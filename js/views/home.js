// The front page. The first thing on it is the product itself: a box where you
// park a stray thought, and beside it a small live study screen where the
// thought lands in the margin.

import { h, mount, toast, announce, clock, minutesText, dayLabel, isTouchDevice } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { adSlot } from '../ads.js';
import { recommendScene, habit } from '../score.js';
import { getScene, sceneName } from '../scenes.js';
import { createBackdrop } from '../backdrop.js';
import { startBlock } from '../block.js';
import { aiMode } from '../ai.js';
import { noteCard } from './note.js';

const GUIDES = [
  { slug: 'parking-lot-method', en: 'The parking lot method: what to do with a thought that shows up mid-study', zh: '「念头停车场」：学到一半冒出来的想法，该拿它怎么办' },
  { slug: 'five-minute-start', en: 'Five minutes before you study: a short plan beats a long warm-up', zh: '开始学习前的五分钟：短计划比长热身管用' },
  { slug: 'background-sound', en: 'Rain, brown noise or silence: finding the sound you focus with', zh: '雨声、棕噪音还是安静：找到适合你专注的声音' },
  { slug: 'study-block-length', en: '25 minutes or 45? How long a study block should be', zh: '25 分钟还是 45 分钟？一轮学习该多长' },
  { slug: 'phone-while-studying', en: 'Where should your phone be while you study?', zh: '学习的时候，手机该放哪儿？' },
  { slug: 'mind-wandering', en: 'Why your mind wanders while you study, and what to do instead of fighting it', zh: '学习时为什么总走神，以及比「硬撑」更管用的办法' },
  { slug: 'worry-while-studying', en: 'A worry showed up while you were studying. Give it an appointment.', zh: '学到一半开始担心？给这个担心约个时间' },
  { slug: 'study-breaks', en: 'What to do in a five-minute study break', zh: '学习间隙的五分钟，做什么最好' },
  { slug: 'one-block-worked-example', en: 'One study block, start to finish: a worked example', zh: '一轮学习从头到尾：一个完整的例子' },
  { slug: 'test-yourself', en: 'Re-reading feels like studying. Testing yourself works better.', zh: '反复看书像在学习，自己考自己才更有效' },
  { slug: 'music-with-lyrics', en: 'Can you study with music on? What lyrics do to reading', zh: '学习时能不能听歌？歌词对阅读做了什么' },
  { slug: 'exam-week-plan', en: 'Planning an exam week in study blocks', zh: '考试周怎么排：按「轮」来计划' },
];

export function homeView(root, navigate) {
  const lang = getLang();
  const scene = getScene(store.state.settings.scene);
  const openThoughts = () => store.state.thoughts.filter((x) => x.status !== 'done');

  // --- the live miniature of a study screen
  const canvas = h('canvas', { class: 'demo-canvas' });
  const demoTimer = h('span', { class: 'demo-timer' }, clock(store.state.settings.focusMin * 60));
  const demoList = h('ul', { class: 'demo-notes' });
  const demo = h('a', { class: 'hero-demo', href: '#/focus', 'aria-label': t('home.start') },
    canvas,
    h('span', { class: 'demo-scene' }, sceneName(scene, lang)),
    demoTimer,
    h('span', { class: 'demo-margin' },
      h('span', { class: 'demo-margin-title' }, t('focus.marginTitle')),
      demoList));

  // --- and what becomes of the thoughts afterwards: three examples, no AI needed
  const after = h('div', { class: 'hero-after' },
    h('p', { class: 'hero-after-title' }, t('home.afterTitle')),
    h('ul', null, ['todo', 'question', 'urge'].map((k) => h('li', null,
      h('span', { class: 'hero-after-thought' }, t(`home.after.${k}`)),
      h('span', { class: 'hero-after-kind' }, t(`cat.${k}`)),
      h('span', { class: 'hero-after-what' }, t(`home.after.${k}What`))))));

  // --- hero: park a thought right here
  const input = h('input', {
    type: 'text', id: 'hero-park', class: 'hero-input', maxlength: '500', autocomplete: 'off', enterkeyhint: 'done',
    placeholder: t('home.placeholder'), 'aria-label': t('home.inputLabel'),
  });
  const openLink = h('a', { class: 'hero-open', href: '#/margin' });
  // A thought parked here is shown dealt-with straight away: this is the half of
  // the idea a visitor would otherwise only meet after a whole study block.
  const parkedBox = h('div', { class: 'hero-parked', hidden: true });
  function showParked(id) {
    const thought = store.state.thoughts.find((x) => x.id === id);
    if (!thought || thought.status === 'done') { const had = parkedBox.contains(document.activeElement); parkedBox.hidden = true; mount(parkedBox); if (had) input.focus(); return; }
    mount(parkedBox,
      h('p', { class: 'hero-parked-head' }, t(real.length ? 'home.parkedHeadBack' : 'home.parkedHead')),
      noteCard(id, { onChange: (what) => { drawParked(false); drawTodo(); if (what === 'status') showParked(id); } }));
    parkedBox.hidden = false;
    // on a phone the card would otherwise open below the fold, behind the tab bar
    parkedBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function drawParked(justAdded) {
    const open = openThoughts();
    const shown = open.slice(-3);
    // Before anything is parked, the miniature shows two examples in pencil
    // (always the two examples: real thoughts stay off a picture anyone nearby can read)
    mount(demoList, [h('li', { class: 'is-example' }, t('home.example1')), h('li', { class: 'is-example' }, t('home.example2'))]);
    openLink.textContent = open.length ? t('home.openMargin', { n: open.length }) : '';
    openLink.hidden = !open.length;
  }

  const form = h('form', {
    class: 'hero-form',
    onsubmit: (e) => {
      e.preventDefault();
      const added = store.addThought(input.value);
      if (!added) { input.focus(); return; }
      input.value = '';
      drawParked(true);
      showParked(added.id);
      announce(t('home.parkedSaid', { text: added.text.slice(0, 60) }));
    },
  }, input, h('button', { type: 'submit', class: 'btn btn-ink' }, t('park.button')));

  const active = store.state.active;
  const real = store.state.sessions.filter((s) => !s.sample);

  // One tap to repeat the last block: same goal, length and sound, with the steps left over
  const last = real.length ? real.reduce((a, b) => (b.startedAt > a.startedAt ? b : a)) : null;
  const again = last && !active ? h('button', {
    type: 'button', class: 'btn btn-quiet btn-again',
    onclick: () => {
      const { prepMin } = store.state.settings;
      startBlock({
        goal: last.goal, minutes: last.plannedMin, scene: last.scene, mode: last.mode, prep: 0,
        steps: (last.steps || []).filter((x) => !x.done).map((x) => x.text),
      });
      store.setSettings({ prepMin }); // one tap skips the warm-up without changing the usual setting
      navigate('#/focus');
    },
  }, h('strong', null, t('home.again')),
  h('span', null, t('home.againWhat', { goal: last.goal || t('focus.noGoal'), n: last.plannedMin }))) : null;

  const hero = h('section', { class: real.length ? 'hero is-returning' : 'hero' },
    h('div', { class: 'hero-copy' },
      h('h1', { class: 'hero-title' }, t('home.title')),
      h('p', { class: 'hero-sub' }, h('span', { class: 'only-wide' }, t('home.sub')), h('span', { class: 'only-narrow' }, t('home.subShort'))),
      h('div', { class: 'hero-cta' },
        h('a', { class: 'btn btn-ink btn-big', href: '#/focus' }, active ? t('home.resume') : t('home.start')),
        again,
        // First visit: a short block with no warm-up, so the "after" half is ten minutes away
        real.length || active ? null : h('button', {
          type: 'button', class: 'btn btn-quiet btn-big',
          onclick: () => {
            const { focusMin, prepMin } = store.state.settings;
            startBlock({ goal: '', minutes: 10, prep: 0 });
            store.setSettings({ focusMin, prepMin }); // a trial does not become the default
            navigate('#/focus');
          },
        }, t('home.try')),
        real.length ? null : h('span', { class: 'hint' }, t('home.startHint'))),
      h('label', { class: 'hero-park-label', for: 'hero-park' }, t('home.parkLabel')),
      form, parkedBox, openLink,
      aiMode() === 'offline'
        ? h('p', { class: 'hint hero-ai' }, t('home.aiHint'), ' ', h('a', { href: '#/settings' }, t('home.aiLink'))) : null),
    h('div', { class: 'hero-side' }, demo, real.length ? null : after));

  // --- to-dos the student gave a day to: the reason to open the site tomorrow
  const todo = h('section', { class: 'todo-strip' });
  function drawTodo() {
    const due = store.dueList();
    todo.hidden = !due.length;
    if (!due.length) return;
    const groups = ['overdue', 'today', 'tomorrow', 'later'].map((when) => ({ when, items: due.filter((d) => d.when === when) })).filter((g) => g.items.length);
    mount(todo,
      h('h2', null, t('due.title')),
      groups.map((g) => h('div', { class: 'todo-group' },
        h('h3', null, t(`due.${g.when}Head`)),
        h('ul', null, g.items.map(({ thought }) => {
          const id = `due-${thought.id}`;
          return h('li', null,
            h('input', {
              type: 'checkbox', id,
              onchange: () => {
                store.updateThought(thought.id, { status: 'done', doneAt: Date.now() });
                toast(t('due.doneToast'));
                drawTodo();
                drawParked(false);
              },
            }),
            h('label', { for: id, dir: 'auto' }, thought.note ? `${thought.text} — ${thought.note}` : thought.text));
        })))));
  }

  // --- the date being worked toward, if the student set one in Settings
  let countdown = null;
  const dl = store.state.settings.deadline;
  if (dl && dl.date) {
    const days = Math.round((new Date(`${dl.date}T12:00`).getTime() - new Date(`${store.dayKey(0)}T12:00`).getTime()) / 86400000);
    if (days < 0) store.setSettings({ deadline: null }); // the day has passed
    if (days >= 0) {
      const name = dl.label || t('home.deadlineDefault');
      countdown = h('p', { class: 'countdown' }, days === 0 ? t('home.deadlineToday', { name }) : t('home.deadline', { name, n: days }));
    }
  }

  // No date set yet: offer it right here, where a student preparing for an exam will see it
  if (!countdown && real.length) {
    const pick = h('input', {
      type: 'date', class: 'field field-date', id: 'home-deadline', min: store.dayKey(0),
      onchange: (e) => {
        if (!e.target.value) return;
        store.setSettings({ deadline: { label: '', date: e.target.value } });
        toast(t('settings.deadline.saved'));
        navigate('#/');
      },
    });
    countdown = h('p', { class: 'countdown countdown-ask' }, h('label', { for: 'home-deadline' }, t('home.deadlineAsk')), pick);
  }

  // --- today and the streak, once there is something to show
  let today = null;
  if (real.length) {
    const hb = habit(real);
    const peak = Math.max(25, ...hb.week.map((d) => d.minutes));
    today = h('section', { class: 'today' },
      h('div', { class: 'today-text' },
        h('h2', null, hb.todayBlocks
          ? t('home.today', { time: minutesText(hb.todayMinutes), n: hb.todayBlocks })
          : t('home.todayNone')),
        hb.streak >= 2 ? h('p', null, t(hb.todayBlocks ? 'home.streakDone' : 'home.streak', { n: hb.streak })) : null,
        countdown),
      h('ol', { class: 'week', 'aria-label': t('home.weekLabel') }, hb.week.map((d) =>
        h('li', { title: `${dayLabel(d.day)}: ${minutesText(d.minutes)}` },
          h('span', { class: 'week-bar', style: `height:${Math.max(d.minutes ? 12 : 0, (d.minutes / peak) * 100)}%` }),
          h('span', { class: 'week-day' }, new Date(d.day).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'narrow' }))))));
  }

  // --- on a phone, a returning student is told once that the site can sit on the home screen
  let install = null;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  if (real.length >= 2 && isTouchDevice() && !standalone && !store.state.settings.installHintSeen) {
    install = h('p', { class: 'notice install-hint' }, t('home.installHint'), ' ',
      h('button', {
        type: 'button', class: 'linklike',
        onclick: () => { store.setSettings({ installHintSeen: true }); install.remove(); },
      }, t('home.installOk')));
  }

  // --- how a block goes (a real sequence, so it is numbered)
  const how = h('section', { class: 'band' },
    h('h2', null, t('home.howTitle')),
    h('ol', { class: 'steps' },
      [1, 2, 3, 4].map((n) => h('li', null,
        h('h3', null, t(`home.how${n}.title`)),
        h('p', null, t(`home.how${n}.body`))))));

  // --- which scene suits you
  const rec = recommendScene(store.state.sessions);
  const sceneBand = h('section', { class: 'band band-split' },
    h('div', null,
      h('h2', null, t('home.sceneTitle')),
      h('p', null, rec.status === 'ready'
        ? t('home.sceneReady', { scene: sceneName(getScene(rec.best.id), lang), score: rec.best.avg })
        : t('home.sceneLearning')),
      h('a', { class: 'btn btn-quiet', href: '#/scenes' }, t('home.sceneLink'))),
    h('div', null,
      h('h2', null, t('home.summaryTitle')),
      h('p', null, t('home.summaryBody')),
      h('a', { class: 'btn btn-quiet', href: '#/summary' }, t('home.summaryLink'))));

  // --- reading
  const guideBase = lang === 'zh' ? 'guides/zh/' : 'guides/';
  const guides = h('section', { class: 'band guides-band' },
    h('h2', null, t('home.guidesTitle')),
    h('ul', { class: 'guide-list' }, GUIDES.map((g) =>
      h('li', null, h('a', { href: `${guideBase}${g.slug}.html` }, lang === 'zh' ? g.zh : g.en)))));

  mount(root, hero, todo, today || (countdown ? h('section', { class: 'today' }, h('div', { class: 'today-text' }, countdown)) : null), install, how, sceneBand, adSlot('home'), guides);
  drawParked(false);
  drawTodo();

  // The miniature runs a slow, purely cosmetic countdown
  const backdrop = createBackdrop(canvas);
  backdrop.setScene(scene);
  // ...and only while it can be seen: no drawing for a picture that is scrolled away
  let watcher = null;
  if ('IntersectionObserver' in window) {
    watcher = new IntersectionObserver(([entry]) => backdrop.setRunning(entry.isIntersecting));
    watcher.observe(demo);
  }
  let left = store.state.settings.focusMin * 60;
  let ticks = 0;
  const tick = setInterval(() => {
    ticks += 1;
    if (ticks > 5) { clearInterval(tick); backdrop.setRunning(false); watcher?.disconnect(); return; }
    left = left > 1 ? left - 1 : store.state.settings.focusMin * 60;
    demoTimer.textContent = clock(left);
  }, 1000);

  return () => {
    watcher?.disconnect();
    clearInterval(tick);
    backdrop.destroy();
  };
}
