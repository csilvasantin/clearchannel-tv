// Altadis España · 10 Xtancos (DCL-a6cb621be0ce5932f50960de, Carlos, 16-oct-2026): la demo de Alsea México con
// otro cliente y su marca blanca. Semilla, índice público, fichas del mapa, enlaces, Tour DooH, visión general,
// comandos del modo experto y segmentación. La demo de Alsea México y el circuito altadis_bcn no cambian.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ficheros, ESTANCOS, idDe, mapaUrl, gemeloUrl, RUTA_SEED, RUTA_INDICE } from '../tools/genera-altadis-espana.mjs';
import { BIZ_ASSET_FILES, bizAssetPath } from '../server/biz-assets.mjs';
import worker from '../_worker.js';

const require = createRequire(import.meta.url);
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const json = f => JSON.parse(read(f));
require('../global-tour.js');
const GT = globalThis.GlobalTour;
const V = require('../vision-general.js');
const C = require('../expert-commands.js');
const S = require('../cliente-segmento.js');
const seed = json(RUTA_SEED);
const indice = json(RUTA_INDICE);

// El reparto de formatos que pidió Carlos, en orden de tour.
const ORDEN = [
  ['A Coruña', 'cliente-07', 'TABLET'], ['Bilbao', 'cliente-17', 'VIDEOWALL 8X1 H'], ['Barcelona', 'cliente-01', 'VERTICAL'],
  ['Zaragoza', 'cliente-16', 'VIDEOWALL 4X1 V'], ['Madrid', 'cliente-08', 'LED CUBO MADRID-062'],
  ['València', 'cliente-10', 'GONDOLA LED LIMITS-006'], ['Palma', 'cliente-13', 'VIDEOWALL 2X1 V'],
  ['Sevilla', 'cliente-18', 'SHUTTLE STRETCH'], ['Málaga', 'cliente-12', 'VIDEOWALL 1X2 V'], ['Granada', 'cliente-09', 'LED GRANADA-021'],
];

test('semilla: 10 estancos reales, uno por ciudad, en orden de tour y con el formato Altadis asignado', () => {
  assert.equal(seed.length, 10);
  seed.forEach((l, i) => {
    const [ciudad, formato, nombre] = ORDEN[i];
    assert.equal(l.tourOrder, i + 1);
    assert.equal(l.city, ciudad);
    assert.equal(l.formato, formato);
    assert.equal(l.espacio, 'altadis-xtanco-' + formato.slice(-2));
    assert.match(l.id, new RegExp(`^altadis-es-${String(i + 1).padStart(2, '0')}-[a-z-]+$`));
    assert.equal(l.kind, 'Estanco · Xtanco Altadis · ' + nombre);
    assert.equal(l.circuit, 'altadis_espana');
    assert.equal(l.country, 'ES');
    assert.deepEqual([l.external.brand, l.external.sponsor, l.external.network], ['Estanco', 'Altadis', 'altadis estancos espana']);
    assert.match(l.external.source, /^openstreetmap shop=tobacco/);
    assert.match(l.osm.id, /^node\/\d+$/);
    assert.equal(l.external.url, 'https://www.openstreetmap.org/' + l.osm.id);
    assert.ok(Array.isArray(l.coords) && l.coords.length === 2 && l.coords.every(Number.isFinite));
    // Península y Baleares.
    assert.ok(l.coords[0] > -9.5 && l.coords[0] < 4.5 && l.coords[1] > 36 && l.coords[1] < 44, l.id);
    assert.match(l.addr, /^.+ · \d{5} .+$/);
  });
  assert.equal(new Set(seed.map(l => l.city)).size, 10);
  assert.equal(new Set(seed.map(l => l.province)).size, 10);
  assert.equal(new Set(seed.map(l => l.formato)).size, 10);
});

test('Barcelona es el estanco real de altadis-bcn-001 (Estanc Gran de Gràcia 61)', () => {
  const bcn = json('data/circuitos/circuito-altadis-bcn-9.seed.json').find(l => l.id === 'altadis-bcn-001');
  const es = seed.find(l => l.city === 'Barcelona');
  assert.equal(es.name, bcn.name);
  assert.deepEqual(es.coords, bcn.coords);
  assert.equal(es.osm.id, bcn.osm.id);
  assert.equal(es.addr, bcn.addr);
});

test('ningún estanco sale del circuito de JTI, competidor de Altadis (encargo #4969)', () => {
  const jti = json('data/circuitos/circuito-jti-xtanco-100.seed.json');
  const csv = read('data/circuitos/xtancos-100.csv');
  const metros = (a, b) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * 110540);
  for (const l of seed) {
    assert.doesNotMatch(JSON.stringify(l), /jti/i, l.id);
    assert.ok(!jti.some(j => j.osm && j.osm.id === l.osm.id), l.id);
    assert.ok(!csv.includes(l.osm.id.split('/')[1]), l.id);
    const cerca = Math.min(...jti.map(j => metros(l.coords, j.coords)));
    assert.ok(cerca > 100, `${l.id} está a ${Math.round(cerca)} m de un estanco de JTI`);
  }
});

test('las pantallas de cada estanco son las de su plano compartido, no inventadas', () => {
  for (const l of seed) {
    const plano = json(`data/xpacios/${l.espacio}.json`);
    assert.equal(plano.formato.id, l.formato);
    assert.equal(l.surfaces.length, plano.pantallas.length, l.id);
    l.surfaces.forEach((s, i) => {
      const p = plano.pantallas[i];
      assert.deepEqual([s.name, s.pantalla, s.w, s.h, s.orient, s.formato, s.itil], [p.nombre, p.id, p.resolucion[0], p.resolucion[1], p.orientacion, l.formato, null]);
      assert.equal(s.surface, p.montaje === 'escaparate' ? 'escaparate' : 'pantalla');
    });
    // 700 impactos/día estimados por estanco (marcado en _nota: no es una medida).
    assert.equal(l.surfaces.reduce((n, s) => n + s.impr, 0), 700);
    assert.match(l._nota, /estimados/);
    assert.equal(l.plano, `https://www.admira.biz/data/xpacios/${l.espacio}.json`);
  }
  assert.equal(seed.reduce((n, l) => n + l.surfaces.length, 0), 22);
});

test('gemelo de admira.store por estanco, abierto al pulsar el punto', () => {
  for (const l of seed) {
    const twin = `https://www.admira.store/xpacios/altadis-18/?espacio=${l.espacio}&loc=${l.id}&marca=altadis`;
    assert.equal(l.twin, twin);
    assert.equal(l.xpaceUrl, twin);
    assert.equal(l.twinOnClick, true);
  }
  require('../xpace-link.js');
  const nav = globalThis.XpaceLinks.panelNavigation(seed[4]);
  assert.deepEqual([nav.kind, nav.href, nav.labelKey], ['xpacio', seed[4].xpaceUrl, 'digital_twin']);
});

test('índice público admira.circuito-demo/1 con el contrato exacto', () => {
  assert.deepEqual(Object.keys(indice), ['schema', 'circuito', 'cliente', 'marca', 'locales']);
  assert.deepEqual([indice.schema, indice.circuito, indice.cliente, indice.marca], ['admira.circuito-demo/1', 'altadis_espana', 'Altadis', 'altadis']);
  assert.equal(indice.locales.length, 10);
  indice.locales.forEach((x, i) => {
    const l = seed[i];
    assert.deepEqual(Object.keys(x), ['id', 'nombre', 'direccion', 'ciudad', 'coords', 'tourOrder', 'formato', 'espacio', 'mapa']);
    assert.deepEqual([x.id, x.nombre, x.direccion, x.ciudad, x.coords, x.tourOrder, x.formato, x.espacio], [l.id, l.name, l.addr, l.city, l.coords, l.tourOrder, l.formato, l.espacio]);
    assert.equal(x.mapa, `https://www.admira.biz/?circuit=altadis_espana&loc=${l.id}&marca=altadis`);
  });
});

test('semilla, índice y locations.js salen del generador (node tools/genera-altadis-espana.mjs --comprobar)', () => {
  for (const { ruta, texto } of ficheros()) assert.equal(read(ruta), texto, ruta);
  assert.equal(ESTANCOS.length, 10);
  assert.equal(mapaUrl(idDe(ESTANCOS[4])), 'https://www.admira.biz/?circuit=altadis_espana&loc=altadis-es-05-madrid&marca=altadis');
  assert.equal(gemeloUrl(ESTANCOS[4]), 'https://www.admira.store/xpacios/altadis-18/?espacio=altadis-xtanco-08&loc=altadis-es-05-madrid&marca=altadis');
});

test('las 10 fichas viajan en locations.js y sobreviven al catálogo del KV sin tocarlo', () => {
  const ctx = vm.createContext({ window: {}, localStorage: { getItem: () => null } });
  vm.runInContext(read('locations.js'), ctx);
  const extra = ctx.window.OMNIP_LOCATIONS_EXTRA.filter(l => /^altadis-es-/.test(l.id));
  assert.deepEqual(JSON.parse(JSON.stringify(extra)), seed);
  const merged = ctx.window.mergeOmnipLocations([{ id: 'otro', name: 'Otro', coords: [0, 0], surfaces: [] }]);
  const ids = merged.map(l => l.id);
  for (const l of seed) assert.ok(ids.includes(l.id), l.id);
  const madrid = merged.find(l => l.id === 'altadis-es-05-madrid');
  assert.equal(madrid.xpaceUrl, seed[4].xpaceUrl);
  assert.equal(madrid.circuit, 'altadis_espana');
});

test('app.js: circuito propio, fuera de Xtanco Nacional, de JTI y de Altadis BCN', () => {
  const app = read('app.js');
  const start = app.indexOf('function normText'), end = app.indexOf('function isAlcampoLocation');
  const ctx = vm.createContext({ LOCATIONS: [] });
  vm.runInContext(app.slice(start, end), ctx);
  for (const l of seed) {
    assert.equal(ctx.isAltadisEspanaLocation(l), true, l.id);
    assert.equal(ctx.isEstancoLocation(l), false, l.id);
    assert.equal(ctx.isJtiXtancoLocation(l), false, l.id);
    assert.equal(ctx.isAltadisBcnLocation(l), false, l.id);
  }
  // altadis_bcn sigue igual.
  for (const l of json('data/circuitos/circuito-altadis-bcn-9.seed.json')) assert.equal(ctx.isAltadisEspanaLocation(l), false, l.id);
  for (const scope of ['all', 'national']) {
    const list = app.match(new RegExp(`\\b${scope}: \\[([^\\]]+)\\]`))[1];
    assert.match(list, /'alsea_mexico', 'altadis_espana'/, scope);
  }
  assert.match(app, /circuit_altadis_espana:'Altadis España · Xtancos \(10\)'/);
  assert.match(app, /circuit_altadis_espana:'Altadis Spain · Xtancos \(10\)'/);
  assert.match(app, /altadis_espana: \{\s*label: t\('circuit_altadis_espana'\),\s*items: altadisEspanaItems/);
  assert.match(app, /altadis_espana:\{name:'Altadis España',theme:'admira',color:'#F47920'\}/);
  assert.match(read('index.html'), /<option value="altadis_espana" data-i18n="circuit_altadis_espana">Altadis España · Xtancos \(10\)<\/option>/);
});

test('enlace profundo ?circuit=altadis_espana&loc=<id>: centra el estanco y abre su ficha una sola vez', () => {
  const app = read('app.js');
  const fn = app.slice(app.indexOf('function applyCircuitDeepLink'), app.indexOf('function watchCircuitDeepLink'));
  assert.match(fn, /const locId = circuitLocParam\(\);/);
  assert.match(fn, /def\.items\.find\(l => l\.id === locId\)/);
  assert.match(fn, /circuitLocDone = true; flyToLocation\(target\);/);
  assert.match(fn, /else if \(!locId \|\| !circuitLocDone\) zoomToSelectedCircuit\(\);/);
  assert.match(app, /function circuitLocParam\(\) \{\s*try \{ return new URLSearchParams\(location\.search \|\| ''\)\.get\('loc'\) \|\| ''; \}/);
  // flyToLocation abre la ficha (renderPanel + panel abierto) al aterrizar.
  assert.match(app, /async function flyToLocation[\s\S]*?renderPanel\(loc\);\s*panel\.classList\.add\('open'\);/);
});

test('la ficha del estanco abre su plano compartido (plano.html?locationId=altadis-xtanco-NN) junto al gemelo', () => {
  const app = read('app.js');
  const src = app.slice(app.indexOf('function planoPageUrl'), app.indexOf('\n}', app.indexOf('function planoPageUrl')) + 2);
  const ctx = vm.createContext({ LANG: 'es' });
  vm.runInContext(src, ctx);
  assert.equal(ctx.planoPageUrl(seed[1]), '/plano.html?locationId=altadis-xtanco-17&lang=es');
  assert.equal(ctx.planoPageUrl({ plano: 'https://evil.example/data/xpacios/x.json' }), '');
  assert.equal(ctx.planoPageUrl({}), '');
  assert.match(read('index.html'), /<a id="p-plano" hidden target="_blank" rel="noopener" data-i18n="view_plano">▤ Plano del Xpacio ↗<\/a>/);
  assert.match(app, /view_plano:'▤ Plano del Xpacio ↗'/);
  assert.match(app, /view_plano:'▤ Xpace floor plan ↗'/);
  // El laboratorio, que ya va al plano con su botón especial, no lo repite.
  assert.match(app, /pPlano\.hidden = !planoHref \|\| !!\(navigation && \/\\\/plano\\\.html\\b\/\.test\(navigation\.href\)\);/);
});

test('Tour DooH global de Altadis: España entera y la puerta de cada estanco, con la marca de Altadis', () => {
  const cfg = GT.config('altadis_espana');
  assert.ok(cfg);
  assert.deepEqual([cfg.accent, cfg.deep], ['#F47920', '#3C3126']);
  assert.deepEqual(Object.keys(cfg.stops), seed.map(l => l.id));
  for (const l of seed) assert.equal(cfg.stops[l.id].format, json(`data/xpacios/${l.espacio}.json`).formato.nombre, l.id);
  assert.deepEqual(seed.map(l => cfg.stops[l.id].short), ['LCG', 'BIO', 'BCN', 'ZAZ', 'MAD', 'VLC', 'PMI', 'SVQ', 'AGP', 'GRX']);
  assert.deepEqual(GT.totals(seed), { stores: 10, states: 10, screens: 22, impressions: 7000 });
  assert.deepEqual([GT.text(cfg, 'es').stores, GT.text(cfg, 'es').states, GT.text(cfg, 'en').states], ['Xtancos', 'ciudades', 'cities']);
  // Alsea México sigue con sus textos de serie; desde DCL-97f84ae3e5b2cb2311c55101 lleva el verde de la casa de Starbucks.
  const alsea = GT.config('alsea_mexico');
  assert.deepEqual([GT.text(alsea, 'es').stores, GT.text(alsea, 'es').states], ['Starbucks', 'estados']);
  assert.notEqual(alsea.bg.top, cfg.bg.top);
  const info = GT.stopInfo(cfg, seed[1], 'es');
  assert.deepEqual([info.state, info.short, info.format, info.screens, info.impressions], ['País Vasco', 'BIO', 'VIDEOWALL 8X1 H', 8, 700]);
  const [[w, s], [e, n]] = GT.bounds(seed);
  assert.deepEqual([w, e], [-8.398132, 2.6528323]);
  assert.deepEqual([s, n], [36.7191336, 43.3706048]);
  const css = read('global-tour.css');
  assert.match(css, /var\(--gt-bg-top,rgba\(0,34,24,\.93\)\)/);
  assert.match(css, /background:var\(--gt-bg-card,rgba\(3,18,13,\.93\)\)/);
});

test('visión general de Altadis: semáforo por estanco con incidencias de estanco (DEMO marcada)', () => {
  const h = V.circuitHealth(seed, () => 'unknown', null, 'altadis_espana');
  assert.equal(h.demo, true);
  assert.deepEqual(h.totals, { ok: 7, incidencia: 2, apagado: 1, sin_datos: 0 });
  const issues = [...h.byId.values()].filter(x => x.issue).map(x => x.issue.es);
  assert.equal(issues.length, 2);
  for (const t of issues) assert.doesNotMatch(t, /menu board|recogida/i);
  // Sin circuito las incidencias de demo siguen siendo las de serie; Starbucks México (DCL-97f84ae3e5b2cb2311c55101)
  // reparte los mismos estados con incidencias que no hablan de menu board ni de recogida.
  const alsea = json('data/circuitos/circuito-alsea-mexico-10.seed.json');
  const before = V.circuitHealth(alsea, () => 'unknown', null);
  const now = V.circuitHealth(alsea, () => 'unknown', null, 'alsea_mexico');
  assert.deepEqual([...now.byId.entries()].map(([id, x]) => [id, x.state]), [...before.byId.entries()].map(([id, x]) => [id, x.state]));
  assert.ok([...before.byId.values()].some(x => x.issue && /recogida|menu board/i.test(x.issue.es)));
  assert.equal(V.pointsData(seed, h).features.length, 10);
});

test('modo experto: cliente altadis con sus alias, sin pisar a JTI ni a Alsea', () => {
  for (const alias of ['altadis', 'Altadis', 'altadis españa', 'Altadis España', 'xtancos altadis', 'altadis_espana', 'ALTADIS ESPANA']) {
    assert.equal(C.resolveClient(alias)?.id, 'altadis', alias);
  }
  assert.equal(C.resolveDoohClient('altadis').id, 'altadis');
  assert.equal(C.resolveDoohClient('xtanco').id, 'jti', '«xtanco» es la enseña de JTI: nunca va a Altadis');
  assert.equal(C.resolveDoohClient('jti').id, 'jti');
  assert.equal(C.resolveDoohClient('').id, 'starbucks-mexico');
  assert.equal(C.resolveDoohClient('alsea').id, 'starbucks-mexico');
  const client = C.CLIENTS.find(c => c.id === 'altadis');
  assert.deepEqual([client.circuit, client.marca, client.featured], ['altadis_espana', 'altadis', true]);
});

test('/demo dooh altadis y /vision general altadis van siempre con marca=altadis', () => {
  const calls = [];
  const onBrand = { segmento: () => 'altadis', open: () => assert.fail('con la marca puesta no se recarga'),
    dooh: id => { calls.push(['dooh', id]); return { ok: true, count: 10, global: true }; },
    vision: id => { calls.push(['vision', id]); return { ok: true, count: 10, totals: { ok: 7, incidencia: 2, apagado: 1, sin_datos: 0 }, demo: true }; } };
  const tour = C.execute('/demo dooh altadis', onBrand, 'es');
  assert.equal(tour.ok, true);
  assert.equal(tour.command, '/demo dooh altadis');
  assert.match(tour.lines[0], /^Tour DooH de Altadis España · Xtancos · 10 Xpacios: del país entero a la puerta de cada uno\./);
  const overview = C.execute('/vision general altadis', onBrand, 'es');
  assert.match(overview.lines[0], /^Visión general de Altadis España · Xtancos · 10 Xpacios: 7 OK · 2 con incidencia · 1 apagados \(DEMO/);
  assert.deepEqual(calls, [['dooh', 'altadis_espana'], ['vision', 'altadis_espana']]);
  // En el mapa sin la marca (Admira u otra): se relanza en la portada con ?marca=altadis.
  const opened = [];
  const offBrand = { segmento: () => null, open: url => { opened.push(url); return { ok: true }; }, dooh: () => assert.fail('no en local'), vision: () => assert.fail('no en local') };
  assert.equal(C.execute('/demo dooh altadis', offBrand, 'es').ok, true);
  assert.equal(C.execute('/vision general altadis', offBrand, 'en').ok, true);
  // Fuera de la portada (handoff), igual.
  const away = { handoff: () => {}, open: url => { opened.push(url); return { ok: true }; } };
  C.execute('/demo dooh altadis', away, 'es');
  assert.deepEqual(opened, [
    '/?circuit=altadis_espana&tour=1&lang=es&marca=altadis',
    '/?ax_cmd=vision%20general%20altadis&lang=en&marca=altadis',
    '/?circuit=altadis_espana&tour=1&lang=es&marca=altadis',
  ]);
  // Alsea México va ahora con la marca de Starbucks (DCL-97f84ae3e5b2cb2311c55101): nunca con la de Altadis.
  const alseaOpened = [];
  C.execute('/demo dooh alsea', { handoff: () => {}, open: url => { alseaOpened.push(url); return { ok: true }; } }, 'es');
  assert.deepEqual(alseaOpened, ['/?circuit=alsea_mexico&tour=1&lang=es&marca=starbucks']);
  const local = [];
  C.execute('/demo dooh alsea', { segmento: () => 'starbucks', open: () => assert.fail('con su marca no recarga'), dooh: id => { local.push(id); return { ok: true, count: 10, global: true }; } }, 'es');
  assert.deepEqual(local, ['alsea_mexico']);
  const fromAltadis = [];
  C.execute('/demo dooh alsea', { segmento: () => 'altadis', open: url => { fromAltadis.push(url); return { ok: true }; }, dooh: () => assert.fail('con Altadis puesta se recarga') }, 'es');
  assert.deepEqual(fromAltadis, ['/?circuit=alsea_mexico&tour=1&lang=es&marca=starbucks']);
});

test('enlaces ?ax_cmd, rutinas de un clic y ayuda de Altadis', () => {
  assert.equal(C.linkedCommand('?ax_cmd=demo-dooh-altadis&marca=altadis'), '/demo dooh altadis');
  assert.equal(C.linkedCommand('?ax_cmd=vision-general-altadis&marca=altadis'), '/vision general altadis');
  const routines = C.defaultRoutines('es');
  assert.deepEqual(routines.slice(0, 4).map(r => r.command), ['/demo dooh starbucks', '/vision general starbucks', '/demo dooh altadis', '/vision general altadis']);
  assert.ok(routines.some(r => r.label === 'Tour DooH Altadis España'));
  assert.ok(C.defaultRoutines('en').some(r => r.label === 'Overview Altadis Spain'));
  assert.ok(C.helpLines('es').some(l => /\/demo dooh altadis/.test(l) && /marca=altadis/.test(l)));
  const panel = read('expert-panel.js');
  assert.match(panel, /segmento\(\) \{ try \{ return root\.AdmiraSegmento \? root\.AdmiraSegmento\.actual\(\) : null; \}/);
});

test('segmentación: ?marca=altadis enseña los 10 Xtancos (y Altadis BCN), nunca JTI', () => {
  for (const l of seed) assert.equal(S.clienteDe(l), 'altadis', l.id);
  const jti = json('data/circuitos/circuito-jti-xtanco-100.seed.json').slice(0, 5);
  const bcn = json('data/circuitos/circuito-altadis-bcn-9.seed.json').slice(0, 2);
  const visibles = S.filtrar([...seed, ...jti, ...bcn], 'altadis').map(l => l.id);
  assert.deepEqual(visibles, [...seed, ...bcn].map(l => l.id));
  assert.deepEqual(S.filtrar(seed, 'jti'), []);
  for (const v of ['altadis', 'Altadis España', 'xtancos altadis']) assert.equal(S.resolver(v), 'altadis', v);
  assert.equal(S.decidir('?circuit=altadis_espana&loc=altadis-es-05-madrid&marca=altadis', null), 'altadis');
});

test('Biz publica el índice (CORS de lectura) y la segmentación; clearchannel.tv no los recibe', async () => {
  for (const f of ['data/xpacios/altadis-espana-10.json', 'cliente-segmento.js', 'locations.js', 'global-tour.js', 'vision-general.js', 'expert-commands.js', 'app.js', 'index.html', 'backoffice.html']) {
    assert.ok(BIZ_ASSET_FILES.includes(f), f);
  }
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/data/xpacios/altadis-espana-10.json')), '/__admira_biz/data/xpacios/altadis-espana-10.json');
  assert.equal(bizAssetPath(new URL('https://www.clearchannel.tv/data/xpacios/altadis-espana-10.json')), '');
  const env = { ASSETS: { fetch(request) {
    const path = new URL(request.url).pathname;
    return path === '/__admira_biz/data/xpacios/altadis-espana-10.json'
      ? new Response(read(RUTA_INDICE), { headers: { 'content-type': 'application/json' } })
      : new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
  } } };
  const r = await worker.fetch(new Request('https://www.admira.biz/data/xpacios/altadis-espana-10.json', { headers: { Origin: 'https://www.admira.store' } }), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal((await r.json()).circuito, 'altadis_espana');
  const cc = await worker.fetch(new Request('https://www.clearchannel.tv/data/xpacios/altadis-espana-10.json'), env);
  assert.equal(cc.status, 404);
});

test('con ?marca=altadis nada recoloca la cámara mientras vuela el tour o el enlace profundo', () => {
  const app = read('app.js');
  // El encuadre de la marca no pisa un tour, la visión general ni un vuelo en curso…
  assert.match(app, /function fitBrandSegment\(\) \{[\s\S]*?if \(circuitDemo\.running \|\| tourRun \|\| visionGeneral \|\| tourCamera\.isNavigating\(\)\) return;/);
  // …ni se lanza al cargar si el enlace ya lleva la cámara (?circuit, ?loc, ?locationId, ?ax_cmd, ?previo).
  assert.match(app, /\['circuit', 'loc', 'locationId', 'ax_cmd', 'previo'\]\.some\(k => q\.has\(k\)\)/);
  assert.match(app, /if \(window\.AdmiraSegmento && window\.AdmiraSegmento\.actual\(\) && !brandDeepLinked\(\)\)/);
  // La bola de la intro tampoco salta encima de un vuelo (cancelaba la primera parada del tour).
  assert.match(read('intro.js'), /map\.getZoom\(\) < 3 && !map\.isMoving\(\)\) map\.jumpTo/);
  assert.match(read('index.html'), /intro\.js\?v=20261016-altadis-es-1/);
});

test('ficha de la puerta: «1 pantalla DooH» en singular', () => {
  assert.deepEqual([GT.text(null, 'es').screen, GT.text(null, 'en').screen], ['pantalla DooH', 'DooH screen']);
  assert.match(read('global-tour.js'), /s\.screens === 1 \? L\.screen : L\.screens/);
});

test('encargo #4969: xtanco, xtancos, estanco, estancos y cualquier prefijo xtanc… o estanc… nunca llevan a Altadis', () => {
  // DCL-97f84ae3e5b2cb2311c55101: tras el PR #92, «/demo dooh xtancos» casaba por prefijo con el alias «xtancos altadis».
  const esperado = { xtanco: 'jti', xtancos: 'jti', Xtancos: 'jti', estanco: 'estancos', estancos: 'estancos', ESTANCOS: 'estancos', estanc: 'estancos', 'xtanco nacional': 'estancos' };
  for (const [typed, id] of Object.entries(esperado)) {
    assert.equal(C.resolveClient(typed)?.id, id, `cliente ${typed}`);
    assert.equal(C.resolveDoohClient(typed)?.id, id, `dooh ${typed}`);
  }
  // Los prefijos ambiguos entre JTI y Xtanco Nacional siguen sin resolverse, como antes de #92; y ninguno da Altadis.
  for (const typed of ['xtanc', 'xtan', 'xtancos a', 'xtancos alt', 'xtancosaltadi', 'estancos al', 'estancos altadi', 'xtanco_', 'estanc-']) {
    assert.notEqual(C.resolveClient(typed)?.id, 'altadis', typed);
    assert.notEqual(C.resolveDoohClient(typed)?.id, 'altadis', typed);
    assert.ok(!C.clientCandidates(typed).includes('altadis'), `Tab ${typed}`);
  }
  for (const pre of ['xta', 'xtan', 'xtanc', 'xtanco', 'xtancos', 'est', 'esta', 'estan', 'estanc', 'estanco', 'estancos']) {
    assert.notEqual(C.resolveDoohClient(pre)?.id, 'altadis', pre);
  }
  // /demo dooh y /vision general: JTI o Xtanco Nacional, nunca el circuito de Altadis.
  const calls = [];
  const ctx = { segmento: () => null, open: url => { calls.push(['open', url]); return { ok: true }; },
    dooh: id => { calls.push(['dooh', id]); return { ok: true, count: 10, global: false }; },
    vision: id => { calls.push(['vision', id]); return { ok: true, count: 10, totals: { ok: 10, incidencia: 0, apagado: 0, sin_datos: 0 }, demo: true }; } };
  for (const typed of ['xtanco', 'xtancos', 'estanco', 'estancos', 'estanc', 'xtanc']) {
    C.execute('/demo dooh ' + typed, ctx, 'es');
    C.execute('/vision general ' + typed, ctx, 'es');
  }
  assert.ok(calls.length >= 10);
  for (const [, target] of calls) assert.doesNotMatch(String(target), /altadis/, JSON.stringify(calls));
  assert.deepEqual([...new Set(calls.map(c => c[1]))].sort(), ['estancos', 'jti_xtanco']);
  assert.match(C.execute('/demo dooh xtanc', ctx, 'es').lines[0], /Cliente no reconocido: «xtanc»/);
  // Altadis se sigue pidiendo por su nombre (y por sus alias enteros, que dicen «altadis»).
  for (const typed of ['altadis', 'Altadis España', 'altadis xtancos', 'xtancos altadis', 'estancos altadis', 'alt']) {
    assert.equal(C.resolveDoohClient(typed)?.id, 'altadis', typed);
  }
});
