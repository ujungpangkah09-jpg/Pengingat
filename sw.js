const CACHE = 'ps-cache-v1';
const FILES = ['/', '/index.html', '/styles.css', '/app.js', '/schedule.json', '/assets/alarm-soft.wav', '/manifest.json'];
self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', evt => { evt.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', evt => {
  evt.respondWith(caches.match(evt.request).then(res => res || fetch(evt.request)));
});