// Catálogo ligero de admira.biz (misión FLT-102675 · encargo #7158, 24-oct-2026).
// A · locations.js: sin escribir el catálogo en localStorage; la clave vieja se borra; el backoffice sigue con su borrador.
// B · loadOmnipLocationsInWorker: trozos del Worker, firma y respaldo en el hilo principal.
// C · catalogo-worker.js: importa locations.js, baja /locations (no-cache), cose con el bundle y lo manda en trozos.
// D · Páginas de un solo local: walk y ficha piden por id (GET /locations/:id), nunca el catálogo entero.
// E · app.js: reglas de circuito en un solo pase (mismo resultado que los filtros), cachés por Xpacio y memo de circuitos.
// F · app.js: la ficha de un punto del slim se pide por id; el catálogo completo se aplica por pasos y sin firma de 10 MB.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = read('app.js'), locSrc = read('locations.js'), workerSrc = read('catalogo-worker.js');
const API = 'https://brain.digitalavatar.ai';

function memoria() {
  const mem = new Map(), log = [];
  return { mem, log, getItem: k => { log.push('get ' + k); return mem.has(k) ? mem.get(k) : null; },
    setItem: (k, v) => { log.push('set ' + k); mem.set(k, String(v)); }, removeItem: k => { log.push('remove ' + k); mem.delete(k); } };
}
const respuesta = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });
// locations.js en un contexto propio, con fetch, localStorage y Worker de mentira.
function cargarLocations({ fetch, Worker, localStorage = memoria(), currentScript } = {}) {
  const win = {};
  const ctx = vm.createContext({ window: win, localStorage, fetch, AbortController, setTimeout, clearTimeout, Worker,
    document: currentScript ? { currentScript: { src: currentScript } } : undefined });
  vm.runInContext(locSrc, ctx);
  return { win, ctx, localStorage };
}
const KV = [
  { id: 'kv-uno', name: 'Uno', kind: 'Correos · Oficina', addr: 'a', coords: [2, 41], surfaces: [{ name: 'P', surface: 'pantalla', cpm: '€4' }] },
  { id: 'alsea-mx-sbux-01-tijuana', name: 'Starbucks Tijuana (KV de septiembre)', kind: 'Cafetería', coords: [-117, 32.5], surfaces: [{ name: 'genérica' }] },
];

test('A · loadOmnipLocationsAsync ya no guarda el catálogo en localStorage, borra la clave vieja y revalida (no-cache)', async () => {
  const calls = [];
  const { win, localStorage } = cargarLocations({ fetch: async (url, opts) => { calls.push([url, opts && opts.cache]); return respuesta({ locations: KV, updatedAt: 'u1', source: 'kv' }); } });
  localStorage.mem.set('omnip-locations', '[{"id":"viejo"}]');
  const res = await win.loadOmnipLocationsAsync(1000);
  assert.deepEqual(calls, [[API + '/locations', 'no-cache']]);
  assert.equal(res.source, 'kv');
  assert.ok(res.locations.some(l => l.id === 'kv-uno'));
  assert.ok(!localStorage.log.some(l => l.startsWith('set ')), 'no escribe 10 MB que no caben');
  assert.ok(localStorage.log.includes('remove omnip-locations'), 'la copia vieja se borra');
  assert.equal(localStorage.mem.has('omnip-locations'), false);
  assert.doesNotMatch(locSrc, /localStorage\.setItem\(window\.OMNIP_STORE_KEY, JSON\.stringify\(merged\)\)/);
  // Sólo el backoffice escribe la clave (su borrador local).
  assert.equal((locSrc.match(/localStorage\.setItem\(/g) || []).length, 1);
  assert.match(locSrc, /window\.saveOmnipLocations = function\(arr\) \{\n  try \{\n    localStorage\.setItem\(window\.OMNIP_STORE_KEY/);
  assert.doesNotMatch(app, /localStorage\.setItem\(window\.OMNIP_STORE_KEY|OMNIP_STORE_KEY, JSON/);
});

test('A · {cache:false} no lee la clave (portada, ficha, walk); el backoffice la sigue leyendo y guardando', () => {
  const { win, localStorage } = cargarLocations({});
  localStorage.mem.set('omnip-locations', JSON.stringify([{ id: 'borrador-backoffice', name: 'B', coords: [0, 0], surfaces: [] }]));
  const portada = win.loadOmnipLocations({ cache: false });
  assert.ok(!localStorage.log.some(l => l.startsWith('get ')), 'ni la lee');
  assert.ok(!portada.some(l => l.id === 'borrador-backoffice'));
  assert.ok(portada.length > 100, 'el bundle');
  const backoffice = win.loadOmnipLocations();
  assert.ok(backoffice.some(l => l.id === 'borrador-backoffice'), 'el backoffice arranca con su borrador');
  assert.equal(win.saveOmnipLocations([{ id: 'x', name: 'X', coords: [0, 0], surfaces: [] }]), true);
  assert.match(localStorage.mem.get('omnip-locations'), /"id":"x"/);
  assert.match(app, /^let LOCATIONS = window\.loadOmnipLocations\(\{ cache: false \}\);$/m);
  assert.match(read('detail.html'), /const locations = window\.loadOmnipLocations\(\{cache: false\}\);/);
  assert.match(read('backoffice.html'), /locations = window\.loadOmnipLocations\(\)\.map/, 'el backoffice no cambia');
});

// Worker de mentira: reproduce los mensajes que enviaría catalogo-worker.js.
function workerFalso(guion) {
  const creados = [];
  class W {
    constructor(url) { this.url = url; this.terminado = false; creados.push(this); }
    postMessage(msg) { this.msg = msg; Promise.resolve().then(() => guion(this, msg)); }
    terminate() { this.terminado = true; }
  }
  return { W, creados };
}

test('B · loadOmnipLocationsInWorker junta los trozos, devuelve la firma y borra la clave vieja', async () => {
  const items = Array.from({ length: 1203 }, (_, i) => ({ id: 'p' + i }));
  const { W, creados } = workerFalso((w, msg) => {
    for (let i = 0; i < items.length; i += msg.chunk) w.onmessage({ data: { type: 'chunk', items: items.slice(i, i + msg.chunk), total: items.length } });
    w.onmessage({ data: { type: 'done', count: items.length, source: 'kv', updatedAt: 'u2', signature: 'u2|1203|p0|p1202|999' } });
  });
  const avances = [];
  const { win, localStorage } = cargarLocations({ Worker: W, fetch: async () => { throw Error('no debe pedir en el hilo principal'); }, currentScript: 'https://www.admira.biz/locations.js?v=x' });
  localStorage.mem.set('omnip-locations', '[]');
  const res = await win.loadOmnipLocationsInWorker({ chunk: 500, onChunk: n => avances.push(n) });
  assert.equal(creados.length, 1);
  assert.equal(creados[0].url, '/catalogo-worker.js?v=20261024-catalogo-ligero-1');
  assert.deepEqual({ ...creados[0].msg }, { api: API, locationsSrc: 'https://www.admira.biz/locations.js?v=x', timeoutMs: 20000, chunk: 500 });
  assert.deepEqual(avances, [500, 1000, 1203], 'tres trozos');
  assert.equal(res.locations.length, 1203); assert.equal(res.locations[1202].id, 'p1202');
  assert.equal(res.signature, 'u2|1203|p0|p1202|999'); assert.equal(res.via, 'worker'); assert.equal(res.updatedAt, 'u2');
  assert.equal(creados[0].terminado, true, 'el Worker se cierra');
  assert.equal(localStorage.mem.has('omnip-locations'), false);
});

test('B · respaldo: sin Worker o si el Worker no carga locations.js, en el hilo principal; si falla la red, null', async () => {
  const kv = async url => { assert.equal(url, API + '/locations'); return respuesta({ locations: KV }); };
  const sinWorker = cargarLocations({ fetch: kv });
  const a = await sinWorker.win.loadOmnipLocationsInWorker();
  assert.equal(a.via, 'main'); assert.equal(a.signature, ''); assert.ok(a.locations.some(l => l.id === 'kv-uno'));
  const imp = workerFalso(w => w.onmessage({ data: { type: 'error', stage: 'import' } }));
  const b = await cargarLocations({ fetch: kv, Worker: imp.W }).win.loadOmnipLocationsInWorker();
  assert.equal(b.via, 'main'); assert.equal(imp.creados[0].terminado, true);
  const roto = workerFalso(w => w.onerror({ preventDefault() {} }));
  assert.equal((await cargarLocations({ fetch: kv, Worker: roto.W }).win.loadOmnipLocationsInWorker()).via, 'main');
  let pedidas = 0;
  const red = workerFalso(w => w.onmessage({ data: { type: 'error', stage: 'fetch' } }));
  assert.equal(await cargarLocations({ fetch: async () => { pedidas++; return respuesta({}); }, Worker: red.W }).win.loadOmnipLocationsInWorker(), null);
  assert.equal(pedidas, 0, 'la red falló: no se repite en el hilo principal');
  // Sin catálogo en el KV, el respaldo no devuelve el bundle como si fuera el catálogo (la portada se queda con el slim).
  assert.equal(await cargarLocations({ fetch: async () => respuesta({ locations: [] }) }).win.loadOmnipLocationsInWorker(), null);
});

// El global del Worker es `self`: el contexto es ese objeto (así locations.js encuentra window = self).
function correrWorker({ fetch, importScripts }) {
  const enviados = [];
  const ctx = vm.createContext({ postMessage: m => enviados.push(m), fetch, AbortController, setTimeout, clearTimeout, importScripts });
  vm.runInContext('var self = this;', ctx);
  vm.runInContext(workerSrc, ctx);
  return { self: ctx, ctx, enviados };
}
const plano = x => JSON.parse(JSON.stringify(x));   // objetos de otro contexto vm, comparables con deepEqual

test('C · catalogo-worker.js importa el mismo locations.js, pide /locations (no-cache) y manda el catálogo cosido en trozos', async () => {
  const pedidas = [], importados = [];
  const muchos = [...KV, ...Array.from({ length: 1100 }, (_, i) => ({ id: 'kv-' + i, name: 'N' + i, kind: 'k', coords: [1, 1], surfaces: [] }))];
  const texto = JSON.stringify({ locations: muchos, updatedAt: 'u3', source: 'kv' });
  let w;
  const importScripts = src => { importados.push(src); vm.runInContext(locSrc, w.ctx); };
  w = correrWorker({ importScripts, fetch: async (url, opts) => { pedidas.push([url, opts.cache]); return { ok: true, status: 200, text: async () => texto }; } });
  assert.equal(vm.runInContext('self.window === self', w.ctx), true, 'locations.js cuelga de window');
  await w.self.onmessage({ data: { api: API, locationsSrc: '/locations.js?v=x', chunk: 500 } });
  assert.deepEqual(importados, ['/locations.js?v=x']);
  assert.deepEqual(pedidas, [[API + '/locations', 'no-cache']]);
  const trozos = w.enviados.filter(m => m.type === 'chunk'), fin = w.enviados.at(-1);
  const todos = trozos.flatMap(m => m.items);
  assert.ok(trozos.every(m => m.items.length <= 500));
  assert.equal(fin.type, 'done'); assert.equal(fin.count, todos.length); assert.equal(fin.updatedAt, 'u3');
  assert.equal(fin.signature, ['u3', todos.length, todos[0].id, todos.at(-1).id, texto.length].join('|'));
  // El cosido del bundle: la ficha curada de Tijuana (bundleWins) manda sobre la del KV y entran los Xpacios del bundle.
  const tijuana = todos.find(l => l.id === 'alsea-mx-sbux-01-tijuana');
  assert.equal(tijuana.name, 'Starbucks Tijuana · Plaza Río');
  assert.ok(todos.some(l => l.id === 'cafebreria-barcelona'), 'Xpacios del bundle que no están en el KV');
  assert.ok(todos.every(l => l.segmentation && l.segmentation.required === true), 'segmentación normalizada');
  // Un segundo catálogo no vuelve a importar locations.js.
  await w.self.onmessage({ data: { api: API, locationsSrc: '/locations.js?v=x', chunk: 500 } });
  assert.equal(importados.length, 1);
});

test('C · catalogo-worker.js avisa de qué falló: import, red o JSON', async () => {
  const sinImport = correrWorker({ importScripts: () => { throw Error('404'); }, fetch: async () => { throw Error('no'); } });
  await sinImport.self.onmessage({ data: {} });
  assert.deepEqual(sinImport.enviados.map(m => [m.type, m.stage]), [['error', 'import']]);
  let w;
  const imp = () => vm.runInContext(locSrc, w.ctx);
  w = correrWorker({ importScripts: imp, fetch: async () => ({ ok: false, status: 503, text: async () => '' }) });
  await w.self.onmessage({ data: { api: API } });
  assert.deepEqual(w.enviados.map(m => [m.type, m.stage, m.error]), [['error', 'fetch', 'http 503']]);
  w = correrWorker({ importScripts: imp, fetch: async () => ({ ok: true, status: 200, text: async () => '{"locations":[]}' }) });
  await w.self.onmessage({ data: { api: API } });
  assert.deepEqual(w.enviados.map(m => [m.type, m.stage]), [['error', 'parse']]);
  // Es parte del release de admira.biz.
  assert.match(read('server/biz-assets.mjs'), /'locations\.js',\n  \/\/ Catálogo ligero \(FLT-102675\)[^\n]*\n  'catalogo-worker\.js',/);
});

test('D · un solo local por id: loadOmnipLocationById cose como el catálogo y, si no llega, usa el bundle', async () => {
  const pedidas = [];
  const fetch = async url => { pedidas.push(url.replace(API, ''));
    if (url.endsWith('/locations/alsea-mx-sbux-01-tijuana')) return respuesta({ location: KV[1] });
    if (url.endsWith('/locations/kv-uno')) return respuesta({ location: KV[0] });
    return respuesta({ error: 'not_found' }, false, 404); };
  const { win } = cargarLocations({ fetch });
  const uno = await win.loadOmnipLocationById('kv-uno');
  assert.equal(uno.source, 'api'); assert.equal(uno.location.id, 'kv-uno'); assert.equal(uno.location.segmentation.required, true);
  const tijuana = await win.loadOmnipLocationById('alsea-mx-sbux-01-tijuana');
  assert.equal(tijuana.location.name, 'Starbucks Tijuana · Plaza Río', 'la ficha curada del bundle manda, como en el catálogo completo');
  const bundle = await win.loadOmnipLocationById('cafebreria-barcelona');
  assert.equal(bundle.source, 'local'); assert.equal(bundle.location.id, 'cafebreria-barcelona');
  assert.deepEqual(plano(await win.loadOmnipLocationById('no-existe')), { location: null, source: 'local' });
  assert.deepEqual(plano(await win.loadOmnipLocationById('')), { location: null, source: 'local' });
  assert.deepEqual(pedidas, ['/locations/kv-uno', '/locations/alsea-mx-sbux-01-tijuana', '/locations/cafebreria-barcelona', '/locations/no-existe']);
  assert.ok(!pedidas.includes('/locations'), 'nunca el catálogo entero');
});

test('D · walk.mjs y detail.html no bajan el catálogo entero; walk.html pide la versión nueva', () => {
  const walk = read('walk.mjs');
  assert.doesNotMatch(walk, /loadOmnipLocationsAsync/);
  assert.match(walk, /const result = await window\.loadOmnipLocationById\(state\.locationId, 4500\);\n    catalogueSource = result\.source;\n    place = result\.location \|\| null;/);
  assert.match(walk, /catalogueSource === 'local' \? 'catalogFallback'/, 'si no llega, lo dice');
  const detail = read('detail.html');
  assert.doesNotMatch(detail, /loadOmnipLocationsAsync/);
  assert.match(detail, /window\.loadOmnipLocationDetail\?\.\(locId, 4500\)/);
  assert.match(read('walk.html'), /walk\.mjs\?v=20261006-experto-tecla-1&amp;evidence=20261010-1&amp;catalogo=20261024-1/);
  for (const p of ['index.html', 'detail.html', 'walk.html', 'backoffice.html', 'store-3d.html', 'parrilla/index.html']) assert.match(read(p), /locations\.js\?v=20261029-mejoras-biz-1/, p);
  assert.match(read('index.html'), /<script defer src="app\.js\?v=20261029-mejoras-biz-1"><\/script>/);
});

// E · las reglas de circuito y los circuitos, con el código de app.js sobre el bundle.
function circuitos(lang = 'es') {
  const { win } = cargarLocations({});
  const ids = app.match(/const CIRCUIT_IDS_BY_SCOPE = \{[\s\S]*?\n\};/)[0];
  const seg = app.slice(app.indexOf('function locationSegmentation'), app.indexOf('function circuitSegmentationForItems'));
  const segFn = app.slice(app.indexOf('function circuitSegmentationForItems'));
  const ctx = vm.createContext({ LANG: lang, performance, t: k => k, sanitizeCircuitScope: v => v || 'all', selectedCircuitScope: 'all', circuitScopePayload: () => ({ required: true, value: 'all' }),
    window: { normalizeOmnipSegmentation: win.normalizeOmnipSegmentation, OMNIP_SEGMENTATION_OPTIONS: win.OMNIP_SEGMENTATION_OPTIONS, addEventListener() {} }, document: { documentElement: { dataset: {} } } });
  vm.runInContext(ids + '\nconst BUILTIN_CIRCUITS = new Set(CIRCUIT_IDS_BY_SCOPE.all);\nvar LOCATIONS = [];\n' + app.slice(app.indexOf('function normText'), app.indexOf('function currentCircuit()'))
    + '\n' + seg + '\n' + segFn.slice(0, segFn.indexOf('\n}\n') + 3), ctx);
  const extra = [
    { id: 'demo-1', name: 'Demo', kind: 'x', circuit: 'demo_cliente', coords: [0, 0], surfaces: [] },
    { id: 'of-1', name: 'Oficina', kind: 'Oficina', experienceId: 'admiraxperience', coords: [0, 0], surfaces: [] },
    { id: 'x-1', name: 'Tienda', kind: 'Retail', osm: { brand: 'BBVA' }, coords: [0, 0], surfaces: [] },
    { id: 'x-2', name: 'Oficina', kind: 'Banca', external: { brand: 'Banorte', network: 'Banorte México' }, coords: [0, 0], surfaces: [] },
  ];
  ctx.LOCATIONS = win.mergeOmnipLocations(win.OMNIP_LOCATIONS_DEFAULT).concat(win.normalizeOmnipLocations(extra));
  return ctx;
}

test('E · repartirPorReglas da lo mismo que filtrar regla a regla, en el mismo orden', () => {
  const ctx = circuitos();
  const porRegla = ctx.repartirPorReglas(ctx.LOCATIONS);
  const reglas = ctx.reglasDeCircuito();
  assert.equal(reglas.length, 22); assert.ok(reglas.length <= 31, 'caben en los bits');
  let conPuntos = 0;
  for (const regla of reglas) { const a = plano(porRegla(regla).map(l => l.id)); assert.deepEqual(a, plano(ctx.LOCATIONS.filter(regla).map(l => l.id)), regla.name); if (a.length) conPuntos++; }
  assert.ok(conPuntos >= 10, 'el bundle cubre la mayoría de reglas: ' + conPuntos);
  assert.deepEqual(plano(porRegla(ctx.isDemoCircuitLocation).map(l => l.id)), ['demo-1'], 'una regla que no está en la lista se filtra igual');
  assert.ok(!porRegla(ctx.isRetailCircuitLocation).some(l => l.id === 'demo-1' || l.id === 'of-1'), 'retail deja fuera demos y oficinas');
  const defs = ctx.circuitDefinitions();
  assert.deepEqual(plano(defs.bbva.items.map(l => l.id).filter(id => id.startsWith('x-'))), ['x-1']);
  assert.deepEqual(plano(defs.banorte_mx.items.map(l => l.id).filter(id => id.startsWith('x-'))), ['x-2']);
  assert.equal(defs.all.items.length, ctx.LOCATIONS.length);
  assert.ok(defs.demo_cliente, 'circuito demo');
});

test('E · los cálculos por Xpacio se guardan y se rehacen si cambia el dato (el slim corrige name/kind en el sitio)', () => {
  const ctx = circuitos();
  const loc = { id: 'p-1', name: 'Punto', kind: 'Retail', addr: '', coords: [0, 0], surfaces: [] };
  const a = ctx.locTexto(loc);
  assert.equal(ctx.locTexto(loc), a, 'el mismo registro');
  assert.equal(a.idNameKind, 'p-1 punto retail'); assert.equal(a.nameKind, 'punto retail'); assert.equal(a.idNameKindAddr, 'p-1 punto retail ');
  assert.equal(ctx.circuitLabel(loc), 'Retail');
  loc.name = 'Correos Gràcia'; loc.kind = 'Correos · Oficina postal';
  assert.equal(ctx.circuitLabel(loc), 'Correos', 'rehecho tras mutar');
  assert.equal(ctx.isCorreosLocation(loc), true);
  assert.equal(ctx.reglasDelXpacio(loc) & (1 << ctx.reglasDeCircuito().indexOf(ctx.isCorreosLocation)), 1 << ctx.reglasDeCircuito().indexOf(ctx.isCorreosLocation));
  loc.circuit = 'cafebreria';
  assert.equal(ctx.circuitLabel(loc), 'Cafebrería', 'el circuito también cuenta');
  ctx.LANG = 'en';
  const oficina = { id: 'o', name: 'O', kind: 'k', experienceId: 'admiraxperience' };
  assert.equal(ctx.circuitLabel(oficina), 'AdmiraXperience office');
  ctx.LANG = 'es';
  assert.equal(ctx.circuitLabel(oficina), 'Oficina AdmiraXperience', 'el idioma cuenta');
  // Segmentación: si el Xpacio ya viene normalizado, se devuelve la suya (sin copia por Xpacio).
  const norm = ctx.window.normalizeOmnipSegmentation({ id: 's', surfaces: [{ surface: 'pantalla' }] });
  assert.equal(ctx.locationSegmentation(norm), norm.segmentation);
  const crudo = { id: 'c', surfaces: [], segmentation: { genders: 'ambos' } };
  const s1 = ctx.locationSegmentation(crudo);
  assert.deepEqual(plano(s1.genders), ['hombre', 'mujer']); assert.equal(ctx.locationSegmentation(crudo), s1, 'guardada');
  crudo.segmentation = { genders: ['mujer'] };
  assert.deepEqual(plano(ctx.locationSegmentation(crudo).genders), ['mujer'], 'otra segmentación, otro cálculo');
});

test('E · circuitDefinitions se guarda mientras no cambien catálogo, idioma ni ámbito', () => {
  const ctx = circuitos();
  const a = ctx.circuitDefinitions();
  assert.equal(ctx.circuitDefinitions(), a);
  ctx.LANG = 'en'; const b = ctx.circuitDefinitions(); assert.notEqual(b, a);
  ctx.selectedCircuitScope = 'national'; const c = ctx.circuitDefinitions(); assert.notEqual(c, b);
  ctx.LOCATIONS = ctx.LOCATIONS.slice(1); const d = ctx.circuitDefinitions(); assert.notEqual(d, c);
  assert.equal(d.all.items.length, ctx.LOCATIONS.length);
  // El ⌘ Experto que carga después recibe los circuitos guardados.
  const recibidos = []; ctx.window.AdmiraExpertCommands = { setCircuits: defs => recibidos.push(defs) };
  assert.equal(ctx.circuitDefinitions(), d); assert.deepEqual(recibidos, [d]);
  ctx.circuitDefinitions(); assert.equal(recibidos.length, 1, 'una sola vez');
});

test('E · precalcularXpacios trabaja por tramos y cede el hilo', async () => {
  const ctx = circuitos();
  let reloj = 0, cedidas = 0;
  ctx.performance = { now: () => (reloj += 25) };   // cada consulta del reloj, 25 ms: pasa del tramo de 10 ms
  ctx.cederHilo = () => { cedidas++; return Promise.resolve(); };
  vm.runInContext('this.__pre = precalcularXpacios;', ctx);
  const lista = ctx.LOCATIONS.slice(0, 200);
  await ctx.__pre(lista);
  assert.ok(cedidas >= 2, 'cedió ' + cedidas + ' veces');
  assert.ok(lista.every(l => ctx.locTexto(l).label !== undefined && ctx.locTexto(l).reglas !== undefined), 'todos calculados');
  assert.match(app, /function cederHilo\(\) \{\n  try \{ if \(window\.scheduler && typeof window\.scheduler\.yield === 'function'\) return window\.scheduler\.yield\(\); \} catch \(_\) \{\}\n  return new Promise\(resolve => setTimeout\(resolve, 0\)\);\n\}/);
});

test('F · la ficha de un punto del slim se pide por id, conserva su sitio y se repinta al llegar (una petición)', async () => {
  const seccion = app.slice(app.indexOf('// Ficha de un punto que sólo conoce el slim'), app.indexOf('// ?circuit=alsea_mexico&tour=1'));
  const slimLoc = { id: 'b', name: 'B', _slim: true, coords: [1, 1], surfaces: [] };
  const log = [];
  let soltar;
  const env = {
    LOCATIONS_ALL: [{ id: 'a' }, slimLoc, { id: 'c' }], activeLocation: slimLoc,
    panel: { classList: { contains: c => c === 'open' } },
    fichaEnlaceDatos: id => { log.push('GET /locations/' + id); return new Promise(r => { soltar = r; }); },
    setLocations(list) { env.LOCATIONS_ALL = list; env.LOC_BY_ID = new Map(list.map(l => [l.id, l])); log.push('setLocations'); },
    setTimeout: fn => fn(), updateLocationsSource: () => log.push('updateLocationsSource'),
    renderPanel: l => { env.activeLocation = l; log.push('renderPanel:' + l.id + ':' + (l._slim ? 'slim' : 'entera')); },
  };
  env.LOC_BY_ID = new Map(env.LOCATIONS_ALL.map(l => [l.id, l]));
  const api = new Function('env', `with(env){${seccion}\nreturn {hidratar: hidratarXpacio, refrescar: refrescarFichaSlim};}`)(env);
  const p1 = api.hidratar('b'), p2 = api.hidratar('b');
  assert.equal(p1, p2, 'una petición por Xpacio');
  soltar({ id: 'b', name: 'B entera', coords: [1, 1], surfaces: [{}, {}] });
  const full = await p1;
  assert.deepEqual(log, ['GET /locations/b', 'setLocations', 'updateLocationsSource', 'renderPanel:b:entera']);
  assert.deepEqual(plano(env.LOCATIONS_ALL.map(l => l.id)), ['a', 'b', 'c'], 'en su sitio');
  assert.equal(full.surfaces.length, 2); assert.equal(env.activeLocation, full);
  // Si ya llegó por otro camino, no se pide ni se toca nada; sin detalle, null.
  log.length = 0;
  assert.equal(await api.hidratar('b'), full); assert.deepEqual(log, []);
  env.LOC_BY_ID.set('z', { id: 'z', _slim: true }); const pz = api.hidratar('z'); soltar(null);
  assert.equal(await pz, null); assert.ok(!log.includes('setLocations'));
  // Al llegar el catálogo completo, una ficha abierta que aún era la del slim se repinta.
  env.activeLocation = { id: 'c', _slim: true }; env.LOC_BY_ID.set('c', { id: 'c', surfaces: [{}] }); log.length = 0;
  api.refrescar(); assert.deepEqual(log, ['renderPanel:c:entera']);
  // renderPanel la pide al pintar una ficha del slim.
  assert.match(app, /function renderPanel\(loc\) \{\n  activeLocation = loc;\n  if \(loc && loc\._slim\) hidratarXpacio\(loc\.id\);/);
});

test('F · el catálogo completo llega del Worker y se aplica por pasos, sin la firma de 10 MB ni volver al bundle', () => {
  const fase = app.slice(app.indexOf('  whenIdle(async () => {'), app.indexOf('// ─── Equipos auto-registrados'));
  assert.match(fase, /const res = typeof window\.loadOmnipLocationsInWorker === 'function'\n      \? await window\.loadOmnipLocationsInWorker\(\{ timeoutMs: 20000 \}\)\n      : await window\.loadOmnipLocationsAsync\(4500\);/);
  assert.match(fase, /if \(!res \|\| res\.source === 'local' \|\| !Array\.isArray\(res\.locations\) \|\| !res\.locations\.length\) return;/, 'sin catálogo, se queda con bundle + slim');
  assert.match(fase, /if \(res\.signature && res\.signature === catalogoCompletoFirma\) return;/);
  assert.ok(fase.indexOf('await precalcularXpacios(res.locations);') < fase.indexOf('setLocations(['), 'clasifica por tramos antes de aplicar');
  assert.ok((fase.match(/await cederHilo\(\);/g) || []).length >= 4, 'cede el hilo entre pasos');
  assert.match(fase, /circuitDefinitions\(\);   \/\/ los circuitos del catálogo nuevo, en su propia tarea/);
  assert.doesNotMatch(app, /function locationsSignature|JSON\.stringify\(items\)\.length/);
  assert.match(fase, /try \{ refrescarFichaSlim\(\); \} catch \(_\) \{\}/);
  // Fase 1: el slim se funde por tramos y se aplica sobre el catálogo de ahora.
  const slim = app.slice(app.indexOf("const slim = await window.loadOmnipLocationsSlimAsync(3500);"), app.indexOf('  const circuitAsked = circuitParam();'));
  assert.match(slim, /if \(\(i & 255\) === 255 && performance\.now\(\) - t0 > 10\) \{ await cederHilo\(\); t0 = performance\.now\(\); \}/);
  assert.match(slim, /_n: Number\(m\.n\) \|\| 0/);
  assert.match(slim, /setLocations\(LOCATIONS_ALL\.concat\(nuevos\.filter\(l => !ya\.has\(l\.id\)\)\)\);/);
  assert.match(app, /total: surfaces\.length \|\| l\._n \|\| 0,/, 'el tooltip dice las superficies del slim');
});

test('F · los comercios importados que no cambian no repintan los 9.000 puntos cada minuto', async () => {
  const seccion = app.slice(app.indexOf('let walkReturnRestored ='), app.indexOf('// ─── Refresh asincrónico desde el worker (KV)'));
  const place = { id: 'yokup-1', name: 'Importado', source: 'yokup-retailer', coords: [2, 41], surfaces: [] };
  let pintadas = 0;
  const ctx = vm.createContext({ LOCATIONS: [{ id: 'legacy' }], LOCATIONS_ALL: [{ id: 'legacy' }], URLSearchParams, location: { search: '' }, document: { hidden: false },
    window: { loadYokupLocationsAsync: async () => [JSON.parse(JSON.stringify(place))] }, map: { loaded: () => true },
    setLocations: next => { ctx.LOCATIONS = next; ctx.LOCATIONS_ALL = next; }, updateLocationsSource: () => { pintadas++; }, renderCircuitSelector: () => {}, flyToLocation: () => {}, setInterval: () => {} });
  vm.runInContext(seccion, ctx);
  await ctx.mergeRetailerLocations(); assert.equal(pintadas, 1);
  await ctx.mergeRetailerLocations(); assert.equal(pintadas, 1, 'igual que antes: nada');
  ctx.window.loadYokupLocationsAsync = async () => [{ ...place, name: 'Renombrado' }];
  await ctx.mergeRetailerLocations(); assert.equal(pintadas, 2, 'cambió: se repinta');
  ctx.LOCATIONS_ALL = ctx.LOCATIONS_ALL.filter(l => l.id !== 'yokup-1');
  await ctx.mergeRetailerLocations(); assert.equal(pintadas, 3, 'el catálogo completo lo quitó: vuelve');
});
