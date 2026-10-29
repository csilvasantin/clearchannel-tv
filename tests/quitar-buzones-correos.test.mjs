// Buzones de Correos fuera del catálogo (Morfeo, 29-oct-2026 · estado de los circuitos Biz, prioridad 1). El filtro
// de tools/quitar-buzones-correos.mjs sólo coge buzones de calle de Correos importados de OSM: las oficinas, los
// CityPaq, los Xpacios con gemelo, las altas de la flota y cualquier otra marca se quedan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { esBuzonCorreos, quitarBuzones, comprobarRetirada, restaurarBuzones, MAX_QUITAR, MIN_QUEDAN } from '../tools/quitar-buzones-correos.mjs';

const surfaces = () => [{ status: 'live', impr: 420 }, { status: 'live', impr: 280 }, { status: 'scheduled', impr: 180 }];
const correos = (id, addr, extra = {}) => ({ id, name: 'Correos Oficina', addr, coords: [-3.7, 40.4],
  external: { brand: 'Correos', network: 'Correos España', source: 'overpass-osm' }, surfaces: surfaces(), ...extra });

test('es buzón la dirección «post_box» de Correos, también con el operador de OSM en medio', () => {
  assert.equal(esBuzonCorreos(correos('correos-0002-correos', 'Correos · post_box')), true);
  assert.equal(esBuzonCorreos(correos('correos-0269-correos', 'Correos · Buzón de Correos de España · post_box')), true);
  assert.equal(esBuzonCorreos(correos('correos-5378-correos', 'Correos · Correos S.A. · post_box')), true);
});

test('no son buzones las oficinas, los CityPaq, otras marcas, los gemelos ni las altas de la flota', () => {
  assert.equal(esBuzonCorreos(correos('correos-0010-correos', 'Oficina de Correos · Correos · post_office')), false);
  assert.equal(esBuzonCorreos(correos('correos-0011-correos', 'CityPaq · Correos · parcel_locker')), false);
  assert.equal(esBuzonCorreos(correos('correos-0012-correos', 'Calle Mayor 3 · Madrid')), false);
  assert.equal(esBuzonCorreos(correos('correos-0013-correos', 'Correos · post_box', { twin: 'twin.html?id=x' })), false);
  assert.equal(esBuzonCorreos(correos('correos-0014-correos', 'Correos · post_box', { selfReg: true })), false);
  assert.equal(esBuzonCorreos({ ...correos('mango-0001', 'Correos · post_box') }), false, 'otro prefijo de id');
  assert.equal(esBuzonCorreos({ ...correos('correos-0015-correos', 'Correos · post_box'), external: { brand: 'Mango' } }), false);
  assert.equal(esBuzonCorreos(null), false);
});

test('quitarBuzones separa sin mutar y resume superficies e impresiones', () => {
  const cat = [correos('correos-0001-correos', 'Correos · post_box'), correos('correos-0002-correos', 'Correos · post_office'),
    { id: 'bbva-1', addr: 'España', surfaces: [{ impr: 10 }] }, correos('correos-0003-correos', 'Correos · correos · post_box')];
  const copia = JSON.stringify(cat);
  const r = quitarBuzones(cat);
  assert.deepEqual(r.quedan.map(l => l.id), ['correos-0002-correos', 'bbva-1']);
  assert.deepEqual(r.quitados.map(l => l.id), ['correos-0001-correos', 'correos-0003-correos']);
  assert.deepEqual(r.resumen, { antes: 4, despues: 2, quitados: 2, superficies: 6, impresiones: 1760, correosAntes: 3, correosDespues: 1 });
  assert.equal(JSON.stringify(cat), copia, 'no toca el catálogo de entrada');
});

test('los topes impiden escribir un catálogo limpio, un filtro desbocado o un catálogo incompleto', () => {
  assert.throws(() => comprobarRetirada({ resumen: { quitados: 0, despues: 9140 } }), /ya está limpio/);
  assert.throws(() => comprobarRetirada({ resumen: { quitados: MAX_QUITAR + 1, despues: 6000 } }), /tope/);
  assert.throws(() => comprobarRetirada({ resumen: { quitados: 3167, despues: MIN_QUEDAN - 1 } }), /incompleto/);
  assert.doesNotThrow(() => comprobarRetirada({ resumen: { quitados: 3167, despues: 5973 } }));
});

test('la vuelta atrás añade sólo los buzones que falten y conserva lo escrito después', () => {
  const copia = [correos('correos-0001-correos', 'Correos · post_box'), correos('correos-0002-correos', 'Correos · post_office')];
  const ahora = [correos('correos-0002-correos', 'Correos · post_office'), { id: 'nuevo-despues', addr: 'x' }];
  const r = restaurarBuzones(ahora, copia);
  assert.equal(r.vuelven, 1);
  assert.deepEqual(r.locations.map(l => l.id), ['correos-0002-correos', 'nuevo-despues', 'correos-0001-correos']);
  assert.equal(restaurarBuzones(r.locations, copia).vuelven, 0, 'dos veces no duplica');
});
