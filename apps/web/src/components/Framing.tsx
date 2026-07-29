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
import { Link } from 'react-router-dom';
import {
  DISCLAIMER_LONG,
  DISCLAIMER_MEDIUM,
  DISCLAIMER_PLAIN,
  DISCLAIMER_PLAIN_MORE,
  NO_ACCUSATION,
  OVERLAP_BAND_LABEL,
  OVERLAP_BAND_NOTE,
  OVERLAP_BAND_PLAIN,
  OVERLAP_BAND_PLAIN_NOTE,
  SCORE_EXPLAINER,
  SCORE_EXPLAINER_PLAIN,
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
  const [open, setOpen] = useState(false);
  return (
    <div
      role="note"
      aria-label="How to read this site"
      data-persistent-disclaimer=""
      className="sticky bottom-0 z-40 border-t-2 border-accent bg-paper-raised print-disclaimer"
    >
      <div className="mx-auto flex max-h-[40vh] max-w-content items-start gap-2.5 overflow-y-auto px-4 py-2.5">
        <span aria-hidden className="mt-0.5 shrink-0 select-none text-accent" title="">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7.2v4M8 4.8v.8" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0">
          {/* The default line is the plain one, and it is a step LARGER than the
              text it replaced. A caveat nobody finishes protects nobody. */}
          <p className="text-sm leading-snug text-ink-1">
            <strong className="font-semibold">{DISCLAIMER_PLAIN}</strong>{' '}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="tap-24 whitespace-nowrap font-medium text-accent underline decoration-accent-line underline-offset-2"
            >
              {open ? 'Show less' : 'Why?'}
            </button>
          </p>
          {open && (
            <div className="mt-1.5 space-y-1.5 text-xs leading-snug text-ink-3">
              <p>{DISCLAIMER_PLAIN_MORE}</p>
              {/* The fuller wording is not replaced by the plain line, only
                  folded behind it. This is the same sentence every other
                  surface of this project shows. */}
              <p className="max-w-measure-wide">{DISCLAIMER_MEDIUM}</p>
              <p>
                <a className="link font-medium text-ink-2" href="#/methodology">How the numbers work →</a>{' '}
                <a className="link ml-2 font-medium text-ink-2" href="#/limitations">What this misses →</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * THE framing block for a page. At most one of these per screen.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS REPLACED, AND WHY
 *
 * There used to be two of these components — `<ShortDisclaimer/>` under the
 * page title and `<InlineDisclaimer/>` above the score list — and several
 * pages rendered both. In quick view both printed DISCLAIMER_PLAIN, which is
 * the *same sentence the sticky banner was already showing*, so a reader could
 * meet one sentence three times on one screen before reaching a number.
 *
 * A usability study found that this did not make anyone more careful. It made
 * the framing invisible (habituation), and for a reader who already believed
 * the worst it read as motive rather than as care.
 *
 * So: one instance per screen, and it never repeats the banner. The banner
 * carries DISCLAIMER_PLAIN; this carries DISCLAIMER_MEDIUM, which is the
 * substantive version — what the tool puts side by side, and the ordinary
 * reason overlap exists. The reader who reads it gets MORE than they used to,
 * not less. Both strings still come from @ftm/core and nothing here writes its
 * own wording.
 *
 * This is not amber. Amber means "the data has a gap" (DESIGN.md §1); this is
 * "here is how to read the page", which is a different claim and must not
 * borrow the colour that the real data gaps depend on.
 * ---------------------------------------------------------------------------
 */
export function FramingNote({ className = '' }: { className?: string }) {
  return (
    <div className={`framing-note ${className}`} role="note" aria-label="How to read the numbers on this page">
      <p>{DISCLAIMER_MEDIUM}</p>
    </div>
  );
}

/**
 * A limit on ONE number, sitting next to that number.
 *
 * "18% of this member's money could not be matched to an industry" is not
 * boilerplate — it is the single most decision-relevant sentence on the page,
 * because it says how much of the figure above is missing. It used to be set
 * in the smallest type on the site, in the same amber box as the correlation
 * boilerplate, and was skipped for exactly that reason.
 *
 * Rules for this component, all of them learned the hard way:
 *   - it goes immediately under the figure it qualifies, never in a footnote
 *     and never inside a <Fold>;
 *   - it is the same size as the copy around that figure, not a size smaller;
 *   - it states a fact about the data, never a judgement about a person.
 */
export function DataLimit({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`data-limit ${className}`}>{children}</p>;
}

/**
 * The full statement: the four correlation paragraphs, then the separate claim
 * that nobody is being accused of anything.
 *
 * NO_ACCUSATION is deliberately set apart rather than appended to the run of
 * paragraphs above it. Four paragraphs of "this is not proof" train a reader to
 * read the fifth as the same point restated a fourth time, and it is not the
 * same point: those are statements about what the evidence can support, this one
 * is a statement about what the publisher is alleging about a named person.
 * A reader who skims this block and takes away only "not proof" has missed the
 * answer to the question they actually had. Hence the rule above it, a step
 * darker ink, and its own position at the end where it is the last thing read.
 *
 * Both strings still come from @ftm/core; nothing here writes its own wording.
 */
export function LongDisclaimer() {
  return (
    <div className="max-w-measure space-y-3 text-base leading-relaxed text-ink-2">
      {DISCLAIMER_LONG.split('\n\n').map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p className="border-t border-line pt-3 text-ink-1">{NO_ACCUSATION}</p>
    </div>
  );
}

/**
 * How to read the number.
 *
 * Two levels, and the plain one is the default. `plain` swaps the three long
 * sentences for the three short ones from disclaimer.ts and keeps the long ones
 * one tap further in — folded, never dropped. Both sets say the same three
 * things: what it is, what it is not, what to do with it.
 */
export function ScoreExplainer({
  open: initial = false,
  plain = false,
}: {
  open?: boolean;
  plain?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  const [long, setLong] = useState(false);
  const copy = plain && !long ? SCORE_EXPLAINER_PLAIN : SCORE_EXPLAINER;
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
        <div className="mt-2 rounded border border-line border-l-2 border-l-accent-line bg-paper p-3">
          <dl className="space-y-2 text-sm leading-relaxed text-ink-2">
            <div>
              <dt className="label">What it is</dt>
              <dd>{copy.what}</dd>
            </div>
            <div>
              <dt className="label">What it is not</dt>
              <dd>{copy.whatItIsNot}</dd>
            </div>
            <div>
              <dt className="label">How to use it</dt>
              <dd>{copy.howToUse}</dd>
            </div>
          </dl>
          {plain && (
            <button
              type="button"
              onClick={() => setLong((l) => !l)}
              aria-expanded={long}
              className="tap-24 mt-2 text-xs font-medium text-ink-3 underline decoration-ink-5 underline-offset-2 hover:text-accent"
            >
              {long ? 'Show the short version' : 'Show the longer version'}
            </button>
          )}
        </div>
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
  showBandNote = true,
  plain = false,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showExplainer?: boolean;
  /**
   * Suppress the one-line band note under the bar.
   *
   * ONLY legal in a LIST, and only when the list states the same sentence once
   * above it — see `bandNoteFor()` below, which is the sanctioned way to build
   * that statement so the wording still comes from @ftm/core.
   *
   * The reason: a member page showing six bills printed "Few or none of this
   * member's top disclosed donor industries have an obvious stake in this bill"
   * six times, identically. Six copies of a caveat is not six times the care;
   * testing found it is how a reader learns to skip the caveat, and how a
   * distrustful reader reads volume as motive. The band LABEL still travels
   * with every number, and the accessible name of every bar still carries the
   * formal band, so nothing is stripped from an individual score.
   */
  showBandNote?: boolean;
  /** Quick view: the plain band name and the plain one-line note, same bands. */
  plain?: boolean;
}) {
  const band = overlapBand(score);
  const pct = Math.round(score * 100);
  const rampClass = { minimal: 'ramp-0', some: 'ramp-1', substantial: 'ramp-2', high: 'ramp-3' }[band];
  const numberSize = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' }[size];
  // Plain view changes the words, never the bands and never the number. The
  // formal label still travels with the score in the accessible name below.
  const bandLabel = plain ? OVERLAP_BAND_PLAIN[band] : OVERLAP_BAND_LABEL[band];
  const bandNote = plain ? OVERLAP_BAND_PLAIN_NOTE[band] : OVERLAP_BAND_NOTE[band];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`${numberSize} tnum font-semibold text-ink-0`}>{pct}%</span>
        <span className="text-sm font-medium text-ink-2">{bandLabel}</span>
      </div>
      {/* The track is a plain 0–100% axis with hairline ticks at the band
          boundaries (15 / 35 / 60). The ticks are what let a reader judge
          magnitude, which on a red/green scale would be done by hue — and hue
          would smuggle in a verdict. Length and position only. */}
      <div
        className="relative mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-ink-7"
        role="img"
        aria-label={`Overlap ${pct} percent. ${OVERLAP_BAND_LABEL[band]}.`}
        title={OVERLAP_BAND_LABEL[band]}
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
      {showBandNote && <p className="mt-1.5 text-xs leading-snug text-ink-3">{bandNote}</p>}
      {showExplainer && <ScoreExplainer plain={plain} />}
    </div>
  );
}

/**
 * The band note for a score, so a list can say once what its rows would
 * otherwise each say. Wording still comes from @ftm/core; this only picks.
 */
export function bandNoteFor(score: number, plain: boolean): string {
  const band = overlapBand(score);
  return plain ? OVERLAP_BAND_PLAIN_NOTE[band] : OVERLAP_BAND_NOTE[band];
}

/** The distinct bands present in a set of scores, in ascending band order. */
export function distinctBands(scores: number[]): number[] {
  const order: Record<string, number> = { minimal: 0, some: 1, substantial: 2, high: 3 };
  const seen = new Map<string, number>();
  for (const s of scores) {
    const b = overlapBand(s);
    if (!seen.has(b)) seen.set(b, s);
  }
  return [...seen.entries()].sort((a, b) => order[a[0]] - order[b[0]]).map(([, s]) => s);
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

/**
 * Amber note used ONLY for data-coverage caveats, never for judgements.
 *
 * The third and broadest tier: "this whole dataset has a gap you need to know
 * about before you read any of it" — no votes in this bundle, awards truncated
 * to the largest few thousand, and so on. If what you are writing is a limit on
 * ONE figure, it belongs in <DataLimit/> next to that figure instead; if it is
 * the correlation-not-causation framing, it belongs in <FramingNote/> and there
 * may only be one of those on the screen.
 */
export function CoverageNote({ children }: { children: React.ReactNode }) {
  return <div className="caveat px-3 py-2">{children}</div>;
}

/**
 * "Something looks wrong on this page?"
 *
 * A skeptical reader who spots an error and has nowhere to report it concludes
 * that nobody wants to hear about errors. Every member and bill page carries
 * this, pointing at the corrections section on the About page, which names the
 * primary record to check first and who to contact.
 */
export function ReportProblemLink({ className = '' }: { className?: string }) {
  return (
    <Link className={`link text-xs text-ink-3 hover:text-accent ${className}`} to="/about">
      Something looks wrong on this page?
    </Link>
  );
}
