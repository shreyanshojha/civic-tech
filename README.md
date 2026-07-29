# Follow the Money

**Public money records and public legislative records, side by side.**

An open-source tool for reading disclosed campaign contributions next to legislative
activity. It shows you where the two overlap and links every figure back to the
government filing it came from.

> **Correlation, not causation.**
> This project shows patterns in public records. It is **not** evidence that money
> influenced any vote, and **not** an accusation of wrongdoing against anyone. A high
> overlap is common, expected, and usually has ordinary explanations. See
> [LIMITATIONS.md](LIMITATIONS.md) — please read it before drawing any conclusion.

It runs entirely on your own computer. There is no hosted service, no account, no
telemetry and no payment code anywhere in this repository. `npm run audit:repo` checks
that mechanically.

---

## Table of contents

- [What this is](#what-this-is)
- [The framing principle](#the-framing-principle)
- [Quick start (zero API keys, ~5 minutes)](#quick-start-zero-api-keys-5-minutes)
- [Getting the free API keys](#getting-the-free-api-keys)
- [Bring your own LLM key (optional)](#bring-your-own-llm-key-optional)
- [Self-hosting for free](#self-hosting-for-free)
- [The mobile app](#the-mobile-app)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Commands](#commands)
- [Data sources and licensing](#data-sources-and-licensing)
- [Privacy](#privacy)
- [Limitations](#limitations)
- [License](#license)

---

## What this is

Three questions, answered from primary sources:

1. **Which sectors gave disclosed money to a member of Congress, and how much?**
   From Federal Election Commission filings.
2. **Which sectors would a given bill plausibly affect?**
   From Library of Congress metadata, or — if you supply your own LLM key — from a
   language model reading the bill.
3. **Where do those two lists overlap?**
   Expressed as a share of that member's disclosed money, with the arithmetic shown.

Plus federal contract and grant awards from USASpending.gov as background context.

It is a **personal open-source project**, MIT licensed. It is not a company, not a
product, and not a service anyone operates on your behalf.

---

## The framing principle

Every part of this codebase is built around one rule:

> **The tool reports a co-occurrence in public records. It never asserts a cause.**

This is not a legal disclaimer bolted on at the end. It is a design constraint:

- All disclaimer wording lives in exactly one file,
  [`packages/core/src/disclaimer.ts`](packages/core/src/disclaimer.ts). No view writes
  its own. Softening it in one place is impossible without softening it everywhere,
  and a test fails if the language is removed.
- The banner is rendered by the root layout, on every route, and **cannot be
  dismissed**.
- An overlap score can only be rendered through the `<OverlapScore/>` component, which
  always draws the band label and the "what does this mean" explainer next to the
  number. A bare percentage cannot appear by accident.
- Generated share-card images paint the disclaimer **into the PNG**, because cards get
  shared out of context.
- Every LLM prompt carries `LLM_FRAMING_RULES`, which forbid causal language, partisan
  framing, and characterising anyone as corrupt or bought.
- The visual design has no partisan colour coding and no red/green "good/bad" scale for
  scores. A reader cannot tell at a glance which "side" a page is about.
- `npm run audit:repo` fails if any of the above stops being true.

---

## Quick start (zero API keys, ~5 minutes)

You need [Node.js 20 or newer](https://nodejs.org). Nothing else. **No API key is
required for a first run** — the pipeline defaults to bulk data sources that need no
signup at all.

```bash
git clone <this repository>   # see "Before you publish" below — this repo has no
cd follow-the-money           # published URL yet, and does not pretend to
npm install

cp .env.example .env        # you can leave every key blank for now

npm run pipeline            # downloads and builds the dataset (5-15 minutes)
npm run dev                 # opens the site at http://localhost:5173
```

That is the whole setup. `npm run pipeline` runs four steps you can also run
individually:

| Step | Command | What it does | Keys needed |
|---|---|---|---|
| 1 | `npm run ingest:fec` | FEC bulk downloads: candidates, committees, and every committee-to-candidate contribution for the cycle | none |
| 2 | `npm run ingest:congress` | GovInfo bulk bill status + the public-domain congress-legislators datasets | none |
| 3 | `npm run ingest:usaspending` | Federal contract and grant awards | none |
| 4 | `npm run classify` | Assigns sectors to bills and donor organisations | none (better with one) |
| 5 | `npm run export` | Builds the static JSON the apps read | none |

Everything lands in `data/ftm.sqlite` (a local file) and
`apps/web/public/data/` (static JSON). Every step is **idempotent** — re-run any of
them as often as you like and the database converges to the same state. HTTP responses
are cached on disk, so a second run is fast and does not re-hit the agencies.

### Scoping your first run

`.env` controls how much is pulled:

```bash
FTM_CONGRESS=119          # which Congress
FTM_ELECTION_CYCLE=2026   # which FEC two-year cycle
FTM_MAX_BILLS=400         # bills to fetch (each is one small request)
FTM_MAX_MEMBERS=60        # members to enrich with individual-donor detail (needs FEC key)
FTM_MAX_AWARDS=2000       # federal awards to fetch
```

Start small. `FTM_MAX_BILLS=100` gives you a working site in a couple of minutes.

---

## Getting the free API keys

Keys are **optional**. Each one adds coverage the keyless path cannot reach.

### 1. api.data.gov key — unlocks OpenFEC *and* Congress.gov

One key works for both.

1. Go to **<https://api.data.gov/signup/>**
2. Enter your name and email. There is no approval step and no cost.
3. The key arrives by email immediately.
4. Put the same value in **both** lines of your `.env`:

```bash
FEC_API_KEY=your_key_here
CONGRESS_API_KEY=your_key_here
```

**What `FEC_API_KEY` adds:** individual-donor money, aggregated by employer. Without
it you get committee/PAC money only — which is complete and real, but is roughly half
the picture. Rate limit: 1,000 requests/hour.

**What `CONGRESS_API_KEY` adds:** roll-call vote positions (who voted which way), and
fresher bill data than the bulk feed. Without it, bills still work; votes are absent
and the UI says so.

> Do **not** use `DEMO_KEY`. It is shared by every anonymous caller on the internet and
> is capped at 40 requests/hour in total. The scripts will warn you if you try.

### 2. USASpending.gov — no key needed

The API is open. Nothing to do.

### 3. Census geocoder — no key needed

Used only when *you* type an address into the "find my representative" box. The site
tells you on screen, before it runs, that the address goes to the US Census Bureau and
nowhere else.

---

## Bring your own LLM key (optional)

The classification layer is **BYOK**: it uses *your* key, billed to *your* account,
and there is no key of any kind in this repository. With `LLM_PROVIDER=none` (the
default), everything runs offline with a deterministic classifier.

```bash
# .env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

or

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

**Any OpenAI-compatible endpoint works**, including a fully local model — which costs
nothing at all:

```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:11434/v1   # Ollama
OPENAI_API_KEY=ollama                        # Ollama ignores the value
OPENAI_MODEL=llama3.1
```

### What the LLM does, and what it costs

| Task | Why a model helps |
|---|---|
| Plain-English bill summaries | The official summaries are written for lawyers |
| Bill → sector classification | *"…modify payment for renal dialysis services"* has zero keyword overlap with "health providers", but the connection is obvious to a reader |
| Donor organisation → sector | A regex cannot know that "Defend American Jobs" is a crypto-industry committee |

**Cost control is built in.** Every result is cached in SQLite keyed by a hash of the
exact input. Re-running the pipeline re-classifies nothing that has not changed — the
second run costs **$0**. Organisation lookups are batched 25 at a time. A first pass
over 400 bills is roughly 400 short calls; on a small model that is cents, not dollars.
The exact token usage is printed at the end of every run.

**The offline path stays honest.** Bills classified without a model are labelled
"Classified from Library of Congress metadata (no language model)" everywhere they
appear, and the confidence values are lower to reflect that.

---

## Self-hosting for free

Assume no prior devops experience. Pick one.

### Option A — just open it on your own machine (no hosting at all)

```bash
npm run build
npx serve apps/web/dist        # or: cd apps/web/dist && python3 -m http.server 8080
```

The build output is a plain folder of files. The app uses hash-based routing
specifically so it works from a `file://` URL and from any static host with no
rewrite rules.

### Option B — GitHub Pages (free)

1. Push the repository to GitHub.
2. Run `npm run pipeline && npm run build` locally.
3. Commit `apps/web/dist` to a `gh-pages` branch, or add a workflow that does it.
4. Repository → Settings → Pages → deploy from that branch.

The data bundle is regenerated locally and committed as static files. Nothing runs on
a server. Note the bundle is tens of megabytes with a full dataset — reduce
`FTM_MAX_BILLS` if you want a smaller one.

### Option C — any static host

Netlify, Cloudflare Pages, Vercel, S3, a Raspberry Pi, a USB stick. Build command
`npm run build`, publish directory `apps/web/dist`. All have free tiers; none of them
require you to operate anything.

### Before you publish: set `PROJECT_REPO_URL`

`npm run audit:repo` **fails on a fresh clone**, on purpose, with:

```
FAIL  repo-url   the share-card watermark points at a real repository
      PROJECT_REPO_URL is still a placeholder: "unpublished build — PROJECT_REPO_URL not set"
```

That is not a broken checkout. `PROJECT_REPO_URL` in
`packages/core/src/disclaimer.ts` is painted into every share-card PNG this app
generates, and it is the only path a card recipient has back to the method and
the caveats. It used to ship as `github.com/OWNER/follow-the-money`, which looks
like real attribution and resolves to nothing, so every image ever produced
carried a dead link.

Set it to your own host and path — no scheme:

```ts
export const PROJECT_REPO_URL: string = 'github.com/yourname/follow-the-money';
```

Nothing else needs changing. `PROJECT_REPO_URL_IS_PLACEHOLDER`, the amber
warning in the share-card dialog, the suppressed link on `/about` and the audit
check all switch off by themselves once the value is real.

### What you are *not* signing up for

There is no database to provision, no server to keep patched, no domain you must
renew, no bill that grows with traffic, and no user data you become responsible for.
That is deliberate — see [`vite.config.ts`](apps/web/vite.config.ts) and
[`App.tsx`](apps/web/src/App.tsx) for the two decisions that make it true.

---

## The mobile app

An Expo (React Native) app lives in [`apps/mobile`](apps/mobile). It bundles the same
JSON and works fully offline — no network calls at all.

```bash
cd apps/mobile
npm install
npx expo start          # then press i / a, or scan the QR code with Expo Go
```

It shares `packages/core` with the web app, so the disclaimer text, the sector
taxonomy and the overlap formula are literally the same code. See
[`apps/mobile/README.md`](apps/mobile/README.md).

---

## How it works

```
  FEC bulk downloads ─┐
  OpenFEC API      ───┤
  GovInfo BULKDATA ───┤──▶  ingest scripts  ──▶  data/ftm.sqlite  ──▶  export  ──▶  static JSON
  congress-legislators┤          (normalize,          (local file)                       │
  Congress.gov API ───┤           idempotent                                             ▼
  USASpending.gov  ───┘           upserts)                                    web app  +  mobile app
                                       │                                     (static)     (bundled)
                                       ▼
                              classification layer
                         (offline metadata, or your own LLM)
```

**Donor sector attribution** runs in this order, and every row records which method was
used so the UI can show it:

1. **Curated organisation table** —
   [`org-knowledge.ts`](packages/core/src/org-knowledge.ts), a checked-in list of trade
   associations and well-known committees, each with a source note.
2. **Keyword stems** — conservative patterns that return "unclassified" rather than
   guess.
3. **FEC committee-type codes** — authoritative for the categories that are *not*
   industries: party committees, leadership PACs, and super PACs whose own funding is
   disclosed in a filing this pipeline does not traverse.
4. **Your LLM**, if configured, for what remains.

**Bill sector classification** uses the CRS policy area and the Library of Congress
legislative subject terms — assigned by human librarians, and a far better signal than
keyword-matching a title — or your LLM reading the bill.

**The overlap score** is a weighted share, and the formula is printed on the page:

```
score = Σ over sectors ( donorShare(sector) × billWeight(sector) )
        where billWeight = classifierConfidence / Σ classifierConfidence
```

Read it as: *weighting each sector by how central it is to this bill, what share of
this member's disclosed money came from those sectors?* Money that could not be
attributed to any sector is excluded from the numerator **and** reported separately on
screen, so the reader can discount accordingly.

---

## Project layout

```
follow-the-money/
├─ packages/core/         shared types, sector taxonomy, overlap maths,
│                         and the single source of truth for all framing language
├─ packages/ingest/       fetch → normalize → SQLite; the BYOK classification layer;
│                         the static export
├─ apps/web/              Vite + React static site
├─ apps/mobile/           Expo (React Native) app
├─ scripts/
│  ├─ audit-repo.mjs      proves the no-backend / no-telemetry / no-payments claims
│  └─ mock-llm-server.mjs deterministic OpenAI-compatible stub, used only by tests
├─ data/                  your local SQLite + HTTP cache (gitignored)
├─ LIMITATIONS.md         what this tool cannot do — please read it
└─ CONTRIBUTING.md
```

---

## Commands

| Command | What it does |
|---|---|
| `npm run pipeline` | Full ingest → classify → export |
| `npm run ingest:fec` | Campaign finance only |
| `npm run ingest:congress` | Bills, members, committees, votes |
| `npm run ingest:usaspending` | Federal awards |
| `npm run classify` | Sector classification (uses your LLM key if set) |
| `npm run export` | Rebuild the static JSON bundle |
| `npm run dev` | Web app, dev server |
| `npm run build` | Web app, production static build |
| `npm test` | Unit tests, including the BYOK path against a local stub |
| `npm run audit:repo` | The no-backend / no-telemetry / no-payments audit |

---

## Data sources and licensing

All four sources are US federal government works or public-domain datasets, free to
use commercially:

| Source | What it provides | Key? | Terms |
|---|---|---|---|
| [FEC bulk downloads](https://www.fec.gov/data/browse-data/?tab=bulk-data) | Candidates, committees, contributions | No | US Government work, public domain |
| [OpenFEC API](https://api.open.fec.gov/developers/) | Individual donors by employer | Free | US Government work, public domain |
| [GovInfo BULKDATA](https://www.govinfo.gov/bulkdata) | Bill status XML | No | US Government work, public domain |
| [Congress.gov API](https://api.congress.gov/) | Bills, votes | Free | US Government work, public domain |
| [@unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) | Member IDs, FEC crosswalk, committee rosters | No | CC0 / public domain |
| [USASpending.gov API](https://api.usaspending.gov/) | Federal awards | No | US Government work, public domain |
| [Census Geocoder](https://geocoding.geo.census.gov/) | Address → congressional district | No | US Government work, public domain |

Member portraits come from the public-domain
[@unitedstates images](https://github.com/unitedstates/images) collection.

This project deliberately does **not** use the OpenSecrets/CRP industry taxonomy, which
is excellent but not freely licensed for commercial reuse. The sector taxonomy here is
built from raw disclosure text instead, and is correspondingly noisier — see
[LIMITATIONS.md](LIMITATIONS.md).

---

## Privacy

- No accounts, no login, no cookies, no local storage, no session of any kind.
- No analytics, no error reporting, no trackers.
- Search runs entirely in your browser against a local file. No query leaves the
  device.
- The only optional outbound request from the UI is the address lookup you explicitly
  trigger, which goes to the US Census Bureau geocoder. The page says so before it
  runs, and name search works without it.
- Your API keys live in `.env`, which is gitignored, and are sent only to the API each
  key belongs to. They are never logged and are scrubbed from error messages.

Verify all of that yourself: `npm run audit:repo`.

---

## Limitations

**[LIMITATIONS.md](LIMITATIONS.md) is required reading.** The short version:

- This tool **cannot prove causation** and does not try to.
- It sees only **disclosed, itemized FEC "hard money"** — not dark money, not
  501(c)(4) spending, not lobbying expenditure, not bundling, not the revolving door.
- Super PAC money is visible, but **the source of that money is not**, and the UI
  labels it as such rather than pretending otherwise.
- Sector attribution from self-reported employer strings is **noisy**, and the
  unattributed share is reported on every member's page rather than hidden.
- **Correlation is expected** in ordinary representation. A member from a farming
  district scores high on an agriculture bill. That is representation, not capture.
- It is **not a substitute for investigative journalism**. If something here looks
  significant, the next step is a primary source or a reporter — not a screenshot.

---

## License

MIT. See [LICENSE](LICENSE).

You may use, copy, modify, merge, publish, distribute, sublicense and sell copies of
this software, including commercially, provided the copyright notice and permission
notice are included. It is provided "as is", without warranty of any kind.

The government data this tool ingests is separately in the public domain. What you
conclude from it is your own responsibility — please read
[LIMITATIONS.md](LIMITATIONS.md) first.
