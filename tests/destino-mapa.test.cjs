// El Xpacio destino parpadea en el mapa (FLT-102668 · encargo #7151, 24-oct-2026). Caso real: CanalKiosk Gràcia está a
// ~200 m del MUPI «gracia» y al aterrizar no se sabía cuál de los dos puntos era el destino.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const D = require('../destino-mapa.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// El código sin comentarios (los comentarios explican lo que NO se usa).
const codigo = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const KIOSK = { id: 'canalkiosk-gracia', name: 'CanalKiosk Gràcia', coords: [2.1572578, 41.4002271] };
const MUPI = { id: 'gracia', name: 'gracia', coords: [2.1558535, 41.4013703] };

test('estado: en camino anillo fijo; al aterrizar late 5 s y luego fijo', () => {
  const e = D.marcar(null, KIOSK);
  assert.deepEqual(e, { id: 'canalkiosk-gracia', coords: KIOSK.coords, parpadeo: true, reducido: false, volando: true, llegada: null });
  assert.equal(D.fase(e, 0), 'estable', 'mientras vuela, el anillo fijo (el latido empieza al llegar)');
  const l = D.llegar(e, 'canalkiosk-gracia', 1000);
  assert.equal(l.volando, false); assert.equal(l.llegada, 1000);
  assert.equal(D.fase(l, 1000), 'parpadeo');
  assert.equal(D.fase(l, 1000 + D.PARPADEO_MS - 1), 'parpadeo');
  assert.equal(D.fase(l, 1000 + D.PARPADEO_MS), 'estable');
  assert.equal(D.msHastaEstable(l, 3000), D.PARPADEO_MS - 2000);
  assert.equal(D.msHastaEstable(l, 99999), 0);
  assert.ok(D.PARPADEO_MS >= 4000 && D.PARPADEO_MS <= 6000, 'entre 4 y 6 s');
  // Una segunda llegada no lo reinicia (llegar es idempotente); la de otro id no lo toca.
  assert.equal(D.llegar(l, 'canalkiosk-gracia', 4000).llegada, 1000);
  assert.equal(D.llegar(l, 'gracia', 4000), l);
  assert.equal(D.fase(null, 0), 'ninguno');
  assert.equal(D.marcar(null, { id: 'x', coords: [NaN, 1] }), null, 'sin coordenadas, nada');
});

test('tours y «reducir movimiento»: anillo fijo, sin latido', () => {
  const tour = D.llegar(D.marcar(null, KIOSK, { parpadeo: false }), KIOSK.id, 0);
  assert.equal(D.fase(tour, 0), 'estable');
  const reducido = D.llegar(D.marcar(null, KIOSK, { reducido: true }), KIOSK.id, 0);
  assert.equal(reducido.parpadeo, false); assert.equal(reducido.reducido, true);
  assert.equal(D.fase(reducido, 0), 'estable'); assert.equal(D.msHastaEstable(reducido, 0), 0);
  const css = read('index.html');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{ \.destino-mapa\.parpadeo \.destino-anillo\{animation:none\} \.destino-mapa\.parpadeo \.destino-onda\{display:none;animation:none\} \}/);
  // El latido se acaba solo: animaciones CSS con vueltas contadas (10 × 0,5 s y 5 × 1 s = 5 s), sin infinite.
  assert.match(css, /\.destino-mapa\.parpadeo \.destino-anillo\{[^}]*animation:destinoParpadeo \.5s steps\(1,end\) 10\}/);
  assert.match(css, /\.destino-mapa\.parpadeo \.destino-onda\{[^}]*animation:destinoOnda 1s ease-out 5 both\}/);
  assert.doesNotMatch(css.slice(css.indexOf('.destino-mapa{'), css.indexOf('@keyframes destinoOnda')), /infinite/);
  assert.doesNotMatch(codigo('destino-mapa.js'), /requestAnimationFrame|setInterval/, 'sin bucles de animación');
});

test('cuándo se quita: al cerrar su ficha (salvo en pleno vuelo) o al abrir la de otro Xpacio', () => {
  const volando = D.marcar(null, KIOSK);
  assert.equal(D.debeQuitarse(volando, { fichaAbierta: false, activa: null }), false, 'flyToLocation cierra la ficha al despegar');
  const llegado = D.llegar(volando, KIOSK.id, 0);
  assert.equal(D.debeQuitarse(llegado, { fichaAbierta: true, activa: KIOSK.id }), false);
  assert.equal(D.debeQuitarse(llegado, { fichaAbierta: false, activa: KIOSK.id }), true, 'cerrar la ficha');
  assert.equal(D.debeQuitarse(llegado, { fichaAbierta: true, activa: MUPI.id }), true, 'la ficha de otro Xpacio');
  assert.equal(D.debeQuitarse(null, { fichaAbierta: false }), false);
});

test('el marcador: uno solo, sin capturar clics, con su fase en la clase; otro destino lo mueve y quitar lo borra', () => {
  let ahora = 0;
  const markers = [];
  class Marker { constructor(o) { this.el = o.element; this.anchor = o.anchor; markers.push(this); } setLngLat(c) { this.c = c; return this; } addTo() { this.on = true; return this; } remove() { this.on = false; } }
  const clases = () => { const s = new Set(); return { add: (...a) => a.forEach(x => s.add(x)), remove: (...a) => a.forEach(x => s.delete(x)), toggle: (x, v) => v ? s.add(x) : s.delete(x), has: x => s.has(x) }; };
  const doc = { createElement: () => ({ className: '', dataset: {}, classList: clases(), setAttribute() {}, set innerHTML(v) { this.html = v; }, offsetWidth: 0 }) };
  const c = D.crear({ map: {}, maplibregl: { Marker }, document: doc, ahora: () => ahora, reducido: () => false });
  c.marcar(KIOSK);
  assert.equal(markers.length, 1); assert.equal(markers[0].anchor, 'center'); assert.deepEqual(markers[0].c, KIOSK.coords);
  const el = markers[0].el;
  assert.equal(el.className, 'destino-mapa'); assert.match(el.html, /destino-onda[\s\S]*destino-anillo/);
  assert.equal(el.classList.has('estable'), true, 'en camino');
  assert.deepEqual(c.estado(), { id: 'canalkiosk-gracia', fase: 'estable', volando: true, reducido: false, marcador: true });
  c.llegar(KIOSK.id);
  assert.equal(el.classList.has('parpadeo'), true); assert.equal(el.classList.has('estable'), false);
  ahora = D.PARPADEO_MS + 1; c.refrescar();
  assert.equal(el.classList.has('parpadeo'), false); assert.equal(el.classList.has('estable'), true);
  c.marcar(MUPI);
  assert.equal(markers.length, 1, 'el mismo marcador, en el otro punto'); assert.deepEqual(markers[0].c, MUPI.coords); assert.equal(el.dataset.destino, 'gracia');
  c.revisar({ fichaAbierta: false, activa: null }); assert.equal(markers[0].on, true, 'en vuelo no se quita');
  c.llegar(MUPI.id); c.revisar({ fichaAbierta: false, activa: null });
  assert.equal(markers[0].on, false); assert.equal(c.estado().fase, 'ninguno');
  // Con «reducir movimiento» del sistema: marca reducido y nunca late.
  const r = D.crear({ map: {}, maplibregl: { Marker }, document: doc, ahora: () => 0, reducido: () => true });
  r.marcar(KIOSK); r.llegar(KIOSK.id);
  assert.equal(r.estado().fase, 'estable'); assert.equal(r.estado().reducido, true);
  // Sin MapLibre (portada sin WebGL): no falla.
  const sin = D.crear({ map: {}, maplibregl: null, document: doc });
  assert.doesNotThrow(() => { sin.marcar(KIOSK); sin.llegar(KIOSK.id); sin.quitar(); });
});

test('app.js: flyToLocation marca el destino (late fuera de los tours) y lo da por llegado al abrir la ficha', () => {
  const app = read('app.js');
  const fly = app.slice(app.indexOf('async function flyToLocation'), app.indexOf('// ─── Network tour'));
  assert.match(fly, /window\.__destinoMapa\?\.marcar\(loc, \{parpadeo: !automatic\}\)/, 'tours (automatic): sólo el anillo fijo');
  assert.match(fly, /const abrir = \(\) => \{ if \(abierta\) return; abierta = true; renderPanel\(loc\); panel\.classList\.add\('open'\); aterrizar\(\); \};/);
  assert.match(fly, /if \(flyToLocation\.vuelo === vuelo\) \{ if \(abierta\) aterrizar\(\); else \{ try \{ window\.__destinoMapa\?\.quitar\(\); \} catch \(_\) \{\} \} \}/, 'un vuelo cortado sin ficha quita el destino, uno sustituido no');
  // Los cinco caminos pasan por flyToLocation: clic en el punto y en la tarjeta de previo (abrirXpacioDelMapa), buscador,
  // enlace ?loc= (volarFichaPorEnlace, con la ficha ya abierta) y Tour DooH (automatic).
  assert.match(app, /function abrirXpacioDelMapa\(loc\) \{[\s\S]{0,500}flyToLocation\(loc\);/);
  assert.match(app, /if \(loc\) \{ searchInput\.value = loc\.name; flyToLocation\(loc\); \}/);
  assert.match(app, /flyToLocation\(loc, \{fichaAbierta: true\}\)/);
  assert.match(app, /flyToLocation\(loc, \{automatic:true, bearing:\(run\.index \* 29\) % 360/);
  assert.match(app, /revisarDestino\(\);\n/, 'renderPanel lo revisa');
  assert.match(app, /new MutationObserver\(revisarDestino\)\.observe\(panel, \{attributes: true, attributeFilter: \['class'\]\}\)/, 'cerrar la ficha lo quita');
  // En el móvil la ficha tapa los dos tercios de abajo: el vuelo lleva relleno para que el destino quede a la vista y
  // se quita al cerrar la ficha. En escritorio, relleno cero.
  assert.match(app, /bearing, padding:fichaPadding\(\)\};/);
  assert.match(app, /if \(\(window\.innerWidth \|\| 1440\) > 720\) return \{\.\.\.SIN_RELLENO\};/);
  assert.match(app, /if \(!panel\.classList\.contains\('open'\) && !destino\.volando\(\) && typeof map\.getPadding === 'function'\)/);
  const html = read('index.html');
  assert.ok(html.indexOf('destino-mapa.js?v=20261024-destino-1') > 0 && html.indexOf('destino-mapa.js?v=') < html.indexOf('app.js?v='));
  assert.match(read('server/biz-assets.mjs'), /'destino-mapa\.js',/);
  // No toca la selección (selected-ring cian) ni la pintura de los puntos (semáforo de incidencias para owners).
  assert.match(app, /id:'selected-ring', type:'circle', source:'locs',/);
  assert.doesNotMatch(codigo('destino-mapa.js'), /addLayer|setPaintProperty|setFilter|selected-ring/);
});
