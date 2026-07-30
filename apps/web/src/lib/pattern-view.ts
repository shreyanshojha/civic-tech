/**
 * The robustness checks, as a reader meets them.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AND WHAT IT MAY NOT DO
 *
 * packages/core/src/patterns.ts computes every check and, when one fails, writes
 * the reason into `failedChecks` in reader-facing words. What it does not carry
 * is the pairing: which sentence belongs to which check, and what that check
 * RULES OUT. Without that pairing a page can only print a list of failures, and
 * a reader cannot tell whether the thing that failed was the outlier test or the
 * party test — which is the whole difference between "this is five people" and
 * "this is one party".
 *
 * So this file holds two things per check: the short name of what it rules out,
 * and enough of the failure sentence to find it again in `failedChecks`. It does
 * NOT hold the sentence. Every word a reader sees about a failure comes from
 * @ftm/core, because there is a test and a repo audit asserting the framing
 * language lives in one file, and eight near-miss paraphrases of it in a view
 * would be exactly the drift they exist to prevent.
 *
 * Pass and fail are derived from PATTERN_THRESHOLDS rather than from whether a
 * matching sentence was found, so a wording change in core can never silently
 * turn a failed check into a passed one. `unmatchedFailures` then catches the
 * other direction: any failure sentence this file could not place is still shown,
 * so nothing is hidden by a stale matcher.
 * ---------------------------------------------------------------------------
 */

import { PATTERN_THRESHOLDS } from '@ftm/core';
import type { Pattern } from '@ftm/core';

export interface PatternCheck {
  id: string;
  /** What the check is, in three or four words. */
  name: string;
  /** The alternative explanation this check removes. Never a claim about a person. */
  rulesOut: string;
  /** The number itself, so a reader can judge it rather than trust the verdict. */
  value: (p: Pattern) => string;
  passed: (p: Pattern) => boolean;
  /** A fragment of the matching sentence in core's `failedChecks`. */
  match: string;
}

const T = PATTERN_THRESHOLDS;
const pctOf = (x: number) => `${(x * 100).toFixed(1)}%`;

export const PATTERN_CHECKS: PatternCheck[] = [
  {
    id: 'q-value',
    name: 'Chance, across every pair tested',
    rulesOut: 'A gap this size turning up somewhere in a thousand comparisons on its own.',
    value: (p) => `q = ${p.qValue < 0.001 ? p.qValue.toExponential(1) : p.qValue.toFixed(3)}`,
    passed: (p) => p.qValue <= T.maxQValue,
    match: 'by chance often enough',
  },
  {
    id: 'ratio',
    name: 'Size of the gap',
    rulesOut: 'A difference that is real but too small to be worth anyone\'s time.',
    value: (p) => `${p.ratio.toFixed(2)}× the other group`,
    passed: (p) => p.ratio >= T.minRatio,
    match: 'too small to act on',
  },
  {
    id: 'trimmed',
    name: 'With the five highest removed',
    rulesOut: 'Five members carrying the whole gap while the rest look like everyone else.',
    value: (p) => `${p.checks.trimmedRatio.toFixed(2)}× the other group`,
    passed: (p) => p.checks.trimmedRatio >= T.minTrimmedRatio,
    match: 'Remove the five highest',
  },
  {
    id: 'above-median',
    name: 'Above the typical non-member',
    rulesOut: 'A few individuals standing in for a group.',
    value: (p) =>
      `${p.checks.aboveBaselineMedian} of ${p.cohort.n} members (${pctOf(p.checks.aboveBaselineMedianShare)})`,
    passed: (p) => p.checks.aboveBaselineMedianShare >= T.minAboveBaselineShare,
    match: 'Fewer than half the committee',
  },
  {
    id: 'party',
    name: 'Holds in both parties',
    rulesOut: 'Party being the real difference between the two groups.',
    value: (p) =>
      p.checks.partyBreakdown.length === 0
        ? 'Neither party had enough members to compare'
        : p.checks.partyBreakdown.map((b) => `${b.party}s ${b.ratio.toFixed(2)}×`).join(', '),
    passed: (p) => p.checks.holdsInBothParties,
    match: 'does not hold in both parties',
  },
  {
    id: 'geography',
    name: 'Spread across states',
    rulesOut: 'One or two states where the industry is simply large.',
    value: (p) =>
      `${p.checks.distinctStatesInTopTen} states among the ten highest; the largest is `
      + `${pctOf(p.checks.largestStateShareOfTopTen)} of them`,
    passed: (p) => p.checks.geographicallySpread,
    match: 'clustered in a few states',
  },
  {
    id: 'attribution-gap',
    name: 'Both groups equally traceable',
    rulesOut: 'One group having more blank employer fields on its filings than the other.',
    value: (p) =>
      `${pctOf(p.cohort.medianAttributionRate)} of the committee's money can be placed, `
      + `${pctOf(p.baseline.medianAttributionRate)} of the other group's`,
    passed: (p) => p.checks.attributionComparable,
    match: 'differ in how much of their money',
  },
  {
    id: 'attribution-floor',
    name: 'Enough traceable money to divide',
    rulesOut: 'A share worked out from so little placeable money that it is guesswork.',
    value: (p) => `${pctOf(p.cohort.medianAttributionRate)} of the committee's money can be placed`,
    passed: (p) => p.cohort.medianAttributionRate >= T.minAttributionRate,
    match: 'Too little of this committee',
  },
];

/** The failure sentence for a check, or null when the check passed. */
export function failureFor(p: Pattern, check: PatternCheck): string | null {
  if (check.passed(p)) return null;
  return p.failedChecks.find((s) => s.includes(check.match)) ?? null;
}

/**
 * Failure sentences no check claimed.
 *
 * Normally empty. If it is not, a matcher above has gone stale — and the page
 * shows the sentence anyway rather than dropping a stated failure on the floor.
 */
export function unmatchedFailures(p: Pattern): string[] {
  return p.failedChecks.filter((s) => !PATTERN_CHECKS.some((c) => s.includes(c.match)));
}
