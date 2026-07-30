/**
 * One dot per member: the committee on one row, everybody else on the other.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PICTURE AND NOT TWO AVERAGES
 *
 * A pattern page could say "13.2% against 3.5%" and stop. Two averages hide the
 * two things that decide whether a comparison means anything: how much the two
 * groups OVERLAP, and whether the gap is the group or a handful of members at
 * the end of a long tail. Both are visible at a glance here and in no other
 * element on the page.
 *
 * Rules this drawing follows, from the DESIGN PRINCIPLES header in styles.css:
 *
 *   - No party anywhere. There is no party in this drawing and no party in the
 *     data behind it.
 *   - No good/bad scale. The cohort is the accent because it is the group being
 *     looked at, not because being on a committee is bad. The other row is a
 *     neutral step from the ink ramp.
 *   - The picture is never the only channel. Every number in it is repeated in
 *     the table underneath and in the aria-label, so it survives a screen
 *     reader, a printer and images-off.
 *
 * Two drawing decisions worth stating:
 *
 *   Dots are stacked into columns, not scattered with random jitter. Random
 *   jitter changes on every render and puts a member's dot somewhere the data
 *   did not; a column tells you honestly that fourteen members sit in the same
 *   half-percent, and it is the same drawing every time.
 *
 *   The vertical line is the median of the row that is NOT on the committee.
 *   It is the threshold the page's most interpretable check counts against
 *   ("43 of 51 are above the typical non-member"), so the reader can see that
 *   count rather than take it on trust.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from 'react';

/** Dot radius. 8px across is the smallest mark that stays a mark when it overlaps. */
const R = 4;
/** Vertical space each row's dots may occupy. */
const STRIP_H = 44;
/**
 * Row label sits above its dots, so a narrow phone column loses no width to it.
 * The height leaves clear air between the label and the tallest possible column
 * of dots in the row above it.
 */
const LABEL_H = 22;
const ROW_H = LABEL_H + STRIP_H;
const AXIS_H = 30;
const PAD_L = 4;
const PAD_R = 12;
/** Before the container has been measured. Any value works; it is replaced on mount. */
const FALLBACK_W = 560;

/**
 * The SVG is drawn at the container's real pixel width rather than scaled from a
 * fixed viewBox. A scaled viewBox would render 11px labels at 6px on a phone and
 * at 20px on a desktop, and dots would change size with the column.
 */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width: width || FALLBACK_W };
}

/** Nice round tick steps, so an axis never reads 0 / 7.3% / 14.6%. */
function ticksFor(max: number): number[] {
  const step = max > 0.4 ? 0.1 : max > 0.2 ? 0.05 : max > 0.08 ? 0.02 : 0.01;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(4)));
  return out;
}

/**
 * Place a row's dots. Same input, same output, every render.
 *
 * Dots are grouped into columns one dot-width wide and stacked around the middle
 * of the strip. Grouping decides only the VERTICAL stacking: every dot keeps its
 * true horizontal position, because the page counts how many dots fall to the
 * right of a line drawn at the baseline median, and snapping a dot to a column
 * centre could move it across that line.
 *
 * A column taller than the strip compresses instead of overflowing. The dots then
 * overlap, which is the honest reading of "more members here than there is room
 * to draw separately".
 */
function layout(shares: number[], x: (v: number) => number): { cx: number; dy: number; v: number }[] {
  const bins = new Map<number, number[]>();
  for (const v of shares) {
    const bin = Math.round(x(v) / (R * 2));
    bins.set(bin, [...(bins.get(bin) ?? []), v]);
  }
  const out: { cx: number; dy: number; v: number }[] = [];
  for (const values of bins.values()) {
    const n = values.length;
    const spacing = Math.min(R * 2 + 1, n > 1 ? (STRIP_H - R * 2) / (n - 1) : 0);
    const start = -((n - 1) * spacing) / 2;
    [...values].sort((a, b) => a - b).forEach((v, i) => {
      out.push({ cx: x(v), dy: start + i * spacing, v });
    });
  }
  return out;
}

export interface CohortPlotRow {
  label: string;
  shares: number[];
  /** Mean of the whole group, from the pattern file — not recomputed from `shares`. */
  mean: number;
  median: number;
  n: number;
}

export function CohortPlot({
  cohort,
  baseline,
  sectorLabel,
}: {
  cohort: CohortPlotRow;
  baseline: CohortPlotRow;
  sectorLabel: string;
}) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();

  const all = [...cohort.shares, ...baseline.shares];
  if (all.length === 0) return null;

  const rawMax = Math.max(...all, 0.01);
  const ticks = ticksFor(rawMax);
  const axisMax = Math.max(ticks[ticks.length - 1] ?? rawMax, rawMax);
  const plotW = Math.max(120, width - PAD_L - PAD_R);
  const x = (v: number) => PAD_L + (v / axisMax) * plotW;

  const height = ROW_H * 2 + AXIS_H;
  const rows = [
    { row: cohort, fill: 'fill-accent', top: 0 },
    { row: baseline, fill: 'fill-ink-5', top: ROW_H },
  ];
  const medianX = x(baseline.median);
  const above = cohort.shares.filter((s) => s > baseline.median).length;

  // Everything the picture carries, in one sentence, for anyone who does not get
  // the picture. Percentages only — no member is named anywhere in this drawing.
  const spoken =
    `Distribution plot. Each dot is one member, placed by the share of their traceable money that came from ${sectorLabel}. `
    + `Top row: the ${cohort.n} members on the committee, typical value ${(cohort.median * 100).toFixed(1)}%, average ${(cohort.mean * 100).toFixed(1)}%. `
    + `Bottom row: the ${baseline.n} members of the same chamber who are not on it, typical value ${(baseline.median * 100).toFixed(1)}%, average ${(baseline.mean * 100).toFixed(1)}%. `
    + `${above} of the ${cohort.n} committee dots sit to the right of the bottom row's typical value.`;

  return (
    <figure className="card-data p-3 sm:p-4">
      <figcaption className="label mb-2.5">
        Every member, one dot each — share of traceable money from {sectorLabel}
      </figcaption>

      <div ref={ref}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={spoken}
          className="block max-w-full"
        >
          {/* Grid first, so dots sit on top of it. Solid hairlines, one step off
              the surface: a dashed grid reads as a threshold, and there is a real
              threshold on this chart that needs to own that meaning. */}
          {ticks.map((t) => (
            <line
              key={`g${t}`}
              x1={x(t)}
              x2={x(t)}
              y1={2}
              y2={ROW_H * 2}
              className="stroke-ink-6"
              strokeWidth="1"
            />
          ))}

          {/* The threshold: the typical member who is not on this committee. */}
          <line
            x1={medianX}
            x2={medianX}
            y1={2}
            y2={ROW_H * 2 + 4}
            className="stroke-ink-4"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {rows.map(({ row, fill, top }) => {
            const cy = top + LABEL_H + STRIP_H / 2;
            return (
              <g key={row.label}>
                {/* The row label is the legend: a swatch in the mark's own colour
                    with its name beside it, so identity never depends on the
                    reader matching two colours across the figure. */}
                <circle cx={PAD_L + R} cy={top + LABEL_H - 6} r={R} className={fill} />
                <text
                  x={PAD_L + R * 2 + 6}
                  y={top + LABEL_H - 2}
                  fontSize="11"
                  className="fill-ink-2"
                >
                  {row.label} · {row.n} members
                </text>
                {layout(row.shares, x).map((d, i) => (
                  <circle
                    key={i}
                    cx={d.cx}
                    cy={cy + d.dy}
                    r={R}
                    className={`${fill} stroke-paper-raised`}
                    strokeWidth="1.5"
                    fillOpacity="0.72"
                  >
                    <title>{`${(d.v * 100).toFixed(1)}% from ${sectorLabel}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* Axis */}
          <line
            x1={PAD_L}
            x2={PAD_L + plotW}
            y1={ROW_H * 2 + 8}
            y2={ROW_H * 2 + 8}
            className="stroke-ink-5"
            strokeWidth="1"
          />
          {ticks.map((t, i) => (
            <text
              key={`t${t}`}
              x={x(t)}
              y={ROW_H * 2 + 21}
              fontSize="10"
              textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
              className="fill-ink-4 tnum"
            >
              {Math.round(t * 100)}%
            </text>
          ))}
        </svg>
      </div>

      <p className="mt-1 text-xs leading-snug text-ink-3">
        The dashed line is the typical member who is not on this committee. Dots stack where members
        share a value.
      </p>

      {/* The table view. Required by the same rule as the aria-label: the numbers
          in the picture must be readable without the picture. */}
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">
          Share of traceable money from {sectorLabel}, by group
        </caption>
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="label pb-1 font-semibold">Group</th>
            <th scope="col" className="label pb-1 text-right font-semibold">Members</th>
            <th scope="col" className="label pb-1 text-right font-semibold">Typical</th>
            <th scope="col" className="label pb-1 text-right font-semibold">Average</th>
          </tr>
        </thead>
        <tbody className="rows">
          {[cohort, baseline].map((row) => (
            <tr key={row.label}>
              <td className="py-1.5 text-ink-2">{row.label}</td>
              <td className="tnum py-1.5 text-right text-ink-2">{row.n}</td>
              <td className="tnum py-1.5 text-right text-ink-2">{(row.median * 100).toFixed(1)}%</td>
              <td className="tnum py-1.5 text-right text-ink-2">{(row.mean * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
