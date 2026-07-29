/**
 * One member of Congress.
 *
 * The page is ordered by how much the reader can trust each block:
 *   1. Who they are — straight from the Congress.gov record.
 *   2. What was disclosed to the FEC — a filing, not an inference.
 *   3. What this tool computed on top of that — the overlap scores, which are
 *      fenced by the disclaimer and never rendered as a bare number.
 *   4. Federal spending in the district — context only, and labelled as such.
 *
 * ---------------------------------------------------------------------------
 * WHAT CHANGED, AND WHAT DID NOT
 *
 * The order above is right and is unchanged. What changed is that the page used
 * to open with three stat blocks, a sector bar chart, two amber coverage notes
 * and a donor table before a reader got to a single sentence they could act on.
 * There is now an "at a glance" block at the top — the total in plain words,
 * the three biggest sectors as bars, the single biggest overlap — and the rest
 * of the page folds underneath it.
 *
 * The coverage gaps (money with no employer on file, money with an employer we
 * could not place, absent roll-call votes) are NOT folded away. A short plain
 * version of the most important one sits inside the at-a-glance block, next to
 * the percentages it qualifies, because a percentage that silently excludes 15%
 * of the money is a misleading percentage. The full amber notes are one tap
 * below, in the same section as the numbers they belong to.
 * ---------------------------------------------------------------------------
 */

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  INDUSTRY_BY_ID, billLabel, describeOverlap, plainAmount, plainShare, shortDate, usd,
} from '@ftm/core';
import { getIndex, getMemberDetail } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useViewMode } from '../lib/view';
import { CoverageNote, InlineDisclaimer, OverlapScore, SourceLink } from '../components/Framing';
import { Empty, ErrorState, IndustryBars, Loading, MemberAvatar, MethodTag, PartyTag, SectionTitle, Stat } from '../components/ui';
import { ShareCardButton } from '../components/ShareCard';
import { Fold, ViewToggle } from '../components/ViewToggle';
import { Term } from '../components/Glossary';

const DONOR_KIND_LABEL: Record<string, string> = {
  committee: 'PAC / committee',
  individual: 'Individual',
};

/**
 * The three biggest sectors, as bars, with the share said in words.
 *
 * One hue, magnitude by length — same rule as everywhere else on the site. The
 * words matter more than the bar: "about a third of it" is a quantity a reader
 * can hold, and "33.4%" is one they skim past.
 */
function SectorGlance({
  rows,
}: {
  rows: { industry: string; amount: number; share: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const label = INDUSTRY_BY_ID[r.industry as keyof typeof INDUSTRY_BY_ID]?.label ?? r.industry;
        return (
          <li key={r.industry}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <Link className="text-base font-medium text-ink-1 hover:text-accent" to={`/industries/${r.industry}`}>
                {label}
              </Link>
              <span className="tnum text-sm text-ink-2">
                {plainAmount(r.amount)}{' '}
                <span className="text-xs text-ink-3">— {plainShare(r.share)}</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-sm bg-ink-7">
              <div
                className="h-full rounded-sm bg-ink-3"
                style={{ width: `${Math.max(2, (r.share / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function RepDetail() {
  const { bioguideId = '' } = useParams();
  const { data, error, loading } = useAsync(() => getMemberDetail(bioguideId), [bioguideId]);
  const { data: index } = useAsync(getIndex, []);
  const { isQuick, setView } = useViewMode();

  /**
   * Committee rows arrive one per subcommittee code, so the same full committee
   * appears several times. Collapse by name and keep any stated role.
   */
  const committees = useMemo(() => {
    const byName = new Map<string, { name: string; role?: string }>();
    for (const c of data?.member.committees ?? []) {
      const existing = byName.get(c.committeeName);
      if (!existing) byName.set(c.committeeName, { name: c.committeeName, role: c.role });
      else if (!existing.role && c.role) existing.role = c.role;
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) {
    return (
      <div className="mx-auto max-w-content px-4">
        <Loading what="this member: their money, and the bills they worked on" />
      </div>
    );
  }

  const { member, donorProfile, topDonors, overlaps, votes, districtAwards } = data;

  const isSenator = member.chamber === 'Senate';
  const districtStr = member.district === undefined ? '' : String(member.district);
  const atLarge = !isSenator && (districtStr === '' || districtStr === '0');
  const seatLine = isSenator
    ? `Senator · ${member.state}`
    : atLarge
      ? `Representative · ${member.state} at-large`
      : `Representative · ${member.state}-${districtStr}`;
  // Same string the share card and every other surface uses for this person.
  const memberSubtitle = isSenator
    ? `Sen. ${member.state}`
    : `Rep. ${member.state}${atLarge ? ' at-large' : `-${districtStr}`}`;

  const cycle = donorProfile?.cycle ?? null;
  const topOverlap = overlaps[0] ?? null;
  const topSectors = (donorProfile?.byIndustry ?? []).filter((r) => r.amount > 0).slice(0, 3);
  const shownOverlaps = isQuick ? overlaps.slice(0, 3) : overlaps;
  const shownDonors = isQuick ? topDonors.slice(0, 5) : topDonors;
  const shownAwards = isQuick ? districtAwards.slice(0, 5) : districtAwards;

  const awardTotal = districtAwards.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <nav className="text-xs text-ink-4">
        <Link className="link" to="/reps">Representatives</Link> <span aria-hidden>/</span>{' '}
        <span>{member.name}</span>
      </nav>

      {/* ---- header ------------------------------------------------------ */}
      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <MemberAvatar src={member.imageUrl} name={member.name} size={84} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="serif text-2xl leading-tight text-ink-0">{member.name}</h1>
            <PartyTag party={member.party} />
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {seatLine}
            {member.party && <> · {member.party}</>}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <SourceLink href={member.sourceUrl}>Their congress.gov page</SourceLink>
            {member.officialUrl && <SourceLink href={member.officialUrl}>Official website</SourceLink>}
            {(donorProfile?.sourceUrls ?? []).map((u, i) => (
              <SourceLink key={u} href={u}>
                FEC filings{(donorProfile?.sourceUrls.length ?? 0) > 1 ? ` (${i + 1})` : ''}
              </SourceLink>
            ))}
          </div>

          <ViewToggle className="mt-3" />
        </div>
      </header>

      {/* ---- at a glance ---------------------------------------------------
          The whole page in one block: how much, from whom, and the one bill
          where those two lists overlap most. Everything under it is detail. */}
      <section className="mt-6">
        <h2 className="sr-only">At a glance</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
          <div className="card-data p-4">
            <div className="label">Money reported to the FEC</div>
            <div className="tnum mt-1 text-2xl font-semibold leading-tight text-ink-0">
              {plainAmount(donorProfile?.totalItemized ?? 0)}
            </div>
            <p className="mt-1.5 text-sm leading-snug text-ink-2">
              {donorProfile && donorProfile.totalItemized > 0 ? (
                <>
                  Given to {member.name}’s campaign in the {donorProfile.cycle}{' '}
                  <Term k="cycle">cycle</Term> — exact figure{' '}
                  <span className="tnum">{usd(donorProfile.totalItemized)}</span>.
                </>
              ) : (
                <>No campaign money is linked to this member in this data. That is a gap in the data, not a claim that none was raised.</>
              )}
            </p>
            {donorProfile && donorProfile.unclassifiedShare > 0 && (
              <p className="mt-2 text-xs leading-snug text-ink-3">
                Of that money, {plainShare(donorProfile.unclassifiedShare)} could not be matched to
                any industry. So the shares here are a floor: the real ones are higher.
              </p>
            )}
          </div>

          <div className="card-data p-4">
            <div className="label mb-2">Where most of it came from</div>
            {topSectors.length === 0 ? (
              <p className="text-sm text-ink-2">No money here could be put in an industry.</p>
            ) : (
              <SectorGlance rows={topSectors} />
            )}
            <p className="mt-2.5 text-xs leading-snug text-ink-3">
              Industries are worked out from what donors write as their employer, so they are rough.
            </p>
          </div>

          <div className="card-data p-4">
            <div className="label mb-2">Biggest overlap with a bill</div>
            {topOverlap ? (
              <>
                <Link to={`/bills/${topOverlap.billId}`} className="tap-24 block text-sm leading-snug text-ink-1 hover:text-accent">
                  {topOverlap.bill
                    ? `${billLabel(topOverlap.bill.billType, topOverlap.bill.billNumber)} — ${topOverlap.bill.title}`
                    : topOverlap.billId}
                </Link>
                <div className="mt-2">
                  <OverlapScore score={topOverlap.score} size="sm" plain={isQuick} />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-2">
                No bill this member worked on shares an industry with their reported donors in this
                data.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-9">
          {/* ---- disclosed money ------------------------------------------ */}
          <section>
            <SectionTitle note={cycle ? `FEC cycle ${cycle}` : undefined}>
              All the money reported for this member
            </SectionTitle>

            {!donorProfile || donorProfile.totalItemized <= 0 ? (
              <Empty>
                No <Term k="itemized">itemized</Term> campaign-finance record is linked to{' '}
                {member.name} in this data. That is a gap in the data, not a statement that no money
                was raised.
              </Empty>
            ) : (
              <Fold open={!isQuick} title="Every industry, and the two gaps in the total" note={`${donorProfile.byIndustry.length} industries`}>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat
                    label="Total reported"
                    value={usd(donorProfile.totalItemized, { compact: true })}
                    sub={
                      <>
                        {/* What this figure covers depends on whether the pipeline
                            ran with an OpenFEC key, so the wording comes from the
                            bundle rather than being hardcoded here. */}
                        {index?.moneyLabel ?? 'Disclosed FEC contributions'}, cycle {donorProfile.cycle}{' '}
                        {donorProfile.sourceUrls[0] && <SourceLink href={donorProfile.sourceUrls[0]}>FEC</SourceLink>}
                      </>
                    }
                  />
                  <Stat
                    label="Put in an industry"
                    value={usd(donorProfile.totalItemized - donorProfile.unclassifiedAmount, { compact: true })}
                    sub={`${((1 - donorProfile.unclassifiedShare) * 100).toFixed(1)}% of the total`}
                  />
                  <Stat
                    label="Not placed"
                    value={usd(donorProfile.unclassifiedAmount, { compact: true })}
                    sub={`${(donorProfile.unclassifiedShare * 100).toFixed(1)}% — left out of every number below`}
                  />
                </div>

                <div className="mt-5">
                  <div className="label mb-2">By industry</div>
                  <IndustryBars rows={donorProfile.byIndustry} />
                  <p className="mt-2 text-xs leading-relaxed text-ink-3">
                    Shares are of the full reported total, so they add up to less than 100% by
                    exactly the amount we could not place.
                  </p>
                </div>

                {/* The two coverage gaps, never collapsed into one number. */}
                <div className="mt-4 space-y-2">
                  <CoverageNote>
                    <strong className="font-semibold">
                      {usd(donorProfile.nonEmployerAmount)} has no employer to sort.
                    </strong>{' '}
                    The filing lists the donor as RETIRED, SELF-EMPLOYED, NOT EMPLOYED or HOMEMAKER,
                    so there is no employer name to match to an industry. That is how the filing was
                    written, not a mistake by this tool.
                    {donorProfile.nonEmployerAmount === 0 && (
                      <> In this data that figure is zero because only committee (PAC) money is
                      here; detail on individual donors needs a free OpenFEC API key.</>
                    )}
                  </CoverageNote>

                  <CoverageNote>
                    <strong className="font-semibold">
                      {usd(donorProfile.unresolvedAmount)} could not be placed.
                    </strong>{' '}
                    There is an employer or group name on the filing, but neither the word list nor
                    the classifier could match it to an industry. That is a real gap in this tool,
                    and the reason every industry share here should be read as a floor.
                  </CoverageNote>
                </div>
              </Fold>
            )}
          </section>

          {/* ---- top donors ----------------------------------------------- */}
          <section>
            <SectionTitle note={isQuick && topDonors.length > shownDonors.length ? `${shownDonors.length} of ${topDonors.length}` : `${topDonors.length} shown`}>
              Biggest donors
            </SectionTitle>
            {topDonors.length === 0 ? (
              <Empty>
                No named donors are recorded for this member in this data. Small gifts are reported
                as a lump sum, so they never appear by name.
              </Empty>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-2xs uppercase tracking-wide text-ink-3">
                      <th className="pb-1 font-semibold">Donor</th>
                      <th className="pb-1 font-semibold">Industry</th>
                      <th className="pb-1 font-semibold">Kind</th>
                      <th className="pb-1 text-right font-semibold">Amount</th>
                      <th className="pb-1 text-right font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shownDonors.map((d, i) => (
                      <tr key={`${d.name}-${d.industry}-${i}`}>
                        <td className="py-1.5 pr-3 align-top text-ink-1">{d.name}</td>
                        <td className="py-1.5 pr-3 align-top">
                          <Link className="link" to={`/industries/${d.industry}`}>
                            {INDUSTRY_BY_ID[d.industry]?.label ?? d.industry}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3 align-top text-ink-2">
                          {d.kind === 'committee' ? <Term k="pac">PAC / committee</Term> : DONOR_KIND_LABEL[d.kind] ?? d.kind}
                        </td>
                        <td className="tnum py-1.5 pr-3 text-right align-top text-ink-1">{usd(d.amount)}</td>
                        <td className="py-1.5 text-right align-top">
                          <SourceLink href={d.sourceUrl}>FEC</SourceLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isQuick && topDonors.length > shownDonors.length && (
              <button type="button" onClick={() => setView('full')} className="btn mt-3">
                Show all {topDonors.length} donors
              </button>
            )}
            <p className="mt-2 text-xs leading-relaxed text-ink-3">
              Amounts are added up per donor, per industry, over the cycle. A donor who gives through
              more than one committee can appear more than once.
            </p>
          </section>

          {/* ---- overlap -------------------------------------------------- */}
          <section>
            <SectionTitle
              note={
                isQuick && overlaps.length > shownOverlaps.length
                  ? `${shownOverlaps.length} of ${overlaps.length}`
                  : `${overlaps.length} bill${overlaps.length === 1 ? '' : 's'}`
              }
            >
              Bills they worked on, next to their donors
            </SectionTitle>
            <InlineDisclaimer className="mb-4" plain={isQuick} />

            {overlaps.length === 0 ? (
              <Empty>
                No bill this member sponsored, cosponsored or has committee responsibility for
                shares an industry with their reported donors in this data.
              </Empty>
            ) : (
              <ul className="space-y-3">
                {shownOverlaps.map((o) => {
                  const bill = o.bill;
                  const label = bill ? billLabel(bill.billType, bill.billNumber) : o.billId;
                  const top = o.matches[0] ?? null;
                  const topLabel = top ? (INDUSTRY_BY_ID[top.industry]?.label ?? top.industry) : null;
                  /**
                   * The member's relationship to this bill.
                   *
                   * The bill record names the sponsor, so that case is certain. It
                   * does not carry the cosponsor list in the member bundle, so the
                   * other two possibilities — cosponsor, or a seat on a committee
                   * of jurisdiction — are reported as the disjunction they actually
                   * are. Picking the more eye-catching of the two would be a guess
                   * dressed as a fact, and the share card repeats this string.
                   */
                  const role =
                    bill?.sponsorBioguideId === member.bioguideId
                      ? 'Sponsor'
                      : 'Cosponsor or committee member';
                  return (
                    <li key={o.billId} className="card p-4">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <Link to={`/bills/${o.billId}`} className="tap-24 mono shrink-0 text-xs text-ink-4 hover:text-accent">
                          {label}
                        </Link>
                        <Link to={`/bills/${o.billId}`} className="tap-24 text-base leading-snug text-ink-1 hover:text-accent">
                          {bill?.title ?? 'Title not in this data'}
                        </Link>
                      </div>

                      {bill && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                          <span className="chip">{role}</span>
                          {bill.latestActionDate && <span>Last moved {shortDate(bill.latestActionDate)}</span>}
                          {!isQuick && bill.policyArea && <span>· {bill.policyArea}</span>}
                          {!isQuick && <MethodTag method={bill.classificationMethod} />}
                          <SourceLink href={bill.congressDotGovUrl}>congress.gov</SourceLink>
                        </div>
                      )}

                      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
                        <div className="min-w-0">
                          {isQuick ? (
                            topLabel && top ? (
                              <p className="text-sm leading-relaxed text-ink-2">
                                Of all the money {member.name} reported, {plainShare(o.score)} came
                                from industries this bill would affect. The biggest is{' '}
                                <Link className="link" to={`/industries/${top.industry}`}>{topLabel}</Link>{' '}
                                — {plainAmount(top.donorAmount)}.
                              </p>
                            ) : null
                          ) : (
                            <>
                              {topLabel && top && (
                                <p className="text-sm leading-relaxed text-ink-2">
                                  Largest shared sector:{' '}
                                  <Link className="link" to={`/industries/${top.industry}`}>{topLabel}</Link> —{' '}
                                  <span className="tnum">{usd(top.donorAmount, { compact: true })}</span> disclosed to
                                  this member ({(top.donorShare * 100).toFixed(1)}% of their money), against a
                                  classifier confidence of {Math.round(top.billConfidence * 100)}% that the bill
                                  affects it.
                                </p>
                              )}
                              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                                {describeOverlap(o, member.name, label)}
                              </p>
                            </>
                          )}
                          <div className="mt-3">
                            <ShareCardButton
                              finding={{
                                memberName: member.name,
                                memberSubtitle,
                                billLabel: label,
                                billTitle: bill?.title ?? '',
                                topIndustryLabel: topLabel,
                                topIndustryAmount: top?.donorAmount ?? null,
                                score: o.score,
                                cycle,
                                role,
                                totalDisclosed: donorProfile?.totalItemized ?? null,
                                classificationMethod: bill?.classificationMethod ?? null,
                              }}
                            />
                          </div>
                        </div>

                        <div className="sm:w-56">
                          <OverlapScore score={o.score} size="md" showExplainer={false} plain={isQuick} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {isQuick && overlaps.length > shownOverlaps.length && (
              <div className="mt-4">
                <button type="button" onClick={() => setView('full')} className="btn">
                  Show all {overlaps.length} bills
                </button>
              </div>
            )}
          </section>

          {/* ---- roll-call votes ------------------------------------------ */}
          <section>
            <SectionTitle note={votes.length > 0 ? `${votes.length} recorded` : undefined}>
              How they voted
            </SectionTitle>
            {votes.length === 0 ? (
              <CoverageNote>
                <strong className="font-semibold">This page cannot show any votes.</strong> Vote
                records come from Congress.gov and need a free API key, which was not set when this
                data was built. So nothing above should be read as a claim about how {member.name}{' '}
                voted on anything. Set <code className="mono">CONGRESS_API_KEY</code> in{' '}
                <code className="mono">.env</code> and re-run <code className="mono">npm run pipeline</code>{' '}
                to fill this in.
              </CoverageNote>
            ) : (
              <Fold open={!isQuick} title={`${votes.length} recorded vote${votes.length === 1 ? '' : 's'}`}>
                <p className="mb-2 text-sm text-ink-2">
                  A <Term k="rollCall">roll-call vote</Term> is one where each member is recorded by
                  name.
                </p>
                <ul className="divide-y divide-line">
                  {votes.map((v) => {
                    const o = v.billId ? overlaps.find((x) => x.billId === v.billId) : undefined;
                    const top = o?.matches[0];
                    return (
                      <li key={v.id} className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm text-ink-1">{v.question}</span>
                          <span className="chip">{v.position}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                          <span>{shortDate(v.date)}</span>
                          <span>· {v.result}</span>
                          {v.billId && <Link className="link" to={`/bills/${v.billId}`}>Bill</Link>}
                          <SourceLink href={v.sourceUrl}>Roll-call record</SourceLink>
                        </div>
                        {o && top && (
                          <div className="mt-2 sm:max-w-sm">
                            <OverlapScore score={o.score} size="sm" showExplainer={false} plain={isQuick} />
                            <p className="mt-1 text-xs text-ink-3">
                              Biggest shared industry on this bill:{' '}
                              {INDUSTRY_BY_ID[top.industry]?.label ?? top.industry}. The number does
                              not use the vote, and the vote is not explained by the number.
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Fold>
            )}
          </section>

          {/* ---- district awards ------------------------------------------ */}
          <section>
            <SectionTitle note="Background only">
              Federal money spent in {atLarge || isSenator ? member.state : `${member.state}-${districtStr}`}
            </SectionTitle>

            <CoverageNote>
              <strong className="font-semibold">This is background, not evidence.</strong> Federal
              contracts and grants are handed out by government agencies through their own process.
              Nothing on this list shows that any donation caused any award, or that this member had
              any part in it. It is here so you can see what federal money moves through the same
              area, and nothing more.
            </CoverageNote>

            {districtAwards.length === 0 ? (
              <div className="mt-3">
                <Empty>
                  No federal awards for this {isSenator ? 'state' : 'district'} are in this data. The
                  award list is capped at the largest few thousand in the country, so most districts
                  are missing.
                </Empty>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm text-ink-2">
                  {districtAwards.length} award{districtAwards.length === 1 ? '' : 's'}, worth{' '}
                  <span className="tnum">{plainAmount(awardTotal)}</span> in all. Biggest first.
                </p>
                <ul className="mt-2 divide-y divide-line">
                  {shownAwards.map((a) => (
                    <li key={a.id} className="py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm text-ink-1">{a.recipientName}</span>
                        <span className="tnum shrink-0 text-sm text-ink-1">{usd(a.amount, { compact: true })}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                        <span>{a.awardType}</span>
                        {a.awardingAgency && <span>· {a.awardingAgency}</span>}
                        <span>· {shortDate(a.actionDate)}</span>
                        <Link className="link" to={`/industries/${a.industry}`}>
                          {INDUSTRY_BY_ID[a.industry]?.label ?? a.industry}
                        </Link>
                        <SourceLink href={a.sourceUrl}>USASpending</SourceLink>
                      </div>
                    </li>
                  ))}
                </ul>
                {isQuick && districtAwards.length > shownAwards.length && (
                  <button type="button" onClick={() => setView('full')} className="btn mt-3">
                    Show all {districtAwards.length} awards
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {/* ---- sidebar ----------------------------------------------------- */}
        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label mb-2">The basics</div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Chamber</dt>
                <dd className="text-ink-1">{member.chamber}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Seat</dt>
                <dd className="text-ink-1">{atLarge && !isSenator ? `${member.state} at-large` : isSenator ? member.state : `${member.state}-${districtStr}`}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Party</dt>
                <dd className="flex items-center gap-1.5 text-ink-1">{member.party ?? '—'} <PartyTag party={member.party} /></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Committees</dt>
                <dd className="tnum text-ink-1">{committees.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Bills with an overlap</dt>
                <dd className="tnum text-ink-1">{overlaps.length}</dd>
              </div>
            </dl>
          </div>

          {committees.length > 0 && (
            <div className="card p-4">
              <Fold open={!isQuick} title="Committees they sit on" note={`${committees.length}`}>
                <p className="mb-2 text-xs text-ink-2">
                  A <Term k="committee">committee of jurisdiction</Term> handles bills on one
                  subject. Members usually ask for the ones that matter where they live.
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {committees.map((c) => (
                    <li key={c.name} className="chip">
                      {c.name}
                      {c.role && <span className="text-ink-4">{c.role}</span>}
                    </li>
                  ))}
                </ul>
              </Fold>
            </div>
          )}

          <div className="card p-4">
            <Fold open={!isQuick} title="Where these facts come from">
              <ul className="space-y-1.5 text-xs text-ink-2">
                <li><SourceLink href={member.sourceUrl}>congress.gov record</SourceLink></li>
                {member.officialUrl && <li><SourceLink href={member.officialUrl}>Official house/senate site</SourceLink></li>}
                {(donorProfile?.sourceUrls ?? []).map((u) => (
                  <li key={u}><SourceLink href={u}>FEC candidate record</SourceLink></li>
                ))}
                <li>Member record fetched {shortDate(member.fetchedAt)}</li>
                {donorProfile && <li>Donor profile built {shortDate(donorProfile.fetchedAt)}</li>}
                {member.fecCandidateIds.length > 0 && (
                  <li className="mono">FEC candidate {member.fecCandidateIds.join(', ')}</li>
                )}
                <li className="mono">bioguide {member.bioguideId}</li>
              </ul>
            </Fold>
          </div>

          <div className="card p-4">
            <div className="label mb-2">What this page cannot tell you</div>
            <p className="text-xs leading-relaxed text-ink-2">
              It sees only reported <Term k="hardMoney">hard money</Term> that was big enough to be{' '}
              <Term k="itemized">itemized</Term> in a filing. It cannot see dark money, most{' '}
              <Term k="superpac">super PAC</Term> spending, lobbying, or a job someone takes after
              leaving office.{' '}
              <Link className="link" to="/limitations">The full list of gaps →</Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
