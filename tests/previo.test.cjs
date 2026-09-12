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

test('localStorage round trip and export JSON', () => {
  const store = new Map();
  const storage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
  assert.equal(P.storageKey('alcampo-breton'), 'admira.previo.quad.alcampo-breton');
  assert.equal(P.readLocal('alcampo-breton', storage), null);
  P.writeLocal('alcampo-breton', { quad: [[0,0],[1,0],[1,1],[0,1]], orientacion: 'vertical' }, storage);
  assert.equal(P.readLocal('alcampo-breton', storage).orientacion, 'vertical');
  P.writeLocal('alcampo-breton', null, storage);
  assert.equal(P.readLocal('alcampo-breton', storage), null);
  const json = JSON.parse(P.exportPrevio({ id: 'alcampo-breton' }, { quad: [[0,0],[1,0],[1,1],[0,1]], local: true }));
  assert.equal(json.id, 'alcampo-breton');
  assert.equal('local' in json.previo, false);
});

test('player URL carries the stream flags only for the embedded player', () => {
  assert.equal(P.playerUrl('alcampo-breton'), 'https://admira.tv/canal.html?clean=1&screen=alcampo-breton&circuit=alcampo&muted=1&playerType=virtual&stream=1');
  assert.equal(P.playerUrl('alcampo-breton', { stream: false }), 'https://admira.tv/canal.html?clean=1&screen=alcampo-breton&circuit=alcampo&muted=1');
});
