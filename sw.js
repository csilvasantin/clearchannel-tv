// Caché de la bola del mundo (encargo #4566): la segunda visita abre al instante.
// - Portada (/ e /index.html): red primero; si la red tarda más de 1,5 s o falla,
//   la copia guardada. Así un despliegue nuevo se ve en la visita siguiente sin esperar.
// - Scripts, estilos y assets propios, MapLibre y el kit de diseño: copia guardada
//   al momento y se refresca por detrás (van versionados con ?v=).
// - Imagen satélite de la bola (zoom ≤ 5): la copia guardada, con tope de teselas.
// Nunca toca /api/, version.json, el backoffice ni peticiones que no sean GET.
const VERSION = 'cc-globo-20260927-1';
const SHELL = VERSION + '-shell';
const TILES = VERSION + '-tiles';
const MAX_TILES = 600;
const PRECACHE = ['/assets/intro/globo-poster.jpg', '/assets/intro/globo.webm', '/assets/intro/globo.mp4'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cc-globo-') && !k.startsWith(VERSION)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const SKIP = /^\/(api\/|version\.json|backoffice|mcp\/|sw\.js)/;
// Shell updates must not mix new markup with old command handlers or styles.
const SHELL_CODE = /^\/(responsive-shell\.(?:js|css)|intro\.js)$/;
const STATIC = /\.(?:js|mjs|css|png|jpe?g|webp|svg|ico|woff2?|webm|mp4|json)$/;
const ESRI = /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/(\d+)\//;

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (SKIP.test(url.pathname)) return;
    if (req.mode === 'navigate') {
      if (url.pathname === '/' || url.pathname === '/index.html') event.respondWith(networkFirst(req));
      return;
    }
    if (SHELL_CODE.test(url.pathname)) { event.respondWith(freshShellCode(req)); return; }
    if (STATIC.test(url.pathname) && !url.pathname.startsWith('/data/')) event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (url.hostname === 'unpkg.com' && url.pathname.startsWith('/maplibre-gl@')) { event.respondWith(cacheFirst(req, SHELL)); return; }
  if (url.hostname === 'www.carlossilva.info' && url.pathname.startsWith('/admira-design/')) { event.respondWith(staleWhileRevalidate(req)); return; }
  const tile = url.href.match(ESRI);
  if (tile && Number(tile[1]) <= 5) event.respondWith(cacheFirst(req, TILES, MAX_TILES));
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  // La portada cambia de marca según el dominio: se guarda sin query para cada origen.
  const key = new Request(new URL('/', req.url).href);
  const fresh = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; });
  const cached = await cache.match(key);
  if (!cached) return fresh;
  const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 1500));
  return Promise.race([fresh.catch(() => cached), timeout]);
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(req);
  const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (cached) { fresh.catch(() => {}); return cached; }
  return fresh;
}

async function cacheFirst(req, name, max) {
  const cache = await caches.open(name);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    await cache.put(req, res.clone());
    if (max) cache.keys().then(keys => { if (keys.length > max) return Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k))); });
  }
  return res;
}

async function freshShellCode(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(new Request(req, {cache: 'no-cache'}));
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch (error) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw error;
  }
}
