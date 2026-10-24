// GET /api/previo/circuito (FLT-102666 · encargo #7145): la primera pieza del Stock con póster para un hashtag, cacheada
// en el borde porque el Stock tarda ~22 s. Sólo GET/HEAD, sólo tags [a-z0-9_-]{1,40}, sólo stock/list con type=video.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePrevioCircuito, resumenStock, esPrevioCircuito, PREVIO_TAG, PREVIO_FRESCO_S, STOCK_LIST } from '../server/previo-circuito.mjs';
import worker from '../_worker.js';

const PIEZAS = { items: [
  { id: 'sin-poster', title: 'Sin póster', tags: ['alcampo'], url: 'https://api.admira.store/stock/asset/sin-poster' },
  { id: 'h1', title: 'Langostino · 16:9', tags: ['alcampo', 'horizontal'], poster: 'https://api.admira.store/stock/poster/h1', url: 'https://api.admira.store/stock/asset/h1?v=1' },
  { id: 'v1', title: 'Pan', tags: ['alcampo', 'vertical'], thumbnail: 'https://stock.admira.store/stock/v1/poster.jpg', url: 'https://api.admira.store/stock/asset/v1' },
  { id: 'http', title: 'Inseguro', tags: ['vertical'], poster: 'http://inseguro.example/p.jpg' },
], total: 4 };

// Cache API de mentira (match/put por URL) y un Stock que cuenta las llamadas.
function cacheFalsa() {
  const datos = new Map();
  return { datos, async match(req) { const r = datos.get(req.url); return r ? r.clone() : undefined; }, async put(req, res) { datos.set(req.url, res.clone()); } };
}
function stock(payload = PIEZAS, status = 200) {
  const llamadas = [];
  const fetchImpl = async (url, init) => { llamadas.push({ url, init }); if (status === 'red') throw new Error('red'); return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }); };
  return { llamadas, fetchImpl };
}
const pedir = (tag, deps, host = 'www.admira.biz', method = 'GET') => handlePrevioCircuito(new Request('https://' + host + '/api/previo/circuito' + (tag == null ? '' : '?tag=' + tag), { method }), deps);

test('resumenStock: primera pieza con póster https (poster o thumbnail) y la primera vertical/horizontal', () => {
  const r = resumenStock(PIEZAS, 'alcampo');
  assert.equal(r.ok, true); assert.equal(r.tag, 'alcampo'); assert.equal(r.piezas, 2, 'la de http:// y la sin póster no cuentan');
  assert.equal(r.poster, 'https://api.admira.store/stock/poster/h1');
  assert.equal(r.video, 'https://api.admira.store/stock/asset/h1?v=1');
  assert.equal(r.title, 'Langostino · 16:9');
  assert.equal(r.vertical.poster, 'https://stock.admira.store/stock/v1/poster.jpg');
  assert.equal(r.horizontal.poster, 'https://api.admira.store/stock/poster/h1');
  assert.deepEqual(resumenStock({ items: [] }, 'correos'), { ok: true, tag: 'correos', poster: null, video: null, title: null, vertical: null, horizontal: null, piezas: 0 });
  assert.equal(resumenStock(null, 'x').poster, null);
});

test('tag válido: pregunta al Stock una vez (stock/list?tag=…&type=video) y responde con caché pública', async () => {
  const s = stock(), cache = cacheFalsa();
  const r = await pedir('alcampo', { fetchImpl: s.fetchImpl, cache, now: () => 1000 });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=300, s-maxage=' + PREVIO_FRESCO_S);
  assert.equal(r.headers.get('x-previo-cache'), 'MISS');
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.poster, 'https://api.admira.store/stock/poster/h1');
  assert.deepEqual(s.llamadas.map(l => l.url), [STOCK_LIST + '?tag=alcampo&type=video'], 'sólo stock/list, con el tag y type=video');
  assert.equal(cache.datos.size, 1, 'queda en la Cache API');
});

test('tag inválido: 400 sin tocar el Stock (ni la caché); tampoco hay proxy de otras rutas ni métodos', async () => {
  for (const tag of [null, '', 'Alcampo', 'alc ampo', '..%2Fx', 'a'.repeat(41), 'alcampo%26type%3Dimage', 'x/y']) {
    const s = stock(), cache = cacheFalsa();
    const r = await pedir(tag, { fetchImpl: s.fetchImpl, cache });
    assert.equal(r.status, 400, String(tag)); assert.deepEqual(await r.json(), { ok: false, error: 'tag_invalido' });
    assert.equal(s.llamadas.length, 0); assert.equal(cache.datos.size, 0);
  }
  assert.ok(PREVIO_TAG.test('altadis_espana') && PREVIO_TAG.test('jti-xtanco') && PREVIO_TAG.test('a'.repeat(40)));
  const s = stock();
  const post = await pedir('alcampo', { fetchImpl: s.fetchImpl, cache: null }, 'www.admira.biz', 'POST');
  assert.equal(post.status, 405); assert.equal(s.llamadas.length, 0);
});

test('caché: la segunda visita sale de la Cache API (HIT) sin volver al Stock; la clave sólo depende del tag', async () => {
  const s = stock(), cache = cacheFalsa();
  let ahora = 10_000;
  await pedir('alcampo', { fetchImpl: s.fetchImpl, cache, now: () => ahora });
  ahora += 60_000;
  const r = await handlePrevioCircuito(new Request('https://www.admira.biz/api/previo/circuito?tag=alcampo&otra=cosa'), { fetchImpl: s.fetchImpl, cache, now: () => ahora });
  assert.equal(r.headers.get('x-previo-cache'), 'HIT');
  assert.equal((await r.json()).poster, 'https://api.admira.store/stock/poster/h1');
  assert.equal(s.llamadas.length, 1, 'el Stock sólo se consultó una vez');
  assert.equal([...cache.datos.keys()][0], 'https://www.admira.biz/api/previo/circuito?tag=alcampo');
});

test('a los 15 min la copia sale al instante (STALE) y se renueva por detrás con waitUntil', async () => {
  const s = stock(), cache = cacheFalsa(), pendientes = [];
  let ahora = 0;
  await pedir('alcampo', { fetchImpl: s.fetchImpl, cache, now: () => ahora });
  ahora = (PREVIO_FRESCO_S + 1) * 1000;
  const r = await pedir('alcampo', { fetchImpl: s.fetchImpl, cache, now: () => ahora, waitUntil: p => pendientes.push(p) });
  assert.equal(r.headers.get('x-previo-cache'), 'STALE');
  assert.equal((await r.json()).poster, 'https://api.admira.store/stock/poster/h1');
  assert.equal(pendientes.length, 1); await Promise.all(pendientes);
  assert.equal(s.llamadas.length, 2, 'la renovación vuelve al Stock');
  const fresca = await pedir('alcampo', { fetchImpl: s.fetchImpl, cache, now: () => ahora + 1000 });
  assert.equal(fresca.headers.get('x-previo-cache'), 'HIT');
});

test('si al renovar el Stock falla, la copia buena no se pisa', async () => {
  const bien = stock(), cache = cacheFalsa(), pendientes = [];
  await pedir('alcampo', { fetchImpl: bien.fetchImpl, cache, now: () => 0 });
  const mal = stock(null, 503);
  await pedir('alcampo', { fetchImpl: mal.fetchImpl, cache, now: () => (PREVIO_FRESCO_S + 5) * 1000, waitUntil: p => pendientes.push(p) });
  await Promise.all(pendientes);
  assert.equal(mal.llamadas.length, 1);
  const r = await pedir('alcampo', { fetchImpl: mal.fetchImpl, cache, now: () => (PREVIO_FRESCO_S + 6) * 1000 });
  assert.equal((await r.json()).poster, 'https://api.admira.store/stock/poster/h1');
});

test('sin pieza con póster: {ok:true, poster:null}; Stock caído: {ok:false} y caché corta', async () => {
  const vacio = stock({ items: [{ id: 'x', title: 'Sin póster' }], total: 1 });
  const r = await pedir('correos', { fetchImpl: vacio.fetchImpl, cache: cacheFalsa(), now: () => 0 });
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.poster, null); assert.equal(j.tag, 'correos');
  for (const status of [500, 'red']) {
    const caido = stock(null, status);
    const e = await pedir('mango', { fetchImpl: caido.fetchImpl, cache: cacheFalsa(), now: () => 0 });
    const k = await e.json();
    assert.equal(k.ok, false); assert.equal(k.poster, null);
    assert.equal(e.headers.get('cache-control'), 'public, max-age=60', 'un fallo no se recuerda 15 min');
  }
});

test('dos visitas a la vez con la caché vacía: una sola consulta al Stock y dos respuestas legibles', async () => {
  let soltar; const espera = new Promise(r => { soltar = r; });
  const llamadas = [];
  const fetchImpl = async url => { llamadas.push(url); await espera; return new Response(JSON.stringify(PIEZAS)); };
  const a = pedir('jti', { fetchImpl, cache: null }), b = pedir('jti', { fetchImpl, cache: null });
  soltar();
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(llamadas.length, 1);
  assert.equal((await ra.json()).poster, (await rb.json()).poster);
});

test('el worker lo sirve sólo en admira.biz, su vista previa y local; en las otras caras sigue el camino de siempre', async () => {
  for (const h of ['admira.biz', 'www.admira.biz', 'abc.clearchannel-tv.pages.dev', 'localhost', '127.0.0.1']) assert.equal(esPrevioCircuito(new URL('https://' + h + '/api/previo/circuito?tag=x')), true, h);
  for (const h of ['www.clearchannel.tv', 'www.admira.app', 'admira.biz.example.com']) assert.equal(esPrevioCircuito(new URL('https://' + h + '/api/previo/circuito?tag=x')), false, h);
  assert.equal(esPrevioCircuito(new URL('https://www.admira.biz/api/previo/circuitos?tag=x')), false);
  // Por el worker: un tag inválido ya responde el módulo (400 JSON), sin pasar por los assets.
  const env = { ASSETS: { fetch: () => { throw new Error('no debe llegar a los assets'); } } };
  const r = await worker.fetch(new Request('https://www.admira.biz/api/previo/circuito?tag=NO'), env, { waitUntil() {} });
  assert.equal(r.status, 400);
  const otra = await worker.fetch(new Request('https://www.clearchannel.tv/api/previo/circuito?tag=alcampo'), { ASSETS: { fetch: () => new Response('portada', { headers: { 'content-type': 'text/plain' } }) } });
  assert.equal(await otra.text(), 'portada', 'clearchannel.tv no estrena ruta');
});
