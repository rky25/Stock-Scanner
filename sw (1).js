// ProScanner Service Worker v2 — rky25.github.io/Stock-Scanner
const CACHE_NAME = 'proscanner-v2';
const BASE = '/Stock-Scanner';

const STATIC_ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] skip:', url)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLiveData =
    url.hostname.includes('yahoo') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('allorigins') ||
    url.hostname.includes('corsproxy') ||
    url.hostname.includes('codetabs') ||
    url.hostname.includes('thingproxy');

  if (isLiveData) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});
