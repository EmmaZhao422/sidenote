// The numbers behind the summary page: the focus score, the totals for a date
// range, and the scene recommendation. Everything here is plain arithmetic on
// the saved sessions, with no AI involved, so it can be unit-tested (see /tests).

import { SCENES, getScene } from './scenes.js';
import { CATEGORIES } from './classify.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------
// Focus score, 0-100. Three parts, shown to the student so it is not a mystery:
//   feel    (40%)  their own 1-5 rating right after the block
//   done    (25%)  did they finish what they planned
//   steady  (35%)  how uninterrupted the block was: pauses, time away, stopping early
//
// Parking a thought never costs points. Writing a stray thought down instead of
// chasing it is exactly what the student is supposed to do, so the score must
// not punish it. How often thoughts show up is reported separately, as a fact.
//
// It is a rough yardstick for comparing your own sessions, not a measurement
// of attention.
// ---------------------------------------------------------------------------
export const SCORE_WEIGHTS = { feel: 0.4, done: 0.25, steady: 0.35 };

export function computeFocusScore(session) {
  const focusSec = Math.max(1, session.focusSec || 0);
  // Pauses are counted per 25 minutes, so a long block isn't judged more harshly
  // than a short one. Blocks shorter than 25 minutes are not scaled up.
  const per25 = 1500 / Math.max(focusSec, 1500);

  const feel = session.rating ? 20 * clamp(session.rating, 1, 5) : 60;

  const finishedValue = { yes: 100, partly: 60, no: 25 }[session.finished] ?? 60;
  const steps = (session.steps || []).filter((s) => s && s.text);
  const done = steps.length
    ? 0.5 * finishedValue + 0.5 * (100 * steps.filter((s) => s.done).length) / steps.length
    : finishedValue;

  let steady = 100;
  steady -= 15 * (session.pauses || 0) * per25;
  if (session.mode === 'paper') {
    // Studying on paper with this tab open: time spent away from the tab is drift.
    const awayRatio = (session.awaySec || 0) / focusSec;
    steady -= Math.min(40, awayRatio * 120);
  }
  const plannedSec = (session.plannedMin || 0) * 60;
  if (plannedSec && focusSec < plannedSec * 0.9) {
    steady -= (1 - focusSec / plannedSec) * 40;        // stopped early
  }
  steady = clamp(steady, 0, 100);

  const score = Math.round(SCORE_WEIGHTS.feel * feel + SCORE_WEIGHTS.done * done + SCORE_WEIGHTS.steady * steady);
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
  // Midnight n calendar days ago. Counting calendar days (not 24-hour steps) keeps
  // the range right in the weeks when the clocks change.
  const back = (n) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.getTime();
  };
  if (key === 'today') return { from: back(0), to: now, days: 1 };
  if (key === '7d') return { from: back(6), to: now, days: 7 };
  if (key === '30d') return { from: back(29), to: now, days: 30 };
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

  // How often the mind wandered: only thoughts parked while the clock was running count
  // (not the ones emptied out before the block, or typed during a pause), and under
  // ten minutes of focus is too little to make a rate of.
  const duringFocus = thoughts.filter((t) => t.sessionId && typeof t.offsetSec === 'number').length;
  const wanderPer25 = focusSec >= 600 ? duringFocus * 1500 / focusSec : null;

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
    byGoal: minutesByGoal(sessions),
  };
}

// Focus minutes per goal, largest first. Goals are matched as typed, ignoring
// case and extra spaces, so "Stats PS 6" and "stats ps 6" count as one.
export function minutesByGoal(sessions) {
  const map = new Map();
  sessions.forEach((s) => {
    const label = String(s.goal || '').trim().replace(/\s+/g, ' ');
    const key = label.toLowerCase();
    const row = map.get(key) || { goal: label, minutes: 0, blocks: 0 };
    row.minutes += (s.focusSec || 0) / 60;
    row.blocks += 1;
    map.set(key, row);
  });
  return [...map.values()]
    .map((r) => ({ ...r, minutes: Math.round(r.minutes) }))
    .sort((a, b) => b.minutes - a.minutes);
}

// Today's totals and the run of consecutive days with at least one block.
// A streak still counts if today has no block yet but yesterday had one.
export function habit(sessions, now = Date.now()) {
  const day = 86400000;
  const today = startOfDay(now);
  const minutesByDay = new Map();
  sessions.forEach((s) => {
    const k = startOfDay(s.startedAt);
    minutesByDay.set(k, (minutesByDay.get(k) || 0) + (s.focusSec || 0) / 60);
  });
  // Walk back one calendar day at a time. Noon is used as the anchor so that
  // daylight-saving changes never skip or repeat a day.
  const dayBefore = (start) => startOfDay(start + day / 2 - day);
  let streak = 0;
  let cursor = minutesByDay.has(today) ? today : dayBefore(today);
  while (minutesByDay.has(cursor)) {
    streak += 1;
    cursor = dayBefore(cursor);
  }
  const week = [];
  let d = today;
  for (let i = 0; i < 7; i++) {
    week.unshift({ day: d, minutes: Math.round(minutesByDay.get(d) || 0) });
    d = dayBefore(d);
  }
  return {
    todayMinutes: Math.round(minutesByDay.get(today) || 0),
    todayBlocks: sessions.filter((s) => startOfDay(s.startedAt) === today).length,
    streak,
    week,
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
  // Three blocks with the same sound say nothing about which sound is best
  if (stats.length < 2) {
    return { status: 'learning', oneScene: true, need: 0, tryNext: similarScenes(stats[0].id, tried, 1)[0] || untried[0] || null, stats };
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
