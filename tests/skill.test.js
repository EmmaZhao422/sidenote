// The Claude skill in /skill must agree with the website and stay packaged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
    assert.equal(py.strayThoughtsPer25Minutes, js.wanderPer25, `per 25, ${key}`);
    assert.deepEqual(py.thoughtKinds, js.byCategory, `kinds, ${key}`);
    assert.deepEqual(Object.values(py.thoughtsByMinuteOfBlock), js.timing, `timing, ${key}`);
    assert.equal(py.thoughtsStillWaiting, js.openCount, `waiting, ${key}`);
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
