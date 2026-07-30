/**
 * COHORT PATTERNS — the only place this project makes a claim about a group.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A reader could not learn anything from this tool, and the diagnosis was not
 * that the caveats were too loud. It was that every view in the app was a single
 * member or a single bill — and at that resolution there is almost nothing to
 * learn. One member's share of money from one sector is a number with a sample
 * size of one, dominated by which committee they happen to sit on and which
 * industries happen to be in their state. Loosening the language around that
 * number would not have made it mean more. It would have made the page lie.
 *
 * The signal in this dataset is at the cohort level: does the *group* of members
 * on a committee differ from the group that is not on it. That question has a
 * real sample size, it can be tested, and the ways it can go wrong can each be
 * measured rather than merely disclaimed.
 *
 * So this module compares a cohort against a baseline and — this is the whole
 * point — computes every reason the comparison might be worthless alongside the
 * comparison itself. The UI shows the checks next to the finding. A reader does
 * not have to trust that somebody thought about outliers; they can see the
 * number with the outliers removed.
 *
 * ---------------------------------------------------------------------------
 * RULES FOR THIS FILE, ENFORCED BY TESTS IN core.test.ts
 *
 * 1. Never emit a causal claim. A pattern says money is distributed unevenly
 *    with respect to committee membership. It does not say why, and this file
 *    has no information that could establish why.
 * 2. Never rank people. The unit of analysis is a group. Individual members
 *    appear only as examples a reader can go and check.
 * 3. Every statistic that could be inflated by an outlier must ship next to a
 *    version of itself that is not. That is what `trimmed` and `median` are for.
 * 4. A pattern that fails a robustness check is still returned, marked failed,
 *    with the reason. Silently dropping it would hide the base rate and make the
 *    surviving ones look more impressive than they are.
 * 5. The strongest permitted conclusion is "this is worth looking into", exactly
 *    as in meaning.ts. No verdict string in this file may be stronger.
 * ---------------------------------------------------------------------------
 */

import type { IndustryId } from './types.js';

/** One member's contribution to a cohort comparison. */
export interface MemberObservation {
  bioguideId: string;
  name: string;
  state: string;
  party: string;
  /**
   * Share of this member's ATTRIBUTABLE money that came from the sector under
   * test, 0–1.
   *
   * Attributable, not total, and the distinction decides whether the comparison
   * means anything. Roughly two thirds of the money in this dataset cannot be
   * placed in any sector — most of it because no employer was written on the
   * filing. If the denominator were total money, a member whose filings are
   * mostly blank would score near zero on every sector regardless of who
   * actually funded them, and the comparison would be measuring paperwork
   * quality. Using placed money asks the like-for-like question: of the money we
   * can identify, how much is this sector.
   *
   * The cost of that choice is that a cohort could differ in how much of its
   * money is placeable at all, which would confound the result — so
   * `attributionRate` is carried along and reported for both groups.
   */
  share: number;
  /** Share of this member's money that could be placed in ANY sector, 0–1. */
  attributionRate: number;
  /** Total money, used only to exclude members too small to compare. */
  total: number;
}

export interface CohortStats {
  n: number;
  meanShare: number;
  medianShare: number;
  /** Median share of money that could be placed at all — the confound check. */
  medianAttributionRate: number;
}

export interface PartyBreakdown {
  party: string;
  cohortMean: number;
  baselineMean: number;
  ratio: number;
  n: number;
}

export interface RobustnessChecks {
  /**
   * The ratio recomputed with the cohort's five highest members removed. If a
   * pattern is really five people it collapses here, and that is the single
   * most common way a result like this turns out to be nothing.
   */
  trimmedRatio: number;
  /**
   * How many of the cohort sit above the baseline's median, and what share of
   * the cohort that is.
   *
   * This is the most interpretable number in the whole file and the UI leads
   * with it. A ratio of means can be produced by a handful of large values; "43
   * of 51 members are above the typical non-member" cannot. It is the
   * difference between a pattern in a group and a few notable individuals.
   */
  aboveBaselineMedian: number;
  aboveBaselineMedianShare: number;
  /** Per-party comparison. A pattern present in only one party is confounded with party. */
  partyBreakdown: PartyBreakdown[];
  /**
   * True when the pattern holds in both major parties. Not "bipartisan" as a
   * compliment — it is a control. If money tracks committee membership in both
   * parties, party is not the explanation.
   */
  holdsInBothParties: boolean;
  /** Distinct states among the cohort's ten highest members, and the largest single state's count. */
  distinctStatesInTopTen: number;
  largestStateShareOfTopTen: number;
  /**
   * True when the cohort's high end is spread across many states. If it is
   * concentrated in two or three, "that industry is simply big there" is the
   * likely explanation and the committee is incidental.
   */
  geographicallySpread: boolean;
  /** True when both cohorts place a comparable share of their money. */
  attributionComparable: boolean;
}

export type PatternVerdict = 'worth-a-look' | 'weak' | 'not-supported';

export interface Pattern {
  id: string;
  committeeCode: string;
  committeeName: string;
  chamber: string;
  sector: IndustryId | string;
  sectorLabel: string;
  cohort: CohortStats;
  baseline: CohortStats;
  /** cohort mean ÷ baseline mean. Infinity is never emitted; see computePattern. */
  ratio: number;
  /** One-sided permutation p-value: how often shuffled labels beat the observed gap. */
  pValue: number;
  /** Benjamini–Hochberg adjusted p-value across every pair tested. Set by adjustPatterns. */
  qValue: number;
  checks: RobustnessChecks;
  verdict: PatternVerdict;
  /** Which checks failed, in reader-facing language. Empty when the verdict is worth-a-look. */
  failedChecks: string[];
  /** A few cohort members at the high end, so a reader can go and check the filings. */
  examples: { bioguideId: string; name: string; state: string; share: number }[];
}

// ---------------------------------------------------------------------------
// arithmetic
// ---------------------------------------------------------------------------

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : (((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

/**
 * Deterministic RNG (mulberry32).
 *
 * The permutation test must give the same answer on every run, or the site's
 * numbers change under readers between builds for no reason and nobody can
 * reproduce a figure they are looking at. Math.random() would do that.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One-sided permutation test on the difference in means.
 *
 * Chosen over a t-test deliberately: these share distributions are heavily
 * right-skewed and mostly zero, so the normality a t-test assumes is plainly
 * false. A permutation test assumes only that, if committee membership were
 * irrelevant, the labels would be exchangeable — which is exactly the null we
 * want. It answers: shuffle who is on the committee ten thousand times, and how
 * often does chance alone produce a gap this big?
 *
 * One-sided because the question is directional. A cohort receiving *less* than
 * baseline is not evidence for the pattern being described.
 */
export function permutationPValue(
  cohort: number[],
  baseline: number[],
  iterations = 10_000,
  seed = 12345,
): number {
  const nC = cohort.length;
  if (nC === 0 || baseline.length === 0) return 1;
  const all = [...cohort, ...baseline];
  const observed = mean(cohort) - mean(baseline);
  if (observed <= 0) return 1;

  const rand = seededRandom(seed);
  let atLeastAsExtreme = 0;

  for (let i = 0; i < iterations; i++) {
    // Fisher–Yates over a copy, then split at nC.
    const shuffled = [...all];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      const tmp = shuffled[j] as number;
      shuffled[j] = shuffled[k] as number;
      shuffled[k] = tmp;
    }
    const diff = mean(shuffled.slice(0, nC)) - mean(shuffled.slice(nC));
    if (diff >= observed) atLeastAsExtreme++;
  }
  // +1 on both sides: with 10,000 iterations and zero hits the honest answer is
  // "below 1 in 10,001", not "exactly zero". A p-value of 0 is never true.
  return (atLeastAsExtreme + 1) / (iterations + 1);
}

/**
 * Benjamini–Hochberg false-discovery-rate adjustment.
 *
 * This is not optional bookkeeping — without it the whole page is misleading.
 * Every full committee is tested against every sector, which is well over a
 * thousand comparisons. At p < 0.05, chance alone yields roughly fifty
 * "findings". Publishing those as patterns would be the single most dishonest
 * thing this project could do, precisely because each one would survive a
 * reader's individual scrutiny.
 *
 * BH rather than Bonferroni: Bonferroni controls the chance of any false
 * positive at all and would leave almost nothing, which overcorrects for a
 * screening tool whose output is explicitly "worth a look". BH controls the
 * expected *proportion* of published patterns that are spurious, which is the
 * quantity a reader actually cares about.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  if (m === 0) return [];
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const q = new Array<number>(m).fill(1);
  let running = 1;
  // Walk from the largest p down, keeping the running minimum so q is monotone.
  for (let rank = m; rank >= 1; rank--) {
    const entry = order[rank - 1];
    if (!entry) continue;
    running = Math.min(running, (entry.p * m) / rank);
    q[entry.i] = Math.min(1, running);
  }
  return q;
}

// ---------------------------------------------------------------------------
// thresholds — every one of these is a judgement, so each says why
// ---------------------------------------------------------------------------

export const PATTERN_THRESHOLDS = {
  /** Below this, a member's share is mostly noise from a handful of cheques. */
  minMemberTotal: 100_000,
  /** A cohort smaller than this cannot support a permutation test worth reading. */
  minCohortSize: 12,
  minBaselineSize: 30,
  /** Below this the gap is real but too small for a reader to do anything with. */
  minRatio: 1.5,
  /**
   * The cohort must actually receive a material share, not just a large multiple
   * of almost nothing.
   *
   * Added after the first run put "Transportation & Infrastructure × water and
   * waste" at the top of the shortlist on 0.4% against 0.1% — a 5.3x ratio built
   * entirely out of rounding. Worse, the baseline median was 0.0%, so "above the
   * typical non-member" degenerated into "received a single dollar", and the
   * check that is supposed to prove a pattern covers the group proved nothing.
   *
   * Ratio alone is scale-free, which is exactly the property that makes it
   * dangerous on a sector nobody gives to. A reader cannot act on three tenths of
   * a percent whatever the multiple is, so it does not belong above findings
   * where a tenth of the money is involved.
   */
  minCohortMeanShare: 0.01,
  /** The cohort must place at least this share of its money, or the sector share is guesswork. */
  minAttributionRate: 0.1,
  /** False-discovery rate. 5% of published patterns are expected to be chance. */
  maxQValue: 0.05,
  /** A pattern that vanishes when five members are removed was those five members. */
  minTrimmedRatio: 1.3,
  /** Fewer than half the cohort above the baseline median is not a group pattern. */
  minAboveBaselineShare: 0.5,
  /** Ten highest spread over fewer states than this looks like state concentration. */
  minDistinctStatesInTopTen: 5,
  /** Attribution rates differing by more than this could produce the gap on their own. */
  maxAttributionGap: 0.15,
} as const;

function statsFor(obs: MemberObservation[]): CohortStats {
  return {
    n: obs.length,
    meanShare: mean(obs.map((o) => o.share)),
    medianShare: median(obs.map((o) => o.share)),
    medianAttributionRate: median(obs.map((o) => o.attributionRate)),
  };
}

function partyKey(party: string): string {
  if (/^dem/i.test(party)) return 'Democrat';
  if (/^rep/i.test(party)) return 'Republican';
  return 'Other';
}

/**
 * Compare one cohort against one baseline. Returns null only when the groups are
 * too small to say anything at all — which is a different outcome from "we
 * looked and found nothing", and the caller must not conflate them.
 */
export function computePattern(input: {
  committeeCode: string;
  committeeName: string;
  chamber: string;
  sector: string;
  sectorLabel: string;
  cohort: MemberObservation[];
  baseline: MemberObservation[];
  iterations?: number;
}): Pattern | null {
  const cohort = input.cohort.filter((o) => o.total >= PATTERN_THRESHOLDS.minMemberTotal);
  const baseline = input.baseline.filter((o) => o.total >= PATTERN_THRESHOLDS.minMemberTotal);
  if (cohort.length < PATTERN_THRESHOLDS.minCohortSize) return null;
  if (baseline.length < PATTERN_THRESHOLDS.minBaselineSize) return null;

  const cStats = statsFor(cohort);
  const bStats = statsFor(baseline);

  // A zero baseline mean would make the ratio infinite, which is not a number a
  // reader can act on and not a claim we can defend. Floor the denominator at
  // one hundredth of a percent and let the ratio be large but finite.
  const denom = Math.max(bStats.meanShare, 0.0001);
  const ratio = cStats.meanShare / denom;

  const sorted = [...cohort].sort((a, b) => b.share - a.share);
  const trimmed = sorted.slice(5);
  const trimmedRatio = trimmed.length > 0 ? mean(trimmed.map((o) => o.share)) / denom : 0;

  const aboveBaselineMedian = cohort.filter((o) => o.share > bStats.medianShare).length;
  const aboveBaselineMedianShare = aboveBaselineMedian / cohort.length;

  const partyBreakdown: PartyBreakdown[] = [];
  for (const p of ['Democrat', 'Republican']) {
    const c = cohort.filter((o) => partyKey(o.party) === p);
    const b = baseline.filter((o) => partyKey(o.party) === p);
    if (c.length < 5 || b.length < 10) continue;
    const cm = mean(c.map((o) => o.share));
    const bm = mean(b.map((o) => o.share));
    partyBreakdown.push({
      party: p,
      cohortMean: cm,
      baselineMean: bm,
      ratio: cm / Math.max(bm, 0.0001),
      n: c.length,
    });
  }
  const holdsInBothParties =
    partyBreakdown.length === 2 && partyBreakdown.every((p) => p.ratio >= PATTERN_THRESHOLDS.minRatio);

  const topTen = sorted.slice(0, 10);
  const stateCounts = new Map<string, number>();
  for (const o of topTen) stateCounts.set(o.state, (stateCounts.get(o.state) ?? 0) + 1);
  const distinctStatesInTopTen = stateCounts.size;
  const largestStateShareOfTopTen = topTen.length > 0
    ? Math.max(...stateCounts.values()) / topTen.length
    : 0;
  const geographicallySpread = distinctStatesInTopTen >= PATTERN_THRESHOLDS.minDistinctStatesInTopTen;

  const attributionComparable =
    Math.abs(cStats.medianAttributionRate - bStats.medianAttributionRate) <=
    PATTERN_THRESHOLDS.maxAttributionGap;

  const pValue = permutationPValue(
    cohort.map((o) => o.share),
    baseline.map((o) => o.share),
    input.iterations ?? 10_000,
  );

  const checks: RobustnessChecks = {
    trimmedRatio,
    aboveBaselineMedian,
    aboveBaselineMedianShare,
    partyBreakdown,
    holdsInBothParties,
    distinctStatesInTopTen,
    largestStateShareOfTopTen,
    geographicallySpread,
    attributionComparable,
  };

  // Verdict is assigned by adjustPatterns, once every test is known and the
  // q-value exists. A pattern cannot be judged in isolation when a thousand
  // others were tested alongside it.
  return {
    id: `${input.committeeCode}-${input.sector}`,
    committeeCode: input.committeeCode,
    committeeName: input.committeeName,
    chamber: input.chamber,
    sector: input.sector,
    sectorLabel: input.sectorLabel,
    cohort: cStats,
    baseline: bStats,
    ratio,
    pValue,
    qValue: 1,
    checks,
    verdict: 'not-supported',
    failedChecks: [],
    examples: topTen.slice(0, 5).map((o) => ({
      bioguideId: o.bioguideId,
      name: o.name,
      state: o.state,
      share: o.share,
    })),
  };
}

/**
 * Apply the multiple-comparison correction across every pair tested, then
 * assign each pattern its verdict and the plain-language reasons it failed.
 *
 * MUST be called with the complete set of tests, including the ones that look
 * like nothing. Correcting over only the promising subset is the same error as
 * not correcting at all.
 */
export function adjustPatterns(patterns: Pattern[]): Pattern[] {
  const q = benjaminiHochberg(patterns.map((p) => p.pValue));
  const T = PATTERN_THRESHOLDS;

  return patterns.map((p, i) => {
    const qValue = q[i] ?? 1;
    const failed: string[] = [];

    if (qValue > T.maxQValue) {
      failed.push(
        `A gap this size turns up by chance often enough, once you account for every committee and sector tested, that it should not be treated as a finding.`,
      );
    }
    if (p.ratio < T.minRatio) {
      failed.push('The gap between the two groups is too small to act on.');
    }
    if (p.cohort.meanShare < T.minCohortMeanShare) {
      failed.push(
        `This sector is a rounding error even for the committee — ${(p.cohort.meanShare * 100).toFixed(1)}% of their traceable money. The multiple looks large only because the other group's share is close to zero.`,
      );
    }
    if (p.checks.trimmedRatio < T.minTrimmedRatio) {
      failed.push(
        'Remove the five highest members of the committee and the gap mostly disappears — so this is about those five, not the committee.',
      );
    }
    if (p.checks.aboveBaselineMedianShare < T.minAboveBaselineShare) {
      failed.push(
        'Fewer than half the committee is above the typical non-member, so this is not a pattern across the group.',
      );
    }
    if (!p.checks.holdsInBothParties) {
      failed.push(
        'The gap does not hold in both parties, so party is a likely explanation rather than the committee.',
      );
    }
    if (!p.checks.geographicallySpread) {
      failed.push(
        'The committee members receiving most of this money are clustered in a few states, so the industry simply being large there is the likely explanation.',
      );
    }
    if (!p.checks.attributionComparable) {
      failed.push(
        'The two groups differ in how much of their money can be traced to any sector at all, which could produce this gap on its own.',
      );
    }
    if (p.cohort.medianAttributionRate < T.minAttributionRate) {
      failed.push('Too little of this committee\'s money can be placed in any sector for the share to mean much.');
    }

    const verdict: PatternVerdict =
      failed.length === 0 ? 'worth-a-look' : failed.length <= 2 ? 'weak' : 'not-supported';

    return { ...p, qValue, verdict, failedChecks: failed };
  });
}

// ---------------------------------------------------------------------------
// reader-facing language
// ---------------------------------------------------------------------------

export const PATTERN_VERDICT_LABEL: Record<PatternVerdict, string> = {
  'worth-a-look': 'Worth a look',
  weak: 'Mixed — some checks failed',
  'not-supported': 'Does not hold up',
};

export const PATTERN_VERDICT_PLAIN: Record<PatternVerdict, string> = {
  'worth-a-look': 'This one passed every check we can run. That makes it worth reading about — not proof of anything.',
  weak: 'This one passed some checks and failed others. Read the failures before you make anything of it.',
  'not-supported': 'This one falls apart when checked. It is here so you can see it was tested, not because it shows anything.',
};

/**
 * What a pattern actually says, in one sentence, in words that do not smuggle in
 * a cause.
 *
 * Note the verb. "Members of X receive a larger share from Y" is a fact about a
 * distribution. Anything of the form "Y targets X" or "X is funded by Y" would
 * assert an intention that no row in this dataset records.
 */
export function describePattern(p: Pattern): string {
  const c = (p.cohort.meanShare * 100).toFixed(1);
  const b = (p.baseline.meanShare * 100).toFixed(1);
  return (
    `Members of the ${p.committeeName} receive ${c}% of their traceable money from ${p.sectorLabel}, `
    + `against ${b}% for members of the same chamber who are not on it.`
  );
}

/** The single most useful sentence about a pattern: how much of the group it covers. */
export function describeCohortSpread(p: Pattern): string {
  const { aboveBaselineMedian } = p.checks;
  return (
    `${aboveBaselineMedian} of the committee's ${p.cohort.n} members are above the typical member who is not on it. `
    + (p.checks.aboveBaselineMedianShare >= 0.75
      ? 'That is most of the committee, so this is a pattern across the group rather than a few individuals.'
      : 'That is a majority but not an overwhelming one, so treat it as a tendency rather than a rule.')
  );
}

/**
 * What a pattern cannot tell you. Deliberately concrete rather than a general
 * disclaimer, because the general one has stopped being read.
 *
 * The first item is the one that matters and it is genuinely unresolvable with
 * this data: nothing here records whether members joined the committee because
 * the industry already mattered to them, or the money arrived because they
 * joined. Both produce this exact table.
 */
export const PATTERN_LIMITS: string[] = [
  'It cannot tell you which came first. Members may seek a committee because an industry matters where they live or what they know, or the money may follow the seat. This data fits both equally well and cannot separate them.',
  'It says nothing about how anyone voted. There is no vote in this comparison at all.',
  'It is one two-year cycle — a snapshot, not a trend.',
  'The shares are of money that could be traced to a sector. Roughly two thirds of all money in this dataset could not be, most of it because no employer was written on the filing.',
  'Committee membership here is the full committee. Subcommittee assignments, which is where much of the detailed work happens, are not part of this comparison.',
];
