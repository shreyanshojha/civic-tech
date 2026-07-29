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
import { PROJECT_NAME, PROJECT_REPO_URL, PROJECT_REPO_URL_IS_PLACEHOLDER, PROJECT_TAGLINE } from '@ftm/core';
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
      {/* No framing note at the top of this page: the full statement is a
          section of the page itself, further down, in its own words. Repeating
          a shorter version of it above would be the third copy on one screen. */}

      {/* ---- who made it ---------------------------------------------------
          ---------------------------------------------------------------------
          A reviewer who was otherwise ready to trust this site stopped here:
          no human is named anywhere in it, the footer had a heading reading
          "OPEN SOURCE" over a block containing no link, and there was nowhere
          to report an error. Anonymity plus an unverifiable claim of openness
          reads as evasion whatever the intent, and it is the cheapest possible
          thing to fix.

          It cannot be filled in from inside the code, because the code does
          not know who is publishing this copy. So it is a visible, deliberately
          unmissable TODO rather than a blank: a reader can see that the slot
          exists and has not been filled, which is a true statement about this
          build, instead of seeing nothing and concluding it was hidden.
          --------------------------------------------------------------------- */}
      <section className="mt-8">
        <SectionTitle>Who is behind this, and who paid for it</SectionTitle>
        {/* Amber, and legitimately so under principle 1 of styles.css: this is
            a gap in what this build can tell the reader, which is the one thing
            the colour is reserved for. It is not a warning about a person. */}
        <div className="caveat max-w-measure-wide px-3 py-2.5">
          <p>
            <strong className="font-semibold">
              TODO — whoever publishes this build must fill this section in before it goes public.
            </strong>{' '}
            Replace the three lines below with real values. A civic-data site that will not say who
            made it and who funded it has not earned anybody's trust, and this placeholder is here so
            that publishing without answering is a visible omission rather than a silent one.
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <strong className="font-semibold">Maintainer:</strong> not set — put a real name or a
              named group here.
            </li>
            <li>
              <strong className="font-semibold">Contact:</strong> not set — an address a reader can
              actually reach, for corrections and questions.
            </li>
            <li>
              <strong className="font-semibold">Funding:</strong> not set — state who pays for this
              work, or state plainly that nobody does and it is unfunded personal work.
            </li>
          </ul>
        </div>
        <p className="mt-3 max-w-measure text-base leading-relaxed text-ink-2">
          What can be said without knowing who published this copy: the project takes no money from
          any political party, campaign, committee, candidate, industry group or advocacy
          organisation, because it takes no money at all — there is nothing to buy and no account to
          open. It runs on the reader's own machine with the reader's own keys.
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
            should be reported to whoever maintains this build using the contact above.
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
            · <strong className="font-semibold">A score is never an alarm.</strong> Overlap magnitudes
            use one neutral ink ramp, so the eye reads “more or less”, never “good or bad”. A high
            overlap is common and frequently has an entirely ordinary explanation.
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
