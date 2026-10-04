// Segmentación del globo por cliente (cliente-segmento.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../cliente-segmento.js');

const P = [
  {id: 'altadis-bcn-001', name: 'Estanc Gran de Gràcia 61', kind: 'Estanco · Circuito DOOH Altadis · Gemelo digital', circuit: 'altadis_bcn', external: {brand: 'Estanco', sponsor: 'Altadis'}},
  {id: 'jti-xtanco-001', name: 'Estanco 1', kind: 'Estanco · Xtanco · Circuito DOOH JTI', circuit: 'jti_xtanco', external: {brand: 'Xtanco'}},
  {id: 'xtanco-valencia', name: 'Xtanco Valencia', kind: 'Estanco · Retail físico · Gemelo digital · Xpacio 3D'},
  {id: 'alsea-sbux-001', name: 'Starbucks Paseo de Gracia', kind: 'Cafetería · Starbucks · Circuito DOOH Alsea', circuit: 'alsea_starbucks', external: {brand: 'Starbucks'}},
  {id: 'alsea-mx-sbux-01-tijuana', name: 'Starbucks Tijuana', kind: 'Cafetería · Starbucks · Alsea México', circuit: 'alsea_mexico', external: {brand: 'Starbucks'}},
  {id: 'cafebreria-barcelona', name: 'Cafebrería', kind: 'Cafetería', circuit: 'cafebreria'},
  {id: 'alcampo-andres-vicente', name: 'Alcampo Supermercado Andrés Vicente', kind: 'Supermercado · Alcampo · Circuito DOOH', external: {brand: 'Alcampo'}},
  {id: 'correos-1', name: 'Oficina', kind: 'Correos · Oficina postal · Retail público nacional', external: {brand: 'Correos'}},
  {id: 'bcn-kiosk-014', name: 'Estanco · premsa', kind: 'Quiosco de prensa · DOOH exterior'},
  {id: 'iphone17', name: 'iPhone de Carlos', kind: 'MUPI · Circuito Admira · AdmiraNeXT Player (iOS)', network: 'Admira'},
];
const ids = (cliente) => S.filtrar(P, cliente).map(l => l.id);

test('Admira (o ninguno) ve todos los puntos', () => {
  assert.equal(S.filtrar(P, null).length, P.length);
  assert.equal(S.filtrar(P, 'admira').length, P.length);
  assert.equal(S.resolver('admira'), null);
  assert.equal(S.resolver('off'), null);
});

test('Starbucks ve Alsea España y México y nada más', () => {
  assert.deepEqual(ids('starbucks'), ['alsea-sbux-001', 'alsea-mx-sbux-01-tijuana']);
  assert.deepEqual(ids('starbucks-mexico'), ['alsea-mx-sbux-01-tijuana']);
});

test('Altadis y JTI nunca se mezclan', () => {
  assert.deepEqual(ids('altadis'), ['altadis-bcn-001']);
  assert.deepEqual(ids('jti'), ['jti-xtanco-001', 'xtanco-valencia']);
  for (const l of S.filtrar(P, 'altadis')) assert.notEqual(S.clienteDe(l), 'jti');
  for (const l of S.filtrar(P, 'jti')) assert.notEqual(S.clienteDe(l), 'altadis');
});

test('Alcampo, Correos y quioscos por marca o tipo', () => {
  assert.deepEqual(ids('alcampo'), ['alcampo-andres-vicente']);
  assert.deepEqual(ids('correos'), ['correos-1']);
  assert.equal(S.clienteDe(P[8]), 'canalkiosk');
});

test('Alias y valores de la URL/sesión', () => {
  assert.equal(S.resolver('JTI Xtanco'), 'jti');
  assert.equal(S.resolver('proyectoStarbucks'), 'starbucks');
  assert.equal(S.decidir('?marca=starbucks', null), 'starbucks');
  assert.equal(S.decidir('?marca=admira', {getItem: () => 'jti'}), null);
  assert.equal(S.decidir('?cliente=altadis', null), 'altadis');
  assert.equal(S.decidir('', {getItem: () => 'jti'}), 'jti');
});

test('Cliente sin puntos propios (marca de ejemplo) no vacía el globo', () => {
  assert.equal(S.filtrar(P, 'lumbre').length, P.length);
});
