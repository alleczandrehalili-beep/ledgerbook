/* Ledgerbook service worker: lets the app open with no internet.
   Pages are fetched from the network when online (so updates arrive) and fall back to the cached copy offline.
   Requests to Supabase are never touched; the app handles those itself. */
const CACHE = 'ledgerbook-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'logo-ahba.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'vendor/supabase.js'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(req, { signal: ctl.signal }); clearTimeout(timer);
    if (res.ok) { cache.put('index.html', res.clone()); }
    return res;
  } catch {
    return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE), hit = await cache.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req));
    if (url.pathname.endsWith('/sw.js')) return;
    return e.respondWith(staleWhileRevalidate(req));
  }
  if (FONT_HOSTS.includes(url.hostname)) e.respondWith(staleWhileRevalidate(req));
});
