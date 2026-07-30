/**
 * Find your representatives.
 *
 * Two ways in, and both of them are answered from files already on the device:
 *
 *  1. ZIP code or TOWN → district, via lib/district.ts. This used to be an
 *     address box that POSTed the reader's street address to the US Census
 *     Bureau geocoder. IT COULD NEVER WORK FROM THIS SITE: that service sends
 *     no `Access-Control-Allow-Origin` header, so the browser throws the answer
 *     away on every origin, localhost included. A static site cannot call it —
 *     the only ways to make that shape work are a server we deliberately do not
 *     have, or pushing home addresses through a stranger's CORS proxy. So do not
 *     "restore" the address box. The crosswalk ships with the app instead; see
 *     lib/district.ts and packages/ingest/src/districts.ts for the whole story.
 *
 *     Because nothing leaves the device any more, the privacy apparatus that
 *     used to surround the box — the "your address is sent to the US Census
 *     Bureau" banner, the "not stored, not logged" block, the "What happens to
 *     my address?" disclosure and the "search by town instead" escape hatch —
 *     is DELETED rather than reworded. Eleven lines of assurance about a request
 *     that no longer happens is not caution, it is clutter that pushed the input
 *     itself off a 375px screen. One quiet sentence replaces all of it.
 *
 *  2. Name / TOWN / state / chamber over legislators.json.
 *
 *     Town search is the load-bearing part. "Which of NY-2, NY-8, NY-10, NY-12
 *     is mine?" is unanswerable from district numbers, which is what a phone
 *     user hit when the address lookup failed; she picked a senator by mistake
 *     and left. Every member ships with the towns their district offices are in
 *     (`districtPlaces`), so typing "Brooklyn" answers the question offline.
 */

import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { INDUSTRY_BY_ID, usd } from '@ftm/core';
import { getIndex, getLegislators, type MemberSummary } from '../lib/data';
import { useAsync, useDebounced } from '../lib/hooks';
import {
  LOCAL_LOOKUP_NOTICE, LOOKUP_SOURCE_NOTE, USPS_TO_STATE_NAME, lookupPlace,
  type LookupResult, type SeatResult,
} from '../lib/district';
import { matchesPlace, seatLine } from '../lib/seat';
import { CoverageNote, DataLimit, FramingNote, SourceLink } from '../components/Framing';
import { ViewToggle } from '../components/ViewToggle';
import { Empty, ErrorState, Loading, MemberAvatar, PartyTag, SectionTitle } from '../components/ui';

type SortKey = 'name' | 'money' | 'state';

function fecUrl(m: MemberSummary, cycle: number | undefined): string | null {
  const id = m.fecCandidateIds[0];
  if (!id) return null;
  return `https://www.fec.gov/data/candidate/${id}/${cycle ? `?cycle=${cycle}` : ''}`;
}

/**
 * The insides of a member row, without the <li>.
 *
 * Split out so the ZIP/town lookup can show the same row under a seat heading
 * without nesting one <li> inside another. The presentation is identical to the
 * members list on purpose: a reader who looks up their ZIP and then scrolls the
 * list should not have to work out that they are looking at the same thing.
 */
function MemberRowBody({ m, cycle }: { m: MemberSummary; cycle?: number }) {
  const fec = fecUrl(m, cycle);
  return (
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
                  {/* Plain chips. These used to open a per-sector page whose
                      member ranking was built from this very field — each
                      member's three largest sectors only — so the page is gone
                      and the label carries the sector's definition instead. */}
                  {m.donorSummary.top.map((t) => (
                    <span
                      key={t.industry}
                      className="chip"
                      title={INDUSTRY_BY_ID[t.industry]?.blurb}
                    >
                      {INDUSTRY_BY_ID[t.industry]?.label ?? t.industry}
                      <span className="tnum text-ink-4">{usd(t.amount, { compact: true })}</span>
                    </span>
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
  );
}

/** One member, as a row in a list. Party is a letter, never a colour. */
function MemberRow({ m, cycle }: { m: MemberSummary; cycle?: number }) {
  return (
    <li className="px-2 py-3">
      <MemberRowBody m={m} cycle={cycle} />
    </li>
  );
}

/**
 * How much of a ZIP falls in one district, in words.
 *
 * `share` is a fraction of the ZIP's LAND AREA — that is what the Census
 * relationship file gives, rounded to two decimals. It is not a probability and
 * it is not a headcount, so it is never worded as one: "most of this ZIP" is
 * something the source supports, "72% likely to be your district" is not.
 */
function shareWords(share: number | undefined): string | null {
  if (share === undefined) return null;
  if (share >= 0.66) return 'most of this ZIP by land area';
  if (share >= 0.34) return 'about half of this ZIP by land area';
  if (share >= 0.15) return 'part of this ZIP by land area';
  return 'a small part of this ZIP by land area';
}

/**
 * One district, and whoever sits in it.
 *
 * `member: null` means the seat is VACANT — four House seats are (TX-23, FL-20,
 * GA-13, CA-14), and the upstream source agrees, so it is a fact about Congress
 * and not a hole in our file. The row therefore says so in words instead of
 * being dropped: "we found your district and nobody is in it" is a useful
 * answer, while a missing row reads as a search that failed.
 */
function SeatRow({
  seat, showShare, cycle,
}: { seat: SeatResult; showShare: boolean; cycle?: number }) {
  const share = showShare ? shareWords(seat.share) : null;
  return (
    <li className="px-2 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-ink-1">
          {seat.stateName}, {seat.label}
        </span>
        {share && <span className="text-xs text-ink-3">{share}</span>}
      </div>

      <div className="mt-2">
        {seat.member ? (
          <MemberRowBody m={seat.member} cycle={cycle} />
        ) : (
          <p className="max-w-measure text-sm leading-relaxed text-ink-2">
            <span className="font-medium text-ink-1">This seat is vacant.</span> Nobody represents{' '}
            {seat.stateName}, {seat.label} in the House right now. That is a vacancy in Congress,
            not a gap in this data.
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * The answer: every district the ZIP or town touches, then the senators.
 *
 * A ZIP is a postal convenience and a district is drawn from population, so
 * about 5,100 of 33,800 ZIPs sit in more than one. Picking the biggest and
 * saying nothing would tell some readers, confidently, about a representative
 * who is not theirs — so all of them are shown and the reason is stated first.
 * Senators are listed separately because they are elected statewide: they are
 * the same two whichever of those districts turns out to be the reader's.
 */
function PlaceResult({
  result, cycle,
}: { result: Extract<LookupResult, { ok: true }>; cycle?: number }) {
  const states = [...new Set(result.seats.map((s) => s.state))];
  const stateName = states.length === 1 ? result.seats[0].stateName : null;

  return (
    <div className="mt-4 space-y-4">
      <p className="max-w-measure text-sm leading-relaxed text-ink-2">
        {result.kind === 'zip' ? (
          <>ZIP <span className="tnum text-ink-0">{result.matched}</span></>
        ) : (
          <span className="text-ink-0">{result.matched}</span>
        )}{' '}
        {result.seats.length === 1
          ? 'is in one House district.'
          : `is in ${result.seats.length} House districts.`}
      </p>

      {/* Said BEFORE the rows, not after them. A reader who reads two names and
          stops has to already know that only one of them is theirs. */}
      {result.split && (
        <p className="max-w-measure text-sm leading-relaxed text-ink-2">
          A {result.kind === 'zip' ? 'ZIP code' : 'town'} can fall in more than one district, so
          more than one seat is listed here — only one of them is yours.
        </p>
      )}

      <div>
        <div className="label mb-2">
          {result.seats.length === 1 ? 'House seat' : 'House seats'}
        </div>
        <ul className="rows -mx-2 border-y border-line">
          {result.seats.map((s) => (
            <SeatRow
              key={`${s.state}-${s.district}`}
              seat={s}
              /* Shown only when the place is split. A single-district ZIP is
                 entirely in that district, give or take the two-decimal
                 rounding in the source, and "99% of this ZIP" would send a
                 reader hunting for a district that is not there. */
              showShare={result.split}
              cycle={cycle}
            />
          ))}
        </ul>
      </div>

      <div>
        <div className="label mb-2">{stateName ? `Senators for ${stateName}` : 'Senators'}</div>
        {/* Two sentences, because a bare town name can hit several states —
            there are 22 Springfields — and "these two are yours" would then be
            wrong for twenty of them. */}
        <p className="mb-2 max-w-measure text-sm leading-relaxed text-ink-2">
          {stateName
            ? 'Senators are elected by the whole state, not by district, so these two are yours whichever district above turns out to be.'
            : `Senators are elected by the whole state, not by district. That town name exists in ${states.length} states, so the senators for all of them are here.`}
        </p>
        {result.senators.length === 0 ? (
          <Empty>
            No senators are listed for this place. The District of Columbia and the US territories
            do not elect any — they send a non-voting delegate to the House instead.
          </Empty>
        ) : (
          <ul className="rows -mx-2 border-y border-line">
            {result.senators.map((m) => <MemberRow key={m.bioguideId} m={m} cycle={cycle} />)}
          </ul>
        )}
      </div>

      <p className="max-w-measure text-xs leading-relaxed text-ink-3">{LOOKUP_SOURCE_NOTE}</p>
    </div>
  );
}

/**
 * A lookup that did not find anything.
 *
 * Amber (.caveat) means "the shipped data has a gap you need to know about", per
 * principle 1 in styles.css — so it is used for the three kinds where that is
 * literally what happened (this ZIP is not in the Census file, this town is not
 * an incorporated place in it, the file was never built) and NOT for the two
 * where the reader simply has not typed a ZIP or a town yet. An empty box is not
 * a data gap, and amber that means two different things means nothing.
 */
function LookupProblem({ result }: { result: Extract<LookupResult, { ok: false }> }) {
  const isDataGap =
    result.kind === 'zip-not-found' ||
    result.kind === 'town-not-found' ||
    result.kind === 'load-failed';

  const inner = (
    <>
      <p className="font-medium">{result.message}</p>
      {result.hint && <p className="mt-1">{result.hint}</p>}
    </>
  );

  return (
    <div className="mt-3 max-w-measure-wide text-sm leading-relaxed">
      {isDataGap ? <CoverageNote>{inner}</CoverageNote> : <div className="well px-3 py-2.5 text-ink-2">{inner}</div>}
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

  // --- ZIP / town lookup state (never persisted, never put in the URL) -----
  const [place, setPlace] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [outcome, setOutcome] = useState<LookupResult | null>(null);

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

  const syncParam = (key: string, value: string, blank: string) => {
    const next = new URLSearchParams(params);
    if (value === blank) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  /**
   * No AbortController, no timeout, no request to cancel: the whole lookup is a
   * read of a file the browser already has, and the only wait is the first
   * ~340 KB of it arriving from this same origin.
   */
  const runLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookingUp(true);
    setOutcome(null);
    setOutcome(await lookupPlace(place, legislators ?? []));
    setLookingUp(false);
  };

  const clearLookup = () => {
    setPlace('');
    setOutcome(null);
    setLookingUp(false);
  };

  if (error) return <ErrorState error={error} />;

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">Representatives</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-2">
        {/* Kept to two lines at 375px on purpose. Every line of preamble here
            pushes the ZIP lookup and the town search — the two things anyone
            comes to this page to use — further down a phone screen. */}
        Everyone in the House and Senate right now, with the money reported behind them. Look up a
        ZIP code or town, search a name, or pick a state.
      </p>
      <ViewToggle className="mt-3" />

      {/* ---- ZIP / town lookup -------------------------------------------
          THE ADDRESS BOX IS GONE ON PURPOSE. DO NOT PUT IT BACK.

          It POSTed the reader's street address to the US Census Bureau
          geocoder. That service returns no `Access-Control-Allow-Origin`
          header, so the browser discarded every answer before our code saw it —
          on every origin, localhost included. A static site with no server
          cannot call it at all, and the only alternative was routing home
          addresses through somebody else's CORS proxy. The crosswalk ships with
          the app instead (lib/district.ts), so a ZIP or a town is now answered
          from a file on the device.

          And because nothing is sent anywhere, the privacy panel that used to
          wrap this input is deleted, not reworded: an amber "your address is
          sent to the US Census Bureau" banner, a second amber block, a "What
          happens to my address?" disclosure and an escape hatch to the town
          search, all about a request that no longer exists. What is left is one
          quiet sentence, in ink rather than amber — amber means "the data has a
          gap" (styles.css principle 1) and nothing here is a gap. */}
      <section className="card mt-5 p-4">
        <h2 className="text-md font-semibold text-ink-0">Find out who represents a ZIP code or town</h2>

        <label htmlFor="place-lookup" className="mt-2 block text-sm font-medium text-ink-1">
          ZIP code or town name — either one works
        </label>

        <form onSubmit={runLookup} className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="place-lookup"
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            /* Two examples separated by "or", never one plausible value. The
               placeholder here used to be a single real address and readers
               took it for something already typed in: they pressed the button
               on an empty box and got an error quoting that address back. */
            placeholder="11201, or Cullman"
            aria-label="ZIP code or town name"
            aria-describedby="place-lookup-notice"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="control h-9 min-h-[2.25rem] w-full flex-1 px-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={lookingUp}
              className="btn h-9 shrink-0 border-accent bg-accent-soft px-4 font-medium text-accent disabled:opacity-60"
            >
              {lookingUp ? 'Looking up…' : 'Look up'}
            </button>
            {(outcome || place) && (
              <button type="button" onClick={clearLookup} className="btn h-9 shrink-0 px-3">
                Clear
              </button>
            )}
          </div>
        </form>

        {/* One sentence, small and in ink. The eleven-line version it replaced
            was about an address leaving the device, which no longer happens. */}
        <p id="place-lookup-notice" className="mt-2 max-w-measure text-xs leading-relaxed text-ink-3">
          {LOCAL_LOOKUP_NOTICE}
        </p>

        {/* The default note on <Loading/> is only true for a local file read.
            This one is: the districts file is served from this same origin and
            is read on the device, so the note says which file is being read. */}
        {lookingUp && (
          <Loading
            what="the districts for that ZIP code or town"
            note="Reading the ZIP-and-town file on your device. Nothing you typed is sent anywhere."
            rows={2}
          />
        )}

        {!lookingUp && outcome && !outcome.ok && <LookupProblem result={outcome} />}
        {!lookingUp && outcome?.ok && <PlaceResult result={outcome} cycle={cycle} />}
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
            the ZIP lookup at ~865px — under the fold AND under the sticky
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
            state filter. District offices are not in every town — if yours is not listed, put your
            ZIP code in the box above, which covers every ZIP in the country.
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
