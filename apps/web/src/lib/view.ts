/**
 * Quick view / full detail, held in the URL.
 *
 * ---------------------------------------------------------------------------
 * WHY THE URL AND NOT STORAGE
 *
 * This app writes nothing to the device: no localStorage, no sessionStorage,
 * no cookies. `scripts/audit-repo.mjs` fails the build if any of those appear.
 * A view preference is still a preference, so it lives in the query string —
 * `#/bills/119-hr-1?view=full`. That makes it stateless, shareable, and
 * back-button-friendly, and it means a link someone sends carries the depth
 * they were reading at.
 *
 * QUICK IS THE DEFAULT, and that is the whole point of the layer. Most people
 * give a page twenty seconds. A page that opens with four tables and a
 * methodology note spends those twenty seconds on nobody's question. Quick view
 * answers the question first; full view is one tap away and removes nothing.
 *
 * Nothing is ever deleted by quick view. Every number, every caveat and every
 * table that exists in full view is reachable from quick view in one tap —
 * either by opening a fold, or by switching the toggle.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ViewMode = 'quick' | 'full';

export const DEFAULT_VIEW: ViewMode = 'quick';

export function parseView(raw: string | null | undefined): ViewMode {
  return raw === 'full' ? 'full' : DEFAULT_VIEW;
}

export interface ViewState {
  view: ViewMode;
  /** True in quick view. Read this rather than comparing strings in a page. */
  isQuick: boolean;
  setView: (v: ViewMode) => void;
  /** How many rows a list should show. Quick view shows a handful, full shows all. */
  cap: (quick: number, full: number) => number;
}

export function useViewMode(): ViewState {
  const [params, setParams] = useSearchParams();
  const view = parseView(params.get('view'));

  const setView = useCallback(
    (next: ViewMode) => {
      const p = new URLSearchParams(params);
      // The default never needs to be spelled out in the URL.
      if (next === DEFAULT_VIEW) p.delete('view');
      else p.set('view', next);
      setParams(p, { replace: true });
    },
    [params, setParams],
  );

  return useMemo(
    () => ({
      view,
      isQuick: view === 'quick',
      setView,
      cap: (quick: number, full: number) => (view === 'quick' ? quick : full),
    }),
    [view, setView],
  );
}
