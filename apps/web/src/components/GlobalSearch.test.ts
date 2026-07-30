/**
 * The search index still describes more of the world than the site can show.
 *
 * `search.json` is written by the export step and carries four kinds of entry:
 * members, bills, sectors and federal award recipients. Two of the destinations
 * those entries used to open no longer exist — the federal-spending page and the
 * per-sector pages were removed with the overlap score — so the ranking function
 * has to drop one kind and re-point another.
 *
 * That is a rule about what the site will and will not offer a reader, enforced
 * in one function, and it is exactly the kind of thing that quietly regresses the
 * next time somebody edits the ranking. Hence these tests. They are the reason
 * this file exists at all: the only other test in this workspace was for the
 * share-card renderer, which is gone.
 *
 * Node environment, no DOM: `rankResults` and `hrefFor` are pure.
 */

import { describe, expect, it } from 'vitest';
import { hrefFor, rankResults } from './GlobalSearch';
import type { SearchEntry } from '../lib/data';

const INDEX: SearchEntry[] = [
  { t: 'member', id: 'A000055', label: 'Robert B. Aderholt', sub: 'Rep. AL-4', terms: 'robert b. aderholt rep. al-4' },
  { t: 'bill', id: '119-hr-1', label: 'H.R. 1', sub: 'A bill about health', terms: 'h.r. 1 a bill about health' },
  {
    t: 'industry',
    id: 'pharma',
    label: 'Pharmaceuticals & Health Products',
    sub: 'Drug manufacturers, medical devices.',
    terms: 'pharmaceuticals & health products drug manufacturers, medical devices.',
  },
  {
    t: 'recipient',
    id: '91d4b7b8453e6e90b6cb95ea',
    label: 'HEALTH CARE SERVICES, CALIFORNIA DEPARTMENT OF',
    sub: 'Federal award recipient · Department of Health and Human Services',
    terms: 'health care services, california department of',
  },
];

describe('rankResults', () => {
  it('never returns a federal award recipient, because there is no page to open', () => {
    // "health" matches the recipient's label, its sub and its terms, so this
    // query would rank it first on the old ranking.
    const hits = rankResults(INDEX, 'health');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((h) => h.t)).not.toContain('recipient');
  });

  it('still finds members, bills and sectors', () => {
    expect(rankResults(INDEX, 'aderholt').map((h) => h.id)).toEqual(['A000055']);
    expect(rankResults(INDEX, 'h.r. 1').map((h) => h.id)).toEqual(['119-hr-1']);
    expect(rankResults(INDEX, 'pharmaceuticals').map((h) => h.id)).toEqual(['pharma']);
  });

  it('ignores a query shorter than two characters', () => {
    expect(rankResults(INDEX, 'a')).toEqual([]);
    expect(rankResults(INDEX, ' ')).toEqual([]);
  });

  it('ranks an exact label match above a substring match', () => {
    const index: SearchEntry[] = [
      { t: 'bill', id: 'b1', label: 'A bill mentioning health care', sub: '', terms: '' },
      { t: 'bill', id: 'b2', label: 'health', sub: '', terms: '' },
    ];
    expect(rankResults(index, 'health').map((h) => h.id)).toEqual(['b2', 'b1']);
  });
});

describe('hrefFor', () => {
  it('sends a sector to the bills carrying that tag, not to a sector page', () => {
    // The per-sector page was removed: its member ranking was built from each
    // member's three largest donor sectors only. bills.json carries every tag
    // for every bill, so this destination is complete.
    expect(hrefFor({ t: 'industry', id: 'pharma', label: '', sub: '', terms: '' }))
      .toBe('/bills?industry=pharma');
  });

  it('sends members and bills to their own pages', () => {
    expect(hrefFor({ t: 'member', id: 'A000055', label: '', sub: '', terms: '' })).toBe('/reps/A000055');
    expect(hrefFor({ t: 'bill', id: '119-hr-1', label: '', sub: '', terms: '' })).toBe('/bills/119-hr-1');
  });

  it('produces a live route for every kind the ranking can return', () => {
    // The guarantee this whole file is about: nothing a reader can pick from the
    // results list may point at a route that no longer exists.
    const dead = [/^\/spending/, /^\/industries\//];
    for (const hit of rankResults(INDEX, 'health').concat(rankResults(INDEX, 'pharmaceuticals'))) {
      const href = hrefFor(hit);
      for (const pattern of dead) expect(href).not.toMatch(pattern);
    }
  });
});
