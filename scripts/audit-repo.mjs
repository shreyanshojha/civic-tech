#!/usr/bin/env node
/**
 * Repository audit.
 *
 * This project makes four promises. This script checks them mechanically so
 * they cannot quietly stop being true:
 *
 *   1. NO HOSTED BACKEND      — nothing here starts a server that must stay up,
 *                               and no client code talks to one.
 *   2. NO USER DATA           — no accounts, no sessions, no cookies, no
 *                               persistence of anything a visitor types.
 *   3. NO TELEMETRY OR ADS    — no analytics, no error reporting, no trackers.
 *   4. NO PAYMENT CODE        — no billing, no checkout, no subscriptions.
 *
 * Plus two hygiene checks:
 *   5. NO EMBEDDED SECRETS    — no API key is ever committed.
 *   6. FRAMING INTACT         — the correlation-not-causation language is present
 *                              in the shared module and reachable from every UI
 *                              surface.
 *
 * Run:  npm run audit:repo
 * Exit code 0 = all clear. Non-zero = something to look at. Wire it into CI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', '.next', 'coverage',
  'data', 'public/data', 'assets/data', '.cache', 'screenshots',
]);

/** Files whose whole purpose is to talk about these words. */
const DOC_FILES = /(?:README|CONTRIBUTING|LIMITATIONS|CHANGELOG|SECURITY|CODE_OF_CONDUCT)\.md$/i;
const SELF = /scripts[/\\]audit-repo\.mjs$/;

/**
 * Generated lockfiles are excluded from CONTENT rules (they are not project code
 * and their `funding` metadata contains third-party donation URLs that are not
 * this project making a payment integration). They are still scanned for
 * committed secrets, which is the check that actually matters in a lockfile.
 */
const LOCKFILE = /(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if ([...SKIP_DIRS].some((s) => rel.replaceAll('\\', '/').endsWith(s))) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|md|yml|yaml)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Each rule is a regex plus the reason it matters. `allow` lets a rule pass on
 * files where the match is legitimate — every allowance is spelled out rather
 * than silently skipped, so a reviewer can judge it.
 */
const RULES = [
  {
    id: 'telemetry',
    why: 'analytics / tracking / error-reporting SDKs',
    re: /\b(google-?analytics|gtag\(|googletagmanager|mixpanel|amplitude|segment\.(com|io)|posthog|plausible\.io|fathom|hotjar|fullstory|logrocket|sentry(?!ry)|bugsnag|datadog|new ?relic|matomo|clarity\.ms|heap\.io)\b/i,
  },
  {
    id: 'ads',
    why: 'advertising or affiliate code',
    re: /\b(adsbygoogle|doubleclick|googlesyndication|adroll|taboola|outbrain|criteo)\b/i,
  },
  {
    id: 'payments',
    why: 'payment, billing or subscription code',
    re: /\b(stripe|braintree|paypal|lemonsqueezy|paddle\.com|razorpay|checkout\.session|priceId|subscription_id|createCheckout|billingPortal)\b/i,
  },
  {
    id: 'accounts',
    why: 'user accounts, sessions or auth',
    re: /\b(next-?auth|passport\.js|firebase\/auth|supabase\.auth|clerk\.dev|auth0|createUser|signInWith|session(Token|Secret)|jsonwebtoken|bcrypt|argon2)\b/i,
  },
  {
    id: 'client-storage',
    why: 'persisting visitor data in the browser',
    re: /\b(localStorage|sessionStorage|document\.cookie|indexedDB|AsyncStorage)\b/,
  },
  {
    id: 'server',
    why: 'code that starts a long-running server the maintainer would have to operate',
    re: /\b(express\(\)|fastify\(\)|new Koa\(|app\.listen\(|http\.createServer|serverless|api\/routes|getServerSideProps)\b/,
    // The mock LLM provider is a test fixture: it is started by `npm test`,
    // never by the app, and never deployed. Called out rather than hidden.
    allow: (rel) => rel.endsWith('scripts/mock-llm-server.mjs'),
  },
  {
    id: 'secrets',
    why: 'a committed API key or credential',
    re: /\b(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/,
  },
  {
    id: 'founder-language',
    why: 'startup/company framing — this is a personal open-source project, not a product',
    re: /\b(our founder|the founder|founder(s)? of|co-?founder|our company|our startup|our customers|our users pay|book a demo|pricing page|enterprise plan)\b/i,
  },
];

/** Outbound hosts a build or runtime may legitimately contact. */
const ALLOWED_HOSTS = [
  'api.open.fec.gov', 'www.fec.gov', 'api.congress.gov', 'www.congress.gov',
  'www.govinfo.gov', 'api.usaspending.gov', 'www.usaspending.gov',
  'unitedstates.github.io', 'geocoding.geo.census.gov',
  'api.anthropic.com', 'api.openai.com',
  'clerk.house.gov', 'www.cbo.gov', 'api.data.gov',
  'localhost', '127.0.0.1', '0.0.0.0',
  'github.com', 'www.w3.org', 'cdnjs.cloudflare.com', 'schemas.wixp.com',
  'json-schema.org', 'www.census.gov', 'reactnative.dev', 'expo.dev', 'registry.npmjs.org',
];

const files = walk(ROOT);
const findings = [];
const hostHits = new Map();

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  if (SELF.test(rel)) continue;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const isDoc = DOC_FILES.test(rel);
  const isLock = LOCKFILE.test(rel);

  for (const rule of RULES) {
    // Documentation is allowed to *discuss* what the project does not contain.
    if (isDoc && rule.id !== 'secrets') continue;
    if (isLock && rule.id !== 'secrets') continue;
    if (rule.allow?.(rel)) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // A comment saying "no analytics" must not trip the analytics rule.
      if (/^\s*(\/\/|\*|#|<!--)/.test(line)) continue;
      const m = rule.re.exec(line);
      if (m) findings.push({ rule: rule.id, why: rule.why, file: rel, line: i + 1, text: line.trim().slice(0, 140) });
    }
  }

  // Same reasoning for the outbound-host inventory: a dependency's funding link
  // is not this project contacting a host.
  if (isLock) continue;
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const host = m[1].toLowerCase();
    if (!ALLOWED_HOSTS.includes(host)) {
      const list = hostHits.get(host) ?? new Set();
      list.add(rel);
      hostHits.set(host, list);
    }
  }
}

// --- framing checks --------------------------------------------------------
const framingProblems = [];
const disclaimerPath = path.join(ROOT, 'packages/core/src/disclaimer.ts');
const disclaimer = fs.existsSync(disclaimerPath) ? fs.readFileSync(disclaimerPath, 'utf8') : '';
for (const constant of ['DISCLAIMER_SHORT', 'DISCLAIMER_MEDIUM', 'DISCLAIMER_LONG', 'DISCLAIMER_CARD', 'LLM_FRAMING_RULES', 'SCORE_EXPLAINER']) {
  if (!disclaimer.includes(`export const ${constant}`)) framingProblems.push(`packages/core/src/disclaimer.ts is missing ${constant}`);
}
for (const rx of [/causation/i, /hard money/i, /dark money|501\(c\)\(4\)/i]) {
  if (!rx.test(disclaimer)) framingProblems.push(`disclaimer.ts no longer mentions ${rx}`);
}

const appShell = path.join(ROOT, 'apps/web/src/App.tsx');
if (fs.existsSync(appShell) && !fs.readFileSync(appShell, 'utf8').includes('PersistentDisclaimer')) {
  framingProblems.push('apps/web/src/App.tsx no longer renders <PersistentDisclaimer/> — the banner would be missing from every page');
}
const shareCard = path.join(ROOT, 'apps/web/src/lib/sharecard.ts');
if (fs.existsSync(shareCard) && !fs.readFileSync(shareCard, 'utf8').includes('DISCLAIMER_CARD')) {
  framingProblems.push('the share-card renderer no longer paints DISCLAIMER_CARD into the image');
}

/* --- publication gate: the share-card watermark ----------------------------
 *
 * PROJECT_REPO_URL is painted into every generated PNG. It is the only route a
 * card recipient has back to the method and the caveats, so a placeholder there
 * is not cosmetic: it means every image this project has ever produced carries
 * a dead attribution.
 *
 * This check FAILS while the placeholder stands. That is deliberate and it is
 * the intended state of an unpublished repository — `npm run audit:repo` is the
 * pre-publication gate, and this is one of the things it is gating. Set a real
 * `github.com/<you>/<repo>` value in packages/core/src/disclaimer.ts and the
 * check goes green on its own.
 *
 * Parsed rather than imported because disclaimer.ts is TypeScript and this
 * script is plain node with no build step in front of it.
 */
const repoUrlProblems = [];
{
  const declared = /export const PROJECT_REPO_URL\s*(?::\s*string\s*)?=\s*(['"`])([\s\S]*?)\1|export const PROJECT_REPO_URL\s*(?::\s*string\s*)?=\s*([A-Za-z_$][\w$]*)\s*;/.exec(disclaimer);
  const placeholderConst = /export const PROJECT_REPO_URL_PLACEHOLDER\s*=\s*(['"`])([\s\S]*?)\1/.exec(disclaimer);

  if (!declared) {
    repoUrlProblems.push('could not find PROJECT_REPO_URL in packages/core/src/disclaimer.ts');
  } else {
    // Either a literal (group 2) or an identifier (group 3) pointing at the placeholder.
    const value = declared[2] ?? (declared[3] === 'PROJECT_REPO_URL_PLACEHOLDER' ? (placeholderConst?.[2] ?? '') : null);
    if (value === null) {
      repoUrlProblems.push(`PROJECT_REPO_URL is set from \`${declared[3]}\`, which this script cannot resolve — set it to a literal URL`);
    } else if (
      value.trim() === '' ||
      /\bOWNER\b/.test(value) ||
      /\bexample\.(com|org|net)\b/i.test(value) ||
      value === (placeholderConst?.[2] ?? ' ')
    ) {
      repoUrlProblems.push(`PROJECT_REPO_URL is still a placeholder: "${value}"`);
      repoUrlProblems.push('every share card is watermarked with this string, so it must be a real repository before publishing');
      repoUrlProblems.push('set it in packages/core/src/disclaimer.ts (host and path only, no scheme)');
    }
    if (/^https?:\/\//i.test(value ?? '')) {
      repoUrlProblems.push('PROJECT_REPO_URL should be host-and-path only ("github.com/you/repo"), without a scheme');
    }
  }

  if (!/export const PROJECT_REPO_URL_IS_PLACEHOLDER/.test(disclaimer)) {
    repoUrlProblems.push('packages/core/src/disclaimer.ts is missing PROJECT_REPO_URL_IS_PLACEHOLDER, so the UI cannot warn about an unset URL');
  }
}

/* --- stale compiled JS sitting next to its TypeScript source ----------------
 *
 * `packages/core/src` had a full set of `.js` files from an old `tsc` emit
 * living beside the `.ts` sources. Because `index.ts` imports `'./format.js'`
 * explicitly, both Vite and Vitest resolved the stale `.js` — so the built site
 * and the unit tests were running code nobody had edited for weeks, while the
 * build succeeded and the typecheck passed. The same trap is documented for
 * `apps/web` in DESIGN.md §8. It is silent, and it is very hard to see.
 *
 * Compiled output belongs in `dist/`. Anything in a `src/` tree that has both
 * `x.ts` and `x.js` is this bug.
 */
const shadowed = [];
for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  if (!/\/src\/.*\.js$/.test(rel)) continue;
  if (fs.existsSync(file.replace(/\.js$/, '.ts')) || fs.existsSync(file.replace(/\.js$/, '.tsx'))) {
    shadowed.push(rel);
  }
}

// Every required document must exist.
const requiredDocs = ['README.md', 'LICENSE', 'CONTRIBUTING.md', 'LIMITATIONS.md', '.env.example'];
const missingDocs = requiredDocs.filter((d) => !fs.existsSync(path.join(ROOT, d)));

// A committed .env would leak the maintainer's own keys.
const envCommitted = fs.existsSync(path.join(ROOT, '.env')) &&
  !fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').some((l) => l.trim() === '.env');

// --- report ----------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
let failed = false;

console.log('\nFollow the Money — repository audit');
console.log(`scanned ${files.length} files under ${ROOT}\n`);

const byRule = new Map();
for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);

for (const rule of RULES) {
  const hits = byRule.get(rule.id) ?? [];
  const ok = hits.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${pad(rule.id, 18)} ${rule.why}`);
  for (const h of hits.slice(0, 8)) console.log(`          ${h.file}:${h.line}  ${h.text}`);
  if (hits.length > 8) console.log(`          …and ${hits.length - 8} more`);
}

console.log(`\n${missingDocs.length === 0 ? '  PASS' : '  FAIL'}  ${pad('required-docs', 18)} README, LICENSE, CONTRIBUTING, LIMITATIONS, .env.example`);
for (const d of missingDocs) console.log(`          missing: ${d}`);
if (missingDocs.length) failed = true;

console.log(`${envCommitted ? '  FAIL' : '  PASS'}  ${pad('env-ignored', 18)} .env is gitignored`);
if (envCommitted) failed = true;

console.log(`${framingProblems.length === 0 ? '  PASS' : '  FAIL'}  ${pad('framing', 18)} correlation-not-causation language intact and wired into every surface`);
for (const p of framingProblems) console.log(`          ${p}`);
if (framingProblems.length) failed = true;

console.log(`${repoUrlProblems.length === 0 ? '  PASS' : '  FAIL'}  ${pad('repo-url', 18)} the share-card watermark points at a real repository`);
for (const p of repoUrlProblems) console.log(`          ${p}`);
if (repoUrlProblems.length) failed = true;


console.log(`${shadowed.length === 0 ? '  PASS' : '  FAIL'}  ${pad('no-stale-emit', 18)} no compiled .js shadowing a .ts source (it silently becomes what ships)`);
for (const s of shadowed.slice(0, 10)) console.log(`          ${s}  shadows  ${s.replace(/\.js$/, '.ts')}`);
if (shadowed.length) failed = true;

console.log(`\n  Outbound hosts referenced anywhere in the source:`);
if (hostHits.size === 0) {
  console.log('    (only the allow-listed government and BYOK-provider endpoints)');
} else {
  for (const [host, where] of [...hostHits].sort()) {
    console.log(`    ${pad(host, 38)} ${[...where].slice(0, 3).join(', ')}${where.size > 3 ? ` +${where.size - 3}` : ''}`);
  }
  console.log('    ^ review these. Anything that is not a government data source, a');
  console.log('      BYOK LLM endpoint the user configured, or documentation is a problem.');
}

/**
 * The repo-url check is a *publication gate*, not an integrity defect: an
 * unpublished working copy is expected to fail it. Track it separately so the
 * summary can say "everything is clean, one gate is still open" rather than
 * implying something is broken.
 */
const publicationGateOnly = repoUrlProblems.length > 0 &&
  missingDocs.length === 0 && !envCommitted && framingProblems.length === 0 &&
  findings.length === 0 && shadowed.length === 0;
const onlyPublicationGate = failed && publicationGateOnly;
if (onlyPublicationGate) {
  console.log('\n  Result: clean on every integrity check — no backend, no user data, no telemetry,');
  console.log('          no payment code, no committed secrets, framing intact.');
  console.log('          One publication gate is still open: PROJECT_REPO_URL must be set before');
  console.log('          you publish, because it is watermarked onto every share card.\n');
} else {
  console.log(`\n  Result: ${failed ? 'ISSUES FOUND' : 'clean — no backend, no user data, no telemetry, no payment code'}\n`);
}
process.exit(failed ? 1 : 0);
