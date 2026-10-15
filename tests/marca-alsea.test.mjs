// «alsea» es Starbucks en la marca blanca (Carlos, 15-oct-2026: Alsea opera Starbucks; por si alguien se
// equivoca). ?marca=alsea, la marca recordada «alsea» y /marca alsea aplican Starbucks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../marca-blanca.js');
const pestaña = valor => ({getItem: k => (k === 'mb:marca' ? valor : null)});

test('?marca=alsea (y ALSEA) es Starbucks', () => {
  assert.equal(api.decide('?marca=alsea', pestaña(null)).id, 'starbucks');
  assert.equal(api.decide('?marca=ALSEA', pestaña(null)).id, 'starbucks');
  assert.equal(api.decide('?marca=starbucks', pestaña(null)).id, 'starbucks');
});

test('una marca recordada «alsea» también es Starbucks; las demás no cambian', () => {
  assert.equal(api.decide('', pestaña('alsea')).id, 'starbucks');
  assert.equal(api.decide('?marca=altadis', pestaña(null)).id, 'altadis');
  assert.equal(api.decide('?marca=admira', pestaña(null)).id, null);
});

test('admira.biz publica este cargador (no el de la base preservada) y la portada lo pide con sello nuevo', async () => {
  const {BIZ_ASSET_FILES} = await import('../server/biz-assets.mjs');
  assert.ok(BIZ_ASSET_FILES.includes('marca-blanca.js'));
  const {readFileSync} = await import('node:fs');
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /marca-blanca\.js\?v=20261015-alsea-1/);
});
