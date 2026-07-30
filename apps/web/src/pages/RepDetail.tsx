/**
 * One member of Congress.
 *
 * The page is ordered by how much the reader can trust each block:
 *   1. Who they are — straight from the Congress.gov record.
 *   2. What was disclosed to the FEC — a filing, not an inference.
 *   3. What this tool computed on top of that — the overlap scores, which are
 *      fenced by the disclaimer and never rendered as a bare number.
 *   4. Federal spending in the district — context only, and labelled as such.
 *
 * ---------------------------------------------------------------------------
 * WHAT CHANGED, AND WHAT DID NOT
 *
 * The order above is right and is unchanged. What changed is that the page used
 * to open with three stat blocks, a sector bar chart, two amber coverage notes
 * and a donor table before a reader got to a single sentence they could act on.
 * There is now an "at a glance" block at the top — the total in plain words,
 * the three biggest sectors as bars, the single biggest overlap — and the rest
 * of the page folds underneath it.
 *
 * The names now come BEFORE the sector labels. A first-time reader was given her
 * own congressman's page and the only thing on it that meant anything to her was
 * the list of who gave — Regions Financial, Drummond, Alabama Power. That list
 * sat four expanders deep behind "Show all 41 rows", under three abstract sector
 * labels covering about 15% of the money. Her verdict: the site led with the
 * abstraction and hid the concrete thing it already knew. So the seven biggest
 * named rows are the first block under the header, open, no tapping — see
 * `<NamedDonors/>` below. Nothing was deleted to make room: the sector cards, the
 * full "By industry" bars and the whole donor table are all still on the page,
 * further down.
 *
 * The coverage gaps (money with no employer on file, money with an employer we
 * could not place, absent roll-call votes) are NOT folded away. A short plain
 * version of the most important one sits inside the at-a-glance block, next to
 * the percentages it qualifies, because a percentage that silently excludes 15%
 * of the money is a misleading percentage. The full amber notes are one tap
 * below, in the same section as the numbers they belong to.
 * ---------------------------------------------------------------------------
 */

import { useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  INDUSTRIES, INDUSTRY_BY_ID, billLabel, describeOverlap, donorDisplayName, isNoEmployerAggregate,
  plainAmount, plainShare, shortDate, usd,
} from '@ftm/core';
import type { IndustryId } from '@ftm/core';
import { getIndex, getMemberDetail } from '../lib/data';
import type { BillSummary, DonorProfile } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { useViewMode } from '../lib/view';
import {
  CoverageNote, DataLimit, FramingNote, OverlapScore, ReportProblemLink, SourceLink,
  bandNoteFor, distinctBands,
} from '../components/Framing';
import { placesLine, seatLine as seatLineFor } from '../lib/seat';
import { WhatThisMeans } from '../components/WhatThisMeans';
import { Empty, ErrorState, IndustryBars, Loading, MemberAvatar, MethodTag, PartyTag, SectionTitle, Stat } from '../components/ui';
import { ShareCardButton } from '../components/ShareCard';
import { shareEligibility, type ShareCardFinding } from '../lib/sharecard';
import { Fold, ViewToggle } from '../components/ViewToggle';
import { Term } from '../components/Glossary';

/**
 * The member's relationship to one bill.
 *
 * The bill record names the sponsor, so that case is certain. It does not carry
 * the cosponsor list in the member bundle, so the other two possibilities —
 * cosponsor, or a seat on a committee of jurisdiction — are reported as the
 * disjunction they actually are. Picking the more eye-catching of the two would
 * be a guess dressed as a fact, and the share card repeats this string.
 */
function roleFor(bill: { sponsorBioguideId?: string } | null | undefined, bioguideId: string): string {
  return bill?.sponsorBioguideId === bioguideId ? 'Sponsor' : 'Cosponsor or committee member';
}

/**
 * The share-card finding for one overlap row. Extracted so the row and the
 * one-per-list refusal count are computed from the same object rather than from
 * two copies that could drift.
 */
interface MemberCardContext {
  bioguideId: string;
  memberName: string;
  memberSubtitle: string;
  cycle: number | null;
  totalDisclosed: number | null;
}

function findingFor(
  o: { billId: string; score: number; matches: { industry: IndustryId; donorAmount: number }[] },
  bill: BillSummary | null | undefined,
  ctx: MemberCardContext,
): ShareCardFinding {
  const top = o.matches[0] ?? null;
  return {
    memberName: ctx.memberName,
    memberSubtitle: ctx.memberSubtitle,
    cycle: ctx.cycle,
    totalDisclosed: ctx.totalDisclosed,
    billLabel: bill ? billLabel(bill.billType, bill.billNumber) : o.billId,
    billTitle: bill?.title ?? '',
    topIndustryLabel: top ? (INDUSTRY_BY_ID[top.industry]?.label ?? top.industry) : null,
    topIndustryAmount: top?.donorAmount ?? null,
    score: o.score,
    role: roleFor(bill, ctx.bioguideId),
    classificationMethod: bill?.classificationMethod ?? null,
    isCeremonial: (bill?.industries?.length ?? 0) === 0,
    topIndustryConfidence: bill?.industries?.[0]?.confidence ?? null,
  };
}

const DONOR_KIND_LABEL: Record<string, string> = {
  committee: 'PAC / committee',
  individual: 'Individual',
};

/**
 * One row of the member bundle's donor list. Structural, so this file does not
 * have to import the whole MemberDetail shape to describe seven rows.
 */
interface DonorRow {
  name: string;
  industry: IndustryId;
  amount: number;
  kind: string;
  sourceUrl: string;
}

/** Seven. Enough to recognise a name, few enough to read without scrolling. */
const NAMED_DONORS_LEAD = 7;

/**
 * Two words per row saying which of the two very different things this is.
 *
 * A committee row IS a donor: a PAC that made a contribution under its own name.
 * An individual row is not one donor at all — it is the employer name that
 * people typed on their own filings, added together. Companies cannot give to
 * federal candidates. The donor table further down the page spells both out in
 * full; this is the short marker so the promoted list cannot silently conflate
 * them.
 */
const DONOR_KIND_TAG: Record<string, string> = {
  committee: 'PAC',
  individual: 'Its employees',
};

/**
 * The rows themselves. Name, amount, sector — nothing else, because the point of
 * this block is that seven names are readable in about four seconds.
 */
function NamedDonorRows({ rows }: { rows: DonorRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((d, i) => {
        const n = donorDisplayName(d.name);
        // 'other' is not a sector, it is the absence of one. Saying "Not placed"
        // is the same claim the rest of the page makes about this money, in two
        // words, and it does not dress a gap up as a finding.
        const placed = d.industry !== 'other';
        const label = INDUSTRY_BY_ID[d.industry]?.label ?? d.industry;
        return (
          <li key={`${d.name}-${i}`} className="py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              {/*
                The filed name travels with the shortened one, on `title` and in
                the accessible name. Shortening is the easiest way for this site
                to misattribute money to the wrong entity, so a reader must
                always be able to see what the filing actually said without
                trusting the shortener — see packages/core/src/donor-name.ts.
              */}
              <span
                className="min-w-0 text-base font-medium text-ink-1"
                title={n.shortened ? n.filed : undefined}
              >
                {n.display}
                {n.shortened && <span className="sr-only"> — filed as {n.filed}</span>}
              </span>
              <span className="tnum shrink-0 font-medium text-ink-0">{usd(d.amount)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {placed ? (
                <Link className="chip hover:text-accent" to={`/industries/${d.industry}`}>{label}</Link>
              ) : (
                <span className="chip">Not placed</span>
              )}
              <span className="text-xs text-ink-4">{DONOR_KIND_TAG[d.kind] ?? d.kind}</span>
              {d.sourceUrl && <SourceLink href={d.sourceUrl}>The filing</SourceLink>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * WHO GAVE, BY NAME — and why it is the first block on the page.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS HIGH ON THE PAGE
 *
 * A dental hygienist in Cullman, Alabama read her own congressman's page. One
 * thing on it landed: REGIONS FINANCIAL, DRUMMOND COMPANY, ALABAMA POWER,
 * BOEING — companies she knew from her own state. "That's the only moment on
 * the whole site where something clicked."
 *
 * That list was four expanders deep, behind "Show all 41 rows". What led instead
 * was a total, a caveat about the total, and three abstract sector labels
 * covering about 15% of the money. Her words: the site "leads with the
 * abstraction and hides the concrete thing it actually knows". Asked what it all
 * meant, she got four bullets of things to go and verify: "I asked a question
 * and got assigned homework."
 *
 * The one change she said would make it worth her time was "lead with the names,
 * not the categories". So seven names lead, expanded, no tapping, above the
 * sector cards — which are still there, one screen down, along with every row of
 * the full donor table.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS BLOCK MUST NOT CLAIM
 *
 * It is not a ranking of all the money. Most disclosed money on a typical member
 * page has no employer written on the filing at all, and the export puts that in
 * one synthetic row which is NOT a donor — `isNoEmployerAggregate()` finds it and
 * it is excluded here by construction. On some members it is the largest row in
 * the file by far, so putting it in a list of names would be both wrong and the
 * loudest thing on the page. It keeps its own explanation, further down, next to
 * the figures it qualifies.
 *
 * The heading therefore says "by name" rather than "the most" or "the top", and
 * the one-line description says what the rows are. No amber here: amber means
 * "the data has a gap" (styles.css §1, DESIGN.md), and a list of donors is not a
 * gap.
 * ---------------------------------------------------------------------------
 */
function NamedDonors({ rows, isQuick }: { rows: DonorRow[]; isQuick: boolean }) {
  const lead = rows.slice(0, NAMED_DONORS_LEAD);
  const rest = rows.slice(NAMED_DONORS_LEAD);
  return (
    <div className="card-data p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-md font-semibold leading-snug text-ink-0">Who gave, by name</h3>
        <span className="tnum text-xs text-ink-3">
          {lead.length} of {rows.length} named rows
        </span>
      </div>
      <p className="mb-2 mt-1 max-w-measure-wide text-sm leading-snug text-ink-2">
        These are the largest reported amounts that carry a name — a PAC that gave under its own
        name, or an employer that donors wrote on their own filings.
      </p>
      <NamedDonorRows rows={lead} />
      {/* The "show all" disclosure is kept, but it is no longer the only way to
          see any names: it now opens the rest of a list that is already useful. */}
      {rest.length > 0 && (
        <Fold
          className="mt-2"
          open={!isQuick}
          title={`The other ${rest.length} names`}
          note={`down to ${usd(rest[rest.length - 1]?.amount ?? 0)}`}
        >
          <NamedDonorRows rows={rest} />
        </Fold>
      )}
    </div>
  );
}

/**
 * The three biggest sectors, as bars, with the share said in words.
 *
 * One hue, magnitude by length — same rule as everywhere else on the site. The
 * words matter more than the bar: "about a third of it" is a quantity a reader
 * can hold, and "33.4%" is one they skim past.
 */
function SectorGlance({
  rows,
}: {
  rows: { industry: string; amount: number; share: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const label = INDUSTRY_BY_ID[r.industry as keyof typeof INDUSTRY_BY_ID]?.label ?? r.industry;
        return (
          <li key={r.industry}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <Link className="text-base font-medium text-ink-1 hover:text-accent" to={`/industries/${r.industry}`}>
                {label}
              </Link>
              <span className="tnum text-sm text-ink-2">
                {plainAmount(r.amount)}{' '}
                <span className="text-xs text-ink-3">— {plainShare(r.share)}</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-sm bg-ink-7">
              <div
                className="h-full rounded-sm bg-ink-3"
                style={{ width: `${Math.max(2, (r.share / max) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Is my senator taking pharma money?" — answered, including when the answer
 * is no.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A reader came to this page with one sector in mind. That sector was not among
 * the member's three largest, so it appeared nowhere on the page — not as a
 * zero, not as an empty row, not at all. He read the silence as concealment and
 * left certain of something the data does not say. The page had no way to say
 * "no", so a reader who needed "no" invented "yes".
 *
 * `donorProfile.byIndustry` is the member's COMPLETE breakdown — every sector
 * with any money in it, not the top-three truncation the list pages read — so
 * this control can answer definitively. There are exactly three true answers
 * and it gives whichever one applies:
 *
 *   - a figure, with the share it is of their total;
 *   - a plain negative — nothing from this sector is in the money we traced;
 *   - "we could not tell", when so much of the money has no industry attached
 *     that even the plain negative would mislead.
 *
 * ---------------------------------------------------------------------------
 * THE THRESHOLD, AND WHY THE OLD ONE NEVER FIRED
 *
 * This control promised three answers and shipped two. The gate was
 * `unclassifiedShare >= 0.05` — five per cent of the member's TOTAL money — and
 * in this bundle the minimum unclassifiedShare across all 531 members with a
 * donor profile is 10.9%. Zero members were under 5%. So every negative came
 * out as "we could not tell", every single time, for every sector, for every
 * member. A reader who came to ask one question got a hedge, which is precisely
 * the register a distrustful reader reads as evasion.
 *
 * Measured over the 531 members in this bundle:
 *
 *   unclassifiedShare (the old denominator)   min 10.9%  p25 54.1%  median 64.2%  p95 89.6%
 *   unresolvedShare   (the one used here)     min  3.6%  p25 28.7%  median 35.9%  p95 51.3%
 *
 * The denominator changed because the two halves of "unattributed" are not the
 * same kind of thing, and the export already keeps them apart:
 *
 *   nonEmployerAmount — the filing says RETIRED / SELF-EMPLOYED / NOT EMPLOYED /
 *     HOMEMAKER. There is no employer written down, so NO tool can ever put this
 *     money in a sector. It is unattributable by construction, for everyone,
 *     forever. It cannot be concealing pharma money, because it is not
 *     concealing anything — the box on the form is empty. Bundle-wide it is
 *     36.9% of all disclosed money, which is most of why the old gate was
 *     unreachable.
 *   unresolvedAmount — an employer IS named and this tool failed to place it.
 *     THIS is the money that could be hiding the sector the reader asked about,
 *     and this is what the threshold is measured against.
 *
 * 25% is the chosen line. Below it, at least three of every four dollars that
 * carry a name were placed, so a sector showing zero placed dollars is far more
 * likely to be genuinely absent than to be sitting unrecognised in the
 * remainder. It sits just under the first quartile (28.7%), and comfortably
 * above the point where the distribution's thin left tail ends and the bulk
 * begins (20%: 4 members per 5-point bucket below it, 46 in the bucket above).
 * 80 of 531 members — 15% — fall under it, so the third answer now actually
 * reaches readers instead of being unreachable.
 *
 * Being honest about the rest: for the other 85% the answer really is "we could
 * not tell", and the copy says so plainly rather than dressing a hedge up as an
 * answer. Both branches state the figure they turn on. An OpenFEC key and a
 * language model both shrink `unresolvedAmount`, which moves members across
 * this line — the number is a property of the bundle, not of any member.
 *
 * NOTE that the plain negative is worded as a claim about the TRACED money, not
 * about the member: "nothing from this sector appears in the money we could
 * trace" is true by construction whenever the sector row is empty. The
 * threshold decides whether that is the headline or the footnote, not whether
 * it is true.
 * ---------------------------------------------------------------------------
 */
/**
 * Share of a member's total that has an employer named on the filing which this
 * tool could not place. Above this, a zero for one sector cannot be reported as
 * an absence. See the block comment above for the distribution behind it.
 */
const CANNOT_TELL_THRESHOLD = 0.25;

function SectorCheck({ profile, memberName }: { profile: DonorProfile; memberName: string }) {
  const [sectorId, setSectorId] = useState<IndustryId | ''>('');
  const selectId = `sector-check-${useId().replace(/:/g, '')}`;

  const row = sectorId ? profile.byIndustry.find((r) => r.industry === sectorId) : undefined;
  const meta = sectorId ? INDUSTRY_BY_ID[sectorId] : undefined;
  const label = meta?.label ?? sectorId;
  const unattributedPct = (profile.unclassifiedShare * 100).toFixed(0);
  // The gate. Employer-named money this tool failed to place, over the total.
  const unresolvedShare =
    profile.totalItemized > 0 ? profile.unresolvedAmount / profile.totalItemized : 1;
  const unresolvedPct = (unresolvedShare * 100).toFixed(0);
  const canRuleOut = unresolvedShare < CANNOT_TELL_THRESHOLD;

  let answer: React.ReactNode = null;
  if (sectorId) {
    if (row && row.amount > 0) {
      answer = (
        <p className="text-md leading-snug text-ink-0">
          <Link className="font-semibold hover:text-accent" to={`/industries/${sectorId}`}>{label}</Link>{' '}
          — <span className="tnum font-semibold">{usd(row.amount)}</span> reported{' '}
          <span className="tnum text-ink-2">({(row.share * 100).toFixed(1)}% of their money)</span>
        </p>
      );
    } else if (canRuleOut) {
      // The clear negative, and it LEADS. The qualification is one line, after
      // it, in the quieter tier — not wrapped around it.
      answer = (
        <>
          <p className="text-md leading-snug text-ink-0">
            <Link className="font-semibold hover:text-accent" to={`/industries/${sectorId}`}>{label}</Link>{' '}
            — <span className="font-semibold">nothing from this sector appears in the money we
            could trace.</span>
          </p>
          <p className="mt-1 max-w-measure-wide text-sm leading-snug text-ink-2">
            <span className="tnum">{unresolvedPct}%</span> of {memberName}’s money names an employer
            this tool could not place, which is low enough to say that plainly.
            {/*
              The honest edge case. A member can have a LOW unresolved share and a
              very HIGH total unattributed share, because most of their money came
              from filings with no employer written at all. "Nothing from this
              sector" is then true of every donor who named an employer — but a
              retired donor is still a person who used to work somewhere, and no
              filing says where. Saying so costs one sentence and prevents the
              reader hearing a stronger negative than the data supports.
            */}
            {Number(unattributedPct) >= 60 && (
              <>
                {' '}A separate <span className="tnum">{unattributedPct}%</span> of their money comes
                from filings with no employer written on them, so it cannot be checked against this
                sector — by this tool or any other.
              </>
            )}
          </p>
        </>
      );
    } else {
      answer = (
        <>
          <p className="text-md leading-snug text-ink-0">
            <Link className="font-semibold hover:text-accent" to={`/industries/${sectorId}`}>{label}</Link>{' '}
            — <span className="font-semibold">we could not tell.</span> None of the money we placed
            came from this sector.
          </p>
          <p className="mt-1 max-w-measure-wide text-sm leading-snug text-ink-2">
            But <span className="tnum">{unresolvedPct}%</span> of {memberName}’s money names an
            employer this tool could not place — too much to call this sector absent. This is a limit
            of this tool, not something about {memberName}.
          </p>
        </>
      );
    }
  }

  return (
    <div className="card-data p-4">
      <h2 className="label mb-1">Check a specific industry</h2>
      {/* "The sectors above are only the largest ones" is the sentence the
          .data-limit immediately above this card already makes, in the marked
          tier, attached to the figure it qualifies. Saying it again here in
          unmarked prose was the second of two copies, not a second fact. What
          is left is instruction: what this control does. */}
      <p className="mb-2.5 max-w-measure-wide text-sm leading-snug text-ink-2">
        Pick any sector — not just the largest — and this will give you the straight answer for it,
        including when the answer is that nothing is there.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-sm text-ink-2">
          Sector
        </label>
        <select
          id={selectId}
          value={sectorId}
          onChange={(e) => setSectorId(e.target.value as IndustryId | '')}
          className="control h-9 max-w-full px-2 text-sm"
        >
          <option value="">Pick a sector…</option>
          {INDUSTRIES.map((i) => (
            <option key={i.id} value={i.id}>{i.label}</option>
          ))}
        </select>
      </div>

      <div role="status" aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {answer ?? (
          <p className="text-sm text-ink-3">No sector picked yet.</p>
        )}
      </div>

      {sectorId && (
        <DataLimit className="mt-2.5">
          This answer covers money reported to the FEC and itemized for the {profile.cycle} cycle,
          and nothing else. Money that was never reported cannot appear in it.
          {profile.unclassifiedShare > 0 && (
            <>
              {' '}Of the {unattributedPct}% with no industry attached, the {unresolvedPct}% above is
              the part that names an employer; the rest names none at all, and no tool can place
              that.
            </>
          )}
        </DataLimit>
      )}
    </div>
  );
}

export default function RepDetail() {
  const { bioguideId = '' } = useParams();
  const { data, error, loading } = useAsync(() => getMemberDetail(bioguideId), [bioguideId]);
  const { data: index } = useAsync(getIndex, []);
  const { isQuick, setView } = useViewMode();

  /**
   * Committee rows arrive one per subcommittee code, so the same full committee
   * appears several times. Collapse by name and keep any stated role.
   */
  const committees = useMemo(() => {
    const byName = new Map<string, { name: string; role?: string }>();
    for (const c of data?.member.committees ?? []) {
      const existing = byName.get(c.committeeName);
      if (!existing) byName.set(c.committeeName, { name: c.committeeName, role: c.role });
      else if (!existing.role && c.role) existing.role = c.role;
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) {
    return (
      <div className="mx-auto max-w-content px-4">
        <Loading what="this member: their money, and the bills they worked on" />
      </div>
    );
  }

  const { member, donorProfile, topDonors, overlaps, votes, districtAwards } = data;

  const isSenator = member.chamber === 'Senate';
  const districtStr = member.district === undefined ? '' : String(member.district);
  const atLarge = !isSenator && (districtStr === '' || districtStr === '0');
  // "Representative · AL-4 · Cullman, Jasper, Tuscumbia". The towns are the
  // only human-readable geography in the data, and a reader who arrived from a
  // list of district numbers needs them here to confirm they opened the right
  // person. See lib/seat.ts.
  const seatLine = seatLineFor(member);
  const offices = placesLine(member.districtPlaces);
  // Same string the share card and every other surface uses for this person.
  const memberSubtitle = isSenator
    ? `Sen. ${member.state}`
    : `Rep. ${member.state}${atLarge ? ' at-large' : `-${districtStr}`}`;

  const cycle = donorProfile?.cycle ?? null;
  const topOverlap = overlaps[0] ?? null;
  const topSectors = (donorProfile?.byIndustry ?? []).filter((r) => r.amount > 0).slice(0, 3);
  const shownOverlaps = isQuick ? overlaps.slice(0, 3) : overlaps;
  const cardContext: MemberCardContext = {
    bioguideId: member.bioguideId,
    memberName: member.name,
    memberSubtitle,
    cycle,
    totalDisclosed: donorProfile?.totalItemized ?? null,
  };
  /**
   * The band note(s) for the whole overlap list, said once instead of per row.
   * Wording still comes from @ftm/core; `bandNoteFor` only picks which string.
   */
  const bandLines = distinctBands(shownOverlaps.map((o) => o.score))
    .map((score) => bandNoteFor(score, isQuick));

  /**
   * Why some of these bills get no share image, counted and said once.
   *
   * `shareEligibility()` still decides per bill and still hides the button per
   * bill — nothing about the refusal changes. What changed is that its
   * explanation used to be printed on every refused row, and on a page where
   * every overlap is under 10% that is the same sentence five times.
   */
  // Not a useMemo: this sits below the loading/error early returns, so a hook
  // here would change the hook order between renders. It is a loop over at most
  // a few dozen rows.
  const shareRefusals = (() => {
    const counts = new Map<string, number>();
    for (const o of shownOverlaps) {
      const e = shareEligibility(findingFor(o, o.bill, cardContext));
      if (!e.eligible && e.reason) counts.set(e.reason, (counts.get(e.reason) ?? 0) + 1);
    }
    return [...counts.entries()];
  })();
  const shownDonors = isQuick ? topDonors.slice(0, 5) : topDonors;
  /**
   * The rows that are actually somebody. The synthetic "No employer listed on the
   * filing" row is a statement about missing data, not a donor, and on some
   * members it is over 90% of the file — it stays out of a list of names and
   * keeps its own explanation in the section below. Already sorted by amount.
   */
  const namedDonors = topDonors.filter((d) => !isNoEmployerAggregate(d.name));
  const shownAwards = isQuick ? districtAwards.slice(0, 5) : districtAwards;

  const awardTotal = districtAwards.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <nav className="text-xs text-ink-4">
        <Link className="link" to="/reps">Representatives</Link> <span aria-hidden>/</span>{' '}
        <span>{member.name}</span>
      </nav>

      {/* ---- header ------------------------------------------------------ */}
      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <MemberAvatar src={member.imageUrl} name={member.name} size={84} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="serif text-2xl leading-tight text-ink-0">{member.name}</h1>
            <PartyTag party={member.party} />
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {seatLine}
            {member.party && <> · {member.party}</>}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <SourceLink href={member.sourceUrl}>Their congress.gov page</SourceLink>
            {member.officialUrl && <SourceLink href={member.officialUrl}>Official website</SourceLink>}
            {(donorProfile?.sourceUrls ?? []).map((u, i) => (
              <SourceLink key={u} href={u}>
                FEC filings{(donorProfile?.sourceUrls.length ?? 0) > 1 ? ` (${i + 1})` : ''}
              </SourceLink>
            ))}
          </div>

          <ViewToggle className="mt-3" />
        </div>
      </header>

      {/* ---- at a glance ---------------------------------------------------
          The whole page in one block: how much, from whom, and the one bill
          where those two lists overlap most. Everything under it is detail. */}
      <section className="mt-6">
        <h2 className="sr-only">At a glance</h2>

        {/* The names first. See the <NamedDonors/> comment: the abstraction was
            leading and the recognisable names were behind a disclosure. */}
        {namedDonors.length > 0 && (
          <div className="mb-4">
            <NamedDonors rows={namedDonors} isQuick={isQuick} />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
          <div className="card-data p-4">
            <h3 className="label">Money reported to the FEC</h3>
            <div className="tnum mt-1 text-2xl font-semibold leading-tight text-ink-0">
              {plainAmount(donorProfile?.totalItemized ?? 0)}
            </div>
            <p className="mt-1.5 text-sm leading-snug text-ink-2">
              {donorProfile && donorProfile.totalItemized > 0 ? (
                <>
                  Given to {member.name}’s campaign in the {donorProfile.cycle}{' '}
                  <Term k="cycle">cycle</Term> — exact figure{' '}
                  <span className="tnum">{usd(donorProfile.totalItemized)}</span>.
                </>
              ) : (
                <>No campaign money is linked to this member in this data. That is a gap in the data, not a claim that none was raised.</>
              )}
            </p>
            {/* ---------------------------------------------------------------
                This sentence used to end "So the shares here are a floor: the
                real ones are higher." That is an assertion — on 537 named
                people's pages — that each of their true industry shares is
                larger than the one shown. It is not supported. Most of the
                unattributed money is filings that list the donor as RETIRED,
                SELF-EMPLOYED, NOT EMPLOYED or HOMEMAKER: there is no employer
                on the form, so that money can never be moved into ANY industry,
                and the shares would not rise if the tool were perfect. The rest
                of the codebase words this correctly as "a floor, not a
                measurement", and now so does this.                          */}
            {donorProfile && donorProfile.unclassifiedShare > 0 && (
              <DataLimit className="mt-2">
                <span className="tnum">{(donorProfile.unclassifiedShare * 100).toFixed(0)}%</span> of
                this money has no industry attached, so read every share below as a floor, not a
                measurement.
                {donorProfile.nonEmployerAmount > 0 && (
                  <>
                    {' '}
                    <span className="tnum">{usd(donorProfile.nonEmployerAmount)}</span> of it is from
                    filings with no employer written on them — retired, self-employed, homemaker.
                    That is normal and it is not hidden money; it can never be assigned to an
                    industry by anyone.
                  </>
                )}
              </DataLimit>
            )}
          </div>

          <div className="card-data p-4">
            {/* Was "Where most of it came from", above a figure the page itself
                describes as "about a tenth of it". "Most" was simply wrong. */}
            <h3 className="label mb-2">Largest industries we could identify</h3>
            {topSectors.length === 0 ? (
              <p className="text-sm text-ink-2">No money here could be put in an industry.</p>
            ) : (
              <SectorGlance rows={topSectors} />
            )}
            <DataLimit className="mt-2.5">
              These are the three largest of {donorProfile?.byIndustry.length ?? 0} sectors, not the
              whole list, and each is worked out from what donors wrote as their employer. A sector
              missing from these three is not a sector with nothing reported — use the check below.
            </DataLimit>
          </div>

          <div className="card-data p-4">
            <h3 className="label mb-2">Biggest overlap with a bill</h3>
            {topOverlap ? (
              <>
                <Link to={`/bills/${topOverlap.billId}`} className="tap-24 block text-sm leading-snug text-ink-1 hover:text-accent">
                  {topOverlap.bill
                    ? `${billLabel(topOverlap.bill.billType, topOverlap.bill.billNumber)} — ${topOverlap.bill.title}`
                    : topOverlap.billId}
                </Link>
                <div className="mt-2">
                  <OverlapScore score={topOverlap.score} size="sm" plain={isQuick} />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-2">
                No bill this member worked on shares an industry with their reported donors in this
                data.
              </p>
            )}
          </div>
        </div>

        {/* The one control that lets the page say "no". Directly under the
            at-a-glance block, because the question it answers is the question
            most readers arrive with. */}
        {donorProfile && donorProfile.totalItemized > 0 && (
          <div className="mt-4">
            <SectorCheck profile={donorProfile} memberName={member.name} />
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-9">
          {/* ---- disclosed money ------------------------------------------ */}
          <section>
            <SectionTitle note={cycle ? `FEC cycle ${cycle}` : undefined}>
              All the money reported for this member
            </SectionTitle>

            {!donorProfile || donorProfile.totalItemized <= 0 ? (
              <Empty>
                No <Term k="itemized">itemized</Term> campaign-finance record is linked to{' '}
                {member.name} in this data. That is a gap in the data, not a statement that no money
                was raised.
              </Empty>
            ) : (
              <Fold open={!isQuick} title="Every industry, and the two gaps in the total" note={`${donorProfile.byIndustry.length} industries`}>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Stat
                    label="Total reported"
                    value={usd(donorProfile.totalItemized, { compact: true })}
                    sub={
                      <>
                        {/* What this figure covers depends on whether the pipeline
                            ran with an OpenFEC key, so the wording comes from the
                            bundle rather than being hardcoded here. */}
                        {index?.moneyLabel ?? 'Disclosed FEC contributions'}, cycle {donorProfile.cycle}{' '}
                        {donorProfile.sourceUrls[0] && <SourceLink href={donorProfile.sourceUrls[0]}>FEC</SourceLink>}
                      </>
                    }
                  />
                  <Stat
                    label="Put in an industry"
                    value={usd(donorProfile.totalItemized - donorProfile.unclassifiedAmount, { compact: true })}
                    sub={`${((1 - donorProfile.unclassifiedShare) * 100).toFixed(1)}% of the total`}
                  />
                </div>

                {/* ---------------------------------------------------------
                    ITEM 3: the resolution goes NEXT TO the number, not in a
                    different card.

                    This block used to be a third <Stat/> reading
                    "NOT PLACED $828.7K — 82.8%, left out of every number
                    below", with the explanation of what that money actually is
                    two cards further down. A distrustful reader met a large
                    number, the words "left out", and no account of it, and drew
                    the only conclusion available: the missing money is being
                    hidden. Testing watched exactly that happen.

                    So the figure and its account are now one block, and the
                    account leads with the half that is nobody's fault: filings
                    with no employer written on them can never be assigned to an
                    industry by ANY tool, including a perfect one. The other
                    half is this tool's own gap and is named as such. Both
                    figures were already in donorProfile; nothing here is new
                    data and nothing was removed — the two amber notes that used
                    to carry these sentences are merged into this one place, so
                    the fact travels with the number instead of chasing it. */}
                <div className="mt-4 border-l-2 border-ink-5 pl-3">
                  <div className="label">Not placed in any industry</div>
                  <div className="tnum mt-0.5 text-lg font-semibold leading-tight text-ink-0">
                    {usd(donorProfile.unclassifiedAmount, { compact: true })}
                  </div>
                  <div className="mt-0.5 text-xs leading-snug text-ink-4">
                    {(donorProfile.unclassifiedShare * 100).toFixed(1)}% of the total — left out of
                    every industry number on this page
                  </div>
                  <DataLimit className="mt-2">
                    <strong className="font-semibold">
                      This is not money that went missing, and it is not money anyone is hiding.
                    </strong>{' '}
                    <span className="tnum">{usd(donorProfile.nonEmployerAmount)}</span> of it comes
                    from filings with no employer written on them at all — the donor is recorded as
                    RETIRED, SELF-EMPLOYED, NOT EMPLOYED or HOMEMAKER. That is how the filing was
                    written, it is entirely normal, and it means there is no employer name for{' '}
                    <em>any</em> tool to match to an industry. A perfect version of this site would
                    still not be able to place it.
                    {donorProfile.nonEmployerAmount === 0 && (
                      <> In this member’s data that figure is zero because only committee (PAC) money
                      is here; detail on individual donors needs a free OpenFEC API key.</>
                    )}{' '}
                    The other <span className="tnum">{usd(donorProfile.unresolvedAmount)}</span>{' '}
                    <em>does</em> name an employer or group, and neither the word list nor the
                    classifier could match it to an industry. That part is a real limitation of this
                    tool, and it is the reason every share on this page is a floor rather than a
                    measurement.
                  </DataLimit>
                </div>

                <div className="mt-5">
                  <h3 className="label mb-2">By industry</h3>
                  <IndustryBars rows={donorProfile.byIndustry} />
                  <DataLimit className="mt-2">
                    Shares are of the full reported total, so they add up to less than 100% by
                    exactly the {(donorProfile.unclassifiedShare * 100).toFixed(1)}% that could not
                    be placed. A sector that is absent from this list had nothing reported for it in
                    the {donorProfile.cycle} cycle.
                  </DataLimit>
                </div>

                {/* The two coverage gaps used to be two amber boxes here,
                    repeating verbatim the two sentences that now sit attached
                    to the "Not placed" figure above. Both figures and every
                    fact from both boxes are still on this page — moved, not
                    dropped — and they are now next to the number they qualify
                    rather than three scroll-lengths under it. */}
              </Fold>
            )}
          </section>

          {/* ---- top donors -----------------------------------------------
              Still here, unchanged, with every row, the Kind column and the
              per-row source. It is no longer the ONLY place a name appears —
              the seven biggest named rows are at the top of the page now — so
              this table is the full reference rather than the first sighting. */}
          <section>
            {/* ---------------------------------------------------------------
                "Biggest donors" over a column headed DONOR was wrong for most
                of these rows. A committee row IS a donor — a PAC is a real
                entity that really made a contribution. But an individual row is
                not: it is the EMPLOYER NAME that one or more individuals typed
                on their own filings, aggregated. Heading that column "donor"
                said that a company gave money to a federal candidate, which
                corporations are prohibited from doing. The table now names what
                is actually in it, and the Kind column distinguishes the two. */}
            <SectionTitle note={isQuick && topDonors.length > shownDonors.length ? `${shownDonors.length} of ${topDonors.length}` : `${topDonors.length} shown`}>
              Biggest employers named on filings
            </SectionTitle>
            {topDonors.length === 0 ? (
              <Empty>
                No named donors are recorded for this member in this data. Small gifts are reported
                as a lump sum, so they never appear by name.
              </Empty>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-2xs uppercase tracking-wide text-ink-3">
                      <th scope="col" className="pb-1 font-semibold">Employer on filing</th>
                      <th scope="col" className="pb-1 font-semibold">Industry</th>
                      <th scope="col" className="pb-1 font-semibold">Kind</th>
                      <th scope="col" className="pb-1 text-right font-semibold">Amount</th>
                      <th scope="col" className="pb-1 text-right font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shownDonors.map((d, i) => (
                      <tr key={`${d.name}-${d.industry}-${i}`}>
                        <td className="py-1.5 pr-3 align-top text-ink-1">{d.name}</td>
                        <td className="py-1.5 pr-3 align-top">
                          <Link className="link" to={`/industries/${d.industry}`}>
                            {INDUSTRY_BY_ID[d.industry]?.label ?? d.industry}
                          </Link>
                        </td>
                        <td className="py-1.5 pr-3 align-top text-ink-2">
                          {d.kind === 'committee' ? <Term k="pac">PAC / committee</Term> : DONOR_KIND_LABEL[d.kind] ?? d.kind}
                        </td>
                        <td className="tnum py-1.5 pr-3 text-right align-top text-ink-1">{usd(d.amount)}</td>
                        <td className="py-1.5 text-right align-top">
                          <SourceLink href={d.sourceUrl}>FEC</SourceLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isQuick && topDonors.length > shownDonors.length && (
              <button type="button" onClick={() => setView('full')} className="btn mt-3">
                Show all {topDonors.length} rows
              </button>
            )}
            {/* One note under this table, not two. Both were limits on how to
                read the same five columns — what a row IS, and how the Amount
                column was totalled — and printing them as two separate marked
                blocks is the caveat-density problem in miniature. Every
                sentence from both is still here. */}
            <DataLimit className="mt-2">
              A row marked <Term k="pac">PAC / committee</Term> is a real committee that made a real
              contribution under its own name. A row marked <strong className="font-medium">Individual</strong>{' '}
              is not one donor: it is the employer name that people typed on their own filings, added
              up. The company did not give the money — its employees did, individually. Companies are
              barred by law from contributing to federal candidates at all. Amounts are added up per
              name, per industry, over the cycle, so a committee that gives through more than one
              entity can appear more than once.
            </DataLimit>
          </section>

          {/* ---- overlap -------------------------------------------------- */}
          <section>
            <SectionTitle
              note={
                isQuick && overlaps.length > shownOverlaps.length
                  ? `${shownOverlaps.length} of ${overlaps.length}`
                  : `${overlaps.length} bill${overlaps.length === 1 ? '' : 's'}`
              }
            >
              Bills they worked on, next to their donors
            </SectionTitle>
            {/* The one framing block on this page. It used to print the exact
                sentence the sticky banner was already showing two inches below
                it, which is how a reader learns to stop reading both. */}
            <FramingNote className="mb-4" />

            {/* ---------------------------------------------------------------
                ONE band statement for the whole list, not one per row.

                Every row carried its own copy of the same sentence — "Few or
                none of this member's top disclosed donor industries have an
                obvious stake in this bill" — printed six times, identically,
                down one page. Testing counted it as six separate hedges, and
                that is how it read: a reader does not experience six copies as
                six times the care, they experience it as noise and stop reading
                the seventh thing, which might have been the one that mattered.

                Nothing is deleted. The sentence still comes from @ftm/core, it
                is still shown, and every bar below still carries its band label
                and the formal band in its accessible name. It is said once, for
                the set, and the set is almost always one band. When it is not,
                one line per band appears — still bounded by four, not by the
                number of bills. */}
            {shownOverlaps.length > 0 && (
              <div className="mb-4 max-w-measure-wide space-y-1 text-sm leading-relaxed text-ink-2">
                {bandLines.map((line) => <p key={line}>{line}</p>)}
                {shareRefusals.map(([reason, n]) => (
                  <p key={reason} className="text-ink-3">
                    {n === shownOverlaps.length
                      ? `None of these ${shownOverlaps.length} can be turned into a share image. `
                      : `${n} of these ${shownOverlaps.length} cannot be turned into a share image. `}
                    {reason.replace(/^No image for this one\.\s*/, '')}
                  </p>
                ))}
              </div>
            )}

            {overlaps.length === 0 ? (
              <Empty>
                No bill this member sponsored, cosponsored or has committee responsibility for
                shares an industry with their reported donors in this data.
              </Empty>
            ) : (
              <ul className="space-y-3">
                {shownOverlaps.map((o) => {
                  const bill = o.bill;
                  const label = bill ? billLabel(bill.billType, bill.billNumber) : o.billId;
                  const top = o.matches[0] ?? null;
                  const topLabel = top ? (INDUSTRY_BY_ID[top.industry]?.label ?? top.industry) : null;
                  const role = roleFor(bill, member.bioguideId);
                  return (
                    <li key={o.billId} className="card p-4">
                      {/* A real heading, so this list is navigable by heading
                          and so the h4s inside <WhatThisMeans/> below sit at a
                          legal level rather than jumping h2 → h4. */}
                      <h3 className="flex flex-wrap items-baseline gap-x-2 font-normal">
                        <Link to={`/bills/${o.billId}`} className="tap-24 mono shrink-0 text-xs text-ink-4 hover:text-accent">
                          {label}
                        </Link>
                        <Link to={`/bills/${o.billId}`} className="tap-24 text-base leading-snug text-ink-1 hover:text-accent">
                          {bill?.title ?? 'Title not in this data'}
                        </Link>
                      </h3>

                      {bill && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                          <span className="chip">{role}</span>
                          {bill.latestActionDate && <span>Last moved {shortDate(bill.latestActionDate)}</span>}
                          {!isQuick && bill.policyArea && <span>· {bill.policyArea}</span>}
                          {!isQuick && <MethodTag method={bill.classificationMethod} />}
                          <SourceLink href={bill.congressDotGovUrl}>congress.gov</SourceLink>
                        </div>
                      )}

                      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
                        <div className="min-w-0">
                          {isQuick ? (
                            topLabel && top ? (
                              <p className="text-sm leading-relaxed text-ink-2">
                                Of all the money {member.name} reported, {plainShare(o.score)} came
                                from industries this bill would affect. The biggest is{' '}
                                <Link className="link" to={`/industries/${top.industry}`}>{topLabel}</Link>{' '}
                                — {plainAmount(top.donorAmount)}.
                              </p>
                            ) : null
                          ) : (
                            <>
                              {topLabel && top && (
                                <p className="text-sm leading-relaxed text-ink-2">
                                  Largest shared sector:{' '}
                                  <Link className="link" to={`/industries/${top.industry}`}>{topLabel}</Link> —{' '}
                                  <span className="tnum">{usd(top.donorAmount, { compact: true })}</span> disclosed to
                                  this member ({(top.donorShare * 100).toFixed(1)}% of their money), against a
                                  classifier confidence of {Math.round(top.billConfidence * 100)}% that the bill
                                  affects it.
                                </p>
                              )}
                              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                                {describeOverlap(o, member.name, label)}
                              </p>
                            </>
                          )}
                          <WhatThisMeans
                            overlap={o}
                            facts={o.meaning}
                            memberName={member.name}
                            billLabel={label}
                            totalDisclosed={donorProfile?.totalItemized ?? 0}
                            hasVote={votes.length > 0}
                            classificationMethod={bill?.classificationMethod ?? null}
                            defaultOpen={!isQuick}
                          />
                          <div className="mt-3">
                            {/* The refusal reason is stated once above this
                                list, not on every row that gets refused. The
                                refusal itself is unchanged. */}
                            <ShareCardButton showReason={false} finding={findingFor(o, bill, cardContext)} />
                          </div>
                        </div>

                        <div className="sm:w-56">
                          {/* Band note suppressed: stated once above the
                              list. The label and the accessible name still
                              carry the band on every bar. */}
                          <OverlapScore
                            score={o.score}
                            size="md"
                            showExplainer={false}
                            showBandNote={false}
                            plain={isQuick}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {isQuick && overlaps.length > shownOverlaps.length && (
              <div className="mt-4">
                <button type="button" onClick={() => setView('full')} className="btn">
                  Show all {overlaps.length} bills
                </button>
              </div>
            )}
          </section>

          {/* ---- roll-call votes ------------------------------------------ */}
          <section>
            <SectionTitle note={votes.length > 0 ? `${votes.length} recorded` : undefined}>
              How they voted
            </SectionTitle>
            {votes.length === 0 ? (
              <CoverageNote>
                <strong className="font-semibold">This page cannot show any votes.</strong> Vote
                records were not collected when this copy of the data was built. So nothing above
                should be read as a claim about how {member.name} voted on anything. Their votes are
                on Congress.gov, linked from their name at the top of this page.
              </CoverageNote>
            ) : (
              <Fold open={!isQuick} title={`${votes.length} recorded vote${votes.length === 1 ? '' : 's'}`}>
                <p className="mb-2 max-w-measure-wide text-sm leading-relaxed text-ink-2">
                  A <Term k="rollCall">roll-call vote</Term> is one where each member is recorded by
                  name. Where a vote has an overlap score beside it, that score does not use the vote
                  and the vote is not explained by the score — said here once, rather than under
                  every row.
                </p>
                <ul className="divide-y divide-line">
                  {votes.map((v) => {
                    const o = v.billId ? overlaps.find((x) => x.billId === v.billId) : undefined;
                    const top = o?.matches[0];
                    return (
                      <li key={v.id} className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm text-ink-1">{v.question}</span>
                          <span className="chip">{v.position}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                          <span>{shortDate(v.date)}</span>
                          <span>· {v.result}</span>
                          {v.billId && <Link className="link" to={`/bills/${v.billId}`}>Bill</Link>}
                          <SourceLink href={v.sourceUrl}>Roll-call record</SourceLink>
                        </div>
                        {o && top && (
                          <div className="mt-2 sm:max-w-sm">
                            {/* Band note and the "the number does not use the
                                vote" sentence are both stated once above this
                                list rather than on every vote. */}
                            <OverlapScore score={o.score} size="sm" showExplainer={false} showBandNote={false} plain={isQuick} />
                            <p className="mt-1 text-xs text-ink-3">
                              Biggest shared industry on this bill:{' '}
                              {INDUSTRY_BY_ID[top.industry]?.label ?? top.industry}.
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Fold>
            )}
          </section>

          {/* ---- district awards ------------------------------------------ */}
          <section>
            <SectionTitle note="Background only">
              Federal money spent in {atLarge || isSenator ? member.state : `${member.state}-${districtStr}`}
            </SectionTitle>

            <CoverageNote>
              <strong className="font-semibold">This is background, not evidence.</strong> Federal
              contracts and grants are handed out by government agencies through their own process.
              Nothing on this list shows that any donation caused any award, or that this member had
              any part in it. It is here so you can see what federal money moves through the same
              area, and nothing more.
            </CoverageNote>

            {districtAwards.length === 0 ? (
              <div className="mt-3">
                <Empty>
                  No federal awards for this {isSenator ? 'state' : 'district'} are in this data. The
                  award list is capped at the largest few thousand in the country, so most districts
                  are missing.
                </Empty>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm text-ink-2">
                  {districtAwards.length} award{districtAwards.length === 1 ? '' : 's'}, worth{' '}
                  <span className="tnum">{plainAmount(awardTotal)}</span> in all. Biggest first.
                </p>
                <ul className="mt-2 divide-y divide-line">
                  {shownAwards.map((a) => (
                    <li key={a.id} className="py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm text-ink-1">{a.recipientName}</span>
                        <span className="tnum shrink-0 text-sm text-ink-1">{usd(a.amount, { compact: true })}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                        <span>{a.awardType}</span>
                        {a.awardingAgency && <span>· {a.awardingAgency}</span>}
                        <span>· {shortDate(a.actionDate)}</span>
                        <Link className="link" to={`/industries/${a.industry}`}>
                          {INDUSTRY_BY_ID[a.industry]?.label ?? a.industry}
                        </Link>
                        <SourceLink href={a.sourceUrl}>USASpending</SourceLink>
                      </div>
                    </li>
                  ))}
                </ul>
                {isQuick && districtAwards.length > shownAwards.length && (
                  <button type="button" onClick={() => setView('full')} className="btn mt-3">
                    Show all {districtAwards.length} awards
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {/* ---- sidebar ----------------------------------------------------- */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="label mb-2">The basics</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Chamber</dt>
                <dd className="text-ink-1">{member.chamber}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Seat</dt>
                <dd className="text-ink-1">{atLarge && !isSenator ? `${member.state} at-large` : isSenator ? member.state : `${member.state}-${districtStr}`}</dd>
              </div>
              {offices && (
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-ink-3">District offices</dt>
                  <dd className="text-right text-ink-1">{offices}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Party</dt>
                <dd className="flex items-center gap-1.5 text-ink-1">{member.party ?? '—'} <PartyTag party={member.party} /></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Committees</dt>
                <dd className="tnum text-ink-1">{committees.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Bills with an overlap</dt>
                <dd className="tnum text-ink-1">{overlaps.length}</dd>
              </div>
            </dl>
          </div>

          {committees.length > 0 && (
            <div className="card p-4">
              <Fold open={!isQuick} title="Committees they sit on" note={`${committees.length}`}>
                <p className="mb-2 text-xs text-ink-2">
                  A <Term k="committee">committee of jurisdiction</Term> handles bills on one
                  subject. Members usually ask for the ones that matter where they live.
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {committees.map((c) => (
                    <li key={c.name} className="chip">
                      {c.name}
                      {c.role && <span className="text-ink-4">{c.role}</span>}
                    </li>
                  ))}
                </ul>
              </Fold>
            </div>
          )}

          <div className="card p-4">
            <Fold open={!isQuick} title="Where these facts come from">
              <ul className="space-y-1.5 text-xs text-ink-2">
                <li><SourceLink href={member.sourceUrl}>congress.gov record</SourceLink></li>
                {member.officialUrl && <li><SourceLink href={member.officialUrl}>Official house/senate site</SourceLink></li>}
                {(donorProfile?.sourceUrls ?? []).map((u) => (
                  <li key={u}><SourceLink href={u}>FEC candidate record</SourceLink></li>
                ))}
                <li>Member record fetched {shortDate(member.fetchedAt)}</li>
                {donorProfile && <li>Donor profile built {shortDate(donorProfile.fetchedAt)}</li>}
                {member.fecCandidateIds.length > 0 && (
                  <li className="mono">FEC candidate {member.fecCandidateIds.join(', ')}</li>
                )}
                <li className="mono">bioguide {member.bioguideId}</li>
              </ul>
            </Fold>
          </div>

          <div className="card p-4">
            <h3 className="label mb-2">What this page cannot tell you</h3>
            <p className="text-sm leading-relaxed text-ink-2">
              It sees only reported <Term k="hardMoney">hard money</Term> that was big enough to be{' '}
              <Term k="itemized">itemized</Term> in a filing. It cannot see dark money, most{' '}
              <Term k="superpac">super PAC</Term> spending, lobbying, or a job someone takes after
              leaving office.{' '}
              <Link className="link" to="/limitations">The full list of gaps →</Link>
            </p>
          </div>

          <div className="card p-4">
            <h3 className="label mb-2">Found a mistake?</h3>
            <p className="text-sm leading-relaxed text-ink-2">
              Every figure on this page links to the government record it came from, so the first
              step is to open that record and compare. If this page and the filing disagree, that is
              a bug here and it should be reported.
            </p>
            <p className="mt-2">
              <ReportProblemLink />
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
