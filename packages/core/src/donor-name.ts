/**
 * DONOR DISPLAY NAMES — turning a filed legal name into one a person reads.
 *
 * ---------------------------------------------------------------------------
 * WHY
 *
 * A first-time reader was given her own congressman's page and found exactly one
 * thing on it that meant anything to her: the list of who actually gave him
 * money. Regions Financial. Alabama Power. Drummond Company. Names she
 * recognised from her own state. Her words: "that's the only moment on the whole
 * site where something clicked."
 *
 * The site was showing her that list four expanders deep, behind "Show all 41
 * rows", underneath three abstract sector labels that covered 15% of the money.
 * It led with the abstraction and hid the concrete thing it actually knew.
 *
 * It was also shouting. The filed name is
 * `REGIONS FINANCIAL CORPORATION POLITICAL ACTION COMMITTEE`. Every row looked
 * like that, so the list read as machine exhaust rather than a list of
 * companies, and the recognisable part was buried in boilerplate.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE THAT MATTERS: NEVER CHANGE WHO IT IS
 *
 * Shortening a donor's name is the single easiest way for this project to
 * misattribute money to the wrong entity, and it would do it silently and at
 * scale. So:
 *
 *  1. Only ever REMOVE tokens that describe the vehicle rather than the entity
 *     — "political action committee", "PAC", "Inc.", a trailing acronym in
 *     brackets. Never substitute a different word, never expand an
 *     abbreviation, never guess a parent company.
 *  2. If removing everything leaves nothing, keep the original. A row reading
 *     "PAC" is useless; a row reading nothing is a bug.
 *  3. The full filed name travels with every shortened one — see
 *     `DonorDisplayName.filed`. The UI must expose it (title attribute at
 *     minimum) so a reader can always see what the filing actually said, and so
 *     nobody has to trust this function to check a figure.
 *  4. Casing is cosmetic and reversible. Acronyms stay uppercase; a token that
 *     is all consonants or a known initialism is not title-cased into nonsense
 *     ("NRA" must not become "Nra").
 *
 * This is deliberately dumb. A cleverer version — stripping "Holdings", mapping
 * subsidiaries to parents, resolving "AT&T Inc." and "AT&T Services" to one
 * entity — would be more readable and would start making claims about corporate
 * structure that no field in this dataset supports.
 * ---------------------------------------------------------------------------
 */

export interface DonorDisplayName {
  /** What to show. Never empty. */
  display: string;
  /** Exactly what the filing said. Always carried, always exposable. */
  filed: string;
  /** True when `display` differs from `filed`, so the UI can offer the original. */
  shortened: boolean;
}

/**
 * Tokens that describe the *vehicle* rather than the donor, stripped one at a
 * time from the END of the name until a real word is reached.
 *
 * Token-at-a-time rather than phrase regexes, because the phrases combine in
 * more orders than can be enumerated. The first version of this used anchored
 * phrase patterns and produced "The Boeing" (it ate COMPANY), "AT&T Inc.
 * Federal" (it ate the committee words and left the qualifier), and left
 * "ALABAMA POWER CO EMPLOYEES FEDERAL POLITICAL ACTION CMTE" untouched because
 * CMTE was not in the list. Stripping tokens from the end handles all three and
 * every future permutation of the same vocabulary.
 *
 * Every token here describes a fundraising vehicle or a corporate form. None of
 * them identifies an entity, which is what makes removing them safe.
 */
const NOISE_TOKENS = new Set([
  // fundraising vehicle
  'pac', 'political', 'action', 'committee', 'cmte', 'cmte.', 'comm', 'fund',
  'federal', 'employees', 'employees’', "employees'", 'employee', 'voluntary',
  'victory', 'good', 'government', 'nonpartisan', 'non-partisan', 'assn',
  // corporate form
  'inc', 'inc.', 'incorporated', 'llc', 'l.l.c.', 'corp', 'corp.', 'corporation',
  'co', 'co.', 'company', 'ltd', 'ltd.', 'plc', 'lp', 'l.p.', 'pllc', 'pc',
  'holdings', 'group',
]);

/**
 * A trailing bracketed acronym, e.g. "… POLITICAL ACTION COMMITTEE (ABC PAC)".
 * It is a restatement of the name in short form, so it is redundant once the
 * name is shown — but only when it looks like an acronym. A bracketed phrase
 * that carries real information ("(Alabama)") is kept.
 */
const TRAILING_ACRONYM = /\s*\(\s*[A-Z0-9][A-Z0-9\s.&'-]{0,24}\s*\)\s*$/;

/**
 * Tokens that must never be title-cased.
 *
 * Not an exhaustive list of acronyms — it does not need to be, because the
 * heuristic below already leaves short vowel-less tokens alone. These are the
 * ones that would otherwise slip through and look wrong.
 */
const KEEP_UPPER = new Set([
  'PAC', 'USA', 'US', 'UAW', 'NRA', 'AFL', 'CIO', 'AFL-CIO', 'IBEW', 'NEA', 'AFT',
  'AT&T', 'UPS', 'IBM', 'GE', '3M', 'CSX', 'BNSF', 'HCA', 'CVS', 'UBS', 'KPMG',
  'PWC', 'EY', 'NAR', 'ABA', 'AMA', 'ADA', 'AIPAC', 'NAACP', 'LGBTQ', 'II', 'III',
  'USAA', 'AFLAC', 'AECOM', 'NASA', 'AT&T', 'HCA', 'AIG', 'ICG', 'BASF', 'BAE',
  'DPAC', 'ABC', 'NFIB', 'BNP', 'TIAA', 'AARP', 'AFSCME', 'SEIU', 'NRECA', 'NAHB',
]);

/** Words that stay lowercase inside a name, unless they lead it. */
const MINOR = new Set(['and', 'of', 'the', 'for', 'de', 'la', 'von', 'van', 'a', 'an', 'in', 'on']);

/**
 * Short, real words that appear in company names and must be title-cased rather
 * than shouted.
 *
 * The vowel-free rule below catches most initialisms (CSX, NRA, LLC) but misses
 * any with a vowel in them — "ICG" came out as "Icg". Loosening the rule to "any
 * short all-caps token is an acronym" fixes ICG and breaks "AIR PRODUCTS" into
 * "AIR Products", because every FEC filing is upper case so every short word
 * looks like an initialism. This stoplist is the narrow part: short words that
 * are genuinely words when they turn up in an employer name.
 */
const SHORT_REAL_WORDS = new Set([
  'AIR', 'OIL', 'GAS', 'SUN', 'SEA', 'BAY', 'KEY', 'ONE', 'ALL', 'PRO', 'TOP',
  'NEW', 'RED', 'BIG', 'CAR', 'JET', 'EYE', 'ARM', 'ICE', 'LAW', 'TAX', 'AID',
  'ART', 'OAK', 'ELM', 'FOX', 'OWL', 'BOX', 'CUP', 'NET', 'WEB', 'BIO', 'ECO',
  'AGE', 'ERA', 'INN', 'SPA', 'GYM', 'TOY', 'SKY', 'ROW', 'WAY', 'END', 'OAKS',
  'BANK', 'FOOD', 'HOME', 'AUTO', 'LIFE', 'CARE', 'FARM', 'GOLD', 'IRON', 'COAL',
  'WOOD', 'STAR', 'BLUE', 'GOOD', 'BEST', 'FIRE', 'ROCK', 'HILL', 'LAKE', 'PARK',
  'EAST', 'WEST', 'MAIN', 'PLUS', 'DATA', 'TECH', 'WORK', 'TRUE', 'PURE', 'REAL',
]);

function looksLikeAcronym(token: string): boolean {
  const bare = token.replace(/[^A-Za-z0-9&.-]/g, '');
  if (bare.length === 0) return false;
  if (KEEP_UPPER.has(bare.toUpperCase())) return true;
  // Hyphenated all-caps with no long word part — "UAW-V-CAP", "AFL-CIO". Without
  // this, title-casing turned UAW-V-CAP into "Uaw-V-Cap".
  if (bare.includes('-') && bare === bare.toUpperCase()
    && bare.split('-').every((p) => p.length <= 4 && p.length > 0)) return true;
  const allCaps = bare === bare.toUpperCase() && /^[A-Z0-9&.]+$/.test(bare);
  // Vowel-free and short is unambiguous: "CSX", "NRA", "LLC", "BNSF".
  if (allCaps && bare.length <= 4 && !/[AEIOUY]/.test(bare)) return true;
  // With a vowel, only three letters or fewer, and only when it is not a real
  // short word. Every FEC filing is upper case, so a longer allowance turns
  // "GOLD BOND" into "Gold BOND" and "AIR PRODUCTS AND CHEMICALS" into
  // "Air Products AND Chemicals" — the stoplist cannot keep up with four-letter
  // English, so the rule is narrowed rather than the list grown.
  if (allCaps && bare.length <= 3 && !SHORT_REAL_WORDS.has(bare)) return true;
  // Contains a period between letters — "U.S.", "L.P."
  if (/^([A-Za-z]\.){2,}$/.test(bare)) return true;
  return false;
}

function titleCaseToken(token: string, isFirst: boolean): string {
  const lower = token.toLowerCase();
  // Joining words are checked BEFORE the acronym heuristic. "AND" is three
  // letters and all caps, so the heuristic claimed it and produced
  // "Air Products AND Chemicals".
  if (!isFirst && MINOR.has(lower.replace(/[^a-z]/g, ''))) return lower;
  if (looksLikeAcronym(token)) return token.toUpperCase();
  // Hyphenated and slashed compounds get each part capitalised.
  return lower.replace(/(^|[-/'’])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Title-case a filed name that is (as FEC filings are) entirely upper case.
 *
 * A name that is NOT all-caps in the filing is left alone: somebody already
 * chose its casing and this function has no better information than they did.
 */
function humanCase(name: string): string {
  const hasLower = /[a-z]/.test(name);
  if (hasLower) return name;
  return name
    .split(/(\s+)/)
    .map((part, i) => (/^\s+$/.test(part) ? part : titleCaseToken(part, i === 0)))
    .join('');
}

/**
 * The aggregate row the export builds for money whose filings name no employer.
 *
 * It is not a donor and must never be shortened, title-cased, or shown in a list
 * headed "who gave the most" — it is a statement about missing data, and it
 * belongs next to the explanation of that gap. Callers use this to exclude it.
 */
export function isNoEmployerAggregate(name: string): boolean {
  return /^no employer listed on the filing/i.test(name.trim());
}

export function donorDisplayName(filed: string): DonorDisplayName {
  const original = (filed ?? '').trim();
  if (!original) return { display: '', filed: '', shortened: false };
  if (isNoEmployerAggregate(original)) {
    return { display: original, filed: original, shortened: false };
  }

  let s = original;

  // Bracketed acronym first: it usually sits after the vehicle words, so
  // removing it exposes them to the token stripping below.
  const withoutAcronym = s.replace(TRAILING_ACRONYM, '');
  if (withoutAcronym.trim().length >= 3) s = withoutAcronym;

  // A "WATERPAC - National Rural Water Association" style prefix: the committee's
  // own short name, restated before the organisation it belongs to. The
  // organisation is the identifying half, so the prefix goes.
  s = s.replace(/^\s*[A-Za-z]*PAC\s*[-—:]\s*(?=\S)/i, '');

  let tokens = s.split(/\s+/).filter(Boolean);

  // If the name is nothing BUT vehicle words, there is no entity in it to
  // reveal. Stripping would leave a stub — "POLITICAL ACTION COMMITTEE" reduced
  // to "Political", which names nobody and looks like a bug. The filed string is
  // the only honest thing to show.
  const bare = (t: string) => t.replace(/[,;:.]+$/, '').toLowerCase();
  if (tokens.every((t) => NOISE_TOKENS.has(bare(t)) || MINOR.has(bare(t)))) {
    return { display: original, filed: original, shortened: false };
  }

  // Strip vehicle and corporate-form tokens from the end, one at a time, while
  // at least one identifying token would survive.
  while (tokens.length > 1) {
    const last = bare(tokens[tokens.length - 1] as string);
    if (!NOISE_TOKENS.has(last)) break;
    tokens = tokens.slice(0, -1);
  }

  // A leading "The" adds nothing once the corporate form is gone, and its
  // absence is what turns "The Boeing" into "Boeing".
  if (tokens.length > 1 && (tokens[0] as string).toLowerCase() === 'the') tokens = tokens.slice(1);

  s = tokens.join(' ').replace(/[\s,;:.-]+$/, '').trim();

  // If stripping left nothing identifying, the filed name is the honest answer.
  // "PAC" on its own must stay "PAC" rather than becoming empty.
  if (s.length < 3) s = original;

  const display = humanCase(s);
  return {
    display,
    filed: original,
    shortened: display !== original,
  };
}
