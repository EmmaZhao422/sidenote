// The summary page: what you worked on, how steady your attention was, what
// your stray thoughts were about, and which scene you focus best with.

import { h, mount, renderText, toast, minutesText, dayLabel, whenLabel, segmented } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { aggregate, rangeFor, recommendScene, breadthLabel } from '../score.js';
import { CATEGORIES } from '../classify.js';
import { columnChart, barList } from '../charts.js';
import { getScene, sceneName } from '../scenes.js';
import { localRecap } from '../recap.js';
import { aiMode, writeRecap } from '../ai.js';
import { buildSample } from '../sample.js';
import { shareCardButton } from '../sharecard.js';

export function summaryView(root) {
  let rangeKey = '7d';
  let preview = null; // example data, shown without being saved
  const body = h('div', { class: 'summary' });

  function tile(label, value, note) {
    return h('div', { class: 'tile' },
      h('span', { class: 'tile-label' }, label),
      h('span', { class: 'tile-value' }, value),
      note ? h('span', { class: 'tile-note' }, note) : null);
  }

  function draw() {
    const lang = getLang();
    const state = preview ? { ...store.state, sessions: preview.sessions, thoughts: preview.thoughts } : store.state;
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
            onclick: () => { preview = buildSample(lang); draw(); },
          }, t('summary.showExample')))));
      return;
    }

    // Example data is only ever a preview. (Older versions saved it; that copy can still be removed here.)
    const sampleNote = preview || store.hasSample() ? h('p', { class: 'notice' },
      t('summary.sampleNote'), ' ',
      h('button', {
        type: 'button', class: 'linklike',
        onclick: () => { preview = null; if (store.hasSample()) store.removeSample(); draw(); },
      }, t('summary.removeSample'))) : null;

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
        barList(rows));

      if (stats.timing.some((n) => n > 0)) {
        const lastUsed = Math.max(4, stats.timing.reduce((acc, n, i) => (n > 0 ? i : acc), 0));
        timing = h('section', { class: 'card' },
          h('h2', null, t('summary.timingTitle')),
          h('p', { class: 'hint' }, t('summary.timingHint')),
          columnChart(stats.timing.slice(0, lastUsed + 1).map((n, i) => ({
            label: i === 9 ? '45+' : `${i * 5}–${i * 5 + 5}`,
            value: n,
            tip: i === 9 ? t('summary.timingTipLate', { n }) : t('summary.timingTip', { from: i * 5, to: i * 5 + 5, n }),
          }))));
      }
    }

    // ---- scenes
    const sceneRows = rec.stats.map((s, i) => h('tr', null,
      // the current favourite gets the highlighter
      h('th', { scope: 'row' }, h('span', { class: i === 0 && rec.status === 'ready' ? 'hl' : null }, sceneName(getScene(s.id), lang))),
      h('td', { 'data-label': t('summary.colScore') }, String(s.avg)),
      h('td', { 'data-label': t('summary.colBlocks') }, String(s.n)),
      h('td', { 'data-label': t('summary.colTime') }, minutesText(s.minutes))));
    const scenes = h('section', { class: 'card' },
      h('h2', null, t('summary.scenesTitle')),
      // the favourite is already named in the written recap above; here only say when there is none yet
      rec.status === 'ready' ? null : h('p', null, rec.oneScene ? t('scenes.oneScene') : t('scenes.learning', { n: rec.need })),
      rec.status === 'ready' && rec.similar.length
        ? h('p', { class: 'hint' }, t('scenes.similar', { scenes: rec.similar.map((id) => sceneName(getScene(id), lang)).join(lang === 'zh' ? '、' : ', ') })) : null,
      h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, t('summary.colScene')), h('th', { scope: 'col' }, t('summary.colScore')),
          h('th', { scope: 'col' }, t('summary.colBlocks')), h('th', { scope: 'col' }, t('summary.colTime')))),
        h('tbody', null, sceneRows)),
      h('p', { class: 'hint' }, t('summary.scenesHint')));

    // ---- the blocks themselves, newest first, each one opens its review
    const recentBlocks = state.sessions
      .filter((s) => s.startedAt >= range.from && s.startedAt <= range.to)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 10);
    const blocks = h('section', { class: 'card' },
      h('h2', null, t('summary.blocksTitle')),
      h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, t('summary.colGoal')), h('th', { scope: 'col' }, t('summary.colWhen')),
          h('th', { scope: 'col' }, t('summary.colTime')), h('th', { scope: 'col' }, t('summary.colScoreShort')),
          h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, t('summary.review'))))),
        h('tbody', null, recentBlocks.map((s) => h('tr', null,
          h('th', { scope: 'row' }, s.goal || t('focus.noGoal')),
          h('td', null, whenLabel(s.startedAt)),
          h('td', null, minutesText(Math.max(1, s.focusSec / 60))),
          h('td', { 'data-label': t('summary.colScoreShort') }, String(s.score ?? '–')),
          h('td', null, preview ? null : h('a', { href: `#/review/${s.id}` }, t('summary.review'))))))));

    // a picture of these numbers to share (numbers only: no goals, no thoughts)
    const share = preview ? null : h('div', { class: 'row share-row' },
      shareCardButton(() => ({ stats, rec, rangeLabel: t(`summary.${rangeKey}`) })),
      h('span', { class: 'hint' }, t('share.hint')));

    mount(body, sampleNote, ranges, tiles, share, recap, perDay,
      h('div', { class: 'two-col' }, kinds, timing), scenes, blocks,
      h('p', { class: 'hint' }, t('summary.scoreExplain')));
  }

  mount(root,
    h('header', { class: 'view-head' },
      h('h1', null, t('summary.title')),
      h('p', { class: 'lede' }, t('summary.lede'))),
    body);
  draw();
}
