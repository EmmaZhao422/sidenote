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
  }
  return data;
}

let state = load();

function load() {
  const s = storage();
  try {
    const text = s ? s.getItem(KEY) : memoryFallback;
    return normalise(text ? JSON.parse(text) : null);
  } catch {
    return normalise(null);
  }
}

function persist() {
  const text = JSON.stringify(state);
  const s = storage();
  try {
    if (s) s.setItem(KEY, text); else memoryFallback = text;
  } catch {
    memoryFallback = text; // storage full or blocked: keep working for this visit
  }
  listeners.forEach((fn) => fn(state));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const store = {
  get state() { return state; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // ---- settings ----
  setSettings(patch) {
    Object.assign(state.settings, patch);
    persist();
  },
  setAiSettings(patch) {
    Object.assign(state.settings.ai, patch);
    persist();
  },

  // ---- thoughts ----
  addThought(text, extra = {}) {
    const clean = String(text || '').trim().slice(0, 500);
    if (!clean) return null;
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
    const th = state.thoughts.find((x) => x.id === id);
    if (!th) return null;
    Object.assign(th, patch);
    persist();
    return th;
  },
  deleteThought(id) {
    state.thoughts = state.thoughts.filter((x) => x.id !== id);
    persist();
  },

  // ---- sessions ----
  addSession(session) {
    state.sessions.push(session);
    persist();
    return session;
  },
  setActive(active) {
    state.active = active;
    persist();
  },

  // ---- import / export / reset ----
  exportJSON() {
    const copy = clone(state);
    copy.settings.ai.key = ''; // never write an API key into a backup file
    copy.active = null;
    return JSON.stringify(copy, null, 2);
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
    state.sessions = state.sessions.filter((s) => !s.sample);
    state.thoughts = state.thoughts.filter((t) => !t.sample);
    persist();
  },
  addSample(sessions, thoughts) {
    state.sessions.push(...sessions);
    state.thoughts.push(...thoughts);
    persist();
  },

  // test helper
  _reset(raw) {
    state = normalise(raw || null);
    persist();
  },
};
