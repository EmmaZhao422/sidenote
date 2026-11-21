// The AI proxy, tested with a fake provider so no real API call is made.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/worker.js';

const ORIGIN = 'https://emmazhao422.github.io';
const env = { ANTHROPIC_API_KEY: 'test-key', PER_VISITOR_LIMIT: '3' };
let calls = [];
let ipCounter = 0;

beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'TYPE: question\n\nBecause of Rayleigh scattering.' }] }), { status: 200 });
  };
});

function post(body, { origin = ORIGIN, ip } = {}) {
  return new Request('https://worker.example/', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': ip || `10.0.0.${++ipCounter}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('answers a valid request and keeps the key on the server side', async () => {
  const res = await worker.fetch(post({ task: 'resolve', input: { text: 'Why is the sky blue?' }, lang: 'en' }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  const data = await res.json();
  assert.match(data.text, /Rayleigh/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].init.headers['x-api-key'], 'test-key');
  assert.equal(calls[0].body.model, 'claude-haiku-5-5');
  assert.ok(calls[0].body.max_tokens <= 500);
  assert.ok(!JSON.stringify(data).includes('test-key'));
});

test('refuses other websites', async () => {
  const res = await worker.fetch(post({ task: 'resolve', input: { text: 'hi' } }, { origin: 'https://evil.example' }), env);
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test('refuses anything that is not one of the three tasks', async () => {
  const res = await worker.fetch(post({ task: 'chat', input: { text: 'write my essay' } }), env);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('refuses oversized and malformed requests', async () => {
  assert.equal((await worker.fetch(post({ task: 'resolve', input: { text: 'x'.repeat(9000) } }), env)).status, 413);
  assert.equal((await worker.fetch(post('{not json'), env)).status, 400);
  assert.equal(calls.length, 0);
});

test('caps how much of a thought reaches the model', async () => {
  await worker.fetch(post({ task: 'resolve', input: { text: 'y'.repeat(3000) } }), env);
  const sent = calls[0].body.messages[0].content;
  assert.ok(sent.length < 700, String(sent.length));
});

test('slows down a visitor who sends too many requests', async () => {
  const ip = '10.9.9.9';
  const statuses = [];
  for (let i = 0; i < 5; i++) {
    statuses.push((await worker.fetch(post({ task: 'plan', input: { goal: 'read ch. 3', minutes: 25 } }, { ip }), env)).status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
});

test('says so when no key is configured', async () => {
  const res = await worker.fetch(post({ task: 'resolve', input: { text: 'hi' } }), {});
  assert.equal(res.status, 503);
});

test('answers the browser preflight check', async () => {
  const res = await worker.fetch(new Request('https://worker.example/', { method: 'OPTIONS', headers: { origin: ORIGIN } }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});
