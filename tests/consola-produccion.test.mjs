// Revisión de consola de producción (Morfeo, 17-oct-2026 · «Volver a verde y no publicar en rojo», 3c).
// Lo que no necesita Chrome: argumentos, qué evento del protocolo cuenta como error y el ruido conocido.
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerArgs, errorDeEvento, RUIDO } from '../tools/consola-produccion.mjs';

test('por defecto revisa portada, backoffice, Bugito y plano de admira.biz e ignora el ruido conocido', () => {
  const o = leerArgs([]);
  assert.equal(o.base, 'https://admira.biz');
  assert.deepEqual(o.paginas, ['/', '/backoffice.html', '/bugito.html', '/plano.html']);
  assert.equal(o.ignorar.length, RUIDO.length);
});

test('--base, --pagina, --ignorar y --estricto', () => {
  const o = leerArgs(['--base', 'https://x.pages.dev/', '--pagina', 'walk.html', '--ignorar', 'foo', '--estricto']);
  assert.equal(o.base, 'https://x.pages.dev');
  assert.deepEqual(o.paginas, ['/walk.html']);
  assert.equal(o.ignorar.length, 1, 'en estricto no se añade el ruido');
  assert.throws(() => leerArgs(['--nada']), /argumento desconocido/);
});

test('cuentan como error las excepciones, console.error/assert y los recursos que no cargan', () => {
  assert.match(errorDeEvento({ method: 'Runtime.exceptionThrown', params: { exceptionDetails: {
    exception: { description: "ReferenceError: Cannot access 'map' before initialization\n    at x" }, url: 'https://admira.biz/app.js', lineNumber: 850 } } }),
  /^excepción: ReferenceError: Cannot access 'map' before initialization \(https:\/\/admira\.biz\/app\.js:851\)$/);
  assert.equal(errorDeEvento({ method: 'Runtime.consoleAPICalled', params: { type: 'error', args: [{ value: 'falló' }, { description: 'Error: x' }] } }), 'console.error: falló Error: x');
  assert.equal(errorDeEvento({ method: 'Log.entryAdded', params: { entry: { level: 'error', source: 'network', text: 'Failed to load resource: 404', url: 'https://admira.biz/x.js' } } }),
    'network: Failed to load resource: 404 (https://admira.biz/x.js)');
});

test('no cuentan los avisos ni los logs normales', () => {
  assert.equal(errorDeEvento({ method: 'Runtime.consoleAPICalled', params: { type: 'warning', args: [{ value: 'ojo' }] } }), null);
  assert.equal(errorDeEvento({ method: 'Runtime.consoleAPICalled', params: { type: 'log', args: [{ value: 'hola' }] } }), null);
  assert.equal(errorDeEvento({ method: 'Log.entryAdded', params: { entry: { level: 'warning', source: 'other', text: 'x' } } }), null);
  assert.equal(errorDeEvento({ method: 'Page.loadEventFired', params: {} }), null);
});

test('el ruido conocido es sólo el de FedCM sin sesión de Google, no cualquier error de Google', () => {
  const ruido = (t) => RUIDO.some((r) => r.re.test(t));
  assert.ok(ruido('other: Not signed in with the identity provider.'));
  assert.ok(ruido('console.error: [GSI_LOGGER]: FedCM get() rejects with NetworkError: Error retrieving a token.'));
  assert.ok(ruido('other: Only one navigator.credentials.get request may be outstanding at one time.'));
  assert.ok(!ruido('console.error: [GSI_LOGGER]: The given origin is not allowed for the given client ID.'));
  assert.ok(!ruido("excepción: ReferenceError: Cannot access 'map' before initialization"));
});
