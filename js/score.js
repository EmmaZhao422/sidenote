// The numbers behind the summary page: the focus score, the totals for a date
// range, and the scene recommendation. Everything here is plain arithmetic on
// the saved sessions, with no AI involved, so it can be unit-tested (see /tests).

import { SCENES, getScene } from './scenes.js';
import { CATEGORIES } from './classify.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------
// Focus score, 0-100. Three parts, shown to the student so it is not a mystery:
//   feel    (45%)  their own 1-5 rating right after the block
//   done    (20%)  did they finish what they planned
//   steady  (35%)  how uninterrupted the block was
// It is a rough yardstick for comparing your own sessions, not a measurement
// of attention.
// ---------------------------------------------------------------------------
export function computeFocusScore(session) {
  const focusSec = Math.max(1, session.focusSec || 0);
  const per25 = 1500 / focusSec;

  const feel = session.rating ? 20 * clamp(session.rating, 1, 5) : 60;

  const finishedValue = { yes: 100, partly: 60, no: 25 }[session.finished] ?? 60;
  const steps = (session.steps || []).filter((s) => s && s.text);
  const done = steps.length
    ? 0.5 * finishedValue + 0.5 * (100 * steps.filter((s) => s.done).length) / steps.length
    : finishedValue;

  let steady = 100;
  steady -= 7 * (session.parkedCount || 0) * per25;   // each stray thought costs a little
  steady -= 12 * (session.pauses || 0) * per25;       // each pause costs more
  if (session.mode === 'paper') {
    // Studying on paper with this tab open: time spent away from the tab is drift.
    const awayRatio = (session.awaySec || 0) / focusSec;
    steady -= Math.min(40, awayRatio * 120);
  }
  const plannedSec = (session.plannedMin || 0) * 60;
  if (plannedSec && focusSec < plannedSec * 0.9) {
    steady -= (1 - focusSec / plannedSec) * 30;        // stopped early
  }
  steady = clamp(steady, 0, 100);

  const score = Math.round(0.45 * feel + 0.2 * done + 0.35 * steady);
  return { score, feel: Math.round(feel), done: Math.round(done), steady: Math.round(steady) };
}

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function rangeFor(key, now = Date.now()) {
  const today = startOfDay(now);
  const day = 86400000;
  if (key === 'today') return { from: today, to: now, days: 1 };
  if (key === '7d') return { from: today - 6 * day, to: now, days: 7 };
  if (key === '30d') return { from: today - 29 * day, to: now, days: 30 };
  return { from: 0, to: now, days: 0 };
}

// ---------------------------------------------------------------------------
// Totals for a range
// ---------------------------------------------------------------------------
export function aggregate(state, range) {
  const sessions = state.sessions.filter((s) => s.startedAt >= range.from && s.startedAt <= range.to);
  const thoughts = state.thoughts.filter((t) => t.createdAt >= range.from && t.createdAt <= range.to);

  const focusSec = sessions.reduce((a, s) => a + (s.focusSec || 0), 0);
  const scored = sessions.filter((s) => typeof s.score === 'number');
  const avgScore = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null;

  // What the stray thoughts were about
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  thoughts.forEach((t) => { byCategory[CATEGORIES.includes(t.category) ? t.category : 'other'] += 1; });

  // How wide the thoughts ranged: 0 = all one kind, 1 = spread evenly over every kind
  let breadth = null;
  if (thoughts.length >= 3) {
    const h = CATEGORIES.reduce((acc, c) => {
      const p = byCategory[c] / thoughts.length;
      return p > 0 ? acc - p * Math.log(p) : acc;
    }, 0);
    breadth = h / Math.log(CATEGORIES.length);
  }

  // Focus minutes and average score per calendar day
  const dayMap = new Map();
  sessions.forEach((s) => {
    const k = startOfDay(s.startedAt);
    const d = dayMap.get(k) || { day: k, minutes: 0, scores: [] };
    d.minutes += (s.focusSec || 0) / 60;
    if (typeof s.score === 'number') d.scores.push(s.score);
    dayMap.set(k, d);
  });
  const byDay = [];
  if (range.days) {
    for (let i = 0; i < range.days; i++) {
      const k = startOfDay(range.from) + i * 86400000;
      // startOfDay again so daylight-saving shifts don't knock the key off midnight
      const key = startOfDay(k + 43200000);
      byDay.push(dayMap.get(key) || { day: key, minutes: 0, scores: [] });
    }
  } else {
    byDay.push(...[...dayMap.values()].sort((a, b) => a.day - b.day));
  }
  byDay.forEach((d) => {
    d.minutes = Math.round(d.minutes);
    d.score = d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null;
    delete d.scores;
  });

  // When in a block the mind wanders: 5-minute bins, last bin is "45+"
  const timing = new Array(10).fill(0);
  thoughts.forEach((t) => {
    if (typeof t.offsetSec === 'number') timing[Math.min(9, Math.floor(t.offsetSec / 300))] += 1;
  });

  const inSession = thoughts.filter((t) => t.sessionId).length;
  const wanderPer25 = focusSec > 0 ? inSession * 1500 / focusSec : null;

  // Is the score going up or down across the range?
  let trend = null;
  if (scored.length >= 4) {
    const ordered = [...scored].sort((a, b) => a.startedAt - b.startedAt);
    const half = Math.floor(ordered.length / 2);
    const mean = (arr) => arr.reduce((a, s) => a + s.score, 0) / arr.length;
    const diff = mean(ordered.slice(ordered.length - half)) - mean(ordered.slice(0, half));
    trend = diff >= 5 ? 'up' : diff <= -5 ? 'down' : 'flat';
  }

  const goals = [];
  [...sessions].sort((a, b) => b.startedAt - a.startedAt).forEach((s) => {
    if (s.goal && !goals.includes(s.goal) && goals.length < 6) goals.push(s.goal);
  });

  const top = CATEGORIES.map((c) => [c, byCategory[c]]).sort((a, b) => b[1] - a[1])[0];

  return {
    sessionCount: sessions.length,
    focusMin: Math.round(focusSec / 60),
    avgScore,
    trend,
    thoughtCount: thoughts.length,
    doneCount: thoughts.filter((t) => t.status === 'done').length,
    openCount: thoughts.filter((t) => t.status !== 'done').length,
    byCategory,
    topCategory: thoughts.length ? top[0] : null,
    breadth,
    byDay,
    timing,
    wanderPer25: wanderPer25 === null ? null : Math.round(wanderPer25 * 10) / 10,
    goals,
    longestMin: Math.round(Math.max(0, ...sessions.map((s) => s.focusSec || 0)) / 60),
  };
}

export function breadthLabel(breadth) {
  if (breadth === null || breadth === undefined) return null;
  if (breadth < 0.35) return 'narrow';
  if (breadth < 0.7) return 'medium';
  return 'wide';
}

// ---------------------------------------------------------------------------
// Scenes: which one do you focus best with?
// ---------------------------------------------------------------------------
export function sceneStats(sessions) {
  const scored = sessions.filter((s) => typeof s.score === 'number' && s.scene);
  const overall = scored.length ? scored.reduce((a, s) => a + s.score, 0) / scored.length : 0;
  const map = new Map();
  scored.forEach((s) => {
    const e = map.get(s.scene) || { id: s.scene, n: 0, sum: 0, minutes: 0 };
    e.n += 1;
    e.sum += s.score;
    e.minutes += (s.focusSec || 0) / 60;
    map.set(s.scene, e);
  });
  return [...map.values()].map((e) => ({
    id: e.id,
    n: e.n,
    avg: Math.round(e.sum / e.n),
    minutes: Math.round(e.minutes),
    // One lucky session shouldn't crown a scene: pull small samples toward the
    // overall average (as if every scene started with two average sessions).
    adjusted: (e.sum + overall * 2) / (e.n + 2),
  })).sort((a, b) => b.adjusted - a.adjusted);
}

function similarity(a, b) {
  const keys = Object.keys(a);
  let dot = 0, na = 0, nb = 0;
  keys.forEach((k) => { dot += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k]; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function similarScenes(sceneId, excludeIds = [], count = 2) {
  const base = getScene(sceneId);
  return SCENES
    .filter((s) => s.id !== base.id && s.id !== 'silence' && !excludeIds.includes(s.id))
    .map((s) => ({ id: s.id, sim: similarity(base.traits, s.traits) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, count)
    .map((x) => x.id);
}

export const MIN_SESSIONS_FOR_RECOMMENDATION = 3;

export function recommendScene(sessions) {
  const stats = sceneStats(sessions);
  const total = stats.reduce((a, s) => a + s.n, 0);
  const tried = stats.map((s) => s.id);
  const untried = SCENES.filter((s) => !tried.includes(s.id) && s.id !== 'silence').map((s) => s.id);

  if (total < MIN_SESSIONS_FOR_RECOMMENDATION) {
    return { status: 'learning', need: MIN_SESSIONS_FOR_RECOMMENDATION - total, tryNext: untried[0] || null, stats };
  }
  const best = stats[0];
  return {
    status: 'ready',
    best,
    // "early" = the favourite has fewer than three sessions behind it
    confidence: best.n >= 3 ? 'solid' : 'early',
    similar: similarScenes(best.id, tried, 2),
    stats,
  };
}
