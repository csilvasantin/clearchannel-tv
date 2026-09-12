const {test} = require('node:test');
const assert = require('node:assert/strict');
const P = require('../previo.js');

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('validQuad accepts clockwise TL,TR,BR,BL and rejects crossed, degenerate or out-of-range corners', () => {
  assert.equal(P.validQuad([[.2,.2],[.8,.2],[.8,.8],[.2,.8]]), true);
  assert.equal(P.validQuad([[.2,.2],[.8,.8],[.8,.2],[.2,.8]]), false);   // cruzado
  assert.equal(P.validQuad([[.2,.2],[.2,.2],[.2,.2],[.2,.2]]), false);   // degenerado
  assert.equal(P.validQuad([[.2,.2],[1.2,.2],[.8,.8],[.2,.8]]), false);  // fuera de 0..1
  assert.equal(P.validQuad([[.2,.2],[.8,.2],[.8,.8]]), false);           // 3 puntos
  assert.equal(P.validQuad(null), false);
});

test('quadMatrix maps the player corners exactly onto the target quad', () => {
  const w = 540, h = 960;
  const d = [[100, 80], [400, 120], [380, 700], [90, 650]];
  const m = P.quadMatrix(w, h, d);
  assert.equal(m.length, 16);
  [[0,0],[w,0],[w,h],[0,h]].forEach(([x,y], i) => {
    const [X, Y] = P.applyMatrix(m, x, y);
    assert.ok(near(X, d[i][0], 1e-3) && near(Y, d[i][1], 1e-3), `corner ${i}: ${X},${Y} vs ${d[i]}`);
  });
});

test('quadMatrix is the identity when the quad equals the player rectangle', () => {
  const m = P.quadMatrix(960, 540, [[0,0],[960,0],[960,540],[0,540]]);
  const id = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  m.forEach((v, i) => assert.ok(near(v, id[i]), `m[${i}]=${v}`));
});

test('quadMatrix throws on a degenerate panel', () => {
  assert.throws(() => P.quadMatrix(540, 960, [[0,0],[0,0],[0,0],[0,0]]));
});

test('fitRect letterboxes like object-fit:contain', () => {
  const r = P.fitRect(1000, 500, 400, 300);   // foto 4:3 en escenario 2:1 → limita la altura
  assert.ok(near(r.h, 500) && near(r.w, 666.6666667) && near(r.x, 166.6666667) && near(r.y, 0));
  const v = P.fitRect(500, 1000, 400, 300);   // limita el ancho
  assert.ok(near(v.w, 500) && near(v.h, 375) && near(v.y, 312.5) && near(v.x, 0));
  assert.equal(P.fitRect(0, 0, 400, 300).w, 0);
});

test('screenTransform picks the player size by orientation and scales the quad to the rendered photo', () => {
  const previo = { quad: [[.25,.25],[.75,.25],[.75,.75],[.25,.75]], orientacion: 'horizontal' };
  const css = P.screenTransform(previo, { w: 800, h: 600 });
  assert.match(css, /^matrix3d\(/);
  const m = css.slice(9, -1).split(',').map(Number);
  const [X, Y] = P.applyMatrix(m, 960, 540);           // BR del player horizontal
  assert.ok(near(X, 600, 1e-2) && near(Y, 450, 1e-2));
  assert.deepEqual(P.playerSize('vertical'), [540, 960]);
  assert.deepEqual(P.playerSize('horizontal'), [960, 540]);
  assert.deepEqual(P.playerSize(undefined), [540, 960]);
  assert.equal(P.screenTransform({ quad: null }, { w: 800, h: 600 }), '');
});

test('local adjustment overrides the KV quad and orientation but keeps the KV image', () => {
  const loc = { id: 'alcampo-breton', previo: { imagen: 'https://admira.tv/api/previo/alcampo-breton.jpg', w: 1600, h: 900, quad: [[.1,.1],[.4,.1],[.4,.6],[.1,.6]], orientacion: 'vertical', tipo: 'real', fuente: 'streetview', confianza: .8 } };
  const kvOnly = P.effectivePrevio(loc, null);
  assert.equal(kvOnly.local, false);
  assert.deepEqual(kvOnly.quad, loc.previo.quad);
  const local = { quad: [[.2,.2],[.5,.2],[.5,.7],[.2,.7]], orientacion: 'horizontal' };
  const eff = P.effectivePrevio(loc, local);
  assert.equal(eff.local, true);
  assert.equal(eff.imagen, loc.previo.imagen);
  assert.deepEqual(eff.quad, local.quad);
  assert.equal(eff.orientacion, 'horizontal');
  assert.equal(eff.fuente, 'ajuste-manual');
  assert.equal(P.effectivePrevio({ id: 'x' }, null), null);                        // sin previo
  assert.ok(P.effectivePrevio({ id: 'x' }, { imagen: 'https://a/b.jpg', w: 10, h: 10 }));  // mock local
  const bad = P.effectivePrevio({ id: 'x', previo: { imagen: 'https://a/b.jpg', quad: [[0,0],[0,0],[0,0],[0,0]] } }, null);
  assert.equal(P.validQuad(bad.quad), true);                                       // quad de respaldo
});

test('localStorage keys are per view; round trip works', () => {
  const store = new Map();
  const storage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
  assert.equal(P.storageKey('alcampo-breton'), 'admira.previo.quad.alcampo-breton');
  assert.equal(P.storageKey('alcampo-breton', 'fachada'), 'admira.previo.quad.alcampo-breton');
  assert.equal(P.storageKey('alcampo-breton', 'detalle'), 'admira.previo.quad.alcampo-breton.detalle');
  assert.equal(P.storageKey('alcampo-breton', 'interior-1'), 'admira.previo.quad.alcampo-breton.interior-1');
  assert.equal(P.readLocal('alcampo-breton', 'fachada', storage), null);
  P.writeLocal('alcampo-breton', 'fachada', { quad: [[0,0],[1,0],[1,1],[0,1]], orientacion: 'vertical' }, storage);
  P.writeLocal('alcampo-breton', 'detalle', { quad: [[.1,.1],[.9,.1],[.9,.9],[.1,.9]], orientacion: 'horizontal' }, storage);
  assert.equal(P.readLocal('alcampo-breton', 'fachada', storage).orientacion, 'vertical');
  assert.equal(P.readLocal('alcampo-breton', 'detalle', storage).orientacion, 'horizontal');
  P.writeLocal('alcampo-breton', 'fachada', null, storage);
  assert.equal(P.readLocal('alcampo-breton', 'fachada', storage), null);
  assert.equal(P.readLocal('alcampo-breton', 'detalle', storage).orientacion, 'horizontal');
});

const KV = { id: 'alcampo-breton', previo: {
  imagen: 'https://admira.tv/api/previo/alcampo-breton.jpg', w: 1600, h: 900, quad: [[.4,.5],[.5,.5],[.5,.8],[.4,.8]], tipo: 'virtual', orientacion: 'vertical', confianza: 'media', fuente: 'streetview',
  detalle: { imagen: 'https://admira.tv/api/previo/alcampo-breton-detalle.jpg', w: 1200, h: 900, quad: [[.2,.1],[.8,.1],[.8,.9],[.2,.9]], pano: { fecha: 'mar 2023' } },
  interior: [
    { imagen: 'https://admira.tv/api/previo/alcampo-breton-int1.jpg', w: 2000, h: 1000, quad: [[.6,.3],[.7,.3],[.7,.6],[.6,.6]], tipo: 'real', orientacion: 'horizontal', confianza: 'alta', nota: 'cajas' },
    { imagen: 'https://admira.tv/api/previo/alcampo-breton-int2.jpg', w: 2000, h: 1000, quad: [[.1,.3],[.2,.3],[.2,.6],[.1,.6]] },
  ],
} };

test('previoViews lists fachada, detalle and interiors in order, inheriting type/orientation from the storefront', () => {
  const views = P.previoViews(KV, () => null);
  assert.deepEqual(views.map(v => v.key), ['fachada', 'detalle', 'interior-1', 'interior-2']);
  const [f, d, i1, i2] = views;
  assert.equal(f.previo.imagen, KV.previo.imagen);
  assert.equal('detalle' in f.previo, false);
  assert.equal(d.previo.orientacion, 'vertical');          // heredada
  assert.equal(d.previo.confianza, 'media');
  assert.deepEqual(d.previo.quad, KV.previo.detalle.quad);
  assert.equal(i1.previo.tipo, 'real');
  assert.equal(i1.previo.orientacion, 'horizontal');
  assert.equal(i2.previo.orientacion, 'vertical');
  assert.deepEqual(P.previoViews({ id: 'x' }, () => null), []);
  assert.deepEqual(P.previoViews({ id: 'x', previo: { imagen: 'https://a/b.jpg', quad: KV.previo.quad } }, () => null).map(v => v.key), ['fachada']);
});

test('a local adjustment applies only to its own view and a local mock can add a view', () => {
  const locals = { 'detalle': { quad: [[.3,.3],[.7,.3],[.7,.7],[.3,.7]], orientacion: 'horizontal' } };
  const views = P.previoViews(KV, (id, view) => locals[view] || null);
  assert.equal(views[0].previo.local, false);
  assert.equal(views[1].previo.local, true);
  assert.equal(views[1].previo.orientacion, 'horizontal');
  assert.deepEqual(views[1].previo.quad, locals.detalle.quad);
  const mock = { 'interior-1': { imagen: 'https://mock/int.jpg', w: 10, h: 10, quad: [[.1,.1],[.9,.1],[.9,.9],[.1,.9]] } };
  const only = P.previoViews({ id: 'x', previo: { imagen: 'https://a/b.jpg', quad: KV.previo.quad } }, (id, view) => mock[view] || null);
  assert.deepEqual(only.map(v => v.key), ['fachada', 'interior-1']);
});

test('the tour walks fachada → detalle → interior-1 at 4 s each, or 8 s when there is only the storefront', () => {
  const views = P.previoViews(KV, () => null);
  assert.deepEqual(P.tourViews(views).map(v => v.key), ['fachada', 'detalle', 'interior-1']);
  assert.equal(P.tourDwell(views), 12000);
  assert.equal(P.tourDwell(views.slice(0, 2)), 8000);
  assert.equal(P.tourDwell(views.slice(0, 1)), 8000);
  assert.equal(P.tourDwell([]), 8000);
});

test('export JSON puts each view adjustment back in its place of the KV previo', () => {
  const locals = { 'fachada': { quad: [[.41,.51],[.49,.51],[.49,.79],[.41,.79]] }, 'interior-2': { quad: [[.15,.3],[.25,.3],[.25,.6],[.15,.6]], orientacion: 'horizontal' } };
  const views = P.previoViews(KV, (id, view) => locals[view] || null);
  const json = JSON.parse(P.exportPrevio(KV, KV.previo, views));
  assert.equal(json.id, 'alcampo-breton');
  assert.deepEqual(json.previo.quad, locals.fachada.quad);
  assert.equal(json.previo.fuente, 'ajuste-manual');
  assert.deepEqual(json.previo.detalle.quad, KV.previo.detalle.quad);
  assert.equal(json.previo.detalle.imagen, KV.previo.detalle.imagen);
  assert.deepEqual(json.previo.interior[1].quad, locals['interior-2'].quad);
  assert.equal(json.previo.interior[1].orientacion, 'horizontal');
  assert.equal(json.previo.interior[0].nota, 'cajas');
  assert.equal('local' in json.previo, false);
});

test('player URL: pseudostreaming (disco-primero, sin stream=1) y hashtag del circuito', () => {
  assert.equal(P.playerUrl('alcampo-breton'), 'https://admira.tv/canal.html?clean=1&screen=alcampo-breton&circuit=alcampo&muted=1&tag=alcampo');
  assert.equal(P.playerUrl('alcampo-breton', { stream: true }), 'https://admira.tv/canal.html?clean=1&screen=alcampo-breton&circuit=alcampo&muted=1&tag=alcampo&stream=1');
  assert.equal(P.playerUrl('x', { circuit: 'otro', tag: '' }), 'https://admira.tv/canal.html?clean=1&screen=x&circuit=otro&muted=1');
});

test('póster del Stock: primera pieza del hashtag con imagen https', () => {
  assert.equal(P.stockPosterUrl('alcampo'), 'https://api.admira.store/stock/list?tag=alcampo&type=video');
  assert.equal(P.firstPoster({ items: [{ id: 'a' }, { id: 'b', thumbnail: 'https://stock.admira.store/stock/b/poster.jpg' }] }), 'https://stock.admira.store/stock/b/poster.jpg');
  assert.equal(P.firstPoster({ items: [{ thumbnail: 'data:image/png;base64,x' }] }), '');
  assert.equal(P.firstPoster(null), '');
});
