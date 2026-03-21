const CACHE_NAME = 'tcg-v2';
const OFFLINE_URLS = [
  '/japan-tcg-price-guide/',
  '/japan-tcg-price-guide/index.html',
  '/japan-tcg-price-guide/search.html',
  '/japan-tcg-price-guide/base.css',
  '/japan-tcg-price-guide/data/brain-cache.json',
  '/japan-tcg-price-guide/data/onepiece-cache.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
