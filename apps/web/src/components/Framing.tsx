/**
 * The framing components.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS LOad-BEARING. Read before changing.
 *
 * Every disclaimer string in the app comes from @ftm/core/disclaimer.ts. No
 * component writes its own wording, so the framing cannot drift between views
 * and cannot be softened in one place without being softened everywhere (which
 * a test would then catch).
 *
 * `<PersistentDisclaimer/>` is rendered once by the root layout and is not
 * conditional on route, scroll position, or dismissal. There is deliberately no
 * "dismiss" button: the whole product thesis is that this framing travels with
 * the data, and a dismissable banner is a banner that gets dismissed.
 *
 * `<ScoreExplainer/>` must be rendered anywhere an overlap number appears. The
 * `<OverlapScore/>` component below composes it in automatically so a developer
 * cannot render a bare number by accident.
 * ---------------------------------------------------------------------------
 */

import { useState } from 'react';
import {
  DISCLAIMER_LONG,
  DISCLAIMER_MEDIUM,
  DISCLAIMER_SHORT,
  OVERLAP_BAND_LABEL,
  OVERLAP_BAND_NOTE,
  SCORE_EXPLAINER,
  overlapBand,
} from '@ftm/core';

/**
 * Restyling notes, so nobody mistakes these for cosmetic churn:
 *
 *  - The background was 95% translucent with a backdrop blur. Page text ghosted
 *    through it while scrolling, which made the most important sentence on the
 *    site look like a rendering bug. It is now opaque.
 *  - It gained a 2px accent rule along its top edge. That is the only 2px rule
 *    in the layout, so the banner reads as a fixed part of the frame rather
 *    than as content that happens to be at the bottom.
 *  - On short viewports it scrolls internally rather than growing without
 *    limit, so it can never push the page it is framing off the screen. The
 *    text is unchanged and nothing is truncated.
 */
export function PersistentDisclaimer() {
  return (
    <div
      role="note"
      aria-label="How to read this site"
      className="sticky bottom-0 z-40 border-t-2 border-accent bg-paper-raised print-disclaimer"
    >
      <div className="mx-auto flex max-h-[40vh] max-w-content items-start gap-2.5 overflow-y-auto px-4 py-2.5">
        <span aria-hidden className="mt-px shrink-0 select-none text-accent" title="">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7.2v4M8 4.8v.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-xs leading-snug text-ink-3">
          <strong className="font-semibold text-ink-1">Correlation, not causation.</strong>{' '}
          This site places two public records side by side — disclosed campaign contributions, and
          legislative activity. An overlap is a pattern worth a question. It is not evidence that
          money influenced a vote, and not an accusation of wrongdoing.{' '}
          <a className="link whitespace-nowrap font-medium text-ink-2" href="#/methodology">
            How the numbers work →
          </a>
        </p>
      </div>
    </div>
  );
}

/** Medium-weight framing, for the top of any page that shows a computed score. */
export function InlineDisclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`caveat px-3 py-2.5 ${className}`}>
      <p>{DISCLAIMER_MEDIUM}</p>
    </div>
  );
}

/**
 * Sits under every page title. It used to be --ink-4 on paper, which measured
 * 3.17:1 — below AA — so the one line every reader needs was the least legible
 * line on the page. It is now --ink-3 with an accent rule marking it as framing
 * rather than as body copy.
 */
export function ShortDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`border-l-2 border-accent-line pl-2.5 text-xs leading-snug text-ink-3 ${className}`}>
      {DISCLAIMER_SHORT}
    </p>
  );
}

export function LongDisclaimer() {
  return (
    <div className="max-w-measure space-y-3 text-base leading-relaxed text-ink-2">
      {DISCLAIMER_LONG.split('\n\n').map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function ScoreExplainer({ open: initial = false }: { open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tap-24 inline-flex items-center gap-1 text-xs font-medium text-ink-3 underline decoration-ink-5 underline-offset-2 hover:text-accent"
        aria-expanded={open}
      >
        <svg
          width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden
          className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
        >
          <path d="m3 1 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {open ? 'Hide' : 'What does this number mean?'}
      </button>
      {open && (
        <dl className="mt-2 space-y-2 rounded border border-line border-l-2 border-l-accent-line bg-paper p-3 text-sm leading-relaxed text-ink-2">
          <div>
            <dt className="label">What it is</dt>
            <dd>{SCORE_EXPLAINER.what}</dd>
          </div>
          <div>
            <dt className="label">What it is not</dt>
            <dd>{SCORE_EXPLAINER.whatItIsNot}</dd>
          </div>
          <div>
            <dt className="label">How to use it</dt>
            <dd>{SCORE_EXPLAINER.howToUse}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/**
 * The only sanctioned way to render an overlap score.
 *
 * It always renders the band label and the explainer alongside the number, so
 * a score can never appear on screen stripped of its meaning. The bar uses the
 * neutral ink ramp — never a red/green scale, which would imply a verdict.
 */
export function OverlapScore({
  score,
  size = 'md',
  showExplainer = true,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showExplainer?: boolean;
}) {
  const band = overlapBand(score);
  const pct = Math.round(score * 100);
  const rampClass = { minimal: 'ramp-0', some: 'ramp-1', substantial: 'ramp-2', high: 'ramp-3' }[band];
  const numberSize = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' }[size];

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={`${numberSize} tnum font-semibold text-ink-0`}>{pct}%</span>
        <span className="text-sm text-ink-3">{OVERLAP_BAND_LABEL[band]}</span>
      </div>
      {/* The track is a plain 0–100% axis with hairline ticks at the band
          boundaries (15 / 35 / 60). The ticks are what let a reader judge
          magnitude, which on a red/green scale would be done by hue — and hue
          would smuggle in a verdict. Length and position only. */}
      <div
        className="relative mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-ink-7"
        role="img"
        aria-label={`Overlap ${pct} percent. ${OVERLAP_BAND_LABEL[band]}.`}
      >
        <div className={`h-full rounded-sm ${rampClass}`} style={{ width: `${Math.max(2, pct)}%` }} />
        {[15, 35, 60].map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute top-0 h-full w-px bg-paper-raised opacity-70"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-ink-3">{OVERLAP_BAND_NOTE[band]}</p>
      {showExplainer && <ScoreExplainer />}
    </div>
  );
}

/** A visible provenance link. Every figure on this site must be traceable. */
export function SourceLink({ href, children }: { href: string; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="tap-24 inline-flex items-center gap-1 text-xs text-ink-4 hover:text-accent"
    >
      {children ?? 'Primary source'}
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4.5 2.5h5v5M9.5 2.5 5 7M8 8.5v1.5h-6v-6h1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/** Amber note used ONLY for data-coverage caveats, never for judgements. */
export function CoverageNote({ children }: { children: React.ReactNode }) {
  return <div className="caveat px-3 py-2">{children}</div>;
}
