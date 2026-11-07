// Tema local «netflix» · encargo «2026-11-07 · admira.biz · PortAventuraNext intro».
// /brand netflix viste la intro de admira.biz con el look Netflix y un solo destino (PortAventura);
// sin activarlo la portada no cambia ni descarga nada, y /brand off lo deshace.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../marca-netflix.js');
const M = require('../marca-blanca.js');
const C = require('../expert-commands.js');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('the arc wordmark is taller at the edges and symmetric', () => {
  const n = 'PORTAVENTURA'.length;
  const s = Array.from({length: n}, (_, i) => N.arcScale(i, n));
  assert.ok(Math.abs(s[0] - 1.3) < 1e-9 && Math.abs(s[n - 1] - 1.3) < 1e-9, 'edges 30 % taller');
  for (let i = 0; i < n; i++) assert.ok(Math.abs(s[i] - s[n - 1 - i]) < 1e-9, 'symmetric');
  assert.ok(Math.min(...s) >= 1 && Math.min(...s) < 1.01, 'centre close to 1');
  assert.equal(N.arcScale(0, 1), 1);
});

test('PortAventura is the only destination and hides behind the globe', () => {
  assert.deepEqual([...N.PA], [1.1556, 41.0866]);
  assert.equal(N.oculto([N.PA[0], N.LAT0], 2.15), false, 'facing the camera: visible');
  assert.equal(N.oculto([N.PA[0] + 180, N.LAT0], 2.15), true, 'far side: hidden');
  assert.equal(N.oculto([N.PA[0] - N.DESFASE, N.LAT0], 2.15), false, 'the start view shows it coming in from the right');
  assert.equal(N.oculto([N.PA[0] + 180, N.LAT0], 12), false, 'zoomed in there is no far side');
});

test('distance and easing used by the flight HUD', () => {
  assert.equal(Math.round(N.distanciaKm(N.PA, N.PA)), 0);
  const madrid = [-3.7038, 40.4168];
  assert.ok(Math.abs(N.distanciaKm(madrid, N.PA) - 430) < 25, 'Madrid → Salou ≈ 430 km');
  // destino(): the point d degrees away keeps that angular distance (used to find the globe's limb for the halo).
  for (const [rumbo, d] of [[0, 30], [90, 60], [180, 89], [270, 75]]) {
    const q = N.destino([N.PA[0] - N.DESFASE, N.LAT0], rumbo, d);
    assert.ok(Math.abs(Math.acos(N.cosAngulo([N.PA[0] - N.DESFASE, N.LAT0], q)) * 180 / Math.PI - d) < 1e-6, `${rumbo}/${d}`);
  }
  assert.ok(N.destino([0, 0], 0, 10)[1] > 9.99, 'north raises the latitude');
  assert.equal(N.easeInOutCubic(0), 0);
  assert.equal(N.easeInOutCubic(1), 1);
  assert.equal(N.easeInOutCubic(0.5), 0.5);
});

test('the globe sits on the right on desktop and on top on mobile', () => {
  assert.deepEqual(N.relleno(1440, 900), {top: 0, bottom: 0, left: 518, right: 0});
  assert.deepEqual(N.relleno(390, 844), {top: 60, bottom: 371, left: 0, right: 0});
});

test('netflix is a local theme of this site, not a catalogue brand', () => {
  assert.equal(M.esLocal('netflix'), true);
  assert.equal(M.esLocal('Netflix'), true, 'case-insensitive, like /brand Netflix');
  assert.equal(M.esLocal('lumbre'), false);
  const def = M.LOCALES.netflix;
  assert.deepEqual([def.js, def.css, def.global], ['marca-netflix.js', 'marca-netflix.css', 'MarcaNetflix']);
  assert.ok(Object.isFrozen(M.LOCALES) && Object.isFrozen(def));
  // ?marca=netflix se recuerda en la pestaña; ?marca=off la olvida (vuelta atrás por URL).
  assert.deepEqual(M.decide('?marca=netflix', null), {id: 'netflix', remember: true});
  assert.deepEqual(M.decide('?marca=Netflix', null), {id: 'netflix', remember: true});
  const mem = new Map([['mb:marca', 'netflix']]);
  const store = {getItem: k => (mem.has(k) ? mem.get(k) : null)};
  assert.deepEqual(M.decide('', store), {id: 'netflix'});
  assert.deepEqual(M.decide('?marca=off', store), {id: null, forget: true});
});

test('the netflix theme is not a client: it never segments the globe or moves the camera', () => {
  const S = require('../cliente-segmento.js');
  assert.equal(S.resolver('netflix'), null);
  assert.equal(S.resolver('Netflix'), null);
  assert.equal(S.decidir('?marca=netflix', null), null);
  assert.equal(S.resolver('altadis'), 'altadis', 'real clients still segment');
});

test('/brand netflix and /brand off go through the white-label verb', async () => {
  const calls = [];
  const marca = {
    actual: () => null,
    listar: () => Promise.resolve([]),
    analizar: () => ({ok: false}),
    activar: id => { calls.push(['activar', id]); return Promise.resolve({ok: true, id: 'netflix', nombre: 'Netflix · PortAventura NeXT', local: true}); },
    desactivar: () => { calls.push(['desactivar']); return {ok: true, changed: true, previous: {id: 'netflix', nombre: 'Netflix · PortAventura NeXT'}}; },
  };
  const ctx = {marca};
  let r = C.execute('/brand Netflix', ctx, 'es');
  assert.equal(r.ok, true);
  let final = await r.later;
  assert.deepEqual(calls[0], ['activar', 'netflix']);
  assert.match(final.lines.join(' '), /Tema Netflix · PortAventura NeXT \(netflix\) activo.*PortAventura.*\/brand off/);
  r = C.execute('/brand off', ctx, 'en');
  assert.deepEqual(calls[1], ['desactivar']);
  assert.match(r.lines.join(' '), /Netflix · PortAventura NeXT brand turned off: back to Admira/);
  // Tema recordado en una página sin mapa: se dice que solo se ve en la portada.
  marca.activar = () => Promise.resolve({ok: true, id: 'netflix', nombre: 'Netflix · PortAventura NeXT', local: true, inerte: true});
  final = await C.execute('/brand netflix', ctx, 'es').later;
  assert.match(final.lines.join(' '), /recordado en esta pestaña.*portada/);
});

test('the catalogue never drops the local theme from /marca and Tab completion', () => {
  const before = C.brands().map(b => b.id);
  assert.ok(before.includes('netflix'), 'seed');
  C.setBrands([{id: 'admira', nombre: 'Admira'}, {id: 'starbucks', nombre: 'Starbucks'}]);
  const after = C.brands();
  assert.deepEqual(after.map(b => b.id), ['admira', 'starbucks', 'netflix']);
  assert.equal(after.find(b => b.id === 'netflix').local, true);
});

test('without the theme the home page loads nothing new, and the release ships both files', () => {
  const index = read('index.html');
  assert.ok(!index.includes('marca-netflix'), 'index.html never loads the theme statically');
  assert.match(index, /marca-blanca\.js\?v=20261107-netflix-1/);
  const css = read('marca-netflix.css');
  // Todo cuelga de html[data-netflix] o de #nfx-*/.nfx-*: al quitar la hoja no queda nada.
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map(s => s.trim()).filter(s => s && !s.startsWith('@') && !/^\d|^from|^to/.test(s))) {
    for (const sel of rule.split(',').map(s => s.trim())) {
      assert.ok(/data-netflix|data-nfx-estado|#nfx-|\.nfx-/.test(sel), `selector fuera del tema: ${sel}`);
    }
  }
  const assets = read('server/biz-assets.mjs');
  assert.ok(assets.includes("'marca-netflix.js', 'marca-netflix.css'"), 'admira.biz release includes the theme');
  const js = read('marca-netflix.js');
  assert.ok(!/\.(mp3|wav|ogg|m4a)\b/i.test(js), 'the ta-dum is synthesised: no recorded audio');
});
