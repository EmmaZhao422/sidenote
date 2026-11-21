// Starting a study block. Kept apart from the study screens so the home page's
// "Same again" button can start one with a single tap.

import { store, uid, TAB_ID } from './store.js';
import { audio } from './audio.js';
import { isTouchDevice } from './ui.js';
import { breakTimer } from './breaktimer.js';

// opts: { goal, minutes, scene, mode, prep, steps: [text] }
// Anything left out falls back to the student's last choices.
export function startBlock(opts = {}) {
  breakTimer.stop();
  const s = store.state.settings;
  const minutes = opts.minutes ?? s.focusMin;
  const scene = opts.scene ?? s.scene;
  const mode = opts.mode ?? s.studyMode;
  const prep = opts.prep ?? s.prepMin;
  store.setSettings({ focusMin: minutes, scene, studyMode: mode, prepMin: prep });

  // To-dos the student sent "to the next block" become its first steps
  const carried = store.takeNextPlan();
  const steps = [...(opts.steps || []), ...carried]
    .map((text) => String(text).trim()).filter(Boolean).slice(0, 3)
    .map((text) => ({ text, done: false }));

  const now = Date.now();
  store.setActive({
    id: uid(),
    owner: TAB_ID,
    stage: prep > 0 ? 'prep' : 'focus',
    goal: String(opts.goal || '').trim(),
    steps,
    plannedMin: minutes,
    prepMin: prep,
    scene,
    mode,
    // "Away from the page" only means something on a computer. A phone locks its
    // screen while the student reads their book, and that is not drifting.
    trackAway: mode === 'paper' && !isTouchDevice(),
    prepStartedAt: now,
    settling: false,
    focusStartedAt: prep > 0 ? null : now,
    pausedAt: null, pausedMs: 0, pauses: 0,
    awayMs: 0, awayCount: 0, awaySince: null,
    lastSeenAt: now,
  });
  // The click that got us here is the "user gesture" browsers need before sound can play.
  audio.setVolume(store.state.settings.volume);
  audio.play(scene, 4);
}

// Another tab is "holding" the block if it wrote to it in the last few seconds
export function heldElsewhere(active, now = Date.now()) {
  return Boolean(active && active.owner && active.owner !== TAB_ID
    && active.stage !== 'wrap' && !active.pausedAt && now - (active.lastSeenAt || 0) < 15000);
}
