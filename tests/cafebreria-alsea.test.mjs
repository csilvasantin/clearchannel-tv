import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Cafebrería Barcelona: Xpacio 3D del circuito Alsea (presentación Alsea, 30-sep-2026).
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ctx = vm.createContext({});
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

test('la Cafebrería entra en el circuito Alsea y no en Estancos', () => {
  assert.equal(ctx.isAlseaStarbucksLocation(cafe), true);
  assert.equal(ctx.isEstancoLocation(cafe), false);
  assert.equal(ctx.isJtiXtancoLocation(cafe), false);
  assert.equal(ctx.isKioskoLocation(cafe), false);
});

test('el catálogo fusionado conserva alsea-sbux-021 y añade la Cafebrería', () => {
  const merged = win.mergeOmnipLocations([{ id: 'alsea-sbux-021', name: 'Paseo de Gracia', surfaces: [] }]);
  assert.ok(merged.some(l => l.id === 'alsea-sbux-021'));
  assert.ok(merged.some(l => l.id === 'cafebreria-barcelona'));
});
