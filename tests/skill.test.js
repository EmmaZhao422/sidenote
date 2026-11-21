// The Claude skill in /skill must agree with the website and stay packaged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSample } from '../js/sample.js';
import { aggregate, rangeFor, recommendScene } from '../js/score.js';
import { SCENES } from '../js/scenes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'skill', 'sidenote-coach', 'scripts', 'sidenote_stats.py');

function backupFile(now) {
  const { sessions, thoughts } = buildSample('en', now);
  sessions.forEach((s) => delete s.sample);
  thoughts.forEach((t) => delete t.sample);
  const file = join(mkdtempSync(join(tmpdir(), 'sidenote-')), 'backup.json');
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  writeFileSync(file, JSON.stringify({ version: 1, app: 'sidenote', exportedAt: now, tzOffsetMinutes, thoughts, sessions }));
  return { file, sessions, thoughts };
}

const run = (...args) => JSON.parse(execFileSync('python3', [script, ...args], { encoding: 'utf8' }));

test('the skill script reports the same numbers as the website summary', () => {
  const now = new Date(2026, 10, 20, 22, 0, 0).getTime();
  const { file, sessions, thoughts } = backupFile(now);
  for (const [days, key] of [[7, '7d'], [30, '30d'], [0, 'all']]) {
    const py = run(file, '--days', String(days));
    const js = aggregate({ sessions, thoughts }, rangeFor(key, now));
    assert.equal(py.blocks, js.sessionCount, `blocks, ${key}`);
    assert.equal(py.focusMinutes, js.focusMin, `focus minutes, ${key}`);
    assert.equal(py.averageFocusScore, js.avgScore, `average score, ${key}`);
    assert.equal(py.strayThoughts, js.thoughtCount, `thoughts, ${key}`);
    assert.equal(py.strayThoughtsDuringBlocksPer25Minutes, js.wanderPer25, `per 25, ${key}`);
    assert.deepEqual(py.thoughtKinds, js.byCategory, `kinds, ${key}`);
    assert.deepEqual(Object.values(py.thoughtsByMinuteOfBlock), js.timing, `timing, ${key}`);
    assert.equal(py.parkedInPeriodStillWaiting, js.openCount, `waiting, ${key}`);
    assert.equal(py.longestBlockMinutes, js.longestMin, `longest, ${key}`);
  }
});

test('the skill script recommends the same scene as the website', () => {
  const now = new Date(2026, 10, 20, 22, 0, 0).getTime();
  const { file, sessions } = backupFile(now);
  const py = run(file, '--days', '0');
  const js = recommendScene(sessions);
  assert.equal(py.sceneRecommendation.status, 'ready');
  assert.equal(py.sceneRecommendation.best, SCENES.find((s) => s.id === js.best.id).en);
  assert.equal(py.sceneRecommendation.bestAverageScore, js.best.avg);
  assert.deepEqual(py.sceneRecommendation.similarUntriedScenes, js.similar.map((id) => SCENES.find((s) => s.id === id).en));
});

test('the skill script lists exactly the thoughts still waiting', () => {
  const now = new Date(2026, 10, 20, 22, 0, 0).getTime();
  const { file, thoughts } = backupFile(now);
  const py = run(file, '--thoughts');
  assert.equal(py.count, thoughts.filter((t) => t.status !== 'done').length);
  assert.ok(py.waitingThoughts.every((t) => t.text && t.kind && t.parkedOn));
});

test('the skill script survives messy files and explains demo-only ones', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidenote-'));
  const messy = join(dir, 'messy.json');
  writeFileSync(messy, JSON.stringify({
    thoughts: [null, 'x', { text: 'no dates', category: null }, { text: 'bad date', createdAt: 'yesterday', status: 'open' }],
    sessions: [null, { startedAt: 'never' }, { startedAt: Date.now() - 1000, focusSec: 60, score: 70, scene: 'rain' }],
  }));
  const a = run(messy, '--thoughts');
  assert.equal(a.count, 2);
  assert.ok(a.waitingThoughts.every((t) => t.kind === 'other'));
  const b = run(messy, '--days', '0');
  assert.equal(b.blocks, 1);
  assert.equal(b.strayThoughtsDuringBlocksPer25Minutes, null);
  assert.equal(b.waitingNow, 2);

  const demo = join(dir, 'demo.json');
  const { sessions, thoughts } = buildSample('zh', Date.now());
  writeFileSync(demo, JSON.stringify({ settings: { lang: 'zh' }, thoughts, sessions }));
  const c = run(demo, '--thoughts');
  assert.equal(c.count, 0);
  assert.match(c.note, /only the website's demo data/);
  assert.equal(c.language, 'zh');
});

test('scene names follow the language of the backup', () => {
  const now = Date.now();
  const { sessions, thoughts } = buildSample('zh', now);
  sessions.forEach((s) => delete s.sample);
  thoughts.forEach((t) => delete t.sample);
  const file = join(mkdtempSync(join(tmpdir(), 'sidenote-')), 'zh.json');
  writeFileSync(file, JSON.stringify({ settings: { lang: 'zh' }, exportedAt: now, tzOffsetMinutes: 0, thoughts, sessions }));
  const py = run(file, '--days', '0');
  const js = recommendScene(sessions);
  assert.equal(py.sceneRecommendation.best, SCENES.find((s) => s.id === js.best.id).zh);
  for (const s of SCENES) assert.match(readFileSync(script, 'utf8'), new RegExp(`"${s.id}": "${s.zh}"`), `zh name of ${s.id}`);
});

test('the scene table in the skill matches the website', () => {
  const src = readFileSync(script, 'utf8');
  for (const s of SCENES) {
    const t = s.traits;
    const line = new RegExp(`\\("${s.id}",\\s*\\{"name": "${s.en}",\\s*"steady": ${t.steady.toFixed(1)}, "nature": ${t.nature.toFixed(1)}, "low": ${t.low.toFixed(1)}, "rhythm": ${t.rhythm.toFixed(1)}, "bright": ${t.bright.toFixed(1)}\\}\\)`);
    assert.match(src, line, `scene ${s.id}`);
  }
});

test('the script refuses files that are not backups', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'sidenote-')), 'x.json');
  writeFileSync(file, '{"hello":1}');
  assert.throws(() => execFileSync('python3', [script, file], { encoding: 'utf8', stdio: 'pipe' }));
});

test('skill/sidenote-coach.zip is up to date with the skill folder', () => {
  execFileSync('python3', [join(root, 'tools', 'package_skill.py'), '--check'], { encoding: 'utf8' });
});

test('three blocks with one sound are not enough to name a favourite, on the site or in the skill', () => {
  const now = Date.now();
  const sessions = [1, 2, 3].map((i) => ({ id: `s${i}`, startedAt: now - i * 3600000, focusSec: 1500, plannedMin: 25, scene: 'rain', score: 80, rating: 4, finished: 'yes', pauses: 0 }));
  const js = recommendScene(sessions);
  assert.equal(js.status, 'learning');
  assert.equal(js.oneScene, true);
  const file = join(mkdtempSync(join(tmpdir(), 'sidenote-')), 'one.json');
  writeFileSync(file, JSON.stringify({ exportedAt: now, tzOffsetMinutes: 0, thoughts: [], sessions }));
  const py = run(file, '--days', '0');
  assert.equal(py.sceneRecommendation.status, 'not enough data');
  assert.equal(py.sceneRecommendation.scenesTried, 1);
});

test('a damaged backup gives one plain line, not a traceback', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'sidenote-')), 'bad.json');
  writeFileSync(file, '{"thoughts":[{"text":"x","createdAt":1e300}],"sessions":[{"startedAt":1795000000000,"finished":["a"],"scene":["a"],"focusSec":"abc","score":150}],"exportedAt":1e20}');
  const res = spawnSync('python3', [script, file, '--days', '0'], { encoding: 'utf8' });
  assert.ok(!/Traceback/.test(res.stderr + res.stdout), res.stderr);
  assert.ok(res.status === 0 || /Could not read this backup/.test(res.stderr));
});

test('the skill ranks scenes over every rated block, like the website, whatever --days says', () => {
  const now = Date.now();
  const { sessions, thoughts } = buildSample('en', now);
  sessions.forEach((s) => delete s.sample);
  thoughts.forEach((t) => delete t.sample);
  const file = join(mkdtempSync(join(tmpdir(), 'sidenote-')), 'all.json');
  writeFileSync(file, JSON.stringify({ settings: { lang: 'en' }, exportedAt: now, tzOffsetMinutes: new Date().getTimezoneOffset(), thoughts, sessions }));
  const js = recommendScene(sessions);
  for (const days of ['2', '7', '30']) {
    const py = run(file, '--days', days);
    assert.equal(py.sceneRecommendation.best, SCENES.find((s) => s.id === js.best.id).en, `--days ${days}`);
  }
});

test('a block keeps its own local day even if the clocks changed before the backup was made', () => {
  // 00:30 local time on a summer-time day (UTC-4), exported later in winter time (UTC-5)
  const startedAt = Date.UTC(2026, 9, 26, 4, 30);
  const file = join(mkdtempSync(join(tmpdir(), 'sidenote-')), 'dst.json');
  writeFileSync(file, JSON.stringify({
    exportedAt: Date.UTC(2026, 10, 20, 15, 0), tzOffsetMinutes: 300, thoughts: [],
    sessions: [{ id: 'a', startedAt, tzOffsetMinutes: 240, focusSec: 1500, plannedMin: 25, score: 80, scene: 'rain', goal: 'x' }],
  }));
  const py = run(file, '--days', '0');
  assert.deepEqual(Object.keys(py.focusMinutesPerDay), ['2026-10-26']);
});
