const CACHE = 'onderweg-v2';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './share-import.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Web Share Target: als iemand het geëxporteerde bestand rechtstreeks naar deze
// app deelt (Android), onderscheppen we de POST en zetten 'm klaar voor share-import.html.
self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);
  if (event.request.method === 'POST' && reqUrl.pathname.endsWith('/share-import.html')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');
        const text = await file.text();
        const cache = await caches.open('share-inbox');
        await cache.put('/share-payload', new Response(text));
      } catch (e) {
        // share-import.html toont zelf een foutmelding als er niets klaarstaat
      }
      return Response.redirect('./share-import.html', 303);
    })());
    return;
  }
});

// App shell: cache-first. Kaarttegels (tile.openstreetmap.org): stale-while-revalidate
// zodat eerder bekeken tegels ook offline zichtbaar blijven.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isTile = url.includes('tile.openstreetmap.org');

  if (isTile) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((res) => { cache.put(event.request, res.clone()); return res; })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});
