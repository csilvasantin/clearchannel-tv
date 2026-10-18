import test from 'node:test';
import assert from 'node:assert/strict';
import {
  homografia, aplicar, tamRecorte, validarEsquinas, ordenarEsquinas, enderezar, siguientesNumeros, revisarEncargo, recetaDetallar,
  MUEBLES, CONTENIDOS, RECETA_SCHEMA, slug
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
