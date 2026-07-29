/**
 * One sector.
 *
 * ---------------------------------------------------------------------------
 * THE MEMBER LIST ON THIS PAGE IS THE MOST MISREADABLE THING ON THE SITE.
 *
 * It answers exactly one question: "of the money this sector is disclosed as
 * having given to sitting members, who received the most?" It is a receipts
 * list. It is NOT a ranking of who is influenced, captured, bought, or owned by
 * this sector, and the page says so in the largest type it can justify, above
 * the list rather than below it.
 *
 * Three structural reasons the ordering is not a corruption ranking:
 *   1. Members from districts where a sector is physically located receive
 *      money from it and legislate on it for the same ordinary reason: it is
 *      there. That is representation, not capture.
 *   2. The ordering reflects only DISCLOSED, ITEMIZED hard money. A sector that
 *      spends through channels the FEC never sees is absent from this list
 *      entirely, which makes the list's silence uninformative.
 *   3. See the derivation caveat below — the underlying figures are a floor.
 *
 * DERIVATION, and its approximation: as on the sector index, per-member sector
 * amounts come from `legislators.json → donorSummary.top`, which the exporter
 * truncates to each member's THREE largest donor sectors. So this page can only
 * list members for whom this sector was a top-three funder. A member who took
 * real money from this sector, but for whom it ranked fourth or lower, does not
 * appear at all — not with a small number, but not at all. The complete
 * breakdown for any individual is on that member's own page, which loads their
 * full donor profile.
 * ---------------------------------------------------------------------------
 */

import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { INDUSTRY_BY_ID, isIndustryId, shortDate, usd } from '@ftm/core';
import type { IndustryId } from '@ftm/core';
import { getAwards, getBills, getLegislators, getOverlaps } from '../lib/data';
import type { BillSummary, MemberSummary } from '../lib/data';
import { useAsync } from '../lib/hooks';
import { CoverageNote, InlineDisclaimer, OverlapScore, ShortDisclaimer, SourceLink } from '../components/Framing';
import { Fold, ViewToggle } from '../components/ViewToggle';
import { parseView, useViewMode } from '../lib/view';
import { Empty, ErrorState, Loading, MemberAvatar, MethodTag, SectionTitle, Stat } from '../components/ui';

const NON_INDUSTRY: IndustryId[] = ['party-leadership', 'super-pac-unattributed', 'government'];

function UnknownSector({ id }: { id: string }) {
  return (
    <div className="mx-auto max-w-content px-4 py-10 pb-14">
      <nav className="text-xs text-ink-4">
        <Link className="link" to="/industries">Sectors</Link> <span aria-hidden>/</span>{' '}
        <span className="mono">{id || '(none)'}</span>
      </nav>
      <h1 className="mt-2 text-xl font-semibold text-ink-0">No such sector</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-3">
        <span className="mono">{id || '(empty)'}</span> is not one of the sector identifiers in this
        project's taxonomy. The taxonomy is fixed and checked into the repository, so this is a bad
        link rather than a missing download — nothing needs to be regenerated.
      </p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {Object.values(INDUSTRY_BY_ID).map((i) => (
          <Link key={i.id} to={`/industries/${i.id}`} className="chip" title={i.blurb}>
            {i.label}
          </Link>
        ))}
      </div>
      <p className="mt-5 text-sm text-ink-4">
        <Link className="link" to="/industries">Back to all sectors</Link>
      </p>
    </div>
  );
}

export default function IndustryDetail() {
  const { id = '' } = useParams();
  const valid = isIndustryId(id);

  const legislators = useAsync(getLegislators, []);
  const bills = useAsync(getBills, []);
  const awards = useAsync(getAwards, []);
  const overlaps = useAsync(getOverlaps, []);

  const { isQuick } = useViewMode();
  // Quick view opens with a handful of rows. The "show more" buttons below are
  // unchanged, and the full list is one tap away either way.
  const [searchParams] = useSearchParams();
  const startQuick = parseView(searchParams.get('view')) === 'quick';
  const [billLimit, setBillLimit] = useState(startQuick ? 5 : 20);
  const [memberLimit, setMemberLimit] = useState(startQuick ? 5 : 15);
  const [awardLimit, setAwardLimit] = useState(startQuick ? 5 : 10);

  const sectorId = valid ? (id as IndustryId) : null;

  const taggedBills = useMemo(() => {
    if (!sectorId) return [] as { bill: BillSummary; confidence: number }[];
    const out: { bill: BillSummary; confidence: number }[] = [];
    for (const b of bills.data ?? []) {
      const tag = b.industries.find((i) => i.industry === sectorId);
      if (tag) out.push({ bill: b, confidence: tag.confidence });
    }
    out.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        String(b.bill.latestActionDate ?? '').localeCompare(String(a.bill.latestActionDate ?? '')),
    );
    return out;
  }, [bills.data, sectorId]);

  const recipients = useMemo(() => {
    if (!sectorId) return [] as { member: MemberSummary; amount: number; share: number }[];
    const out: { member: MemberSummary; amount: number; share: number }[] = [];
    for (const m of legislators.data ?? []) {
      if (!m.donorSummary) continue;
      const row = m.donorSummary.top.find((t) => t.industry === sectorId);
      if (!row || row.amount <= 0) continue;
      out.push({ member: m, amount: row.amount, share: row.share });
    }
    out.sort((a, b) => b.amount - a.amount);
    return out;
  }, [legislators.data, sectorId]);

  const sectorAwards = useMemo(() => {
    if (!sectorId) return [];
    return (awards.data ?? []).filter((a) => a.industry === sectorId).sort((a, b) => b.amount - a.amount);
  }, [awards.data, sectorId]);

  const sectorOverlaps = useMemo(() => {
    if (!sectorId) return [];
    const legByBio = new Map((legislators.data ?? []).map((l) => [l.bioguideId, l]));
    const billById = new Map((bills.data ?? []).map((b) => [b.id, b]));
    return (overlaps.data ?? [])
      .filter((o) => o.matches.some((m) => m.industry === sectorId))
      .filter((o) => legByBio.has(o.bioguideId) && billById.has(o.billId))
      .slice(0, 4)
      .map((o) => ({ o, member: legByBio.get(o.bioguideId)!, bill: billById.get(o.billId)! }));
  }, [overlaps.data, legislators.data, bills.data, sectorId]);

  if (!valid) return <UnknownSector id={id} />;

  const error = legislators.error ?? bills.error ?? awards.error;
  if (error) return <ErrorState error={error} />;

  const meta = INDUSTRY_BY_ID[sectorId!];
  const isBucket = NON_INDUSTRY.includes(sectorId!);
  const disclosedFloor = recipients.reduce((s, r) => s + r.amount, 0);
  const awardTotal = sectorAwards.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="mx-auto max-w-content px-4 py-6 pb-14">
      <nav className="text-xs text-ink-4">
        <Link className="link" to="/industries">Sectors</Link> <span aria-hidden>/</span>{' '}
        <span className="mono">{sectorId}</span>
      </nav>

      <header className="mt-2">
        <h1 className="serif text-2xl leading-snug text-ink-0">{meta?.label ?? sectorId}</h1>
        <p className="mt-2 max-w-measure text-base leading-relaxed text-ink-2">{meta?.blurb}</p>
        <ShortDisclaimer className="mt-2" plain={isQuick} />
        <ViewToggle className="mt-3" />
      </header>

      {isBucket && (
        <div className="mt-4">
          <CoverageNote>
            <strong className="font-semibold">This is not an industry.</strong> It is a bucket kept
            deliberately separate from the sector taxonomy so that political money and public money
            never inflate an industry's figures. Nothing below should be read as “an industry funded
            these members”.{' '}
            <Link className="link" to="/industries">Why these buckets exist →</Link>
          </CoverageNote>
        </div>
      )}

      {/* ---- headline figures ------------------------------------------- */}
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
        <Stat
          label="Disclosed to members"
          value={disclosedFloor > 0 ? `≥ ${usd(disclosedFloor, { compact: true })}` : '—'}
          sub="At least this much. It counts only members this was a top-three funder for."
        />
        <Stat label="Members" value={recipients.length} sub="People this is one of the three biggest funders for." />
        <Stat label="Bills tagged" value={taggedBills.length} sub="Tagged by this tool, not by Congress." />
        <Stat
          label="Federal awards"
          value={awardTotal > 0 ? usd(awardTotal, { compact: true }) : '—'}
          sub={`${sectorAwards.length} award${sectorAwards.length === 1 ? '' : 's'} here. Background, not evidence.`}
        />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-9">
          {/* ---- bills ------------------------------------------------- */}
          <section>
            <SectionTitle note={`${taggedBills.length} bill${taggedBills.length === 1 ? '' : 's'}`}>
              Bills this sector is tagged on
            </SectionTitle>
            <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-2">
              Most confident tag first. That percentage is this tool marking its own work, not a
              measured chance — a confident tag can still be wrong. Open a bill to see why it was
              tagged.
            </p>

            {bills.loading ? (
              <Loading what="the bills tagged with this sector" />
            ) : taggedBills.length === 0 ? (
              <Empty>
                No bill in this bundle carries this sector tag. That is a real answer for narrow
                sectors, and also what you would see if the bill ingest ran but classification did not.
              </Empty>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {taggedBills.slice(0, billLimit).map(({ bill: b, confidence }) => (
                    <li key={b.id} className="py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <Link to={`/bills/${b.id}`} className="tap-24 mono shrink-0 text-xs text-ink-4 hover:text-accent">
                          {b.billType.toUpperCase()} {b.billNumber}
                        </Link>
                        <Link to={`/bills/${b.id}`} className="tap-24 text-base leading-snug text-ink-1 hover:text-accent">
                          {b.title}
                        </Link>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-4">
                        <span className="tnum">{Math.round(confidence * 100)}% sure of this tag</span>
                        {b.latestActionDate && <span>Last action {shortDate(b.latestActionDate)}</span>}
                        {b.policyArea && <span>· {b.policyArea}</span>}
                        {b.overlapCount > 0 && (
                          <span>
                            {b.overlapCount} member{b.overlapCount === 1 ? '' : 's'} whose donors are in these industries
                          </span>
                        )}
                        <MethodTag method={b.classificationMethod} />
                      </div>
                    </li>
                  ))}
                </ul>
                {taggedBills.length > billLimit && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setBillLimit((l) => l + 30)}
                      className="btn"
                    >
                      Show {Math.min(30, taggedBills.length - billLimit)} more
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ---- members ------------------------------------------------ */}
          <section>
            <SectionTitle note={`${recipients.length} member${recipients.length === 1 ? '' : 's'}`}>
              Members who got the most money from this sector
            </SectionTitle>

            <div className="mb-3 space-y-2">
              <InlineDisclaimer plain={isQuick} />
              <CoverageNote>
                <strong className="font-semibold">This is a list of receipts. It is not a ranking
                of who is influenced.</strong>{' '}
                Being high on it means one thing: a bigger reported dollar figure.
              </CoverageNote>
              <Fold open={!isQuick} title="Why this list is easy to misread">
              <CoverageNote>
                <strong className="font-semibold">This list is a receipts list, not a ranking of
                anything else.</strong>{' '}
                Position on it means one thing: a larger disclosed dollar figure. It is not an
                ordering of who is influenced by this sector, beholden to it, or captured by it, and
                it carries no implication of wrongdoing about anyone on it. Members whose districts
                contain a sector receive money from it and legislate on it for the same unremarkable
                reason — the sector is there. Read a name here as a starting point for a question,
                and check the member's own page, where the full untruncated breakdown lives.
              </CoverageNote>
              </Fold>
            </div>

            {legislators.loading ? (
              <Loading what="the members this sector funded" />
            ) : recipients.length === 0 ? (
              <Empty>
                No sitting member here has this sector among their three biggest funders. That does
                not mean the sector gave nothing — see the note above.
              </Empty>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {recipients.slice(0, memberLimit).map(({ member: m, amount, share }) => (
                    <li key={m.bioguideId} className="flex items-start gap-3 py-3">
                      <MemberAvatar src={m.imageUrl} name={m.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/reps/${m.bioguideId}`} className="block text-base font-medium text-ink-0 hover:text-accent">
                          {m.name}
                        </Link>
                        <div className="text-xs text-ink-4">
                          {m.chamber === 'Senate' ? 'Sen.' : 'Rep.'} · {m.state}
                          {m.district ? `-${m.district}` : ''}
                          {' · '}
                          {usd(m.donorSummary?.totalItemized ?? 0, { compact: true })} reported in total
                        </div>
                        {/* One hue. Length is the only encoding. */}
                        <div className="mt-1.5 h-1 w-full rounded-full bg-ink-7">
                          <div
                            className="h-full rounded-full bg-ink-3"
                            style={{ width: `${Math.max(1.5, Math.min(100, share * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tnum text-sm font-semibold text-ink-0">{usd(amount, { compact: true })}</div>
                        <div className="tnum text-xs text-ink-4">{(share * 100).toFixed(1)}% of their money</div>
                      </div>
                    </li>
                  ))}
                </ul>
                {recipients.length > memberLimit && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setMemberLimit((l) => l + 25)}
                      className="btn"
                    >
                      Show {Math.min(25, recipients.length - memberLimit)} more
                    </button>
                  </div>
                )}
              </>
            )}

            <p className="mt-3 max-w-measure-wide text-xs leading-relaxed text-ink-4">
              <strong className="font-semibold text-ink-3">What is missing from this list.</strong>{' '}
              The shared file this page reads carries only each member's three largest donor sectors,
              so members for whom this sector ranked fourth or lower are absent entirely rather than
              listed with a small figure. The totals above are therefore a floor, and the ordering
              favours sectors that concentrate their giving over sectors that spread it thin.
            </p>
          </section>

          {/* ---- overlaps ----------------------------------------------- */}
          {sectorOverlaps.length > 0 && (
            <section>
              <SectionTitle note={<Link className="link" to="/methodology">How this is computed →</Link>}>
                Where this sector shows up in an overlap
              </SectionTitle>
              <p className="mb-3 max-w-measure-wide text-sm leading-relaxed text-ink-3">
                Member–bill pairs in which this sector is one of the sectors present on both sides.
                A high number is common and often entirely ordinary. Read them as questions.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {sectorOverlaps.map(({ o, member, bill: b }) => (
                  <li key={`${o.billId}:${o.bioguideId}`} className="card p-4">
                    <Link to={`/reps/${member.bioguideId}`} className="block text-base font-medium text-ink-0 hover:text-accent">
                      {member.name}
                    </Link>
                    <div className="text-xs text-ink-4">
                      {member.chamber === 'Senate' ? 'Sen.' : 'Rep.'} · {member.state}
                      {member.district ? `-${member.district}` : ''}
                    </div>
                    <Link to={`/bills/${b.id}`} className="tap-24 mt-1.5 block text-sm text-ink-2 hover:text-accent">
                      <span className="mono text-ink-4">{b.billType.toUpperCase()} {b.billNumber}</span>{' '}
                      {b.title.length > 90 ? `${b.title.slice(0, 90)}…` : b.title}
                    </Link>
                    <div className="mt-3">
                      <OverlapScore score={o.score} size="sm" showExplainer={false} plain={isQuick} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---- awards -------------------------------------------------- */}
          <section>
            <SectionTitle note={<Link className="link" to="/spending">All federal spending →</Link>}>
              Federal money going the other way
            </SectionTitle>
            <CoverageNote>
              <strong className="font-semibold">Context, never evidence.</strong> These are federal
              contracts and grants awarded to recipients this tool classified into this sector. A
              federal award is the end of a procurement or grant process that runs for years, is
              constrained by statute, is administered by career civil servants, and is usually
              competed. Nothing on this page suggests, or could support, any link between a
              contribution and an award. It is here because knowing where federal money in a sector
              actually goes is useful when reading a bill about that sector.
            </CoverageNote>

            {awards.loading ? (
              <Loading what="federal awards" />
            ) : sectorAwards.length === 0 ? (
              <Empty>No award in this bundle was classified into this sector.</Empty>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-line">
                  {sectorAwards.slice(0, awardLimit).map((a) => (
                    <li key={a.id} className="py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 text-sm text-ink-1">{a.recipientName}</span>
                        <span className="tnum shrink-0 text-sm font-semibold text-ink-0">
                          {usd(a.amount, { compact: true })}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-4">
                        <span>{a.awardingAgency ?? 'Unknown agency'}</span>
                        <span>{shortDate(a.actionDate)}</span>
                        {a.recipientState && (
                          <span>
                            {a.recipientState}
                            {a.recipientCongressionalDistrict ? `-${a.recipientCongressionalDistrict}` : ''}
                          </span>
                        )}
                        <MethodTag method={a.industryMethod} />
                        <SourceLink href={a.sourceUrl}>usaspending.gov record</SourceLink>
                      </div>
                    </li>
                  ))}
                </ul>
                {sectorAwards.length > awardLimit && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setAwardLimit((l) => l + 20)}
                      className="btn"
                    >
                      Show {Math.min(20, sectorAwards.length - awardLimit)} more
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* ---- sidebar ----------------------------------------------- */}
        <aside className="space-y-6">
          <div className="card p-4">
            <div className="label mb-2">How this sector gets assigned</div>
            <p className="text-xs leading-relaxed text-ink-3">
              Contributions land in this bucket through one of four routes, tried in order: a curated
              organisation table checked into the repository, keyword stems matched against the
              self-reported employer or committee name, the FEC's own committee-type and
              organisation-type codes, and — only if the reader has configured their own key — a
              language model. Every stored row records which route was used.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">
              Bills land here from the Library of Congress policy area and subject terms, or from a
              language model when one is configured.
            </p>
            <p className="mt-2 text-xs">
              <Link className="link" to="/methodology">Full method</Link> ·{' '}
              <Link className="link" to="/limitations">Known limitations</Link>
            </p>
          </div>

          <div className="card p-4">
            <div className="label mb-2">Sector identifier</div>
            <p className="mono text-xs text-ink-3">{sectorId}</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-4">
              Defined in <span className="mono">packages/core/src/industries.ts</span>. The taxonomy is
              intentionally coarse: self-reported employer text will not carry finer distinctions
              reliably.
            </p>
          </div>

          <div className="card p-4">
            <div className="label mb-2">Other sectors</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.values(INDUSTRY_BY_ID)
                .filter((i) => i.id !== sectorId)
                .slice(0, 14)
                .map((i) => (
                  <Link key={i.id} to={`/industries/${i.id}`} className="chip" title={i.blurb}>
                    {i.label}
                  </Link>
                ))}
            </div>
            <p className="mt-2 text-xs">
              <Link className="link" to="/industries">All sectors →</Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
