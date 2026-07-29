/**
 * Congress.gov ingestion — members, committees, bills, votes.
 *
 * Run:  npm run ingest:congress
 *
 * ---------------------------------------------------------------------------
 * TWO MODES, AND WHY
 *
 * "bulk" (no API key needed, the default when CONGRESS_API_KEY is absent)
 *   - Members + committee rosters + the FEC<->bioguide crosswalk come from the
 *     @unitedstates/congress-legislators datasets (public domain, CC0).
 *   - Bill status comes from GovInfo BULKDATA XML, which the GPO publishes with
 *     no key and no rate limit.
 *   - Roll-call votes are unavailable in this mode.
 *
 * "api" (used automatically when CONGRESS_API_KEY is set)
 *   - Bills and roll-call votes come from api.congress.gov, which is fresher
 *     and includes vote positions.
 *
 * The point of the bulk mode is that someone can clone this repo and get a
 * fully working legislative dataset with zero signups. The FEC key is still
 * required for campaign finance — there is no keyless FEC API.
 * ---------------------------------------------------------------------------
 *
 * Idempotent: every write is an upsert keyed on the government's own ID.
 */

import { XMLParser } from 'fast-xml-parser';
import { classifyTextToIndustry } from '@ftm/core/src';
import { CONFIG, isMain, optionalKey } from './lib/env.js';
import { getJson, stableId } from './lib/http.js';
import { db, j, setMeta, upsert } from './lib/db.js';

const API = 'https://api.congress.gov/v3';
const US_DATA = 'https://unitedstates.github.io/congress-legislators';
const US_IMAGES = 'https://unitedstates.github.io/images/congress/225x275';
const GOVINFO_BULK = 'https://www.govinfo.gov/bulkdata';

const now = () => new Date().toISOString();

function apiUrl(pathname: string, params: Record<string, string | number | undefined>, key: string): string {
  const u = new URL(`${API}${pathname}`);
  u.searchParams.set('api_key', key);
  u.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  }
  return u.toString();
}

const billId = (congress: number, type: string, num: string | number) => `${congress}-${type.toLowerCase()}-${num}`;

const BILL_SLUG: Record<string, string> = {
  hr: 'house-bill', s: 'senate-bill',
  hjres: 'house-joint-resolution', sjres: 'senate-joint-resolution',
  hconres: 'house-concurrent-resolution', sconres: 'senate-concurrent-resolution',
  hres: 'house-resolution', sres: 'senate-resolution',
};

function publicBillUrl(congress: number, type: string, num: string | number): string {
  const slug = BILL_SLUG[type.toLowerCase()] ?? 'bill';
  return `https://www.congress.gov/bill/${congress}th-congress/${slug}/${num}`;
}

function stripHtml(html?: string | null): string | null {
  if (!html) return null;
  const t = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t || null;
}

function arr<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

async function safeGet<T>(url: string, label: string, ttlHours = 24): Promise<T | null> {
  try {
    return await getJson<T>(url, { label, ttlHours });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Members — always from the public-domain crosswalk, so FEC IDs are exact
// ---------------------------------------------------------------------------

interface UsLegislator {
  id: { bioguide: string; fec?: string[] };
  name: { first?: string; last?: string; official_full?: string };
  terms: { type: string; start: string; end?: string; state: string; district?: number; party?: string; url?: string }[];
}

interface DistrictOffice { id: { bioguide: string }; offices?: { city?: string; state?: string }[] }

async function ingestMembers(): Promise<{ members: number; withFec: number; withPlaces: number }> {
  const data = await getJson<UsLegislator[]>(`${US_DATA}/legislators-current.json`, {
    label: 'legislators-current', ttlHours: 24 * 3,
  });

  /**
   * District office cities — the answer to "which one of these is mine?"
   *
   * A phone user was asked to find her own representative. The address lookup
   * needs a network call, and when it failed the fallback was a list reading
   * "NY-2, NY-8, NY-10, NY-12, NY-13, NY-26" with no other geography. Nobody
   * knows their district number — finding it out was the whole task — so she
   * picked a senator by mistake and left.
   *
   * A member's district office cities are the places they actually sit in, are
   * published in the same public-domain dataset, and turn an unusable number
   * into "NY-12 · New York". No API key, no extra service.
   */
  const offices = await safeGet<DistrictOffice[]>(`${US_DATA}/legislators-district-offices.json`, 'district offices', 24 * 7);
  const placesByBioguide = new Map<string, string[]>();
  for (const o of offices ?? []) {
    const cities = [...new Set((o.offices ?? []).map((x) => x.city).filter((c): c is string => Boolean(c)))];
    if (cities.length) placesByBioguide.set(o.id.bioguide, cities.slice(0, 4));
  }

  const stmt = upsert('legislators', 'bioguide_id', [
    'bioguide_id', 'name', 'first_name', 'last_name', 'chamber', 'state', 'district', 'party',
    'image_url', 'official_url', 'fec_candidate_ids', 'terms', 'district_places', 'source', 'source_url', 'fetched_at',
  ]);

  let withFec = 0;
  let withPlaces = 0;
  const tx = db().transaction(() => {
    for (const m of data) {
      const term = m.terms[m.terms.length - 1];
      if (!term) continue;
      const fec = m.id.fec ?? [];
      if (fec.length) withFec++;
      if (placesByBioguide.has(m.id.bioguide)) withPlaces++;
      stmt.run({
        bioguide_id: m.id.bioguide,
        name: m.name.official_full ?? `${m.name.first ?? ''} ${m.name.last ?? ''}`.trim(),
        first_name: m.name.first ?? null,
        last_name: m.name.last ?? null,
        chamber: term.type === 'sen' ? 'Senate' : 'House',
        state: term.state,
        district: term.district !== undefined && term.district !== null ? String(term.district) : null,
        party: term.party ?? null,
        image_url: `${US_IMAGES}/${m.id.bioguide}.jpg`,
        official_url: term.url ?? `https://www.congress.gov/member/${m.id.bioguide}`,
        fec_candidate_ids: j(fec),
        terms: j(m.terms.slice(-3)),
        district_places: j(placesByBioguide.get(m.id.bioguide) ?? []),
        source: 'congress',
        source_url: `https://www.congress.gov/member/${m.id.bioguide}`,
        fetched_at: now(),
      });
    }
  });
  tx();
  return { members: data.length, withFec, withPlaces };
}

/**
 * Links FEC candidate rows to bioguide IDs using the crosswalk above.
 *
 * This is an exact join on published identifiers — not a name-similarity guess.
 * Any FEC candidate not in the crosswalk is simply left unlinked, and the UI
 * says "no donor data linked" rather than attaching someone else's money.
 */
export function linkFecToBioguide(): { matched: number; unlinked: number } {
  const legs = db().prepare('SELECT bioguide_id, fec_candidate_ids FROM legislators').all() as
    { bioguide_id: string; fec_candidate_ids: string }[];

  const byFec = new Map<string, string>();
  for (const l of legs) {
    for (const fecId of JSON.parse(l.fec_candidate_ids || '[]') as string[]) byFec.set(fecId, l.bioguide_id);
  }

  const cands = db().prepare('SELECT candidate_id FROM fec_candidates').all() as { candidate_id: string }[];
  const upd = db().prepare('UPDATE fec_candidates SET bioguide_id = ? WHERE candidate_id = ?');
  let matched = 0;
  db().transaction(() => {
    for (const c of cands) {
      const bio = byFec.get(c.candidate_id);
      if (bio) { upd.run(bio, c.candidate_id); matched++; }
    }
  })();
  return { matched, unlinked: cands.length - matched };
}

// ---------------------------------------------------------------------------
// Committee rosters
// ---------------------------------------------------------------------------

async function ingestCommitteeRosters(): Promise<number> {
  const roster = await safeGet<Record<string, { bioguide?: string; title?: string }[]>>(
    `${US_DATA}/committee-membership-current.json`, 'committee rosters', 24 * 7);
  const committees = await safeGet<{ thomas_id: string; name: string }[]>(
    `${US_DATA}/committees-current.json`, 'committee list', 24 * 7);

  if (!roster || !committees) {
    console.warn('  Committee rosters unavailable; bill pages will show sponsors and cosponsors only.');
    return 0;
  }

  const nameByCode = new Map(committees.map((c) => [c.thomas_id, c.name]));
  const stmt = upsert('committee_memberships', ['bioguide_id', 'committee_code'],
    ['bioguide_id', 'committee_code', 'committee_name', 'role']);

  let n = 0;
  db().transaction(() => {
    for (const [code, members] of Object.entries(roster)) {
      const name = nameByCode.get(code) ?? nameByCode.get(code.slice(0, 4)) ?? code;
      for (const m of members) {
        if (!m.bioguide) continue;
        stmt.run({ bioguide_id: m.bioguide, committee_code: code, committee_name: name, role: m.title ?? null });
        n++;
      }
    }
  })();
  return n;
}

// ---------------------------------------------------------------------------
// Bills — bulk (keyless) path
// ---------------------------------------------------------------------------

const billStmt = () => upsert('bills', 'id', [
  'id', 'congress', 'bill_type', 'bill_number', 'title', 'introduced_date', 'latest_action_date',
  'latest_action_text', 'policy_area', 'subjects', 'sponsor_bioguide_id', 'cosponsor_bioguide_ids',
  'committee_codes', 'committee_names', 'official_summary', 'congress_dot_gov_url',
  'source', 'source_url', 'fetched_at',
]);

interface BulkFileEntry { justFileName: string; link: string; formattedLastModifiedTime: string; size: number }

async function fetchXml(url: string, label: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/xml', 'User-Agent': 'follow-the-money (open source civic data tool)' } });
    if (!res.ok) return null;
    const text = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true, trimValues: true });
    return parser.parse(text);
  } catch {
    console.warn(`    could not parse ${label}`);
    return null;
  }
}

/** GovInfo's index timestamps look like "13-Jul-2026 23:36". */
function parseBulkDate(s: string): number {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return 0;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mi = months.indexOf(m[2]!);
  if (mi < 0) return 0;
  return Date.UTC(Number(m[3]), mi, Number(m[1]), Number(m[4]), Number(m[5]));
}

async function ingestBillsBulk(congress: number, maxBills: number): Promise<number> {
  const types = (process.env.FTM_BILL_TYPES ?? 'hr,s').split(',').map((s) => s.trim()).filter(Boolean);
  const stmt = billStmt();
  const perType = Math.ceil(maxBills / types.length);
  let stored = 0;

  for (const type of types) {
    const index = await safeGet<{ files: BulkFileEntry[] }>(
      `${GOVINFO_BULK}/json/BILLSTATUS/${congress}/${type}`, `bulk index ${type}`, 6);
    if (!index?.files?.length) {
      console.warn(`  no bulk index for ${type}`);
      continue;
    }

    // Most-recently-updated first: those are the bills actually moving.
    const files = index.files
      .filter((f) => f.justFileName?.endsWith('.xml'))
      .sort((a, b) => parseBulkDate(b.formattedLastModifiedTime) - parseBulkDate(a.formattedLastModifiedTime))
      .slice(0, perType);

    for (const [i, f] of files.entries()) {
      const parsed = await fetchXml(f.link, f.justFileName);
      const bill = parsed?.billStatus?.bill;
      if (!bill) continue;

      const num = String(bill.number);
      const id = billId(congress, type, num);
      const summaries = arr(bill.summaries?.summary);
      const latestSummary = summaries[summaries.length - 1]?.text;
      const committees = arr(bill.committees?.committee);
      const cosponsors = arr(bill.cosponsors?.item);
      const subjects = arr(bill.subjects?.legislativeSubjects?.item).map((s: any) => s?.name).filter(Boolean);
      const sponsor = arr(bill.sponsors?.item)[0];

      stmt.run({
        id,
        congress,
        bill_type: type,
        bill_number: num,
        title: String(bill.title ?? `${type.toUpperCase()} ${num}`),
        introduced_date: bill.introducedDate ? String(bill.introducedDate) : null,
        latest_action_date: bill.latestAction?.actionDate ? String(bill.latestAction.actionDate) : null,
        latest_action_text: stripHtml(bill.latestAction?.text),
        policy_area: bill.policyArea?.name ? String(bill.policyArea.name) : null,
        subjects: j(subjects.map(String)),
        sponsor_bioguide_id: sponsor?.bioguideId ? String(sponsor.bioguideId) : null,
        cosponsor_bioguide_ids: j(cosponsors.map((c: any) => c?.bioguideId).filter(Boolean).map(String)),
        committee_codes: j(committees.map((c: any) => c?.systemCode).filter(Boolean).map(String)),
        committee_names: j(committees.map((c: any) => c?.name).filter(Boolean).map(String)),
        official_summary: stripHtml(latestSummary),
        congress_dot_gov_url: publicBillUrl(congress, type, num),
        source: 'congress',
        source_url: f.link,
        fetched_at: now(),
      });
      stored++;
      if ((i + 1) % 10 === 0) console.log(`  [${type}] ${i + 1}/${files.length}`);
    }
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Bills — API path
// ---------------------------------------------------------------------------

async function ingestBillsApi(key: string, congress: number, maxBills: number): Promise<number> {
  const stmt = billStmt();
  const listUrl = apiUrl(`/bill/${congress}`, { limit: 250, sort: 'updateDate+desc' }, key);
  const list = await safeGet<{ bills: any[] }>(listUrl, 'bill list', 6);
  const selected = (list?.bills ?? []).slice(0, maxBills);
  let n = 0;

  for (const [i, b] of selected.entries()) {
    const type = String(b.type).toLowerCase();
    const id = billId(b.congress, type, b.number);
    const detail = await safeGet<any>(apiUrl(`/bill/${b.congress}/${type}/${b.number}`, {}, key), `bill ${id}`);
    const bill = detail?.bill;
    if (!bill) continue;

    const [summaries, committees, cosponsors, subjects] = await Promise.all([
      safeGet<any>(apiUrl(`/bill/${b.congress}/${type}/${b.number}/summaries`, {}, key), `summaries ${id}`),
      safeGet<any>(apiUrl(`/bill/${b.congress}/${type}/${b.number}/committees`, {}, key), `committees ${id}`),
      safeGet<any>(apiUrl(`/bill/${b.congress}/${type}/${b.number}/cosponsors`, { limit: 250 }, key), `cosponsors ${id}`),
      safeGet<any>(apiUrl(`/bill/${b.congress}/${type}/${b.number}/subjects`, { limit: 250 }, key), `subjects ${id}`),
    ]);

    const summaryList: any[] = summaries?.summaries ?? [];
    const cmtes: any[] = committees?.committees ?? [];

    stmt.run({
      id,
      congress: b.congress,
      bill_type: type,
      bill_number: String(b.number),
      title: bill.title ?? b.title ?? `${type.toUpperCase()} ${b.number}`,
      introduced_date: bill.introducedDate ?? null,
      latest_action_date: bill.latestAction?.actionDate ?? null,
      latest_action_text: stripHtml(bill.latestAction?.text),
      policy_area: bill.policyArea?.name ?? null,
      subjects: j((subjects?.subjects?.legislativeSubjects ?? []).map((s: any) => s.name).filter(Boolean)),
      sponsor_bioguide_id: bill.sponsors?.[0]?.bioguideId ?? null,
      cosponsor_bioguide_ids: j((cosponsors?.cosponsors ?? []).map((c: any) => c.bioguideId).filter(Boolean)),
      committee_codes: j(cmtes.map((c) => c.systemCode).filter(Boolean)),
      committee_names: j(cmtes.map((c) => c.name).filter(Boolean)),
      official_summary: stripHtml(summaryList[summaryList.length - 1]?.text),
      congress_dot_gov_url: publicBillUrl(b.congress, type, b.number),
      source: 'congress',
      source_url: publicBillUrl(b.congress, type, b.number),
      fetched_at: now(),
    });
    n++;
    if ((i + 1) % 10 === 0 || i === selected.length - 1) console.log(`  [${i + 1}/${selected.length}] bills stored`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Roll-call votes (API only)
// ---------------------------------------------------------------------------

async function ingestVotes(key: string, congress: number, maxVotes: number): Promise<number> {
  const stmt = upsert('votes', 'id', [
    'id', 'bill_id', 'chamber', 'congress', 'session', 'roll_number', 'date', 'question',
    'result', 'positions', 'source', 'source_url', 'fetched_at',
  ]);

  let stored = 0;
  for (const session of [2, 1]) {
    if (stored >= maxVotes) break;
    const list = await safeGet<any>(apiUrl(`/house-vote/${congress}/${session}`, { limit: 250 }, key), `votes ${session}`, 6);
    const votes: any[] = list?.houseRollCallVotes ?? [];
    const recent = votes
      .slice()
      .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))
      .slice(0, maxVotes - stored);

    for (const v of recent) {
      const detail = await safeGet<any>(
        apiUrl(`/house-vote/${congress}/${session}/${v.rollCallNumber}/members`, {}, key),
        `vote ${session}-${v.rollCallNumber}`);
      const results: any[] = detail?.houseRollCallVoteMemberVotes?.results ?? [];
      if (results.length === 0) continue;

      stmt.run({
        id: stableId('house-vote', congress, session, v.rollCallNumber),
        bill_id: v.legislationType && v.legislationNumber
          ? billId(congress, String(v.legislationType), String(v.legislationNumber)) : null,
        chamber: 'House',
        congress,
        session,
        roll_number: v.rollCallNumber,
        date: v.startDate ?? '',
        question: v.voteType ?? 'Roll call vote',
        result: v.result ?? '',
        positions: j(results.filter((r) => r.bioguideID).map((r) => ({ bioguideId: r.bioguideID, position: r.voteCast }))),
        source: 'congress',
        source_url: v.sourceDataURL ?? 'https://clerk.house.gov/Votes',
        fetched_at: now(),
      });
      stored++;
      if (stored >= maxVotes) break;
    }
  }
  return stored;
}

// ---------------------------------------------------------------------------

export async function ingestCongress(): Promise<void> {
  const key = optionalKey('CONGRESS_API_KEY');
  const congress = CONFIG.congress();
  const maxBills = CONFIG.maxBills();
  const maxVotes = Number(process.env.FTM_MAX_VOTES ?? 15);
  /**
   * Having a key does not mean the API is the right source for everything.
   *
   * Bill detail costs ~5 API calls per bill (detail + summaries + committees +
   * cosponsors + subjects), so a 1,500-bill dataset is ~7,500 calls against a
   * 1,000/hour quota — seven hours, to re-fetch data GovInfo already serves in
   * bulk for free and unmetered. Votes, by contrast, are ONLY available through
   * the API and cost one call each.
   *
   * So the default with a key is: bulk for bills, API for votes. Set
   * FTM_BILLS_SOURCE=api to override when you want the freshest bill text and
   * have the quota to spend.
   */
  const billsSource = (process.env.FTM_BILLS_SOURCE ?? 'bulk').toLowerCase();
  const mode = key ? 'api' : 'bulk';

  console.log(`\nCongress ingestion — ${congress}th Congress, up to ${maxBills} bills`);
  console.log(`  bills: ${mode === 'api' && billsSource === 'api' ? 'Congress.gov API' : 'GovInfo bulk data (free, unmetered)'}`);
  console.log(`  votes: ${mode === 'api' ? 'Congress.gov API' : 'unavailable without a key'}`);
  if (mode === 'bulk') {
    console.log('  No CONGRESS_API_KEY set — using GovInfo bulk data and the public-domain');
    console.log('  congress-legislators datasets. This needs no signup. Roll-call vote');
    console.log('  positions are not available without a key; everything else is.\n');
  } else {
    console.log('');
  }

  const { members, withFec, withPlaces } = await ingestMembers();
  console.log(`  ${members} current members (${withFec} with published FEC candidate IDs, ${withPlaces} with district office cities)`);

  const roster = await ingestCommitteeRosters();
  console.log(`  ${roster} committee seats`);

  let bills = 0;
  if (mode === 'api' && billsSource === 'api') {
    try {
      bills = await ingestBillsApi(key!, congress, maxBills);
    } catch (err) {
      console.warn(`  API bill fetch failed (${(err as Error).message.split('\n')[0]}); falling back to bulk data.`);
    }
  }
  if (bills === 0) bills = await ingestBillsBulk(congress, maxBills);
  console.log(`  ${bills} bills`);

  let votes = 0;
  if (mode === 'api') {
    try {
      votes = await ingestVotes(key!, congress, maxVotes);
    } catch { /* non-fatal */ }
    console.log(`  ${votes} House roll-call votes`);
  }

  const link = linkFecToBioguide();
  console.log(`  FEC crosswalk: ${link.matched} candidate records linked, ${link.unlinked} left unlinked`);

  const cmtes = db().prepare('SELECT committee_id, name, connected_organization_name FROM fec_committees WHERE inferred_industry IS NULL').all() as any[];
  const setInd = db().prepare('UPDATE fec_committees SET inferred_industry = ? WHERE committee_id = ?');
  db().transaction(() => {
    for (const c of cmtes) {
      const m = classifyTextToIndustry(c.name, c.connected_organization_name);
      if (m.confidence > 0) setInd.run(m.industry, c.committee_id);
    }
  })();

  setMeta('congress_last_run', now());
  setMeta('congress_number', String(congress));
  setMeta('congress_mode', mode);
  console.log('\n  Done.\n');
}

if (isMain(import.meta.url)) {
  ingestCongress().catch((err) => {
    console.error(`\nCongress ingestion failed: ${err.message}\n`);
    process.exit(1);
  });
}
