/**
 * Shared UI primitives.
 *
 * Rules encoded here so views cannot break them:
 *  - Party is rendered as a plain neutral letter, never as a colour. See
 *    <PartyTag/>: it has one style regardless of party.
 *  - Money is always tabular-numeral and always labelled with its cycle.
 *  - Industry bars use one hue; sector identity comes from the label, not from
 *    a colour the reader has to decode.
 */

import { useState } from 'react';
import { INDUSTRY_BY_ID, classificationMethodLabel, usd } from '@ftm/core';
import type { IndustryId } from '@ftm/core';

/**
 * A single figure. The number is the loudest thing in the block; the label
 * above and the qualifier below are quieter on purpose, because the qualifier
 * ("a floor", "itemized hard money only") is what stops the number being read
 * as more than it is, and it has to travel attached to the figure rather than
 * live in a footnote.
 *
 * The left hairline gives a row of these a shared spine. Without it, blocks
 * whose qualifier wrapped to two lines read as detached fragments.
 */
export function Stat({
  label, value, sub, mono = true,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="border-l-2 border-ink-5 pl-2.5">
      <div className="label">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold leading-tight text-ink-0 ${mono ? 'tnum' : ''}`}>{value}</div>
      {sub && <div className="mt-1 text-xs leading-snug text-ink-4">{sub}</div>}
    </div>
  );
}

/**
 * Party is a fact about a person and is shown as such. It is never used to
 * colour, sort, rank or filter anything anywhere in this application.
 */
export function PartyTag({ party }: { party?: string }) {
  if (!party) return null;
  const letter = /^dem/i.test(party) ? 'D' : /^rep/i.test(party) ? 'R' : /^ind/i.test(party) ? 'I' : party.slice(0, 1).toUpperCase();
  return (
    <span
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line px-1 text-2xs font-semibold text-ink-3"
      title={party}
    >
      {letter}
    </span>
  );
}

/**
 * A sector label, with its one-line definition on `title`.
 *
 * It used to be a link to a per-sector page. Those pages are gone: they were
 * built from `legislators.json → donorSummary.top`, which carries only each
 * member's three largest donor sectors, so a "top members for this sector" list
 * rested on roughly an eighth of the money and could not be fixed from that
 * file. A chip that leads nowhere is better than a chip that leads to a ranking
 * built on a fraction of the data. The `onClick` form is still a real control —
 * it filters the list the chip sits on.
 */
export function IndustryChip({
  id, active = false, onClick, count,
}: { id: IndustryId; active?: boolean; onClick?: () => void; count?: number }) {
  const meta = INDUSTRY_BY_ID[id];
  const body = (
    <>
      {meta?.label ?? id}
      {count !== undefined && <span className="tnum text-ink-4">{count}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`chip ${active ? 'chip-active' : ''}`} title={meta?.blurb}>
        {body}
      </button>
    );
  }
  return (
    <span className={`chip ${active ? 'chip-active' : ''}`} title={meta?.blurb}>
      {body}
    </span>
  );
}

/**
 * Horizontal bar list of industry amounts. One hue, magnitude by length.
 *
 * The labels are plain text. They used to link to a per-sector page; see
 * <IndustryChip/> above for why there is no longer one to link to.
 */
export function IndustryBars({
  rows, max, showAmounts = true,
}: {
  rows: { industry: IndustryId; amount: number; share: number }[];
  max?: number;
  showAmounts?: boolean;
}) {
  const top = max ?? Math.max(...rows.map((r) => r.amount), 1);
  if (rows.length === 0) {
    return <p className="text-sm text-ink-3">None of this money could be matched to an industry.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const meta = INDUSTRY_BY_ID[r.industry];
        const label = meta?.label ?? r.industry;
        return (
          <li key={r.industry}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink-2" title={meta?.blurb}>
                {label}
              </span>
              {showAmounts && (
                <span className="tnum shrink-0 text-ink-3">
                  {usd(r.amount, { compact: true })}
                  <span className="ml-1.5 text-ink-4">{(r.share * 100).toFixed(1)}%</span>
                </span>
              )}
            </div>
            <div className="mt-1 h-1 w-full rounded-full bg-ink-7">
              <div className="h-full rounded-full bg-ink-3" style={{ width: `${Math.max(1.5, (r.amount / top) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MemberAvatar({
  src, name, size = 40,
}: { src?: string; name: string; size?: number }) {
  // Portraits are hotlinked from the public-domain @unitedstates image set. They
  // are the ONLY external request this app makes, they are purely decorative, and
  // an offline or blocked load must degrade to initials rather than an empty
  // circle — so `broken` state, not `display: none`.
  const [broken, setBroken] = useState(false);
  const initials = name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-ink-7 text-2xs font-semibold text-ink-4"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

/**
 * Loading state. A spinner next to a sentence tells a reader nothing about
 * what is coming; skeleton rows in the shape of the real content do, and they
 * stop the page reflowing under the reader's eye when data lands.
 *
 * The shimmer is defined in styles.css behind a `prefers-reduced-motion:
 * no-preference` query, so a reader who asked for stillness gets a static grey
 * block rather than a pulsing one. `role="status"` keeps the announcement.
 */
/**
 * The default second line, and why it is overridable.
 *
 * Every other load on this site really is a local file read, and saying so is
 * the point. But the address lookup is the one flow that DOES send something —
 * and it was showing "Nothing is being sent anywhere" while it sent an address
 * to the Census Bureau, directly contradicting the notice sitting inches above
 * it. A reader who catches a site contradicting itself about where their data
 * goes stops believing the rest of the page, correctly.
 *
 * So the line is a prop. A caller whose flow is not a local read MUST pass its
 * own; the default is only true for the ones that are.
 */
const LOCAL_READ_NOTE = 'This site reads files on your device. Nothing is being sent anywhere.';

export function Loading({
  what = 'data', rows = 4, note = LOCAL_READ_NOTE,
}: { what?: string; rows?: number; note?: string }) {
  const widths = ['72%', '54%', '84%', '61%', '77%', '48%'];
  return (
    <div className="py-6" role="status" aria-live="polite">
      {/* Say what is coming, in words a reader can act on. "Loading…" tells
          them nothing; "Reading the file for this bill" tells them what will be
          on the screen and that it is a file, not a server they are waiting on. */}
      <span className="sr-only">Getting {what}. One moment.</span>
      <p aria-hidden className="text-sm text-ink-2">Getting {what}…</p>
      <p aria-hidden className="mt-0.5 text-xs text-ink-3">{note}</p>
      <div aria-hidden className="mt-3 space-y-3.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton h-3.5" style={{ width: widths[i % widths.length] }} />
            <div className="skeleton h-2.5 w-1/4 opacity-70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="card mx-auto my-10 max-w-2xl border-l-2 border-l-caveat p-5">
      <h2 className="text-md font-semibold text-ink-0">There is no data here yet</h2>
      <p className="mt-2 text-sm text-ink-2">
        This site runs from files on your own machine. It looks like those files have not been
        built yet. Build them once, reload, and this page will work. Nothing is fetched from a
        server while you use the site.
      </p>
      <pre className="mt-3 overflow-x-auto rounded border border-line bg-ink-7 p-2.5 font-mono text-xs leading-relaxed text-ink-2">
        {error.message}
      </pre>
      <p className="mt-3 text-xs text-ink-3">
        Run <span className="mono text-ink-2">npm run pipeline</span> from the repository root. The
        first run needs no keys.
      </p>
    </div>
  );
}

/**
 * Empty state. A bare centred sentence floating in a large white gap reads as
 * a page that failed; a dashed well reads as a container that is genuinely
 * empty. The dashed rule uses the ink ramp, never the caveat amber — amber
 * means "the data has a gap", which is a different claim from "no results".
 */
export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="well px-4 py-8 text-center">
      <p className="mx-auto max-w-measure text-sm text-ink-3">{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-5 pb-1.5">
      <h2 className="text-md font-semibold leading-snug text-ink-0">{children}</h2>
      {note && <span className="text-xs text-ink-3">{note}</span>}
    </div>
  );
}

/**
 * Shows how a value was derived. Used wherever a method is not obvious.
 *
 * The wording lives in @ftm/core so the share-card renderer — which has no React
 * in it and cannot import this file — prints the same sentence. A card that
 * shows a classification-derived percentage has to be able to say where the
 * classification came from, in the same words the page uses.
 */
export function MethodTag({ method }: { method: string | null | undefined }) {
  const label = classificationMethodLabel(method);
  if (!label) return null;
  return <span className="chip chip-wrap">{label}</span>;
}
