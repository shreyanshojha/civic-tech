/**
 * Cohort patterns: every full committee against every sector.
 *
 *   read ftm.sqlite -> one observation per member per sector -> permutation test
 *   -> Benjamini–Hochberg over the whole search -> static JSON
 *
 * Run:  npm run ingest:patterns
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A reader could not learn anything from this site, and the reason was
 * resolution, not wording. Every view was one member or one bill. One member's
 * share of money from one sector has a sample size of one; it is dominated by
 * which committee that member sits on and which industries are in their state,
 * so no amount of hedging makes it mean more than it does.
 *
 * The comparison that has a sample size is the cohort: the members on a
 * committee against the members of the same chamber who are not on it. That
 * question can be tested, and each way it can go wrong can be measured. All of
 * that statistical work lives in packages/core/src/patterns.ts. This file's job
 * is only to build the observations honestly and to run the search over the
 * whole grid rather than over the interesting corner of it.
 *
 * ---------------------------------------------------------------------------
 * THE ONE PROPERTY THAT MATTERS MOST
 *
 * `adjustPatterns` is called ONCE, over every pair that was tested, including
 * the ~1,000 that look like nothing. There are about 1,100 comparisons here. At
 * p < 0.05 chance alone produces roughly fifty "findings", so a false-discovery
 * correction computed over only the promising subset is arithmetically the same
 * as no correction at all — and it would be worse than no correction, because
 * the page would carry a q-value that a reader could reasonably trust.
 *
 * So: collect everything, adjust once, then decide what to publish. Never filter
 * before the adjustment. If you are editing this file and find yourself adding a
 * `.filter()` above the `adjustPatterns` call, that is the bug.
 *
 * ---------------------------------------------------------------------------
 * TWO JOINS THAT HAVE BROKEN BEFORE
 *
 * 1. MONEY TO MEMBERS runs through `legislators.fec_candidate_ids`, a JSON list
 *    of FEC candidate IDs per member. A member can have several (an old House ID
 *    plus a current Senate one), and `contributions.recipient_candidate_id`
 *    holds FEC IDs for challengers and retirees too. This crosswalk has silently
 *    emptied before, and an empty crosswalk does not crash — it produces a page
 *    of zeros that looks like a finding about a quiet Congress. So the coverage
 *    is asserted below and the script dies rather than write that file.
 *
 * 2. COMMITTEES are matched by CODE, never by name. A four-character code is a
 *    full committee; anything longer is a subcommittee — and a subcommittee row
 *    carries its PARENT's name in `committee_name` ("HSAG03" is filed under
 *    "House Committee on Agriculture"). Grouping by name would count many
 *    members two or three times and inflate every cohort.
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { INDUSTRIES, PATTERN_THRESHOLDS, adjustPatterns, computePattern } from '@ftm/core/src';
import type { MemberObservation, Pattern, PatternVerdict } from '@ftm/core/src';
import { CONFIG, MOBILE_DATA_DIR, WEB_DATA_DIR, isMain } from './lib/env.js';
import { db } from './lib/db.js';

/**
 * Sectors that are not sectors.
 *
 * `other` is money whose employer field was blank, "SELF" or "RETIRED" — about
 * two thirds of the dataset. `super-pac-unattributed` is money whose own donors
 * are disclosed in a filing this pipeline does not traverse. Neither is an
 * industry, so neither can be the subject of a comparison, and — this is the
 * part that changes the numbers — neither belongs in the DENOMINATOR either.
 * See the long comment on MemberObservation.share: dividing by total money would
 * make the comparison partly a measure of paperwork quality, because a member
 * whose filings are mostly blank would score near zero on every sector no matter
 * who actually funded them.
 */
const PSEUDO_SECTORS = new Set(['other', 'super-pac-unattributed']);

/** Every real sector, in taxonomy order, so the grid is the same on every run. */
const SECTORS = INDUSTRIES.filter((i) => !PSEUDO_SECTORS.has(i.id));

/** A full committee code is exactly four characters. Longer is a subcommittee. */
const FULL_COMMITTEE_CODE_LENGTH = 4;

/**
 * Permutation iterations.
 *
 * 10,000 over ~1,100 pairs measured at roughly two minutes on a laptop, which is
 * well inside the budget, so there is no two-stage screen and no mixed iteration
 * counts to explain to a reader. The count is written into `meta` because the
 * smallest p-value this test can return is 1/(iterations+1), and a reader
 * comparing q-values needs to know where that floor is.
 */
const ITERATIONS = 10_000;

/**
 * Per-member shares kept for the distribution plot, rounded to four decimals.
 *
 * The plot — one dot per member, cohort and baseline on two rows — is the single
 * most informative thing on the detail page, because it shows overlap and spread
 * instead of two averages that could hide either. It needs the raw shares.
 *
 * Four decimals is 0.01 of a percentage point: finer than any pixel on the plot
 * and finer than this data deserves. No names travel with these numbers beyond
 * the handful already in `examples`; a full per-member table for a thousand
 * patterns would be a much larger file and would turn a group comparison back
 * into the per-person view that did not work.
 */
const SHARE_DECIMALS = 4;

/** Above this the file is too big to ship, and `not-supported` detail is dropped. */
const SIZE_BUDGET_BYTES = 1_000_000;

/**
 * Never publish fewer than this many `not-supported` rows.
 *
 * The list of failures is what shows the base rate of the search. If the budget
 * ever squeezed it to a handful, the file should get bigger rather than let the
 * shortlist stand almost alone.
 */
const NOT_SUPPORTED_FLOOR = 100;

interface PatternOut extends Pattern {
  /** Every cohort member's share, rounded. Order is not meaningful. */
  cohortShares: number[];
  /** Every baseline member's share, rounded. Order is not meaningful. */
  baselineShares: number[];
}

interface MemberRow {
  bioguideId: string;
  name: string;
  chamber: string;
  state: string;
  party: string;
  /** Total disclosed money for the cycle, all sectors including the pseudo ones. */
  total: number;
  /** Money that could be placed in a real sector. */
  attributable: number;
  /** Placed money by sector id. */
  bySector: Map<string, number>;
}

const round = (x: number) => Number(x.toFixed(SHARE_DECIMALS));

/**
 * fec candidate id -> bioguide id.
 *
 * Built from the `legislators` table rather than from `fec_candidates`, because
 * `fec_candidate_ids` is the column the rest of the app treats as the member's
 * own list of filings, and a crosswalk that disagrees with it would put money on
 * a member's page that this comparison does not see.
 */
function buildFecCrosswalk(rows: { bioguide_id: string; fec_candidate_ids: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  let unparsable = 0;
  for (const r of rows) {
    let ids: unknown;
    try {
      ids = JSON.parse(r.fec_candidate_ids || '[]');
    } catch {
      unparsable++;
      continue;
    }
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      if (typeof id === 'string' && id.trim()) map.set(id.trim(), r.bioguide_id);
    }
  }
  if (unparsable > 0) {
    console.warn(`  warning: ${unparsable} legislators have an fec_candidate_ids value that is not JSON`);
  }
  return map;
}

export async function ingestPatterns(): Promise<void> {
  const startedAt = Date.now();
  const cycle = CONFIG.cycle();
  console.log(`\nTesting every full committee against every sector, FEC cycle ${cycle}\n`);

  // ---- members ------------------------------------------------------------
  const legislators = db().prepare(`
    SELECT bioguide_id, name, chamber, state, party, fec_candidate_ids
    FROM legislators
  `).all() as { bioguide_id: string; name: string; chamber: string; state: string; party: string | null; fec_candidate_ids: string }[];

  const fecToBioguide = buildFecCrosswalk(legislators);

  const members = new Map<string, MemberRow>();
  for (const l of legislators) {
    members.set(l.bioguide_id, {
      bioguideId: l.bioguide_id,
      name: l.name,
      chamber: l.chamber,
      state: l.state,
      party: l.party ?? '',
      total: 0,
      attributable: 0,
      bySector: new Map(),
    });
  }

  // ---- money --------------------------------------------------------------
  // Grouped in SQL because the per-row table is 200k rows and only the sums are
  // needed. NULL industry is treated exactly like `other`: money that exists but
  // cannot be placed, so it counts towards total and not towards attributable.
  const money = db().prepare(`
    SELECT recipient_candidate_id AS candidate_id,
           industry               AS industry,
           SUM(amount)            AS amount
    FROM contributions
    WHERE cycle = ?
    GROUP BY recipient_candidate_id, industry
  `).all(cycle) as { candidate_id: string; industry: string | null; amount: number }[];

  let dollarsToMembers = 0;
  let dollarsToNonMembers = 0;
  for (const row of money) {
    const bioguideId = fecToBioguide.get(row.candidate_id);
    if (!bioguideId) {
      // Challengers, retiring members and candidates for seats nobody in this
      // dataset holds. Not a join failure — they are genuinely not in Congress.
      dollarsToNonMembers += row.amount;
      continue;
    }
    const m = members.get(bioguideId);
    if (!m) continue;
    dollarsToMembers += row.amount;
    m.total += row.amount;
    const sector = row.industry;
    if (sector && !PSEUDO_SECTORS.has(sector)) {
      m.attributable += row.amount;
      m.bySector.set(sector, (m.bySector.get(sector) ?? 0) + row.amount);
    }
  }

  const withMoney = [...members.values()].filter((m) => m.total > 0).length;
  const comparable = [...members.values()].filter((m) => m.total >= PATTERN_THRESHOLDS.minMemberTotal).length;

  console.log(`  members                 ${members.size}`);
  console.log(`  members with money      ${withMoney}`);
  console.log(`  above the size floor    ${comparable} (at least $${PATTERN_THRESHOLDS.minMemberTotal.toLocaleString()})`);
  console.log(`  money placed on members $${Math.round(dollarsToMembers).toLocaleString()}`);
  console.log(`  money to non-members    $${Math.round(dollarsToNonMembers).toLocaleString()}`);

  /**
   * The crosswalk assertion.
   *
   * A broken join here writes a file full of zeros that reads as a finding, so
   * this fails the build instead. The floor is 500 of 537: a handful of members
   * genuinely have no itemized money in a cycle (appointed mid-term, retiring,
   * or safe enough not to raise), and demanding all 537 would break on a real
   * dataset. Anything below 500 means the crosswalk, not the Congress.
   */
  const MIN_MEMBERS_WITH_MONEY = 500;
  if (withMoney < MIN_MEMBERS_WITH_MONEY) {
    throw new Error(
      `Only ${withMoney} of ${members.size} members have any contributions attached. `
      + `That is the fec_candidate_ids crosswalk failing, not a quiet Congress — `
      + `${fecToBioguide.size} FEC ids were mapped and $${Math.round(dollarsToNonMembers).toLocaleString()} `
      + `landed on nobody. Refusing to write patterns.json from it.`,
    );
  }

  // ---- committees ---------------------------------------------------------
  const memberships = db().prepare(`
    SELECT bioguide_id, committee_code, committee_name
    FROM committee_memberships
    WHERE length(committee_code) = ?
  `).all(FULL_COMMITTEE_CODE_LENGTH) as { bioguide_id: string; committee_code: string; committee_name: string }[];

  const committees = new Map<string, { name: string; members: Set<string> }>();
  for (const r of memberships) {
    const entry = committees.get(r.committee_code) ?? { name: r.committee_name, members: new Set<string>() };
    if (members.has(r.bioguide_id)) entry.members.add(r.bioguide_id);
    committees.set(r.committee_code, entry);
  }

  /**
   * Which chamber a committee belongs to comes from its members, not its code.
   *
   * The `H`/`S` prefix does hold in this data — checked, all 15 `H` committees
   * are House-only and all 26 `S` ones Senate-only — but the joint committees
   * (`JSEC`, `JSTX`, `JSPR`, `JSLC`, `JCSE`) have no usable prefix at all, and
   * trusting the letter would file half of a joint committee's members against
   * the wrong baseline. Reading the chamber off the members cannot be wrong.
   *
   * A committee with members in both chambers is tested once per chamber: a
   * House member's baseline must be other House members, because the two
   * chambers raise money at completely different scales.
   */
  const chambersOf = (codeMembers: Set<string>): string[] => {
    const set = new Set<string>();
    for (const id of codeMembers) {
      const chamber = members.get(id)?.chamber;
      if (chamber) set.add(chamber);
    }
    return [...set].sort();
  };

  const byChamber = new Map<string, string[]>();
  for (const m of members.values()) {
    byChamber.set(m.chamber, [...(byChamber.get(m.chamber) ?? []), m.bioguideId]);
  }

  function observe(bioguideId: string, sector: string): MemberObservation | null {
    const m = members.get(bioguideId);
    if (!m) return null;
    return {
      bioguideId: m.bioguideId,
      name: m.name,
      state: m.state,
      party: m.party,
      // Attributable money is the denominator. See PSEUDO_SECTORS above.
      share: m.attributable > 0 ? (m.bySector.get(sector) ?? 0) / m.attributable : 0,
      attributionRate: m.total > 0 ? m.attributable / m.total : 0,
      total: m.total,
    };
  }

  // ---- the search ---------------------------------------------------------
  const raw: PatternOut[] = [];
  let pairsSkippedTooSmall = 0;
  let committeeChamberPairs = 0;

  for (const [code, committee] of [...committees].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const chamber of chambersOf(committee.members)) {
      const cohortIds = [...committee.members].filter((id) => members.get(id)?.chamber === chamber);
      const baselineIds = (byChamber.get(chamber) ?? []).filter((id) => !committee.members.has(id));
      committeeChamberPairs++;

      for (const sector of SECTORS) {
        const cohort = cohortIds.map((id) => observe(id, sector.id)).filter((o): o is MemberObservation => o !== null);
        const baseline = baselineIds.map((id) => observe(id, sector.id)).filter((o): o is MemberObservation => o !== null);

        const pattern = computePattern({
          committeeCode: code,
          committeeName: committee.name,
          chamber,
          sector: sector.id,
          sectorLabel: sector.label,
          cohort,
          baseline,
          iterations: ITERATIONS,
        });

        // null means the groups are too small to say anything — a different
        // outcome from "we looked and found nothing", and it must NOT enter the
        // BH denominator, because no test was run.
        if (!pattern) {
          pairsSkippedTooSmall++;
          continue;
        }

        // computePattern applies the same size floor to both groups, so the
        // shares plotted have to come from the filtered sets or the plot would
        // show members the statistics ignored.
        const keep = (o: MemberObservation) => o.total >= PATTERN_THRESHOLDS.minMemberTotal;
        raw.push({
          ...pattern,
          cohortShares: cohort.filter(keep).map((o) => round(o.share)),
          baselineShares: baseline.filter(keep).map((o) => round(o.share)),
        });
      }
    }
  }

  /**
   * Pattern ids must be unique, because the detail page is addressed by id.
   *
   * `computePattern` builds the id from committee code plus sector, which
   * collides if a joint committee is ever large enough to be tested in both
   * chambers. No joint committee reaches the twelve-member floor in either
   * chamber today, so this cannot fire — and if the data changes so that it can,
   * a loud failure is much better than two patterns sharing one URL.
   */
  const seen = new Set<string>();
  for (const p of raw) {
    if (seen.has(p.id)) {
      throw new Error(
        `Two patterns share the id "${p.id}". A committee with members in both chambers is now `
        + `large enough to test twice, so the id needs a chamber qualifier before this can ship.`,
      );
    }
    seen.add(p.id);
  }

  // ---- the correction, once, over everything ------------------------------
  const adjusted = adjustPatterns(raw) as PatternOut[];

  const verdictCounts: Record<PatternVerdict, number> = {
    'worth-a-look': 0,
    weak: 0,
    'not-supported': 0,
  };
  for (const p of adjusted) verdictCounts[p.verdict]++;

  /**
   * Output order: `worth-a-look` first, then by ratio.
   *
   * Ratio, not q-value, inside a verdict. A q-value orders by how surprised the
   * test was, which is mostly a function of cohort size; ratio orders by the
   * size of the gap, which is the thing a reader is deciding whether to spend
   * time on. Every pattern carries both.
   */
  const verdictRank: Record<PatternVerdict, number> = { 'worth-a-look': 0, weak: 1, 'not-supported': 2 };
  const sorted = [...adjusted].sort(
    (a, b) => verdictRank[a.verdict] - verdictRank[b.verdict] || b.ratio - a.ratio,
  );

  /**
   * Trimming, if it is needed, and said out loud if it happens.
   *
   * Rule 4 in core/patterns.ts: a pattern that failed is still published, marked
   * failed, because dropping it hides the base rate and makes the survivors look
   * stronger than they are. So `worth-a-look` and `weak` are never touched.
   *
   * A thousand `not-supported` patterns each carrying ~400 baseline shares is
   * megabytes of JSON that no reader will open, so if the file busts its budget
   * the ones furthest from the thresholds lose their per-member arrays and then
   * their rows — closest-first, by q-value, so what survives is the near misses
   * rather than an arbitrary slice. `meta` records exactly what went, and the
   * count of every verdict is reported whether or not its rows are here.
   */
  const size = (rows: PatternOut[]) => JSON.stringify(rows).length;
  let patterns = sorted;
  const dropped: string[] = [];

  if (size(patterns) > SIZE_BUDGET_BYTES) {
    patterns = patterns.map((p) =>
      p.verdict === 'not-supported' ? { ...p, cohortShares: [], baselineShares: [] } : p,
    );
    dropped.push(
      'The per-member share arrays were removed from the not-supported patterns, so those have no '
      + 'distribution plot. Every other figure on them is unchanged.',
    );
  }

  if (size(patterns) > SIZE_BUDGET_BYTES) {
    const supported = patterns.filter((p) => p.verdict !== 'not-supported');
    const notSupported = patterns
      .filter((p) => p.verdict === 'not-supported')
      .sort((a, b) => a.qValue - b.qValue || b.ratio - a.ratio);
    // Fill the remaining budget with near misses rather than cutting at a round
    // number: the more of the failed set a reader can see, the better they can
    // judge how ordinary the shortlist is.
    let kept = notSupported.length;
    while (kept > NOT_SUPPORTED_FLOOR && size([...supported, ...notSupported.slice(0, kept)]) > SIZE_BUDGET_BYTES) {
      kept -= 10;
    }
    patterns = [...supported, ...notSupported.slice(0, kept)];
    dropped.push(
      `Of ${verdictCounts['not-supported']} not-supported patterns, the ${kept} that came `
      + `closest to the thresholds are listed and ${notSupported.length - kept} are counted here `
      + 'but not listed. All of them were tested and all of them are in the correction below.',
    );
  }

  const elapsedMs = Date.now() - startedAt;

  const payload = {
    generatedAt: new Date().toISOString(),
    meta: {
      cycle,
      /** Committees whose members were counted by code, full committees only. */
      committeesTested: committees.size,
      committeeChamberGroupsTested: committeeChamberPairs,
      sectorsTested: SECTORS.length,
      /**
       * The denominator of the search, and the m in the Benjamini–Hochberg
       * correction. A reader has to be able to see this next to the shortlist,
       * or the shortlist looks like a set of discoveries rather than the tail of
       * a thousand comparisons.
       */
      pairsTested: adjusted.length,
      pairsSkippedTooSmall,
      verdictCounts,
      patternsListed: patterns.length,
      fdrThreshold: PATTERN_THRESHOLDS.maxQValue,
      permutationIterations: ITERATIONS,
      /** The smallest p-value this test can produce, so a q-value has a floor. */
      smallestPossiblePValue: 1 / (ITERATIONS + 1),
      minMemberTotal: PATTERN_THRESHOLDS.minMemberTotal,
      minCohortSize: PATTERN_THRESHOLDS.minCohortSize,
      membersTested: comparable,
      membersWithMoney: withMoney,
      membersTotal: members.size,
      dropped,
      elapsedMs,
    },
    patterns,
  };

  for (const dir of [WEB_DATA_DIR, MOBILE_DATA_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'patterns.json'), JSON.stringify(payload));
  }

  const bytes = fs.statSync(path.join(WEB_DATA_DIR, 'patterns.json')).size;
  console.log(`\n  committee × sector pairs tested   ${adjusted.length}`);
  console.log(`  pairs too small to test           ${pairsSkippedTooSmall}`);
  console.log(`  worth a look                      ${verdictCounts['worth-a-look']}`);
  console.log(`  mixed (some checks failed)        ${verdictCounts.weak}`);
  console.log(`  does not hold up                  ${verdictCounts['not-supported']}`);
  console.log(`  rows written                      ${patterns.length}`);
  for (const note of dropped) console.log(`  · ${note}`);
  console.log(`\n  wrote patterns.json — ${(bytes / 1024).toFixed(0)} KB, in ${(elapsedMs / 1000).toFixed(0)}s\n`);

  for (const p of patterns.filter((x) => x.verdict === 'worth-a-look').slice(0, 8)) {
    console.log(
      `  ${p.ratio.toFixed(2)}×  q=${p.qValue.toExponential(1)}  trimmed=${p.checks.trimmedRatio.toFixed(2)}×  `
      + `${p.checks.aboveBaselineMedian}/${p.cohort.n} above baseline median  —  ${p.committeeName} / ${p.sectorLabel}`,
    );
  }
  console.log('');
}

if (isMain(import.meta.url)) {
  ingestPatterns().catch((err) => {
    console.error(`\nPattern search failed: ${err.message}\n`);
    process.exit(1);
  });
}
