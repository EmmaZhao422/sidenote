import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, parseResolveReply } from '../js/prompts.js';

test('reads the TYPE line off a reply', () => {
  assert.deepEqual(parseResolveReply('TYPE: todo\n\nEmail her tonight.'), { category: 'todo', text: 'Email her tonight.' });
  assert.deepEqual(parseResolveReply('No type line here.'), { category: null, text: 'No type line here.' });
});

test('asks for the reply in the visitor\'s language', () => {
  assert.match(buildPrompt('resolve', { text: 'x' }, 'zh').system, /Simplified Chinese/);
  assert.match(buildPrompt('resolve', { text: 'x' }, 'en').system, /English/);
});

test('rejects unknown tasks', () => {
  assert.throws(() => buildPrompt('anything-else', {}, 'en'));
});

test('the recap prompt carries numbers, not the thoughts themselves', () => {
  const p = buildPrompt('recap', { stats: { sessions: 3, focusMinutes: 75 } }, 'en');
  assert.match(p.user, /"sessions":3/);
});
