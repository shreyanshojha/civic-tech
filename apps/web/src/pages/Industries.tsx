/**
 * The sector index.
 *
 * ---------------------------------------------------------------------------
 * HOW THE "DISCLOSED MONEY" COLUMN IS DERIVED — AND WHAT IT APPROXIMATES
 *
 * There is no per-sector money total in the bundle. The only cross-member
 * campaign-finance figure that ships in a single file is
 * `legislators.json → donorSummary`, and the exporter deliberately truncates
 * that to each member's TOP THREE sectors (see packages/ingest/src/export.ts,
 * `donorSummary.top = p.byIndustry.slice(0, 3)`), so that list views never have
 * to pull 537 per-member detail files.
 *
 * So the figure shown here is:
 *
 *     sectorTotal(s) = Σ over members m of  amount(m, s)
 *                      where s is among m's three largest donor sectors
 *
 * That is a genuine, checkable number, but it is a FLOOR, not a total. Money a
 * sector gave to a member for whom it was that member's 4th-largest sector or
 * below is invisible to this page. In the bundle as generated, the top-three
 * slices cover roughly 54% of the $391M of itemized money attributed to sitting
 * members — so a bit under half of the attributable money is not counted in any
 * row below. The page says so on screen; the honest framing is "at least this
 * much", never "this much".
 *
 * Two consequences worth understanding before reading the ranking:
 *  - Sectors that give BROADLY but never dominate any one member (a few
 *    thousand dollars to hundreds of members) are systematically undercounted
 *    relative to sectors that give CONCENTRATED money to a few members.
 *  - The ranking is therefore closer to "which sectors dominate somebody's
 *    funding" than to "which sectors spend the most". Those are different
 *    questions and the second one cannot be answered from this file.
 *
 * The exact per-member, all-sectors breakdown IS available — it is on each
 * member's own page, which loads that member's detail file. Anything derived
 * here that matters should be checked there.
 *
 * Bill counts and federal-award totals have no such caveat: bills.json carries
 * every tag for every bill, and awards.json carries every award in the bundle
 * (itself capped — see /spending).
 * ---------------------------------------------------------------------------
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { INDUSTRIES, usd } from '@ftm/core';
import type { Industry, IndustryId } from '@ftm/core';
import { getAwards, getBills, getIndustries, getLegislators } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { CoverageNote, ShortDisclaimer } from '../components/Framing';
import { Empty, ErrorState, Loading, SectionTitle, Stat } from '../components/ui';

type SortKey = 'money' | 'bills' | 'awards' | 'members' | 'label';

/** Buckets in the taxonomy that are not industries. Explained in full below. */
const NON_INDUSTRY: IndustryId[] = ['party-leadership', 'super-pac-unattributed', 'government'];

interface Row {
  meta: Industry;
  /** Floor on disclosed money — see the file header. */
  disclosed: number;
  /** Members for whom this sector is a top-three donor sector. */
  members: number;
  /** Bills carrying this sector tag. */
  bills: number;
  /** Federal award dollars classified into this sector, as context only. */
  awards: number;
  awardCount: number;
}

export default function Industries() {
  const industries = useAsync(getIndustries, []);
  const legislators = useAsync(getLegislators, []);
  const bills = useAsync(getBills, []);
  const awards = useAsync(getAwards, []);

  const [sort, setSort] = useState<SortKey>('money');

  const taxonomy = industries.data ?? INDUSTRIES;

  const rows = useMemo<Row[]>(() => {
    const disclosed = new Map<IndustryId, number>();
    const members = new Map<IndustryId, number>();
    for (const l of legislators.data ?? []) {
      if (!l.donorSummary) continue;
      for (const t of l.donorSummary.top) {
        disclosed.set(t.industry, (disclosed.get(t.industry) ?? 0) + t.amount);
        members.set(t.industry, (members.get(t.industry) ?? 0) + 1);
      }
    }

    const billCount = new Map<IndustryId, number>();
    for (const b of bills.data ?? []) {
      for (const i of b.industries) billCount.set(i.industry, (billCount.get(i.industry) ?? 0) + 1);
    }

    const awardTotal = new Map<IndustryId, number>();
    const awardCount = new Map<IndustryId, number>();
    for (const a of awards.data ?? []) {
      awardTotal.set(a.industry, (awardTotal.get(a.industry) ?? 0) + a.amount);
      awardCount.set(a.industry, (awardCount.get(a.industry) ?? 0) + 1);
    }

    return taxonomy.map((meta) => ({
      meta,
      disclosed: disclosed.get(meta.id) ?? 0,
      members: members.get(meta.id) ?? 0,
      bills: billCount.get(meta.id) ?? 0,
      awards: awardTotal.get(meta.id) ?? 0,
      awardCount: awardCount.get(meta.id) ?? 0,
    }));
  }, [taxonomy, legislators.data, bills.data, awards.data]);

  const sorted = useMemo(() => {
    const out = rows.slice();
    out.sort((a, b) => {
      switch (sort) {
        case 'bills': return b.bills - a.bills || a.meta.label.localeCompare(b.meta.label);
        case 'awards': return b.awards - a.awards || a.meta.label.localeCompare(b.meta.label);
        case 'members': return b.members - a.members || a.meta.label.localeCompare(b.meta.label);
        case 'label': return a.meta.label.localeCompare(b.meta.label);
        default: return b.disclosed - a.disclosed || a.meta.label.localeCompare(b.meta.label);
      }
    });
    return out;
  }, [rows, sort]);

  const sectorRows = sorted.filter((r) => r.meta.id !== 'other' && !NON_INDUSTRY.includes(r.meta.id));
  const bucketRows = sorted.filter((r) => NON_INDUSTRY.includes(r.meta.id));
  const otherRow = rows.find((r) => r.meta.id === 'other');

  const totals = useMemo(() => {
    const attributed = (legislators.data ?? []).reduce((s, l) => s + (l.donorSummary?.totalItemized ?? 0), 0);
    const counted = rows.reduce((s, r) => s + r.disclosed, 0);
    return { attributed, counted, share: attributed > 0 ? counted / attributed : 0 };
  }, [legislators.data, rows]);

  const error = industries.error ?? legislators.error ?? bills.error ?? awards.error;
  if (error) return <ErrorState error={error} />;

  const loading = industries.loading || legislators.loading || bills.loading || awards.loading;
  const maxDisclosed = Math.max(...sectorRows.map((r) => r.disclosed), 1);

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <h1 className="text-xl font-semibold text-ink-0">Sectors</h1>
      <p className="mt-1 max-w-measure text-base leading-relaxed text-ink-3">
        A deliberately coarse taxonomy of {taxonomy.length} buckets, built in this repository from raw
        disclosure text rather than licensed from anyone. Every bucket links to the bills tagged with
        it, the members whose disclosed funding it makes up the largest share of, and the federal
        money flowing the other way.
      </p>
      <ShortDisclaimer className="mt-2" />

      {/* ---- headline figures ------------------------------------------- */}
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat label="Sectors" value={sectorRows.length} sub="Excluding the non-industry buckets below" />
        <Stat
          label="Money counted here"
          value={usd(totals.counted, { compact: true })}
          sub={`A floor. ${(totals.share * 100).toFixed(0)}% of the ${usd(totals.attributed, { compact: true })} disclosed to sitting members.`}
        />
        <Stat label="Bills tagged" value={(bills.data ?? []).filter((b) => b.industries.length > 0).length.toLocaleString()} sub={`of ${(bills.data ?? []).length.toLocaleString()} bills in the bundle`} />
        <Stat label="Federal awards" value={(awards.data ?? []).length.toLocaleString()} sub="Context only — see Federal spending" />
      </div>

      <div className="mt-5">
      <CoverageNote>
        <strong className="font-semibold">Read the money column as “at least this much”.</strong> The
        bundle ships only each member's three largest donor sectors in the shared file this page
        reads, so a sector's fourth-place-and-below money is not counted here. That leaves roughly{' '}
        {((1 - totals.share) * 100).toFixed(0)}% of the money attributed to sitting members outside
        every row below. Sectors that give a little to very many members are undercounted relative to
        sectors that dominate a few members' funding. The complete, untruncated breakdown for any
        individual is on that member's own page.
      </CoverageNote>
      </div>

      {/* ---- the non-industry buckets ------------------------------------ */}
      <section className="mt-8">
        <SectionTitle>Three of these buckets are not industries</SectionTitle>
        <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-3">
          Political money and public money both show up in campaign-finance filings, and both would
          quietly distort every sector figure on this site if they were folded into an industry. They
          are kept separate on purpose, so that “this sector funded that member” never silently means
          “a party committee did” or “a public agency did”. They are listed here, and they are ranked
          alongside the sectors below, but they answer a different question.
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {bucketRows.map((r) => (
            <li key={r.meta.id} className="card p-4">
              <Link to={`/industries/${r.meta.id}`} className="tap-24 text-base font-medium text-ink-0 hover:text-accent">
                {r.meta.label}
              </Link>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{r.meta.blurb}</p>
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-4">
                <div>
                  <dt className="inline">Disclosed </dt>
                  <dd className="tnum inline text-ink-2">{usd(r.disclosed, { compact: true })}</dd>
                </div>
                <div>
                  <dt className="inline">Bills </dt>
                  <dd className="tnum inline text-ink-2">{r.bills}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2">
          <CoverageNote>
            <strong className="font-semibold">Super PAC — funding source not visible</strong> is the
            most important of the three to understand. That money is real, disclosed and correctly
            reported; what is missing is the layer underneath it. An independent-expenditure
            committee's own donors appear on its own separate FEC filing, which this pipeline does
            not traverse, so the sector behind the sector cannot be seen from here. Labelling it
            “unclassified” would imply a failure of attribution; labelling it as an industry would be
            an invention. It gets its own bucket instead.
          </CoverageNote>
          {otherRow && (
            <p className="text-xs leading-relaxed text-ink-4">
              A fourth bucket, <Link className="link" to="/industries/other">Other / Unclassified</Link>,
              holds money whose disclosed employer text could not be placed at all. It is excluded from
              every overlap score rather than being guessed at, and each member's page reports their own
              unattributed share.
            </p>
          )}
        </div>
      </section>

      {/* ---- the sectors -------------------------------------------------- */}
      <section className="mt-8">
        <SectionTitle
          note={
            <label className="flex items-center gap-1.5 text-xs text-ink-4">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort sectors by"
                className="h-8 control px-2 text-sm"
              >
                <option value="money">Disclosed money (floor)</option>
                <option value="bills">Bills tagged</option>
                <option value="members">Members funded</option>
                <option value="awards">Federal awards received</option>
                <option value="label">Name A–Z</option>
              </select>
            </label>
          }
        >
          All sectors
        </SectionTitle>

        {loading ? (
          <Loading what="sectors" />
        ) : sectorRows.length === 0 ? (
          <Empty>No sectors in this bundle. Run the pipeline once to generate the data.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {sectorRows.map((r) => (
              <li key={r.meta.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Link to={`/industries/${r.meta.id}`} className="tap-24 text-base font-medium text-ink-0 hover:text-accent">
                    {r.meta.label}
                  </Link>
                  <span className="tnum shrink-0 text-sm text-ink-2">
                    {r.disclosed > 0 ? `≥ ${usd(r.disclosed, { compact: true })}` : '—'}
                  </span>
                </div>
                <p className="mt-0.5 max-w-measure-wide text-sm leading-relaxed text-ink-3">{r.meta.blurb}</p>

                {/* One hue, magnitude by length. Never a colour scale. */}
                <div className="mt-1.5 h-1 w-full rounded-full bg-ink-7">
                  <div
                    className="h-full rounded-full bg-ink-3"
                    style={{ width: `${Math.max(r.disclosed > 0 ? 1.5 : 0, (r.disclosed / maxDisclosed) * 100)}%` }}
                  />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-4">
                  <span className="tnum">
                    {r.bills} bill{r.bills === 1 ? '' : 's'} tagged
                  </span>
                  <span className="tnum">
                    top-three donor sector for {r.members} member{r.members === 1 ? '' : 's'}
                  </span>
                  {r.awardCount > 0 && (
                    <span className="tnum">
                      {usd(r.awards, { compact: true })} in federal awards ({r.awardCount})
                    </span>
                  )}
                  <Link className="link" to={`/industries/${r.meta.id}`}>
                    Open sector →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 max-w-measure-wide text-xs leading-relaxed text-ink-4">
        {taxonomy.length} buckets is a choice, not a limit of the data. Employer strings in FEC filings
        are self-reported free text — “SELF”, “N/A”, “RETIRED”, an employer name spelled four different ways — and
        a finer taxonomy would project precision that does not exist in the source.{' '}
        <Link className="link" to="/methodology">How sectors get assigned</Link> ·{' '}
        <Link className="link" to="/limitations">What this cannot tell you</Link>
      </p>

      <p className="mt-3 text-xs text-ink-4">
        Sector labels and descriptions come from{' '}
        <span className="mono">packages/core/src/industries.ts</span>, the same file the ingestion
        pipeline classifies against — so what you read here is exactly what the classifier used.
      </p>
    </div>
  );
}
