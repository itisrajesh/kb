const CACHE_NAME = 'kb-cache-v1';
const PRECACHE_URLS = ['index.html', 'manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('SW install error:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cached) => cached || fetch(event.request))
      .then((response) => {
        if (!response || response.status === 404) {
          return caches.match('index.html');
        }
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match('index.html'))
  );
});