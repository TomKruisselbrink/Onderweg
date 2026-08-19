const CACHE = 'onderweg-v7';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
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

// App shell: cache-first. Kaarttegels (tile.openstreetmap.org): stale-while-revalidate
// zodat eerder bekeken tegels ook offline zichtbaar blijven.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Firebase/Firestore/Google-verzoeken NOOIT onderscheppen — dit zijn lang-lopende
  // realtime-verbindingen en logins; de service worker mag daar niet tussen zitten.
  // Firestore heeft zijn eigen (robuustere) offline-cache ingebouwd.
  if (
    url.includes('googleapis.com') ||
    url.includes('google.com') ||
    url.includes('gstatic.com/firebasejs') ||
    url.includes('firebaseapp.com')
  ) {
    return;
  }

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
