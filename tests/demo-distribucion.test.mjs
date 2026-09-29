import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = JSON.parse(readFileSync(new URL('../data/demo-distribucion/puntos.ejemplo.json', import.meta.url)));
const html = readFileSync(new URL('../distribucion/index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../distribucion/distribucion.js', import.meta.url), 'utf8');
const sala = readFileSync(new URL('../distribucion/sala.js', import.meta.url), 'utf8');

assert.equal(json.fuente, 'ejemplo');
assert.equal(json.alsea.length, 10);
assert.equal(json.jti.length, 10);
for (const p of json.alsea.concat(json.jti)) {
  assert.ok(p.id && p.nombre && p.ciudad);
  assert.equal(typeof p.lat, 'number');
  assert.equal(typeof p.lng, 'number');
  assert.equal(p.ejemplo, false);
}
assert.match(json.alsea[0].id, /^alsea-mx-sbux-/);
assert.match(json.jti[0].id, /^jti-xtanco-/);
assert.doesNotMatch(js, /cigarrillo|cigarette/i);

assert.match(html, /id="publicar"/);
assert.match(html, /id="mapa"/);
assert.match(html, /Registro/);
assert.match(js, /EJEMPLO/);
assert.match(js, /demo-sala-macmini/);
assert.match(js, /target: SALA/);
assert.match(js, /SIMULADO/);
assert.match(js, /1790609061411-86drpb/);
assert.match(js, /1790608980217-vni6ai/);
assert.doesNotMatch(js, /signage\/push[\s\S]{0,400}target:\s*null/);
assert.match(sala, /it\.target === SCREEN/);
assert.match(sala, /producer: 'demo-sala-macmini'/);
assert.doesNotMatch(sala + js, /locName|machine:/);

console.log('demo-distribucion ok');
