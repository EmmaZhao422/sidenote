// The summary page: what you worked on, how steady your attention was, what
// your stray thoughts were about, and which scene you focus best with.

import { h, mount, renderText, toast, minutesText, dayLabel, segmented } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { aggregate, rangeFor, recommendScene, breadthLabel } from '../score.js';
import { CATEGORIES } from '../classify.js';
import { columnChart, barList } from '../charts.js';
import { getScene, sceneName } from '../scenes.js';
import { localRecap } from '../recap.js';
import { aiMode, writeRecap } from '../ai.js';
import { buildSample } from '../sample.js';
import { adSlot } from '../ads.js';

export function summaryView(root) {
  let rangeKey = '7d';
  const body = h('div', { class: 'summary' });

  function tile(label, value, note) {
    return h('div', { class: 'tile' },
      h('span', { class: 'tile-label' }, label),
      h('span', { class: 'tile-value' }, value),
      note ? h('span', { class: 'tile-note' }, note) : null);
  }

  function draw() {
    const state = store.state;
    const lang = getLang();
    const range = rangeFor(rangeKey);
    const stats = aggregate(state, range);
    const rec = recommendScene(state.sessions);

    // ---- nothing recorded yet
    if (!state.sessions.length) {
      mount(body, h('div', { class: 'empty-block' },
        h('h2', null, t('summary.emptyTitle')),
        h('p', null, t('summary.emptyBody')),
        h('div', { class: 'row' },
          h('a', { class: 'btn btn-ink', href: '#/focus' }, t('home.start')),
          h('button', {
            type: 'button', class: 'btn btn-quiet',
            onclick: () => { const s = buildSample(lang); store.addSample(s.sessions, s.thoughts); draw(); },
          }, t('summary.showExample')))));
      return;
    }

    const sampleNote = store.hasSample() ? h('p', { class: 'notice' },
      t('summary.sampleNote'), ' ',
      h('button', { type: 'button', class: 'linklike', onclick: () => { store.removeSample(); draw(); } }, t('summary.removeSample'))) : null;

    const ranges = segmented(t('summary.range'), [
      { value: 'today', label: t('summary.today') },
      { value: '7d', label: t('summary.7d') },
      { value: '30d', label: t('summary.30d') },
      { value: 'all', label: t('summary.all') },
    ], rangeKey, (v) => { rangeKey = v; draw(); });

    if (!stats.sessionCount) {
      mount(body, sampleNote, ranges, h('p', { class: 'empty' }, t('summary.emptyRange')));
      return;
    }

    // ---- headline numbers
    const tiles = h('div', { class: 'tiles' },
      tile(t('summary.focusTime'), minutesText(stats.focusMin), t('summary.blocks', { n: stats.sessionCount })),
      tile(t('summary.focusScore'), stats.avgScore === null ? '–' : String(stats.avgScore),
        stats.trend ? t(`summary.trend.${stats.trend}`) : t('summary.outOf100')),
      tile(t('summary.parked'), String(stats.thoughtCount),
        stats.wanderPer25 === null ? null : t('summary.per25', { n: stats.wanderPer25 })),
      tile(t('summary.dealt'), String(stats.doneCount), stats.openCount ? t('summary.stillOpen', { n: stats.openCount }) : t('summary.noneOpen')));

    // ---- written recap
    const recapText = h('div');
    const recapFrom = h('span', { class: 'note-reply-from' }, t('summary.recapAuto'));
    mount(recapText, renderText(localRecap(stats, rec)));
    const aiBtn = aiMode() === 'offline' ? null : h('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: async () => {
        aiBtn.disabled = true;
        aiBtn.textContent = t('summary.recapWriting');
        try {
          // Only numbers and the goals the student typed are sent, not the thoughts themselves.
          const text = await writeRecap({
            period: rangeKey, sessions: stats.sessionCount, focusMinutes: stats.focusMin, longestBlockMinutes: stats.longestMin,
            averageFocusScore: stats.avgScore, scoreTrend: stats.trend, goals: stats.goals,
            strayThoughts: stats.thoughtCount, strayThoughtsPer25Min: stats.wanderPer25, thoughtKinds: stats.byCategory,
            thoughtsByFiveMinuteBin: stats.timing, thoughtsStillOpen: stats.openCount,
            bestScene: rec.status === 'ready' ? { name: getScene(rec.best.id).en, averageScore: rec.best.avg, sessions: rec.best.n } : null,
          });
          mount(recapText, renderText(text));
          recapFrom.textContent = t('note.fromAi');
        } catch (err) {
          toast(t('note.error', { detail: err.message || '' }));
        }
        aiBtn.disabled = false;
        aiBtn.textContent = t('summary.recapAi');
      },
    }, t('summary.recapAi'));
    const recap = h('section', { class: 'card recap' },
      h('div', { class: 'row row-between' }, h('h2', null, t('summary.recapTitle')), aiBtn),
      recapFrom, recapText);

    // ---- focus time per day
    let perDay = null;
    if (stats.byDay.length > 1) {
      const every = stats.byDay.length > 14 ? 7 : stats.byDay.length > 7 ? 2 : 1;
      perDay = h('section', { class: 'card' },
        h('h2', null, t('summary.perDayTitle')),
        columnChart(stats.byDay.map((d) => ({
          label: dayLabel(d.day),
          value: d.minutes,
          tip: d.minutes
            ? t('summary.dayTip', { day: dayLabel(d.day, 'long'), time: minutesText(d.minutes), score: d.score ?? '–' })
            : t('summary.dayTipNone', { day: dayLabel(d.day, 'long') }),
        })), { labelEvery: every, unit: t('unit.minShort') }));
    }

    // ---- what the stray thoughts were about
    let kinds = null;
    let timing = null;
    if (stats.thoughtCount) {
      const rows = CATEGORIES
        .map((c) => ({ label: t(`cat.${c}`), value: stats.byCategory[c], tip: t('summary.kindTip', { kind: t(`cat.${c}`), n: stats.byCategory[c] }) }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value);
      const b = breadthLabel(stats.breadth);
      kinds = h('section', { class: 'card' },
        h('h2', null, t('summary.kindsTitle')),
        barList(rows),
        b ? h('p', { class: 'hint' }, t(`recap.breadth.${b}`)) : null);

      if (stats.timing.some((n) => n > 0)) {
        const lastUsed = Math.max(4, stats.timing.reduce((acc, n, i) => (n > 0 ? i : acc), 0));
        timing = h('section', { class: 'card' },
          h('h2', null, t('summary.timingTitle')),
          h('p', { class: 'hint' }, t('summary.timingHint')),
          columnChart(stats.timing.slice(0, lastUsed + 1).map((n, i) => ({
            label: i === 9 ? '45+' : String(i * 5),
            value: n,
            tip: i === 9 ? t('summary.timingTipLate', { n }) : t('summary.timingTip', { from: i * 5, to: i * 5 + 5, n }),
          }))));
      }
    }

    // ---- scenes
    const sceneRows = rec.stats.map((s, i) => h('tr', null,
      // the current favourite gets the highlighter
      h('th', { scope: 'row' }, h('span', { class: i === 0 && rec.status === 'ready' ? 'hl' : null }, sceneName(getScene(s.id), lang))),
      h('td', null, String(s.avg)),
      h('td', null, String(s.n)),
      h('td', null, minutesText(s.minutes))));
    const scenes = h('section', { class: 'card' },
      h('h2', null, t('summary.scenesTitle')),
      h('p', null, rec.status === 'ready'
        ? t(rec.confidence === 'solid' ? 'recap.sceneSolid' : 'recap.sceneEarly', { scene: sceneName(getScene(rec.best.id), lang), score: rec.best.avg })
        : t('scenes.learning', { n: rec.need })),
      rec.status === 'ready' && rec.similar.length
        ? h('p', { class: 'hint' }, t('scenes.similar', { scenes: rec.similar.map((id) => sceneName(getScene(id), lang)).join(lang === 'zh' ? '、' : ', ') })) : null,
      h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, t('summary.colScene')), h('th', { scope: 'col' }, t('summary.colScore')),
          h('th', { scope: 'col' }, t('summary.colBlocks')), h('th', { scope: 'col' }, t('summary.colTime')))),
        h('tbody', null, sceneRows)),
      h('p', { class: 'hint' }, t('summary.scenesHint')));

    mount(body, sampleNote, ranges, tiles, recap, perDay,
      h('div', { class: 'two-col' }, kinds, timing), scenes,
      h('p', { class: 'hint' }, t('summary.scoreExplain')));
  }

  mount(root,
    h('header', { class: 'view-head' },
      h('h1', null, t('summary.title')),
      h('p', { class: 'lede' }, t('summary.lede'))),
    body, adSlot('insights'));
  draw();
}
