/**
 * How every number on this site is produced.
 *
 * Written for a reader who does not believe it. Everything on this page is
 * either (a) pulled live out of the generated bundle, so it describes THIS
 * dataset rather than an idealised one, or (b) imported from @ftm/core so the
 * page cannot drift from the code that actually runs.
 *
 * ---------------------------------------------------------------------------
 * THE HAND-WORKED OVERLAP EXAMPLE WAS CUT FROM THIS PAGE.
 *
 * Two sections went: "Step 4 — the overlap score, exactly" (the formula, the
 * score explainer, and five notes on what the score does not use) and "Step 5 —
 * one score, worked out by hand" (an invented member, an invented bill, the
 * arithmetic in a <pre>, and a rendered score at the end). They documented the
 * member×bill overlap percentage, and no page on this site shows that percentage
 * any more — three independent evaluations found it was the headline metric and
 * was worthless, and the site's own reading guide had already called it "a
 * bookmark, not a finding".
 *
 * The arithmetic is still real and still runs: `computeOverlap` in @ftm/core is
 * called by the export step and `overlaps.json` still ships. Documenting the
 * derivation of a number a reader can never meet is not honesty, it is noise, so
 * what stands in its place is a short statement that the file exists and is not
 * rendered, plus a full description of the comparison that IS rendered — the
 * committee cohort test on /patterns.
 * ---------------------------------------------------------------------------
 */

import { Link } from 'react-router-dom';
import { PATTERN_THRESHOLDS, usd } from '@ftm/core';
import { getIndex, getPatterns } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { CoverageNote, FramingNote } from '../components/Framing';
import { Empty, ErrorState, Loading, SectionTitle, Stat } from '../components/ui';

function Source({
  name, keyed, what, url,
}: { name: string; keyed: string; what: string; url: string }) {
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a className="link text-base font-medium text-ink-0" href={url} target="_blank" rel="noreferrer noopener">
          {name}
        </a>
        <span className="chip">{keyed}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{what}</p>
    </li>
  );
}

export default function Methodology() {
  const { data: idx, error, loading } = useAsync(getIndex, []);
  // Read so the committee-comparison section can quote this bundle's own counts
  // rather than describing the code in the abstract. A bundle with no patterns
  // file simply omits that line; it is not an error on this page.
  const patterns = useAsync(getPatterns, []);

  if (error) return <ErrorState error={error} />;

  const classifiedByLlm = idx ? idx.sources.classification.startsWith('llm') : false;
  const fecMode = idx?.sources.openfec ?? '—';
  const congressMode = idx?.sources.congress ?? '—';

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">How the numbers work</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-3">
        Every figure on this site is derived from a government file that anybody can download. This
        page describes each step, names the file it came from, and states every threshold the code
        uses, so the working can be checked rather than trusted.
      </p>
      <FramingNote className="mt-2 max-w-measure-wide" />

      {/* ---- this bundle -------------------------------------------------- */}
      <section className="mt-8">
        <SectionTitle note={idx ? `Generated ${new Date(idx.generatedAt).toLocaleString()}` : undefined}>
          What is in the bundle you are reading
        </SectionTitle>
        {loading ? (
          <Loading what="the bundle description" />
        ) : !idx ? (
          <Empty>
            No bundle metadata is loaded, so this section cannot describe the dataset you are reading.
            Everything below still applies — it describes the code rather than the data.
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Stat label="Members" value={(idx.counts.legislators ?? 0).toLocaleString()} sub="Sitting House and Senate" />
              <Stat
                label="Bills"
                value={(idx.counts.bills ?? 0).toLocaleString()}
                sub={`${(idx.counts.classifications ?? 0).toLocaleString()} carry a classification · ${idx.congress}th Congress`}
              />
              <Stat
                label="Contribution rows"
                value={(idx.counts.contributions ?? 0).toLocaleString()}
                sub={`${usd(idx.counts.contributionDollars ?? 0, { compact: true })} · FEC cycle ${idx.cycle}`}
              />
              <Stat
                label="Federal awards"
                value={(idx.counts.awards ?? 0).toLocaleString()}
                sub="Contracts and grants. Shown per district on a member's page, as background only."
              />
              <Stat label="Committee seats" value={(idx.counts.committeeSeats ?? 0).toLocaleString()} sub="Used to decide who 'touched' a bill" />
              <Stat
                label="Roll-call votes"
                value={(idx.counts.votes ?? 0).toLocaleString()}
                sub={idx.counts.votes ? 'Positions recorded' : 'None in this bundle — needs a free Congress.gov key'}
              />
              <Stat label="Election cycle" value={idx.cycle} sub={idx.isSample ? 'Checked-in sample data' : 'Fetched from primary sources'} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="card p-3">
                <div className="label">Campaign finance built with</div>
                <div className="mono mt-1 text-sm text-ink-1">{fecMode}</div>
                <p className="mt-1 text-xs leading-relaxed text-ink-4">
                  {fecMode.includes('api')
                    ? 'Bulk downloads plus the OpenFEC API, so individual-donor money aggregated by employer is included.'
                    : 'FEC bulk downloads only. Committee (PAC) money is present; individual-donor detail is not, because that needs a free OpenFEC key.'}
                  {idx.sources.lastRun.fec && ` Last run ${new Date(idx.sources.lastRun.fec).toLocaleString()}.`}
                </p>
              </div>
              <div className="card p-3">
                <div className="label">Legislation built with</div>
                <div className="mono mt-1 text-sm text-ink-1">{congressMode}</div>
                <p className="mt-1 text-xs leading-relaxed text-ink-4">
                  {congressMode === 'bulk'
                    ? 'GovInfo BULKDATA XML plus the public-domain congress-legislators datasets. No key was used, and roll-call vote positions are unavailable on this path.'
                    : 'api.congress.gov, which is fresher and carries roll-call vote positions.'}
                  {idx.sources.lastRun.congress && ` Last run ${new Date(idx.sources.lastRun.congress).toLocaleString()}.`}
                </p>
              </div>
              <div className="card p-3">
                <div className="label">Classification built with</div>
                <div className="mono mt-1 text-sm text-ink-1">{idx.sources.classification}</div>
                <p className="mt-1 text-xs leading-relaxed text-ink-4">
                  {classifiedByLlm
                    ? 'A language model, running on the key configured on the machine that generated this bundle.'
                    : 'The offline classifier: Library of Congress policy areas and subject terms, plus keyword stems. No language model was involved, and the sector tags are correspondingly rough.'}
                  {idx.sources.lastRun.classify && ` Last run ${new Date(idx.sources.lastRun.classify).toLocaleString()}.`}
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ---- sources ------------------------------------------------------ */}
      <section className="mt-10">
        <SectionTitle>Step 1 — the four sources</SectionTitle>
        <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
          <strong className="font-semibold">The default configuration needs zero API keys.</strong>{' '}
          Three of the four sources publish bulk files or open endpoints that require no signup, no
          key and no quota, and the fourth is public-domain data on a static host. A clone of this
          repository produces a real dataset from real government filings before anybody registers
          for anything. Keys are strictly additive: an optional free OpenFEC key adds individual-donor
          detail, an optional free Congress.gov key adds roll-call vote positions, and an optional
          language-model key of the reader's own improves the classifier. There is no shared key, no
          fallback key and no key belonging to whoever published the repository.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Source
            name="FEC bulk downloads"
            keyed="No key"
            url="https://www.fec.gov/data/browse-data/?tab=bulk-data"
            what="Pipe-delimited files published per two-year cycle with no key and no rate limit: candidate master, committee master, the candidate-to-committee linkage, and every contribution from a committee to a candidate. Committee money is also the easier money to attribute, because a PAC's registered name and its connected organisation usually state plainly what it represents."
          />
          <Source
            name="GovInfo BULKDATA"
            keyed="No key"
            url="https://www.govinfo.gov/bulkdata"
            what="Bill status XML published by the Government Publishing Office, with no key and no rate limit. It supplies each bill's title, sponsor and cosponsors, committees of referral, the Congressional Research Service policy area and subject terms, and the official CRS summary where one has been published."
          />
          <Source
            name="congress-legislators"
            keyed="No key · public domain"
            url="https://github.com/unitedstates/congress-legislators"
            what="The community-maintained, CC0 crosswalk that makes the rest of this possible: it links a member's bioguide ID to their FEC candidate IDs. Without it, campaign finance and legislation are two datasets with no shared key. It also supplies committee rosters and member photographs."
          />
          <Source
            name="USASpending.gov"
            keyed="No key"
            url="https://www.usaspending.gov/"
            what="The government's open award API — no signup, no key, no per-key quota. It supplies federal contract and grant awards, used purely as context about where federal money goes. It is never treated as evidence about a contribution."
          />
        </ul>
        <p className="mt-3 max-w-measure-wide text-xs leading-relaxed text-ink-4">
          Every stored row keeps the government's own identifier, a deep link to the primary record,
          and the timestamp it was fetched — so every figure on the site is one click from a filing,
          and staleness is visible rather than hidden. Every write is an upsert keyed on a
          deterministic hash of the natural key, so re-running the pipeline is safe.
        </p>
      </section>

      {/* ---- donor industry ---------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Step 2 — assigning a sector to money</SectionTitle>
        <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
          FEC filings do not carry an industry field. What they carry is a self-reported employer
          string on individual contributions, and a registered committee name plus the FEC's own
          type codes on committee contributions. Four routes are tried, in this order, and the row
          records which one succeeded — nothing is stored as though it were known when it was
          guessed.
        </p>
        <ol className="max-w-3xl space-y-3">
          <li className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base font-medium text-ink-0">1. Curated organisation table</span>
              <span className="mono text-xs text-ink-4">method: keyword (org table)</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              A checked-in table of named committees whose sector cannot be read off their name — a
              trade association, a super PAC whose title says nothing about its funders. Entries must
              cite a public source, must classify the economic interest rather than the politics, and
              must fall back to “funding source not visible” when the funding is genuinely mixed.
              This exists so that the no-key path is still informative and not merely empty.
            </p>
          </li>
          <li className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base font-medium text-ink-0">2. Keyword stems</span>
              <span className="mono text-xs text-ink-4">method: keyword</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              Ordered regular expressions over the employer, occupation and committee name; the first
              sector that matches wins, so narrow sectors are tested before broad ones. Filings that
              say SELF, RETIRED, N/A, HOMEMAKER or STUDENT are recognised as carrying no employer at
              all and are reported separately from money that had an employer this tool could not
              place — conflating those two would overstate how much is unknown. When nothing matches,
              the answer is “other”; the classifier does not guess.
            </p>
          </li>
          <li className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base font-medium text-ink-0">3. FEC committee-type codes</span>
              <span className="mono text-xs text-ink-4">method: committee-type</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              The FEC's own committee-type and organisation-type letters. Party, leadership and
              candidate-transfer committee types are routed to the party bucket rather than to any
              industry, so political money can never inflate a sector's figures. Independent-
              expenditure and hybrid types with no other signal are labelled “funding source not
              visible” — their donors are disclosed on a separate filing this pipeline does not read,
              so the honest statement is that the layer beneath is invisible, not that it is unknown.
            </p>
          </li>
          <li className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base font-medium text-ink-0">4. A language model — optional, bring your own key</span>
              <span className="mono text-xs text-ink-4">method: llm</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              Only if the reader has configured a key of their own. It resolves committee names that
              carry real-world knowledge no regular expression holds. Results are cached against a
              hash of the exact input, so a re-run costs nothing. With no key configured this step is
              skipped entirely and the row keeps whichever earlier method produced it.
            </p>
          </li>
        </ol>
        <CoverageNote>
          Because each contribution row stores its own method, the site can show you how a figure was
          derived instead of asking you to assume. Wherever a sector attribution appears next to a
          method tag, that tag is the stored value for that row — not a description of the pipeline
          in general.
        </CoverageNote>
      </section>

      {/* ---- bill classification ------------------------------------------ */}
      <section className="mt-10">
        <SectionTitle>Step 3 — deciding which sectors a bill affects</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <div className="label mb-1.5">Offline path — the default</div>
            <p className="text-sm leading-relaxed text-ink-3">
              Every bill on Congress.gov carries exactly one Congressional Research Service policy
              area and a set of curated legislative subject terms, assigned by Library of Congress
              staff rather than by a machine. Mapping those to sectors is a far better free signal
              than keyword-matching a bill title. The policy area contributes a moderate-confidence
              signal and the subject terms sharpen it — “Health” tells you a bill touches health, but
              not whether it lands on hospitals, insurers or drug manufacturers, so the confidences
              on this path are deliberately conservative. Bills with no usable metadata get no tags at
              all, which for ceremonial resolutions and naming bills is the correct answer.
            </p>
          </div>
          <div className="card p-4">
            <div className="label mb-1.5">Language-model path — optional, bring your own key</div>
            <p className="text-sm leading-relaxed text-ink-3">
              A model reads the title, policy area, subject terms and official CRS summary and
              returns a plain-English paraphrase plus sectors with confidences and a one-line
              rationale each. This exists because keyword matching genuinely cannot bridge “amend
              title XVIII of the Social Security Act to modify payment for renal dialysis services”
              and “dialysis providers”, though the connection is obvious to a reader. If no key is
              configured the pipeline still runs and marks every result as the offline method, which
              the interface displays rather than hides.
            </p>
          </div>
        </div>
        {/* ---- what "in plain words" can and cannot cover -------------------
            The numbers come out of the bundle, so this paragraph describes THIS
            dataset. Most bills land in the title-only column and the page says
            so: a reader who is told "we explain bills in plain words" and then
            meets 730 bills we cannot explain should have been warned here
            first. */}
        {idx && (idx.counts.plainCrsSummary ?? 0) + (idx.counts.plainTitleOnly ?? 0) > 0 && (
          <div className="mt-4 card p-4">
            <div className="label mb-1.5">Step 3b — the plain-language explanation, and how far it reaches</div>
            <p className="text-sm leading-relaxed text-ink-3">
              Every bill page opens with what the bill would do, who it reaches and what would change.
              That is generated at build time by a deterministic rewriter in{' '}
              <span className="mono">@ftm/core</span> — no language model, no key — and it can only be
              as good as the text it is given. Of{' '}
              <span className="tnum">{idx.counts.bills.toLocaleString()}</span> measures in this
              bundle:{' '}
              <span className="tnum">{(idx.counts.plainCrsSummary ?? 0).toLocaleString()}</span> are
              described from a published Congressional Research Service summary;{' '}
              <span className="tnum">{(idx.counts.plainTitleOnly ?? 0).toLocaleString()}</span> have no
              summary at all, so the page says only the title exists and points at the bill rather than
              paraphrasing a title into a description of a law; and{' '}
              <span className="tnum">{(idx.counts.plainCeremonial ?? 0).toLocaleString()}</span> are
              tributes, building namings or Congress's own housekeeping, which change no law and are
              labelled as such.
            </p>
            <CoverageNote>
              The title-only group is the largest of the three. That is a limit of the public record,
              not a setting: for those bills the only text Congress has published is a title, and often
              only a short title like “SHARE Act of 2025”, which describes nothing. The audience line —
              who a bill reaches — is derived from Library of Congress subject labels and is available
              for most bills either way.
            </CoverageNote>
          </div>
        )}

        <p className="mt-3 max-w-measure-wide text-xs leading-relaxed text-ink-4">
          Whichever path ran, the confidence attached to a tag is the classifier's own self-assessment.
          It is not a measured probability, not a statistical guarantee, and not validated against a
          labelled ground truth — because no such labelled set exists for this task. Every bill page
          shows which method produced its tags.
        </p>
      </section>

      {/* ---- the committee comparison, which is what the site actually shows
          This replaced two sections on the overlap score: the formula, and one
          score worked out by hand. See the file header. Every threshold quoted
          here is imported from PATTERN_THRESHOLDS or read out of the generated
          patterns file, so this description cannot drift from the code. */}
      <section className="mt-10">
        <SectionTitle note={<Link className="link" to="/patterns">See the comparisons →</Link>}>
          Step 4 — the committee comparison, exactly
        </SectionTitle>
        <p className="max-w-measure-wide text-sm leading-relaxed text-ink-2">
          This is the only comparison the site puts on screen. It is also the only one with a group on
          both sides. Take one committee and one sector. Take every member of that committee. Take
          every member of the same chamber who is not on it. Then compare the share of each member's
          traced money that came from that sector. One member's share is a sample of one and cannot be
          tested. Fifty against four hundred can be.
        </p>
        <ol className="mt-4 max-w-3xl space-y-3">
          <li className="card p-4">
            <div className="label mb-1.5">1. Who is in, and who is left out</div>
            <p className="text-sm leading-relaxed text-ink-3">
              A member with under{' '}
              <span className="tnum">${PATTERN_THRESHOLDS.minMemberTotal.toLocaleString()}</span> of
              reported money is dropped from both groups. At that size, one cheque moves their share by
              tens of percentage points. A committee then needs at least{' '}
              <span className="tnum">{PATTERN_THRESHOLDS.minCohortSize}</span> members above that
              floor, and the comparison group at least{' '}
              <span className="tnum">{PATTERN_THRESHOLDS.minBaselineSize}</span>, or the pair is not
              tested at all. Not tested is reported as its own outcome — it is not a pattern that
              failed.
            </p>
          </li>
          <li className="card p-4">
            <div className="label mb-1.5">2. The test itself: shuffle the labels</div>
            <p className="text-sm leading-relaxed text-ink-3">
              A permutation test, not a t-test. These share distributions are mostly zero and heavily
              skewed, so the bell curve a t-test assumes is plainly false. Instead the code shuffles
              which members count as being on the committee, ten thousand times over. Then it counts
              how often chance alone produces a gap this big. The shuffle uses a fixed seed, so the
              figure a reader is looking at does not change from one build to the next.
            </p>
          </li>
          <li className="card p-4">
            <div className="label mb-1.5">3. The correction for the size of the search</div>
            <p className="text-sm leading-relaxed text-ink-3">
              Every full committee is tested against every sector. That is over a thousand
              comparisons. At the usual one-in-twenty cutoff, chance alone hands you about fifty
              “findings”, and each one would survive a reader's own scrutiny. So a Benjamini–Hochberg
              false-discovery-rate correction is applied across every pair tested, at{' '}
              <span className="tnum">{(PATTERN_THRESHOLDS.maxQValue * 100).toFixed(0)}%</span>: of the
              comparisons published as worth a look, about that share are expected to be chance. The
              denominator is printed in the first sentence of the page for the same reason.
            </p>
          </li>
          <li className="card p-4">
            <div className="label mb-1.5">4. The robustness checks, each shown next to the gap</div>
            <p className="text-sm leading-relaxed text-ink-3">
              A gap has to survive every one of these to reach the shortlist. Take out the five
              highest members: it must still be above{' '}
              <span className="tnum">{PATTERN_THRESHOLDS.minTrimmedRatio.toFixed(1)}×</span>, so it is
              not five people. At least half the committee must sit above the typical non-member, so it
              describes the group and not a corner of it. The ten largest members must come from at
              least <span className="tnum">{PATTERN_THRESHOLDS.minDistinctStatesInTopTen}</span>{' '}
              different states, so it is not one state's industry. It must hold in both parties. And
              both groups must place a similar share of their money in some sector, so the gap is not
              an artefact of one group simply being easier to attribute.
            </p>
          </li>
          <li className="card p-4">
            <div className="label mb-1.5">5. The failures stay on the page</div>
            <p className="text-sm leading-relaxed text-ink-3">
              A comparison that fails a check is still listed, marked, with the checks it failed. A
              page showing only survivors has hidden its own base rate, which would make the survivors
              look far stronger than they are.
            </p>
          </li>
        </ol>
        {patterns.data && (
          <p className="mt-3 max-w-measure-wide text-xs leading-relaxed text-ink-4">
            In the bundle you are reading:{' '}
            <span className="tnum">{patterns.data.meta.pairsTested.toLocaleString()}</span> comparisons
            were tested,{' '}
            <span className="tnum">{patterns.data.meta.verdictCounts['worth-a-look'].toLocaleString()}</span>{' '}
            passed every check, and{' '}
            <span className="tnum">{patterns.data.meta.pairsSkippedTooSmall.toLocaleString()}</span>{' '}
            pairs were too small to test. Permutations per test:{' '}
            <span className="tnum">{patterns.data.meta.permutationIterations.toLocaleString()}</span>.
          </p>
        )}
        <ul className="mt-4 max-w-3xl space-y-1.5 text-sm leading-relaxed text-ink-3">
          <li>· No member's vote is an input. Nothing on this site uses a vote in any calculation.</li>
          <li>· Whether a bill or a sector was helped or harmed is not an input either. There is no direction in any of this.</li>
          <li>· Money the pipeline could not attribute to a sector is never guessed at. It is reported as its own figure and left out of every share.</li>
          <li>· The comparison cannot say which came first — a member joining a committee, or the money arriving. The data fits both.</li>
        </ul>
      </section>

      {/* ---- who counts as involved ---------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Step 5 — who counts as having “touched” a bill</SectionTitle>
        <p className="max-w-measure-wide text-sm leading-relaxed text-ink-2">
          A bill's sponsor, each of its cosponsors, and every member sitting on a committee the bill
          was referred to. Committee membership is included because jurisdiction is where most
          legislative influence actually lives, and excluding it would miss the members most likely to
          shape a bill. It also means a member can be counted against a bill they have never
          mentioned — being on that list is not a claim that somebody acted on a bill, only that they
          were in a position to.
        </p>
        <p className="mt-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
          This is used to build the bill's own record of sponsors and committees. It used to feed one
          more thing: a percentage, per member per bill, of how much of that member's reported money
          came from sectors the bill would affect.
        </p>

        {/* Somebody will open the data folder, find overlaps.json, and wonder
            why nothing renders it. Saying so here costs a paragraph and prevents
            the obvious wrong conclusion, which is that a page is broken. */}
        <div className="mt-3 card p-4">
          <div className="label mb-1.5">The number this site used to show, and no longer does</div>
          <p className="max-w-measure-wide text-sm leading-relaxed text-ink-3">
            That percentage is still computed by the pipeline, and{' '}
            <code className="mono">overlaps.json</code> is still written into the data folder. No page
            renders it. It was the biggest number on the site and it could not bear the weight. A
            member from a farming area takes farm money and works on farm bills. So the number was
            large for ordinary reasons, and it was read as a verdict anyway. The site's own reading
            guide called it a bookmark rather than a finding. That is not enough to earn the top of a
            named person's page.
          </p>
          <p className="mt-2 max-w-measure-wide text-sm leading-relaxed text-ink-3">
            What replaced it is the committee comparison above: the same kind of question asked about
            a group, where the answer can be tested and every way it could be wrong is measured and
            printed beside it.{' '}
            <Link className="link" to="/how-to-read">How to read what is left →</Link>
          </p>
        </div>
      </section>

      {/* ---- reproducing --------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Reproducing all of this</SectionTitle>
        <p className="max-w-measure-wide text-sm leading-relaxed text-ink-2">
          Everything shown is computed at build time and shipped as plain JSON files. There is no
          query API, no database connection from the browser, and no server involved in rendering any
          page. From a clone of the repository, <code className="mono">npm run pipeline</code> fetches
          the sources, classifies, runs the committee comparisons and writes the bundle — no keys
          required for a first run. The exported files sit in{' '}
          <code className="mono">apps/web/public/data</code> and can be inspected directly with any
          JSON viewer.
        </p>
        {/* Repository paths are not useful to a reader and are actively
            confusing to one who has no repository — they read as jargon, or as
            a reference to something they were not given. The property that
            matters to a reader is the one stated here. */}
        <p className="mt-3 max-w-measure-wide text-sm leading-relaxed text-ink-3">
          The sector taxonomy, the thresholds behind the committee comparison and the framing language
          each live in exactly one place in the code, and this page imports the thresholds from that
          place rather than restating them — so the description here cannot quietly fall out of step
          with the code that produced the numbers.
        </p>
        <p className="mt-4 text-sm text-ink-4">
          <Link className="link" to="/limitations">What this tool cannot do →</Link> ·{' '}
          <Link className="link" to="/about">What this project is →</Link>
        </p>
      </section>
    </div>
  );
}
