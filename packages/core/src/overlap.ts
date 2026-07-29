import type { BillClassification, DonorProfile, IndustryId, OverlapResult } from './types.js';

/**
 * The overlap score.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT MEASURES
 *
 *   "Weighting each industry by how central it is to this bill, what share of
 *    this member's disclosed itemized contributions came from those industries?"
 *
 * Formally, with
 *   D_i  = share of the member's total itemized contributions from industry i
 *          (over the selected cycle; shares sum to <= 1, the remainder is
 *          unclassified money we could not assign)
 *   C_i  = the classifier's confidence that the bill affects industry i
 *   W_i  = C_i / sum(C)          (bill weights, sum to 1)
 *
 *   score = sum_i ( D_i * W_i )
 *
 * The score therefore lives in [0, 1] and reads as a percentage of disclosed
 * money. It is a weighted share, not a p-value, not a probability, not a
 * measure of influence.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT MEASURE
 *
 * - It does not use the member's vote. A member who voted against every
 *   interest that funded them gets the same score.
 * - It does not know whether the bill helps or hurts the industry.
 * - It ignores money we could not classify, and reports that gap explicitly in
 *   `method.unclassifiedDonorShare` so the reader can discount accordingly.
 * - It is symmetric to ordinary, legitimate representation: a member from a
 *   farming district on an agriculture bill will score high, and should.
 *
 * Any UI that renders this number MUST render the explainer alongside it.
 * See disclaimer.ts / SCORE_EXPLAINER.
 * ---------------------------------------------------------------------------
 */

export const OVERLAP_FORMULA =
  'score = Σ_industries ( donorShare(industry) × billWeight(industry) ), where billWeight = classifierConfidence / Σ classifierConfidence. Range 0–1, read as a weighted share of disclosed itemized money.';

export function computeOverlap(
  bill: BillClassification,
  donors: DonorProfile,
  opts: { minBillConfidence?: number } = {},
): OverlapResult {
  const minConf = opts.minBillConfidence ?? 0.25;

  const billIndustries = bill.industries.filter((b) => b.confidence >= minConf);
  const confSum = billIndustries.reduce((s, b) => s + b.confidence, 0);

  const donorShare = new Map<IndustryId, { share: number; amount: number }>();
  for (const row of donors.byIndustry) {
    if (row.industry === 'other') continue; // unclassified money never counts toward a match
    donorShare.set(row.industry, { share: row.share, amount: row.amount });
  }

  const matches: OverlapResult['matches'] = [];
  let score = 0;

  if (confSum > 0) {
    for (const b of billIndustries) {
      const d = donorShare.get(b.industry);
      if (!d) continue;
      const weight = b.confidence / confSum;
      const contribution = d.share * weight;
      score += contribution;
      matches.push({
        industry: b.industry,
        donorAmount: d.amount,
        donorShare: d.share,
        billConfidence: b.confidence,
        contribution,
      });
    }
  }

  matches.sort((a, b) => b.contribution - a.contribution);

  return {
    billId: bill.billId,
    bioguideId: donors.bioguideId,
    cycle: donors.cycle,
    score: clamp01(score),
    matches,
    method: {
      formula: OVERLAP_FORMULA,
      donorProfileCycle: donors.cycle,
      billClassificationMethod: bill.method,
      unclassifiedDonorShare: donors.unclassifiedShare,
    },
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Builds a one-sentence, non-causal, plain-English reading of a score.
 * Used in the UI, on share cards, and in exports so the phrasing never drifts.
 */
export function describeOverlap(result: OverlapResult, memberName: string, billLabel: string): string {
  const pct = Math.round(result.score * 100);
  if (result.matches.length === 0) {
    return `None of ${memberName}'s top disclosed donor industries are among the industries this classifier associates with ${billLabel}.`;
  }
  const top = result.matches[0]!;
  return `Weighting industries by how central they are to ${billLabel}, about ${pct}% of ${memberName}'s disclosed itemized contributions came from those industries — the largest single overlap being ${top.industry}. This is a co-occurrence in public records, not a finding about why anyone voted the way they did.`;
}
