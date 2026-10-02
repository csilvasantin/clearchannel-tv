import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const seed = JSON.parse(readFileSync(new URL('../data/circuitos/circuito-altadis-bcn-9.seed.json', import.meta.url), 'utf8'));
const start = app.indexOf('function normText');
const end = app.indexOf('function isAlcampoLocation');
const ctx = vm.createContext({ LOCATIONS: [] });
vm.runInContext(app.slice(start, end), ctx);

test('los 9 estancos Altadis forman su circuito y no entran en Xtanco Nacional ni JTI', () => {
  assert.equal(seed.length, 9);
  for (const loc of seed) {
    assert.equal(ctx.isAltadisBcnLocation(loc), true);
    assert.equal(ctx.isEstancoLocation(loc), false);
    assert.equal(ctx.isJtiXtancoLocation(loc), false);
  }
});

test('cada estanco Altadis trae una pantalla vertical y otra horizontal, en orden de ruta', () => {
  seed.forEach((loc, i) => {
    assert.equal(loc.tourOrder, i + 1);
    const o = loc.surfaces.map(s => s.orient);
    assert.deepEqual(o, ['vertical', 'horizontal']);
    assert.match(loc.twin, /loc=altadis-bcn-00\d/);
  });
});

test('el circuito altadis_bcn está en el selector y en los ámbitos', () => {
  assert.match(app, /'altadis_bcn'/);
  assert.match(app, /circuit_altadis_bcn:'Altadis · Estancos Barcelona 9'/);
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /value="altadis_bcn"/);
});
