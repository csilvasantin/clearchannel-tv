const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../expert-panel.js');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const panel = html.slice(html.indexOf('<section id="expert-panel"'), html.indexOf('<div class="space"'));

test('expert panel has three blocks in order: CLI, Verbos, Rutinas', () => {
  const modules = [...panel.matchAll(/data-module="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(modules, ['cli', 'verbos', 'rutinas']);
  assert.deepEqual(L.IDS, modules);
  const cli = panel.slice(panel.indexOf('data-module="cli"'), panel.indexOf('data-module="verbos"'));
  for (const id of ['expert-command-form', 'expert-command', 'expert-command-result']) assert.match(cli, new RegExp(`id="${id}"`));
  assert.match(panel.slice(panel.indexOf('data-module="verbos"')), /id="expert-verbs"/);
  assert.match(panel.slice(panel.indexOf('data-module="rutinas"')), /id="expert-save-routine"[\s\S]*id="expert-routines"/);
  assert.match(panel, /class="expert-layout-menu"/);
  assert.match(panel, /data-close-mode="expert"/);
});

test('scripts load registry before panel and share one cache-busting stamp', () => {
  const order = ['responsive-shell.js', 'expert-commands.js', 'expert-panel.js'].map(f => html.indexOf(f + '?v='));
  assert.ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2]);
  const stamp = html.match(/expert-panel\.js\?v=([^"]+)"/)[1];
  assert.ok(html.includes('expert-commands.js?v=' + stamp) && html.includes('responsive-shell.css?v=' + stamp) && html.includes('intro.js?v=' + stamp));
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const shell = new RegExp(sw.match(/const SHELL_CODE = \/(.+)\/;/)[1]);
  for (const f of ['/expert-commands.js', '/expert-panel.js', '/responsive-shell.js', '/intro.js']) assert.ok(shell.test(f), f);
});

test('layout normalisation never loses or duplicates a block and recovers from bad storage', () => {
  assert.deepEqual(L.normalizeLayout(null), {order: ['cli', 'verbos', 'rutinas'], hidden: [], weights: L.DEFAULT_WEIGHTS});
  const layout = L.normalizeLayout({order: ['rutinas', 'rutinas', 'evil'], hidden: ['verbos', 'evil'], weights: {cli: NaN, verbos: -1, rutinas: 500}});
  assert.deepEqual(layout.order, ['rutinas', 'cli', 'verbos']);
  assert.deepEqual(layout.hidden, ['verbos']);
  assert.equal(layout.weights.cli, 44); assert.equal(layout.weights.verbos, 28); assert.equal(layout.weights.rutinas, 100);
});

test('pair resize conserves the pair total, clamps 15–85 % and leaves others intact', () => {
  const w = {cli: 40, verbos: 30, rutinas: 30};
  const r = L.resizePair(w, 'cli', 'verbos', 0.7);
  assert.equal(r.cli, 49); assert.ok(Math.abs(r.verbos - 21) < 1e-9); assert.equal(r.rutinas, 30);
  assert.equal(L.resizePair(w, 'cli', 'verbos', 2).cli, 70 * 0.85);
  assert.equal(L.resizePair(w, 'cli', 'verbos', -1).cli, 70 * 0.15);
  assert.deepEqual(w, {cli: 40, verbos: 30, rutinas: 30});
});

test('reordering works both ways and ignores unknown blocks', () => {
  const order = ['cli', 'verbos', 'rutinas'];
  assert.deepEqual(L.moveModule(order, 'cli', 'rutinas'), ['verbos', 'rutinas', 'cli']);
  assert.deepEqual(L.moveModule(order, 'rutinas', 'cli'), ['rutinas', 'cli', 'verbos']);
  assert.deepEqual(L.moveModule(order, 'x', 'cli'), order);
});

test('layout state persists through storage and survives broken JSON', () => {
  const mem = new Map();
  const storage = {getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v))};
  const state = {order: ['verbos', 'cli', 'rutinas'], hidden: ['rutinas'], weights: {cli: 50, verbos: 25, rutinas: 25}};
  assert.equal(L.saveLayout(storage, state), true);
  assert.deepEqual(L.loadLayout(storage), state);
  assert.ok(mem.has(L.LAYOUT_KEY));
  mem.set(L.LAYOUT_KEY, '{nope');
  assert.deepEqual(L.loadLayout(storage), L.normalizeLayout(null));
  assert.equal(L.saveLayout({setItem() { throw new Error('quota'); }}, state), false);
});

test('CSS stacks the blocks under 600 px and keeps the bottom-panel height handle', () => {
  const css = fs.readFileSync(path.join(root, 'responsive-shell.css'), 'utf8');
  const phone = css.slice(css.indexOf('@media(max-width:600px){'));
  assert.ok(phone.length > 0 && /^@media\(max-width:600px\)\{[\s\S]*?\.expert-blocks\{[^}]*flex-direction:column/.test(phone));
  assert.match(phone, /\.expert-module-resizer\{display:none!important\}/);
  assert.match(css, /\.mode-resize-expert\{/);
  const shell = fs.readFileSync(path.join(root, 'responsive-shell.js'), 'utf8');
  assert.match(shell, /admira_panel_size_/);
  assert.doesNotMatch(shell, /Comando no reconocido/, 'command handling lives in the registry');
});
