// Superficies «scheduled» como programadas (Morfeo, 29-oct-2026 · estado de los circuitos Biz). El catálogo trae
// «scheduled» en Correos, Banorte y Liverpool (5.532 superficies) donde el contrato de locations.js dice 'sched':
// la miniatura salía gris, como parada; el ⌘ Experto no las contaba y el backoffice no casaba ninguna opción.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
function cargarLocations() {
  const win = {};
  vm.runInContext(read('locations.js'), vm.createContext({ window: win, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout, clearTimeout }));
  return win;
}
const correos = () => ({ id: 'correos-0001', name: 'Correos', kind: 'Correos · Oficina postal', addr: 'a', coords: [-3.7, 40.4], surfaces: [
  { name: 'Pantalla turno', surface: 'pantalla', status: 'live', impr: 420, cpm: '€6' },
  { name: 'Taquillas', surface: 'pudo', status: 'scheduled', impr: 180, cpm: '€4' },
  { name: 'Escaparate', surface: 'escaparate', status: 'idle', impr: 280, cpm: '€5' },
] });

test('al cargar el catálogo, «scheduled» pasa a «sched» y el resto de estados no cambia', () => {
  const win = cargarLocations();
  const entrada = correos();
  const [loc] = win.normalizeOmnipLocations([entrada]);
  assert.deepEqual(loc.surfaces.map(s => s.status), ['live', 'sched', 'idle']);
  assert.equal(loc.surfaces[1].impr, 180, 'la superficie conserva sus datos');
  assert.equal(entrada.surfaces[1].status, 'scheduled', 'no toca el objeto de entrada');
  assert.equal(loc.surfaces[0], entrada.surfaces[0], 'las superficies que ya cumplen el contrato se reutilizan');
});

test('sin «scheduled», las superficies son las mismas y un Xpacio sin superficies sigue igual', () => {
  const win = cargarLocations();
  const limpio = { ...correos(), surfaces: correos().surfaces.filter(s => s.status !== 'scheduled') };
  assert.equal(win.normalizeOmnipLocations([limpio])[0].surfaces, limpio.surfaces);
  assert.equal(win.normalizeOmnipLocations([{ id: 'slim', coords: [2, 41] }])[0].surfaces, undefined);
});

test('el cosido del catálogo completo (Web Worker) también lo traduce', () => {
  const win = cargarLocations();
  const merged = win.mergeOmnipLocations([correos()], []);
  assert.deepEqual(merged.find(l => l.id === 'correos-0001').surfaces.map(s => s.status), ['live', 'sched', 'idle']);
});

test('la miniatura pinta en amarillo «sched», que es lo que ahora llega', () => {
  assert.match(read('app.js'), /const fill = live \? '#88ffaa' : \(status === 'sched' \? '#ffd866' : '#75aab9'\);/);
});
