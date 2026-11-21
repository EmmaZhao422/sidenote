// Two small chart types, drawn with plain HTML and CSS (no chart library).
// Both show a single series in one colour: the bars compare amounts, they
// don't need colour to tell things apart. Every bar has a hover/focus tooltip
// with the exact value, and the same values are exposed to screen readers.

import { h } from './ui.js';

// Vertical bars over time or over ordered bins.
// data: [{ label, value, tip }]   options: { labelEvery, unit }
export function columnChart(data, options = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = niceCeil(max);
  const every = options.labelEvery || 1;
  const peak = data.findIndex((d) => d.value === max);

  const cols = h('div', { class: 'cols', role: 'list' });
  data.forEach((d, i) => {
    const pct = (d.value / top) * 100;
    cols.append(h('div', {
      class: 'col', role: 'listitem', tabindex: i === 0 ? '0' : '-1', 'aria-label': d.tip, dataset: { tip: d.tip },
    },
    h('div', { class: 'col-track' },
      // label only the tallest bar; the rest are a hover away
      i === peak && d.value > 0 ? h('span', { class: 'col-value', style: `bottom:${pct}%` }, String(d.value)) : null,
      h('div', { class: 'col-bar', style: `height:${pct}%` })),
    h('span', { class: 'col-label' }, i % every === 0 || i === data.length - 1 ? d.label : '')));
  });

  arrowKeys(cols);
  return h('div', { class: 'chart' },
    h('div', { class: 'chart-axis', 'aria-hidden': 'true' },
      h('span', null, `${top}${options.unit ? ' ' + options.unit : ''}`), h('span', null, String(top / 2)), h('span', null, '0')),
    cols);
}

// Horizontal bars for comparing a handful of named things.
// rows: [{ label, value, tip }]
export function barList(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const list = h('div', { class: 'bars', role: 'list' }, rows.map((r, i) =>
    h('div', { class: 'bar-row', role: 'listitem', tabindex: i === 0 ? '0' : '-1', 'aria-label': r.tip, dataset: { tip: r.tip } },
      h('span', { class: 'bar-label' }, r.label),
      h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: `width:${(r.value / max) * 100}%` })),
      h('span', { class: 'bar-value' }, String(r.value)))));
  arrowKeys(list);
  return list;
}

// A chart is one stop for the Tab key; the arrow keys walk through its bars.
function arrowKeys(group) {
  group.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    const items = [...group.children];
    const next = items[items.indexOf(document.activeElement) + step];
    if (!next) return;
    e.preventDefault();
    items.forEach((el) => { el.tabIndex = el === next ? 0 : -1; });
    next.focus();
  });
}

// Round an axis maximum up to a friendly number: 37 -> 40, 130 -> 150
function niceCeil(x) {
  if (x <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(x));
  const n = x / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  const candidate = step * pow;
  // prefer a tighter ceiling when there is a lot of headroom
  if (candidate >= x * 1.6 && pow >= 10) return Math.ceil(x / (pow / 2)) * (pow / 2);
  return candidate;
}
