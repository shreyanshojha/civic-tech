import type { IndustryId } from './types.js';

/**
 * Congressional Research Service policy areas and legislative subject terms,
 * mapped to this project's sectors.
 *
 * WHY: every bill on Congress.gov carries exactly one CRS "policy area" and a
 * set of curated legislative subject terms. These are assigned by librarians,
 * not by a machine, which makes them a far better free signal than keyword
 * matching on the bill title. Using them means the no-LLM path produces
 * genuinely reasonable industry tags instead of noise.
 *
 * These mappings are deliberately conservative in confidence. A policy area of
 * "Health" tells you a bill touches the health sector; it does not tell you
 * whether it affects hospitals, insurers, or drug manufacturers. So the policy
 * area contributes a moderate-confidence signal and the subject terms sharpen
 * it.
 */

export const POLICY_AREA_INDUSTRIES: Record<string, { industry: IndustryId; confidence: number }[]> = {
  'Agriculture and Food': [{ industry: 'agriculture', confidence: 0.85 }],
  'Animals': [{ industry: 'agriculture', confidence: 0.45 }],
  'Armed Forces and National Security': [{ industry: 'defense', confidence: 0.8 }],
  'Arts, Culture, Religion': [{ industry: 'media-entertainment', confidence: 0.5 }],
  'Civil Rights and Liberties, Minority Issues': [],
  'Commerce': [
    { industry: 'retail-consumer', confidence: 0.5 },
    { industry: 'manufacturing', confidence: 0.4 },
  ],
  'Congress': [],
  'Crime and Law Enforcement': [{ industry: 'legal', confidence: 0.4 }],
  'Economics and Public Finance': [{ industry: 'finance-banking', confidence: 0.5 }],
  'Education': [{ industry: 'education', confidence: 0.85 }],
  'Emergency Management': [{ industry: 'insurance', confidence: 0.4 }],
  'Energy': [
    { industry: 'energy-fossil', confidence: 0.6 },
    { industry: 'energy-renewable', confidence: 0.55 },
    { industry: 'utilities-electric', confidence: 0.55 },
  ],
  'Environmental Protection': [
    { industry: 'energy-fossil', confidence: 0.45 },
    { industry: 'waste-water', confidence: 0.45 },
  ],
  'Families': [],
  'Finance and Financial Sector': [
    { industry: 'finance-banking', confidence: 0.85 },
    { industry: 'insurance', confidence: 0.45 },
  ],
  'Foreign Trade and International Finance': [
    { industry: 'manufacturing', confidence: 0.5 },
    { industry: 'transport', confidence: 0.4 },
  ],
  'Government Operations and Politics': [{ industry: 'government', confidence: 0.6 }],
  'Health': [
    { industry: 'health-providers', confidence: 0.7 },
    { industry: 'pharma', confidence: 0.5 },
    { industry: 'insurance', confidence: 0.45 },
  ],
  'Housing and Community Development': [
    { industry: 'real-estate', confidence: 0.75 },
    { industry: 'construction', confidence: 0.5 },
  ],
  'Immigration': [],
  'International Affairs': [],
  'Labor and Employment': [{ industry: 'labor-unions', confidence: 0.6 }],
  'Law': [{ industry: 'legal', confidence: 0.55 }],
  'Native Americans': [{ industry: 'government', confidence: 0.4 }],
  'Public Lands and Natural Resources': [
    { industry: 'mining', confidence: 0.45 },
    { industry: 'energy-fossil', confidence: 0.4 },
  ],
  'Science, Technology, Communications': [
    { industry: 'tech', confidence: 0.7 },
    { industry: 'telecom', confidence: 0.55 },
  ],
  'Social Welfare': [{ industry: 'health-providers', confidence: 0.35 }],
  'Sports and Recreation': [{ industry: 'media-entertainment', confidence: 0.4 }],
  'Taxation': [{ industry: 'finance-banking', confidence: 0.35 }],
  'Transportation and Public Works': [
    { industry: 'transport', confidence: 0.8 },
    { industry: 'construction', confidence: 0.5 },
  ],
  'Water Resources Development': [
    { industry: 'waste-water', confidence: 0.7 },
    { industry: 'construction', confidence: 0.4 },
  ],
};

/**
 * Subject-term fragments that sharpen a policy area into a specific sector.
 * Matched case-insensitively as substrings against the bill's subject terms.
 */
export const SUBJECT_TERM_INDUSTRIES: { match: string; industry: IndustryId; confidence: number }[] = [
  { match: 'prescription drug', industry: 'pharma', confidence: 0.85 },
  { match: 'drug and medical device', industry: 'pharma', confidence: 0.85 },
  { match: 'medical device', industry: 'pharma', confidence: 0.8 },
  { match: 'biotechnology', industry: 'pharma', confidence: 0.8 },
  { match: 'hospital care', industry: 'health-providers', confidence: 0.85 },
  { match: 'health care cost', industry: 'health-providers', confidence: 0.6 },
  { match: 'health care coverage and access', industry: 'insurance', confidence: 0.6 },
  { match: 'medicare', industry: 'health-providers', confidence: 0.7 },
  { match: 'medicaid', industry: 'health-providers', confidence: 0.7 },
  { match: 'health insurance', industry: 'insurance', confidence: 0.85 },
  { match: 'nursing', industry: 'health-providers', confidence: 0.7 },
  { match: 'banking and financial institutions', industry: 'finance-banking', confidence: 0.9 },
  { match: 'securities', industry: 'finance-banking', confidence: 0.8 },
  { match: 'financial services and investments', industry: 'finance-banking', confidence: 0.85 },
  { match: 'insurance industry', industry: 'insurance', confidence: 0.9 },
  { match: 'housing finance', industry: 'real-estate', confidence: 0.8 },
  { match: 'mortgage', industry: 'real-estate', confidence: 0.8 },
  { match: 'oil and gas', industry: 'energy-fossil', confidence: 0.9 },
  { match: 'coal', industry: 'energy-fossil', confidence: 0.85 },
  { match: 'pipelines', industry: 'energy-fossil', confidence: 0.8 },
  { match: 'alternative and renewable resources', industry: 'energy-renewable', confidence: 0.9 },
  { match: 'solar', industry: 'energy-renewable', confidence: 0.85 },
  { match: 'wind power', industry: 'energy-renewable', confidence: 0.85 },
  { match: 'electric power', industry: 'utilities-electric', confidence: 0.85 },
  { match: 'nuclear power', industry: 'utilities-electric', confidence: 0.7 },
  { match: 'mining', industry: 'mining', confidence: 0.85 },
  { match: 'metals', industry: 'mining', confidence: 0.7 },
  { match: 'defense spending', industry: 'defense', confidence: 0.9 },
  { match: 'military procurement', industry: 'defense', confidence: 0.9 },
  { match: 'aviation and airports', industry: 'transport', confidence: 0.85 },
  { match: 'railroads', industry: 'transport', confidence: 0.9 },
  { match: 'motor carriers', industry: 'transport', confidence: 0.85 },
  { match: 'marine and inland water transportation', industry: 'transport', confidence: 0.85 },
  { match: 'telecommunication', industry: 'telecom', confidence: 0.9 },
  { match: 'broadcasting', industry: 'media-entertainment', confidence: 0.8 },
  { match: 'internet', industry: 'tech', confidence: 0.75 },
  { match: 'computer', industry: 'tech', confidence: 0.75 },
  { match: 'artificial intelligence', industry: 'tech', confidence: 0.85 },
  { match: 'digital media', industry: 'tech', confidence: 0.7 },
  { match: 'intellectual property', industry: 'media-entertainment', confidence: 0.55 },
  { match: 'agricultural price', industry: 'agriculture', confidence: 0.9 },
  { match: 'farm', industry: 'agriculture', confidence: 0.8 },
  { match: 'food industry', industry: 'agriculture', confidence: 0.85 },
  { match: 'pesticide', industry: 'agriculture', confidence: 0.7 },
  { match: 'alcoholic beverages', industry: 'tobacco-alcohol-cannabis', confidence: 0.9 },
  { match: 'tobacco', industry: 'tobacco-alcohol-cannabis', confidence: 0.9 },
  { match: 'marijuana', industry: 'tobacco-alcohol-cannabis', confidence: 0.9 },
  { match: 'firearms', industry: 'firearms', confidence: 0.9 },
  { match: 'gun control', industry: 'firearms', confidence: 0.8 },
  { match: 'labor standards', industry: 'labor-unions', confidence: 0.7 },
  { match: 'labor-management relations', industry: 'labor-unions', confidence: 0.85 },
  { match: 'employee benefits and pensions', industry: 'finance-banking', confidence: 0.5 },
  { match: 'higher education', industry: 'education', confidence: 0.85 },
  { match: 'elementary and secondary education', industry: 'education', confidence: 0.85 },
  { match: 'student aid', industry: 'education', confidence: 0.8 },
  { match: 'construction', industry: 'construction', confidence: 0.75 },
  { match: 'water quality', industry: 'waste-water', confidence: 0.8 },
  { match: 'solid waste', industry: 'waste-water', confidence: 0.85 },
  { match: 'hotels', industry: 'hospitality', confidence: 0.85 },
  { match: 'gambling', industry: 'hospitality', confidence: 0.85 },
  { match: 'tourism', industry: 'hospitality', confidence: 0.8 },
  { match: 'retail', industry: 'retail-consumer', confidence: 0.75 },
  { match: 'manufacturing', industry: 'manufacturing', confidence: 0.75 },
  { match: 'chemicals', industry: 'manufacturing', confidence: 0.7 },
  { match: 'digital currency', industry: 'crypto', confidence: 0.9 },
  { match: 'virtual currency', industry: 'crypto', confidence: 0.9 },
  { match: 'lawyers', industry: 'legal', confidence: 0.8 },
  { match: 'lobbying', industry: 'legal', confidence: 0.8 },
];

/**
 * Combines the policy area and subject terms into a ranked industry list.
 * Deterministic, offline, and free. Returns [] when nothing is indicated —
 * which for a ceremonial or procedural bill is the correct answer.
 */
export function classifyBillMetadata(
  policyArea: string | null | undefined,
  subjects: string[],
): { industry: IndustryId; confidence: number; rationale: string }[] {
  const scores = new Map<IndustryId, { confidence: number; reasons: string[] }>();

  const bump = (industry: IndustryId, confidence: number, reason: string) => {
    const cur = scores.get(industry);
    if (!cur) { scores.set(industry, { confidence, reasons: [reason] }); return; }
    // Independent evidence combines, but never certainty.
    cur.confidence = Math.min(0.95, 1 - (1 - cur.confidence) * (1 - confidence));
    if (cur.reasons.length < 3) cur.reasons.push(reason);
  };

  if (policyArea) {
    for (const m of POLICY_AREA_INDUSTRIES[policyArea] ?? []) {
      bump(m.industry, m.confidence, `CRS policy area "${policyArea}"`);
    }
  }

  const haystack = subjects.map((s) => s.toLowerCase());
  for (const term of SUBJECT_TERM_INDUSTRIES) {
    const hit = haystack.find((s) => s.includes(term.match));
    if (hit) bump(term.industry, term.confidence, `subject term "${hit}"`);
  }

  return [...scores.entries()]
    .map(([industry, v]) => ({
      industry,
      confidence: v.confidence,
      rationale: `Assigned from Library of Congress metadata: ${v.reasons.join(', ')}. This is metadata matching, not a reading of the bill text.`,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/**
 * Ceremonial and commemorative measures.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS — read before removing it.
 *
 * A review of this tool found it rendering, above a named member's photograph:
 *
 *     S.Res. 799 — expressing condolences to the victims of a mass shooting
 *     "Sectors this bill would affect: FIREARMS — confidence 90%"
 *     "Members involved, and who funded them: <member>"  … with a share button.
 *
 * The subject term "firearms" is correct metadata. The inference drawn from it
 * was indefensible: a condolence resolution does not affect the firearms
 * industry, and juxtaposing a member's donors with a memorial resolution is
 * exactly the kind of out-of-context implication this project exists NOT to
 * make.
 *
 * So: ceremonial measures are detected and excluded from sector tagging and
 * from every overlap computation. They remain browsable — they are real
 * legislative activity — but they carry no sector and produce no score.
 *
 * The detector is deliberately over-inclusive. A substantive bill wrongly
 * treated as ceremonial loses a score. A ceremonial resolution wrongly scored
 * defames someone. Those errors are not symmetric.
 * ---------------------------------------------------------------------------
 */
const CEREMONIAL_TITLE_PATTERNS: RegExp[] = [
  /\b(express(ing|es)?)\s+(the\s+)?(sense|condolences|sympathy|gratitude|support|solidarity|appreciation)\b/i,
  /\bcongratulat(ing|es|e)\b/i,
  /\bhonor(ing|s)?\s+(the\s+)?(life|memory|service|contributions|legacy|sacrifice)\b/i,
  /\bcommemorat(ing|es|e)\b/i,
  /\brecogniz(ing|es|e)\s+(the\s+)?(importance|contributions|anniversary|achievements|role|service|significance)\b/i,
  /\bcelebrat(ing|es|e)\b/i,
  /\bdesignat(ing|e)\s+.{0,80}\bas\s+["“]?(national|american)?\s*[^"”]{0,60}\b(day|week|month|year)\b/i,
  /\bsupporting the designation of\b/i,
  /\bmourn(ing|s)?\s+the\s+(loss|death|passing)\b/i,
  /\bremembering\b/i,
  /\bpaying tribute\b/i,
  /\bin memory of\b/i,
  /\bnational .{0,40}\b(day|week|month)\b.{0,40}\b(designat|recogni|declar)/i,
  // Post office and federal building naming bills.
  /\bto designate the facility of the united states postal service\b/i,
  /\bto (re)?designate the .{0,80} as the .{0,80}\b(building|facility|center|courthouse|post office|clinic|memorial)\b/i,
  /\bnaming .{0,60}\b(after|in honor of)\b/i,
];

/** Internal procedural measures that concern the operation of Congress itself. */
const PROCEDURAL_TITLE_PATTERNS: RegExp[] = [
  /\bproviding for (the )?consideration of\b/i,
  /\bproviding for congressional disapproval\b.{0,0}/i, // handled separately: CRA resolutions ARE substantive
  /\bamending the rules of the (house|senate)\b/i,
  /\belecting members to (certain )?standing committees\b/i,
  /\bauthorizing the (speaker|clerk)\b/i,
  /\bfixing the daily hour of meeting\b/i,
  /\bto authorize testimony and legal representation\b/i,
  /\brelating to the adjournment\b/i,
];

export interface CeremonialCheck {
  ceremonial: boolean;
  reason: string | null;
}

/**
 * Returns true when a measure is commemorative, memorial, honorific, naming, or
 * an internal procedural matter — i.e. when tagging it with an economic sector
 * would be meaningless or actively misleading.
 *
 * Note the deliberate exception: a Congressional Review Act resolution of
 * disapproval ("providing for congressional disapproval of the rule submitted
 * by…") IS substantive — it repeals a regulation — and must not be filtered.
 */
export function isCeremonialMeasure(
  title: string,
  billType: string,
  policyArea?: string | null,
  subjects: string[] = [],
): CeremonialCheck {
  // The Library of Congress labels these directly. An audit found 18 tribute
  // and commemorative resolutions still being sector-tagged and scored because
  // their titles did not match any phrase pattern — including a memorial for
  // police officers killed in the line of duty, which was tagged "Lawyers &
  // Lobbyists" and offered a share button. The subject term is authoritative;
  // check it first.
  const CEREMONIAL_SUBJECTS = /congressional tributes|commemorative (event|holiday)|anniversaries|awards and medals|memorials/i;
  if (subjects.some((s) => CEREMONIAL_SUBJECTS.test(s))) {
    return { ceremonial: true, reason: 'measure the Library of Congress labels as a congressional tribute or commemoration' };
  }
  const t = (title ?? '').trim();
  if (!t) return { ceremonial: false, reason: null };

  // CRA disapproval resolutions are substantive. Check before anything else.
  if (/\bcongressional disapproval of the rule\b/i.test(t)) return { ceremonial: false, reason: null };

  for (const re of CEREMONIAL_TITLE_PATTERNS) {
    const m = re.exec(t);
    if (m) return { ceremonial: true, reason: `commemorative or honorific measure ("${m[0].slice(0, 60)}")` };
  }
  for (const re of PROCEDURAL_TITLE_PATTERNS) {
    const m = re.exec(t);
    if (m) return { ceremonial: true, reason: `internal procedural measure ("${m[0].slice(0, 60)}")` };
  }

  // Simple resolutions (H.Res./S.Res.) that carry the "Congress" policy area are
  // about the institution, not about the economy.
  const simple = /^(hres|sres|hconres|sconres)$/i.test(billType);
  if (simple && policyArea === 'Congress') {
    return { ceremonial: true, reason: 'simple resolution concerning the operation of Congress' };
  }

  return { ceremonial: false, reason: null };
}


/**
 * What kind of measure is this, and does it become law?
 *
 * The app previously tested `/res$/i` on the bill type, which matches `hjres`
 * and `sjres` as well as `hres`/`hconres`, and then told the reader
 * "a resolution, not a law — it does not become law."
 *
 * That is wrong for 409 of the 1,477 measures in a typical dataset. A JOINT
 * resolution is presented to the President and does become law; that is the
 * vehicle used for Congressional Review Act repeals and for proposing
 * constitutional amendments. On one page the label said "not a law" directly
 * above a summary reading "This joint resolution nullifies the final rule…".
 */
export type MeasureKind = 'bill' | 'joint-resolution' | 'simple-resolution' | 'concurrent-resolution';

export interface MeasureType {
  kind: MeasureKind;
  label: string;
  /** One plain sentence a non-expert can act on. */
  explanation: string;
  becomesLaw: boolean;
}

export function measureType(billType: string): MeasureType {
  const t = (billType ?? '').toLowerCase();
  if (t === 'hjres' || t === 'sjres') {
    return {
      kind: 'joint-resolution',
      label: 'Joint resolution',
      explanation:
        'A joint resolution. It goes to the President like a bill and can become law — this is the vehicle used to repeal a federal rule, or to propose a change to the Constitution.',
      becomesLaw: true,
    };
  }
  if (t === 'hconres' || t === 'sconres') {
    return {
      kind: 'concurrent-resolution',
      label: 'Concurrent resolution',
      explanation:
        'A concurrent resolution. Both chambers vote on it, but it does not go to the President and does not become law. Used for budget frameworks and for the two chambers to state a joint position.',
      becomesLaw: false,
    };
  }
  if (t === 'hres' || t === 'sres') {
    return {
      kind: 'simple-resolution',
      label: 'Simple resolution',
      explanation:
        'A simple resolution. Only one chamber votes on it, and it does not become law. Used for that chamber\'s own rules, and for statements of opinion and tribute.',
      becomesLaw: false,
    };
  }
  return {
    kind: 'bill',
    label: 'Bill',
    explanation: 'A bill. It becomes law only if both chambers pass it and the President signs it.',
    becomesLaw: true,
  };
}
