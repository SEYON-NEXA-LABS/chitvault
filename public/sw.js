const CACHE_NAME = 'chitvault-v4'; // Bumped for ChunkLoadError recovery
const OFFLINE_URL = '/offline.html';

const ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── 1. Bypass Caching for special cases ──
  // Do NOT cache Next.js internal data/RSC requests or Chrome extensions
  if (
    request.headers.get('RSC') || 
    request.headers.get('Next-Router-State-Tree') ||
    url.pathname.includes('_next/data') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // ── 2. Navigation (HTML): Network-First with Offline Fallback ──
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // ── 3. Static Assets: Stale-While-Revalidate ──
  // Only cache GET requests for static assets
  if (request.method === 'GET' && (
      url.pathname.startsWith('/_next/static') || 
      url.pathname.startsWith('/icons') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.svg')
  )) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cacheCopy));
          }
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});
