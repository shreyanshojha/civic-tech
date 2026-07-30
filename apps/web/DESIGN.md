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

Every bar on this site is **one hue**, filled from the neutral ink ramp, and
encodes size with **length alone**. Length is a quantity. Hue is a judgement.
These charts are only allowed to express a quantity. A large figure about a
member is not "bad": a member whose donors sit in the industries of their own
district is, in the overwhelming majority of cases, a member who sits on a
committee relevant to that district, which is how the institution is designed to
work. Rendering that in red would state a conclusion the data cannot support, in
a channel the reader processes before they read a word of the caveat next to it.

`.ramp-0` … `.ramp-3` used to exist for the member×bill overlap score. That score
was cut from every page — three independent evaluations found it was the
product's headline metric and was worthless, and the site's own `/how-to-read`
called it "a bookmark, not a finding" — and the four fills went with it. The rule
above outlives them and governs the sector bars, the cohort plot and every bar
added later.

### Amber is reserved

`--caveat` amber means exactly one thing: *this data has a gap or a limit you
need to know about before you read the number.* It is never a severity, never a
warning about a person, never "attention". If a block is amber, a reader must be
able to assume it is talking about the dataset, not about a legislator.

### Qualifications come in three kinds and must look like three kinds

This is the correction to the mistake that did the most damage in testing. Every
qualification on the site used to be an amber `.caveat` box: the correlation
boilerplate, the coverage gaps, and the one sentence that said how much of the
number in front of the reader was missing. Same colour, same shape, same size,
up to three per screen, and the boilerplate was the loudest of them.

Two things followed. Readers habituated and skimmed all of it, so the caveat
that changed a specific number was skipped along with the boilerplate they had
already read six times. And a low-trust reader read the *volume* of amber as a
motive — "nobody puts a disclaimer that big on the front door unless a lawyer
made 'em" — and then read every gap the site was honest about as something being
hidden. The hedging produced the opposite of its intent.

So there are three tiers, and they are visually distinct:

| tier | what it says | how it looks | how many |
|---|---|---|---|
| `.data-limit` | a fact about **this number** — "60% of this member's money has no industry attached"; "these are their three largest sectors only" | amber ink, 2px amber rule, **no fill**, inline, directly under the figure, at the size of the copy around it | as many as there are figures that need one |
| `.caveat` / `<CoverageNote/>` | a gap in **the whole dataset** — no votes in this bundle, awards truncated to the largest few thousand | the amber box, unchanged | at most one per claim, never the same sentence twice |
| `.framing-note` / `<FramingNote/>` | correlation-not-causation | **not amber** — accent rule on `--accent-soft` | exactly **one** per screen |

Three rules follow from the table and are the ones worth enforcing:

1. **A data limit is never folded and never shrunk.** It used to be `text-2xs`
   in `--ink-4` — the smallest, faintest text on the site — carrying the most
   decision-relevant sentence on the page. It is now at least `text-sm` and sits
   next to the number rather than in a footnote.
2. **Framing is not a data gap, so it is not amber.** Giving the boilerplate the
   colour reserved for real gaps is most of why the colour stopped meaning
   anything. `<FramingNote/>` carries `DISCLAIMER_MEDIUM` and nothing else.
3. **A page never repeats the persistent banner's own sentence.** The banner
   says `DISCLAIMER_PLAIN`; an on-page framing block therefore says the *fuller*
   version, so a reader who reads both gets more rather than the same thing
   twice. Measured before this pass: seven of eleven routes printed the banner's
   sentence a second time, one printed it a third. Now zero do.

Do not "improve" a page by adding a second framing block. If a section feels
like it needs one, the caveat it actually needs is a `.data-limit` about the
number in it.

**A framing block is one per screen, not one per screenful.** `<FramingNote/>`
usually sits under the page title; on `/reps` it sits above the members list
instead. That is deliberate: 206 vertical pixels at 375px between the title and
the first control put the address input at ~865px, under both the fold and the
sticky disclaimer bar, on a 375×667 phone — the reader could not see the control
she came for. It is still exactly one block, still the full `DISCLAIMER_MEDIUM`
wording, still unfolded and unshrunk; it just sits next to the figures it frames
rather than above two controls that produce none. Moving it is allowed. Folding
it, shrinking it, or adding a second one is not.

### A repeated caveat is one caveat, said once

The same sentence printed on every row of a list is not N times the care. It is
how a reader learns to skip the class of thing it belongs to, and — measured in
testing — how a low-trust reader reads volume as motive.

So: **a qualification that is identical across the rows of a list is stated once,
above the list, and suppressed on the rows.** It is only legal in a list, and only
when the list carries the equivalent statement.

The worked example of this rule used to be the per-row band note under each
overlap score, said once above the list by `bandNoteFor()` / `distinctBands()`.
The score, the notes and those two helpers are all gone. The rule is not: the
`.data-limit` under a member's sector bars is one statement about every bar above
it, and `PATTERN_LIMITS` is stated once per patterns page rather than once per
comparison.

Measured on a member page (`/reps/A000055`), counting `.data-limit`, `.caveat`,
`.framing-note`, per-row band notes and unmarked prose qualifiers:

| view | before | after |
|---|---|---|
| quick (default) | 12 | 8 |
| full | 17 | 10 |

No fact was removed to get there. The two amber notes about the two halves of
the unattributed money were merged into one `.data-limit` attached to the figure
they describe; the two notes under the donor table were merged into one; the
"these are only the largest sectors" sentence stopped being printed twice; and
the band note stopped being printed once per bill.

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
| `text-lg` | 20 px | 1.3 | figures in `<Stat/>`, small figures |
| `text-xl` | 24 px | 1.22 | index-page h1 |
| `text-2xl` | 31 px | 1.15 | detail-page h1 (serif), large figures |
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
- soften or hide a coverage caveat,
- restore the member×bill overlap score. It was removed from every page on
  purpose; `<OverlapScore/>` and `<ScoreExplainer/>` no longer exist. The strings
  behind them still sit in `@ftm/core` for the pipeline and the tests, which makes
  reintroducing them a two-line change and therefore worth naming here.

One thing you now *must* do that you previously did not: **render at most one
on-page framing block per screen, and never the banner's own sentence.** The
banner is the framing; a page that repeats it verbatim is not reinforcing it, it
is teaching the reader to skip it. See §1.

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

## 5b. Layering: short by default, depth on demand

The site is written twice. Not two different claims — one claim at two reading
levels, with the short one on top.

**The rule: fold, never delete.** Every number, table, caveat and coverage note
that exists in full detail view is reachable from quick view in at most one tap.
If a change makes a page shorter by removing a qualification, it is not a
simplification, it is a different claim. Fold it instead.

### The view mode

`?view=quick | full` in the query string, **defaulting to quick**. It lives in
the URL and nowhere else: `scripts/audit-repo.mjs` fails the build if anything
writes a visitor's preference into browser storage or a cookie (its
`client-storage` rule names the exact APIs), and a preference in the URL is also
shareable and survives the back button. See `src/lib/view.ts`.

`<ViewToggle/>` sits in the same place on every page that has one — directly
under the page title. `<Fold>` is the block-level partner: a native `<details>`
whose default open state follows the view mode, so "Everything" behaves like one
control instead of twelve. A reader can still open or close any single fold.

Quick view may:

- use the plain band names (`OVERLAP_BAND_PLAIN`) and the plain score explainer
  (`SCORE_EXPLAINER_PLAIN`) instead of the formal ones,
- use `plainAmount()` / `plainShare()` phrasing next to (never instead of) the
  exact figure,
- show the top 3–5 rows of a list with a control that opens the rest,
- collapse methodology and derivation prose into folds.

Quick view may **not** drop a coverage caveat, a provenance link, or the band
label on a score. The percentage itself never changes between views, and the
formal band label always travels in the accessible name of the score bar.

### The persistent disclaimer

Default text is now `DISCLAIMER_PLAIN` at `text-sm` — a step **larger** than the
`text-xs` it replaced — with `DISCLAIMER_PLAIN_MORE` and the unchanged
`DISCLAIMER_MEDIUM` behind a "Why?" button. This is the one place where making
the framing shorter makes it stronger: the long version was correct and unread.

Everything in §5 still holds. It is still sticky, opaque, undismissable, on
every route, and every string still comes from `@ftm/core/disclaimer.ts`.

### Plain language

Target roughly 6th–8th grade in body copy: short sentences, active voice, no
term of art without a gloss. Terms of art get `<Term k="…"/>` from
`components/Glossary.tsx`, which opens a definition inline on tap — not a
`title=` tooltip, which does not exist on a phone. Definitions live in
`lib/glossary.ts`.

Measured on the visible text of a page in quick view, prose sentences only
(headings, chips and table cells excluded):

| page | Flesch-Kincaid before | after | avg sentence before | after |
|---|---|---|---|---|
| home | 11.0 | 7.5 | 16.6 words | 12.1 words |
| bill detail | 10.9 | 5.4 | 18.5 words | 11.0 words |

### The money-flow diagram

`components/MoneyFlow.tsx`. Two connectors, drawn differently on purpose: a
solid ribbon (thickness = amount) for sector → member, which is a disclosed
payment, and a thin dashed line labelled "worked on" for member → bill, which is
a role and carries no money. One unbroken flow would read as "this money bought
this bill" — the exact claim the project refuses to make. Everything in the
picture is repeated in the labelled list under it and in its `aria-label`; the
graphic is never the only channel.

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

Heading order is verified per route: exactly one `h1` and no skipped levels, on
every route including the not-found page. Card titles are real headings (`h3`/`h4`
carrying `.label`), not styled `<div>`s, so "jump to the next heading" reaches
them.

### Route changes are announced, and the skip link is a button

Both of these were bugs, and the first one was severe.

`<a href="#main">` under a `HashRouter` does not jump to an element. The whole
route lives in `location.hash`, so activating it *replaced* the route with
`#main`, which matches nothing — the router rendered "Page not found" and the
page vanished. It was the first tab stop on every page, so the one control built
specifically for keyboard users was the fastest way for a keyboard user to
destroy the page they were reading. It is now a `<button>` that sets
`tabindex="-1"` on `<main>` and focuses it, and touches the URL not at all.

`<RouteAnnouncer/>` in `App.tsx` does three things on every navigation: sets
`document.title` to the page's own `h1` (all eleven routes previously shared one
title), moves focus to that `h1` with `tabindex="-1"`, and announces the same
subject through a visually-hidden `role="status"`.

It reads the `h1` through a `MutationObserver` rather than once, and ignores an
`h1` that is the same node *and* the same text as the one it last announced.
That guard is not defensive coding: while a lazy route chunk is downloading,
React keeps the previous page's markup on screen, so reading the `h1` when the
pathname changes gets the heading of the page the reader just left. Measured
during this pass: every route announced the title of the route before it.

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
| `.caveat` | dataset-level data-gap notices only. The 3px left rule is load-bearing: it survives forced-colours and print, where the amber fill does not, so a caveat cannot quietly stop looking like a caveat |
| `.data-limit` | a limit on **one figure**, inline and adjacent to it. Amber ink and rule, no fill. Never folded, never below `text-sm`. See §1 |
| `.framing-note` | the correlation-not-causation block. **One per screen**, accent not amber, text from `DISCLAIMER_MEDIUM`. See §1 |
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
