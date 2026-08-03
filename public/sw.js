// Minimal offline cache.
//
// Strategy: network-first for navigations (so a deploy is picked up on the next
// online visit), cache-first for hashed build assets (they never change under a
// given URL, so serving them from cache is always correct and instant).
//
// CACHE_VERSION must change whenever the caching logic changes; asset URLs are
// content-hashed by Vite, so a new build produces new keys automatically and
// old entries are cleaned up on activate.

const CACHE_VERSION = 'sqt-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(['./', './index.html'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache cross-origin requests (the Google Fonts stylesheet); letting
  // them fail closed keeps the app usable offline with fallback fonts.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // fetch() does not reject on a 4xx/5xx, so this must be gated on
          // response.ok. Without the check, a transient error page served by
          // the CDN — most likely in the minutes after a deploy — would be
          // cached as the app shell and then served on every later offline
          // load, until some future successful navigation overwrote it.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
