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

test('a change made in another tab is kept, not overwritten', () => {
  store.addThought('from this tab');
  // another tab saves a copy that also contains its own thought
  const other = JSON.parse(JSON.stringify(store.state));
  other.thoughts.push({ id: 'other-1', text: 'from the other tab', createdAt: 5, status: 'open', category: 'other' });
  store._externalWrite(other);
  // this tab now parks one more: all three must survive
  store.addThought('second from this tab');
  const texts = store.state.thoughts.map((t) => t.text);
  assert.deepEqual(texts, ['from this tab', 'from the other tab', 'second from this tab']);
});

test('steps queued for the next block are handed over once', () => {
  store.addToNextPlan('Email Prof. Lin');
  store.addToNextPlan('Email Prof. Lin');
  store.addToNextPlan('Print the worksheet');
  assert.deepEqual(store.takeNextPlan(), ['Email Prof. Lin', 'Print the worksheet']);
  assert.deepEqual(store.takeNextPlan(), []);
});

test('a backup can be inspected before it replaces anything', () => {
  store.addThought('keep me');
  const backup = store.exportJSON();
  assert.deepEqual(store.peekJSON(backup), { sessions: 0, thoughts: 1 });
  assert.throws(() => store.peekJSON('{"x":1}'));
});

test('what was saved is there after the page is loaded again', async () => {
  const box = new Map();
  globalThis.localStorage = { getItem: (k) => (box.has(k) ? box.get(k) : null), setItem: (k, v) => box.set(k, String(v)), removeItem: (k) => box.delete(k) };
  try {
    const first = await import('../js/store.js?visit=1');
    first.store.addThought('survives a reload');
    const second = await import('../js/store.js?visit=2');
    assert.ok(second.store.state.thoughts.some((t) => t.text === 'survives a reload'));
  } finally {
    delete globalThis.localStorage;
  }
});
