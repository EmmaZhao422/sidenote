// Two screens that list parked thoughts:
//   marginView  - everything you've parked, open or dealt with
//   reviewView  - the thoughts from one study block, shown right after it ends

import { h, mount, toast, clock, minutesText, dayLabel, segmented } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { noteCard, sortAll } from './note.js';
import { adSlot } from '../ads.js';
import { audio } from '../audio.js';
import { getScene, sceneName } from '../scenes.js';

function sortAllButton(getIds, goalFor, refresh) {
  const btn = h('button', {
    type: 'button', class: 'btn btn-ink',
    onclick: async () => {
      const ids = getIds();
      btn.disabled = true;
      const failed = await sortAll(ids, goalFor, (n) => { btn.textContent = t('margin.sortingAll', { n, total: ids.length }); });
      refresh();
      if (failed) toast(t('margin.someFailed', { n: failed }));
    },
  }, t('margin.sortAll'));
  return btn;
}

function goalOf(thought) {
  const s = store.state.sessions.find((x) => x.id === thought.sessionId);
  return s ? s.goal : '';
}

// ------------------------------------------------------------------ margin
export function marginView(root) {
  let tab = 'open';

  const input = h('input', {
    type: 'text', class: 'field', maxlength: '500', autocomplete: 'off',
    placeholder: t('home.placeholder'), 'aria-label': t('home.inputLabel'),
  });
  const form = h('form', {
    class: 'row',
    onsubmit: (e) => {
      e.preventDefault();
      if (!store.addThought(input.value)) return;
      input.value = '';
      tab = 'open';
      draw();
    },
  }, input, h('button', { type: 'submit', class: 'btn btn-ink' }, t('park.button')));

  const body = h('div');

  function draw() {
    const all = [...store.state.thoughts].sort((a, b) => b.createdAt - a.createdAt);
    const open = all.filter((x) => x.status !== 'done');
    const done = all.filter((x) => x.status === 'done');
    const list = tab === 'open' ? open : done;

    const tabs = segmented(t('margin.title'), [
      { value: 'open', label: t('margin.tabOpen', { n: open.length }) },
      { value: 'done', label: t('margin.tabDone', { n: done.length }) },
    ], tab, (v) => { tab = v; draw(); });

    const unanswered = open.filter((x) => !x.reply);
    const tools = h('div', { class: 'row row-between' }, tabs,
      tab === 'open' && unanswered.length >= 2
        ? sortAllButton(() => unanswered.map((x) => x.id), goalOf, draw) : null);

    const notes = h('div', { class: 'notes' });
    if (!list.length) {
      notes.append(h('p', { class: 'empty' }, tab === 'open' ? t('margin.emptyOpen') : t('margin.emptyDone')));
    }
    // Group by day so a long list has landmarks
    let lastDay = '';
    list.forEach((x) => {
      const day = dayLabel(x.createdAt, 'long');
      if (day !== lastDay) { notes.append(h('h2', { class: 'notes-day' }, day)); lastDay = day; }
      notes.append(noteCard(x.id, { goal: goalOf(x), onChange: (what) => { if (what === 'status') draw(); } }));
    });

    mount(body, tools, notes);
  }

  mount(root,
    h('header', { class: 'view-head' },
      h('h1', null, t('margin.title')),
      h('p', { class: 'lede' }, t('margin.lede'))),
    form, body, adSlot('lot'));
  draw();
}

// ------------------------------------------------------------------ review
export function reviewView(root, navigate, sessionId) {
  const session = store.state.sessions.find((x) => x.id === sessionId);
  if (!session) { navigate('#/margin'); return; }
  const lang = getLang();
  const p = session.parts || { feel: 0, done: 0, steady: 0 };

  const scoreCard = h('section', { class: 'score-card' },
    h('div', { class: 'score-big' },
      h('span', { class: 'score-num' }, String(session.score)),
      h('span', { class: 'score-of' }, t('review.outOf'))),
    h('div', { class: 'score-parts' },
      h('h2', null, t('review.scoreTitle')),
      h('dl', null,
        h('dt', null, t('review.feel')), h('dd', null, String(p.feel)),
        h('dt', null, t('review.done')), h('dd', null, String(p.done)),
        h('dt', null, t('review.steady')), h('dd', null, String(p.steady))),
      h('p', { class: 'hint' }, t('review.scoreHint'))));

  const facts = [
    t('review.factTime', { time: minutesText(Math.max(1, session.focusSec / 60)) }),
    t('review.factScene', { scene: sceneName(getScene(session.scene), lang) }),
    t('review.factParked', { n: session.parkedCount }),
    session.pauses ? t('review.factPauses', { n: session.pauses }) : null,
    session.mode === 'paper' && session.awaySec > 30 ? t('review.factAway', { time: minutesText(Math.max(1, session.awaySec / 60)) }) : null,
  ].filter(Boolean);

  const body = h('div');
  function draw() {
    const mine = store.state.thoughts.filter((x) => x.sessionId === sessionId);
    const open = mine.filter((x) => x.status !== 'done');
    const unanswered = open.filter((x) => !x.reply);
    const notes = h('div', { class: 'notes' });
    if (!mine.length) {
      notes.append(h('p', { class: 'empty' }, t('review.none')));
    } else if (!open.length) {
      notes.append(h('p', { class: 'empty' }, t('review.allDone')));
    }
    open.forEach((x) => notes.append(noteCard(x.id, {
      goal: session.goal, onChange: (what) => { if (what === 'status') draw(); },
    })));
    mount(body,
      h('div', { class: 'row row-between' },
        h('h2', null, t('review.thoughtsTitle', { n: open.length })),
        unanswered.length >= 2 ? sortAllButton(() => unanswered.map((x) => x.id), () => session.goal, draw) : null),
      notes);
  }

  // --- a short break before the next block, timed here so the phone stays put
  let breakTicker = 0;
  const breakBox = h('section', { class: 'break' });
  function drawBreakChoice() {
    clearInterval(breakTicker);
    mount(breakBox,
      h('h2', null, t('review.breakTitle')),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => startBreak(5) }, t('review.break', { n: 5 })),
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => startBreak(15) }, t('review.break', { n: 15 })),
        h('a', { class: 'btn btn-ink', href: '#/focus' }, t('review.another'))));
  }
  function startBreak(minutes) {
    const endsAt = Date.now() + minutes * 60000;
    const left = h('span', { class: 'break-clock', role: 'timer' }, clock(minutes * 60));
    mount(breakBox,
      h('h2', null, t('review.breakRunning'), ' ', left),
      h('p', { class: 'hint' }, t('review.breakHint')),
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: drawBreakChoice }, t('review.breakSkip')));
    clearInterval(breakTicker);
    breakTicker = setInterval(() => {
      const remaining = (endsAt - Date.now()) / 1000;
      left.textContent = clock(remaining);
      if (remaining > 0) return;
      clearInterval(breakTicker);
      if (store.state.settings.chime) audio.chime();
      mount(breakBox,
        h('h2', null, t('review.breakOver')),
        h('div', { class: 'row' }, h('a', { class: 'btn btn-ink', href: '#/focus' }, t('review.another'))));
    }, 500);
  }
  drawBreakChoice();

  mount(root,
    h('header', { class: 'view-head' },
      h('h1', null, t('review.title')),
      h('p', { class: 'lede' }, session.goal ? t('review.ledeGoal', { goal: session.goal }) : t('review.lede'))),
    scoreCard,
    h('ul', { class: 'facts' }, facts.map((f) => h('li', null, f))),
    body,
    breakBox,
    h('p', null, h('a', { href: '#/summary' }, t('review.toSummary'))));
  draw();
  return () => clearInterval(breakTicker);
}
