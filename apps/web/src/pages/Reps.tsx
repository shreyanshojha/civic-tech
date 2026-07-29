/**
 * Find your representatives.
 *
 * Two ways in, and the order matters:
 *
 *  1. Name / TOWN / state / chamber. Entirely local — legislators.json is
 *     already on the device, so nothing leaves it. This is the default and it
 *     is listed first because it is the option that costs the user nothing.
 *
 *     Town search is the load-bearing part. "Which of NY-2, NY-8, NY-10, NY-12
 *     is mine?" is unanswerable from district numbers, which is what a phone
 *     user hit when the address lookup failed; she picked a senator by mistake
 *     and left. Every member ships with the towns their district offices are in
 *     (`districtPlaces`), so typing "Brooklyn" answers the question offline.
 *
 *  2. Address. This is the ONLY feature in the application that makes an
 *     outbound request. The notice explaining exactly where the address goes is
 *     rendered in the same block as the input and its headline is always
 *     visible before anything can be sent; the detail is one tap away in the
 *     same block. See lib/geocode.ts — the wording lives there, next to the
 *     code that does the sending, so the two cannot drift apart, and the
 *     comment there records why the eleven-line panel no longer sits above the
 *     input (it pushed the input itself off a 375px screen).
 */

import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { INDUSTRY_BY_ID, usd } from '@ftm/core';
import { getIndex, getLegislators, type MemberSummary } from '../lib/data';
import { useAsync, useDebounced } from '../lib/hooks';
import {
  CENSUS_LOOKUP_NOTICE, DISTRICT_LOOKUP_FALLBACK, USPS_TO_STATE_NAME, lookupDistrict,
  type DistrictMatch, type GeocodeResult,
} from '../lib/geocode';
import { matchesPlace, seatLine } from '../lib/seat';
import { CoverageNote, DataLimit, FramingNote, SourceLink } from '../components/Framing';
import { ViewToggle } from '../components/ViewToggle';
import { Term } from '../components/Glossary';
import { Empty, ErrorState, Loading, MemberAvatar, PartyTag, SectionTitle } from '../components/ui';

type SortKey = 'name' | 'money' | 'state';

function fecUrl(m: MemberSummary, cycle: number | undefined): string | null {
  const id = m.fecCandidateIds[0];
  if (!id) return null;
  return `https://www.fec.gov/data/candidate/${id}/${cycle ? `?cycle=${cycle}` : ''}`;
}

/** One member, as a row. Party is a letter, never a colour. */
function MemberRow({ m, cycle }: { m: MemberSummary; cycle?: number }) {
  const fec = fecUrl(m, cycle);
  return (
    <li className="px-2 py-3">
      <div className="flex items-start gap-3">
        <MemberAvatar src={m.imageUrl} name={m.name} size={44} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/reps/${m.bioguideId}`} className="tap-24 text-base font-medium leading-snug text-ink-0 hover:text-accent">
              {m.name}
            </Link>
            <PartyTag party={m.party} />
          </div>

          <div className="mt-0.5 text-xs text-ink-3">
            {seatLine(m)}
            {m.committees.length > 0 && <> · {m.committees.length} committee assignment{m.committees.length === 1 ? '' : 's'}</>}
          </div>

          {m.donorSummary ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="tnum font-medium text-ink-1">{usd(m.donorSummary.totalItemized, { compact: true })}</span>
                <span className="text-xs text-ink-3">reported{cycle ? `, cycle ${cycle}` : ''}</span>
                {fec && <SourceLink href={fec}>FEC filings</SourceLink>}
              </div>

              {m.donorSummary.top.length > 0 && (
                <>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {m.donorSummary.top.map((t) => (
                      <Link
                        key={t.industry}
                        to={`/industries/${t.industry}`}
                        className="chip"
                        title={INDUSTRY_BY_ID[t.industry]?.blurb}
                      >
                        {INDUSTRY_BY_ID[t.industry]?.label ?? t.industry}
                        <span className="tnum text-ink-4">{usd(t.amount, { compact: true })}</span>
                      </Link>
                    ))}
                  </div>
                  {/* This was 11px --ink-4 tucked in at the end of the chip row
                      — the smallest, faintest type on the site, carrying the
                      fact that decides how much of the row above to believe. It
                      is now the same size as the row it qualifies.

                      It is deliberately NOT given the .data-limit marker: sixty
                      amber-ruled lines down a list page would recreate exactly
                      the wallpaper this pass is removing. The marked statement
                      of the limit is made once, above the list. */}
                  {m.donorSummary.unclassifiedShare > 0 && (
                    <p className="mt-1 text-sm leading-snug text-ink-3">
                      {(m.donorSummary.unclassifiedShare * 100).toFixed(0)}% of this member’s money
                      has no industry attached.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="mt-1.5 text-xs text-ink-3">
              No campaign money is linked to this member in this data. That is a gap in the data.{' '}
              <SourceLink href={m.sourceUrl}>congress.gov record</SourceLink>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** The three seats that represent one address: the district member + two senators. */
function AddressResult({
  match, legislators, cycle,
}: { match: DistrictMatch; legislators: MemberSummary[]; cycle?: number }) {
  const inState = legislators.filter((l) => l.state === match.state);
  const house = inState.filter(
    (l) => l.chamber === 'House' && String(l.district ?? '0') === match.district,
  );
  const senators = inState.filter((l) => l.chamber === 'Senate');

  return (
    <div className="mt-4 space-y-4">
      <div className="text-sm leading-relaxed text-ink-2">
        <p>
          The Census Bureau matched that to <span className="text-ink-0">{match.matchedAddress}</span> —{' '}
          {match.stateName}, {match.districtLabel.toLowerCase()}
          {match.congress && <> (boundaries for the {match.congress}th Congress)</>}.
        </p>
        <p className="mt-1 text-xs text-ink-4">
          Census GEOID <span className="mono">{match.geoid}</span> · state FIPS{' '}
          <span className="mono">{match.stateFips}</span> → {match.state}. Only the district was kept;
          the coordinates in the response were discarded.
        </p>
      </div>

      {match.delegate && (
        <CoverageNote>
          {match.stateName} is represented in the House by a non-voting delegate
          {match.state === 'PR' ? ' (a resident commissioner)' : ''}, and has no senators. The seat
          below can introduce bills, sign on as a <Term k="cosponsor">cosponsor</Term>, and vote in
          committee — but cannot vote on final passage on the House floor.
        </CoverageNote>
      )}

      <div>
        <div className="label mb-2">Your House seat</div>
        {house.length === 0 ? (
          <Empty>
            No sitting member is recorded for {match.state}
            {match.atLarge ? ' at-large' : `-${match.districtCode.replace(/^0+/, '')}`} in this data.
            The seat may be empty, or this data may be older than a special election.
          </Empty>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {house.map((m) => <MemberRow key={m.bioguideId} m={m} cycle={cycle} />)}
          </ul>
        )}
      </div>

      {!match.delegate && (
        <div>
          <div className="label mb-2">Your senators</div>
          {senators.length === 0 ? (
            <Empty>No senators are recorded for {match.stateName} in this data.</Empty>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {senators.map((m) => <MemberRow key={m.bioguideId} m={m} cycle={cycle} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function Reps() {
  const { data: legislators, error, loading } = useAsync(getLegislators, []);
  const { data: index } = useAsync(getIndex, []);
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 150);
  const [chamber, setChamber] = useState<'all' | 'House' | 'Senate'>('all');
  const [stateFilter, setStateFilter] = useState(params.get('state') ?? 'all');
  const [sort, setSort] = useState<SortKey>('name');
  const [limit, setLimit] = useState(60);

  // --- address lookup state (never persisted, never put in the URL) --------
  const [address, setAddress] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [outcome, setOutcome] = useState<GeocodeResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cycle = index?.cycle;

  // Sorted by the name a reader reads, not by the two-letter code.
  const states = useMemo(
    () => [...new Set((legislators ?? []).map((l) => l.state))].sort((a, b) =>
      (USPS_TO_STATE_NAME[a] ?? a).localeCompare(USPS_TO_STATE_NAME[b] ?? b),
    ),
    [legislators],
  );

  const filtered = useMemo(() => {
    if (!legislators) return [];
    const needle = debouncedQ.trim().toLowerCase();
    const out = legislators.filter((l) => {
      if (chamber !== 'all' && l.chamber !== chamber) return false;
      if (stateFilter !== 'all' && l.state !== stateFilter) return false;
      if (!needle) return true;
      return (
        l.name.toLowerCase().includes(needle) ||
        (l.lastName ?? '').toLowerCase().includes(needle) ||
        (l.firstName ?? '').toLowerCase().includes(needle) ||
        l.state.toLowerCase() === needle ||
        // The offline answer to "which district is mine?". A reader who knows
        // their town but not their district number — which is nearly everyone —
        // gets there from here and from nowhere else on the site.
        matchesPlace(l.districtPlaces, needle) ||
        (USPS_TO_STATE_NAME[l.state] ?? '').toLowerCase().includes(needle) ||
        l.committees.some((c) => c.committeeName.toLowerCase().includes(needle))
      );
    });

    return out.slice().sort((a, b) => {
      switch (sort) {
        case 'money':
          return (b.donorSummary?.totalItemized ?? -1) - (a.donorSummary?.totalItemized ?? -1);
        case 'state':
          return a.state.localeCompare(b.state) || Number(a.district ?? 0) - Number(b.district ?? 0);
        default:
          return (a.lastName ?? a.name).localeCompare(b.lastName ?? b.name);
      }
    });
  }, [legislators, debouncedQ, chamber, stateFilter, sort]);

  /**
   * Did this query match on a town? Used to tell the reader what they just did,
   * because "Brooklyn" returning five members is only obviously correct once
   * the rows show that Brooklyn is where those five keep an office.
   */
  const townHits = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    if (needle.length < 2) return 0;
    return filtered.filter((l) => matchesPlace(l.districtPlaces, needle)).length;
  }, [filtered, debouncedQ]);

  const searchRef = useRef<HTMLInputElement>(null);
  const focusMemberSearch = () => {
    const el = searchRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus();
  };

  const syncParam = (key: string, value: string, blank: string) => {
    const next = new URLSearchParams(params);
    if (value === blank) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const runLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLookingUp(true);
    setOutcome(null);
    const result = await lookupDistrict(address, { signal: controller.signal });
    if (controller.signal.aborted && result.ok === false && result.kind === 'timeout') {
      setLookingUp(false);
      return;
    }
    setOutcome(result);
    setLookingUp(false);
  };

  const clearLookup = () => {
    abortRef.current?.abort();
    setAddress('');
    setOutcome(null);
    setLookingUp(false);
  };

  if (error) return <ErrorState error={error} />;

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">Representatives</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-2">
        {/* Kept to two lines at 375px on purpose. Every line of preamble here
            pushes the address input and the town search — the two things
            anyone comes to this page to use — further down a phone screen. */}
        Everyone in the House and Senate right now, with the money reported behind them. Search a
        name or the town you live in, pick a state, or type an address.
      </p>
      <ViewToggle className="mt-3" />

      {/* ---- address lookup ----------------------------------------------
          ORDER MATTERS AND IS NOT COSMETIC.

          The eleven-line privacy panel used to sit above the input. On a 375px
          phone that put the input itself below the fold: a reader arriving to
          do one thing had to scroll past a wall of assurance to reach the box
          the assurance was about, and testing watched people never find it.

          So: heading, the one sentence that must be read before anything is
          sent, input, example, one line of assurance, and the full detail one
          tap away inside the same block. Nothing was deleted — body, opt-out
          and both source links are all still here. See lib/geocode.ts, which is
          the single source of all of this wording. */}
      <section className="card mt-5 p-4">
        <h2 className="text-md font-semibold text-ink-0">Find out who represents an address</h2>

        {/* ONE sentence above the control, and it is the one that has to be
            read before anything is sent: "your address is sent to the US Census
            Bureau, and to nothing else". Never folded, never conditional —
            rule 1 in lib/geocode.ts. The rest of the notice is below the input,
            still in this block. Measured at 375x667: the input and its button
            now both sit clear of the fold and of the sticky disclaimer bar; the
            eleven-line version put the input at ~865px, where nobody found it. */}
        <p className="caveat mt-2 px-3 py-2 font-semibold">{CENSUS_LOOKUP_NOTICE.headline}</p>

        <form onSubmit={runLookup} className="mt-2.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="address-lookup-input"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            /* NOT an example address. The placeholder used to be the literal
               string "350 Fifth Ave, New York, NY", which readers took for a
               pre-filled value: they pressed the button on an empty box and got
               an error that quoted the same address back at them. A placeholder
               names the shape of the answer; the example lives in visible
               helper text under the input, where it cannot be mistaken for
               input that is already there. */
            placeholder="Street, city, state"
            aria-label="Street address to look up"
            aria-describedby="address-lookup-help"
            autoComplete="off"
            spellCheck={false}
            className="control h-9 min-h-[2.25rem] w-full flex-1 px-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={lookingUp}
              className="btn h-9 shrink-0 border-accent bg-accent-soft px-4 font-medium text-accent disabled:opacity-60"
            >
              {lookingUp ? 'Looking up…' : 'Send to the Census Bureau'}
            </button>
            {(outcome || address) && (
              <button
                type="button"
                onClick={clearLookup}
                className="btn h-9 shrink-0 px-3"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* The example, and the offline alternative, both BELOW the input.
            Anything put above the input costs the input its place on a phone
            screen — which is the bug this whole block is fixing — so the
            alternative is offered here rather than as a line of preamble. */}
        <p id="address-lookup-help" className="mt-2 text-sm leading-relaxed text-ink-2">
          For example: <span className="text-ink-1">350 Fifth Ave, New York, NY</span>. US street
          addresses only. The government service is free, and can take a few seconds to answer.{' '}
          Would rather not send an address?{' '}
          <button
            type="button"
            onClick={focusMemberSearch}
            className="tap-24 font-medium text-accent underline decoration-accent-line underline-offset-2"
          >
            Search by town instead
          </button>{' '}
          — members are listed with the towns their district offices are in, and that sends nothing
          anywhere.
        </p>

        {/* The rest of the notice. The headline above the input is the sentence
            that has to be read before anything is sent and it is never folded;
            this is the detail behind it, in the same block, one tap away. The
            whole eleven-line panel used to sit above the input and pushed the
            input itself off a 375x667 screen — the reader could not see the
            control the notice was about. Nothing here was deleted. */}
        <div className="caveat mt-2 px-3 py-2.5">
          <p>{CENSUS_LOOKUP_NOTICE.assurance}</p>
          <details className="mt-1.5">
            <summary className="tap-24 cursor-pointer font-medium underline decoration-caveat-line underline-offset-2">
              What happens to my address?
            </summary>
            <div className="mt-1.5 space-y-1">
              <p>{CENSUS_LOOKUP_NOTICE.body}</p>
              <p>{CENSUS_LOOKUP_NOTICE.optOut}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                <SourceLink href={CENSUS_LOOKUP_NOTICE.serviceDocsUrl}>The service being called</SourceLink>
                <SourceLink href={CENSUS_LOOKUP_NOTICE.privacyPolicyUrl}>Census Bureau privacy policy</SourceLink>
              </p>
            </div>
          </details>
        </div>

        {/* This flow is the one place on the site where something IS sent, so
            it cannot borrow the default "nothing is being sent anywhere" line —
            that contradicted the notice two inches above it, and a site caught
            contradicting itself about where a reader's data goes has lost the
            argument. */}
        {lookingUp && (
          <Loading
            what="the district for that address"
            note="Your address is with the US Census Bureau right now. Nothing else about you was sent, and the answer is not stored."
            rows={2}
          />
        )}

        {!lookingUp && outcome && !outcome.ok && (
          <div className="mt-3 space-y-2">
            <CoverageNote>
              <p className="font-semibold">{outcome.message}</p>
              {outcome.hint && <p className="mt-1">{outcome.hint}</p>}
            </CoverageNote>
            {/* The offline answer, stated as an answer rather than as a
                consolation. "Find your member by name" is no help to the person
                who is here because she does not know the name. */}
            <div className="rounded border border-line border-l-2 border-l-accent bg-accent-soft px-3 py-2.5">
              <p className="text-sm font-semibold text-ink-0">{DISTRICT_LOOKUP_FALLBACK.headline}</p>
              <p className="mt-1 max-w-measure-wide text-sm leading-relaxed text-ink-1">
                {DISTRICT_LOOKUP_FALLBACK.body}
              </p>
              <button
                type="button"
                onClick={focusMemberSearch}
                className="btn mt-2 h-8 px-3 text-sm"
              >
                Search by town instead
              </button>
            </div>
          </div>
        )}

        {!lookingUp && outcome?.ok && legislators && (
          <AddressResult match={outcome.match} legislators={legislators} cycle={cycle} />
        )}
      </section>

      {/* ---- name / town / state / chamber -------------------------------- */}
      <div className="mt-6">
        <label htmlFor="member-search" className="block text-sm font-medium text-ink-1">
          Search members by name or by town
        </label>
        <p id="member-search-help" className="mt-0.5 max-w-measure-wide text-sm leading-relaxed text-ink-2">
          Type the town you live in — “Brooklyn”, “Cullman”, “Tuscumbia” — and you will get the
          members who keep a district office there. Names, states and committees work too. This
          search runs on a file already in your browser and sends nothing anywhere.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id="member-search"
          ref={searchRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(60); syncParam('q', e.target.value, ''); }}
          placeholder="Name, town, state or committee…"
          aria-label="Search members by name, town, state or committee"
          aria-describedby="member-search-help"
          className="h-9 min-w-[14rem] flex-1 control px-3 text-sm"
        />
        <select
          value={chamber}
          onChange={(e) => { setChamber(e.target.value as typeof chamber); setLimit(60); }}
          aria-label="Chamber"
          className="h-9 control px-2 text-sm"
        >
          <option value="all">Both chambers</option>
          <option value="House">House</option>
          <option value="Senate">Senate</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); setLimit(60); syncParam('state', e.target.value, 'all'); }}
          aria-label="State or territory"
          className="h-9 control px-2 text-sm"
        >
          <option value="all">All states</option>
          {/* Two-letter codes are a filing convention, not a name people scan a
              list by. "AS" is not recognisable; "American Samoa (AS)" is. */}
          {states.map((s) => (
            <option key={s} value={s}>
              {USPS_TO_STATE_NAME[s] ? `${USPS_TO_STATE_NAME[s]} (${s})` : s}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort by"
          className="h-9 control px-2 text-sm"
        >
          <option value="name">Name A–Z</option>
          <option value="money">Most disclosed money</option>
          <option value="state">State, then district</option>
        </select>
      </div>

      {/* ---- results ------------------------------------------------------ */}
      <div className="mt-6">
        {/* ---------------------------------------------------------------
            THE one framing block on this page — still exactly one, still the
            full DISCLAIMER_MEDIUM wording, still unfolded and unshrunk. What
            changed is where it sits.

            It used to sit directly under the page title. At 375px that is 206
            vertical pixels between the title and the first control, and it put
            the address input at ~865px — under the fold AND under the sticky
            disclaimer bar — on a 375x667 phone. The user this page exists for
            could not see the box she came to use.

            Here it sits immediately above the members list, which is where the
            money figures and the sector tags actually are: it frames the
            numbers, and the two controls above it produce no numbers of their
            own. Nothing is folded, nothing is smaller, nothing is conditional,
            and there is still exactly one of these per screen. */}
        <FramingNote className="mb-4 max-w-measure-wide" />

        <SectionTitle note={`${filtered.length.toLocaleString()} of ${(legislators?.length ?? 0).toLocaleString()}`}>
          Members
        </SectionTitle>

        {/* Stated once, above the list, rather than repeated on sixty rows:
            the sector chips on each row are a top-three list, so a sector that
            is absent from a row is not a sector that reported nothing. */}
        <DataLimit className="mb-3">
          The sector tags on each row are that member's three largest only. A sector missing from a
          row is not a sector with nothing in it — each member's own page can answer for any sector.
        </DataLimit>

        {townHits > 0 && (
          <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
            {townHits} of these {townHits === 1 ? 'is a member who keeps' : 'are members who keep'} a
            district office in a place matching “{debouncedQ.trim()}”. Office towns are listed on
            every row, after the seat.
          </p>
        )}

        {sort === 'money' && (
          <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
            Sorted by the total reported to the FEC for cycle {cycle ?? '—'}. A big total usually
            means a big, close race — not anything about the member. Members with no FEC record are
            last.
          </p>
        )}

        {loading ? (
          <Loading what="the list of members" />
        ) : filtered.length === 0 ? (
          <Empty>
            No member matches that. Try a last name on its own, the name of your town, or clear the
            state filter. District offices are not in every town — if yours is not listed, try the
            nearest larger town, or put your address in the box above.
          </Empty>
        ) : (
          <>
            <ul className="rows -mx-2">
              {filtered.slice(0, limit).map((m) => <MemberRow key={m.bioguideId} m={m} cycle={cycle} />)}
            </ul>

            {filtered.length > limit && (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + 100)}
                  className="btn"
                >
                  Show {Math.min(100, filtered.length - limit)} more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
