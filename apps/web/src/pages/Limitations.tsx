/**
 * What this tool cannot do.
 *
 * This page is not a legal shield and it is not decoration. It is the page that
 * keeps the rest of the site honest, so it is written to be read: specific,
 * concrete, and about this dataset rather than about tools in general. The full
 * DISCLAIMER_LONG is rendered verbatim from @ftm/core — no wording is invented
 * here — and the coverage notes are pulled live out of the generated bundle so
 * they describe the data actually loaded rather than an idealised version.
 */

import { Link } from 'react-router-dom';
import { getIndex } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { CoverageNote, LongDisclaimer } from '../components/Framing';
import { ErrorState, Loading, SectionTitle } from '../components/ui';

interface Limit {
  heading: string;
  body: React.ReactNode;
}

const LIMITS: Limit[] = [
  {
    heading: 'It cannot show that money caused anything',
    body: (
      <>
        This is the whole of it. Every number on this site is a co-occurrence: a contribution was
        disclosed, and separately, a legislative act happened. Nothing here distinguishes a member who
        was influenced from a member who would have done exactly the same thing with no money at all,
        and no arrangement of these two datasets ever could. There is no design of this tool, no extra
        source, and no larger sample that would turn a correlation in public filings into evidence of
        influence.
      </>
    ),
  },
  {
    heading: 'It sees only disclosed, itemized FEC hard money',
    body: (
      <>
        The money visible here is the money the Federal Election Commission requires to be itemized
        and publishes. That excludes, entirely and by construction: dark money; 501(c)(4) and 501(c)(6)
        spending; contributions below the itemization threshold; lobbying expenditure, which is
        reported to Congress under a different regime this project does not ingest at all; bundling,
        where one person aggregates many small contributions and the aggregation is invisible in the
        filing; and the revolving door — the job somebody takes afterwards, which no campaign-finance
        filing records. Several of those channels are larger than the one shown here. A sector that
        spends mostly through them will look quiet on this site, and that quiet means nothing.
      </>
    ),
  },
  {
    heading: 'Super-PAC money is visible, but its source is not',
    body: (
      <>
        Independent-expenditure committees appear in this data and their contributions are real and
        correctly reported. What is missing is the layer beneath: a super PAC's own donors are
        disclosed on its own separate filing, which this pipeline does not traverse. So the money is
        counted, and the sector behind it is simply not visible from here. It is labelled{' '}
        <Link className="link" to="/industries/super-pac-unattributed">funding source not visible</Link>{' '}
        rather than being assigned a sector, because assigning one would be an invention and calling
        it “unclassified” would imply the tool failed at something it never attempted.
      </>
    ),
  },
  {
    heading: 'Sector attribution comes from free text and is noisy',
    body: (
      <>
        There is no industry field in an FEC filing. Individual contributions carry a self-reported
        employer string — “SELF”, “N/A”, “RETIRED”, an employer name spelled four different ways across
        four filings — and committee contributions carry a registered name that may say nothing about
        who funds it. Everything sector-related on this site is inferred from that text. Filings that
        genuinely have no employer are separated from money that had an employer this tool could not
        place, because merging the two would overstate how much is unknown. Every member's page
        reports their own unattributed share; treat a member with a large one as a member whose
        sector figures are weak. The taxonomy is deliberately coarse for the same reason — a finer one
        would project precision the source text does not contain.
      </>
    ),
  },
  {
    heading: 'The classifier can be wrong, and its confidence is its own opinion',
    body: (
      <>
        Sector tags on bills are produced by this tool, not by Congress. On the default offline path
        they come from Library of Congress policy areas and subject terms plus keyword stems; with a
        language-model key configured they come from a model reading the bill's metadata and summary.
        Both get bills wrong. The percentage shown next to a tag is the classifier's own
        self-assessment — it is not a measured probability, not a statistical guarantee, and not
        validated against a labelled ground truth, because no such labelled set exists for this task.
        A confident tag can be flatly incorrect. Each bill page shows which method produced its tags
        so a reader can weigh them accordingly.
      </>
    ),
  },
  {
    heading: 'Overlap is exactly what ordinary representation looks like',
    body: (
      <>
        This is the mistake that matters most. Members seek committee assignments relevant to their
        districts. Industries concentrated in a district fund that district's representative. A member
        from a farming district will score high on an agriculture bill, and should — that pattern is
        what representation produces, and it is indistinguishable, in this data, from what capture
        would produce. A high score is therefore not surprising and not damning. Constituent interest,
        party position, ideology, personal conviction and the substance of the bill itself are all
        more likely explanations for any given vote than a contribution.
      </>
    ),
  },
  {
    heading: 'The dataset is partial, and partial in ways that matter',
    body: (
      <>
        A bundle covers one election cycle and one Congress. Federal awards are truncated to the
        largest by value rather than the complete record. Bills with no usable metadata get no tags
        and therefore no overlap at all, so they are absent rather than scored as zero. Members whose
        FEC candidate records could not be linked to a bioguide ID have no donor profile and appear
        nowhere in any money figure. Roll-call vote positions are missing entirely unless a free
        Congress.gov key was configured when the bundle was built. Absence on this site is very often
        an absence of data, not an absence of activity.
      </>
    ),
  },
  {
    heading: 'It is not a substitute for investigative journalism',
    body: (
      <>
        This tool reads filings. It does not interview anybody, read a calendar, obtain a document
        under FOIA, or know anything that is not in a government file. It cannot tell you what was
        said in a meeting, what a member believes, or what an amendment was traded for. Its useful
        output is a question, and the correct next step for any question that seems worth pursuing is
        a primary source — the bill text, the filing, the member's own stated reasoning, all linked
        from the relevant page — or a reporter who can do the parts this cannot. A screenshot of a
        score is not a finding, and publishing one as though it were does real harm to somebody who
        may have done nothing at all.
      </>
    ),
  },
];

export default function Limitations() {
  const { data: idx, error, loading } = useAsync(getIndex, []);

  if (error) return <ErrorState error={error} />;

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">What this tool cannot do</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-3">
        Read this before drawing a conclusion from anything on this site. These are not hedges. They
        are the specific, structural reasons that particular conclusions cannot be supported by this
        data, however the numbers look.
      </p>

      {/* ---- the headline claim, stated once, prominently ----------------- */}
      <section className="mt-6">
        <div className="card border-accent-line p-5">
          <div className="label mb-2">The single most important limitation</div>
          <p className="serif text-lg leading-snug text-ink-0 sm:text-xl">
            Nothing on this site can show that a campaign contribution caused a vote, a bill, or any
            other outcome. Every figure here is a correlation between two public records, and a
            correlation is where a question starts — not where one ends.
          </p>
        </div>
      </section>

      {/* ---- the full disclaimer, verbatim from @ftm/core ------------------ */}
      <section className="mt-8">
        <SectionTitle>The full statement</SectionTitle>
        <div className="max-w-3xl">
          <LongDisclaimer />
        </div>
      </section>

      {/* ---- the specifics -------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle note={`${LIMITS.length} specific limitations`}>Specifically</SectionTitle>
        <ol className="max-w-3xl space-y-5">
          {LIMITS.map((l, i) => (
            <li key={l.heading} className="border-l-2 border-line pl-4">
              <h3 className="text-base font-semibold leading-snug text-ink-0">
                <span className="tnum mr-1.5 text-ink-4">{i + 1}.</span>
                {l.heading}
              </h3>
              <p className="mt-1.5 text-base leading-relaxed text-ink-2">{l.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- live coverage notes -------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle
          note={idx ? `Bundle generated ${new Date(idx.generatedAt).toLocaleString()}` : undefined}
        >
          Coverage gaps in the bundle you are actually reading
        </SectionTitle>
        <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-3">
          The notes below are written by the export step at generation time and describe this exact
          dataset — not the project in the abstract. They change when the data changes.
        </p>

        {loading ? (
          <Loading what="coverage notes" />
        ) : !idx || idx.coverageNotes.length === 0 ? (
          <CoverageNote>
            This bundle recorded no coverage notes. That is unusual — if the data folder was generated
            by an older revision of the pipeline, regenerate it so these notes are present.
          </CoverageNote>
        ) : (
          <div className="space-y-2">
            {idx.coverageNotes.map((n, i) => (
              <CoverageNote key={i}>{n}</CoverageNote>
            ))}
          </div>
        )}

        {idx && (
          <p className="mt-3 text-xs leading-relaxed text-ink-4">
            Built from: campaign finance <span className="mono">{idx.sources.openfec}</span>,
            legislation <span className="mono">{idx.sources.congress}</span>, classification{' '}
            <span className="mono">{idx.sources.classification}</span>. FEC cycle {idx.cycle},{' '}
            {idx.congress}th Congress.{' '}
            {idx.isSample && 'This is the checked-in sample bundle, not a live fetch. '}
            <Link className="link" to="/methodology">What each of those modes means →</Link>
          </p>
        )}
      </section>

      {/* ---- what to do instead ---------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>If you found something that looks significant</SectionTitle>
        <ol className="max-w-measure space-y-2 text-base leading-relaxed text-ink-2">
          <li>
            <strong className="font-semibold">1. Read the bill.</strong> Not the tags, not the
            paraphrase — the text, linked from every bill page. The classifier may simply be wrong
            about what the bill does.
          </li>
          <li>
            <strong className="font-semibold">2. Open the filing.</strong> Every money figure links to
            the FEC record behind it. Check the amounts, the dates, and the committee.
          </li>
          <li>
            <strong className="font-semibold">3. Read the member's own stated reasoning</strong> — the
            floor statement, the press release, the committee record. It is public, and it is very
            often a complete and ordinary explanation.
          </li>
          <li>
            <strong className="font-semibold">4. Check whether the sector is simply in the
            district.</strong> If it is, the overlap has an unremarkable explanation and the finding
            probably dissolves.
          </li>
          <li>
            <strong className="font-semibold">5. If it still holds up, take it to a reporter.</strong>{' '}
            Not to a screenshot. The parts that would establish anything — interviews, documents,
            timelines, FOIA — are exactly the parts this tool cannot do.
          </li>
        </ol>
        <p className="mt-4 text-sm text-ink-4">
          <Link className="link" to="/methodology">How the numbers are computed →</Link> ·{' '}
          <Link className="link" to="/about">What this project is →</Link>
        </p>
      </section>
    </div>
  );
}
