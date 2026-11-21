// All of a visitor's data lives in their own browser (localStorage) under one
// key. There is no account and no server database: nothing a student parks here
// leaves their device unless they ask the AI to look at a thought.

import { classify, CATEGORIES } from './classify.js';
import { computeFocusScore } from './score.js';

const KEY = 'sidenote.v1';
const BEAT_KEY = 'sidenote.beat';   // the running block's heartbeat, kept apart so it never triggers redraws
const KEY_KEY = 'sidenote.key';     // the visitor's own API key, for this browser session only

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
    // remember: false = the key lives only until the browser is closed (the default)
    // keyGen goes up every time the key is set, removed or erased, in any tab. A tab
    // holding a key from an older generation drops it instead of writing it back.
    ai: { provider: 'anthropic', key: '', baseUrl: '', model: '', remember: false, keyGen: 0 },
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
    // Settings come from this browser's storage or from a backup file someone picked:
    // either can hold anything, so each known field is checked and odd keys are left out.
    const given = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    for (const [k, v] of Object.entries(given)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype' || k === 'ai') continue;
      data.settings[k] = v;
    }
    const st = data.settings;
    const d = DEFAULTS.settings;
    if (!['', 'en', 'zh'].includes(st.lang)) st.lang = d.lang;
    if (!['auto', 'light', 'dark'].includes(st.theme)) st.theme = d.theme;
    if (!(isNum(st.focusMin) && st.focusMin >= 1 && st.focusMin <= 600)) st.focusMin = d.focusMin;
    if (!(isNum(st.prepMin) && st.prepMin >= 0 && st.prepMin <= 60)) st.prepMin = d.prepMin;
    if (!(isNum(st.volume) && st.volume >= 0 && st.volume <= 1)) st.volume = d.volume;
    if (typeof st.scene !== 'string') st.scene = d.scene;
    if (st.studyMode !== 'screen') st.studyMode = 'paper';
    st.chime = st.chime !== false;
    st.notify = st.notify === true;
    const dl = st.deadline;
    st.deadline = dl && typeof dl === 'object' && typeof dl.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(dl.date)
      ? { label: typeof dl.label === 'string' ? dl.label.slice(0, 40) : '', date: dl.date } : null;
    data.settings.ai = Object.assign(clone(DEFAULTS.settings.ai), (given.ai && typeof given.ai === 'object') ? given.ai : {});
    // a key saved by an older version stays remembered, so nothing stops working
    if (data.settings.ai.key && (!given.ai || given.ai.remember === undefined)) data.settings.ai.remember = true;
    if (Array.isArray(raw.thoughts)) data.thoughts = raw.thoughts.filter((t) => t && typeof t === 'object').slice(-MAX_RECORDS).map(fixThought);
    if (Array.isArray(raw.sessions)) data.sessions = raw.sessions.filter((x) => x && typeof x === 'object').slice(-MAX_RECORDS).map(fixSession);
    if (raw.active && typeof raw.active === 'object') data.active = raw.active;
    if (Array.isArray(raw.nextPlan)) data.nextPlan = raw.nextPlan.filter((x) => typeof x === 'string').slice(0, 6);
    // "In your next block" is only true while the plan (or the block in progress)
    // really holds the to-do, and it never goes together with a day.
    const held = new Set([...data.nextPlan, ...((data.active && Array.isArray(data.active.carried)) ? data.active.carried : [])]);
    data.thoughts.forEach((x) => { if (x.queued && (x.due || !held.has(x.text))) x.queued = false; });
  }
  return data;
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

// Far more than years of daily use; a file with more than this is not a real backup,
// and the screens that list everything would stop responding.
const MAX_RECORDS = 5000;
const cut = (text, n) => (text.length > n ? Array.from(text).slice(0, n).join('') : text);

// The only links a reply ever carries are the ones this site makes itself: a web
// search, or a hand-off to an AI chat. A backup file is not allowed to add others.
const LINK_HOSTS = ['claude.ai', 'chatgpt.com', 'www.google.com', 'www.bing.com', 'cn.bing.com'];
function fixLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.filter((l) => {
    if (!l || typeof l !== 'object' || typeof l.url !== 'string' || typeof l.label !== 'string') return false;
    try { const u = new URL(l.url); return u.protocol === 'https:' && LINK_HOSTS.includes(u.hostname); } catch { return false; }
  }).slice(0, 4).map((l) => ({ url: l.url, label: cut(l.label, 80), ...(l.kind === 'ai' || l.kind === 'search' ? { kind: l.kind } : {}) }));
}

// Records from an older version, or edited by hand, may lack fields the screens read
function fixThought(t) {
  const text = cut(typeof t.text === 'string' ? t.text : String(t.text ?? ''), 500);
  const r = t.reply && typeof t.reply === 'object' && typeof t.reply.text === 'string' ? t.reply : null;
  return {
    ...t,
    id: typeof t.id === 'string' ? t.id : uid(),
    text,
    createdAt: isNum(t.createdAt) ? t.createdAt : Date.now(),
    status: t.status === 'done' ? 'done' : 'open',
    category: CATEGORIES.includes(t.category) ? t.category : classify(text),
    sessionId: typeof t.sessionId === 'string' ? t.sessionId : null,
    offsetSec: isNum(t.offsetSec) ? t.offsetSec : null,
    reply: r ? { text: cut(r.text, 6000), source: r.source === 'ai' ? 'ai' : 'offline', links: fixLinks(r.links), at: isNum(r.at) ? r.at : 0 } : null,
  };
}

function fixSession(x) {
  const s = {
    ...x,
    id: typeof x.id === 'string' ? x.id : uid(),
    startedAt: isNum(x.startedAt) ? x.startedAt : Date.now(),
    focusSec: isNum(x.focusSec) && x.focusSec > 0 ? x.focusSec : 0,
    plannedMin: isNum(x.plannedMin) && x.plannedMin > 0 ? x.plannedMin : Math.max(1, Math.round((isNum(x.focusSec) ? x.focusSec : 0) / 60)),
    pauses: isNum(x.pauses) && x.pauses > 0 ? x.pauses : 0,
    awaySec: isNum(x.awaySec) && x.awaySec > 0 ? x.awaySec : 0,
    parkedCount: isNum(x.parkedCount) && x.parkedCount > 0 ? x.parkedCount : 0,
    goal: typeof x.goal === 'string' ? cut(x.goal, 200) : '',
    scene: typeof x.scene === 'string' ? x.scene : 'silence',
    steps: Array.isArray(x.steps) ? x.steps.filter((st) => st && typeof st.text === 'string').slice(0, 12) : [],
  };
  if (!isNum(s.score) || !s.parts || typeof s.parts !== 'object') {
    s.parts = computeFocusScore(s);
    s.score = s.parts.score;
  }
  return s;
}

let lastWritten = null;      // the exact text this tab last read or wrote
let storageFailed = false;   // true once a save could not reach localStorage

let unreadable = false;      // true if the saved data could not be read at start-up

function readRaw() {
  // Once a save has failed, the newest copy is the one in memory, not the one on disk
  if (storageFailed) return memoryFallback;
  const s = storage();
  try {
    return s ? s.getItem(KEY) : memoryFallback;
  } catch {
    return memoryFallback;
  }
}

// The API key is kept out of the saved data unless the visitor asked for it to be remembered
// It is stored with the generation it belongs to, so a key removed in another tab
// is not picked up again here after a reload.
function sessionKey(value, gen = 0) {
  try {
    if (value === undefined) {
      const saved = sessionStorage.getItem(KEY_KEY) || '';
      const cut = saved.indexOf(':');
      const tagged = cut > 0 && /^\d+$/.test(saved.slice(0, cut));
      if (!tagged) return saved; // saved by the previous version: keep it, it is re-saved with its generation
      return Number(saved.slice(0, cut)) === gen ? saved.slice(cut + 1) : '';
    }
    if (value) sessionStorage.setItem(KEY_KEY, `${gen}:${value}`); else sessionStorage.removeItem(KEY_KEY);
  } catch { /* no session storage: the key lasts until the page is closed */ }
  return value || '';
}

function hydrate(data) {
  if (!data.settings.ai.key) data.settings.ai.key = sessionKey(undefined, data.settings.ai.keyGen || 0);
  return data;
}

function load() {
  let text = null;
  try {
    text = readRaw();
    lastWritten = text;
    return hydrate(normalise(text ? JSON.parse(text) : null));
  } catch {
    // Damaged data is set aside, never overwritten: it can often be repaired by hand
    unreadable = true;
    try { if (text) storage().setItem(`${KEY}.unreadable-${Date.now()}`, text); } catch { /* no room for a copy */ }
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
    const { key, keyGen } = state.settings.ai;
    state = normalise(text ? JSON.parse(text) : null);
    // This tab's key (kept in memory, not on disk) carries over only if no tab has
    // set, removed or erased the key since. Otherwise what is on disk wins.
    if (!state.settings.ai.key && (state.settings.ai.keyGen || 0) === (keyGen || 0)) state.settings.ai.key = key;
    lastWritten = text;
  } catch { /* unreadable: keep what we have */ }
}

function persist() {
  const ai = state.settings.ai;
  sessionKey(ai.key, ai.keyGen || 0);
  // what goes to disk: everything, minus the key unless it is to be remembered
  const text = JSON.stringify(ai.remember ? state : { ...state, settings: { ...state.settings, ai: { ...ai, key: '' } } });
  const s = storage();
  try {
    if (!s) throw new Error('no storage');
    s.setItem(KEY, text);
    storageFailed = false; // room again (or storage is back): saving has recovered
  } catch {
    // Storage is full or blocked: keep working from memory for this visit, and say so
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

  // Called if saving to the browser stops working (storage full or blocked).
  // Called straight away if it is already not working.
  onStorageFailure(fn) {
    failListeners.add(fn);
    if (storageFailed || (typeof window !== 'undefined' && !storage())) fn();
  },
  get savingWorks() { return !storageFailed && Boolean(storage()); },
  // True if the saved data was damaged when the page opened (a copy was set aside)
  get foundUnreadable() { return unreadable; },
  // The newest copy that was set aside because it could not be read
  unreadableCopy() {
    try {
      const s = storage();
      const keys = [];
      for (let i = 0; i < s.length; i += 1) { const k = s.key(i); if (k && k.startsWith(`${KEY}.unreadable-`)) keys.push(k); }
      keys.sort();
      return keys.length ? s.getItem(keys[keys.length - 1]) : '';
    } catch { return ''; }
  },

  // ---- the running block's heartbeat: { tab, at }, written every few seconds ----
  // gone: true is written as the page is closed or reloaded
  beat(gone = false) {
    try { storage()?.setItem(BEAT_KEY, JSON.stringify({ tab: TAB_ID, at: Date.now(), gone, hidden: !gone && typeof document !== 'undefined' && document.hidden === true })); } catch { /* not vital */ }
  },
  lastBeat() {
    try { return JSON.parse(storage()?.getItem(BEAT_KEY) || 'null') || { tab: '', at: 0 }; } catch { return { tab: '', at: 0 }; }
  },

  // Asks the browser not to clear this site's data when space runs low.
  // Safari can otherwise delete it after a week without a visit.
  keepData() {
    try { navigator.storage?.persist?.().catch(() => {}); } catch { /* not supported */ }
  },

  // Local calendar day as 'YYYY-MM-DD', n days from today
  dayKey(offsetDays = 0, from = Date.now()) {
    const d = new Date(from);
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  // Open thoughts the student gave a day to, soonest first: [{ thought, when: 'overdue' | 'today' | 'tomorrow' | 'later' }]
  dueList(now = Date.now()) {
    const today = this.dayKey(0, now);
    const tomorrow = this.dayKey(1, now);
    return state.thoughts
      .filter((x) => x.status !== 'done' && x.due)
      .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.createdAt - b.createdAt))
      .map((thought) => ({ thought, when: thought.due < today ? 'overdue' : thought.due === today ? 'today' : thought.due === tomorrow ? 'tomorrow' : 'later' }));
  },

  // Queue of steps for the next study block (to-dos sent there from the margin)
  addToNextPlan(text) {
    refresh();
    const list = state.nextPlan || [];
    if (!list.includes(text) && list.length < 6) list.push(text);
    state.nextPlan = list;
    persist();
    return list.length;
  },
  // (every thought with that wording stops being "in your next block", twins included)
  removeFromNextPlan(text) {
    refresh();
    state.nextPlan = (state.nextPlan || []).filter((x) => x !== text);
    state.thoughts.forEach((x) => { if (x.queued && x.text === text) x.queued = false; });
    persist();
  },
  // Hands over at most `room` queued steps; anything that does not fit stays queued
  takeNextPlan(room = 3) {
    refresh();
    const list = state.nextPlan || [];
    const taken = list.slice(0, Math.max(0, room));
    if (taken.length) { state.nextPlan = list.slice(taken.length); persist(); }
    return taken;
  },

  // ---- settings ----
  setSettings(patch) {
    refresh();
    Object.assign(state.settings, patch);
    persist();
  },
  setAiSettings(patch) {
    refresh();
    if ('key' in patch && patch.key !== state.settings.ai.key) patch = { ...patch, keyGen: (state.settings.ai.keyGen || 0) + 1 };
    Object.assign(state.settings.ai, patch);
    persist();
  },

  // ---- thoughts ----
  addThought(text, extra = {}) {
    // cut by whole characters, so an emoji at the limit is never split in half
    const clean = [...String(text || '').trim()].slice(0, 500).join('');
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
  // Change a few fields of the running block, on top of the newest saved copy
  patchActive(patch) {
    refresh();
    if (!state.active) return null;
    state.active = { ...state.active, ...patch };
    persist();
    return state.active;
  },

  // ---- import / export / reset ----
  exportJSON() {
    const copy = clone(state);
    // never write an API key, or where it is sent, into a backup file
    copy.settings.ai = { provider: 'anthropic', key: '', baseUrl: '', model: '', remember: false };
    copy.active = null;
    // each record carries its own time-zone offset, so a reader can find its local day
    // even when the clocks have changed since
    copy.sessions.forEach((x) => { x.tzOffsetMinutes = new Date(x.startedAt).getTimezoneOffset(); });
    copy.thoughts.forEach((x) => { x.tzOffsetMinutes = new Date(x.createdAt).getTimezoneOffset(); });
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
    // The AI connection never comes from a file. Otherwise a backup someone sends
    // could point this browser's saved key at a server of their choosing.
    const keepAi = clone(state.settings.ai);
    state = normalise(parsed);
    state.settings.ai = keepAi;
    state.active = null;
    persist();
  },
  clearAll() {
    refresh();
    const gen = (state.settings.ai.keyGen || 0) + 1; // so other open tabs let go of the key too
    state = normalise(null);
    state.settings.ai.keyGen = gen;
    // "Everything" includes the copies kept when saved data could not be read
    // (they hold the old thoughts), and the small keys beside the main one.
    try {
      const s = storage();
      if (s) {
        const extra = [];
        for (let i = 0; i < s.length; i += 1) { const k = s.key(i); if (k && (k.startsWith(`${KEY}.`) || k === BEAT_KEY || k === 'sidenote.break')) extra.push(k); }
        extra.forEach((k) => s.removeItem(k));
      }
    } catch { /* storage blocked: nothing was saved there either */ }
    unreadable = false;
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
