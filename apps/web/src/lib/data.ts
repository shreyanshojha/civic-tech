/**
 * The data layer.
 *
 * Everything is a static JSON file fetched from ./data/. There is no API, no
 * backend, no database connection, and no request that leaves the machine
 * serving this site — not one, since the address lookup that used to be the
 * single exception was replaced by a shipped ZIP-and-town crosswalk (see
 * district.ts: the Census geocoder sends no CORS header, so a browser could
 * never read its answer anyway).
 *
 * Fetches are memoised so a given file is pulled once per page load.
 */

import type {
  Award, BillClassification, DonorProfile, Industry, IndustryId, OverlapResult, Pattern,
  PatternVerdict, PlainBill, PlainConfidence, VoteRecord,
} from '@ftm/core';

export interface BundleIndex {
  generatedAt: string;
  isSample: boolean;
  cycle: number;
  congress: number;
  counts: Record<string, number>;
  sources: {
    openfec: string; congress: string; classification: string;
    lastRun: { fec: string | null; congress: string | null; classify: string | null };
  };
  overlapFormula: string;
  /** Describes exactly what the contribution figures cover in THIS bundle. */
  moneyLabel?: string;
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
  /**
   * Towns this member keeps a district office in, e.g. ["Cullman","Jasper"].
   *
   * 535 of the 537 members in the bundle have at least one. It is the only
   * human-readable geography in the data and it is what lets a reader who does
   * not know their district number find their own member offline. Optional
   * because an older bundle, generated before the field existed, will not have
   * it — every consumer must tolerate its absence rather than render "undefined".
   */
  districtPlaces?: string[];
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
  /**
   * The one sentence from the plain-language layer a list row can use: who this
   * bill reaches. Optional because an older bundle will not have it.
   */
  plain?: { whoItTouches: string; confidence: PlainConfidence } | null;
}

export interface MeaningFacts {
  percentile: number;
  median: number;
  n: number;
  ordinary: { kind: string; text: string }[];
  unattributedShare: number;
}

export interface BillDetail {
  bill: {
    id: string; congress: number; billType: string; billNumber: string; title: string;
    introducedDate?: string; latestActionDate?: string; latestActionText?: string;
    policyArea?: string; subjects: string[]; sponsorBioguideId?: string;
    cosponsorBioguideIds: string[]; committeeCodes: string[]; committeeNames: string[];
    officialSummary?: string; congressDotGovUrl: string; sourceUrl: string; fetchedAt: string;
  };
  classification: BillClassification | null;
  /**
   * What this bill does, who it reaches, and what would change — computed in the
   * export step by `explainBillPlainly` in @ftm/core, never in the browser.
   * Optional because an older bundle will not have it.
   */
  plain?: PlainBill | null;
  overlaps: (OverlapResult & {
    member: { name: string; chamber: string; state: string; district?: string; imageUrl?: string; role: string } | null;
    donorProfile: DonorProfile | null;
    meaning?: MeaningFacts | null;
  })[];
  votes: { id: string; date: string; question: string; result: string; sourceUrl: string; positions: number }[];
  disclaimer: string;
}

export interface MemberDetail {
  member: MemberSummary;
  donorProfile: DonorProfile | null;
  topDonors: { name: string; industry: IndustryId; amount: number; kind: string; sourceUrl: string }[];
  overlaps: (OverlapResult & { bill: BillSummary | null; meaning?: MeaningFacts | null })[];
  votes: { id: string; billId?: string; date: string; question: string; result: string; position: string; sourceUrl: string }[];
  districtAwards: Award[];
  disclaimer: string;
}

/**
 * ---------------------------------------------------------------------------
 * TWO LOADERS WERE REMOVED FROM THIS FILE: `getOverlaps()` (overlaps.json) and
 * `getFeatured()` / `getFeaturedSet()` (featured.json), with the
 * `FeaturedOverlap` and `FeaturedSet` types that went with them.
 *
 * Both files are still written by the export step and both still ship in the
 * data folder. Nothing in the app fetches them, because nothing in the app
 * renders the member×bill overlap score any more — three independent
 * evaluations found it was the headline metric and was worthless, and the site's
 * own reading guide called it a bookmark rather than a finding. A loader with no
 * caller is how a deleted feature comes back by accident, so the loaders went and
 * the data stayed.
 *
 * The `overlaps` field is still declared on BillDetail and MemberDetail above,
 * because it is genuinely in those files and a type that lies about a file is
 * worse than an unused field. No component reads it.
 * ---------------------------------------------------------------------------
 */

/**
 * One committee-versus-everyone-else comparison, as the ingest step wrote it.
 *
 * `cohortShares` and `baselineShares` are the per-member shares the distribution
 * plot draws — one number per member, rounded, with no names attached. They are
 * empty on a pattern whose rows were slimmed to keep the file shippable (see
 * `PatternsFile.meta.dropped`), so the plot must handle an empty array rather
 * than assume it is there.
 */
export interface PatternRow extends Pattern {
  cohortShares: number[];
  baselineShares: number[];
}

/**
 * The whole pattern file, meta first.
 *
 * `meta.pairsTested` is the denominator of the search and the reason the list
 * page can be read at all: without it a shortlist of eighteen looks like
 * eighteen discoveries instead of the tail of over a thousand comparisons.
 */
export interface PatternsFile {
  generatedAt: string;
  meta: {
    cycle: number;
    committeesTested: number;
    committeeChamberGroupsTested: number;
    sectorsTested: number;
    pairsTested: number;
    pairsSkippedTooSmall: number;
    verdictCounts: Record<PatternVerdict, number>;
    patternsListed: number;
    fdrThreshold: number;
    permutationIterations: number;
    smallestPossiblePValue: number;
    minMemberTotal: number;
    minCohortSize: number;
    membersTested: number;
    membersWithMoney: number;
    membersTotal: number;
    dropped: string[];
    elapsedMs: number;
  };
  patterns: PatternRow[];
}

export interface SearchEntry {
  t: 'member' | 'bill' | 'industry' | 'recipient';
  id: string;
  label: string;
  sub: string;
  terms: string;
}

const BASE = `${import.meta.env.BASE_URL ?? './'}data/`.replace(/\/{2,}/g, '/');

const cache = new Map<string, Promise<unknown>>();

export class DataMissingError extends Error {
  constructor(public readonly file: string) {
    super(
      `Could not load ${file}. The data bundle has not been generated yet.\n\n` +
        `Run this once, from the repository root:\n\n    npm run pipeline\n\n` +
        `It needs no API keys for a first run.`,
    );
    this.name = 'DataMissingError';
  }
}

export function loadJson<T>(file: string): Promise<T> {
  const existing = cache.get(file);
  if (existing) return existing as Promise<T>;
  const p = fetch(`${BASE}${file}`)
    .then((r) => {
      if (!r.ok) throw new DataMissingError(file);
      return r.json() as Promise<T>;
    })
    .catch((err) => {
      cache.delete(file);
      if (err instanceof DataMissingError) throw err;
      throw new DataMissingError(file);
    });
  cache.set(file, p);
  return p;
}

export const getIndex = () => loadJson<BundleIndex>('index.json');
export const getIndustries = () => loadJson<Industry[]>('industries.json');
export const getLegislators = () => loadJson<MemberSummary[]>('legislators.json');
export const getBills = () => loadJson<BillSummary[]>('bills.json');
export const getAwards = () => loadJson<Award[]>('awards.json');
export const getSearchIndex = () => loadJson<SearchEntry[]>('search.json');
export const getPatterns = () => loadJson<PatternsFile>('patterns.json');

export const getBillDetail = (id: string) => loadJson<BillDetail>(`bill/${id}.json`);
export const getMemberDetail = (id: string) => loadJson<MemberDetail>(`member/${id}.json`);

export type { Award, DonorProfile, Industry, IndustryId, OverlapResult, Pattern, PatternVerdict, PlainBill, PlainConfidence, VoteRecord };
