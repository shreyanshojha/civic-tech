/**
 * Address → congressional district, using the US Census Bureau geocoder.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY OUTBOUND REQUEST IN THE WHOLE APPLICATION.
 *
 * Everything else this site shows is a static JSON file served from the same
 * origin (see data.ts). This module is the single exception, and it only ever
 * runs when a person types an address and presses a button.
 *
 * Rules this file exists to keep:
 *
 *  1. The user is TOLD BEFORE IT RUNS. `CENSUS_LOOKUP_NOTICE` below is the one
 *     source of truth for that wording and is rendered on screen, next to the
 *     input, not in a tooltip and not after the fact. Do not duplicate or
 *     paraphrase that text in a view.
 *  2. No key, no account, no tracking parameter. The Census geocoder is a free,
 *     keyless, public federal service.
 *  3. The address is never stored, never logged, never put in the URL, and
 *     never sent anywhere else. It exists in a React state variable until the
 *     page is closed.
 *  4. Only the district is kept from the response. Latitude, longitude, census
 *     block and tract come back in the payload and are deliberately discarded.
 *
 * Known limits, surfaced to the user rather than hidden:
 *  - US-only, and street addresses only. The service does not geocode Guam,
 *    American Samoa, the Northern Mariana Islands or the US Virgin Islands, and
 *    coverage of Puerto Rico is patchy — so a delegate's constituent may get no
 *    match at all. Name search is the fallback and always works offline.
 *  - It can take several seconds on a cold cache. Callers must show progress.
 * ---------------------------------------------------------------------------
 */

/** Shown on screen BEFORE the user can run a lookup. Single source of truth. */
export const CENSUS_LOOKUP_NOTICE = {
  headline: 'Your address is sent to the US Census Bureau, and to nothing else.',
  body:
    'If you use this box, the address you type is sent to the US Census Bureau’s public geocoding service (geocoding.geo.census.gov) so it can tell us which congressional district it falls in. It is sent to no other party. This app does not store it, log it, put it in the page address, or attach it to anything you look at afterwards — it stays in your browser until you close the tab. The Census Bureau is a federal agency and operates under its own privacy policy.',
  optOut:
    'You do not have to use this. Searching by name or filtering by state and chamber works without an address and sends nothing anywhere.',
  privacyPolicyUrl: 'https://www.census.gov/about/policies/privacy.html',
  serviceDocsUrl: 'https://geocoding.geo.census.gov/geocoder/',
} as const;

/** State/territory FIPS code → USPS abbreviation. */
export const STATE_FIPS_TO_USPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY',
  // Territories and the federal district. Each is represented in the House by a
  // non-voting delegate or resident commissioner, which is why they appear here.
  '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '74': 'UM', '78': 'VI',
};

/** USPS abbreviation → full name, for readable "we matched you to…" copy. */
export const USPS_TO_STATE_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  AS: 'American Samoa', GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico',
  UM: 'US Minor Outlying Islands', VI: 'US Virgin Islands',
};

/**
 * Census district codes that mean "this place has one House seat, not a
 * numbered district".
 *
 * "00" is a genuine at-large state (WY, VT, DE, AK, ND, SD, MT before 2023…).
 * "98" is the code the Census uses for a delegate district — DC, and the
 * territories. "ZZ" appears for unassigned water area and is not a district.
 *
 * The bundled legislator data stores every one of these as district "0", which
 * is what `district` below normalises to.
 */
const AT_LARGE_CODES = new Set(['00', '98']);
const NON_DISTRICT_CODES = new Set(['ZZ', 'zz']);

export interface DistrictMatch {
  /** The address as the Census Bureau normalised it, so the user can sanity-check it. */
  matchedAddress: string;
  /** USPS abbreviation, e.g. "NY". */
  state: string;
  /** Full state name, e.g. "New York". */
  stateName: string;
  /** Two-digit state FIPS as returned, e.g. "36". */
  stateFips: string;
  /**
   * District as the bundled data stores it: "12", or "0" for at-large seats and
   * delegate districts. Join on `state` + `district`.
   */
  district: string;
  /** The raw Census district code, e.g. "12", "00", "98". */
  districtCode: string;
  /** Human label, e.g. "District 12", "At-large district", "Delegate district (at large)". */
  districtLabel: string;
  /** True for a single-seat state or a delegate district. */
  atLarge: boolean;
  /** True when the seat is a non-voting delegate or resident commissioner. */
  delegate: boolean;
  /** State FIPS + district, e.g. "3612". Straight from the Census response. */
  geoid: string;
  /** Congress the district boundaries belong to, e.g. "119". */
  congress: string | null;
}

export type GeocodeFailure =
  /** The service answered, but no address matched. */
  | 'no-match'
  /** An address matched, but the response carried no congressional district. */
  | 'no-district'
  /** We could not reach the service at all — offline, blocked, or DNS failure. */
  | 'unreachable'
  /** The service answered with an error status or an unparseable body. */
  | 'service-error'
  /** The request took too long and we gave up. */
  | 'timeout'
  /** The user gave us nothing usable to send. */
  | 'empty-input';

export type GeocodeResult =
  | { ok: true; match: DistrictMatch }
  | { ok: false; kind: GeocodeFailure; message: string; hint?: string };

/** Endpoint, isolated so it is greppable and obvious in review. */
export const CENSUS_GEOCODER_ORIGIN = 'https://geocoding.geo.census.gov';

export function censusGeocodeUrl(address: string): string {
  const params = new URLSearchParams({
    address,
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    format: 'json',
  });
  return `${CENSUS_GEOCODER_ORIGIN}/geocoder/geographies/onelineaddress?${params.toString()}`;
}

/**
 * The congressional-district layer is keyed by session — "119th Congressional
 * Districts" today, "120th…" after the next election — so we find it by shape
 * rather than by hard-coding this year's name.
 */
function findDistrictLayer(
  geographies: Record<string, unknown>,
): { rows: Record<string, unknown>[]; congress: string | null } | null {
  for (const [key, value] of Object.entries(geographies)) {
    if (!/congressional district/i.test(key)) continue;
    if (!Array.isArray(value) || value.length === 0) continue;
    const rows = value.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object');
    if (rows.length === 0) continue;
    const fromKey = /(\d+)\w*\s+congressional/i.exec(key)?.[1] ?? null;
    const fromRow = typeof rows[0].CDSESSN === 'string' ? (rows[0].CDSESSN as string) : null;
    return { rows, congress: fromRow ?? fromKey };
  }
  return null;
}

/** The district number lives under a session-suffixed key: CD119, CD118, CD… */
function readDistrictCode(row: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(row)) {
    if (!/^CD\d*$/i.test(key)) continue;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  // Fall back to the last two characters of the GEOID (state FIPS + district).
  const geoid = typeof row.GEOID === 'string' ? row.GEOID : '';
  return geoid.length >= 3 ? geoid.slice(-2) : null;
}

/**
 * Turns one Census "Congressional Districts" row into our shape.
 * Exported so it can be exercised without a network call.
 */
export function parseDistrictRow(
  row: Record<string, unknown>,
  matchedAddress: string,
  congress: string | null,
): DistrictMatch | null {
  const stateFips = String(row.STATE ?? '').padStart(2, '0');
  const geoid = String(row.GEOID ?? '');
  const code = readDistrictCode(row);
  if (!code || NON_DISTRICT_CODES.has(code)) return null;

  // The FIPS table is the primary mapping, as required. STUSAB, when the
  // response carries one, is only a fallback for a FIPS code we do not know.
  const state =
    STATE_FIPS_TO_USPS[stateFips] ??
    (typeof row.STUSAB === 'string' ? row.STUSAB.toUpperCase() : '');
  if (!state) return null;

  const name = typeof row.NAME === 'string' ? row.NAME : '';
  const basename = typeof row.BASENAME === 'string' ? row.BASENAME : '';
  const rawLabel = basename || name;

  // "Delegate District (at Large)" / "Resident Commissioner District (at Large)"
  const delegate = /delegate|resident commissioner/i.test(`${name} ${basename}`) || code === '98';
  const atLarge = AT_LARGE_CODES.has(code) || /at large/i.test(`${name} ${basename}`);

  const districtLabel = delegate
    ? 'Delegate district (at large)'
    : atLarge
      ? 'At-large district (one seat for the whole state)'
      : `District ${String(Number(code))}`;

  return {
    matchedAddress,
    state,
    stateName: USPS_TO_STATE_NAME[state] ?? state,
    stateFips,
    // The bundled legislator records use "0" for every single-seat district.
    district: atLarge || delegate ? '0' : String(Number(code)),
    districtCode: code,
    districtLabel: rawLabel && !atLarge && !delegate ? `District ${String(Number(code))}` : districtLabel,
    atLarge: atLarge || delegate,
    delegate,
    geoid,
    congress,
  };
}

const TIMEOUT_MS = 20_000;

/**
 * Looks up the congressional district for a free-text US address.
 *
 * Never throws: every failure comes back as a `{ ok: false }` result with a
 * message written for a person, because a blank screen is not an error state.
 */
export async function lookupDistrict(
  rawAddress: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<GeocodeResult> {
  const address = rawAddress.trim().replace(/\s+/g, ' ');
  if (address.length < 5) {
    return {
      ok: false,
      kind: 'empty-input',
      message: 'Enter a street address before looking it up.',
      hint: 'A house number, street, city and state works best — for example “350 Fifth Ave, New York, NY”.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);

  let payload: unknown;
  try {
    const res = await fetch(censusGeocodeUrl(address), {
      signal: controller.signal,
      // No credentials, no cookies, no referrer — nothing about the visitor
      // travels with the address.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        ok: false,
        kind: 'service-error',
        message: `The Census Bureau geocoder answered with an error (HTTP ${res.status}).`,
        hint: 'This is a free federal service and it does go down. Search by name in the box above in the meantime, or try again in a few minutes.',
      };
    }
    payload = await res.json();
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    if (aborted && opts.signal?.aborted) {
      return { ok: false, kind: 'timeout', message: 'Lookup cancelled.' };
    }
    if (aborted) {
      return {
        ok: false,
        kind: 'timeout',
        message: 'The Census Bureau geocoder did not answer in time.',
        hint: 'It is often slow on a first request. Try once more, or find your member by name or state instead.',
      };
    }
    return {
      ok: false,
      kind: 'unreachable',
      message: 'Could not reach the Census Bureau geocoding service.',
      hint: 'You may be offline, or a network policy may be blocking geocoding.geo.census.gov. Everything else on this site works without a connection — search by name or filter by state.',
    };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }

  const result = (payload as { result?: { addressMatches?: unknown } } | null)?.result;
  const matches = Array.isArray(result?.addressMatches) ? (result?.addressMatches as unknown[]) : [];

  if (matches.length === 0) {
    return {
      ok: false,
      kind: 'no-match',
      message: 'The Census Bureau could not find that address.',
      hint: 'It only covers the United States, and it wants a street address rather than a place name or a bare ZIP code. Guam, American Samoa, the Northern Mariana Islands and the US Virgin Islands are not in it at all, and Puerto Rico is only partly covered. Try adding the city and state, or find your member by name.',
    };
  }

  const first = matches[0] as { matchedAddress?: unknown; geographies?: unknown };
  const matchedAddress = typeof first.matchedAddress === 'string' ? first.matchedAddress : address;
  const geographies =
    first.geographies && typeof first.geographies === 'object'
      ? (first.geographies as Record<string, unknown>)
      : {};

  const layer = findDistrictLayer(geographies);
  const parsed = layer ? parseDistrictRow(layer.rows[0], matchedAddress, layer.congress) : null;

  if (!parsed) {
    return {
      ok: false,
      kind: 'no-district',
      message: `We found “${matchedAddress}”, but the Census Bureau returned no congressional district for it.`,
      hint: 'This happens for addresses that fall in unassigned water area, and for parts of the territories. Pick your state below instead.',
    };
  }

  return { ok: true, match: parsed };
}
