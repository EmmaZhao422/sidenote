// Talks to an AI model, in one of three ways:
//
//   'site'     the site owner's Cloudflare Worker (CONFIG.ai.proxyUrl). The API
//              key stays on the server; the browser never sees it.
//   'own-key'  the visitor pasted their own API key in Settings. Requests go
//              straight from their browser to the provider.
//   'claude'   the site is running as a page inside the Claude app (a private
//              preview). Claude answers directly; no key is involved.
//   'offline'  no AI connected. The built-in helper sorts the thought and
//              suggests a next step, but cannot answer questions.

import { CONFIG } from './config.js';
import { store } from './store.js';
import { buildPrompt, parseResolveReply } from './prompts.js';
import { classify, looksLikeCrisis } from './classify.js';
import { getLang, t } from './i18n.js';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5';
const ANTHROPIC_VERSION = '2026-10-21';
const TIMEOUT_MS = 30000;

// Inside the Claude app, pages are handed a `claude.use('sample')` function that
// asks Claude. It arrives a moment after the page loads, or not at all.
let askClaude = null;

export function insideClaudeApp() {
  return typeof window !== 'undefined' && Boolean(window.claude && typeof window.claude.use === 'function');
}

export function connectClaudeApp(onReady) {
  if (!insideClaudeApp()) return;
  window.claude.use('sample').then((sample) => {
    if (!sample) return;
    askClaude = sample;
    onReady?.();
  }).catch(() => { /* not available in this view */ });
}

export function aiMode() {
  if (store.state.settings.ai.key) return 'own-key';
  if (askClaude) return 'claude';
  if (CONFIG.ai.proxyUrl) return 'site';
  return 'offline';
}

async function postJSON(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = (data.error && (data.error.message || data.error)) || res.statusText;
      const err = new Error(`${res.status} ${typeof detail === 'string' ? detail : ''}`.trim());
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function callModel(task, input) {
  const lang = getLang();
  const mode = aiMode();

  if (mode === 'site') {
    const data = await postJSON(CONFIG.ai.proxyUrl, {}, { task, input, lang });
    return String(data.text || '');
  }

  if (mode === 'claude') {
    const p = buildPrompt(task, input, lang);
    const reply = await askClaude(`${p.system}\n\n${p.user}`, { modelTier: 'quick', cache: false });
    return String((reply && reply.text) || '');
  }

  const ai = store.state.settings.ai;
  const prompt = buildPrompt(task, input, lang);

  if (ai.provider === 'openai-compatible') {
    const base = (ai.baseUrl || '').replace(/\/+$/, '');
    if (!base || !ai.model) throw new Error(t('ai.needBaseModel'));
    const data = await postJSON(`${base}/chat/completions`, { authorization: `Bearer ${ai.key}` }, {
      model: ai.model,
      max_tokens: prompt.maxTokens,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });
    return String(data.choices?.[0]?.message?.content || '');
  }

  // Anthropic Messages API, called directly from the visitor's browser with
  // the visitor's own key.
  const data = await postJSON('https://api.anthropic.com/v1/messages', {
    'x-api-key': ai.key,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  }, {
    model: ai.model || DEFAULT_ANTHROPIC_MODEL,
    max_tokens: prompt.maxTokens,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

// ---- the three things the app asks for ------------------------------------

// Returns { text, source: 'ai' | 'offline', category?, links? }
export async function resolveThought(thought, goal) {
  if (aiMode() === 'offline') return offlineReply(thought);
  const raw = await callModel('resolve', { text: thought.text, goal });
  const parsed = parseResolveReply(raw);
  if (!parsed.text) throw new Error(t('ai.empty'));
  return { text: parsed.text, source: 'ai', category: parsed.category };
}

export async function writeRecap(stats) {
  const text = (await callModel('recap', { stats })).trim();
  if (!text) throw new Error(t('ai.empty'));
  return text;
}

export async function suggestSteps(goal, minutes) {
  const raw = await callModel('plan', { goal, minutes });
  return raw.split('\n').map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 3);
}

export async function testConnection() {
  const steps = await suggestSteps('Read chapter 3 of my biology textbook', 25);
  return steps.length > 0;
}

// ---- the built-in helper, used when no AI is connected --------------------

export function offlineReply(thought) {
  if (looksLikeCrisis(thought.text)) {
    return { text: t('offline.crisis'), source: 'offline', category: 'worry' };
  }
  const category = thought.category || classify(thought.text);
  const links = [];
  if (category === 'question') {
    // Bing is reachable where Google is not, so Chinese-language visitors get that
    const engine = getLang() === 'zh' ? 'https://cn.bing.com/search?q=' : 'https://www.google.com/search?q=';
    links.push({ label: t('offline.search'), url: engine + encodeURIComponent(thought.text) });
  }
  return { text: t(`offline.${category}`), source: 'offline', category, links };
}
