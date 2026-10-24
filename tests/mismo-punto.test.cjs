// Elegir entre Xpacios del mismo punto (FLT-102672 · encargo #7155, 24-oct-2026). Caso real: ipad-luna y
// canalkiosk-gracia comparten coordenada en Plaça de la Vila de Gràcia, y bcn-kiosk-016 está a ~7 m.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const MP = require('../mismo-punto.js');
const Z = require('../previos-zoom.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const KIOSK = [2.1572578, 41.4002271], NEWS = [2.157333, 41.400264];
// A zoom 13,6 los tres caen a ~1,6 px; a zoom 16,8, News & Coffee queda a ~14,6 px.
const cand = (dxNews) => [
  { id: 'ipad-luna', nombre: 'ipad-luna', x: 400, y: 300, coords: KIOSK, incidente: -1 },
  { id: 'canalkiosk-gracia', nombre: 'CanalKiosk Gràcia', x: 400, y: 300, coords: KIOSK, incidente: -1 },
  { id: 'bcn-kiosk-016', nombre: 'News & Coffee · premsa', x: 400 + dxNews, y: 300 - dxNews / 2, coords: NEWS, incidente: -1 },
];

test('agrupar bajo un clic: misma coordenada o a 8 px o menos; el umbral manda', () => {
  const ancla = { x: 400, y: 300, coords: KIOSK };
  assert.deepEqual(MP.agrupar(cand(1.4), ancla).map(c => c.id), ['canalkiosk-gracia', 'ipad-luna', 'bcn-kiosk-016'], 'zoom 13,6: los tres');
  assert.deepEqual(MP.agrupar(cand(13), ancla).map(c => c.id), ['canalkiosk-gracia', 'ipad-luna'], 'zoom 16,8: los dos de la misma coordenada');
  assert.equal(MP.UMBRAL_PX, 8);
  const borde = d => MP.agrupar([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: d, y: 0 }], { x: 0, y: 0 }).length;
  assert.equal(borde(8), 2, '8 px entra'); assert.equal(borde(8.01), 1, 'más de 8 px, no');
  assert.equal(MP.agrupar([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 6, y: 0 }], { x: 0, y: 0 }, { umbral: 5 }).length, 1, 'umbral configurable');
  // La misma coordenada cuenta aunque la proyección los separe (redondeos, 3D).
  assert.equal(MP.agrupar([{ id: 'a', x: 0, y: 0, coords: KIOSK }, { id: 'b', x: 20, y: 0, coords: KIOSK.slice() }], { x: 0, y: 0, coords: KIOSK }).length, 2);
  // Un solo Xpacio: un grupo de uno (el clic abre directo). Ids repetidos (catálogo y bundle): una vez.
  assert.deepEqual(MP.agrupar([{ id: 'solo', x: 10, y: 10 }], { x: 10, y: 10 }).map(c => c.id), ['solo']);
  assert.equal(MP.agrupar([{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 1, y: 0 }], { x: 0, y: 0 }).length, 1);
  assert.deepEqual(MP.agrupar([{ id: 'a', x: 0, y: 0 }], null), []);
  // Dos puntos que se solapan bajo el clic (MapLibre los da en e.features) son ambiguos aunque sus centros disten 14 px.
  assert.deepEqual(MP.agrupar(cand(13), ancla, { bajoClic: ['canalkiosk-gracia', 'bcn-kiosk-016'] }).map(c => c.id).sort(), ['bcn-kiosk-016', 'canalkiosk-gracia', 'ipad-luna']);
  assert.equal(MP.agrupar([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 40, y: 0 }], { x: 0, y: 0 }, { bajoClic: new Set(['a']) }).length, 1, 'bajoClic sólo añade los suyos');
});

test('orden: la incidencia más grave primero (el semáforo de owners), luego lo más cercano al clic y luego el nombre', () => {
  const ancla = { x: 100, y: 100 };
  const g = MP.agrupar([
    { id: 'z', nombre: 'Zeta', x: 100, y: 100, incidente: -1 },
    { id: 'a', nombre: 'alfa', x: 100, y: 100, incidente: -1 },
    { id: 'lejos', nombre: 'Aaa', x: 106, y: 100, incidente: -1 },
    { id: 'grave', nombre: 'Grave', x: 107, y: 100, incidente: 2 },
  ], ancla, { clic: { x: 100, y: 100 } });
  assert.deepEqual(g.map(c => c.id), ['grave', 'a', 'z', 'lejos']);
  // Nombres con mayúsculas y acentos: orden de diccionario.
  assert.deepEqual(MP.ordenar([{ id: '1', nombre: 'Óptica', x: 0, y: 0 }, { id: '2', nombre: 'ipad', x: 0, y: 0 }, { id: '3', nombre: 'CanalKiosk', x: 0, y: 0 }], { x: 0, y: 0 }).map(c => c.nombre), ['CanalKiosk', 'ipad', 'Óptica']);
  // Como mucho MAX_ITEMS en el selector.
  const muchos = Array.from({ length: 20 }, (_, i) => ({ id: 'p' + i, x: 0, y: 0 }));
  assert.equal(MP.agrupar(muchos, { x: 0, y: 0 }).length, MP.MAX_ITEMS);
});

test('vecinos para las tarjetas de previo: los mismos que una búsqueda exhaustiva, con rejilla', () => {
  let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const puntos = Array.from({ length: 400 }, (_, i) => ({ id: 'p' + i, x: Math.round(azar() * 300 * 10) / 10, y: Math.round(azar() * 200 * 10) / 10 }));
  puntos.push({ id: 'gemelo', x: puntos[0].x, y: puntos[0].y });
  const v = MP.vecinos(puntos);
  for (const p of puntos) {
    const esperado = puntos.filter(q => q.id !== p.id && Math.hypot(p.x - q.x, p.y - q.y) <= 8).map(q => q.id).sort();
    assert.deepEqual((v.get(p.id) || []).slice().sort(), esperado, p.id);
  }
  assert.ok(v.get('gemelo').includes('p0') && v.get('p0').includes('gemelo'));
  assert.equal(MP.vecinos([{ id: 'solo', x: 1, y: 1 }]).size, 0, 'un punto aislado no tiene vecinos');
});

test('teclado: flechas con vuelta, Inicio y Fin', () => {
  assert.equal(MP.mover(0, 'ArrowDown', 3), 1); assert.equal(MP.mover(2, 'ArrowDown', 3), 0, 'vuelta');
  assert.equal(MP.mover(0, 'ArrowUp', 3), 2); assert.equal(MP.mover(1, 'ArrowRight', 3), 2); assert.equal(MP.mover(1, 'ArrowLeft', 3), 0);
  assert.equal(MP.mover(1, 'Home', 3), 0); assert.equal(MP.mover(0, 'End', 3), 2);
  assert.equal(MP.mover(7, 'Enter', 3), 0, 'índice fuera de rango: el primero'); assert.equal(MP.mover(0, 'ArrowDown', 0), -1);
});

test('HTML del selector: menú con botones de verdad, foco en el primero, aria-label, ES/EN y sin inyección', () => {
  const items = [{ id: 'canalkiosk-gracia', nombre: 'CanalKiosk Gràcia', tipo: 'Quiosco · Canal DOOH', nivel: 'Previo DooH', nivelClave: 'dooh' },
    { id: 'ipad-luna', nombre: '<b>ipad</b>', tipo: '' , nivel: '' }];
  const html = MP.selectorHtml(items, { lang: 'es' });
  assert.match(html, /<strong id="xp-selector-titulo">2 Xpacios en este punto<\/strong>/);
  assert.match(html, /<button type="button" class="xp-selector-cerrar" data-xp-cerrar aria-label="Cerrar">×<\/button>/);
  assert.match(html, /role="menu" aria-labelledby="xp-selector-titulo" aria-label="Elige un Xpacio: 2 en este punto"/);
  assert.match(html, /<button type="button" role="menuitem" class="xp-selector-item" data-xp-elegir="canalkiosk-gracia" tabindex="0">/);
  assert.match(html, /data-xp-elegir="ipad-luna" tabindex="-1">/);
  assert.match(html, /<span class="xp-selector-tipo">Quiosco · Canal DOOH<\/span>/);
  assert.match(html, /pz-etq pz-etq-dooh"><i aria-hidden="true"><\/i>Previo DooH/);
  assert.match(html, /&lt;b&gt;ipad&lt;\/b&gt;/); assert.doesNotMatch(html, /<b>ipad/);
  assert.match(MP.selectorHtml(items, { lang: 'en' }), /2 venues at this spot[\s\S]*aria-label="Close"/);
  assert.match(MP.selectorHtml(items, { lang: 'es', t: k => k === 'mp_titulo' ? '{n} en este sitio (i18n)' : k }), /2 en este sitio \(i18n\)/, 'manda el t() de app.js');
});

test('tarjeta de previo de un punto compartido: dice de qué Xpacio es y ofrece «+N»; su caja es más alta', () => {
  const loc = { id: 'canalkiosk-gracia', name: 'CanalKiosk Gràcia' };
  const nada = Z.nivelPrevio({ circuito: null });
  const html = Z.tarjetaHtml(loc, nada, { lang: 'es', compartidos: 1 });
  assert.match(html, /<span class="pz-pie"><span class="pz-nombre" title="CanalKiosk Gràcia">CanalKiosk Gràcia<\/span><button type="button" class="pz-mas" data-pz="mas" aria-label="Hay 1 Xpacios más en este punto: elegir">\+1<\/button><\/span>/);
  assert.ok(html.indexOf('pz-cta') < html.indexOf('pz-previo') && html.indexOf('pz-previo') < html.indexOf('pz-pie'), 'CTA, previo y el pie');
  assert.doesNotMatch(Z.tarjetaHtml(loc, nada, { lang: 'es' }), /pz-pie/, 'sin compartir, la tarjeta de siempre');
  assert.match(Z.tarjetaHtml(loc, nada, { lang: 'en', compartidos: 2 }), /aria-label="2 more venues at this spot: choose">\+2/);
  const p = { x: 500, y: 500 }, alta = Z.cajaTarjeta({ ...p, extraAlto: Z.PIE_ALTO }, Z.TARJETA), normal = Z.cajaTarjeta(p, Z.TARJETA);
  assert.equal(normal.t - alta.t, Z.PIE_ALTO);
  // Una tarjeta ajena no tapa un punto compartido (hay que poder hacer clic en él para elegir); la suya, sí.
  const ops = { ancho: 1440, alto: 900, max: 6, margenes: { top: 72, right: 8, bottom: 64, left: 8 } };
  const vecino = { id: 'altadis-bcn-002', x: 800, y: 520 }, compartido = { id: 'canalkiosk-gracia', x: 720, y: 450, compartidos: ['ipad-luna'] };
  assert.ok(Z.elegirTarjetas([vecino], ops).length === 1, 'sin nada que evitar, la tarjeta del vecino sale');
  assert.equal(Z.elegirTarjetas([vecino], { ...ops, evitar: [{ id: 'canalkiosk-gracia', x: 720, y: 450, r: 11 }] }).length, 0, 'su caja taparía el punto compartido');
  assert.equal(Z.elegirTarjetas([compartido], { ...ops, evitar: [{ id: 'ipad-luna', x: 720, y: 450, r: 11 }] }).length, 1, 'la del propio punto, sí');
});

test('controlador: los puntos compartidos llevan el pie y «+N» abre el selector con los del punto', () => {
  const locs = {
    'ipad-luna': { id: 'ipad-luna', name: 'ipad-luna', coords: [700, 450] },
    'canalkiosk-gracia': { id: 'canalkiosk-gracia', name: 'CanalKiosk Gràcia', coords: [700, 450] },
    'otro': { id: 'otro', name: 'Otro', coords: [300, 450] },
  };
  const markers = [], llamadas = [];
  class El { constructor() { this.dataset = {}; this.innerHTML = ''; this.listeners = {}; this.classList = { toggle() {}, add() {}, remove() {} }; }
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); } querySelectorAll() { return []; } querySelector() { return null; } contains() { return false; } }
  class Marker { constructor(o) { this.el = o.element; markers.push(this); } setLngLat() { return this; } addTo() { return this; } remove() {} }
  const map = { getZoom: () => 16, getLayer: () => ({}), getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 900 }) }),
    queryRenderedFeatures: () => Object.keys(locs).map(id => ({ properties: { id } })), project: c => ({ x: c[0], y: c[1] }) };
  const c = Z.crear({ map, maplibregl: { Marker }, document: { createElement: () => new El() }, fetch: () => Promise.resolve({ ok: false }),
    loc: id => locs[id], fuentes: () => ({ directo: null, dooh: null, orientacion: '', tag: '' }), lang: () => 'es', ocupado: () => false, activa: () => null,
    tapas: () => [], margenes: () => ({ top: 72, right: 8, bottom: 64, left: 8 }), puedeAnunciar: () => true, anunciar() {}, abrir() {},
    elegirEnPunto: (loc, ids) => llamadas.push([loc.id, ids]) });
  c.calcular();
  const conPie = markers.find(m => /pz-pie/.test(m.el.innerHTML));
  assert.ok(conPie, 'una tarjeta (sólo una) en el punto compartido, con su pie');
  assert.equal(markers.filter(m => /pz-pie/.test(m.el.innerHTML)).length, 1);
  assert.ok(!/pz-pie/.test(markers.find(m => m.el.dataset.pzId === 'otro').el.innerHTML), 'el aislado, sin pie');
  const id = conPie.el.dataset.pzId;
  conPie.el.listeners.click[0]({ target: { closest: () => ({ dataset: { pz: 'mas' } }) }, preventDefault() {}, stopPropagation() {} });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0][0], id);
  assert.deepEqual(llamadas[0][1].slice().sort(), ['canalkiosk-gracia', 'ipad-luna']);
  // nivelSiSeSabe: sin hashtag, «ninguno» se sabe; nunca pide nada.
  assert.equal(c.nivelSiSeSabe(locs.otro).nivel, 'ninguno');
  assert.equal(c.estado().peticiones, 0);
});

test('app.js: el clic en un punto compartido abre el selector; con uno solo, como siempre; Escape, flechas y un vuelo lo cierran', () => {
  const app = read('app.js');
  assert.match(app, /const grupo = xpaciosEnElPunto\(e\.point, loc, \(e\.features \|\| \[\]\)\.map\(f => f\.properties && f\.properties\.id\)\);\n\s*if \(grupo\.length > 1\) \{ tipHover\.reset\(\); abrirSelectorMismoPunto\(grupo, loc\.coords\); return; \}\n\s*abrirXpacioDelMapa\(loc\);/);
  assert.match(app, /map\.queryRenderedFeatures\(\[\[punto\.x - r, punto\.y - r\], \[punto\.x \+ r, punto\.y \+ r\]\], \{layers: \['unclustered-point'\]\}\)/);
  assert.match(app, /if \(ev\.key === 'Escape'\) \{ ev\.preventDefault\(\); ev\.stopPropagation\(\); cerrarSelectorMismoPunto\(true\); return; \}/);
  assert.match(app, /enfocar\(MP\.mover\(foco, ev\.key, botones\.length\)\)/);
  assert.match(app, /if \(loc\) abrirXpacioDelMapa\(loc\);   \/\/ flyToLocation: vuela, abre su ficha y marca el destino/);
  assert.match(app, /map\.on\('movestart', e => \{ if \(selectorPunto && \(!e \|\| !e\.originalEvent\)\) cerrarSelectorMismoPunto\(\); \}\);/);
  assert.match(app, /elegirEnPunto: \(loc, ids, boton\) => \{/);
  // Los clusters siguen haciendo zoom.
  assert.match(app, /map\.on\('click', 'clusters', \(e\) => \{[\s\S]{0,700}getClusterExpansionZoom/);
  // MapLibre 5: getClusterExpansionZoom devuelve una promesa (la función (err, z) ya no se llama).
  assert.match(app, /if \(r && typeof r\.then === 'function'\) r\.then\(acercar\)\.catch\(\(\) => \{\}\);/);
  const manejador = app.slice(app.indexOf("map.on('click', 'clusters'"), app.indexOf("map.on('click', 'unclustered-point'"));
  const pasos = [];
  const fakeMap = { queryRenderedFeatures: () => [{ properties: { cluster_id: 7 }, geometry: { coordinates: [2, 41] } }], easeTo: o => pasos.push(o),
    getSource: () => ({ getClusterExpansionZoom: id => Promise.resolve(id + 3) }), on: (ev, capa, fn) => { fakeMap.fn = fn; } };
  new Function('map', manejador)(fakeMap);
  fakeMap.fn({ point: { x: 1, y: 1 } });
  return Promise.resolve().then(() => Promise.resolve()).then(() => assert.deepEqual(pasos, [{ center: [2, 41], zoom: 10, duration: 800 }], 'el grupo acerca con la promesa de MapLibre 5'));
  for (const k of ['mp_titulo', 'mp_aria', 'mp_cerrar', 'mp_mas', 'mp_mas_aria', 'mp_pista']) assert.equal((app.match(new RegExp('\\b' + k + ':')) || []).length >= 1, true, k);
  assert.match(app, /mp_titulo:'\{n\} Xpacios en este punto'/); assert.match(app, /mp_titulo:'\{n\} venues at this spot'/);
  const html = read('index.html');
  assert.ok(html.indexOf('mismo-punto.js?v=20261024-mismo-punto-1') > 0 && html.indexOf('mismo-punto.js?v=') < html.indexOf('previos-zoom.js?v=') && html.indexOf('previos-zoom.js?v=') < html.indexOf('app.js?v=20261024-mismo-punto-1'));
  assert.match(html, /\.xp-selector-item\{[^}]*min-height:44px/, 'botones de 44 px');
  assert.match(read('server/biz-assets.mjs'), /'mismo-punto\.js',/);
});
