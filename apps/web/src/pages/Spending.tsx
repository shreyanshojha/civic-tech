/**
 * Federal contract and grant awards.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE EXISTS, AND THE ONE THING IT MUST NEVER IMPLY
 *
 * Campaign finance answers "who gave money to whom". Awards answer the opposite
 * question: "where did federal money actually go". Both facts are public; both
 * are useful when reading a bill about a sector. Placing them in the same
 * application shows that both exist and nothing else.
 *
 * An award is the end of a procurement or grant process that runs for years, is
 * constrained by statute, is administered by career civil servants, and is in
 * most cases competed. No arrangement of this data can support a claim that a
 * contribution produced an award, and this page must never render one — not in
 * a heading, not in a sort order, not in a tooltip. There is deliberately no
 * "contributions vs awards" comparison anywhere on it.
 *
 * The `?q=` parameter is read from the URL because <GlobalSearch/> links here
 * with `?q=<recipient name>` when a reader picks a federal award recipient.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { INDUSTRY_BY_ID, shortDate, usd } from '@ftm/core';
import type { IndustryId } from '@ftm/core';
import { getAwards, getIndex } from '../lib/data';
import { useAsync, useDebounced } from '../lib/hooks';
import { CoverageNote, DataLimit, FramingNote, SourceLink } from '../components/Framing';
import { Fold, ViewToggle } from '../components/ViewToggle';
import { useViewMode } from '../lib/view';
import { Empty, ErrorState, Loading, MethodTag, SectionTitle, Stat } from '../components/ui';

type SortKey = 'amount-desc' | 'amount-asc' | 'date-desc' | 'date-asc' | 'recipient';

const PAGE = 50;

export default function Spending() {
  const { data: awards, error, loading } = useAsync(getAwards, []);
  const index = useAsync(getIndex, []);
  const [params, setParams] = useSearchParams();
  const { isQuick } = useViewMode();

  // GlobalSearch navigates here with ?q=<recipient name>.
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 150);
  const [sector, setSector] = useState<IndustryId | 'all'>('all');
  const [agency, setAgency] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('amount-desc');
  const [limit, setLimit] = useState(PAGE);

  // Keep the URL in step so a filtered view can be linked and reloaded.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debouncedQ.trim()) next.set('q', debouncedQ.trim());
    else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // Follow the URL when something else navigates here (e.g. the search box).
  useEffect(() => {
    const urlQ = params.get('q') ?? '';
    setQ((cur) => (urlQ !== cur.trim() && urlQ !== '' ? urlQ : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('q')]);

  const agencies = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of awards ?? []) {
      const key = a.awardingAgency ?? 'Not recorded';
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [awards]);

  const sectors = useMemo(() => {
    const m = new Map<IndustryId, number>();
    for (const a of awards ?? []) m.set(a.industry, (m.get(a.industry) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [awards]);

  const filtered = useMemo(() => {
    if (!awards) return [];
    const needle = debouncedQ.trim().toLowerCase();
    let out = awards.filter((a) => {
      if (sector !== 'all' && a.industry !== sector) return false;
      if (agency !== 'all' && (a.awardingAgency ?? 'Not recorded') !== agency) return false;
      if (!needle) return true;
      return (
        a.recipientName.toLowerCase().includes(needle) ||
        (a.recipientParentName ?? '').toLowerCase().includes(needle) ||
        (a.awardingAgency ?? '').toLowerCase().includes(needle) ||
        (a.awardingSubAgency ?? '').toLowerCase().includes(needle) ||
        (a.naicsDescription ?? '').toLowerCase().includes(needle) ||
        (a.description ?? '').toLowerCase().includes(needle) ||
        (a.recipientState ?? '').toLowerCase() === needle
      );
    });

    out = out.slice().sort((a, b) => {
      switch (sort) {
        case 'amount-asc': return a.amount - b.amount;
        case 'date-desc': return String(b.actionDate).localeCompare(String(a.actionDate));
        case 'date-asc': return String(a.actionDate).localeCompare(String(b.actionDate));
        case 'recipient': return a.recipientName.localeCompare(b.recipientName);
        default: return b.amount - a.amount;
      }
    });
    return out;
  }, [awards, debouncedQ, sector, agency, sort]);

  useEffect(() => { setLimit(PAGE); }, [debouncedQ, sector, agency, sort]);

  if (error) return <ErrorState error={error} />;

  const shown = filtered.slice(0, limit);
  const filteredTotal = filtered.reduce((s, a) => s + a.amount, 0);
  const bundleAwards = index.data?.counts.awards ?? awards?.length ?? 0;
  // The export keeps the largest awards by value, so the smallest row present is
  // itself the cut-off. Showing it is the clearest way to say how partial this is.
  const smallestInBundle = (awards ?? []).reduce((m, a) => Math.min(m, a.amount), Infinity);

  const clearAll = () => { setQ(''); setSector('all'); setAgency('all'); setSort('amount-desc'); };
  const hasFilters = q.trim() !== '' || sector !== 'all' || agency !== 'all';

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">Federal spending</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-2">
        Contracts and grants, from the government's own record of where federal money went. Every row
        links to that record, so you can check any figure in one click.
      </p>
      <FramingNote className="mt-2 max-w-measure-wide" />
      <ViewToggle className="mt-3" />

      {/* ---------------------------------------------------------------------
          This used to be two amber boxes, one directly above the other, opening
          with "This is background. It is never evidence." and "This is context.
          It is never evidence." — the same sentence twice, the second one one
          tap away. A reader who has read the first has no reason to open the
          second, and a reader who has not read the first will not read either.
          One box now, with the substance that used to be in the folded copy
          folded under it rather than repeated. */}
      <div className="mt-4">
        <CoverageNote>
          <strong className="font-semibold">This is background. It is never evidence.</strong> Nothing
          on this page can show that a donation caused an award, and none of it should be read that
          way.
          <Fold className="mt-2" open={!isQuick} title="Why awards are here at all">
            <p className="max-w-measure-wide">
              A federal award is the outcome of a procurement or grant process that runs for years,
              is constrained by statute, is administered by career civil servants, and is usually
              competed. No filter, sort order or total on this page is capable of showing that a
              campaign contribution caused, influenced, or was exchanged for an award. Awards are
              here so that a reader looking at a bill about a sector can also see where federal money
              in that sector actually goes.
            </p>
          </Fold>
        </CoverageNote>
      </div>

      {/* ---- headline figures ------------------------------------------- */}
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat label="Awards shown" value={filtered.length.toLocaleString()} sub={`out of ${bundleAwards.toLocaleString()} awards here`} />
        <Stat label="What they are worth" value={usd(filteredTotal, { compact: true })} sub="The rows you are looking at, added up." />
        <Stat label="Agencies" value={agencies.length} sub="The government bodies that handed the money out." />
        <Stat label="Sectors represented" value={sectors.length} sub={<Link className="link" to="/industries">Browse sectors →</Link>} />
      </div>
      {/* The limit that changes how every figure above should be read, next to
          those figures rather than at the foot of the page. */}
      <DataLimit className="mt-3">
        These totals are of what is loaded here, never of federal spending. The bundle keeps only the
        largest awards by value
        {Number.isFinite(smallestInBundle) && (
          <> — the smallest one present is {usd(smallestInBundle, { compact: true })}</>
        )}
        , so small awards, which are the overwhelming majority by count, are absent entirely.
      </DataLimit>

      {/* ---- controls ---------------------------------------------------- */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="A company, an agency, a state code, or what the money was for…"
            aria-label="Search federal awards"
            className="h-9 min-w-[15rem] flex-1 control px-3 text-sm"
          />
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as IndustryId | 'all')}
            aria-label="Filter by sector"
            className="h-9 control px-2 text-sm"
          >
            <option value="all">All sectors</option>
            {sectors.map(([id, n]) => (
              <option key={id} value={id}>
                {INDUSTRY_BY_ID[id]?.label ?? id} ({n})
              </option>
            ))}
          </select>
          <select
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            aria-label="Filter by awarding agency"
            className="h-9 max-w-full control px-2 text-sm"
          >
            <option value="all">All agencies</option>
            {agencies.map(([name, n]) => (
              <option key={name} value={name}>
                {name} ({n})
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort awards by"
            className="h-9 control px-2 text-sm"
          >
            <option value="amount-desc">Largest amount first</option>
            <option value="amount-asc">Smallest amount first</option>
            <option value="date-desc">Most recent first</option>
            <option value="date-asc">Oldest first</option>
            <option value="recipient">Recipient A–Z</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="btn h-9"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ---- results ------------------------------------------------------ */}
      <div className="mt-6">
        <SectionTitle note={`${filtered.length.toLocaleString()} award${filtered.length === 1 ? '' : 's'}`}>
          Awards
        </SectionTitle>

        {loading ? (
          <Loading what="the list of federal awards" />
        ) : filtered.length === 0 ? (
          <Empty>
            No award matches that.{' '}
            {hasFilters ? 'Try clearing the sector or agency box, or typing less in the search box.' : ''}
          </Empty>
        ) : (
          <>
            {/* Narrow screens: one card per award. A five-column table is not
                readable at 375px and horizontal scrolling hides the amount. */}
            <ul className="rows -mx-2 sm:hidden">
              {shown.map((a) => (
                <li key={a.id} className="px-2 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm leading-snug text-ink-1">{a.recipientName}</span>
                    <span className="tnum shrink-0 text-base font-semibold text-ink-0">
                      {usd(a.amount, { compact: true })}
                    </span>
                  </div>
                  {a.recipientParentName && a.recipientParentName !== a.recipientName && (
                    <div className="mt-0.5 text-xs text-ink-4">Parent: {a.recipientParentName}</div>
                  )}
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-ink-4">
                    <dt>Agency</dt>
                    <dd className="text-ink-3">
                      {a.awardingAgency ?? 'Not recorded'}
                      {a.awardingSubAgency ? ` · ${a.awardingSubAgency}` : ''}
                    </dd>
                    <dt>Date</dt>
                    <dd className="tnum text-ink-3">{shortDate(a.actionDate)}</dd>
                    <dt>Sector</dt>
                    <dd>
                      <Link className="link text-ink-3" to={`/industries/${a.industry}`}>
                        {INDUSTRY_BY_ID[a.industry]?.label ?? a.industry}
                      </Link>
                    </dd>
                    <dt>Location</dt>
                    <dd className="tnum text-ink-3">
                      {a.recipientState ?? '—'}
                      {a.recipientCongressionalDistrict ? `-${a.recipientCongressionalDistrict}` : ''}
                    </dd>
                    <dt>Type</dt>
                    <dd className="text-ink-3">{a.awardType}</dd>
                  </dl>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <MethodTag method={a.industryMethod} />
                    <SourceLink href={a.sourceUrl}>usaspending.gov record</SourceLink>
                  </div>
                </li>
              ))}
            </ul>

            {/* Wider screens: the table. */}
            <div className="hidden overflow-x-auto sm:block lg:overflow-x-visible">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Federal contract and grant awards. Context about where federal money went; not
                  evidence that any contribution caused any award.
                </caption>
                <thead className="lg:thead-sticky">
                  <tr className="text-left text-2xs uppercase tracking-[0.06em] text-ink-3">
                    <th scope="col" className="py-2 pr-3 font-semibold">Recipient</th>
                    <th scope="col" className="py-2 pr-6 text-right font-semibold">Amount</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Awarding agency</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Sector</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">State / district</th>
                    <th scope="col" className="py-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="zebra divide-y divide-line">
                  {shown.map((a) => (
                    <tr key={a.id} className="align-top">
                      <td className="max-w-[22rem] py-2 pr-3">
                        <div className="text-ink-1">{a.recipientName}</div>
                        <div className="text-2xs text-ink-4">
                          {a.awardType}
                          {a.recipientParentName && a.recipientParentName !== a.recipientName
                            ? ` · parent ${a.recipientParentName}`
                            : ''}
                        </div>
                      </td>
                      <td className="tnum whitespace-nowrap py-2 pr-6 text-right font-semibold text-ink-0">
                        {usd(a.amount, { compact: true })}
                      </td>
                      <td className="py-2 pr-3 text-ink-2">
                        {a.awardingAgency ?? 'Not recorded'}
                        {a.awardingSubAgency && (
                          <div className="text-2xs text-ink-4">{a.awardingSubAgency}</div>
                        )}
                      </td>
                      <td className="tnum whitespace-nowrap py-2 pr-3 text-ink-3">{shortDate(a.actionDate)}</td>
                      <td className="py-2 pr-3">
                        <Link className="link text-ink-2" to={`/industries/${a.industry}`}>
                          {INDUSTRY_BY_ID[a.industry]?.label ?? a.industry}
                        </Link>
                        <div className="text-2xs text-ink-4">
                          <MethodTag method={a.industryMethod} />
                        </div>
                      </td>
                      <td className="tnum whitespace-nowrap py-2 pr-3 text-ink-3">
                        {a.recipientState ?? '—'}
                        {a.recipientCongressionalDistrict ? `-${a.recipientCongressionalDistrict}` : ''}
                      </td>
                      <td className="whitespace-nowrap py-2">
                        <SourceLink href={a.sourceUrl}>usaspending.gov</SourceLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > limit ? (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + PAGE)}
                  className="btn"
                >
                  Show {Math.min(PAGE, filtered.length - limit).toLocaleString()} more
                </button>
                <p className="mt-2 text-xs text-ink-4">
                  Showing {shown.length.toLocaleString()} of {filtered.length.toLocaleString()}.
                </p>
              </div>
            ) : (
              <p className="mt-5 text-center text-xs text-ink-4">
                Showing all {filtered.length.toLocaleString()} matching awards.
              </p>
            )}
          </>
        )}
      </div>

      {/* ---- coverage ------------------------------------------------------ */}
      <section className="mt-10 border-t border-line pt-6">
        <SectionTitle>What is in this table, and what is not</SectionTitle>
        <ul className="max-w-measure space-y-2 text-sm leading-relaxed text-ink-2">
          {/* The truncation is stated once, next to the totals it qualifies, at
              the top of the page. This bullet gives the mechanism rather than
              repeating the sentence. */}
          <li>
            · <strong className="font-semibold">This is not all federal spending.</strong> The export
            step keeps the largest awards by dollar value rather than the whole firehose, so the
            bundle holds {bundleAwards.toLocaleString()} rows. That cut is by value, not by sample,
            so it is not a random subset of anything and no share computed from it generalises.
          </li>
          <li>
            · <strong className="font-semibold">The sector on each row is this tool's guess.</strong>{' '}
            It comes from the award's NAICS industry code where one exists, and from keyword matching
            on the recipient name where one does not. Each row shows which route was used; rows with
            no usable signal are left unattributed rather than guessed at.
          </li>
          <li>
            · <strong className="font-semibold">A recipient is not a sector.</strong> A state agency
            passing federal health money through to providers is recorded as the recipient, so large
            grants often name a government body rather than the businesses eventually paid.
          </li>
          <li>
            · <strong className="font-semibold">Congressional district is the recipient's, and is
            often missing.</strong> It records where the recipient is registered, which is not
            necessarily where the work happens or where the money ends up.
          </li>
          <li>
            · <strong className="font-semibold">Amounts are as reported.</strong> Awards are amended,
            de-obligated and superseded; the figure shown is what the award record carried when this
            bundle was generated, not a settled final cost.
          </li>
        </ul>
        <p className="mt-4 text-sm text-ink-4">
          <Link className="link" to="/methodology">How this data is collected</Link> ·{' '}
          <Link className="link" to="/limitations">What this tool cannot do</Link>
        </p>
      </section>
    </div>
  );
}
