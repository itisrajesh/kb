const CACHE_NAME = 'kb-cache-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  // External libs used by the app - precache so the app can boot offline
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
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('[SW] Caching precache URLs individually (non-atomic)');
        const results = await Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            // 'reload' bypasses the HTTP cache so we get a fresh copy to store
            fetch(url, { cache: 'reload' }).then((response) => {
              if (!response.ok && response.type !== 'opaque') {
                throw new Error(`Bad response ${response.status} for ${url}`);
              }
              return cache.put(url, response);
            })
          )
        );

        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            console.warn('[SW] Failed to precache:', PRECACHE_URLS[i], result.reason);
          }
        });

        const failed = results.filter((r) => r.status === 'rejected').length;
        console.log(`[SW] Precache complete: ${PRECACHE_URLS.length - failed}/${PRECACHE_URLS.length} succeeded`);
      })
      .then(() => {
        console.log('[SW] Skipping waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[SW] Install error:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // For navigation requests (HTML pages), try network first, then cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => cached || caches.match('./index.html'));
        })
    );
    return;
  }
  
  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // If fetch succeeded, cache & return
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Provide sensible fallbacks when offline depending on resource type
          const dest = request.destination; // 'script', 'style', 'image', etc.
          if (dest === 'script') {
            return new Response('// Offline - script unavailable', {
              headers: { 'Content-Type': 'application/javascript' },
              status: 503,
            });
          }
          if (dest === 'style') {
            return new Response('/* Offline - stylesheet unavailable */', {
              headers: { 'Content-Type': 'text/css' },
              status: 503,
            });
          }
          if (dest === 'image') {
            // Try to return a cached app icon as an image fallback
            return caches.match('./icons/icon-192.svg');
          }
          // Default: plain offline text
          return new Response('Offline', {
            headers: { 'Content-Type': 'text/plain' },
            status: 503,
          });
        });
    })
  );
});