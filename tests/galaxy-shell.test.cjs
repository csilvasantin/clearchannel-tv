// Shell cuadrático universal (FLT-101311): galaxy-shell.js reproduce el shell de la
// portada en cualquier página y traspasa a la portada los verbos que necesitan el mapa.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../galaxy-shell.js');
const C = require('../expert-commands.js');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const backoffice = read('backoffice.html');
// Sello del componente (galaxy-shell.css/js) en todas las páginas, sello de los ficheros
// de página que cambiaron con el shell (FLT-101311 c) y sello común de los ficheros de
// comportamiento de la portada (responsive-shell, expert-*, intro.js), que con la marca
// blanca (FLT-101331) suben a la vez.
const STAMP = '20261001-marca-1';
const PAGES_STAMP = '20261001-shell-2';
const PORTADA_STAMP = '20261001-marca-1';
const squash = html => html.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
const memory = () => {
  const mem = new Map();
  return {mem, getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k)};
};

test('the shell markup has the ids, classes, modes and icons of the portada', () => {
  const {header, options, advanced, expert} = S.markup({section: '/ backoffice'}, {lang: 'es', wordmark: 'CLEAR·CHANNEL'});
  assert.match(header, /^<header class="galaxy-shell">/);
  assert.match(header, /<button type="button" id="header-menu-toggle" class="mode-toggle"[^>]*aria-controls="header-navigation" data-mode="options"[^>]*>☰<\/button>/);
  assert.match(header, /<button type="button" id="header-advanced-toggle" class="mode-toggle"[^>]*aria-controls="advanced-tools" data-mode="advanced"[^>]*>▤<\/button>/);
  assert.match(header, /<button type="button" id="header-expert-toggle" class="mode-toggle"[^>]*aria-controls="expert-panel" data-mode="expert"[^>]*>⌘<\/button>/);
  assert.match(header, /class="brand-heading"[\s\S]*id="header-menu-toggle"[\s\S]*class="logo"[\s\S]*data-brand-wordmark[^>]*>CLEAR·CHANNEL<\/a><span class="sub galaxy-shell-section"[^>]*>\/ backoffice<\/span>/);
  assert.match(header, /<div class="mode-switches" role="group"[\s\S]*id="header-login" class="mode-toggle header-login"[\s\S]*id="header-advanced-toggle"[\s\S]*id="header-expert-toggle"/);
  assert.match(options, /^<nav id="header-navigation" class="mode-panel options-panel"[^>]*hidden>/);
  assert.match(options, /data-close-mode="options"/);
  assert.match(advanced, /^<details id="advanced-tools" class="mode-panel advanced-panel">/);
  assert.match(advanced, /<summary class="mode-panel-head">[\s\S]*<div class="advanced-actions">/);
  assert.match(expert, /^<section id="expert-panel" class="mode-panel expert-panel"[^>]*hidden>/);
  assert.deepEqual([...expert.matchAll(/data-module="([^"]+)"/g)].map(m => m[1]), ['cli', 'verbos', 'rutinas']);
  // Every id of the portada shell exists once in the component, and the toggles match the portada byte for byte.
  for (const id of S.PANEL_IDS) assert.equal((index.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, 'index ' + id);
  const all = [header, options, advanced, expert].join('\n');
  for (const id of [...S.PANEL_IDS, 'header-login', 'lang-switch', 'lang-toggle', 'expert-command-form', 'expert-command', 'expert-command-result', 'expert-verbs', 'expert-save-routine', 'expert-routines']) {
    assert.equal((all.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, 'shell ' + id);
    assert.ok(index.includes(`id="${id}"`), 'portada ' + id);
  }
  for (const id of ['header-advanced-toggle', 'header-expert-toggle']) {
    const tag = html => html.match(new RegExp(`<button type="button" id="${id}"[^>]*>[^<]*</button>`))[0];
    assert.equal(tag(header), tag(index), id);
  }
});

test('the expert panel is the very same markup as the portada', () => {
  const portada = index.slice(index.indexOf('<section id="expert-panel"'), index.indexOf('<div class="space"'));
  assert.equal(squash(S.markup({}, {lang: 'es'}).expert), squash(portada));
});

test('Options is common to every page: Inicio, Player virtual, Ayuda, page links and the ENG/ESP switch', () => {
  const {options} = S.markup({options: [{href: 'about.html', es: 'Concepto RTB', en: 'RTB concept'}]}, {lang: 'es'});
  const links = [...options.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(links, [['/', 'Inicio'], ['/players/', 'Player virtual'], ['/help/#navigation-modes', 'Ayuda'], ['about.html', 'Concepto RTB']]);
  assert.match(options, /<div class="lang-switch" id="lang-switch"[^>]*><button type="button" class="lang-btn" id="lang-toggle" data-lang-target="en"[^>]*>ENG<\/button><\/div>\s*<\/nav>$/);
  assert.match(S.markup({}, {lang: 'en'}).options, /id="lang-toggle" data-lang-target="es"[^>]*>ESP</);
  // Same labels as the portada Options panel.
  for (const label of ['data-shell-text-es="Player virtual" data-shell-text-en="Virtual player"', 'data-shell-text-es="Ayuda" data-shell-text-en="Help"']) {
    assert.ok(index.includes(label) && options.includes(label), label);
  }
});

test('page declarations are escaped and cannot inject markup or script URLs', () => {
  const {header, advanced, options} = S.markup({
    section: '<img src=x onerror=alert(1)>',
    advanced: [{href: 'javascript:alert(1)', es: 'Malo', en: 'Bad'}, {id: 'x"y', es: '<b>', en: '<b>'}],
    options: [{href: '/ok', es: '"quoted"'}],
  }, {lang: 'es'});
  assert.ok(!/<img/.test(header) && header.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!advanced.includes('javascript:') && advanced.includes('href="#"'));
  assert.ok(advanced.includes('id="x&quot;y"') && advanced.includes('&lt;b&gt;'));
  assert.ok(options.includes('&quot;quoted&quot;'));
  assert.equal(S.normalizeConfig({home: '//evil.example'}).home, '/');
  assert.equal(S.normalizeConfig({home: 'https://evil.example'}).home, '/');
  assert.equal(S.normalizeConfig({home: '/'}).home, '/');
  assert.equal(S.normalizeConfig({}, {section: 'backoffice'}).section, 'backoffice');
});

test('language follows the portada rule: ?lang= beats the per-brand preference, then the brand default', () => {
  const admira = {id: 'admira', defaultLanguage: 'es'}, cc = {id: 'clearchannel', defaultLanguage: 'en'};
  const store = memory();
  assert.equal(S.languageKey(admira), 'admira-lang');
  assert.equal(S.preferredLanguage('', store, admira), 'es');
  assert.equal(S.preferredLanguage('', store, cc), 'en');
  store.setItem('clearchannel-lang', 'es');
  assert.equal(S.preferredLanguage('', store, cc), 'es');
  assert.equal(S.preferredLanguage('?lang=en', store, cc), 'en');
  assert.equal(S.preferredLanguage('?lang=fr', store, cc), 'es');
  assert.ok(read('app.js').includes("(window.ADMIRA_SITE_BRAND?.id || 'clearchannel') + '-lang'"));
  assert.ok(backoffice.includes("(window.ADMIRA_SITE_BRAND?.id || 'clearchannel') + '-lang'"), 'backoffice shares the portada language key');
  assert.ok(!backoffice.includes("'omnip-lang'"));
});

test('backoffice.html loads the shell and hands its own actions to the panels', () => {
  assert.ok(backoffice.includes(`<link rel="stylesheet" href="/galaxy-shell.css?v=${STAMP}">`));
  assert.ok(backoffice.includes(`<script defer src="/galaxy-shell.js?v=${STAMP}"></script>`));
  assert.ok(backoffice.indexOf('window.ADMIRA_SHELL') < backoffice.indexOf('/galaxy-shell.js?v='), 'config before the component');
  assert.ok(!/<header[\s>]/.test(backoffice), 'no own header: the universal one replaces it');
  assert.ok(!/<nav[\s>]/.test(backoffice));
  const slots = backoffice.slice(backoffice.indexOf('<div data-shell-slots hidden>'), backoffice.indexOf('</div>', backoffice.indexOf('<div data-shell-slots hidden>')));
  for (const [id, slot] of [['btn-logout', 'advanced'], ['nav-demos', 'advanced'], ['badge-mode', 'advanced']]) assert.match(slots, new RegExp(`id="${id}"[^>]*data-shell-slot="${slot}"`), id);
  for (const href of ['target/', '../xpace-os/']) assert.match(slots, new RegExp(`href="${href.replace(/[./]/g, '\\$&')}" data-shell-slot="advanced"`), href);
  assert.match(slots, /href="about\.html" data-shell-slot="options"/);
  // Logout keeps its own handler; the inner layout follows the measured shell header.
  assert.match(backoffice, /document\.getElementById\('btn-logout'\)\.addEventListener\('click', \(\) => \{\s*if \(!confirm\(t\('logout_confirm'\)\)\) return;\s*clearAuth\(\);\s*location\.reload\(\);/);
  assert.ok(!backoffice.includes('100vh - 65px'));
  assert.match(backoffice, /\.shell\{[^}]*calc\(100dvh - var\(--app-header-height,64px\) - var\(--shell-bottom,0px\)\)/);
  assert.match(backoffice, /\.gate\{position:fixed;inset:0;z-index:9500;/, 'login gate covers the shell panels');
  // Everything the backoffice did is still there.
  for (const id of ['gate', 'g-signin', 'demo-access', 'demo-cards', 'catalog-shell', 'bo-list-ul', 'bo-map', 'bo-editor', 'btn-publish']) assert.ok(backoffice.includes(`id="${id}"`), id);
  // /backoffice still redirects to backoffice.html.
  assert.match(read('backoffice/index.html'), /location\.replace\('\/backoffice\.html'/);
});

test('galaxy-shell.css reuses responsive-shell.css and the service worker keeps both fresh', () => {
  const css = read('galaxy-shell.css');
  assert.match(css, new RegExp(`^/\\*[\\s\\S]*?\\*/\\s*@import url\\('responsive-shell\\.css\\?v=${PORTADA_STAMP}'\\);`));
  const sw = read('sw.js');
  const shell = new RegExp(sw.match(/const SHELL_CODE = \/(.+)\/;/)[1]);
  for (const f of ['/galaxy-shell.js', '/galaxy-shell.css', '/responsive-shell.js', '/expert-panel.js']) assert.ok(shell.test(f), f);
  // The component loads the same behaviour scripts as the portada, in the same order.
  const js = read('galaxy-shell.js');
  const order = ["load('responsive-shell.js')", "load('expert-commands.js')", "load('expert-panel.js')"].map(s => js.indexOf(s));
  assert.ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2]);
  assert.ok(index.includes(`expert-panel.js?v=${PORTADA_STAMP}`) && index.includes(`expert-commands.js?v=${PORTADA_STAMP}`));
  assert.ok(index.includes(`responsive-shell.css?v=${PORTADA_STAMP}`) && index.includes(`responsive-shell.js?v=${PORTADA_STAMP}`));
});

test('away from the map, map verbs are handed to the portada; local verbs run in place', () => {
  const handed = [];
  const ctx = {
    handoff: command => { handed.push(command); return {ok: true}; },
    demo: () => { throw new Error('no map here'); }, circuit: () => { throw new Error('no map here'); }, search: () => { throw new Error('no map here'); },
    stop() {}, clear() { handed.push('cleared'); }, routines: () => C.defaultRoutines('es'),
  };
  let r = C.execute('/demo Starbucks', ctx, 'es');
  assert.equal(r.ok, true); assert.equal(r.handoff, true); assert.equal(r.command, '/demo starbucks');
  assert.match(r.lines[0], /portada.*\/demo starbucks/);
  assert.equal(C.execute('/circuito cliente=alcampo', ctx).handoff, true);
  assert.equal(C.execute('/buscar Gran Vía', ctx).handoff, true);
  assert.deepEqual(handed, ['/demo starbucks', '/circuito alcampo', '/buscar Gran Vía']);
  assert.equal(C.execute('/help', ctx).handoff, undefined);
  assert.match(C.execute('/help', ctx).lines.join('\n'), /\/demo \[cliente\].*se ejecuta en el mapa de la portada/);
  assert.equal(C.execute('/limpiar', ctx).cleared, true);
  assert.equal(C.execute('/demo pepsi', ctx).ok, false, 'invalid commands are not handed over');
  assert.equal(handed.length, 4);
  assert.equal(C.execute('/demo jti', Object.assign({}, ctx, {handoff: () => ({ok: false})})).ok, false);
});

test('pending orders live in sessionStorage only, are canonical, consumed once and expire', () => {
  const store = memory(), now = 1_000_000;
  assert.equal(C.savePending(store, '/demo cliente=Starbucks', now), true);
  assert.deepEqual(JSON.parse(store.mem.get(C.PENDING_KEY)), {command: '/demo starbucks', at: now});
  assert.equal(C.takePending(store, now + 1000), '/demo starbucks');
  assert.equal(C.takePending(store, now + 1000), null, 'consumed');
  C.savePending(store, '/circuito jti', now);
  assert.equal(C.takePending(store, now + C.PENDING_TTL + 1), null, 'expired');
  assert.equal(store.mem.has(C.PENDING_KEY), false);
  for (const bad of ['/help', '/limpiar', '/evil()', '']) assert.equal(C.savePending(store, bad, now), false, bad);
  store.setItem(C.PENDING_KEY, JSON.stringify({command: 'alert(1)', at: now}));
  assert.equal(C.takePending(store, now), null);
  store.setItem(C.PENDING_KEY, '{broken');
  assert.equal(C.takePending(store, now), null);
  // The component never puts the order in the URL: it navigates to the bare home path.
  const js = read('galaxy-shell.js');
  assert.match(js, /C\.savePending\(session, command\)/);
  assert.match(js, /location\.assign\(cfg\.home\)/);
  // The portada runs it on load (only when it is the map, not away).
  const panel = read('expert-panel.js');
  assert.match(panel, /C\.takePending\(root\.sessionStorage\)/);
  assert.match(panel, /if \(!away\) \{[\s\S]*runPending/);
});

test('pages can register their own verbs without clobbering shared ones or shared routines', () => {
  const verb = C.registerVerb({id: 'nuevo', aliases: ['new'], es: 'Alta', en: 'New', run: () => ({ok: true, lines: ['ok']})});
  assert.equal(verb.command, '/nuevo'); assert.equal(verb.local, true);
  assert.ok(C.VERBS.includes(verb));
  assert.equal(C.execute('/new', {}).ok, true);
  assert.equal(C.parse('/NUEVO').verb, verb);
  assert.throws(() => C.registerVerb({id: 'demo', run() {}}), /ya existe/);
  assert.throws(() => C.registerVerb({id: 'otro', aliases: ['cli'], run() {}}), /ya existe/);
  assert.throws(() => C.registerVerb({id: 'sinrun'}), TypeError);
  assert.equal(C.addRoutine([], '/nuevo').ok, false, 'local verbs are not saved as shared routines');
  assert.deepEqual(C.sanitizeRoutines([{command: '/nuevo'}, {command: '/demo jti'}]).map(r => r.command), ['/demo jti']);
  assert.match(C.helpLines('es').join('\n'), /\/nuevo — Alta.*solo en esta página/);
  assert.match(backoffice, /verbs: \[\{\s*id: 'nuevo'/);
});

// ─── Todas las páginas (FLT-101311 c) ────────────────────────────────────────────
// Guardián de coherencia: cada HTML del sitio carga el shell cuadrático, es la portada
// (que lo trae en línea) o figura aquí con el motivo concreto por el que queda fuera.
// Una página nueva que no cargue el shell hace fallar este test.
const SHELL_EXCEPTIONS = {
  'backoffice/index.html': 'Redirección inmediata a /backoffice.html (location.replace + meta refresh); no pinta nada.',
  'presentation/cc/index.html': 'Redirección inmediata a /presentation/ (location.replace + meta refresh); no pinta nada.',
  'wututu/index.html': 'Bundle Vite compilado fuera de este repo: demo de contador de audiencias para iPad que se proyecta en un MUPI a pantalla completa (100vh, overflow oculto); una barra encima cortaría el escenario y el HTML se regenera en cada build.',
};
// Cabeceras de contenido (título de la página dentro de un contenedor), no barras de navegación.
const CONTENT_HEADERS = {
  'help/index.html': 'Portada de la ayuda dentro de .wrap (título y resumen).',
  'store-3d.html': 'Título de la escena 3D dentro de .app (nombre del Xpace y hotspots).',
  'presentation/index.html': 'Hero de la presentación (header.hero con data-shell-keep).',
};
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler']);
function htmlPages(dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlPages(full, out);
    else if (entry.name.endsWith('.html')) out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out.sort();
}
const pages = htmlPages();
const adopted = pages.filter(page => page !== 'index.html' && !SHELL_EXCEPTIONS[page]);
const headEnd = html => ['</head>', '<body'].map(tag => html.indexOf(tag)).filter(i => i >= 0).reduce((a, b) => Math.min(a, b), html.length);

test('every page loads the four-band shell, is the portada, or is a listed exception with its reason', () => {
  assert.ok(pages.length >= 18, 'the walk finds the site pages');
  for (const [page, reason] of Object.entries(SHELL_EXCEPTIONS)) {
    assert.ok(pages.includes(page), `stale exception: ${page}`);
    assert.ok(reason.length > 40, `exception without a concrete reason: ${page}`);
    assert.ok(!read(page).includes('galaxy-shell'), `${page} is listed as an exception but loads the shell`);
  }
  for (const page of ['backoffice/index.html', 'presentation/cc/index.html']) assert.match(read(page), /location\.replace\(/, page);
  for (const id of S.PANEL_IDS) assert.ok(index.includes(`id="${id}"`), 'the portada carries the shell in line: ' + id);
  // The pages Carlos named, plus the ones discovered around them.
  for (const page of ['about.html', 'backoffice.html', 'detail.html', 'marketplace.html', 'store-3d.html', 'walk.html', 'documentacion/index.html',
    'help/index.html', 'mcp/index.html', 'parrilla/index.html', 'presentacion/index.html', 'presentation/index.html', 'target/index.html',
    'tutorial/index.html', 'players/index.html']) assert.ok(adopted.includes(page), page);
  for (const page of adopted) {
    const html = read(page);
    const css = `<link rel="stylesheet" href="/galaxy-shell.css?v=${STAMP}">`;
    assert.equal(html.split(css).length - 1, 1, `${page}: galaxy-shell.css?v=${STAMP} exactly once`);
    assert.match(html, new RegExp(`<script defer src="/galaxy-shell\\.js\\?v=${STAMP}"[^>]*></script>`), `${page}: galaxy-shell.js?v=${STAMP}`);
    assert.equal((html.match(/galaxy-shell\.(?:css|js)\?v=/g) || []).length, 2, `${page}: one stamp for both files`);
    // The component's stylesheet goes after the page's own styles, so the shell wins ties.
    const at = html.indexOf(css), end = headEnd(html);
    assert.ok(at < end, `${page}: shell in <head>`);
    const head = html.slice(at + css.length, end);
    assert.ok(!/<style[\s>]|rel="stylesheet"/.test(head), `${page}: no page styles after galaxy-shell.css`);
    if (html.includes('window.ADMIRA_SHELL')) assert.ok(html.indexOf('window.ADMIRA_SHELL') < html.indexOf('/galaxy-shell.js?v='), `${page}: config before the component`);
    // No page keeps its own bar: the admira-design nav and the per-page headers are gone.
    assert.ok(!/class="admira-nav[\s"]/.test(html) && !html.includes('admira-design/nav.css'), `${page}: own admira-nav`);
    const headers = html.match(/<header[\s>][^>]*/g) || [];
    for (const tag of headers) assert.ok(CONTENT_HEADERS[page] || tag.includes('data-shell-keep'), `${page}: own <header> left in place: ${tag}`);
    if (page === 'presentation/index.html') assert.match(html, /<header class="hero" id="top" data-shell-keep>/);
    for (const [, slot] of html.matchAll(/data-shell-slot="([^"]*)"/g)) assert.ok(['advanced', 'options'].includes(slot), `${page}: slot ${slot}`);
    assert.ok(!/100vh - (?:42|65|76|112|120)px|top:\s*94px/.test(html), `${page}: fixed heights of the old headers`);
  }
});

test('pages hand their own navigation to ☰ Opciones and their work to ▤ Avanzado', () => {
  const slot = (page, attrs, where) => assert.match(read(page), new RegExp(`<(?:a|button)[^>]*${attrs}[^>]*data-shell-slot="${where}"|<(?:a|button)[^>]*data-shell-slot="${where}"[^>]*${attrs}`), `${page}: ${attrs} → ${where}`);
  slot('about.html', 'href="marketplace\\.html"', 'options');
  slot('about.html', 'href="#flujo"', 'advanced');
  slot('detail.html', 'id="back-map"', 'options');
  slot('detail.html', 'id="advanced-store-3d"', 'advanced');
  slot('detail.html', 'data-admira-contact', 'options');
  slot('marketplace.html', 'data-admira-contact', 'options');
  slot('store-3d.html', 'id="back-detail"', 'options');
  slot('documentacion/index.html', 'href="/presentation/"', 'options');
  slot('mcp/index.html', 'href="llms\\.txt"', 'advanced');
  slot('parrilla/index.html', 'id="emitBtn"', 'advanced');
  slot('parrilla/index.html', 'id="autoBtn"', 'advanced');
  slot('presentation/index.html', 'href="#xtanco"', 'advanced');
  slot('target/index.html', 'data-action="publish"', 'advanced');
  slot('target/index.html', 'data-action="export"', 'advanced');
  slot('tutorial/index.html', 'href="\\.\\./target/"', 'options');
  // Handlers that look the moved elements up keep finding them.
  assert.match(read('detail.html'), /getElementById\('advanced-store-3d'\)\.href = store3dHref/);
  assert.ok(!read('detail.html').includes("getElementById('side-map')"), 'the old side rail is gone');
  assert.match(read('parrilla/index.html'), /\$\('#emitBtn'\)\.onclick=emitNow;\$\('#autoBtn'\)\.onclick=toggleAuto;/);
  assert.match(read('target-assets/app.js'), /qsa\("\[data-action\]"\)\.forEach/);
  // Ayuda in ☰ Opciones lands on the navigation section of /help/.
  assert.ok(S.COMMON_OPTIONS.some(o => o.href === '/help/#navigation-modes') && read('help/index.html').includes('id="navigation-modes"'));
});

test('one language switch: pages with their own i18n follow the shell and the per-brand key', () => {
  for (const page of ['target/index.html', 'tutorial/index.html']) {
    const html = read(page);
    assert.match(html, /window\.ADMIRA_SHELL = \{[^\n]*setLang: lang => setLang\(lang\) \};/, page);
    assert.ok(!html.includes('target-lang-btn'), `${page}: no second language switch`);
    assert.ok(html.indexOf('/galaxy-shell.js?v=') < html.indexOf('src="../target-assets/app.js'), page);
  }
  const app = read('target-assets/app.js');
  assert.match(app, /const LANG_KEY = `\$\{SITE_BRAND\.id \|\| "clearchannel"\}-lang`;/);
  assert.ok(!app.includes('omnip-lang'));
  const walk = read('walk.mjs');
  assert.ok(!walk.includes('omnip-lang') && !walk.includes("$('language')"));
  assert.match(walk, /\(window\.ADMIRA_SITE_BRAND\?\.id \|\| 'clearchannel'\) \+ '-lang'/);
  assert.match(walk, /document\.addEventListener\('admira:lang'/);
  assert.match(read('walk.html'), /window\.ADMIRA_SHELL = \{[^\n]*setLang\(\) \{\} \};/);
  assert.ok(!read('walk.html').includes('id="language"'));
  // The shell dispatches the event walk.mjs listens to, after storing the per-brand preference.
  assert.match(read('galaxy-shell.js'), /store\.setItem\(languageKey\(brand\), next\)[\s\S]*new CustomEvent\('admira:lang'/);
});

test('keyboard shortcuts of slides and 3D scene ignore the expert CLI', () => {
  for (const page of ['presentacion/index.html', 'store-3d.html']) {
    const html = read(page);
    const handler = html.slice(html.lastIndexOf("addEventListener('keydown'"));
    assert.match(handler.slice(0, 400), /closest\('input,textarea,select,\[contenteditable\],\.mode-panel'\)\)\s*return/, page);
  }
});

test('layouts measure the shell instead of the old headers', () => {
  assert.match(read('store-3d.html'), /\.app\{height:calc\(100vh - var\(--app-header-height,64px\) - var\(--shell-bottom,0px\)\);height:calc\(100dvh - var\(--app-header-height,64px\) - var\(--shell-bottom,0px\)\)/);
  assert.match(read('store-3d.html'), /\.app > header\{/, 'the scene header is scoped, it no longer styles the shell bar');
  const deck = read('presentacion/index.html');
  assert.match(deck, /^<!doctype html>/);
  for (const sel of ['#stage', '.crt', '.flicker']) assert.match(deck, new RegExp(`${sel.replace(/[.#]/g, '\\$&')}\\{position:fixed;inset:var\\(--app-header-height,64px\\) 0 var\\(--shell-bottom,0px\\)`), sel);
  assert.match(deck, /#nav\{position:fixed;z-index:70;bottom:calc\(var\(--shell-bottom,0px\) \+ 14px\)/);
  const css = read('target-assets/styles.css');
  assert.match(css, /top: calc\(var\(--app-header-height, 64px\) \+ 18px\);\n  max-height: calc\(100vh - var\(--app-header-height, 64px\) - var\(--shell-bottom, 0px\) - 36px\);/);
  assert.match(css, /\.toast \{[^}]*z-index: 9450;/, 'page toasts above the shell panels');
  assert.ok(!/\.topbar \{|\.target-lang-btn \{|\.tutorial-nav \{/.test(css), 'no styles left for the removed bars');
  assert.match(read('presentation/index.html'), /\.hero\{min-height:calc\(100svh - var\(--app-header-height,64px\)\)/);
  assert.match(read('help/index.html'), /\.wrap > header\{/);
  // Files whose content changed carry the new stamp so the service worker does not serve the old copy.
  for (const [page, file] of [['target/index.html', 'target-assets/styles.css'], ['target/index.html', 'target-assets/app.js'], ['tutorial/index.html', 'target-assets/app.js'], ['walk.html', 'walk.css'], ['walk.html', 'walk.mjs']]) {
    assert.ok(read(page).includes(`${file.split('/').pop()}?v=${PAGES_STAMP}`), `${page}: ${file}?v=${PAGES_STAMP}`);
  }
});

test('the bar wears the portada colours on every page, per brand, and stays on top of page content', () => {
  const css = read('galaxy-shell.css');
  const tokens = text => Object.fromEntries([...text.matchAll(/--([a-z0-9]+):\s*([^;}]+)/g)].map(m => [m[1], m[2].trim().replace(/\s+/g, '')]));
  const cc = tokens(css.match(/body > header\.galaxy-shell,#header-navigation,#advanced-tools,#expert-panel\{(--bg[^}]+)\}/)[1]);
  const portada = tokens(index.match(/:root\{(--bg[^}]+)\}/)[1]);
  for (const [k, v] of Object.entries(portada)) assert.equal(cc[k], v, 'clearchannel --' + k);
  const admira = tokens(css.match(/:root\[data-brand="admira"\] :is\([^)]*\)\{([^}]+)\}/)[1]);
  const brand = tokens(read('brand.css').match(/:root\[data-brand="admira"\] \{([^}]+)\}/)[1]);
  for (const [k, v] of Object.entries(brand)) assert.equal(admira[k], v, 'admira --' + k);
  assert.match(css, /body > header\.galaxy-shell\{z-index:8900\}/);
  assert.match(css, /html\[data-shell=galaxy\]\{scroll-padding-top:/);
  assert.match(css, /\.galaxy-shell-page \.admira-contact-panel\{z-index:9310\}/);
  // Element selectors of a page (section, li, strong, input, button…) cannot reshape the shell.
  for (const rule of ['#expert-panel .expert-module{padding:0;border-top:0', '#expert-panel li{', '#header-navigation > *{flex-shrink:0}', 'body > header.galaxy-shell .mode-toggle:not(.header-login){padding:0}', '#expert-panel #expert-command{min-height:0;margin:0']) assert.ok(css.includes(rule), rule);
});
