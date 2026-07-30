/**
 * The bill list.
 *
 * Two things were cut here with the overlap score: the "Largest overlap" sort
 * option, and the "N members whose donors are in these industries" line on each
 * row. Both were counts of a number no page shows any more. `bills.json` still
 * carries `topOverlap` and `overlapCount`; nothing reads them.
 *
 * The percentage still on a row is the classifier's confidence in a tag. It is
 * about the bill, never about a member, and it says so in words on the chip.
 */

import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { INDUSTRY_BY_ID, shortDate } from '@ftm/core';
import type { IndustryId } from '@ftm/core';
import { getBills, getLegislators } from '../lib/data';
import { useAsync, useDebounced } from '../lib/hooks';
import { Empty, ErrorState, Loading, MethodTag, SectionTitle } from '../components/ui';
import { FramingNote } from '../components/Framing';
import { ViewToggle } from '../components/ViewToggle';
import { Term } from '../components/Glossary';
import { parseView, useViewMode } from '../lib/view';

type SortKey = 'recent' | 'cosponsors' | 'title';

export default function Bills() {
  const { data: bills, error, loading } = useAsync(getBills, []);
  const { data: legislators } = useAsync(getLegislators, []);
  const [params, setParams] = useSearchParams();
  const { isQuick } = useViewMode();

  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 150);
  const [industry, setIndustry] = useState<IndustryId | 'all'>((params.get('industry') as IndustryId) ?? 'all');
  const [chamber, setChamber] = useState<'all' | 'house' | 'senate'>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [onlyClassified, setOnlyClassified] = useState(isQuick);
  const [limit, setLimit] = useState(parseView(params.get('view')) === 'quick' ? 20 : 60);

  const legByBio = useMemo(() => new Map((legislators ?? []).map((l) => [l.bioguideId, l])), [legislators]);

  const industryCounts = useMemo(() => {
    const m = new Map<IndustryId, number>();
    for (const b of bills ?? []) for (const i of b.industries) m.set(i.industry, (m.get(i.industry) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [bills]);

  const filtered = useMemo(() => {
    if (!bills) return [];
    const needle = debouncedQ.trim().toLowerCase();
    // "hr 1234" and "hr1234" should both find H.R. 1234.
    const numberMatch = /^([a-z]{1,7})\s*\.?\s*(\d+)$/.exec(needle);

    let out = bills.filter((b) => {
      if (industry !== 'all' && !b.industries.some((i) => i.industry === industry)) return false;
      if (chamber === 'house' && !/^h/.test(b.billType)) return false;
      if (chamber === 'senate' && !/^s/.test(b.billType)) return false;
      if (onlyClassified && b.industries.length === 0) return false;
      if (!needle) return true;
      if (numberMatch && b.billType === numberMatch[1] && b.billNumber === numberMatch[2]) return true;
      return (
        b.title.toLowerCase().includes(needle) ||
        `${b.billType} ${b.billNumber}`.includes(needle) ||
        (b.policyArea ?? '').toLowerCase().includes(needle) ||
        b.subjects.some((s) => s.toLowerCase().includes(needle)) ||
        b.committeeNames.some((c) => c.toLowerCase().includes(needle))
      );
    });

    out = out.slice().sort((a, b) => {
      switch (sort) {
        case 'cosponsors': return b.cosponsorCount - a.cosponsorCount;
        case 'title': return a.title.localeCompare(b.title);
        default: return String(b.latestActionDate ?? '').localeCompare(String(a.latestActionDate ?? ''));
      }
    });
    return out;
  }, [bills, debouncedQ, industry, chamber, sort, onlyClassified]);

  if (error) return <ErrorState error={error} />;

  const setIndustryFilter = (id: IndustryId | 'all') => {
    setIndustry(id);
    setLimit(60);
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('industry'); else next.set('industry', id);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">Bills</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-2">
        Bills from the Congress sitting now. Each one is tagged with the industries it would affect.
        This tool adds those tags, not Congress. Open any bill to see what it does in plain words.
      </p>
      {/* One framing block on this page — and not the sentence the sticky
          banner is already showing at the foot of the screen. */}
      <FramingNote className="mt-2 max-w-measure-wide" />
      <ViewToggle className="mt-3" />

      {/* ---- controls ---------------------------------------------------- */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(60); }}
            placeholder="Search a title, a number like hr 1234, or a subject…"
            aria-label="Filter bills"
            className="control h-9 min-w-[16rem] flex-1 px-3 text-sm"
          />
          <select
            value={chamber}
            onChange={(e) => setChamber(e.target.value as typeof chamber)}
            aria-label="Chamber"
            className="control h-9 px-2 text-sm"
          >
            <option value="all">Both chambers</option>
            <option value="house">House</option>
            <option value="senate">Senate</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort by"
            className="control h-9 px-2 text-sm"
          >
            <option value="recent">Most recent action</option>
            <option value="cosponsors">Most cosponsors</option>
            <option value="title">Title A–Z</option>
          </select>
          {/* The <label> wraps the box, so the whole row is the target — which is
              what WCAG 2.2 SC 2.5.8 measures. It was 20px tall with a 13px box;
              min-h-6 takes the target to 24 and the box up to 18 without turning
              a 13.5px control row into a chunky one. */}
          <label className="flex min-h-6 items-center gap-2 text-sm text-ink-3">
            <input
              type="checkbox"
              checked={onlyClassified}
              onChange={(e) => setOnlyClassified(e.target.checked)}
              className="h-[1.125rem] w-[1.125rem] shrink-0"
            />
            Only bills with an industry tag
          </label>
        </div>

        <div className="flex max-h-[7.5rem] flex-wrap gap-1.5 overflow-y-auto md:max-h-none">
          <button type="button" onClick={() => setIndustryFilter('all')} className={`chip ${industry === 'all' ? 'chip-active' : ''}`}>
            All sectors <span className="tnum text-ink-4">{bills?.length ?? 0}</span>
          </button>
          {industryCounts.map(([id, n]) => (
            <button key={id} type="button" onClick={() => setIndustryFilter(id)} className={`chip ${industry === id ? 'chip-active' : ''}`} title={INDUSTRY_BY_ID[id]?.blurb}>
              {INDUSTRY_BY_ID[id]?.label ?? id} <span className="tnum text-ink-4">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- results ----------------------------------------------------- */}
      <div className="mt-6">
        <SectionTitle note={`${filtered.length.toLocaleString()} of ${(bills?.length ?? 0).toLocaleString()}`}>
          Results
        </SectionTitle>
        <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
          The percentage on an industry tag is{' '}
          <Term k="confidence">how sure this tool is</Term> that the bill touches that industry. It
          says nothing about any member and nothing about money. Tap a tag to see the other bills
          with it.
        </p>

        {loading ? (
          <Loading what="the list of bills" />
        ) : filtered.length === 0 ? (
          <Empty>
            No bills match what you picked. Try clearing the industry filter, or typing less in the
            search box — a last name or a bill number like “hr 1234” works well.
          </Empty>
        ) : (
          <>
            <ul className="rows -mx-2">
              {filtered.slice(0, limit).map((b) => {
                const sponsor = b.sponsorBioguideId ? legByBio.get(b.sponsorBioguideId) : undefined;
                return (
                  <li key={b.id} className="px-2 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link to={`/bills/${b.id}`} className="tap-24 mono shrink-0 text-xs text-ink-4 hover:text-accent">
                        {b.billType.toUpperCase()} {b.billNumber}
                      </Link>
                      <Link to={`/bills/${b.id}`} className="tap-24 max-w-measure-wide text-base leading-snug text-ink-1 hover:text-accent">
                        {b.title}
                      </Link>
                    </div>

                    {/* Who the bill reaches, under the title.
                        This is the first thing under a row now, ahead of the CRS
                        policy area, because "Health" is a filing category and
                        "Anyone who fills a prescription" is the reason a reader
                        would open the row at all. The policy area is still on the
                        line below.

                        Deliberately NOT marked amber when the bill is
                        title-only. This sentence comes from the subject labels
                        either way, so its quality does not depend on whether a
                        CRS summary exists — flagging the row would point the
                        data-gap colour at the one sentence that has no gap. The
                        gap is stated on the bill's own page, where the sentence
                        it applies to is. */}
                    {b.plain?.whoItTouches && (
                      <p className="mt-1 max-w-measure text-sm leading-snug text-ink-2">{b.plain.whoItTouches}</p>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      {sponsor && (
                        <span>
                          Sponsor{' '}
                          <Link className="link" to={`/reps/${sponsor.bioguideId}`}>{sponsor.name}</Link>
                        </span>
                      )}
                      <span>{b.cosponsorCount} <Term k="cosponsor">cosponsors</Term></span>
                      {b.latestActionDate && <span>Last action {shortDate(b.latestActionDate)}</span>}
                      {b.policyArea && <span>· {b.policyArea}</span>}
                    </div>

                    {b.industries.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {b.industries.slice(0, 5).map((i) => (
                          <button
                            key={i.industry}
                            type="button"
                            onClick={() => setIndustryFilter(i.industry)}
                            className="chip"
                            title={`${INDUSTRY_BY_ID[i.industry]?.blurb ?? ''} — this tool is ${Math.round(i.confidence * 100)}% sure of the tag. Tap to filter this list by it.`}
                          >
                            <span>
                              tagged {INDUSTRY_BY_ID[i.industry]?.label ?? i.industry}{' '}
                              <span className="tnum text-ink-4">· {Math.round(i.confidence * 100)}% sure</span>
                            </span>
                          </button>
                        ))}
                        <MethodTag method={b.classificationMethod} />
                      </div>
                    )}
                  </li>
                );
              })}
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
