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
  assert.deepEqual(L.stored(mem(JSON.stringify({token, email: 'csilva@admira.com'})), now), {token, email: 'csilva@admira.com', registrado: false});
  // Registrado sin backoffice (Xpacios privados, 29-oct-2026): se recuerda para que el enlace no lleve al backoffice.
  assert.equal(L.stored(mem(JSON.stringify({token, email: 'ana@gmail.com', registrado: true})), now).registrado, true);
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
  assert.match(src, /const init = \{method: 'POST', headers: \{Authorization: 'Bearer ' \+ token\}, cache: 'no-store'\};\n    let r = await fetch\('\/api\/demo-session', init\);/);
  // Sin backoffice, la misma credencial entra como registrada (Xpacios privados, 29-oct-2026).
  assert.match(src, /if \(r\.status === 401\) r = await fetch\('\/api\/registro', init\);/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<script defer src="login-google\.js\?v=/);
  assert.match(fs.readFileSync(path.join(root, 'galaxy-shell.js'), 'utf8'), /load\('login-google\.js'\)/);
  assert.match(fs.readFileSync(path.join(root, 'server/biz-assets.mjs'), 'utf8'), /'login-google\.js'/);
});

// 18-oct-2026: en las páginas interiores (cabecera de galaxy-shell.js) el enlace volvía a decir «Login» con la sesión
// abierta, porque responsive-shell.js reescribe data-shell-text-es/en al arrancar y al cambiar de idioma.
test('con sesión, el enlace dice «Backoffice» también después del traductor de la cabecera común', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(root, 'login-google.js'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'responsive-shell.js'), 'utf8');
  assert.match(shell, /document\.querySelectorAll\('\[data-shell-text-es\]'\)\.forEach\(el=>\{el\.textContent=es\(\)\?el\.dataset\.shellTextEs:el\.dataset\.shellTextEn;\}\);/,
    'el traductor común sigue leyendo data-shell-text-es/en');
  for (const lang of ['es', 'en']) {
    // El enlace tal como lo pinta galaxy-shell.js (bilingual): textos de Login en los dos idiomas.
    const link = {textContent: 'Login', title: '', hidden: false, dataset: {shellTextEs: 'Login', shellTextEn: 'Login'}, classList: {add() {}},
      removeAttribute() {}, after() {}};
    const clases = new Set();
    const token = jwt({email: 'prueba@admira.biz', exp: Math.floor(Date.now() / 1000) + 3600});
    const ctx = {document: {documentElement: {lang, classList: {add: c => clases.add(c)}}, getElementById: id => (id === 'header-login' ? link : null), head: {append() {}}},
      localStorage: mem(JSON.stringify({token, email: 'prueba@admira.biz'})), location: {pathname: '/help/', hostname: 'www.admira.biz'},
      atob: s => Buffer.from(s, 'base64').toString('binary'), Buffer, MutationObserver: class { observe() {} disconnect() {} }, setTimeout: () => 0, clearTimeout() {}, JSON, Date};
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.runInNewContext(src, ctx);
    assert.equal(link.textContent, 'Backoffice', lang + ': login-google.js lo pone');
    // Lo que hace responsive-shell.js al arrancar o al cambiar de idioma.
    link.textContent = lang === 'es' ? link.dataset.shellTextEs : link.dataset.shellTextEn;
    assert.equal(link.textContent, 'Backoffice', lang + ': y el traductor común lo respeta');
    assert.match(link.title, /prueba@admira\.biz/);
    assert.ok(clases.has('admira-con-sesion'));
  }
});
