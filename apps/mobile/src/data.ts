/**
 * The data layer.
 *
 * The web build fetches ./data/*.json over HTTP. This app cannot: it must work
 * with no server and no connectivity, so the exact same JSON files are BUNDLED
 * into the binary with `require()` and read synchronously from memory. There is
 * no fetch here, and there must never be one — see the header of index.ts.
 *
 * The shapes below deliberately mirror apps/web/src/lib/data.ts so that the two
 * clients read the same contract. Anything the exporter changes must change in
 * both places.
 *
 * ---------------------------------------------------------------------------
 * ONE DIFFERENCE FROM THE WEB BUILD, ON PURPOSE.
 *
 * packages/ingest/src/export.ts writes per-entity detail files (`bill/*.json`,
 * `member/*.json`) only into apps/web/public/data — they are not part of the
 * mobile bundle. So the detail screens here are COMPUTED from the top-level
 * files (bills.json + legislators.json + overlaps.json + awards.json) rather
 * than read from a prepared file.
 *
 * That reconstruction is faithful but not complete, and the gaps are surfaced
 * in the UI as coverage notes rather than hidden:
 *   · a bill's LLM/keyword `plainSummary` and per-sector `rationale` live only
 *     in bill/<id>.json, so bill detail shows the sector tags and confidences
 *     without the prose rationale;
 *   · a member's FULL donor breakdown lives only in member/<id>.json. What is
 *     reconstructed here is the top-3 sectors from `donorSummary` unioned with
 *     every sector that appears in that member's overlap matches (each match
 *     carries the member's real `donorAmount` and `donorShare` for that
 *     sector), which recovers most of the breakdown for members who appear in
 *     overlaps.json;
 *   · overlaps.json is capped by the exporter at the top 2000 rows, so a
 *     low-scoring member/bill pair may be absent.
 * ---------------------------------------------------------------------------
 */

import type {
  Award,
  DonorProfile,
  Industry,
  IndustryId,
  OverlapResult,
} from '@ftm/core';

// ---------------------------------------------------------------------------
// Shapes — kept in step with apps/web/src/lib/data.ts
// ---------------------------------------------------------------------------

export interface BundleIndex {
  generatedAt: string;
  isSample: boolean;
  cycle: number;
  congress: number;
  counts: Record<string, number>;
  sources: {
    openfec: string;
    congress: string;
    classification: string;
    lastRun: { fec: string | null; congress: string | null; classify: string | null };
  };
  overlapFormula: string;
  disclaimers: { short: string; medium: string; long: string };
  coverageNotes: string[];
}

export interface MemberSummary {
  bioguideId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  chamber: 'House' | 'Senate';
  state: string;
  district?: string;
  party?: string;
  imageUrl?: string;
  officialUrl?: string;
  fecCandidateIds: string[];
  sourceUrl: string;
  fetchedAt: string;
  committees: { committeeCode: string; committeeName: string; role?: string }[];
  donorSummary: {
    totalItemized: number;
    top: { industry: IndustryId; amount: number; share: number }[];
    unclassifiedShare: number;
  } | null;
}

export interface BillSummary {
  id: string;
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  introducedDate?: string;
  latestActionDate?: string;
  latestActionText?: string;
  policyArea?: string;
  subjects: string[];
  sponsorBioguideId?: string;
  cosponsorCount: number;
  committeeNames: string[];
  congressDotGovUrl: string;
  industries: { industry: IndustryId; confidence: number }[];
  classificationMethod: 'llm' | 'keyword-fallback' | null;
  topOverlap: { bioguideId: string; score: number } | null;
  overlapCount: number;
}

export interface SearchEntry {
  t: 'member' | 'bill' | 'industry' | 'recipient';
  id: string;
  label: string;
  sub: string;
  terms: string;
}

// ---------------------------------------------------------------------------
// Bundled files. `require` — not fetch — is the whole point.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-var-requires */
export const INDEX: BundleIndex = require('../assets/data/index.json') as BundleIndex;
export const INDUSTRIES_BUNDLED: Industry[] = require('../assets/data/industries.json') as Industry[];
export const LEGISLATORS: MemberSummary[] = require('../assets/data/legislators.json') as MemberSummary[];
export const BILLS: BillSummary[] = require('../assets/data/bills.json') as BillSummary[];
export const OVERLAPS: OverlapResult[] = require('../assets/data/overlaps.json') as OverlapResult[];
export const SEARCH: SearchEntry[] = require('../assets/data/search.json') as SearchEntry[];
export const AWARDS: Award[] = require('../assets/data/awards.json') as Award[];

// ---------------------------------------------------------------------------
// Indexes, built once on first use.
// ---------------------------------------------------------------------------

function memo<T>(build: () => T): () => T {
  let value: T | undefined;
  let built = false;
  return () => {
    if (!built) {
      value = build();
      built = true;
    }
    return value as T;
  };
}

export const memberById = memo(
  () => new Map(LEGISLATORS.map((l) => [l.bioguideId, l])),
);

export const billById = memo(() => new Map(BILLS.map((b) => [b.id, b])));

export const overlapsByBill = memo(() => {
  const m = new Map<string, OverlapResult[]>();
  for (const o of OVERLAPS) {
    const list = m.get(o.billId);
    if (list) list.push(o);
    else m.set(o.billId, [o]);
  }
  for (const list of m.values()) list.sort((a, b) => b.score - a.score);
  return m;
});

export const overlapsByMember = memo(() => {
  const m = new Map<string, OverlapResult[]>();
  for (const o of OVERLAPS) {
    const list = m.get(o.bioguideId);
    if (list) list.push(o);
    else m.set(o.bioguideId, [o]);
  }
  for (const list of m.values()) list.sort((a, b) => b.score - a.score);
  return m;
});

export const awardsByState = memo(() => {
  const m = new Map<string, Award[]>();
  for (const a of AWARDS) {
    if (!a.recipientState) continue;
    const list = m.get(a.recipientState);
    if (list) list.push(a);
    else m.set(a.recipientState, [a]);
  }
  return m;
});

/** Every state present in the bundle, for the chamber/state filter. */
export const STATES = memo(() =>
  [...new Set(LEGISLATORS.map((l) => l.state))].filter(Boolean).sort(),
);

// ---------------------------------------------------------------------------
// Derived detail views
// ---------------------------------------------------------------------------

export interface BillDetailView {
  bill: BillSummary;
  sponsor: MemberSummary | null;
  overlaps: (OverlapResult & { member: MemberSummary | null; role: string })[];
}

export function getBillDetail(id: string): BillDetailView | null {
  const bill = billById().get(id);
  if (!bill) return null;
  const overlaps = (overlapsByBill().get(id) ?? []).map((o) => ({
    ...o,
    member: memberById().get(o.bioguideId) ?? null,
    role: bill.sponsorBioguideId === o.bioguideId ? 'Sponsor' : 'Involved',
  }));
  return {
    bill,
    sponsor: bill.sponsorBioguideId ? (memberById().get(bill.sponsorBioguideId) ?? null) : null,
    overlaps,
  };
}

export interface DonorSectorRow {
  industry: IndustryId;
  amount: number;
  share: number;
  /** How this row was recovered, shown to the reader so the gap is visible. */
  from: 'summary' | 'overlap';
}

export interface MemberDetailView {
  member: MemberSummary;
  /**
   * Partial. `byIndustry` is the reconstruction described at the top of this
   * file; `unclassifiedShare` and `totalItemized` come straight from the
   * exporter's own summary and are exact.
   */
  donorProfile: Pick<DonorProfile, 'totalItemized' | 'unclassifiedShare' | 'cycle'> & {
    byIndustry: DonorSectorRow[];
    /** True when sectors beyond the exporter's top-3 were recovered. */
    reconstructed: boolean;
  } | null;
  overlaps: (OverlapResult & { bill: BillSummary | null })[];
  stateAwards: Award[];
}

export function getMemberDetail(bioguideId: string): MemberDetailView | null {
  const member = memberById().get(bioguideId);
  if (!member) return null;

  const overlaps = (overlapsByMember().get(bioguideId) ?? []).map((o) => ({
    ...o,
    bill: billById().get(o.billId) ?? null,
  }));

  let donorProfile: MemberDetailView['donorProfile'] = null;
  const summary = member.donorSummary;
  if (summary) {
    const rows = new Map<IndustryId, DonorSectorRow>();
    for (const t of summary.top) {
      rows.set(t.industry, { industry: t.industry, amount: t.amount, share: t.share, from: 'summary' });
    }
    let reconstructed = false;
    for (const o of overlaps) {
      for (const m of o.matches) {
        if (rows.has(m.industry)) continue;
        rows.set(m.industry, {
          industry: m.industry,
          amount: m.donorAmount,
          share: m.donorShare,
          from: 'overlap',
        });
        reconstructed = true;
      }
    }
    donorProfile = {
      totalItemized: summary.totalItemized,
      unclassifiedShare: summary.unclassifiedShare,
      cycle: INDEX.cycle,
      byIndustry: [...rows.values()].sort((a, b) => b.amount - a.amount),
      reconstructed,
    };
  }

  const stateAwards = (awardsByState().get(member.state) ?? []).slice(0, 20);

  return { member, donorProfile, overlaps, stateAwards };
}

// ---------------------------------------------------------------------------
// Search — entirely local, over the bundled index. Nothing leaves the device.
// ---------------------------------------------------------------------------

export function searchAll(query: string, limit = 30): SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const out: SearchEntry[] = [];
  for (const e of SEARCH) {
    if (e.label.toLowerCase().includes(needle) || e.terms.includes(needle)) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** The route an entry in the global search index points at. */
export function searchHref(e: SearchEntry): string | null {
  switch (e.t) {
    case 'member':
      return `/reps/${e.id}`;
    case 'bill':
      return `/bills/${e.id}`;
    case 'industry':
      return `/bills?industry=${e.id}`;
    default:
      return null;
  }
}

/**
 * The bundle stores every single-seat House district as "0" — genuine at-large
 * states and the non-voting delegate seats alike. Rendering "VT-0" would be
 * wrong, so seats are labelled rather than concatenated. Same rule as the web
 * build's Reps.tsx.
 */
export function seatLine(m: Pick<MemberSummary, 'chamber' | 'state' | 'district'>): string {
  if (m.chamber === 'Senate') return `Senator · ${m.state}`;
  const d = m.district === undefined ? '' : String(m.district);
  if (d === '' || d === '0') return `Representative · ${m.state} at-large`;
  return `Representative · ${m.state}-${d}`;
}

export function fecUrl(m: MemberSummary, cycle: number): string | null {
  const id = m.fecCandidateIds[0];
  if (!id) return null;
  return `https://www.fec.gov/data/candidate/${id}/?cycle=${cycle}`;
}

export type { Award, Industry, IndustryId, OverlapResult };
