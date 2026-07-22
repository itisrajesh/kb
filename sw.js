const CACHE_NAME = 'kb-cache-v2';
const DYNAMIC_CACHE = 'kb-dynamic-v2';

// Essential assets to precache.
// We explicitly cache critical libs so the UI can load offline immediately.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com?plugins=typography',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs/themes/prism.min.css',
  'https://cdn.jsdelivr.net/npm/prismjs/prism.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs/components/prism-python.min.js',
  'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('[SW] Caching core URLs');
        // Non-blocking caching for robust installation
        const results = await Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            fetch(url, { cache: 'reload' }).then((response) => {
              if (!response.ok && response.type !== 'opaque') {
                throw new Error(`Bad response for ${url}`);
              }
              return cache.put(url, response);
            })
          )
        );
        return cache;
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2...');
  const currentCaches = [CACHE_NAME, DYNAMIC_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests (e.g. POST/PUT) and browser extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // STRATEGY 1: Network First for index.html (always get latest markup if online)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match(request);
        })
    );
    return;
  }
  
  // STRATEGY 2: Stale-While-Revalidate for CDN Scripts & Assets
  // This ensures the app boots instantly from cache while updating silently in the background
  if (url.origin === 'https://unpkg.com' || url.origin === 'https://cdn.tailwindcss.com' || url.origin === 'https://cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch((err) => {
           console.log('[SW] Background fetch failed for', request.url, err);
        });
        
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
  
  // STRATEGY 3: Cache First, fallback to network for images/fonts
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline Fallbacks
          const dest = request.destination;
          if (dest === 'image') return caches.match('./icons/icon-192.svg');
          return new Response('Offline Content Unavailable', {
            headers: { 'Content-Type': 'text/plain' },
            status: 503,
          });
        });
    })
  );
});