/**
 * The normalized local schema. Every ingestion source writes into these shapes,
 * so the frontend never has to know which agency a field came from.
 *
 * Design notes:
 * - Every record carries `source` and `sourceUrl` so any number on screen can be
 *   traced back to a primary government record in one click. This is a hard
 *   requirement of the project, not a nice-to-have.
 * - Every record carries `fetchedAt` so staleness is visible to the user.
 * - IDs are the government's own IDs wherever one exists (FEC candidate ID,
 *   bioguide ID, bill slug). We never mint opaque IDs that can't be checked.
 */

export type SourceName = 'openfec' | 'congress' | 'usaspending' | 'derived' | 'sample';

export interface Provenance {
  source: SourceName;
  /** Deep link to the primary record a human can open and verify. */
  sourceUrl: string;
  /** ISO timestamp of when this row was fetched. */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Industry taxonomy
// ---------------------------------------------------------------------------

export type IndustryId =
  | 'agriculture'
  | 'defense'
  | 'energy-fossil'
  | 'energy-renewable'
  | 'finance-banking'
  | 'insurance'
  | 'real-estate'
  | 'health-providers'
  | 'pharma'
  | 'tech'
  | 'telecom'
  | 'transport'
  | 'construction'
  | 'manufacturing'
  | 'retail-consumer'
  | 'legal'
  | 'education'
  | 'labor-unions'
  | 'media-entertainment'
  | 'hospitality'
  | 'mining'
  | 'waste-water'
  | 'utilities-electric'
  | 'crypto'
  | 'firearms'
  | 'tobacco-alcohol-cannabis'
  | 'ideological-single-issue'
  | 'party-leadership'
  | 'super-pac-unattributed'
  | 'government'
  | 'other';

export interface Industry {
  id: IndustryId;
  label: string;
  /** Short neutral description shown in tooltips. */
  blurb: string;
}

// ---------------------------------------------------------------------------
// People and committees
// ---------------------------------------------------------------------------

export interface Legislator extends Provenance {
  /** Library of Congress bioguide ID — the stable cross-source key. */
  bioguideId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  /** 'House' | 'Senate' */
  chamber: 'House' | 'Senate';
  state: string;
  /** House district number as a string; undefined for senators. */
  district?: string;
  /** Stored as a neutral factual field. The UI never colours by it. */
  party?: string;
  imageUrl?: string;
  officialUrl?: string;
  /** FEC candidate IDs linked to this person, if resolved. */
  fecCandidateIds: string[];
  terms?: { start: string; end?: string; chamber: string }[];
}

export interface CommitteeMembership {
  bioguideId: string;
  committeeCode: string;
  committeeName: string;
  role?: string;
}

// ---------------------------------------------------------------------------
// Campaign finance (OpenFEC)
// ---------------------------------------------------------------------------

export interface FecCandidate extends Provenance {
  candidateId: string;
  name: string;
  party?: string;
  state?: string;
  district?: string;
  office: string;
  incumbentChallenge?: string;
  cycles: number[];
  principalCommitteeIds: string[];
  /** Best-effort link to a bioguide ID; null when we could not confidently match. */
  bioguideId: string | null;
}

export interface FecCommittee extends Provenance {
  committeeId: string;
  name: string;
  committeeType?: string;
  designation?: string;
  organizationType?: string;
  /** Industry inferred from the committee's name/organization type. */
  inferredIndustry?: IndustryId;
  connectedOrganizationName?: string;
}

/**
 * A normalized contribution row. Depending on which FEC endpoint it came from
 * this is either an itemized individual receipt (Schedule A) or a
 * committee-to-candidate contribution.
 */
export interface Contribution extends Provenance {
  /** Deterministic hash of the natural key — makes re-ingest idempotent. */
  id: string;
  recipientCandidateId: string | null;
  recipientCommitteeId: string | null;
  contributorName: string;
  contributorEmployer?: string;
  contributorOccupation?: string;
  contributorState?: string;
  /** 'individual' | 'committee' */
  contributorKind: 'individual' | 'committee';
  amount: number;
  date: string | null;
  cycle: number;
  /** Industry assigned to this contribution, and how we assigned it. */
  industry: IndustryId;
  industryMethod: 'keyword' | 'llm' | 'committee-type' | 'placeholder' | 'unassigned';
  industryConfidence: number;
}

/** Aggregated donor profile for one legislator in one cycle. */
export interface DonorProfile {
  bioguideId: string;
  cycle: number;
  totalItemized: number;
  /** Sorted descending by amount. */
  byIndustry: { industry: IndustryId; amount: number; share: number; contributionCount: number }[];
  /**
   * Money with no industry attached, split into two honest buckets:
   *  - nonEmployer: the filing lists RETIRED / SELF / NOT EMPLOYED / HOMEMAKER,
   *    so there is no employer to classify. Not a failure of this tool.
   *  - unresolved:  there IS an employer string, but neither the keyword map
   *    nor the LLM could place it. A genuine coverage gap.
   * Both are shown in the UI. `unclassifiedAmount` is their sum.
   */
  unclassifiedAmount: number;
  unclassifiedShare: number;
  nonEmployerAmount: number;
  unresolvedAmount: number;
  sourceUrls: string[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Legislation (Congress.gov)
// ---------------------------------------------------------------------------

export interface Bill extends Provenance {
  /** e.g. "119-hr-1234" — congress, type, number. */
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
  cosponsorBioguideIds: string[];
  committeeCodes: string[];
  committeeNames: string[];
  /** Official CRS summary text, when one has been published. */
  officialSummary?: string;
  congressDotGovUrl: string;
}

export interface BillClassification {
  billId: string;
  /** Plain-English paraphrase. Never a verbatim copy of the source. */
  plainSummary: string;
  industries: {
    industry: IndustryId;
    confidence: number;
    rationale: string;
  }[];
  method: 'llm' | 'keyword-fallback';
  model: string | null;
  /** Hash of the input text — lets the cache detect when a bill actually changed. */
  inputHash: string;
  classifiedAt: string;
}

export interface VoteRecord extends Provenance {
  id: string;
  billId?: string;
  chamber: 'House' | 'Senate';
  congress: number;
  session: number;
  rollNumber: number;
  date: string;
  question: string;
  result: string;
  positions: { bioguideId: string; position: 'Yea' | 'Nay' | 'Present' | 'Not Voting' }[];
}

// ---------------------------------------------------------------------------
// Federal spending (USASpending)
// ---------------------------------------------------------------------------

export interface Award extends Provenance {
  id: string;
  recipientName: string;
  recipientParentName?: string;
  awardType: string;
  amount: number;
  actionDate: string;
  awardingAgency?: string;
  awardingSubAgency?: string;
  recipientState?: string;
  recipientCongressionalDistrict?: string;
  naicsCode?: string;
  naicsDescription?: string;
  industry: IndustryId;
  industryMethod: 'naics' | 'keyword' | 'unassigned';
  description?: string;
}

// ---------------------------------------------------------------------------
// Derived: the thing the app actually shows
// ---------------------------------------------------------------------------

export interface OverlapResult {
  billId: string;
  bioguideId: string;
  cycle: number;
  /** 0..1 — see overlap.ts for the exact formula and its assumptions. */
  score: number;
  /** Industries present in BOTH lists, sorted by contribution to the score. */
  matches: {
    industry: IndustryId;
    donorAmount: number;
    donorShare: number;
    billConfidence: number;
    contribution: number;
  }[];
  /** Everything needed to reproduce the number by hand. */
  method: {
    formula: string;
    donorProfileCycle: number;
    billClassificationMethod: 'llm' | 'keyword-fallback';
    unclassifiedDonorShare: number;
  };
}

/** The static bundle the frontend loads. Generated by `npm run export`. */
export interface DataBundle {
  generatedAt: string;
  /** True when this bundle is the checked-in sample rather than a real fetch. */
  isSample: boolean;
  counts: Record<string, number>;
  industries: Industry[];
  legislators: Legislator[];
  bills: Bill[];
  classifications: Record<string, BillClassification>;
  donorProfiles: Record<string, DonorProfile>;
  overlaps: OverlapResult[];
  votes: VoteRecord[];
  awards: Award[];
  committeeMemberships: CommitteeMembership[];
  /** Human-readable notes about coverage gaps in THIS bundle. */
  coverageNotes: string[];
}
