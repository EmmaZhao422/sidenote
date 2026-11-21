// Every t('...') key used in the code must exist in both languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICT } from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'js');
const files = [...readdirSync(root), ...readdirSync(join(root, 'views')).map((f) => join('views', f))]
  .filter((f) => f.endsWith('.js') && f !== 'i18n.js');

const used = new Set();
for (const f of files) {
  const src = readFileSync(join(root, f), 'utf8');
  for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.-]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
}
const html = readFileSync(join(root, '..', 'index.html'), 'utf8');
for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);

test('every key used in the code exists in English and Chinese', () => {
  const missing = [];
  for (const key of used) {
    for (const lang of ['en', 'zh']) if (!(key in DICT[lang])) missing.push(`${lang}: ${key}`);
  }
  assert.deepEqual(missing, []);
});

test('English and Chinese define the same keys', () => {
  const en = Object.keys(DICT.en).sort();
  const zh = Object.keys(DICT.zh).sort();
  assert.deepEqual(en.filter((k) => !zh.includes(k)), [], 'missing in zh');
  assert.deepEqual(zh.filter((k) => !en.includes(k)), [], 'missing in en');
});

test('keys built at runtime exist too', () => {
  const dynamic = [
    ...['question', 'todo', 'worry', 'idea', 'urge', 'other'].flatMap((c) => [`cat.${c}`, `offline.${c}`]),
    ...[1, 2, 3, 4].flatMap((n) => [`home.how${n}.title`, `home.how${n}.body`]),
    ...[1, 2, 3, 4, 5].map((n) => `wrap.rating${n}`),
    ...[1, 2, 3].map((n) => `prep.step${n}`),
    'setup.modeHint.paper', 'setup.modeHint.screen',
    ...['up', 'down', 'flat'].flatMap((x) => [`recap.trend.${x}`, `summary.trend.${x}`]),
    ...['narrow', 'medium', 'wide'].map((x) => `recap.breadth.${x}`),
    ...['offline', 'site', 'own-key'].map((x) => `settings.ai.status.${x}`),
  ];
  for (const key of dynamic) {
    assert.ok(key in DICT.en, `en: ${key}`);
    assert.ok(key in DICT.zh, `zh: ${key}`);
  }
});
