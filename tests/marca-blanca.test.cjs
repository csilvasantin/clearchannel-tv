// Marca blanca en admira.app (FLT-101331): un solo mecanismo (marca-blanca.js) para la
// portada y el shell común, nada de admiranext.com sin marca activa, textos AA con
// cualquier marca y el verbo /marca del modo experto.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../marca-blanca.js');
const C = require('../expert-commands.js');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const STAMP = '20261003-superpuestos-1';
const memory = (init = {}) => {
  const mem = new Map(Object.entries(init));
  return {mem, getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k)};
};
const pages = (() => {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), {withFileTypes: true})) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel); else if (entry.name.endsWith('.html')) out.push(rel);
    }
  };
  walk('');
  return out;
})();

// Ejecuta marca-blanca.js en un navegador mínimo y anota todo lo que intenta cargar.
function boot({search = '', session = memory(), extra = {}, loadLinks = false, elements = {}} = {}) {
  const created = [], fetched = [];
  const node = tag => ({tagName: tag.toUpperCase(), attrs: {}, style: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() {}});
  const document = {
    currentScript: {src: 'https://www.admira.app/marca-blanca.js?v=' + STAMP},
    documentElement: {lang: 'es', style: {length: 0, setProperty() {}, removeProperty() {}}, getAttribute: () => null, removeAttribute() {}},
    head: {append: n => { created.push(n); if (loadLinks && n.onload) setImmediate(() => n.onload()); }},
    title: 'Mapa | admira.app',
    createElement: tag => node(tag),
    querySelector: () => null, querySelectorAll: () => [], getElementById: id => elements[id] || null,
    dispatchEvent() {}, addEventListener() {},
  };
  const window = {document, sessionStorage: session, location: {search, href: 'https://www.admira.app/' + search}, setTimeout: () => 0, clearTimeout() {},
    fetch: url => { fetched.push(url); return new Promise(() => {}); }, history: {replaceState() {}}, console};
  window.window = window;
  const context = vm.createContext(Object.assign(window, {URL, URLSearchParams, CustomEvent: class {}, MutationObserver: class { observe() {} disconnect() {} }, Promise}, extra));
  vm.runInContext(read('marca-blanca.js'), context);
  return {created, fetched, session, api: context.AdmiraMarca};
}

test('without an active brand nothing is loaded and admiranext.com is never contacted', () => {
  for (const [search, init] of [['', {}], ['?lang=es', {}], ['?marca=admira', {'mb:marca': 'lumbre'}], ['?marca=off', {'mb:marca': 'starbucks'}], ['?marca=', {}]]) {
    const r = boot({search, session: memory(init)});
    assert.deepEqual(r.created, [], `${search}: nothing injected`);
    assert.deepEqual(r.fetched, [], `${search}: no request`);
    assert.equal(r.session.getItem('mb:marca'), null, `${search}: no remembered brand`);
    assert.equal(r.api.actual(), null);
  }
  // No page carries the common white-label files statically: only marca-blanca.js inserts them, on demand.
  for (const page of pages) {
    const html = read(page);
    assert.ok(!/admiranext\.com\/marcablanca\/marcablanca\.(?:css|js)/.test(html), `${page}: static marcablanca`);
    assert.ok(!html.includes('marca-blanca.css'), `${page}: marca-blanca.css only via marca-blanca.js`);
  }
});

test('with ?marca=<id> or a remembered brand the loader, the common sheet and the local sheet are loaded', () => {
  for (const [search, init, id] of [['?marca=lumbre', {}, 'lumbre'], ['', {'mb:marca': 'starbucks'}, 'starbucks'], ['?marca=Frescaria', {}, 'frescaria']]) {
    const r = boot({search, session: memory(init)});
    const script = r.created.find(n => n.tagName === 'SCRIPT');
    assert.ok(script && script.src === M.BASE + 'marcablanca.js', `${id}: loader`);
    assert.equal(script.attrs['data-mb-plataforma'], 'app');
    assert.equal(script.attrs['data-mb-auto'], 'false', 'the site applies the brand itself, after checking the catalogue');
    const links = r.created.filter(n => n.tagName === 'LINK').map(n => n.href);
    assert.ok(links.includes(M.BASE + 'marcablanca.css'), `${id}: common sheet`);
    assert.ok(links.includes('https://www.admira.app/marca-blanca.css?v=' + STAMP), `${id}: local sheet with the same stamp`);
  }
});

// Mapa de MapLibre mínimo: capas, pintura y eventos «styledata».
function fakeMap() {
  const layers = new Map(), handlers = [];
  return {
    layers, handlers,
    getLayer: id => (layers.has(id) ? {id} : undefined),
    getPaintProperty: (id, prop) => (layers.get(id) || {})[prop],
    setPaintProperty: (id, prop, value) => { layers.get(id)[prop] = value; },
    on: (event, fn) => { if (event === 'styledata') handlers.push(fn); },
    off: (event, fn) => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); },
    addLayer(id, paint) { layers.set(id, Object.assign({}, paint)); handlers.slice().forEach(fn => fn()); },
  };
}
const fakeLoader = () => ({
  version: 'test',
  cargar: id => Promise.resolve({id, nombre: 'Starbucks', catalogo: {propuesta: true}}),
  aplicar: id => Promise.resolve({id, modo: 'claro', marca: {id, nombre: 'Starbucks', catalogo: {propuesta: true}},
    variables: {'--mb-primario': '#006241', '--mb-primario-texto': '#FFFFFF', '--mb-fondo': '#FFFFFF', '--mb-superficie': '#FFFFFF', '--mb-texto': '#0F1C1D', '--mb-texto-suave': '#576061'}}),
});
const ticks = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

test('the brand colours the map clusters even when app.js adds or recreates the layers later', async () => {
  const map = fakeMap();
  const video = {style: {}}, intro = {style: {}};
  const r = boot({search: '?marca=starbucks', loadLinks: true, extra: {map, MarcaBlanca: fakeLoader()}, elements: {'intro-video': video, intro}});
  assert.equal(video.style.visibility, 'hidden', 'the recorded intro (default orange clusters) is hidden from the start');
  await ticks();
  assert.equal(r.api.actual().id, 'starbucks');
  assert.equal(map.handlers.length, 1, 'listens to the map before its layers exist');
  // The clusters layer arrives later (slow catalogue, globe still loading): it is painted at once.
  map.addLayer('clusters', {'circle-color': ['match', ['get', 'circIdx'], 0, '#ffd866', '#78f3ff']});
  map.addLayer('cluster-count', {'text-color': '#001620'});
  map.addLayer('selected-ring', {'circle-stroke-color': '#78f3ff'});
  assert.equal(map.getPaintProperty('clusters', 'circle-color'), '#006241');
  assert.equal(map.getPaintProperty('cluster-count', 'text-color'), '#FFFFFF');
  assert.equal(map.getPaintProperty('selected-ring', 'circle-stroke-color'), '#006241');
  // A layer switch recreates the layers with the default colours: they are painted again.
  map.addLayer('clusters', {'circle-color': '#78f3ff'});
  assert.equal(map.getPaintProperty('clusters', 'circle-color'), '#006241');
  // Back to Admira: default colours, intro untouched again, no listener left.
  r.api.desactivar();
  assert.deepEqual(map.getPaintProperty('clusters', 'circle-color'), '#78f3ff');
  assert.equal(map.handlers.length, 0);
  assert.equal(video.style.visibility, '');
});

test('without a brand the intro video and the map are not touched', async () => {
  const map = fakeMap();
  map.layers.set('clusters', {'circle-color': '#78f3ff'});
  const video = {style: {}};
  boot({search: '', extra: {map, MarcaBlanca: fakeLoader()}, elements: {'intro-video': video}});
  await ticks();
  assert.deepEqual(video.style, {});
  assert.equal(map.handlers.length, 0);
  assert.equal(map.getPaintProperty('clusters', 'circle-color'), '#78f3ff');
});

test('the brand decision follows the common loader: ?marca= wins and is remembered, admira/off forget it', () => {
  const s = memory();
  assert.deepEqual(M.decide('?marca=lumbre', s), {id: 'lumbre', remember: true});
  assert.deepEqual(M.decide('?marca=LÚMBRE', s), {id: 'lumbre', remember: true});
  assert.deepEqual(M.decide('?marca=admira', memory({'mb:marca': 'lumbre'})), {id: null, forget: true});
  assert.deepEqual(M.decide('?marca=off', s), {id: null, forget: true});
  assert.deepEqual(M.decide('', memory({'mb:marca': 'brumelle'})), {id: 'brumelle'});
  assert.deepEqual(M.decide('?marca=<script>', memory({'mb:marca': 'brumelle'})), {id: 'brumelle'}, 'a malformed id is ignored');
  assert.deepEqual(M.decide('', memory({'mb:marca': '../evil'})), {id: null});
  assert.deepEqual(M.decide('', null), {id: null});
  assert.equal(M.decideMode('?modo=oscuro', memory()), 'oscuro');
  assert.equal(M.decideMode('?modo=raro', memory()), 'marca');
});

test('/marca <web> only accepts http(s) websites and builds the analyser URL', () => {
  assert.equal(M.normalizeUrl('starbucks.es'), 'https://starbucks.es/');
  assert.equal(M.normalizeUrl('https://www.starbucks.es/menu?x=1'), 'https://www.starbucks.es/menu?x=1');
  for (const bad of ['lumbre', 'javascript:alert(1)', 'ftp://x.com', 'https://user:pw@x.com', 'no es una web', '', 'http://localhost']) assert.equal(M.normalizeUrl(bad), null, bad);
  assert.equal(M.analyzerUrl('https://starbucks.es/'), 'https://www.admiranext.com/marcablanca/?web=https%3A%2F%2Fstarbucks.es%2F');
});

test('texts of the bar and panels reach WCAG AA with light, dark and hostile palettes', () => {
  const palettes = {
    starbucks: {modo: 'claro', primario: '#006241', 'primario-texto': '#FFFFFF', secundario: '#000000', acento: '#C58800', 'acento-texto': '#231800', fondo: '#FFFFFF', superficie: '#FFFFFF', 'superficie-alt': '#EEEFEF', texto: '#0F1C1D', 'texto-suave': '#576061', ok: '#2F7D4F', error: '#C0392B'},
    lumbre: {modo: 'claro', primario: '#3B2318', 'primario-texto': '#FFF7EC', secundario: '#C2703F', acento: '#E0703A', 'acento-texto': '#FFFFFF', fondo: '#F7F0E6', superficie: '#FFFAF3', 'superficie-alt': '#F3E7D6', texto: '#2A1A12', 'texto-suave': '#6E5646', ok: '#4F7D3A', error: '#B8432F'},
    brumelle: {modo: 'oscuro', primario: '#D4FF3A', 'primario-texto': '#0A0A0A', secundario: '#F2EFE9', acento: '#FF3D7F', 'acento-texto': '#0A0A0A', fondo: '#0A0A0A', superficie: '#161616', 'superficie-alt': '#1F1F1F', texto: '#F2EFE9', 'texto-suave': '#A8A39A', ok: '#7EE08A', error: '#FF4D4D'},
    admira: {modo: 'oscuro', primario: '#FFD866', 'primario-texto': '#1A1405', acento: '#FF4488', fondo: '#0A0C12', superficie: '#141826', texto: '#F0E6FF', 'texto-suave': 'rgba(216,200,255,.68)', ok: '#88FFAA', error: '#FF6B6B'},
    // Una propuesta automática mal contrastada: amarillo sobre blanco y texto gris claro.
    hostil: {modo: 'claro', primario: '#FFE14D', 'primario-texto': '#FFFFFF', acento: '#FFF3B0', fondo: '#FFFFFF', superficie: '#FAFAFA', texto: '#BBBBBB', 'texto-suave': '#DDDDDD', ok: '#9BE29B', error: '#FFB3B3'},
  };
  for (const [name, p] of Object.entries(palettes)) {
    const vars = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'modo').map(([k, v]) => ['--mb-' + k, v]));
    const t = M.shellTokens(vars, p.modo);
    for (const token of ['--mbx-ink', '--mbx-mut', '--mbx-brand', '--mbx-accent', '--mbx-ok', '--mbx-error']) {
      for (const bg of [p.fondo, p.superficie]) assert.ok(M.contrast(t[token], bg) >= 4.5, `${name} ${token} ${t[token]} on ${bg}: ${M.contrast(t[token], bg).toFixed(2)}`);
    }
    assert.ok(M.contrast(t['--mbx-on-brand'], t['--mbx-brand']) >= 4.5, `${name} text on brand`);
    assert.ok(M.contrast(t['--mbx-on-accent'], t['--mbx-accent']) >= 4.5, `${name} text on accent`);
  }
  // The brand's own colours are kept whenever they are readable.
  const sb = M.shellTokens({'--mb-primario': '#006241', '--mb-fondo': '#FFFFFF', '--mb-superficie': '#FFFFFF', '--mb-texto': '#0F1C1D', '--mb-texto-suave': '#576061', '--mb-primario-texto': '#FFFFFF'}, 'claro');
  assert.equal(sb['--mbx-brand'], '#006241');
  assert.equal(sb['--mbx-mut'], '#576061');
  assert.equal(sb['--mbx-on-brand'], '#FFFFFF');
  assert.equal(M.contrast('#000', '#fff').toFixed(1), '21.0');
});

test('the portada and the common shell share the same single mechanism', () => {
  const index = read('index.html');
  const tag = `<script defer src="marca-blanca.js?v=${STAMP}"></script>`;
  assert.equal(index.split(tag).length - 1, 1, 'the portada loads marca-blanca.js once');
  const head = index.slice(0, index.indexOf('</head>'));
  assert.ok(head.includes(tag) && head.indexOf(tag) < head.indexOf('responsive-shell.js?v='), 'in <head>, before the shell behaviour');
  assert.ok(index.includes(`expert-panel.js?v=${STAMP}`), 'same stamp as the expert scripts it talks to');
  const shell = read('galaxy-shell.js');
  assert.match(shell, /load\('marca-blanca\.js'\)\.catch\(/, 'galaxy-shell.js loads the very same file, with its own stamp, without blocking the shell');
  for (const page of pages.filter(p => p !== 'index.html')) assert.ok(!read(page).includes('marca-blanca.js'), `${page}: gets it through galaxy-shell.js`);
  // Every rule of the local sheet only applies while a brand is active on the app platform.
  const css = read('marca-blanca.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, '$1').match(/[^{}]+\{[^{}]*\}/g);
  assert.ok(rules.length > 30);
  for (const rule of rules) for (const sel of rule.slice(0, rule.indexOf('{')).split(/,(?![^(]*\))/)) {
    assert.match(sel.trim(), /^:root\[data-mb-marca\]\[data-mb-plataforma="app"\]/, 'unscoped selector: ' + sel.trim());
  }
  // The service worker keeps both files fresh, like the rest of the shell code.
  const sw = read('sw.js');
  const fresh = new RegExp(sw.match(/const SHELL_CODE = \/(.+)\/;/)[1]);
  for (const f of ['/marca-blanca.js', '/marca-blanca.css']) assert.ok(fresh.test(f), f);
  assert.match(read('_headers'), /\/marca-blanca\.js\n {2}Cache-Control: public, max-age=0, must-revalidate/);
  // Inline colours of the portada that now read the brand keep their usual value as fallback.
  for (const [token, fallback] of [['--mbx-accent', '#ffd866'], ['--mbx-ok', '#7dffd0'], ['--mbx-inset', 'rgba(20,16,6,.4)'], ['--mbx-fondo', '#0a1118']]) {
    assert.ok(index.includes(`var(${token},${fallback})`), `${token} falls back to ${fallback}`);
  }
});

test('the brand stays on top of the domain identity and does not touch the worker', () => {
  const js = read('marca-blanca.js');
  assert.ok(!/data-brand\b(?!-)/.test(js.replace(/data-brand-wordmark/g, '')), 'never rewrites data-brand (brand.js / _worker.js own it)');
  assert.ok(!/marca-?blanca|data-mb-/.test(read('_worker.js')), 'the worker is untouched');
  // The client logo goes before the domain wordmark, which becomes the “powered by”.
  assert.match(js, /logo\.insertBefore\(slot, home\)/);
  assert.match(read('marca-blanca.css'), /\.logo \.logo-home::before\{content:"powered by "/);
  // A proposal generated from a website never passes as the official brand.
  assert.match(js, /propuesta generada automáticamente, no es la marca oficial/);
  // «Volver a Admira» in ☰ Opciones, bilingual through the shell.
  assert.match(js, /dataset\.shellTextEs = 'Volver a Admira'/);
  assert.match(js, /dataset\.shellTextEn = 'Back to Admira'/);
});

// ─── Verbo /marca ───
const marcaCtx = (over = {}) => {
  const calls = [];
  const marca = Object.assign({
    actual: () => null,
    listar: () => Promise.resolve([{id: 'admira', nombre: 'Admira'}, {id: 'lumbre', nombre: 'Lumbre Café', ejemplo: true}, {id: 'starbucks', nombre: 'Starbucks', propuesta: true}]),
    activar: id => { calls.push(['activar', id]); return Promise.resolve(id === 'lumbre' ? {ok: true, id, nombre: 'Lumbre Café', ejemplo: true} : id === 'caida' ? {ok: false, reason: 'network'} : {ok: false, reason: 'unknown', id}); },
    desactivar: () => { calls.push(['desactivar']); return {ok: true, changed: true, previous: {id: 'lumbre', nombre: 'Lumbre Café'}}; },
    analizar: url => { calls.push(['analizar', url]); return {ok: true, href: M.analyzerUrl(url), url}; },
  }, over);
  return {calls, ctx: {marca, demo() {}, circuit() {}, search() {}, stop() {}, clear() {}}};
};

test('/marca parses ids, off, websites and named attributes; rejects garbage', () => {
  const cmd = text => C.parse(text);
  assert.equal(cmd('/marca lumbre').command, '/marca lumbre');
  assert.equal(cmd('/marca Lúmbre').command, '/marca lumbre');
  assert.equal(cmd('/marca marca=brumelle').command, '/marca brumelle');
  assert.equal(cmd('/brand frescaria').command, '/marca frescaria');
  for (const off of ['/marca off', '/marca admira', '/marca OFF', '/marca ninguna']) assert.equal(cmd(off).command, '/marca off', off);
  assert.equal(cmd('/marca starbucks.es').command, '/marca https://starbucks.es/');
  assert.equal(cmd('/marca https://www.starbucks.es/').command, '/marca https://www.starbucks.es/');
  assert.equal(cmd('/marca web=starbucks.es').command, '/marca https://starbucks.es/');
  assert.equal(cmd('/marca').command, '/marca');
  const bad = cmd('/marca <img src=x>');
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'invalid_brand');
  assert.match(C.errorLines(bad, 'es').join(' '), /Marca no válida[\s\S]*off para volver a Admira/);
  assert.equal(cmd('/marca javascript:alert(1)').ok, false);
});

test('/marca off, /marca <web> and /marca <id> drive the white label; unknown ids apply nothing', async () => {
  let {calls, ctx} = marcaCtx();
  let r = C.execute('/marca off', ctx, 'es');
  assert.ok(r.ok && calls.some(c => c[0] === 'desactivar'));
  assert.match(r.lines[0], /Lumbre Café desactivada: vuelve Admira/);

  r = C.execute('/marca starbucks.es', ctx, 'es');
  assert.deepEqual(calls.at(-1), ['analizar', 'https://starbucks.es/']);
  assert.match(r.lines.join(' '), /otra pestaña: https:\/\/www\.admiranext\.com\/marcablanca\/\?web=https%3A%2F%2Fstarbucks\.es%2F/);

  r = C.execute('/marca lumbre', ctx, 'es');
  assert.ok(r.ok && r.later, 'the result arrives later (admiranext.com)');
  assert.match(r.lines[0], /Aplicando la marca lumbre/);
  let final = await r.later;
  assert.ok(final.ok);
  assert.match(final.lines[0], /Marca Lumbre Café \(lumbre\) activa · marca ficticia de ejemplo/);

  final = await C.execute('/marca noexiste', ctx, 'es').later;
  assert.equal(final.ok, false);
  assert.match(final.lines.join(' '), /no está en el catálogo de admiranext\.com\. No se ha aplicado nada/);

  final = await C.execute('/marca caida', ctx, 'en').later;
  assert.equal(final.ok, false);
  assert.match(final.lines[0], /Could not reach admiranext\.com/);

  // Without the white-label runtime the verb says so instead of failing silently.
  r = C.execute('/marca lumbre', {demo() {}, circuit() {}, search() {}, stop() {}, clear() {}}, 'es');
  assert.equal(r.ok, false);
  assert.match(r.lines[0], /aún no está lista/);
});

test('/marca alone says which brand is active and lists the catalogue', async () => {
  const {ctx} = marcaCtx({actual: () => ({id: 'starbucks', nombre: 'Starbucks', propuesta: true})});
  const r = C.execute('/marca', ctx, 'es');
  assert.match(r.lines[0], /Marca activa: Starbucks \(starbucks\) · propuesta automática, no es la marca oficial/);
  const final = await r.later;
  assert.match(final.lines[0], /Disponibles: admira, lumbre \(ejemplo\), starbucks \(propuesta\)/);
  const none = C.execute('/marca', marcaCtx().ctx, 'en');
  assert.match(none.lines[0], /No white label: you see the Admira look/);
  await none.later;
  C.setBrands(C.BRAND_SEED);
});

test('/marca is in /help, completes catalogue ids with Tab and keeps the registry routines working', () => {
  const help = C.helpLines('es').join('\n');
  assert.match(help, /\/marca \[marca\] — Marca blanca/);
  assert.match(help, /^marca: off \(Admira\), admira, lumbre \(ejemplo\)/m);
  assert.equal(C.complete('/mar').value, '/marca ');
  assert.equal(C.complete('/marca lu').value, '/marca lumbre');
  assert.deepEqual(C.complete('/marca ').options, ['admira', 'lumbre', 'brumelle', 'frescaria', 'off']);
  C.setBrands([{id: 'admira', nombre: 'Admira'}, {id: 'starbucks', nombre: 'Starbucks', propuesta: true}]);
  assert.equal(C.complete('/marca star').value, '/marca starbucks');
  assert.deepEqual(C.setBrands([{id: '../x'}]).map(b => b.id), ['admira', 'starbucks'], 'invalid lists are ignored');
  C.setBrands(C.BRAND_SEED);
  // Generated routines are unchanged; a /marca command can be saved as an own routine.
  assert.ok(C.defaultRoutines('es').every(r => /^\/(demo|circuito) /.test(r.command)));
  assert.ok(C.addRoutine([], '/marca lumbre').ok);
  assert.ok(C.addRoutine([], '/marca off').ok);
  const docs = read('docs/marca-blanca.md');
  for (const word of ['?marca=', '/marca off', 'Volver a Admira', 'powered by', 'Qué no cambia']) assert.ok(docs.includes(word), word);
});
