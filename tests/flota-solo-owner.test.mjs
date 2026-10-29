// Equipos de la flota fuera del mapa público (Morfeo, 29-oct-2026, a petición de Carlos). Sin sesión de owner verificada,
// los equipos dados de alta solos que no son de ningún circuito con nombre no entran en LOCATIONS (mapa, buscador,
// circuitos, «Todos»). Los de un circuito, como el iPad del quiosco de CanalKiosk, siguen. Con la sesión vuelven todos.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const plano = v => JSON.parse(JSON.stringify(v));

// Las reglas de circuito y setLocations de app.js, con el owner verificado o no.
function contexto(owner) {
  const ids = app.match(/const CIRCUIT_IDS_BY_SCOPE = \{[\s\S]*?\n\};/)[0];
  const ctx = vm.createContext({ LANG: 'es', performance, t: k => k, window: { addEventListener() {} }, document: { documentElement: { dataset: {} } },
    incidentModeOn: () => owner, stampAltadisTwin() {}, stampDemoTwin() {}, invalidateLocationsGeoJSON() {} });
  const desde = app.indexOf('function normText'), hasta = app.indexOf('function repartirPorReglas');
  const trozo = app.slice(desde, hasta).replace(/\nsetLocations\(LOCATIONS\);\n/, '\n').replace(/\nfunction invalidateLocationsGeoJSON\(\) \{[\s\S]*?\n\}\n/, '\n');
  vm.runInContext(ids + '\nconst BUILTIN_CIRCUITS = new Set(CIRCUIT_IDS_BY_SCOPE.all);\nvar LOCATIONS = [], LOCATIONS_ALL = [], LOC_BY_ID = new Map();\n' + trozo, ctx);
  return ctx;
}
const catalogo = () => [
  { id: 'tienda-1', name: 'Tienda', kind: 'Retail', coords: [2, 41], surfaces: [{}] },
  { id: 'iphone-carlos', name: 'iPhone de Carlos · Jardinets', kind: 'MUPI · Circuito Admira · iPhone', network: 'Admira', addr: 'Jardinets', coords: [2.16, 41.39], selfReg: true, surfaces: [{}] },
  { id: 'kiosko-lesseps', name: 'kiosko-lesseps', kind: 'MUPI · Circuito Admira · kiosko', network: 'Admira', addr: 'Plaça de Lesseps · Barcelona', coords: [2.15, 41.4], selfReg: true, surfaces: [{}] },
];

test('sin sesión de owner, los equipos de la flota sin circuito no salen; los de un circuito y el resto, sí', () => {
  const ctx = contexto(false);
  const cat = catalogo();
  ctx.setLocations(cat);
  const visibles = plano(vm.runInContext('LOCATIONS.map(l => l.id)', ctx));
  assert.ok(visibles.includes('tienda-1'));
  assert.ok(!visibles.includes('iphone-carlos'), 'el iPhone no sale en el mapa público');
  assert.ok(visibles.includes('kiosko-lesseps'), 'un equipo del circuito de quioscos sigue');
  assert.equal(vm.runInContext('LOCATIONS_ALL.length', ctx), 3, 'el catálogo completo se guarda entero');
  assert.equal(vm.runInContext("LOC_BY_ID.has('iphone-carlos')", ctx), false, 'tampoco se abre su ficha por enlace');
});

test('con la sesión de owner verificada vuelven todos', () => {
  const ctx = contexto(true);
  ctx.setLocations(catalogo());
  assert.deepEqual(plano(vm.runInContext('LOCATIONS.map(l => l.id)', ctx)), ['tienda-1', 'iphone-carlos', 'kiosko-lesseps']);
});

test('al cambiar la sesión de owner se rehace la lista y se repinta el selector', () => {
  const flota = app.indexOf("window.addEventListener('bugito:incident-mode', () => {\n  try { setLocations(LOCATIONS_ALL); renderCircuitSelector(); } catch (_) {}\n});");
  assert.ok(flota > 0, 'rehace la lista al cambiar el modo');
  assert.ok(flota < app.indexOf("window.addEventListener('bugito:incident-mode', () => applyIncidentMode());"), 'antes del repintado del mapa');
  assert.match(app, /LOCATIONS = segmentLocations\(LOCATIONS_ALL\.filter\(flotaVisible\)\);/);
});
