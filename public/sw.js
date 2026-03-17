const SW_VERSION = 'v8';
const CACHE_STATIC = `aviron-static-${SW_VERSION}`;
const CACHE_DYNAMIC = `aviron-dynamic-${SW_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
  '/offline.html',
];

// ── Installation ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activation : vider les anciens caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie hybride ──
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // 1. Supabase → toujours réseau direct (jamais de cache)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('vercel.app') && url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Assets Vite (hash dans le nom) → réseau direct, puis cache
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE_DYNAMIC).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // 3. Navigation (HTML) → network-first, fallback offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .catch(() => caches.match('/offline.html') || caches.match('/index.html'))
    );
    return;
  }

  // 4. Reste → cache-first
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

// ── Push notifications (pour plus tard) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'AvironCoach', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      tag: data.tag || 'aviron-notif',
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.notification.data?.url) {
    e.waitUntil(clients.openWindow(e.notification.data.url));
  }
});

// ── Message depuis l'app pour forcer la mise à jour ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
