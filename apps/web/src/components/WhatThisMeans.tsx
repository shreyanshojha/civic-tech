/**
 * "What does this number mean?"
 *
 * ---------------------------------------------------------------------------
 * This is the most dangerous component in the application, and it exists
 * because leaving it out is more dangerous still.
 *
 * A bare "28%" is not neutral. A reader who cannot tell whether 28% is high,
 * low, normal or alarming will supply an answer from somewhere, and the answer
 * people reach for about politicians and money is rarely the charitable one.
 * Refusing to explain does not protect anyone; it just outsources the
 * interpretation to whatever the reader already believed.
 *
 * So this block explains — under four rules, all enforced in @ftm/core/meaning
 * and its tests:
 *
 *   1. Every sentence is a restatement of arithmetic, a comparison against a
 *      computed distribution, or a fact from the record. Nothing is narrated.
 *   2. The ordinary explanation is shown FIRST and given the most visual
 *      weight, because it is usually the true one and the one a reader is
 *      least likely to think of unprompted.
 *   3. The comparison is context, never a ranking. No "highest", no ordinal,
 *      no leaderboard.
 *   4. The strongest conclusion available is "this is worth reading the bill".
 *      There is no path through this component that produces an accusation.
 *
 * If you are adding a fifth slot: it must be derivable from a field. If you
 * find yourself writing a sentence that begins "this suggests", stop.
 * ---------------------------------------------------------------------------
 */

import { explainOverlap } from '@ftm/core';
import type { IndustryId, OverlapResult } from '@ftm/core';

export interface MeaningFacts {
  percentile: number;
  median: number;
  n: number;
  ordinary: { kind: string; text: string }[];
  unattributedShare: number;
}

export function WhatThisMeans({
  overlap,
  facts,
  memberName,
  billLabel,
  totalDisclosed,
  hasVote,
  classificationMethod,
  defaultOpen = false,
}: {
  overlap: OverlapResult;
  facts: MeaningFacts | null | undefined;
  memberName: string;
  billLabel: string;
  totalDisclosed: number;
  hasVote: boolean;
  classificationMethod: 'llm' | 'keyword-fallback' | null;
  defaultOpen?: boolean;
}) {
  if (!facts) return null;

  const meaning = explainOverlap({
    score: overlap.score,
    memberName,
    billLabel,
    topIndustry: (overlap.matches[0]?.industry as IndustryId | undefined) ?? null,
    topIndustryAmount: overlap.matches[0]?.donorAmount ?? 0,
    totalDisclosed,
    unattributedShare: facts.unattributedShare,
    distribution: { percentile: facts.percentile, median: facts.median, n: facts.n },
    ordinary: facts.ordinary as never,
    hasVote,
    classificationMethod,
  });

  return (
    <details className="mt-3 rounded border border-line bg-paper" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-ink-1 marker:content-['']">
        <span className="inline-flex items-center gap-1.5">
          <svg
            aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="1.8" className="text-accent transition-transform"
          >
            <path d="M4 2.5 8 6l-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          So what does this actually mean?
        </span>
      </summary>

      <div className="space-y-3 border-t border-line px-3 py-3">
        {/* 1 — the arithmetic, restated */}
        <div>
          <h4 className="label mb-1">In plain terms</h4>
          <p className="text-sm leading-relaxed text-ink-1">{meaning.inPlainTerms}</p>
        </div>

        {/* 2 — is it unusual? */}
        {meaning.comparedToOthers && (
          <div>
            <h4 className="label mb-1">Is that a lot?</h4>
            <p className="text-sm leading-relaxed text-ink-1">{meaning.comparedToOthers}</p>
          </div>
        )}

        {/* 3 — the boring explanation, given the most weight on purpose */}
        {meaning.ordinaryReasons.length > 0 && (
          <div className="rounded border-l-2 border-l-accent bg-accent-soft px-3 py-2">
            <h4 className="label mb-1">The most likely explanation</h4>
            <ul className="space-y-1.5">
              {meaning.ordinaryReasons.map((r, i) => (
                <li key={i} className="text-sm leading-relaxed text-ink-1">{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 4 — what a finding would actually take */}
        <div>
          <h4 className="label mb-1">What would make this worth a story</h4>
          <ul className="space-y-1">
            {meaning.whatWouldMakeItInteresting.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-2">
                <span aria-hidden className="text-ink-4">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-line pt-2.5 text-sm font-medium leading-relaxed text-ink-1">
          {meaning.bottomLine}
        </p>
      </div>
    </details>
  );
}
