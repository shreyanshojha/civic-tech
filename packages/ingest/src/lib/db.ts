import Database from 'better-sqlite3';
import { DB_PATH } from './env.js';

/**
 * Local SQLite store.
 *
 * This is a *local file on your machine*. There is no hosted database, no
 * connection string to a server anyone operates, and nothing here leaves your
 * disk unless you choose to publish the exported JSON.
 *
 * Every table uses the government's own identifier as the primary key, and
 * every write is an INSERT ... ON CONFLICT DO UPDATE. Re-running any ingestion
 * script is therefore idempotent: same input, same rows, no duplicates.
 */

let _db: Database.Database | null = null;

/**
 * ---------------------------------------------------------------------------
 * WHY better-sqlite3 IS AN *OPTIONAL* DEPENDENCY
 *
 * It is a native C++ addon, so npm has to either find a prebuilt binary for
 * your exact Node version or compile it. On Node 26 neither worked: there was
 * no prebuild, and the source does not compile because V8 removed
 * `Object::GetPrototype` and `PropertyCallbackInfo::This`.
 *
 * That alone was survivable. What made it bad is that npm aborts the WHOLE
 * install when a hard dependency fails to build — so somebody who just wanted
 * to look at the site got no vite, no React, nothing, and an error about
 * `node-gyp` and a C++ compiler that has no visible connection to what they
 * asked for. The reported symptom was "vite: command not found", which points
 * at entirely the wrong thing.
 *
 * Nothing in the web or mobile app touches SQLite. It is used only by the
 * ingestion scripts, which most readers never run — the dataset ships in the
 * repository. So it is optional: a failed build now leaves the site perfectly
 * installable, and only the pipeline is affected. This function is where that
 * shows up, so this is where the failure has to be explained in words rather
 * than as a module-resolution stack trace.
 * ---------------------------------------------------------------------------
 */
function assertDriverPresent(): void {
  if (typeof Database === 'function') return;
  throw new Error(
    [
      'The SQLite driver (better-sqlite3) is not installed, so the ingestion',
      'scripts cannot run. The web and mobile apps do not need it — if you only',
      'want to look at the site, run:',
      '',
      '    npm run setup:web',
      '    npm run dev',
      '',
      'To run the pipeline you need it built, which needs a Node version it has a',
      'binary for. Node 20, 22 or 24 all work; Node 26 does not, because V8',
      'removed APIs the addon uses. With nvm:',
      '',
      '    nvm install 22 && nvm use 22 && npm install',
      '',
      'The dataset is committed to this repository, so you do not need the',
      'pipeline unless you want to refresh or extend the data.',
    ].join('\n'),
  );
}

export function db(): Database.Database {
  if (_db) return _db;
  assertDriverPresent();
  const d = new Database(DB_PATH);
  d.pragma('journal_mode = WAL');
  d.pragma('synchronous = NORMAL');
  migrate(d);
  _db = d;
  return d;
}

function migrate(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS legislators (
    bioguide_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    chamber TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT,
    party TEXT,
    image_url TEXT,
    official_url TEXT,
    fec_candidate_ids TEXT NOT NULL DEFAULT '[]',
    terms TEXT NOT NULL DEFAULT '[]',
    district_places TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fec_candidates (
    candidate_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    party TEXT,
    state TEXT,
    district TEXT,
    office TEXT,
    incumbent_challenge TEXT,
    cycles TEXT NOT NULL DEFAULT '[]',
    principal_committee_ids TEXT NOT NULL DEFAULT '[]',
    bioguide_id TEXT,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_fec_cand_bioguide ON fec_candidates(bioguide_id);

  CREATE TABLE IF NOT EXISTS fec_committees (
    committee_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    committee_type TEXT,
    designation TEXT,
    organization_type TEXT,
    connected_organization_name TEXT,
    inferred_industry TEXT,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contributions (
    id TEXT PRIMARY KEY,
    recipient_candidate_id TEXT,
    recipient_committee_id TEXT,
    contributor_name TEXT NOT NULL,
    contributor_employer TEXT,
    contributor_occupation TEXT,
    contributor_state TEXT,
    contributor_kind TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT,
    cycle INTEGER NOT NULL,
    industry TEXT NOT NULL,
    industry_method TEXT NOT NULL,
    industry_confidence REAL NOT NULL,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_contrib_cand ON contributions(recipient_candidate_id, cycle);
  CREATE INDEX IF NOT EXISTS idx_contrib_industry ON contributions(industry);

  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    congress INTEGER NOT NULL,
    bill_type TEXT NOT NULL,
    bill_number TEXT NOT NULL,
    title TEXT NOT NULL,
    introduced_date TEXT,
    latest_action_date TEXT,
    latest_action_text TEXT,
    policy_area TEXT,
    subjects TEXT NOT NULL DEFAULT '[]',
    sponsor_bioguide_id TEXT,
    cosponsor_bioguide_ids TEXT NOT NULL DEFAULT '[]',
    committee_codes TEXT NOT NULL DEFAULT '[]',
    committee_names TEXT NOT NULL DEFAULT '[]',
    official_summary TEXT,
    congress_dot_gov_url TEXT NOT NULL,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bill_classifications (
    bill_id TEXT PRIMARY KEY,
    plain_summary TEXT NOT NULL,
    industries TEXT NOT NULL,
    method TEXT NOT NULL,
    model TEXT,
    input_hash TEXT NOT NULL,
    classified_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS committee_memberships (
    bioguide_id TEXT NOT NULL,
    committee_code TEXT NOT NULL,
    committee_name TEXT NOT NULL,
    role TEXT,
    PRIMARY KEY (bioguide_id, committee_code)
  );

  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    bill_id TEXT,
    chamber TEXT NOT NULL,
    congress INTEGER NOT NULL,
    session INTEGER NOT NULL,
    roll_number INTEGER NOT NULL,
    date TEXT NOT NULL,
    question TEXT NOT NULL,
    result TEXT NOT NULL,
    positions TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS awards (
    id TEXT PRIMARY KEY,
    recipient_name TEXT NOT NULL,
    recipient_parent_name TEXT,
    award_type TEXT NOT NULL,
    amount REAL NOT NULL,
    action_date TEXT NOT NULL,
    awarding_agency TEXT,
    awarding_sub_agency TEXT,
    recipient_state TEXT,
    recipient_congressional_district TEXT,
    naics_code TEXT,
    naics_description TEXT,
    industry TEXT NOT NULL,
    industry_method TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_awards_district ON awards(recipient_state, recipient_congressional_district);

  -- Cache for employer-string -> industry resolutions, so an LLM is asked
  -- about any given employer string at most once, ever.
  CREATE TABLE IF NOT EXISTS employer_industry_cache (
    normalized_employer TEXT PRIMARY KEY,
    industry TEXT NOT NULL,
    confidence REAL NOT NULL,
    method TEXT NOT NULL,
    model TEXT,
    resolved_at TEXT NOT NULL
  );
  `);

  addColumnIfMissing(d, 'legislators', 'district_places', "TEXT NOT NULL DEFAULT '[]'");
}

/**
 * Adds a column to an existing table when it is missing.
 * Keeps `npm run ingest` working on a database created by an older version
 * rather than forcing a full re-download.
 */
function addColumnIfMissing(d: Database.Database, table: string, column: string, ddl: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function setMeta(key: string, value: string) {
  db().prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getMeta(key: string): string | null {
  const row = db().prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/** Builds an idempotent upsert statement for a table with a known column list. */
export function upsert(table: string, pk: string | string[], cols: string[]) {
  const pks = Array.isArray(pk) ? pk : [pk];
  const updatable = cols.filter((c) => !pks.includes(c));
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})
    ON CONFLICT(${pks.join(', ')}) DO UPDATE SET ${updatable.map((c) => `${c} = excluded.${c}`).join(', ')}`;
  return db().prepare(sql);
}

export function j(v: unknown): string {
  return JSON.stringify(v ?? null);
}

export function pj<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
