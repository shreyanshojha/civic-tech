/**
 * The on-ramp.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE EXISTS
 *
 * A reader who had used the site said: "I am not able to learn anything or
 * derive any conclusion from it", and then "explain me how to read it". That is
 * not a data problem — every figure on the site is sourced and hedged. It is an
 * on-ramp problem. Nothing anywhere told a first-time visitor what question the
 * site answers, what any number on it means, or what they were allowed to
 * conclude once they had one. So they arrived at a page full of percentages
 * with no way to turn one into a defensible thought, and left.
 *
 * This page is that missing on-ramp, and it is deliberately NOT a second copy
 * of /methodology. Methodology answers "how is this number computed"; this page
 * answers "what do I do with this page, and what may I conclude". The split is
 * stated in the first paragraph so a reader lands in the right one, and the
 * mechanics are LINKED rather than restated, so the two pages cannot drift.
 *
 * Two rules while editing:
 *
 *  1. READING LEVEL IS THE FEATURE. Short sentences, concrete nouns, second
 *     person. If a sentence needs a subordinate clause to stay accurate, split
 *     it into two sentences instead of nesting one. A guide nobody finishes
 *     helps nobody, which is the exact failure this page was written to fix.
 *
 *  2. NO NEW FRAMING SENTENCE. Every claim about what the site does and does
 *     not show is imported from @ftm/core. There is a test and a repo audit
 *     asserting the framing language lives in one place, and a "how to read"
 *     page is the single most tempting place to quietly write a fifth version
 *     of it.
 * ---------------------------------------------------------------------------
 */

import { Link } from 'react-router-dom';
import {
  NO_ACCUSATION,
  OVERLAP_BAND_PLAIN,
  SCORE_EXPLAINER,
  overlapBand,
} from '@ftm/core';
import { FramingNote, OverlapScore } from '../components/Framing';
import { Term } from '../components/Glossary';
import { SectionTitle } from '../components/ui';

/**
 * One demo score, and it is invented on purpose.
 *
 * A real member and a real bill would turn a teaching example into a claim
 * about a named person, on the one page where the reader has not yet been told
 * how to read it. 42% lands in the third band, which is the band a reader is
 * most likely to meet and most likely to over-read.
 */
const DEMO_SCORE = 0.42;

/** The four bands, in order, with the number that produces each one. */
const BANDS: { score: number; when: string }[] = [
  { score: 0.05, when: 'Under 15%' },
  { score: 0.25, when: '15% to 35%' },
  { score: 0.45, when: '35% to 60%' },
  { score: 0.75, when: '60% and up' },
];

/** A numbered walkthrough. The number is in the heading so it is announced. */
function Walkthrough({
  n, title, to, linkLabel, steps, then,
}: {
  n: number;
  title: string;
  to: string;
  linkLabel: string;
  steps: React.ReactNode[];
  then: React.ReactNode;
}) {
  return (
    <li className="card p-4">
      <h3 className="text-base font-semibold leading-snug text-ink-0">
        <span className="tnum mr-1.5 text-ink-4">{n}.</span>
        {title}
      </h3>
      <ol className="mt-2 max-w-measure space-y-1.5 text-base leading-snug text-ink-2">
        {steps.map((s, i) => (
          <li key={i}>· {s}</li>
        ))}
      </ol>
      <p className="mt-2 max-w-measure text-sm leading-relaxed text-ink-3">{then}</p>
      <p className="mt-2">
        <Link className="link text-sm font-medium text-ink-1" to={to}>
          {linkLabel} →
        </Link>
      </p>
    </li>
  );
}

/** A limit, paired with the thing to do about it. Never a limit on its own. */
function Limit({ what, doThis }: { what: React.ReactNode; doThis: React.ReactNode }) {
  return (
    <li className="border-l-2 border-line pl-4">
      <p className="max-w-measure text-base leading-snug text-ink-1">{what}</p>
      <p className="mt-1 max-w-measure text-base leading-snug text-ink-3">
        <span className="font-semibold text-ink-2">What to do: </span>
        {doThis}
      </p>
    </li>
  );
}

export default function HowToRead() {
  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">How to read this site</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-2">
        This site holds a lot of numbers. This page tells you what they mean and what you can say
        once you have one. Read it once and the rest of the site opens up.
      </p>
      {/* The two pages get mixed up, so the difference is the first thing said. */}
      <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-3">
        This is the reading guide. It is not the maths.{' '}
        <Link className="link font-medium text-ink-1" to="/methodology">
          How the numbers work
        </Link>{' '}
        shows how each number is built, step by step, with one score worked out by hand. Come here
        to learn how to read a page. Go there to check the arithmetic.
      </p>

      {/* The one framing block on this page. It carries DISCLAIMER_MEDIUM, not
          the sentence the sticky banner is already showing. */}
      <FramingNote className="mt-4 max-w-measure-wide" />

      {/* ---- the question ------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>The one question this site answers</SectionTitle>
        <p className="max-w-measure text-md leading-relaxed text-ink-1">
          Which industries gave reported money to a member of Congress, which industries a bill
          would affect, and where those two lists share the same names.
        </p>
        <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-2">
          That is the whole question. Both lists are public. Nobody had put them side by side in one
          place, so this site does that, and links every number back to the filing it came from.
        </p>

        {/* The honest answer to "what can I learn here" is: not much from one
            member's page, because one member's share of one sector is a number
            with a sample size of one. The committee view is the only place on
            this site where the comparison has a sample size, so the reading guide
            has to send people there rather than let them conclude the site has
            nothing to offer. */}
        <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-2">
          There is one more question, and it is the one with real numbers behind it.{' '}
          <Link className="link font-medium text-ink-1" to="/patterns">
            Committees
          </Link>{' '}
          compares a whole committee with the members of the same chamber who are not on it. One
          member's percentage tells you very little on its own. Fifty of them, next to four hundred
          others, can be tested — and that page shows every test, including the ones that failed.
        </p>

        <h3 className="mt-6 text-base font-semibold text-ink-0">Two things it cannot answer</h3>
        <ul className="mt-2 max-w-measure space-y-2 text-base leading-snug text-ink-2">
          <li>
            · <strong className="font-semibold text-ink-1">Why anyone voted the way they did.</strong>{' '}
            The site holds no information about that at all. A member's reasons live in their floor
            statements, their press releases and their committee record. None of that is in this
            data.
          </li>
          <li>
            · <strong className="font-semibold text-ink-1">When money arrived, next to when a bill
            moved.</strong> There is no timeline here. You cannot ask this site whether a cheque came
            before or after a vote. It does not line those two things up.
          </li>
        </ul>
      </section>

      {/* ---- the three things you can do ---------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Three things you can actually do here</SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          Each one takes about a minute. Pick whichever question is yours.
        </p>
        <ol className="grid gap-3 lg:grid-cols-3">
          <Walkthrough
            n={1}
            title="Look up your own representatives"
            to="/reps"
            linkLabel="Go to Representatives"
            steps={[
              <>
                Open <strong className="font-semibold text-ink-1">Representatives</strong> in the top
                menu.
              </>,
              <>
                In the box marked{' '}
                <em className="not-italic font-medium text-ink-1">ZIP code or town name</em>, type
                your ZIP code. A town name works too.
              </>,
              <>
                Press <strong className="font-semibold text-ink-1">Look up</strong>. You get your
                House member and your two senators.
              </>,
              <>Tap a name to open their page.</>,
            ]}
            then={
              <>
                Their page shows how much money was reported for them, which industries it came
                from, and the bills they worked on. Nothing you type is sent anywhere. The ZIP file
                is read on your own device.
              </>
            }
          />
          <Walkthrough
            n={2}
            title="See what an industry gave, and to whom"
            to="/industries"
            linkLabel="Go to Sectors"
            steps={[
              <>
                Open <strong className="font-semibold text-ink-1">Sectors</strong> in the top menu.
                A sector is a rough group of employers, like banking or farming.
              </>,
              <>Pick one from the list, or tap a sector name anywhere else on the site.</>,
              <>
                On the sector page, read{' '}
                <em className="not-italic font-medium text-ink-1">Members who received the most from
                donors in this sector</em>.
              </>,
              <>
                Then read <em className="not-italic font-medium text-ink-1">Bills this sector is
                tagged on</em>.
              </>,
            ]}
            then={
              <>
                Those two lists are the money side and the lawmaking side of one sector. The list of
                members is not a ranking of anybody. It is who the reported money went to, largest
                first.
              </>
            }
          />
          <Walkthrough
            n={3}
            title="Open a bill and see who has donor money in it"
            to="/bills"
            linkLabel="Go to Bills"
            steps={[
              <>
                Open <strong className="font-semibold text-ink-1">Bills</strong> in the top menu.
                Search a subject, or a number like <span className="mono">hr 1234</span>.
              </>,
              <>
                On a bill page, read{' '}
                <em className="not-italic font-medium text-ink-1">What this bill does</em> first. It
                is in plain words.
              </>,
              <>
                Then <em className="not-italic font-medium text-ink-1">Industries this bill would
                affect</em>. Each tag carries how sure this tool is of it.
              </>,
              <>
                Then <em className="not-italic font-medium text-ink-1">Money next to this bill</em>.
                That lists members who worked on it, with a match number each.
              </>,
            ]}
            then={
              <>
                A member appears in that list if they wrote the bill, signed on to it, or sit on the{' '}
                <Term k="committee">committee of jurisdiction</Term>. Being in the list is not a
                claim that they did anything. It says they were in a position to.
              </>
            }
          />
        </ol>
      </section>

      {/* ---- the match number --------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle note={<Link className="link" to="/methodology">The exact formula →</Link>}>
          How to read the match number
        </SectionTitle>

        <div className="grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="card-data self-start p-4">
            <div className="label mb-2">An invented example</div>
            <OverlapScore score={DEMO_SCORE} size="lg" plain />
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              Not a real member and not a real bill. The number and the words under it are drawn by
              the same code the rest of the site uses.
            </p>
          </div>

          <div>
            {/* SCORE_EXPLAINER verbatim. Rewording it here would put a fifth
                version of the framing in a fourth file. */}
            <dl className="max-w-measure space-y-3 text-base leading-relaxed text-ink-2">
              <div>
                <dt className="label">What it is</dt>
                <dd>{SCORE_EXPLAINER.what}</dd>
              </div>
              <div>
                <dt className="label">What it is not</dt>
                <dd className="text-ink-1">{SCORE_EXPLAINER.whatItIsNot}</dd>
              </div>
              <div>
                <dt className="label">How to use it</dt>
                <dd>{SCORE_EXPLAINER.howToUse}</dd>
              </div>
            </dl>
          </div>
        </div>

        <h3 className="mt-7 text-base font-semibold text-ink-0">A big match is normal. Read that twice.</h3>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">
          This is the part people get wrong. A big number is not a red flag. A member from a farming
          area takes farm money and works on farm bills. That is their job. It is what representing a
          place looks like, and it produces a high number every time.
        </p>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">
          So the number is good for one thing only: choosing what to read next. A big match says
          &ldquo;this page may be worth ten minutes&rdquo;. It says nothing else. It is a
          bookmark, not a finding.
        </p>

        {/* NO_ACCUSATION is a different claim from the framing note above —
            that one is about what the evidence can support, this one is about
            what the publisher is alleging about a named person. Set apart so a
            reader does not read it as the same point restated. */}
        <p className="mt-4 max-w-measure-wide border-t border-line pt-3 text-base leading-relaxed text-ink-1">
          {NO_ACCUSATION}
        </p>

        <h3 className="mt-7 text-base font-semibold text-ink-0">The four names for a number</h3>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">
          Every match number is also given a name in words. The names are the same four everywhere on
          the site. They describe size, and nothing more.
        </p>
        <ul className="rows mt-3 max-w-2xl">
          {BANDS.map((b) => (
            <li key={b.when} className="flex flex-wrap items-baseline gap-x-3 py-2">
              <span className="tnum w-28 shrink-0 text-sm text-ink-3">{b.when}</span>
              <span className="text-base font-medium text-ink-0">
                {OVERLAP_BAND_PLAIN[overlapBand(b.score)]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- the four ordinary explanations -------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Four dull reasons a big match happens</SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          When the site finds one of these on the record, it says so on the page, above everything
          else. Check them before you think anything. One of them is usually the whole story.
        </p>
        <ol className="max-w-measure space-y-4">
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">1.</span>They sit on the committee
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              The <Term k="committee">committee of jurisdiction</Term> is the group that handles this
              subject. Members ask for the committee that covers the industries back home. So the
              money and the subject line up by design.
            </p>
          </li>
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">2.</span>They wrote the bill
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              A <Term k="sponsor">sponsor</Term> writing a bill about their own area's biggest
              industry is the ordinary case. It would be odd if they did not.
            </p>
          </li>
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">3.</span>The industry is simply big in that state
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              If the same industry is the top donor for several members of the same state, the fact
              is about the state, not about one person. The site checks this and tells you the count.
            </p>
          </li>
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">4.</span>The total is small
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              A match is a share of a total. When the total is small, one ordinary cheque makes a
              big share. Always look at the dollar figure next to the percentage.
            </p>
          </li>
        </ol>
      </section>

      {/* ---- what would make it interesting ------------------------------- */}
      <section className="mt-10">
        <SectionTitle>What would make it worth someone's attention</SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          A big match on its own is not a story. These four checks are what the site puts next to
          every match number. Not one of them can be answered from this site alone. That is the
          point: the number sends you somewhere else.
        </p>
        <ol className="max-w-measure space-y-3 text-base leading-snug text-ink-2">
          <li>
            <strong className="font-semibold text-ink-1">1. Find the vote.</strong> The match number
            does not use it at all. Many bills never get a{' '}
            <Term k="rollCall">roll-call vote</Term>, so there may be nothing to find.
          </li>
          <li>
            <strong className="font-semibold text-ink-1">2. Look at members who took none of that
            money.</strong> Did they vote the same way? If they did, the money explains nothing.
          </li>
          <li>
            <strong className="font-semibold text-ink-1">3. Check the dates.</strong> Money that
            arrived after a position was taken cannot have caused it.
          </li>
          <li>
            <strong className="font-semibold text-ink-1">4. Read what the member said.</strong> In
            their own words. It is public, and it is very often the whole answer.
          </li>
        </ol>
      </section>

      {/* ---- the limits, as reading advice --------------------------------
          Four amber boxes in a row is the habituation problem styles.css
          documents: identical warnings stacked teach a reader to skip warnings.
          These are real gaps and they are stated in full — but each one is
          paired with the thing to DO about it, which is what makes a limit
          usable rather than decorative. The full list lives on /limitations. */}
      <section className="mt-10">
        <SectionTitle note={<Link className="link" to="/limitations">The full list of gaps →</Link>}>
          Four gaps, and what to do about each
        </SectionTitle>
        <ul className="mt-3 space-y-5">
          <Limit
            what={
              <>
                <strong className="font-semibold">It sees only reported{' '}
                <Term k="hardMoney">hard money</Term>.</strong> Money given straight to a campaign
                and filed with the government. Dark money, most{' '}
                <Term k="superpac">super PAC</Term> spending and lobbying are all outside it.
              </>
            }
            doThis={
              <>
                Read every total as a floor, never a full picture. A small total does not mean a
                member had little support. It means little was reported here.
              </>
            }
          />
          <Limit
            what={
              <>
                <strong className="font-semibold">A lot of money has no employer on the
                filing.</strong> Many filings say SELF, RETIRED or nothing at all. No tool can
                assign that money to an industry, ever. This is not a bug that will be fixed.
              </>
            }
            doThis={
              <>
                Look for the line under each figure saying how much could not be matched. If it is
                large, the percentage above it is weak. Discount it on sight.
              </>
            }
          />
          <Limit
            what={
              <>
                <strong className="font-semibold">Industry tags on bills are worked out, not
                official.</strong> Nobody publishes a list of the industries a bill affects. This
                tool infers them, and it is sometimes wrong.
              </>
            }
            doThis={
              <>
                Read <em className="not-italic font-medium text-ink-2">What this bill does</em>, then
                judge the tags yourself. Each tag shows how sure the tool is. A low number means
                treat it as a guess.
              </>
            }
          />
          <Limit
            what={
              <>
                <strong className="font-semibold">There is no timeline.</strong> Nothing here links
                the date on a cheque to the date of a bill action. Money is reported one{' '}
                <Term k="cycle">cycle</Term> at a time.
              </>
            }
            doThis={
              <>
                Never read a match number as a sequence of events. If dates matter to your question,
                you need the filings themselves, which every figure links to.
              </>
            }
          />
        </ul>
      </section>

      {/* ---- if you think you found something ------------------------------ */}
      <section className="mt-10">
        <SectionTitle>If you think you have found something</SectionTitle>
        <ol className="max-w-measure space-y-2.5 text-base leading-relaxed text-ink-2">
          <li>
            <strong className="font-semibold text-ink-1">1. Open the filing.</strong> Every figure on
            this site links to the government record behind it. Click it. Check the amount, the date
            and the committee against what you were shown.
          </li>
          <li>
            <strong className="font-semibold text-ink-1">2. Rule out the four dull reasons
            first.</strong> Committee seat, they wrote it, the industry is big in the state, the
            total is small. Most findings dissolve right here, and that is a good outcome.
          </li>
          <li>
            <strong className="font-semibold text-ink-1">3. Treat what is left as a question, not
            an answer.</strong> A question for a reporter, or a records request. Proving anything
            needs interviews, documents and dates. This site has none of those.
          </li>
        </ol>
        <p className="mt-4 max-w-measure text-base leading-relaxed text-ink-3">
          A screenshot of a percentage is not a finding. It is the first ten minutes of work.
        </p>
        <p className="mt-5 text-sm text-ink-3">
          <Link className="link" to="/methodology">How the numbers work →</Link> ·{' '}
          <Link className="link" to="/limitations">What this tool cannot do →</Link> ·{' '}
          <Link className="link" to="/about">What this project is →</Link>
        </p>
      </section>
    </div>
  );
}
