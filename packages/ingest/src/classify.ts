/**
 * The semantic matching layer — the part of this project that does the actual
 * thinking.
 *
 * Run:  npm run classify
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES
 *
 * 1. BILL CLASSIFICATION. For each bill, read its title, policy area, subject
 *    terms and official CRS summary, and produce:
 *      - a plain-English paraphrase (never a verbatim copy of the source text)
 *      - a list of industries the bill plausibly affects, each with a
 *        confidence and a one-line rationale
 *    Keyword matching cannot do this. "A bill to amend title XVIII of the
 *    Social Security Act to modify payment for renal dialysis services" has no
 *    keyword overlap with "dialysis providers" or "health providers", but the
 *    connection is obvious to a reader. That gap is the reason this layer
 *    exists.
 *
 * 2. DONOR ORGANISATION RESOLUTION. Campaign committee names like
 *    "DEFEND AMERICAN JOBS" or "BDA PAC" carry no keyword signal but are
 *    well-known entities. The same LLM resolves them to a sector.
 *
 * 3. CACHING. Every result is written to SQLite keyed by a hash of the exact
 *    input. Re-running never re-classifies unchanged work. This matters
 *    because the user is paying for their own calls: the second run of a
 *    400-bill dataset costs $0.
 *
 * ---------------------------------------------------------------------------
 * BYOK, ENFORCED
 *
 * If no key is configured, this script still runs: it falls back to the
 * deterministic keyword classifier and marks every result `keyword-fallback`,
 * which the UI displays honestly. It never calls a model on anyone else's key.
 * ---------------------------------------------------------------------------
 */

import crypto from 'node:crypto';
import {
  INDUSTRIES,
  classifyBillMetadata,
  isCeremonialMeasure,
  lookupOrg,
  classifyTextToIndustries,
  classifyTextToIndustry,
  isIndustryId,
} from '@ftm/core/src';
import type { IndustryId } from '@ftm/core/src';
import { isMain } from './lib/env.js';
import { db, setMeta } from './lib/db.js';
import { complete, describeConfig, parseJsonLoose, resolveLlmConfig, usage } from './lib/llm.js';
import type { LlmConfig } from './lib/llm.js';

const now = () => new Date().toISOString();
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);

const INDUSTRY_MENU = INDUSTRIES.filter((i) => i.id !== 'other')
  .map((i) => `- ${i.id}: ${i.label} — ${i.blurb}`)
  .join('\n');

// ---------------------------------------------------------------------------
// Bill classification
// ---------------------------------------------------------------------------

interface BillRow {
  id: string;
  title: string;
  policy_area: string | null;
  subjects: string;
  official_summary: string | null;
  bill_type: string;
  bill_number: string;
  congress: number;
}

interface LlmBillResult {
  plainSummary: string;
  industries: { industry: string; confidence: number; rationale: string }[];
}

/** The exact text the model sees. Hashed for the cache key. */
function billInputText(b: BillRow): string {
  const subjects = (JSON.parse(b.subjects || '[]') as string[]).slice(0, 25);
  return [
    `Bill: ${b.bill_type.toUpperCase()} ${b.bill_number} (${b.congress}th Congress)`,
    `Title: ${b.title}`,
    b.policy_area ? `Policy area: ${b.policy_area}` : '',
    subjects.length ? `Subject terms: ${subjects.join('; ')}` : '',
    b.official_summary ? `Official summary (source text, paraphrase it — do not copy):\n${b.official_summary.slice(0, 6000)}` : '',
  ].filter(Boolean).join('\n');
}

function billPrompt(input: string): string {
  return `${input}

---

Return ONLY a JSON object, no prose around it, in exactly this shape:

{
  "plainSummary": "2-4 sentences, plain English, written for someone with no legal or policy background. Paraphrase in your own words. Say what the bill would actually change. If the source material is too thin to tell, say that plainly instead of guessing.",
  "industries": [
    { "industry": "<id from the list below>", "confidence": 0.0-1.0, "rationale": "one short sentence on why this sector is affected" }
  ]
}

Rules for "industries":
- List every sector with a genuine, direct stake in this bill. Usually 1-4. Never more than 6.
- "Affected" means the bill would change this sector's costs, revenues, regulatory obligations, or market. It does NOT mean the sector merely finds the topic interesting.
- Confidence is your confidence that the sector is materially affected: 0.9 = the bill is explicitly about them, 0.5 = plausibly affected, 0.3 = tangential.
- If no sector is clearly affected (a ceremonial resolution, a naming bill, an internal procedural measure), return an empty array. An empty array is a correct and useful answer — do not pad it.
- Use ONLY these ids:

${INDUSTRY_MENU}`;
}

/**
 * The offline path. Two signals, in priority order:
 *
 *  1. Library of Congress metadata — the CRS policy area and the curated
 *     legislative subject terms. These are assigned by human librarians and are
 *     by far the better signal.
 *  2. Keyword matching on the title and summary text, as a top-up for sectors
 *     the metadata missed.
 *
 * Returning an empty industry list is a legitimate outcome here (a ceremonial
 * resolution affects no sector), and the export step correctly produces no
 * overlap rows for such a bill rather than inventing one.
 */
function keywordBillFallback(b: BillRow): LlmBillResult {
  const subjectList = JSON.parse(b.subjects || '[]') as string[];
  const fromMetadata = classifyBillMetadata(b.policy_area, subjectList);

  const text = [b.title, b.policy_area ?? '', subjectList.join(' '), (b.official_summary ?? '').slice(0, 4000)].join(' ');
  const seen = new Set(fromMetadata.map((m) => m.industry));
  const fromKeywords = classifyTextToIndustries(text, 4)
    .filter((m) => !seen.has(m.industry))
    .map((m) => ({
      industry: m.industry,
      // Keyword matches deserve less confidence than curated metadata.
      confidence: Math.min(0.5, m.confidence * 0.6),
      rationale: `Keyword match on "${m.matchedOn}" in the bill text. Weaker evidence than the Library of Congress subject terms.`,
    }));

  const summary = b.official_summary
    ? `${b.official_summary.slice(0, 400).trim()}${b.official_summary.length > 400 ? '…' : ''}`
    : b.title;

  return {
    plainSummary:
      `${summary}\n\n(This is the official Congressional Research Service summary, quoted rather than paraphrased, because no LLM key is configured. Set LLM_PROVIDER in .env for a plain-English rewrite.)`,
    industries: [...fromMetadata, ...fromKeywords].sort((a, z) => z.confidence - a.confidence).slice(0, 5),
  };
}

function normalizeIndustries(raw: LlmBillResult['industries']): { industry: IndustryId; confidence: number; rationale: string }[] {
  const seen = new Set<string>();
  const out: { industry: IndustryId; confidence: number; rationale: string }[] = [];
  for (const r of raw ?? []) {
    const id = String(r?.industry ?? '').trim();
    if (!isIndustryId(id) || id === 'other' || seen.has(id)) continue;
    const conf = Number(r?.confidence);
    seen.add(id);
    out.push({
      industry: id,
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
      rationale: String(r?.rationale ?? '').slice(0, 300),
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}

/**
 * Ceremonial measures are excluded from sector tagging entirely.
 *
 * A condolence resolution carries the subject term "firearms". Tagging it, and
 * then showing a member's firearms-sector donors beside it, is an implication
 * this project must never make. See isCeremonialMeasure() in @ftm/core for the
 * full reasoning.
 */
function ceremonialResult(b: BillRow, reason: string): LlmBillResult {
  return {
    plainSummary:
      (b.official_summary ? `${b.official_summary.slice(0, 400).trim()}\n\n` : `${b.title}\n\n`) +
      `This is a ${reason}. It carries no sector tags and no donor overlap is computed for it, ` +
      `because attributing an economic interest to a commemorative or procedural measure would be misleading.`,
    industries: [],
  };
}

/**
 * ---------------------------------------------------------------------------
 * FTM_CLASSIFY_ONLY_WITH_SUMMARY — spend the model where it has something to read
 * ---------------------------------------------------------------------------
 * Only 466 of 1,478 bills in this dataset have a summary written by the
 * Congressional Research Service. The other 1,012 have a title and nothing else.
 *
 * Running the model on those 1,012 is not just poor value for money — it is the
 * wrong thing to do. With only a title to work from, the model cannot describe
 * what a bill does; it can only rephrase the title more fluently, and a fluent
 * rephrasing reads to a reader exactly like a summary. That is precisely what
 * core/plain-bill.ts refuses to do by design (see its rule 4: when only a title
 * exists, say so and tell the reader to open the bill). Paying a model to
 * manufacture the confident-sounding text that layer deliberately withholds
 * would undo the honesty on purpose.
 *
 * So this flag restricts the LLM pass to bills with source text. The rest keep
 * their metadata-derived sector tags and their honest "no summary exists" state.
 *
 * Set it to 1 and the run costs roughly a third as much and produces a strictly
 * better result. It is off by default only because a fork with a different data
 * mix might reasonably want everything.
 * ---------------------------------------------------------------------------
 */
async function classifyBills(cfg: LlmConfig | null, limit: number): Promise<{ done: number; cached: number; failed: number; ceremonial: number }> {
  const onlyWithSummary = process.env.FTM_CLASSIFY_ONLY_WITH_SUMMARY === '1';
  if (onlyWithSummary) {
    console.log('  FTM_CLASSIFY_ONLY_WITH_SUMMARY=1 — only bills with a CRS summary go to the model.');
    console.log('  Bills with just a title keep their metadata tags and say plainly that no summary exists.');
  }
  const bills = db().prepare(`
    SELECT id, title, policy_area, subjects, official_summary, bill_type, bill_number, congress
    FROM bills
    WHERE (? = 0 OR (official_summary IS NOT NULL AND length(official_summary) > 50))
    ORDER BY latest_action_date DESC NULLS LAST LIMIT ?
  `).all(onlyWithSummary ? 1 : 0, limit) as BillRow[];

  const existing = new Map(
    (db().prepare('SELECT bill_id, input_hash, method FROM bill_classifications').all() as
      { bill_id: string; input_hash: string; method: string }[]).map((r) => [r.bill_id, r]),
  );

  const stmt = db().prepare(`
    INSERT INTO bill_classifications (bill_id, plain_summary, industries, method, model, input_hash, classified_at)
    VALUES (@bill_id, @plain_summary, @industries, @method, @model, @input_hash, @classified_at)
    ON CONFLICT(bill_id) DO UPDATE SET
      plain_summary = excluded.plain_summary, industries = excluded.industries, method = excluded.method,
      model = excluded.model, input_hash = excluded.input_hash, classified_at = excluded.classified_at
  `);

  let done = 0, cached = 0, failed = 0, ceremonial = 0;

  for (const [i, b] of bills.entries()) {
    const cer = isCeremonialMeasure(b.title, b.bill_type, b.policy_area, JSON.parse(b.subjects || '[]') as string[]);
    const input = cer.ceremonial ? `CEREMONIAL:${b.title}` : billInputText(b);
    const h = hash(input);
    const prev = existing.get(b.id);

    // Cache hit: same input, and we are not upgrading a keyword fallback to a
    // real LLM reading.
    if (prev && prev.input_hash === h && !(cfg && prev.method === 'keyword-fallback')) {
      cached++;
      continue;
    }

    let result: LlmBillResult | null = null;
    let method: 'llm' | 'keyword-fallback' = 'keyword-fallback';

    if (cer.ceremonial) {
      result = ceremonialResult(b, cer.reason!);
      ceremonial++;
    } else if (cfg) {
      try {
        const text = await complete(cfg, billPrompt(input), { maxTokens: 900 });
        const parsed = parseJsonLoose<LlmBillResult>(text);
        if (parsed && typeof parsed.plainSummary === 'string') {
          result = parsed;
          method = 'llm';
        } else {
          console.warn(`    ${b.id}: could not parse model output, falling back to keywords`);
          failed++;
        }
      } catch (err) {
        console.warn(`    ${b.id}: ${(err as Error).message.slice(0, 120)} — falling back to keywords`);
        failed++;
      }
    }

    if (!result) result = keywordBillFallback(b);

    stmt.run({
      bill_id: b.id,
      plain_summary: String(result.plainSummary ?? '').slice(0, 4000),
      industries: JSON.stringify(normalizeIndustries(result.industries)),
      method,
      model: method === 'llm' ? cfg!.model : null,
      input_hash: h,
      classified_at: now(),
    });
    done++;

    if ((i + 1) % 25 === 0 || i === bills.length - 1) {
      console.log(`  [${i + 1}/${bills.length}] classified ${done}, cached ${cached}`);
    }
  }

  return { done, cached, failed, ceremonial };
}

// ---------------------------------------------------------------------------
// Donor organisation resolution
// ---------------------------------------------------------------------------

interface OrgBatchResult {
  results: { name: string; industry: string; confidence: number }[];
}

function orgPrompt(names: string[]): string {
  return `Below is a list of names taken from US Federal Election Commission filings. Each is either the name of a political committee (a PAC) or the self-reported employer of an individual donor.

For each name, identify which economic sector the organisation belongs to.

${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY a JSON object of this shape, with one entry per input name, in the same order:

{"results": [{"name": "<the exact input name>", "industry": "<id from the list>", "confidence": 0.0-1.0}]}

Rules:
- Use "other" with confidence 0 when you do not recognise the organisation or when the name genuinely does not indicate a sector. Guessing is worse than admitting ignorance here — a wrong sector produces a misleading chart.
- A PAC named after a slogan rather than an industry ("A Brighter Tomorrow PAC") is "ideological-single-issue" only if it is clearly a cause-based group; otherwise use "other".
- Party committees, leadership PACs, and candidate campaign committees are "party-leadership".
- Government bodies, public agencies and public universities are "government".
- Confidence reflects how sure you are of the *organisation's identity*, not how strongly you feel about it.

Valid ids:

${INDUSTRY_MENU}
- other: cannot be determined from the name`;
}

async function resolveOrganisations(cfg: LlmConfig | null, limit: number, batchSize: number): Promise<{ resolved: number; attempted: number }> {
  if (!cfg) {
    console.log('  Skipping donor-organisation resolution: no LLM key configured.');
    console.log('  (The keyword classifier has already done what it can offline.)');
    return { resolved: 0, attempted: 0 };
  }

  // Biggest unresolved money first — that is where accuracy actually moves the
  // numbers a reader sees.
  const targets = db().prepare(`
    SELECT c.contributor_name AS name, SUM(c.amount) AS amt
    FROM contributions c
    LEFT JOIN employer_industry_cache e ON e.normalized_employer = UPPER(c.contributor_name)
    WHERE c.industry = 'other'
      AND (e.method IS NULL OR e.method = 'unassigned')
    GROUP BY c.contributor_name
    ORDER BY amt DESC
    LIMIT ?
  `).all(limit) as { name: string; amt: number }[];

  if (targets.length === 0) return { resolved: 0, attempted: 0 };
  console.log(`  resolving ${targets.length} donor organisations (largest unresolved money first)…`);

  const write = db().prepare(`
    INSERT INTO employer_industry_cache (normalized_employer, industry, confidence, method, model, resolved_at)
    VALUES (?, ?, ?, 'llm', ?, ?)
    ON CONFLICT(normalized_employer) DO UPDATE SET
      industry = excluded.industry, confidence = excluded.confidence,
      method = excluded.method, model = excluded.model, resolved_at = excluded.resolved_at
  `);

  let resolved = 0;
  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const names = batch.map((t) => t.name);
    try {
      const text = await complete(cfg, orgPrompt(names), { maxTokens: 200 + batch.length * 60 });
      const parsed = parseJsonLoose<OrgBatchResult>(text);
      const results = parsed?.results ?? [];
      const byName = new Map(results.map((r) => [String(r.name ?? '').trim().toUpperCase(), r]));

      db().transaction(() => {
        for (const t of batch) {
          const r = byName.get(t.name.trim().toUpperCase());
          const id = String(r?.industry ?? 'other').trim();
          const conf = Number(r?.confidence);
          if (!isIndustryId(id) || id === 'other' || !Number.isFinite(conf) || conf < 0.4) {
            // Record the miss so we never pay to ask about this name again.
            write.run(t.name.toUpperCase(), 'other', 0, cfg.model, now());
            return;
          }
          write.run(t.name.toUpperCase(), id, Math.min(1, conf), cfg.model, now());
          resolved++;
        }
      })();
    } catch (err) {
      console.warn(`    batch ${i / batchSize + 1}: ${(err as Error).message.slice(0, 120)}`);
    }
    console.log(`    [${Math.min(i + batchSize, targets.length)}/${targets.length}] ${resolved} resolved`);
  }

  return { resolved, attempted: targets.length };
}

/** Pushes the resolved cache back onto the contribution rows. */
function applyIndustryCache(): number {
  const res = db().prepare(`
    UPDATE contributions
    SET industry = (SELECT e.industry FROM employer_industry_cache e WHERE e.normalized_employer = UPPER(contributions.contributor_name)),
        industry_confidence = (SELECT e.confidence FROM employer_industry_cache e WHERE e.normalized_employer = UPPER(contributions.contributor_name)),
        industry_method = (SELECT e.method FROM employer_industry_cache e WHERE e.normalized_employer = UPPER(contributions.contributor_name))
    WHERE EXISTS (
      SELECT 1 FROM employer_industry_cache e
      WHERE e.normalized_employer = UPPER(contributions.contributor_name)
        AND e.confidence > 0
        AND e.industry != contributions.industry
    )
  `).run();
  return res.changes;
}

/**
 * Backfills the offline keyword classifier over any contribution row that has
 * never been looked at. Costs nothing and runs whether or not a key is set.
 */
function applyKeywordBackfill(): number {
  const rows = db().prepare(`
    SELECT DISTINCT contributor_name FROM contributions
    WHERE industry = 'other' AND industry_method IN ('unassigned', 'placeholder')
  `).all() as { contributor_name: string }[];

  const write = db().prepare(`
    INSERT INTO employer_industry_cache (normalized_employer, industry, confidence, method, model, resolved_at)
    VALUES (?, ?, ?, ?, NULL, ?) ON CONFLICT(normalized_employer) DO NOTHING
  `);
  let n = 0;
  db().transaction(() => {
    for (const r of rows) {
      // Curated organisation knowledge first — it is the higher-quality signal
      // and encodes facts a regex cannot know. This backfill previously skipped
      // it, so newly-added curated entries never reached existing rows.
      const known = lookupOrg(r.contributor_name);
      if (known) {
        write.run(r.contributor_name.toUpperCase(), known.industry, known.confidence, 'keyword', now());
        n++;
        continue;
      }
      const m = classifyTextToIndustry(r.contributor_name);
      if (m.confidence <= 0) continue;
      write.run(r.contributor_name.toUpperCase(), m.industry, m.confidence, 'keyword', now());
      n++;
    }
  })();
  return n;
}

// ---------------------------------------------------------------------------

export async function classify(): Promise<void> {
  const cfg = resolveLlmConfig();
  const maxBills = Number(process.env.FTM_CLASSIFY_BILLS ?? 1000);
  const maxOrgs = Number(process.env.FTM_CLASSIFY_ORGS ?? 400);
  const batchSize = Number(process.env.FTM_ORG_BATCH ?? 25);

  console.log(`\nClassification layer`);
  console.log(`  model: ${describeConfig(cfg)}\n`);

  const bills = await classifyBills(cfg, maxBills);
  console.log(`  bills: ${bills.done} classified, ${bills.cached} already cached, ${bills.failed} model errors`);
  console.log(`  ${bills.ceremonial} commemorative, honorific or procedural measures deliberately left untagged`);

  const backfilled = applyKeywordBackfill();
  if (backfilled) console.log(`  keyword backfill resolved ${backfilled} organisation names offline`);

  const orgs = await resolveOrganisations(cfg, maxOrgs, batchSize);
  if (orgs.attempted) console.log(`  organisations: ${orgs.resolved}/${orgs.attempted} resolved`);

  const updated = applyIndustryCache();
  console.log(`  ${updated} contribution rows re-labelled from the resolution cache`);

  setMeta('classify_last_run', now());
  setMeta('classify_method', cfg ? `llm:${cfg.model}` : 'keyword-fallback');

  if (cfg) {
    console.log(`\n  LLM usage this run: ${usage.calls} calls, ~${usage.inputTokens} input tokens, ~${usage.outputTokens} output tokens.`);
    console.log(`  Billed to your own ${cfg.provider} account. Re-running is free for anything already cached.`);
  }

  const gap = db().prepare(`
    SELECT COALESCE(SUM(CASE WHEN industry = 'other' THEN amount END), 0) AS unresolved,
           COALESCE(SUM(amount), 0) AS total FROM contributions
  `).get() as { unresolved: number; total: number };
  console.log(`\n  Money still unattributed to a sector: $${Math.round(gap.unresolved).toLocaleString()} of $${Math.round(gap.total).toLocaleString()} (${((gap.unresolved / Math.max(1, gap.total)) * 100).toFixed(1)}%).`);
  console.log(`  That figure is shown to users on every donor breakdown. It is never hidden.\n`);
}

if (isMain(import.meta.url)) {
  classify().catch((err) => {
    console.error(`\nClassification failed: ${err.message}\n`);
    process.exit(1);
  });
}
