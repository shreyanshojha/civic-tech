# Design system

This file exists so the constraints in `src/styles.css` survive contact with
future contributors. The rules here are not taste. Most of them are the visual
half of an editorial position, and undoing one of them changes what the site
claims.

Read `src/styles.css` first — the DESIGN PRINCIPLES comment at the top is the
short version and it is binding. This file is the long version, with the
measurements.

---

## 1. Colour rules, and why they are not negotiable

### No partisan colour, ever

Red and blue are not in the palette. Not as an accent, not as a chart series,
not as a hover state, not "just for the party letter". `<PartyTag/>` renders one
neutral bordered glyph regardless of party, and party is never a sort key, a
filter, a rank or a fill.

The reason is the product's whole reason to exist. This site puts campaign money
next to legislative activity. If a reader can tell at a glance which "side" a
page is about, they will read the page as an argument about that side, and every
number on it becomes ammunition rather than evidence. The palette is built so
that they cannot: one slate-teal accent (`--accent`, `#1b5551` light / `#78c6be`
dark), chosen precisely because it belongs to neither party's visual vocabulary,
and a neutral grey ink ramp for everything else.

If you find yourself wanting a second hue to distinguish two categories, use
position, length, a label, or a border style instead. That is a harder design
problem and it is the correct one.

### No red/green magnitude scale

Overlap scores use `.ramp-0` … `.ramp-3`, four steps of **one hue** varying only
in weight. A high overlap is not bad. A member whose donor sectors overlap with
a bill they worked on is, in the overwhelming majority of cases, a member who
sits on a committee relevant to their district — which is how the institution is
designed to work. Rendering an 80% overlap in red would state a conclusion that
the data cannot support, in a channel the reader processes before they read a
word of the caveat sitting next to it.

The bar in `<OverlapScore/>` therefore encodes magnitude with **length and
position only**: a plain 0–100% track with hairline ticks at the band boundaries
(15 / 35 / 60). Length is a quantity. Hue is a judgement. This chart is only
allowed to express a quantity.

### Amber is reserved

`--caveat` amber means exactly one thing: *this data has a gap or a limit you
need to know about before you read the number.* It is never a severity, never a
warning about a person, never "attention". `.caveat` and `<CoverageNote/>` are
the only things that may use it. If a block is amber, a reader must be able to
assume it is talking about the dataset, not about a legislator.

### The ink ramp is split into text and structure

| tier | role |
|---|---|
| `--ink-0` … `--ink-4` | **text only** — all clear WCAG AA on every surface, both schemes |
| `--ink-5`, `--ink-6`, `--ink-7` | **structure only** — hairlines, bar tracks, wells, zebra |

Do not set text in `--ink-5`, `--ink-6` or `--ink-7`. Before this pass, the whole
secondary-text tier was `--ink-4` at **3.17:1** — below AA — which meant sponsor
names, provenance links, table headers, counts and every "this is a floor"
qualifier were the least legible text on the page. Those qualifiers are the
things that stop a number being over-read, so the least legible text was also
the most load-bearing text.

There are two border tokens, and the difference matters:

- `--line` — the receding hairline. Grouping and separation. Decorative.
- `--edge` — ≥ 3:1 against its surface. Everything a reader can *operate*:
  inputs, selects, buttons, the results panel. WCAG 1.4.11 requires the boundary
  of an interactive control to be perceivable, and a 1.3:1 hairline is not.
  Measured: 3.04–3.15:1 light, 3.40–3.66:1 dark.

---

## 2. Measured contrast

Computed from the rendered colours, `(L1 + 0.05) / (L2 + 0.05)`. Every cell is a
text tier against a background it is actually used on.

### Light

| token | paper | raised | ink-7 | accent-soft | caveat-soft | worst |
|---|---|---|---|---|---|---|
| `--ink-0` `#0c0d0e` | 18.79 | 19.45 | 16.84 | 16.62 | 17.60 | **16.62** |
| `--ink-1` `#1c1f22` | 15.99 | 16.56 | 14.33 | 14.15 | 14.98 | **14.15** |
| `--ink-2` `#383e44` | 10.45 | 10.82 | 9.37 | 9.25 | 9.79 | **9.25** |
| `--ink-3` `#535a61` | 6.75 | 6.99 | 6.06 | 5.98 | 6.33 | **5.98** |
| `--ink-4` `#646b72` | 5.22 | 5.40 | 4.68 | 4.62 | 4.89 | **4.62** |
| `--accent` `#1b5551` | 8.23 | 8.52 | 7.38 | 7.28 | 7.71 | **7.28** |
| `--caveat` `#6f5313` | 6.94 | 7.19 | 6.22 | 6.14 | 6.50 | **6.14** |

### Dark

| token | paper | raised | ink-7 | accent-soft | caveat-soft | worst |
|---|---|---|---|---|---|---|
| `--ink-0` `#f4f6f7` | 16.47 | 15.32 | 14.30 | 12.93 | 13.87 | **12.93** |
| `--ink-1` `#e4e8ea` | 14.48 | 13.47 | 12.57 | 11.36 | 12.19 | **11.36** |
| `--ink-2` `#c2c9ce` | 10.66 | 9.92 | 9.26 | 8.37 | 8.98 | **8.37** |
| `--ink-3` `#b1b8be` | 8.90 | 8.28 | 7.73 | 6.99 | 7.50 | **6.99** |
| `--ink-4` `#8c959c` | 5.86 | 5.45 | 5.09 | 4.60 | 4.94 | **4.60** |
| `--accent` `#78c6be` | 9.03 | 8.40 | 7.84 | 7.09 | 7.60 | **7.09** |
| `--caveat` `#e0c684` | 10.70 | 9.95 | 9.28 | 8.39 | 9.01 | **8.39** |

A crawl of every rendered text node across all 11 routes × 3 widths × both
schemes measured **320 distinct text styles and 0 AA failures**. The floor is
4.60:1 (`--ink-4` on `--accent-soft`, used for the count inside an active
filter chip). AA for normal text is 4.5:1, so the headroom is thin by design —
`--ink-4` is as light as it is allowed to get. If you lighten it, you break the
promise in principle 5 of `styles.css`.

**If you change any colour token, re-measure.** Do not eyeball it.

---

## 3. Type scale

Nine steps, defined once as CSS variables in `styles.css` and exposed to
Tailwind as `text-2xs` … `text-3xl`. Every step is at least 8% from its
neighbours, which is roughly the threshold at which a size change reads as a
deliberate difference rather than as a rendering inconsistency.

| token | size | line-height | used for |
|---|---|---|---|
| `text-2xs` | 11 px | 1.45 | `.label` uppercase eyebrows, `kbd`, dense unit tags |
| `text-xs` | 12.5 px | 1.5 | metadata, provenance, counts, the persistent disclaimer |
| `text-sm` | 13.5 px | 1.55 | secondary body, table cells, list detail lines |
| `text-base` | 15 px | 1.6 | body prose — the default |
| `text-md` | 17 px | 1.5 | `<SectionTitle/>` h2, lead paragraphs |
| `text-lg` | 20 px | 1.3 | figures in `<Stat/>`, small `<OverlapScore/>` |
| `text-xl` | 24 px | 1.22 | index-page h1 |
| `text-2xl` | 31 px | 1.15 | detail-page h1 (serif), large `<OverlapScore/>` |
| `text-3xl` | 40 px | 1.06 | the home hero, and nothing else |

**Do not add `text-[13px]`.** The scale replaced fourteen ad-hoc arbitrary sizes
— 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 19, 22, 38 px. Six of
those sat inside a 2.5px band, which is not a hierarchy; it is noise that costs
a reader effort without giving them information. If a size you want is not on
this list, the answer is almost always a different step, occasionally a weight
change, and never a new size.

The previous heading hierarchy was h1 20px → h2 15px → body 14–15px, so a
section heading was the same size as the paragraph under it and was doing all
its work with weight alone. Now h1 24 → h2 17 → body 15 gives each level a real
size step.

**Serif is structural, not decorative.** `--font-serif` marks the *subject of
the page*: the home hero, a bill title, a member name, a sector name, and the
single most important limitation on `/limitations`. Everything else — every
label, every figure, every control — is sans. A reader should be able to tell
"what this page is about" from typeface alone.

**Tabular numerals everywhere a figure appears.** `.tnum`, plus
`font-feature-settings: "tnum"` on `body`. Money in a column that does not align
is money that cannot be compared at a glance.

---

## 4. Spacing rhythm

One 4px base unit, with three named tokens for the three scales that matter:

| token | value | separates |
|---|---|---|
| `--space-tight` | 6 px | lines within a block |
| `--space-block` | 16 px | blocks within a section |
| `--space-section` | 36 px | sections |

Two layout constants are also tokens, because other things need to reason about
them:

- `--header-h` (5.8rem) — the sticky header. Used by `scroll-padding-top` so an
  anchor never lands under it, and by `.thead-sticky` so a sticky table head
  docks under the header rather than under the top of the viewport.
- `--disclaimer-h` (4.25rem) — the sticky disclaimer, used by
  `scroll-padding-bottom`.

**Reading measure.** `.measure` (68ch) for body prose, `.measure-wide` (82ch) for
secondary and caveat text. A 72rem container with unconstrained prose in it
produces ~110-character lines, at which point readers start losing their place
on the line return. This app asks people to read a lot of careful qualifying
prose; it has to be readable, not merely present.

**Dead space is a signal, not a crime.** The hero used to leave the right 40% of
a 1440px screen empty because prose was capped at `max-w-2xl` inside a 72rem
container. The fix was to move the four headline figures into that gap — filling
it with the data — not to widen the prose. On single-column prose pages
(`/about`, `/limitations`, `/methodology`) the right column stays empty on
purpose. Stretching a paragraph to fill a container is not a layout improvement.

---

## 5. The framing is part of the layout

`<PersistentDisclaimer/>` is sticky, opaque, undismissable, and rendered once by
the root layout on every route. Its 2px accent top rule is the only 2px rule in
the chrome, so it reads as part of the frame rather than as content that happens
to be at the bottom.

You may restyle it. You may not:

- change any disclaimer wording (all strings come from `@ftm/core/disclaimer.ts`
  and nothing else is allowed to write its own),
- add a dismiss control,
- make it conditional on route or scroll,
- reduce its prominence,
- remove `<ScoreExplainer/>` from anywhere a score appears, or render a bare
  number without going through `<OverlapScore/>`,
- soften or hide a coverage caveat.

Two constraints it now satisfies that it did not before: it is **opaque** (it was
95% translucent with a backdrop blur, so page text ghosted through it during
scroll and the most important sentence on the site looked like a rendering bug),
and it **scrolls internally above 40vh** so on a short viewport it can never grow
until it pushes the page it is framing off screen. The text is unchanged and
nothing is truncated.

On phones the sticky header collapses to two rows (brand + nav, with search
behind a button) instead of three. That was the correct place to reclaim
viewport: the header is chrome and can be quieter, the disclaimer is the
product and cannot.

---

## 6. Motion and focus

`prefers-reduced-motion: reduce` is honoured with a **blanket guard** in
`styles.css` that neutralises every animation and transition on the page, so a
contributor cannot add a moving thing that ignores it by forgetting to. If you
genuinely need motion, opt back in explicitly inside a
`@media (prefers-reduced-motion: no-preference)` block — `.skeleton` is the one
example. Verified: 0 elements animating under reduced-motion.

`:focus-visible` is never removed. It is a 2px accent outline plus a 2px
paper-coloured spacer ring, so it stays visible on top of the `accent-soft` and
`caveat-soft` fills as well as on plain paper. Verified: 256 focusable elements
at 375px and at 1440px, 0 without a visible ring.

Heading order is verified per route: exactly one `h1`, no skipped levels, on all
11 routes.

---

## 7. Component vocabulary

Prefer these over re-typing utility strings, because a rule written once is a
rule that can be enforced.

| class | use |
|---|---|
| `.card` | grouped content on a raised surface |
| `.card-data` | a card carrying figures; firmer top edge, since a 1.4:1 hairline vanishes in dark mode |
| `.chip` / `.chip-active` | tags and filters. A `button.chip` gets `--edge` because it is pressable |
| `.control` | inputs and selects — `--edge` border |
| `.btn` | buttons — `--edge` border |
| `.caveat` | data-gap notices only. The 3px left rule is load-bearing: it survives forced-colours and print, where the amber fill does not, so a caveat cannot quietly stop looking like a caveat |
| `.rows` | list rhythm: hairline separators plus a hover wash |
| `.zebra` | alternating row wash for long tables. A wash of the well colour, never a tint of the accent, so it never reads as a selected state |
| `.thead-sticky` | sticky table head, docked under `--header-h` |
| `.well` | empty states. Dashed ink rule, *not* caveat amber — "no results" and "the data has a gap" are different claims and must not look alike |
| `.skeleton` | loading placeholders in the shape of the content that is coming |
| `.measure` / `.measure-wide` | reading measure for prose |
| `.scroll-x` | horizontal scroller with an edge-fade mask so it is visible that there is more |
| `.tap-24` | WCAG 2.2 SC 2.5.8 hit area for a small control, with no visual change |

### `.tap-24`, and why the target size problem is not solved by padding alone

A review counted 37–40 interactive elements per page under 24×24 CSS px —
almost all of them inline links set in 12–13px text with no vertical padding.
On a phone those are links you miss.

The constraint is that they sit inside running prose, so any real height change
would open up the line spacing across the whole site. `.tap-24` exploits the
difference between the two box types:

- on an **inline** box, vertical padding grows the hit area and the border box
  but does **not** affect the line box, so the page lays out to the pixel
  exactly as it did before;
- on a **block or flex-item** box the same padding would push things apart, so
  an equal negative block margin cancels it.

One declaration covers both, because block margins are ignored on inline boxes.
`.link` carries the same padding inline so the several dozen links that already
use it are covered without being touched individually.

Two things are measured rather than assumed, and should be re-measured if this
changes: `document.documentElement.scrollWidth <= clientWidth` at 375px on every
route (WCAG 1.4.10 Reflow — long `.chip` labels used to break this), and every
interactive element at ≥ 24×24, counting a checkbox's wrapping `<label>` as the
target since that is what a reader actually presses.

---

## 8. Build note

`vite.config.ts` pins `resolve.extensions` to put `.tsx`/`.ts` ahead of `.js`.
Vite's default order is the other way round, and this repo had a set of stale
`Home.js`-style files from an old `tsc` emit sitting next to their `.tsx`
sources. Vite resolved the `.js`, so the running site was compiled from source
nobody was editing while the build succeeded and the typecheck passed. Do not
remove that line, and do not check compiled `.js` in next to `.tsx`.
