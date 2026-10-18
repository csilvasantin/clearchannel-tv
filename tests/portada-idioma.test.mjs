// Portada de admira.biz sin modo Experto (Carlos, 15-oct-2026): en el sitio de ⌘, la pastilla de idioma
// con la misma caja que ☰ y ▤; ENG pasa a inglés y ESP vuelve. Las demás páginas conservan ⌘.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const portada = leer('index.html'), app = leer('app.js'), galaxia = leer('galaxy-shell.js');

test('on the home page the ⌘ slot holds the language pill, same .mode-toggle box and compact zoom', () => {
  const grupo = portada.slice(portada.indexOf('class="mode-switches"'), portada.indexOf('</div>', portada.indexOf('class="mode-switches"')));
  assert.match(grupo, /id="header-expert-toggle"[^>]*>⌘<\/button>\s*<button type="button" id="header-lang-toggle" class="mode-toggle header-lang" data-lang-target="en" data-admira-compact-control aria-label="Cambiar a inglés"[^>]*>ENG<\/button>/);
  assert.doesNotMatch(grupo.match(/id="header-lang-toggle"[^>]*>/)[0], /data-mode=|data-shell-(es|en)=/, 'not a panel toggle and labels owned by app.js');
  assert.match(portada, /#header-expert-toggle\{display:none!important\}/, 'Expert hidden on the home page');
  assert.match(portada, /\.mode-toggle\.header-lang\{font:700 12px\/1 /);
});

test('the pill and the Options menu switch share the same language code', () => {
  assert.match(app, /document\.querySelectorAll\('#lang-toggle, #header-lang-toggle'\)\.forEach\(langToggle => \{/);
  assert.match(app, /document\.querySelectorAll\('#lang-toggle, #header-lang-toggle'\)\.forEach\(boton => boton\.addEventListener\('click', e => \{\n  setLang\(/);
});

test('interior pages keep Expert (galaxy-shell.js still renders ⌘)', () => {
  // Desde FLT-102501 (15-oct-2026) la cabecera común también lleva la pastilla de idioma, pero al lado
  // de ⌘ y no en su sitio: las páginas interiores conservan el modo Experto visible.
  assert.match(galaxia, /id="header-expert-toggle"[^>]*>⌘<\/button>\s*<button type="button" id="header-lang-toggle" class="mode-toggle header-lang"/);
  assert.doesNotMatch(galaxia + leer('galaxy-shell.css'), /#header-expert-toggle\{display:none/);
});

// Con sesión, ⌘ ocupa el sitio de la pastilla de idioma (Carlos, 18-oct-2026: «una vez loginados, el icono de
// selección de idioma pasa a ser el modo experto»). Sesión = omnip-bo-gtoken de login-google.js con el ID token vigente.
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = exp => `${b64({alg: 'none'})}.${b64({exp, email: 'prueba@admira.biz', name: 'Prueba Ñandú'})}.firma`;
const ahora = Math.floor(Date.now() / 1000);
const CASOS = [
  ['vigente', JSON.stringify({token: token(ahora + 3600), email: 'prueba@admira.biz'}), true],
  ['caducada', JSON.stringify({token: token(ahora - 60), email: 'prueba@admira.biz'}), false],
  ['basura', '{no es json', false],
  ['sin token', JSON.stringify({email: 'x'}), false],
  ['vacía', null, false]
];
const almacen = v => ({getItem: k => (k === 'omnip-bo-gtoken' ? v : null), setItem() {}});
function marca(code, valor, extra = {}) {
  const clases = new Set();
  const documentElement = {lang: 'es', classList: {add: c => clases.add(c), contains: c => clases.has(c)}};
  const ctx = {localStorage: almacen(valor), document: {documentElement, getElementById: () => null, head: {append() {}}, addEventListener() {}},
    atob: s => Buffer.from(s, 'base64').toString('binary'), Date, JSON, String, Buffer, MutationObserver: class { observe() {} disconnect() {} }, setTimeout: () => 0, ...extra};
  ctx.window = ctx; ctx.globalThis = ctx; ctx.location = {hostname: 'www.admira.biz', pathname: '/'};
  vm.runInNewContext(code, ctx);
  return clases.has('admira-con-sesion');
}

test('con sesión, ⌘ vuelve a la portada y la pastilla de idioma se va (el idioma sigue en ☰)', () => {
  assert.match(portada, /html:not\(\.admira-con-sesion\) #header-expert-toggle\{display:none!important\}/);
  assert.match(portada, /html\.admira-con-sesion #header-lang-toggle\{display:none!important\}/);
  assert.doesNotMatch(portada, /\n\s*#header-expert-toggle\{display:none!important\}/, 'ya no se oculta ⌘ siempre');
  assert.match(portada, /id="lang-switch"[^>]*>[\s\S]{0,200}id="lang-toggle"/, 'el idioma sigue en ☰ Opciones');
  assert.match(galaxia, /regla\.textContent = 'html\.admira-con-sesion #header-lang-toggle\{display:none!important\}'/, 'páginas interiores: la misma barra');
  assert.match(portada, /login-google\.js\?v=20261018-sesion-experto-1/);
});

test('la portada, login-google.js y la cabecera común deciden igual si hay sesión, antes de pintar', () => {
  const head = portada.slice(0, portada.indexOf('</head>'));
  const inline = head.match(/<script>\n\/\* Con sesión, ⌘ ocupa[\s\S]*?\*\/\n([\s\S]*?)\n<\/script>/)[1];
  assert.ok(head.indexOf(inline) < head.indexOf('html.admira-con-sesion #header-lang-toggle'), 'la marca va antes de las reglas');
  const login = leer('login-google.js');
  const G = require('../galaxy-shell.js');
  const L = require('../login-google.js');
  for (const [nombre, valor, esperado] of CASOS) {
    assert.equal(marca(inline, valor), esperado, 'portada · ' + nombre);
    assert.equal(marca(login, valor), esperado, 'login-google.js · ' + nombre);
    assert.equal(G.sesionVigente(almacen(valor)), esperado, 'galaxy-shell.js · ' + nombre);
    assert.equal(!!L.stored(almacen(valor)), esperado, 'stored() · ' + nombre);
  }
  assert.match(login, /function signedIn\(session\) \{\n    marcarSesion\(\);/, 'al iniciar sesión con el popup, ⌘ aparece sin recargar');
  assert.match(galaxia, /if \(sesion\) html\.classList\.add\('admira-con-sesion'\);[\s\S]{0,400}document\.body\.prepend\(\.\.\.shellNodes\)/, 'la marca, antes de pintar la cabecera');
});
