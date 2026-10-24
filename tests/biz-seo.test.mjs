// SEO y compartir de admira.biz (FLT-102678 · encargo #7161): robots.txt y sitemaps propios por Host, sitemap de Xpacios
// del catálogo ligero con caché en el borde, metadatos por Xpacio en el servidor (escapados, con su previo y con
// respaldo si el catálogo falla), og:locale es_ES y la imagen de compartir sin cifras. clearchannel.tv no cambia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import worker from '../_worker.js';
import {
  robotsTxt, sitemapIndice, sitemapPaginas, idsParaSitemap, sitemapXpacios, handleBizSeo, esFicheroSeo, xpacioDeUrl, metadatosXpacio,
  cabeceraXpacio, rewriterXpacio, cargarXpacio, prepararXpacio, etiquetaStock, resumenXpacio, cifrasXpacio, limpio, jsonSeguro,
  PAGINAS_PUBLICAS, BIZ_ORIGEN, CATALOGO, OG_PORTADA, XPACIOS_FRESCO_S, XPACIO_FRESCO_S, JSONLD_ORGANIZACION, urlXpacio, MAX_NOMBRE_REPETIDO, direccionUtil,
} from '../server/biz-seo.mjs';
import { posterCircuitoEnCache } from '../server/previo-circuito.mjs';
import { BIZ_ASSET_FILES, bizAssetPath } from '../server/biz-assets.mjs';

const require = createRequire(import.meta.url);
const raiz = new URL('../', import.meta.url);
const leer = f => readFileSync(new URL(f, raiz), 'utf8');

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────────────────────────
function cacheFalsa() {
  const datos = new Map();
  return { datos, async match(req) { const r = datos.get(req.url); return r ? r.clone() : undefined; }, async put(req, res) { datos.set(req.url, res.clone()); } };
}
// Comprobación de XML bien formado, sin dependencias: etiquetas equilibradas, una raíz y ningún & suelto.
function xmlBienFormado(xml) {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
  const cuerpo = xml.replace(/^<\?xml[^>]*\?>\s*/, '').replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(cuerpo, /&(?!(?:amp|lt|gt|quot|apos|#\d+);)/, 'ningún & sin escapar');
  const pila = []; let raices = 0;
  for (const [, cierre, nombre, auto] of cuerpo.matchAll(/<(\/?)([A-Za-z][\w:.-]*)(?:\s+[\w:.-]+="[^"<]*")*\s*(\/?)>/g)) {
    if (cierre) assert.equal(pila.pop(), nombre, 'cierre de </' + nombre + '>');
    else if (!auto) { if (!pila.length) raices++; pila.push(nombre); }
  }
  assert.equal(pila.length, 0, 'etiquetas sin cerrar: ' + pila.join(','));
  assert.equal(raices, 1, 'una sola raíz');
  assert.doesNotMatch(cuerpo.replace(/<[^>]+>/g, ''), /[<>]/, 'ningún < o > suelto en el texto');
  return true;
}
const locsDe = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));

const XPACIO = {
  id: 'canalkiosk-gracia', name: 'CanalKiosk Gràcia', kind: 'Quiosco · Canal DOOH · Gemelo fotorreal',
  addr: 'Plaça de la Vila de Gràcia · Barcelona 08012', coords: [2.1572578, 41.4002271],
  surfaces: [{ name: 'MUPI izq.', impr: 480, cpm: '€7' }, { name: 'MUPI dcha.', impr: 460, cpm: '€7' }, { name: 'Kiosko 3D', impr: 520, cpm: '€8' }],
};
const ALCAMPO = {
  id: 'alcampo-andres-vicente', name: 'Alcampo Supermercado Andrés Vicente', kind: 'Supermercado · Alcampo · Circuito DOOH',
  addr: 'Calle Mosén Andrés Vicente, 30-32 · Zaragoza · 50017', city: 'Zaragoza', coords: [-0.913827, 41.648574], external: { brand: 'Alcampo' },
  surfaces: [{ impr: 450, cpm: '€6' }, { impr: 270, cpm: '€4' }],
  previo: { imagen: 'https://admira.tv/api/previo/alcampo-andres-vicente.jpg', w: 1600, h: 900, quad: [[0, 0]] },
};
// Lo que un catálogo malicioso o roto podría traer: todo tiene que salir escapado.
const PELIGROSO = {
  id: 'xpacio-raro', name: 'Tienda "La <b>Buena</b>" & Cía</title><script>alert(1)</script>', kind: "Kiosko 'O' <img src=x onerror=alert(2)>",
  addr: 'Calle "Mayor" <1> & 2\u2028', city: '', coords: [2, 41], surfaces: [{ impr: '100', cpm: '€5,50' }],
};
const respuestaJSON = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

// ── robots.txt y sitemaps por Host ───────────────────────────────────────────────────────────────────────────────
test('admira.biz sirve su robots.txt (Sitemap propio, mismos Disallow del backoffice) y clearchannel.tv el de siempre', async () => {
  const assets = []; const env = { ASSETS: { fetch(req) { assets.push(new URL(req.url).host + new URL(req.url).pathname); return new Response('asset:' + new URL(req.url).pathname, { headers: { 'content-type': 'text/plain' } }); } } };
  for (const host of ['www.admira.biz', 'admira.biz']) {
    const r = await worker.fetch(new Request('https://' + host + '/robots.txt'), env);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'text/plain; charset=utf-8');
    const txt = await r.text();
    assert.match(txt, /^Sitemap: https:\/\/www\.admira\.biz\/sitemap\.xml$/m);
    assert.doesNotMatch(txt, /clearchannel/i);
    for (const linea of ['User-agent: *', 'Allow: /', 'Disallow: /backoffice/', 'Disallow: /backoffice.html']) assert.ok(txt.split('\n').includes(linea), linea);
  }
  assert.equal(assets.length, 0, 'admira.biz no pide robots.txt a ASSETS');
  // El de clearchannel.tv (y admira.app y la vista previa de Pages) sigue saliendo de ASSETS, tal cual.
  for (const host of ['www.clearchannel.tv', 'clearchannel.tv', 'www.admira.app', 'preview.clearchannel-tv.pages.dev']) {
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const r = await worker.fetch(new Request('https://' + host + path), env);
      assert.equal(await r.text(), 'asset:' + path, host + path);
    }
  }
  // Y el fichero de la base (el que sirve clearchannel.tv) no se ha tocado.
  assert.match(leer('robots.txt'), /^Sitemap: https:\/\/www\.clearchannel\.tv\/sitemap\.xml$/m);
  assert.match(leer('sitemap.xml'), /https:\/\/www\.clearchannel\.tv\/store-3d\.html/);
  for (const f of ['robots.txt', 'sitemap.xml']) assert.ok(!BIZ_ASSET_FILES.includes(f), f + ' no entra en la release de admira.biz: lo sirve el worker');
});

test('sitemap.xml de admira.biz es un índice con el de páginas y el de Xpacios; el de páginas no lleva redirecciones', async () => {
  const r = await worker.fetch(new Request('https://www.admira.biz/sitemap.xml'), { ASSETS: { fetch() { throw new Error('no debe llegar a ASSETS'); } } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/xml; charset=utf-8');
  const indice = await r.text();
  xmlBienFormado(indice);
  assert.match(indice, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual(locsDe(indice), [BIZ_ORIGEN + '/sitemap-paginas.xml', BIZ_ORIGEN + '/sitemap-xpacios.xml']);
  const paginas = sitemapPaginas();
  xmlBienFormado(paginas);
  const urls = locsDe(paginas);
  assert.deepEqual(urls, PAGINAS_PUBLICAS.map(p => BIZ_ORIGEN + p));
  for (const u of urls) {
    assert.match(u, /^https:\/\/www\.admira\.biz\//);
    assert.doesNotMatch(u, /store-3d|\.html$|parrilla|backoffice|walk|plano|bugito|arquitecto/, u + ': redirige, es noindex o es una herramienta');
  }
  // HEAD: mismas cabeceras, sin cuerpo; POST: 405.
  const head = await handleBizSeo(new Request('https://www.admira.biz/robots.txt', { method: 'HEAD' }));
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal((await handleBizSeo(new Request('https://www.admira.biz/sitemap.xml', { method: 'POST' }))).status, 405);
  assert.equal(esFicheroSeo(new URL('https://www.admira.biz/sitemap-xpacios.xml')), true);
  assert.equal(esFicheroSeo(new URL('https://www.clearchannel.tv/sitemap.xml')), false);
  assert.equal(esFicheroSeo(new URL('https://admira.biz.example.com/robots.txt')), false);
  assert.equal(esFicheroSeo(new URL('https://www.admira.biz/sitemap-otro.xml')), false);
});

test('sitemap de Xpacios: del catálogo ligero, sin altas propias ni Xpacios sin pantallas, URLs absolutas y XML válido', () => {
  const slim = { count: 7, locations: [
    { id: 'canalkiosk-gracia', name: 'CanalKiosk Gràcia', n: 3 }, { id: 'admira-sitges-2', name: 'Admira Sitges 2', n: 1, selfReg: true },
    { id: 'yokup-lab', name: 'Laboratorio', n: 0 }, { id: 'Mayusculas', name: 'M', n: 2 }, { id: 'canalkiosk-gracia', name: 'CanalKiosk Gràcia', n: 3 },
    { id: 'correos-1774-correos', name: 'Correos Oficina', n: 2 }, { id: 'a&b', name: 'AB', n: 1 }, null,
  ] };
  const ids = idsParaSitemap(slim);
  assert.deepEqual(ids, ['canalkiosk-gracia', 'correos-1774-correos']);
  const xml = sitemapXpacios(ids);
  xmlBienFormado(xml);
  assert.deepEqual(locsDe(xml), ['https://www.admira.biz/detail?loc=canalkiosk-gracia', 'https://www.admira.biz/detail?loc=correos-1774-correos']);
  assert.equal(urlXpacio('a b'), 'https://www.admira.biz/detail?loc=a%20b');
  // Con el catálogo completo (sin «n») cuenta sus pantallas.
  assert.deepEqual(idsParaSitemap([{ id: 'x-1', name: 'X1', surfaces: [{}] }, { id: 'x-2', name: 'X2', surfaces: [] }]), ['x-1']);
  // Tope de 50.000 URLs por sitemap.
  assert.equal(idsParaSitemap({ locations: Array.from({ length: 50010 }, (_, i) => ({ id: 'x-' + i, name: 'Tienda ' + i, n: 1 })) }).length, 50000);
  // Un nombre repetido más de 20 veces (los 3.541 «Correos Oficina» sin dirección) no entra: serían páginas duplicadas.
  const genericos = Array.from({ length: MAX_NOMBRE_REPETIDO + 1 }, (_, i) => ({ id: 'correos-' + i, name: 'Correos Oficina', n: 1 }));
  const veinte = Array.from({ length: MAX_NOMBRE_REPETIDO }, (_, i) => ({ id: 'bbva-' + i, name: 'BBVA Barcelona', n: 1 }));
  const ids2 = idsParaSitemap({ locations: [...genericos, ...veinte, { id: 'sin-nombre', n: 1 }, { id: 'unica', name: 'Única', n: 1 }] });
  assert.deepEqual(ids2, [...veinte.map(l => l.id), 'unica']);
});

test('sitemap de Xpacios: se pide el slim una vez, queda en la Cache API, se renueva detrás pasada 1 h y sin catálogo da 503', async () => {
  const cache = cacheFalsa(), llamadas = [], pendientes = [];
  let ahora = 1_000_000, falla = false;
  const fetchImpl = async (url) => { llamadas.push(String(url)); if (falla) throw new Error('red'); return respuestaJSON({ locations: [{ id: 'uno', name: 'Uno', n: 1 }, { id: 'dos', name: 'Dos', n: 2 }] }); };
  const deps = { fetchImpl, cache, now: () => ahora, waitUntil: p => pendientes.push(p) };
  const pedir = () => handleBizSeo(new Request('https://www.admira.biz/sitemap-xpacios.xml'), deps);
  const r1 = await pedir();
  assert.equal(r1.status, 200); assert.equal(r1.headers.get('x-sitemap-cache'), 'MISS');
  assert.equal(r1.headers.get('cache-control'), 'public, max-age=3600');
  assert.deepEqual(llamadas, [CATALOGO + '?slim=1'], 'sólo el catálogo ligero');
  await Promise.all(pendientes.splice(0));
  assert.equal(cache.datos.size, 1);
  const r2 = await pedir();
  assert.equal(r2.headers.get('x-sitemap-cache'), 'HIT'); assert.equal(llamadas.length, 1);
  assert.deepEqual(locsDe(await r2.text()), [urlXpacio('uno'), urlXpacio('dos')]);
  // Pasada la hora: sale la copia y se renueva detrás; si la renovación falla, la copia buena sigue.
  ahora += (XPACIOS_FRESCO_S + 1) * 1000; falla = true;
  const r3 = await pedir();
  assert.equal(r3.headers.get('x-sitemap-cache'), 'STALE');
  assert.deepEqual(locsDe(await r3.text()), [urlXpacio('uno'), urlXpacio('dos')]);
  await Promise.all(pendientes.splice(0));
  assert.equal(llamadas.length, 2);
  assert.equal((await pedir()).status, 200, 'la copia buena no se pisa con un fallo');
  // Sin copia y sin catálogo: 503 con Retry-After, nunca un sitemap vacío.
  const vacio = await handleBizSeo(new Request('https://www.admira.biz/sitemap-xpacios.xml'), { fetchImpl: async () => { throw new Error('red'); }, cache: cacheFalsa(), now: () => 1 });
  assert.equal(vacio.status, 503); assert.equal(vacio.headers.get('retry-after'), '300'); assert.equal(vacio.headers.get('cache-control'), 'no-store');
  const sinNada = await handleBizSeo(new Request('https://www.admira.biz/sitemap-xpacios.xml'), { fetchImpl: async () => respuestaJSON({ locations: [] }), cache: null });
  assert.equal(sinNada.status, 503);
});

// ── Metadatos por Xpacio ─────────────────────────────────────────────────────────────────────────────────────────
test('xpacioDeUrl: /detail?loc=<id> y la portada con ?loc=<id> (con o sin circuit), sólo en admira.biz', () => {
  assert.deepEqual(xpacioDeUrl(new URL('https://www.admira.biz/detail?loc=canalkiosk-gracia')), { id: 'canalkiosk-gracia', pagina: 'detalle' });
  assert.deepEqual(xpacioDeUrl(new URL('https://admira.biz/detail.html?loc=x-1&lang=en')), { id: 'x-1', pagina: 'detalle' });
  assert.deepEqual(xpacioDeUrl(new URL('https://www.admira.biz/?circuit=altadis_espana&loc=altadis-es-05-madrid')), { id: 'altadis-es-05-madrid', pagina: 'portada' });
  assert.deepEqual(xpacioDeUrl(new URL('https://www.admira.biz/?loc=altadis-es-05-madrid')), { id: 'altadis-es-05-madrid', pagina: 'portada' });
  for (const u of ['https://www.admira.biz/detail', 'https://www.admira.biz/', 'https://www.admira.biz/walk?loc=x', 'https://www.admira.biz/detail?loc=%3Cscript%3E',
    'https://www.admira.biz/detail?loc=' + 'a'.repeat(121), 'https://www.clearchannel.tv/detail?loc=canalkiosk-gracia', 'https://www.admira.app/detail?loc=x']) {
    assert.equal(xpacioDeUrl(new URL(u)), null, u);
  }
});

test('metadatos de un Xpacio: «Nombre · ciudad o dirección | admira.biz», cifras orientativas, canónica /detail?loc=, OG y Place', () => {
  const m = metadatosXpacio(XPACIO, { pagina: 'detalle' });
  assert.equal(m.titulo, 'CanalKiosk Gràcia · Plaça de la Vila de Gràcia · Barcelona 08012 | admira.biz');
  assert.equal(m.descripcion, 'Quiosco · Canal DOOH · Gemelo fotorreal en Plaça de la Vila de Gràcia · Barcelona 08012. 3 dispositivos, unas 1460 impresiones al día estimadas y CPM orientativo de €7,33. Cifras orientativas del catálogo, no audiencia medida.');
  assert.deepEqual(cifrasXpacio(XPACIO), { dispositivos: 3, impr: 1460, cpm: 22 / 3 });
  assert.equal(m.canonica, 'https://www.admira.biz/detail?loc=canalkiosk-gracia');
  assert.equal(m.ogUrl, m.canonica);
  assert.deepEqual(m.imagen, { url: OG_PORTADA.url, w: 1200, h: 630, fuente: 'portada', alt: 'Mapa de espacios comerciales de admira.biz' });
  assert.equal(m.locale, 'es_ES'); assert.equal(m.localeAlt, 'en_GB');
  assert.deepEqual(m.jsonLd, { '@context': 'https://schema.org', '@type': 'Place', name: 'CanalKiosk Gràcia', url: m.canonica,
    address: 'Plaça de la Vila de Gràcia · Barcelona 08012', geo: { '@type': 'GeoCoordinates', latitude: 41.4002271, longitude: 2.1572578 } });
  // Con ciudad, el título la usa; la descripción, la dirección.
  const a = metadatosXpacio(ALCAMPO);
  assert.equal(a.titulo, 'Alcampo Supermercado Andrés Vicente · Zaragoza | admira.biz');
  assert.match(a.descripcion, /^Supermercado · Alcampo · Circuito DOOH en Calle Mosén Andrés Vicente, 30-32 · Zaragoza · 50017\. 2 dispositivos, unas 720 impresiones al día estimadas y CPM orientativo de €5,00\./);
  // Las cifras nunca se presentan como medidas.
  for (const d of [m.descripcion, a.descripcion]) { assert.match(d, /estimad/); assert.match(d, /orientativ/); assert.match(d, /no audiencia medida/); }
  // En inglés (?lang=en, la versión de la propia página): mismas cifras, mismo título y la canónica en español.
  const en = metadatosXpacio(XPACIO, { lang: 'en' });
  assert.equal(en.titulo, m.titulo); assert.equal(en.canonica, m.canonica); assert.equal(en.locale, 'en_GB'); assert.equal(en.localeAlt, 'es_ES');
  assert.match(en.descripcion, /3 devices, about 1,460 estimated impressions a day and indicative CPM €7\.33\. Indicative catalogue figures, not measured audience\.$/);
  // La dirección de relleno de OpenStreetMap («Correos · post_box») no sale en el título ni en la descripción.
  const correos = metadatosXpacio({ id: 'correos-2079-correos', name: 'Correos Oficina', kind: 'Correos · Oficina postal · Retail público nacional',
    addr: 'Correos · post_box', external: { brand: 'Correos' }, surfaces: [{ impr: 420, cpm: '€6' }] });
  assert.equal(correos.titulo, 'Correos Oficina | admira.biz');
  assert.match(correos.descripcion, /^Correos · Oficina postal · Retail público nacional\. 1 dispositivo, unas 420 impresiones al día estimadas y CPM orientativo de €6,00\./);
  assert.equal(direccionUtil('Oficina de Correos · Correos · post_office', 'Correos Oficina de', 'Correos'), 'Oficina de Correos');
  assert.equal(direccionUtil('Calle de Fuencarral 2 · 28004 Madrid', 'Estanco', ''), 'Calle de Fuencarral 2 · 28004 Madrid');
  assert.equal(direccionUtil('España', 'BBVA España', 'BBVA'), '');
  // Sin pantallas no se inventa nada.
  const vacio = metadatosXpacio({ id: 'v', name: 'Vacío', surfaces: [] });
  assert.equal(vacio.descripcion, 'Espacio comercial. Aún sin pantallas publicadas.');
  assert.equal(vacio.titulo, 'Vacío | admira.biz');
});

test('og:image por prioridad: el Previo DooH de la fachada, el póster del circuito en caché y, si no, la portada', async () => {
  const a = metadatosXpacio(ALCAMPO, { poster: 'https://api.admira.store/stock/poster/h1' });
  assert.deepEqual(a.imagen, { url: 'https://admira.tv/api/previo/alcampo-andres-vicente.jpg', w: 1600, h: 900, fuente: 'previo', alt: 'Fachada de Alcampo Supermercado Andrés Vicente (Previo DooH)' });
  assert.equal(a.jsonLd.image, a.imagen.url);
  const b = metadatosXpacio({ ...ALCAMPO, previo: null }, { poster: 'https://api.admira.store/stock/poster/h1' });
  assert.equal(b.imagen.fuente, 'circuito'); assert.equal(b.imagen.url, 'https://api.admira.store/stock/poster/h1'); assert.equal(b.imagen.w, 0);
  assert.equal(b.jsonLd.image, undefined);
  // Un previo que no es de admira.tv, o un póster que no es https, no valen.
  assert.equal(metadatosXpacio({ ...ALCAMPO, previo: { imagen: 'https://malo.example/x.jpg' } }).imagen.fuente, 'portada');
  assert.equal(metadatosXpacio({ ...ALCAMPO, previo: null }, { poster: 'http://inseguro.example/p.jpg' }).imagen.fuente, 'portada');
  assert.equal(metadatosXpacio({ ...ALCAMPO, previo: null }, { poster: 'https://x.example/"onerror="' }).imagen.fuente, 'portada');
  // El póster sale de la Cache API de /api/previo/circuito, sin preguntar nunca al Stock.
  const cache = cacheFalsa();
  await cache.put(new Request('https://www.admira.biz/api/previo/circuito?tag=alcampo'), new Response(JSON.stringify({ ok: true, poster: 'https://api.admira.store/stock/poster/v1', horizontal: { poster: 'https://api.admira.store/stock/poster/h1' } }), { headers: { 'x-previo-ok': '1' } }));
  await cache.put(new Request('https://www.admira.biz/api/previo/circuito?tag=jti'), new Response(JSON.stringify({ ok: false, poster: 'https://x.example/p.jpg' }), { headers: { 'x-previo-ok': '0' } }));
  assert.equal(await posterCircuitoEnCache('https://www.admira.biz', 'alcampo', cache), 'https://api.admira.store/stock/poster/h1', 'mejor la horizontal');
  assert.equal(await posterCircuitoEnCache('https://www.admira.biz', 'jti', cache), '', 'un fallo guardado no cuenta');
  assert.equal(await posterCircuitoEnCache('https://www.admira.biz', 'correos', cache), '');
  assert.equal(await posterCircuitoEnCache('https://www.admira.biz', '../x', cache), '');
  assert.equal(await posterCircuitoEnCache('https://www.admira.biz', 'alcampo', null), '');
  const fetchImpl = async () => respuestaJSON({ location: { ...ALCAMPO, previo: null } });
  const p = await prepararXpacio({ id: ALCAMPO.id, pagina: 'detalle' }, new URL('https://admira.biz/detail?loc=' + ALCAMPO.id), { fetchImpl, cache, now: () => 1, HTMLRewriter: class {} });
  assert.equal(p.meta.imagen.url, 'https://api.admira.store/stock/poster/h1', 'desde admira.biz sin www también encuentra la caché de www');
});

test('og:url: la ficha por enlace de la portada se comparte tal cual (sin parámetros ajenos); el resto, la canónica', () => {
  const url = new URL('https://www.admira.biz/?utm_source=x&circuit=altadis_espana&loc=altadis-es-05-madrid&marca=altadis&lang=en&fbclid=1');
  const m = metadatosXpacio({ ...XPACIO, id: 'altadis-es-05-madrid' }, { pagina: 'portada', url });
  assert.equal(m.ogUrl, 'https://www.admira.biz/?circuit=altadis_espana&loc=altadis-es-05-madrid&marca=altadis&lang=en');
  assert.equal(m.canonica, 'https://www.admira.biz/detail?loc=altadis-es-05-madrid', 'Google consolida en la ficha');
  // Sin circuit la portada no abre la ficha: la tarjeta lleva a /detail.
  assert.equal(metadatosXpacio(XPACIO, { pagina: 'portada', url: new URL('https://www.admira.biz/?loc=canalkiosk-gracia') }).ogUrl, urlXpacio('canalkiosk-gracia'));
  assert.equal(metadatosXpacio(XPACIO, { pagina: 'portada', url: new URL('https://www.admira.biz/?circuit=%22%3E&loc=canalkiosk-gracia') }).ogUrl, urlXpacio('canalkiosk-gracia'));
});

test('la cabecera del Xpacio escapa todo lo que viene del catálogo (comillas, <, &) y el JSON-LD no puede cerrar el script', () => {
  const m = metadatosXpacio(PELIGROSO, { pagina: 'detalle' });
  const html = cabeceraXpacio(m);
  assert.doesNotMatch(html, /<script>alert|<b>|<img|onerror=alert\(2\)>|<\/title>/i);
  assert.equal((html.match(/<script/g) || []).length, 1, 'sólo el script de JSON-LD');
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  // Cada atributo content es una cadena entre comillas sin comillas dentro.
  for (const [, valor] of html.matchAll(/content="([^"]*)"/g)) assert.doesNotMatch(valor, /[<>]/);
  assert.match(html, /Tienda &quot;La &lt;b&gt;Buena&lt;\/b&gt;&quot; &amp; Cía&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Kiosko &#39;O&#39; &lt;img src=x onerror=alert\(2\)&gt;/);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(ld, /[<>&\u2028\u2029]/);
  assert.equal(JSON.parse(ld).name, limpio(PELIGROSO.name, 90), 'el JSON sigue siendo el mismo dato');
  assert.equal(jsonSeguro({ a: '</script><!--&\u2028' }), '{"a":"\\u003c/script\\u003e\\u003c!--\\u0026\\u2028"}');
  // El título va a setInnerContent como texto (el HTMLRewriter lo escapa); sin saltos de línea ni controles.
  assert.doesNotMatch(m.titulo, /[\u0000-\u001f\u2028]/);
  assert.equal(limpio('a'.repeat(200), 20).length, 20);
  for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'og:locale', 'og:locale:alternate', 'og:site_name', 'og:type']) assert.ok(html.includes('property="' + k + '"'), k);
  for (const k of ['description', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'admira:xpacio']) assert.ok(html.includes('name="' + k + '"'), k);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.admira\.biz\/detail\?loc=xpacio-raro">/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test('en el worker, fetch se llama suelto (en workerd, como método de otro objeto da «Illegal invocation»)', async () => {
  const real = globalThis.fetch;
  const llamadas = [];
  globalThis.fetch = function (url) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    llamadas.push(String(url));
    return Promise.resolve(String(url).includes('slim') ? respuestaJSON({ locations: [{ id: 'uno', name: 'Uno', n: 1 }] }) : respuestaJSON({ location: XPACIO }));
  };
  try {
    const r = await handleBizSeo(new Request('https://www.admira.biz/sitemap-xpacios.xml'), { cache: null });
    assert.equal(r.status, 200);
    assert.equal((await cargarXpacio('canalkiosk-gracia', { cache: null })).estado, 'ok');
    assert.equal(llamadas.length, 2);
  } finally { globalThis.fetch = real; }
});

test('cargarXpacio: GET /locations/:id con caché corta; un 404 es «no existe»; un fallo usa la última copia buena o nada', async () => {
  const cache = cacheFalsa(), llamadas = []; let ahora = 5000, modo = 'ok';
  const fetchImpl = async (url, init) => {
    llamadas.push({ url: String(url), signal: !!(init && init.signal) });
    if (modo === 'red') throw new Error('red');
    if (modo === '404') return respuestaJSON({ error: 'not_found' }, 404);
    if (modo === '500') return respuestaJSON({}, 500);
    if (modo === 'otro') return respuestaJSON({ location: { ...XPACIO, id: 'otro' } });
    return respuestaJSON({ location: { ...XPACIO, secreto: 'no se guarda', surfaces: [...XPACIO.surfaces, null] } });
  };
  const deps = { fetchImpl, cache, now: () => ahora };
  const r1 = await cargarXpacio('canalkiosk-gracia', deps);
  assert.equal(r1.estado, 'ok'); assert.equal(r1.loc.name, 'CanalKiosk Gràcia'); assert.equal(r1.loc.secreto, undefined); assert.equal(r1.loc.surfaces.length, 3);
  assert.deepEqual(llamadas, [{ url: CATALOGO + '/canalkiosk-gracia', signal: true }], 'una petición, con tope de tiempo');
  await new Promise(r => setImmediate(r));
  assert.equal((await cargarXpacio('canalkiosk-gracia', deps)).estado, 'ok'); assert.equal(llamadas.length, 1, 'dentro de los 2 min sale de la caché');
  ahora += (XPACIO_FRESCO_S + 1) * 1000; modo = 'red';
  const viejo = await cargarXpacio('canalkiosk-gracia', deps);
  assert.equal(viejo.estado, 'ok'); assert.equal(viejo.viejo, true); assert.equal(llamadas.length, 2);
  modo = '500'; assert.equal((await cargarXpacio('sin-copia', deps)).estado, 'error');
  modo = 'otro'; assert.equal((await cargarXpacio('sin-copia', deps)).estado, 'error', 'una respuesta de otro Xpacio no vale');
  modo = '404'; assert.equal((await cargarXpacio('no-existe-ya', deps)).estado, 'no-existe');
  await new Promise(r => setImmediate(r));
  const antes = llamadas.length; assert.equal((await cargarXpacio('no-existe-ya', deps)).estado, 'no-existe'); assert.equal(llamadas.length, antes, 'el 404 se recuerda');
  assert.equal((await cargarXpacio('<x>', deps)).estado, 'error');
  assert.deepEqual(resumenXpacio(null), null);
});

// HTMLRewriter de juguete: guarda los manejadores; transform() devuelve el propio reescritor (como tests/brand-worker).
class FakeRewriter {
  constructor() { this.handlers = []; }
  on(selector, handlers) { this.handlers.push([selector, handlers]); return this; }
  transform(entrada) { this.entrada = entrada; return this; }
}
function elemento(attrs = {}) {
  return { attrs: { ...attrs }, quitado: false, inner: null, anadido: '', getAttribute(k) { return this.attrs[k] ?? null; }, setAttribute(k, v) { this.attrs[k] = v; },
    setInnerContent(v, o) { this.inner = v; this.innerHtml = !!(o && o.html); }, remove() { this.quitado = true; }, append(v, o) { this.anadido += v; this.appendHtml = !!(o && o.html); } };
}

test('worker: /detail?loc=<id> y la portada con ?loc= salen con los metadatos del Xpacio; si el catálogo falla, con los genéricos', async () => {
  const realFetch = globalThis.fetch, realRewriter = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = FakeRewriter;
  const pedidas = [];
  let modo = 'ok';
  globalThis.fetch = async (url) => {
    pedidas.push(String(url));
    if (modo === 'red') throw new Error('red');
    if (modo === '404') return respuestaJSON({ error: 'not_found' }, 404);
    return respuestaJSON({ location: XPACIO });
  };
  const env = { ASSETS: { fetch() { return new Response('<html><head><title>x</title></head></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }); } } };
  try {
    const rw = await worker.fetch(new Request('https://www.admira.biz/detail?loc=canalkiosk-gracia'), env);
    assert.deepEqual(pedidas, [CATALOGO + '/canalkiosk-gracia']);
    const sel = rw.handlers.map(([s]) => s);
    assert.deepEqual(sel, ['title', 'meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'meta[name="admira:xpacio"]', 'link[rel="canonical"]', 'head']);
    assert.ok(rw.entrada instanceof FakeRewriter && rw.entrada.handlers.some(([s]) => s === 'meta[content]'), 'después de la pasada de marca');
    const of = s => rw.handlers.find(([x]) => x === s)[1];
    const titulo = elemento(); of('title').element(titulo);
    assert.equal(titulo.inner, 'CanalKiosk Gràcia · Plaça de la Vila de Gràcia · Barcelona 08012 | admira.biz'); assert.equal(titulo.innerHtml, false, 'como texto');
    for (const s of ['meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'link[rel="canonical"]']) { const e = elemento(); of(s).element(e); assert.equal(e.quitado, true, s); }
    const head = elemento(); of('head').element(head);
    assert.equal(head.appendHtml, true);
    assert.match(head.anadido, /<link rel="canonical" href="https:\/\/www\.admira\.biz\/detail\?loc=canalkiosk-gracia">/);
    assert.match(head.anadido, /<meta property="og:locale" content="es_ES">/);
    assert.match(head.anadido, /"@type":"Place"/);
    // La portada con la ficha por enlace: lo mismo, y la portada sin ?loc no pide nada al catálogo.
    pedidas.length = 0;
    const portada = await worker.fetch(new Request('https://www.admira.biz/?circuit=kioskos&loc=canalkiosk-gracia'), env);
    assert.equal(portada.handlers[0][0], 'title'); assert.deepEqual(pedidas, [CATALOGO + '/canalkiosk-gracia']);
    const h2 = elemento(); portada.handlers.find(([s]) => s === 'head')[1].element(h2);
    assert.match(h2.anadido, /property="og:url" content="https:\/\/www\.admira\.biz\/\?circuit=kioskos&amp;loc=canalkiosk-gracia"/);
    pedidas.length = 0;
    const sinLoc = await worker.fetch(new Request('https://www.admira.biz/'), env);
    assert.ok(sinLoc.handlers.some(([s]) => s === 'meta[content]'), 'la portada de siempre'); assert.equal(pedidas.length, 0);
    // Catálogo caído: la página sale con la pasada de marca de siempre (metadatos genéricos), sin romperse.
    modo = 'red';
    const caida = await worker.fetch(new Request('https://www.admira.biz/detail?loc=canalkiosk-gracia'), env);
    assert.ok(caida.handlers.some(([s]) => s === 'meta[content]') && !caida.handlers.some(([s]) => s === 'meta[property^="og:"]'));
    // Un id que el catálogo no conoce: /detail lleva noindex; la portada, nada.
    modo = '404';
    const noExiste = await worker.fetch(new Request('https://www.admira.biz/detail?loc=no-existe'), env);
    assert.deepEqual(noExiste.handlers.map(([s]) => s), ['head']);
    const h3 = elemento(); noExiste.handlers[0][1].element(h3); assert.equal(h3.anadido, '<meta name="robots" content="noindex">\n');
    const portada404 = await worker.fetch(new Request('https://www.admira.biz/?loc=no-existe-2'), env);
    assert.ok(portada404.handlers.some(([s]) => s === 'meta[content]'));
    // clearchannel.tv y admira.app no cambian: ni catálogo ni metadatos por Xpacio.
    pedidas.length = 0; modo = 'ok';
    const cc = await worker.fetch(new Request('https://www.clearchannel.tv/detail?loc=canalkiosk-gracia'), env);
    assert.deepEqual(cc.handlers.map(([s]) => s), ['head'], 'sólo el avatar de siempre');
    const app = await worker.fetch(new Request('https://www.admira.app/detail?loc=canalkiosk-gracia'), env);
    assert.ok(!app.handlers.some(([s]) => s === 'meta[property^="og:"]'));
    assert.equal(pedidas.length, 0);
    // Una respuesta que no es HTML (o no es 200) no se toca.
    const env404 = { ASSETS: { fetch() { return new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }); } } };
    const r404 = await worker.fetch(new Request('https://www.admira.biz/detail?loc=canalkiosk-gracia'), env404);
    assert.ok(!r404.handlers.some(([s]) => s === 'meta[property^="og:"]'));
  } finally { globalThis.fetch = realFetch; globalThis.HTMLRewriter = realRewriter; }
});

test('rewriterXpacio sustituye los metadatos genéricos sin dejar duplicados', () => {
  const rw = rewriterXpacio(metadatosXpacio(XPACIO), FakeRewriter);
  const quitar = rw.handlers.filter(([, h]) => h.element && h.element.toString().includes('remove')).map(([s]) => s);
  assert.deepEqual(quitar, ['meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]', 'meta[name="admira:xpacio"]', 'link[rel="canonical"]']);
});

// ── Idioma, imagen de compartir y portada ────────────────────────────────────────────────────────────────────────
test('og:locale es_ES con alternate en_GB en admira.biz; la imagen de compartir es la suya; Organization sólo en su portada', async () => {
  const realRewriter = globalThis.HTMLRewriter; globalThis.HTMLRewriter = FakeRewriter;
  const env = { ASSETS: { fetch() { return new Response('<html></html>', { headers: { 'content-type': 'text/html' } }); } } };
  try {
    const meta = async (url, attrs) => { const rw = await worker.fetch(new Request(url), env); const e = elemento(attrs); rw.handlers.find(([s]) => s === 'meta[content]')[1].element(e); return e.attrs.content; };
    assert.equal(await meta('https://www.admira.biz/', { property: 'og:locale', content: 'en_GB' }), 'es_ES');
    assert.equal(await meta('https://www.admira.biz/', { property: 'og:locale:alternate', content: 'es_ES' }), 'en_GB');
    assert.equal(await meta('https://www.admira.biz/about', { property: 'og:locale', content: 'es_ES' }), 'es_ES', 'la que ya estaba bien no cambia');
    assert.equal(await meta('https://www.admira.biz/presentation/', { property: 'og:locale', content: 'en_GB' }), 'es_ES');
    assert.equal(await meta('https://www.admira.biz/', { property: 'og:image', content: 'https://www.clearchannel.tv/assets/og-cover.jpg' }), 'https://www.admira.biz/assets/og-admira-biz.jpg');
    assert.equal(await meta('https://www.admira.biz/about', { name: 'twitter:image', content: 'https://www.clearchannel.tv/assets/og-cover.jpg' }), 'https://www.admira.biz/assets/og-admira-biz.jpg');
    assert.equal(await meta('https://www.admira.app/', { property: 'og:image', content: 'https://www.clearchannel.tv/assets/og-cover.jpg' }), 'https://www.admira.app/assets/og-cover.jpg', 'admira.app no cambia de imagen');
    const head = async url => { const rw = await worker.fetch(new Request(url), env); const e = elemento(); rw.handlers.find(([s]) => s === 'head')[1].element(e); return e.anadido; };
    assert.ok((await head('https://www.admira.biz/')).includes(JSONLD_ORGANIZACION));
    assert.ok(!(await head('https://www.admira.biz/about')).includes('"Organization"'));
    assert.ok(!(await head('https://www.admira.app/')).includes('"Organization"'));
    const org = JSON.parse(JSONLD_ORGANIZACION.replace(/^<script[^>]*>|<\/script>$/g, ''));
    assert.deepEqual(org, { '@context': 'https://schema.org', '@type': 'Organization', name: 'admira.biz', url: 'https://www.admira.biz/', logo: 'https://www.admira.biz/assets/favicon-256.png' });
    // clearchannel.tv: ningún reescritor de marca (ni locale ni imagen): sólo el avatar.
    assert.deepEqual((await worker.fetch(new Request('https://www.clearchannel.tv/'), env)).handlers.map(([s]) => s), ['head']);
  } finally { globalThis.HTMLRewriter = realRewriter; }
  // index.html (sólo admira.biz) ya lo declara así en el origen.
  const index = leer('index.html');
  assert.match(index, /<meta property="og:locale" content="es_ES">\n<meta property="og:locale:alternate" content="en_GB">/);
  assert.doesNotMatch(index, /hreflang/, 'sin hreflang: ?lang=en comparte canónica con la versión en español');
});

test('la imagen de compartir de admira.biz y la ilustración de la ficha: sin cifras, con su tamaño y en la release de admira.biz', () => {
  const jpg = readFileSync(new URL('assets/og-admira-biz.jpg', raiz));
  assert.equal(jpg[0], 0xff); assert.equal(jpg[1], 0xd8, 'JPEG');
  // Tamaño en la cabecera SOF0/SOF2.
  let i = 2, w = 0, h = 0;
  while (i < jpg.length) { const marca = jpg[i + 1], largo = jpg.readUInt16BE(i + 2); if (marca === 0xc0 || marca === 0xc2) { h = jpg.readUInt16BE(i + 5); w = jpg.readUInt16BE(i + 7); break; } i += 2 + largo; }
  assert.deepEqual([w, h], [1200, 630]);
  assert.ok(statSync(new URL('assets/og-admira-biz.jpg', raiz)).size < 200 * 1024, 'menos de 200 KB');
  const webp = readFileSync(new URL('assets/xpacio-ilustrativo.webp', raiz));
  assert.equal(webp.toString('ascii', 0, 4), 'RIFF'); assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
  for (const f of ['assets/og-admira-biz.jpg', 'assets/xpacio-ilustrativo.webp', 'brand.js']) assert.ok(BIZ_ASSET_FILES.includes(f), f);
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/assets/og-admira-biz.jpg')), '/__admira_biz/assets/og-admira-biz.jpg');
  assert.equal(bizAssetPath(new URL('https://www.clearchannel.tv/assets/og-admira-biz.jpg')), '');
  // La ficha ya no enseña el cockpit con «2.456.789 impresiones» y «$1,85» junto al CPM real.
  const detail = leer('detail.html');
  assert.doesNotMatch(detail, /admira-app-cockpit\.webp/);
  assert.match(detail, /<img src="assets\/xpacio-ilustrativo\.webp" width="1600" height="770"/);
  // La de clearchannel.tv sigue en su sitio, intacta.
  assert.ok(statSync(new URL('assets/og-cover.jpg', raiz)).size > 0);
});

test('brand.js respeta una canónica propia con query (la de un Xpacio) y sigue corrigiendo la de clearchannel.tv', () => {
  const codigo = leer('brand.js');
  function ejecutar(host, canonical) {
    const enlace = { nodeType: 1, tagName: 'LINK', attrs: { rel: 'canonical', href: canonical }, hasAttribute(k) { return k in this.attrs; }, getAttribute(k) { return this.attrs[k] ?? null; },
      setAttribute(k, v) { this.attrs[k] = v; }, matches() { return false; } };
    const raizDoc = { nodeType: 1, tagName: 'HTML', dataset: {}, lang: '', hasAttribute() { return false; }, getAttribute() { return null; }, matches() { return false; }, querySelectorAll: () => [enlace] };
    const documento = { documentElement: raizDoc, readyState: 'complete', body: {}, head: { appendChild() {} }, createTreeWalker: () => ({ nextNode: () => false }), querySelector: () => null, addEventListener() {} };
    const ctx = vm.createContext({ window: { location: { hostname: host, search: '', pathname: '/detail' } }, document: documento, URLSearchParams, NodeFilter: { SHOW_TEXT: 4 },
      fetch: () => Promise.reject(new Error('sin red')), MutationObserver: class { observe() {} } });
    vm.runInContext(codigo, ctx);
    return enlace.attrs.href;
  }
  assert.equal(ejecutar('www.admira.biz', 'https://www.admira.biz/detail?loc=canalkiosk-gracia'), 'https://www.admira.biz/detail?loc=canalkiosk-gracia');
  assert.equal(ejecutar('www.admira.biz', 'https://www.clearchannel.tv/detail.html'), 'https://www.admira.biz/detail');
  assert.equal(ejecutar('www.admira.biz', 'https://www.admira.bizarro.example/x'), 'https://www.admira.biz/detail');
  // Los cargadores con brand.js cambiado piden la versión nueva.
  for (const f of ['index.html', 'detail.html']) assert.match(leer(f), /<script src="\/brand\.js\?v=20261024-seo-1"><\/script>/, f);
});

test('etiquetaStock del servidor = la de previos-zoom.js (el póster del circuito es el mismo que ve el mapa)', () => {
  const PZ = require('../previos-zoom.js');
  const casos = [ALCAMPO, XPACIO, { id: 'altadis-es-05-madrid', circuit: 'altadis_espana' }, { id: 'xtanco-bcn', circuit: 'jti_xtanco' },
    { id: 'alsea-mx-sbux-06-cdmx', circuit: 'alsea_mexico' }, { id: 'correos-1774-correos' }, { id: 'tienda-x', external: { brand: 'Starbucks' } },
    { id: 'otro', external: { brand: 'Xtanco' } }, { id: 'nada' }, null, { id: 'kiosko-12', circuit: 'kioskos' }, { id: 'x', circuit: 'metro' }];
  for (const c of casos) assert.equal(etiquetaStock(c), PZ.etiquetaStock(c), JSON.stringify(c));
});

test('la release copia el módulo SEO y no publica robots ni sitemap de admira.biz como ficheros', () => {
  const build = leer('scripts/build-biz-release.mjs');
  assert.match(build, /copyFileSync\(join\(root, 'server\/biz-seo\.mjs'\), join\(out, 'server\/biz-seo\.mjs'\)\)/);
  assert.match(robotsTxt(), /Disallow: \/backoffice\n/);
  xmlBienFormado(sitemapIndice());
});
