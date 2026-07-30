/**
 * What this project is.
 *
 * ---------------------------------------------------------------------------
 * VOICE RULES FOR THIS FILE — please keep them if you edit it.
 *
 * This is a personal open-source project, MIT licensed. It is not an
 * organisation, has no staff, sells nothing, and hosts nothing. The page is
 * therefore written in neutral third person — "this project", "the pipeline",
 * "the reader" — and never in a corporate first person plural. Marketing
 * vocabulary is out of place here: there is nobody to market to, and implying
 * otherwise would misrepresent what somebody is downloading.
 *
 * It also matters that no hosted service is implied anywhere. Somebody reading
 * this is running a copy on their own machine, holding their own keys, with no
 * account and nothing reporting back. Any sentence that suggests otherwise is a
 * factual error about the software, not a style preference.
 * ---------------------------------------------------------------------------
 */

import { Link } from 'react-router-dom';
import {
  NO_ACCUSATION,
  PROJECT_CONTACT_LABEL,
  PROJECT_CONTACT_URL,
  PROJECT_FUNDING,
  PROJECT_NAME,
  PROJECT_REPO_URL,
  PROJECT_REPO_URL_IS_PLACEHOLDER,
  PROJECT_TAGLINE,
} from '@ftm/core';
import { getIndex } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { LongDisclaimer } from '../components/Framing';
import { Empty, ErrorState, Loading, SectionTitle } from '../components/ui';

export default function About() {
  const { data: idx, error, loading } = useAsync(getIndex, []);

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">About {PROJECT_NAME}</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-2">{PROJECT_TAGLINE}</p>
      {/* No <FramingNote/> at the top of this page: the full correlation
          statement is a section of the page itself, further down, in its own
          words. Repeating a shorter version of it above would be the third copy
          on one screen. The section immediately below is a different claim, not
          a shorter copy of that one — see the note on it. */}

      {/* ---- not an accusation ---------------------------------------------
          ---------------------------------------------------------------------
          This is the highest thing on the page on purpose, and it is not a
          second copy of the correlation framing further down.

          The correlation language answers a question about evidence. The
          question a reader actually arrives with — having just seen their own
          representative named next to a dollar figure — is whether this site is
          accusing that person of something. Nothing here ever said no, so
          readers answered it themselves, and the answer they reached was the
          uncharitable one. If it is not being alleged, it costs one paragraph
          to say so before anything else on the page.

          Wording comes from @ftm/core (NO_ACCUSATION) like every other framing
          string, so the mobile app makes the identical claim and no view can
          soften this one alone. Rendered as ordinary lead prose, NOT amber:
          principle 1 of styles.css reserves amber for "the data has a gap", and
          this is not a gap in the data.
          --------------------------------------------------------------------- */}
      <section className="mt-7">
        <SectionTitle>This is not an accusation</SectionTitle>
        <p className="max-w-measure-wide text-md leading-relaxed text-ink-1">{NO_ACCUSATION}</p>
      </section>

      {/* ---- who to contact, and who paid for it ----------------------------
          ---------------------------------------------------------------------
          A reviewer who was otherwise ready to trust this site stopped here:
          the footer had a heading reading "OPEN SOURCE" over a block containing
          no link, there was nowhere to report an error, and nothing said whether
          anybody was funding the thing. Those two gaps are what made a claim of
          openness unverifiable, and they are the cheapest possible things to fix.

          What answers them is a working corrections route and a plain statement
          about money — not a name. A name would not let anyone check a single
          figure on this site; the published source does that, and it does it for
          a reader who has never heard of whoever wrote it. So this section names
          nobody, and it does not hedge about that either: it says what is true,
          which is that the work is unfunded, personal, and inspectable line by
          line by anyone who disagrees with it.

          The values come from @ftm/core, not from this file, so the mobile app
          and any future surface answer identically. This block is plain — not
          amber. Under principle 1 of styles.css the amber caveat colour means
          "the data has a gap", and who published a build is not a data gap.
          --------------------------------------------------------------------- */}
      <section className="mt-8">
        <SectionTitle>Who to contact, and who paid for it</SectionTitle>
        <p className="mb-3 max-w-measure text-base leading-relaxed text-ink-2">
          Nobody is named on this site, and nothing about reading it depends on a name: the whole
          method is published, so any figure on any page can be recomputed — and argued with — by
          somebody who has never heard of whoever wrote it. The two things that do change how this
          should be read are where a correction goes and whose money is behind it. Both are stated
          plainly below, and the short version of each is that corrections go to the issue tracker
          and nobody is funding this.
        </p>
        <dl className="max-w-measure-wide space-y-2.5 text-base leading-relaxed text-ink-2">
          <div>
            <dt className="label">Contact</dt>
            <dd>
              <a className="link" href={PROJECT_CONTACT_URL} target="_blank" rel="noreferrer noopener">
                {PROJECT_CONTACT_LABEL}
              </a>
              . Corrections are the most useful thing you can send. If a figure here disagrees with
              the filing it links to, the filing is right and this tool is wrong — say so and it
              gets fixed.
            </dd>
          </div>
          <div>
            <dt className="label">Who funds it</dt>
            <dd>{PROJECT_FUNDING}</dd>
          </div>
        </dl>
        <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-2">
          There is no account to open and no data collected about you. The site runs from files your
          browser has already downloaded, and any language-model classification runs on the
          reader's own key.
        </p>
      </section>

      {/* ---- corrections ----------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Something looks wrong on a page</SectionTitle>
        <ol className="max-w-measure space-y-2.5 text-base leading-relaxed text-ink-2">
          <li>
            <strong className="font-semibold">1. Open the primary record.</strong> Every figure on
            every page links to the government file it came from — the FEC filing, the Congress.gov
            record, the USASpending award. Start there.
          </li>
          <li>
            <strong className="font-semibold">2. If this site and that record disagree, this site
            is wrong.</strong> That is a bug in the code here, not a dispute with the agency, and it
            should be reported using the contact above.
          </li>
          <li>
            <strong className="font-semibold">3. If the record itself is wrong,</strong> the
            correction belongs with the agency that published it. Nothing here can amend a federal
            filing, and this project deliberately does not edit the source data it displays.
          </li>
          <li>
            <strong className="font-semibold">4. If a sector looks misassigned,</strong> that is the
            most likely kind of error on this site by a wide margin. Sector labels are inferred from
            free text somebody typed on a form.{' '}
            <Link className="link" to="/methodology">How that inference works</Link>.
          </li>
        </ol>
      </section>

      {/* ---- what it is --------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>What this is</SectionTitle>
        <div className="max-w-measure space-y-3 text-base leading-relaxed text-ink-2">
          <p>
            This is a personal open-source project, released under the MIT licence. It is not an
            organisation, not a business, and not a service anybody operates on somebody else's
            behalf. There is nothing to buy, nothing to subscribe to, and nobody to bill.
          </p>
          <p>
            It does one narrow thing. It downloads public government filings — campaign-finance
            records from the Federal Election Commission, legislative records from Congress, federal
            award records from USASpending — normalises them into one local database, and puts the
            money next to the legislation so a reader can see where the two touch. That is the entire
            scope. It does not tell anybody why a vote happened, because it cannot know.
          </p>
          <p>
            The reason it exists is that both halves of this data have always been public and neither
            half has ever been easy to hold in one hand. Joining them is not hard; it is just tedious,
            and it had not been done in a form somebody could run for themselves, inspect line by
            line, and disagree with.
          </p>
        </div>
      </section>

      {/* ---- how it runs --------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>How it runs</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <h3 className="label mb-1.5">On the reader's own machine</h3>
            <p className="text-sm leading-relaxed text-ink-3">
              The pipeline runs locally. It fetches from government sources into a local SQLite file,
              computes everything at build time, and writes a folder of plain JSON. What is on screen
              right now was rendered from files sitting on the machine serving this page — there is no
              query API, no database connection from the browser, and no backend involved in drawing
              any view here.
            </p>
          </div>
          <div className="card p-4">
            <h3 className="label mb-1.5">With the reader's own keys</h3>
            <p className="text-sm leading-relaxed text-ink-3">
              A first run needs no API keys at all: three of the four sources publish bulk files or
              open endpoints with no signup, and the fourth is public-domain data. Keys are strictly
              additive and always belong to whoever is running the pipeline. Nothing in the repository
              ships a key, falls back to a shared key, or borrows anybody else's quota — if a key is
              missing, the script explains how to obtain a free one and stops.
            </p>
          </div>
          <div className="card p-4">
            <h3 className="label mb-1.5">No account, no telemetry, no server</h3>
            <p className="text-sm leading-relaxed text-ink-3">
              There is nothing to sign up for, because there is nothing to sign up to. No analytics,
              no error reporting, no usage tracking, no cookies for identity, nothing phoning home.
              Search runs entirely in the browser against a prebuilt index, so a typed query never
              leaves the device. The one exception is an optional address lookup that only runs when a
              reader explicitly triggers it, and which says so on screen before it does.
            </p>
          </div>
          <div className="card p-4">
            <h3 className="label mb-1.5">Portable on purpose</h3>
            <p className="text-sm leading-relaxed text-ink-3">
              The build output is a folder of static files. It works opened straight off a disk with
              no server at all, and on any static host with no rewrite rules — which is why routing
              here uses hashes. Running this should cost nobody anything and should not depend on
              anybody staying online, including whoever wrote it.
            </p>
          </div>
        </div>
      </section>

      {/* ---- what it deliberately does not do -------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Deliberate constraints</SectionTitle>
        <ul className="max-w-measure space-y-2.5 text-base leading-relaxed text-ink-2">
          <li>
            · <strong className="font-semibold">Party is never a colour.</strong> Party affiliation is
            stored and displayed as a plain factual letter, and is never used to sort, rank, filter or
            colour anything. The palette contains no saturated red or blue for exactly this reason: a
            reader should not be able to tell “which side” a page is about at a glance.
          </li>
          <li>
            · <strong className="font-semibold">A number is never an alarm.</strong> Every bar on this
            site uses one neutral ink ramp, so the eye reads “more or less”, never “good or bad”. This
            is also why the site no longer prints a match number between one member and one bill: it
            was read as a verdict, and money lining up with a member's own subject area is common and
            usually has an entirely ordinary explanation.
          </li>
          <li>
            · <strong className="font-semibold">Framing travels with the data.</strong> Every
            disclaimer string comes from one file in the core package. Nothing writes its own wording,
            so the framing cannot be softened in one view without being softened everywhere — and a
            test fails when a view stops rendering it. The banner at the bottom of every page has no
            dismiss button on purpose.
          </li>
          <li>
            · <strong className="font-semibold">Every figure is traceable.</strong> Each stored record
            keeps the government's own identifier, a deep link to the primary filing, and the time it
            was fetched. Any number on screen is one click from the record it came from.
          </li>
          <li>
            · <strong className="font-semibold">Uncertainty is shown, not smoothed.</strong> Money that
            could not be attributed to a sector is reported as its own visible figure rather than
            being quietly dropped or guessed at, and each classification records which method produced
            it.
          </li>
        </ul>
      </section>

      {/* ---- the claim ------------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>The claim this project makes, in full</SectionTitle>
        <div className="max-w-3xl">
          <LongDisclaimer />
        </div>
        <p className="mt-4 max-w-measure-wide text-sm leading-relaxed text-ink-3">
          Two pages are worth reading before anything here is used for anything:{' '}
          <Link className="link" to="/methodology">how the numbers work</Link>, which walks through
          every derivation and works one score out by hand, and{' '}
          <Link className="link" to="/limitations">what this tool cannot do</Link>, which is specific
          about the conclusions this data cannot support however the figures look.
        </p>
      </section>

      {/* ---- licence and contributions ---------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>Licence, source and contributions</SectionTitle>
        <div className="max-w-measure space-y-3 text-base leading-relaxed text-ink-2">
          {/* A hyperlink to a placeholder is worse than no hyperlink: it looks
              like provenance and resolves to nothing. While PROJECT_REPO_URL is
              unset, say so instead of rendering a dead link. */}
          {PROJECT_REPO_URL_IS_PLACEHOLDER ? (
            <p>
              MIT licensed. <strong className="font-semibold">This is an unpublished build and it
              has no public source link yet.</strong> Nothing is being withheld — an address simply
              has not been set for this copy, and whoever publishes it has to set one. Until then
              there is no repository to point at, and saying so is more useful than a heading that
              promises source code and links nowhere. Anybody with the source is free to run it, fork
              it, correct it, or take it somewhere else entirely.
            </p>
          ) : (
            <p>
              MIT licensed. The source is public at{' '}
              <a className="link" href={`https://${PROJECT_REPO_URL}`} target="_blank" rel="noreferrer noopener">
                {PROJECT_REPO_URL}
              </a>
              . Anybody is free to run it, fork it, correct it, or take it somewhere else entirely.
            </p>
          )}
          <p>
            The parts most worth contributing to are the ones a regular expression cannot reach: the
            curated table of organisations whose sector is not readable from the name, and the sector
            taxonomy itself. Entries there must cite a public source, must classify an economic
            interest rather than a political side, and must fall back to “funding source not visible”
            when the truth is that the funding is genuinely not visible. Corrections to the underlying
            government data belong with the agency that published it, and every page here links to the
            record so that is possible.
          </p>
          <p>
            Government filings are public records. The sector taxonomy in this repository is built from
            raw disclosure text rather than licensed from anybody, which makes it noisier than
            hand-coded commercial datasets — that trade is made deliberately, and it is the reason all
            of this can be given away.
          </p>
        </div>
      </section>

      {/* ---- this bundle -------------------------------------------------------- */}
      <section className="mt-10">
        <SectionTitle>The copy of the data you are reading</SectionTitle>
        {error ? (
          <ErrorState error={error} />
        ) : loading ? (
          <Loading what="bundle details" />
        ) : !idx ? (
          <Empty>No bundle metadata is available for this copy of the data.</Empty>
        ) : (
          <dl className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-4">Generated</dt>
              <dd className="tnum text-ink-2">{new Date(idx.generatedAt).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-4">Coverage</dt>
              <dd className="tnum text-ink-2">FEC cycle {idx.cycle} · {idx.congress}th Congress</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-4">Campaign finance</dt>
              <dd className="mono text-ink-2">{idx.sources.openfec}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-4">Legislation</dt>
              <dd className="mono text-ink-2">{idx.sources.congress}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-4">Classification</dt>
              <dd className="mono text-ink-2">{idx.sources.classification}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-4">Origin</dt>
              <dd className="text-ink-2">{idx.isSample ? 'Checked-in sample data' : 'Fetched from primary sources'}</dd>
            </div>
          </dl>
        )}
        <p className="mt-4 text-sm text-ink-4">
          <Link className="link" to="/methodology">How the numbers work →</Link> ·{' '}
          <Link className="link" to="/limitations">What this cannot do →</Link>
        </p>
      </section>
    </div>
  );
}
