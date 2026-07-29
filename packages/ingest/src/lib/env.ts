import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../../../..');

// Always read the .env at the repo root, no matter which directory the script
// was launched from. One .env for the whole project.
dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true });
export const DATA_DIR = path.join(REPO_ROOT, 'data');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const DB_PATH = path.join(DATA_DIR, 'ftm.sqlite');
export const WEB_DATA_DIR = path.join(REPO_ROOT, 'apps/web/public/data');
export const MOBILE_DATA_DIR = path.join(REPO_ROOT, 'apps/mobile/assets/data');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

/**
 * Reads a key from the environment.
 *
 * There is no fallback value anywhere in this project. If a key is missing the
 * script explains how to get one for free and exits. It never falls back to a
 * shared key, a demo key that would rate-limit other users, or a key belonging
 * to whoever published this repository.
 */
export function requireKey(name: string, howToGet: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`\n  Missing ${name}.\n`);
    console.error(`  ${howToGet}\n`);
    console.error(`  Then add it to your .env file:\n    ${name}=your_key_here\n`);
    console.error(`  (Copy .env.example to .env first if you have not already.)\n`);
    process.exit(1);
  }
  if (/^(your_key_here|changeme|xxx|todo)$/i.test(v)) {
    console.error(`\n  ${name} is still set to a placeholder value.`);
    console.error(`  ${howToGet}\n`);
    process.exit(1);
  }
  if (/^demo_key$/i.test(v)) {
    console.warn(
      `\n  WARNING: ${name}=DEMO_KEY. That key is shared by every anonymous caller on the\n` +
        `  internet and is capped at 40 requests/hour in total, so it will fail almost\n` +
        `  immediately. It is fine for a 30-second smoke test and useless for anything else.\n` +
        `  ${howToGet}\n`,
    );
  }
  return v;
}

export function optionalKey(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const CONFIG = {
  congress: () => num('FTM_CONGRESS', 119),
  cycle: () => num('FTM_ELECTION_CYCLE', 2026),
  maxBills: () => num('FTM_MAX_BILLS', 40),
  maxMembers: () => num('FTM_MAX_MEMBERS', 60),
};

export const KEY_HELP = {
  fec: 'OpenFEC keys are free and instant. Sign up at https://api.data.gov/signup/ — the key arrives by email.',
  congress: 'Congress.gov keys are free and instant. Sign up at https://api.congress.gov/sign-up/ (same api.data.gov key works for OpenFEC too).',
};

/** True when the user asked for `--sample`, i.e. no network calls at all. */
export const SAMPLE_MODE = process.argv.includes('--sample');

/** True when this module was the script node was invoked with. */
export function isMain(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(fileURLToPath(importMetaUrl)) === path.resolve(entry);
  } catch {
    return false;
  }
}
