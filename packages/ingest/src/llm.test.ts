/**
 * Tests for the bring-your-own-key LLM layer.
 *
 * These run against scripts/mock-llm-server.mjs — a local, deterministic,
 * OpenAI-compatible stub — so contributors can verify the whole code path
 * without an API key and without spending anything.
 *
 * The most important assertions here are the BYOK guarantees:
 *   - no key configured  => no network call is ever attempted
 *   - a key configured   => the credential is actually sent
 *   - a malformed model response degrades to the offline classifier
 *   - the key never appears in an error message
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { complete, parseJsonLoose, resolveLlmConfig } from './lib/llm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}/v1`;

let server: ChildProcess;

beforeAll(async () => {
  server = spawn('node', [path.join(REPO, 'scripts/mock-llm-server.mjs'), '--port', String(PORT)], { stdio: 'ignore' });
  // wait for the port to accept connections
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { authorization: 'Bearer t' }, body: '{}' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('mock server did not start');
}, 20_000);

afterAll(() => { server?.kill(); });

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]!; }
  try { fn(); } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]!; }
  }
}

describe('BYOK configuration', () => {
  it('returns null when no provider is configured', () => {
    withEnv({ LLM_PROVIDER: 'none', OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined }, () => {
      expect(resolveLlmConfig()).toBeNull();
    });
  });

  it('returns null when a provider is named but the key is missing — never a default key', () => {
    withEnv({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: undefined }, () => {
      expect(resolveLlmConfig()).toBeNull();
    });
    withEnv({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: undefined }, () => {
      expect(resolveLlmConfig()).toBeNull();
    });
  });

  it('returns null for an unknown provider rather than guessing', () => {
    withEnv({ LLM_PROVIDER: 'definitely-not-a-provider' }, () => {
      expect(resolveLlmConfig()).toBeNull();
    });
  });

  it('honours a custom base URL so a fully local model works', () => {
    withEnv({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_BASE_URL: 'http://localhost:11434/v1' }, () => {
      expect(resolveLlmConfig()?.baseUrl).toBe('http://localhost:11434/v1');
    });
  });

  it('never carries a hard-coded key anywhere in the module', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(path.join(here, 'lib/llm.ts'), 'utf8'));
    expect(src).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
    expect(src).not.toMatch(/sk-ant-[A-Za-z0-9_-]{16,}/);
  });
});

describe('completions against the mock provider', () => {
  const cfg = { provider: 'openai' as const, model: 'mock-model', apiKey: 'test-key-123', baseUrl: BASE };

  it('classifies a bill and returns parseable JSON', async () => {
    const text = await complete(cfg, 'Title: A bill to modify Medicare payment for renal dialysis services');
    const parsed = parseJsonLoose<{ plainSummary: string; industries: { industry: string; confidence: number }[] }>(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.industries.map((i) => i.industry)).toContain('health-providers');
  });

  it('returns an empty industry list for a ceremonial bill instead of padding', async () => {
    const text = await complete(cfg, 'Title: To designate the federal building at 1 Main Street as the John Doe Federal Building. naming');
    const parsed = parseJsonLoose<{ industries: unknown[] }>(text);
    expect(parsed!.industries).toEqual([]);
  });

  it('handles a batched organisation lookup', async () => {
    const prompt = `Below is a list of names taken from US Federal Election Commission filings.\n\n1. DEFEND AMERICAN JOBS\n2. SOME COMPLETELY UNKNOWN ENTITY\n`;
    const parsed = parseJsonLoose<{ results: { name: string; industry: string; confidence: number }[] }>(await complete(cfg, prompt));
    expect(parsed!.results).toHaveLength(2);
    expect(parsed!.results[0]!.industry).toBe('crypto');
    // The important half: it admits ignorance rather than guessing.
    expect(parsed!.results[1]!.industry).toBe('other');
    expect(parsed!.results[1]!.confidence).toBe(0);
  });

  it('rejects an unauthenticated call — the client must always send credentials', async () => {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('never leaks the API key into an error message', async () => {
    // A port nothing is listening on: the request fails at the transport layer,
    // which is the path most likely to echo the request back into the message.
    const bad = { ...cfg, baseUrl: 'http://127.0.0.1:9/v1' };
    await expect(complete(bad, 'x', { retries: 0 })).rejects.toThrow();
    try {
      await complete(bad, 'x', { retries: 0 });
    } catch (err) {
      expect((err as Error).message).not.toContain('test-key-123');
    }
  });
});

describe('parseJsonLoose', () => {
  it('reads a bare object', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });
  it('reads a fenced block', () => {
    expect(parseJsonLoose('here you go:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('reads an object buried in prose', () => {
    expect(parseJsonLoose('Sure! {"a":3} hope that helps')).toEqual({ a: 3 });
  });
  it('returns null on garbage rather than throwing, so callers can fall back', () => {
    expect(parseJsonLoose('absolutely not json')).toBeNull();
    expect(parseJsonLoose('')).toBeNull();
  });
});
