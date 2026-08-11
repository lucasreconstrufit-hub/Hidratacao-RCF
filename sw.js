// RCF Hidratação — Service Worker v2
// Incrementar CACHE_NAME força a limpeza do cache antigo em todos os dispositivos
const CACHE_NAME = 'rcf-v6';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// INSTALL — cacheia assets novos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  // Força ativação imediata sem esperar abas fecharem
  self.skipWaiting();
});

// ACTIVATE — apaga TODOS os caches antigos (incluindo rcf-hidratacao-v1, rcf-v4, etc.)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deletando cache antigo:', k);
          return caches.delete(k);
        })
      )
    ).then(() => {
      // Toma controle de todas as abas abertas imediatamente
      return self.clients.claim();
    })
  );
});

// FETCH — network-first para HTML (sempre pega versão nova), cache-first para assets
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Ignora extensões chrome e outros protocolos
  if (!url.protocol.startsWith('http')) return;

  // Fontes Google — cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // Navegação (HTML) — network-first, fallback para cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // JS e CSS — network-first para garantir atualizações
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais assets — cache-first
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(r => {
        if (r && r.status === 200) {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return r;
      })
    )
  );
});
