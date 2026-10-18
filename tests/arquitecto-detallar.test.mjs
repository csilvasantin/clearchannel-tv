import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  homografia, aplicar, tamRecorte, validarEsquinas, ordenarEsquinas, enderezar, siguientesNumeros, revisarEncargo, recetaDetallar,
  sitioEnPlano, juntoA, revisarSitios, siguientesCodigos, MUEBLES, CONTENIDOS, RECETA_SCHEMA, HUELLA, INVENTARIOS, slug
} from '../arquitecto-detallar.mjs';

// Arquitecto · «detallar»: fotos → recortes enderezados → receta del Taller 3D (xpaceos.taller-3d.receta/1).
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const cesta = (over = {}) => ({
  nombre: 'Cestas visita', local: 'alsea-sbux-021', autor: 'Carlos', lugar: 'Starbucks Paseo de Gràcia', fecha: '2026-10-18',
  piezas: [{ nombre: 'Cesta de café 1971', numero: 56, mueble: 'cesta_alta', contenido: 'bolsas_de_pie', cantidad: 11, cartel: { ancho: 0.28, alto: 0.98 } },
           { nombre: 'Cesta de vasos', numero: 57, mueble: 'cesta_baja', contenido: 'vasos', cantidad: 28 }],
  recortes: [{ nombre: 'frente bolsa', pieza: 0, rol: 'frente', png: PNG, esquinas: [[0, 0], [10, 0], [10, 20], [0, 20]], foto: 0 },
             { nombre: 'cartel 1971', pieza: 0, rol: 'cartel', png: PNG, tam: [440, 1024], esquinas: [[0, 0], [10, 0], [10, 20], [0, 20]], foto: 1 },
             { nombre: 'sirena', pieza: 1, rol: 'logo', png: PNG, esquinas: [[0, 0], [10, 0], [10, 10], [0, 10]], foto: 2 }],
  ...over
});

test('the homography maps the four marked corners onto the rectangle', () => {
  const src = [[12, 30], [210, 18], [230, 260], [5, 240]], H = homografia([[0, 0], [100, 0], [100, 200], [0, 200]], src);
  for (const [i, [u, v]] of [[0, 0], [100, 0], [100, 200], [0, 200]].entries()) {
    const [x, y] = aplicar(H, u, v); assert.ok(Math.abs(x - src[i][0]) < 1e-6 && Math.abs(y - src[i][1]) < 1e-6);
  }
});

test('crossed or degenerate corners are refused instead of producing a twisted texture', () => {
  assert.throws(() => validarEsquinas([[0, 0], [10, 0], [0, 10], [10, 10]]), /cruzadas/);
  assert.throws(() => validarEsquinas([[0, 0], [10, 0]]), /esquinas/);
  assert.equal(validarEsquinas([[0, 0], [10, 0], [10, 10], [0, 10]]), true);
});

test('corners clicked in any order become top-left, top-right, bottom-right, bottom-left', () => {
  const ok = [[10, 12], [200, 8], [210, 300], [4, 290]];
  for (const orden of [[2, 0, 3, 1], [1, 2, 3, 0], [3, 2, 1, 0]]) assert.deepEqual(ordenarEsquinas(orden.map(i => ok[i])), ok);
});

test('crop size follows the marked sides and is capped at 1024 px', () => {
  assert.deepEqual(tamRecorte([[0, 0], [300, 0], [300, 600], [0, 600]]), [300, 600]);
  const [w, h] = tamRecorte([[0, 0], [4000, 0], [4000, 2000], [0, 2000]]); assert.equal(w, 1024); assert.equal(h, 512);
});

test('rectifying a tilted square of a synthetic photo returns its flat colours', () => {
  // Foto 64x64 gris con un cuadrado rojo girado 45º; enderezado debe quedar casi todo rojo.
  const W = 64, data = new Uint8ClampedArray(W * W * 4).fill(128);
  const dentro = (x, y) => Math.abs(x - 32) + Math.abs(y - 32) < 20;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (dentro(x + 0.5, y + 0.5)) { const o = (y * W + x) * 4; data[o] = 220; data[o + 1] = 20; data[o + 2] = 30; data[o + 3] = 255; }
  const out = enderezar({ width: W, height: W, data }, [[32, 16], [48, 32], [32, 48], [16, 32]], [20, 20]);
  let rojos = 0; for (let i = 0; i < out.data.length; i += 4) if (out.data[i] > 180 && out.data[i + 1] < 70) rojos++;
  assert.ok(rojos / (20 * 20) > 0.9, 'el interior enderezado es el cuadrado rojo');
});

test('new catalogue numbers continue the public registry without reusing any', () => {
  assert.deepEqual(siguientesNumeros({ numbers: { a: 1, b: 52, c: 55 } }, 3), [56, 57, 58]);
  assert.deepEqual(siguientesNumeros(null, 2), [1, 2]);
});

test('the request review asks for the faces each content needs before writing a recipe', () => {
  assert.equal(revisarEncargo(cesta()).ok, true);
  const sinLogo = revisarEncargo(cesta({ recortes: cesta().recortes.slice(0, 2) }));
  assert.equal(sinLogo.ok, false); assert.ok(sinLogo.errores.includes('pieza-1-falta-logo'));
  assert.ok(revisarEncargo(cesta({ local: '' })).errores.includes('local'));
  const sinNumero = revisarEncargo(cesta({ piezas: [{ ...cesta().piezas[1], numero: null }], recortes: [{ ...cesta().recortes[2], pieza: 0 }] }));
  assert.equal(sinNumero.ok, true); assert.ok(sinNumero.avisos.includes('pieza-0-numero'));
});

test('the recipe is a workshop recipe: object crops embedded, no photos, textures for every face the pieces use', () => {
  const r = recetaDetallar(cesta());
  assert.equal(r.schema, RECETA_SCHEMA); assert.equal(r.fotos.publicables, false); assert.equal(r.local, 'alsea-sbux-021');
  assert.match(r.encargo, /^cestas-visita-alsea-sbux-021-2026-10-18$/); assert.equal(r.fuentes, r.encargo);
  assert.equal(Object.keys(r.fuentes_embebidas).length, 3); assert.ok(Object.values(r.fuentes_embebidas).every(v => v.startsWith('data:image/png;base64,')));
  const salidas = new Set(r.texturas.map(op => op.salida).filter(Boolean)), fuentes = new Set(Object.keys(r.fuentes_embebidas));
  for (const op of r.texturas.filter(op => op.fuente)) assert.ok(fuentes.has(op.fuente), op.fuente);
  const [cafe, vasos] = r.piezas;
  assert.equal(cafe.numero, 56); assert.match(cafe.id, /^native:starbucks[A-Z]/); assert.equal(cafe.instancia, 'sb-cesta-de-cafe-1971');
  assert.deepEqual(cafe.mueble.borde, MUEBLES.cesta_alta.borde); assert.equal(cafe.contenido.familia, 'bolsas_de_pie');
  for (const f of Object.values(cafe.contenido.caras)) assert.ok(salidas.has(f), f);
  assert.equal(cafe.carteles.length, 1); assert.ok(salidas.has(cafe.carteles[0].textura)); assert.equal(cafe.carteles[0].ancho, 0.28);
  assert.equal(vasos.contenido.familia, 'vasos'); assert.equal(vasos.contenido.cantidad, 28);
  for (const [, file] of Object.values(vasos.contenido.materiales)) assert.ok(salidas.has(file), file);
  assert.ok(r.recortes.every(x => !('png' in x)), 'el índice de recortes no repite las imágenes');
  assert.ok(!JSON.stringify(r).includes('data:image/jpeg'), 'ninguna foto original viaja en la receta');
});

test('every content family and fixture offered by the Architect is one the workshop knows', () => {
  assert.deepEqual(Object.keys(CONTENIDOS).sort(), ['bolsas_almohada', 'bolsas_de_pie', 'ninguno', 'vasos']);
  for (const m of Object.values(MUEBLES)) { assert.equal(m.familia, 'cesta_trenzada'); assert.ok(m.borde[0] > m.fondo[0] && m.borde[1] >= m.fondo[1]); }
  assert.equal(slug('Cesta de Café «1971»'), 'cesta-de-cafe-1971');
});

// ── Dónde va (mejora 2, 18-oct-2026): sitio en el plano del local y alta ITIL ──
const PLANO = JSON.parse(fs.readFileSync(new URL('../data/xpacios/alsea-sbux-021.json', import.meta.url)));
const INVENTARIO = { location_id: 'alsea-sbux-021', units: ['PDG103-BAR-01', 'PDG103-MES-02', 'PDG103-CES-01', 'PDG103-CES-02', 'PDG103-CES-03', 'otro'].map(itil_code => ({ itil_code })) };

test('a tap on the plan becomes the footprint corner, centred on the tap and kept inside the room', () => {
  assert.deepEqual(sitioEnPlano(PLANO, [2.36, 4.12]), { x: 2.04, y: 3.8 });
  assert.deepEqual(sitioEnPlano(PLANO, [-3, 99]), { x: 0, y: PLANO.planta.fondo - HUELLA });
  assert.throws(() => sitioEnPlano({ planta: { ancho: 0, fondo: 0 } }, [1, 1]), /plano/);
});

test('the published baskets sit inside the Paseo de Gràcia plan, next to the furniture Carlos named', () => {
  // Las posiciones del gemelo (starbucks-room.js): vasos y snacks junto al pilar; café 1971 frente a la estantería de tazas.
  const cestas = [{ nombre: 'vasos', sitio: { x: 2.04, y: 3.8 } }, { nombre: 'snacks', sitio: { x: 2.74, y: 4.18 } }, { nombre: 'café', sitio: { x: 1.08, y: 4.98 } }];
  assert.deepEqual(cestas.map(c => juntoA(PLANO, c.sitio)), ['Pilar', 'Pilar', 'Tazas']);
  const r = revisarSitios(PLANO, cestas);
  assert.deepEqual(r.fuera, []);
  assert.ok(r.solapes.some(x => x.pieza === 0 && x.con === 'Pilar'), 'el plano es esquemático: el solape es aviso, no error');
  assert.equal(juntoA(PLANO, { x: 10, y: 7.2 }), null, 'nada a menos de 1,5 m');
});

test('a spot outside the room is an error; overlaps between pieces are only warnings', () => {
  const r = revisarSitios(PLANO, [{ nombre: 'a', sitio: { x: 13.8, y: 1 } }, { nombre: 'b', sitio: { x: 9, y: 5 } }, { nombre: 'c', sitio: { x: 9.3, y: 5.2 } }]);
  assert.deepEqual(r.fuera, [0]);
  assert.deepEqual(r.solapes, [{ pieza: 1, con: 'c', otra: 2 }]);
});

test('ITIL codes continue the venue family in the public inventory and never repeat', () => {
  assert.deepEqual(siguientesCodigos(INVENTARIO, 'CES', 2), ['PDG103-CES-04', 'PDG103-CES-05']);
  assert.deepEqual(siguientesCodigos(INVENTARIO, 'CES', 1, ['PDG103-CES-04']), ['PDG103-CES-05']);
  assert.deepEqual(siguientesCodigos(INVENTARIO, 'EXP', 1), ['PDG103-EXP-01']);
  assert.deepEqual(siguientesCodigos(null, 'CES', 2), [null, null]);
  assert.ok(INVENTARIOS['alsea-sbux-021'].startsWith('https://www.xpaceos.com/inventario/'));
  for (const m of Object.values(MUEBLES)) assert.equal(m.itil, 'CES');
});

test('with a plan every piece needs its spot; without one the recipe is allowed but warned', () => {
  const sinSitio = revisarEncargo(cesta({ plano: PLANO }));
  assert.equal(sinSitio.ok, false); assert.ok(sinSitio.errores.includes('pieza-0-falta-sitio') && sinSitio.errores.includes('pieza-1-falta-sitio'));
  const sinPlano = revisarEncargo(cesta());
  assert.equal(sinPlano.ok, true); assert.ok(sinPlano.avisos.includes('sin-plano') && sinPlano.avisos.includes('pieza-0-itil'));
  const malItil = revisarEncargo(cesta({ piezas: cesta().piezas.map(p => ({ ...p, itil: 'pdg 4' })) }));
  assert.ok(malItil.errores.includes('pieza-0-itil-formato'));
  const repetido = revisarEncargo(cesta({ piezas: cesta().piezas.map(p => ({ ...p, itil: 'PDG103-CES-04' })) }));
  assert.ok(repetido.errores.includes('pieza-1-itil-repetido'));
});

test('the recipe says where each piece goes, in twin grid units, and carries its Yokup CI', () => {
  const piezas = cesta().piezas.map((p, i) => ({ ...p, sitio: [{ x: 1.08, y: 4.98 }, { x: 2.04, y: 3.8 }][i], itil: ['PDG103-CES-04', 'PDG103-CES-05'][i] }));
  const r = recetaDetallar(cesta({ plano: PLANO, piezas }));
  assert.deepEqual(r.plano, { id: 'alsea-sbux-021', version: PLANO.version });
  const [cafe, vasos] = r.piezas;
  assert.deepEqual(cafe.colocacion, { xpacio: 'alsea-sbux-021', plano: PLANO.version, x: 1.08, y: 4.98, huella: [HUELLA, HUELLA], junto_a: 'Tazas' });
  assert.equal(vasos.colocacion.junto_a, 'Pilar');
  assert.deepEqual(Object.keys(cafe.itil).sort(), ['admira_store_id', 'category', 'group_name', 'itil_code', 'name', 'position', 'role']);
  assert.equal(cafe.itil.itil_code, 'PDG103-CES-04'); assert.equal(cafe.itil.position, cafe.instancia); assert.equal(cafe.itil.admira_store_id, 'alsea-sbux-021');
  assert.match(cafe.itil.role, /^Taller 3D · catálogo 56 · bolsas de pie de relleno visual, sin stock medido$/);
  for (const p of r.piezas) assert.ok(p.itil.role.length <= 120, 'Yokup limita role a 120 caracteres');
  const sinPlano = recetaDetallar(cesta());
  assert.equal(sinPlano.plano, null); assert.ok(sinPlano.piezas.every(p => p.colocacion === null && p.itil.itil_code === null));
});
