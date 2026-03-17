const CACHE = 'tcg-v1';
const ASSETS = [
  '/japan-tcg-price-guide/',
  '/japan-tcg-price-guide/pokemon/',
  '/japan-tcg-price-guide/onepiece/',
  '/japan-tcg-price-guide/favicon.ico'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok && e.request.url.includes('japan-tcg-price-guide')) {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }))
  );
});
