/**
 * Find your representatives.
 *
 * Two ways in, and the order matters:
 *
 *  1. Name / state / chamber. Entirely local — legislators.json is already on
 *     the device, so nothing leaves it. This is the default and it is listed
 *     first because it is the option that costs the user nothing.
 *
 *  2. Address. This is the ONLY feature in the application that makes an
 *     outbound request, and the notice explaining exactly where the address
 *     goes is rendered above the input, unconditionally, before anything can be
 *     typed. See lib/geocode.ts — the wording lives there, next to the code
 *     that does the sending, so the two cannot drift apart.
 */

import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { INDUSTRY_BY_ID, usd } from '@ftm/core';
import { getIndex, getLegislators, type MemberSummary } from '../lib/data';
import { useAsync, useDebounced } from '../lib/hooks';
import { CENSUS_LOOKUP_NOTICE, lookupDistrict, type DistrictMatch, type GeocodeResult } from '../lib/geocode';
import { CoverageNote, ShortDisclaimer, SourceLink } from '../components/Framing';
import { ViewToggle } from '../components/ViewToggle';
import { Term } from '../components/Glossary';
import { useViewMode } from '../lib/view';
import { Empty, ErrorState, Loading, MemberAvatar, PartyTag, SectionTitle } from '../components/ui';

type SortKey = 'name' | 'money' | 'state';

/**
 * The bundle stores every single-seat House district as "0" — genuine at-large
 * states and the non-voting delegate seats alike. Rendering "VT-0" would be
 * wrong, so seats are labelled rather than concatenated.
 */
function seatLine(m: Pick<MemberSummary, 'chamber' | 'state' | 'district'>): string {
  if (m.chamber === 'Senate') return `Senator · ${m.state}`;
  const d = m.district === undefined ? '' : String(m.district);
  if (d === '' || d === '0') return `Representative · ${m.state} at-large`;
  return `Representative · ${m.state}-${d}`;
}

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
                  {m.donorSummary.unclassifiedShare > 0 && (
                    <span className="text-2xs text-ink-4">
                      {(m.donorSummary.unclassifiedShare * 100).toFixed(0)}% of their money could not be matched to an industry
                    </span>
                  )}
                </div>
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
  const { isQuick } = useViewMode();

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

  const states = useMemo(
    () => [...new Set((legislators ?? []).map((l) => l.state))].sort(),
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
        Everyone in the House and Senate right now, with the money reported behind them. Search a
        name, pick a state, or type an address to find your district. Open anyone to see who funded
        them and what they worked on.
      </p>
      <ShortDisclaimer className="mt-2" plain={isQuick} />
      <ViewToggle className="mt-3" />

      {/* ---- address lookup ---------------------------------------------- */}
      <section className="card mt-5 p-4">
        <h2 className="text-md font-semibold text-ink-0">Find out who represents an address</h2>

        {/* The notice is above the input, always rendered, never dismissable. */}
        <div className="caveat mt-2 px-3 py-2.5">
          <p className="font-semibold">{CENSUS_LOOKUP_NOTICE.headline}</p>
          <p className="mt-1">{CENSUS_LOOKUP_NOTICE.body}</p>
          <p className="mt-1">{CENSUS_LOOKUP_NOTICE.optOut}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SourceLink href={CENSUS_LOOKUP_NOTICE.serviceDocsUrl}>The service being called</SourceLink>
            <SourceLink href={CENSUS_LOOKUP_NOTICE.privacyPolicyUrl}>Census Bureau privacy policy</SourceLink>
          </p>
        </div>

        <form onSubmit={runLookup} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="350 Fifth Ave, New York, NY"
            aria-label="Street address to look up"
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

        <p className="mt-2 text-xs leading-relaxed text-ink-2">
          US street addresses only. The government service is free, and can take a few seconds to
          answer.
        </p>

        {lookingUp && <Loading what="the district for that address" />}

        {!lookingUp && outcome && !outcome.ok && (
          <div className="mt-3">
            <CoverageNote>
              <p className="font-semibold">{outcome.message}</p>
              {outcome.hint && <p className="mt-1">{outcome.hint}</p>}
            </CoverageNote>
          </div>
        )}

        {!lookingUp && outcome?.ok && legislators && (
          <AddressResult match={outcome.match} legislators={legislators} cycle={cycle} />
        )}
      </section>

      {/* ---- name / state / chamber -------------------------------------- */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(60); syncParam('q', e.target.value, ''); }}
          placeholder="Search by name, state or committee…"
          aria-label="Search members by name"
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
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <SectionTitle note={`${filtered.length.toLocaleString()} of ${(legislators?.length ?? 0).toLocaleString()}`}>
          Members
        </SectionTitle>

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
            No member matches that. Try a last name on its own, clear the state filter, or type an
            address in the box above.
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
