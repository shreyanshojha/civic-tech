/**
 * One comparison, with every reason it might be worthless shown next to it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PAGE IS FOR
 *
 * The list page hands a reader a shortlist. This page is where they find out
 * whether to believe one entry on it. That means the checks are not an appendix
 * here — they are the content. A reader should not have to trust that somebody
 * thought about outliers, or party, or geography. Each of those is a number on
 * this page, with the alternative explanation it rules out written next to it,
 * and a failed check is shown as plainly as a passed one.
 *
 * The distribution plot is the most useful thing on the page. Two averages can
 * hide a complete overlap between the groups; four hundred dots cannot.
 *
 * ---------------------------------------------------------------------------
 * THREE THINGS NOT TO DO WHILE EDITING
 *
 * 1. Do not write a sentence describing the finding. `describePattern` and
 *    `describeCohortSpread` in @ftm/core are the only two, and their wording is
 *    load-bearing: "members of X receive a larger share from Y" is a fact about a
 *    distribution, while anything of the form "Y targets X" asserts an intention
 *    that no row in this dataset records.
 *
 * 2. Do not colour a failed check. Amber on this site means "the data has a gap"
 *    and nothing else, and a red/green pass-fail scale would turn a statistical
 *    check into a verdict on a group of people. Pass and fail are words.
 *
 * 3. Do not rank the example members. They are five names a reader can go and
 *    check filings for. That is the whole purpose, and NO_ACCUSATION sits with
 *    them because a list of five names under a statistic reads as an accusation
 *    unless something says otherwise.
 * ---------------------------------------------------------------------------
 */

import { Link, useParams } from 'react-router-dom';
import {
  NO_ACCUSATION,
  PATTERN_LIMITS,
  PATTERN_VERDICT_PLAIN,
  describeCohortSpread,
  describePattern,
} from '@ftm/core';
import { getPatterns } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { PATTERN_CHECKS, failureFor, unmatchedFailures } from '../lib/pattern-view';
import type { PatternCheck } from '../lib/pattern-view';
import type { PatternRow } from '../lib/data';
import { CohortPlot } from '../components/CohortPlot';
import { ErrorState, Loading, SectionTitle, Stat } from '../components/ui';
import { VerdictChip } from './Patterns';

/**
 * Pass and fail, in words and in one glyph.
 *
 * The glyph is aria-hidden and the word is always there, so the state never
 * depends on a shape or a colour being noticed.
 */
function CheckState({ passed }: { passed: boolean }) {
  return (
    <span className="chip shrink-0">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        {passed ? (
          <path d="M2 6.5 4.8 9.2 10 3.4" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M2.5 6h7" strokeLinecap="round" />
        )}
      </svg>
      {passed ? 'Passed' : 'Did not pass'}
    </span>
  );
}

function CheckRow({ p, check }: { p: PatternRow; check: PatternCheck }) {
  const passed = check.passed(p);
  const failure = failureFor(p, check);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <h3 className="text-base font-semibold leading-snug text-ink-0">{check.name}</h3>
        <CheckState passed={passed} />
      </div>
      <p className="mt-1 max-w-measure text-sm leading-snug text-ink-3">
        <span className="font-medium text-ink-2">Rules out: </span>
        {check.rulesOut}
      </p>
      <p className="tnum mt-1 text-base leading-snug text-ink-1">{check.value(p)}</p>
      {/* The reason, in core's words. Never paraphrased here. */}
      {failure && <p className="mt-1.5 max-w-measure text-sm leading-snug text-ink-1">{failure}</p>}

      {/* The party check carries a table, because "holds in both parties" is a
          claim a reader should be able to check number by number. Party is shown
          as a fact and is never used to colour, sort or rank anything. */}
      {check.id === 'party' && p.checks.partyBreakdown.length > 0 && (
        <table className="mt-2 w-full max-w-md text-sm">
          <caption className="sr-only">Share of traceable money from {p.sectorLabel}, by party</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="label pb-1 font-semibold">Party</th>
              <th scope="col" className="label pb-1 text-right font-semibold">On it</th>
              <th scope="col" className="label pb-1 text-right font-semibold">Not on it</th>
              <th scope="col" className="label pb-1 text-right font-semibold">Gap</th>
            </tr>
          </thead>
          <tbody className="rows">
            {p.checks.partyBreakdown.map((b) => (
              <tr key={b.party}>
                <td className="py-1.5 text-ink-2">
                  {b.party}s <span className="text-ink-4">({b.n})</span>
                </td>
                <td className="tnum py-1.5 text-right text-ink-2">{(b.cohortMean * 100).toFixed(1)}%</td>
                <td className="tnum py-1.5 text-right text-ink-2">{(b.baselineMean * 100).toFixed(1)}%</td>
                <td className="tnum py-1.5 text-right text-ink-1">{b.ratio.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}

export default function PatternDetail() {
  const { id } = useParams<{ id: string }>();
  const file = useAsync(getPatterns, []);

  if (file.error) return <ErrorState error={file.error} />;
  if (!file.data) {
    return (
      <div className="mx-auto max-w-content px-4">
        <Loading what="this comparison" />
      </div>
    );
  }

  const { meta, patterns } = file.data;
  const p = patterns.find((x) => x.id === id);

  /**
   * A pattern id that is not in the file.
   *
   * Not necessarily a bad link: the file lists every comparison that passed a
   * check and as many of the failures as fit inside its size budget, so a link
   * to one of the furthest-out failures can genuinely be absent. Saying which of
   * those two happened is more useful than "not found".
   */
  if (!p) {
    return (
      <div className="mx-auto max-w-content px-4 py-10">
        <h1 className="text-lg font-semibold text-ink-0">That comparison is not in this data bundle</h1>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">
          {meta.pairsTested.toLocaleString()} comparisons were tested and{' '}
          {meta.patternsListed.toLocaleString()} are listed in this file. The ones left out are
          failures that fell furthest from every threshold; they are counted in the totals but their
          rows are not here.
        </p>
        <p className="mt-3 text-sm">
          <Link className="link font-medium text-ink-1" to="/patterns">
            Back to all comparisons →
          </Link>
        </p>
      </div>
    );
  }

  const hasPlot = p.cohortShares.length > 0 && p.baselineShares.length > 0;
  const leftovers = unmatchedFailures(p);

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <p className="text-sm">
        <Link className="link text-ink-3" to="/patterns">← All committee comparisons</Link>
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        {/* One h1, and it names both halves of the comparison: the committee and
            the sector. It becomes the tab title and the screen-reader
            announcement, so "House Committee on Agriculture" alone would not say
            which of its 29 sector comparisons the reader is on. */}
        <h1 className="max-w-measure text-xl font-semibold leading-tight text-ink-0">
          {p.committeeName}: money from {p.sectorLabel}
        </h1>
        <VerdictChip verdict={p.verdict} />
      </div>
      <p className="mt-1 text-sm text-ink-3">
        {p.chamber} · full committee {p.committeeCode} · FEC cycle {meta.cycle}
      </p>

      {/* ---- the finding, in core's words --------------------------------- */}
      <section className="mt-5">
        <h2 className="sr-only">What the comparison says</h2>
        <p className="max-w-measure text-md leading-relaxed text-ink-1">{describePattern(p)}</p>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">{describeCohortSpread(p)}</p>
        <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-2">
          {PATTERN_VERDICT_PLAIN[p.verdict]}
        </p>
      </section>

      {/* ---- the plot ------------------------------------------------------ */}
      <section className="mt-7">
        <SectionTitle
          note={`${p.cohort.n} on the committee · ${p.baseline.n} not on it`}
        >
          Every member, one dot each
        </SectionTitle>
        {hasPlot ? (
          <CohortPlot
            sectorLabel={p.sectorLabel}
            cohort={{
              label: 'On the committee',
              shares: p.cohortShares,
              mean: p.cohort.meanShare,
              median: p.cohort.medianShare,
              n: p.cohort.n,
            }}
            baseline={{
              label: 'Not on the committee',
              shares: p.baselineShares,
              mean: p.baseline.meanShare,
              median: p.baseline.medianShare,
              n: p.baseline.n,
            }}
          />
        ) : (
          <p className="max-w-measure text-sm leading-relaxed text-ink-3">
            The per-member figures for this comparison are not in the data bundle. They are kept for
            the comparisons that passed at least one check, so that the file stays small enough to
            ship. Every other figure on this page is unchanged.
          </p>
        )}
      </section>

      {/* ---- the headline numbers ----------------------------------------- */}
      <section className="mt-8">
        <h2 className="sr-only">The numbers behind the comparison</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          <Stat
            label="On the committee"
            value={`${(p.cohort.meanShare * 100).toFixed(1)}%`}
            sub={`Average of ${p.cohort.n} members. Typical member ${(p.cohort.medianShare * 100).toFixed(1)}%.`}
          />
          <Stat
            label="Not on the committee"
            value={`${(p.baseline.meanShare * 100).toFixed(1)}%`}
            sub={`Average of ${p.baseline.n} members. Typical member ${(p.baseline.medianShare * 100).toFixed(1)}%.`}
          />
          <Stat
            label="Gap"
            value={`${p.ratio.toFixed(2)}×`}
            sub="The first figure divided by the second. Averages, so one large member moves it."
          />
          <Stat
            label="Chance of this gap"
            value={p.qValue < 0.001 ? p.qValue.toExponential(1) : p.qValue.toFixed(3)}
            sub={`After allowing for all ${meta.pairsTested.toLocaleString()} comparisons. Cannot go below ${meta.smallestPossiblePValue.toExponential(1)} with ${meta.permutationIterations.toLocaleString()} shuffles.`}
          />
        </div>
      </section>

      {/* ---- the checks ---------------------------------------------------- */}
      <section className="mt-9">
        <SectionTitle
          note={`${PATTERN_CHECKS.filter((c) => c.passed(p)).length} of ${PATTERN_CHECKS.length} passed`}
        >
          Every check, and what each one rules out
        </SectionTitle>
        <p className="mb-1 max-w-measure text-base leading-relaxed text-ink-2">
          Each check removes one dull explanation for the gap. Read the ones that failed first.
        </p>
        <ul className="rows">
          {PATTERN_CHECKS.map((check) => (
            <CheckRow key={check.id} p={p} check={check} />
          ))}
        </ul>
        {leftovers.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm leading-snug text-ink-1">
            {leftovers.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- the examples -------------------------------------------------- */}
      <section className="mt-9">
        <SectionTitle>Five filings you can go and read</SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          These are members of this committee with a high share, so there is something to look at on
          their page. This is not a ranking and it is not a list of anybody to worry about. Open one,
          then follow the links to the filings themselves and check the figures.
        </p>
        <ul className="rows -mx-2">
          {p.examples.map((e) => (
            <li key={e.bioguideId} className="px-2 py-2.5">
              <Link to={`/reps/${e.bioguideId}`} className="group flex items-baseline justify-between gap-3">
                <span className="text-base leading-snug text-ink-1 group-hover:text-accent">
                  {e.name} <span className="text-ink-4">· {e.state}</span>
                </span>
                <span className="tnum shrink-0 text-sm text-ink-3">{(e.share * 100).toFixed(1)}%</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-measure-wide border-t border-line pt-3 text-sm leading-relaxed text-ink-1">
          {NO_ACCUSATION}
        </p>
      </section>

      {/* ---- the limits, in full ------------------------------------------- */}
      <section className="mt-9">
        <SectionTitle>What this comparison cannot tell you</SectionTitle>
        <ul className="max-w-measure space-y-2 text-base leading-snug text-ink-2">
          {PATTERN_LIMITS.map((limit, i) => (
            <li key={i}>· {limit}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-3">
          <Link className="link" to="/patterns">All committee comparisons →</Link> ·{' '}
          <Link className="link" to="/methodology">How the numbers work →</Link> ·{' '}
          <Link className="link" to="/limitations">What this tool cannot do →</Link>
        </p>
      </section>
    </div>
  );
}
