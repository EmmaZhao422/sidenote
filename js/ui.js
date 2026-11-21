// Small DOM helpers shared by every view. No framework: `h()` builds elements,
// and each view is a function that returns an element.

import { getLang, t } from './i18n.js';

// h('button', { class: 'btn', onclick: fn }, 'Label', childEl, ...)
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') throw new Error('h(): raw HTML is not allowed, build nodes instead');
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

// Replace everything inside `el`. Unlike el.replaceChildren(), null and false
// are skipped, so views can write `condition ? node : null`.
export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

// Turns the AI's plain-text reply into paragraphs and lists. Everything goes in
// as text nodes, so nothing the model (or a student) writes can run as HTML.
export function renderText(text) {
  const root = h('div', { class: 'reply-text' });
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) root.append(h('p', null, inline(para.join(' '))));
    para = [];
  };
  for (const line of lines) {
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!list) { list = h('ul'); root.append(list); }
      list.append(h('li', null, inline(bullet[1])));
    } else if (!line.trim()) {
      flushPara();
      list = null;
    } else {
      list = null;
      para.push(line.trim());
    }
  }
  flushPara();
  return root;
}

// **bold** and `code` only
function inline(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] !== undefined ? h('strong', null, m[1]) : h('code', null, m[2]));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

let toastTimer = 0;
// Says something to screen-reader users without showing it: "Done: buy milk",
// "Removed", "Kind changed to Worry". One quiet region for the whole app.
export function announce(message) {
  let el = document.getElementById('sr-status');
  if (!el) {
    el = h('div', { id: 'sr-status', class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = '';
  clearTimeout(announceTimer);
  // (a changed text node is announced more reliably than a replaced one)
  setTimeout(() => { el.textContent = message; }, 50);
  // Stale text left in a live region gets read again by anyone browsing the page.
  announceTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}
let announceTimer = 0;

export function clearAnnounce() {
  clearTimeout(announceTimer);
  const el = document.getElementById('sr-status');
  if (el) el.textContent = '';
}

export function toast(message, ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
}

// 1500 -> "25:00"
export function clock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 95 -> "1 h 35 min"
export function minutesText(min) {
  const m = Math.round(min);
  if (m < 60) return t('unit.min', { n: m });
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? t('unit.hmin', { h: hours, n: rest }) : t('unit.h', { h: hours });
}

function locale() {
  return getLang() === 'zh' ? 'zh-CN' : 'en-US';
}

export function dayLabel(ts, style = 'short') {
  const opts = style === 'long'
    ? { weekday: 'long', month: 'long', day: 'numeric' }
    : { month: 'numeric', day: 'numeric' };
  return new Date(ts).toLocaleDateString(locale(), opts);
}

export function timeLabel(ts) {
  // hour12 gives 上午/下午 in Chinese, so "5:25" is never mistaken for a countdown
  return new Date(ts).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function whenLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? timeLabel(ts) : `${dayLabel(ts)} ${timeLabel(ts)}`;
}

// A segmented choice: [{ value, label }]
// Works like a group of radio buttons: one Tab stop, arrow keys move the choice.
// wrap.setValue(v) changes the selection from outside without calling onChange.
export function segmented(name, options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name });
  const buttons = options.map((o) => h('button', {
    type: 'button', class: 'seg-btn', role: 'radio',
    onclick: () => { mark(o.value); onChange(o.value); },
  }, o.label));
  function mark(v) {
    const chosen = options.findIndex((o) => o.value === v);
    buttons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === chosen));
      b.tabIndex = i === chosen || (chosen < 0 && i === 0) ? 0 : -1;
    });
  }
  wrap.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const edge = { Home: 0, End: buttons.length - 1 }[e.key];
    if (!step && edge === undefined) return;
    e.preventDefault();
    const at = buttons.indexOf(document.activeElement);
    const next = edge !== undefined ? buttons[edge] : buttons[(at + step + buttons.length) % buttons.length];
    const place = [...document.querySelectorAll('[role="radiogroup"]')].indexOf(wrap);
    next.focus();
    next.click();
    // Choosing may have redrawn the screen, this group included (even in another
    // language). Put the cursor back on the chosen option of the group in its place.
    if (!next.isConnected) {
      const groups = [...document.querySelectorAll('[role="radiogroup"]')];
      const again = groups.find((g) => g.getAttribute('aria-label') === name) || groups[place];
      again?.querySelector('[aria-checked="true"]')?.focus();
    }
  });
  wrap.setValue = mark;
  mark(value);
  wrap.append(...buttons);
  return wrap;
}

// The Chinese "handwritten" face is a separate stylesheet, fetched only when
// Chinese text is going to be shown (see css/hand-zh.css).
let handZhLoaded = false;
export function loadChineseHand() {
  if (handZhLoaded || typeof document === 'undefined') return;
  handZhLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/hand-zh.css';
  document.head.append(link);
}
export const hasChinese = (text) => /[\u3400-\u9fff]/.test(String(text || ''));

// True on phones and tablets (a finger, not a mouse)
export function isTouchDevice() {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}
