// One break timer for the whole site. It shows as a small pill at the bottom of
// the screen, so a break started from a parked thought ("want to check my
// phone") or from the review screen keeps counting while the student looks at
// other pages, and ends with the same chime.

import { h, clock, toast } from './ui.js';
import { t } from './i18n.js';
import { store } from './store.js';
import { audio } from './audio.js';

const KEY = 'sidenote.break';
let endsAt = 0;
let ticker = 0;
let pill = null;
const watchers = new Set();

function remember() {
  try {
    if (endsAt) sessionStorage.setItem(KEY, String(endsAt)); else sessionStorage.removeItem(KEY);
  } catch { /* private mode: the break just won't survive a reload */ }
}

function draw() {
  const left = Math.max(0, (endsAt - Date.now()) / 1000);
  if (!pill) {
    pill = h('div', { id: 'break-pill', class: 'break-pill', role: 'timer' },
      h('span', { class: 'break-pill-text' }),
      h('button', { type: 'button', class: 'linklike', onclick: () => breakTimer.stop() }, t('review.breakSkip')));
    document.body.append(pill);
  }
  pill.hidden = !endsAt;
  pill.firstChild.textContent = `${t('break.pill')} ${clock(left)}`;
  pill.lastChild.textContent = t('review.breakSkip');
  watchers.forEach((fn) => fn(left));
}

function tick() {
  if (!endsAt) return;
  if (Date.now() >= endsAt) {
    endsAt = 0;
    remember();
    clearInterval(ticker);
    draw();
    if (store.state.settings.chime) audio.chime();
    toast(t('review.breakOver'), 6000);
    watchers.forEach((fn) => fn(0, true));
    return;
  }
  draw();
}

export const breakTimer = {
  get running() { return endsAt > Date.now(); },
  start(minutes) {
    endsAt = Date.now() + minutes * 60000;
    remember();
    clearInterval(ticker);
    ticker = setInterval(tick, 500);
    draw();
  },
  stop() {
    endsAt = 0;
    remember();
    clearInterval(ticker);
    draw();
    watchers.forEach((fn) => fn(0, false));
  },
  // fn(secondsLeft, finished?) on every tick; returns a function that stops watching
  watch(fn) {
    watchers.add(fn);
    return () => watchers.delete(fn);
  },
  // Picks a running break back up after a reload
  resume() {
    try {
      const saved = Number(sessionStorage.getItem(KEY));
      if (saved > Date.now()) {
        endsAt = saved;
        ticker = setInterval(tick, 500);
        draw();
      }
    } catch { /* nothing saved */ }
  },
};
