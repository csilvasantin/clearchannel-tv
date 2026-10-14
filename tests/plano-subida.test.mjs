import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  ID_RE, MAX_JSON, MAX_CALCO, MAX_LADO, ACEPTA, normalizarId, idDeFichero, nombreDeFichero, tipoFichero, comprobarFichero,
  leerPlanoJson, resumenPlano, comprobarSala, salaRectangular, escalaCalco, escalaPdf, anchoSala, nuevoCalco, calcoValido,
  geometriaCalco, registroSubida, registroValido, almacenPlanos, conTiempo, ESPERA_IDB
} from '../plano-subida.mjs';
import { SCHEMA, ORDER_SCHEMA, validate, inwardNormal, wallLength, placeNew, template } from '../plano-core.mjs';
import { BIZ_ASSET_FILES } from '../server/biz-assets.mjs';

const starbucksText = readFileSync(new URL('../data/xpacios/alsea-sbux-021.json', import.meta.url), 'utf8');
const starbucks = JSON.parse(starbucksText);
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('ids and names come from any text or file name', () => {
  assert.equal(normalizarId('  Starbucks Paseo de Gracia 103 '), 'starbucks-paseo-de-gracia-103');
  assert.equal(normalizarId('Mañana · Óptica--Ñ'), 'manana-optica-n');
  assert.equal(normalizarId('---'), '');
  assert.equal(normalizarId('a'.repeat(100)).length, 80);
  assert.ok(ID_RE.test(normalizarId('x'.repeat(79) + '-y')));
  assert.equal(idDeFichero('/Users/c/Planos/Tienda Valencia_v2.PDF'), 'tienda-valencia-v2');
  assert.equal(nombreDeFichero('planta-tienda_valencia.pdf'), 'planta tienda valencia');
  assert.equal(nombreDeFichero('C:\\planos\\Local 7.json'), 'Local 7');
});

test('the expert verb builds the upload link with the same id normalisation', () => {
  const C = createRequire(import.meta.url)('../expert-commands.js');
  for (const text of ['Café Gràcia', '  Starbucks Paseo de Gracia 103 ', 'Mañana · Óptica--Ñ', 'MI-TIENDA', '¿?', 'a'.repeat(100)]) {
    assert.equal(C.planoId(text), normalizarId(text), text);
  }
});

test('file type by extension or MIME, with size limits', () => {
  assert.equal(tipoFichero({ name: 'plano.JSON' }), 'json');
  assert.equal(tipoFichero({ name: 'calco.jpeg' }), 'imagen');
  assert.equal(tipoFichero({ name: 'calco.svg' }), 'imagen');
  assert.equal(tipoFichero({ name: 'plano.pdf' }), 'pdf');
  assert.equal(tipoFichero({ name: 'sin-extension', type: 'image/webp' }), 'imagen');
  assert.equal(tipoFichero({ name: 'plano.dwg', type: 'application/json' }), null, 'a known extension wins over the MIME');
  assert.equal(tipoFichero({ name: 'notas.txt' }), null);
  for (const ext of ['.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf', 'application/pdf']) assert.ok(ACEPTA.split(',').includes(ext), ext);
  assert.deepEqual(comprobarFichero({ name: 'plano.json', size: 100 }), { ok: true, tipo: 'json', error: null });
  assert.equal(comprobarFichero({ name: 'plano.json', size: MAX_JSON + 1 }).error.codigo, 'grande');
  assert.equal(comprobarFichero({ name: 'plano.pdf', size: MAX_JSON + 1 }).ok, true, 'a PDF may be larger than a JSON');
  assert.equal(comprobarFichero({ name: 'plano.pdf', size: MAX_CALCO + 1 }).error.codigo, 'grande');
  assert.equal(comprobarFichero({ name: 'plano.png', size: 0 }).error.codigo, 'vacio');
  const bad = comprobarFichero({ name: 'plano.dwg', size: 10 });
  assert.equal(bad.ok, false); assert.equal(bad.error.codigo, 'tipo'); assert.ok(bad.error.texto && bad.error.en);
});

test('the published Starbucks plan reads back as a valid upload with its own id', () => {
  const r = leerPlanoJson(starbucksText, 'otro-xpacio');
  assert.equal(r.ok, true, JSON.stringify(r.errores));
  assert.equal(r.id, 'alsea-sbux-021');
  assert.equal(r.plan.id, 'alsea-sbux-021');
  assert.equal(r.plan.pantallas.length, 6);
  assert.ok(r.avisos.some(a => a.codigo === 'otro-id'), 'warns when the plan belongs to another Xpace');
  assert.deepEqual(r.plan.paredes, starbucks.paredes);
  // Los avisos de plano-core (mueble delante, etc.) viajan como avisos, no como errores.
  const core = validate(starbucks).map(i => i.codigo);
  for (const c of core) assert.ok(r.avisos.some(a => a.codigo === c), c);
  const same = leerPlanoJson(starbucksText, 'alsea-sbux-021');
  assert.ok(!same.avisos.some(a => a.codigo === 'otro-id'));
  assert.deepEqual(resumenPlano(r.plan), { id: 'alsea-sbux-021', nombre: 'Starbucks Paseo de Gracia 103', paredes: 4, pantallas: 6, ancho: 14, fondo: 8, alto: 3.3 });
});

test('the id comes from the JSON when valid, otherwise from the URL', () => {
  const plan = { ...starbucks, id: 'Starbucks 103!' };
  const r = leerPlanoJson(JSON.stringify(plan), 'mi-tienda');
  assert.equal(r.ok, true);
  assert.equal(r.id, 'mi-tienda');
  assert.ok(r.avisos.some(a => a.codigo === 'id-url'));
  const noId = { ...starbucks }; delete noId.id;
  assert.equal(leerPlanoJson(JSON.stringify(noId), 'mi-tienda').id, 'mi-tienda');
  const nowhere = leerPlanoJson(JSON.stringify(noId), 'NO VALE');
  assert.equal(nowhere.ok, false);
  assert.equal(nowhere.errores[0].codigo, 'id');
  assert.equal(leerPlanoJson(JSON.stringify(noId), undefined).ok, false, 'a missing default id is not the string "undefined"');
  const unnamed = { ...starbucks }; delete unnamed.nombre;
  assert.equal(leerPlanoJson(JSON.stringify(unnamed), 'x').plan.nombre, 'alsea-sbux-021');
});

test('bad JSON, wrong schema or a work order are rejected with a reason', () => {
  const empty = leerPlanoJson('   ', 'x');
  assert.equal(empty.ok, false); assert.equal(empty.errores[0].codigo, 'vacio');
  const broken = leerPlanoJson('{"schema":', 'x');
  assert.equal(broken.ok, false); assert.equal(broken.errores[0].codigo, 'json'); assert.equal(broken.plan, null);
  assert.equal(leerPlanoJson('[1,2]', 'x').errores[0].codigo, 'esquema');
  const wrong = leerPlanoJson(JSON.stringify({ ...starbucks, schema: 'otro/1' }), 'x');
  assert.equal(wrong.errores[0].codigo, 'esquema'); assert.match(wrong.errores[0].texto, /otro\/1/);
  const order = leerPlanoJson(JSON.stringify({ schema: ORDER_SCHEMA, xpacio: 'alsea-sbux-021' }), 'x');
  assert.match(order.errores[0].texto, /orden de obra/); assert.match(order.errores[0].en, /work order/);
  assert.equal(leerPlanoJson('\uFEFF' + starbucksText, 'x').ok, true, 'a UTF-8 BOM is tolerated');
  const huge = JSON.stringify({ ...starbucks, relleno: 'x'.repeat(MAX_JSON) });
  assert.equal(leerPlanoJson(huge, 'x').errores[0].codigo, 'grande');
});

test('the minimum structure is checked: room, walls with ends, screens with the fields plano-core uses', () => {
  const codes = mutate => {
    const plan = JSON.parse(starbucksText); mutate(plan);
    const r = leerPlanoJson(JSON.stringify(plan), 'x');
    assert.equal(r.ok, false); assert.equal(r.plan, null);
    return r.errores.map(e => e.codigo);
  };
  assert.deepEqual(codes(p => { delete p.planta; }), ['planta']);
  assert.deepEqual(codes(p => { p.planta.alto = 0; }), ['planta']);
  assert.deepEqual(codes(p => { p.paredes = p.paredes.slice(0, 2); }), ['paredes']);
  assert.ok(codes(p => { p.paredes[1].b = [14]; }).includes('pared'));
  assert.ok(codes(p => { p.paredes[2].id = 'F'; }).includes('pared'));
  assert.ok(codes(p => { p.paredes[0].b = [0.01, 0]; }).includes('pared'));
  assert.deepEqual(codes(p => { p.pantallas[0].pared = 'Z'; }), ['pantalla']);
  assert.deepEqual(codes(p => { p.pantallas[0].s = '5'; }), ['pantalla']);
  assert.deepEqual(codes(p => { p.pantallas[1].orientacion = 'diagonal'; }), ['pantalla']);
  assert.deepEqual(codes(p => { delete p.pantallas[2].pulgadas; }), ['pantalla']);
  assert.deepEqual(codes(p => { p.pantallas[3].resolucion = [1920]; }), ['pantalla']);
  assert.deepEqual(codes(p => { p.pantallas[4].id = p.pantallas[5].id; }), ['pantalla']);
  assert.deepEqual(codes(p => { p.pantallas = {}; }), ['pantallas']);
  assert.deepEqual(codes(p => { p.huecos[0].pared = 'Z'; }), ['huecos']);
  assert.deepEqual(codes(p => { delete p.mobiliario[0].alto; }), ['mobiliario']);
  // Sin pantallas, huecos ni muebles también vale: se completan las listas.
  const bare = JSON.parse(starbucksText); delete bare.pantallas; delete bare.huecos; delete bare.mobiliario;
  const r = leerPlanoJson(JSON.stringify(bare), 'x');
  assert.equal(r.ok, true);
  assert.deepEqual([r.plan.pantallas, r.plan.huecos, r.plan.mobiliario], [[], [], []]);
});

test('anticlockwise or open walls and plano-core conflicts are warnings, not errors', () => {
  const plan = JSON.parse(starbucksText);
  plan.paredes = plan.paredes.slice().reverse().map(w => ({ ...w, a: w.b, b: w.a }));
  const r = leerPlanoJson(JSON.stringify(plan), 'x');
  assert.equal(r.ok, true);
  assert.ok(r.avisos.some(a => a.codigo === 'antihorario'));
  const open = JSON.parse(starbucksText); open.paredes[1].a = [14, 0.5];
  assert.ok(leerPlanoJson(JSON.stringify(open), 'x').avisos.some(a => a.codigo === 'abiertas'));
  const clash = JSON.parse(starbucksText); clash.pantallas[1].s = clash.pantallas[0].s;
  const c = leerPlanoJson(JSON.stringify(clash), 'x');
  assert.equal(c.ok, true);
  assert.ok(c.avisos.some(a => a.codigo === 'solape' && a.nivel === 'error'));
});

test('a rectangular room is a valid plan whose walls follow the Starbucks convention', () => {
  const sala = salaRectangular({ id: 'mi-tienda', nombre: '  Mi   tienda  ', ancho: 14, fondo: 8, alto: 3.3 });
  assert.equal(sala.schema, SCHEMA);
  assert.equal(sala.nombre, 'Mi tienda');
  assert.deepEqual(sala.planta, { ancho: 14, fondo: 8, alto: 3.3 });
  // Mismas paredes que Starbucks Paseo de Gracia 103 (14 × 8): mismos extremos y mismo sentido.
  assert.deepEqual(sala.paredes.map(w => [w.a, w.b]), starbucks.paredes.map(w => [w.a, w.b]));
  for (const w of sala.paredes) assert.deepEqual(Object.keys(w), ['id', 'nombre', 'a', 'b']);
  assert.deepEqual([sala.pantallas, sala.huecos, sala.mobiliario], [[], [], []]);
  // Normales hacia dentro: el centro de la sala queda delante de cada pared.
  for (const w of sala.paredes) {
    const [nx, ny] = inwardNormal(w), mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2;
    assert.ok((7 - mx) * nx + (4 - my) * ny > 0, w.id);
  }
  assert.deepEqual(sala.paredes.map(w => wallLength(w)), [14, 8, 14, 8]);
  // Pasa la lectura de un plano subido y admite pantallas nuevas.
  const back = leerPlanoJson(JSON.stringify(sala), 'mi-tienda');
  assert.equal(back.ok, true); assert.deepEqual(back.avisos, []);
  const placed = placeNew(sala, [], template('mosaico-h'), 'F');
  assert.deepEqual(validate(sala, placed).filter(i => i.nivel === 'error'), []);
  assert.equal(salaRectangular({ id: 'a', ancho: 5.555, fondo: 4, alto: 3 }).planta.ancho, 5.56);
  assert.equal(salaRectangular({ id: 'a', ancho: 5, fondo: 4, alto: 3 }).nombre, 'a');
});

test('room sizes are checked before building it', () => {
  assert.deepEqual(comprobarSala({ ancho: 10, fondo: 6, alto: 3 }), []);
  assert.deepEqual(comprobarSala({ ancho: 0, fondo: NaN, alto: 31 }).map(e => e.codigo), ['ancho', 'fondo', 'alto']);
  assert.ok(comprobarSala({ ancho: 600, fondo: 6, alto: 3 })[0].en.includes('width'));
  assert.throws(() => salaRectangular({ id: 'Mi Tienda', ancho: 10, fondo: 6, alto: 3 }), TypeError);
  assert.throws(() => salaRectangular({ id: 'mi-tienda', ancho: 10, fondo: 0.5, alto: 3 }), RangeError);
});

test('traces are scaled down to 2400 px on their longest side, never up', () => {
  assert.equal(MAX_LADO, 2400);
  assert.deepEqual(escalaCalco(4800, 1200), { w: 2400, h: 600, factor: 0.5 });
  assert.deepEqual(escalaCalco(1000, 3000), { w: 800, h: 2400, factor: 0.8 });
  assert.deepEqual(escalaCalco(800, 600), { w: 800, h: 600, factor: 1 });
  assert.equal(escalaCalco(0, 10), null);
  // Un A4 (595 × 842 pt) se amplía hasta 2400 px de alto; un A0 se reduce.
  assert.ok(Math.abs(escalaPdf(595, 842) * 842 - 2400) < 1e-9);
  assert.ok(escalaPdf(2384, 3370) < 1);
  assert.equal(escalaPdf(0, 0), 1);
});

test('a trace sits at the top-left corner of the walls with its real width and image proportion', () => {
  const calco = nuevoCalco({ dataUrl: PNG, pxAncho: 1400, pxAlto: 800, fichero: 'plano.png', ancho: anchoSala(starbucks) });
  assert.equal(calco.ancho, 14); assert.equal(calco.opacidad, 0.5);
  assert.ok(calcoValido(calco));
  assert.deepEqual(geometriaCalco(calco, starbucks), { x: 0, y: 0, width: 14, height: 8 });
  const moved = { paredes: starbucks.paredes.map(w => ({ ...w, a: [w.a[0] + 2, w.a[1] + 1], b: [w.b[0] + 2, w.b[1] + 1] })) };
  assert.deepEqual(geometriaCalco({ ...calco, ancho: 7 }, moved), { x: 2, y: 1, width: 7, height: 4 });
  assert.equal(anchoSala({ paredes: moved.paredes }), 14);
  assert.equal(nuevoCalco({ dataUrl: PNG, pxAncho: 1, pxAlto: 1, ancho: 3, opacidad: 7 }).opacidad, 1);
  assert.ok(!calcoValido({ ...calco, dataUrl: 'javascript:alert(1)' }));
  assert.ok(!calcoValido({ ...calco, dataUrl: 'data:text/html,<script>' }));
  assert.ok(!calcoValido({ ...calco, ancho: 0 }));
  assert.ok(calcoValido({ ...calco, dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }));
});

test('the stored record is { id, plan | null, calco | null, fichero, subidoEn }', () => {
  const sala = salaRectangular({ id: 'mi-tienda', ancho: 10, fondo: 6, alto: 3 });
  const calco = nuevoCalco({ dataUrl: PNG, pxAncho: 100, pxAlto: 60, fichero: 'plano.png', ancho: 10 });
  const r = registroSubida({ id: 'mi-tienda', plan: sala, calco, fichero: 'plano.png', subidoEn: '2026-10-14T10:00:00.000Z' });
  assert.deepEqual(Object.keys(r), ['id', 'plan', 'calco', 'fichero', 'subidoEn']);
  assert.notEqual(r.plan, sala, 'the plan is copied');
  assert.ok(registroValido(r, 'mi-tienda'));
  assert.ok(!registroValido(r, 'otra'));
  assert.ok(registroValido(registroSubida({ id: 'alsea-sbux-021', calco }), 'alsea-sbux-021'), 'a trace over the published plan');
  assert.ok(!registroValido(registroSubida({ id: 'mi-tienda' }), 'mi-tienda'), 'nothing uploaded is not a record');
  assert.equal(registroSubida({ id: 'mi-tienda', calco: { dataUrl: 'x' } }).calco, null);
  assert.equal(registroSubida({ id: '../x', plan: sala }), null);
  assert.match(registroSubida({ id: 'a', plan: sala }).subidoEn, /^\d{4}-\d\d-\d\dT/);
});

test('without IndexedDB the store degrades cleanly', async () => {
  const store = almacenPlanos(undefined);
  assert.equal(await store.disponible(), false);
  assert.equal(await store.leer('alsea-sbux-021'), null);
  assert.equal(await store.guardar({ id: 'x' }), false);
  assert.equal(await store.borrar('x'), false);
  const throwing = almacenPlanos({ open() { throw new Error('SecurityError'); } });
  assert.equal(await throwing.leer('x'), null);
});

test('reading window.indexedDB may throw: the module and the store survive', async () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { throw new Error('SecurityError: storage blocked'); } });
  try {
    const store = almacenPlanos();
    assert.equal(await store.leer('alsea-sbux-021'), null);
    assert.equal(await store.disponible(), false);
    assert.equal(await store.guardar({ id: 'x' }), false);
  } finally {
    if (before) Object.defineProperty(globalThis, 'indexedDB', before); else delete globalThis.indexedDB;
  }
});

test('an IndexedDB open that never answers times out instead of blocking the page', async () => {
  assert.equal(ESPERA_IDB, 1500);
  const hanging = { open() { return {}; } }; // la petición no dispara nunca onsuccess ni onerror
  const store = almacenPlanos(hanging, { espera: 40 });
  const t0 = Date.now();
  assert.equal(await store.leer('alsea-sbux-021'), null);
  assert.equal(await store.guardar({ id: 'x' }), false);
  assert.equal(await store.disponible(), false);
  assert.ok(Date.now() - t0 < 1000, 'each call gives up after its wait');
  // El tope de init: el plano publicado no espera a IndexedDB.
  assert.equal(await conTiempo(new Promise(() => {}), 20, null), null);
  assert.equal(await conTiempo(Promise.resolve('subido'), 1000, null), 'subido');
  assert.equal(await conTiempo('ya', 10), 'ya');
});

test('every published floor plan reads as a valid plan with no plano-core errors and ships on admira.biz', () => {
  const C = createRequire(import.meta.url)('../expert-commands.js');
  assert.ok(C.PLANOS.some(p => p.id === 'lab-gran-de-gracia-51'));
  for (const p of C.PLANOS) {
    const file = `data/xpacios/${p.id}.json`;
    const r = leerPlanoJson(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), p.id);
    assert.equal(r.ok, true, `${p.id}: ${JSON.stringify(r.errores)}`);
    assert.equal(r.id, p.id);
    assert.equal(r.plan.schema, SCHEMA);
    assert.deepEqual(validate(r.plan).filter(i => i.nivel === 'error'), [], p.id);
    assert.ok(BIZ_ASSET_FILES.includes(file), file);
  }
});

test('the Gran de Gràcia 51 lab keeps its camera survey sizes and its ITIL codes from Yokup', () => {
  const lab = JSON.parse(readFileSync(new URL('../data/xpacios/lab-gran-de-gracia-51.json', import.meta.url), 'utf8'));
  assert.deepEqual(lab.planta, { ancho: 3.45, fondo: 3.5, alto: 3.1 });
  assert.deepEqual(lab.pantallas.map(s => s.itil).sort(), ['GDG51-PAN-01', 'GDG51-PAN-02', 'GDG51-PAN-03', 'GDG51-PAN-04', 'GDG51-PAN-05', 'GDG51-PAN-06', 'GDG51-PAN-07']);
  assert.deepEqual(lab.dispositivos.map(d => d.itil), ['GDG51-PLY-01', 'GDG51-PLY-02', 'GDG51-PLY-03', 'GDG51-CAM-01']);
  for (const d of lab.dispositivos) assert.ok(lab.paredes.some(w => w.id === d.pared), d.id);
  assert.equal(lab.yokup.cis, lab.pantallas.length + lab.dispositivos.length);
  assert.match(lab.yokup.portal, /^https:\/\/admira\.app\//);
  assert.deepEqual(validate(lab), [], 'no warnings either');
});

test('the upload module ships with the floor plan page on admira.biz', () => {
  assert.ok(BIZ_ASSET_FILES.includes('plano-subida.mjs'));
  const html = readFileSync(new URL('../plano.html', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../plano.mjs', import.meta.url), 'utf8');
  // plano.mjs y plano.css salen con el mismo sello; el módulo de subida, con el suyo.
  const stamp = html.match(/plano\.mjs\?v=(\d{8}-[a-z0-9-]+)"/)[1];
  assert.ok(html.includes(`plano.css?v=${stamp}"`), stamp);
  assert.match(page, /plano-subida\.mjs\?v=20261014-subir-1/);
  assert.match(html, /id="upload"[^>]*data-shell-slot="advanced"/);
  // pdf.js solo bajo demanda, con versión exacta y su worker de la misma versión.
  assert.doesNotMatch(html, /pdf\.min\.js/);
  assert.match(page, /cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\//);
  assert.match(page, /isEvalSupported: false/);
});
