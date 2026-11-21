// Service worker: lets the site keep working when the connection drops
// (library wifi, a train).
//
// - On the first visit it saves the whole app, so even a visitor who only saw
//   the home page can run a study block offline afterwards.
// - After that the rule is "network first": every request goes to the network,
//   and the saved copy is used only if the network fails (or, for the page itself,
//   takes more than three seconds). So visitors get the newest version whenever they are
//   online, and nobody is stuck on an old one after you push a change.

const CACHE = 'sidenote-offline-v3';

// The files the app itself is made of. tests/sw.test.js checks this list
// against the js/ and css/ folders, so a new file can't be forgotten.
const SHELL = [
  './', 'index.html', 'css/app.css', 'css/hand-zh.css', 'favicon.svg', 'manifest.webmanifest', 'icon-192.png',
  'fonts/bricolage-grotesque-latin.woff2', 'fonts/caveat-latin.woff2',
  'js/ads.js', 'js/ai.js', 'js/analytics.js', 'js/audio.js', 'js/backdrop.js', 'js/block.js', 'js/breaktimer.js', 'js/charts.js',
  'js/classify.js', 'js/config.js', 'js/csv.js', 'js/handoff.js', 'js/i18n.js', 'js/ics.js', 'js/main.js', 'js/prompts.js', 'js/recap.js',
  'js/sample.js', 'js/scenes.js', 'js/score.js', 'js/sharecard.js', 'js/site.js', 'js/store.js', 'js/theme.js', 'js/ui.js',
  'js/views/home.js', 'js/views/margin.js', 'js/views/note.js', 'js/views/scenes.js', 'js/views/session.js',
  'js/views/settings.js', 'js/views/summary.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // One missing file must not stop the rest from being saved
      // 'reload' skips the browser's own cache, so the saved copy is the newest one
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only the site's own files. Fonts, ads and AI requests are left alone.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const saved = () => caches.match(request, { ignoreSearch: true });
  const fresh = fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });

  // Scripts and styles: the network, and the saved copy only if the network fails
  // outright. They are never raced against a timer, because a page built from some
  // new files and some old ones does not run at all.
  if (request.mode !== 'navigate') {
    event.respondWith(fresh.catch(() => saved().then((hit) => hit || Response.error())));
    return;
  }

  // Opening the page itself: on a connection that hangs (weak wifi), show the saved
  // page after 3 seconds instead of a blank tab.
  const slow = new Promise((resolve) => {
    setTimeout(() => saved().then((hit) => { if (hit) resolve(hit); }), 3000);
  });
  event.respondWith(
    Promise.race([fresh, slow]).catch(() => saved().then((hit) => hit || Response.error())),
  );
});
