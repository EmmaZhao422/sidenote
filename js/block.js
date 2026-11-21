// Starting a study block. Kept apart from the study screens so the home page's
// "Same again" button can start one with a single tap.

import { store, uid, TAB_ID } from './store.js';
import { audio } from './audio.js';
import { isTouchDevice } from './ui.js';
import { breakTimer } from './breaktimer.js';

// The id of a block started a moment ago in this page. The study screen asks for it
// once: a block it finds running that it did not just start is one it is coming
// back to (a reload, a closed tab), and that one resumes paused.
let fresh = null;
export function takeFresh(id) {
  const hit = fresh !== null && fresh === id;
  fresh = null;
  return hit;
}

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

  // To-dos the student sent "to the next block" come first; whatever does not fit
  // in three steps stays queued for the block after.
  const own = (opts.steps || []).map((text) => String(text).trim()).filter(Boolean);
  const carried = store.takeNextPlan(3);
  const steps = [...carried, ...own].slice(0, 3).map((text) => ({ text, done: false }));

  const now = Date.now();
  fresh = uid();
  store.setActive({
    id: fresh,
    owner: TAB_ID,
    stage: prep > 0 ? 'prep' : 'focus',
    goal: String(opts.goal || '').trim(),
    steps,
    carried,              // the queued to-dos this block took on (see settleCarried)
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

// Another tab is "holding" the block if its heartbeat was seen in the last few seconds
export function heldElsewhere(active, now = Date.now()) {
  if (!active || !active.owner || active.owner === TAB_ID || active.stage === 'wrap' || active.pausedAt) return false;
  const beat = store.lastBeat();
  if (beat.gone) return false; // its page was closed
  // Browsers slow a hidden tab's timers to about one a minute, so its heartbeat is allowed to be older
  return beat.tab === active.owner && now - beat.at < (beat.hidden ? 90000 : 15000);
}

// When a block ends, the queued to-dos it took on are settled: a step that was
// ticked marks its thought done; one that was not goes back in the queue.
// With steps = null (the block was thrown away) everything goes back.
export function settleCarried(carried = [], steps = null) {
  carried.forEach((text) => {
    const done = steps && steps.some((s) => s.text === text && s.done);
    const twins = store.state.thoughts.filter((x) => x.queued && x.text === text && x.status !== 'done');
    const thought = twins[0];
    if (done) {
      twins.forEach((x) => store.updateThought(x.id, { status: 'done', doneAt: Date.now(), queued: false }));
    } else if (steps === null) {
      store.addToNextPlan(text);      // the block was thrown away: it still waits for the next one
    } else if (thought) {
      // Not ticked off: it goes back to the list of thoughts instead of following
      // the student into every block from now on.
      twins.forEach((x) => store.updateThought(x.id, { queued: false }));
    }
  });
}
