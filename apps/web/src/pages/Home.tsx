/**
 * The front door.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PAGE IS FOR, AND WHO IT IS FOR
 *
 * It used to open with a headline, three paragraphs of careful prose, and two
 * columns of qualifications — a good page for someone being paid to read it.
 * Most visitors are not. They arrive with one of three questions:
 *
 *     "who funds my representative?"   "what is in this bill?"   "who pays for
 *                                                                 my industry?"
 *
 * So the page now leads with those three questions as three doors, and with the
 * search box. Everything that was here before is still here — the selection
 * rule, the coverage notes, the long disclaimer, the "what this does not show"
 * list — but folded, below, and reachable in one tap.
 *
 * Folding is not deleting. If you find yourself removing a caveat to make this
 * page shorter, stop: fold it instead.
 * ---------------------------------------------------------------------------
 */

import { Link } from 'react-router-dom';
import { INDUSTRY_BY_ID, PROJECT_TAGLINE, plainAmount, usd } from '@ftm/core';
import { getBills, getFeaturedSet, getIndex, getLegislators } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useViewMode } from '../lib/view';
import { CoverageNote, LongDisclaimer, OverlapScore } from '../components/Framing';
import { ErrorState, IndustryChip, Loading, MemberAvatar, SectionTitle, Stat } from '../components/ui';
import { GlobalSearch } from '../components/GlobalSearch';
import { Fold } from '../components/ViewToggle';

/** One of the three doors. A whole card is the target, not a link inside it. */
function EntryCard({
  to, title, line, icon,
}: { to: string; title: string; line: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="entry-card group relative">
      {/* The arrow is positioned, not inline: inline it wraps onto a line of
          its own whenever the title breaks, which on a narrow column is most
          of the time. */}
      <svg
        aria-hidden className="entry-arrow absolute right-3 top-3.5 text-accent" width="13" height="13"
        viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
      >
        <path d="M2 6h7M6 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex items-start gap-3 pr-5">
        <span aria-hidden className="mt-0.5 shrink-0 text-accent">{icon}</span>
        <span className="min-w-0">
          <span className="block text-md font-semibold leading-snug text-ink-0 group-hover:text-accent">
            {title}
          </span>
          <span className="mt-1 block text-sm leading-snug text-ink-2">{line}</span>
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  const index = useAsync(getIndex, []);
  const bills = useAsync(getBills, []);
  const legislators = useAsync(getLegislators, []);
  const featured = useAsync(getFeaturedSet, []);
  const { isQuick } = useViewMode();

  if (index.error) return <ErrorState error={index.error} />;
  if (!index.data) {
    return (
      <div className="mx-auto max-w-content px-4">
        <Loading what="the data files for this site" />
      </div>
    );
  }

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
  const allFeatured = (featured.data?.rows ?? []).filter(
    (o) => billById.has(o.billId) && legByBio.has(o.bioguideId),
  );
  const topOverlaps = allFeatured.slice(0, isQuick ? 3 : 6);

  // The pipeline's own words, rendered verbatim. Null on a fallback bundle, and
  // the copy below then says there was no rule rather than inventing one.
  const featureNote = featured.data?.note ?? null;
  const listLoading = featured.loading;

  const recentBills = (bills.data ?? []).filter((b) => b.industries.length > 0).slice(0, isQuick ? 5 : 8);

  return (
    <div className="mx-auto max-w-content px-4 pb-14">
      {/* ---- hero: the three questions, then the search box ---------------
          The old hero spent its first screen on prose. A reader who skims for
          twenty seconds should be able to leave this page having done the thing
          they came for, so the doors come first and the explanation follows. */}
      <section className="grid gap-6 border-b border-line py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,1fr)] lg:gap-x-12 lg:gap-y-8">
        <div className="lg:col-start-1 lg:row-start-1">
          <h1 className="serif text-2xl leading-[1.12] text-ink-0 sm:text-3xl">
            Who gives money to Congress, and what Congress works on.
          </h1>
          <p className="mt-3 max-w-measure text-md leading-relaxed text-ink-2">
            Both lists are public. This site puts them next to each other. Every number links to the
            government filing it came from.
          </p>

          <div className="mt-5 max-w-xl">
            <GlobalSearch />
            <p className="mt-2 text-xs text-ink-3">
              Try a last name, a bill number, or a sector. Searching happens on your device. Nothing
              you type is sent anywhere.
            </p>
          </div>

        {/* ---- the three doors --------------------------------------------
            A whole card is the target. Three questions, three destinations, one
            plain sentence each. This is the part of the page that has to work
            for someone who will not read a paragraph, so on a phone it comes
            before every figure on the page. */}
        <div className="mt-7">
          <h2 className="sr-only">Where to start</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <EntryCard
              to="/reps"
              title="Look up my representative"
              line="Type a name, or an address, and see who funded them."
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="10" cy="7" r="3.2" />
                  <path d="M4 16.5c1.2-2.6 3.4-4 6-4s4.8 1.4 6 4" strokeLinecap="round" />
                </svg>
              }
            />
            <EntryCard
              to="/bills"
              title="Browse bills"
              line="See what a bill does, in plain words, and who worked on it."
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M5 3h7l3 3v11H5z" strokeLinejoin="round" />
                  <path d="M7.5 9h5M7.5 12h5" strokeLinecap="round" />
                </svg>
              }
            />
            <EntryCard
              to="/industries"
              title="Follow a sector"
              line="Pick an industry and see the money and the bills it touches."
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 16.5h14" strokeLinecap="round" />
                  <path d="M5.5 16.5v-5M10 16.5v-9M14.5 16.5v-3" strokeLinecap="round" />
                </svg>
              }
            />
          </div>

          {/* ---- the fourth door ------------------------------------------
              A reader told us plainly: "I am not able to learn anything or
              derive any conclusion from it", and then "explain me how to read
              it". The three doors above answer "where do I go"; none of them
              answered "what am I looking at once I get there", and a reader who
              cannot answer that leaves regardless of how good the data is.

              So the guide is a door too, and it sits with the other three
              rather than in the footer — the same <EntryCard/>, one row down so
              the three original doors keep their grid. It is deliberately not
              dressed up as a notice or a callout: a first-time visitor should be
              able to pick it as easily as any other starting point. */}
          {/* The fifth door is the committee comparisons, and it is a door for
              the same reason the guide is. The three doors above all land a
              reader on ONE member or ONE bill, and at that resolution there is
              almost nothing to learn — one member's share of one sector is a
              number with a sample size of one. The committee view is the only
              place on this site where a comparison has a sample size, so a
              reader who wants to learn something needs to be able to find it
              from the front page rather than from the nav bar alone. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <EntryCard
              to="/how-to-read"
              title="New here? Start with how to read this"
              line="What the numbers mean, what a big number does not mean, and what you can fairly conclude."
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="10" cy="10" r="7.2" />
                  <path d="M8 7.8a2 2 0 1 1 2.6 1.9c-.4.15-.6.5-.6.95v.6" strokeLinecap="round" />
                  <path d="M10 14.2v.1" strokeLinecap="round" />
                </svg>
              }
            />
            <EntryCard
              to="/patterns"
              title="Compare a committee with everyone else"
              line="Every committee was tested against every sector. See the few gaps that survived every check."
              icon={
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="6" cy="6.5" r="1.6" />
                  <circle cx="11" cy="6.5" r="1.6" />
                  <circle cx="15.5" cy="6.5" r="1.6" />
                  <circle cx="4.5" cy="13.5" r="1.6" />
                  <circle cx="8" cy="13.5" r="1.6" />
                  <path d="M2.5 10h15" strokeLinecap="round" />
                </svg>
              }
            />
          </div>
        </div>
        </div>
        {/* Last in the DOM, and last on a phone: a reader who has not chosen
            where to go yet is not helped by four totals. On a wide screen grid
            placement lifts it into the right column beside them — placement,
            not `order`, so reading order and focus order never disagree. */}
        <div className="card-data self-start p-4 sm:p-5 lg:col-start-2 lg:row-start-1">
          <h2 className="label mb-3 border-b border-line pb-2">What is in this data</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-1">
            <Stat
              label="Members of Congress"
              value={idx.counts.legislators?.toLocaleString() ?? '—'}
              sub="Everyone in the House and Senate right now."
            />
            <Stat
              label="Bills"
              value={idx.counts.bills?.toLocaleString() ?? '—'}
              sub={`Bills from the ${idx.congress}th Congress — the one sitting now.`}
            />
            <Stat
              label="Money reported"
              value={plainAmount(idx.counts.contributionDollars ?? 0)}
              // The exact wording comes from the bundle, because what this
              // figure covers depends on whether the pipeline ran with an
              // OpenFEC key. Hardcoding "itemized hard money" described a
              // dataset that, without a key, contains only committee money.
              sub={
                <>
                  Only money reported to the government. Exact figure{' '}
                  <span className="tnum">{usd(idx.counts.contributionDollars ?? 0)}</span>, FEC cycle{' '}
                  {idx.cycle} · {idx.moneyLabel ?? 'disclosed FEC contributions'}.
                </>
              }
            />
            <Stat
              label="Federal awards"
              value={idx.counts.awards?.toLocaleString() ?? '—'}
              sub="Government contracts and grants. Background only — not linked to any donation."
            />
          </div>
        </div>
      </section>

      {/* ---- what this shows / does not show ------------------------------
          Short lines, one claim each. These are the two lists a reader has to
          be able to hold in their head, so they are the only prose above the
          folds. */}
      <section className="grid gap-6 border-b border-line py-7 md:grid-cols-2">
        <div>
          <SectionTitle>What you can see here</SectionTitle>
          <ul className="space-y-1.5 text-base leading-snug text-ink-2">
            <li>· Which industries the money reported to a member came from, and how much.</li>
            <li>· Which industries a bill would affect, and why we think so.</li>
            <li>· Where those two lists match.</li>
            <li>· A link to the government filing behind every number.</li>
          </ul>
        </div>
        <div>
          <SectionTitle>What you cannot</SectionTitle>
          <ul className="space-y-1.5 text-base leading-snug text-ink-2">
            <li>· Proof that money changed a vote. This site never claims that.</li>
            <li>· Money that was never reported, like dark money.</li>
            <li>· A judgement about any person, party, industry or bill.</li>
            <li>· A reason to skip reading the bill.</li>
          </ul>
        </div>
      </section>

      {/* ---- pairs worth a look ------------------------------------------- */}
      <section className="py-7">
        <SectionTitle note={<Link className="link" to="/bills">All bills →</Link>}>
          A few pairs worth a look
        </SectionTitle>
        <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
          In each pair, the industries a member's reported money came from are also industries the
          bill would affect. That is often completely ordinary: members work on the industries in
          their own area. Read these as questions, not answers.
        </p>

        {listLoading ? (
          <Loading what="the list of member and bill pairs" rows={3} />
        ) : topOverlaps.length === 0 ? (
          <CoverageNote>
            No pairs have been worked out yet. That happens when bills are loaded but campaign money
            is not, or when no bill in the data has an industry tag. Run{' '}
            <code className="mono">npm run pipeline</code> from the repository root to fill this in.
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
                    <OverlapScore score={o.score} size="sm" showExplainer={false} plain={isQuick} />
                  </div>
                  {o.matches[0] && (
                    <p className="mt-2 text-xs text-ink-3">
                      Biggest shared industry:{' '}
                      <Link className="link" to={`/industries/${o.matches[0].industry}`}>
                        {INDUSTRY_BY_ID[o.matches[0].industry]?.label ?? o.matches[0].industry}
                      </Link>{' '}
                      · {plainAmount(o.matches[0].donorAmount)} disclosed
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* The selection rule, stated where the selection is shown. It is
            folded rather than dropped: a reader who wants to know why these six
            is one tap away, and a reader who does not is not made to read it
            before they can see anything. */}
        <Fold
          className="mt-4"
          open={!isQuick}
          title="How these were picked (and why it is not a ranking)"
        >
          <div className="max-w-measure-wide text-sm leading-relaxed text-ink-2">
            {featureNote ? (
              <p>{featureNote}</p>
            ) : (
              <p>
                This data bundle has no picked set, so the list above is simply the highest raw
                scores in <code className="mono">overlaps.json</code>. A raw score favours members
                with a small reported total, and can show the same bill several times.
              </p>
            )}
            <p className="mt-2">
              <strong className="font-semibold">This is not a ranking of members.</strong> No member
              is being compared with any other. The order means nothing beyond the rule above, and a
              member who is not on this list has not been cleared of anything — most of the data is
              simply not on this page.{' '}
              <Link className="link" to="/methodology">How the number is built →</Link>
            </p>
          </div>
        </Fold>
      </section>

      {/* ---- recent bills ------------------------------------------------ */}
      <section className="border-t border-line py-7">
        <SectionTitle note={<Link className="link" to="/bills">Browse and filter →</Link>}>
          Bills with recent activity
        </SectionTitle>
        {bills.loading ? (
          <Loading what="the list of bills" rows={4} />
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
                        title={`This tool tagged the bill ${INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}, and is ${Math.round(i.confidence * 100)}% sure of that tag. It is not an overlap score.`}
                      >
                        {/* One flex child, not two: a chip whose label wraps would
                            otherwise strand the number at the far right of the
                            wrapped box instead of keeping it in the text flow. */}
                        <span>
                          tagged {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}{' '}
                          <span className="tnum text-ink-4">· {Math.round(i.confidence * 100)}% sure</span>
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
      <section className="border-t border-line py-7">
        <SectionTitle note={<Link className="link" to="/industries">All sectors →</Link>}>Pick a sector</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(INDUSTRY_BY_ID)
            .filter((i) => i.id !== 'other')
            .map((i) => <IndustryChip key={i.id} id={i.id} />)}
        </div>
      </section>

      {/* ---- the parts that need more than a sentence ---------------------
          Below the fold, and folded. Nothing here has been shortened; it has
          been moved to where a reader goes looking for it rather than where it
          blocks the thing they came for. */}
      <section className="border-t border-line py-7">
        <SectionTitle>Before you draw a conclusion</SectionTitle>

        <Fold
          open={!isQuick}
          title="What is missing from this data"
          note={`${idx.coverageNotes.length} note${idx.coverageNotes.length === 1 ? '' : 's'}`}
        >
          <div className="space-y-2">
            {idx.coverageNotes.map((n, i) => (
              <CoverageNote key={i}>{n}</CoverageNote>
            ))}
            <p className="text-xs text-ink-3">
              Data built {new Date(idx.generatedAt).toLocaleString()} · sources: FEC {idx.sources.openfec},
              Congress {idx.sources.congress}, tagging {idx.sources.classification}.{' '}
              <Link className="link" to="/limitations">The full list of gaps →</Link>
            </p>
          </div>
        </Fold>

        <Fold open={!isQuick} title="The longer version of the warning above">
          <div className="max-w-3xl">
            <LongDisclaimer />
          </div>
        </Fold>

        <Fold open={!isQuick} title="Words used on this site">
          <dl className="max-w-measure space-y-2 text-sm leading-relaxed text-ink-2">
            <div>
              <dt className="font-semibold text-ink-1">Disclosed</dt>
              <dd>Reported to the government and published. Money nobody reported cannot show up here.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-1">Sector</dt>
              <dd>A rough group of employers, like “Banking &amp; Finance”. These groups are built from what donors write on their own filings, so they are approximate — and a sector is a label on a donor, never an entity that gave anything. Companies cannot give to federal candidates at all.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-1">Overlap</dt>
              <dd>How much of a member’s reported money came from industries a bill would affect. It is a share of money, nothing more.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-1">Cycle</dt>
              <dd>The two-year run-up to an election. Campaign money is reported one cycle at a time.</dd>
            </div>
          </dl>
        </Fold>

        <p className="mt-4 text-sm text-ink-3">{PROJECT_TAGLINE}</p>
      </section>
    </div>
  );
}
