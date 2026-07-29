/**
 * USASpending.gov ingestion — federal contract and grant awards.
 *
 *   fetch -> normalize -> store (local SQLite)
 *
 * Run:  npm run ingest:usaspending
 *
 * ---------------------------------------------------------------------------
 * NO API KEY REQUIRED
 *
 * USASpending.gov's v2 API is open: no signup, no key, no per-key quota. This
 * script therefore always runs for everybody, exactly like the FEC bulk half of
 * fec.ts. The only politeness we owe it is the shared throttle in lib/http.ts.
 * ---------------------------------------------------------------------------
 *
 * WHY AWARDS ARE IN THIS PROJECT AT ALL
 *
 * Campaign finance answers "who gave money to whom". Awards answer the opposite
 * question: "where did federal money actually go, and to which sector". Having
 * both lets the app show an industry's presence on *both* sides of the ledger —
 * an industry that gives heavily and also receives heavily is a more interesting
 * thing for a reader to look at than either fact alone, and the sector mix of
 * federal spending is useful context for reading a bill about that sector.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE USING AWARD DATA ANYWHERE IN THE UI
 *
 * Award data is CONTEXT. It is never evidence.
 *
 * A federal award is the end of a procurement or grant process that is years
 * long, statutorily constrained, run by career civil servants, and in most cases
 * competed. A contribution is a disclosed political donation. Placing the two
 * next to each other shows that both exist; it says nothing whatsoever about
 * whether one produced the other. There is no causal claim available here, and
 * this repository must never render one — not in a headline, not in a tooltip,
 * not by ordering two numbers next to each other in a way that implies a
 * mechanism. Same discipline as every overlap score in this project: patterns,
 * not proof. See overlap.ts, disclaimer.ts and LIMITATIONS.md.
 *
 * Concretely: a defence contractor's PAC contributions and a DoD contract to the
 * same company are two separate public facts. "Company X gave $Y and received
 * $Z" is reportable. "Company X gave $Y and therefore received $Z" is not, and
 * is not supported by anything in this table.
 * ---------------------------------------------------------------------------
 *
 * COVERAGE LIMITS, restated because they shape what the numbers mean:
 *  - `amount` is the award's total obligated value over its whole life, not the
 *    amount obligated inside our time window. A 2016 contract that saw a single
 *    modification last month appears at its full multi-billion face value.
 *  - We take the largest awards first. This is a deliberate, disclosed sample,
 *    not a census of federal spending. Small awards are systematically absent.
 *  - NAICS codes exist for contracts only. Grants and other assistance carry an
 *    Assistance Listing (CFDA) programme title instead, so they are classified
 *    from text and are noisier.
 *  - `recipient_state` / `recipient_congressional_district` are the recipient's
 *    registered business address, which is frequently a headquarters far from
 *    where the work happens. Place of performance is available from the API and
 *    is deliberately NOT written into those columns, because they are two
 *    genuinely different facts and conflating them would silently corrupt any
 *    district-level reading of this table.
 *
 * Idempotency: every row's primary key is a deterministic hash of the award's
 * government identifier, and every write is an upsert. Re-run as often as you
 * like.
 */

import { classifyTextToIndustry, industryFromNaics } from '@ftm/core/src';
import type { IndustryId } from '@ftm/core/src';
import { CONFIG, isMain, num } from './lib/env.js';
import { getJson, postJson, stableId } from './lib/http.js';
import { db, setMeta, upsert } from './lib/db.js';

const API = 'https://api.usaspending.gov/api/v2';
const SEARCH = `${API}/search/spending_by_award/`;
/** The endpoint's documented maximum page size. */
const PAGE_SIZE = 100;
const now = () => new Date().toISOString();

/** Human-openable page for one award. The API's own id is the URL slug. */
const awardPublicUrl = (generatedInternalId?: string | null) =>
  generatedInternalId
    ? `https://www.usaspending.gov/award/${encodeURIComponent(generatedInternalId)}`
    : 'https://www.usaspending.gov/search';

type IndustryMethod = 'naics' | 'keyword' | 'unassigned';

// ---------------------------------------------------------------------------
// What we ask for
//
// The `fields` array is validated against a per-award-type mapping table. An
// unknown value in `fields` is NOT rejected — the API cheerfully returns it as
// null — so the only way to discover the real names is to send a bad `sort`,
// which returns 422 with the full accepted list. Every field below was verified
// against that list live; see the group comments for the two that differ.
// ---------------------------------------------------------------------------

const COMMON_FIELDS = [
  'Award ID',
  'Recipient Name',
  'Award Amount',
  'Awarding Agency',
  'Awarding Sub Agency',
  'Start Date',
  'Description',
  'recipient_location_state_code',
  'recipient_id',
  'prime_award_recipient_id',
  'generated_internal_id',
] as const;

interface AwardGroup {
  /** Label used in logs and stored in meta. */
  label: string;
  /** USASpending award_type_codes. */
  codes: string[];
  fields: string[];
  /** Which returned key holds the human-readable award type for this group. */
  typeKey: string;
}

const GROUPS: AwardGroup[] = [
  {
    label: 'contracts',
    codes: ['A', 'B', 'C', 'D'],
    // naics_*/psc_* are only populated for contract award types.
    fields: [...COMMON_FIELDS, 'Contract Award Type', 'naics_code', 'naics_description', 'psc_description'],
    typeKey: 'Contract Award Type',
  },
  {
    label: 'grants',
    codes: ['02', '03', '04', '05'],
    // Grants have no NAICS at all. Their nearest equivalent is the Assistance
    // Listing (CFDA) programme title, which is free text and only good enough
    // for the keyword classifier.
    fields: [...COMMON_FIELDS, 'Award Type', 'cfda_program_title'],
    typeKey: 'Award Type',
  },
];

// ---------------------------------------------------------------------------

interface SearchRow {
  'Award ID'?: string | null;
  'Recipient Name'?: string | null;
  'Award Amount'?: number | null;
  'Awarding Agency'?: string | null;
  'Awarding Sub Agency'?: string | null;
  'Start Date'?: string | null;
  Description?: string | null;
  'Contract Award Type'?: string | null;
  'Award Type'?: string | null;
  naics_code?: string | null;
  naics_description?: string | null;
  psc_description?: string | null;
  cfda_program_title?: string | null;
  recipient_location_state_code?: string | null;
  recipient_id?: string | null;
  prime_award_recipient_id?: string | null;
  generated_internal_id?: string | null;
}

interface SearchResponse {
  results: SearchRow[];
  page_metadata: { page: number; hasNext: boolean };
  messages?: string[];
}

interface RecipientResponse {
  name?: string | null;
  parent_name?: string | null;
  location?: { state_code?: string | null; congressional_code?: string | null } | null;
}

/**
 * NAICS first, because a government-assigned industry code beats anything we
 * could infer from a company name. Its 2-digit sector for "management of
 * companies", "other services" and "public administration" maps to `other`,
 * which is true but useless, so those fall through to the text classifier
 * rather than being recorded as a confident NAICS answer.
 */
function resolveAwardIndustry(
  naics: string | null | undefined,
  ...texts: (string | null | undefined)[]
): { industry: IndustryId; method: IndustryMethod } {
  const fromNaics = industryFromNaics(naics ?? undefined);
  if (fromNaics && fromNaics !== 'other') return { industry: fromNaics, method: 'naics' };

  const m = classifyTextToIndustry(...texts);
  if (m.confidence > 0) return { industry: m.industry, method: 'keyword' };

  return { industry: 'other', method: 'unassigned' };
}

/** YYYY-MM-DD, `months` before `from`. */
function monthsAgo(from: Date, months: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - months, from.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Pass 1: the award search
// ---------------------------------------------------------------------------

/**
 * `recipient_parent_name` and `recipient_congressional_district` are absent on
 * purpose: the search endpoint cannot supply them, so they are owned entirely
 * by the recipient pass below. Listing them here would make every re-run write
 * NULL over whatever that pass had already resolved — an upsert that quietly
 * destroys data is not idempotent. Columns left out of the INSERT default to
 * NULL on a fresh row and are untouched on conflict, which is what we want.
 */
const awardStmt = () =>
  upsert('awards', 'id', [
    'id', 'recipient_name', 'award_type', 'amount', 'action_date',
    'awarding_agency', 'awarding_sub_agency', 'recipient_state',
    'naics_code', 'naics_description', 'industry', 'industry_method', 'description',
    'source', 'source_url', 'fetched_at',
  ]);

async function ingestGroup(
  group: AwardGroup,
  window: { start: string; end: string },
  maxRows: number,
  /** recipient_id -> the award row ids it owns, for the district pass. */
  byRecipient: Map<string, string[]>,
): Promise<{ rows: number; dollars: number }> {
  const stmt = awardStmt();
  let rows = 0, dollars = 0, page = 1;

  console.log(`  ${group.label} (award_type_codes ${group.codes.join(',')})…`);

  while (rows < maxRows) {
    const body = {
      filters: {
        award_type_codes: group.codes,
        time_period: [{ start_date: window.start, end_date: window.end }],
      },
      fields: group.fields,
      page,
      // PAGE_SIZE must not vary between pages. The API paginates by
      // offset = (page - 1) * limit, so shrinking `limit` to fit a remaining
      // budget re-reads rows already seen. Ask for a full page every time and
      // trim the last one locally instead.
      limit: PAGE_SIZE,
      sort: 'Award Amount',
      order: 'desc',
      subawards: false,
    };

    const data = await postJson<SearchResponse>(SEARCH, body, { label: `${group.label} p${page}` });
    const results = (data.results ?? []).slice(0, maxRows - rows);
    if (results.length === 0) break;

    db().transaction((list: SearchRow[]) => {
      for (const r of list) {
        const recipientName = (r['Recipient Name'] ?? '').trim();
        const amount = Number(r['Award Amount'] ?? 0);
        const awardId = r['Award ID'] ?? r.generated_internal_id;
        // action_date is NOT NULL in the schema and every downstream chart keys
        // off it, so a row without any date is dropped rather than back-filled
        // with a guess.
        const actionDate = r['Start Date'];
        if (!recipientName || !awardId || !actionDate || !Number.isFinite(amount) || amount <= 0) continue;

        const naics = r.naics_code ?? null;
        const description = r.Description ?? r.cfda_program_title ?? r.psc_description ?? null;
        const { industry, method } = resolveAwardIndustry(
          naics,
          recipientName,
          description,
          r.naics_description,
          r.psc_description,
          r.cfda_program_title,
          r['Awarding Sub Agency'],
        );

        const id = stableId('usaspending', group.label, r.generated_internal_id ?? awardId);
        stmt.run({
          id,
          recipient_name: recipientName,
          award_type: (r[group.typeKey as 'Contract Award Type' | 'Award Type'] ?? group.label).toString(),
          amount,
          action_date: actionDate.slice(0, 10),
          awarding_agency: r['Awarding Agency'] ?? null,
          awarding_sub_agency: r['Awarding Sub Agency'] ?? null,
          recipient_state: r.recipient_location_state_code ?? null,
          naics_code: naics,
          naics_description: r.naics_description ?? null,
          industry,
          industry_method: method,
          description,
          source: 'usaspending',
          source_url: awardPublicUrl(r.generated_internal_id),
          fetched_at: now(),
        });

        const recipientId = r.recipient_id ?? r.prime_award_recipient_id;
        if (recipientId) {
          const list2 = byRecipient.get(recipientId) ?? [];
          list2.push(id);
          byRecipient.set(recipientId, list2);
        }

        const before = rows;
        rows++;
        dollars += amount;
        if (Math.floor(before / 200) !== Math.floor(rows / 200)) {
          console.log(`    ${rows} ${group.label} rows…`);
        }
      }
    })(results);

    if (!data.page_metadata?.hasNext) break;
    page++;
  }

  return { rows, dollars };
}

// ---------------------------------------------------------------------------
// Pass 2: congressional districts
//
// spending_by_award does not return a congressional district for the recipient
// (asking for `recipient_location_congressional_code` silently yields null —
// it is not in the accepted mapping). The per-recipient endpoint does return
// it, so we look up the recipients we actually stored, busiest first, and
// back-fill. One GET per distinct recipient, disk-cached by lib/http.ts, so a
// re-run costs nothing.
//
// The `recipient_locations` search filter with `district_original` also works
// and was verified, but a district-by-district sweep is 435+ paginated
// searches for data we can get in a few hundred cheap lookups. Not worth it.
// ---------------------------------------------------------------------------

async function enrichDistricts(byRecipient: Map<string, string[]>, maxLookups: number): Promise<number> {
  const busiest = [...byRecipient.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, maxLookups);
  if (busiest.length === 0) return 0;

  console.log(`\n  resolving congressional districts for ${busiest.length} recipients…`);
  const update = db().prepare(
    `UPDATE awards SET recipient_parent_name = COALESCE(?, recipient_parent_name),
                       recipient_state = COALESCE(?, recipient_state),
                       recipient_congressional_district = COALESCE(?, recipient_congressional_district)
     WHERE id = ?`,
  );

  let updated = 0, failed = 0;
  for (const [i, entry] of busiest.entries()) {
    const [recipientId, awardIds] = entry;
    let rec: RecipientResponse;
    try {
      rec = await getJson<RecipientResponse>(`${API}/recipient/${encodeURIComponent(recipientId)}/`, {
        label: `recipient ${recipientId}`,
        retries: 1,
        ttlHours: 24 * 30, // a business address does not move often
      });
    } catch {
      failed++;
      continue;
    }

    const district = rec.location?.congressional_code ?? null;
    const state = rec.location?.state_code ?? null;
    // parent_name repeats the recipient's own name when there is no parent;
    // storing that would just be noise.
    const parent = rec.parent_name && rec.parent_name !== rec.name ? rec.parent_name : null;
    if (!district && !state && !parent) continue;

    db().transaction((ids: string[]) => {
      for (const id of ids) {
        update.run(parent, state, district, id);
        // Only count the thing this pass exists for. A recipient with a state
        // but no district on file is not a district we learned.
        if (district) updated++;
      }
    })(awardIds);

    if ((i + 1) % 200 === 0) console.log(`    [${i + 1}/${busiest.length}] ${updated} rows back-filled`);
  }

  if (failed > 0) console.log(`    (${failed} recipient lookups failed — those rows keep a null district)`);
  return updated;
}

// ---------------------------------------------------------------------------

export async function ingestUsaspending(): Promise<void> {
  // Another ingestion script may hold the write lock; wait rather than crash.
  db().pragma('busy_timeout = 30000');

  const maxAwards = num('FTM_MAX_AWARDS', 2000);
  const months = num('FTM_AWARD_MONTHS', 24);
  // num() treats 0 as "unset", so read the explicit opt-out separately.
  const skipDistricts = process.env.FTM_AWARD_DISTRICT_LOOKUPS?.trim() === '0';
  const maxLookups = skipDistricts ? 0 : num('FTM_AWARD_DISTRICT_LOOKUPS', 400);

  const today = new Date();
  const window = { start: monthsAgo(today, months), end: today.toISOString().slice(0, 10) };

  console.log(`\nUSASpending ingestion — awards active ${window.start} … ${window.end}`);
  console.log('  No API key needed: USASpending.gov is open to everyone.');
  console.log(`  Up to ${maxAwards} awards (largest first), split across contracts and grants.\n`);

  const byRecipient = new Map<string, string[]>();
  const perGroup = Math.max(1, Math.floor(maxAwards / GROUPS.length));

  let rows = 0, dollars = 0;
  for (const group of GROUPS) {
    try {
      const got = await ingestGroup(group, window, perGroup, byRecipient);
      console.log(`    ${got.rows} ${group.label}, $${Math.round(got.dollars).toLocaleString()}`);
      rows += got.rows;
      dollars += got.dollars;
    } catch (err) {
      // One award type failing should not throw away the other's rows.
      console.warn(`    ${group.label} failed: ${(err as Error).message.split('\n')[0]}`);
    }
  }

  const backfilled = maxLookups > 0 ? await enrichDistricts(byRecipient, maxLookups) : 0;

  setMeta('usaspending_last_run', now());
  setMeta('usaspending_window', `${window.start}..${window.end}`);
  setMeta('usaspending_max_awards', String(maxAwards));
  setMeta('usaspending_cycle', String(CONFIG.cycle()));

  const spread = db().prepare(`
    SELECT COUNT(*) AS total,
           COUNT(DISTINCT industry) AS industries,
           SUM(CASE WHEN industry_method = 'naics' THEN 1 ELSE 0 END) AS by_naics,
           SUM(CASE WHEN industry_method = 'keyword' THEN 1 ELSE 0 END) AS by_keyword,
           SUM(CASE WHEN industry_method = 'unassigned' THEN 1 ELSE 0 END) AS unassigned,
           SUM(CASE WHEN recipient_congressional_district IS NOT NULL THEN 1 ELSE 0 END) AS with_district
    FROM awards WHERE source = 'usaspending'
  `).get() as Record<string, number>;

  console.log(`\n  Done. ${rows} awards this run, $${Math.round(dollars).toLocaleString()} in total award value.`);
  console.log(`  Table now holds ${spread.total} awards across ${spread.industries} industries.`);
  console.log(`  Classified: ${spread.by_naics} by NAICS, ${spread.by_keyword} by keyword, ${spread.unassigned} unassigned.`);
  console.log(`  ${spread.with_district} rows carry a recipient congressional district (${backfilled} back-filled this run).`);
  console.log('\n  Reminder: awards are CONTEXT about where federal money goes. They are');
  console.log('  never evidence that any contribution caused any award.\n');
}

if (isMain(import.meta.url)) {
  ingestUsaspending().catch((err) => {
    console.error(`\nUSASpending ingestion failed: ${err.message}\n`);
    process.exit(1);
  });
}
