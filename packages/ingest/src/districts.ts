/**
 * ZIP code and town → congressional district crosswalk.
 *
 *   download -> parse -> write static JSON (no SQLite)
 *
 * Run:  npm run ingest:districts
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS: THE ADDRESS BOX COULD NEVER HAVE WORKED
 *
 * "Find out who represents an address" used to POST the reader's address to the
 * US Census Bureau's public geocoder from the browser. That service answers
 * correctly and quickly — but it sends **no `Access-Control-Allow-Origin`
 * header**. A browser therefore discards the response before any of our code
 * sees it, on every origin, including localhost. Confirmed against the live
 * service: HTTP 200, a correct district in the body, and no CORS header at all.
 *
 * So the feature was not broken by a bug we could find and fix. It was
 * structurally impossible from a static site, and the only ways to make that
 * exact design work are a server or a third-party CORS proxy. This project has
 * no server on purpose, and routing readers' home addresses through a stranger's
 * proxy to preserve a privacy notice claiming the address goes nowhere but the
 * Census Bureau would have been worse than the bug.
 *
 * The fix inverts it: ship the crosswalk instead of asking at runtime. A ZIP
 * code or a town name is enough to find a district, and both can be answered
 * from a file the reader already has.
 *
 * What that buys, beyond working:
 *
 *   - The app now makes ZERO outbound requests. This was previously the single
 *     exception, and every privacy claim on the site had to be written around
 *     it. That whole panel of caveats is deleted rather than reworded.
 *   - It works offline, and from file://.
 *   - It cannot break because a federal service is down or slow, which the old
 *     path handled with three separate failure states and a timeout.
 *   - A ZIP is far less personal than a street address, and typing one is much
 *     less work — which matters more than it sounds for the readers this is for.
 *
 * ---------------------------------------------------------------------------
 * SOURCE
 *
 * Census Bureau 2020 geographic relationship files for the 119th Congress:
 *
 *   tab20_cd11920_zcta520_natl.txt   districts <-> ZCTAs (≈ ZIP codes)
 *   tab20_cd11920_place20_natl.txt   districts <-> incorporated places
 *
 * Work of the US federal government: public domain, no key, no signup, no
 * attribution required (given anyway, on screen and here).
 *
 * These are the 119th-Congress files specifically. District lines changed
 * between the 118th and the 119th in several states, so the 118th files would
 * be quietly wrong for exactly the readers most likely to be checking.
 *
 * ---------------------------------------------------------------------------
 * WHY A ZIP MAPS TO MORE THAN ONE DISTRICT, AND WHY WE KEEP ALL OF THEM
 *
 * ZIP codes are a postal routing convenience and districts are drawn from
 * population. They cross each other constantly: about a fifth of ZIPs touch
 * more than one district. A tool that silently picks the biggest one tells some
 * readers, confidently, about a representative who is not theirs.
 *
 * So every district a ZIP touches is kept, ordered by how much of the ZIP's land
 * area falls in each, and the UI shows all of them when there is more than one
 * and says why. `share` is that land-area fraction, rounded to two decimals —
 * enough to rank and to say "most of this ZIP", not enough to imply precision
 * the source does not have. Land area, not population: the relationship file
 * gives area, and pretending otherwise would be inventing a number.
 *
 * ---------------------------------------------------------------------------
 * PLACES: WHY BOTH FILES
 *
 * The site already let a reader search the towns where members keep district
 * offices, which covers about 800 towns. There are roughly 29,000 incorporated
 * places in the United States. Someone in a small town looked for it, did not
 * find it, and reasonably concluded the site did not cover them. The place file
 * fixes that: every incorporated place in the country resolves to a district.
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { MOBILE_DATA_DIR, REPO_ROOT, WEB_DATA_DIR, isMain } from './lib/env.js';

const CENSUS_REL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld';
const ZCTA_FILE = 'tab20_cd11920_zcta520_natl.txt';
const PLACE_FILE = 'tab20_cd11920_place20_natl.txt';

/** Downloads land here so a re-run is free and does not re-hit the Census Bureau. */
const CACHE_DIR = path.join(REPO_ROOT, 'data/cache/census-rel');

/**
 * State FIPS → USPS abbreviation.
 *
 * Embedded rather than fetched: it is 56 rows that have not changed since 1970,
 * and making a lookup table of constants into a network dependency would add a
 * failure mode for nothing. DC and the five territories are included because
 * they have non-voting delegates who appear in this dataset, and omitting them
 * would drop those readers entirely.
 */
const STATE_BY_FIPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY',
  '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
};

async function download(file: string): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cached = path.join(CACHE_DIR, file);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 1_000_000) {
    console.log(`  ${file}: cached`);
    return fs.readFileSync(cached, 'utf8');
  }
  console.log(`  ${file}: downloading…`);
  const res = await fetch(`${CENSUS_REL}/${file}`, {
    headers: { 'User-Agent': 'follow-the-money (open source civic data tool)' },
  });
  if (!res.ok) throw new Error(`Census relationship file ${file} returned HTTP ${res.status}`);
  const text = await res.text();
  if (text.length < 1_000_000) {
    throw new Error(`Census relationship file ${file} was suspiciously small (${text.length} bytes) — refusing to build a crosswalk from it`);
  }
  fs.writeFileSync(cached, text);
  return text;
}

/** Pipe-delimited, with a UTF-8 BOM on the header line. */
function parseRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const first = lines[0];
  if (!first) return [];
  const header = first.replace(/^﻿/, '').split('|');
  return lines.slice(1).map((line) => {
    const cells = line.split('|');
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

/**
 * `GEOID_CD119_20` is state FIPS + district, zero-padded: `0101` is AL-01.
 *
 * `00` and `98` are real values, not missing data: `00` is the single district of
 * a state that has only one (WY, VT, DE, AK, ND, SD), and `98` is the Census
 * code for a delegate district (DC and the territories). Both MUST come out as
 * the string `'0'`, because that is what the bundled legislator data stores for
 * those seats — emit anything else and every at-large state silently finds no
 * representative, which is the exact class of bug this file exists to fix.
 * `ZZ` is unassigned water area and is not a district at all.
 */
const AT_LARGE_CD_CODES = new Set(['00', '98']);

function parseCd(geoid: string): { state: string; district: string } | null {
  if (!/^\d{2}(\d{2}|ZZ)$/i.test(geoid)) return null;
  const state = STATE_BY_FIPS[geoid.slice(0, 2)];
  if (!state) return null;
  const code = geoid.slice(2).toUpperCase();
  if (code === 'ZZ') return null;
  if (AT_LARGE_CD_CODES.has(code)) return { state, district: '0' };
  return { state, district: String(Number(code)) };
}

export interface DistrictRef { state: string; district: string; share?: number }

/**
 * Town names as typed by a human, not as filed by a cartographer.
 *
 * The Census writes "Abbeville city", "Scottsdale city", "Cicero town" — the
 * legal-status word is part of the official name and no reader types it. It is
 * stripped so that "abbeville" matches. `CLASSFP` would be the tidier way to do
 * this, but the suffix is what actually appears in the string and stripping the
 * string is what makes the match work.
 */
function normalizePlace(nameLsad: string): string {
  return nameLsad
    .replace(/\s+(city and borough|city|town|village|borough|municipality|CDP|comunidad|zona urbana)$/i, '')
    .trim()
    .toLowerCase();
}

export async function ingestDistricts(): Promise<void> {
  console.log('\nBuilding the ZIP and town → district crosswalk (no API key needed)\n');

  // ---- ZIP -> districts ---------------------------------------------------
  const zctaRows = parseRows(await download(ZCTA_FILE));
  const byZip = new Map<string, DistrictRef[]>();
  let zipRowsUsed = 0;

  for (const row of zctaRows) {
    const zip = row.GEOID_ZCTA5_20 ?? '';
    // Rows with a blank ZCTA are the district's own summary line (the part of a
    // district that is in no ZCTA at all — water, mostly). Not a lookup entry.
    if (!/^\d{5}$/.test(zip)) continue;
    const cd = parseCd(row.GEOID_CD119_20 ?? '');
    if (!cd) continue;
    const area = Number(row.AREALAND_PART ?? '') || 0;
    const list = byZip.get(zip) ?? [];
    list.push({ ...cd, share: area });
    byZip.set(zip, list);
    zipRowsUsed++;
  }

  // Turn raw areas into shares, order by them, and drop slivers.
  const zipOut: Record<string, DistrictRef[]> = {};
  let multiDistrictZips = 0;
  for (const [zip, list] of byZip) {
    const total = list.reduce((s, r) => s + (r.share ?? 0), 0);
    let refs = list
      .map((r) => ({ state: r.state, district: r.district, share: total > 0 ? (r.share ?? 0) / total : 0 }))
      .sort((a, b) => b.share - a.share);
    // A district holding under 1% of a ZIP's land is almost always a boundary
    // artefact — a road easement or a river bank — not somewhere anyone lives.
    // Keeping them would tell readers about three representatives when they have
    // one. The largest is never dropped, so no ZIP is emptied by this.
    const kept = refs.filter((r, i) => i === 0 || r.share >= 0.01);
    if (kept.length > 1) multiDistrictZips++;
    zipOut[zip] = kept.map((r) => ({
      state: r.state,
      district: r.district,
      share: Math.round(r.share * 100) / 100,
    }));
  }

  // ---- town -> districts --------------------------------------------------
  const placeRows = parseRows(await download(PLACE_FILE));
  const byTown = new Map<string, Map<string, DistrictRef>>();

  for (const row of placeRows) {
    const nameLsad = row.NAMELSAD_PLACE_20;
    if (!nameLsad) continue;
    const cd = parseCd(row.GEOID_CD119_20 ?? '');
    if (!cd) continue;
    const area = Number(row.AREALAND_PART ?? '') || 0;
    // Same sliver logic, applied before aggregation: a town that clips the
    // corner of a district by a few square metres is not in that district for
    // any purpose a reader cares about.
    if (area <= 0) continue;
    // Key on town + state, because there are 88 Springfields and a reader
    // typing "springfield" needs to be told which one, not given one at random.
    const key = `${normalizePlace(nameLsad)}|${cd.state}`;
    const inner = byTown.get(key) ?? new Map<string, DistrictRef>();
    const dk = `${cd.state}-${cd.district}`;
    const prev = inner.get(dk);
    inner.set(dk, { ...cd, share: (prev?.share ?? 0) + area });
    byTown.set(key, inner);
  }

  const townOut: Record<string, DistrictRef[]> = {};
  for (const [key, inner] of byTown) {
    const refs = [...inner.values()].sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
    const total = refs.reduce((s, r) => s + (r.share ?? 0), 0);
    const kept = refs.filter((r, i) => i === 0 || (total > 0 && (r.share ?? 0) / total >= 0.02));
    townOut[key] = kept.map((r) => ({ state: r.state, district: r.district }));
  }

  // ---- write --------------------------------------------------------------
  const payload = {
    source: {
      name: 'US Census Bureau, 2020 geographic relationship files, 119th Congress',
      url: `${CENSUS_REL}/${ZCTA_FILE}`,
      note: 'Work of the US federal government — public domain. Shipped with this app so no address, ZIP or town you type is sent anywhere.',
    },
    congress: 119,
    zip: zipOut,
    town: townOut,
  };

  for (const dir of [WEB_DATA_DIR, MOBILE_DATA_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'districts.json'), JSON.stringify(payload));
  }

  const bytes = fs.statSync(path.join(WEB_DATA_DIR, 'districts.json')).size;
  console.log(`\n  ZIPs:  ${Object.keys(zipOut).length.toLocaleString()} (${multiDistrictZips.toLocaleString()} span more than one district)`);
  console.log(`  towns: ${Object.keys(townOut).length.toLocaleString()}`);
  console.log(`  wrote districts.json — ${(bytes / 1024 / 1024).toFixed(2)} MB, from ${zipRowsUsed.toLocaleString()} ZIP rows`);
  console.log('\n  The app now makes no outbound request of any kind.\n');
}

if (isMain(import.meta.url)) {
  ingestDistricts().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
