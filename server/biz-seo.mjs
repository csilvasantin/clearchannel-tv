// SEO y compartir de admira.biz (FLT-102678 · encargo #7161, 24-oct-2026).
// El mismo proyecto Pages sirve www.admira.biz y www.clearchannel.tv, y la release de admira.biz parte de la de
// clearchannel.tv: admira.biz servía el robots.txt y el sitemap.xml de clearchannel.tv (con su store-3d.html, que da
// 308), y un enlace a un Xpacio compartido por WhatsApp, LinkedIn o Slack salía con la vista genérica. Este módulo,
// sólo con Host (www.)admira.biz:
//  · /robots.txt propio y /sitemap.xml como índice de dos sitemaps: las páginas públicas y los Xpacios, éste generado
//    del catálogo ligero (GET /locations?slim=1, unos 143 KB comprimidos) y guardado en la Cache API del borde.
//  · Metadatos por Xpacio en el servidor para /detail?loc=<id> y la portada con ?loc=<id>: título, descripción con
//    cifras orientativas, canónica, Open Graph, Twitter y JSON-LD Place. Los datos salen de GET /locations/:id
//    (~0,7 KB), con caché corta y un tope de tiempo; si fallan, la página sale con los metadatos genéricos de siempre.
// La URL canónica de un Xpacio es /detail?loc=<id>: abre la ficha de cualquier Xpacio sólo con su id (la portada sólo
// la abre con ?circuit=…&loc=…), es una página ligera de texto sin WebGL ni los ~10 MB del catálogo y tiene un único
// formato por Xpacio. Su «Volver al mapa» lleva al punto en el mapa.
import { posterCircuitoEnCache } from './previo-circuito.mjs';

export const BIZ_ORIGEN = 'https://www.admira.biz';
export const BIZ_SEO_HOST = /^(?:www\.)?admira\.biz$/i;
export const CATALOGO = 'https://brain.digitalavatar.ai/locations';
export const ID_XPACIO = /^[a-z0-9][a-z0-9._-]{0,119}$/;
export const OG_PORTADA = Object.freeze({ url: BIZ_ORIGEN + '/assets/og-admira-biz.jpg', w: 1200, h: 630 });
// Páginas públicas de admira.biz que responden 200 sin redirigir y no llevan noindex (comprobado el 24-oct-2026).
// Fuera: store-3d.html (308), /parrilla/ (noindex), el backoffice y las herramientas (walk, plano, bugito, arquitecto).
export const PAGINAS_PUBLICAS = Object.freeze(['/', '/marketplace', '/about', '/help/', '/tutorial/', '/target/', '/wututu/', '/mcp/']);
export const SITEMAP_PAGINAS = '/sitemap-paginas.xml';
export const SITEMAP_XPACIOS = '/sitemap-xpacios.xml';
export const MAX_URLS = 50000;                // tope de un sitemap (sitemaps.org)
export const XPACIOS_FRESCO_S = 3600;         // el sitemap de Xpacios se renueva por detrás pasada 1 h
export const XPACIOS_GUARDADO_S = 86400;      // y la copia del borde dura 24 h
export const XPACIO_FRESCO_S = 120;           // la ficha de un Xpacio, 2 min (el catálogo dice max-age=60)
export const XPACIO_NO_EXISTE_S = 60;         // un 404 del catálogo se recuerda 1 min
export const XPACIO_GUARDADO_S = 86400;       // si el catálogo falla, vale la última copia buena de las últimas 24 h
export const XPACIO_TIMEOUT_MS = 1500;
export const SLIM_TIMEOUT_MS = 20000;
const GENERADO = 'x-seo-generado', ESTADO = 'x-seo-estado';
const XML = 'application/xml; charset=utf-8';

export const urlXpacio = id => BIZ_ORIGEN + '/detail?loc=' + encodeURIComponent(id);

// ── Escapes ──────────────────────────────────────────────────────────────────────────────────────────────────────
const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ENTIDADES[c]);
export const escXml = escHtml;
// Dentro de <script type="application/ld+json">: nada que cierre el script ni rompa el JS.
export const jsonSeguro = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
// Texto de catálogo: sin caracteres de control, espacios colapsados y con tope de longitud.
export function limpio(valor, max = 160) {
  if (valor == null || typeof valor === 'object') return '';
  const t = String(valor).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}
const https = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
const PREVIO_IMAGEN = /^https:\/\/(?:www\.)?admira\.tv\/api\/previo\/[A-Za-z0-9._-]+\.jpg$/;
const entero = n => Number.isInteger(Number(n)) && Number(n) > 0 && Number(n) < 10000 ? Number(n) : 0;

// ── robots.txt y sitemaps ────────────────────────────────────────────────────────────────────────────────────────
// Los Disallow del backoffice son los de clearchannel.tv; el tercero cubre su URL limpia (/backoffice, que Pages sirve).
export function robotsTxt() {
  return ['User-agent: *', 'Allow: /', 'Disallow: /backoffice/', 'Disallow: /backoffice.html', 'Disallow: /backoffice', '',
    'Sitemap: ' + BIZ_ORIGEN + '/sitemap.xml', ''].join('\n');
}
export function sitemapIndice() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [SITEMAP_PAGINAS, SITEMAP_XPACIOS].map(p => '  <sitemap><loc>' + escXml(BIZ_ORIGEN + p) + '</loc></sitemap>\n').join('')
    + '</sitemapindex>\n';
}
function urlset(urls) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => '  <url><loc>' + escXml(u) + '</loc></url>\n').join('') + '</urlset>\n';
}
export const sitemapPaginas = () => urlset(PAGINAS_PUBLICAS.map(p => BIZ_ORIGEN + p));
// Xpacios del catálogo que van al sitemap: id válido, al menos un dispositivo, no un alta propia de la flota (selfReg:
// equipos de prueba que se dan de alta solos) y con un nombre que lo distinga. El catálogo del 24-oct-2026 tiene 3.541
// «Correos Oficina» (dirección «Correos · post_box», sin ciudad), 1.095 «BBVA España», 975 «Correos Oficina de», 738
// «Mango»…: páginas con el mismo título y la misma descripción, que Google trata como duplicadas. Un nombre que se
// repite más de MAX_NOMBRE_REPETIDO veces no entra; esas fichas siguen abiertas e indexables, sólo no se empujan.
// (El slim no trae dirección ni ciudad: con ellas se podría afinar por título.) Sin repetidos y con el tope de 50.000.
export const MAX_NOMBRE_REPETIDO = 20;
const nombreClave = l => String(l && l.name || '').trim().toLowerCase();
export function idsParaSitemap(payload) {
  const lista = payload && Array.isArray(payload.locations) ? payload.locations : Array.isArray(payload) ? payload : [];
  const candidatos = [], vistos = new Set(), veces = new Map();
  for (const l of lista) {
    if (!l || typeof l.id !== 'string' || !ID_XPACIO.test(l.id) || vistos.has(l.id) || l.selfReg) continue;
    const n = l.n != null ? Number(l.n) : Array.isArray(l.surfaces) ? l.surfaces.length : 0;
    if (!(n > 0) || !nombreClave(l)) continue;
    vistos.add(l.id); candidatos.push(l);
    veces.set(nombreClave(l), (veces.get(nombreClave(l)) || 0) + 1);
  }
  return candidatos.filter(l => veces.get(nombreClave(l)) <= MAX_NOMBRE_REPETIDO).slice(0, MAX_URLS).map(l => l.id);
}
export const sitemapXpacios = ids => urlset(ids.map(urlXpacio));

export function esFicheroSeo(url) {
  return BIZ_SEO_HOST.test(url.hostname) && ['/robots.txt', '/sitemap.xml', SITEMAP_PAGINAS, SITEMAP_XPACIOS].includes(url.pathname);
}

function respuesta(request, texto, tipo, status = 200, extra = {}) {
  return new Response(request.method === 'HEAD' ? null : texto, { status, headers: Object.assign({ 'Content-Type': tipo,
    'X-Content-Type-Options': 'nosniff' }, extra) });
}

function dependencias(deps) {
  return {
    // Envuelto: en workerd, fetch llamado como método de otro objeto (d.fetchImpl(...)) da «Illegal invocation».
    fetchImpl: deps.fetchImpl || ((u, init) => fetch(u, init)),
    cache: 'cache' in deps ? deps.cache : (typeof caches !== 'undefined' && caches.default) || null,
    now: deps.now || Date.now,
    waitUntil: deps.waitUntil || null,
  };
}
function conTope(ms) {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(ms) } : {};
}

// El sitemap de Xpacios: en la Cache API 24 h; pasada 1 h sale la copia al instante y se renueva detrás. Sin copia y sin
// catálogo, 503 con Retry-After (nunca un sitemap vacío, que diría que no hay Xpacios).
const CLAVE_SITEMAP = () => new Request(BIZ_ORIGEN + SITEMAP_XPACIOS, { method: 'GET' });
let sitemapEnVuelo = null;
function generarSitemap(d) {
  if (sitemapEnVuelo) return sitemapEnVuelo;
  sitemapEnVuelo = (async () => {
    let ids = [];
    try {
      const r = await d.fetchImpl(CATALOGO + '?slim=1', Object.assign({ headers: { accept: 'application/json' } }, conTope(SLIM_TIMEOUT_MS)));
      if (r && r.ok) ids = idsParaSitemap(await r.json());
    } catch (_) { ids = []; }
    if (!ids.length) return null;
    const texto = sitemapXpacios(ids);
    if (d.cache) {
      const guardar = d.cache.put(CLAVE_SITEMAP(), new Response(texto, { headers: { 'Content-Type': XML,
        'Cache-Control': 'public, s-maxage=' + XPACIOS_GUARDADO_S, [GENERADO]: String(d.now()) } })).catch(() => {});
      if (d.waitUntil) d.waitUntil(guardar); else await guardar;
    }
    return texto;
  })().finally(() => { sitemapEnVuelo = null; });
  return sitemapEnVuelo;
}
async function sitemapXpaciosTexto(d) {
  let guardada = null;
  if (d.cache) { try { guardada = await d.cache.match(CLAVE_SITEMAP()); } catch (_) { guardada = null; } }
  if (guardada) {
    const generado = Number(guardada.headers.get(GENERADO)) || 0;
    const texto = await guardada.text();
    if (d.now() - generado <= XPACIOS_FRESCO_S * 1000) return { texto, estado: 'HIT' };
    const renovar = generarSitemap(d).catch(() => null);
    if (d.waitUntil) d.waitUntil(renovar);
    return { texto, estado: 'STALE' };
  }
  const texto = await generarSitemap(d);
  return texto ? { texto, estado: 'MISS' } : null;
}

// deps (para los tests): fetchImpl, cache (match/put), now y waitUntil.
export async function handleBizSeo(request, deps = {}) {
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  const hora = { 'Cache-Control': 'public, max-age=3600' };
  if (url.pathname === '/robots.txt') return respuesta(request, robotsTxt(), 'text/plain; charset=utf-8', 200, hora);
  if (url.pathname === '/sitemap.xml') return respuesta(request, sitemapIndice(), XML, 200, hora);
  if (url.pathname === SITEMAP_PAGINAS) return respuesta(request, sitemapPaginas(), XML, 200, hora);
  const hecho = await sitemapXpaciosTexto(dependencias(deps));
  if (!hecho) return respuesta(request, '<?xml version="1.0" encoding="UTF-8"?>\n<!-- catálogo no disponible -->\n', XML, 503,
    { 'Cache-Control': 'no-store', 'Retry-After': '300' });
  return respuesta(request, hecho.texto, XML, 200, Object.assign({ 'X-Sitemap-Cache': hecho.estado }, hora));
}

// ── Metadatos por Xpacio ─────────────────────────────────────────────────────────────────────────────────────────
// /detail?loc=<id> (la canónica) y la portada con ?loc=<id> (con o sin circuit). Devuelve {id, pagina} o null.
export function xpacioDeUrl(url) {
  if (!BIZ_SEO_HOST.test(url.hostname)) return null;
  const p = url.pathname;
  const pagina = p === '/detail' || p === '/detail.html' ? 'detalle' : p === '/' || p === '/index.html' ? 'portada' : '';
  const id = pagina ? url.searchParams.get('loc') || '' : '';
  return id && ID_XPACIO.test(id) ? { id, pagina } : null;
}

// Hashtag del Stock de un Xpacio: la misma tabla que etiquetaStock de previos-zoom.js (tests/biz-seo.test.mjs lo compara).
const TAG_CIRCUITO = { altadis_espana: 'altadis', altadis_bcn: 'altadis', jti_xtanco: 'jti', alsea_starbucks: 'starbucks', alsea_mexico: 'starbucks' };
const TAG_PREFIJO = { alcampo: 'alcampo', altadis: 'altadis', jti: 'jti', alsea: 'starbucks', correos: 'correos', mango: 'mango', bbva: 'bbva',
  decathlon: 'decathlon', desigual: 'desigual', caixabank: 'caixabank', banorte: 'banorte', elcorteingles: 'elcorteingles', multiopticas: 'multiopticas',
  liverpool: 'liverpool', palacio: 'palacio', kiosko: 'kiosko', metro: 'metro', cafebreria: 'cafebreria', admiraxperience: 'admiraxperience' };
const TAG_MARCA = { alcampo: 'alcampo', starbucks: 'starbucks', altadis: 'altadis', xtanco: 'jti' };
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function etiquetaStock(loc) {
  if (!loc) return '';
  const circuito = String(loc.circuit || '').toLowerCase();
  if (TAG_CIRCUITO[circuito]) return TAG_CIRCUITO[circuito];
  const prefijo = String(loc.id || '').toLowerCase().split('-')[0];
  if (TAG_PREFIJO[prefijo]) return TAG_PREFIJO[prefijo];
  if (TAG_PREFIJO[circuito]) return TAG_PREFIJO[circuito];
  return TAG_MARCA[norm(loc.external && loc.external.brand)] || '';
}

// Lo que se guarda de un Xpacio: sólo los campos que usan los metadatos.
export function resumenXpacio(loc) {
  if (!loc || typeof loc !== 'object' || typeof loc.id !== 'string') return null;
  const surfaces = Array.isArray(loc.surfaces) ? loc.surfaces.filter(s => s && typeof s === 'object').map(s => ({ impr: s.impr, cpm: s.cpm })) : [];
  const p = loc.previo && typeof loc.previo === 'object' ? loc.previo : null;
  return { id: loc.id, name: loc.name, kind: loc.kind, addr: loc.addr, city: loc.city, circuit: loc.circuit, coords: loc.coords,
    external: loc.external && typeof loc.external === 'object' ? { brand: loc.external.brand } : null,
    surfaces, previo: p ? { imagen: p.imagen, w: p.w, h: p.h } : null };
}

// Cifras como en la ficha (detail.html): impresiones/día = suma de las de sus pantallas; CPM = media de los que se leen.
const cpmDe = s => { const raw = String(s && s.cpm != null ? s.cpm : '').replace(/[^\d.,]/g, '').replace(',', '.'); const v = raw ? Number(raw) : NaN; return Number.isFinite(v) && v >= 0 ? v : null; };
const imprDe = s => { const v = s && s.impr !== null && s.impr !== undefined && s.impr !== '' ? Number(s.impr) : NaN; return Number.isFinite(v) && v >= 0 ? v : null; };
function numero(n, en) { try { return new Intl.NumberFormat(en ? 'en-GB' : 'es-ES').format(Math.round(n)); } catch (_) { return String(Math.round(n)); } }
const dinero = (n, en) => '€' + (en ? n.toFixed(2) : n.toFixed(2).replace('.', ','));
export function cifrasXpacio(loc) {
  const s = loc && Array.isArray(loc.surfaces) ? loc.surfaces : [];
  const imprs = s.map(imprDe).filter(v => v !== null), cpms = s.map(cpmDe).filter(v => v !== null);
  return { dispositivos: s.length, impr: imprs.length ? imprs.reduce((a, b) => a + b, 0) : null,
    cpm: cpms.length ? cpms.reduce((a, b) => a + b, 0) / cpms.length : null };
}

function coordenadas(c) {
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]), lat = Number(c[1]);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng) ? { lat, lng } : null;
}
// og:url de la portada con ficha (?circuit=…&loc=…): la propia URL compartida, sin parámetros ajenos, para que la
// tarjeta lleve al mapa con la ficha abierta. Sin circuit, la portada no abre la ficha: entonces, la canónica.
function urlPortada(url, id) {
  const q = url.searchParams, out = new URLSearchParams();
  const circuit = q.get('circuit') || '';
  if (!/^[a-z0-9_-]{1,60}$/.test(circuit)) return '';
  out.set('circuit', circuit); out.set('loc', id);
  const marca = q.get('marca') || '';
  if (/^[a-z0-9_-]{1,40}$/.test(marca)) out.set('marca', marca);
  if (q.get('lang') === 'en') out.set('lang', 'en');
  return BIZ_ORIGEN + '/?' + out.toString();
}

// {titulo, descripcion, canonica, ogUrl, imagen:{url,w,h,alt,fuente}, locale, localeAlt, jsonLd, id}
// Dirección útil: sin las etiquetas de OpenStreetMap que el catálogo deja como dirección («Correos · post_box») ni los
// trozos que ya dice el nombre o la marca.
export function direccionUtil(addr, nombre, marca) {
  const n = String(nombre || '').toLowerCase(), m = String(marca || '').toLowerCase();
  const partes = limpio(addr, 300).split(' · ').map(t => t.trim()).filter(t => t && !/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(t)
    && !n.includes(t.toLowerCase()) && t.toLowerCase() !== m);
  return limpio(partes.join(' · '), 100);
}

export function metadatosXpacio(loc, { pagina = 'detalle', url = null, poster = '', lang = 'es' } = {}) {
  const en = lang === 'en';
  const nombre = limpio(loc.name, 90) || loc.id;
  const ciudad = limpio(loc.city, 60), direccion = direccionUtil(loc.addr, nombre, loc.external && loc.external.brand);
  const lugar = ciudad || direccion;
  const titulo = nombre + (lugar && !nombre.toLowerCase().includes(lugar.toLowerCase()) ? ' · ' + lugar : '') + ' | admira.biz';
  const tipo = limpio(loc.kind, 90) || (en ? 'Commercial space' : 'Espacio comercial');
  const donde = direccion || ciudad;
  const c = cifrasXpacio(loc);
  const partes = [];
  if (!c.dispositivos) partes.push(en ? 'no screens published yet' : 'aún sin pantallas publicadas');
  else {
    partes.push(c.dispositivos + (en ? (c.dispositivos === 1 ? ' device' : ' devices') : (c.dispositivos === 1 ? ' dispositivo' : ' dispositivos')));
    if (c.impr !== null) partes.push(en ? 'about ' + numero(c.impr, true) + ' estimated impressions a day' : 'unas ' + numero(c.impr, false) + ' impresiones al día estimadas');
    if (c.cpm !== null) partes.push(en ? 'indicative CPM ' + dinero(c.cpm, true) : 'CPM orientativo de ' + dinero(c.cpm, false));
  }
  const lista = partes.length > 1 ? partes.slice(0, -1).join(', ') + (en ? ' and ' : ' y ') + partes[partes.length - 1] : partes[0];
  const cierre = c.dispositivos && (c.impr !== null || c.cpm !== null)
    ? (en ? ' Indicative catalogue figures, not measured audience.' : ' Cifras orientativas del catálogo, no audiencia medida.') : '';
  const descripcion = tipo + (donde ? (en ? ' at ' : ' en ') + donde : '') + '. ' + lista.charAt(0).toUpperCase() + lista.slice(1) + '.' + cierre;
  const canonica = urlXpacio(loc.id);
  const ogUrl = pagina === 'portada' && url ? urlPortada(url, loc.id) || canonica : canonica;
  // og:image: (a) el Previo DooH de la fachada; (b) el póster del circuito si ya está en la caché del borde; (c) la portada.
  let imagen;
  const previo = loc.previo && PREVIO_IMAGEN.test(loc.previo.imagen || '') ? loc.previo : null;
  if (previo) imagen = { url: previo.imagen, w: entero(previo.w), h: entero(previo.h), fuente: 'previo',
    alt: (en ? 'Shopfront of ' : 'Fachada de ') + nombre + (en ? ' (DooH preview)' : ' (Previo DooH)') };
  else if (https(poster)) imagen = { url: poster, w: 0, h: 0, fuente: 'circuito',
    alt: (en ? 'What the screens of ' : 'Lo que emite el circuito de ') + nombre + (en ? ' play' : '') };
  else imagen = { url: OG_PORTADA.url, w: OG_PORTADA.w, h: OG_PORTADA.h, fuente: 'portada', alt: en ? 'admira.biz commercial spaces map' : 'Mapa de espacios comerciales de admira.biz' };
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Place', name: nombre, url: canonica };
  if (direccion) jsonLd.address = direccion;
  const geo = coordenadas(loc.coords);
  if (geo) jsonLd.geo = { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lng };
  if (imagen.fuente === 'previo') jsonLd.image = imagen.url;
  return { id: loc.id, titulo, descripcion, canonica, ogUrl, imagen, locale: en ? 'en_GB' : 'es_ES', localeAlt: en ? 'es_ES' : 'en_GB', jsonLd };
}

// El bloque que se añade al <head> (todo escapado). <meta name="admira:xpacio"> le dice a detail.html que el título
// ya es el del Xpacio.
export function cabeceraXpacio(m) {
  const meta = (k, v, attr = 'property') => '<meta ' + attr + '="' + k + '" content="' + escHtml(v) + '">';
  const i = m.imagen;
  return [
    meta('description', m.descripcion, 'name'),
    '<link rel="canonical" href="' + escHtml(m.canonica) + '">',
    meta('og:type', 'website'), meta('og:site_name', 'admira.biz'), meta('og:title', m.titulo), meta('og:description', m.descripcion),
    meta('og:url', m.ogUrl), meta('og:image', i.url),
    i.w && i.h ? meta('og:image:width', String(i.w)) + meta('og:image:height', String(i.h)) : '',
    meta('og:image:alt', i.alt), meta('og:locale', m.locale), meta('og:locale:alternate', m.localeAlt),
    meta('twitter:card', 'summary_large_image', 'name'), meta('twitter:title', m.titulo, 'name'), meta('twitter:description', m.descripcion, 'name'),
    meta('twitter:image', i.url, 'name'), meta('admira:xpacio', m.id, 'name'),
    '<script type="application/ld+json">' + jsonSeguro(m.jsonLd) + '</script>',
  ].filter(Boolean).join('\n') + '\n';
}

// Sustituye los metadatos genéricos de la página por los del Xpacio (segunda pasada, después de la de marca).
export function rewriterXpacio(m, Rewriter = globalThis.HTMLRewriter) {
  const quitar = { element(el) { el.remove(); } };
  return new Rewriter()
    .on('title', { element(el) { el.setInnerContent(m.titulo); } })
    .on('meta[name="description"]', quitar)
    .on('meta[property^="og:"]', quitar)
    .on('meta[name^="twitter:"]', quitar)
    .on('meta[name="admira:xpacio"]', quitar)
    .on('link[rel="canonical"]', quitar)
    .on('head', { element(el) { el.append(cabeceraXpacio(m), { html: true }); } });
}
// Un /detail?loc=<id> que el catálogo no conoce (404) es la página «no disponible»: no se indexa.
export function rewriterNoIndex(Rewriter = globalThis.HTMLRewriter) {
  return new Rewriter().on('head', { element(el) { el.append('<meta name="robots" content="noindex">\n', { html: true }); } });
}

// GET /locations/:id con caché corta en la Cache API y tope de tiempo.
// → {estado:'ok', loc} | {estado:'no-existe'} | {estado:'error'}. Nunca lanza.
const CLAVE_XPACIO = id => new Request(BIZ_ORIGEN + '/__seo/xpacio/' + encodeURIComponent(id), { method: 'GET' });
export async function cargarXpacio(id, deps = {}) {
  const d = dependencias(deps);
  const timeoutMs = deps.timeoutMs || XPACIO_TIMEOUT_MS;
  if (!ID_XPACIO.test(id || '')) return { estado: 'error' };
  let viejo = null;
  if (d.cache) {
    try {
      const g = await d.cache.match(CLAVE_XPACIO(id));
      if (g) {
        const generado = Number(g.headers.get(GENERADO)) || 0, estado = g.headers.get(ESTADO), cuerpo = await g.json();
        const edad = d.now() - generado;
        if (estado === 'no-existe' && edad <= XPACIO_NO_EXISTE_S * 1000) return { estado: 'no-existe' };
        if (estado === 'ok' && cuerpo && cuerpo.id === id) {
          if (edad <= XPACIO_FRESCO_S * 1000) return { estado: 'ok', loc: cuerpo };
          if (edad <= XPACIO_GUARDADO_S * 1000) viejo = cuerpo;
        }
      }
    } catch (_) {}
  }
  const guardar = (estado, cuerpo) => {
    if (!d.cache) return;
    const p = d.cache.put(CLAVE_XPACIO(id), new Response(JSON.stringify(cuerpo), { headers: { 'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=' + (estado === 'ok' ? XPACIO_GUARDADO_S : XPACIO_NO_EXISTE_S), [GENERADO]: String(d.now()), [ESTADO]: estado } })).catch(() => {});
    if (d.waitUntil) d.waitUntil(p);
  };
  try {
    const r = await d.fetchImpl(CATALOGO + '/' + encodeURIComponent(id), Object.assign({ headers: { accept: 'application/json' } }, conTope(timeoutMs)));
    if (r && r.status === 404) { guardar('no-existe', null); return { estado: 'no-existe' }; }
    if (!r || !r.ok) throw new Error('catalogo ' + (r ? r.status : 'sin respuesta'));
    const j = await r.json();
    const loc = resumenXpacio(j && j.location);
    if (!loc || loc.id !== id) throw new Error('respuesta de otro Xpacio');
    guardar('ok', loc);
    return { estado: 'ok', loc };
  } catch (_) {
    return viejo ? { estado: 'ok', loc: viejo, viejo: true } : { estado: 'error' };
  }
}

// Lo que el worker necesita para una página con Xpacio: el reescritor a aplicar, o null para dejarla como está.
// Se arranca en paralelo con la petición del HTML. Nunca lanza.
export async function prepararXpacio(xpacio, url, deps = {}) {
  try {
    const r = await cargarXpacio(xpacio.id, deps);
    const Rewriter = deps.HTMLRewriter || globalThis.HTMLRewriter;
    if (r.estado === 'no-existe') return xpacio.pagina === 'detalle' ? { estado: 'no-existe', rewriter: () => rewriterNoIndex(Rewriter) } : null;
    if (r.estado !== 'ok') return null;
    const d = dependencias(deps);
    const previo = r.loc.previo && PREVIO_IMAGEN.test(r.loc.previo.imagen || '');
    let poster = '';
    if (!previo) {
      const tag = etiquetaStock(r.loc);
      for (const origen of [url.origin, BIZ_ORIGEN]) {
        const p = tag ? await posterCircuitoEnCache(origen, tag, d.cache) : null;
        if (p) { poster = p; break; }
      }
    }
    const m = metadatosXpacio(r.loc, { pagina: xpacio.pagina, url, poster, lang: url.searchParams.get('lang') === 'en' ? 'en' : 'es' });
    return { estado: 'ok', meta: m, rewriter: () => rewriterXpacio(m, Rewriter) };
  } catch (_) { return null; }
}

// La portada sin Xpacio lleva la organización (datos de la propia página: nombre, URL y su icono).
export const JSONLD_ORGANIZACION = '<script type="application/ld+json">' + jsonSeguro({ '@context': 'https://schema.org', '@type': 'Organization',
  name: 'admira.biz', url: BIZ_ORIGEN + '/', logo: BIZ_ORIGEN + '/assets/favicon-256.png' }) + '</script>';
