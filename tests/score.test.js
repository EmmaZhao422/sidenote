import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFocusScore, aggregate, rangeFor, recommendScene, similarScenes, breadthLabel, habit } from '../js/score.js';
import { buildSample } from '../js/sample.js';

const base = { focusSec: 1500, plannedMin: 25, rating: 5, finished: 'yes', pauses: 0, parkedCount: 0, mode: 'screen', steps: [] };

test('a clean, finished, well-rated block scores 100', () => {
  assert.equal(computeFocusScore(base).score, 100);
});

test('the score stays between 0 and 100 whatever happens', () => {
  const awful = { ...base, rating: 1, finished: 'no', pauses: 30, parkedCount: 80, mode: 'paper', awaySec: 1400, focusSec: 300 };
  const s = computeFocusScore(awful).score;
  assert.ok(s >= 0 && s <= 100, String(s));
  assert.ok(s < 30);
});

test('pauses lower the score', () => {
  const calm = computeFocusScore({ ...base, rating: 4 }).score;
  const busy = computeFocusScore({ ...base, rating: 4, pauses: 2 }).score;
  assert.ok(busy < calm);
});

test('parking thoughts never costs points', () => {
  const none = computeFocusScore({ ...base, rating: 4, parkedCount: 0 });
  const many = computeFocusScore({ ...base, rating: 4, parkedCount: 9 });
  assert.deepEqual(many, none);
});

test('a short block is not punished harder for one pause than a long one', () => {
  const short = computeFocusScore({ ...base, focusSec: 300, plannedMin: 5, pauses: 1 }).steady;
  const long = computeFocusScore({ ...base, focusSec: 1500, plannedMin: 25, pauses: 1 }).steady;
  assert.equal(short, long);
});

test('time away from the tab only counts when studying on paper', () => {
  const onScreen = computeFocusScore({ ...base, mode: 'screen', awaySec: 600 }).score;
  const onPaper = computeFocusScore({ ...base, mode: 'paper', awaySec: 600 }).score;
  assert.equal(onScreen, 100);
  assert.ok(onPaper < 100);
});

test('stopping early costs something', () => {
  assert.ok(computeFocusScore({ ...base, focusSec: 600 }).steady < 100);
});

test('unfinished steps lower the "done" part', () => {
  const half = computeFocusScore({ ...base, steps: [{ text: 'a', done: true }, { text: 'b', done: false }] });
  assert.equal(half.done, 75);
});

test('totals for a range add up', () => {
  const now = new Date(2026, 10, 20, 22, 0, 0).getTime();
  const { sessions, thoughts } = buildSample('en', now);
  const stats = aggregate({ sessions, thoughts }, rangeFor('30d', now));
  assert.equal(stats.sessionCount, sessions.length);
  assert.equal(stats.thoughtCount, thoughts.length);
  assert.equal(stats.byDay.length, 30);
  assert.equal(stats.byDay.reduce((a, d) => a + d.minutes, 0), stats.focusMin);
  assert.equal(Object.values(stats.byCategory).reduce((a, b) => a + b, 0), thoughts.length);
  assert.equal(stats.timing.reduce((a, b) => a + b, 0), thoughts.length);
  assert.ok(stats.avgScore > 0 && stats.avgScore <= 100);
  assert.ok(['narrow', 'medium', 'wide'].includes(breadthLabel(stats.breadth)));
});

test('today only counts today', () => {
  const now = new Date(2026, 10, 20, 22, 0, 0).getTime();
  const { sessions, thoughts } = buildSample('en', now);
  const stats = aggregate({ sessions, thoughts }, rangeFor('today', now));
  assert.equal(stats.sessionCount, 1);
});

test('no recommendation until three blocks are rated', () => {
  const rec = recommendScene([{ scene: 'rain', score: 90, focusSec: 1500 }]);
  assert.equal(rec.status, 'learning');
  assert.equal(rec.need, 2);
});

test('one lucky block does not beat a consistently good scene', () => {
  const sessions = [
    { scene: 'rain', score: 82, focusSec: 1500 }, { scene: 'rain', score: 84, focusSec: 1500 },
    { scene: 'rain', score: 80, focusSec: 1500 }, { scene: 'rain', score: 85, focusSec: 1500 },
    { scene: 'white', score: 60, focusSec: 1500 }, { scene: 'white', score: 58, focusSec: 1500 },
    { scene: 'fire', score: 86, focusSec: 1500 },
  ];
  const rec = recommendScene(sessions);
  assert.equal(rec.status, 'ready');
  assert.equal(rec.best.id, 'rain');
  assert.equal(rec.confidence, 'solid');
  assert.ok(rec.similar.length > 0);
  assert.ok(!rec.similar.includes('rain') && !rec.similar.includes('white') && !rec.similar.includes('fire'));
});

test('similar scenes share a character', () => {
  assert.deepEqual(similarScenes('brown', [], 1), ['library']);
  assert.ok(similarScenes('rain', [], 3).includes('forest'));
});

test('streak counts consecutive days and survives a day with no block yet', () => {
  const noon = (y, m, d) => new Date(y, m, d, 12, 0, 0).getTime();
  const block = (ts, min = 25) => ({ startedAt: ts, focusSec: min * 60 });
  const now = noon(2026, 10, 21);
  // blocks yesterday, the day before, and three days ago; none today
  const sessions = [block(noon(2026, 10, 20)), block(noon(2026, 10, 19), 45), block(noon(2026, 10, 18)), block(noon(2026, 10, 15))];
  let h = habit(sessions, now);
  assert.equal(h.streak, 3);
  assert.equal(h.todayMinutes, 0);
  assert.equal(h.week.length, 7);
  assert.equal(h.week[6].minutes, 0);
  assert.equal(h.week[5].minutes, 25);
  assert.equal(h.week[4].minutes, 45);
  // add one today
  h = habit([...sessions, block(now, 50)], now);
  assert.equal(h.streak, 4);
  assert.equal(h.todayMinutes, 50);
  assert.equal(h.todayBlocks, 1);
  // a gap of a full day breaks it
  assert.equal(habit([block(noon(2026, 10, 19))], now).streak, 0);
  assert.equal(habit([], now).streak, 0);
});
