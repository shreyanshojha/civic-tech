import { overlapBand } from './disclaimer.js';
import { INDUSTRY_BY_ID } from './industries.js';
import type { IndustryId } from './types.js';

/**
 * "What does this number mean?" — answered without ever interpreting it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE IS DANGEROUS, AND HOW IT IS MADE SAFE
 *
 * A bare percentage is useless to most readers: 28% of what, compared to whom,
 * and so what? Leaving it bare does not make the tool neutral — it makes it
 * a Rorschach test, and readers fill the gap with the worst available story.
 *
 * But "what it means" is also the exact place a correlation tool turns into an
 * accusation engine. One sentence of narration — "this raises questions about
 * whose interests they serve" — and the project has become the thing it exists
 * not to be.
 *
 * So this module obeys four rules, and every one is enforced by tests:
 *
 *  1. NO NARRATION. Nothing here writes an interpretation. Every sentence is
 *     either a restatement of the arithmetic, a comparison to a computed
 *     distribution, or a fact pulled from the record (committee seat, sponsor
 *     role, state). If a claim cannot be traced to a field, it is not made.
 *
 *  2. THE ORDINARY EXPLANATION COMES FIRST. Where a mundane reason for a high
 *     score exists in the data — they sit on the committee, it is their state's
 *     dominant industry — it is surfaced ABOVE everything else. The boring
 *     explanation is usually the true one and it is the one a reader is least
 *     likely to think of on their own.
 *
 *  3. COMPARISON IS CONTEXT, NOT RANKING. A percentile tells a reader whether a
 *     number is unusual, which is the single most useful thing you can say
 *     about it. It must never be presented as a leaderboard position, and the
 *     phrasing below deliberately avoids "worst", "highest" and any ordinal.
 *
 *  4. THE HONEST ANSWER IS OFTEN "NOTHING". `verdict` is never a judgement; the
 *     strongest thing this module will ever say is "this is unusual enough to
 *     be worth reading the bill".
 * ---------------------------------------------------------------------------
 */

export interface OrdinaryExplanation {
  /** Machine-checkable reason code, so the UI never invents its own. */
  kind: 'committee-seat' | 'sponsor' | 'cosponsor' | 'state-industry' | 'policy-area' | 'small-total';
  /** One plain sentence, built from real fields. */
  text: string;
}

export interface OverlapDistribution {
  /** 0-100. Where this score sits among all scored member/bill pairs. */
  percentile: number;
  median: number;
  /** How many pairs the distribution was computed over. */
  n: number;
}

export interface MeaningInput {
  score: number;
  memberName: string;
  billLabel: string;
  topIndustry: IndustryId | null;
  topIndustryAmount: number;
  totalDisclosed: number;
  unattributedShare: number;
  distribution: OverlapDistribution | null;
  ordinary: OrdinaryExplanation[];
  hasVote: boolean;
  classificationMethod: 'llm' | 'keyword-fallback' | null;
}

export interface Meaning {
  /** Slot 1 — the arithmetic, restated so it can be pictured. */
  inPlainTerms: string;
  /** Slot 2 — is this number unusual? Null when there is no distribution. */
  comparedToOthers: string | null;
  /** Slot 3 — the mundane reasons, from the record. Empty is possible. */
  ordinaryReasons: string[];
  /** Slot 4 — what a reader would need to turn this into a finding. */
  whatWouldMakeItInteresting: string[];
  /** The one thing this module is willing to conclude. Never a judgement. */
  bottomLine: string;
}

/** "about $3 of every $10" — a ratio people can picture without doing maths. */
export function plainRatio(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return 'none of every $10';
  const perTen = share * 10;
  if (perTen < 0.5) return 'less than 50 cents of every $10';
  if (perTen < 1) return 'under $1 of every $10';
  return `about $${Math.round(perTen)} of every $10`;
}

/**
 * Assembles the four slots. Pure: same inputs, same sentences, every time.
 * The caller supplies facts; this function never looks anything up and never
 * decides anything.
 */
export function explainOverlap(input: MeaningInput): Meaning {
  const {
    score, memberName, billLabel, topIndustry, topIndustryAmount, totalDisclosed,
    unattributedShare, distribution, ordinary, hasVote, classificationMethod,
  } = input;

  const band = overlapBand(score);
  const industryLabel = topIndustry ? (INDUSTRY_BY_ID[topIndustry]?.label ?? topIndustry) : null;

  // --- Slot 1: restate the arithmetic ---------------------------------------
  const inPlainTerms =
    `${memberName} reported $${Math.round(totalDisclosed).toLocaleString()} in donations. ` +
    `Of that, ${plainRatio(score)} came from industries this classifier links to ${billLabel}` +
    (industryLabel ? `, mostly ${industryLabel} ($${Math.round(topIndustryAmount).toLocaleString()}).` : '.');

  // --- Slot 2: is it unusual? ----------------------------------------------
  let comparedToOthers: string | null = null;
  if (distribution && distribution.n >= 30) {
    const p = distribution.percentile;
    const medianPct = Math.round(distribution.median * 100);
    const above = 100 - p;
    // "About 0 in 100 are higher" is what rounding produces at the very top of
    // the distribution, and it reads as a bug. Say it in words instead.
    const higherPhrase = above < 1
      ? 'Fewer than 1 in 100 pairs score higher'
      : `About ${Math.round(above)} in 100 pairs score higher`;

    // The median in this dataset is very low, because most member-bill pairs
    // barely overlap at all. Saying so is essential: without it, a reader sees
    // "higher than 99% of pairs" and hears "extreme", when the comparison set
    // is mostly near-zero. The percentile and the absolute share are different
    // questions and the sentence has to hold both.
    const shape = medianPct <= 5
      ? `Most member-bill pairs barely overlap at all — the typical one is around ${medianPct}% — so being above the middle is easier than it sounds.`
      : `The typical pair sits around ${medianPct}%.`;

    if (p >= 90) {
      comparedToOthers = `${higherPhrase}. ${shape}`;
    } else if (p >= 60) {
      comparedToOthers = `This sits above the middle of the pack. ${higherPhrase}. ${shape}`;
    } else if (p >= 40) {
      comparedToOthers = `This sits around the middle of the pack. ${shape}`;
    } else {
      comparedToOthers = `This sits below the middle of the pack — most pairs score higher. ${shape}`;
    }
  }

  // --- Slot 3: the boring explanations, first ------------------------------
  const ordinaryReasons = ordinary.map((o) => o.text);
  if (unattributedShare >= 0.4) {
    ordinaryReasons.push(
      `About ${Math.round(unattributedShare * 100)}% of this member's money could not be matched to any industry, so this percentage is a floor, not a measurement.`,
    );
  }
  if (classificationMethod === 'keyword-fallback') {
    ordinaryReasons.push(
      'No language model read this bill. The industry tags came from library metadata and word matching, so they are rough.',
    );
  }

  // --- Slot 4: what a finding would actually require ------------------------
  const whatWouldMakeItInteresting = [
    hasVote
      ? 'Check how they actually voted — this number does not use their vote at all.'
      : 'Find out how they voted. This bill has no recorded vote in this dataset, and most bills never get one.',
    'Check whether members with no money from this industry voted differently. If they voted the same way, the money explains nothing.',
    'Check the dates. Money that arrived after a position was taken cannot have caused it.',
    'Read what the member said about the bill in their own words.',
  ];

  // --- The bottom line ------------------------------------------------------
  let bottomLine: string;
  if (ordinary.length > 0) {
    bottomLine =
      'There is a plain explanation for this on the record above, and it is probably the right one. ' +
      'Money and subject matter lining up is what representing a place normally looks like.';
  } else if (band === 'high' || band === 'substantial') {
    bottomLine =
      'Nothing here shows the money changed anything, and this tool cannot tell you that. ' +
      'It is a reason to read the bill and the vote, and nothing more.';
  } else {
    bottomLine =
      'There is not much overlap here. That is not a clean bill of health either — this tool only sees money that was reported.';
  }

  return { inPlainTerms, comparedToOthers, ordinaryReasons, whatWouldMakeItInteresting, bottomLine };
}

/** Builds the ordinary-explanation list from record fields. Facts only. */
export function findOrdinaryExplanations(facts: {
  role: string | null;
  onCommitteeOfJurisdiction: boolean;
  committeeName?: string | null;
  topIndustry: IndustryId | null;
  state?: string | null;
  /** How many of this member's home-state colleagues share the same top sector. */
  stateColleaguesWithSameTopSector?: number;
  stateColleagueCount?: number;
  totalDisclosed: number;
}): OrdinaryExplanation[] {
  const out: OrdinaryExplanation[] = [];
  const label = facts.topIndustry ? (INDUSTRY_BY_ID[facts.topIndustry]?.label ?? facts.topIndustry) : null;

  if (facts.onCommitteeOfJurisdiction) {
    out.push({
      kind: 'committee-seat',
      text: facts.committeeName
        ? `They sit on the ${facts.committeeName}, which handles this bill. Members join the committee for the industries in their district, so money and subject matter line up by design.`
        : 'They sit on a committee that handles this bill, so money and subject matter line up by design.',
    });
  }
  if (facts.role === 'Sponsor') {
    out.push({ kind: 'sponsor', text: 'They wrote this bill. Sponsoring a bill about your own district\'s industry is the ordinary case, not the odd one.' });
  }
  if (
    label && facts.state &&
    (facts.stateColleaguesWithSameTopSector ?? 0) >= 2 &&
    (facts.stateColleagueCount ?? 0) >= 3
  ) {
    out.push({
      kind: 'state-industry',
      text: `${label} is also the top donor sector for ${facts.stateColleaguesWithSameTopSector} other members from ${facts.state}. That points to the industry being big in the state, not to anything about this member.`,
    });
  }
  // A share computed on a small denominator is arithmetic, not a signal.
  if (facts.totalDisclosed > 0 && facts.totalDisclosed < 50_000) {
    out.push({
      kind: 'small-total',
      text: `This member reported only $${Math.round(facts.totalDisclosed).toLocaleString()} in total. With a small total, one ordinary donation produces a large percentage.`,
    });
  }
  return out;
}
