const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../global-tour.js');
const V = require('../vision-general.js');
const C = require('../expert-commands.js');
const root = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/circuitos/circuito-alsea-mexico-10.seed.json'), 'utf8'));
const loc = {id: 'x', surfaces: [{name: 'a'}, {name: 'b'}, {name: 'c'}]};
const conn = map => (l, s) => map[s.name];

test('semáforo de un Xpacio: verde, amarillo, rojo y gris sin datos', () => {
  assert.equal(V.storeHealth(loc, conn({a: 'online', b: 'online', c: 'online'})).state, 'ok');
  assert.equal(V.storeHealth(loc, conn({a: 'online', b: 'offline', c: 'online'})).state, 'incidencia');
  assert.equal(V.storeHealth(loc, conn({a: 'online', b: 'online', c: 'online'}), 1).state, 'incidencia');
  assert.equal(V.storeHealth(loc, conn({a: 'offline', b: 'offline', c: 'offline'})).state, 'apagado');
  const none = V.storeHealth(loc, () => 'unknown');
  assert.deepEqual([none.state, none.real], ['sin_datos', false]);
});

test('Alsea México sin telemetría: estados de DEMO fijos (7 OK, 2 con incidencia, 1 apagado) y marcados', () => {
  const h = V.circuitHealth(seed, () => 'unknown', null);
  assert.equal(h.demo, true);
  assert.deepEqual(h.totals, {ok: 7, incidencia: 2, apagado: 1, sin_datos: 0});
  // Repetible: la misma tienda sale siempre igual.
  const again = V.circuitHealth(seed, () => 'unknown', null);
  for (const l of seed) assert.equal(again.byId.get(l.id).state, h.byId.get(l.id).state, l.id);
  for (const s of h.byId.values()) assert.equal(s.demo, true);
  // Con menos de 4 Xpacios, todos en verde.
  assert.deepEqual(V.circuitHealth(seed.slice(0, 3), () => 'unknown', null).totals, {ok: 3, incidencia: 0, apagado: 0, sin_datos: 0});
});

test('en cuanto hay un dato real, manda la telemetría y no hay demo', () => {
  const h = V.circuitHealth(seed, (l, s) => (l.id === seed[0].id ? 'online' : 'unknown'), null);
  assert.equal(h.demo, false);
  assert.equal(h.byId.get(seed[0].id).state, 'ok');
  assert.equal(h.byId.get(seed[1].id).state, 'sin_datos');
  const fc = V.pointsData(seed, h);
  assert.equal(fc.features.length, 10);
  assert.equal(fc.features[0].properties.color, V.COLORS.ok);
  assert.equal(fc.features[1].properties.color, V.COLORS.sin_datos);
});

test('/vision general alsea abre Alsea México y avisa cuando los estados son de demo', () => {
  const calls = [];
  const ctx = {vision: id => { calls.push(id); return {ok: true, count: 10, totals: {ok: 7, incidencia: 2, apagado: 1, sin_datos: 0}, demo: true}; }};
  for (const cmd of ['/vision general alsea', '/visión general Alsea', 'vision alsea', '/vision-general alsea']) {
    const r = C.execute(cmd, ctx, 'es');
    assert.equal(r.ok, true, cmd);
    assert.equal(r.command, '/vision general starbucks-mexico', cmd);
  }
  assert.deepEqual([...new Set(calls)], ['alsea_mexico']);
  const line = C.execute('/vision general alsea', ctx, 'es').lines[0];
  assert.match(line, /Visión general de Starbucks México \(Alsea\) · 10 Xpacios: 7 OK · 2 con incidencia · 1 apagados \(DEMO: estados simulados/);
  assert.match(C.execute('/vision general alsea', ctx, 'en').lines[0], /overview · 10 Xpaces: 7 OK · 2 with issues · 1 off \(DEMO/);
});

test('/vision general: enlace ?ax_cmd, fuera de la portada y rutina de un clic', () => {
  assert.equal(C.linkedCommand('?ax_cmd=vision-general-alsea'), '/vision general alsea');
  assert.equal(C.linkedCommand('?ax_cmd=vision-alsea'), '/vision general alsea');
  assert.equal(C.linkedCommand('?ax_cmd=vision-general-alsea;parar'), null);
  const opened = [];
  const away = C.execute('/vision general alsea', {handoff: () => {}, open: url => { opened.push(url); return {ok: true}; }}, 'es');
  assert.equal(away.ok, true);
  assert.deepEqual(opened, ['/?ax_cmd=vision%20general%20starbucks-mexico&lang=es']);
  assert.equal(C.linkedCommand('?ax_cmd=' + encodeURIComponent('vision general starbucks-mexico')), '/vision general starbucks mexico');
  assert.equal(C.resolveDoohClient('starbucks mexico').id, 'starbucks-mexico');
  assert.ok(C.defaultRoutines('es').some(r => r.label === 'Visión general Alsea México' && r.command === '/vision general alsea'));
});

test('el panel registra /vision en el motor común y la página carga el módulo', () => {
  const panel = fs.readFileSync(path.join(root, 'expert-panel.js'), 'utf8');
  assert.match(panel, /registerAdapter\(\{id:'biz-vision',verbs:\[\{name:'vision',alias:\['visión'/);
  assert.match(panel, /vision\(circuitId\) \{\s*const r = ctx\.circuit\(circuitId\);[\s\S]*?startVisionGeneral\(circuitId\)/);
  assert.match(panel, /stopVisionGeneral\(\)/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('vision-general.js?v=') > 0 && html.indexOf('vision-general.js?v=') < html.lastIndexOf('app.js?v='));
  assert.match(fs.readFileSync(path.join(root, 'server/biz-assets.mjs'), 'utf8'), /'vision-general\.js'/);
});
