// Optional visit counter (Cloudflare Web Analytics). Off unless a token is set
// in config.js. It counts page views; it never sees what a student writes.

import { CONFIG } from './config.js';

export function startAnalytics() {
  const token = CONFIG.analytics && CONFIG.analytics.cloudflareToken;
  if (!token) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token });
  document.head.append(s);
}
