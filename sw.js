// ProScanner Service Worker — Cache-First Strategy
const CACHE_NAME = 'proscanner-v1';
const STATIC_ASSETS = [
  '/Stock-Scanner/',
  '/Stock-Scanner/index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
  'https://unpkg.com/lightweight-charts@4.0.0/dist/lightweight-charts.standalone.production.js'
];

// ── Install: cache core assets ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static, network-first for API ────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network for Yahoo Finance & Anthropic API calls
  const isAPICall =
    url.hostname.includes('yahoo') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('allorigins') ||
    url.hostname.includes('corsproxy') ||
    url.hostname.includes('codetabs');

  if (isAPICall) {
    // Network only for live data — don't cache
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — no live data available' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for everything else (app shell, fonts, charts lib)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Fallback for navigation requests when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/Stock-Scanner/index.html');
        }
      });
    })
  );
});
