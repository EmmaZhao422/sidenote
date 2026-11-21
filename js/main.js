// Entry point: picks the view for the current address (#/focus, #/margin, ...)
// and keeps the navigation, language and "waiting" count up to date.

import { store } from './store.js';
import { t, getLang } from './i18n.js';
import { CONFIG } from './config.js';
import { applyTheme } from './theme.js';
import { startAnalytics } from './analytics.js';
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

function render() {
  destroy?.();
  destroy = null;
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
  if (!firstRender) {
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true }); // so keyboard and screen-reader users land on the new screen
  }
  firstRender = false;
}

document.getElementById('lang-toggle').addEventListener('click', () => {
  store.setSettings({ lang: getLang() === 'zh' ? 'en' : 'zh' });
  render();
});

// Keep a copy of the site for when the connection drops (see sw.js)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline copy is a bonus, not a requirement */ });
}

// Follow the device when it switches between light and dark
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(store.state.settings.theme));

window.addEventListener('hashchange', render);
store.subscribe(updateCount);
render();
startAnalytics();
