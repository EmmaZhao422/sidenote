import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';

beforeEach(() => store._reset());

test('parking a thought trims it, sorts it and keeps it open', () => {
  const th = store.addThought('   Why is the sky blue?   ');
  assert.equal(th.text, 'Why is the sky blue?');
  assert.equal(th.category, 'question');
  assert.equal(th.status, 'open');
  assert.equal(store.addThought('   '), null);
  assert.equal(store.state.thoughts.length, 1);
});

test('very long thoughts are cut to 500 characters', () => {
  assert.equal(store.addThought('x'.repeat(900)).text.length, 500);
});

test('a backup never contains the API key, and restoring keeps the current one', () => {
  store.setAiSettings({ key: 'sk-secret' });
  store.addThought('Email Prof. Lin');
  const backup = store.exportJSON();
  assert.ok(!backup.includes('sk-secret'));

  store.clearAll();
  store.setAiSettings({ key: 'sk-other' });
  store.importJSON(backup);
  assert.equal(store.state.thoughts.length, 1);
  assert.equal(store.state.settings.ai.key, 'sk-other');
});

test('restoring rejects files that are not backups', () => {
  assert.throws(() => store.importJSON('{"hello":1}'));
  assert.throws(() => store.importJSON('not json'));
});

test('removing example data leaves real data alone', () => {
  store.addThought('real one');
  store.addSample([{ id: 's1', sample: true, startedAt: 1 }], [{ id: 't1', sample: true, text: 'x', createdAt: 1 }]);
  assert.equal(store.hasSample(), true);
  store.removeSample();
  assert.equal(store.hasSample(), false);
  assert.equal(store.state.thoughts.length, 1);
  assert.equal(store.state.sessions.length, 0);
});

test('old saved data without newer settings still loads', () => {
  store._reset({ settings: { lang: 'zh' }, thoughts: [], sessions: [] });
  assert.equal(store.state.settings.lang, 'zh');
  assert.equal(store.state.settings.focusMin, 25);
  assert.equal(store.state.settings.ai.provider, 'anthropic');
});
