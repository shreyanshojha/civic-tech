#!/usr/bin/env node
/**
 * A tiny OpenAI-compatible server used ONLY by this project's tests.
 *
 * WHY IT EXISTS
 * -------------
 * The classification layer is bring-your-own-key. Contributors should be able
 * to verify that the LLM code path works — request shape, auth header, JSON
 * parsing, batching, caching, fallback on malformed output — without owning an
 * API key or spending money. This server answers /v1/chat/completions with
 * deterministic, correctly-shaped payloads so the whole path can be exercised
 * in CI.
 *
 * IT IS NOT A MODEL. It does not go on the internet, it is never started by the
 * app, and it is never referenced from any runtime code path. Nothing in
 * packages/ or apps/ imports it. It exists for `npm test`.
 *
 * Usage:
 *   node scripts/mock-llm-server.mjs --port 8787
 *   OPENAI_BASE_URL=http://127.0.0.1:8787/v1 OPENAI_API_KEY=test-key \
 *     LLM_PROVIDER=openai npm run classify
 */

import http from 'node:http';

const portArg = process.argv.indexOf('--port');
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 8787;

/** Deterministic canned knowledge, enough to make the tests meaningful. */
const ORG_ANSWERS = {
  'DEFEND AMERICAN JOBS': ['crypto', 0.9],
  'PROTECT PROGRESS': ['crypto', 0.9],
  'VOTEVETS': ['ideological-single-issue', 0.85],
  'BDA PAC': ['finance-banking', 0.7],
  'SOME COMPLETELY UNKNOWN ENTITY': ['other', 0],
};

function classifyBillFromPrompt(prompt) {
  const p = prompt.toLowerCase();
  const industries = [];
  const add = (industry, confidence, rationale) => industries.push({ industry, confidence, rationale });
  if (/dialysis|medicare|hospital|health/.test(p)) add('health-providers', 0.85, 'Changes payment rules for care providers.');
  if (/drug|pharmaceutic|biologic/.test(p)) add('pharma', 0.8, 'Alters the market for prescription products.');
  if (/pipeline|drilling|petroleum|oil and gas/.test(p)) add('energy-fossil', 0.85, 'Directly regulates extraction and transport.');
  if (/solar|wind|renewable|clean energy/.test(p)) add('energy-renewable', 0.8, 'Changes incentives for renewable generation.');
  if (/bank|securities|credit/.test(p)) add('finance-banking', 0.8, 'Amends financial-institution obligations.');
  if (/defense|armed forces|military/.test(p)) add('defense', 0.8, 'Affects procurement and contractor obligations.');
  if (/naming|post office|commemorat|designat.*federal building/.test(p)) industries.length = 0;
  return {
    plainSummary:
      'This is a deterministic test fixture, not a real model summary. It exists so the bring-your-own-key code path can be exercised without an API key or any spending.',
    industries: industries.slice(0, 4),
  };
}

function handleOrgBatch(prompt) {
  const names = [...prompt.matchAll(/^\s*\d+\.\s+(.+)$/gm)].map((m) => m[1].trim());
  return {
    results: names.map((name) => {
      const hit = ORG_ANSWERS[name.toUpperCase()];
      return { name, industry: hit ? hit[0] : 'other', confidence: hit ? hit[1] : 0 };
    }),
  };
}

function respond(prompt) {
  if (/names taken from US Federal Election Commission filings/i.test(prompt)) return handleOrgBatch(prompt);
  if (/RETURN_MALFORMED_FOR_TEST/.test(prompt)) return 'this is deliberately not json';
  return classifyBillFromPrompt(prompt);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404).end('not found');
    return;
  }
  // Assert the client actually sent an Authorization header — a regression here
  // would mean the real client was calling providers unauthenticated.
  const auth = req.headers.authorization ?? req.headers['x-api-key'];
  if (!auth) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'no credentials presented' } }));
    return;
  }

  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    const isAnthropic = req.url.includes('/messages');
    const prompt = isAnthropic
      ? parsed.messages?.[0]?.content ?? ''
      : (parsed.messages ?? []).filter((m) => m.role === 'user').map((m) => m.content).join('\n');

    const answer = respond(prompt);
    const text = typeof answer === 'string' ? answer : JSON.stringify(answer);

    res.writeHead(200, { 'content-type': 'application/json' });
    if (isAnthropic) {
      res.end(JSON.stringify({
        content: [{ type: 'text', text }],
        usage: { input_tokens: prompt.length / 4 | 0, output_tokens: text.length / 4 | 0 },
      }));
    } else {
      res.end(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: text } }],
        usage: { prompt_tokens: prompt.length / 4 | 0, completion_tokens: text.length / 4 | 0 },
      }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock LLM server (tests only) on http://127.0.0.1:${PORT}`);
});
