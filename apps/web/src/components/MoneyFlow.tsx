/**
 * The money-flow diagram.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS ALLOWED TO SAY, AND WHAT IT IS NOT
 *
 * A picture makes a claim before anyone reads a word, so this one is built to
 * make only the claim the data supports. It has two connectors and they are
 * drawn differently on purpose:
 *
 *   sector → member   a solid ribbon whose thickness is an AMOUNT. This is a
 *                     disclosed payment. It happened, and the FEC filing is
 *                     linked from the same page.
 *
 *   member → bill     a thin dashed line carrying the word "worked on". This
 *                     is a ROLE — sponsor, cosponsor, or a seat on the
 *                     committee. No money crosses it.
 *
 * A single unbroken flow from sector through member into bill would read as
 * "this money bought this bill", which is exactly the claim this project
 * refuses to make. So the chain is deliberately broken in the middle, and the
 * caption says so in words.
 *
 * Other constraints, from DESIGN.md:
 *   - one hue, from the neutral ink ramp. Magnitude is thickness, never colour.
 *   - no party anywhere in it.
 *   - the graphic is never the only channel: everything in it is repeated in
 *     the labelled list underneath and in the aria-label, so a screen-reader
 *     user and a sighted user get the same facts.
 * ---------------------------------------------------------------------------
 */

import { Link } from 'react-router-dom';
import { plainAmount, plainShare, usd } from '@ftm/core';
import type { IndustryId } from '@ftm/core';

export interface FlowSector {
  industry: IndustryId;
  label: string;
  amount: number;
  /** Share of the member's whole disclosed total, 0–1. */
  share: number;
}

const W = 240;
const ROW_H = 24;
const TOP = 24;

export function MoneyFlow({
  sectors,
  memberName,
  memberHref,
  billLabel,
  role,
  cycle,
}: {
  sectors: FlowSector[];
  memberName: string;
  memberHref?: string;
  billLabel: string;
  role?: string | null;
  cycle?: number | null;
}) {
  const rows = sectors.slice(0, 3).filter((s) => s.amount > 0);
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.amount), 1);
  const height = TOP + rows.length * ROW_H + 16;
  const midY = TOP + (rows.length * ROW_H) / 2;
  const nodeH = 30;

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const shareTotal = rows.reduce((s, r) => s + r.share, 0);

  // One sentence carrying everything the picture carries, for anyone who does
  // not get the picture — screen reader, print, images-off, or in a hurry.
  //
  // "Banking & Finance gave $59 thousand" used to be the wording here and in
  // the list below. A sector cannot give anything: these figures are PAC
  // contributions plus individual contributions bucketed by the employer each
  // donor typed on their own filing. Corporate contributions to federal
  // candidates are illegal, so writing it that way asserted a crime in passing.
  // The neutral construction states exactly what the data is.
  const spoken =
    `Diagram. ${rows
      .map((r) => `${plainAmount(r.amount)} of the money disclosed to ${memberName} came from donors this tool classifies as ${r.label}`)
      .join('; ')}. ` +
    `That money was disclosed${cycle ? ` in the ${cycle} cycle` : ''}. ` +
    `${memberName} ${role ? `is listed as ${role.toLowerCase()} on` : 'worked on'} ${billLabel}. ` +
    'The line between the member and the bill is a role, not a payment.';

  return (
    <figure className="card-data p-3">
      <figcaption className="label mb-2">Where the money came from, and what it sits next to</figcaption>

      {/* Small on purpose, and capped: a diagram that grows to 900px wide
          stops being a glance and starts being a chart. `h-auto` keeps the
          aspect ratio rather than letterboxing the drawing inside a fixed
          height, which is what happens if you set both width and height. */}
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={spoken}
        className="block h-auto w-full max-w-[24rem]"
        preserveAspectRatio="xMidYMid meet"
      >
        <text x="4" y="12" className="fill-ink-3" fontSize="9">Donors classified as</text>
        <text x="120" y="12" className="fill-ink-3" fontSize="9">Member</text>
        <text x="188" y="12" className="fill-ink-3" fontSize="9">This bill</text>

        {rows.map((r, i) => {
          const y = TOP + i * ROW_H + ROW_H / 2;
          const th = Math.max(4, Math.min(14, (r.amount / max) * 14));
          // A ribbon: two mirrored cubics, so its thickness is the quantity.
          const d =
            `M74 ${y - th / 2} C 96 ${y - th / 2}, 96 ${midY - th / 2}, 118 ${midY - th / 2} ` +
            `L118 ${midY + th / 2} C 96 ${midY + th / 2}, 96 ${y + th / 2}, 74 ${y + th / 2} Z`;
          return (
            <g key={r.industry}>
              <rect x="4" y={y - th / 2} width="70" height={th} rx={Math.min(3, th / 2)} className="fill-ink-3" />
              <path d={d} className="fill-ink-5" opacity="0.55" />
              <text x="4" y={y - th / 2 - 3} className="fill-ink-4" fontSize="7.5">
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* The member. A plain outlined node — no portrait, no party, no fill. */}
        <rect
          x="118" y={midY - nodeH / 2} width="46" height={nodeH} rx="4"
          className="fill-paper-raised stroke-ink-5" strokeWidth="1"
        />
        <text x="141" y={midY + 3} textAnchor="middle" className="fill-ink-2" fontSize="8.5">member</text>

        {/* Role, not payment: dashed, thin, and labelled in the picture itself. */}
        <path d={`M164 ${midY} H 184`} className="stroke-ink-5" strokeWidth="1" strokeDasharray="3 3" fill="none" />
        <path d={`M181 ${midY - 3} l4 3 -4 3`} className="stroke-ink-5" strokeWidth="1" fill="none" />
        {/* Above the node boxes, not level with them: at this scale a label on
            the connector line is overprinted by the box it points at. */}
        <text x="175" y={midY - nodeH / 2 - 4} textAnchor="middle" className="fill-ink-4" fontSize="7">worked on</text>

        <rect
          x="186" y={midY - nodeH / 2} width="50" height={nodeH} rx="4"
          className="fill-paper-raised stroke-ink-5" strokeWidth="1"
        />
        <text x="211" y={midY + 3} textAnchor="middle" className="fill-ink-2" fontSize="8.5">bill</text>
      </svg>

      {/* Everything above, in words. This is not a fallback — it is the primary
          reading of the diagram, and the picture is the summary of it. */}
      <ol className="mt-3 space-y-1.5 text-sm text-ink-2">
        {rows.map((r, i) => (
          <li key={r.industry} className="flex flex-wrap items-baseline gap-x-1.5">
            <span aria-hidden className="tnum text-xs text-ink-4">{i + 1}</span>
            <span className="tnum">{plainAmount(r.amount)}</span>
            <span>came from donors this tool classifies as</span>
            <Link className="link" to={`/industries/${r.industry}`}>{r.label}</Link>
            <span className="text-xs text-ink-3">(that is {plainShare(r.share)})</span>
          </li>
        ))}
      </ol>

      <p className="mt-2.5 text-sm leading-relaxed text-ink-2">
        That is {plainAmount(total)} in all — {plainShare(shareTotal)} — of the money disclosed to{' '}
        {memberHref ? (
          <Link className="link font-medium" to={memberHref}>{memberName}</Link>
        ) : (
          <span className="font-medium">{memberName}</span>
        )}
        {cycle ? <> in the {cycle} cycle</> : null}. {memberName} is listed as{' '}
        {role ? role.toLowerCase() : 'involved'} on {billLabel}.
      </p>
      <p className="mt-1.5 text-sm leading-snug text-ink-3">
        The dashed line is a job, not a payment. No money in this picture went to the bill, and none
        of it shows why anyone voted any way. Exact figures: {rows.map((r) => usd(r.amount)).join(' · ')}.
      </p>
      <p className="data-limit mt-2">
        A sector name here is a label this tool put on a donor, not an entity that wrote a cheque.
        Committee rows are real PACs; the rest is individual contributions grouped by the employer
        each donor typed on their own filing.
      </p>
    </figure>
  );
}
