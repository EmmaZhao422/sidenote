import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, sessionsToCsv } from '../js/csv.js';

test('cells with commas, quotes and line breaks are quoted', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a, b'), '"a, b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell(null), '');
});

test('a goal that looks like a formula is written as text, numbers are left alone', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(csvCell('+1 chapter'), "'+1 chapter");
  assert.equal(csvCell(-5), '-5');
  assert.equal(csvCell(92), '92');
});

test('one row per block, oldest first, with a header', () => {
  const csv = sessionsToCsv([
    { startedAt: new Date(2026, 10, 21, 9, 5).getTime(), goal: '线性代数, 第 3 章', plannedMin: 25, focusSec: 1500, score: 88, rating: 4, finished: 'yes', scene: 'rain', pauses: 1, parkedCount: 2 },
    { startedAt: new Date(2026, 10, 20, 20, 0).getTime(), goal: '', plannedMin: 45, focusSec: 2700, score: 70, rating: 3, finished: 'partly', scene: 'brown', pauses: 0, parkedCount: 0 },
  ]);
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('date,start,goal'));
  assert.equal(lines[1], '2026-11-20,20:00,,45,45,70,3,partly,Brown noise,0,0');
  assert.equal(lines[2], '2026-11-21,09:05,"线性代数, 第 3 章",25,25,88,4,yes,Rain on the window,1,2');
});
