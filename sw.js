const CACHE_NAME = 'kb-cache-v2';
const PRECACHE_URLS = ['./index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      for (const url of PRECACHE_URLS) {
        try {
          const resp = await fetch(url, { cache: 'no-cache' });
          if (resp && resp.ok) {
            await cache.put(url, resp.clone());
            console.log('✓ SW cached:', url);
          } else {
            console.warn('SW: failed to cache', url, resp?.status);
          }
        } catch (err) {
          console.warn('SW: fetch error for', url, err.message);
        }
      }
    } catch (err) {
      console.error('SW install error:', err);
    }
    return self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    return self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});
