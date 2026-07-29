import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { INDUSTRY_BY_ID, describeOverlap, shortDate, usd } from '@ftm/core';
import { getBillDetail, getLegislators } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { CoverageNote, InlineDisclaimer, OverlapScore, SourceLink } from '../components/Framing';
import { Empty, ErrorState, IndustryBars, Loading, MemberAvatar, MethodTag, PartyTag, SectionTitle } from '../components/ui';
import { ShareCardButton } from '../components/ShareCard';

export default function BillDetail() {
  const { id = '' } = useParams();
  const { data, error, loading } = useAsync(() => getBillDetail(id), [id]);
  const { data: legislators } = useAsync(getLegislators, []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const legByBio = useMemo(() => new Map((legislators ?? []).map((l) => [l.bioguideId, l])), [legislators]);

  const label = useMemo(() => {
    if (!data) return '';
    return `${data.bill.billType.toUpperCase()} ${data.bill.billNumber}`;
  }, [data]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <div className="mx-auto max-w-content px-4"><Loading what="this bill" /></div>;

  const { bill, classification, overlaps, votes } = data;
  const isKeywordOnly = classification?.method === 'keyword-fallback';

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

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <nav className="text-xs text-ink-4">
        <Link className="link" to="/bills">Bills</Link> <span aria-hidden>/</span> <span className="mono">{label}</span>
      </nav>

      <header className="mt-2">
        <h1 className="serif max-w-4xl text-2xl leading-snug text-ink-0">{bill.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-4">
          <span className="mono">{label} · {bill.congress}th Congress</span>
          {bill.introducedDate && <span>Introduced {shortDate(bill.introducedDate)}</span>}
          {bill.latestActionDate && <span>Last action {shortDate(bill.latestActionDate)}</span>}
          {bill.policyArea && <span>· {bill.policyArea}</span>}
          <SourceLink href={bill.congressDotGovUrl}>Read it on Congress.gov</SourceLink>
        </div>
        {bill.latestActionText && (
          <p className="mt-2 max-w-measure-wide text-sm leading-relaxed text-ink-3">{bill.latestActionText}</p>
        )}
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          {/* ---- plain-English summary ---------------------------------- */}
          <section>
            <SectionTitle note={<MethodTag method={classification?.method} />}>What this bill does</SectionTitle>
            {classification ? (
              <>
                <div className="space-y-2 text-base leading-relaxed text-ink-1">
                  {classification.plainSummary.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
                {classification.method === 'llm' && (
                  <p className="mt-2 text-xs text-ink-4">
                    Paraphrased by {classification.model} from the official summary. Machine-generated
                    and may be wrong or incomplete — the authoritative text is{' '}
                    <SourceLink href={bill.congressDotGovUrl}>the bill itself</SourceLink>.
                  </p>
                )}
              </>
            ) : (
              <Empty>No summary has been generated for this bill yet.</Empty>
            )}
          </section>

          {/* ---- sector tags -------------------------------------------- */}
          <section>
            <SectionTitle>Sectors this bill would affect</SectionTitle>
            {!classification || classification.industries.length === 0 ? (
              <CoverageNote>
                No sector was identified for this bill. For ceremonial resolutions, naming bills and
                internal procedural measures this is the correct answer, and no overlap is computed.
              </CoverageNote>
            ) : (
              <ul className="space-y-2.5">
                {classification.industries.map((i) => (
                  <li key={i.industry} className="card p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link to={`/industries/${i.industry}`} className="tap-24 text-base font-medium text-ink-0 hover:text-accent">
                        {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}
                      </Link>
                      <span className="tnum text-xs text-ink-4">
                        classifier confidence {Math.round(i.confidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink-3">{i.rationale}</p>
                  </li>
                ))}
              </ul>
            )}
            {isKeywordOnly && (
              <CoverageNote>
                These tags came from Library of Congress metadata and keyword matching, not from a
                language model reading the bill. They are rougher than the LLM path. Set{' '}
                <code className="mono">LLM_PROVIDER</code> in your <code className="mono">.env</code>{' '}
                and re-run <code className="mono">npm run classify</code> to improve them.
              </CoverageNote>
            )}
          </section>

          {/* ---- the overlap -------------------------------------------- */}
          <section>
            <SectionTitle note={`${overlaps.length} member${overlaps.length === 1 ? '' : 's'}`}>
              Members involved, and who funded them
            </SectionTitle>
            <InlineDisclaimer className="mb-4" />

            {overlaps.length === 0 ? (
              <Empty>
                No member on this bill has campaign-finance data linked in the current dataset.
              </Empty>
            ) : (
              <ul className="space-y-3">
                {overlaps.map((o) => {
                  const key = o.bioguideId;
                  const isOpen = expanded === key;
                  const profile = o.donorProfile;
                  return (
                    <li key={key} className="card p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <MemberAvatar src={o.member?.imageUrl} name={o.member?.name ?? o.bioguideId} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={`/reps/${o.bioguideId}`} className="tap-24 text-base font-medium text-ink-0 hover:text-accent">
                              {o.member?.name ?? o.bioguideId}
                            </Link>
                            <span className="chip">{o.member?.role ?? 'Involved'}</span>
                          </div>
                          <div className="text-xs text-ink-4">
                            {o.member?.chamber === 'Senate' ? 'Sen.' : 'Rep.'} · {o.member?.state}
                            {o.member?.district ? `-${o.member.district}` : ''}
                            {profile && <> · {usd(profile.totalItemized, { compact: true })} disclosed, cycle {profile.cycle}</>}
                          </div>
                        </div>
                        <div className="w-full sm:w-56">
                          <OverlapScore score={o.score} size="md" showExplainer={false} />
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-ink-2">
                        {describeOverlap(o, o.member?.name ?? 'this member', label)}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : key)}
                          className="btn px-2.5 py-1 text-xs"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? 'Hide the breakdown' : 'Show how this number was built'}
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

                      {isOpen && (
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
                            <div className="label mb-1.5">Shared sectors, and what each contributed to the score</div>
                            <div className="scroll-x -mx-1 px-1">
                              <table className="w-full min-w-[30rem] text-sm">
                                <thead>
                                  <tr className="text-left text-2xs uppercase tracking-wide text-ink-4">
                                    <th className="pb-1 font-semibold">Sector</th>
                                    <th className="pb-1 text-right font-semibold">Disclosed to member</th>
                                    <th className="pb-1 text-right font-semibold">Share of their money <span className="normal-case">(D)</span></th>
                                    <th className="pb-1 text-right font-semibold">Classifier confidence <span className="normal-case">(C)</span></th>
                                    <th className="pb-1 text-right font-semibold">Weight <span className="normal-case">(C ÷ ΣC)</span></th>
                                    <th className="pb-1 text-right font-semibold">Contribution <span className="normal-case">(D × weight)</span></th>
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
                              <div className="label mb-1.5">Their full disclosed donor breakdown, cycle {profile.cycle}</div>
                              <IndustryBars rows={profile.byIndustry.slice(0, 10)} />
                              <p className="mt-2 text-xs leading-relaxed text-ink-4">
                                {usd(profile.unresolvedAmount)} ({(profile.unclassifiedShare * 100).toFixed(1)}% of the
                                total) could not be attributed to any sector and is excluded from the score above.
                                {profile.nonEmployerAmount > 0 && <> A further {usd(profile.nonEmployerAmount)} came from filings with no employer listed.</>}
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
          </section>

          {/* ---- votes --------------------------------------------------- */}
          {votes.length > 0 && (
            <section>
              <SectionTitle>Roll-call votes on this bill</SectionTitle>
              <ul className="divide-y divide-line">
                {votes.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                    <span className="text-ink-2">{v.question}</span>
                    <span className="text-ink-4">
                      {shortDate(v.date)} · {v.result} · {v.positions} positions recorded{' '}
                      <SourceLink href={v.sourceUrl}>Clerk record</SourceLink>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ---- sidebar ------------------------------------------------- */}
        <aside className="space-y-6">
          <div className="card p-4">
            <div className="label mb-2">Committees of jurisdiction</div>
            {bill.committeeNames.length === 0 ? (
              <p className="text-sm text-ink-4">None recorded.</p>
            ) : (
              <ul className="space-y-1 text-sm text-ink-2">
                {bill.committeeNames.map((c) => <li key={c}>{c}</li>)}
              </ul>
            )}
          </div>

          {bill.subjects.length > 0 && (
            <div className="card p-4">
              <div className="label mb-2">Library of Congress subject terms</div>
              <div className="flex flex-wrap gap-1.5">
                {bill.subjects.slice(0, 18).map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-ink-4">
                Assigned by Library of Congress staff, not by this tool. They are a major input to the
                sector tags on the left.
              </p>
            </div>
          )}

          {bill.officialSummary && (
            <div className="card p-4">
              <div className="label mb-2">Official CRS summary</div>
              <p className="max-h-64 overflow-auto text-xs leading-relaxed text-ink-3">{bill.officialSummary}</p>
              <p className="mt-2 text-2xs text-ink-4">Public-domain text from the Congressional Research Service.</p>
            </div>
          )}

          <div className="card p-4">
            <div className="label mb-2">Provenance</div>
            <ul className="space-y-1.5 text-xs text-ink-3">
              <li><SourceLink href={bill.congressDotGovUrl}>congress.gov record</SourceLink></li>
              <li><SourceLink href={bill.sourceUrl}>machine-readable source</SourceLink></li>
              <li>Fetched {shortDate(bill.fetchedAt)}</li>
              {bill.sponsorBioguideId && (
                <li>
                  Sponsor{' '}
                  <Link className="link" to={`/reps/${bill.sponsorBioguideId}`}>
                    {legByBio.get(bill.sponsorBioguideId)?.name ?? bill.sponsorBioguideId}
                  </Link>{' '}
                  <PartyTag party={legByBio.get(bill.sponsorBioguideId)?.party} />
                </li>
              )}
              <li>{bill.cosponsorBioguideIds.length} cosponsors</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
