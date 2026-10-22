/** Site-wide cache policy: mutable files are network-first, hashed bundles immutable. */
const CACHE_VERSION = 'sstoy-network-first-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const CURRENT_CACHES = new Set([STATIC_CACHE, DATA_CACHE, ASSET_CACHE]);
const SCOPE = new URL(self.registration.scope);
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(SCOPE.hostname);

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      // Only remove this app's caches, never another application's CacheStorage.
      if (/^sstoy-/.test(name)) {
        if (LOCAL || !CURRENT_CACHES.has(name)) await caches.delete(name);
      } else if (/^(static|data|images)-v\d/.test(name)) {
        // Old names were generic: leave any other project's entries untouched.
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const url = new URL(request.url);
          if (url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname)) await cache.delete(request);
        }
        if (!(await cache.keys()).length) await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // A worker installed by an old dev visit must not cache Vite or local data.
  if (LOCAL || request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;
  const hashedBundle = /\/assets\/(?:js|css)\/[^/]+-[\w-]{8,}\.(?:js|css)$/.test(url.pathname);
  const cacheName = /\.json$/.test(url.pathname) ? DATA_CACHE
    : /\.(?:html|js|css)$/.test(url.pathname) || request.mode === 'navigate' ? STATIC_CACHE : ASSET_CACHE;
  event.respondWith(serve(request, cacheName, hashedBundle, event));
});

async function serve(request, cacheName, immutable, event) {
  // Storage failures must never turn a successful network load into an error.
  let cache;
  try { cache = await caches.open(cacheName); } catch (error) { console.warn('[SW] Cache unavailable:', error); }
  const cached = async () => {
    try { return await cache?.match(request); } catch { return undefined; }
  };
  if (immutable) {
    const response = await cached();
    if (response) return response;
  }
  try {
    const response = await fetch(request, { cache: immutable ? 'default' : 'no-cache' });
    if (response.ok && response.status === 200 && cache) {
      // Preserve the original response, including its correct encoding metadata.
      event.waitUntil(cache.put(request, response.clone()).catch(error => console.warn('[SW] Cache write failed:', error)));
    }
    if (response.status >= 500) return (await cached()) || response;
    return response;
  } catch (error) {
    const response = await cached();
    if (response) return response;
    throw error;
  }
}
