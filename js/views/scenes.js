// The scene library: listen to each one, see how you've focused with it so far,
// and pick the one to use next.

import { h, mount, toast } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { SCENES, getScene, sceneName, sceneBlurb } from '../scenes.js';
import { audio } from '../audio.js';
import { recommendScene } from '../score.js';

export function scenesView(root) {
  const lang = getLang();
  const grid = h('div', { class: 'scene-grid' });
  const advice = h('section', { class: 'card' });

  function draw() {
    const rec = recommendScene(store.state.sessions);
    const statFor = (id) => rec.stats.find((s) => s.id === id);
    const names = (ids) => ids.map((id) => sceneName(getScene(id), lang)).join(lang === 'zh' ? '、' : ', ');

    if (rec.status === 'ready') {
      mount(advice,
        h('h2', null, t('scenes.adviceTitle')),
        h('p', null, t(rec.confidence === 'solid' ? 'recap.sceneSolid' : 'recap.sceneEarly',
          { scene: sceneName(getScene(rec.best.id), lang), score: rec.best.avg })),
        rec.similar.length ? h('p', null, t('scenes.similar', { scenes: names(rec.similar) })) : null,
        h('p', { class: 'hint' }, t('scenes.how')));
    } else {
      mount(advice,
        h('h2', null, t('scenes.adviceTitle')),
        h('p', null, rec.oneScene ? t('scenes.oneScene') : t('scenes.learning', { n: rec.need })),
        h('p', { class: 'hint' }, t('scenes.how')));
    }

    mount(grid, SCENES.map((sc) => {
      const stat = statFor(sc.id);
      const isDefault = store.state.settings.scene === sc.id;
      const isPlaying = audio.currentId === sc.id;
      const play = sc.id === 'silence' ? null : h('button', {
        type: 'button', class: 'btn btn-paper', 'aria-pressed': String(isPlaying),
        onclick: async () => {
          if (audio.currentId === sc.id) { audio.stop(0.5); draw(); return; }
          audio.setVolume(store.state.settings.volume);
          const ok = await audio.play(sc.id, 1);
          if (!ok) toast(t('scenes.noAudio'));
          draw();
        },
      }, isPlaying ? t('scenes.stop') : t('scenes.listen'));
      const choose = h('button', {
        type: 'button', class: 'btn btn-ghost', disabled: isDefault,
        onclick: () => { store.setSettings({ scene: sc.id }); toast(t('scenes.chosen', { scene: sceneName(sc, lang) })); draw(); },
      }, isDefault ? t('scenes.isDefault') : t('scenes.use'));

      return h('article', { class: 'scene-card', style: `--sky-a:${sc.sky[0]};--sky-b:${sc.sky[1]}` },
        h('h2', null, sceneName(sc, lang),
          rec.status === 'ready' && rec.best.id === sc.id ? h('span', { class: 'scene-best' }, t('setup.yourBest')) : null),
        h('p', null, sceneBlurb(sc, lang)),
        h('p', { class: 'scene-stat' }, stat ? t('scenes.stat', { score: stat.avg, n: stat.n }) : t('scenes.untried')),
        h('div', { class: 'row' }, play, choose));
    }));
  }

  const volume = h('input', {
    type: 'range', min: '0', max: '1', step: '0.05', value: String(store.state.settings.volume), id: 'vol',
    oninput: (e) => { const v = Number(e.target.value); audio.setVolume(v); store.setSettings({ volume: v }); },
  });

  mount(root,
    h('header', { class: 'view-head' },
      h('h1', null, t('scenes.title')),
      h('p', { class: 'lede' }, t('scenes.lede'))),
    advice,
    h('div', { class: 'row' }, h('label', { for: 'vol', class: 'label label-inline' }, t('focus.volume')), volume),
    grid);
  draw();

  return () => audio.stop(0.5); // stop the preview when leaving the page
}
