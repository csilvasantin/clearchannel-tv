// «créame demo de <cliente>»: los puntos con circuit demo_<cliente> se segmentan solos por cliente.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../cliente-segmento.js');

test('demo_<cliente> se asigna al cliente sin tocar ALIAS', () => {
  const loc = {id: 'lenovo-demo-madrid', circuit: 'demo_lenovo', name: 'Lenovo Demo · Madrid Gran Vía'};
  assert.equal(S.clienteDe(loc), 'lenovo');
  assert.equal(S.visible(loc, 'lenovo'), true);
  assert.equal(S.visible(loc, 'starbucks'), false);
  assert.equal(S.clienteDe({id: 'x', circuit: 'demo_el_corte'}), 'el-corte');
});

test('los puntos demo no se cuelan en Starbucks ni en Altadis', () => {
  const list = [{id: 'lenovo-demo-london', circuit: 'demo_lenovo'}, {id: 'alsea-sbux-001', circuit: 'alsea_starbucks'}];
  assert.deepEqual(S.filtrar(list, 'starbucks').map(l => l.id), ['alsea-sbux-001']);
  assert.deepEqual(S.filtrar(list, 'lenovo').map(l => l.id), ['lenovo-demo-london']);
});

test('app.js define circuitos demo genéricos y los saca de retail', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /function isDemoCircuitLocation\(loc\)/);
  assert.match(src, /\.\.\.demoDefs,/);
  assert.match(src, /\.filter\(l => !isDemoCircuitLocation\(l\)\)/);
});

test('app.js stamps demo twin xpaceUrl from loc.twin (admira.store)', () => {
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /function stampDemoTwin\(loc\)/);
  assert.match(src, /LOCATIONS\.forEach\(stampDemoTwin\)/);
  assert.match(src, /digital_twin:'Gemelo Digital'/);
  assert.match(src, /digital_twin:'Digital Twin'/);
});
