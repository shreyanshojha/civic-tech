/**
 * One bill.
 *
 * ---------------------------------------------------------------------------
 * READING ORDER, AND WHY IT CHANGED
 *
 * The page used to open with the legal title — "Referred to the Committee on
 * Energy and Commerce, and in addition to the Committees on Agriculture, Ways
 * and Means…" — and put the plain-English summary a screen further down. That
 * is the correct order for someone who already knows what the bill is and is
 * checking a detail. It is the wrong order for everyone else, who has exactly
 * one question: what does this thing do?
 *
 * So the order is now:
 *      1. what the bill does, in plain words
 *      2. which industries it would affect, as big tappable chips
 *      3. one picture of where the money sits next to it
 *      4. the members, with the overlap number
 *      5. everything else, folded: legal title, official summary, subject
 *         terms, committees, votes, provenance
 *
 * Nothing from the old page was removed. The legal title, the CRS summary, the
 * Library of Congress subject terms and the full arithmetic are all still on
 * this page, one tap away, and all of them open at once in full detail view.
 * ---------------------------------------------------------------------------
 */

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  INDUSTRY_BY_ID, billLabel as fmtBillLabel, describeOverlap, plainAmount, plainShare, shortDate, usd,
} from '@ftm/core';
import { getBillDetail, getLegislators } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useViewMode } from '../lib/view';
import { CoverageNote, InlineDisclaimer, OverlapScore, SourceLink } from '../components/Framing';
import { Empty, ErrorState, IndustryBars, Loading, MemberAvatar, MethodTag, PartyTag, SectionTitle } from '../components/ui';
import { ShareCardButton } from '../components/ShareCard';
import { Fold, ViewToggle } from '../components/ViewToggle';
import { MoneyFlow } from '../components/MoneyFlow';
import { Term } from '../components/Glossary';
import { WhatThisMeans } from '../components/WhatThisMeans';

export default function BillDetail() {
  const { id = '' } = useParams();
  const { data, error, loading } = useAsync(() => getBillDetail(id), [id]);
  const { data: legislators } = useAsync(getLegislators, []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { isQuick, setView } = useViewMode();
  const legByBio = useMemo(() => new Map((legislators ?? []).map((l) => [l.bioguideId, l])), [legislators]);

  const label = useMemo(() => {
    if (!data) return '';
    return `${data.bill.billType.toUpperCase()} ${data.bill.billNumber}`;
  }, [data]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) {
    return (
      <div className="mx-auto max-w-content px-4">
        <Loading what="this bill: what it does, and who worked on it" />
      </div>
    );
  }

  const { bill, classification, overlaps, votes } = data;
  const isKeywordOnly = classification?.method === 'keyword-fallback';
  const prettyLabel = fmtBillLabel(bill.billType, bill.billNumber);
  const isResolution = /res$/i.test(bill.billType);

  /**
   * ΣC — the denominator of the bill weights.
   *
   * `computeOverlap` drops any tag below 0.25 confidence and then normalises
   * what is left, so this has to be summed over exactly that set or the weight
   * column would not reproduce the contributions. The threshold is mirrored
   * from packages/core/src/overlap.ts; if it ever changes there, this changes
   * with it. (Verified against the shipped bundle: for every multi-tag bill,
   * `billConfidence × donorShare ÷ contribution` equals this sum.)
   */
  const MIN_BILL_CONFIDENCE = 0.25;
  const scoringTags = (classification?.industries ?? []).filter((i) => i.confidence >= MIN_BILL_CONFIDENCE);
  const confidenceSum = scoringTags.reduce((s, i) => s + i.confidence, 0);
  const tagCount = scoringTags.length;

  // The plain summary's first paragraph is the lead. The rest follows it, and
  // nothing is dropped — a two-paragraph summary still shows both paragraphs.
  const summaryParas = classification?.plainSummary?.split('\n\n').filter(Boolean) ?? [];

  const shownOverlaps = isQuick ? overlaps.slice(0, 3) : overlaps;

  // The picture uses the strongest single pairing on the page, because a
  // diagram of 135 members is not a diagram. Which member it is, is stated in
  // the words underneath it.
  const flowFor = overlaps.find((o) => o.matches.length > 0) ?? null;

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
          <span>
            {isResolution ? (
              <>A <Term k="hres">resolution</Term>, not a law</>
            ) : (
              <>A <Term k="hr">bill</Term> — it becomes law only if both chambers pass it</>
            )}
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
          {/* ---- 1. what it does, first ---------------------------------- */}
          <section>
            <SectionTitle note={<MethodTag method={classification?.method} />}>What this bill does</SectionTitle>
            {classification && summaryParas.length > 0 ? (
              <>
                <p className="max-w-measure text-md leading-relaxed text-ink-0">{summaryParas[0]}</p>
                {summaryParas.slice(1).map((p, i) => (
                  <p key={i} className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">{p}</p>
                ))}
                {classification.method === 'llm' && (
                  <p className="mt-2 text-xs text-ink-3">
                    Rewritten by {classification.model} from the official summary. A machine wrote it,
                    so it can be wrong. The real text is{' '}
                    <SourceLink href={bill.congressDotGovUrl}>the bill itself</SourceLink>.
                  </p>
                )}
              </>
            ) : (
              <Empty>
                Nobody has written a plain summary of this bill yet. You can still read the official
                text on Congress.gov, linked at the top of this page.
              </Empty>
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
            <SectionTitle>Industries this bill would affect</SectionTitle>
            {!classification || classification.industries.length === 0 ? (
              <CoverageNote>
                We could not tie this bill to any industry. For naming bills, ceremonial
                resolutions and housekeeping measures that is the right answer, and no overlap
                number is worked out.
              </CoverageNote>
            ) : (
              <>
                <ul className="flex flex-wrap gap-2">
                  {classification.industries.map((i) => (
                    <li key={i.industry}>
                      <Link
                        to={`/industries/${i.industry}`}
                        className="inline-flex min-h-[2.25rem] max-w-full items-center gap-2 rounded-full border border-edge bg-paper-raised px-3.5 py-1.5 text-base font-medium text-ink-1 hover:border-accent hover:text-accent"
                      >
                        <span className="min-w-0">{INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}</span>
                        <span className="tnum shrink-0 text-xs font-normal text-ink-3">
                          {Math.round(i.confidence * 100)}% sure
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 max-w-measure-wide text-xs leading-relaxed text-ink-3">
                  The percentage says <Term k="confidence">how sure this tool is</Term> of the tag.
                  It is not about any member, and not about money.
                </p>

                <Fold className="mt-3" open={!isQuick} title="Why each industry was tagged">
                  <ul className="space-y-2.5">
                    {classification.industries.map((i) => (
                      <li key={i.industry} className="card p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <Link to={`/industries/${i.industry}`} className="tap-24 text-base font-medium text-ink-0 hover:text-accent">
                            {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}
                          </Link>
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
                bill — so they are rougher than they look. Set{' '}
                <code className="mono">LLM_PROVIDER</code> in your <code className="mono">.env</code>{' '}
                and re-run <code className="mono">npm run classify</code> to improve them.
              </CoverageNote>
            )}
          </section>

          {/* ---- 3. one picture ------------------------------------------ */}
          {flowFor && flowFor.member && (
            <section>
              <SectionTitle note="One member, as an example">Money next to this bill</SectionTitle>
              <MoneyFlow
                sectors={flowFor.matches.map((m) => ({
                  industry: m.industry,
                  label: INDUSTRY_BY_ID[m.industry]?.label ?? m.industry,
                  amount: m.donorAmount,
                  share: m.donorShare,
                }))}
                memberName={flowFor.member.name}
                memberHref={`/reps/${flowFor.bioguideId}`}
                billLabel={prettyLabel}
                role={flowFor.member.role}
                cycle={flowFor.cycle}
              />
            </section>
          )}

          {/* ---- 4. the members ------------------------------------------ */}
          <section>
            <SectionTitle
              note={
                isQuick && overlaps.length > shownOverlaps.length
                  ? `${shownOverlaps.length} of ${overlaps.length}`
                  : `${overlaps.length} member${overlaps.length === 1 ? '' : 's'}`
              }
            >
              Members on this bill, and who funded them
            </SectionTitle>
            <InlineDisclaimer className="mb-4" plain={isQuick} />

            {overlaps.length === 0 ? (
              <Empty>
                No member on this bill has campaign money linked to them in this data. That is a gap
                in the data, not a sign that nobody was funded.
              </Empty>
            ) : (
              <ul className="space-y-3">
                {shownOverlaps.map((o) => {
                  const key = o.bioguideId;
                  const isOpen = expanded === key;
                  const profile = o.donorProfile;
                  const top = o.matches[0] ?? null;
                  return (
                    <li key={key} className="card p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <MemberAvatar src={o.member?.imageUrl} name={o.member?.name ?? o.bioguideId} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/reps/${o.bioguideId}`} className="tap-24 text-base font-medium text-ink-0 hover:text-accent">
                              {o.member?.name ?? o.bioguideId}
                            </Link>
                            <span className="chip">
                              {o.member?.role === 'Cosponsor' ? (
                                <Term k="cosponsor">Cosponsor</Term>
                              ) : (
                                o.member?.role ?? 'Involved'
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-ink-3">
                            {o.member?.chamber === 'Senate' ? 'Sen.' : 'Rep.'} · {o.member?.state}
                            {o.member?.district ? `-${o.member.district}` : ''}
                            {profile && (
                              <> · {plainAmount(profile.totalItemized)} reported, <Term k="cycle">cycle</Term> {profile.cycle}</>
                            )}
                          </div>
                        </div>
                        <div className="w-full sm:w-56">
                          <OverlapScore score={o.score} size="md" showExplainer={false} plain={isQuick} />
                        </div>
                      </div>

                      {/* Quick view says it in short words; full view keeps the
                          exact sentence the share card and the export use. */}
                      {isQuick && top ? (
                        <p className="mt-3 text-sm leading-relaxed text-ink-2">
                          Of all the money {o.member?.name ?? 'this member'} reported,{' '}
                          {plainShare(o.score)} came from industries this bill would affect. The
                          biggest is{' '}
                          <Link className="link" to={`/industries/${top.industry}`}>
                            {INDUSTRY_BY_ID[top.industry]?.label ?? top.industry}
                          </Link>{' '}
                          — {plainAmount(top.donorAmount)}.
                        </p>
                      ) : (
                        <p className="mt-3 text-sm leading-relaxed text-ink-2">
                          {describeOverlap(o, o.member?.name ?? 'this member', label)}
                        </p>

                      )}

                      <WhatThisMeans
                        overlap={o}
                        facts={o.meaning}
                        memberName={o.member?.name ?? 'This member'}
                        billLabel={prettyLabel}
                        totalDisclosed={profile?.totalItemized ?? 0}
                        hasVote={votes.length > 0}
                        classificationMethod={classification?.method ?? null}
                        defaultOpen={!isQuick}
                      />

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : key)}
                          className="btn px-2.5 py-1 text-xs"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? 'Hide the maths' : 'Show how this number was worked out'}
                        </button>
                        <ShareCardButton
                          finding={{
                            memberName: o.member?.name ?? o.bioguideId,
                            memberSubtitle: `${o.member?.chamber === 'Senate' ? 'Sen.' : 'Rep.'} ${o.member?.state ?? ''}${o.member?.district ? `-${o.member.district}` : ''}`,
                            billLabel: label,
                            billTitle: bill.title,
                            topIndustryLabel: o.matches[0] ? (INDUSTRY_BY_ID[o.matches[0].industry]?.label ?? o.matches[0].industry) : null,
                            topIndustryAmount: o.matches[0]?.donorAmount ?? null,
                            score: o.score,
                            cycle: profile?.cycle ?? null,
                            // The three qualifiers the card used to drop. The role
                            // is already on screen in the chip above; the total is
                            // the denominator of the percentage; the method is how
                            // the sector tags the score depends on were derived.
                            role: o.member?.role ?? null,
                            totalDisclosed: profile?.totalItemized ?? null,
                            classificationMethod: classification?.method ?? null,
                          }}
                        />
                        {profile?.sourceUrls[0] && <SourceLink href={profile.sourceUrls[0]}>FEC filings</SourceLink>}
                      </div>

                      {(isOpen || !isQuick) && (
                        <div className="mt-4 space-y-4 border-t border-line pt-4">
                          {/* ---- the arithmetic, so it closes ----------------
                              This table used to show donor share, bill relevance
                              and contribution — and a reader multiplying the
                              first two did not get the third, because relevance
                              is not the multiplier. The multiplier is the
                              *normalised* weight C / ΣC. On a bill with one
                              surviving tag that weight is 1.00 and the
                              confidence cancels out entirely, which is the
                              majority case, so the missing column was not an
                              edge case: it was most of the dataset.

                              The weight is now its own column, ΣC is stated in
                              the footer note, and share × weight = contribution
                              on every row.                                   */}
                          <div className="min-w-0">
                            <div className="label mb-1.5">Shared industries, and what each added to the number</div>
                            <div className="scroll-x -mx-1 px-1">
                              <table className="w-full min-w-[30rem] text-sm">
                                <thead>
                                  <tr className="text-left text-2xs uppercase tracking-wide text-ink-3">
                                    <th className="pb-1 font-semibold">Sector</th>
                                    <th className="pb-1 text-right font-semibold">Given to member</th>
                                    <th className="pb-1 text-right font-semibold">Share of their money <span className="normal-case">(D)</span></th>
                                    <th className="pb-1 text-right font-semibold">Classifier confidence <span className="normal-case">(C)</span></th>
                                    <th className="pb-1 text-right font-semibold">Weight <span className="normal-case">(C ÷ ΣC)</span></th>
                                    <th className="pb-1 text-right font-semibold">Adds <span className="normal-case">(D × weight)</span></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                  {o.matches.map((m) => (
                                    <tr key={m.industry}>
                                      <td className="py-1.5 pr-3">
                                        <Link className="link" to={`/industries/${m.industry}`}>
                                          {INDUSTRY_BY_ID[m.industry]?.label ?? m.industry}
                                        </Link>
                                      </td>
                                      <td className="tnum py-1.5 text-right">{usd(m.donorAmount, { compact: true })}</td>
                                      <td className="tnum py-1.5 text-right">{(m.donorShare * 100).toFixed(1)}%</td>
                                      <td className="tnum py-1.5 text-right">{Math.round(m.billConfidence * 100)}%</td>
                                      <td className="tnum py-1.5 text-right">
                                        {confidenceSum > 0 ? (m.billConfidence / confidenceSum).toFixed(2) : '—'}
                                      </td>
                                      <td className="tnum py-1.5 text-right">{(m.contribution * 100).toFixed(1)} pts</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="mt-2 max-w-measure-wide text-xs leading-relaxed text-ink-3">
                              Confidence is <strong className="font-semibold">normalised</strong> before
                              it is used: the weight of a sector is its confidence divided by the total
                              confidence across every sector tagged on this bill, so the weights always
                              sum to 1.00. Here{' '}
                              <span className="tnum">ΣC = {confidenceSum.toFixed(2)}</span>
                              {' '}across {tagCount} tag{tagCount === 1 ? '' : 's'} on this bill
                              {tagCount === 1 && (
                                <>
                                  , so the weight is 1.00 and the confidence column cancels out — it
                                  does not affect this score at all
                                </>
                              )}
                              . Multiply the D column by the weight column to get the contribution, and
                              add the contributions to get the {Math.round(o.score * 100)}% above.
                            </p>
                          </div>

                          {profile && (
                            <div>
                              <div className="label mb-1.5">
                                Everything this member reported, cycle {profile.cycle}
                              </div>
                              <IndustryBars rows={profile.byIndustry.slice(0, 10)} />
                              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                                {usd(profile.unresolvedAmount)} ({(profile.unclassifiedShare * 100).toFixed(1)}% of the
                                total) could not be put in any sector, and is left out of the number above.
                                {profile.nonEmployerAmount > 0 && <> Another {usd(profile.nonEmployerAmount)} came from filings with no employer written on them.</>}
                              </p>
                            </div>
                          )}

                          <div>
                            <div className="label mb-1">Exact formula</div>
                            <p className="mono text-2xs leading-relaxed text-ink-3">{o.method.formula}</p>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {isQuick && overlaps.length > shownOverlaps.length && (
              <div className="mt-4">
                <button type="button" onClick={() => setView('full')} className="btn">
                  Show all {overlaps.length} members
                </button>
                <p className="mt-1.5 text-xs text-ink-3">
                  This opens the full detail view, with every table on this page open.
                </p>
              </div>
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
            <div className="label mb-2">In short</div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Kind</dt>
                <dd className="text-right text-ink-1">{isResolution ? 'Resolution' : 'Bill'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Industries tagged</dt>
                <dd className="tnum text-ink-1">{classification?.industries.length ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Members with an overlap</dt>
                <dd className="tnum text-ink-1">{overlaps.length}</dd>
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

          <div className="card p-4">
            <div className="label mb-2">What this page cannot tell you</div>
            <p className="text-xs leading-relaxed text-ink-2">
              It sees only money that was reported to the FEC. It cannot see dark money, lobbying
              spending, or a job offer after someone leaves office.{' '}
              <Link className="link" to="/limitations">The full list of gaps →</Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
