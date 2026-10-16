const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../global-tour.js');
const GT = globalThis.GlobalTour;
const root = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/circuitos/circuito-alsea-mexico-10.seed.json'), 'utf8'))
  .sort((a, b) => a.tourOrder - b.tourOrder);
const cfg = GT.config('alsea_mexico');

test('Alsea México: 10 Starbucks del seed, uno por estado, todos con parada en el tour global', () => {
  assert.equal(seed.length, 10);
  assert.equal(new Set(seed.map(l => l.province)).size, 10);
  assert.ok(cfg);
  assert.deepEqual(Object.keys(cfg.stops).sort(), seed.map(l => l.id).sort());
  assert.equal(new Set(Object.values(cfg.stops).map(s => s.state)).size, 10);
  assert.equal(seed[0].city, 'Tijuana');
  assert.equal(seed[9].city, 'Cancún');
});

test('solo los circuitos declarados tienen tour global', () => {
  assert.equal(GT.config('alsea_starbucks'), null);
  assert.equal(GT.config('__proto__'), null);
  assert.equal(GT.config('toString'), null);
});

test('la ficha de la puerta: lugar, estado, calle corta, tienda y alcance', () => {
  const info = GT.stopInfo(cfg, seed[5], 'es');
  assert.equal(info.place, 'Madero');
  assert.equal(info.state, 'Ciudad de México');
  assert.equal(info.street, 'Madero 42 · Centro Histórico');
  assert.equal(info.storeId, '38487');
  // Desde DCL-97f84ae3e5b2cb2311c55101 cada tienda lleva un formato de Altadis (CDMX: GÓNDOLA LED, 1 pantalla).
  assert.equal(info.format, 'GONDOLA LED LIMITS-006');
  assert.equal(info.screens, 1);
  assert.equal(info.impressions, 1550);
  // Sin entrada en la config se cae a los datos del catálogo.
  const bare = GT.stopInfo(null, {id:'x', name:'Solo', addr:'Calle 1 · Ciudad', province:'JAL', surfaces:[]}, 'en');
  assert.deepEqual([bare.place, bare.state, bare.short, bare.street, bare.lang], ['Solo', 'JAL', 'JAL', 'Calle 1', 'en']);
});

test('totales del circuito y formato de cifras por idioma', () => {
  assert.deepEqual(GT.totals(seed), {stores:10, states:10, screens:22, impressions:15500});
  assert.equal(GT.formatCount(15500, 'es'), '15,5 K');
  assert.equal(GT.formatCount(15500, 'en'), '15.5 K');
  assert.equal(GT.formatCount(700, 'es'), '700');
});

test('el encuadre global abarca de Tijuana a Cancún', () => {
  const [[w, s], [e, n]] = GT.bounds(seed);
  assert.equal(w, -117.018754);
  assert.equal(e, -86.80794);
  assert.equal(n, 32.527349);
  assert.equal(s, 17.078757);
  assert.equal(GT.bounds([]), null);
});

test('los arcos salen y llegan exactamente a las tiendas', () => {
  const a = seed[0].coords, b = seed[1].coords;
  const line = GT.arc(a, b, 10);
  assert.equal(line.length, 11);
  assert.deepEqual(line[0], a);
  assert.deepEqual(line[10].map(v => +v.toFixed(9)), b.map(v => +v.toFixed(9)));
  // Curva, no recta: el punto medio se separa del segmento.
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  assert.ok(Math.hypot(line[5][0] - mid[0], line[5][1] - mid[1]) > 0.5);
});

test('la ruta recorrida crece parada a parada y la pendiente va siempre entera', () => {
  const kinds = fc => fc.features.map(f => f.properties.kind);
  const done = fc => fc.features.find(f => f.properties.kind === 'done');
  assert.deepEqual(kinds(GT.routeData(seed, 0)), ['pending']);
  const first = done(GT.routeData(seed, 1)).geometry.coordinates;
  assert.deepEqual(first[0], seed[0].coords);
  assert.deepEqual(first.at(-1).map(v => +v.toFixed(9)), seed[1].coords.map(v => +v.toFixed(9)));
  const half = done(GT.routeData(seed, 1.5)).geometry.coordinates;
  assert.ok(half.length > first.length);
  const all = done(GT.routeData(seed, 9)).geometry.coordinates;
  assert.deepEqual(all.at(-1).map(v => +v.toFixed(9)), seed[9].coords.map(v => +v.toFixed(9)));
  // Sin puntos repetidos en las juntas de los tramos.
  for (let i = 1; i < all.length; i++) assert.notDeepEqual(all[i], all[i - 1]);
  assert.deepEqual(done(GT.routeData(seed, 99)).geometry.coordinates, all);
});

test('paradas: hecha, actual y siguiente; la etiqueta no repite ciudad y estado', () => {
  const fc = GT.stopsData(cfg, seed, 5, 'es');
  assert.deepEqual(fc.features.map(f => f.properties.status),
    ['done', 'done', 'done', 'done', 'done', 'current', 'next', 'next', 'next', 'next']);
  assert.equal(fc.features[5].properties.rank, 0);
  assert.equal(fc.features[0].properties.label, 'Tijuana\nBaja California');
  assert.equal(fc.features[5].properties.label, 'Ciudad de México');
  assert.equal(fc.features[7].properties.label, 'Oaxaca');
  assert.equal(fc.features[4].properties.label, 'Querétaro');
  // Al terminar, todas hechas.
  assert.ok(GT.stopsData(cfg, seed, seed.length, 'es').features.every(f => f.properties.status === 'done'));
});

test('a pie de puerta: la tienda en el centro, calle e inclinación solo en 3D', () => {
  const cam = GT.doorCamera(cfg, seed[2], 2, true);
  assert.deepEqual(cam.center, seed[2].coords);
  assert.equal(cam.zoom, 18.2);
  assert.equal(cam.pitch, 60);
  assert.equal(GT.doorCamera(cfg, seed[2], 2, false).pitch, 0);
  assert.notEqual(GT.doorCamera(cfg, seed[3], 3, true).bearing, cam.bearing);
});

test('Biz publica el módulo y la página lo carga antes de app.js', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const assets = fs.readFileSync(path.join(root, 'server/biz-assets.mjs'), 'utf8');
  assert.ok(html.indexOf('global-tour.js?v=') > 0 && html.indexOf('global-tour.js?v=') < html.indexOf('app.js?v='));
  assert.match(html, /global-tour\.css\?v=/);
  for (const file of ['global-tour.js', 'global-tour.css', 'circuit-overview.js']) assert.ok(assets.includes(`'${file}'`), file);
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /beginGlobalTour\(items\)/);
  assert.match(app, /watchGlobalTourDeepLink\(c\)/);
});

test('«Mis demos» de Biz lleva la demo de Alsea México: la release copia la sesión de demo de HEAD', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build-biz-release.mjs'), 'utf8');
  assert.match(build, /copyFileSync\(join\(root, 'server\/demo-session\.mjs'\), join\(out, 'server\/demo-session\.mjs'\)\)/);
  const session = fs.readFileSync(path.join(root, 'server/demo-session.mjs'), 'utf8');
  assert.match(session, /circuit: 'alsea_mexico'/);
});
