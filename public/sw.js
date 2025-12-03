/**
 * Service Worker for Stella Sora Tools
 * Provides aggressive caching for faster repeat visits and offline support
 */

const CACHE_VERSION = 'v2.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Respect deployed base path (e.g., /sstoy/ on GitHub Pages)
const BASE_PATH = new URL('.', self.registration?.scope ?? self.location.href).pathname.replace(/\/$/, '');

// Cache lifetime (in milliseconds)
const DATA_CACHE_TIME = 60 * 60 * 1000; // 1 hour
const IMAGE_CACHE_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/characterdb.html',
  '/discdb.html',
  '/resources.html',
  '/tasks.html',
].map((path) => `${BASE_PATH}${path}`);

// URL patterns
const DATA_PATTERN = /\/(data|lang)\//;
const IMAGE_PATTERN = /\/(assets|images)\//;
const JS_CSS_PATTERN = /\.(js|css)$/;

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((err) => {
        console.error('[SW] Failed to cache static assets:', err);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old version caches
            if (
              cacheName !== STATIC_CACHE &&
              cacheName !== DATA_CACHE &&
              cacheName !== IMAGE_CACHE
            ) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim(); // Take control of all pages immediately
      })
  );
});

/**
 * Fetch event - serve from cache or network
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore Vite dev server requests
  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('src/') ||
    url.pathname.includes('node_modules') ||
    url.pathname.endsWith('.hot-update.json')
  ) {
    return;
  }

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle data files (JSON)
  if (DATA_PATTERN.test(url.pathname)) {
    event.respondWith(handleDataRequest(request));
    return;
  }

  // Handle images
  if (IMAGE_PATTERN.test(url.pathname)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle static assets (JS, CSS, HTML)
  if (JS_CSS_PATTERN.test(url.pathname) || url.pathname.endsWith('.html')) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

/**
 * Handle data file requests (cache-first with expiry)
 */
async function handleDataRequest(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  // Check if cached response is still fresh
  if (cached) {
    const cachedDate = cached.headers.get('sw-cache-date');
    if (cachedDate) {
      const age = Date.now() - parseInt(cachedDate, 10);
      if (age < DATA_CACHE_TIME) {
        console.log('[SW] Serving data from cache:', request.url);
        return cached;
      }
    }
  }

  // Fetch from network
  try {
    console.log('[SW] Fetching data from network:', request.url);
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const clonedResponse = response.clone();
      const headers = new Headers(clonedResponse.headers);
      headers.append('sw-cache-date', Date.now().toString());

      const body = await clonedResponse.blob();
      const cachedResponse = new Response(body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: headers,
      });

      cache.put(request, cachedResponse);
    }

    return response;
  } catch (error) {
    // Network failed, return stale cache if available
    if (cached) {
      console.log('[SW] Network failed, serving stale cache:', request.url);
      return cached;
    }
    throw error;
  }
}

/**
 * Handle image requests (cache-first with long expiry)
 */
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  // Check if cached response is still fresh
  if (cached) {
    const cachedDate = cached.headers.get('sw-cache-date');
    if (cachedDate) {
      const age = Date.now() - parseInt(cachedDate, 10);
      if (age < IMAGE_CACHE_TIME) {
        return cached;
      }
    }
  }

  // Fetch from network
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const clonedResponse = response.clone();
      const headers = new Headers(clonedResponse.headers);
      headers.append('sw-cache-date', Date.now().toString());

      const body = await clonedResponse.blob();
      const cachedResponse = new Response(body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: headers,
      });

      cache.put(request, cachedResponse);
    }

    return response;
  } catch (error) {
    // Network failed, return stale cache if available
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Handle static asset requests (network-first for HTML, cache-first for JS/CSS)
 */
async function handleStaticRequest(request) {
  const url = new URL(request.url);

  // HTML: Network-first (always get latest)
  if (url.pathname.endsWith('.html')) {
    try {
      const response = await fetch(request);
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }
      throw error;
    }
  }

  // JS/CSS: Cache-first (faster loading)
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Update cache in background
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {
        // Ignore network errors
      });

    return cached;
  }

  // Not in cache, fetch from network
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    throw error;
  }
}
