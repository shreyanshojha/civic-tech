# Contributing

Thanks for looking at this.

## What this project is

**Follow the Money is a personal open-source project.** It is not a company, not a
startup, not a commercial product, and not a service anyone operates. There is no
organisation behind it, no roadmap owed to anyone, and no revenue model. It is MIT
licensed code that anyone can clone, run locally, fork, or take in a different
direction entirely.

Please keep that framing in any code, docs or UI copy you contribute. The repository
audit (`npm run audit:repo`) fails on startup/company language for this reason.

## Before you start

Read [LIMITATIONS.md](LIMITATIONS.md). Most good contributions to this project make it
*more careful*, not more impressive.

## The rules that are not up for negotiation

These are enforced by tests and by `npm run audit:repo`. A pull request that breaks one
will not be merged.

1. **Correlation, never causation.** No text, label, tooltip, summary, prompt, image or
   commit message may assert or imply that a contribution caused a legislative action.
   Not "bought", not "influenced", not "in exchange for", not a knowing wink.

2. **All framing language comes from one file.** Every disclaimer string lives in
   `packages/core/src/disclaimer.ts`. Do not write a new one in a component. If you
   need wording that does not exist yet, add it there so every surface can use it and
   the tests can check it.

3. **Scores render through `<OverlapScore/>` only.** It composes in the band label and
   the explainer. A bare percentage must never reach the screen.

4. **No partisan colour, ever.** Party is a neutral factual field. It is never used to
   colour, sort, rank or filter. Scores use a single-hue neutral ramp — never
   red/green, which reads as a verdict.

5. **No backend, no accounts, no telemetry, no payments.** No analytics, no error
   reporting, no cookies, no local storage of user input, no login, no billing. The app
   must stay deployable as a folder of static files.

6. **Bring your own key, always.** No API key may be committed, defaulted, proxied or
   shipped. If no key is configured, the code path must degrade to the offline
   classifier — never to someone else's key.

7. **Every figure is traceable.** If you add a number to the UI, add a link to the
   government record it came from.

8. **Report the gaps.** If a computation excludes data (unattributed money, truncated
   samples, capped result sets), say so on screen. Silent truncation reads as
   completeness.

## Good first contributions

- **Fix a sector misclassification.** Add an entry to
  `packages/core/src/org-knowledge.ts`. Every entry needs a `note` with a citable
  public source, and must classify the *economic interest*, never the politics.
- **Improve a keyword pattern** in `packages/core/src/industries.ts` — with a test.
- **Improve the CRS subject-term mapping** in `packages/core/src/policy-areas.ts`.
- **Accessibility fixes.** Contrast, focus order, screen-reader labels, keyboard
  navigation.
- **A data source with a genuinely free, commercially usable licence.** Say which
  licence in the pull request.
- **Better tests**, especially ones that would catch a framing regression.

## Contributions that will be declined

- Anything that scores, ranks, or grades members on an implied integrity scale.
- Anything that colour-codes or sorts by party.
- Adding a hosted backend, an account system, analytics, or a payment path.
- Data sources that are not free and commercially reusable (this notably includes the
  OpenSecrets/CRP industry taxonomy — please do not add it).
- Copy that sharpens the framing into an accusation, however true you believe it is.
- Anything that removes or weakens a stated limitation.

## Development

```bash
npm install
cp .env.example .env      # keys optional; everything works without them
npm run pipeline          # build the dataset
npm run dev               # web app
npm test                  # unit tests
npm run audit:repo        # the no-backend / no-telemetry / no-payments audit
```

The mobile app has its own install:

```bash
cd apps/mobile && npm install && npx expo start
```

### Before opening a pull request

```bash
npm test
npm run audit:repo
npm run build
cd apps/web && npx tsc --noEmit
```

All four must pass — **with one deliberate exception**: `npm run audit:repo`
fails on `repo-url` until `PROJECT_REPO_URL` is set (see below). Every other
check in it must be green, and your change must not add a second failure.

### Before publishing a build: set `PROJECT_REPO_URL`

`PROJECT_REPO_URL` in `packages/core/src/disclaimer.ts` is a placeholder. It is
painted into every share-card PNG, and it is the only way a card recipient can
get back to the method and the caveats — so shipping a value that resolves to
nothing means shipping images with dead attribution.

While it is unset:

- `node scripts/audit-repo.mjs` fails with `FAIL repo-url` and exits non-zero;
- the share-card dialog shows an amber warning saying it must be set;
- `/about` says there is no source URL instead of rendering a dead link;
- the card watermark reads `unpublished build — PROJECT_REPO_URL not set`.

To publish, replace it with your host and path (no scheme,
e.g. `github.com/yourname/follow-the-money`). Everything above switches off on
its own — there is no second place to update.

### Testing the LLM path without a key

`scripts/mock-llm-server.mjs` is a deterministic OpenAI-compatible stub used only by
tests. It lets you exercise the whole bring-your-own-key path — request shape, auth
header, batching, caching, malformed-response fallback — for free:

```bash
node scripts/mock-llm-server.mjs --port 8787 &
LLM_PROVIDER=openai OPENAI_API_KEY=test OPENAI_BASE_URL=http://127.0.0.1:8787/v1 \
  npm run classify
```

It is never started by the app and never deployed.

## Style

- TypeScript, strict mode.
- Comments explain **why**, not what. If a decision is non-obvious — especially a
  decision about how to be honest with the data — write down the reasoning.
- Prefer refusing to guess over guessing. `other` with confidence 0 is a correct
  answer; a plausible wrong sector produces a misleading chart.
- Keep views dumb; put logic in `packages/core` where it can be tested.

## Reporting a data error

Open an issue with:

- what the tool shows,
- what the correct value is,
- **the primary government source** that demonstrates it.

Corrections that make the tool less confident are as welcome as ones that make it more
informative.

## Conduct

Be decent. This project touches politics; the code and the discussion around it stay
nonpartisan. Contributions that use the project to attack a person or a party will be
closed.

## Licence

By contributing you agree that your contributions are licensed under the MIT licence,
the same as the rest of the project.
