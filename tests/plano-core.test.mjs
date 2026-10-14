import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCHEMA, panelSize, hLayout, footprint, validate, workOrder, exportOrder, restoreProposal, placeNew, template,
  clampToWall, wallLength, inwardNormal, moveGroup, composition, groupCanvas, reshape
} from '../plano-core.mjs';
import { BIZ_ASSET_FILES, bizAssetPath } from '../server/biz-assets.mjs';

const starbucks = JSON.parse(readFileSync(new URL('../data/xpacios/alsea-sbux-021.json', import.meta.url), 'utf8'));
const MURAL = 'mural-doble-h';

const plan = {
  schema: SCHEMA, id: 'demo', nombre: 'Demo', version: 'demo-1',
  planta: { ancho: 10, fondo: 8, alto: 3.2 },
  paredes: [
    { id: 'N', nombre: 'Fachada', a: [0, 0], b: [10, 0] },
    { id: 'E', nombre: 'Este', a: [10, 0], b: [10, 8] },
    { id: 'S', nombre: 'Fondo', a: [10, 8], b: [0, 8] },
    { id: 'O', nombre: 'Oeste', a: [0, 8], b: [0, 0] }
  ],
  huecos: [
    { id: 'puerta', tipo: 'puerta', pared: 'N', desde: 4, ancho: 2, base: 0, alto: 2.4 },
    { id: 'esc', tipo: 'escaparate', pared: 'N', desde: 6.5, ancho: 3, base: 0.4, alto: 2.4 }
  ],
  mobiliario: [{ id: 'barra', nombre: 'Barra', x: 2, y: 7, w: 5, d: 0.8, alto: 1.1 }],
  pantallas: [
    { id: 'v1', itil: 'CI-1', nombre: 'Vertical', tipo: 'pantalla', orientacion: 'vertical', pulgadas: 55, pared: 'E', s: 2, z: 1 },
    { id: 'h1', itil: 'CI-2', nombre: 'Horizontal', tipo: 'pantalla', orientacion: 'horizontal', pulgadas: 55, pared: 'E', s: 5, z: 1.5 }
  ]
};

test('a 55-inch 16:9 panel measures about 1.22 × 0.68 m and swaps when vertical', () => {
  const h = panelSize({ pulgadas: 55 });
  assert.ok(Math.abs(h.w - 1.2176) < 0.001 && Math.abs(h.h - 0.6849) < 0.001);
  const v = panelSize({ pulgadas: 55, orientacion: 'vertical' });
  assert.equal(v.w, h.h); assert.equal(v.h, h.w);
  assert.deepEqual(panelSize({ orientacion: 'vertical', dimensiones: { ancho: 1.23, alto: 0.71 } }), { w: 0.71, h: 1.23 });
});

test('walls run clockwise so the inward normal points into the shop', () => {
  const r = v => v.map(n => Math.round(n) + 0);
  assert.deepEqual(r(inwardNormal(plan.paredes[0])), [0, 1]);
  assert.deepEqual(r(inwardNormal(plan.paredes[1])), [-1, 0]);
  assert.equal(wallLength(plan.paredes[1]), 8);
});

test('an H is a portrait, a centred landscape and a portrait, touching', () => {
  const [a, b, c] = hLayout(55);
  const fa = footprint({ ...a, pulgadas: 55 }), fb = footprint({ ...b, pulgadas: 55 }), fc = footprint({ ...c, pulgadas: 55 });
  assert.ok(Math.abs(fa.x1 - fb.x0) < 1e-9 && Math.abs(fb.x1 - fc.x0) < 1e-9);
  assert.ok(Math.abs((fb.z0 + fb.z1) / 2 - (fa.z0 + fa.z1) / 2) < 1e-9);
});

test('Starbucks 103 is the studio double-H mural and validates cleanly', () => {
  assert.equal(starbucks.schema, SCHEMA);
  assert.equal(composition(starbucks.pantallas, MURAL), 'V–H–V–V–H–V');
  assert.deepEqual(groupCanvas(starbucks.pantallas, MURAL), [8160, 1920]);
  assert.deepEqual(validate(starbucks), []);
  assert.deepEqual([...new Set(starbucks.pantallas.map(s => s.player))], ['Mac Studio', 'Mac mini']);
  assert.ok(starbucks.pantallas.every(s => s.itil === null && s.screenId), 'no invented ITIL codes');
  assert.match(starbucks.fuente.titulo, /esquemático/);
});

test('validation catches overlaps, doors, walls, ceiling, furniture and low screens', () => {
  const moved = plan.pantallas.map(s => s.id === 'h1' ? { ...s, s: 2.3, z: 1.2 } : s);
  assert.ok(validate(plan, moved).some(i => i.codigo === 'solape' && i.nivel === 'error'));
  const door = [{ ...plan.pantallas[1], pared: 'N', s: 5, z: 1.5 }];
  assert.ok(validate(plan, door).some(i => i.codigo === 'tapa-hueco' && i.nivel === 'error'));
  const shopWindow = [{ ...plan.pantallas[1], pared: 'N', s: 8, z: 1.5 }];
  assert.ok(validate(plan, shopWindow).some(i => i.codigo === 'tapa-hueco' && i.nivel === 'aviso'));
  assert.ok(!validate(plan, [{ ...shopWindow[0], escaparate: true }]).some(i => i.codigo === 'tapa-hueco'));
  assert.ok(validate(plan, [{ ...plan.pantallas[1], s: 7.8 }]).some(i => i.codigo === 'fuera-de-pared'));
  assert.ok(validate(plan, [{ ...plan.pantallas[1], z: 2.8 }]).some(i => i.codigo === 'techo'));
  assert.ok(validate(plan, [{ ...plan.pantallas[1], z: 0.5 }]).some(i => i.codigo === 'baja'));
  const behindBar = [{ ...plan.pantallas[1], pared: 'S', s: 5, z: 0.95 }];
  assert.ok(validate(plan, behindBar).some(i => i.codigo === 'mueble-delante'));
  assert.ok(!validate(plan, [{ ...behindBar[0], z: 1.3 }]).some(i => i.codigo === 'mueble-delante'));
});

test('mosaic screens may touch but not overlap; loose screens need a margin', () => {
  const mural = starbucks.pantallas;
  const pushed = mural.map((s, i) => i === 1 ? { ...s, s: s.s - 0.05 } : s);
  assert.ok(validate(starbucks, pushed).some(i => i.codigo === 'solape'));
  const loose = mural.map(s => ({ ...s, grupo: undefined }));
  assert.ok(validate(starbucks, loose).some(i => i.codigo === 'solape'), 'without a group the 5 cm margin applies');
});

test('moving the whole mural keeps its shape and is one work-order line', () => {
  const ids = starbucks.pantallas.map(s => s.id);
  const moved = moveGroup(starbucks, starbucks.pantallas, ids, { ds: 1.234, dz: 0.1 });
  assert.equal(composition(moved, MURAL), 'V–H–V–V–H–V');
  assert.deepEqual(validate(starbucks, moved), []);
  moved.forEach((s, i) => assert.ok(Math.abs(s.s - starbucks.pantallas[i].s - 1.23) < 1e-9));
  const { acciones } = workOrder(starbucks, moved);
  assert.equal(acciones.length, 1);
  assert.equal(acciones[0].tipo, 'modificacion');
  assert.equal(acciones[0].cis.length, 6);
  assert.match(acciones[0].obra[0], /Trasladar el mural doble H entero 1,23 m a la derecha y 0,1 m más arriba/);
  assert.ok(!acciones[0].contenidos, 'a rigid move does not touch the studio installation');
  const clamped = moveGroup(starbucks, starbucks.pantallas, ids, { ds: 99 });
  assert.ok(Math.max(...clamped.map(s => footprint(s).x1)) <= 14 + 1e-9);
  const otherWall = moveGroup(starbucks, starbucks.pantallas, ids, { pared: 'D' });
  assert.ok(otherWall.every(s => s.pared === 'D'));
  assert.match(workOrder(starbucks, otherWall).acciones[0].obra[0], /de la pared Fondo · barra a la pared Lateral derecho/);
});

test('rotating one mural screen reshapes the studio installation', () => {
  const proposal = starbucks.pantallas.map(s => s.id === 'macmini-starbucks-horizontal' ? { ...s, orientacion: 'vertical' } : s);
  const { acciones, resumen } = workOrder(starbucks, proposal);
  assert.deepEqual(resumen, { modificacion: 1, contenidos: 1 });
  assert.match(acciones[0].obra.join(' '), /Girar a vertical/);
  assert.match(acciones[0].inventario, /pantalla macmini-starbucks-horizontal, código ITIL por cruzar en Yokup/);
  const c = acciones.find(a => a.tipo === 'contenidos');
  assert.match(c.contenidos, /starbucks-six/);
  assert.match(c.contenidos, /V–H–V–V–H–V \(8160×1920\) pasa a V–H–V–V–V–V \(7320×1920\)/);
});

test('removing the mural and adding loose screens are listed with ITIL actions', () => {
  const extra = placeNew(starbucks, [], template('vertical'), 'F');
  const { acciones, resumen } = workOrder(starbucks, extra);
  assert.deepEqual(resumen, { baja: 1, alta: 1 });
  const baja = acciones.find(a => a.tipo === 'baja');
  assert.equal(baja.cis.length, 6);
  assert.match(baja.inventario, /Baja de 6 CI/);
  const alta = acciones.find(a => a.tipo === 'alta');
  assert.equal(alta.itil, null);
  assert.match(alta.inventario, /código pendiente/);
  assert.deepEqual(workOrder(starbucks, starbucks.pantallas).acciones, []);
});

test('the double-H template adds six grouped screens on a free spot', () => {
  const items = template('mosaico-doble-h', starbucks.pantallas);
  assert.equal(items.length, 6);
  assert.equal(new Set(items.map(s => s.grupo)).size, 1);
  assert.equal(composition(items, items[0].grupo), 'V–H–V–V–H–V');
  const placed = placeNew(starbucks, starbucks.pantallas, items, 'F');
  const proposal = starbucks.pantallas.concat(placed);
  assert.deepEqual(validate(starbucks, proposal).filter(i => i.nivel === 'error'), []);
  const { acciones } = workOrder(starbucks, proposal);
  assert.equal(acciones.length, 1);
  assert.match(acciones[0].contenidos, /lienzo 8160×1920/);
});

test('loose screens: moves, rotations, removals and content impact', () => {
  const proposal = [
    { ...plan.pantallas[0], pared: 'S', s: 8.5, z: 1.2 },
    { ...plan.pantallas[1], orientacion: 'vertical' }
  ];
  const { acciones, resumen } = workOrder(plan, proposal);
  assert.deepEqual(resumen, { modificacion: 2 });
  const traslado = acciones.find(a => a.pantalla === 'v1');
  assert.match(traslado.obra.join(' '), /Trasladar/);
  assert.match(traslado.obra.join(' '), /toma eléctrica/);
  assert.match(acciones.find(a => a.pantalla === 'h1').contenidos, /1920×1080 a 1080×1920/);
  const removed = workOrder(plan, [plan.pantallas[0]]);
  assert.equal(removed.acciones[0].tipo, 'baja');
  assert.match(removed.acciones[0].inventario, /Baja del CI CI-2/);
});

test('an exported order restores only on the same plan version and walls', () => {
  const order = exportOrder(starbucks, starbucks.pantallas.slice(0, 3), { titulo: 'Solo una H', creada: '2026-10-14T10:00:00Z' });
  assert.equal(order.schema, 'admira.orden-obra/1');
  assert.equal(order.version_plano, starbucks.version);
  assert.equal(restoreProposal(order, starbucks).titulo, 'Solo una H');
  assert.equal(restoreProposal({ ...order, version_plano: 'otra' }, starbucks), null);
  assert.equal(restoreProposal({ ...order, propuesta: [{ ...order.propuesta[0], pared: 'X' }] }, starbucks), null);
  assert.equal(restoreProposal(null, starbucks), null);
});

test('clamping keeps a screen inside its wall', () => {
  const f = footprint(clampToWall(plan, { ...plan.pantallas[1], s: 99, z: 99 }));
  assert.ok(f.x1 <= 8 + 1e-9 && f.z1 <= 3.2 + 1e-9);
});

test('admira.biz serves the floor plan page, its modules and every plan file', () => {
  for (const file of ['plano.html', 'plano.mjs', 'plano-core.mjs', 'plano.css', 'walk-core.mjs', 'data/xpacios/alsea-sbux-021.json']) assert.ok(BIZ_ASSET_FILES.includes(file), file);
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/plano?locationId=alsea-sbux-021')), '/__admira_biz/plano');
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/data/xpacios/alsea-sbux-021.json')), '/__admira_biz/data/xpacios/alsea-sbux-021.json');
});

test('moving the mural and rotating one of its screens is one move plus one rotation', () => {
  const ids = starbucks.pantallas.map(s => s.id);
  const moved = moveGroup(starbucks, starbucks.pantallas, ids, { ds: -1.6 })
    .map(s => s.id === 'macmini-starbucks-horizontal' ? { ...s, orientacion: 'vertical' } : s);
  const { acciones, resumen } = workOrder(starbucks, moved);
  assert.deepEqual(resumen, { modificacion: 2, contenidos: 1 });
  assert.match(acciones[0].obra[0], /Trasladar el mural doble H entero 1,6 m a la izquierda/);
  const giro = acciones.find(a => a.pantalla === 'macmini-starbucks-horizontal');
  assert.doesNotMatch(giro.obra.join(' '), /Trasladar/);
  assert.match(giro.obra.join(' '), /Girar a vertical/);
  assert.match(acciones.find(a => a.tipo === 'contenidos').contenidos, /V–H–V–V–V–V/);
});

test('rotating or resizing keeps the screen centre, so a turned H lines up with its verticals', () => {
  const h2 = starbucks.pantallas.find(s => s.id === 'macmini-starbucks-horizontal');
  const v3 = starbucks.pantallas.find(s => s.id === 'macmini-starbucks-vertical');
  const turned = reshape(h2, { orientacion: 'vertical' });
  assert.ok(Math.abs(turned.z - v3.z) < 0.002);
  const f0 = footprint(h2), f1 = footprint(reshape(h2, { pulgadas: 65 }));
  assert.ok(Math.abs((f0.z0 + f0.z1) / 2 - (f1.z0 + f1.z1) / 2) < 0.002);
  assert.match(workOrder(starbucks, [{ ...starbucks.pantallas[0], s: 2.5 }]).acciones.map(a => a.obra.join(' ')).join(' '), /centro a 2,5 m/);
});
