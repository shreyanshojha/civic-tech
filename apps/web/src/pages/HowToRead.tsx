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
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE USED TO TEACH THE MATCH NUMBER. THE MATCH NUMBER IS GONE.
 *
 * Two whole sections went with it: "How to read the match number" — a demo
 * score, the score explainer, and the four band names — and "Four dull reasons a
 * big match happens". This page's own sentence about that number was the clearest
 * verdict anybody wrote on it: "A big match says 'this page may be worth ten
 * minutes'. It says nothing else. It is a bookmark, not a finding." Three
 * independent evaluations of the site agreed, so the number was cut from every
 * page rather than explained better.
 *
 * The honesty was not deleted, it was redirected. The four dull reasons still
 * have a section, because they are exactly the reasons a committee gap on
 * /patterns is usually ordinary, and the reasons a member's own page looks the
 * way it does. What replaced the demo score is a section on reading the money on
 * a member's page: the names, the floor under every share, and the control that
 * can answer "no".
 * ---------------------------------------------------------------------------
 */

import { Link } from 'react-router-dom';
import { NO_ACCUSATION } from '@ftm/core';
import { FramingNote } from '../components/Framing';
import { Term } from '../components/Glossary';
import { SectionTitle } from '../components/ui';

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
        names every file the figures come from, and every threshold and test the code applies. Come
        here to learn how to read a page. Go there to check the working.
      </p>

      {/* The one framing block on this page. It carries DISCLAIMER_MEDIUM, not
          the sentence the sticky banner is already showing. */}
      <FramingNote className="mt-4 max-w-measure-wide" />

      {/* ---- the question ------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>The one question this site answers</SectionTitle>
        <p className="max-w-measure text-md leading-relaxed text-ink-1">
          Who gave reported money to a member of Congress, and what that member's Congress is working
          on.
        </p>
        <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-2">
          Both lists are public. Nobody had put them in one place, so this site does that, and links
          every number back to the filing it came from. It stops there. It does not score how well the
          two lists line up for one person, because a number like that cannot be read — see below.
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
          person's share tells you very little on its own. Fifty of them, next to four hundred
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
                Their page opens with the names of the biggest reported givers, then how much was
                reported in all, then the sectors it came from. Nothing you type is sent anywhere.
                The ZIP file is read on your own device.
              </>
            }
          />
          <Walkthrough
            n={2}
            title="Open a bill and find out what it does"
            to="/bills"
            linkLabel="Go to Bills"
            steps={[
              <>
                Open <strong className="font-semibold text-ink-1">Bills</strong> in the top menu.
                Search a subject, or a number like <span className="mono">hr 1234</span>.
              </>,
              <>
                On a bill page, read{' '}
                <em className="not-italic font-medium text-ink-1">In plain words</em> first: what it
                does, who it touches, what would change.
              </>,
              <>
                Then <em className="not-italic font-medium text-ink-1">Industries this bill would
                affect</em>. Each tag says how sure this tool is of it.
              </>,
              <>
                Open <em className="not-italic font-medium text-ink-1">The paperwork</em> for the
                sponsor, the committees, and the official summary word for word.
              </>,
            ]}
            then={
              <>
                Some bills have a real summary published for them and some have only a title. The
                page says which of the two you are reading, every time, and never dresses a title up
                as a description.
              </>
            }
          />
          <Walkthrough
            n={3}
            title="Compare one committee with everyone else"
            to="/patterns"
            linkLabel="Go to Committees"
            steps={[
              <>
                Open <strong className="font-semibold text-ink-1">Committees</strong> in the top menu.
              </>,
              <>
                Read the first line. It says how many comparisons were run, and how many passed every
                check. Both numbers matter.
              </>,
              <>
                Open one from <em className="not-italic font-medium text-ink-1">Worth a look</em> to
                see every check it passed, and the members behind it.
              </>,
              <>
                Then open <em className="not-italic font-medium text-ink-1">The rest of the
                search</em>. Those are the ones that failed. They are on the page on purpose.
              </>,
            ]}
            then={
              <>
                This is the only place on the site where a comparison has a group on both sides. Even
                here, the strongest thing said is that a gap is worth reading about. A{' '}
                <Term k="committee">committee of jurisdiction</Term> attracts the money of the
                industries it handles, which is an ordinary reason for a gap.
              </>
            }
          />
        </ol>
        {/* The Sectors page is a taxonomy list, not a walkthrough: there is
            nothing to do on it but read. It still needs naming here, because a
            reader who meets "Insurance" on a member page needs to know where the
            definition lives. */}
        <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-2">
          One more page is worth knowing about.{' '}
          <Link className="link font-medium text-ink-1" to="/industries">Sectors</Link> lists every
          group of employers this site sorts money into, says what each one covers, and links to the
          bills tagged with it. Three of the groups are not industries at all, and it says which and
          why.
        </p>
      </section>

      {/* ---- reading a member's money -------------------------------------
          This section replaced "How to read the match number". The number it
          taught is gone from the site; what a reader actually meets on a member
          page is a list of names, a set of shares, and a gap. Those need reading
          advice more than a deleted percentage did. */}
      <section className="mt-10">
        <SectionTitle note={<Link className="link" to="/methodology">Where the figures come from →</Link>}>
          How to read a member's money
        </SectionTitle>
        <p className="max-w-measure text-base leading-relaxed text-ink-2">
          A member's page starts with names: the biggest reported amounts that came with a name on
          the filing. Read those first. They are the most concrete thing on the site, and you may
          well recognise some of them.
        </p>
        <ol className="mt-4 max-w-measure space-y-4">
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">1.</span>A name is not always a giver
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              A row marked <Term k="pac">PAC</Term> is a real group that gave under its own name. A
              row marked <em className="not-italic font-medium text-ink-1">its employees</em> is not
              one giver at all. It is the employer that people wrote on their own forms, added up.
              The company gave nothing. Companies are barred by law from giving to federal
              candidates.
            </p>
          </li>
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">2.</span>Every share is a floor
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              On most members, a lot of the money has no employer written on the form. Nobody can put
              that money in a sector — not this site, not a perfect one. So each page says how much
              is missing, right under the figure it affects. Read that line before you read the
              share above it.
            </p>
          </li>
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">3.</span>You can ask about one sector, and get
              a straight no
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              Only the three largest sectors are shown as bars. If the sector you care about is not
              one of them, use{' '}
              <em className="not-italic font-medium text-ink-1">Check a specific industry</em> on the
              same page. It gives one of three answers: a figure, nothing at all, or “we could not
              tell” — and it says which, in plain words.
            </p>
          </li>
        </ol>

        <h3 className="mt-7 text-base font-semibold text-ink-0">
          There is no “match score” on this site any more
        </h3>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">
          Until recently every member page and every bill page carried one percentage: how much of a
          member's money came from industries that bill would affect. It is gone. It was the biggest
          number on the site and it could not carry any weight.
        </p>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">
          Here is why, in the words this page used to use about it: a big match said “this page may
          be worth ten minutes”, and nothing else. It was a bookmark, not a finding. A member from a
          farming area takes farm money and works on farm bills. That is the job. It produced a big
          number every time, and readers read that number as a verdict.
        </p>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">
          What is left in its place is the{' '}
          <Link className="link font-medium text-ink-1" to="/patterns">committee comparison</Link>,
          which asks the same kind of question about a group of fifty people instead of one, and can
          be tested.
        </p>

        {/* NO_ACCUSATION is a different claim from the framing note above —
            that one is about what the evidence can support, this one is about
            what the publisher is alleging about a named person. Set apart so a
            reader does not read it as the same point restated. */}
        <p className="mt-4 max-w-measure-wide border-t border-line pt-3 text-base leading-relaxed text-ink-1">
          {NO_ACCUSATION}
        </p>
      </section>

      {/* ---- the four ordinary explanations --------------------------------
          These four used to explain away a big match number. They apply just as
          well to what is left: a member whose donors sit in their own subject
          area, and a committee whose money looks different from everyone else's.
          The honesty is the same; only the thing it is pointed at changed. */}
      <section className="mt-10">
        <SectionTitle>Four dull reasons the money lines up</SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          This holds whether you are reading one member's page or a committee comparison. Check these
          four first. One of them is usually the whole story.
        </p>
        <ol className="max-w-measure space-y-4">
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">1.</span>They sit on the committee
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              The <Term k="committee">committee of jurisdiction</Term> is the group that handles one
              subject. Members ask for the committee that covers the industries back home. So the
              money and the subject line up by design. This is the main reason a committee's money
              can differ from everybody else's without anything being wrong.
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
              If the same industry is the top source for several members of one state, the fact is
              about the state, not about a person. Every committee comparison reports how many
              different states its ten largest members come from, for exactly this reason.
            </p>
          </li>
          <li>
            <h3 className="text-base font-semibold text-ink-0">
              <span className="tnum mr-1.5 text-ink-4">4.</span>The total is small
            </h3>
            <p className="mt-1 text-base leading-snug text-ink-2">
              A share is always a share of a total. When the total is small, one ordinary cheque
              makes a big share. Always look at the dollar figure next to a percentage. Committee
              comparisons leave out members with very little reported money for this reason, and say
              how many were left out.
            </p>
          </li>
        </ol>
      </section>

      {/* ---- what would make it interesting ------------------------------- */}
      <section className="mt-10">
        <SectionTitle>What would make it worth someone's attention</SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          Money sitting near a subject is not a story. These are the four checks that would begin to
          make one. Not one of them can be answered from this site alone. That is the point: this
          site is where the question starts, not where it ends.
        </p>
        <ol className="max-w-measure space-y-3 text-base leading-snug text-ink-2">
          <li>
            <strong className="font-semibold text-ink-1">1. Find the vote.</strong> Nothing on this
            site uses one. Many bills never get a <Term k="rollCall">roll-call vote</Term> at all, so
            there may be nothing to find.
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
                Never read money near a subject as a sequence of events. If dates matter to your
                question, you need the filings themselves, which every figure links to.
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
            first.</strong> Committee seat, they wrote the bill, the industry is big in the state, the
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
