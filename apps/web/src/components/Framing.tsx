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
 * ---------------------------------------------------------------------------
 * WHAT USED TO BE HERE: `<OverlapScore/>`, `<ScoreExplainer/>`, `bandNoteFor()`
 * and `distinctBands()`. DO NOT PUT THEM BACK.
 *
 * They rendered the member×bill overlap score — the percentage of a member's
 * reported money that came from sectors a bill would affect. Three independent
 * evaluations of the site (a product manager, an ordinary voter, a working
 * reporter) reached the same verdict independently: the score was the product's
 * headline number and it was worthless. The site's own /how-to-read page said as
 * much — "a big match says 'this page may be worth ten minutes'. It says nothing
 * else. It is a bookmark, not a finding." Several pages existed only to display
 * it, and they are gone with it.
 *
 * The score is still computed by the pipeline and still ships in the data
 * bundle; nothing renders it. The comparison that survived is the committee
 * cohort test on /patterns, which has a sample size and a stated denominator.
 *
 * The band strings and the score explainer still live in @ftm/core because the
 * ingest pipeline and the core tests use them. Importing them back into a view
 * is how this comes back by accident.
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
 *
 * ---------------------------------------------------------------------------
 * THE ONE THING THIS COMPONENT ADDS TO THE CORE TEXT, AND WHY.
 *
 * One paragraph of DISCLAIMER_LONG explains what "a high overlap score" means.
 * That score used to be printed on every member and bill page. It is not printed
 * anywhere any more — it was cut after three independent evaluations found it was
 * the headline metric and was worthless. The paragraph is still correct about the
 * phenomenon, but a reader who goes looking for the number it names will not find
 * one, and an unexplained reference to a missing feature reads as a site that has
 * lost track of itself.
 *
 * The core string is NOT edited: it is the single source of the framing, it is
 * asserted by a test and by the repo audit, and the ingest pipeline uses it. So
 * the note below is the app's own editorial line, plainly marked as such, in the
 * quiet tier, after the statement rather than inside it. Do not fold it, and do
 * not fix this by rewording @ftm/core.
 * ---------------------------------------------------------------------------
 */
export function LongDisclaimer() {
  return (
    <div className="max-w-measure space-y-3 text-base leading-relaxed text-ink-2">
      {DISCLAIMER_LONG.split('\n\n').map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p className="border-t border-line pt-3 text-ink-1">{NO_ACCUSATION}</p>
      <p className="text-sm text-ink-3">
        One note on the wording above: this site no longer shows an overlap score — a single
        percentage for how much of one member's money came from industries one bill would affect. It
        was removed from every page, because a big number turned out to mean only “this page may be
        worth ten minutes”. The paragraph naming it is kept as written because it is the same
        statement every part of this project uses.
      </p>
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
