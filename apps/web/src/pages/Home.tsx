import { Link } from 'react-router-dom';
import { INDUSTRY_BY_ID, PROJECT_TAGLINE, usd } from '@ftm/core';
import { getBills, getFeaturedSet, getIndex, getLegislators } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { CoverageNote, LongDisclaimer, OverlapScore } from '../components/Framing';
import { ErrorState, IndustryChip, Loading, MemberAvatar, SectionTitle, Stat } from '../components/ui';
import { GlobalSearch } from '../components/GlobalSearch';

export default function Home() {
  const index = useAsync(getIndex, []);
  const bills = useAsync(getBills, []);
  const legislators = useAsync(getLegislators, []);
  const featured = useAsync(getFeaturedSet, []);

  if (index.error) return <ErrorState error={index.error} />;
  if (!index.data) return <div className="mx-auto max-w-content px-4"><Loading what="the dataset" /></div>;

  const idx = index.data;
  const legByBio = new Map((legislators.data ?? []).map((l) => [l.bioguideId, l]));
  const billById = new Map((bills.data ?? []).map((b) => [b.id, b]));

  /* ---- the featured set ------------------------------------------------
     This list used to be `overlaps.json.slice(0, 6)` — the six highest raw
     scores, with no diversification. That surfaced small-denominator artefacts
     (a member with a tiny disclosed total scores high off a single cheque) and
     the same bill six times, and it read to a first-time visitor as a ranking
     of who is worst.

     The export now writes `featured.json`: the same row shape, already filtered
     and de-duplicated, carrying a `featureNote` that states the rule it used.
     We render that note verbatim next to the list rather than paraphrasing it,
     so the rule the reader is told is the rule that was actually applied.

     `featured.json` is optional. An older bundle will not have it, in which case
     `getFeaturedSet()` falls back to the raw overlap list — degraded, but working,
     and labelled as unfiltered below rather than passed off as a curated set.  */
  const topOverlaps = (featured.data?.rows ?? [])
    .filter((o) => billById.has(o.billId) && legByBio.has(o.bioguideId))
    .slice(0, 6);

  // The pipeline's own words, rendered verbatim. Null on a fallback bundle, and
  // the copy below then says there was no rule rather than inventing one.
  const featureNote = featured.data?.note ?? null;

  const listLoading = featured.loading;

  const recentBills = (bills.data ?? []).filter((b) => b.industries.length > 0).slice(0, 8);

  return (
    <div className="mx-auto max-w-content px-4 pb-14">
      {/* ---- hero --------------------------------------------------------
          Two columns from lg up. The old single-column hero capped its prose at
          max-w-2xl inside a 72rem container, which left the right 40% of a
          1440px screen empty while the four headline figures were stretched
          thin across the full width below it. Pulling the figures into that gap
          fills it with the thing the site is actually about — the data — rather
          than with an illustration, and gives each figure enough width for its
          qualifier to sit on one or two lines instead of four.               */}
      <section className="grid gap-8 border-b border-line py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,1fr)] lg:gap-12">
        <div>
          <h1 className="serif text-2xl leading-[1.12] text-ink-0 sm:text-3xl">
            Public money records and public legislative records, side by side.
          </h1>
          <p className="mt-3 max-w-measure-wide text-base leading-relaxed text-ink-2">
            Every figure here comes from a government filing you can open yourself. This tool does one
            thing: it puts the money next to the legislation and shows you where they touch.{' '}
            <strong className="font-semibold">It does not tell you why anyone voted the way they did,
            because it cannot know.</strong>
          </p>

          <div className="mt-6 max-w-xl">
            <GlobalSearch />
            <p className="mt-2 text-xs text-ink-4">
              Try a surname, a bill number, a sector, or a federal contractor. Everything is searched
              locally in your browser — no query leaves this device.
            </p>
          </div>
        </div>

        <div className="card-data self-start p-4 sm:p-5">
          <h2 className="label mb-3 border-b border-line pb-2">In this bundle</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-1">
            <Stat label="Members tracked" value={idx.counts.legislators?.toLocaleString() ?? '—'} sub="Current House and Senate" />
            <Stat label="Bills" value={idx.counts.bills?.toLocaleString() ?? '—'} sub={`${idx.congress}th Congress`} />
            <Stat
              label="Disclosed contributions"
              value={usd(idx.counts.contributionDollars ?? 0, { compact: true })}
              // The exact wording comes from the bundle, because what this
              // figure covers depends on whether the pipeline ran with an
              // OpenFEC key. Hardcoding "itemized hard money" described a
              // dataset that, without a key, contains only committee money.
              sub={`FEC cycle ${idx.cycle} · ${idx.moneyLabel ?? 'disclosed FEC contributions'}`}
            />
            <Stat label="Federal awards" value={idx.counts.awards?.toLocaleString() ?? '—'} sub="Contracts and grants, as context" />
          </div>
        </div>
      </section>

      {/* ---- what this is / is not --------------------------------------- */}
      <section className="grid gap-6 border-b border-line py-8 md:grid-cols-2">
        <div>
          <SectionTitle>What this shows</SectionTitle>
          <ul className="space-y-2 text-base leading-relaxed text-ink-2">
            <li>· Which sectors gave disclosed money to a member of Congress, and how much.</li>
            <li>· Which sectors a bill would plausibly affect, and why the tool thinks so.</li>
            <li>· Where those two lists overlap — expressed as a share of disclosed money.</li>
            <li>· A link to the primary government filing behind every single number.</li>
          </ul>
        </div>
        <div>
          <SectionTitle>What it does not show</SectionTitle>
          <ul className="space-y-2 text-base leading-relaxed text-ink-2">
            <li>· Any claim that a contribution caused a vote, a bill, or an outcome.</li>
            <li>· Undisclosed money, dark money, or 501(c)(4) spending — all invisible here.</li>
            <li>· A judgement about any member, party, sector, or bill.</li>
            <li>· A substitute for reading the bill, or for actual investigative journalism.</li>
          </ul>
        </div>
      </section>

      {/* ---- largest overlaps -------------------------------------------- */}
      <section className="py-8">
        <SectionTitle note={<Link className="link" to="/bills">All bills →</Link>}>
          A few member–bill pairs worth a closer look
        </SectionTitle>
        <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-3">
          Each of these is a pair where the sectors that funded a member overlap with the sectors a
          bill would affect. A high number here is <em>common and often entirely ordinary</em> —
          members seek committees relevant to their districts, and the industries in a district fund
          its representative. Read these as questions, not findings.
        </p>

        {/* The selection rule, stated where the selection is shown.
            featureNote is the export's own sentence, rendered verbatim; the line
            under it is this page saying plainly what the list is not, because a
            grid of faces and percentages reads as a leaderboard unless it is
            told otherwise. */}
        <div className="mb-4 max-w-measure-wide border-l-2 border-accent-line pl-2.5 text-xs leading-relaxed text-ink-3">
          {featureNote ? (
            <p>
              <span className="font-semibold text-ink-2">How these were chosen:</span> {featureNote}
            </p>
          ) : (
            <p>
              <span className="font-semibold text-ink-2">How these were chosen:</span> this bundle has
              no curated selection, so the list below is simply the highest raw scores in{' '}
              <code className="mono">overlaps.json</code>. Raw score alone favours members with a small
              disclosed total, and can show the same bill several times over.
            </p>
          )}
          <p className="mt-1.5">
            <strong className="font-semibold text-ink-2">This is not a ranking of members.</strong>{' '}
            No member is being compared with any other, the order carries no meaning beyond the rule
            stated above, and a member not appearing here has not been cleared of anything — most of
            the dataset simply is not on this page.{' '}
            <Link className="link" to="/methodology">How the score is built →</Link>
          </p>
        </div>

        {listLoading ? (
          <Loading what="overlaps" />
        ) : topOverlaps.length === 0 ? (
          <CoverageNote>
            No overlaps computed yet. That happens when bills have been ingested but campaign-finance
            data has not, or when no bill in the dataset has an identified sector. Run{' '}
            <code className="mono">npm run pipeline</code> from the repository root.
          </CoverageNote>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {topOverlaps.map((o) => {
              const member = legByBio.get(o.bioguideId)!;
              const bill = billById.get(o.billId)!;
              return (
                <li key={`${o.billId}:${o.bioguideId}`} className="card-data p-4">
                  <div className="flex items-start gap-3">
                    <MemberAvatar src={member.imageUrl} name={member.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/reps/${member.bioguideId}`} className="tap-24 block truncate text-base font-medium text-ink-0 hover:text-accent">
                        {member.name}
                      </Link>
                      <div className="text-xs text-ink-4">
                        {member.chamber === 'Senate' ? 'Sen.' : 'Rep.'} · {member.state}
                        {member.district ? `-${member.district}` : ''}
                      </div>
                      <Link to={`/bills/${bill.id}`} className="tap-24 mt-1.5 block text-sm text-ink-2 hover:text-accent">
                        <span className="mono text-ink-4">{bill.billType.toUpperCase()} {bill.billNumber}</span>{' '}
                        {bill.title.length > 90 ? `${bill.title.slice(0, 90)}…` : bill.title}
                      </Link>
                    </div>
                  </div>
                  <div className="mt-3">
                    <OverlapScore score={o.score} size="sm" showExplainer={false} />
                  </div>
                  {o.matches[0] && (
                    <p className="mt-2 text-xs text-ink-4">
                      Largest shared sector:{' '}
                      <Link className="link" to={`/industries/${o.matches[0].industry}`}>
                        {INDUSTRY_BY_ID[o.matches[0].industry]?.label ?? o.matches[0].industry}
                      </Link>{' '}
                      · {usd(o.matches[0].donorAmount, { compact: true })} disclosed
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- recent bills ------------------------------------------------ */}
      <section className="border-t border-line py-8">
        <SectionTitle note={<Link className="link" to="/bills">Browse and filter →</Link>}>
          Recently active legislation
        </SectionTitle>
        {bills.loading ? (
          <Loading what="bills" />
        ) : (
          <ul className="rows -mx-2">
            {recentBills.map((b) => (
              <li key={b.id} className="px-2 py-2.5">
                <Link to={`/bills/${b.id}`} className="group block">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="mono text-xs text-ink-4">{b.billType.toUpperCase()} {b.billNumber}</span>
                    <span className="max-w-measure-wide text-base leading-snug text-ink-1 group-hover:text-accent">{b.title}</span>
                  </div>
                  {/* The percentage on these chips is the *classifier's* confidence
                      that the bill touches the sector. It is not an overlap score,
                      and eight inches above it "80%" means overlap score — so it
                      carries its unit rather than sitting bare. */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {b.industries.slice(0, 4).map((i) => (
                      <span
                        key={i.industry}
                        className="chip"
                        title={`This tool tagged the bill ${INDUSTRY_BY_ID[i.industry]?.label ?? i.industry} with ${Math.round(i.confidence * 100)}% classifier confidence. Not an overlap score.`}
                      >
                        {/* One flex child, not two: a chip whose label wraps would
                            otherwise strand the number at the far right of the
                            wrapped box instead of keeping it in the text flow. */}
                        <span>
                          tagged {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}{' '}
                          <span className="tnum text-ink-4">· confidence {Math.round(i.confidence * 100)}%</span>
                        </span>
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- sectors ----------------------------------------------------- */}
      <section className="border-t border-line py-8">
        <SectionTitle note={<Link className="link" to="/industries">All sectors →</Link>}>Browse by sector</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(INDUSTRY_BY_ID)
            .filter((i) => i.id !== 'other')
            .map((i) => <IndustryChip key={i.id} id={i.id} />)}
        </div>
      </section>

      {/* ---- coverage ---------------------------------------------------- */}
      <section className="border-t border-line py-8">
        <SectionTitle note={<Link className="link" to="/limitations">Full limitations →</Link>}>
          What is and is not in this dataset
        </SectionTitle>
        <div className="space-y-2">
          {idx.coverageNotes.map((n, i) => (
            <CoverageNote key={i}>{n}</CoverageNote>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-4">
          Bundle generated {new Date(idx.generatedAt).toLocaleString()} · sources:{' '}
          FEC {idx.sources.openfec}, Congress {idx.sources.congress}, classification {idx.sources.classification}.
        </p>
      </section>

      {/* ---- the long version -------------------------------------------- */}
      <section className="border-t border-line py-8">
        <SectionTitle>Read this before you draw a conclusion</SectionTitle>
        <div className="max-w-3xl">
          <LongDisclaimer />
        </div>
        <p className="mt-4 text-sm text-ink-4">{PROJECT_TAGLINE}</p>
      </section>
    </div>
  );
}
