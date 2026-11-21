// Two screens that list parked thoughts:
//   marginView  - everything you've parked, open or dealt with
//   reviewView  - the thoughts from one study block, shown right after it ends

import { h, mount, toast, clock, minutesText, dayLabel, timeLabel, segmented } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { noteCard, sortAll, isPlanned } from './note.js';
import { aiMode } from '../ai.js';
import { copyForClaudeButton, askAllLink } from '../handoff.js';
import { getScene, sceneName } from '../scenes.js';
import { startBlock } from '../block.js';
import { breakTimer } from '../breaktimer.js';
import { buildIcs, tomorrowAt, downloadIcs } from '../ics.js';
import { CONFIG } from '../config.js';

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
      h('div', { class: 'row' },
        tab === 'open' && unanswered.length >= 2 && aiMode() !== 'offline'
          ? sortAllButton(() => unanswered.map((x) => x.id), goalOf, draw) : null,
        tab === 'open' && aiMode() === 'offline' ? askAllLink(() => store.state.thoughts.filter((x) => x.status !== 'done' && x.category !== 'worry' && x.category !== 'urge'), open.length) : null,
        tab === 'open' && open.length
          ? copyForClaudeButton(() => store.state.thoughts.filter((x) => x.status !== 'done')) : null));

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
    form, body);
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
      h('span', { class: 'score-word' }, t(`review.word.${session.score >= 85 ? 'high' : session.score >= 70 ? 'good' : session.score >= 50 ? 'mid' : 'low'}`)),
      h('span', { class: 'score-of' }, t('review.outOf'))),
    h('div', { class: 'score-parts' },
      h('h2', null, t('review.scoreTitle')),
      h('dl', null,
        h('dt', null, t('review.feel')), h('dd', null, String(p.feel)),
        h('dt', null, t('review.done')), h('dd', null, String(p.done)),
        h('dt', null, t('review.steady')), h('dd', null, String(p.steady))),
      h('details', { class: 'score-how' },
        h('summary', null, t('review.scoreHow')),
        h('p', { class: 'hint' }, t('review.scoreHint')))));

  const facts = [
    t('review.factTime', { time: minutesText(Math.max(1, session.focusSec / 60)) }),
    t('review.factScene', { scene: sceneName(getScene(session.scene), lang) }),
    t('review.factParked', { n: session.parkedCount }),
    session.pauses ? t('review.factPauses', { n: session.pauses }) : null,
    session.mode === 'paper' && session.awaySec > 30 ? t('review.factAway', { time: minutesText(Math.max(1, session.awaySec / 60)) }) : null,
  ].filter(Boolean);

  const body = h('div');
  function draw(focusId) {
    const mine = store.state.thoughts.filter((x) => x.sessionId === sessionId);
    const open = mine.filter((x) => x.status !== 'done');
    // Thoughts already given a day or a place in the next block sit below, folded:
    // the list on top is what is still undecided.
    const undecided = open.filter((x) => !isPlanned(x));
    const planned = open.filter(isPlanned);
    const unanswered = undecided.filter((x) => !x.reply);
    const card = (x) => noteCard(x.id, {
      goal: session.goal, onChange: (what) => { if (what === 'status') draw(); else if (what === 'due') draw(x.id); },
    });
    const notes = h('div', { class: 'notes' });
    if (!mine.length) {
      notes.append(h('p', { class: 'empty' }, t('review.none')));
    } else if (!open.length) {
      notes.append(h('p', { class: 'empty' }, t('review.allDone')));
    } else if (!undecided.length) {
      notes.append(h('p', { class: 'empty' }, t('review.allPlanned')));
    }
    undecided.forEach((x) => notes.append(card(x)));
    if (planned.length) {
      notes.append(h('h3', { class: 'notes-day' }, t('review.plannedTitle', { n: planned.length })));
      planned.forEach((x) => notes.append(card(x)));
    }
    mount(body,
      h('div', { class: 'row row-between' },
        h('h2', null, t('review.thoughtsTitle', { n: undecided.length })),
        h('div', { class: 'row' },
          unanswered.length >= 2 && aiMode() !== 'offline' ? sortAllButton(() => unanswered.map((x) => x.id), () => session.goal, draw) : null,
          aiMode() === 'offline' ? askAllLink(() => store.state.thoughts.filter((x) => x.sessionId === sessionId && x.status !== 'done' && !isPlanned(x) && x.category !== 'worry' && x.category !== 'urge'), undecided.length) : null,
          open.length ? copyForClaudeButton(() => store.state.thoughts.filter((x) => x.sessionId === sessionId && x.status !== 'done')) : null)),
      notes);
    if (focusId) {
      const el = [...body.querySelectorAll('.note')].find((n) => n.dataset.id === focusId);
      el?.querySelector('.note-change, .note-when .chip[aria-pressed="true"], .note-when .chip')?.focus({ preventScroll: true });
    }
  }

  // --- a short break before the next block, timed here so the phone stays put
  const breakBox = h('section', { class: 'break' });
  // What is left of this block's plan can roll straight into the next one
  const leftover = (session.steps || []).filter((x) => !x.done).map((x) => x.text);
  const unfinished = Boolean(session.goal) && (leftover.length > 0 || session.finished !== 'yes');
  const nextButtons = () => [
    unfinished ? h('button', {
      type: 'button', class: 'btn btn-ink',
      title: t('review.againHint'),
      onclick: () => {
        const { prepMin } = store.state.settings;
        startBlock({ goal: session.goal, minutes: session.plannedMin, scene: session.scene, mode: session.mode, prep: 0, steps: leftover });
        store.setSettings({ prepMin });
        navigate('#/focus');
      },
    }, t('review.again')) : null,
    h('a', { class: unfinished ? 'btn btn-quiet' : 'btn btn-ink', href: '#/focus' }, t('review.another')),
    // A calendar entry for tomorrow, at the hour this block started
    h('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: () => {
        const start = tomorrowAt(session.startedAt);
        downloadIcs(buildIcs({
          title: session.goal ? t('ics.titleGoal', { goal: session.goal }) : t('ics.title'),
          start, minutes: session.plannedMin, url: `${CONFIG.siteUrl}#/focus`,
          note: leftover.length ? leftover.map((x) => `- ${x}`).join('\n') : '',
        }));
        toast(t('ics.saved', { time: timeLabel(start.getTime()) }), 6000);
      },
    }, t('ics.button')),
  ];
  function drawBreakChoice() {
    mount(breakBox,
      h('h2', null, t('review.breakTitle')),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => breakTimer.start(5) }, t('review.break', { n: 5 })),
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => breakTimer.start(15) }, t('review.break', { n: 15 })),
        nextButtons()));
  }
  function drawBreakRunning(left) {
    if (!breakBox.querySelector('.break-clock')) {
      mount(breakBox,
        h('h2', null, t('review.breakRunning'), ' ', h('span', { class: 'break-clock', role: 'timer' }, clock(left))),
        h('p', { class: 'hint' }, t('review.breakHint')),
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => breakTimer.stop() }, t('review.breakSkip')));
    } else {
      breakBox.querySelector('.break-clock').textContent = clock(left);
    }
  }
  // The break itself runs in js/breaktimer.js, so it keeps going on other pages
  const stopWatching = breakTimer.watch((left, finished) => {
    if (left > 0) return drawBreakRunning(left);
    if (finished) {
      mount(breakBox,
        h('h2', null, t('review.breakOver')),
        h('div', { class: 'row' }, nextButtons()));
    } else {
      drawBreakChoice();
    }
  });
  drawBreakChoice();
  // A block worth keeping exists now: ask the browser not to clear this site's data on its own
  store.keepData();

  mount(root,
    h('header', { class: 'view-head' },
      h('h1', null, t('review.title')),
      h('p', { class: 'lede' }, session.goal ? t('review.ledeGoal', { goal: session.goal }) : t('review.lede')),
      // one sentence a person would say about the block, before any number
      h('p', { class: 'takeaway' }, t(session.parkedCount ? 'review.takeaway' : 'review.takeawayNone', {
        time: minutesText(Math.max(1, session.focusSec / 60)), n: session.parkedCount,
      }))),
    scoreCard,
    h('ul', { class: 'facts' }, facts.map((f) => h('li', null, f))),
    body,
    breakBox,
    h('p', null, h('a', { href: '#/summary' }, t('review.toSummary'))));
  draw();
  // this page shows the break itself, so the floating pill would only say it twice
  document.body.classList.add('no-pill');
  return () => { stopWatching(); document.body.classList.remove('no-pill'); };
}
