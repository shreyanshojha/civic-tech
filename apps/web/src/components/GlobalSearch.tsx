/**
 * One search box for the whole application.
 *
 * It searches members, bills, sectors and federal award recipients from a single
 * prebuilt index file, entirely in the browser. No query ever leaves the device.
 *
 * Ranking is deliberately simple and explainable: exact label match, then label
 * prefix, then label substring, then a match anywhere in the entity's indexed
 * terms. Ties break toward members and bills, which is what people are usually
 * looking for.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSearchIndex, type SearchEntry } from '../lib/data';
import { useAsync, useDebounced } from '../lib/hooks';

const TYPE_LABEL: Record<SearchEntry['t'], string> = {
  member: 'Member of Congress',
  bill: 'Bill',
  industry: 'Sector',
  recipient: 'Federal award recipient',
};

const TYPE_ORDER: Record<SearchEntry['t'], number> = { member: 0, bill: 1, industry: 2, recipient: 3 };

export function rankResults(index: SearchEntry[], raw: string, limit = 24): SearchEntry[] {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return [];
  const scored: { e: SearchEntry; score: number }[] = [];

  for (const e of index) {
    const label = e.label.toLowerCase();
    let score = -1;
    if (label === q) score = 0;
    else if (label.startsWith(q)) score = 1;
    else if (label.includes(q)) score = 2;
    else if (e.sub.toLowerCase().includes(q)) score = 3;
    else if (e.terms.includes(q)) score = 4;
    if (score < 0) continue;
    scored.push({ e, score: score * 10 + TYPE_ORDER[e.t] });
  }

  scored.sort((a, b) => a.score - b.score || a.e.label.length - b.e.label.length);
  return scored.slice(0, limit).map((s) => s.e);
}

function hrefFor(e: SearchEntry): string {
  switch (e.t) {
    case 'member': return `/reps/${e.id}`;
    case 'bill': return `/bills/${e.id}`;
    case 'industry': return `/industries/${e.id}`;
    case 'recipient': return `/spending?q=${encodeURIComponent(e.label)}`;
  }
}

/**
 * Stable DOM id for one option row.
 *
 * `aria-activedescendant` is a *reference*, so the option it points at has to
 * have an id that exists in the document at the moment the attribute is read.
 * Deriving it from the option's index and the listbox's own id keeps the two
 * search instances (header and hero) from colliding, and keeps the id stable
 * across re-renders for a given position in the list.
 */
function optionId(listId: string, index: number): string {
  return `${listId}-option-${index}`;
}

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { data: index } = useAsync(getSearchIndex, []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(q, 120);

  // The header and the home hero both render a GlobalSearch, so a hard-coded
  // "global-search-results" put two elements with the same id on the page and
  // aria-controls pointed at whichever the browser found first. useId gives each
  // instance its own namespace.
  const listId = `global-search-results-${useId().replace(/:/g, '')}`;

  const results = useMemo(() => (index ? rankResults(index, debounced) : []), [index, debounced]);

  useEffect(() => setCursor(0), [debounced]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      // "/" focuses search from anywhere, the way every search-first tool works.
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = useCallback((e: SearchEntry) => {
    setOpen(false);
    setQ('');
    navigate(hrefFor(e));
  }, [navigate]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); const hit = results[cursor]; if (hit) go(hit); }
  };

  /**
   * The listbox is only in the DOM while it is open and the query is long
   * enough, and `aria-activedescendant` must not name an element that is not
   * there — a dangling reference is worse than no reference, because a screen
   * reader will announce nothing and give no clue why.
   *
   * Before this, the attribute was never set at all: a sighted mouse user saw
   * the highlight move on ArrowDown and a screen-reader user was told nothing.
   */
  const listOpen = open && debounced.trim().length >= 2;
  const activeDescendant =
    listOpen && results.length > 0 && results[cursor] ? optionId(listId, cursor) : undefined;

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4"
          width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={compact ? 'Search…' : 'Search members, bills, sectors, contractors…'}
          aria-label={compact ? 'Search everything (site header)' : 'Search everything'}
          aria-expanded={listOpen}
          role="combobox"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={activeDescendant}
          className={`control w-full pl-8 pr-8 ${
            compact ? 'h-8 text-sm' : 'h-10 text-base'
          }`}
        />
        {/* A lone "/" glyph read out after the search field's own label is
            noise — it is a hint about a physical keyboard shortcut, drawn for
            people who can see it sitting inside the box. The shortcut itself
            still works. */}
        {!compact && (
          <kbd
            aria-hidden
            className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-edge px-1.5 py-0.5 text-2xs text-ink-3 sm:block"
          >
            /
          </kbd>
        )}
      </div>

      {/* A drop shadow is invisible on a dark background, so the results panel
          is separated from the page by an --edge border rather than by a
          shadow; the shadow stays only as a light-mode nicety. */}
      {listOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-auto rounded border border-edge bg-paper-raised shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-sm text-ink-3">
                Nothing matches “{debounced}”. Try a surname, a bill number like “hr 1234”, or a
                sector.
              </p>
              {/* This box searches an index of members, bills, sectors and award
                  recipients. It does not and cannot resolve an address — and a
                  reader who types one and is told only "nothing matches"
                  reasonably concludes the site has nothing for them, when in
                  fact the tool that answers their question is one page away.
                  Shown always, because a query that looks like an address is not
                  reliably detectable and the pointer is cheap either way. */}
              <p className="mt-2 border-t border-line pt-2 text-sm leading-relaxed text-ink-2">
                Typed an address or a town? This box does not handle those.{' '}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setOpen(false); setQ(''); navigate('/reps'); }}
                  className="tap-24 font-medium text-accent underline decoration-accent-line underline-offset-2"
                >
                  Find your representatives by address or town →
                </button>
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {results.map((r, i) => (
                <li key={`${r.t}:${r.id}`}>
                  <button
                    type="button"
                    id={optionId(listId, i)}
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-start gap-3 border-l-2 px-3 py-2 text-left ${
                      i === cursor ? 'border-accent bg-accent-soft' : 'border-transparent'
                    }`}
                  >
                    <span className="label mt-0.5 w-[92px] shrink-0 normal-case tracking-normal">
                      {TYPE_LABEL[r.t]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink-1">{r.label}</span>
                      <span className="block truncate text-xs text-ink-3">{r.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
