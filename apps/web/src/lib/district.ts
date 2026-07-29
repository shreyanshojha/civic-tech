/**
 * "Who represents me?" — answered from a file, with no network call.
 *
 * ---------------------------------------------------------------------------
 * THIS REPLACES A FEATURE THAT COULD NOT WORK
 *
 * The previous version of this file (`geocode.ts`) sent the reader's street
 * address to the US Census Bureau's public geocoder from the browser. The
 * service answers correctly — but it returns **no `Access-Control-Allow-Origin`
 * header**, so a browser throws the response away before our code sees it. On
 * every origin. Including localhost. That is why "the address lookup is not
 * working": it never could, and no amount of error handling was going to change
 * it. Verified against the live service — HTTP 200, correct district in the
 * body, no CORS header.
 *
 * A static site has exactly two ways to make that design work: run a server, or
 * push readers' home addresses through somebody else's CORS proxy. This project
 * has no server on purpose, and the second option would have meant sending home
 * addresses to a stranger in order to keep a privacy notice that promised the
 * address went nowhere but the Census Bureau.
 *
 * So the question is answered from a crosswalk shipped with the app instead —
 * see packages/ingest/src/districts.ts. Consequences, all good:
 *
 *   - the app now makes ZERO outbound requests, so the privacy notice, the
 *     "your address is sent to…" panel, the timeout, and the three separate
 *     network failure states are all DELETED rather than reworded;
 *   - it works offline and from file://;
 *   - a ZIP code is less personal than a street address and much less typing.
 *
 * ---------------------------------------------------------------------------
 * WHAT A HONEST ANSWER HAS TO INCLUDE
 *
 * Three cases that a naive lookup gets wrong, and that the return type below
 * forces every caller to handle:
 *
 * 1. A ZIP can span several districts — about 5,100 of 33,800 do. Picking the
 *    biggest silently tells some readers about a representative who is not
 *    theirs. All of them are returned, largest share first, and the UI says so.
 *
 * 2. Some ZIPs are not in the file at all. ZCTAs only exist for populated
 *    areas, so PO-box-only ZIPs (05601, Montpelier VT) have no entry. That is a
 *    "not in this dataset" answer, not a "you don't exist" answer, and it needs
 *    its own message pointing at the town search.
 *
 * 3. A district can be real and currently have nobody in it. Four House seats
 *    are vacant in this dataset (TX-23, FL-20, GA-13, CA-14 — the upstream
 *    source agrees, so this is a fact about Congress, not a gap in our data).
 *    "Your district is TX-23 and the seat is vacant" is a correct and useful
 *    answer. Returning nothing would look like a broken search.
 * ---------------------------------------------------------------------------
 */

import type { MemberSummary } from './data';

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

export interface DistrictRef {
  state: string;
  district: string;
  /** Share of the ZIP's land area in this district, 0–1. Absent for town matches. */
  share?: number;
}

interface DistrictsFile {
  source: { name: string; url: string; note: string };
  congress: number;
  zip: Record<string, DistrictRef[]>;
  town: Record<string, DistrictRef[]>;
}

/** One district, plus whoever holds it — or nobody. */
export interface SeatResult {
  state: string;
  stateName: string;
  district: string;
  /** "District 12", or "At-large seat" / "Delegate seat" when district is "0". */
  label: string;
  /** Share of the searched ZIP's land in this district, when the search was a ZIP. */
  share?: number;
  /** The sitting representative, or null when the seat is vacant. */
  member: MemberSummary | null;
}

export type LookupResult =
  | {
      ok: true;
      /** How the query was read. */
      kind: 'zip' | 'town';
      /** Echo of what was matched, e.g. "11201" or "Cullman, Alabama". */
      matched: string;
      /** Every district the place touches, largest first. */
      seats: SeatResult[];
      /** Both senators for the state, which a reader almost always also wants. */
      senators: MemberSummary[];
      /** True when the place is split across districts — the UI must say so. */
      split: boolean;
    }
  | {
      ok: false;
      kind: 'empty' | 'zip-not-found' | 'town-not-found' | 'unrecognised' | 'load-failed';
      message: string;
      hint?: string;
    };

const DATA_URL = 'data/districts.json';
let cache: DistrictsFile | null = null;
let inflight: Promise<DistrictsFile> | null = null;

/**
 * Loaded on first use, not at page load. It is ~3.3 MB uncompressed (≈340 KB
 * over the wire) and most readers never touch the lookup, so making everyone
 * pay for it on arrival would be the wrong trade.
 */
export async function loadDistricts(): Promise<DistrictsFile> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load ${DATA_URL} (HTTP ${r.status})`);
        return r.json() as Promise<DistrictsFile>;
      })
      .then((json) => { cache = json; return json; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function seatLabelFor(district: string, delegate: boolean): string {
  if (district !== '0') return `District ${district}`;
  return delegate ? 'Delegate seat (at large)' : 'At-large seat';
}

const DELEGATE_STATES = new Set(['DC', 'PR', 'GU', 'AS', 'MP', 'VI']);

/** "Cullman, AL" / "cullman al" / "Cullman" → { name, state? } */
function parseTownQuery(q: string): { name: string; state?: string } {
  const m = /^(.*?)[,\s]+([A-Za-z]{2})$/.exec(q.trim());
  if (m && USPS_TO_STATE_NAME[m[2].toUpperCase()]) {
    return { name: m[1].trim().toLowerCase(), state: m[2].toUpperCase() };
  }
  return { name: q.trim().toLowerCase() };
}

function buildSeats(
  refs: DistrictRef[],
  legislators: MemberSummary[],
  withShare: boolean,
): SeatResult[] {
  return refs.map((r) => {
    const member = legislators.find(
      (m) => m.state === r.state && String(m.district ?? '') === r.district,
    ) ?? null;
    return {
      state: r.state,
      stateName: USPS_TO_STATE_NAME[r.state] ?? r.state,
      district: r.district,
      label: seatLabelFor(r.district, DELEGATE_STATES.has(r.state)),
      share: withShare ? r.share : undefined,
      member,
    };
  });
}

function senatorsFor(states: string[], legislators: MemberSummary[]): MemberSummary[] {
  const set = new Set(states);
  return legislators.filter((m) => set.has(m.state) && (m.district === null || m.district === undefined));
}

/**
 * The one entry point. Accepts a 5-digit ZIP or a town name, optionally with a
 * state ("Springfield, IL" — there are 22 Springfields, so a bare "springfield"
 * legitimately returns several and the UI shows them all rather than guessing).
 */
export async function lookupPlace(
  query: string,
  legislators: MemberSummary[],
): Promise<LookupResult> {
  const q = query.trim();
  if (!q) return { ok: false, kind: 'empty', message: 'Type a ZIP code or a town name.' };

  let file: DistrictsFile;
  try {
    file = await loadDistricts();
  } catch {
    return {
      ok: false,
      kind: 'load-failed',
      message: 'The ZIP and town lookup file has not been built for this copy of the site.',
      hint: 'Run npm run pipeline from the repository root. Everything else on the page still works — you can pick a state below.',
    };
  }

  // ---- ZIP ---------------------------------------------------------------
  const zipMatch = /^(\d{5})(?:-\d{4})?$/.exec(q);
  if (zipMatch) {
    const zip = zipMatch[1];
    const refs = file.zip[zip];
    if (!refs || refs.length === 0) {
      return {
        ok: false,
        kind: 'zip-not-found',
        message: `${zip} is not in the Census Bureau's ZIP-to-district file.`,
        hint: 'That usually means it is a PO-box-only ZIP rather than a residential area. Try a neighbouring ZIP, or type your town name instead — both work the same way.',
      };
    }
    const seats = buildSeats(refs, legislators, true);
    return {
      ok: true,
      kind: 'zip',
      matched: zip,
      seats,
      senators: senatorsFor(seats.map((s) => s.state), legislators),
      split: seats.length > 1,
    };
  }

  // Anything with digits in it that is not a ZIP is most likely a street
  // address, which this tool deliberately no longer accepts. Say that, rather
  // than reporting "town not found" for a perfectly real address.
  if (/\d/.test(q)) {
    return {
      ok: false,
      kind: 'unrecognised',
      message: 'This box takes a ZIP code or a town name, not a full street address.',
      hint: 'The ZIP from that address is enough — it is looked up on your own device, so nothing you type is sent anywhere.',
    };
  }

  // ---- town --------------------------------------------------------------
  const { name, state } = parseTownQuery(q);
  const keys = state ? [`${name}|${state}`] : Object.keys(file.town).filter((k) => k.startsWith(`${name}|`));
  const refs: DistrictRef[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    for (const r of file.town[k] ?? []) {
      const id = `${r.state}-${r.district}`;
      if (seen.has(id)) continue;
      seen.add(id);
      refs.push(r);
    }
  }

  if (refs.length === 0) {
    return {
      ok: false,
      kind: 'town-not-found',
      message: `No incorporated town called “${q}” is in the Census Bureau's town-to-district file.`,
      hint: 'Neighbourhoods are not towns in this file — “Brooklyn” is part of New York city, for instance. Your ZIP code will always work, and it is looked up on your own device.',
    };
  }

  const seats = buildSeats(refs, legislators, false);
  const states = [...new Set(seats.map((s) => s.state))];
  const matchedLabel = state
    ? `${titleCase(name)}, ${USPS_TO_STATE_NAME[state] ?? state}`
    : states.length === 1
      ? `${titleCase(name)}, ${USPS_TO_STATE_NAME[states[0]] ?? states[0]}`
      : `${titleCase(name)} (${states.length} states)`;

  return {
    ok: true,
    kind: 'town',
    matched: matchedLabel,
    seats,
    senators: senatorsFor(states, legislators),
    split: seats.length > 1,
  };
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * The notice that replaced the old privacy panel.
 *
 * The old one was eleven lines explaining where an address went and what was
 * done with it, because an address really was leaving the device. Nothing leaves
 * now, so the honest version is one sentence — and one sentence gets read, which
 * eleven did not.
 */
export const LOCAL_LOOKUP_NOTICE =
  'Looked up on your own device, from a file your browser already has. Nothing you type is sent anywhere.';

/** Shown under the results, because the reader should be able to check it. */
export const LOOKUP_SOURCE_NOTE =
  'ZIP and town boundaries come from the US Census Bureau’s 2020 relationship files for the 119th Congress — public domain, and bundled with this site.';
