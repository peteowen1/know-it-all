// Minimal offline cache.
//
// Strategy: network-first for navigations (so a deploy is picked up on the next
// online visit), cache-first for hashed build assets (they never change under a
// given URL, so serving them from cache is always correct and instant).
//
// CACHE_VERSION must change whenever the caching logic changes; asset URLs are
// content-hashed by Vite, so a new build produces new keys automatically and
// old entries are cleaned up on activate.

const CACHE_VERSION = 'sqt-v3';

// Runtime entries are capped, oldest first, so every deploy's new hashed files
// don't pile up forever. Code (JS/CSS) and everything else (mostly ~540 flag
// SVGs) have separate caps: with one shared cap, browsing flags evicted the
// app's own entry bundle, and the next offline load failed. A build is ~40
// code files, so the code cap always keeps the current build whole.
const MAX_CODE_ENTRIES = 150;
const MAX_OTHER_ENTRIES = 300;
const SHELL = ['./', './index.html'];

const isCode = (request) => /\.(js|css)$/.test(new URL(request.url).pathname);

async function trimCache(cache) {
  const keys = await cache.keys(); // oldest first
  const isShell = (request) => SHELL.some((path) => new URL(path, self.location).href === request.url);
  const runtime = keys.filter((request) => !isShell(request));
  const overflow = (list, max) => list.slice(0, Math.max(0, list.length - max));
  const doomed = [
    ...overflow(runtime.filter(isCode), MAX_CODE_ENTRIES),
    ...overflow(runtime.filter((request) => !isCode(request)), MAX_OTHER_ENTRIES)
  ];
  await Promise.all(doomed.map((request) => cache.delete(request)));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)));
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
          // A host's SPA fallback can answer a missing (old-build) chunk with
          // index.html and a 200; caching that would serve HTML as JS forever.
          const isHtml = (response.headers.get('content-type') || '').includes('text/html');
          if (response.ok && !isHtml) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy).then(() => trimCache(cache)));
          }
          return response;
        })
    )
  );
});
