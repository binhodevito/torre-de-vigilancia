// Service Worker — Pilha de Leitura
// Cache offline para arquivos do app e capas de gibis

const CACHE_APP  = 'pilha-app-v1';
const CACHE_CAPAS = 'pilha-capas-v1';

// Arquivos essenciais do app (cache imediato no install)
const ARQUIVOS_APP = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/scraper.js',
  '/js/ui.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@400;500;600;700&display=swap'
];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', evento => {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE_APP).then(cache => cache.addAll(ARQUIVOS_APP).catch(() => {}))
  );
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys().then(chaves => {
      return Promise.all(
        chaves
          .filter(c => c !== CACHE_APP && c !== CACHE_CAPAS)
          .map(c => caches.delete(c))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────
self.addEventListener('fetch', evento => {
  const url = new URL(evento.request.url);

  // Requisições ao Apps Script: sempre rede (dados precisam estar atualizados)
  if (url.hostname.includes('script.google.com')) return;

  // Capas de gibis: cache-first com fallback para rede
  if (url.pathname.includes('/capas') || url.pathname.includes('/capasthumbs')) {
    evento.respondWith(cacheFirstComFallback(evento.request, CACHE_CAPAS));
    return;
  }

  // Proxy allorigins: sempre rede
  if (url.hostname.includes('allorigins')) return;

  // Arquivos do app e fontes: stale-while-revalidate
  evento.respondWith(staleWhileRevalidate(evento.request, CACHE_APP));
});

// Estratégia: cache primeiro, se falhar vai pra rede
async function cacheFirstComFallback(request, nomecache) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const resposta = await fetch(request);
    if (resposta.ok) {
      const cache = await caches.open(nomecache);
      cache.put(request, resposta.clone());
    }
    return resposta;
  } catch (_) {
    return new Response('', { status: 503 });
  }
}

// Estratégia: serve do cache imediatamente e atualiza em background
async function staleWhileRevalidate(request, nomecache) {
  const cache  = await caches.open(nomecache);
  const cached = await cache.match(request);

  const buscarRede = fetch(request).then(resposta => {
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  }).catch(() => null);

  return cached || await buscarRede || new Response('', { status: 503 });
}
