// Starbucks México · Alsea · 10 estados (DCL-97f84ae3e5b2cb2311c55101, Carlos, 16-oct-2026): el Tour DooH de Alsea
// México al nivel del de Altadis España (tests/altadis-espana.test.mjs), con cliente Starbucks y su marca blanca.
// Semilla, índice público, fichas del mapa encima del KV, gemelo y plano por tienda, enlace profundo, Tour DooH,
// visión general, comandos del modo experto, tarjeta de Mis demos y publicación en Biz.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ficheros, CAFETERIAS, idDe, mapaUrl, gemeloUrl, GEMELO_MATRIX, RUTA_SEED, RUTA_INDICE } from '../tools/genera-alsea-mexico.mjs';
import { BIZ_ASSET_FILES, bizAssetPath } from '../server/biz-assets.mjs';
import { sessionFromClaims, GOOGLE_CLIENT_ID } from '../server/demo-session.mjs';
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

// Los 10 Starbucks reales de la semilla de septiembre, en su orden de tour, y el formato que pidió Carlos para cada uno.
const ORDEN = [
  ['alsea-mx-sbux-01-tijuana', 'Tijuana', 'cliente-07', 'TABLET'],
  ['alsea-mx-sbux-02-monterrey', 'Monterrey', 'cliente-17', 'VIDEOWALL 8X1 H'],
  ['alsea-mx-sbux-03-leon', 'León', 'cliente-01', 'VERTICAL'],
  ['alsea-mx-sbux-04-guadalajara', 'Guadalajara', 'cliente-16', 'VIDEOWALL 4X1 V'],
  ['alsea-mx-sbux-05-queretaro', 'Querétaro', 'cliente-08', 'LED CUBO MADRID-062'],
  ['alsea-mx-sbux-06-cdmx', 'Ciudad de México', 'cliente-10', 'GONDOLA LED LIMITS-006'],
  ['alsea-mx-sbux-07-puebla', 'Puebla', 'cliente-13', 'VIDEOWALL 2X1 V'],
  ['alsea-mx-sbux-08-oaxaca', 'Oaxaca', 'cliente-18', 'SHUTTLE STRETCH'],
  ['alsea-mx-sbux-09-merida', 'Mérida', 'cliente-12', 'VIDEOWALL 1X2 V'],
  ['alsea-mx-sbux-10-cancun', 'Cancún', 'cliente-09', 'LED GRANADA-021'],
];

test('semilla: los mismos 10 Starbucks reales, en el mismo orden, cada uno con su formato Altadis de cafetería', () => {
  assert.equal(seed.length, 10);
  seed.forEach((l, i) => {
    const [id, ciudad, formato, nombre] = ORDEN[i];
    assert.deepEqual([l.id, l.city, l.tourOrder, l.formato, l.espacio], [id, ciudad, i + 1, formato, 'altadis-cafe-' + formato.slice(-2)]);
    assert.equal(l.kind, 'Cafetería · Starbucks · Alsea México · ' + nombre);
    assert.deepEqual([l.circuit, l.country, l.music], ['alsea_mexico', 'MX', 'lounge']);
    assert.deepEqual([l.external.brand, l.external.operator, l.external.network], ['Starbucks', 'Alsea', 'starbucks mexico']);
    assert.match(l.external.storeId, /^\d{5}$/);
    assert.match(l.external.source, /^starbucks\.com\.mx store locator/);
    // La dirección fiscal del localizador se conserva tal cual; la ficha la escribe legible con su código postal.
    assert.match(l.external.addr, / · México$/);
    assert.match(l.addr, /^.+ · .+ · \d{5} .+$/);
    assert.ok(l.coords[0] > -118 && l.coords[0] < -86 && l.coords[1] > 14 && l.coords[1] < 33, l.id);
  });
  assert.equal(new Set(seed.map(l => l.province)).size, 10);
  assert.equal(new Set(seed.map(l => l.formato)).size, 10);
});

test('no cambian los puntos ni el orden del tour respecto a la semilla de septiembre (ids, nombres, coordenadas)', () => {
  const antes = {
    'alsea-mx-sbux-01-tijuana': ['Starbucks Tijuana · Plaza Río', [-117.018754, 32.527349], '38252'],
    'alsea-mx-sbux-06-cdmx': ['Starbucks CDMX · Madero', [-99.137403, 19.433649], '38487'],
    'alsea-mx-sbux-10-cancun': ['Starbucks Cancún · Puerto Cancún', [-86.80794, 21.160301], '38723'],
  };
  for (const [id, [name, coords, storeId]] of Object.entries(antes)) {
    const l = seed.find(x => x.id === id);
    assert.deepEqual([l.name, l.coords, l.external.storeId], [name, coords, storeId], id);
  }
  // El tour global sigue con las mismas paradas, en el mismo orden.
  assert.deepEqual(Object.keys(GT.config('alsea_mexico').stops), ORDEN.map(o => o[0]));
});

test('las pantallas de cada Starbucks son las del plano compartido de su formato en versión cafetería', () => {
  for (const l of seed) {
    const plano = json(`data/xpacios/${l.espacio}.json`);
    assert.equal(plano.espacio.tipo, 'cafe', l.id);
    assert.equal(plano.formato.id, l.formato);
    assert.equal(l.surfaces.length, plano.pantallas.length, l.id);
    l.surfaces.forEach((s, i) => {
      const p = plano.pantallas[i];
      assert.deepEqual([s.name, s.pantalla, s.w, s.h, s.orient, s.formato, s.itil, s.status], [p.nombre, p.id, p.resolucion[0], p.resolucion[1], p.orientacion, l.formato, null, 'sched']);
      assert.equal(s.surface, p.montaje === 'escaparate' ? 'escaparate' : 'pantalla');
      assert.equal(s.cpm, p.tecnologia === 'led' ? '€8' : '€6');
    });
    // 1.550 impactos/día estimados por cafetería (la plantilla de septiembre), marcados en _nota: no son una medida.
    assert.equal(l.surfaces.reduce((n, s) => n + s.impr, 0), 1550);
    assert.match(l._nota, /estimados/);
    assert.equal(l.plano, `https://www.admira.biz/data/xpacios/${l.espacio}.json`);
  }
  assert.equal(seed.reduce((n, l) => n + l.surfaces.length, 0), 22);
});

test('gemelo de admira.store por tienda con la marca Starbucks; el de Paseo de Gràcia 103 queda como secundario', () => {
  for (const l of seed) {
    const twin = `https://www.admira.store/xpacios/altadis-18/?espacio=${l.espacio}&loc=${l.id}&marca=starbucks`;
    assert.deepEqual([l.twin, l.xpaceUrl, l.twinOnClick], [twin, twin, true]);
    assert.deepEqual(l.twinAlt, { url: GEMELO_MATRIX, es: 'Gemelo Matrix · Paseo de Gràcia 103 ↗', en: 'Matrix twin · Paseo de Gràcia 103 ↗' });
    assert.equal(l.bundleWins, true);
  }
  assert.equal(GEMELO_MATRIX, 'https://www.admira.store/admira-xp/?quality=matrix&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks');
  assert.equal(new Set(seed.map(l => l.twin)).size, 10, 'ya no comparten el mismo gemelo');
  require('../xpace-link.js');
  const nav = globalThis.XpaceLinks.panelNavigation(seed[5]);
  assert.deepEqual([nav.kind, nav.href, nav.labelKey], ['xpacio', seed[5].xpaceUrl, 'digital_twin']);
});

test('índice público admira.circuito-demo/1 con el mismo contrato que el de Altadis', () => {
  assert.deepEqual(Object.keys(indice), ['schema', 'circuito', 'cliente', 'marca', 'locales']);
  assert.deepEqual([indice.schema, indice.circuito, indice.cliente, indice.marca], ['admira.circuito-demo/1', 'alsea_mexico', 'Starbucks (Alsea)', 'starbucks']);
  assert.deepEqual(Object.keys(indice), Object.keys(json('data/xpacios/altadis-espana-10.json')));
  assert.equal(indice.locales.length, 10);
  indice.locales.forEach((x, i) => {
    const l = seed[i];
    assert.deepEqual(Object.keys(x), ['id', 'nombre', 'direccion', 'ciudad', 'coords', 'tourOrder', 'formato', 'espacio', 'mapa']);
    assert.deepEqual([x.id, x.nombre, x.direccion, x.ciudad, x.coords, x.tourOrder, x.formato, x.espacio], [l.id, l.name, l.addr, l.city, l.coords, l.tourOrder, l.formato, l.espacio]);
    assert.equal(x.mapa, `https://www.admira.biz/?circuit=alsea_mexico&loc=${l.id}&marca=starbucks`);
  });
});

test('semilla, índice y locations.js salen del generador (node tools/genera-alsea-mexico.mjs --comprobar)', () => {
  for (const { ruta, texto } of ficheros()) assert.equal(read(ruta), texto, ruta);
  assert.equal(CAFETERIAS.length, 10);
  assert.equal(mapaUrl(idDe(CAFETERIAS[5])), 'https://www.admira.biz/?circuit=alsea_mexico&loc=alsea-mx-sbux-06-cdmx&marca=starbucks');
  assert.equal(gemeloUrl(CAFETERIAS[5]), 'https://www.admira.store/xpacios/altadis-18/?espacio=altadis-cafe-10&loc=alsea-mx-sbux-06-cdmx&marca=starbucks');
});

test('las 10 fichas viajan en locations.js y mandan sobre las de septiembre del KV y de la caché, sin tocar el KV', () => {
  const ctx = vm.createContext({ window: {}, localStorage: { getItem: () => null } });
  vm.runInContext(read('locations.js'), ctx);
  const w = ctx.window;
  const extra = w.OMNIP_LOCATIONS_EXTRA.filter(l => /^alsea-mx-/.test(l.id));
  assert.deepEqual(JSON.parse(JSON.stringify(extra)), seed);
  // La ficha del KV (3 superficies genéricas, gemelo de xpaceos) pierde frente a la del bundle.
  const kv = { id: 'alsea-mx-sbux-06-cdmx', name: 'Starbucks CDMX · Madero', kind: 'Cafetería · Starbucks · Alsea México', coords: [-99.137403, 19.433649],
    twin: 'https://www.xpaceos.com/admira-xp/?autostart=cafeteria&loc=alsea-mx-sbux-06-cdmx', xpaceUrl: null,
    surfaces: [{ name: 'Menu board digital', impr: 700 }, { name: 'Pantalla recogida', impr: 450 }, { name: 'Escaparate', impr: 400 }] };
  const merged = w.mergeOmnipLocations([kv, { id: 'otro', name: 'Otro', coords: [0, 0], surfaces: [] }]);
  assert.equal(merged.filter(l => /^alsea-mx-/.test(l.id)).length, 10);
  const cdmx = merged.find(l => l.id === 'alsea-mx-sbux-06-cdmx');
  assert.deepEqual([cdmx.kind, cdmx.formato, cdmx.surfaces.length, cdmx.xpaceUrl, cdmx.plano],
    [seed[5].kind, 'cliente-10', 1, seed[5].xpaceUrl, seed[5].plano]);
  assert.equal(merged.find(l => l.id === 'otro').name, 'Otro');
  // Cada fusión da copias: tocar una ficha del mapa no cambia el bundle.
  cdmx.surfaces.push({ name: 'x' });
  assert.equal(w.mergeOmnipLocations([kv]).find(l => l.id === 'alsea-mx-sbux-06-cdmx').surfaces.length, 1);
  // Altadis España no lleva bundleWins (no está en el KV) y sigue entrando igual.
  assert.ok(w.OMNIP_LOCATIONS_EXTRA.filter(l => /^altadis-es-/.test(l.id)).every(l => !l.bundleWins));
  assert.equal(merged.filter(l => /^altadis-es-/.test(l.id)).length, 10);
});

test('app.js: sin el gemelo compartido, el catálogo slim no pisa las fichas curadas y la ficha enseña el gemelo secundario', () => {
  const app = read('app.js');
  assert.doesNotMatch(app, /stampAlseaMexicoTwin|ALSEA_MEXICO_TWIN/);
  assert.match(app, /if \(cur && cur\.bundleWins\) return;/);
  const src = app.slice(app.indexOf('function twinAltLink'), app.indexOf('\n}', app.indexOf('function twinAltLink')) + 2);
  const ctx = vm.createContext({ LANG: 'es' });
  vm.runInContext(src, ctx);
  assert.deepEqual({ ...ctx.twinAltLink(seed[0]) }, { href: GEMELO_MATRIX, label: 'Gemelo Matrix · Paseo de Gràcia 103 ↗' });
  ctx.LANG = 'en';
  assert.equal(ctx.twinAltLink(seed[0]).label, 'Matrix twin · Paseo de Gràcia 103 ↗');
  assert.equal(ctx.twinAltLink({ twinAlt: { url: 'https://evil.example/x', es: 'x' } }), null);
  assert.equal(ctx.twinAltLink({ twinAlt: { url: 'javascript:alert(1)', es: 'x' } }), null);
  assert.equal(ctx.twinAltLink({}), null);
  assert.match(read('index.html'), /<div class="actions twin-alt-row" id="p-twin-alt-row" hidden><a id="p-twin-alt" hidden target="_blank" rel="noopener"><\/a><\/div>/);
  assert.match(app, /if \(row\) row\.hidden = !alt;/);
  assert.match(app, /pTwinAlt\.textContent = alt\.label;/);
  // ▤ Plano del Xpacio: el mismo de Altadis, con el plano de cafetería de su formato.
  const plano = app.slice(app.indexOf('function planoPageUrl'), app.indexOf('\n}', app.indexOf('function planoPageUrl')) + 2);
  const pctx = vm.createContext({ LANG: 'es' });
  vm.runInContext(plano, pctx);
  assert.equal(pctx.planoPageUrl(seed[1]), '/plano.html?locationId=altadis-cafe-17&lang=es');
  assert.match(app, /alsea_mexico:\{name:'Starbucks México',theme:'admira',color:'#00704a'\}/);
});

test('enlace profundo ?circuit=alsea_mexico&loc=<id>&marca=starbucks: el mismo mecanismo que Altadis, con la marca Starbucks', () => {
  const app = read('app.js');
  const fn = app.slice(app.indexOf('function applyCircuitDeepLink'), app.indexOf('function watchCircuitDeepLink'));
  assert.match(fn, /def\.items\.find\(l => l\.id === locId\)/);
  assert.match(fn, /circuitLocDone = true; flyToLocation\(target\);/);
  assert.equal(S.decidir('?circuit=alsea_mexico&loc=alsea-mx-sbux-06-cdmx&marca=starbucks', null), 'starbucks');
  // Con la marca Starbucks el globo enseña los 10 de México (Starbucks incluye Starbucks México) y nada más.
  for (const l of seed) assert.equal(S.clienteDe(l), 'starbucks-mexico', l.id);
  const altadis = json('data/circuitos/circuito-altadis-espana-10.seed.json').slice(0, 3);
  assert.deepEqual(S.filtrar([...seed, ...altadis], 'starbucks').map(l => l.id), seed.map(l => l.id));
});

test('Tour DooH: México entero y la puerta de cada Starbucks con su formato, pantallas e impactos, y la marca Starbucks', () => {
  const cfg = GT.config('alsea_mexico');
  assert.deepEqual(cfg.title, { es: 'Starbucks México · Alsea', en: 'Starbucks Mexico · Alsea' });
  assert.deepEqual([cfg.accent, cfg.deep], ['#00a862', '#00704a']);
  assert.equal(cfg.bg.top, 'rgba(30,57,50,.95)', 'verde de la casa de Starbucks (#1E3932)');
  for (const l of seed) assert.equal(cfg.stops[l.id].format, json(`data/xpacios/${l.espacio}.json`).formato.nombre, l.id);
  assert.deepEqual(GT.totals(seed), { stores: 10, states: 10, screens: 22, impressions: 15500 });
  const info = GT.stopInfo(cfg, seed[1], 'es');
  assert.deepEqual([info.state, info.short, info.storeId, info.format, info.screens, info.impressions], ['Nuevo León', 'NL', '38670', 'VIDEOWALL 8X1 H', 8, 1550]);
  // Ninguna parada con «0 pantallas DooH · 0 impactos/día».
  for (const l of seed) {
    const s = GT.stopInfo(cfg, l, 'es');
    assert.ok(s.screens > 0 && s.impressions > 0 && s.format, l.id);
  }
});

test('visión general de Starbucks México: semáforo de demo con incidencias que valen para cualquier formato', () => {
  const h = V.circuitHealth(seed, () => 'unknown', null, 'alsea_mexico');
  assert.equal(h.demo, true);
  assert.deepEqual(h.totals, { ok: 7, incidencia: 2, apagado: 1, sin_datos: 0 });
  const issues = [...h.byId.values()].filter(x => x.issue).map(x => x.issue.es);
  assert.equal(issues.length, 2);
  for (const t of issues) assert.doesNotMatch(t, /menu board|recogida|escaparate/i);
  assert.equal(V.pointsData(seed, h).features.length, 10);
});

test('modo experto: /demo dooh starbucks (y starbucks mexico, sbux, alsea) lanza lo mismo que /demo dooh alsea', () => {
  for (const alias of ['starbucks', 'Starbucks', 'starbucks mexico', 'Starbucks México', 'sbux', 'SBUX', 'alsea', 'alsea_mexico', 'starbucks-mexico']) {
    assert.equal(C.resolveDoohClient(alias)?.id, 'starbucks-mexico', alias);
  }
  // Starbucks España sigue siendo «starbucks espana» y /demo starbucks (sin dooh) no cambia.
  assert.equal(C.resolveDoohClient('starbucks espana').id, 'starbucks');
  assert.equal(C.resolveClient('starbucks').id, 'starbucks');
  const client = C.CLIENTS.find(c => c.id === 'starbucks-mexico');
  assert.deepEqual([client.circuit, client.marca, client.featured], ['alsea_mexico', 'starbucks', true]);
  const calls = [];
  const onBrand = { segmento: () => 'starbucks', open: () => assert.fail('con la marca puesta no se recarga'),
    dooh: id => { calls.push(['dooh', id]); return { ok: true, count: 10, global: true }; },
    vision: id => { calls.push(['vision', id]); return { ok: true, count: 10, totals: { ok: 7, incidencia: 2, apagado: 1, sin_datos: 0 }, demo: true }; } };
  for (const cmd of ['/demo dooh starbucks', '/demo dooh alsea', '/demo dooh sbux', '/demo dooh starbucks mexico']) {
    const r = C.execute(cmd, onBrand, 'es');
    assert.equal(r.ok, true, cmd);
    assert.equal(r.command, '/demo dooh starbucks-mexico', cmd);
    assert.match(r.lines[0], /^Tour DooH de Starbucks México \(Alsea\) · 10 Xpacios: del país entero a la puerta de cada uno\./, cmd);
  }
  assert.match(C.execute('/vision general starbucks', onBrand, 'es').lines[0], /^Visión general de Starbucks México \(Alsea\) · 10 Xpacios: 7 OK/);
  assert.deepEqual([...new Set(calls.map(c => c.join(':')))], ['dooh:alsea_mexico', 'vision:alsea_mexico']);
  // Sin la marca (Admira, Altadis) o fuera de la portada: se relanza en la portada con ?marca=starbucks.
  const opened = [];
  const offBrand = { segmento: () => null, open: url => { opened.push(url); return { ok: true }; }, dooh: () => assert.fail('no en local'), vision: () => assert.fail('no en local') };
  C.execute('/demo dooh starbucks', offBrand, 'es');
  C.execute('/vision general starbucks', { ...offBrand, segmento: () => 'altadis' }, 'en');
  C.execute('/demo dooh alsea', { handoff: () => {}, open: url => { opened.push(url); return { ok: true }; } }, 'es');
  assert.deepEqual(opened, [
    '/?circuit=alsea_mexico&tour=1&lang=es&marca=starbucks',
    '/?ax_cmd=vision%20general%20starbucks-mexico&lang=en&marca=starbucks',
    '/?circuit=alsea_mexico&tour=1&lang=es&marca=starbucks',
  ]);
});

test('enlaces ?ax_cmd, rutinas de un clic y ayuda de Starbucks', () => {
  assert.equal(C.linkedCommand('?ax_cmd=demo-dooh-starbucks'), '/demo dooh starbucks');
  assert.equal(C.linkedCommand('?ax_cmd=demo-dooh-starbucks&marca=starbucks'), '/demo dooh starbucks');
  assert.equal(C.linkedCommand('?ax_cmd=vision-general-starbucks&marca=starbucks'), '/vision general starbucks');
  assert.equal(C.linkedCommand('?ax_cmd=demo-dooh-alsea'), '/demo dooh alsea');
  const routines = C.defaultRoutines('es');
  assert.deepEqual(routines.slice(0, 2).map(r => [r.label, r.command]), [['Tour DooH Starbucks México', '/demo dooh starbucks'], ['Visión general Starbucks México', '/vision general starbucks']]);
  assert.deepEqual(C.defaultRoutines('en').slice(0, 2).map(r => r.label), ['DooH Tour Starbucks Mexico', 'Overview Starbucks Mexico']);
  assert.ok(C.helpLines('es').some(l => /\/demo dooh starbucks \(o alsea, sbux, starbucks mexico\)/.test(l) && /marca=starbucks/.test(l)));
  assert.ok(C.helpLines('en').some(l => /\/vision general starbucks/.test(l)));
  assert.match(read('help/index.html'), /starbucks-mexico \(Starbucks México · 10 estados, siempre con su marca: \/demo dooh starbucks/);
});

test('Mis demos: la tarjeta de Starbucks México lleva ?marca=starbucks, /demo dooh starbucks y el gemelo de CDMX', () => {
  const claims = { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', sub: 'u', exp: Date.now() / 1000 + 3600, email_verified: true, email: 'staff@admira.com' };
  const card = sessionFromClaims(claims).demos.find(d => d.id === 'alsea-mexico');
  assert.deepEqual([card.title, card.locationId, card.circuit, card.marca, card.command, card.overview],
    ['Starbucks México · Alsea · 10 estados', 'alsea-mx-sbux-06-cdmx', 'alsea_mexico', 'starbucks', '/demo dooh starbucks', '/vision general starbucks']);
  assert.equal(card.twinUrl, seed[5].xpaceUrl);
  // backoffice.html: la marca propia de la demo va en Ver ficha, Tour DooH y Visión general.
  assert.match(read('backoffice.html'), /const brand = '&marca=' \+ encodeURIComponent\(d\.marca \|\| 'off'\);/);
});

test('Biz publica el índice de Starbucks México (CORS de lectura); clearchannel.tv no lo recibe', async () => {
  for (const f of ['data/xpacios/alsea-mexico-10.json', 'locations.js', 'global-tour.js', 'vision-general.js', 'expert-commands.js', 'app.js', 'index.html', 'backoffice.html']) {
    assert.ok(BIZ_ASSET_FILES.includes(f), f);
  }
  for (const l of seed) assert.ok(BIZ_ASSET_FILES.includes(`data/xpacios/${l.espacio}.json`), l.espacio);
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/data/xpacios/alsea-mexico-10.json')), '/__admira_biz/data/xpacios/alsea-mexico-10.json');
  assert.equal(bizAssetPath(new URL('https://www.clearchannel.tv/data/xpacios/alsea-mexico-10.json')), '');
  const env = { ASSETS: { fetch(request) {
    const path = new URL(request.url).pathname;
    return path === '/__admira_biz/data/xpacios/alsea-mexico-10.json'
      ? new Response(read(RUTA_INDICE), { headers: { 'content-type': 'application/json' } })
      : new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
  } } };
  const r = await worker.fetch(new Request('https://www.admira.biz/data/xpacios/alsea-mexico-10.json', { headers: { Origin: 'https://www.admira.store' } }), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal((await r.json()).circuito, 'alsea_mexico');
  const cc = await worker.fetch(new Request('https://www.clearchannel.tv/data/xpacios/alsea-mexico-10.json'), env);
  assert.equal(cc.status, 404);
});

test('las páginas piden la versión nueva de lo que cambia', () => {
  // Cada fichero, con el sello de su último cambio (tours DooH del 16-oct, main en verde y portada sin WebGL del 17-oct).
  const html = read('index.html');
  assert.match(html, /vision-general\.js\?v=20261016-starbucks-es-1/);
  assert.ok(html.includes('global-tour.js?v=20261016-total-tour-1'), 'global-tour.js');
  // app.js y mapa-sin-webgl.js: portada sin WebGL (17-oct), el mapa mudo se carga antes que app.js. app.js cambió después
  // con el asistente Comercial (18-oct, 20261018-comercial-2), con la captación de comercios (comercial-3),
  // con «Anunciarme aquí» en la ficha (20-oct, comercial-5), con el handON del laboratorio (laboratorio-1)
  // y con ese handON en la zona protegida de admiranext.com (zona-protegida-1).
  // Después, con AdmiraXperience como proyecto de pantallas e hilo musical (22-oct, admiraxperience-1).
  assert.ok(html.includes('<script defer src="mapa-sin-webgl.js?v=20261017-sin-webgl-1"></script><script defer src="app.js?v=20261022-admiraxperience-1"></script>'));
  assert.match(html, /marca-blanca\.js\?v=20261016-starbucks-mx-2/);
  assert.match(html, /expert-commands\.js\?v=20261017-main-verde-1/);
  // locations.js cambió por última vez con la Sneaker Store en AdmiraXperience (22-oct): la portada y las fichas piden esa versión.
  for (const page of ['index.html', 'detail.html', 'walk.html', 'backoffice.html']) assert.match(read(page), /locations\.js\?v=20261022-admiraxperience-1/, page);
});

test('los enlaces de la suite común del Experto abren México con la marca Starbucks', () => {
  for (const [q, cmd] of [['?ax_cmd=demo-dooh-starbucks-mexico&marca=starbucks', '/demo dooh starbucks mexico'], ['?ax_cmd=vision-general-starbucks-mexico&marca=starbucks', '/vision general starbucks mexico']]) {
    assert.equal(C.linkedCommand(q), cmd, q);
    // expert-panel.js espera a que el circuito del cliente tenga puntos antes de enviar la orden.
    const client = C.resolveDoohClient(cmd.split(' ').slice(2).join(' '));
    assert.deepEqual([client.id, client.circuit, client.marca], ['starbucks-mexico', 'alsea_mexico', 'starbucks'], q);
    assert.equal(S.decidir(q, null), 'starbucks', q);
    // Con la marca del enlace puesta, la orden se ejecuta allí mismo (sin recargar) y sobre alsea_mexico.
    const calls = [];
    const r = C.execute(cmd, { segmento: () => 'starbucks', open: () => assert.fail('no recarga'),
      dooh: id => { calls.push(id); return { ok: true, count: 10, global: true }; },
      vision: id => { calls.push(id); return { ok: true, count: 10, totals: { ok: 7, incidencia: 2, apagado: 1, sin_datos: 0 }, demo: true }; } }, 'es');
    assert.equal(r.ok, true, q);
    assert.deepEqual(calls, ['alsea_mexico'], q);
  }
  // Desde d8453bd (16-oct-2026) el enlace también admite «/tour X»: ahí el cliente empieza en la segunda palabra.
  assert.match(read('expert-panel.js'), /C\.resolveDoohClient\(linked\.split\(' '\)\.slice\(linked\.startsWith\('\/tour '\) \? 1 : 2\)\.join\(' '\)\)/);
  const tour = C.linkedCommand('?ax_cmd=tour-alsea-mexico&marca=starbucks');
  assert.equal(tour, '/tour alsea mexico');
  assert.equal(C.resolveDoohClient(tour.split(' ').slice(1).join(' ')).circuit, 'alsea_mexico');
});

// marca-blanca.js en un navegador mínimo: el cargador de admiranext.com falla `fallos` veces y luego carga.
function arrancaMarca({ fallos, desconocida = false }) {
  const timers = [];
  let scripts = 0;
  const nodo = tag => ({ tagName: tag.toUpperCase(), attrs: {}, style: {}, setAttribute(k, v) { this.attrs[k] = v; }, toggleAttribute() {}, remove() {}, append() {} });
  const MB = { version: 't', cargar: () => (desconocida ? Promise.reject(new Error('404')) : Promise.resolve({ nombre: 'Starbucks' })),
    aplicar: id => Promise.resolve({ id, modo: 'claro', variables: {}, marca: { nombre: 'Starbucks' } }) };
  const session = new Map();
  const window = { warned: [], location: { search: '?ax_cmd=vision-general-starbucks-mexico&marca=starbucks', href: 'https://www.admira.biz/' },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: k => session.delete(k) },
    setTimeout: (fn, ms) => { if (ms < 5000) { timers.push(ms); setImmediate(fn); } return 0; }, clearTimeout() {},
    fetch: () => new Promise(() => {}), history: { replaceState() {} }, console: { warn: m => window.warned.push(m), info() {}, log() {} } };
  window.document = {
    currentScript: { src: 'https://www.admira.biz/marca-blanca.js?v=t' }, title: 'Mapa',
    documentElement: { lang: 'es', style: { length: 0, setProperty() {}, removeProperty() {} }, getAttribute: () => null, setAttribute() {}, removeAttribute() {} },
    head: { append: n => setImmediate(() => {
      if (n.tagName !== 'SCRIPT') return n.onload && n.onload();
      scripts++;
      if (scripts <= fallos) n.onerror(); else { window.MarcaBlanca = MB; n.onload(); }
    }) },
    createElement: nodo, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, dispatchEvent() {}, addEventListener() {},
  };
  window.window = window;
  const ctx = vm.createContext(Object.assign(window, { URL, URLSearchParams, CustomEvent: class {}, MutationObserver: class { observe() {} disconnect() {} }, Promise }));
  vm.runInContext(read('marca-blanca.js'), ctx);
  return new Promise(r => setTimeout(() => r({ actual: ctx.AdmiraMarca.actual(), scripts, reintentos: timers.filter(ms => ms >= 1000), warned: window.warned }), 300));
}

test('marca blanca: un fallo de red al arrancar se reintenta y la página acaba con la marca del enlace', async () => {
  const bien = await arrancaMarca({ fallos: 0 });
  assert.deepEqual([bien.actual.id, bien.scripts, bien.reintentos], ['starbucks', 1, []]);
  // Con la portada ocupada fallaba una vez y la visión general se quedaba con la cabecera de Admira.
  const dos = await arrancaMarca({ fallos: 2 });
  assert.deepEqual([dos.actual.id, dos.scripts, dos.reintentos, dos.warned], ['starbucks', 3, [1500, 4000], []]);
  const caido = await arrancaMarca({ fallos: 3 });
  assert.deepEqual([caido.actual, caido.scripts, caido.reintentos], [null, 3, [1500, 4000]]);
  assert.match(caido.warned[0], /no se aplicó «starbucks» \(network\)/);
  // Una marca que no existe no se reintenta.
  const nada = await arrancaMarca({ fallos: 0, desconocida: true });
  assert.deepEqual([nada.actual, nada.reintentos], [null, []]);
});
