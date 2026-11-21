import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('the offline list names every script the app loads', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const listed = new Set([...sw.matchAll(/'(js\/[\w/.-]+\.js|css\/[\w.-]+\.css)'/g)].map((m) => m[1]));
  const onDisk = [
    ...readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync(new URL('../js/views/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `js/views/${f}`),
    ...readdirSync(new URL('../css/', import.meta.url)).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`),
  ];
  for (const file of onDisk) assert.ok(listed.has(file), `${file} is missing from SHELL in sw.js`);
  for (const file of listed) assert.ok(onDisk.includes(file), `${file} is listed in sw.js but does not exist`);
});
