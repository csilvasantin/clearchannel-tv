// Paneles superpuestos (principio de Carlos, 3-oct-2026): «el cuerpo central del sitio
// (contenido) no se desplaza al abrir las barras opcionales, ni verticales ni la horizontal
// inferior». ☰ Opciones, ▤ Avanzado y ⌘ Experto flotan sobre el contenido y entran cerrados
// en cada carga. Este guardián falla si una página vuelve a encoger su contenido con el
// panel experto o si responsive-shell.js vuelve a restaurar un panel abierto.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sources = execFileSync('git', ['ls-files', '*.html', '*.css', '*.js', '*.mjs'], {cwd: root, encoding: 'utf8'})
  .split('\n').filter(f => f && !f.startsWith('tests/') && !f.includes('node_modules/') && fs.existsSync(path.join(root, f)));

// Declarations that size or place the content box. `bottom` alone is how floaters step aside.
const SIZING = /^(?:height|min-height|max-height|inset|inset-block|inset-block-end|padding|padding-bottom|padding-block|padding-block-end|margin|margin-bottom|margin-block|margin-block-end|top)$/;
// Floating cards of the portada shell itself, not page content.
const FLOATING = [['responsive-shell.css', /\.demo-card\b/]];

test('no page keeps a --shell-bottom: the content never shrinks for the expert panel', () => {
  const offenders = sources.filter(f => read(f).includes('--shell-bottom'));
  assert.deepEqual(offenders, [], 'remove --shell-bottom; floaters may use var(--expert-panel-height)');
});

test('no page subtracts the expert panel height from the size of its content', () => {
  const offenders = [];
  for (const file of sources.filter(f => /\.(?:html|css)$/.test(f) && read(f).includes('--expert-panel-height'))) {
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const decl of body.split(';')) {
        const i = decl.indexOf(':');
        if (i < 0 || !decl.includes('--expert-panel-height')) continue;
        const prop = decl.slice(0, i).trim().toLowerCase();
        if (!SIZING.test(prop)) continue;
        if (FLOATING.some(([f, sel]) => f === file && sel.test(selector))) continue;
        offenders.push(`${file}: ${selector.trim().slice(-80)} { ${decl.trim()} }`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('only the shell measures the expert panel; page scripts do not resize content with it', () => {
  const offenders = sources.filter(f => /\.(?:js|mjs)$/.test(f) && f !== 'responsive-shell.js' && read(f).includes('expert-panel-height'));
  assert.deepEqual(offenders, []);
  // The shell layers never reserve room in the page: no body padding/margin per open mode.
  for (const file of ['responsive-shell.css', 'galaxy-shell.css']) {
    const own = /(?:^|[}\s,])body(?:[.:][\w-]+(?:\([^)]*\))?)*\.mode-(?:options|advanced|expert)-open(?:[.:][\w-]+(?:\([^)]*\))?)*\s*\{([^}]*)\}/g;
    for (const [rule, body] of read(file).matchAll(own)) assert.ok(!/(?:padding|margin|width|height|inset)\s*:/.test(body), `${file}: ${rule}`);
  }
});

test('responsive-shell.js does not remember the open state; only the resized size', () => {
  const js = read('responsive-shell.js');
  assert.ok(!/setItem\('admira_panel_'\s*\+/.test(js), 'the open state is not stored');
  assert.ok(!/getItem\('admira_panel_'\s*\+/.test(js), 'the open state is not restored');
  assert.match(js, /setItem\('admira_panel_size_'\+mode/);
  assert.match(js, /^\/\/ Galaxy shell:[^\n]*closed on entry/);
});

// Minimal DOM, enough to run responsive-shell.js and see which panels it leaves open.
function fakeDom({store, openInMarkup = []}) {
  const element = (props = {}) => {
    const attrs = {};
    return Object.assign({
      hidden: false, open: false, style: {}, dataset: {}, classList: {toggle() {}},
      setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: k => attrs[k],
      addEventListener() {}, append() {}, focus() {}, contains: () => false, querySelector: () => null,
      getBoundingClientRect: () => ({top: 0, bottom: 64, width: 200, height: 64}),
    }, props);
  };
  const panels = {
    'header-navigation': element({hidden: !openInMarkup.includes('options')}),
    'advanced-tools': element({open: openInMarkup.includes('advanced')}),
    'expert-panel': element({hidden: !openInMarkup.includes('expert')}),
  };
  const toggles = ['options', 'advanced', 'expert'].map(mode => element({dataset: {mode}}));
  const bodyClasses = new Set();
  const document = {
    documentElement: {lang: 'es', style: {setProperty() {}}},
    body: {classList: {toggle: (c, on) => (on ? bodyClasses.add(c) : bodyClasses.delete(c))}},
    querySelector: sel => (sel === 'body > header' || sel === '.mode-switches' ? element() : null),
    querySelectorAll: sel => (sel === '[data-mode]' ? toggles : []),
    getElementById: id => panels[id] || element(),
    createElement: () => element(),
    addEventListener() {},
  };
  class Observer { observe() {} }
  const context = {
    document, localStorage: store, innerWidth: 1440, innerHeight: 900,
    addEventListener() {}, queueMicrotask, ResizeObserver: Observer, MutationObserver: Observer,
  };
  return {context, panels, bodyClasses};
}

function memoryStore(entries) {
  const mem = new Map(Object.entries(entries));
  return {mem, getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k)};
}

test('every load starts with ☰, ▤ and ⌘ closed, even if an older version stored them open', () => {
  const store = memoryStore({admira_panel_options: '1', admira_panel_advanced: '1', admira_panel_expert: '1', admira_panel_size_expert: '420'});
  const {context, panels, bodyClasses} = fakeDom({store, openInMarkup: ['options', 'advanced', 'expert']});
  vm.runInNewContext(read('responsive-shell.js'), context);
  assert.equal(panels['header-navigation'].hidden, true, '☰ closed');
  assert.equal(panels['advanced-tools'].open, false, '▤ closed');
  assert.equal(panels['expert-panel'].hidden, true, '⌘ closed');
  assert.deepEqual([...bodyClasses], []);
  for (const mode of ['options', 'advanced', 'expert']) assert.equal(store.mem.has('admira_panel_' + mode), false, 'stale open state dropped: ' + mode);
  assert.equal(store.mem.get('admira_panel_size_expert'), '420', 'the resized size is kept');
  assert.equal(panels['expert-panel'].style.height, '420px');
});

test('the docs state the overlay principle', () => {
  for (const doc of ['docs/galaxy-shell.md', 'docs/responsive-navigation.md']) {
    const text = read(doc);
    assert.match(text, /se superponen/i, doc);
    assert.match(text, /cerrad[oa]s/i, doc);
    assert.ok(!text.includes('var(--shell-bottom'), doc);
  }
});


test('Options footer stops above a visibly minimized shared dock even with native hidden=true',()=>{
 const {context,panels}=fakeDom({store:memoryStore({})});const values=new Map();
 context.document.documentElement.style.setProperty=(k,v)=>values.set(k,v);
 panels['expert-panel'].classList.contains=(name)=>name==='ax-dock';
 vm.runInNewContext(read('responsive-shell.js'),context);
 assert.equal(panels['expert-panel'].hidden,true,'native Expert starts closed');
 assert.equal(values.get('--expert-panel-height'),'64px','the visible minimized dock still occupies 64px');
 assert.match(read('responsive-shell.css'),/\.options-panel,\.advanced-panel\{bottom:var\(--expert-panel-height,0px\)\}/);
});
