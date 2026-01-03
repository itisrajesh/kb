const CACHE_NAME = 'kb-cache-v1';
// Only precache explicit files. Avoid '/' as it can 404 depending on server.
const PRECACHE_URLS = ['/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of PRECACHE_URLS) {
      try {
        // Fetch with no-cache so we get a fresh copy during install
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp || !resp.ok) {
          console.warn('SW: precache failed for', url, resp && resp.status);
          continue;
        }
        await cache.put(url, resp.clone());
      } catch (err) {
        console.warn('SW: precache fetch error for', url, err);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});
