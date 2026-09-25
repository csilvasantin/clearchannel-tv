import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = app.indexOf('function normText');
const end = app.indexOf('function isAlcampoLocation');
const ctx = vm.createContext({});
vm.runInContext(app.slice(start, end), ctx);

test('los estancos JTI no entran en Xtanco Nacional', () => {
  const jti = { id: 'jti-xtanco-001', name: 'Estanco Juan Florez', kind: 'estanco', circuit: 'jti_xtanco' };
  const nacional = { id: 'xtanco-valencia', name: 'Xtanco Valencia', kind: 'estanco' };
  assert.equal(ctx.isJtiXtancoLocation(jti), true);
  assert.equal(ctx.isEstancoLocation(jti), false);
  assert.equal(ctx.isEstancoLocation(nacional), true);
});
