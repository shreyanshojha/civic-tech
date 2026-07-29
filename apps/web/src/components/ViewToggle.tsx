/**
 * The quick / full switch, and the fold it works with.
 *
 * Both live in one file because they are one idea: short by default, depth on
 * demand. The toggle sets the default depth of a page; a <Fold> is how any one
 * block on that page obeys it while still letting a reader open just that block.
 *
 * Nothing here hides anything permanently. A folded block is one tap from open,
 * and switching to full detail opens every fold on the page at once.
 */

import { useEffect, useId, useState } from 'react';
import { useViewMode } from '../lib/view';

/**
 * Sits in the same place on every page that has one: directly under the page
 * title, above the first block of content. Two real buttons, not a checkbox,
 * because the two states are two destinations rather than an on/off.
 */
export function ViewToggle({ className = '' }: { className?: string }) {
  const { view, setView } = useViewMode();
  const labelId = `view-toggle-${useId().replace(/:/g, '')}`;

  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`}>
      <span id={labelId} className="label">
        Show me
      </span>
      <div role="group" aria-labelledby={labelId} className="inline-flex overflow-hidden rounded border border-edge">
        {(
          [
            ['quick', 'Just the answer', 'The short version: the main numbers, in plain words.'],
            ['full', 'Everything', 'Every row, every table, every note, all open.'],
          ] as const
        ).map(([mode, label, hint]) => {
          const active = view === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={active}
              title={hint}
              className={`min-h-6 px-2.5 py-1 text-xs font-medium ${
                active ? 'bg-accent-soft text-accent' : 'bg-paper-raised text-ink-3 hover:text-accent'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-ink-4">
        {view === 'quick' ? 'Nothing is hidden — tap any heading to open it.' : 'Everything on this page is open.'}
      </span>
    </div>
  );
}

/**
 * A collapsible block.
 *
 * `open` is the *default* state and follows the view mode. A reader can open or
 * close any individual fold afterwards; flipping the toggle re-syncs them all,
 * which is what makes "Everything" behave like a single control rather than
 * like twelve.
 *
 * Native <details>, so it works with no JavaScript, is in the accessibility
 * tree for free, and is found by the browser's own in-page search.
 */
export function Fold({
  title,
  note,
  open = false,
  children,
  className = '',
}: {
  title: React.ReactNode;
  note?: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(open);
  useEffect(() => setIsOpen(open), [open]);

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
      className={`fold ${className}`}
    >
      <summary className="fold-summary">
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"
          aria-hidden className="fold-marker shrink-0"
        >
          <path d="m3 1 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 flex-1">{title}</span>
        {note && <span className="shrink-0 text-xs font-normal text-ink-4">{note}</span>}
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
