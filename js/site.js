// Used by the plain pages (guides, about, privacy, terms): fills in the ad
// placement, if ads are switched on in config.js.
import { adSlot } from './ads.js';

document.querySelectorAll('[data-ad]').forEach((el) => {
  const ad = adSlot(el.dataset.ad);
  if (ad) el.replaceWith(ad); else el.remove();
});
