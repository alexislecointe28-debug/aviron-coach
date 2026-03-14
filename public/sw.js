// Version à incrémenter à chaque déploiement pour forcer le remplacement
const SW_VERSION = 'v4';
const CACHE = `aviron-coach-${SW_VERSION}`;

// À l'installation : mettre en cache uniquement les fichiers statiques stables
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png']))
      .then(() => self.skipWaiting()) // Prendre le contrôle immédiatement
  );
});

// À l'activation : supprimer TOUS les anciens caches sans exception
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Suppression ancien cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // Prendre le contrôle des onglets ouverts
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase : toujours réseau direct, jamais de cache
  if (url.hostname.includes('supabase.co')) return;

  // Assets Vite (/assets/*.js, /assets/*.css) : réseau direct, jamais de cache
  // Ces fichiers ont des hashes dans leur nom, pas besoin de les cacher
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Fichiers statiques stables (icônes, manifest, HTML) : cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});
