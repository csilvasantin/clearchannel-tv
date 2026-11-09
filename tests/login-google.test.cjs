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

// 9-nov-2026 · t848u: con sesión el login deja de convertirse en «Backoffice». Backoffice es #header-backoffice
// (aparte). Sin /api/proyectos (este VM no tiene fetch), el fallback mantiene el enlace y la clase de sesión.
test('con sesión, la cabecera marca admira-con-sesion y ya no convierte el login en Backoffice', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(root, 'login-google.js'), 'utf8');
  assert.match(src, /PROJECT_KEY = 'admira-proyecto-activo'/);
  assert.match(src, /\/api\/proyectos/);
  assert.match(src, /admira:proyecto/);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /id="header-backoffice"/);
  assert.match(fs.readFileSync(path.join(root, 'galaxy-shell.js'), 'utf8'), /id="header-backoffice"/);
  for (const lang of ['es', 'en']) {
    const link = {textContent: 'Entrar', title: '', hidden: false, dataset: {shellTextEs: 'Entrar', shellTextEn: 'Sign in'}, classList: {add() {}},
      removeAttribute() {}, after() {}, addEventListener() {}};
    const bo = {hidden: true};
    const clases = new Set();
    const token = jwt({email: 'prueba@admira.biz', exp: Math.floor(Date.now() / 1000) + 3600});
    const calls = [];
    const ctx = {
      document: {
        documentElement: {lang, classList: {add: c => clases.add(c)}},
        getElementById: id => (id === 'header-login' ? link : id === 'header-backoffice' ? bo : null),
        head: {append() {}},
        createElement: tag => ({tagName: tag, style: {}, setAttribute() {}, append() {}, replaceChildren() {}, querySelector() { return null; }, addEventListener() {}, className: '', textContent: '', value: '', options: []}),
      },
      localStorage: mem(JSON.stringify({token, email: 'prueba@admira.biz'})),
      location: {pathname: '/help/', hostname: 'www.admira.biz'},
      fetch: async (url) => { calls.push(String(url)); return {ok: false, status: 503, json: async () => ({})}; },
      atob: s => Buffer.from(s, 'base64').toString('binary'),
      Buffer, MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: (fn) => { try { fn(); } catch (_) {} return 0; }, clearTimeout() {}, JSON, Date,
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    };
    ctx.window = ctx; ctx.globalThis = ctx;
    ctx.dispatchEvent = () => {};
    vm.runInNewContext(src, ctx);
    assert.ok(clases.has('admira-con-sesion'), lang);
    assert.notEqual(link.textContent, 'Backoffice', lang + ': el login ya no se convierte en Backoffice');
    assert.ok(calls.some(u => u.includes('/api/proyectos')), lang + ': pide la lista autenticada');
  }
});
// El catálogo (locations.js) acepta el token en localStorage o en sessionStorage. «Cerrar sesión»
// tiene que borrar los dos; si no, un token que quedó en la pestaña sigue abriendo los privados.
test('cerrar sesión borra omnip-bo-gtoken de localStorage y de sessionStorage', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(root, 'login-google.js'), 'utf8');
  const token = jwt({email: 'ana@gmail.com', exp: Math.floor(Date.now() / 1000) + 3600});
  const guardado = JSON.stringify({token, email: 'ana@gmail.com', registrado: true});
  const caja = inicial => {
    const data = Object.assign({}, inicial);
    return {
      getItem: k => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
      removeItem: k => { delete data[k]; },
    };
  };
  function arrancar({confirmar, localRemove, sessionRemove, lang = 'es'}) {
    const clicks = [];
    const link = {
      textContent: 'Login', title: '', hidden: false,
      dataset: {shellTextEs: 'Login', shellTextEn: 'Login'},
      classList: {add() {}}, removeAttribute() {}, after() {},
      addEventListener(type, fn) { if (type === 'click') clicks.push(fn); },
    };
    const local = caja({'omnip-bo-gtoken': guardado});
    const session = caja({'omnip-bo-gtoken': guardado});
    if (localRemove) local.removeItem = localRemove;
    if (sessionRemove) session.removeItem = sessionRemove;
    let recargas = 0;
    const preguntas = [];
    const ctx = {
      document: {
        documentElement: {lang, classList: {add() {}}},
        getElementById: id => (id === 'header-login' ? link : null),
        head: {append() {}},
      },
      localStorage: local, sessionStorage: session,
      location: {pathname: '/', hostname: 'www.admira.biz', reload() { recargas += 1; }},
      confirm(msg) { preguntas.push(msg); return confirmar; },
      atob: s => Buffer.from(s, 'base64').toString('binary'),
      Buffer, JSON, Date,
      MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: () => 0, clearTimeout() {},
    };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.runInNewContext(src, ctx);
    assert.equal(link.textContent, lang === 'en' ? 'Registered' : 'Registrado');
    assert.equal(clicks.length, 1, 'el enlace de un registrado llama a cerrarSesion');
    clicks[0]({preventDefault() {}});
    return {local, session, recargas, preguntas};
  }

  const si = arrancar({confirmar: true});
  assert.equal(si.local.getItem('omnip-bo-gtoken'), null);
  assert.equal(si.session.getItem('omnip-bo-gtoken'), null);
  assert.equal(si.recargas, 1);
  assert.match(si.preguntas[0], /Cerrar la sesión/);

  const en = arrancar({confirmar: true, lang: 'en'});
  assert.equal(en.local.getItem('omnip-bo-gtoken'), null);
  assert.equal(en.session.getItem('omnip-bo-gtoken'), null);
  assert.match(en.preguntas[0], /Sign out/);

  const no = arrancar({confirmar: false});
  assert.equal(no.local.getItem('omnip-bo-gtoken'), guardado);
  assert.equal(no.session.getItem('omnip-bo-gtoken'), guardado);
  assert.equal(no.recargas, 0);

  let localBorrado = false, sessionBorrado = false;
  const roto = arrancar({
    confirmar: true,
    localRemove() { localBorrado = true; throw new Error('local bloqueado'); },
    sessionRemove() { sessionBorrado = true; throw new Error('session bloqueado'); },
  });
  assert.equal(localBorrado, true);
  assert.equal(sessionBorrado, true);
  assert.equal(roto.recargas, 1);
});
