/**
 * Bring-your-own-key LLM client.
 *
 * ---------------------------------------------------------------------------
 * THE RULES THIS FILE ENFORCES
 *
 * 1. No key, no call. If the user has not supplied their own key, this module
 *    returns null and every caller falls back to the offline classifier. There
 *    is no default key, no bundled key, no "free tier" proxy, and no telemetry
 *    endpoint. Nothing in this repository can make an LLM call on anyone's
 *    behalf but the person running it.
 * 2. The key is read from the environment at call time and is never logged,
 *    never written to the cache, and never included in an error message.
 * 3. Every prompt carries the project's framing rules (see core/disclaimer.ts)
 *    so generated text cannot drift into causal or partisan language.
 * 4. Any OpenAI-compatible base URL is accepted, which means a fully local
 *    model (Ollama, LM Studio, llama.cpp) works and costs nothing.
 * ---------------------------------------------------------------------------
 */

import { LLM_FRAMING_RULES } from '@ftm/core/src';
import { optionalKey } from './env.js';

export type Provider = 'anthropic' | 'openai' | 'none';

export interface LlmConfig {
  provider: Provider;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface LlmUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export const usage: LlmUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };

/**
 * Resolves the user's configuration, or returns null when no key is present.
 * Callers MUST treat null as "run offline", never as "use a default".
 */
export function resolveLlmConfig(): LlmConfig | null {
  const raw = (process.env.LLM_PROVIDER ?? 'none').trim().toLowerCase();
  if (raw === 'none' || raw === '') return null;

  if (raw === 'anthropic') {
    const apiKey = optionalKey('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.warn('  LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty — running offline instead.');
      return null;
    }
    return {
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5',
      apiKey,
      baseUrl: (process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com').replace(/\/$/, ''),
    };
  }

  if (raw === 'openai') {
    const apiKey = optionalKey('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('  LLM_PROVIDER=openai but OPENAI_API_KEY is empty — running offline instead.');
      return null;
    }
    return {
      provider: 'openai',
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      apiKey,
      baseUrl: (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''),
    };
  }

  console.warn(`  Unknown LLM_PROVIDER "${raw}". Expected anthropic, openai, or none. Running offline.`);
  return null;
}

export interface CompleteOpts {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Retries on 429/5xx. */
  retries?: number;
}

/** Strips anything that looks like a key out of text before it reaches a log. */
function scrub(text: string, key: string): string {
  if (!key) return text;
  return text.split(key).join('***');
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * One completion. Returns the model's raw text.
 * Throws on unrecoverable errors so the caller can fall back.
 */
export async function complete(cfg: LlmConfig, prompt: string, opts: CompleteOpts = {}): Promise<string> {
  const system = [LLM_FRAMING_RULES, opts.system ?? ''].filter(Boolean).join('\n\n');
  const maxTokens = opts.maxTokens ?? 1200;
  const temperature = opts.temperature ?? 0;
  const retries = opts.retries ?? 3;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = cfg.provider === 'anthropic'
        ? await callAnthropic(cfg, system, prompt, maxTokens, temperature)
        : await callOpenAi(cfg, system, prompt, maxTokens, temperature);
      usage.calls++;
      return text;
    } catch (err) {
      const msg = scrub((err as Error).message, cfg.apiKey);
      const retryable = /\b(429|500|502|503|504|ECONNRESET|ETIMEDOUT|fetch failed)\b/i.test(msg);
      if (!retryable || attempt === retries) throw new Error(msg);
      const backoff = Math.min(30_000, 1500 * 2 ** attempt);
      console.warn(`    LLM retry ${attempt + 1}/${retries} in ${Math.round(backoff / 1000)}s (${msg.slice(0, 80)})`);
      await sleep(backoff);
    }
  }
  throw new Error('unreachable');
}

async function callAnthropic(cfg: LlmConfig, system: string, prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${scrub(await res.text(), cfg.apiKey).slice(0, 300)}`);
  const data = (await res.json()) as any;
  usage.inputTokens += data?.usage?.input_tokens ?? 0;
  usage.outputTokens += data?.usage?.output_tokens ?? 0;
  const blocks: any[] = data?.content ?? [];
  return blocks.filter((b) => b?.type === 'text').map((b) => b.text).join('').trim();
}

async function callOpenAi(cfg: LlmConfig, system: string, prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_completion_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${scrub(await res.text(), cfg.apiKey).slice(0, 300)}`);
  const data = (await res.json()) as any;
  usage.inputTokens += data?.usage?.prompt_tokens ?? 0;
  usage.outputTokens += data?.usage?.completion_tokens ?? 0;
  return String(data?.choices?.[0]?.message?.content ?? '').trim();
}

/**
 * Parses JSON out of a model response, tolerating ```json fences and leading
 * prose. Returns null rather than throwing, so a malformed response degrades to
 * the offline classifier instead of killing the run.
 */
export function parseJsonLoose<T>(text: string): T | null {
  if (!text) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch { /* fall through */ }

  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  const opener = candidate[start];
  const closer = opener === '[' ? ']' : '}';
  const end = candidate.lastIndexOf(closer);
  if (end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function describeConfig(cfg: LlmConfig | null): string {
  if (!cfg) return 'offline (no LLM key supplied — using the deterministic keyword classifier)';
  return `${cfg.provider}:${cfg.model} via ${cfg.baseUrl}`;
}
