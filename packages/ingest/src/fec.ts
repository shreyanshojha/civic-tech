/**
 * OpenFEC ingestion — campaign finance.
 *
 *   fetch -> normalize -> store (local SQLite)
 *
 * Run:  npm run ingest:fec
 *
 * ---------------------------------------------------------------------------
 * TWO SOURCES, BOTH REAL
 *
 * 1. BULK (always runs, no API key required)
 *    The FEC publishes pipe-delimited bulk files with no key and no rate limit.
 *    We read the candidate master, committee master, candidate/committee
 *    linkage, and — the important one — every contribution FROM a committee TO
 *    a candidate for the cycle. Committee money is also the *easier* money to
 *    classify by industry, because a PAC's name and connected organisation
 *    usually say plainly what industry it represents.
 *
 * 2. API (only if FEC_API_KEY is set)
 *    Adds individual-donor money, aggregated by employer, for the members you
 *    actually have bills for. Individual money is where the free-text employer
 *    strings live, so this is the noisier half of the data.
 *
 * You get a working, honest dataset with no key at all. A free key makes it
 * more complete. Nothing in this repo ever ships or falls back to someone
 * else's key.
 * ---------------------------------------------------------------------------
 *
 * Idempotency: every row's primary key is a deterministic hash of its natural
 * key and every write is an upsert. Re-run as often as you like.
 *
 * LIMITATION, restated because it shapes everything downstream: this only ever
 * sees itemized, disclosed HARD money reported to the FEC. Money below the
 * itemization threshold, 501(c)(4) spending, and undisclosed money are all
 * invisible here. See LIMITATIONS.md.
 */

import { classifyTextToIndustry, lookupOrg } from '@ftm/core/src';
import type { IndustryId } from '@ftm/core/src';
import { CONFIG, isMain, optionalKey } from './lib/env.js';
import { getJson, stableId } from './lib/http.js';
import { db, j, setMeta, upsert } from './lib/db.js';
import { CCL, CM, CN, ORG_TYPE_HINT, PARTY_LEADERSHIP_CMTE_TYPES, PARTY_COMMITTEE_TYPES, SUPER_PAC_CMTE_TYPES, PAS2, INDEPENDENT_EXPENDITURE_TX_TYPES, fecDate, readBulk } from './lib/fecbulk.js';

const API = 'https://api.open.fec.gov/v1';
const now = () => new Date().toISOString();

const candidatePublicUrl = (id: string, cycle: number) => `https://www.fec.gov/data/candidate/${id}/?cycle=${cycle}`;
const committeePublicUrl = (id: string, cycle: number) => `https://www.fec.gov/data/committee/${id}/?cycle=${cycle}`;

type Method = 'keyword' | 'llm' | 'committee-type' | 'placeholder' | 'unassigned';

// ---------------------------------------------------------------------------
// Employer / organisation -> industry, with a permanent on-disk cache
// ---------------------------------------------------------------------------

function resolveIndustry(...texts: (string | undefined | null)[]): { industry: IndustryId; confidence: number; method: Method } {
  const joined = texts.filter(Boolean).join(' | ').trim();
  const norm = joined.toUpperCase();
  if (!norm) return { industry: 'other', confidence: 0, method: 'placeholder' };

  const cached = db()
    .prepare('SELECT industry, confidence, method FROM employer_industry_cache WHERE normalized_employer = ?')
    .get(norm) as { industry: IndustryId; confidence: number; method: Method } | undefined;
  if (cached) return cached;

  // Curated organisation knowledge first — it encodes facts a regex cannot
  // know (that "Defend American Jobs" is a crypto-industry committee, say).
  const known = lookupOrg(joined);
  if (known) {
    db().prepare(
      `INSERT INTO employer_industry_cache (normalized_employer, industry, confidence, method, model, resolved_at)
       VALUES (?, ?, ?, 'keyword', NULL, ?) ON CONFLICT(normalized_employer) DO NOTHING`,
    ).run(norm, known.industry, known.confidence, now());
    return { industry: known.industry, confidence: known.confidence, method: 'keyword' };
  }

  const m = classifyTextToIndustry(joined);
  const method: Method = m.placeholder ? 'placeholder' : m.confidence > 0 ? 'keyword' : 'unassigned';
  db().prepare(
    `INSERT INTO employer_industry_cache (normalized_employer, industry, confidence, method, model, resolved_at)
     VALUES (?, ?, ?, ?, NULL, ?) ON CONFLICT(normalized_employer) DO NOTHING`,
  ).run(norm, m.industry, m.confidence, method, now());
  return { industry: m.industry, confidence: m.confidence, method };
}

// ---------------------------------------------------------------------------
// Bulk ingestion
// ---------------------------------------------------------------------------

async function ingestBulk(cycle: number): Promise<{ candidates: number; committees: number; contributions: number; dollars: number }> {
  // NOTE: `bioguide_id` is deliberately absent from this column list.
  // It is owned by the crosswalk in congress.ts. Including it here made every
  // re-run of this script write NULL over the link, which silently detached all
  // campaign finance from all members and produced an app with zero overlaps.
  const candStmt = upsert('fec_candidates', 'candidate_id', [
    'candidate_id', 'name', 'party', 'state', 'district', 'office', 'incumbent_challenge',
    'cycles', 'principal_committee_ids', 'source', 'source_url', 'fetched_at',
  ]);
  const cmteStmt = upsert('fec_committees', 'committee_id', [
    'committee_id', 'name', 'committee_type', 'designation', 'organization_type',
    'connected_organization_name', 'inferred_industry', 'source', 'source_url', 'fetched_at',
  ]);
  const contribStmt = upsert('contributions', 'id', [
    'id', 'recipient_candidate_id', 'recipient_committee_id', 'contributor_name', 'contributor_employer',
    'contributor_occupation', 'contributor_state', 'contributor_kind', 'amount', 'date', 'cycle',
    'industry', 'industry_method', 'industry_confidence', 'source', 'source_url', 'fetched_at',
  ]);

  // --- candidate master ----------------------------------------------------
  console.log('  candidate master…');
  const candidates: string[][] = [];
  for await (const row of readBulk(cycle, 'cn')) candidates.push(row);

  // --- candidate/committee linkage ----------------------------------------
  console.log('  candidate/committee linkage…');
  const committeesByCandidate = new Map<string, string[]>();
  let rejectedLinks = 0;
  for await (const row of readBulk(cycle, 'ccl')) {
    const cand = row[CCL.CAND_ID], cmte = row[CCL.CMTE_ID];
    if (!cand || !cmte) continue;

    /**
     * ONLY the candidate's own principal campaign committee.
     *
     * The FEC's candidate/committee linkage file links a candidate to every
     * committee that has ever designated itself as connected to them — which
     * includes party committees and joint fundraising committees. An earlier
     * version of this code took all of them, and the consequence was that
     * $81.9 MILLION of National Republican Senatorial Committee receipts were
     * reported on this site, under a named sitting senator's photograph, as
     * "money reported to the FEC — given to Dan Sullivan's campaign", with the
     * words "exact figure" beside it. Joint fundraising committees produced the
     * same error for 28 more members.
     *
     * That is a false statement of fact about a real person, and it is exactly
     * the class of error that no amount of careful framing elsewhere can undo.
     *
     * designation 'P' is the principal campaign committee. 'J' is joint
     * fundraising (money raised jointly and split between participants, so
     * attributing 100% of it to one member overstates their receipts), 'U' is
     * unauthorised, 'A'/'B'/'D' are authorised/lobbyist/leadership. Committee
     * types 'X'/'Y'/'Z' are party committees regardless of designation.
     */
    const designation = (row[CCL.CMTE_DSGN] ?? '').toUpperCase();
    const cmteType = (row[CCL.CMTE_TP] ?? '').toUpperCase();
    if (designation !== 'P' || PARTY_COMMITTEE_TYPES.has(cmteType)) { rejectedLinks++; continue; }

    const list = committeesByCandidate.get(cand) ?? [];
    if (!list.includes(cmte)) list.push(cmte);
    committeesByCandidate.set(cand, list);
  }
  console.log(`  (linked only principal campaign committees; ${rejectedLinks} party, joint-fundraising and other linkages excluded)`);

  let candCount = 0;
  db().transaction(() => {
    for (const r of candidates) {
      const id = r[CN.CAND_ID];
      if (!id) continue;
      candStmt.run({
        candidate_id: id,
        name: r[CN.CAND_NAME] ?? id,
        party: r[CN.PARTY] ?? null,
        state: r[CN.OFFICE_ST] ?? null,
        district: r[CN.DISTRICT] ?? null,
        office: r[CN.OFFICE] ?? '',
        incumbent_challenge: r[CN.ICI] ?? null,
        cycles: j([cycle]),
        principal_committee_ids: j(committeesByCandidate.get(id) ?? (r[CN.PCC] ? [r[CN.PCC]] : [])),  // already filtered to designation 'P'
        source: 'openfec',
        source_url: candidatePublicUrl(id, cycle),
        fetched_at: now(),
      });
      candCount++;
    }
  })();

  // --- committee master ----------------------------------------------------
  console.log('  committee master…');
  const cmteInfo = new Map<string, { name: string; connected: string; industry: IndustryId; confidence: number }>();
  let cmteCount = 0;
  const cmteRows: string[][] = [];
  for await (const row of readBulk(cycle, 'cm')) cmteRows.push(row);

  db().transaction(() => {
    for (const r of cmteRows) {
      const id = r[CM.CMTE_ID];
      if (!id) continue;
      const name = r[CM.CMTE_NM] ?? id;
      const connected = r[CM.CONNECTED_ORG_NM] ?? '';
      const orgTp = r[CM.ORG_TP] ?? '';
      const cmteTp = (r[CM.CMTE_TP] ?? '').toUpperCase();
      let { industry, confidence } = resolveIndustry(name, connected);

      // The FEC's own committee-type code is authoritative for the categories
      // that are NOT industries at all. Party committees (X/Y/Z), leadership
      // PACs (D) and candidate committees (H/S/P) are political money moving
      // between politicians. Bucketing them separately matters: left in
      // "unclassified" they would overstate how much money we failed to place,
      // and forced into an industry they would inflate every overlap score.
      if (PARTY_LEADERSHIP_CMTE_TYPES.has(cmteTp)) {
        industry = 'party-leadership';
        confidence = 0.95;
      } else if (industry === 'other' && orgTp === 'L') {
        // A labor-organization org type is a strong, unambiguous signal; the
        // other codes ("Corporation") say nothing about *which* industry.
        industry = 'labor-unions';
        confidence = 0.7;
      } else if (industry === 'other' && SUPER_PAC_CMTE_TYPES.has(cmteTp)) {
        // We know exactly what this is; we just cannot see through it to the
        // sector behind the money. Saying so is more useful, and more honest,
        // than filing it under "unclassified".
        industry = 'super-pac-unattributed';
        confidence = 0.9;
      }
      cmteInfo.set(id, { name, connected, industry, confidence });
      cmteStmt.run({
        committee_id: id,
        name,
        committee_type: r[CM.CMTE_TP] ?? null,
        designation: r[CM.DSGN] ?? null,
        organization_type: ORG_TYPE_HINT[orgTp] ?? null,
        connected_organization_name: connected || null,
        inferred_industry: confidence > 0 ? industry : null,
        source: 'openfec',
        source_url: committeePublicUrl(id, cycle),
        fetched_at: now(),
      });
      cmteCount++;
    }
  })();

  // --- committee -> candidate contributions --------------------------------
  // Upserts alone cannot remove a row that should no longer exist — for example
  // when the transaction-type filter changes and previously-ingested rows stop
  // qualifying. Clear this cycle's bulk-sourced rows first so the table is a
  // faithful projection of the current rules rather than an accumulation of
  // every rule the pipeline has ever had. API-sourced individual-donor rows use
  // a different contributor_kind and are left untouched.
  console.log('  committee-to-candidate contributions…');
  const cleared = db()
    .prepare(`DELETE FROM contributions WHERE cycle = ? AND source = 'openfec' AND contributor_kind = 'committee'`)
    .run(cycle).changes;
  if (cleared > 0) console.log(`  (cleared ${cleared} previously-ingested rows for this cycle before rebuilding)`);

  let rows = 0, dollars = 0, skippedIndependent = 0, skippedIndependentDollars = 0;
  let batch: string[][] = [];

  const flush = db().transaction((chunk: string[][]) => {
    for (const r of chunk) {
      const candId = r[PAS2.CAND_ID];
      const donorId = r[PAS2.CMTE_ID];
      const amount = Number(r[PAS2.TRANSACTION_AMT] ?? 0);
      const txType = r[PAS2.TRANSACTION_TP] ?? '';
      if (!candId || !donorId || !Number.isFinite(amount) || amount <= 0) continue;
      // Independent expenditures — for OR against — are not contributions the
      // campaign received. Counting the supportive ones while dropping the
      // opposing ones would systematically inflate every total.
      if (INDEPENDENT_EXPENDITURE_TX_TYPES.has(txType)) {
        skippedIndependent++;
        skippedIndependentDollars += amount;
        continue;
      }

      const info = cmteInfo.get(donorId);
      const donorName = info?.name ?? donorId;
      const industry = info?.industry ?? 'other';
      const confidence = info?.confidence ?? 0;

      contribStmt.run({
        id: stableId('fec-bulk-pas2', r[PAS2.SUB_ID] ?? `${donorId}:${candId}:${r[PAS2.TRANSACTION_DT]}:${amount}`),
        recipient_candidate_id: candId,
        recipient_committee_id: r[PAS2.OTHER_ID] || null,
        contributor_name: donorName,
        contributor_employer: info?.connected || null,
        contributor_occupation: null,
        contributor_state: r[PAS2.STATE] ?? null,
        contributor_kind: 'committee',
        amount,
        date: fecDate(r[PAS2.TRANSACTION_DT]),
        cycle,
        industry,
        industry_method: confidence > 0 ? 'committee-type' : 'unassigned',
        industry_confidence: confidence,
        source: 'openfec',
        source_url: committeePublicUrl(donorId, cycle),
        fetched_at: now(),
      });
      rows++;
      dollars += amount;
    }
  });

  for await (const r of readBulk(cycle, 'pas2')) {
    batch.push(r);
    if (batch.length >= 5000) { flush(batch); batch = []; }
  }
  if (batch.length) flush(batch);

  if (skippedIndependent > 0) {
    console.log(`  (excluded ${skippedIndependent} independent expenditures totalling $${Math.round(skippedIndependentDollars).toLocaleString()} —`);
    console.log(`   money spent for or against a candidate by an outside group is not a contribution the campaign received)`);
  }
  return { candidates: candCount, committees: cmteCount, contributions: rows, dollars };
}

// ---------------------------------------------------------------------------
// API enrichment: individual money aggregated by employer
// ---------------------------------------------------------------------------

interface FecPage<T> { pagination: { pages: number }; results: T[] }
interface ByEmployerRow { employer: string | null; total: number; count: number }

function apiUrl(pathname: string, params: Record<string, string | number | undefined>, key: string): string {
  const u = new URL(`${API}${pathname}`);
  u.searchParams.set('api_key', key);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  return u.toString();
}

/**
 * Which members to spend API calls on: the ones who actually appear in the
 * bills we have ingested, most-involved first. There is no point burning a
 * rate limit on members the app will never render.
 */
function targetCandidateIds(limit: number): { candidateId: string; committeeIds: string[]; name: string }[] {
  const rows = db().prepare(`
    WITH involved AS (
      SELECT sponsor_bioguide_id AS bio FROM bills WHERE sponsor_bioguide_id IS NOT NULL
      UNION ALL
      SELECT json_each.value FROM bills, json_each(bills.cosponsor_bioguide_ids)
    ), ranked AS (
      SELECT bio, COUNT(*) AS n FROM involved GROUP BY bio
    )
    SELECT c.candidate_id, c.principal_committee_ids, c.name, r.n
    FROM fec_candidates c
    JOIN ranked r ON r.bio = c.bioguide_id
    WHERE c.bioguide_id IS NOT NULL
    ORDER BY r.n DESC, c.candidate_id
    LIMIT ?
  `).all(limit) as { candidate_id: string; principal_committee_ids: string; name: string }[];

  return rows.map((r) => ({
    candidateId: r.candidate_id,
    committeeIds: JSON.parse(r.principal_committee_ids || '[]') as string[],
    name: r.name,
  }));
}

async function enrichWithIndividualDonors(key: string, cycle: number, maxMembers: number, topEmployers: number): Promise<number> {
  const contribStmt = upsert('contributions', 'id', [
    'id', 'recipient_candidate_id', 'recipient_committee_id', 'contributor_name', 'contributor_employer',
    'contributor_occupation', 'contributor_state', 'contributor_kind', 'amount', 'date', 'cycle',
    'industry', 'industry_method', 'industry_confidence', 'source', 'source_url', 'fetched_at',
  ]);

  const targets = targetCandidateIds(maxMembers);
  if (targets.length === 0) {
    console.log('  No linked members yet — run `npm run ingest:congress` first, then re-run this.');
    return 0;
  }
  console.log(`  enriching ${targets.length} members with individual-donor detail…`);

  let rows = 0;
  for (const [i, t] of targets.entries()) {
    for (const cmteId of t.committeeIds.slice(0, 2)) {
      const collected: ByEmployerRow[] = [];
      let page = 1;
      try {
        while (collected.length < topEmployers) {
          const data = await getJson<FecPage<ByEmployerRow>>(
            apiUrl('/schedules/schedule_a/by_employer/', { committee_id: cmteId, cycle, per_page: 100, page, sort: '-total' }, key),
            { label: `by_employer ${cmteId} p${page}` },
          );
          collected.push(...data.results);
          if (page >= data.pagination.pages || data.results.length === 0) break;
          page++;
        }
      } catch (err) {
        console.warn(`    ${cmteId}: ${(err as Error).message.split('\n')[0]}`);
        continue;
      }

      db().transaction((list: ByEmployerRow[]) => {
        for (const r of list) {
          const employer = (r.employer ?? '').trim();
          if (!employer || r.total <= 0) continue;
          const { industry, confidence, method } = resolveIndustry(employer);
          contribStmt.run({
            id: stableId('fec-employer', cmteId, cycle, employer),
            recipient_candidate_id: t.candidateId,
            recipient_committee_id: cmteId,
            contributor_name: employer,
            contributor_employer: employer,
            contributor_occupation: null,
            contributor_state: null,
            contributor_kind: 'individual',
            amount: r.total,
            date: null,
            cycle,
            industry,
            industry_method: method,
            industry_confidence: confidence,
            source: 'openfec',
            source_url: committeePublicUrl(cmteId, cycle),
            fetched_at: now(),
          });
          rows++;
        }
      })(collected.slice(0, topEmployers));
    }
    if ((i + 1) % 10 === 0 || i === targets.length - 1) console.log(`    [${i + 1}/${targets.length}] ${rows} individual-donor rows`);
  }
  return rows;
}

// ---------------------------------------------------------------------------

export async function ingestFec(): Promise<void> {
  const cycle = CONFIG.cycle();
  const key = optionalKey('FEC_API_KEY');
  const maxMembers = CONFIG.maxMembers();
  const topEmployers = Number(process.env.FTM_TOP_EMPLOYERS ?? 150);

  console.log(`\nOpenFEC ingestion — cycle ${cycle}`);
  console.log(key
    ? '  FEC_API_KEY found: bulk data + individual-donor detail.\n'
    : '  No FEC_API_KEY: using FEC bulk downloads only (no signup needed).\n  Committee/PAC money will be complete; individual-donor detail will be absent.\n  Add a free key from https://api.data.gov/signup/ to fill that in.\n');

  const bulk = await ingestBulk(cycle);
  console.log(`  ${bulk.candidates} candidates, ${bulk.committees} committees`);
  console.log(`  ${bulk.contributions} committee-to-candidate contributions, $${Math.round(bulk.dollars).toLocaleString()}`);

  // Re-assert the FEC <-> bioguide crosswalk. Running the two ingestion scripts
  // in either order must leave the same, linked result.
  try {
    const { linkFecToBioguide } = await import('./congress.js');
    const link = linkFecToBioguide();
    console.log(`  crosswalk: ${link.matched} candidate records linked to current members`);
  } catch {
    console.log('  crosswalk not applied yet — run `npm run ingest:congress`, which owns it.');
  }

  let individualRows = 0;
  if (key) individualRows = await enrichWithIndividualDonors(key, cycle, maxMembers, topEmployers);

  setMeta('fec_last_run', now());
  setMeta('fec_cycle', String(cycle));
  setMeta('fec_mode', key ? 'bulk+api' : 'bulk');

  const gap = db().prepare(`
    SELECT COALESCE(SUM(CASE WHEN industry_method = 'placeholder' THEN amount END), 0) AS non_employer,
           COALESCE(SUM(CASE WHEN industry_method = 'unassigned'  THEN amount END), 0) AS unresolved,
           COALESCE(SUM(amount), 0) AS total
    FROM contributions WHERE cycle = ?`).get(cycle) as { non_employer: number; unresolved: number; total: number };
  const share = (n: number) => `${((n / Math.max(1, gap.total)) * 100).toFixed(1)}%`;

  console.log(`\n  Done. ${individualRows ? `${individualRows} individual-donor rows added.` : ''}`);
  console.log(`  No employer/org on file:  $${Math.round(gap.non_employer).toLocaleString()} (${share(gap.non_employer)}) — nobody can classify these.`);
  console.log(`  Named but unresolved:     $${Math.round(gap.unresolved).toLocaleString()} (${share(gap.unresolved)}) — 'npm run classify' with an LLM key shrinks this.\n`);
}

if (isMain(import.meta.url)) {
  ingestFec().catch((err) => {
    console.error(`\nFEC ingestion failed: ${err.message}\n`);
    process.exit(1);
  });
}
