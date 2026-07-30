/**
 * The one page on this site that compares groups instead of people.
 *
 * ---------------------------------------------------------------------------
 * WHY IT EXISTS
 *
 * Every other view here is one member or one bill. A reader told us they could
 * not learn anything from those, and they were right: one member's share of
 * money from one sector has a sample size of one. It is set by which committee
 * they sit on and which industries are in their state, so there is nothing in it
 * to learn.
 *
 * This page asks the question that has a sample size. Take the members on a
 * committee. Take the members of the same chamber who are not on it. Does the
 * money look different? That can be tested, and every way it could be wrong can
 * be measured.
 *
 * ---------------------------------------------------------------------------
 * TWO RULES FOR THIS PAGE
 *
 * 1. THE DENOMINATOR IS PART OF THE FINDING. Every committee was tested against
 *    every sector — over a thousand comparisons. A shortlist of eighteen read
 *    without that number looks like eighteen discoveries. So the count of pairs
 *    tested is in the first sentence and in the figures at the top, taken from
 *    the file's own `meta` rather than typed in here.
 *
 * 2. THE FAILURES STAY ON THE PAGE. Rule 4 in packages/core/src/patterns.ts:
 *    hiding the comparisons that did not hold up makes the ones that did look
 *    stronger than they are. They are folded, never dropped.
 *
 * Every sentence describing a finding comes from @ftm/core — `describePattern`
 * and `describeCohortSpread`. Do not write another one here. There is a test and
 * a repo audit asserting that language lives in one file.
 * ---------------------------------------------------------------------------
 */

import { Link } from 'react-router-dom';
import {
  PATTERN_LIMITS,
  PATTERN_VERDICT_LABEL,
  PATTERN_VERDICT_PLAIN,
  describeCohortSpread,
  describePattern,
} from '@ftm/core';
import type { PatternVerdict } from '@ftm/core';
import { getPatterns } from '../lib/data';
import type { PatternRow } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { FramingNote } from '../components/Framing';
import { Empty, ErrorState, Loading, SectionTitle, Stat } from '../components/ui';
import { Fold } from '../components/ViewToggle';

/** The verdict, as a neutral chip. No colour carries the verdict — the words do. */
export function VerdictChip({ verdict }: { verdict: PatternVerdict }) {
  return <span className="chip">{PATTERN_VERDICT_LABEL[verdict]}</span>;
}

/** Committee, chamber and sector — the identity of a comparison, in one line. */
function PatternHeading({ p }: { p: PatternRow }) {
  return (
    <>
      <span className="block text-md font-semibold leading-snug text-ink-0">
        {p.committeeName}
      </span>
      <span className="mt-0.5 block text-sm text-ink-3">
        {p.chamber} · money from{' '}
        <span className="font-medium text-ink-2">{p.sectorLabel}</span>
      </span>
    </>
  );
}

/** One shortlisted comparison. The sentences are core's, the numbers are the file's. */
function ShortlistCard({ p }: { p: PatternRow }) {
  return (
    <li className="card-data p-4">
      <Link to={`/patterns/${p.id}`} className="block hover:text-accent">
        <PatternHeading p={p} />
      </Link>

      <p className="mt-2.5 max-w-measure text-base leading-snug text-ink-1">{describePattern(p)}</p>
      <p className="mt-1.5 max-w-measure text-sm leading-snug text-ink-2">{describeCohortSpread(p)}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        <div>
          <dt className="label">Gap</dt>
          <dd className="tnum text-ink-1">{p.ratio.toFixed(2)}×</dd>
        </div>
        <div>
          <dt className="label">Five highest out</dt>
          <dd className="tnum text-ink-1">{p.checks.trimmedRatio.toFixed(2)}×</dd>
        </div>
        <div>
          <dt className="label">Both parties</dt>
          <dd className="text-ink-1">{p.checks.holdsInBothParties ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="label">States in top ten</dt>
          <dd className="tnum text-ink-1">{p.checks.distinctStatesInTopTen}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm">
        <Link className="link font-medium text-ink-1" to={`/patterns/${p.id}`}>
          Every check on this one →
        </Link>
      </p>
    </li>
  );
}

/** A compact row for the folded lists. Enough to judge it, one tap to the rest. */
function CompactRow({ p }: { p: PatternRow }) {
  return (
    <li className="px-2 py-2.5">
      <Link to={`/patterns/${p.id}`} className="group block">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="tnum shrink-0 text-sm text-ink-3">{p.ratio.toFixed(2)}×</span>
          <span className="max-w-measure-wide text-base leading-snug text-ink-1 group-hover:text-accent">
            {p.committeeName} · {p.sectorLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-ink-3">
          {p.failedChecks.length} check{p.failedChecks.length === 1 ? '' : 's'} failed ·{' '}
          {p.checks.aboveBaselineMedian} of {p.cohort.n} above the typical non-member
        </p>
      </Link>
    </li>
  );
}

export default function Patterns() {
  const file = useAsync(getPatterns, []);

  if (file.error) return <ErrorState error={file.error} />;
  if (!file.data) {
    return (
      <div className="mx-auto max-w-content px-4">
        <Loading what="the committee comparisons" />
      </div>
    );
  }

  const { meta, patterns } = file.data;
  const shortlist = patterns.filter((p) => p.verdict === 'worth-a-look');
  const mixed = patterns.filter((p) => p.verdict === 'weak');
  const failed = patterns.filter((p) => p.verdict === 'not-supported');

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">Committees, next to the members not on them</h1>
      <p className="mt-1.5 max-w-measure text-base leading-relaxed text-ink-2">
        Take the members of one committee. Take the members of the same chamber who are not on it.
        Then compare where their money came from. This page tested every committee against every
        sector — {meta.pairsTested.toLocaleString()} comparisons in all — and{' '}
        {meta.verdictCounts['worth-a-look']} of them passed every check.
      </p>
      <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-3">
        That count is the point of this page. With {meta.pairsTested.toLocaleString()} comparisons,
        chance alone throws up dozens of gaps that look real. So the shortlist below is corrected for
        the size of the search, and the comparisons that did not survive are still here, further down.
      </p>

      <FramingNote className="mt-4 max-w-measure-wide" />

      {/* ---- the size of the search ---------------------------------------- */}
      <section className="mt-8">
        <h2 className="sr-only">The size of the search</h2>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          <Stat
            label="Comparisons tested"
            value={meta.pairsTested.toLocaleString()}
            sub={`${meta.committeesTested} full committees × ${meta.sectorsTested} sectors, cycle ${meta.cycle}.`}
          />
          <Stat
            label="Passed every check"
            value={meta.verdictCounts['worth-a-look'].toLocaleString()}
            sub="The strongest thing said here is that these are worth reading about."
          />
          <Stat
            label="Passed some checks"
            value={meta.verdictCounts.weak.toLocaleString()}
            sub="Listed below, with the checks they failed."
          />
          <Stat
            label="Did not hold up"
            value={meta.verdictCounts['not-supported'].toLocaleString()}
            sub="Also listed below. Hiding these would flatter the ones above."
          />
        </div>
        <p className="mt-3 max-w-measure-wide text-xs leading-relaxed text-ink-3">
          A further {meta.pairsSkippedTooSmall.toLocaleString()} pairs were not tested at all,
          because the committee had fewer than {meta.minCohortSize} members with at least{' '}
          ${meta.minMemberTotal.toLocaleString()} of reported money. Those are not failures. Nothing
          was measured.{' '}
          <Link className="link" to="/methodology">
            How the numbers work →
          </Link>
        </p>
      </section>

      {/* ---- the shortlist -------------------------------------------------- */}
      <section className="mt-9">
        <SectionTitle note={`${shortlist.length} of ${meta.pairsTested.toLocaleString()}`}>
          Worth a look
        </SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          {PATTERN_VERDICT_PLAIN['worth-a-look']}
        </p>
        {shortlist.length === 0 ? (
          <Empty>
            No comparison passed every check in this data bundle. That is a normal result, not a
            missing file.
          </Empty>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {shortlist.map((p) => (
              <ShortlistCard key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      {/* ---- the rest, folded but present ---------------------------------
          Rule 4 in core/patterns.ts. A page that shows only the survivors of a
          thousand tests is a page that has hidden its base rate. These are one
          tap away, in the same order, with the reasons attached. */}
      <section className="mt-10">
        <SectionTitle>The rest of the search</SectionTitle>
        <p className="mb-1 max-w-measure text-base leading-relaxed text-ink-2">
          These are the comparisons that failed a check, or several. They are here so you can see how
          ordinary the ones above are. Every one of them counted towards the correction applied to the
          shortlist.
        </p>

        <Fold
          className="mt-3"
          title={`${PATTERN_VERDICT_LABEL.weak} — ${mixed.length}`}
          note="one or two checks failed"
        >
          <p className="mb-2 max-w-measure text-sm leading-relaxed text-ink-2">
            {PATTERN_VERDICT_PLAIN.weak}
          </p>
          {mixed.length === 0 ? (
            <Empty>None in this bundle.</Empty>
          ) : (
            <ul className="rows -mx-2">
              {mixed.map((p) => (
                <CompactRow key={p.id} p={p} />
              ))}
            </ul>
          )}
        </Fold>

        <Fold
          title={`${PATTERN_VERDICT_LABEL['not-supported']} — ${meta.verdictCounts['not-supported'].toLocaleString()}`}
          note={`${failed.length.toLocaleString()} listed`}
        >
          <p className="mb-2 max-w-measure text-sm leading-relaxed text-ink-2">
            {PATTERN_VERDICT_PLAIN['not-supported']}
          </p>
          {/* What the file left out, in the file's own words. A truncated list
              that does not say it was truncated is worse than a long one. */}
          {meta.dropped.length > 0 && (
            <ul className="mb-3 space-y-1 text-xs leading-relaxed text-ink-3">
              {meta.dropped.map((note, i) => (
                <li key={i}>· {note}</li>
              ))}
            </ul>
          )}
          {failed.length === 0 ? (
            <Empty>None in this bundle.</Empty>
          ) : (
            <ul className="rows -mx-2">
              {failed.map((p) => (
                <CompactRow key={p.id} p={p} />
              ))}
            </ul>
          )}
        </Fold>
      </section>

      {/* ---- what it cannot say --------------------------------------------
          PATTERN_LIMITS verbatim, in full, on the page a reader lands on first.
          It is tempting to paraphrase five bullets into two sentences here; that
          is how a project ends up with five slightly different versions of its
          own caveats, and the repo audit exists to stop it. */}
      <section className="mt-10 border-t border-line pt-6">
        <SectionTitle>What a comparison here cannot tell you</SectionTitle>
        <ul className="max-w-measure space-y-2 text-base leading-snug text-ink-2">
          {PATTERN_LIMITS.map((limit, i) => (
            <li key={i}>· {limit}</li>
          ))}
        </ul>
        <p className="mt-3 max-w-measure text-sm leading-relaxed text-ink-3">
          Members with under ${meta.minMemberTotal.toLocaleString()} of reported money are left out of
          every comparison, and a committee needs {meta.minCohortSize} members above that floor before
          it is tested at all.
        </p>
        <p className="mt-4 text-sm text-ink-3">
          <Link className="link" to="/how-to-read">How to read this site →</Link> ·{' '}
          <Link className="link" to="/methodology">How the numbers work →</Link> ·{' '}
          <Link className="link" to="/limitations">What this tool cannot do →</Link>
        </p>
      </section>
    </div>
  );
}
