/**
 * One bill.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE IS ABOUT THE BILL. THAT IS THE WHOLE SCOPE.
 *
 * It used to end with two money sections: a diagram putting one member's donor
 * sectors next to the bill, and "Members on this bill, and who funded them" —
 * every member with a percentage of their reported money that came from sectors
 * the bill would affect, plus the arithmetic behind that percentage and a
 * share-image button. Both are gone, along with the "Members with an overlap"
 * count in the sidebar.
 *
 * Three independent evaluations of the live site — a product manager, an
 * ordinary voter and a working reporter — reached the same conclusion on their
 * own: that percentage was the product's headline metric and it was worthless.
 * The site's own reading guide already said so: a big match "is a bookmark, not
 * a finding". The bill's own data file still carries the overlap rows; this page
 * does not read them.
 *
 * What is left is what this page can say about the bill itself. 322 bills in
 * this bundle carry a real written summary, which is the reason these pages are
 * worth opening at all.
 *
 * ---------------------------------------------------------------------------
 * READING ORDER, AND WHY IT IS THIS WAY
 *
 * The page used to open with the legal title — "Referred to the Committee on
 * Energy and Commerce, and in addition to the Committees on Agriculture, Ways
 * and Means…" — and put the plain-English summary a screen further down. That
 * is the correct order for someone who already knows what the bill is and is
 * checking a detail. It is the wrong order for everyone else, who has exactly
 * one question: what does this thing do?
 *
 * So the order is:
 *      1. what the bill does, in plain words
 *      2. which industries it would affect, with the tool's own confidence
 *      3. everything else, folded: legal title, official summary, subject
 *         terms, committees, votes, sponsor and cosponsors, provenance
 * ---------------------------------------------------------------------------
 */

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  INDUSTRY_BY_ID, PLAIN_BILL_FRAMING, billLabel as fmtBillLabel, measureType, shortDate,
} from '@ftm/core';
import { getBillDetail, getLegislators } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useViewMode } from '../lib/view';
import { CoverageNote, DataLimit, ReportProblemLink, SourceLink } from '../components/Framing';
import { Empty, ErrorState, Loading, MethodTag, PartyTag, SectionTitle } from '../components/ui';
import { Fold, ViewToggle } from '../components/ViewToggle';
import { Term } from '../components/Glossary';

export default function BillDetail() {
  const { id = '' } = useParams();
  const { data, error, loading } = useAsync(() => getBillDetail(id), [id]);
  const { data: legislators } = useAsync(getLegislators, []);
  const { isQuick } = useViewMode();
  const legByBio = useMemo(() => new Map((legislators ?? []).map((l) => [l.bioguideId, l])), [legislators]);

  const label = useMemo(() => {
    if (!data) return '';
    return `${data.bill.billType.toUpperCase()} ${data.bill.billNumber}`;
  }, [data]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) {
    return (
      <div className="mx-auto max-w-content px-4">
        <Loading what="this bill: what it does, and who handles it" />
      </div>
    );
  }

  const { bill, classification, votes } = data;
  // Generated in the export step by `explainBillPlainly`, never here. Optional
  // so a bundle built before this existed still renders.
  const plain = data.plain ?? null;
  const isKeywordOnly = classification?.method === 'keyword-fallback';
  const prettyLabel = fmtBillLabel(bill.billType, bill.billNumber);
  const measure = measureType(bill.billType);

  // The plain summary's first paragraph is the lead. The rest follows it, and
  // nothing is dropped — a two-paragraph summary still shows both paragraphs.
  const summaryParas = classification?.plainSummary?.split('\n\n').filter(Boolean) ?? [];

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <nav className="text-xs text-ink-4">
        <Link className="link" to="/bills">Bills</Link> <span aria-hidden>/</span> <span className="mono">{label}</span>
      </nav>

      <header className="mt-2">
        <h1 className="serif text-2xl leading-snug text-ink-0">
          {prettyLabel}
          {/* The legal title is the page's subject for anyone reading with a
              screen reader or landing from a search engine, so it stays in the
              h1 — it is only demoted visually, and it is printed in full in the
              first fold below. */}
          <span className="sr-only"> — {bill.title}</span>
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span title={measure.explanation}>
            {measure.label} —{' '}
            {measure.becomesLaw ? 'can become law' : 'does not become law'}
          </span>
          <span className="mono">{bill.congress}th Congress</span>
          {bill.introducedDate && <span>Introduced {shortDate(bill.introducedDate)}</span>}
          {bill.latestActionDate && <span>Last moved {shortDate(bill.latestActionDate)}</span>}
          <SourceLink href={bill.congressDotGovUrl}>Read it on Congress.gov</SourceLink>
        </div>
        <ViewToggle className="mt-3" />
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          {/* ---- 1. what it does, in plain words, first ------------------- */}
          <section>
            <SectionTitle>In plain words</SectionTitle>
            {plain ? (
              <div className="space-y-4">
                <div>
                  <h3 className="label mb-1">What it does</h3>
                  {/* When only the title exists, the honest sentence IS a
                      data-gap notice, so it goes in amber — the one meaning
                      amber has under principle 1 of styles.css — rather than
                      being dressed up as a description or hidden. */}
                  {plain.confidence === 'title-only' ? (
                    <CoverageNote>{plain.whatItDoes}</CoverageNote>
                  ) : (
                    <p className="max-w-measure text-md leading-relaxed text-ink-0">{plain.whatItDoes}</p>
                  )}
                  {plain.titleInPlainWords && (
                    <div className="mt-3">
                      <h4 className="label mb-1">{PLAIN_BILL_FRAMING.titleRestatementLead}</h4>
                      <p className="max-w-measure text-base leading-relaxed text-ink-2">
                        {plain.titleInPlainWords}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="label mb-1">Who it touches</h3>
                  <p className="max-w-measure text-md leading-relaxed text-ink-0">{plain.whoItTouches}</p>
                </div>
                <div>
                  <h3 className="label mb-1">What would change</h3>
                  <p className="max-w-measure text-base leading-relaxed text-ink-1">{plain.everydayEffect}</p>
                </div>
                <p className="max-w-measure-wide text-xs leading-relaxed text-ink-3">
                  {plain.source}{' '}
                  <SourceLink href={bill.congressDotGovUrl}>Read the bill itself</SourceLink>
                </p>
              </div>
            ) : (
              <Empty>
                Nobody has written a plain summary of this bill yet. You can still read the official
                text on Congress.gov, linked at the top of this page.
              </Empty>
            )}

            {/* The machine-written paraphrase, when a reader configured a key of
                their own. It is NOT shown on the keyword path: there, the stored
                "plain summary" is a verbatim copy of the legal title, and the
                legal title is already printed in the fold below. Showing it
                twice, once under a heading promising plain English, is the
                register laundering this page was rebuilt to stop. */}
            {/* The `crs-summary` condition is load-bearing, not belt-and-braces.
                The caption below states the paraphrase was made "from the
                official summary". For the 1,012 bills in this dataset that have
                no official summary, a model has nothing to work from but the
                title — so it would produce a fluent rephrasing of a title, this
                block would present it under a heading promising a summary of the
                bill, and the caption would assert a provenance that does not
                exist. Three falsehoods stacked, all of them convincing.

                Gating on the tier means the model's output is shown only where
                there was source text for it to rewrite. Where there was not, the
                "In plain words" block above already says so, which is the true
                answer. */}
            {classification?.method === 'llm'
              && plain?.confidence === 'crs-summary'
              && summaryParas.length > 0 && (
              <Fold className="mt-4" open={!isQuick} title="A language model's summary of this bill">
                {summaryParas.map((p, i) => (
                  <p key={i} className="max-w-measure text-base leading-relaxed text-ink-2">{p}</p>
                ))}
                <p className="mt-2 text-xs text-ink-3">
                  Rewritten by {classification.model} from the official summary. A machine wrote it,
                  so it can be wrong. The real text is{' '}
                  <SourceLink href={bill.congressDotGovUrl}>the bill itself</SourceLink>.
                </p>
              </Fold>
            )}

            <Fold className="mt-4" open={!isQuick} title="The official title, in legal wording">
              <p className="max-w-measure-wide text-base leading-relaxed text-ink-1">{bill.title}</p>
              {bill.policyArea && (
                <p className="mt-2 text-sm text-ink-3">
                  Congress files this under: <span className="text-ink-1">{bill.policyArea}</span>
                </p>
              )}
              {bill.latestActionText && (
                <p className="mt-2 max-w-measure-wide text-sm leading-relaxed text-ink-2">
                  <span className="label">Last thing that happened</span>
                  <br />
                  {bill.latestActionText}
                </p>
              )}
            </Fold>
          </section>

          {/* ---- 2. sectors, as big chips -------------------------------- */}
          <section>
            {/* The method tag belongs HERE, on the sector tags, which is what the
                classifier actually produced. It used to sit on the summary
                heading, where it implied the classifier had written the
                summary. */}
            <SectionTitle note={<MethodTag method={classification?.method} />}>
              Industries this bill would affect
            </SectionTitle>
            {!classification || classification.industries.length === 0 ? (
              <CoverageNote>
                We could not tie this bill to any industry. For naming bills, ceremonial
                resolutions and housekeeping measures that is the right answer.
              </CoverageNote>
            ) : (
              <>
                {/* These were links to a per-sector page. That page ranked
                    members using only each member's three largest donor sectors
                    — about an eighth of the money — so it is gone, and these are
                    plain tags. The sector's definition is on `title`; the bills
                    tagged with it are one filter away on the Bills page. */}
                <ul className="flex flex-wrap gap-2">
                  {classification.industries.map((i) => (
                    <li key={i.industry}>
                      <span
                        title={INDUSTRY_BY_ID[i.industry]?.blurb}
                        className="inline-flex min-h-[2.25rem] max-w-full items-center gap-2 rounded-full border border-edge bg-paper-raised px-3.5 py-1.5 text-base font-medium text-ink-1"
                      >
                        <span className="min-w-0">{INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}</span>
                        <span className="tnum shrink-0 text-xs font-normal text-ink-3">
                          {Math.round(i.confidence * 100)}% sure
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <DataLimit className="mt-2">
                  The percentage says <Term k="confidence">how sure this tool is</Term> of the tag.
                  It is not about any member, and not about money. An industry that is not tagged
                  here was not judged relevant to this bill — it is not a gap in the list.{' '}
                  <Link className="link" to={`/bills?industry=${classification.industries[0]?.industry ?? ''}`}>
                    Other bills tagged {INDUSTRY_BY_ID[classification.industries[0]?.industry ?? 'other']?.label ?? 'this sector'} →
                  </Link>
                </DataLimit>

                <Fold className="mt-3" open={!isQuick} title="Why each industry was tagged">
                  <ul className="space-y-2.5">
                    {classification.industries.map((i) => (
                      <li key={i.industry} className="card p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-base font-medium text-ink-0" title={INDUSTRY_BY_ID[i.industry]?.blurb}>
                            {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}
                          </span>
                          <span className="tnum text-xs text-ink-3">
                            classifier confidence {Math.round(i.confidence * 100)}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-ink-2">{i.rationale}</p>
                      </li>
                    ))}
                  </ul>
                </Fold>
              </>
            )}
            {isKeywordOnly && (
              <CoverageNote>
                <strong className="font-semibold">These tags were matched by keyword.</strong> They
                come from Library of Congress labels and word matching — no language model read this
                bill — so they are rougher than they look. Treat a tag here as a hint about what the
                bill touches, not as a fact about it.
              </CoverageNote>
            )}
          </section>

          {/* ---- 5. everything else, folded ------------------------------ */}
          <section>
            <SectionTitle>The paperwork</SectionTitle>

            {votes.length > 0 && (
              <Fold open={!isQuick} title="Recorded votes on this bill" note={`${votes.length}`}>
                <ul className="divide-y divide-line">
                  {votes.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                      <span className="text-ink-1">{v.question}</span>
                      <span className="text-ink-3">
                        {shortDate(v.date)} · {v.result} · {v.positions} members recorded{' '}
                        <SourceLink href={v.sourceUrl}>Clerk record</SourceLink>
                      </span>
                    </li>
                  ))}
                </ul>
              </Fold>
            )}

            <Fold
              open={!isQuick}
              title="Committees handling it"
              note={`${bill.committeeNames.length}`}
            >
              <p className="mb-2 text-sm text-ink-2">
                The <Term k="committee">committee of jurisdiction</Term> is the group of members who
                deal with this subject first.
              </p>
              {bill.committeeNames.length === 0 ? (
                <p className="text-sm text-ink-3">None recorded.</p>
              ) : (
                <ul className="space-y-1 text-sm text-ink-1">
                  {bill.committeeNames.map((c) => <li key={c}>{c}</li>)}
                </ul>
              )}
            </Fold>

            {bill.officialSummary && (
              <Fold open={!isQuick} title="The official summary, word for word">
                <p className="mb-2 text-xs text-ink-3">
                  A <Term k="crs">CRS summary</Term>. Public-domain text, quoted here exactly.
                </p>
                <p className="max-h-64 overflow-auto text-sm leading-relaxed text-ink-2">{bill.officialSummary}</p>
              </Fold>
            )}

            {bill.subjects.length > 0 && (
              <Fold open={!isQuick} title="Subject labels" note={`${bill.subjects.length}`}>
                <div className="flex flex-wrap gap-1.5">
                  {bill.subjects.slice(0, 40).map((s) => <span key={s} className="chip">{s}</span>)}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-3">
                  Library of Congress staff put these labels on the bill, not this tool. They are a
                  big part of how the industry tags above were worked out.
                </p>
              </Fold>
            )}

            <Fold open={!isQuick} title="Where this page's facts come from">
              <ul className="space-y-1.5 text-sm text-ink-2">
                <li><SourceLink href={bill.congressDotGovUrl}>congress.gov record</SourceLink></li>
                <li><SourceLink href={bill.sourceUrl}>machine-readable source</SourceLink></li>
                <li>Fetched {shortDate(bill.fetchedAt)}</li>
                {bill.sponsorBioguideId && (
                  <li>
                    <Term k="sponsor">Sponsor</Term>{' '}
                    <Link className="link" to={`/reps/${bill.sponsorBioguideId}`}>
                      {legByBio.get(bill.sponsorBioguideId)?.name ?? bill.sponsorBioguideId}
                    </Link>{' '}
                    <PartyTag party={legByBio.get(bill.sponsorBioguideId)?.party} />
                  </li>
                )}
                <li>
                  {bill.cosponsorBioguideIds.length} <Term k="cosponsor">cosponsors</Term>
                </li>
              </ul>
            </Fold>
          </section>
        </div>

        {/* ---- sidebar: the short facts, always open ------------------- */}
        <aside className="space-y-4">
          <div className="card-data p-4">
            <h3 className="label mb-2">In short</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Kind</dt>
                <dd className="text-right text-ink-1" title={measure.explanation}>{measure.label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Industries tagged</dt>
                <dd className="tnum text-ink-1">{classification?.industries.length ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Cosponsors</dt>
                <dd className="tnum text-ink-1">{bill.cosponsorBioguideIds.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Recorded votes</dt>
                <dd className="tnum text-ink-1">{votes.length}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              A bill with no recorded votes has not been voted on in public. Most bills never are.
            </p>
          </div>

          {/* This card used to be about money, because the page used to end
              with money. It does not any more, so the card says what this page's
              own material cannot tell you instead of qualifying a section that
              is no longer here. */}
          <div className="card p-4">
            <h3 className="label mb-2">What this page cannot tell you</h3>
            <p className="text-sm leading-relaxed text-ink-2">
              The industry tags are worked out by this tool, not published by Congress, and they can
              be wrong. The plain-words summary is only as good as the official summary it was built
              from, and many bills have none. Nothing here says whether the bill is a good idea, or
              whether it will pass.{' '}
              <Link className="link" to="/limitations">The full list of gaps →</Link>
            </p>
          </div>

          <div className="card p-4">
            <h3 className="label mb-2">Found a mistake?</h3>
            <p className="text-sm leading-relaxed text-ink-2">
              The bill text, the summary and every fact on this page link to the government record
              behind them. If this page and that record disagree, the page is wrong.
            </p>
            <p className="mt-2">
              <ReportProblemLink />
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
