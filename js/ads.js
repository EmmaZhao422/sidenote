// Ad placements. Nothing loads until CONFIG.ads.adsenseClient is filled in
// (see docs/MONETIZATION.md). Two rules are built in on purpose:
//
//   1. Ads never appear while someone is planning or focusing, and never on the
//      app's own tool screens (margin, summary, settings). A study tool that
//      distracts you is working against itself, and ad networks do not allow
//      ads on screens that have no content of their own to read.
//   2. Each placement is labelled "Advertisement", which AdSense policy allows
//      and which keeps the page honest.
//
// Add ?adpreview=1 to the address to see where the placements sit.

import { CONFIG } from './config.js';

let scriptRequested = false;

function loadAdSense() {
  if (scriptRequested) return;
  scriptRequested = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CONFIG.ads.adsenseClient)}`;
  document.head.append(s);
}

function label(lang) {
  return String(lang || '').toLowerCase().startsWith('zh') ? '广告' : 'Advertisement';
}

// Returns an element to place in the page, or null when ads are off.
export function adSlot(name, lang = document.documentElement.lang) {
  const client = CONFIG.ads.adsenseClient;
  const slot = CONFIG.ads.slots[name];
  const preview = new URLSearchParams(location.search).has('adpreview');

  if (!client || !slot) {
    if (!preview) return null;
    const box = document.createElement('aside');
    box.className = 'ad ad-preview';
    box.textContent = `${label(lang)} · ${name}`;
    return box;
  }

  loadAdSense();
  const wrap = document.createElement('aside');
  wrap.className = 'ad';
  wrap.setAttribute('aria-label', label(lang));
  const tag = document.createElement('span');
  tag.className = 'ad-label';
  tag.textContent = label(lang);
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = client;
  ins.dataset.adSlot = slot;
  ins.dataset.adFormat = 'auto';
  ins.dataset.fullWidthResponsive = 'true';
  wrap.append(tag, ins);

  // AdSense fills the unit once it is actually on the page.
  requestAnimationFrame(() => {
    if (!ins.isConnected) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked by an ad blocker */ }
  });
  return wrap;
}
