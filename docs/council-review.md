# User-council review — Follow the Money

**Reviewed:** build of `apps/web` at bundle `generatedAt 2026-07-29T02:37:27.452Z`
(`isSample: false`, cycle 2026, congress 119, `classification: keyword-fallback`).
**Method:** built the app, served it with `vite preview`, and drove every route with
Playwright — reading rendered `innerText`, measuring computed colours, generating a real
share-card PNG, and cross-checking every claim against the JSON in
`apps/web/public/data/`. Screenshots in `/tmp/council/`.

Five reviewers, five sets of priorities. Consolidated severity table at the end.

---

## 0. What genuinely works (short, because you asked)

- **`LIMITATIONS.md` is the best document in the repo.** Section 5 ("The overlap score is
  a share, not a verdict") and the line *"Low scores are not clean bills of health"* are
  more honest than most funded civic-tech.
- **The methodology page shows its arithmetic.** Step 5 works a score by hand with round
  numbers. Very few tools do this.
- **`PartyTag` really is one style regardless of party** (`components/ui.tsx:33-40`), the
  score ramp really is single-hue, and there is no red/green. The visual nonpartisanship
  claim holds.
- **`npm run audit:repo` passes and `npm test` passes (33 tests).** No telemetry, no
  payments, no accounts. Real.
- **`/reps` now sends nothing at all.** The address box that went to the Census geocoder
  (which sends no CORS header, so it never worked from a browser) was replaced by a
  ZIP-and-town crosswalk shipped with the app, and its privacy panel was deleted rather
  than reworded.

Everything below is what is wrong.

---

## 1. The politically engaged skeptic

*"I came in expecting this to be a hit job on my side. It isn't. It's a hit job on the
other side — which is worse, because you'll never notice."*

### 1.1 BLOCKER — The home page's flagship list is 100% one party

`/` → "Largest overlaps in the current dataset" ships six cards. All six are Democrats:

| # | Member | Party | Bill | Score |
|---|---|---|---|---|
| 1 | Alexandria Ocasio-Cortez | D | HRES 1427 | 80% |
| 2 | Rashida Tlaib | D | HRES 1427 | 63% |
| 3 | Elizabeth Warren | D | SRES 700 | 63% |
| 4 | Greg Casar | D | HRES 1427 | 58% |
| 5 | Greg Casar | D | HR 7471 | 58% |
| 6 | Greg Casar | D | HR 6371 | 58% |

This is not cherry-picking by me — it is `overlaps.json` sorted by score, which is
exactly what `Home.tsx:22-25` does (`.slice(0, 6)`, no diversification). Extending the
window does not rescue it:

- top 25 overlaps: **24 D / 1 R**
- top 50: **47 D / 3 R**
- top 100: **87 D / 13 R**
- whole 2,000-row bundle: **1,270 D / 728 R**

Congress in this dataset is 274 R / 260 D / 3 I. So the "who looks worst" surface of a
self-described nonpartisan tool is 96% one party at the top and skews 64/36 across the
whole bundle. A reader who lands here and leaves in 30 seconds takes away "Democrats are
the bought ones," which the author does not believe and the data does not support.

**The cause is structural, not editorial**, which is why it is a blocker rather than a
tuning problem — see §3.1. The mechanism is: only PAC money is in the bundle; labor PACs
are a single concentrated industry code while corporate PAC money for Republicans spreads
across a dozen sector buckets; a *share*-based score therefore mechanically rewards
concentration. `labor-unions` is the top matching sector in **137 of the top 200
overlaps**. Ten of the twelve remaining slots are `finance-banking` and
`health-providers`.

The most perverse consequence: **the #1 result in the entire country is a member who
refuses corporate PAC money.** AOC's entire PAC intake in this bundle is $25,110. A single
$20,000 block of union PAC cheques is 79.6% of it. The tool's headline finding is an
artifact of a small denominator, and it reads as an accusation.

### 1.2 SHOULD-FIX — Sector labels do carry a slant, in two places

- **`Ideological & Single-Issue`** is a bucket that holds, in AOC's own donor table,
  "LEAGUE OF CONSERVATION VOTERS ACTION FUND" and "SIERRA CLUB INDEPENDENT ACTION". The
  label reads as pejorative in a way `Banking & Finance` does not. Where does NRA-PVF or
  SBA List land? Same bucket. So the one bucket that mixes left and right advocacy is
  also the one with the loaded name.
- **`Labor Unions` is listed as an industry.** `Party & Leadership Committees`,
  `Super PAC — funding source not visible` and `Government & Public Sector` all got
  carved out as "not industries" with a careful explanation on `/industries`. Union PAC
  money is arguably the same kind of thing — organised political money, not an economic
  sector buying a bill. Whatever the right answer, the current taxonomy is the single
  largest driver of the partisan skew in §1.1 and it was not given the same scrutiny as
  the three buckets that were.

### 1.3 SHOULD-FIX — "Recently active legislation" is neither recent nor sorted

`Home.tsx:26` is `bills.filter(b => b.industries.length > 0).slice(0, 8)` — file order,
not date order. The rendered list runs HR 9968, HR 9969, **HR 4541**, HR 9950, … A reader
cannot tell what selection rule put those eight bills on the national front page, and
"we happened to write them in that order" is not a defensible answer for a tool whose
whole pitch is transparency.

### 1.4 SHOULD-FIX — The bare "48% / 52% / 55%" chips are read as overlap scores

Same section. Each bill gets a chip like `Defense & Aerospace 55%`. That number is
`Math.round(i.confidence * 100)` — the *classifier's* self-assessed confidence
(`Home.tsx:167-172`). It sits eight inches below a section where "80%" meant "overlap
score". Nothing on screen distinguishes them. On the bill detail page the same number is
correctly labelled `classifier confidence 55%`; on the home page the label is dropped.

### 1.5 NICE-TO-HAVE — No way to check for balance

`/reps` offers filters for chamber, state, and sort by name/money/geography. There is no
party filter and no party column in any aggregate view. That reads as scrupulous, and it
also means a skeptic cannot answer "is this thing balanced?" without downloading the
JSON. A published aggregate — "the overlaps in this bundle split 64/36 D/R, here is why"
— would defuse §1.1 far better than silence.

---

## 2. The congressional staffer

*"My boss is on this site next to the words 'High overlap' and a photo. Here is what my
counsel will ask for."*

### 2.1 BLOCKER — The share card strips exactly the qualifiers that make it defensible

I generated a real card. `/tmp/council/sharecard.png`. Verbatim:

> **Labor Unions gave $20K to Alexandria Ocasio-Cortez, who is listed on HRES 1427.**
> "Expressing support for the designation of July 10th as Journeyman Lineworkers Recognition Day."
> Rep. NY-14 · HRES 1427
> **OVERLAP SCORE — 80% — High overlap** *(with an 80%-filled progress bar)*
> Weighted share of this member's disclosed money that came from sectors this bill would affect.
> Correlation, not causation. Public records shown side by side — not proof of influence or wrongdoing.
> github.com/OWNER/follow-the-money · Sources: FEC · Congress.gov

Four separate problems, all of which the on-page version gets right and the card loses:

1. **"who is listed on"** is a euphemism that reads worse than the truth. She is a
   *cosponsor* — the page says so, in a chip, right next to her name. The card knows the
   role (`BillDetail.tsx:129` renders `o.member?.role`) and simply does not pass it into
   the `ShareCardFinding`. "Cosponsor of" is both more accurate and less insinuating than
   "listed on", which implies she was found on a list.
2. **The denominator vanishes.** "gave $20K … 80%" invites the reader to compute a
   $25,000 total. Nowhere on the card does the total appear. The page shows
   "$25.1K disclosed, cycle 2026"; the card does not.
3. **The classifier caveat vanishes.** The page carries "Classified from Library of
   Congress metadata (no language model)" and "classifier confidence 60%". The card
   carries neither. The number 80% is presented at the same epistemic weight as the
   $20,000, which is a hard fact from a filing.
4. **The bill is a ceremonial resolution.** Nothing on the card says so. "80% High
   overlap" on *Journeyman Lineworkers Recognition Day* is a category error that a
   reader has no way to detect from the image.

`lib/sharecard.ts` opens with a comment saying the framing must be "inside the pixels…
so it can never be pushed off the canvas." The disclaimer made it. The three facts that
actually neutralise the number did not.

### 2.2 BLOCKER — `github.com/OWNER/follow-the-money` is baked into every card

`packages/core/src/disclaimer.ts:PROJECT_REPO_URL`. It is painted into every PNG and
printed in the dialog copy: *"…along with github.com/OWNER/follow-the-money, so the caveat
travels with the screenshot."* Except it doesn't — the URL is a placeholder that resolves
to nothing. Every image this tool has ever produced carries a dead attribution link, so a
recipient cannot get back to the caveats. Do not publish with this string in the repo.

### 2.3 BLOCKER — Ceremonial and memorial resolutions are scored

The methodology page states, twice, that this does not happen:

> "Bills with no usable metadata get no tags and no overlap score at all, which for
> ceremonial resolutions and naming bills is the correct answer."

It is not true. **145 of the 293 ceremonial-looking resolutions in the bundle carry a
sector tag**, and **112 of the top 200 overlaps site-wide are on ceremonial resolutions**.
Three live pages my office would send to counsel before lunch:

- **`#/bills/119-sres-799`** — *"A resolution expressing the condolences of the Senate and
  honoring the memory of the victims on the fourth anniversary of the mass shooting at the
  Fourth of July parade in Highland Park, Illinois."* Rendered heading: **"Sectors this
  bill would affect — Firearms — classifier confidence 90%"**, followed by
  **"Members involved, and who funded them — 1 member — Tammy Duckworth"** with a
  "Make a shareable image" button. There is no reading of that page that is not a
  disaster.
- **`#/bills/119-hres-1433`** — a resolution *honoring the life and military service of a
  late Senator*. Tagged `defense 0.5` on a keyword match for the word **"military"**. The
  card I generated for it reads: *"Defense & Aerospace gave $19K to Clay Fuller, who is
  listed on HRES 1433."* on a memorial resolution for a dead colleague.
- **`#/bills/119-hres-1461`** — a resolution honoring a late Congressman described in the
  title as a *"superior attorney"* → tagged **Lawyers & Lobbyists**, on a keyword match
  for "attorney".

None of this is defamation in the legal sense. All of it is the raw material for a bad
faith screenshot, and the person hurt is a member who did nothing but cosponsor a
condolence resolution.

### 2.4 BLOCKER — The site asserts a fact about my boss's finances that is false

Every rep page, every bill page, every card. AOC's page:

> **TOTAL DISCLOSED — $25.1K — Itemized hard money, cycle 2026 FEC**

and the generated sentence (`packages/core/src/overlap.ts:describeOverlap`):

> "about 80% of Alexandria Ocasio-Cortez's **disclosed itemized contributions** came from
> those industries"

Both are wrong, and wrong in a way that is checkable in one click on the FEC link the page
itself provides. "Itemized" is an FEC term of art meaning contributions above the
itemization threshold — overwhelmingly *individual* money. The pipeline reads only
`pas2` (committee-to-candidate). So the field named `totalItemized` contains PAC money and
nothing else, and the UI labels it "itemized hard money". The correct sentence is "80% of
the $25,110 in **PAC money** disclosed to her committee". The difference between those two
sentences is roughly three orders of magnitude, and it is the difference between a boring
true statement and a false one.

The coverage note ("Individual-donor detail is NOT included… Only committee (PAC) money is
present") exists, but it lives at the bottom of the home page and in a paragraph on the
rep page that begins "$0 has no employer to classify" — not in the label, not in the
headline stat, and not on the share card.

### 2.5 SHOULD-FIX — "Members involved" includes members who were never involved

`Step 6` is honest about this in prose — *"a member can appear against a bill they have
never mentioned"* — but the section heading a reader actually sees is **"Members involved,
and who funded them"**, with a count: **"143 members"**. For HRES 1427 that is every
cosponsor plus the whole Energy & Commerce committee. "Involved" is doing work the
methodology explicitly disclaims. Rename it to something the page can defend — "Members
in a position to act on this bill", or split sponsors/cosponsors from committee members.

### 2.6 SHOULD-FIX — Sponsor rendered as a raw ID

`#/bills/119-hr-9967` sidebar: **"Sponsor N000147"**. Not a name, not a link. Any page
that names a member in the money section should name them in the provenance section too.
Same page: latest action text names three committees, and **"COMMITTEES OF JURISDICTION —
None recorded."**

---

## 3. The data journalist

*"I tried to reproduce one score from what's on the screen. It doesn't reproduce."*

### 3.1 BLOCKER — The displayed inputs do not produce the displayed output

I picked the top result on the site and did the arithmetic by hand from the "Show how this
number was built" table on `#/bills/119-hres-1427`. Verbatim, the only row:

| Sector | Disclosed to member | Share of their money | Bill relevance | Contribution to score |
|---|---|---|---|---|
| Labor Unions | $20K | 79.6% | **60%** | **79.6 pts** |

A reader with a calculator does `0.796 × 0.60 = 0.478` and gets **48%**, not the 80% the
page shows. The "Bill relevance" column is *not* the multiplier. The real multiplier is
`billWeight = confidence / Σ confidence`, and because this bill has exactly one surviving
tag, `Σ confidence = 0.60` and the weight is **1.0**. The confidence cancels out entirely.

**This is the majority case, not an edge case: 292 of the 583 tagged bills (50.1%) have
exactly one surviving tag.** For all of them the "Bill relevance" column is decorative,
and the table as laid out is actively misleading about how the number was built. The
methodology page's worked example (Step 5) uses an invented two-tag bill precisely because
that is the case where the column does something — it never shows the degenerate case that
covers half the dataset.

The underlying arithmetic *is* correct and does reconcile: $20,000 / $25,110 = 0.7965,
weight 1.0, score 0.7965. The bug is entirely in the presentation. Add the `Σ C` and the
computed weight as a visible column, or a footer row showing `ΣC = 0.60 → weight 1.00`.

### 3.2 BLOCKER — `Federal spending` headline is $5.7 trillion and should not be

`#/spending` → **"VALUE OF THOSE AWARDS — $5.7T — Sum of the filtered rows"** over 1,682
awards. That is 83% of total annual federal outlays, from under two thousand rows. It is
wrong for two compounding reasons:

- The top rows are **Medicaid formula entitlement transfers to state health agencies**,
  not contracts or grants in the sense the page's own copy uses ("a procurement or grant
  process… usually competed"). The single largest row is
  `HEALTH CARE SERVICES, CALIFORNIA DEPARTMENT OF — $111,733,918,965 — BLOCK GRANT (A) —
  "MEDICAID ENTITLEMENT FOR 7 - FY 2026 - T19"`.
- **The same award appears five times.** Five California Medicaid rows, ~$465B combined,
  covering different fiscal years, all summed into one headline. `NYS DEPARTMENT OF
  HEALTH` appears with `Oct 1, 2024` and `Oct 1, 2025` rows both counted. `MCKESSON
  CORPORATION / EXPRESS REPORT: PHARMACEUTICAL PRIME VEN…` appears **19 times**.

Publishing a $5.7T number with no caveat next to it, on a page that also displays campaign
contributions, is the single most overstated figure on the site.

### 3.3 BLOCKER — Award sector classification is broken badly enough to invert conclusions

564 awards come from the Department of Defense. **Eleven** of them are tagged
`Defense & Aerospace`. The rest land in Manufacturing (357), Technology (56), Water & Waste
(38), Transportation (35), Construction (30), Banking & Finance (22). Two live examples:

- `RAYTHEON COMPANY — "UKRAINE NASAMS 6 LOT PROCUREMENT"` → tagged **Water & Waste**.
  It is rendered on `#/industries/waste-water` under "Federal money going the other way".
- `NORTHROP GRUMMAN SYSTEMS CORPORATION — "CONTRACTOR LOGISTICS SUPPORT"` → tagged
  **Transportation**.

Consequence: `#/industries/defense` shows almost no federal money going to defense, and
`#/industries/waste-water` shows missile procurement. Any reader comparing "money in" to
"money out" per sector gets the answer backwards.

### 3.4 SHOULD-FIX — Two different totals for the same quantity, on the same site

- Home page coverage note: *"**$188,630,223** of the money shown came from
  independent-expenditure committees…"*
- `#/industries` sector table: `Super PAC — funding source not visible — Disclosed
  **$37.3M**`

A 5× discrepancy for the same bucket. The industries page does explain that its column is
a floor built from each member's top-3 sectors only — but it never reconciles against the
$188.6M figure the reader saw ten minutes earlier, and the two numbers are never on screen
together. Show the reconciliation.

### 3.5 SHOULD-FIX — Silent truncation of the overlap set

`index.json` says `overlaps: 4476` and `/methodology` prints **"OVERLAPS COMPUTED —
4,476"**. `export.ts:523` ships `.slice(0, 2000)`. Every aggregate view that reads
`overlaps.json` — including `#/industries/:id` → "Where this sector shows up in an
overlap" and the home page list — is computed over a **top-score-truncated** sample and
presented as if it were the whole. That is precisely the sampling error a journalist would
be fired for. Either ship all 4,476 (the file is 1.4MB; the full set is not prohibitive) or
label every derived view "top 2,000 by score".

### 3.6 SHOULD-FIX — Provenance is real, with one dead link

I resolved the outbound links. `fec.gov/data/candidate/H8NY15148/?cycle=2026` → 200.
`fec.gov/data/committee/C00003251/?cycle=2026` → 200.
`govinfo.gov/bulkdata/BILLSTATUS/119/hres/BILLSTATUS-119hres1427.xml` → 200. Congress.gov
403s to an automated client, which is their bot policy, not a broken link. **Provenance is
genuinely good** and this is the strongest part of the project.
`github.com/OWNER/follow-the-money` is the one dead link, and it is on every share card
(§2.2).

### 3.7 NICE-TO-HAVE — The keyword classifier's failures are quotable

`HR 9961 — "To prohibit the use of campaign contributions or **legal defense funds** to pay
settlements or penalties related to sexual assault, sexual abuse, and sexual harassment
claims"` → tagged **Defense & Aerospace**, rationale (verbatim from the data):
*"Keyword match on \"defense\" in the bill text."* It is on the home page right now, with
a `Defense & Aerospace 55%` chip.

Others: `HR 9950 (healthy food in military commissaries)` → Defense, on "military".
`HR 9968 (barriers to participation in USDA organic programs)` → **Government & Public
Sector**, on "Department of Agriculture" — a sector that has $0 of money in it, so the
overlap is structurally zero forever. `HRES 1442 (National Moon Landing Day)` → Technology
0.70 + Telecom 0.55. `SRES 798 (Great Outdoors Month)` → Mining 0.45 + Oil, Gas & Coal
0.40.

Every one of these is honestly labelled on its own page. None of them is labelled on the
home page or the share card.

---

## 4. The first-time non-expert visitor

*"Ten seconds in, I mostly get it. Two minutes in, I've drawn the wrong conclusion."*

### 4.1 The 10-second test: passes

The headline — *"Public money records and public legislative records, side by side"* —
plus the bolded *"It does not tell you why anyone voted the way they did, because it cannot
know"* is genuinely clear. The paired "What this shows / What it does not show" columns are
the best onboarding on the site. Good.

### 4.2 BLOCKER — The mental model I leave with is conspiratorial anyway

Not because of the disclaimers — they're everywhere — but because of what's *under* them.
I scrolled past four paragraphs of "correlation, not causation" and then read six cards
that all say the same thing: a named person, a photo, a big percentage, the word **"High
overlap"**, and a dollar figure. Six for six, same party. My brain does not store the
paragraph; it stores "AOC, 80%, labor unions".

Then I clicked through to the bill, which turns out to be **Journeyman Lineworkers
Recognition Day** — a resolution that does nothing at all. At that point one of two things
happens: I don't notice (and keep the false impression), or I do notice (and conclude the
whole site is junk). Neither is the outcome you want. The disclaimer copy is not the
problem. The example selection is.

### 4.3 SHOULD-FIX — The disclaimer has become wallpaper, and it's measurable

Count of times a first-time visitor reads a variant of "correlation, not causation" before
reaching any actual data:

1. Sticky bottom banner (present on every route, undismissable).
2. Home hero, bolded.
3. "What it does not show" column.
4. Paragraph above the overlap cards.
5. `OVERLAP_BAND_NOTE` under each of the six cards.
6. Seven coverage notes.
7. Full `DISCLAIMER_LONG` in "Read this before you draw a conclusion".
8. Footer, again.

Eight. On one page. By #4 I am skimming; by #6 I am scrolling past a grey box on reflex —
including the six coverage notes that contain the *actually load-bearing* caveat ("only
committee (PAC) money is present"). The generic warning has crowded out the specific one.
Cut the repetitions and put one sentence where it matters: *on the card, next to the 80%,*
say "this is 80% of $25,110 in PAC money".

### 4.4 SHOULD-FIX — Jargon that is never explained where it's used

Explained well somewhere, unexplained at the point of use:

- **"itemized hard money"** — appears in the home stat sub-label and the rep page stat.
  Explained nowhere on either page. (And is wrong here anyway — §2.4.)
- **"Cosponsor"** — chip next to a name, no tooltip. A first-timer does not know this is
  a costless signature that hundreds of members add to ceremonial resolutions. That single
  gap is what turns HRES 1427 into a scandal in a lay reader's head.
- **"H.RES." vs "H.R."** — the difference between "a nonbinding expression of sentiment"
  and "a law" is the single most important thing a non-expert needs to know on this site,
  and it is conveyed only by one letter in a monospace font.
- **"classifier confidence"** — the word "classifier" is never defined in the UI.
- **`overlaps.json` "score"** presented as a percentage with no unit and no baseline.
  LIMITATIONS.md says "there is no 'expected' overlap to compare against" — that sentence
  belongs next to the number, not in a separate file.

### 4.5 NICE-TO-HAVE — Two search boxes, both empty, both on screen

At 375px the header search and the hero search are visible simultaneously with different
placeholders ("Search…" and "Search members, bills, sectors, contractors…"). Both carry
`aria-label="Search everything"`. Pick one.

---

## 5. The accessibility and mobile user

Tested at **375×812**, `deviceScaleFactor 2`, `isMobile`, `hasTouch`. Contrast computed
from live `getComputedStyle` values against the resolved ancestor background, WCAG 2.1
formula.

### 5.1 BLOCKER — The sticky disclaimer covers content on mobile

`/tmp/council/m_.png` shows it. Two sticky regions:

| Element | position | height |
|---|---|---|
| `<header class="sticky top-0 z-30 …">` | sticky top | **142.5px** |
| `<div class="sticky bottom-0 z-40 …">` | sticky bottom | **141.3px** |

283.8px of a 812px viewport — **35% of the screen is permanently chrome**. Worse, the
bottom banner is `bg-paper-raised/95 backdrop-blur`, so it does not merely occupy space,
it **occludes**: in the screenshot the "MEMBERS TRACKED 537" and "BILLS 1,477" figures are
sliced through the middle and the sub-labels ("FEC cycle 2026 · itemized hard money only")
are legible-but-blurred underneath. There is no `padding-bottom` on `<main>` to reserve the
space, and the banner cannot be dismissed by design. On a phone, the guarantee that the
disclaimer is always visible is being purchased with the readability of the data.

### 5.2 BLOCKER — Horizontal page scroll on three route types

`document.scrollWidth` vs `clientWidth` at 375px:

| Route | scrollWidth | overflow |
|---|---|---|
| `#/bills/119-hres-1427` | **435** | 60px |
| `#/industries/labor-unions` | **435** | 60px |
| `#/reps/O000172` | **452** | 77px |

Cause on the bill/industry pages is the `MethodTag` chip — `"Classified from Library of
Congress metadata (no language model)"` renders at `right: 434.6px` and pushes the document
(visible clipped in `/tmp/council/m_bills_119-hres-1427.png`). On the rep page it is
`<table class="w-full min-w-[34rem]">` (544px) inside an `overflow-x: auto` wrapper that is
itself wider than the viewport. Whole-page horizontal scrolling is a WCAG 1.4.10 Reflow
failure and makes the sticky banner drift off-screen sideways.

### 5.3 SHOULD-FIX — `--ink-4` fails WCAG AA everywhere it is used

`--ink-4: #868f98` on `--paper: #fbfbfa` measures **3.17:1**; on `--paper-raised: #ffffff`
it measures **3.28:1**. AA requires **4.5:1** for normal text. Measured failures on every
page tested. It is not a decorative token — this is what it renders:

- `"Try a surname, a bill number, a sector, or a federal contractor…"` (12.5px) — the
  only instruction for the primary search control.
- Every `.label` — `MEMBERS TRACKED`, `DISCLOSED CONTRIBUTIONS`, `COMMITTEE MEMBERSHIPS`,
  `COMMITTEES OF JURISDICTION` (11px, 600).
- Every stat sub-label, including `"FEC cycle 2026 · itemized hard money only"` — i.e.
  the coverage caveat itself is the least readable text on the page.
- `"Read it on Congress.gov"`, `"All bills →"`, `"usaspending.gov record"` — source links.
- The `"79.6%"` figures in the donor bar chart.
- On `#/spending`: the short disclaimer line itself.

`#868f98` needs to go to roughly `#6a737c` to clear 4.5:1 on `#fbfbfa`. Dark mode
`--ink-4: #6f7a83` on `--paper: #14181b` has the same problem in reverse.

### 5.4 SHOULD-FIX — Tap targets below 24×24 CSS px, in bulk

WCAG 2.2 SC 2.5.8 (Target Size Minimum, AA) requires 24×24. Measured at 375px, count of
interactive elements failing on each page: home **40+**, bill detail **40+**, rep detail
**37**, industry detail **40+**, spending **40+**, methodology 15. Representative:

| Element | rendered size |
|---|---|
| `All bills →` | 56.4 × **14** |
| `Labor Unions` (largest-shared-sector link) | 82 × **15** |
| `Bills` (breadcrumb) | 25.5 × **15** |
| `HR 5658` (bill number link) | 50.6 × **18** |
| `FEC filings` | 76.4 × **18** |
| `Their congress.gov page` | 161.8 × **18** |

These are all inline links in 12–13px text with no vertical padding. Adding
`py-1.5 -my-1.5` to inline link classes fixes most of them without changing layout.

### 5.5 SHOULD-FIX — The search combobox never sets `aria-activedescendant`

`GlobalSearch.tsx` gets most of this right: `role="combobox"`, `aria-expanded`,
`aria-controls="global-search-results"`, a `role="listbox"`, `role="option"` children, and
`aria-selected={i === cursor}` (line 154). But the input never gets
`aria-activedescendant`. I typed "warren", pressed ArrowDown six times, and read
`document.activeElement` each time: the focused element stays `<input>` and
`aria-activedescendant` is `null` on all six presses. A sighted mouse user sees the
highlight move; a screen-reader user is told nothing at all. The options also have no
`id`s, which is what `aria-activedescendant` would need. Also missing:
`aria-autocomplete="list"` and `aria-haspopup="listbox"`.

### 5.6 SHOULD-FIX — No skip link

No "Skip to content" anywhere in `src/`. `<main>` exists (`App.tsx:137`) but is not
targetable. A keyboard user hits the logo, the header search, and five nav links on every
single route before reaching content. Tab order is otherwise sane and **focus visibility is
good** — `outline: solid 2px rgb(31, 95, 91)` on every one of the 18 elements I tabbed
through, and the share-card dialog correctly returns focus to its trigger on close.

### 5.7 SHOULD-FIX — Nav overflows with no affordance

Header nav renders `Federal spending` clipped mid-word as "Federal sper" and `Method` fully
off-screen (measured `right: 472.6px` in a 375px viewport). It is a horizontally
scrollable strip with no scrollbar, no fade, and no gradient — a first-time mobile user has
no way to know `/methodology` exists, which is the one page that would fix half the
problems in §4.

### 5.8 NICE-TO-HAVE — Heading order is clean

Checked every route: exactly one `<h1>`, no skipped levels, no heading used for styling.
Genuinely good and worth keeping.

---

## 6. Data findings (independent of any UI fix)

Things that are wrong in `apps/web/public/data/`, not in the presentation layer. These
survive any amount of copy editing.

| # | Finding | Evidence |
|---|---|---|
| D1 | Top overlaps are 96% one party, and the mechanism is that a *share*-based score rewards donor-base concentration. Labor PACs are one bucket; corporate PACs spread across ten. | top-25: 24D/1R. `labor-unions` is top match in 137/200. |
| D2 | The bundle's #1 finding is a small-denominator artifact from a member who refuses corporate PAC money. | AOC `totalItemized: 25110`; one $20K union block = 79.6%. |
| D3 | `totalItemized` contains only `pas2` committee-to-candidate money but is labelled "itemized hard money" in the UI — an FEC term that means the opposite. | `packages/ingest/src/lib/fecbulk.ts` reads `pas2` only. |
| D4 | 52 of the top 100 overlaps nationally are a single ceremonial resolution, HRES 1427. | `Counter(billId)` over top 100. |
| D5 | 145 ceremonial resolutions carry sector tags; 112 of the top 200 overlaps sit on them — contradicting the methodology page's explicit claim. | regex over titles + tag filter. |
| D6 | 292 of 583 tagged bills (50.1%) have exactly one surviving tag, so the "Bill relevance" column divides out and the shown table doesn't reproduce the shown score. | `confidence >= 0.25` filter. |
| D7 | `$5.7T` spending headline is Medicaid entitlement transfers, with the same award counted up to 19 times. | `MCKESSON…PRIME VEN` ×19; CA Medicaid ×5 (~$465B). |
| D8 | 564 DoD awards, 11 tagged Defense. Raytheon NASAMS → `waste-water`; Northrop logistics → `transport`. | `Counter(industry)` over DoD awards. |
| D9 | `overlaps.json` is `.slice(0, 2000)` of 4,476, but the methodology page prints 4,476 and every aggregate view reads the truncated file. | `export.ts:523`. |
| D10 | `super-pac-unattributed` reported as `$188.6M` (home) and `$37.3M` (industries) with no reconciliation. | `index.json` vs `industries.json`. |
| D11 | `Government & Public Sector` has 104 bills tagged and **$0** of money, so 104 bills can only ever score 0. | `/industries` sector table. |
| D12 | `SUPPORTING_TX_TYPES` includes `24E` (independent expenditure **in support**) and `22Y` (refund) alongside genuine `24K` contributions, all summed as money "given to" a member — while `24A` (spending **against**) is excluded. A group that spends $5M attacking a member counts zero; $5M supporting counts as if the member banked it. | `packages/ingest/src/lib/fecbulk.ts:116-117`. |
| D13 | No member page has any federal awards — the "Federal awards in NY-14" section is empty on all 537 rep pages because district matching never hits. | `sum(len(awards))` over `member/*.json` = 0. |
| D14 | Every page load fetches member portraits from `unitedstates.github.io`, telling a third party which member the reader is looking at — while `/reps` says *"no query leaves this device"* and the README says "no telemetry". `audit-repo.mjs` misses it (its outbound-host scan found only `nodejs.org`). | Playwright request interception. |

---

## 7. Consolidated findings

| Severity | Finding | Page / file | Suggested fix |
|---|---|---|---|
| **Blocker** | Home "Largest overlaps" is 6/6 one party; top-100 is 87/13 | `apps/web/src/pages/Home.tsx:22-25` | Don't rank by raw score. Require a minimum denominator (e.g. $100K PAC total), exclude ceremonial bill types, dedupe by member, and publish the party split of the full bundle on the page. |
| **Blocker** | Ceremonial/memorial resolutions are tagged and scored, contradicting the methodology page | `packages/ingest/src/classify.ts`; `#/bills/119-sres-799`, `119-hres-1433` | Hard-exclude `hres`/`sres`/`hconres`/`sconres` with no legislative effect, plus title patterns (`designating`, `honoring`, `commemorating`, `expressing the condolences`). Make the methodology claim true. |
| **Blocker** | Share card omits role, denominator, classifier caveat and bill type | `apps/web/src/lib/sharecard.ts:234-242`; `pages/BillDetail.tsx:158-170` | Pass `role` and `totalItemized` into `ShareCardFinding`. Headline → "Labor Unions PACs gave $20K of the $25.1K disclosed to X, a cosponsor of HRES 1427." Print the classifier method in the footer band. |
| **Blocker** | `github.com/OWNER/follow-the-money` painted into every generated PNG | `packages/core/src/disclaimer.ts` | Set the real URL, or make it a required env/config value and fail `audit:repo` while it is a placeholder. |
| **Blocker** | "itemized hard money" / "disclosed itemized contributions" describes PAC-only money | `packages/core/src/overlap.ts:describeOverlap`; `pages/RepDetail.tsx` stat label | Rename the field and every label to "PAC / committee money" whenever `sources.openfec === 'bulk'`. Never use "itemized" for `pas2` data. |
| **Blocker** | The breakdown table's inputs don't produce its output for 50% of bills | `pages/BillDetail.tsx:174-205` | Add a `Weight (C / ΣC)` column and a `ΣC = …` footer row. When there is one tag, say so: "single tag → weight 1.00; confidence does not affect this score." |
| **Blocker** | `$5.7T` federal-spending headline; duplicate awards; entitlement transfers presented as contracts | `pages/Spending.tsx`; `packages/ingest/src/usaspending.ts` | Dedupe by award ID, exclude `BLOCK GRANT (A)` / `FORMULA GRANT (A)` from the headline sum (or split "contracts" from "transfers"), and show the count and date range next to the total. |
| **Blocker** | 564 DoD awards, 11 tagged Defense; Raytheon → Water & Waste | `packages/ingest/src/classify.ts` (award path) | Use the awarding agency + NAICS/PSC as the primary signal for awards, keyword text only as a tiebreaker. |
| **Blocker** | Sticky header + sticky banner consume and occlude 35% of a 375×812 viewport | `apps/web/src/App.tsx` | Collapse the mobile banner to one line with a "why?" expander; add `padding-bottom` to `<main>` equal to the banner height so nothing is ever underneath it. |
| **Blocker** | Whole-document horizontal scroll on bill / industry / rep detail at 375px | `components/ui.tsx` `MethodTag`; `pages/RepDetail.tsx` table | Let the `MethodTag` chip wrap (`whitespace-normal`, `max-w-full`). Constrain the table wrapper to `max-w-full overflow-x-auto` inside a `min-w-0` parent. |
| Should-fix | Bare `48%` / `55%` chips on the home page are classifier confidence, unlabelled | `pages/Home.tsx:167-172` | Label them `conf. 55%` or drop the number on this surface. |
| Should-fix | "Recently active legislation" is unsorted file order | `pages/Home.tsx:26` | Sort by `latestActionDate` desc and say so. |
| Should-fix | `--ink-4` (#868f98) at 3.17:1 fails AA on every page, including the caveat text | `apps/web/src/styles.css:30,60` | Darken to ≈`#6a737c` (light) and lighten the dark-mode value; re-measure. |
| Should-fix | 37–40 tap targets under 24×24 per page | `components/ui.tsx`, `.link` in `styles.css` | Add `inline-block py-1.5 -my-1.5` to inline link styles. |
| Should-fix | Combobox never sets `aria-activedescendant`; options have no `id`s | `components/GlobalSearch.tsx:120-155` | Give each option an `id`, set `aria-activedescendant` from `cursor`, add `aria-autocomplete="list"`. |
| Should-fix | No skip link | `apps/web/src/App.tsx:137` | Add a visually-hidden-until-focused `<a href="#main">Skip to content</a>`. |
| Should-fix | `overlaps.json` silently truncated to top 2,000 of 4,476 | `packages/ingest/src/export.ts:523` | Ship all of them, or label every derived view "top 2,000 by score". |
| Should-fix | Super PAC total is $188.6M in one place and $37.3M in another | `index.json` coverage note vs `industries.json` | Show both with the reconciliation, on the same screen. |
| Should-fix | "Members involved, and who funded them — 143 members" includes members with no involvement | `pages/BillDetail.tsx:107-109` | Rename to "Members in a position to act on this bill" and group by sponsor / cosponsor / committee. |
| Should-fix | Member portraits hotlinked from `unitedstates.github.io` contradict "no telemetry" / "no query leaves this device" | `components/ui.tsx:115-140`; `scripts/audit-repo.mjs` | Vendor the portraits into the bundle at build time, or gate them behind an opt-in and say so on `/reps`. Extend `audit:repo` to scan built assets for outbound hosts, since it currently misses this. |
| Should-fix | `24E` (independent expenditure) and `22Y` counted as money "given to" a member; `24A` excluded | `packages/ingest/src/lib/fecbulk.ts:116-117` | Separate direct contributions from independent expenditures in the totals, and either count `24A` as a negative signal or document the asymmetry on `/methodology`. |
| Should-fix | Jargon unexplained at point of use: "cosponsor", "H.RES. vs H.R.", "itemized", "classifier" | all pages | Inline `<abbr>`/tooltip. The `H.RES.` distinction matters most — a one-line "this resolution has no legal effect" badge on ceremonial bill types would defuse §2.3 and §4.2 at once. |
| Should-fix | Header nav clips `Federal spending` / `Method` with no scroll affordance at 375px | `App.tsx` nav | Add a fade/gradient edge, or wrap to two rows on small viewports. |
| Should-fix | Disclaimer repeated 8× on the home page; the specific caveat (PAC-only) is buried among generic ones | `pages/Home.tsx` | Cut to 2–3 placements. Promote the PAC-only note into the stat sub-label and onto the card. |
| Nice-to-have | Sponsor rendered as `N000147`; "COMMITTEES OF JURISDICTION — None recorded" while the action text names three | `pages/BillDetail.tsx` sidebar | Resolve to the member's name and link it; parse committees from the referral text as a fallback. |
| Nice-to-have | Two search boxes visible at once on mobile, identical `aria-label` | `App.tsx` + `pages/Home.tsx` | Hide the header search on the home route, or give them distinct labels. |
| Nice-to-have | 537 rep pages show an always-empty "Federal awards in [district]" section | `export.ts:385-386`; `pages/RepDetail.tsx` | Fix the district join, or hide the section when the award set has no district coverage. |
| Nice-to-have | `Ideological & Single-Issue` label reads pejorative; `Labor Unions` treated as an industry while three comparable buckets were carved out | `packages/core/src/industries.ts` | Rename to "Advocacy & Single-Issue"; document explicitly why union PACs are an industry and party committees are not. |
| Nice-to-have | No way for a reader to check the site for partisan balance | `/methodology` | Publish the party split of the shipped overlap set and an explanation of the concentration effect. |
| Nice-to-have | `Government & Public Sector` has 104 tagged bills and $0 of money | `industries.ts` / classifier | Either give it money or stop tagging bills into a bucket that can never score. |

---

## 8. The one-sentence version

The framing infrastructure is real and better than most published tools — and it is
currently wrapped around a dataset whose top result is a member who refuses corporate PAC
money, cosponsoring a resolution that designates a commemorative day, scored 80% off a
$25,000 denominator, on a share card that says "gave $20K" and links to
`github.com/OWNER`. Fix the selection and the labels before shipping; the disclaimers are
already doing all the work they can.
