const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../login-google.js');
const root = path.join(__dirname, '..');

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = claims => [b64({alg: 'RS256'}), b64(claims), 'firma'].join('.');
const mem = value => ({getItem: () => value});

test('cliente de Google por dominio: admira.biz con el de la suite, el resto con el del sitio', () => {
  assert.match(L.clientFor('www.admira.biz'), /^861856772040-e1ri6/);
  assert.match(L.clientFor('admira.biz'), /^861856772040-e1ri6/);
  assert.match(L.clientFor('www.clearchannel.tv'), /^861856772040-quq6/);
  assert.match(L.clientFor('admira.biz.ejemplo.com'), /^861856772040-quq6/);
});

test('en el backoffice no se toca el enlace: allí ya hay puerta de Google', () => {
  for (const p of ['/backoffice', '/backoffice.html', '/backoffice/']) assert.equal(L.isBackoffice(p), true, p);
  for (const p of ['/', '/index.html', '/plano', '/backoffice-x']) assert.equal(L.isBackoffice(p), false, p);
});

test('sesión guardada: vale mientras el ID token no caduca y usa la misma clave que el backoffice', () => {
  assert.equal(L.KEY, 'omnip-bo-gtoken');
  const now = Date.UTC(2026, 9, 15, 20, 0);
  const token = jwt({email: 'csilva@admira.com', exp: Math.floor(now / 1000) + 600});
  assert.deepEqual(L.stored(mem(JSON.stringify({token, email: 'csilva@admira.com'})), now), {token, email: 'csilva@admira.com'});
  const expired = jwt({email: 'x@admira.com', exp: Math.floor(now / 1000) - 1});
  assert.equal(L.stored(mem(JSON.stringify({token: expired})), now), null);
  assert.equal(L.stored(mem('no-json'), now), null);
  assert.equal(L.stored(mem(null), now), null);
  // Sin email guardado, lo toma del token.
  assert.equal(L.stored(mem(JSON.stringify({token})), now).email, 'csilva@admira.com');
  const backoffice = fs.readFileSync(path.join(root, 'backoffice.html'), 'utf8');
  assert.match(backoffice, /const GTOK_KEY = 'omnip-bo-gtoken';/);
});

test('popup de Google en la portada y en las páginas de la piel común, publicado en Biz', () => {
  const src = fs.readFileSync(path.join(root, 'login-google.js'), 'utf8');
  assert.match(src, /ux_mode: 'popup'/);
  assert.match(src, /renderButton\(host, \{type: 'standard'/);
  assert.match(src, /fetch\('\/api\/demo-session', \{method: 'POST', headers: \{Authorization: 'Bearer ' \+ token\}/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<script defer src="login-google\.js\?v=/);
  assert.match(fs.readFileSync(path.join(root, 'galaxy-shell.js'), 'utf8'), /load\('login-google\.js'\)/);
  assert.match(fs.readFileSync(path.join(root, 'server/biz-assets.mjs'), 'utf8'), /'login-google\.js'/);
});
