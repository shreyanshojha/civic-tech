import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { CACHE_DIR } from './env.js';

/**
 * FEC bulk download reader.
 *
 * The FEC publishes pipe-delimited bulk files at fec.gov/files/bulk-downloads
 * with NO API key and NO rate limit. That makes them the right default source
 * for this project: someone can clone the repo and get real campaign-finance
 * data without signing up for anything.
 *
 * Files used (per two-year cycle):
 *   cn{yy}.zip    candidate master
 *   cm{yy}.zip    committee master (name, connected org, org type)
 *   ccl{yy}.zip   candidate <-> committee linkage
 *   pas2{yy}.zip  contributions FROM committees TO candidates  <- the money
 *
 * Deliberately NOT used by default: indiv{yy}.zip (itemized individual
 * contributions) is several gigabytes. Individual-donor coverage comes from the
 * OpenFEC API's by-employer aggregate instead, which needs a free key. This is
 * documented in the README as the one real difference between key and no-key.
 *
 * Column layouts follow the FEC's published data dictionaries. They are stable
 * and positional; the FEC does not ship headers in these files.
 */

const BULK_BASE = 'https://www.fec.gov/files/bulk-downloads';

/** 2026 -> "26" */
export function cycleSuffix(cycle: number): string {
  return String(cycle).slice(-2);
}

async function downloadZip(url: string, cacheName: string, maxAgeHours = 24 * 7): Promise<Uint8Array> {
  const file = path.join(CACHE_DIR, cacheName);
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < maxAgeHours * 3600_000) {
    return new Uint8Array(fs.readFileSync(file));
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'follow-the-money (open source civic data tool)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}

/** Downloads a bulk zip and yields its rows as arrays of strings. */
export async function* readBulk(cycle: number, name: 'cn' | 'cm' | 'ccl' | 'pas2'): AsyncGenerator<string[]> {
  const suffix = cycleSuffix(cycle);
  const zipName = `${name}${suffix}.zip`;
  const url = `${BULK_BASE}/${cycle}/${zipName}`;
  const buf = await downloadZip(url, `fecbulk-${zipName}`);
  const files = unzipSync(buf);
  const entry = Object.keys(files)[0];
  if (!entry) throw new Error(`empty archive ${zipName}`);
  // FEC bulk files are latin-1, not utf-8. Decoding as utf-8 mangles names.
  const text = new TextDecoder('latin1').decode(files[entry]!);
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/\r$/, '');
    if (!trimmed) continue;
    yield trimmed.split('|');
  }
}

// --- Positional column indexes, from the FEC data dictionaries ---------------

export const CN = {
  CAND_ID: 0, CAND_NAME: 1, PARTY: 2, ELECTION_YR: 3, OFFICE_ST: 4,
  OFFICE: 5, DISTRICT: 6, ICI: 7, STATUS: 8, PCC: 9,
} as const;

export const CM = {
  CMTE_ID: 0, CMTE_NM: 1, TRES_NM: 2, STREET1: 3, STREET2: 4, CITY: 5, STATE: 6, ZIP: 7,
  DSGN: 8, CMTE_TP: 9, PTY: 10, FILING_FREQ: 11, ORG_TP: 12, CONNECTED_ORG_NM: 13, CAND_ID: 14,
} as const;

export const CCL = {
  CAND_ID: 0, CAND_ELECTION_YR: 1, FEC_ELECTION_YR: 2, CMTE_ID: 3, CMTE_TP: 4, CMTE_DSGN: 5, LINKAGE_ID: 6,
} as const;

export const PAS2 = {
  CMTE_ID: 0, AMNDT_IND: 1, RPT_TP: 2, TRANSACTION_PGI: 3, IMAGE_NUM: 4, TRANSACTION_TP: 5,
  ENTITY_TP: 6, NAME: 7, CITY: 8, STATE: 9, ZIP: 10, EMPLOYER: 11, OCCUPATION: 12,
  TRANSACTION_DT: 13, TRANSACTION_AMT: 14, OTHER_ID: 15, CAND_ID: 16, TRAN_ID: 17,
  FILE_NUM: 18, MEMO_CD: 19, MEMO_TEXT: 20, SUB_ID: 21,
} as const;

/** MMDDYYYY -> YYYY-MM-DD */
export function fecDate(s: string | undefined): string | null {
  if (!s || s.length !== 8) return null;
  const mm = s.slice(0, 2), dd = s.slice(2, 4), yyyy = s.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * FEC organization type codes. Only used as a weak prior — a "C" (corporation)
 * tells us nothing about which industry, so it stays unclassified unless the
 * committee name says more.
 */
export const ORG_TYPE_HINT: Record<string, string> = {
  C: 'Corporation',
  L: 'Labor organization',
  M: 'Membership organization',
  T: 'Trade association',
  V: 'Cooperative',
  W: 'Corporation without capital stock',
};

/**
 * Transaction types in pas2 that represent money moving to a candidate.
 * 24K/24E/24C etc. are the contribution and expenditure codes; 24A ("independent
 * expenditure OPPOSING") is excluded because it is money spent AGAINST the
 * candidate and counting it as support would be flatly wrong.
 */
export const SUPPORTING_TX_TYPES = new Set(['24K', '24Z', '24R', '24C', '24F', '24E', '24N', '10', '11', '15', '15E', '15J', '22Y']);
export const OPPOSING_TX_TYPES = new Set(['24A']);

/**
 * Independent expenditures. 24E is money spent *supporting* a candidate and 24A
 * is money spent *opposing* one — neither is a contribution the campaign
 * receives or controls.
 *
 * An earlier version counted 24E as money "given to" a member while excluding
 * 24A. That is indefensibly asymmetric: $5M spent attacking a member counted as
 * zero, while $5M spent supporting them counted as if it had been banked. Both
 * are now excluded from contribution totals, and the exclusion is logged.
 */
export const INDEPENDENT_EXPENDITURE_TX_TYPES = new Set(['24A', '24E', '24C', '24F', '24N']);

/**
 * FEC committee-type codes that are political rather than industry money.
 *   H/S/P  candidate committees (transfers between campaigns)
 *   X/Y/Z  party committees (national, state, nonfederal)
 *   D      leadership PACs
 * These get their own bucket so they never masquerade as an industry.
 */
export const PARTY_LEADERSHIP_CMTE_TYPES = new Set(['H', 'S', 'P', 'X', 'Y', 'Z', 'D']);

/**
 * Independent-expenditure / super PAC committee types.
 *   O  Super PAC (independent expenditure only)
 *   U  Single-candidate independent expenditure committee
 *   V/W Hybrid PAC (with a non-contribution account)
 *   I  Independent-expenditure filer
 * Their own donors are disclosed on their Schedule A, which this pipeline does
 * not traverse, so when the name gives no sector signal the honest label is
 * "funding source not visible from here" rather than "unclassified".
 */
export const SUPER_PAC_CMTE_TYPES = new Set(['O', 'U', 'V', 'W', 'I']);

/**
 * Party committee types — national, state and nonfederal party committees.
 * These are never a candidate's own campaign committee, and their receipts must
 * never be attributed to a candidate as money given to that candidate.
 */
export const PARTY_COMMITTEE_TYPES = new Set(['X', 'Y', 'Z']);
