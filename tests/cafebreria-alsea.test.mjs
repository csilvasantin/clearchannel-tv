import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Cafebrería: identidad independiente sobre la ficha y el gemelo existentes.
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ LOCATIONS: [] });
vm.runInContext(app.slice(app.indexOf('function normText'), app.indexOf('function isAlcampoLocation')), ctx);

const win = {};
const locCtx = vm.createContext({ window: win, localStorage: { getItem: () => null, setItem() {} } });
vm.runInContext(readFileSync(new URL('../locations.js', import.meta.url), 'utf8'), locCtx);
const cafe = win.OMNIP_LOCATIONS_EXTRA.find(l => l.id === 'cafebreria-barcelona');

test('la Cafebrería está en el catálogo con su gemelo y superficies', () => {
  assert.ok(cafe, 'cafebreria-barcelona en OMNIP_LOCATIONS_EXTRA');
  assert.deepEqual([...cafe.coords], [2.15979, 41.39574]);
  assert.equal(cafe.twin, 'https://www.pixeria.com/stock.html?type=xpaces&highlight=1790375438696-1ladz7');
  assert.equal(cafe.fly, 'https://www.pixeria.com/stock.html?type=xpaces&highlight=1790375438696-1ladz7');
  assert.equal(cafe.flyLabel, 'Ver Gemelo Digital ↗');
  assert.equal(Object.prototype.hasOwnProperty.call(cafe, 'xpaceUrl'), false);
  assert.equal(cafe.twinOnClick, true);
  assert.ok(cafe.surfaces.length >= 6);
  cafe.surfaces.filter(s => s.screen).forEach(s => assert.match(s.screen, /^cafebreria-barcelona-[a-z0-9-]+$/));
});

test('la Cafebrería queda independiente de Starbucks incluso con una ficha antigua', () => {
  assert.equal(ctx.isCafebreriaLocation(cafe), true);
  assert.equal(cafe.project_id, 'cafebreria');
  assert.equal(cafe.circuit, 'cafebreria');
  assert.equal(ctx.isAlseaStarbucksLocation(cafe), false);
  assert.equal(ctx.isAlseaStarbucksLocation({id:cafe.id, circuit:'alsea_starbucks', external:{brand:'Starbucks'}}), false);
  assert.equal(ctx.isAlseaStarbucksLocation({id:'alsea-sbux-021', circuit:'alsea_starbucks'}), true);
  assert.equal(ctx.isEstancoLocation(cafe), false);
  assert.equal(ctx.isJtiXtancoLocation(cafe), false);
  assert.equal(ctx.isKioskoLocation(cafe), false);
});

test('el catálogo fusionado conserva alsea-sbux-021 y añade la Cafebrería', () => {
  const merged = win.mergeOmnipLocations([{ id: 'alsea-sbux-021', name: 'Paseo de Gracia', surfaces: [] }]);
  assert.ok(merged.some(l => l.id === 'alsea-sbux-021'));
  assert.ok(merged.some(l => l.id === 'cafebreria-barcelona'));
});

test('la migración de una ficha KV/cache no duplica ni pierde datos editables', () => {
  const old = { id: cafe.id, name: 'Mi Cafebrería', circuit: 'alsea_starbucks', network: 'Alsea', addr: 'Referencia personalizada', surfaces: [{screen:'my-screen'}], xpaceUrl: '' };
  const merged = win.mergeOmnipLocations([old]);
  const records = merged.filter(l => l.id === cafe.id);
  assert.equal(records.length, 1);
  const current = records[0];
  assert.equal(current.project_id, 'cafebreria');
  assert.equal(current.circuit, 'cafebreria');
  assert.equal(current.network, 'Cafebrería');
  assert.equal(current.referenceLocationId, 'alsea-sbux-021');
  assert.equal(current.name, old.name);
  assert.equal(current.addr, old.addr);
  assert.equal(current.surfaces[0].screen, 'my-screen');
  assert.equal(current.xpaceUrl, '');
  assert.equal(current.fly, cafe.fly);
});
