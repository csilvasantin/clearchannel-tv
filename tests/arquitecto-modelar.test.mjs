import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  layoutGemelo, colocacionDatos, dxfPlanta, resumenModelo, tipoMueble, txt, urlGemelo3D, urlGemelo2D, modeloCatalogo,
  COLOCACION_SCHEMA, CAPAS_DXF, TIPOS_MUEBLE
} from '../arquitecto-modelar.mjs';

// Arquitecto · «modelar» (18-oct-2026): del plano del local al gemelo 3D, la colocación como datos y la planta en DXF.
const PLANO = JSON.parse(readFileSync(new URL('../data/xpacios/alsea-sbux-021.json', import.meta.url), 'utf8'));
// Layout del gemelo de XpaceOS para Paseo de Gràcia (admira-xp/scripts/starbucks-room.js, 18-oct-2026). El test gemelo
// de xpaceos (plano3d.test.mjs) compara su copia pública del plano con el starbucks-room.js vivo.
const GEMELO = [
  ['starbucks-ipad-01', 'ipadLandscape', 'native:ipadLandscape', 7.6, 0.4, [0.65, 0.35], 0.96],
  ['sb-backbar', 'counter', undefined, 3, 0, [10, 1]], ['sb-pos', 'counter', undefined, 3, 3, [4, 1]], ['sb-pastry', 'vending', undefined, 7, 3, [6, 1]],
  ['sb-mugs', 'shelves', undefined, 0, 3, [1, 3]], ['sb-pillar', 'custom', undefined, 2, 3, [1, 1]],
  ['sb-table-a', 'cafeTable', undefined, 3, 6, [2, 2]], ['sb-table-b', 'cafeTable', undefined, 6, 6, [2, 2]],
  ['sb-cup-basket', 'starbucksCupBasket', 'native:starbucksCupBasket', 2.04, 3.8, [0.64, 0.64]],
  ['sb-snack-basket', 'starbucksSnackBasket', 'native:starbucksSnackBasket', 2.74, 4.18, [0.64, 0.64]],
  ['sb-coffee-basket', 'starbucksCoffeeBasket', 'native:starbucksCoffeeBasket', 1.08, 4.98, [0.64, 0.64]],
];
const pares = dxf => { const l = dxf.split('\n'); const out = []; for (let i = 0; i + 1 < l.length; i += 2) out.push([l[i].trim(), l[i + 1]]); return out; };

test('Paseo de Gràcia: the placement taken from the plan is the store twin, piece by piece', () => {
  const lay = new Map(layoutGemelo(PLANO).map(i => [i.id, i]));
  assert.equal(lay.size, GEMELO.length);
  for (const [id, type, asset, col, row, fp, mountY] of GEMELO) {
    const p = lay.get(id); assert.ok(p, id);
    assert.deepEqual([p.type, p.inventoryAssetId, p.col, p.row, p.fp, p.mountY], [type, asset, col, row, fp, mountY], id);
  }
});

test('furniture types: the plan says it, otherwise the name; catalogue pieces point at their xpaceos model', () => {
  assert.equal(tipoMueble({ id: 'x', nombre: 'Mesa', tipo: 'cesta' }), 'cesta');
  assert.equal(tipoMueble({ id: 'barra-2', nombre: 'Mostrador' }), 'barra');
  assert.equal(tipoMueble({ id: 'x', nombre: 'Algo', tipo: 'otro' }), 'mueble');
  assert.ok(TIPOS_MUEBLE.includes('ipad'));
  assert.equal(modeloCatalogo({ catalogo: { id: 'native:starbucksCupBasket', numero: 53 } }), 'https://www.xpaceos.com/inventario/assets/catalog/53/better.glb');
  assert.equal(modeloCatalogo({ catalogo: { id: 'otro:x', numero: 53 } }), null);
  assert.equal(urlGemelo3D('alsea-sbux-021'), 'https://www.xpaceos.com/xpacios/starbucks-paseo-de-gracia/');
  assert.equal(urlGemelo3D('altadis-cafe-01'), 'https://www.xpaceos.com/xpacios/gran-de-gracia-51/?loc=altadis-cafe-01');
  assert.match(urlGemelo2D('alsea-sbux-021'), /^https:\/\/www\.xpaceos\.com\/admira-xp\/\?loc=alsea-sbux-021/);
  assert.equal(urlGemelo2D('altadis-cafe-01'), null);
});

test('the summary counts what the twin will draw and warns about a schematic plan', () => {
  const r = resumenModelo(PLANO);
  assert.equal(r.ok, true); assert.deepEqual(r.sala, { ancho: 14, fondo: 8, alto: 3.3 });
  assert.equal(r.muebles, 11); assert.equal(r.pantallas, 6);
  assert.deepEqual(r.piezasCatalogo.map(p => p.numero), [52, 53, 54, 55]);
  assert.ok(r.avisos.some(a => a.codigo === 'esquematico'));
  const viejo = resumenModelo({ ...PLANO, mobiliario: PLANO.mobiliario.map(({ tipo, gemelo, ...m }) => m) });
  assert.ok(viejo.avisos.some(a => a.codigo === 'tipo-deducido' && a.n === 11) && viejo.avisos.some(a => a.codigo === 'sin-gemelo-2d'));
  assert.equal(resumenModelo(null).ok, false);
});

test('placement as data: every piece with its spot, model and ITIL code, plus the twin layout and links', () => {
  const c = colocacionDatos(PLANO, { fecha: '2026-10-18' });
  assert.equal(c.schema, COLOCACION_SCHEMA); assert.deepEqual(c.plano, { id: 'alsea-sbux-021', version: PLANO.version });
  assert.equal(c.piezas.length, 11); assert.equal(c.pantallas.length, 6);
  const cafe = c.piezas.find(p => p.id === 'cesta-cafe');
  assert.deepEqual({ x: cafe.x, y: cafe.y, w: cafe.w, d: cafe.d, itil: cafe.itil, gemelo: cafe.gemelo, numero: cafe.catalogo.numero },
    { x: 1.08, y: 4.98, w: 0.64, d: 0.64, itil: 'PDG103-CES-03', gemelo: 'sb-coffee-basket', numero: 55 });
  assert.equal(c.piezas.find(p => p.id === 'ipad-tpv').base, 0.96);
  assert.ok(c.pantallas.every(s => s.w > 0 && s.h > 0));
  assert.equal(c.gemelo.layout.length, 11); assert.match(c.gemelo.url3d, /starbucks-paseo-de-gracia/);
  assert.throws(() => colocacionDatos({}), /plano/);
});

test('the DXF floor plan is a closed R12 file in metres, with walls, door, furniture, catalogue pieces and screens', () => {
  const { dxf, capas, entidades } = dxfPlanta(PLANO, { fecha: '2026-10-18' });
  const p = pares(dxf);
  assert.deepEqual(p[0], ['0', 'SECTION']); assert.deepEqual(p.at(-1), ['0', 'EOF']);
  assert.ok(p.some(([c, v]) => c === '1' && v === 'AC1009'), 'AutoCAD R12');
  for (const capa of Object.keys(CAPAS_DXF)) assert.ok(p.some(([c, v], i) => c === '2' && v === capa && p[i - 1][1] === 'LAYER'), capa);
  assert.ok(capas.MUROS >= 4 && capas.PUERTAS === 2 && capas.MOBILIARIO === 7 && capas.PIEZAS === 4 && capas.PANTALLAS === 6, JSON.stringify(capas));
  assert.equal(entidades, Object.values(capas).reduce((a, b) => a + b, 0));
  assert.equal(p.filter(([c, v]) => c === '0' && v === 'CIRCLE').length, 3, 'las tres cestas');
  // Coordenadas finitas y dentro del dibujo; la pared del fondo (y = 0 del plano) queda arriba (Y = 8).
  const xs = p.filter(([c]) => c === '10').map(([, v]) => +v), ys = p.filter(([c]) => c === '20').map(([, v]) => +v);
  assert.ok([...xs, ...ys].every(Number.isFinite));
  assert.ok(Math.min(...xs) >= -1 && Math.max(...xs) <= 15.5 && Math.min(...ys) >= -1.2 && Math.max(...ys) <= 9.2);
  assert.ok(p.every(([, v]) => /^[\x20-\x7e]*$/.test(v)), 'sólo ASCII en un R12');
  assert.ok(dxf.includes('Cesta de cafe 1971 #55') && dxf.includes('Barra - espresso'));
  assert.throws(() => dxfPlanta({ planta: {} }), /plano/);
});

test('DXF text is plain ASCII: accents dropped and symbols replaced', () => {
  assert.equal(txt('Cesta de café «1971» · Gràcia × 3'), 'Cesta de cafe "1971" - Gracia x 3');
  assert.equal(txt('línea\nnueva'), 'linea nueva');
});
