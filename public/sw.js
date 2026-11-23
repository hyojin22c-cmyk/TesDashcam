// Offline-capable service worker.
// The build replaces the two placeholders below (see `precacheServiceWorker` in vite.config.ts).
// Without a build (the dev server) they stay untouched and the worker passes everything through.
const BUILD_ID = '__CT_BUILD_ID__';
const PRECACHE_URLS = /*__CT_PRECACHE__*/[];

const IS_BUILT = !BUILD_ID.startsWith('__');
// Production, dev and preview builds share one origin, so every cache name carries the scope.
const CACHE_PREFIX = `ct-dashcam|${self.registration.scope}|`;
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const PRECACHED = new Set(PRECACHE_URLS.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (!IS_BUILT) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // One missing file must not block installation; it is fetched on demand instead.
      Promise.allSettled([...PRECACHED].map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

async function putInCache(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: CACHE_NAME });
  if (cached) return cached;
  const response = await fetch(request);
  await putInCache(request, response);
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request, { cacheName: CACHE_NAME, ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl, { cacheName: CACHE_NAME });
      if (fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!IS_BUILT || request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  // Map tiles and other cross-origin requests always go to the network.
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Describes the live deployment; a cached copy would be misleading.
  if (url.pathname.endsWith('/deployment.json')) return;

  if (request.mode === 'navigate') {
    // Online visits always get the newest page; offline visits open the cached app shell.
    const isAppShell = url.href.split(/[?#]/)[0] === self.registration.scope;
    event.respondWith(networkFirst(request, isAppShell ? new URL('index.html', self.registration.scope).href : null));
    return;
  }

  const isVersioned = url.pathname.includes('/assets/') || PRECACHED.has(url.href.split(/[?#]/)[0]);
  event.respondWith(isVersioned ? cacheFirst(request) : networkFirst(request, null));
});
