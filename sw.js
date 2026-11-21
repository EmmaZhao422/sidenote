// Service worker: lets the site keep working when the connection drops
// (library wifi, a train). The rule is "network first": every request goes to
// the network, and a saved copy is used only when that fails. So visitors
// always get the newest version when they are online, and nobody is stuck on
// an old one after you push a change.

const CACHE = 'sidenote-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only the site's own files. Fonts, ads and AI requests are left alone.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((saved) => saved || Response.error())),
  );
});
