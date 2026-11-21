// The AI proxy: a Cloudflare Worker that sits between the website and the AI
// provider so that the API key never reaches a visitor's browser.
//
//   browser  --POST { task, input, lang }-->  this Worker  --->  AI provider
//
// What it does to keep the bill under control:
//   - only answers pages served from ALLOWED_ORIGINS
//   - only accepts the three tasks in js/prompts.js, with size-capped input,
//     so it can't be used as a general chatbot
//   - caps the length of every reply (maxTokens in js/prompts.js)
//   - limits each visitor to PER_VISITOR_LIMIT requests per 10 minutes
//   - stops for the day after DAILY_LIMIT requests (needs the optional KV binding)
//
// Set a monthly spend limit with your AI provider as well. That is the real
// safety net; everything here is a first line of defence.
//
// Setup steps are in docs/SETUP-AI.md.

import { buildPrompt, TASKS } from '../js/prompts.js';

const ANTHROPIC_VERSION = '2026-10-21';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const WINDOW_MS = 10 * 60 * 1000;

// Best-effort memory of recent requests per visitor. A Worker can run in many
// places at once and forgets this when it restarts, so treat it as a speed bump.
const recent = new Map();

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://emmazhao422.github.io')
    .split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(origin ? corsHeaders(origin) : {}) },
  });
}

function overVisitorLimit(ip, limit, now = Date.now()) {
  const hits = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= limit) { recent.set(ip, hits); return true; }
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear(); // don't let the map grow without bound
  return false;
}

async function overDailyLimit(env) {
  if (!env.LIMITS) return false; // KV not set up: skip
  const key = `day:${new Date().toISOString().slice(0, 10)}`;
  const count = Number(await env.LIMITS.get(key)) || 0;
  if (count >= Number(env.DAILY_LIMIT || 2000)) return true;
  await env.LIMITS.put(key, String(count + 1), { expirationTtl: 172800 });
  return false;
}

async function askModel(env, prompt) {
  // Option A: any OpenAI-compatible provider (set OPENAI_COMPAT_BASE_URL, AI_API_KEY, AI_MODEL)
  if (env.OPENAI_COMPAT_BASE_URL) {
    const res = await fetch(`${String(env.OPENAI_COMPAT_BASE_URL).replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({
        model: env.AI_MODEL,
        max_tokens: prompt.maxTokens,
        messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      }),
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || '');
  }

  // Option B (default): Anthropic. Set ANTHROPIC_API_KEY; AI_MODEL is optional.
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: prompt.maxTokens,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  });
  if (!res.ok) throw new Error(`provider ${res.status}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = allowedOrigins(env).includes(origin);

    if (request.method === 'OPTIONS') {
      return allowed ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    }
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!allowed) return json({ error: 'origin not allowed' }, 403);
    if (!env.ANTHROPIC_API_KEY && !env.OPENAI_COMPAT_BASE_URL) return json({ error: 'AI is not configured on this server' }, 503, origin);

    const raw = await request.text();
    if (raw.length > 8000) return json({ error: 'request too large' }, 413, origin);

    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'invalid JSON' }, 400, origin); }
    const { task, input, lang } = body || {};
    if (!TASKS.includes(task) || typeof input !== 'object' || input === null) {
      return json({ error: 'unknown task' }, 400, origin);
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (overVisitorLimit(ip, Number(env.PER_VISITOR_LIMIT || 30))) {
      return json({ error: 'Too many requests. Try again in a few minutes.' }, 429, origin);
    }
    if (await overDailyLimit(env)) {
      return json({ error: 'The AI has reached its limit for today. It resets at midnight UTC.' }, 429, origin);
    }

    try {
      const prompt = buildPrompt(task, input, lang === 'zh' ? 'zh' : 'en');
      const text = await askModel(env, prompt);
      return json({ text }, 200, origin);
    } catch (err) {
      return json({ error: 'The AI provider did not answer. Try again.' }, 502, origin);
    }
  },
};
