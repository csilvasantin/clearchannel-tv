// Previo del circuito para el mapa y la ficha (FLT-102666 · encargo #7145, 24-oct-2026).
// GET /api/previo/circuito?tag=<circuito> devuelve la primera pieza del Stock con ese hashtag que tiene póster
// https://: {ok, tag, poster, video, title, vertical, horizontal}. Sin pieza válida, {ok:true, poster:null}.
// El Stock (api.admira.store/stock/list) tarda unos 22 s en responder, así que el navegador no puede pedirlo en cada
// zoom: aquí se pregunta una vez y se guarda en la Cache API de Cloudflare. A los 15 min la copia sigue sirviéndose al
// instante mientras se renueva detrás (waitUntil); a las 24 h caduca. No es un proxy: sólo esta ruta, sólo GET/HEAD,
// sólo tags [a-z0-9_-]{1,40} y sólo stock/list con type=video; el cuerpo que sale lo compone este módulo.
export const PREVIO_CIRCUITO_PATH = '/api/previo/circuito';
export const PREVIO_TAG = /^[a-z0-9_-]{1,40}$/;
export const PREVIO_FRESCO_S = 900;       // 15 min: después se renueva por detrás
export const PREVIO_GUARDADO_S = 86400;   // 24 h: lo que dura la copia en la Cache API
export const PREVIO_ERROR_S = 60;         // un fallo del Stock se recuerda 1 min, para no repetir 22 s en cada visita
export const STOCK_LIST = 'https://api.admira.store/stock/list';
export const PREVIO_CIRCUITO_HOST = /^(?:www\.)?admira\.biz$|(?:^|\.)clearchannel-tv\.pages\.dev$|^(?:localhost|127\.0\.0\.1)$/i;
const GENERADO = 'x-previo-generado', OK = 'x-previo-ok';
const CABECERAS = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };

const https = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
function orientacionDe(it) {
  const tags = Array.isArray(it && it.tags) ? it.tags.map(x => String(x).toLowerCase()) : [];
  if (tags.includes('vertical')) return 'vertical';
  if (tags.includes('horizontal')) return 'horizontal';
  const t = String(it && it.title || '');
  if (/\b9\s*:\s*16\b|VERTICAL/.test(t)) return 'vertical';
  if (/\b16\s*:\s*9\b|HORIZONTAL/.test(t)) return 'horizontal';
  return '';
}
function pieza(it) {
  const poster = https(it && (it.poster || it.thumbnail || it.thumb));
  if (!poster) return null;
  return { poster, video: https(it.url) || null, title: String(it.title || '').slice(0, 120), orientacion: orientacionDe(it) || null };
}
// Resumen del Stock para un tag: la primera pieza con póster y, si las hay, la primera vertical y la primera horizontal
// (la pantalla del previo es vertical u horizontal y se le encaja la que corresponde).
export function resumenStock(payload, tag) {
  const items = !payload ? [] : Array.isArray(payload.items) ? payload.items : Array.isArray(payload.assets) ? payload.assets : Array.isArray(payload) ? payload : [];
  let primera = null, vertical = null, horizontal = null, validas = 0;
  for (const it of items) {
    const p = pieza(it);
    if (!p) continue;
    validas++;
    if (!primera) primera = p;
    if (!vertical && p.orientacion === 'vertical') vertical = p;
    if (!horizontal && p.orientacion === 'horizontal') horizontal = p;
  }
  if (!primera) return { ok: true, tag, poster: null, video: null, title: null, vertical: null, horizontal: null, piezas: 0 };
  return { ok: true, tag, poster: primera.poster, video: primera.video, title: primera.title, vertical, horizontal, piezas: validas };
}

function json(body, status, cacheControl, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({}, CABECERAS, { 'Cache-Control': cacheControl }, extra) });
}
// Lo que se guarda en la Cache API lleva su propio s-maxage (24 h, o 1 min si fue un fallo del Stock), la hora en que
// se generó y si salió bien.
function paraGuardar({ body, ok, generado }) {
  return json(body, 200, 'public, s-maxage=' + (ok ? PREVIO_GUARDADO_S : PREVIO_ERROR_S), { [GENERADO]: String(generado), [OK]: ok ? '1' : '0' });
}
// Lo que recibe el navegador: 5 min en el navegador y 15 min en cachés compartidas (1 min si fue un fallo).
function paraServir(texto, ok, estado) {
  return new Response(texto, { status: 200, headers: Object.assign({}, CABECERAS, {
    'Cache-Control': ok ? 'public, max-age=300, s-maxage=' + PREVIO_FRESCO_S : 'public, max-age=' + PREVIO_ERROR_S,
    'X-Previo-Cache': estado }) });
}

const enVuelo = new Map();   // tag → promesa: dos visitas a la vez no piden dos veces lo mismo al Stock
async function consultarStock(tag, fetchImpl, timeoutMs) {
  const url = STOCK_LIST + '?tag=' + encodeURIComponent(tag) + '&type=video';
  const init = { headers: { accept: 'application/json' } };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') init.signal = AbortSignal.timeout(timeoutMs);
  try {
    const r = await fetchImpl(url, init);
    if (!r || !r.ok) return { ok: false, tag, poster: null, error: 'stock_' + (r ? r.status : 'sin_respuesta') };
    return resumenStock(await r.json(), tag);
  } catch (_) {
    return { ok: false, tag, poster: null, error: 'stock_no_disponible' };
  }
}
// Devuelve {texto, ok}: cada visita compone su propia Response (un cuerpo sólo se puede leer una vez).
// Al renovar una copia buena, un fallo del Stock no la pisa: se sigue sirviendo la buena hasta que caduque.
function generar(tag, d, { conservarBuena = false } = {}) {
  if (enVuelo.has(tag)) return enVuelo.get(tag);
  const p = consultarStock(tag, d.fetchImpl, d.timeoutMs).then(async body => {
    const hecho = { body, ok: !!body.ok, generado: d.now() };
    if (d.cache && (hecho.ok || !conservarBuena)) { try { await d.cache.put(d.clave, paraGuardar(hecho)); } catch (_) {} }
    return { texto: JSON.stringify(body), ok: hecho.ok };
  }).finally(() => enVuelo.delete(tag));
  enVuelo.set(tag, p);
  return p;
}

// El póster del circuito si ya está en la Cache API (SEO y compartir, FLT-102678): sólo lee, nunca pregunta al Stock
// (tarda ~22 s). Prefiere la pieza horizontal, que encaja mejor en una tarjeta de 1,91:1. → URL https o ''.
export async function posterCircuitoEnCache(origen, tag, cache) {
  if (!cache || !PREVIO_TAG.test(tag || '')) return '';
  try {
    const r = await cache.match(new Request(origen + PREVIO_CIRCUITO_PATH + '?tag=' + tag, { method: 'GET' }));
    if (!r || r.headers.get(OK) === '0') return '';
    const b = await r.json();
    return https(b && b.horizontal && b.horizontal.poster) || https(b && b.poster);
  } catch (_) { return ''; }
}

export function esPrevioCircuito(url) {
  return url.pathname === PREVIO_CIRCUITO_PATH && PREVIO_CIRCUITO_HOST.test(url.hostname);
}

// deps (para los tests): fetchImpl, cache (la Cache API: match/put), now, waitUntil y timeoutMs.
export async function handlePrevioCircuito(request, deps = {}) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Max-Age': '86400' } });
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'method_not_allowed' }, 405, 'no-store', { Allow: 'GET, HEAD, OPTIONS' });
  const tag = url.searchParams.get('tag') || '';
  if (!PREVIO_TAG.test(tag)) return json({ ok: false, error: 'tag_invalido' }, 400, 'public, max-age=300');
  const d = {
    fetchImpl: deps.fetchImpl || fetch,
    cache: 'cache' in deps ? deps.cache : (typeof caches !== 'undefined' && caches.default) || null,
    now: deps.now || Date.now,
    waitUntil: deps.waitUntil || null,
    timeoutMs: deps.timeoutMs || 45000,
    // La clave no depende de lo que el visitante añada a la URL: sólo del tag.
    clave: new Request(url.origin + PREVIO_CIRCUITO_PATH + '?tag=' + tag, { method: 'GET' }),
  };
  let guardada = null;
  if (d.cache) { try { guardada = await d.cache.match(d.clave); } catch (_) { guardada = null; } }
  if (guardada) {
    const ok = guardada.headers.get(OK) !== '0';
    const generado = Number(guardada.headers.get(GENERADO)) || 0;
    const texto = await guardada.text();
    if (d.now() - generado <= (ok ? PREVIO_FRESCO_S : PREVIO_ERROR_S) * 1000) return paraServir(texto, ok, 'HIT');
    // Copia vieja (más de 15 min, o de 1 min si fue un fallo): sale ya y se renueva detrás.
    const renovar = generar(tag, d, { conservarBuena: ok }).catch(() => {});
    if (d.waitUntil) d.waitUntil(renovar);
    return paraServir(texto, ok, 'STALE');
  }
  const nuevo = await generar(tag, d);
  return paraServir(nuevo.texto, nuevo.ok, 'MISS');
}
