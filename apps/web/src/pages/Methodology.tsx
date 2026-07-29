/**
 * How every number on this site is produced.
 *
 * Written for a reader who does not believe it. Everything on this page is
 * either (a) pulled live out of the generated bundle, so it describes THIS
 * dataset rather than an idealised one, or (b) imported from @ftm/core so the
 * page cannot drift from the code that actually runs. The overlap formula and
 * the score explainer are imported, never retyped.
 */

import { Link } from 'react-router-dom';
import { OVERLAP_FORMULA, SCORE_EXPLAINER, usd } from '@ftm/core';
import { getIndex } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { CoverageNote, OverlapScore, ShortDisclaimer } from '../components/Framing';
import { Empty, ErrorState, Loading, SectionTitle, Stat } from '../components/ui';

/**
 * The worked example.
 *
 * Deliberately synthetic and deliberately round, so a reader can reproduce
 * every digit with a calculator and no data files. The numbers are chosen to
 * exercise the three parts of the formula people get wrong: unclassified money
 * is excluded from the numerator but stays in the denominator; a donor sector
 * the bill does not touch contributes nothing; and a bill tag below the 0.25
 * confidence floor is dropped before the weights are computed.
 */
const EXAMPLE = {
  memberTotal: 1_000_000,
  donors: [
    { label: 'Banking & Finance', amount: 250_000, share: 0.25 },
    { label: 'Insurance', amount: 100_000, share: 0.1 },
    { label: 'Real Estate', amount: 50_000, share: 0.05 },
  ],
  unclassified: 600_000,
  billTags: [
    { label: 'Banking & Finance', confidence: 0.8, kept: true },
    { label: 'Insurance', confidence: 0.4, kept: true },
    { label: 'Technology', confidence: 0.2, kept: false },
  ],
};

const EXAMPLE_CONF_SUM = 0.8 + 0.4;
const EXAMPLE_SCORE = 0.25 * (0.8 / EXAMPLE_CONF_SUM) + 0.1 * (0.4 / EXAMPLE_CONF_SUM);

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

  if (error) return <ErrorState error={error} />;

  const classifiedByLlm = idx ? idx.sources.classification.startsWith('llm') : false;
  const fecMode = idx?.sources.openfec ?? '—';
  const congressMode = idx?.sources.congress ?? '—';

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">How the numbers work</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-3">
        Every figure on this site is derived from a government file that anybody can download. This
        page describes each step, names the file it came from, and works one score out by hand so the
        arithmetic can be checked rather than trusted.
      </p>
      <ShortDisclaimer className="mt-2" />

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
              <Stat label="Overlaps computed" value={(idx.counts.overlaps ?? 0).toLocaleString()} sub="Member–bill pairs with at least one shared sector" />
              <Stat label="Federal awards" value={(idx.counts.awards ?? 0).toLocaleString()} sub={<Link className="link" to="/spending">Federal spending →</Link>} />
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
              on this path are deliberately conservative. Bills with no usable metadata get no tags
              and no overlap score at all, which for ceremonial resolutions and naming bills is the
              correct answer.
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
        <p className="mt-3 max-w-measure-wide text-xs leading-relaxed text-ink-4">
          Whichever path ran, the confidence attached to a tag is the classifier's own self-assessment.
          It is not a measured probability, not a statistical guarantee, and not validated against a
          labelled ground truth — because no such labelled set exists for this task. Every bill page
          shows which method produced its tags.
        </p>
      </section>

      {/* ---- the formula --------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Step 4 — the overlap score, exactly</SectionTitle>
        <div className="card p-4">
          <div className="label mb-1.5">The formula, imported from the code that computes it</div>
          <p className="mono text-xs leading-relaxed text-ink-2">{OVERLAP_FORMULA}</p>
          {idx && idx.overlapFormula !== OVERLAP_FORMULA && (
            <p className="mt-2 text-xs text-ink-4">
              The bundle you are reading was generated with a different revision of this formula:{' '}
              <span className="mono">{idx.overlapFormula}</span>
            </p>
          )}
        </div>

        <dl className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-ink-2">
          <div>
            <dt className="label">What it is</dt>
            <dd>{SCORE_EXPLAINER.what}</dd>
          </div>
          <div>
            <dt className="label">What it is not</dt>
            <dd>{SCORE_EXPLAINER.whatItIsNot}</dd>
          </div>
          <div>
            <dt className="label">How to use it</dt>
            <dd>{SCORE_EXPLAINER.howToUse}</dd>
          </div>
        </dl>

        <ul className="mt-4 max-w-3xl space-y-1.5 text-sm leading-relaxed text-ink-3">
          <li>· Money the pipeline could not attribute to any sector is excluded from the numerator but stays in the member's total, so unattributed money pushes a score down rather than up.</li>
          <li>· Bill tags below a confidence of 0.25 are dropped before the weights are computed, so a barely-there tag cannot swing a score.</li>
          <li>· The member's vote is not an input. Somebody who voted against every interest that funded them scores identically.</li>
          <li>· Whether the bill helps or harms the sector is not an input either. The score has no direction.</li>
          <li>· Every result stores the unattributed share alongside it, so a score built on thin attribution can be discounted on sight.</li>
        </ul>
      </section>

      {/* ---- worked example ------------------------------------------------ */}
      <section className="mt-10">
        <SectionTitle note="Check this with a calculator">Step 5 — one score, worked out by hand</SectionTitle>
        <p className="mb-4 max-w-measure-wide text-sm leading-relaxed text-ink-2">
          An invented member and an invented bill, with round numbers, so every digit below can be
          reproduced without downloading anything.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <div className="label mb-2">The member's disclosed itemized money</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-2xs uppercase tracking-wide text-ink-4">
                  <th scope="col" className="pb-1 font-semibold">Sector</th>
                  <th scope="col" className="pb-1 text-right font-semibold">Amount</th>
                  <th scope="col" className="pb-1 text-right font-semibold">Share D</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {EXAMPLE.donors.map((d) => (
                  <tr key={d.label}>
                    <td className="py-1.5 text-ink-2">{d.label}</td>
                    <td className="tnum py-1.5 text-right">{usd(d.amount)}</td>
                    <td className="tnum py-1.5 text-right">{d.share.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5 text-ink-4">Could not be attributed</td>
                  <td className="tnum py-1.5 text-right text-ink-4">{usd(EXAMPLE.unclassified)}</td>
                  <td className="tnum py-1.5 text-right text-ink-4">0.60</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-ink-0">Total itemized</td>
                  <td className="tnum py-1.5 text-right font-semibold text-ink-0">{usd(EXAMPLE.memberTotal)}</td>
                  <td className="tnum py-1.5 text-right font-semibold text-ink-0">1.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card p-4">
            <div className="label mb-2">The bill's sector tags</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-2xs uppercase tracking-wide text-ink-4">
                  <th scope="col" className="pb-1 font-semibold">Sector</th>
                  <th scope="col" className="pb-1 text-right font-semibold">Confidence C</th>
                  <th scope="col" className="pb-1 text-right font-semibold">Weight W</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {EXAMPLE.billTags.map((t) => (
                  <tr key={t.label} className={t.kept ? '' : 'text-ink-4'}>
                    <td className="py-1.5">{t.label}</td>
                    <td className="tnum py-1.5 text-right">{t.confidence.toFixed(2)}</td>
                    <td className="tnum py-1.5 text-right">
                      {t.kept ? (t.confidence / EXAMPLE_CONF_SUM).toFixed(4) : 'dropped'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs leading-relaxed text-ink-4">
              Technology is dropped because 0.20 is below the 0.25 floor. The weights are computed
              from what survives: ΣC = 0.80 + 0.40 = 1.20.
            </p>
          </div>
        </div>

        <div className="card mt-4 p-4">
          <div className="label mb-2">The arithmetic</div>
          <pre className="mono overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
{`Banking & Finance   D = 0.25   W = 0.80 / 1.20 = 0.666666…   D × W = 0.166666…
Insurance           D = 0.10   W = 0.40 / 1.20 = 0.333333…   D × W = 0.033333…
Real Estate         D = 0.05   the bill has no real-estate tag   D × W = 0
Technology          tag dropped below the 0.25 floor           D × W = 0

score = 0.166666… + 0.033333… = 0.20`}
          </pre>
          <p className="mt-3 max-w-measure-wide text-sm leading-relaxed text-ink-3">
            So the score is 20%. Read it as: weighting sectors by how central they are to this bill,
            about a fifth of this member's disclosed itemized money came from those sectors. Note
            what the $600,000 of unattributable money did — it stayed in the denominator, so it pulled
            the score down. Had all of it been attributable to banking, the score would have been far
            higher; had none of it been attributable, the score would be lower still. A score built on
            a member whose money is largely unattributed is a weak score, which is why the
            unattributed share is reported next to every one of them.
          </p>
          <div className="mt-4 max-w-sm">
            <OverlapScore score={EXAMPLE_SCORE} size="md" />
          </div>
        </div>
      </section>

      {/* ---- who counts as involved ---------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Step 6 — who counts as having “touched” a bill</SectionTitle>
        <p className="max-w-measure-wide text-sm leading-relaxed text-ink-2">
          A score is computed for the bill's sponsor, for each of its cosponsors, and for every member
          sitting on a committee the bill was referred to. Committee membership is included because
          jurisdiction is where most legislative influence actually lives, and excluding it would miss
          the members most likely to shape a bill. It also means a member can appear against a bill
          they have never mentioned — appearing in this list is not a claim that somebody acted on a
          bill, only that they were in a position to. Pairs with no shared sector at all are not
          stored.
        </p>
      </section>

      {/* ---- reproducing --------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Reproducing all of this</SectionTitle>
        <p className="max-w-measure-wide text-sm leading-relaxed text-ink-2">
          Everything shown is computed at build time and shipped as plain JSON files. There is no
          query API, no database connection from the browser, and no server involved in rendering any
          page. From a clone of the repository, <code className="mono">npm run pipeline</code> fetches
          the sources, classifies, computes every overlap and writes the bundle — no keys required for
          a first run. The exported files sit in{' '}
          <code className="mono">apps/web/public/data</code> and can be inspected directly with any
          JSON viewer.
        </p>
        <p className="mt-3 max-w-measure-wide text-sm leading-relaxed text-ink-3">
          The formula lives in <code className="mono">packages/core/src/overlap.ts</code>, the sector
          taxonomy in <code className="mono">packages/core/src/industries.ts</code>, the framing
          language in <code className="mono">packages/core/src/disclaimer.ts</code>, and the export
          step in <code className="mono">packages/ingest/src/export.ts</code>. This page imports the
          formula and the explainer from that first file rather than restating them, so it cannot
          quietly fall out of date with the code.
        </p>
        <p className="mt-4 text-sm text-ink-4">
          <Link className="link" to="/limitations">What this tool cannot do →</Link> ·{' '}
          <Link className="link" to="/about">What this project is →</Link>
        </p>
      </section>
    </div>
  );
}
