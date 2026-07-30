import { isCeremonialMeasure, measureType } from './policy-areas.js';

/**
 * "What does that bill do, in clean and very lucid language, and how does it
 * affect normal public?" — answered without an LLM, and without lying.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE IS DANGEROUS, AND HOW IT IS MADE SAFE
 *
 * `meaning.ts` is dangerous because it narrates a number. This file is
 * dangerous in a different and larger way: it tells a reader what a law does.
 * A wrong sentence here is not a misleading statistic, it is misinformation
 * about the law, and a reader has no way to catch it — the whole reason they
 * are reading this instead of the bill is that they cannot read the bill.
 *
 * The thing it replaces was worse than nothing. `bill_classifications.
 * plain_summary` was populated, on the no-key path, with the bill's own
 * LEGISLATIVE TITLE — "To amend title XVIII of the Social Security Act to
 * ensure appropriate payments for ambulance services under the Medicare
 * program." — under a heading that said "What this bill does" and a field name
 * that promised a paraphrase. That is register laundering: the reader is told
 * they are getting plain English and handed statute-speak.
 *
 * So this module obeys five rules, and every one is enforced by a test in
 * core.test.ts:
 *
 *  1. NOTHING HAS HAPPENED YET. A bill that has not become law changes
 *     nothing. Every sentence about effect is conditional — "would", "if it
 *     passed" — and the present-tense CRS verb is rewritten into that mood
 *     rather than copied. There is no phrasing in here that can be read as
 *     "this is now the rule".
 *
 *  2. NO EVALUATION. Not good, not bad, not needed, not dangerous, not a
 *     loophole, not a giveaway, not a reform. Note that the last two are words
 *     Congress itself uses in bill titles; where they appear in prose this
 *     module rewrites them out, because repeating a sponsor's framing is
 *     adopting it.
 *
 *  3. WHO IT REACHES, NEVER WHO PROFITS. "Reaches" is a fact about the subject
 *     matter. "Benefits" is a claim about causation and motive, and nothing in
 *     this dataset supports it. So the audience sentences name people in the
 *     position the bill's subject matter puts them in, and never name a
 *     beneficiary.
 *
 *  4. THE HONEST ANSWER IS USUALLY "WE CANNOT SAY". Only 466 of the 1,478
 *     bills in this dataset have a Congressional Research Service summary. For
 *     the other ~1,012 the only substantive text in existence is the title,
 *     and a title paraphrased confidently is exactly the failure above. Those
 *     bills say so, in the first sentence, and point at the bill.
 *
 *  5. NO NEW SOURCE TEXT. Every sentence is either a fixed string from the
 *     table below, or a deterministic rewrite of public-domain CRS text. This
 *     module never invents a fact about a bill; it re-words one.
 *
 * The CRS conventions this exploits are strong and stable: a summary opens by
 * restating the bill's short title (pure noise — the title is already on the
 * page), then gives one operative sentence beginning "This bill requires /
 * establishes / prohibits / nullifies …", then elaborates after
 * "Specifically,". The operative sentence is the answer to the reader's
 * question, and it is the only sentence this module takes.
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// The rewrite table
// ---------------------------------------------------------------------------

export interface ProseRewrite {
  /** Matched against legislative prose. Global + case-insensitive by construction. */
  from: RegExp;
  /** The plain replacement. Empty string means "this phrase carries no meaning". */
  to: string;
  /** Why the plain version says the same thing the legal version said. Reviewable. */
  why: string;
}

/**
 * Every deterministic rewrite this module will make, with the argument for it.
 *
 * This table is the reviewable surface of the whole feature. If one of these is
 * wrong, the site tells a reader something false about a law, so each entry
 * carries the reason its two sides mean the same thing. Entries that DELETE
 * text are held to a higher bar than entries that swap a word: deleting is only
 * allowed where the phrase has no operative content at all.
 *
 * Order matters. Longer and more specific patterns come first, because
 * "title XVIII of the Social Security Act" must be consumed before the bare
 * "the Social Security Act" rule sees it.
 */
export const PROSE_REWRITES: ProseRewrite[] = [
  // --- (a) phrases with no operative content: deleted -----------------------
  {
    from: /,?\s*and for other purposes\.?/gi,
    to: '',
    why: 'A drafting catch-all. It grants nothing and restricts nothing; it exists so a later amendment is germane. Deleting it removes no content and it appears in 117 titles in this dataset.',
  },
  {
    from: /\bThis Act may be cited as the\b[^.]*\.\s*/gi,
    to: '',
    why: 'The short-title section. It names the Act and does nothing else — and the name is already the page heading, so keeping it is pure repetition.',
  },
  {
    from: /\bNotwithstanding any other provision of law,?\s*/gi,
    to: 'Even if another law says otherwise, ',
    why: 'A precedence clause. The plain version states the same ordering rule without the Latin-shaped construction.',
  },
  {
    from: /\bexcept as otherwise provided in this (section|Act|title),?\s*/gi,
    to: 'apart from the exceptions written into it, ',
    why: 'A cross-reference to exceptions elsewhere in the same document. The plain version keeps the fact that exceptions exist, which is the only thing the clause tells a reader who cannot follow the cross-reference.',
  },
  {
    from: /\bsubject to the availability of appropriations,?\s*/gi,
    to: 'only if Congress puts up the money, ',
    why: 'This is the single most load-bearing qualifier in federal legislation and readers routinely miss it: the text authorises an activity but does not fund it. Saying it in plain words is more faithful than repeating it in legal words.',
  },

  // --- (b) statutes named by number, which no reader can resolve ------------
  {
    from: /\bto amend title XVIII of the Social Security Act to\b/gi,
    to: 'to change Medicare rules so that they',
    why: 'Title XVIII of the Social Security Act IS Medicare; that is what the title creates and nothing else lives in it. A reader told "title XVIII" learns nothing; a reader told "Medicare" learns exactly what is at stake. "so that they" rather than a bare "so that" because what follows in a bill title is always a bare infinitive ("…to ensure appropriate payments"), and "so that ensure" is not English. The conditional mood is added by the caller, which is what keeps it out of the indicative.',
  },
  {
    from: /\bto amend title XIX of the Social Security Act to\b/gi,
    to: 'to change Medicaid rules so that they',
    why: 'Same construction, for the Medicaid title.',
  },
  {
    from: /\btitle XVIII of the Social Security Act\b/gi,
    to: 'the Medicare law',
    why: 'Same identity as above, in the slot where the phrase is a noun rather than the opening of a title.',
  },
  {
    from: /\btitle XIX of the Social Security Act\b/gi,
    to: 'the Medicaid law',
    why: 'Title XIX is Medicaid, in the same way title XVIII is Medicare.',
  },
  {
    from: /\btitle XXI of the Social Security Act\b/gi,
    to: "the children's health insurance law",
    why: 'Title XXI is CHIP, the children’s health insurance programme.',
  },
  {
    from: /\bthe Elementary and Secondary Education Act of 1965\b/gi,
    to: "the main federal school law",
    why: 'ESEA is the statute that carries almost all federal money and rules for public schools. Naming its subject rather than its year is what tells a reader whether it touches them.',
  },
  {
    from: /\bthe Internal Revenue Code of 1986\b/gi,
    to: 'the federal tax code',
    why: 'The Internal Revenue Code of 1986 is the tax code in force. The year is a citation convention, not information.',
  },
  {
    from: /\bthe Federal Food, Drug, and Cosmetic Act\b/gi,
    to: 'the federal food and drug law',
    why: 'Restates the statute by its subject. The formal name is a title, not a description.',
  },
  {
    from: /\bthe Controlled Substances Act\b/gi,
    to: 'the federal drug law',
    why: 'Names what the statute governs. "Controlled substances" is a term of art whose meaning is exactly "drugs the federal government regulates".',
  },
  {
    from: /\bchapter 8 of title 5, United States Code\b/gi,
    to: "Congress's power to cancel a federal rule",
    why: 'This citation is the Congressional Review Act. It is the mechanism, and the mechanism is the point of the measure — every one of the 44 "nullifies" measures here runs on it.',
  },

  // --- (c) agencies named at full legal length ------------------------------
  // Long agency names are the biggest single driver of reading grade in CRS
  // prose: "the Centers for Medicare & Medicaid Services" is five words and
  // eleven syllables of pure syllable load. Each replacement below says what
  // the agency IS, which is also what a reader needs in order to care.
  {
    from: /\bthe Centers for Medicare (&|and) Medicaid Services\b/gi,
    to: 'the agency that runs Medicare and Medicaid',
    why: 'CMS runs both programmes. The replacement is longer in words but plainer per word, and it tells a reader who has heard of Medicare but not of CMS what body is being talked about.',
  },
  {
    from: /\bthe Department of Health and Human Services\b/gi,
    to: 'the federal health department',
    why: 'HHS is the federal health department. Nothing is lost and the reader is not asked to decode an initialism.',
  },
  {
    from: /\bthe Secretary of Health and Human Services\b/gi,
    to: 'the head of the federal health department',
    why: 'Same substitution, in the officer slot. "Secretary" alone reads to a non-American as clerical staff.',
  },
  {
    from: /\bthe Government Accountability Office\b/gi,
    to: "Congress's auditors",
    why: 'GAO audits federal programmes for Congress. Its function is the whole reason a bill directs a report to it.',
  },
  {
    from: /\bthe Bureau of Land Management\b/gi,
    to: 'the federal land agency',
    why: 'BLM manages federal public land. In this dataset it appears almost only in measures about what may happen on that land.',
  },
  {
    from: /\bthe Department of Veterans Affairs\b/gi,
    to: 'the VA',
    why: 'The VA is the name veterans and their families actually use for it, including in the department\'s own materials.',
  },
  // For these six the initialism is the form readers already hold, it refers to
  // nothing else in federal government, and it is shorter than the legal name by
  // several syllables — so the swap loses no precision at all.
  { from: /\bthe Environmental Protection Agency\b/gi, to: 'the EPA', why: 'The initialism is more widely recognised than the full name, refers to no other body, and is four words shorter.' },
  { from: /\bthe Food and Drug Administration\b/gi, to: 'the FDA', why: 'The initialism is the form readers already know from medicine packaging, and refers to no other body.' },
  { from: /\bthe Internal Revenue Service\b/gi, to: 'the IRS', why: 'The initialism is the form on every tax form a reader has ever filled in, and refers to no other body.' },
  { from: /\bthe Federal Aviation Administration\b/gi, to: 'the FAA', why: 'The initialism is the form used in every airline announcement and news report, and refers to no other body.' },
  { from: /\bthe Federal Communications Commission\b/gi, to: 'the FCC', why: 'The initialism is the common form in broadcasting and phone service, and refers to no other body.' },
  { from: /\bthe Securities and Exchange Commission\b/gi, to: 'the SEC', why: 'The initialism is the common form in any reporting about shares, and refers to no other federal body.' },
  { from: /\bthe Department of Homeland Security\b/gi, to: 'Homeland Security', why: 'Dropping "the Department of" leaves a name that is already unambiguous in American usage, and takes two words out of a sentence that has too many.' },
  { from: /\bthe Department of Defense\b/gi, to: 'the Defense Department', why: 'Plainer word order for the same body. Deliberately NOT "the Pentagon", which is a building and a figure of speech, not the department.' },
  { from: /\bthe Department of Agriculture\b/gi, to: 'the USDA', why: 'The initialism is the common form, including on the meat and produce labels a reader has in the kitchen, and it refers to no other body.' },
  { from: /\bthe Department of the Interior\b/gi, to: 'the Interior Department', why: 'Plainer word order for the same body: the modifier goes in front, as it does in ordinary speech, and the "of the" disappears.' },
  { from: /\bthe Department of the Treasury\b/gi, to: 'the Treasury Department', why: 'Plainer word order for the same body. Listed separately from the pattern below so the rewrite cannot produce "the the Treasury Department".' },
  { from: /\bthe Department of (Energy|Education|Transportation|Labor|Justice|Commerce|State)\b/gi, to: 'the $1 Department', why: 'Plainer word order for the same body. The department name is carried through by the capture group, so the rewrite is purely syntactic and cannot change which department is meant.' },

  // --- (d) legal vocabulary with an exact plain equivalent ------------------
  {
    from: /\bpromulgat(e|es|ed|ing)\b/gi,
    to: 'issu$1',
    why: 'To promulgate a rule is to issue it. The inflection is carried through by the capture group so tense is preserved.',
  },
  {
    from: /\bnon-?U\.?S\.? nationals?\b/gi,
    to: 'people who are not U.S. citizens',
    why: 'CRS uses this to avoid the statutory word "alien". The plain version keeps that intent and is what the category actually means to a reader.',
  },
  // A fiscal year is a budget year, but only where the phrase is the object of a
  // preposition. In the modifier slot — "continuing FY2026 appropriations" — the
  // expansion produces "continuing the 2026 budget year appropriations", so
  // there the year is left bare instead. Two entries, ordered.
  {
    from: /(?<=\b(?:for|through|in|of|during|until|by)\s)(?:the\s+)?(?:fiscal year|FY)\s?(\d{4})\b/gi,
    to: 'the $1 budget year',
    why: 'A fiscal year is a budget year. Saying so removes a term of art without changing which year is meant. The lookbehind restricts it to the slot where it reads as a noun phrase.',
  },
  {
    from: /\b(?:fiscal year|FY)\s?(\d{4})\b/gi,
    to: '$1',
    why: 'Everywhere else the phrase modifies a following noun, and the bare year says the same thing in one word.',
  },
  {
    from: /\bthe date of (?:the )?enactment of this Act\b/gi,
    to: 'the day this becomes law',
    why: 'The standard drafting formula for the commencement date. The plain version names the same day and, unlike the original, makes clear to a reader that the day has not arrived.',
  },
  {
    from: /\bnot later than\b/gi,
    to: 'within',
    why: 'A deadline. "Not later than 180 days after X" and "within 180 days after X" are the same deadline; the second is one clause a reader does not have to unpick.',
  },
  { from: /\bin order to\b/gi, to: 'to', why: 'Two words of padding around an infinitive that is already there. Removing them cannot change what the infinitive says, and it shortens a sentence that is usually too long.' },
  { from: /\bwith respect to\b/gi, to: 'about', why: 'A three-word preposition that means "about" or "regarding" and nothing more; the one-word version carries the same relation.' },
  { from: /\bpursuant to\b/gi, to: 'under', why: 'Means "under" or "as required by", which is exactly the relation a reader takes from "under" — and "under a law" is the phrase they have already met.' },
  { from: /\bprior to\b/gi, to: 'before', why: 'Means before. There is no shade of meaning in the longer form that the shorter one loses, and "before" is one word rather than two.' },
  { from: /\bsubsequent to\b/gi, to: 'after', why: 'Means after. As with "prior to", the longer form carries no extra sense — it is register, not content.' },
  { from: /\bis authorized to\b/gi, to: 'may', why: 'The authorising formula. "May" is the plain modal with exactly that force, and — importantly — it keeps the sense permissive: an authorisation is not a requirement, and a reader must not come away thinking it is one.' },
  {
    from: /\bshall\b/gi,
    to: 'must',
    why: 'The canonical plain-language rewrite, and the one every federal drafting guide already recommends: in operative text "shall" imposes a duty, which is what "must" says. Note it keeps working under negation — "shall not" becomes "must not", which is the same prohibition.',
  },
  { from: /\butiliz(e|es|ed|ing)\b/gi, to: 'us$1', why: 'Utilize means use — there is no technical sense in this corpus that "use" does not cover. The capture group carries the inflection through, so tense is preserved.' },
  {
    from: /\binstitutions of higher education\b/gi,
    to: 'colleges',
    why: 'The statutory term covers colleges and universities. "Colleges" is the word the students it applies to use, and the phrase is five syllables shorter.',
  },
  {
    from: /\bagricultural producers\b/gi,
    to: 'farmers',
    why: 'The statutory term for farmers and ranchers. "Farmers" is what they are called outside the statute.',
  },
  {
    from: /\bindividuals\b/gi,
    to: 'people',
    why: 'CRS uses "individuals" where "people" is meant, because the statutes do. Same referent, one fewer syllable per use, and it is the word a reader thinks in.',
  },
  {
    from: /\bappropriates\b/gi,
    to: 'sets aside money',
    why: 'A false friend: "appropriates" means allocates funds. ONLY the third-person verb form is rewritten. The bare "appropriate" is left alone deliberately — it is overwhelmingly the adjective in this corpus ("to ensure appropriate payments"), and rewriting that would produce "to ensure sets aside money payments", which is worse than the jargon.',
  },
  {
    from: /\bsets forth\b/gi,
    to: 'sets out',
    why: '"Sets forth" is archaic for "sets out" or "states". No change of meaning; two fewer syllables and a word a reader has met.',
  },
  {
    from: /\bsuch sums as may be necessary\b/gi,
    to: 'as much money as it takes',
    why: 'An open-ended authorisation. The plain version keeps exactly the open-endedness, which is the point of the phrase.',
  },
  {
    from: /\bshall be construed\b/gi,
    to: 'is to be read',
    why: 'Construe here means read or interpret. No change of meaning.',
  },

  {
    from: /^(This (?:bill|Act|act|resolution|joint resolution|measure)) conditions\s+(.{3,140}?)\s+on\b/i,
    to: '$1 makes $2 depend on',
    why: '"This bill conditions Medicare payment for X on certain requirements" has no plain twin while "conditions" stays a verb — every candidate produced a second "on". Recasting it as "makes X depend on Y" says the same thing and hands the sentence a verb the conditional table can then handle. Anchored to the start of the sentence, and to CRS\'s own subject, because "the conditions imposed on farmers" is the same five characters in a noun slot and rewriting THAT would produce nonsense.',
  },

  // --- (e) the sponsor's own framing, removed -------------------------------
  // These are words Congress uses about its own bills. Repeating them is
  // adopting a claim this project has no basis for, so they are neutralised
  // even though the source text used them (rule 2).
  // Each is anchored to the infinitive slot ("to reform…") because these words
  // are also NOUNS inside statute names — rewriting "the Tax Reform Act" to
  // "the Tax Change Act" would misname a real law. After "to " the word can
  // only be a verb.
  {
    from: /\b(to|and) (?:reform|improve)\b/gi,
    to: '$1 change',
    why: 'Both assert that the change is an improvement. That is the sponsor\'s claim, not a fact in the record, and this project does not repeat it (rule 2). "Change" is the part that is verifiable from the text.',
  },
  {
    from: /\b(to|and) modernize\b/gi,
    to: '$1 update',
    why: '"Modernize" carries the claim that the new version is better suited to the present. "Update" states the same action without the endorsement.',
  },
  {
    from: /\b(to|and) strengthen\b/gi,
    to: '$1 tighten',
    why: '"Strengthen" is praise. "Tighten" describes the same direction of travel on a rule — more restrictive — and lets a reader decide for themselves whether they wanted that.',
  },
  {
    from: /\b(to|and) enhance\b/gi,
    to: '$1 increase',
    why: '"Enhance" means improve. "Increase" is the measurable part of what is being claimed.',
  },
  {
    from: /\b(to|and) streamline\b/gi,
    to: '$1 simplify',
    why: '"Streamline" is business register and implies the result is better. "Simplify" says what changes to the process.',
  },
  {
    from: /\bclos(e|es|ing) (a|the) loophole\b/gi,
    to: 'chang$1 the rule',
    why: '"Loophole" is a judgement about a rule someone dislikes. The neutral statement is that a rule changes.',
  },
  {
    from: /\bcommon-?sense\b/gi,
    to: '',
    why: 'Pure advocacy. It describes no provision.',
  },
];

/**
 * The operative verb, made conditional and made plain.
 *
 * CRS writes in the present indicative: "This bill requires the Secretary to…".
 * That is correct for describing a document and catastrophic for describing the
 * world, and this site puts the sentence next to a member's photograph and
 * their donors. So the verb is rewritten into the conditional mood, and where
 * the legal verb has a plainer twin ("nullifies" → "would cancel") the plainer
 * twin is used.
 *
 * The table is closed on purpose. CRS vocabulary is small — in this dataset 20
 * verbs cover 400 of 466 summaries — and a closed table cannot silently mangle
 * an irregular verb the way a de-inflection rule would ("has" → "ha").
 * Anything not in here falls back to a frame that needs no conjugation at all;
 * see `conditionalise`.
 */
export const OPERATIVE_VERBS: Record<string, string> = {
  // the workhorses, in dataset frequency order
  provides: 'would provide',
  nullifies: 'would cancel',
  directs: 'would order',
  designates: 'would name',
  requires: 'would require',
  proposes: 'would propose',
  prohibits: 'would ban',
  establishes: 'would set up',
  reauthorizes: 'would renew',
  expands: 'would widen',
  terminates: 'would end',
  allows: 'would allow',
  removes: 'would remove',
  eliminates: 'would get rid of',
  extends: 'would extend',
  authorizes: 'would allow',
  revises: 'would change',
  redesignates: 'would rename',
  opens: 'would open',
  revokes: 'would cancel',
  renames: 'would rename',
  broadens: 'would widen',
  reinstates: 'would bring back',
  // Deliberately NOT in this table: `conditions`. "This bill conditions
  // Medicare payment for X on certain requirements" has no plain twin that
  // survives the second "on" — every candidate produced "would put conditions on
  // Medicare payment for X on certain requirements". A verb with no clean
  // rewrite is better left to the attributed fallback in `conditionalise` than
  // forced into one.
  imposes: 'would place',
  increases: 'would raise',
  places: 'would place',
  bars: 'would ban',
  restores: 'would bring back',
  rescinds: 'would cancel',
  reopens: 'would reopen',
  grants: 'would grant',
  modifies: 'would change',
  repeals: 'would cancel',
  relaxes: 'would loosen',
  includes: 'would include',
  ends: 'would end',
  incorporates: 'would fold in',
  addresses: 'would deal with',
  limits: 'would limit',
  exchanges: 'would swap',
  adopts: 'would adopt',
  encourages: 'would encourage',
  ranks: 'would rank',
  informs: 'would inform',
  states: 'would state',
  amends: 'would change',
  creates: 'would create',
  makes: 'would make',
  reduces: 'would lower',
  exempts: 'would leave out',
  codifies: 'would write into law',
  permits: 'would allow',
  transfers: 'would hand over',
  withdraws: 'would pull back',
  suspends: 'would pause',
  waives: 'would set aside',
  raises: 'would raise',
  lowers: 'would lower',
  repurposes: 'would re-use',
  sets: 'would set',
  // Resolutions that state a position. A resolution genuinely does express,
  // condemn or elect — reporting that is a fact about the document, not this
  // project taking the position. The conditional still applies: an unpassed
  // resolution has expressed nothing.
  expresses: 'would express',
  supports: 'would support',
  recognizes: 'would recognize',
  condemns: 'would condemn',
  honors: 'would honor',
  congratulates: 'would congratulate',
  calls: 'would call',
  urges: 'would urge',
  demands: 'would demand',
  reaffirms: 'would restate',
  declares: 'would declare',
  elects: 'would elect',
  dismisses: 'would dismiss',
  censures: 'would censure',
  orders: 'would order',
  requests: 'would ask',
  // present in the source but evaluative; neutralised per rule 2
  reforms: 'would change',
  improves: 'would change',
  strengthens: 'would change',
  streamlines: 'would change',
  modernizes: 'would change',
};

// ---------------------------------------------------------------------------
// Who the bill reaches
// ---------------------------------------------------------------------------

export interface AudienceRule {
  /** Matched case-insensitively as a substring of a CRS subject term. */
  match: string;
  /** Who this reaches. A person, in the words they would use about themselves. */
  who: string;
  /** Where a change would show up in an ordinary week, if one ever happened. */
  where: string;
}

/**
 * Subject terms → the people a bill on that subject reaches.
 *
 * This extends the approach in `policy-areas.ts` — Library of Congress subject
 * terms are the best free signal about a bill, because a librarian assigned
 * them by hand — but answers a different question. `SUBJECT_TERM_INDUSTRIES`
 * asks "which donor sector is this near?". This asks "whose week does this turn
 * up in?", which is the question a reader who is not investigating anyone has.
 *
 * The register is deliberate: "Anyone who flies", not "air travellers"; "People
 * on Medicare who use a wheelchair", not "Medicare beneficiaries utilising
 * mobility devices". A sentence a reader has to translate has failed.
 *
 * Ordered most specific first; the first match wins and at most two are used.
 * Per rule 3 no entry names a beneficiary — "Drug companies, and anyone who
 * fills a prescription" is who a bill reaches; "drug companies stand to gain"
 * is a motive claim this dataset cannot support.
 */
export const SUBJECT_AUDIENCES: AudienceRule[] = [
  // health — the largest substantive block in this dataset
  { match: 'wheelchair', who: 'People who use a wheelchair.', where: 'what a wheelchair costs you' },
  { match: 'medicare', who: 'People on Medicare.', where: 'what Medicare pays for' },
  { match: 'medicaid', who: 'People on Medicaid.', where: 'what Medicaid pays for' },
  { match: 'prescription drug', who: 'Anyone who fills a prescription.', where: 'the price at the pharmacy counter' },
  { match: 'drug safety', who: 'Anyone who takes a medicine.', where: 'which medicines you can be given' },
  { match: 'health care coverage and access', who: 'Anyone who buys health insurance.', where: 'what your plan covers' },
  { match: 'health care costs and insurance', who: 'Anyone who pays a medical bill.', where: 'what you are billed' },
  { match: 'health insurance', who: 'Anyone with health insurance.', where: 'what your plan covers' },
  { match: 'hospital', who: 'People who go into hospital, and the staff there.', where: 'a hospital visit' },
  { match: 'nursing home', who: 'People in nursing homes, and their families.', where: 'care in a nursing home' },
  { match: 'mental health', who: 'People getting help for their mental health.', where: 'getting an appointment' },
  { match: 'cancer', who: 'People with cancer, and the people caring for them.', where: 'treatment and screening' },
  { match: 'child health', who: 'Parents of young children.', where: "a child's care" },
  { match: 'health personnel', who: 'People who work in health care, and their patients.', where: 'who is there to treat you' },
  { match: 'medical research', who: 'People with an illness that is still being studied.', where: 'what research gets funded' },

  // money in and out of a household
  { match: 'income tax', who: 'Anyone who files a tax return.', where: 'your tax return' },
  { match: 'tax', who: 'Anyone who pays federal tax.', where: 'your tax bill' },
  { match: 'social security', who: 'People who get Social Security.', where: 'your monthly payment' },
  { match: 'unemployment', who: 'People who have lost a job.', where: 'what you can claim' },
  { match: 'minimum wage', who: 'People paid by the hour.', where: 'your paycheck' },
  { match: 'labor standards', who: 'People at work, and the people who employ them.', where: 'your hours and your pay' },
  { match: 'employee benefits and pensions', who: 'People with a pension through work.', where: 'your retirement savings' },
  { match: 'student aid', who: 'Students, and people paying off a student loan.', where: 'what you owe' },
  { match: 'consumer credit', who: 'Anyone with a loan or a credit card.', where: 'what credit costs you' },
  { match: 'banking and financial institutions', who: 'Anyone with a bank account.', where: 'dealing with your bank' },
  { match: 'consumer affairs', who: 'Anyone who buys things.', where: 'what you can buy, and what it costs' },
  { match: 'mortgage', who: 'Home buyers, and people with a mortgage.', where: 'buying or keeping a home' },
  { match: 'housing', who: 'Renters and home buyers.', where: 'what housing costs' },
  { match: 'digital currency', who: 'People who hold digital currency.', where: 'buying and holding it' },
  { match: 'virtual currency', who: 'People who hold digital currency.', where: 'buying and holding it' },
  { match: 'food assistance', who: 'People who use food aid.', where: 'what you can buy with it' },

  // school
  { match: 'elementary and secondary education', who: 'School districts, and children in them.', where: 'your local school' },
  { match: 'higher education', who: 'College students, and their families.', where: 'college costs and rules' },
  { match: 'student', who: 'Students, and their families.', where: 'school and college' },
  { match: 'child care', who: 'Parents who pay for child care.', where: 'what child care costs' },
  { match: 'child safety and welfare', who: 'Children, and the adults responsible for them.', where: "a child's safety" },

  // getting about
  { match: 'aviation and airports', who: 'Anyone who flies.', where: 'flying' },
  { match: 'railroad', who: 'Anyone who rides a train.', where: 'train travel' },
  { match: 'motor vehicles', who: 'Anyone who drives.', where: 'driving, and what a car must have' },
  { match: 'roads and highways', who: 'Anyone who drives.', where: 'the roads you use' },
  { match: 'transportation safety', who: 'Anyone who travels.', where: 'how safe the journey is' },
  { match: 'postal service', who: 'Anyone who gets mail.', where: 'your mail' },

  // bills that arrive at a house
  { match: 'electric power', who: 'Anyone who pays an electricity bill.', where: 'your electricity bill' },
  { match: 'oil and gas', who: 'Anyone who buys fuel or heats a home.', where: 'what fuel costs' },
  { match: 'energy prices', who: 'Anyone who pays an energy bill.', where: 'your energy bill' },
  { match: 'telecommunication', who: 'Anyone with a phone line or broadband.', where: 'your phone and internet service' },
  { match: 'internet', who: 'Anyone who uses the internet.', where: 'what you can do online' },
  { match: 'broadband', who: 'People with a slow internet connection, or none at all.', where: 'whether you can get connected' },
  { match: 'water quality', who: 'Anyone who drinks tap water.', where: 'what comes out of the tap' },
  { match: 'air quality', who: 'People living near a road, a plant or a port.', where: 'the air where you live' },
  { match: 'solid waste', who: 'Anyone who puts out the trash.', where: 'trash and recycling' },

  // the rest of ordinary life
  { match: 'firearms', who: 'People who own or buy guns.', where: 'buying and owning a gun' },
  { match: 'immigration', who: 'People applying to live here, and their families here.', where: 'an application, and how long it takes' },
  { match: 'visas', who: 'People applying to come here, and their families here.', where: 'an application, and how long it takes' },
  { match: 'veterans', who: 'Veterans and their families.', where: 'what the VA does for you' },
  { match: 'military personnel', who: 'People serving in the military, and their families.', where: 'service pay and conditions' },
  { match: 'law enforcement officers', who: 'Police officers, and the people they stop.', where: 'how policing works where you live' },
  { match: 'crime victims', who: 'People who have been the victim of a crime.', where: 'what help you can get' },
  { match: 'criminal justice', who: 'People charged with a crime, and their families.', where: 'how a case is handled' },
  { match: 'elections, voting', who: 'Anyone who votes.', where: 'how you vote' },
  { match: 'disaster relief', who: 'People living where a disaster hits.', where: 'what help arrives, and when' },
  { match: 'parks, recreation', who: 'People who visit public land, and people who live beside it.', where: 'what you can do there' },
  { match: 'land use and conservation', who: 'People who live near or work on federal land.', where: 'what may be done with that land' },
  { match: 'mining', who: 'People who live near a mine, and people who work in one.', where: 'what may be dug, and where' },
  { match: 'agricultural price', who: 'Farmers, and anyone who buys food.', where: 'farm income and food prices' },
  { match: 'farm', who: 'Farmers, and anyone who buys food.', where: 'farming, and food prices' },
  { match: 'food industry', who: 'Anyone who buys food.', where: 'what is on the shelf, and what the label says' },
  { match: 'artificial intelligence', who: 'Anyone whose work or data an automated system touches.', where: 'how these systems may be used' },
  { match: 'data collection', who: 'Anyone whose personal data is held by a company.', where: 'what may be done with your data' },
  { match: 'small business', who: 'People who run a small business.', where: 'running the business' },
  { match: 'tobacco', who: 'People who smoke or vape.', where: 'what may be sold, and to whom' },
  { match: 'alcoholic beverages', who: 'People who drink, and places that serve.', where: 'what may be sold, and where' },
  { match: 'marijuana', who: 'People who use cannabis, legally or not.', where: 'what is legal where you live' },
];

/**
 * The CRS policy area is the fallback when no subject term matches. Every bill
 * has exactly one, so this table is the reason `whoItTouches` is almost never
 * blank — but it is deliberately vaguer than the subject rules above, because a
 * policy area genuinely is vaguer.
 *
 * Two of these say "nobody directly". That is the honest answer for a
 * resolution about the House's own committee assignments, and pretending
 * otherwise in order to fill the box would be the same error the old
 * plain_summary made.
 */
export const POLICY_AREA_AUDIENCES: Record<string, { who: string; where: string }> = {
  'Agriculture and Food': { who: 'Farmers, and anyone who buys food.', where: 'farming, and food prices' },
  'Animals': { who: 'People who keep animals, and people who work with them.', where: 'how animals must be treated' },
  'Armed Forces and National Security': { who: 'People in the military, and their families.', where: 'service, and what the military buys' },
  'Arts, Culture, Religion': { who: 'People who take part in the arts, or practice a faith.', where: 'what is funded, and what is protected' },
  'Civil Rights and Liberties, Minority Issues': { who: 'Anyone who could be treated differently because of who they are.', where: 'your rights, and how you enforce them' },
  'Commerce': { who: 'Anyone who buys or sells something.', where: 'what may be sold, and on what terms' },
  'Congress': { who: 'Nobody directly — this is about how Congress runs itself.', where: 'nothing in an ordinary week' },
  'Crime and Law Enforcement': { who: 'People caught up in the criminal law, and victims of crime.', where: 'policing, charges and sentences' },
  'Economics and Public Finance': { who: 'Anyone who pays tax or gets a federal payment.', where: 'federal spending and borrowing' },
  'Education': { who: 'Students, teachers, and the families paying for it.', where: 'school and college' },
  'Emergency Management': { who: 'People living where a disaster hits.', where: 'what help arrives, and when' },
  'Energy': { who: 'Anyone who pays an energy bill.', where: 'your energy bill' },
  'Environmental Protection': { who: 'People living near whatever is being regulated.', where: 'the air, water and land where you live' },
  'Families': { who: 'Parents, children, and people caring for a relative.', where: 'family life, and what support exists' },
  'Finance and Financial Sector': { who: 'Anyone with a bank account, a loan or savings.', where: 'dealing with banks and lenders' },
  'Foreign Trade and International Finance': { who: 'Anyone who buys imported goods, and people who make goods here.', where: 'prices, and what is made where' },
  'Government Operations and Politics': { who: 'Anyone who deals with a federal agency.', where: 'dealing with the government' },
  'Health': { who: 'Anyone who sees a doctor or pays for care.', where: 'getting care, and paying for it' },
  'Housing and Community Development': { who: 'Renters, home buyers, and their neighborhoods.', where: 'what housing costs' },
  'Immigration': { who: 'People applying to live here, and their families here.', where: 'an application, and how long it takes' },
  'International Affairs': { who: 'Mostly people outside the United States. It reaches most readers here only indirectly.', where: 'what the United States does abroad' },
  'Labor and Employment': { who: 'People at work, and the people who employ them.', where: 'your job, your hours and your pay' },
  'Law': { who: 'Anyone who ends up in a court case.', where: 'how a case is handled' },
  'Native Americans': { who: 'People in tribal nations, and their neighbours.', where: 'tribal land, services and rights' },
  'Public Lands and Natural Resources': { who: 'People who use public land, and people who live beside it.', where: 'what may be done on that land' },
  'Science, Technology, Communications': { who: 'Anyone who uses a phone, the internet, or a connected device.', where: 'the services and devices you use' },
  'Social Welfare': { who: 'People who rely on a federal payment or programme.', where: 'what you can claim' },
  'Sports and Recreation': { who: 'People who play or watch sport.', where: 'how a sport is run' },
  'Taxation': { who: 'Anyone who files a tax return.', where: 'your tax return' },
  'Transportation and Public Works': { who: 'Anyone who travels, by any means.', where: 'getting around' },
  'Water Resources Development': { who: 'People who depend on a river, a dam or a water supply.', where: 'your water supply' },
};

/**
 * Last resort: the statute a title says it amends.
 *
 * 154 bills in this dataset carry NO policy area and NO subject terms — the
 * Library of Congress has not got to them yet — and for those the two tables
 * above have nothing to work with. But a title that says it amends "title XVIII
 * of the Social Security Act" has told us the answer already: that title IS
 * Medicare. Reading the statute reference is not a guess about what the bill
 * does, which is why this is allowed to set the audience while rule 4 still
 * forbids describing the bill itself from its title.
 *
 * Only statutes whose subject is unambiguous are listed. A reference to "title
 * 5, United States Code" could be almost anything and is not here.
 */
export const TITLE_STATUTE_AUDIENCES: { match: RegExp; who: string; where: string }[] = [
  { match: /title XVIII of the Social Security Act|\bMedicare\b/i, who: 'People on Medicare.', where: 'what Medicare pays for' },
  { match: /title XIX of the Social Security Act|\bMedicaid\b/i, who: 'People on Medicaid.', where: 'what Medicaid pays for' },
  { match: /title XXI of the Social Security Act|Children's Health Insurance/i, who: 'Families whose children are on CHIP.', where: "your children's cover" },
  { match: /Internal Revenue Code|\bincome tax\b/i, who: 'Anyone who files a tax return.', where: 'your tax return' },
  { match: /Elementary and Secondary Education Act/i, who: 'School districts, and children in them.', where: 'your local school' },
  { match: /Higher Education Act/i, who: 'College students, and their families.', where: 'college costs and rules' },
  { match: /Public Health Service Act/i, who: 'Anyone who uses a clinic or a public health service.', where: 'getting care' },
  { match: /Federal Food, Drug, and Cosmetic Act/i, who: 'Anyone who takes a medicine or buys food.', where: 'what may be sold to you' },
  { match: /Controlled Substances Act/i, who: 'People caught up in the drug laws, and patients who need those drugs.', where: 'what is legal, and who may prescribe it' },
  { match: /title 38, United States Code|\bveterans?\b/i, who: 'Veterans and their families.', where: 'what the VA does for you' },
  { match: /Immigration and Nationality Act/i, who: 'People applying to live here, and their families here.', where: 'an application, and how long it takes' },
  { match: /Clean Air Act/i, who: 'People living near a road, a plant or a port.', where: 'the air where you live' },
  { match: /(Clean Water Act|Federal Water Pollution Control Act|Safe Drinking Water Act)/i, who: 'Anyone who drinks tap water.', where: 'what comes out of the tap' },
  { match: /Fair Labor Standards Act/i, who: 'People paid by the hour.', where: 'your hours and your pay' },
  { match: /(Truth in Lending Act|Fair Credit Reporting Act)/i, who: 'Anyone with a loan or a credit card.', where: 'what credit costs you' },
];

// ---------------------------------------------------------------------------
// The fixed framing sentences
// ---------------------------------------------------------------------------

/**
 * Every sentence this module can emit that is not derived from CRS text.
 *
 * They live in one exported object for the same reason the disclaimers do: so a
 * UI can never write its own version, and so a test can hold all of them to the
 * reading-level and no-assertion rules at once. Nothing here evaluates a bill,
 * and nothing here is written in a mood that says something has happened.
 */
export const PLAIN_BILL_FRAMING = {
  /** Rule 4. The whole of `whatItDoes` when there is no summary to work from. */
  titleOnly:
    'No one has written a summary of this bill yet. All we have is its title, and a title is not a description of a law. To find out what it does, you have to open the bill itself.',
  /** Rule 5 — ceremonial measures, reusing the detector in policy-areas.ts. */
  ceremonial:
    'This is a tribute or a commemoration. It does not change any law.',
  /** The naming-bill variant of the same. */
  ceremonialNaming:
    'This puts a name on a building or a place. It does not change any law.',
  /**
   * The third ceremonial kind, and the largest: Congress running itself.
   * Lumping these in with tributes was wrong — a resolution electing members to
   * the Budget Committee is not a commemoration, and telling a reader it was one
   * is a plain factual error in the sentence they trust most.
   */
  ceremonialProcedural:
    'This is Congress running its own house. It sets a rule, a seat or a date for Congress itself. It does not change any law.',
  /** Prefix for the restated title. Says what the words are, so they are not read as a summary. */
  titleRestatementLead: 'Its title, in plainer words:',
  /** Nothing has happened yet — attached to every conditional effect sentence. */
  notLawYet: 'Nothing has changed yet.',
  becomesLawOdds: 'Most bills never become law.',
  neverBecomesLaw: 'This kind of resolution does not become law, even if it passes.',
  unknownEffect:
    'The title alone does not say what would change for you, and this tool will not guess.',
  ceremonialEffect: 'Nothing changes for you. No rule and no payment changes.',
  audienceUnknown:
    'We cannot tell from the labels on this bill who it reaches. The subject is too broad to say.',
  /** `source`, per confidence tier. */
  sourceCrs:
    'Reworded from the official summary. Staff at the Congressional Research Service wrote that summary. It is public domain, and the full text of it is further down this page.',
  sourceTitleOnly:
    'From the bill title, and from the subject labels that library staff put on it. There is no official summary of this bill yet.',
  sourceCeremonial:
    'From the bill title, and from the subject labels that library staff put on it.',
} as const;

// ---------------------------------------------------------------------------
// The public shape
// ---------------------------------------------------------------------------

/** How much this module actually knows about a bill. The UI must show this. */
export type PlainConfidence = 'crs-summary' | 'title-only' | 'ceremonial';

export interface PlainBillInput {
  title: string;
  billType: string;
  policyArea?: string | null;
  subjects?: string[];
  /** The CRS summary, when Congress.gov has published one. */
  officialSummary?: string | null;
}

export interface PlainBill {
  /** One or two short sentences. Conditional, never an assertion of effect. */
  whatItDoes: string;
  /** Which ordinary people this reaches. Never who profits. */
  whoItTouches: string;
  /** What would change for them, hedged by what is knowable. */
  everydayEffect: string;
  confidence: PlainConfidence;
  /** Where the words came from, for display next to them. */
  source: string;
  /**
   * The bill's OWN title with the boilerplate taken out — offered separately,
   * and labelled as the title, precisely so it is never mistaken for a summary.
   * Null when trimming produced nothing a reader would gain from.
   */
  titleInPlainWords: string | null;
}

// ---------------------------------------------------------------------------
// Text machinery
// ---------------------------------------------------------------------------

/** Collapses the whitespace CRS text arrives with, including hard line breaks. */
function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Applies the rewrite table, then repairs the seams.
 *
 * Deleting a phrase mid-sentence leaves doubled spaces and orphaned commas, and
 * a reader notices that before they notice anything else on the page.
 */
export function simplifyLegalProse(input: string): string {
  let out = tidy(input);
  for (const r of PROSE_REWRITES) out = out.replace(r.from, r.to);
  const repaired = tidy(
    out
      // An acronym gloss immediately after the name it glosses is dead weight
      // once the name has been replaced — "(CMS)", "(BLM)", "(RMP)". Restricted
      // to a single all-caps token so a parenthetical carrying real content,
      // like "(1) requiring annual open enrolment", is never touched.
      .replace(/\s*\(([A-Z][A-Za-z0-9.&']{1,12})\)/g, '')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .replace(/,\s*\./g, '.'),
  );
  // Deleting ", and for other purposes." takes the full stop with it, and a
  // sentence with no end reads like truncated data — which on this page would
  // make a reader wonder what else got cut.
  return /[.!?]$/.test(input.trim()) && !/[.!?]$/.test(repaired) ? `${repaired}.` : repaired;
}

/** Abbreviations that end in a period and must not end a sentence. */
const ABBREV = /(?:\b[A-Z]|U\.S|e\.g|i\.e|No|Nos|Inc|Corp|Co|Sec|Secs|Cal|Fed|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs|etc|approx|Art|Div|Pub|Stat)\.$/;

/** Splits prose into sentences without breaking on "U.S." or "No. 5". */
export function splitSentences(text: string): string[] {
  const parts = tidy(text).split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev !== undefined && ABBREV.test(prev)) out[out.length - 1] = `${prev} ${part}`;
    else out.push(part);
  }
  return out.filter(Boolean);
}

/**
 * Removes the short-title restatement CRS opens with.
 *
 * The convention is exact and worth exploiting: a summary begins with the
 * bill's short title — sometimes twice, "Support And Value Expectant Moms and
 * Babies Act of 2025 or the SAVE Moms and Babies Act of 2025" — and then starts
 * the real sentence with "This bill". For a reader who is looking at the title
 * at the top of the page, that opening is not just useless, it is the exact
 * noise that made the old summary field worthless.
 *
 * 464 of the 466 summaries in this dataset carry the anchor. The two that do
 * not are returned untouched, because guessing where a title ends without one
 * would risk cutting the first operative clause off.
 */
export function stripTitleRestatement(summary: string): string {
  const s = tidy(summary);
  const anchor = /\b(?:This|The)\s+(?:bill|Act|act|joint resolution|concurrent resolution|resolution|measure|amendment)\b/.exec(
    s.slice(0, 700),
  );
  if (!anchor || anchor.index === 0) return s;
  return s.slice(anchor.index).trim();
}

/**
 * Turns a CRS present-tense sentence into the conditional mood (rule 1).
 *
 * "This bill requires the FDA to…" becomes "This bill would require the FDA
 * to…". The subject is kept — CRS's own "This bill" / "This joint resolution" —
 * because replacing it with "it" costs the reader the antecedent, and the
 * measure kind is information.
 *
 * When the verb is not in the closed table the sentence is NOT conjugated by
 * rule. It is attributed instead: "The official summary says: …". That is
 * honest — a description of a document rather than of the world — and it cannot
 * produce "this bill ha the effect of".
 */
export function conditionalise(sentence: string): string {
  const m = /^((?:This|The)\s+(?:bill|Act|act|joint resolution|concurrent resolution|resolution|measure|amendment))\s+((?:\w+ly)\s+)?([a-z]+)\b/.exec(
    sentence,
  );
  if (m) {
    const [, subject, adverb, verb] = m;
    const replacement = OPERATIVE_VERBS[verb!.toLowerCase()];
    if (replacement) {
      const rest = coordinateVerbs(sentence.slice(m[0].length));
      // "This act" reads oddly for a bill that is not an act yet; CRS uses it
      // for measures already enacted elsewhere in the corpus. Normalise the
      // noun to the neutral "measure" only when the source said "act", so the
      // page never calls an unpassed bill an act.
      const noun = /\bacts?$/i.test(subject!) ? 'This measure' : subject!;
      return `${noun} ${adverb ? `${adverb.trim()} ` : ''}${replacement}${rest}`;
    }
  }
  return `The official summary says: ${sentence}`;
}

/**
 * The SECOND verb in a compound predicate, which the first rewrite misses.
 *
 * "This bill extends and modifies the Act" became "This bill would extend and
 * modifies the Act" — a present-tense assertion smuggled into a conditional
 * sentence, which is precisely what rule 1 forbids, sitting where it is hardest
 * to notice. Once the leading verb is under "would", every verb coordinated
 * with it shares that modal and has to be a bare infinitive.
 *
 * Only coordinate positions are touched (" and provides", "; and requires"),
 * because those are the only slots where a third-person verb is guaranteed to
 * share the subject of the first one.
 */
/**
 * Verbs of tribute and of internal housekeeping.
 *
 * A measure whose CRS summary begins with one of these does not change a rule
 * anybody lives under: it states a position, marks an occasion, or fills a
 * committee seat. Any other operative verb means the measure does something, and
 * is used above to overrule a subject-term-based ceremonial flag.
 */
const CEREMONIAL_OPERATIVE_VERBS = new Set([
  'expresses', 'supports', 'recognizes', 'condemns', 'honors', 'congratulates',
  'commemorates', 'mourns', 'calls', 'urges', 'demands', 'reaffirms', 'declares',
  'elects', 'dismisses', 'requests', 'states', 'commends', 'encourages',
]);

/** The verb CRS put immediately after "This bill" / "This resolution". */
export function operativeVerbOf(summaryBody: string): string | null {
  const m = /^(?:This|The)\s+(?:bill|Act|act|joint resolution|concurrent resolution|resolution|measure|amendment)\s+(?:\w+ly\s+)?([a-z]+)\b/.exec(
    tidy(summaryBody),
  );
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * The bare forms of every verb in the table ("change", "set", "get"), used to
 * recognise a coordinated verb after `conditionalise` has already stripped its
 * modal. First word only, because several rewrites are phrasal ("get rid of").
 */
const BARE_OPERATIVE_VERBS = new Set(
  Object.values(OPERATIVE_VERBS).map((v) => v.replace(/^would\s+/, '').split(' ')[0]!),
);

function coordinateVerbs(rest: string): string {
  return rest.replace(/([,;]?\s+and\s+)([a-z]+)\b/g, (whole, joiner: string, verb: string) => {
    const mapped = OPERATIVE_VERBS[verb.toLowerCase()];
    if (!mapped) return whole;
    return `${joiner}${mapped.replace(/^would\s+/, '')}`;
  });
}

/**
 * Splits one over-long sentence in two at a clause boundary.
 *
 * Reading grade is driven as hard by words-per-sentence as by syllables, and
 * CRS operative sentences run to 40 words. Splitting keeps every clause —
 * nothing is dropped — which matters because the clauses CRS puts after a
 * semicolon or an "and" are often the conditions ("unless Congress
 * authorises…") that change what the provision means. Truncating there would
 * change the law; splitting there does not.
 */
function splitLongSentence(sentence: string): string {
  if (sentence.split(' ').length <= 26) return sentence;

  // A split is only attempted where the text after the boundary can be given a
  // subject WITHOUT guessing at grammar. Two cases qualify:
  //
  //   ", and <verb in the table>"  → "It would also <verb>…"
  //   ", including <noun phrase>"  → "That includes <noun phrase>…"
  //
  // Everything else is left as one long sentence on purpose. An earlier version
  // split on any ", and " and produced "It would also cover and (2) regulate
  // and enact public campaign financing systems", which is not English and
  // implies the measure "covers" something it in fact does. A long sentence a
  // reader has to work at beats a short one that is wrong.
  const andVerb = /,\s+and\s+([a-z]+)\b/.exec(sentence);
  if (andVerb && andVerb.index >= 40 && BARE_OPERATIVE_VERBS.has(andVerb[1]!.toLowerCase())) {
    // `conditionalise` has already put the coordinated verb in its bare form, so
    // it only needs the modal back: "…, and change X" → "…. It would also
    // change X".
    const head = sentence.slice(0, andVerb.index);
    const tail = sentence.slice(andVerb.index + andVerb[0].length - andVerb[1]!.length);
    return `${head}. It would also ${tail}`.replace(/\s+/g, ' ').replace(/\.?$/, '.');
  }
  // "including by extending payments…" must not become "That includes by
  // extending payments…", so the gerund-after-"by" form is excluded rather than
  // patched: it is a continuation of HOW, not a list of WHAT.
  const including = /,\s+including\s+(?!by\b)(?=[a-z(])/.exec(sentence);
  if (including && including.index >= 40) {
    const head = sentence.slice(0, including.index);
    const tail = sentence.slice(including.index + including[0].length);
    return `${head}. That includes ${tail}`.replace(/\.?$/, '.');
  }
  return sentence;
}

// ---------------------------------------------------------------------------
// Reading level
// ---------------------------------------------------------------------------

/** Vowel-group syllable count. Crude, standard, and good enough for a grade. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Flesch–Kincaid grade level.
 *
 * Here because reading level is not a nice-to-have on this feature, it IS the
 * feature: a grade-14 paraphrase of a grade-16 statute has not helped anybody.
 * Exported so the tests can hold the fixed framing sentences to a number rather
 * than to a vibe.
 */
export function fleschKincaidGrade(text: string): number {
  const sentences = splitSentences(text).length || 1;
  const words = tidy(text).split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return 0;
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

// ---------------------------------------------------------------------------
// The audience sentence
// ---------------------------------------------------------------------------

function audienceFor(input: PlainBillInput): { who: string; where: string | null } {
  const subjects = (input.subjects ?? []).map((s) => s.toLowerCase());

  /**
   * An omnibus has no audience its subject terms can find.
   *
   * The National Defense Authorization Act carries over a hundred subject terms,
   * because it touches everything the Defense Department does — including
   * military pharmacies, so it matches "drug safety" and came out reading
   * "Anyone who takes a medicine. Anyone who buys health insurance." for the
   * largest defence bill in the country. On a list that long the first match is
   * an artefact of the order of the table below, not a fact about the bill, so
   * the single CRS policy area — "Armed Forces and National Security" — is the
   * more honest answer and the one used instead.
   */
  const isOmnibus = subjects.length > 25;

  const hits: AudienceRule[] = [];
  if (!isOmnibus) for (const rule of SUBJECT_AUDIENCES) {
    // Two different subject terms can map to the same audience — "farm" and
    // "agricultural price" both reach farmers — and printing that audience
    // twice ("Farmers, and anyone who buys food. Farmers, and anyone who buys
    // food.") reads as a bug and undermines every other sentence on the page.
    if (subjects.some((s) => s.includes(rule.match)) && !hits.some((h) => h.who === rule.who)) hits.push(rule);
    if (hits.length === 2) break;
  }
  if (hits.length > 0) {
    // Two audiences are joined rather than merged, because a bill about
    // Medicare AND wheelchairs reaches the intersection the reader cares about
    // ("People on Medicare who use a wheelchair") only if both are on screen.
    const who = hits.map((h) => h.who).join(' ');
    return { who, where: hits[0]!.where };
  }
  const area = input.policyArea ? POLICY_AREA_AUDIENCES[input.policyArea] : undefined;
  if (area) return { who: area.who, where: area.where };
  // Nothing from the librarians. Read the statute the title names.
  for (const hint of TITLE_STATUTE_AUDIENCES) {
    if (hint.match.test(input.title ?? '')) return { who: hint.who, where: hint.where };
  }
  return { who: PLAIN_BILL_FRAMING.audienceUnknown, where: null };
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/**
 * The whole feature, as one pure function.
 *
 * Same bill in, same four sentences out, every time, with no key and no network
 * — which is the only way this could be part of `npm run pipeline` for a
 * reader who cloned the repo and has no LLM account.
 */
export function explainBillPlainly(input: PlainBillInput): PlainBill {
  const title = tidy(input.title ?? '');
  const measure = measureType(input.billType);
  const trimmedTitle = trimTitle(title);

  // A summary shorter than this is a stub — "Sets forth policies." — and
  // rewording a stub produces a sentence that sounds like knowledge and is not.
  const summary = tidy(input.officialSummary ?? '');
  const hasSummary = summary.length > 50;
  const body = hasSummary ? stripTitleRestatement(summary) : '';

  const ceremonial = isCeremonialMeasure(title, input.billType, input.policyArea ?? null, input.subjects ?? []);

  /**
   * Two ways the shared ceremonial detector is wrong for THIS purpose, both
   * found by reading its output over all 1,478 bills.
   *
   * `isCeremonialMeasure` is deliberately over-inclusive, and it is right to be:
   * its job is to stop a condolence resolution being tagged with a donor sector,
   * where a false positive costs a score and a false negative defames someone.
   * Here the asymmetry runs the other way. A false positive prints "This does
   * not change any law" on a law, which is not a missing feature, it is a false
   * statement about the law in the sentence the reader trusts most. So this
   * module overrides it in exactly two cases and nowhere else:
   *
   *  1. CONGRESSIONAL REVIEW ACT RESOLUTIONS. policy-areas.ts already intends to
   *     exempt these — its comment says so — but the exemption tests for
   *     "congressional disapproval of the rule", and every one of the 44 in this
   *     dataset is titled "congressional disapproval UNDER CHAPTER 8 OF TITLE 5,
   *     UNITED STATES CODE, of the rule…", so the words do not sit together and
   *     the exemption never fires. The following procedural pattern then catches
   *     them. These measures repeal federal rules — opening coal leasing on
   *     1.7 million acres, in one case here — and are the opposite of
   *     housekeeping. The detector itself is left alone: changing it would move
   *     every sector tag and overlap score in the bundle, which is not this
   *     change's business.
   *
   *  2. A SUBSTANTIVE MEASURE CARRYING A COMMEMORATIVE SUBJECT TERM. The
   *     National Defense Authorization Act for Fiscal Year 2026 is flagged
   *     ceremonial because it contains medal provisions, so the Library of
   *     Congress gave it the subject "Awards and medals". CRS's own summary
   *     opens "This bill sets out policies and authorities for FY2026 for
   *     Department of Defense programs" — the summary's operative verb is a far
   *     better witness than a subject term, so where a summary exists and its
   *     verb is substantive rather than a verb of tribute, the summary wins.
   */
  const craDisapproval = /\bcongressional disapproval\b/i.test(title);
  const naming = /\b(post office|postal service|facility|building|courthouse|clinic|memorial|redesignate|naming)\b/i.test(title);
  const verb = hasSummary ? operativeVerbOf(body) : null;
  // Override (2) is deliberately confined to the SUBJECT-TERM path, which is the
  // only one that misfires this way. It must not reach the procedural path: a
  // special rule — "This resolution provides for consideration of H.R. 7567" —
  // has a substantive-looking verb and is still nothing but the terms of floor
  // debate, and an earlier version of this check promoted 8 of them into "what
  // this bill does" before that showed up in a full-corpus diff.
  const flaggedBySubjectTerm = /labels as a congressional tribute or commemoration/i.test(ceremonial.reason ?? '');
  const summarySaysSubstantive =
    flaggedBySubjectTerm && verb !== null && !CEREMONIAL_OPERATIVE_VERBS.has(verb) && !naming;

  // --- ceremonial: say so and stop (rule 5) --------------------------------
  if (ceremonial.ceremonial && !craDisapproval && !summarySaysSubstantive) {
    // `isCeremonialMeasure` already distinguishes these three; it would be a
    // waste of its work — and a factual error in the output — to flatten them.
    const procedural = /internal procedural measure|operation of Congress/i.test(ceremonial.reason ?? '');
    const kind = naming ? 'naming' : procedural ? 'procedural' : 'tribute';
    return {
      whatItDoes:
        kind === 'naming' ? PLAIN_BILL_FRAMING.ceremonialNaming
          : kind === 'procedural' ? PLAIN_BILL_FRAMING.ceremonialProcedural
          : PLAIN_BILL_FRAMING.ceremonial,
      whoItTouches:
        kind === 'naming' ? 'Nobody directly — this renames a building or a place.'
          : kind === 'procedural' ? 'Nobody directly — this is Congress handling its own affairs.'
          : 'Nobody directly — this is a statement, not a rule.',
      everydayEffect: PLAIN_BILL_FRAMING.ceremonialEffect,
      confidence: 'ceremonial',
      source: PLAIN_BILL_FRAMING.sourceCeremonial,
      titleInPlainWords: null,
    };
  }

  const { who, where } = audienceFor(input);

  // --- the honest gap: two thirds of the dataset (rule 4) ------------------
  if (!hasSummary) {
    return {
      whatItDoes: PLAIN_BILL_FRAMING.titleOnly,
      whoItTouches: who,
      everydayEffect: [
        PLAIN_BILL_FRAMING.notLawYet,
        PLAIN_BILL_FRAMING.unknownEffect,
        measure.becomesLaw ? PLAIN_BILL_FRAMING.becomesLawOdds : PLAIN_BILL_FRAMING.neverBecomesLaw,
      ].join(' '),
      confidence: 'title-only',
      source: PLAIN_BILL_FRAMING.sourceTitleOnly,
      titleInPlainWords: trimmedTitle,
    };
  }

  // --- the good case: there is a CRS summary -------------------------------
  const first = splitSentences(body)[0] ?? body;
  const whatItDoes = splitLongSentence(conditionalise(simplifyLegalProse(first)));

  const effect = where
    ? `If it passed, the change would show up in ${where}.`
    : 'If it passed, what changed would depend on how the agency wrote the rules.';

  return {
    whatItDoes,
    whoItTouches: who,
    everydayEffect: [
      effect,
      PLAIN_BILL_FRAMING.notLawYet,
      measure.becomesLaw ? PLAIN_BILL_FRAMING.becomesLawOdds : PLAIN_BILL_FRAMING.neverBecomesLaw,
    ].join(' '),
    confidence: 'crs-summary',
    source: PLAIN_BILL_FRAMING.sourceCrs,
    titleInPlainWords: null,
  };
}

/**
 * The bill's title with the boilerplate taken out.
 *
 * This is NOT a summary and is never labelled as one — that conflation is the
 * bug this whole module exists to fix. It is offered on title-only bills, under
 * `PLAIN_BILL_FRAMING.titleRestatementLead`, because "To amend title XVIII of
 * the Social Security Act to ensure appropriate payments for ambulance services
 * under the Medicare program, and for other purposes" and "would change
 * Medicare rules so that payments for ambulance services are set differently"
 * are the same words, and only one of them can be read by the person the law
 * applies to.
 *
 * Returns null when the trimming changed nothing worth a second line.
 */
export function trimTitle(title: string): string | null {
  if (!title) return null;
  // The rewrite table runs FIRST, while the leading "To amend title XVIII of
  // the Social Security Act to…" is still intact — that phrase is only
  // recognisable in one piece.
  const simplified = simplifyLegalProse(title).replace(/\.$/, '');

  // A federal bill title is an infinitive phrase: "To require the Secretary
  // to…". Swapping "To" for "Would" turns it into a conditional sentence with
  // no other surgery, which is the only transformation here that cannot change
  // what the words claim: the verb, its object and every qualifier are
  // untouched. Titles not in that form (a bare short title like "GOSAFE Act",
  // or "Providing for congressional disapproval of…") are left as they are.
  const infinitive =
    /^To\s+(.+)$/i.exec(simplified) ??
    /^A\s+(?:bill|joint resolution|resolution|concurrent resolution)\s+to\s+(.+)$/i.exec(simplified);

  let out: string;
  if (infinitive) {
    out = `Would ${infinitive[1]!.replace(/^amend\b/i, 'change')}`;
  } else if (simplified !== tidy(title).replace(/\.$/, '')) {
    // Not an infinitive, but the table removed boilerplate. Worth showing.
    out = simplified;
  } else {
    return null;
  }

  if (out.length < 16) return null;
  return `${out.charAt(0).toUpperCase()}${out.slice(1)}.`;
}
