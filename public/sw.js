const STATIC_CACHE = 'mingyu-v2-static-v1';
const RUNTIME_CACHE = 'mingyu-v2-runtime-v1';
const NAVIGATION_CACHE = 'mingyu-v2-nav-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith('mingyu-v2-static-') && key !== STATIC_CACHE) ||
              (key.startsWith('mingyu-v2-nav-') && key !== NAVIGATION_CACHE),
          )
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/mcp' ||
    url.pathname.startsWith('/mcp/') ||
    url.pathname.startsWith('/downloads/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    if (url.pathname.startsWith('/api-docs')) return;
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest' ||
    request.destination === 'worker' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/character-data/') ||
    url.pathname.startsWith('/asteroid-data/')
  ) {
    event.respondWith(handleAsset(request));
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      const cache = await caches.open(NAVIGATION_CACHE).catch(() => null);
      if (cache) await cache.put('/index.html', response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    const navCache = await caches.open(NAVIGATION_CACHE).catch(() => null);
    const cached = navCache ? await navCache.match('/index.html') : null;
    if (cached) return cached;
    const shell = await caches.open(STATIC_CACHE).catch(() => null);
    const fallback = shell ? (await shell.match('/index.html')) || (await shell.match('/')) : null;
    if (fallback) return fallback;
    throw error;
  }
}

async function handleAsset(request) {
  const pathname = new URL(request.url).pathname;
  const isShell = APP_SHELL.includes(pathname);
  if (isShell) {
    try {
      const response = await fetch(request);
      if (response.ok && !response.headers.get('content-type')?.includes('text/html')) {
        const cache = await caches.open(STATIC_CACHE).catch(() => null);
        if (cache) await cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    } catch {
      const cache = await caches.open(STATIC_CACHE).catch(() => null);
      const cached = cache ? await cache.match(request) : null;
      if (cached) return cached;
      throw new Error('Offline asset unavailable');
    }
  }

  const runtime = await caches.open(RUNTIME_CACHE).catch(() => null);
  if (runtime) {
    const cached = await runtime.match(request);
    if (cached) return cached;
  }
  const response = await fetch(request);
  if (
    response.ok &&
    !response.headers.get('content-type')?.includes('text/html') &&
    runtime
  ) {
    await runtime.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}
