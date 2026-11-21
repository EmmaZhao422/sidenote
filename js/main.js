// Entry point: picks the view for the current address (#/focus, #/margin, ...)
// and keeps the navigation, language and "waiting" count up to date.

import { store } from './store.js';
import { t, getLang } from './i18n.js';
import { toast, loadChineseHand, hasChinese } from './ui.js';
import { CONFIG } from './config.js';
import { applyTheme } from './theme.js';
import { breakTimer } from './breaktimer.js';
import { startAnalytics } from './analytics.js';
import { connectClaudeApp, insideClaudeApp } from './ai.js';
import { homeView } from './views/home.js';
import { sessionView } from './views/session.js';
import { marginView, reviewView } from './views/margin.js';
import { summaryView } from './views/summary.js';
import { scenesView } from './views/scenes.js';
import { settingsView } from './views/settings.js';

const ROUTES = {
  '': homeView,
  focus: sessionView,
  margin: marginView,
  summary: summaryView,
  scenes: scenesView,
  settings: settingsView,
};

const view = document.getElementById('view');
let destroy = null;
let firstRender = true;

function route() {
  const [name = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, arg };
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function applyLanguage() {
  const lang = getLang();
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('site.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = lang === 'zh' ? CONFIG.siteNameZh : CONFIG.siteName; });
  document.querySelectorAll('[data-guides]').forEach((el) => { el.href = lang === 'zh' ? 'guides/zh/' : 'guides/'; });
  document.querySelectorAll('[data-page]').forEach((el) => {
    el.href = (lang === 'zh' ? 'zh/' : '') + el.dataset.page;
  });
  const toggle = document.getElementById('lang-toggle');
  toggle.textContent = lang === 'zh' ? 'English' : '中文';
  toggle.setAttribute('lang', lang === 'zh' ? 'en' : 'zh-CN');
  const support = document.getElementById('support-link');
  support.hidden = !CONFIG.supportUrl;
  if (CONFIG.supportUrl) support.href = CONFIG.supportUrl;
  document.getElementById('source-link').href = CONFIG.repoUrl;
}

function updateCount() {
  const n = store.state.thoughts.filter((x) => x.status !== 'done').length;
  const badge = document.getElementById('open-count');
  badge.textContent = n ? String(n) : '';
  badge.hidden = !n;
}

// quiet = a redraw the student did not ask for (another tab saved something):
// stay where they are on the page and do not move keyboard focus
function render(quiet = false) {
  const keepY = quiet === true ? window.scrollY : null;
  destroy?.();
  destroy = null;
  // index.html hides its own home-page text on other screens until this first draw
  document.documentElement.classList.remove('is-deep');
  applyTheme(store.state.settings.theme);
  applyLanguage();
  const { name, arg } = route();

  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === (name === 'review' ? 'margin' : name);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  view.className = `view view-${name || 'home'}`;
  if (name === 'review') destroy = reviewView(view, navigate, arg) || null;
  else destroy = (ROUTES[name] || homeView)(view, navigate, render) || null;

  updateCount();
  if (keepY !== null) {
    window.scrollTo(0, keepY);
  } else if (!firstRender) {
    window.scrollTo(0, 0);
    // Keyboard and screen-reader users land on the new screen: on the field the screen
    // itself put the cursor in, if it did, and otherwise on the screen as a whole.
    if (!view.contains(document.activeElement) || document.activeElement === view) view.focus({ preventScroll: true });
  }
  firstRender = false;
}

document.getElementById('lang-toggle').addEventListener('click', () => {
  store.setSettings({ lang: getLang() === 'zh' ? 'en' : 'zh' });
  render();
  wantChineseHand();
});

// Keep a copy of the site for when the connection drops (see sw.js)
try {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline copy is a bonus, not a requirement */ });
  }
} catch { /* some embedded views don't allow it */ }

// When the site is opened as a page inside the Claude app, Claude can answer directly.
if (insideClaudeApp()) {
  document.body.classList.add('in-claude-app');
  connectClaudeApp(() => {
    // Redraw so buttons and status reflect the connection, unless a study block is on screen
    if (route().name !== 'focus') render(true);
  });
}

// Follow the device when it switches between light and dark
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(store.state.settings.theme));

// Fetch the Chinese handwriting face once Chinese text is on screen
function wantChineseHand() {
  if (getLang() === 'zh' || store.state.thoughts.slice(-30).some((x) => hasChinese(x.text))) loadChineseHand();
}

// A link can ask for a language: ...?lang=zh (used by the Chinese landing page)
try {
  const asked = new URLSearchParams(location.search).get('lang');
  if ((asked === 'zh' || asked === 'en') && !store.state.settings.lang) store.setSettings({ lang: asked });
} catch { /* no query string support: carry on */ }

window.addEventListener('hashchange', () => render());
store.subscribe((_, info) => {
  updateCount();
  wantChineseHand();
  // Another tab changed something: show it here too, unless the student is mid-sentence.
  // (The study screens look after themselves.)
  // The summary is left alone (it would lose the chosen range); it catches up on the next visit.
  if (!info?.external || ['focus', 'summary', 'settings'].includes(route().name)) return;
  const el = document.activeElement;
  const busy = el && view.contains(el) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
  if (!busy) render(true);
});

// A message that stays on screen until dismissed, for things a passing toast would hide
function banner(id, text, action) {
  if (document.getElementById(id)) return;
  const el = document.createElement('div');
  el.id = id;
  el.className = 'banner';
  el.setAttribute('role', 'alert');
  const p = document.createElement('p');
  p.textContent = text;
  el.append(p);
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-paper';
    btn.textContent = action.label;
    btn.addEventListener('click', action.run);
    el.append(btn);
  }
  document.body.prepend(el);
}
function downloadBackup() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sidenote-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
store.onStorageFailure(() => banner('storage-banner', t('settings.storageFailed'), { label: t('settings.export'), run: downloadBackup }));
if (store.foundUnreadable) banner('unreadable-banner', t('settings.unreadable'));

// A page left open overnight: when the student comes back on a new day, "today" has moved
let shownDay = store.dayKey(0);
document.addEventListener('visibilitychange', () => {
  if (document.hidden || shownDay === store.dayKey(0)) return;
  shownDay = store.dayKey(0);
  if (route().name === '') render(true);
});
render();
wantChineseHand();
breakTimer.resume();
startAnalytics();
