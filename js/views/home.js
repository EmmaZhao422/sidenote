// The front page. The first thing on it is the product itself: a box where you
// park a stray thought.

import { h, mount, toast } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { adSlot } from '../ads.js';
import { recommendScene } from '../score.js';
import { getScene, sceneName } from '../scenes.js';

const GUIDES = [
  { slug: 'parking-lot-method', en: 'The parking lot method: what to do with a thought that shows up mid-study', zh: '「念头停车场」：学到一半冒出来的想法，该拿它怎么办' },
  { slug: 'five-minute-start', en: 'Five minutes before you study: a short plan beats a long warm-up', zh: '开始学习前的五分钟：短计划比长热身管用' },
  { slug: 'background-sound', en: 'Rain, brown noise or silence: finding the sound you focus with', zh: '雨声、棕噪音还是安静：找到适合你专注的声音' },
  { slug: 'study-block-length', en: '25 minutes or 45? How long a study block should be', zh: '25 分钟还是 45 分钟？一轮学习该多长' },
  { slug: 'phone-while-studying', en: 'Where should your phone be while you study?', zh: '学习的时候，手机该放哪儿？' },
];

export function homeView(root, navigate) {
  const lang = getLang();

  // --- hero: park a thought right here
  const input = h('input', {
    type: 'text', class: 'hero-input', maxlength: '500', autocomplete: 'off',
    placeholder: t('home.placeholder'), 'aria-label': t('home.inputLabel'),
  });
  const recent = h('ul', { class: 'hero-notes' });
  const openLink = h('a', { class: 'hero-open', href: '#/margin' });

  function drawRecent() {
    const open = store.state.thoughts.filter((x) => x.status !== 'done');
    recent.replaceChildren(...open.slice(-3).reverse().map((x) => h('li', null, h('span', { class: 'hl' }, x.text))));
    openLink.textContent = open.length ? t('home.openMargin', { n: open.length }) : '';
    openLink.hidden = !open.length;
  }

  const form = h('form', {
    class: 'hero-form',
    onsubmit: (e) => {
      e.preventDefault();
      if (!store.addThought(input.value)) { input.focus(); return; }
      input.value = '';
      drawRecent();
      toast(t('home.parkedToast'));
    },
  }, input, h('button', { type: 'submit', class: 'btn btn-ink' }, t('park.button')));

  const active = store.state.active;
  const startBtn = h('a', { class: 'btn btn-ink btn-big', href: '#/focus' },
    active ? t('home.resume') : t('home.start'));

  const hero = h('section', { class: 'hero' },
    h('h1', { class: 'hero-title' }, t('home.title')),
    h('p', { class: 'hero-sub' }, t('home.sub')),
    form, recent, openLink,
    h('div', { class: 'hero-cta' }, startBtn, h('span', { class: 'hint' }, t('home.startHint'))),
  );

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

  mount(root, hero, how, sceneBand, adSlot('home'), guides);
  drawRecent();
}
