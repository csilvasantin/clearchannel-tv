// Portada sin WebGL (Morfeo, 17-oct-2026): si maplibre no puede crear el mapa, app.js recibe un mapa mudo
// y la portada sigue en pie con un aviso; con WebGL, el mapa es el de siempre.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ccCrearMapa, TEXTO } = require('../mapa-sin-webgl.js');

const leer = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function docFalso(lang = 'es') {
  const hechos = [];
  const doc = { documentElement: { lang, dataset: {} } };
  const el = (tag) => ({ tag, style: {}, attrs: {}, children: [], ownerDocument: doc,
    setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); hechos.push(c); return c; } });
  const contenedor = el('div');
  Object.assign(doc, { body: el('body'), getElementById: (id) => (id === 'map' ? contenedor : null), createElement: el });
  return { doc, contenedor, hechos };
}

const OPCIONES = { container: 'map', center: [-28, 16], zoom: 2.15, pitch: 0 };

test('con WebGL devuelve el mapa de maplibre tal cual', () => {
  const { doc } = docFalso();
  class Map { constructor(o) { this.o = o; } }
  const m = ccCrearMapa(OPCIONES, { document: doc, maplibregl: { Map } });
  assert.ok(m instanceof Map);
  assert.equal(m.o, OPCIONES);
  assert.equal(doc.documentElement.dataset.mapa, undefined);
});

test('sin WebGL devuelve un mapa mudo, marca la página y avisa en el idioma de la página', () => {
  for (const [lang, texto] of [['es', TEXTO.es], ['en', TEXTO.en]]) {
    const { doc, hechos } = docFalso(lang);
    const Map = function () { throw new Error('Failed to initialize WebGL'); };
    const m = ccCrearMapa(OPCIONES, { document: doc, maplibregl: { Map } });
    assert.equal(m.sinWebGL, true);
    assert.equal(doc.documentElement.dataset.mapa, 'sin-webgl');
    const aviso = hechos.find((h) => h.className === 'map-sin-webgl');
    assert.equal(aviso.textContent, texto, lang);
    assert.equal(aviso.attrs.role, 'status');
  }
});

test('si maplibre no llegó del CDN, también hay mapa mudo', () => {
  const { doc } = docFalso();
  assert.equal(ccCrearMapa(OPCIONES, { document: doc, maplibregl: undefined }).sinWebGL, true);
});

test('el mapa mudo aguanta lo que hace app.js con el mapa sin lanzar', async () => {
  const { doc, contenedor } = docFalso();
  const map = ccCrearMapa(OPCIONES, { document: doc, maplibregl: { Map() { throw new Error('sin WebGL'); } } });
  // Encadenar, controles y manejadores (map.dragRotate.disable(), map.on(...).on(...)).
  assert.equal(map.on('load', () => {}).on('click', () => {}), map);
  assert.doesNotThrow(() => { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); map.addControl({}); });
  // Lecturas con valor: zoom, centro, lienzo, contenedor y fuentes que no existen.
  assert.equal(Math.abs(map.getZoom() - OPCIONES.zoom) < 0.01 && map.getPitch() === 0, true);
  assert.deepEqual(map.getCenter(), { lng: -28, lat: 16 });
  assert.equal(map.getContainer(), contenedor);
  assert.equal(map.getCanvas().tag, 'canvas');
  assert.equal(map.getSource('locs'), undefined, 'updateLocationsSource no intenta setData');
  assert.deepEqual(map.queryRenderedFeatures([0, 0]), []);
  assert.equal(map.isStyleLoaded() || map.loaded() || map.isMoving(), false);
  // Asignaciones, coerción, iteración y await no rompen ni se quedan colgados.
  assert.doesNotThrow(() => { map.getCanvas().style.cursor = 'pointer'; map.algo = 1; });
  assert.equal(map.flyTo({ center: [0, 0] }) + 1, 1);
  assert.deepEqual([...map.algoIterable], []);
  assert.equal(await map, map);
});

test('app.js crea el mapa con ccCrearMapa y la portada carga mapa-sin-webgl.js antes que app.js', () => {
  const app = leer('app.js');
  assert.doesNotMatch(app, /new maplibregl\.Map\(/, 'nada de constructor directo: sin WebGL tumbaba la portada');
  assert.match(app, /const map = ccCrearMapa\(\{\n  container: 'map', style: STYLE_TIERRA,/);
  const html = leer('index.html');
  assert.ok(html.indexOf('mapa-sin-webgl.js?v=') > 0 && html.indexOf('mapa-sin-webgl.js?v=') < html.indexOf('app.js?v='));
});
