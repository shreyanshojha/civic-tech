/**
 * Builds the static data bundle the web and mobile apps read.
 *
 * Run:  npm run export
 *
 * Output: apps/web/public/data/*.json  (and a copy for the mobile app)
 *
 * Everything the apps show is computed HERE, at build time, and shipped as
 * plain JSON. There is no query API, no server, no database connection from the
 * client. That is a deliberate architectural constraint: the apps must be
 * deployable as a folder of static files, so that running this project costs
 * nobody anything and depends on nobody staying online.
 *
 * The bundle is split into several files so the apps can lazy-load:
 *   index.json        counts, coverage notes, generation metadata
 *   industries.json   the taxonomy
 *   legislators.json  every current member + their donor profile summary
 *   bills.json        bill list (search index payload)
 *   bill-detail/*.json  per-bill detail incl. classification and overlaps
 *   member-detail/*.json per-member detail incl. full donor breakdown
 *   awards.json       federal award context
 *   search.json       a compact global search index over every entity
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DISCLAIMER_LONG,
  DISCLAIMER_MEDIUM,
  DISCLAIMER_SHORT,
  INDUSTRIES,
  OVERLAP_FORMULA,
  computeOverlap,
  findOrdinaryExplanations,
} from '@ftm/core/src';
import type { BillClassification, DonorProfile, IndustryId, OverlapResult } from '@ftm/core/src';
import { CONFIG, MOBILE_DATA_DIR, WEB_DATA_DIR, isMain } from './lib/env.js';
import { db, getMeta } from './lib/db.js';

const now = () => new Date().toISOString();

function writeJson(dir: string, rel: string, data: unknown) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Donor profiles
// ---------------------------------------------------------------------------

/**
 * Aggregates every contribution to a member's linked FEC candidate records into
 * an industry breakdown.
 *
 * Note what is deliberately NOT collapsed away: `nonEmployerAmount` (money with
 * no employer on file) and `unresolvedAmount` (money we failed to place) stay
 * as separate visible figures. Hiding them would make the industry percentages
 * look more authoritative than they are.
 */
function buildDonorProfiles(cycle: number): Map<string, DonorProfile> {
  const rows = db().prepare(`
    SELECT l.bioguide_id                AS bioguide_id,
           c.industry                   AS industry,
           c.industry_method            AS method,
           SUM(c.amount)                AS amount,
           COUNT(*)                     AS n
    FROM contributions c
    JOIN fec_candidates fc ON fc.candidate_id = c.recipient_candidate_id
    JOIN legislators   l  ON l.bioguide_id   = fc.bioguide_id
    WHERE c.cycle = ?
    GROUP BY l.bioguide_id, c.industry, c.industry_method
  `).all(cycle) as { bioguide_id: string; industry: IndustryId; method: string; amount: number; n: number }[];

  const acc = new Map<string, {
    total: number;
    byIndustry: Map<IndustryId, { amount: number; n: number }>;
    nonEmployer: number;
    unresolved: number;
  }>();

  for (const r of rows) {
    let a = acc.get(r.bioguide_id);
    if (!a) { a = { total: 0, byIndustry: new Map(), nonEmployer: 0, unresolved: 0 }; acc.set(r.bioguide_id, a); }
    a.total += r.amount;
    if (r.industry === 'other') {
      if (r.method === 'placeholder') a.nonEmployer += r.amount;
      else a.unresolved += r.amount;
      continue;
    }
    const cur = a.byIndustry.get(r.industry) ?? { amount: 0, n: 0 };
    cur.amount += r.amount;
    cur.n += r.n;
    a.byIndustry.set(r.industry, cur);
  }

  const sourceUrls = new Map<string, string[]>();
  for (const r of db().prepare(`
    SELECT l.bioguide_id AS bio, fc.candidate_id AS cand FROM fec_candidates fc
    JOIN legislators l ON l.bioguide_id = fc.bioguide_id WHERE fc.bioguide_id IS NOT NULL
  `).all() as { bio: string; cand: string }[]) {
    const list = sourceUrls.get(r.bio) ?? [];
    list.push(`https://www.fec.gov/data/candidate/${r.cand}/?cycle=${cycle}`);
    sourceUrls.set(r.bio, list);
  }

  const out = new Map<string, DonorProfile>();
  for (const [bio, a] of acc) {
    const byIndustry = [...a.byIndustry.entries()]
      .map(([industry, v]) => ({ industry, amount: v.amount, share: a.total > 0 ? v.amount / a.total : 0, contributionCount: v.n }))
      .sort((x, y) => y.amount - x.amount);
    const unclassified = a.nonEmployer + a.unresolved;
    out.set(bio, {
      bioguideId: bio,
      cycle,
      totalItemized: a.total,
      byIndustry,
      unclassifiedAmount: unclassified,
      unclassifiedShare: a.total > 0 ? unclassified / a.total : 0,
      nonEmployerAmount: a.nonEmployer,
      unresolvedAmount: a.unresolved,
      sourceUrls: sourceUrls.get(bio) ?? [],
      fetchedAt: now(),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------

interface BillRow {
  id: string; congress: number; bill_type: string; bill_number: string; title: string;
  introduced_date: string | null; latest_action_date: string | null; latest_action_text: string | null;
  policy_area: string | null; subjects: string; sponsor_bioguide_id: string | null;
  cosponsor_bioguide_ids: string; committee_codes: string; committee_names: string;
  official_summary: string | null; congress_dot_gov_url: string; source_url: string; fetched_at: string;
}

interface DonorRow { name: string; industry: string; amount: number; kind: string; sourceUrl: string }

/**
 * Collapses filing artefacts out of the donor table.
 *
 * The OpenFEC by-employer endpoint returns the *employer string a donor typed*,
 * so the raw list contains rows like `NULL`, `NONE`, `RETIRED`, `SELF EMPLOYED`
 * and `NOT EMPLOYED` — with real dollar totals beside them. Rendered in a
 * column headed DONOR, `NULL — $4,500,000` reads as concealment, and a reviewer
 * reading this site as a hostile outsider said exactly that.
 *
 * They are not donors and not concealment: they are thousands of individuals
 * whose filing lists no employer. So they collapse into one clearly-labelled,
 * non-clickable row, and the aggregate is preserved rather than hidden.
 */
const PLACEHOLDER_EMPLOYER = /^(null|none|n\/?a|self|self.?employed|selfemployed|retired|not employed|unemployed|homemaker|requested|information requested|refused|\.|-)$/i;

function collapsePlaceholderDonors(rows: DonorRow[]): (DonorRow & { isAggregate?: boolean })[] {
  const real: DonorRow[] = [];
  let placeholderTotal = 0;
  let placeholderCount = 0;
  for (const r of rows) {
    if (PLACEHOLDER_EMPLOYER.test(String(r.name ?? '').trim())) {
      placeholderTotal += r.amount;
      placeholderCount++;
    } else {
      real.push(r);
    }
  }
  const out: (DonorRow & { isAggregate?: boolean })[] = real.slice(0, 40);
  if (placeholderTotal > 0) {
    out.push({
      name: `No employer listed on the filing (${placeholderCount} filing categories combined)`,
      industry: 'other',
      amount: placeholderTotal,
      kind: 'individual',
      sourceUrl: '',
      isAggregate: true,
    });
    out.sort((a, b) => b.amount - a.amount);
  }
  return out;
}

const parse = <T>(s: string | null | undefined, fb: T): T => {
  if (!s) return fb;
  try { return JSON.parse(s) as T; } catch { return fb; }
};

/**
 * Member portraits.
 *
 * These were previously hotlinked to unitedstates.github.io. That meant every
 * page view told a third party which member the reader was looking at — while
 * the site said "no query leaves this device" and the README said "no
 * telemetry". Both claims were true of the search box and false of the page as
 * a whole.
 *
 * So the portraits are downloaded once, at build time, into the static bundle.
 * The running app then makes no outbound request at all. Set
 * FTM_SKIP_PORTRAITS=1 to skip the download; the UI degrades to initials.
 */
async function fetchPortraits(bioguideIds: string[], dir: string): Promise<{ saved: number; missing: number }> {
  if (process.env.FTM_SKIP_PORTRAITS === '1') {
    console.log('  portraits: skipped (FTM_SKIP_PORTRAITS=1) — the UI will show initials');
    return { saved: 0, missing: bioguideIds.length };
  }
  const outDir = path.join(dir, 'portraits');
  fs.mkdirSync(outDir, { recursive: true });
  let saved = 0, missing = 0;

  for (const [i, id] of bioguideIds.entries()) {
    const file = path.join(outDir, `${id}.jpg`);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) { saved++; continue; }
    try {
      const res = await fetch(`https://unitedstates.github.io/images/congress/225x275/${id}.jpg`, {
        headers: { 'User-Agent': 'follow-the-money (open source civic data tool)' },
      });
      if (!res.ok) { missing++; continue; }
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      saved++;
    } catch {
      missing++;
    }
    if ((i + 1) % 100 === 0) console.log(`    portraits ${i + 1}/${bioguideIds.length}`);
    await new Promise((r) => setTimeout(r, 30));
  }
  return { saved, missing };
}

export async function exportBundle(): Promise<void> {
  const cycle = CONFIG.cycle();
  const outDirs = [WEB_DATA_DIR, MOBILE_DATA_DIR];

  console.log(`\nExporting static data bundle (cycle ${cycle})\n`);

  const industries = INDUSTRIES;

  // --- legislators ---------------------------------------------------------
  const legRows = db().prepare(`
    SELECT bioguide_id, name, first_name, last_name, chamber, state, district, party,
           image_url, official_url, fec_candidate_ids, terms, district_places, source, source_url, fetched_at
    FROM legislators ORDER BY last_name, first_name
  `).all() as any[];

  const committeeRows = db().prepare('SELECT bioguide_id, committee_code, committee_name, role FROM committee_memberships').all() as any[];
  const committeesByMember = new Map<string, { committeeCode: string; committeeName: string; role?: string }[]>();
  for (const c of committeeRows) {
    const list = committeesByMember.get(c.bioguide_id) ?? [];
    list.push({ committeeCode: c.committee_code, committeeName: c.committee_name, role: c.role ?? undefined });
    committeesByMember.set(c.bioguide_id, list);
  }

  const donorProfiles = buildDonorProfiles(cycle);

  const legislators = legRows.map((l) => ({
    bioguideId: l.bioguide_id,
    name: l.name,
    firstName: l.first_name ?? undefined,
    lastName: l.last_name ?? undefined,
    chamber: l.chamber,
    state: l.state,
    district: l.district ?? undefined,
    party: l.party ?? undefined,
    // Rewritten below to a local path once the portrait has been downloaded.
    imageUrl: l.image_url ?? undefined,
    officialUrl: l.official_url ?? undefined,
    fecCandidateIds: parse<string[]>(l.fec_candidate_ids, []),
    // Towns this member keeps a district office in. The only human-readable
    // geography available for a district without shipping map data.
    districtPlaces: parse<string[]>(l.district_places, []),
    source: l.source,
    sourceUrl: l.source_url,
    fetchedAt: l.fetched_at,
    committees: committeesByMember.get(l.bioguide_id) ?? [],
    // Small summary so list views never need the full profile.
    donorSummary: (() => {
      const p = donorProfiles.get(l.bioguide_id);
      if (!p) return null;
      return {
        totalItemized: p.totalItemized,
        top: p.byIndustry.slice(0, 3).map((r) => ({ industry: r.industry, amount: r.amount, share: r.share })),
        // The FULL breakdown, not just the top three. An earlier version shipped
        // only the top three, which meant any page summing sectors across members
        // silently undercounted every sector that spreads small amounts widely.
        byIndustry: p.byIndustry.map((r) => ({ industry: r.industry, amount: r.amount, share: r.share })),
        unclassifiedShare: p.unclassifiedShare,
        unresolvedAmount: p.unresolvedAmount,
        nonEmployerAmount: p.nonEmployerAmount,
      };
    })(),
  }));

  // Download portraits into the web bundle and point the records at the local
  // copies, so the running app makes no outbound request for them.
  const portraits = await fetchPortraits(legislators.map((l) => l.bioguideId), WEB_DATA_DIR);
  for (const l of legislators) {
    const local = path.join(WEB_DATA_DIR, 'portraits', `${l.bioguideId}.jpg`);
    l.imageUrl = fs.existsSync(local) ? `data/portraits/${l.bioguideId}.jpg` : undefined;
  }
  console.log(`  portraits: ${portraits.saved} local, ${portraits.missing} unavailable (those members show initials)`);


  // --- bills + classifications --------------------------------------------
  const billRows = db().prepare(`
    SELECT * FROM bills ORDER BY COALESCE(latest_action_date, introduced_date) DESC
  `).all() as BillRow[];

  const classRows = db().prepare('SELECT * FROM bill_classifications').all() as any[];
  const classifications = new Map<string, BillClassification>(
    classRows.map((c) => [c.bill_id, {
      billId: c.bill_id,
      plainSummary: c.plain_summary,
      industries: parse(c.industries, [] as BillClassification['industries']),
      method: c.method,
      model: c.model,
      inputHash: c.input_hash,
      classifiedAt: c.classified_at,
    }]),
  );

  // --- votes ---------------------------------------------------------------
  const voteRows = db().prepare('SELECT * FROM votes ORDER BY date DESC').all() as any[];
  const votes = voteRows.map((v) => ({
    id: v.id, billId: v.bill_id ?? undefined, chamber: v.chamber, congress: v.congress,
    session: v.session, rollNumber: v.roll_number, date: v.date, question: v.question,
    result: v.result, positions: parse(v.positions, [] as any[]),
    source: v.source, sourceUrl: v.source_url, fetchedAt: v.fetched_at,
  }));

  // --- awards --------------------------------------------------------------
  // Selecting purely by size returns nothing but multi-billion-dollar block
  // grants, which is a badly skewed picture of federal spending. Take the
  // largest awards AND a per-sector and per-agency spread so smaller, more
  // typical contracts are represented too.
  const awardRows = db().prepare(`
    WITH ranked AS (
      SELECT *,
             ROW_NUMBER() OVER (ORDER BY amount DESC)                         AS overall_rank,
             ROW_NUMBER() OVER (PARTITION BY industry        ORDER BY amount DESC) AS sector_rank,
             ROW_NUMBER() OVER (PARTITION BY awarding_agency ORDER BY amount DESC) AS agency_rank
      FROM awards
    )
    SELECT * FROM ranked
    WHERE overall_rank <= 1200 OR sector_rank <= 120 OR agency_rank <= 60
    ORDER BY amount DESC
  `).all() as any[];

  // USASpending returns one row per award *modification*, so the same award can
  // appear many times with the same obligated total. Summing them produces a
  // headline figure several times larger than the money actually involved.
  // Collapse on the natural key before anything downstream sees them.
  const seenAward = new Set<string>();
  const dedupedAwardRows = awardRows.filter((a) => {
    const key = [a.recipient_name, a.amount, a.action_date, a.awarding_agency, a.naics_code].join('|');
    if (seenAward.has(key)) return false;
    seenAward.add(key);
    return true;
  });
  const awardDuplicatesDropped = awardRows.length - dedupedAwardRows.length;
  /**
   * Awards that must never be attributed to a congressional district.
   *
   * USASpending records a recipient's HQ district, not where the money is
   * spent. For a state agency that means an entire state's Medicaid entitlement
   * lands in whichever district holds the agency's mailing address.
   */
  const isStatewidePassThrough = (a: any): boolean => {
    const name = String(a.recipient_name ?? '').toUpperCase();
    const type = String(a.award_type ?? '').toUpperCase();
    if (/BLOCK GRANT|ENTITLEMENT|FORMULA GRANT/.test(type)) return true;
    if (/\b(STATE OF|COMMONWEALTH OF|DEPARTMENT OF|DEPT OF)\b/.test(name) && /GRANT/.test(type)) return true;
    if (/\bCALIFORNIA DEPARTMENT|STATE CONTROLLER|STATE TREASURER\b/.test(name)) return true;
    return false;
  };

  const awards = dedupedAwardRows.map((a) => ({
    id: a.id, recipientName: a.recipient_name, recipientParentName: a.recipient_parent_name ?? undefined,
    awardType: a.award_type, amount: a.amount, actionDate: a.action_date,
    awardingAgency: a.awarding_agency ?? undefined, awardingSubAgency: a.awarding_sub_agency ?? undefined,
    recipientState: a.recipient_state ?? undefined,
    recipientCongressionalDistrict: a.recipient_congressional_district ?? undefined,
    naicsCode: a.naics_code ?? undefined, naicsDescription: a.naics_description ?? undefined,
    industry: a.industry, industryMethod: a.industry_method, description: a.description ?? undefined,
    source: a.source, sourceUrl: a.source_url, fetchedAt: a.fetched_at,
  }));

  /**
   * The subset of awards it is defensible to show under a member's name:
   * inside the current Congress's window, not in the future, and not a
   * statewide pass-through geocoded to an agency's mailing address.
   */
  const AWARD_WINDOW_START = `${CONFIG.cycle() - 6}-01-01`;
  const todayIso = new Date().toISOString().slice(0, 10);
  const districtEligibleAwards = awards.filter((a) => {
    const d = String(a.actionDate ?? '');
    if (!d || d < AWARD_WINDOW_START || d > todayIso) return false;
    return !isStatewidePassThrough({ recipient_name: a.recipientName, award_type: a.awardType });
  });

  // --- overlaps ------------------------------------------------------------
  const overlaps: OverlapResult[] = [];
  const overlapsByBill = new Map<string, OverlapResult[]>();
  const overlapsByMember = new Map<string, OverlapResult[]>();

  for (const b of billRows) {
    const cls = classifications.get(b.id);
    if (!cls || cls.industries.length === 0) continue;
    const involved = new Set<string>();
    if (b.sponsor_bioguide_id) involved.add(b.sponsor_bioguide_id);
    for (const c of parse<string[]>(b.cosponsor_bioguide_ids, [])) involved.add(c);
    // Committee members with jurisdiction over the bill are the other half of
    // the "who touched this" question, per the project's design.
    for (const code of parse<string[]>(b.committee_codes, [])) {
      for (const m of committeeRows) if (m.committee_code === code) involved.add(m.bioguide_id);
    }

    const list: OverlapResult[] = [];
    for (const bio of involved) {
      const profile = donorProfiles.get(bio);
      if (!profile || profile.totalItemized <= 0) continue;
      const r = computeOverlap(cls, profile);
      if (r.matches.length === 0) continue;
      list.push(r);
      overlaps.push(r);
      const byMember = overlapsByMember.get(bio) ?? [];
      byMember.push(r);
      overlapsByMember.set(bio, byMember);
    }
    list.sort((a, z) => z.score - a.score);
    overlapsByBill.set(b.id, list);
  }

  /**
   * The two things that turn a bare percentage into something a reader can
   * actually judge, both computed here so the UI never has to derive them:
   *
   *  1. WHERE IT SITS. A 28% means nothing on its own. Against a distribution
   *     it means "about average", which is the single most useful sentence you
   *     can put next to a number — and the one most likely to stop someone
   *     reading a routine figure as a scandal.
   *  2. WHY IT IS PROBABLY BORING. Committee seat, sponsorship, a sector that
   *     dominates the whole state's delegation, or a denominator so small the
   *     percentage is an artefact. All read off the record, never inferred.
   */
  const sortedScores = overlaps.map((o) => o.score).sort((a, b) => a - b);
  const medianScore = sortedScores.length
    ? sortedScores[Math.floor(sortedScores.length / 2)]!
    : 0;
  const percentileOf = (score: number): number => {
    if (sortedScores.length === 0) return 0;
    let lo = 0, hi = sortedScores.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedScores[mid]! < score) lo = mid + 1; else hi = mid;
    }
    return (lo / sortedScores.length) * 100;
  };
  const distribution = { median: medianScore, n: sortedScores.length };

  // Which sector tops each state delegation's donor list, and how often.
  const topSectorByState = new Map<string, Map<string, number>>();
  for (const l of legislators) {
    const top = l.donorSummary?.top?.[0]?.industry;
    if (!top) continue;
    const forState = topSectorByState.get(l.state) ?? new Map<string, number>();
    forState.set(top, (forState.get(top) ?? 0) + 1);
    topSectorByState.set(l.state, forState);
  }
  const stateDelegationSize = new Map<string, number>();
  for (const l of legislators) stateDelegationSize.set(l.state, (stateDelegationSize.get(l.state) ?? 0) + 1);

  const committeeCodesByMember = new Map<string, Set<string>>();
  for (const c of committeeRows) {
    const set = committeeCodesByMember.get(c.bioguide_id) ?? new Set<string>();
    set.add(c.committee_code);
    committeeCodesByMember.set(c.bioguide_id, set);
  }
  const committeeNameByCode = new Map(committeeRows.map((c) => [c.committee_code, c.committee_name]));

  function meaningFactsFor(
    o: OverlapResult,
    bill: BillRow,
    role: string | null,
  ) {
    const member = legByBio.get(o.bioguideId);
    const profile = donorProfiles.get(o.bioguideId);
    const billCommittees = parse<string[]>(bill.committee_codes, []);
    const memberCommittees = committeeCodesByMember.get(o.bioguideId) ?? new Set<string>();
    // A member sits on a committee of jurisdiction if any of the bill's
    // committee codes — or their parent full-committee code — matches.
    const matchedCode = billCommittees.find(
      (code) => memberCommittees.has(code) || [...memberCommittees].some((mc) => mc.startsWith(code.slice(0, 4))),
    );
    const topIndustry = o.matches[0]?.industry ?? null;
    const stateTop = member ? topSectorByState.get(member.state) : undefined;

    return {
      percentile: percentileOf(o.score),
      median: distribution.median,
      n: distribution.n,
      ordinary: findOrdinaryExplanations({
        role,
        onCommitteeOfJurisdiction: Boolean(matchedCode),
        committeeName: matchedCode ? committeeNameByCode.get(matchedCode) ?? null : null,
        topIndustry,
        state: member?.state ?? null,
        stateColleaguesWithSameTopSector: topIndustry && stateTop ? Math.max(0, (stateTop.get(topIndustry) ?? 0) - 1) : 0,
        stateColleagueCount: member ? stateDelegationSize.get(member.state) ?? 0 : 0,
        totalDisclosed: profile?.totalItemized ?? 0,
      }),
      unattributedShare: profile?.unclassifiedShare ?? 0,
    };
  }

  // --- per-bill detail files ----------------------------------------------
  const legByBio = new Map(legislators.map((l) => [l.bioguideId, l]));
  const billSummaries = billRows.map((b) => {
    const cls = classifications.get(b.id);
    const list = overlapsByBill.get(b.id) ?? [];
    return {
      id: b.id,
      congress: b.congress,
      billType: b.bill_type,
      billNumber: b.bill_number,
      title: b.title,
      introducedDate: b.introduced_date ?? undefined,
      latestActionDate: b.latest_action_date ?? undefined,
      latestActionText: b.latest_action_text ?? undefined,
      policyArea: b.policy_area ?? undefined,
      subjects: parse<string[]>(b.subjects, []).slice(0, 12),
      sponsorBioguideId: b.sponsor_bioguide_id ?? undefined,
      cosponsorCount: parse<string[]>(b.cosponsor_bioguide_ids, []).length,
      committeeNames: parse<string[]>(b.committee_names, []),
      congressDotGovUrl: b.congress_dot_gov_url,
      industries: cls?.industries.map((i) => ({ industry: i.industry, confidence: i.confidence, rationale: i.rationale })) ?? [],
      plainSummary: cls?.plainSummary?.slice(0, 900) ?? null,
      classificationMethod: cls?.method ?? null,
      topOverlap: list[0] ? { bioguideId: list[0].bioguideId, score: list[0].score } : null,
      overlapCount: list.length,
    };
  });

  for (const b of billRows) {
    const cls = classifications.get(b.id);
    const list = overlapsByBill.get(b.id) ?? [];
    writeJson(WEB_DATA_DIR, `bill/${b.id}.json`, {
      bill: {
        id: b.id, congress: b.congress, billType: b.bill_type, billNumber: b.bill_number,
        title: b.title, introducedDate: b.introduced_date ?? undefined,
        latestActionDate: b.latest_action_date ?? undefined, latestActionText: b.latest_action_text ?? undefined,
        policyArea: b.policy_area ?? undefined, subjects: parse<string[]>(b.subjects, []),
        sponsorBioguideId: b.sponsor_bioguide_id ?? undefined,
        cosponsorBioguideIds: parse<string[]>(b.cosponsor_bioguide_ids, []),
        committeeCodes: parse<string[]>(b.committee_codes, []),
        committeeNames: parse<string[]>(b.committee_names, []),
        officialSummary: b.official_summary ?? undefined,
        congressDotGovUrl: b.congress_dot_gov_url,
        source: 'congress', sourceUrl: b.source_url, fetchedAt: b.fetched_at,
      },
      classification: cls ?? null,
      overlaps: list.map((o) => ({
        ...o,
        member: legByBio.get(o.bioguideId)
          ? {
              name: legByBio.get(o.bioguideId)!.name,
              chamber: legByBio.get(o.bioguideId)!.chamber,
              state: legByBio.get(o.bioguideId)!.state,
              district: legByBio.get(o.bioguideId)!.district,
              imageUrl: legByBio.get(o.bioguideId)!.imageUrl,
              role: b.sponsor_bioguide_id === o.bioguideId ? 'Sponsor'
                : parse<string[]>(b.cosponsor_bioguide_ids, []).includes(o.bioguideId) ? 'Cosponsor'
                : 'Committee member',
            }
          : null,
        donorProfile: donorProfiles.get(o.bioguideId) ?? null,
        meaning: meaningFactsFor(
          o,
          b,
          b.sponsor_bioguide_id === o.bioguideId ? 'Sponsor'
            : parse<string[]>(b.cosponsor_bioguide_ids, []).includes(o.bioguideId) ? 'Cosponsor'
            : 'Committee member',
        ),
      })),
      votes: votes.filter((v) => v.billId === b.id).map((v) => ({ ...v, positions: v.positions.length })),
      disclaimer: DISCLAIMER_MEDIUM,
    });
  }

  // --- per-member detail files --------------------------------------------
  for (const l of legislators) {
    const profile = donorProfiles.get(l.bioguideId) ?? null;
    const memberOverlaps = (overlapsByMember.get(l.bioguideId) ?? []).sort((a, z) => z.score - a.score).slice(0, 60);
    const billById = new Map(billSummaries.map((b) => [b.id, b]));
    const billRowById = new Map(billRows.map((b) => [b.id, b]));
    writeJson(WEB_DATA_DIR, `member/${l.bioguideId}.json`, {
      member: l,
      donorProfile: profile,
      topDonors: profile
        ? collapsePlaceholderDonors(db().prepare(`
            SELECT c.contributor_name AS name, c.industry AS industry, SUM(c.amount) AS amount,
                   c.contributor_kind AS kind, c.source_url AS sourceUrl
            FROM contributions c
            JOIN fec_candidates fc ON fc.candidate_id = c.recipient_candidate_id
            WHERE fc.bioguide_id = ? AND c.cycle = ?
            GROUP BY c.contributor_name, c.industry
            ORDER BY amount DESC LIMIT 60
          `).all(l.bioguideId, cycle) as DonorRow[])
        : [],
      overlaps: memberOverlaps.map((o) => {
        const row = billRowById.get(o.billId);
        return {
          ...o,
          bill: billById.get(o.billId) ?? null,
          meaning: row
            ? meaningFactsFor(
                o,
                row,
                row.sponsor_bioguide_id === o.bioguideId ? 'Sponsor'
                  : parse<string[]>(row.cosponsor_bioguide_ids, []).includes(o.bioguideId) ? 'Cosponsor'
                  : 'Committee member',
              )
            : null,
        };
      }),
      votes: votes
        .map((v) => {
          const pos = (v.positions as any[]).find((p) => p.bioguideId === l.bioguideId);
          return pos ? { id: v.id, billId: v.billId, date: v.date, question: v.question, result: v.result, position: pos.position, sourceUrl: v.sourceUrl } : null;
        })
        .filter(Boolean)
        .slice(0, 40),
      // Awards are filtered before they reach a member's page. Two errors were
      // shipping here: awards dated 1997 and 2028 shown as money spent in a
      // district under a member elected in 2014, and statewide Medicaid
      // entitlement transfers geocoded to a state agency's headquarters, which
      // produced "Federal money spent in CA-7 — $527.9 billion" (roughly
      // $694,000 per resident, and more than California's entire state budget).
      districtAwards: l.district
        ? districtEligibleAwards.filter((a) => a.recipientState === l.state && String(a.recipientCongressionalDistrict ?? '') === String(l.district).padStart(2, '0')).slice(0, 25)
        : districtEligibleAwards.filter((a) => a.recipientState === l.state).slice(0, 25),
      disclaimer: DISCLAIMER_MEDIUM,
    });
  }

  // --- global search index -------------------------------------------------
  const searchIndex = [
    ...legislators.map((l) => ({
      t: 'member' as const,
      id: l.bioguideId,
      label: l.name,
      sub: `${l.chamber === 'Senate' ? 'Sen.' : 'Rep.'} ${l.state}${l.district ? `-${l.district}` : ''}`,
      terms: [l.name, l.lastName ?? '', l.state, l.party ?? '', ...(l.committees ?? []).map((c) => c.committeeName)].join(' ').toLowerCase(),
    })),
    ...billSummaries.map((b) => ({
      t: 'bill' as const,
      id: b.id,
      label: `${b.billType.toUpperCase()} ${b.billNumber}`,
      sub: b.title.slice(0, 150),
      terms: [b.title, b.policyArea ?? '', b.subjects.join(' '), b.committeeNames.join(' ')].join(' ').toLowerCase(),
    })),
    ...industries.map((i) => ({
      t: 'industry' as const, id: i.id, label: i.label, sub: i.blurb,
      terms: `${i.label} ${i.blurb}`.toLowerCase(),
    })),
    ...[...new Map(awards.map((a) => [a.recipientName, a])).values()].slice(0, 800).map((a) => ({
      t: 'recipient' as const, id: a.id, label: a.recipientName,
      sub: `Federal award recipient · ${a.awardingAgency ?? 'federal agency'}`,
      terms: `${a.recipientName} ${a.naicsDescription ?? ''} ${a.awardingAgency ?? ''}`.toLowerCase(),
    })),
  ];

  // --- featured overlaps ---------------------------------------------------
  /**
   * The home page used to show the global top-6 overlaps by score. A review
   * found that list was 6 out of 6 from one party, and that it was dominated by
   * two artefacts rather than by anything meaningful:
   *
   *  1. SMALL DENOMINATORS. The score is a *share*. A member who refuses
   *     corporate PAC money entirely can have a total intake of $25,000, so one
   *     ordinary $20,000 union contribution scores 80% — mechanically the
   *     highest number in the country, and a statement about almost nothing.
   *  2. REPETITION. A single widely-cosponsored resolution supplied 52 of the
   *     top 100 rows, because every cosponsor generates its own pair.
   *
   * The fix is not to hand-balance the list by party — that would be its own
   * kind of thumb on the scale. It is to remove the artefacts: require a
   * meaningful denominator, show each member and each bill at most once, and
   * exclude measures with no substantive sector. Whatever party distribution
   * survives that is the one the data actually supports.
   */
  const MIN_DISCLOSED_FOR_FEATURE = Number(process.env.FTM_FEATURE_MIN_DISCLOSED ?? 100_000);
  const featured = (() => {
    const seenMember = new Set<string>();
    const seenBill = new Set<string>();
    const out: (OverlapResult & { featureNote: string })[] = [];
    for (const o of [...overlaps].sort((a, b) => b.score - a.score)) {
      const profile = donorProfiles.get(o.bioguideId);
      if (!profile || profile.totalItemized < MIN_DISCLOSED_FOR_FEATURE) continue;
      if (seenMember.has(o.bioguideId) || seenBill.has(o.billId)) continue;
      seenMember.add(o.bioguideId);
      seenBill.add(o.billId);
      out.push({
        ...o,
        featureNote:
          'Selected because the member has a substantial disclosed total, so the share is not a small-denominator artefact. Each member and each bill appears at most once. This is not a ranking of members.',
      });
      if (out.length >= 12) break;
    }
    return out;
  })();

  // --- sector totals -------------------------------------------------------
  // Computed here, once, from the full donor profiles. Pages must use this file
  // rather than re-deriving totals from truncated per-member summaries.
  const sectorTotals = (() => {
    const money = new Map<IndustryId, { amount: number; members: number }>();
    for (const p of donorProfiles.values()) {
      for (const r of p.byIndustry) {
        const cur = money.get(r.industry) ?? { amount: 0, members: 0 };
        cur.amount += r.amount;
        cur.members += 1;
        money.set(r.industry, cur);
      }
    }
    const billCounts = new Map<IndustryId, number>();
    for (const c of classifications.values()) {
      for (const i of c.industries) billCounts.set(i.industry, (billCounts.get(i.industry) ?? 0) + 1);
    }
    const awardTotals = new Map<IndustryId, { amount: number; count: number }>();
    for (const a of awards) {
      const cur = awardTotals.get(a.industry as IndustryId) ?? { amount: 0, count: 0 };
      cur.amount += a.amount; cur.count += 1;
      awardTotals.set(a.industry as IndustryId, cur);
    }
    return industries.map((i) => ({
      industry: i.id,
      disclosedToSittingMembers: Math.round(money.get(i.id)?.amount ?? 0),
      membersReceiving: money.get(i.id)?.members ?? 0,
      billsTagged: billCounts.get(i.id) ?? 0,
      awardAmount: Math.round(awardTotals.get(i.id)?.amount ?? 0),
      awardCount: awardTotals.get(i.id)?.count ?? 0,
    })).sort((a, b) => b.disclosedToSittingMembers - a.disclosedToSittingMembers);
  })();

  // --- coverage notes ------------------------------------------------------
  const attributable = [...donorProfiles.values()].reduce((sum, p) => sum + p.totalItemized, 0);

  /**
   * PLAUSIBILITY GUARD.
   *
   * A single member's reported receipts once reached $81.9M in this pipeline —
   * 2.8x the next-highest figure — because party-committee money had been
   * attributed to their personal campaign. It shipped, under their photograph,
   * labelled "exact figure". Nothing caught it, because nothing was looking.
   *
   * So now something looks. A member whose total is a wild outlier is far more
   * likely to be an attribution bug than a record-breaking fundraiser, and a
   * false dollar figure attached to a named person is the single worst thing
   * this project can output. Loud warning, and a hard failure when it is
   * egregious.
   */
  {
    const totals = [...donorProfiles.values()].map((p) => p.totalItemized).sort((a, b) => a - b);
    if (totals.length > 20) {
      const p99 = totals[Math.floor(totals.length * 0.99)]!;
      const ceiling = p99 * 3;

      /**
       * Size alone is not the test — the CAUSE is.
       *
       * A genuine record-breaking fundraiser is an outlier and perfectly real;
       * one member in this dataset raised $29M through their own principal
       * campaign committee, almost all of it small-dollar. Failing the build on
       * that would be punishing the data for being true.
       *
       * What is never legitimate is an outlier whose money arrives through a
       * committee that is not the member's own principal campaign committee.
       * That is the party/joint-fundraising misattribution bug. So: warn on any
       * outlier, but only refuse to publish when a non-principal committee is
       * feeding it.
       */
      const badCommittee = db().prepare(`
        SELECT DISTINCT fc.bioguide_id AS bio, cm.name AS cmte, cm.designation AS dsgn, cm.committee_type AS type
        FROM contributions c
        JOIN fec_candidates fc ON fc.candidate_id = c.recipient_candidate_id
        JOIN fec_committees cm ON cm.committee_id = c.recipient_committee_id
        WHERE fc.bioguide_id IS NOT NULL
          AND c.contributor_kind = 'individual'
          AND (cm.designation != 'P' OR cm.committee_type IN ('X','Y','Z'))
      `).all() as { bio: string; cmte: string; dsgn: string; type: string }[];
      const badByMember = new Map(badCommittee.map((b) => [b.bio, b]));

      let fatal = 0;
      for (const [bio, p] of donorProfiles) {
        if (p.totalItemized <= ceiling) continue;
        const who = legislators.find((l) => l.bioguideId === bio);
        const bad = badByMember.get(bio);
        if (bad) {
          fatal++;
          console.error(
            `  MISATTRIBUTION: ${who?.name ?? bio} = $${Math.round(p.totalItemized).toLocaleString()} includes money from ` +
              `"${bad.cmte}" (designation ${bad.dsgn}, type ${bad.type}), which is not their principal campaign committee.`,
          );
        } else {
          console.warn(
            `  Large total (checked, looks genuine): ${who?.name ?? bio} = $${Math.round(p.totalItemized).toLocaleString()}, ` +
              `over 3x the 99th percentile ($${Math.round(p99).toLocaleString()}). All of it arrives through their own ` +
              `principal campaign committee, so this is reported as-is.`,
          );
        }
      }
      if (fatal > 0 && process.env.FTM_ALLOW_OUTLIERS !== '1') {
        throw new Error(
          `Refusing to export: ${fatal} member total(s) include money from a committee that is not their own. ` +
            `Publishing a wrong dollar figure under a named person's photograph is not recoverable. ` +
            `Fix the committee linkage, or set FTM_ALLOW_OUTLIERS=1 if you have verified the figures.`,
        );
      }
    }
  }

  const contribStats = db().prepare(`
    SELECT COUNT(*) n, COALESCE(SUM(amount),0) total,
           COALESCE(SUM(CASE WHEN industry='other' THEN amount END),0) unresolved,
           COALESCE(SUM(CASE WHEN industry='super-pac-unattributed' THEN amount END),0) superpac,
           COALESCE(SUM(CASE WHEN contributor_kind='individual' THEN amount END),0) individual
    FROM contributions WHERE cycle = ?`).get(cycle) as any;

  // The label has to describe what is ACTUALLY in the bundle. Saying "plus
  // individual donations" when two members out of five hundred have them
  // describes a dataset that does not exist.
  const individualCoverage = db().prepare(`
    SELECT COUNT(DISTINCT fc.bioguide_id) AS n FROM contributions c
    JOIN fec_candidates fc ON fc.candidate_id = c.recipient_candidate_id
    WHERE c.contributor_kind = 'individual' AND c.cycle = ? AND fc.bioguide_id IS NOT NULL
  `).get(cycle) as { n: number };
  const coverageRatio = individualCoverage.n / Math.max(1, donorProfiles.size);
  const moneyLabel =
    coverageRatio >= 0.9
      ? 'disclosed FEC contributions: committee (PAC) money and individual donations aggregated by employer'
      : coverageRatio > 0
        ? `disclosed FEC committee (PAC) contributions; individual-donor detail for only ${individualCoverage.n} of ${donorProfiles.size} members`
        : 'disclosed FEC committee (PAC) contributions only — no individual-donor money in this bundle';

  const coverageNotes = [
    `The money shown is ${moneyLabel}. Independent expenditures — outside spending for or against a candidate — are excluded entirely, because they are not contributions a campaign receives or controls.`,
    `Federal award figures are the sum of the awards listed in this bundle, after collapsing duplicate award modifications (${awardDuplicatesDropped} dropped). They are a sample of federal spending, not a total, and are shown as context only.`,
    `Of $${Math.round(contribStats.total).toLocaleString()} in disclosed contributions this cycle, $${Math.round(attributable).toLocaleString()} resolves to a current member of Congress. The remainder went to challengers, retiring members and candidates for seats nobody in this dataset holds, and is not attributed to anyone here.`,
    `Campaign finance covers FEC cycle ${cycle} and includes only money disclosed to the FEC. It does not include dark money, 501(c)(4) spending, lobbying expenditure, bundling, or anything below the itemization threshold.`,
    `$${Math.round(contribStats.superpac).toLocaleString()} of the money shown came from independent-expenditure committees whose own donors are disclosed in a separate filing this pipeline does not traverse. It is labelled "funding source not visible" rather than assigned to an industry.`,
    (() => {
      const split = db().prepare(`
        SELECT COALESCE(SUM(CASE WHEN industry_method = 'placeholder' THEN amount END), 0) AS no_employer,
               COALESCE(SUM(CASE WHEN industry = 'other' AND industry_method != 'placeholder' THEN amount END), 0) AS unresolved
        FROM contributions WHERE cycle = ?`).get(cycle) as { no_employer: number; unresolved: number };
      const pct = (n: number) => `${((n / Math.max(1, contribStats.total)) * 100).toFixed(1)}%`;
      return (
        `Money with no sector attached splits two ways, and the difference matters. ` +
        `$${Math.round(split.no_employer).toLocaleString()} (${pct(split.no_employer)}) comes from filings that list no employer at all — "retired", "self-employed", "not employed" — so there is nothing for anyone to classify. ` +
        `A further $${Math.round(split.unresolved).toLocaleString()} (${pct(split.unresolved)}) names an employer this tool could not place, which is a genuine coverage gap. ` +
        `Both are excluded from every overlap score.`
      );
    })(),
    (() => {
      const covered = db().prepare(`
        SELECT COUNT(DISTINCT fc.bioguide_id) AS n FROM contributions c
        JOIN fec_candidates fc ON fc.candidate_id = c.recipient_candidate_id
        WHERE c.contributor_kind = 'individual' AND c.cycle = ? AND fc.bioguide_id IS NOT NULL
      `).get(cycle) as { n: number };
      if (covered.n === 0) {
        return `Individual-donor detail is NOT in this bundle — it requires a free OpenFEC API key. Only committee (PAC) money is present, which is roughly half the disclosed picture.`;
      }
      const ratio = covered.n / Math.max(1, donorProfiles.size);
      if (ratio >= 0.95) {
        return `Individual-donor detail covers ${covered.n} of ${donorProfiles.size} members. The ${donorProfiles.size - covered.n} without it show committee (PAC) money only, so their totals will look smaller than they are.`;
      }
      return `Individual-donor detail covers only ${covered.n} of ${donorProfiles.size} members with donor data. For the rest, the figures are committee (PAC) money alone, so totals are NOT comparable between members. Raise FTM_MAX_MEMBERS and re-run with an OpenFEC key for even coverage.`;
    })(),
    getMeta('classify_method')?.startsWith('llm')
      ? `Bills were classified by ${getMeta('classify_method')}.`
      : `Bills were classified by the offline keyword classifier, not by a language model. Industry tags are correspondingly rough. Set LLM_PROVIDER in .env to improve them.`,
    votes.length === 0
      ? `Roll-call vote positions are not in this bundle — they require a free Congress.gov API key.`
      : `${votes.length} House roll-call votes included.`,
  ];

  const index = {
    generatedAt: now(),
    isSample: false,
    cycle,
    congress: CONFIG.congress(),
    counts: {
      legislators: legislators.length,
      bills: billSummaries.length,
      classifications: classifications.size,
      contributions: contribStats.n,
      contributionDollars: Math.round(contribStats.total),
      // Money that resolves to a CURRENT member of Congress. Always smaller than
      // the total, because the FEC cycle also contains challengers, retirees and
      // candidates for seats nobody in this dataset holds. Reporting only the
      // larger number would make every per-member figure look like it was
      // missing money.
      contributionDollarsToSittingMembers: Math.round(attributable),
      membersWithDonorData: donorProfiles.size,
      awardsListed: awards.length,
      awardDollarsListed: Math.round(awards.reduce((sum, a) => sum + a.amount, 0)),
      awardDuplicatesDropped,
      featured: featured.length,
      overlaps: overlaps.length,
      votes: votes.length,
      awards: awards.length,
      committeeSeats: committeeRows.length,
    },
    sources: {
      openfec: getMeta('fec_mode') ?? 'bulk',
      congress: getMeta('congress_mode') ?? 'bulk',
      classification: getMeta('classify_method') ?? 'keyword-fallback',
      lastRun: {
        fec: getMeta('fec_last_run'),
        congress: getMeta('congress_last_run'),
        classify: getMeta('classify_last_run'),
      },
    },
    overlapFormula: OVERLAP_FORMULA,
    overlapDistribution: { median: distribution.median, n: distribution.n },
    moneyLabel,
    disclaimers: { short: DISCLAIMER_SHORT, medium: DISCLAIMER_MEDIUM, long: DISCLAIMER_LONG },
    coverageNotes,
  };

  for (const dir of outDirs) {
    writeJson(dir, 'index.json', index);
    writeJson(dir, 'industries.json', industries);
    writeJson(dir, 'legislators.json', legislators);
    writeJson(dir, 'bills.json', billSummaries);
    writeJson(dir, 'awards.json', awards);
    writeJson(dir, 'search.json', searchIndex);
    writeJson(dir, 'sector-totals.json', sectorTotals);
    // Previously sliced to the top 2000, while index.json reported the true
    // count — so every aggregate view was computed on a top-score-truncated
    // sample while claiming completeness. Ship them all.
    writeJson(dir, 'overlaps.json', overlaps.sort((a, b) => b.score - a.score));
    writeJson(dir, 'featured.json', featured);
  }

  const bytes = (dir: string) => {
    let total = 0;
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p); else total += fs.statSync(p).size;
      }
    };
    if (fs.existsSync(dir)) walk(dir);
    return total;
  };

  console.log(`  legislators   ${index.counts.legislators}`);
  console.log(`  bills         ${index.counts.bills} (${index.counts.classifications} classified)`);
  console.log(`  contributions ${index.counts.contributions} ($${index.counts.contributionDollars.toLocaleString()})`);
  console.log(`  overlaps      ${index.counts.overlaps}`);
  console.log(`  awards        ${index.counts.awards}`);
  console.log(`  search index  ${searchIndex.length} entries`);
  console.log(`\n  Bundle size: ${(bytes(WEB_DATA_DIR) / 1e6).toFixed(1)} MB in apps/web/public/data\n`);
  for (const note of coverageNotes) console.log(`  · ${note}`);
  console.log('');
}

if (isMain(import.meta.url)) {
  exportBundle().catch((err) => {
    console.error(`\nExport failed: ${err.message}\n`);
    process.exit(1);
  });
}
