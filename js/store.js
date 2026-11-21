// All of a visitor's data lives in their own browser (localStorage) under one
// key. There is no account and no server database: nothing a student parks here
// leaves their device unless they ask the AI to look at a thought.

import { classify } from './classify.js';

const KEY = 'sidenote.v1';

const DEFAULTS = {
  version: 1,
  settings: {
    lang: '',            // '' = follow the browser
    theme: 'auto',       // 'auto' | 'light' | 'dark'
    focusMin: 25,
    prepMin: 5,
    scene: 'rain',
    volume: 0.6,
    studyMode: 'paper',  // 'paper' = leaving this tab counts as drifting; 'screen' = it doesn't
    chime: true,
    notify: false,       // system notification when a block ends in a background tab
    ai: { provider: 'anthropic', key: '', baseUrl: '', model: '' },
  },
  thoughts: [],
  sessions: [],
  active: null,          // a focus session in progress, so a reload doesn't lose it
  nextPlan: [],          // steps queued for the next block
};

let memoryFallback = null;
const listeners = new Set();

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* blocked (private mode, sandboxed frame) */ }
  return null;
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function normalise(raw) {
  const data = clone(DEFAULTS);
  if (raw && typeof raw === 'object') {
    Object.assign(data.settings, raw.settings || {});
    data.settings.ai = Object.assign(clone(DEFAULTS.settings.ai), (raw.settings && raw.settings.ai) || {});
    if (Array.isArray(raw.thoughts)) data.thoughts = raw.thoughts;
    if (Array.isArray(raw.sessions)) data.sessions = raw.sessions;
    if (raw.active && typeof raw.active === 'object') data.active = raw.active;
    if (Array.isArray(raw.nextPlan)) data.nextPlan = raw.nextPlan.slice(0, 3);
  }
  return data;
}

let lastWritten = null;      // the exact text this tab last read or wrote
let storageFailed = false;   // true once a save could not reach localStorage

function readRaw() {
  const s = storage();
  try {
    return s ? s.getItem(KEY) : memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function load() {
  try {
    const text = readRaw();
    lastWritten = text;
    return normalise(text ? JSON.parse(text) : null);
  } catch {
    return normalise(null);
  }
}

let state = load();

// Another tab may have saved since this one last looked. Every change starts by
// picking up the newest copy, so one tab never writes its stale view over
// another tab's thoughts.
function refresh() {
  const text = readRaw();
  if (text === lastWritten) return;
  try {
    state = normalise(text ? JSON.parse(text) : null);
    lastWritten = text;
  } catch { /* unreadable: keep what we have */ }
}

function persist() {
  const text = JSON.stringify(state);
  const s = storage();
  try {
    if (s) s.setItem(KEY, text); else memoryFallback = text;
  } catch {
    // Storage is full or blocked: keep working for this visit, and say so once
    memoryFallback = text;
    if (!storageFailed) {
      storageFailed = true;
      failListeners.forEach((fn) => fn());
    }
  }
  lastWritten = text;
  listeners.forEach((fn) => fn(state));
}

const failListeners = new Set();

// When another tab saves, pick the change up and tell this tab's screens
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    refresh();
    listeners.forEach((fn) => fn(state, { external: true }));
  });
}

// One id per browser tab (kept across reloads), so a study block has one owner
function thisTab() {
  try {
    let id = sessionStorage.getItem('sidenote.tab');
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('sidenote.tab', id);
    }
    return id;
  } catch {
    return 'tab';
  }
}
export const TAB_ID = typeof window !== 'undefined' ? thisTab() : 'node';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const store = {
  get state() { return state; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Called once if saving to the browser stops working (storage full or blocked)
  onStorageFailure(fn) {
    failListeners.add(fn);
  },

  // Asks the browser not to clear this site's data when space runs low.
  // Safari can otherwise delete it after a week without a visit.
  keepData() {
    try { navigator.storage?.persist?.().catch(() => {}); } catch { /* not supported */ }
  },

  // Queue of steps for the next study block (to-dos sent there from the margin)
  addToNextPlan(text) {
    refresh();
    const list = state.nextPlan || [];
    if (!list.includes(text) && list.length < 3) list.push(text);
    state.nextPlan = list;
    persist();
    return list.length;
  },
  takeNextPlan() {
    refresh();
    const list = state.nextPlan || [];
    if (list.length) { state.nextPlan = []; persist(); }
    return list;
  },

  // ---- settings ----
  setSettings(patch) {
    refresh();
    Object.assign(state.settings, patch);
    persist();
  },
  setAiSettings(patch) {
    refresh();
    Object.assign(state.settings.ai, patch);
    persist();
  },

  // ---- thoughts ----
  addThought(text, extra = {}) {
    const clean = String(text || '').trim().slice(0, 500);
    if (!clean) return null;
    refresh();
    const thought = {
      id: uid(),
      text: clean,
      createdAt: Date.now(),
      sessionId: null,
      offsetSec: null,       // seconds into the focus block when it was parked
      category: classify(clean),
      status: 'open',        // 'open' | 'done'
      reply: null,           // { text, source: 'ai' | 'offline', at }
      ...extra,
    };
    state.thoughts.push(thought);
    persist();
    return thought;
  },
  updateThought(id, patch) {
    refresh();
    const th = state.thoughts.find((x) => x.id === id);
    if (!th) return null;
    Object.assign(th, patch);
    persist();
    return th;
  },
  deleteThought(id) {
    refresh();
    state.thoughts = state.thoughts.filter((x) => x.id !== id);
    persist();
  },

  // ---- sessions ----
  addSession(session) {
    refresh();
    state.sessions.push(session);
    persist();
    return session;
  },
  setActive(active) {
    refresh();
    state.active = active;
    persist();
  },

  // ---- import / export / reset ----
  exportJSON() {
    const copy = clone(state);
    copy.settings.ai.key = ''; // never write an API key into a backup file
    copy.active = null;
    // Extra facts for anything that reads the file later (the Claude skill in /skill)
    copy.app = 'sidenote';
    copy.exportedAt = Date.now();
    copy.tzOffsetMinutes = new Date().getTimezoneOffset();
    return JSON.stringify(copy, null, 2);
  },
  // Looks inside a backup without changing anything: { sessions, thoughts }
  peekJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.thoughts) || !Array.isArray(parsed.sessions)) {
      throw new Error('not a Sidenote backup');
    }
    return { sessions: parsed.sessions.length, thoughts: parsed.thoughts.length };
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.thoughts) || !Array.isArray(parsed.sessions)) {
      throw new Error('not a Sidenote backup');
    }
    const key = state.settings.ai.key;
    state = normalise(parsed);
    state.settings.ai.key = key;
    state.active = null;
    persist();
  },
  clearAll() {
    state = normalise(null);
    persist();
  },

  // ---- sample data, so a new visitor can see what the summary looks like ----
  hasSample() {
    return state.sessions.some((s) => s.sample) || state.thoughts.some((t) => t.sample);
  },
  removeSample() {
    refresh();
    state.sessions = state.sessions.filter((s) => !s.sample);
    state.thoughts = state.thoughts.filter((t) => !t.sample);
    persist();
  },
  addSample(sessions, thoughts) {
    refresh();
    state.sessions.push(...sessions);
    state.thoughts.push(...thoughts);
    persist();
  },

  // test helper
  _reset(raw) {
    state = normalise(raw || null);
    persist();
  },
  // test helper: pretend another tab saved this
  _externalWrite(raw) {
    memoryFallback = JSON.stringify(normalise(raw));
    const st = storage();
    if (st) st.setItem(KEY, memoryFallback);
  },
};
