// Tres mejoras de admira.biz (Morfeo, 29-oct-2026): el «☁ Publicar» del backoffice ya no pisa lo que otros escriben
// en el catálogo, los equipos de la flota salen de «Otros retail físicos» y las direcciones dejan de enseñar las
// etiquetas de OpenStreetMap.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const app = read('app.js');
function cargarLocations() {
  const win = {};
  vm.runInContext(read('locations.js'), vm.createContext({ window: win, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout, clearTimeout }));
  return win;
}
const win = cargarLocations();
// Lo que sale del contexto de vm se compara en plano (otro realm: otros prototipos).
const plano = v => JSON.parse(JSON.stringify(v));
const ids = l => plano(l.locations.map(x => x.id));

test('1 · Publicar parte del catálogo de ahora: respeta altas y bajas de otros y aplica sólo lo que cambió quien edita', () => {
  const a = { id: 'a', v: 1 }, b = { id: 'b', v: 1 }, c = { id: 'c', v: 1 }, buzon = { id: 'correos-0002-correos', v: 1 };
  const base = [a, b, c, buzon];
  // Quien edita: cambia «a», quita «b», añade «n». En el KV, mientras tanto: se quitó el buzón y se dio de alta «equipo».
  const mine = [{ id: 'a', v: 2 }, c, buzon, { id: 'n', v: 1 }];
  const current = [a, b, c, { id: 'equipo', v: 1 }];
  const r = win.rebaseOmnipLocations(base, mine, current);
  assert.deepEqual(ids(r), ['a', 'c', 'equipo', 'n']);
  assert.equal(r.locations[0].v, 2, 'manda lo editado');
  assert.deepEqual(plano(r.cambios), { nuevos: 1, editados: 1, quitados: 1 });
  assert.ok(!ids(r).includes('correos-0002-correos'), 'lo que otro quitó y quien edita no tocó sigue quitado');
});

test('1 · casos límite del rebase: sin cambios, mismo id nuevo en los dos lados y editado aquí pero borrado allí', () => {
  const base = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
  const sinCambios = win.rebaseOmnipLocations(base, base.map(x => ({ ...x })), [{ id: 'a', v: 9 }, { id: 'b', v: 1 }]);
  assert.deepEqual(plano(sinCambios.cambios), { nuevos: 0, editados: 0, quitados: 0 });
  assert.equal(sinCambios.locations[0].v, 9, 'sin tocar, manda lo de ahora');
  const doble = win.rebaseOmnipLocations(base, [...base, { id: 'x', v: 'mio' }], [...base, { id: 'x', v: 'suyo' }]);
  assert.equal(doble.locations.find(l => l.id === 'x').v, 'mio');
  assert.equal(doble.cambios.nuevos, 1);
  const vuelve = win.rebaseOmnipLocations(base, [{ id: 'a', v: 2 }, { id: 'b', v: 1 }], [{ id: 'b', v: 1 }]);
  assert.deepEqual(ids(vuelve), ['b', 'a'], 'lo editado aquí vuelve aunque otro lo borrara');
  assert.equal(vuelve.cambios.editados, 1);
});

test('1 · el backoffice sólo publica con el catálogo del KV como base, y parte del catálogo de ahora', () => {
  const bo = read('backoffice.html');
  assert.match(bo, /if \(res\.source === 'kv'\) catalogoBase = copiaCatalogo\(locations\);/);
  const pub = bo.slice(bo.indexOf('async function publishToWorker'), bo.indexOf('const SURF_TYPES'));
  assert.match(pub, /if \(!catalogoBase\) \{/, 'sin base no publica');
  assert.match(pub, /const ahora = await window\.loadOmnipLocationsAsync\(20000\);\s*if \(!ahora \|\| ahora\.source !== 'kv'\) throw/);
  assert.match(pub, /window\.rebaseOmnipLocations\(catalogoBase, locations,/);
  assert.match(pub, /window\.publishOmnipLocations\(r\.locations, token\)/);
  assert.doesNotMatch(pub, /publishOmnipLocations\(locations, token\)/, 'ya no sube su copia entera');
});

// Las reglas de circuito de app.js, como en tests/catalogo-ligero.test.mjs.
function reglas() {
  const idsCircuitos = app.match(/const CIRCUIT_IDS_BY_SCOPE = \{[\s\S]*?\n\};/)[0];
  const ctx = vm.createContext({ LANG: 'es', performance, t: k => k, window: { addEventListener() {} }, document: { documentElement: { dataset: {} } } });
  vm.runInContext(idsCircuitos + '\nconst BUILTIN_CIRCUITS = new Set(CIRCUIT_IDS_BY_SCOPE.all);\nvar LOCATIONS = [];\n'
    + app.slice(app.indexOf('function normText'), app.indexOf('function repartirPorReglas')), ctx);
  return ctx;
}

test('2 · un equipo de la flota dado de alta solo no cuenta como «Otros retail físicos»', () => {
  const ctx = reglas();
  const equipo = { id: 'tablet-samsung-unitree', name: 'Tablet Samsung Unitree', kind: 'MUPI · Circuito Admira · AdmiraNeXT Player', network: 'Admira',
    addr: '(provisional · se actualiza con GPS)', coords: [2.17, 41.38], selfReg: true, surfaces: [{}] };
  const tienda = { id: 'tienda-1', name: 'Tienda', kind: 'Retail', coords: [2, 41], surfaces: [{}] };
  assert.equal(ctx.isRetailCircuitLocation(equipo), false);
  assert.equal(ctx.isRetailCircuitLocation(tienda), true);
  const bit = 1 << ctx.reglasDeCircuito().indexOf(ctx.isRetailCircuitLocation);
  const loc = { ...tienda };
  assert.equal(ctx.reglasDelXpacio(loc) & bit, bit);
  loc.selfReg = true;
  assert.equal(ctx.reglasDelXpacio(loc) & bit, 0, 'el cálculo guardado se rehace si cambia selfReg');
});

test('3 · la dirección que se enseña quita las etiquetas de OpenStreetMap y dice cuándo falta', () => {
  const d = (addr, extra = {}, lang) => win.direccionVisible({ name: 'Correos Oficina de', external: { brand: 'Correos' }, addr, ...extra }, lang);
  assert.equal(d('Oficina de Correos · Correos · post_office'), 'Oficina de Correos');
  assert.equal(d('Correos · post_office'), 'Dirección por confirmar');
  assert.equal(d('Correos · post_office', {}, 'en'), 'Address to be confirmed');
  assert.equal(d('CityPaq · Correos · parcel_locker', { name: 'CityPaq Correos' }), 'Dirección por confirmar');
  assert.equal(d('Calle Mayor 3 · Madrid · post_office'), 'Calle Mayor 3 · Madrid');
  assert.equal(d('España', { name: 'BBVA España', external: { brand: 'BBVA' } }), 'Dirección por confirmar · España');
  assert.equal(d('España', { name: 'BBVA España' }, 'en'), 'Address to be confirmed · España');
  // Las direcciones de verdad no se tocan, aunque el nombre repita la ciudad; sin dirección (slim), en blanco.
  assert.equal(d('Carrer de les Parellades 11 Sitges · España', { name: 'BBVA Sitges' }), 'Carrer de les Parellades 11 Sitges · España');
  assert.equal(d('Ciudad de México · México'), 'Ciudad de México · México');
  assert.equal(d(undefined), '');
});

test('3 · la ficha, las tarjetas, el buscador, la lista del circuito, detail y store-3d usan esa dirección', () => {
  for (const marca of ["<span class=\"cp-addr\">${escHtml(direccionXpacio(loc))}</span>", "escHtml(direccionXpacio(p))",
    "pvEl('pv-addr').textContent = direccionXpacio(loc);", "getElementById('p-addr').textContent = direccionXpacio(loc);",
    '<div class="addr">${escHtml(direccionXpacio(l))}</div>']) assert.ok(app.includes(marca), marca);
  assert.doesNotMatch(app, /escHtml\((loc|l|p)\.addr\)|textContent = loc\.addr/, 'no queda ninguna dirección cruda en pantalla');
  assert.match(read('detail.html'), /setText\('addr', window\.direccionVisible \? window\.direccionVisible\(loc, detailLang\) : loc\.addr\);/);
  assert.match(read('store-3d.html'), /window\.direccionVisible\(loc, document\.documentElement\.lang\)/);
});
