// Previos de lo que emiten las pantallas al hacer zoom y en la ficha (FLT-102666 · encargo #7145, 24-oct-2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Z = require('../previos-zoom.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const AHORA = 1_800_000_000_000;
const FACHADA = { imagen: 'https://admira.tv/api/previo/alcampo-x.jpg', w: 1600, h: 900, quad: [[.681, .63], [.721, .63], [.721, .757], [.681, .757]], orientacion: 'vertical', tipo: 'virtual' };
const CIRCUITO = { ok: true, tag: 'alcampo', poster: 'https://api.admira.store/stock/poster/h1', video: 'https://api.admira.store/stock/asset/h1',
  vertical: { poster: 'https://api.admira.store/stock/poster/v1', video: 'https://api.admira.store/stock/asset/v1', title: 'Pan' },
  horizontal: { poster: 'https://api.admira.store/stock/poster/h1', video: 'https://api.admira.store/stock/asset/h1', title: 'Langostino' } };

test('hashtag del Stock de cada Xpacio: alcampo, altadis (también los Xtancos de Barcelona), jti, starbucks; nada inventado', () => {
  assert.equal(Z.etiquetaStock({ id: 'alcampo-andres-vicente' }), 'alcampo');
  assert.equal(Z.etiquetaStock({ id: 'super-x', name: 'Alcampo', external: { brand: 'Alcampo' } }), 'alcampo');
  assert.equal(Z.etiquetaStock({ id: 'altadis-es-05-madrid', circuit: 'altadis_espana' }), 'altadis');
  assert.equal(Z.etiquetaStock({ id: 'altadis-bcn-001', circuit: 'altadis_bcn' }), 'altadis');
  assert.equal(Z.etiquetaStock({ id: 'jti-xtanco-001', circuit: 'jti_xtanco' }), 'jti');
  assert.equal(Z.etiquetaStock({ id: 'alsea-sbux-001', circuit: 'alsea_starbucks' }), 'starbucks');
  assert.equal(Z.etiquetaStock({ id: 'alsea-mx-sbux-01-tijuana', circuit: 'alsea_mexico' }), 'starbucks');
  assert.equal(Z.etiquetaStock({ id: 'correos-3511-correos' }), 'correos');
  for (const id of ['the-test', 'i-phone', 'qa-player', 'bcn-kiosk-001']) assert.equal(Z.etiquetaStock({ id }), '', id);
  assert.equal(Z.orientacionDe({ surfaces: [{ orientation: 'portrait' }] }), 'vertical');
  assert.equal(Z.orientacionDe({ surfaces: [{}, { orient: 'horizontal' }] }), 'horizontal');
  assert.equal(Z.orientacionDe({ surfaces: [] }), '');
});

test('En directo: sólo una pieza fresca (< 170 s), sin standby; imagen tal cual, vídeo por su póster del Stock; audio no', () => {
  const it = (o) => ({ item: Object.assign({ id: '1792428613807-shykjt', url: 'https://api.admira.store/stock/asset/1792428613807-shykjt', type: 'video', title: 'Pieza', ts: AHORA - 30_000 }, o), standby: false });
  assert.deepEqual(Z.itemEnDirecto(it(), AHORA), { poster: 'https://api.admira.store/stock/poster/1792428613807-shykjt', video: 'https://api.admira.store/stock/asset/1792428613807-shykjt', title: 'Pieza' });
  assert.equal(Z.itemEnDirecto(it({ id: 'default:1791955421961-8yq0xg' }), AHORA).poster, 'https://api.admira.store/stock/poster/1791955421961-8yq0xg');
  assert.deepEqual(Z.itemEnDirecto(it({ type: 'image', url: 'https://x.example/a.jpg' }), AHORA), { poster: 'https://x.example/a.jpg', video: null, title: 'Pieza' });
  assert.equal(Z.itemEnDirecto(it({ ts: AHORA - 170_000 }), AHORA), null, 'a los 170 s ya no está en directo (EMIT_FRESH_MS)');
  assert.equal(Z.itemEnDirecto(it({ type: 'audio' }), AHORA), null);
  assert.equal(Z.itemEnDirecto({ item: it().item, standby: true }, AHORA), null);
  assert.equal(Z.itemEnDirecto({ item: null }, AHORA), null, 'hoy, las 61 pantallas dan item:null');
  assert.equal(Z.itemEnDirecto(it({ type: 'image', url: 'javascript:alert(1)' }), AHORA), null);
  // Vídeo sin id del Stock: el vídeo mismo (se pinta con preload=metadata).
  assert.deepEqual(Z.itemEnDirecto(it({ id: 'raro con espacios' }), AHORA), { poster: null, video: 'https://api.admira.store/stock/asset/1792428613807-shykjt', title: 'Pieza' });
});

test('nivel de previo: En directo > Previo DooH > Programación del circuito > nada; lo que falla baja de nivel', () => {
  const directo = { poster: 'https://api.admira.store/stock/poster/p', video: 'https://v.example/p.webm', title: 'Ahora' };
  const todo = { directo, dooh: FACHADA, circuito: CIRCUITO, orientacion: 'vertical' };
  assert.equal(Z.nivelPrevio(todo).nivel, 'directo');
  const dooh = Z.nivelPrevio({ ...todo, directo: null });
  assert.equal(dooh.nivel, 'dooh');
  assert.equal(dooh.poster, CIRCUITO.vertical.poster, 'pantalla vertical: la pieza vertical del circuito');
  assert.equal(Z.nivelPrevio({ dooh: { ...FACHADA, orientacion: 'horizontal' }, circuito: CIRCUITO }).poster, CIRCUITO.horizontal.poster);
  const sinPoster = Z.nivelPrevio({ dooh: FACHADA, circuito: 'pendiente' });
  assert.equal(sinPoster.nivel, 'dooh'); assert.equal(sinPoster.poster, null); assert.equal(sinPoster.pendiente, true);
  assert.equal(Z.nivelPrevio({ dooh: { ...FACHADA, quad: [[0, 0], [0, 0], [0, 0], [0, 0]] }, circuito: CIRCUITO }).nivel, 'circuito', 'un quad roto no es un Previo DooH');
  const circ = Z.nivelPrevio({ circuito: CIRCUITO, orientacion: '' });
  assert.equal(circ.nivel, 'circuito'); assert.equal(circ.poster, CIRCUITO.poster);
  assert.deepEqual(Z.nivelPrevio({ circuito: null }), { nivel: 'ninguno', pendiente: false });
  assert.deepEqual(Z.nivelPrevio({ circuito: 'pendiente' }), { nivel: 'ninguno', pendiente: true });
  assert.deepEqual(Z.nivelPrevio({ circuito: { ok: true, poster: null } }), { nivel: 'ninguno', pendiente: false });
  // «Previo nunca negro»: la imagen que da error se apunta y el Xpacio baja al nivel siguiente.
  const f = new Set([directo.poster]);
  assert.deepEqual(Z.nivelPrevio(todo, f), { nivel: 'directo', poster: null, video: directo.video, title: 'Ahora' }, 'sin póster, el vídeo de la pieza');
  f.add(directo.video); assert.equal(Z.nivelPrevio(todo, f).nivel, 'dooh');
  f.add(FACHADA.imagen); assert.equal(Z.nivelPrevio(todo, f).nivel, 'circuito');
  f.add(CIRCUITO.vertical.poster); assert.equal(Z.nivelPrevio(todo, f).nivel, 'circuito', 'queda la pieza principal del circuito');
  f.add(CIRCUITO.poster); assert.equal(Z.nivelPrevio(todo, f).nivel, 'ninguno');
});

test('el reparto de hoy con los datos reales: 0 en directo, 102 Previo DooH, 229 de programación del circuito', () => {
  // Muestra del catálogo (brain.digitalavatar.ai/locations, 24-oct-2026): los tags con piezas en el Stock son
  // alcampo (14), altadis (7), jti (5) y starbucks (50 de 170); las 61 pantallas vinculadas dan item:null.
  const conPoster = new Set(['alcampo', 'altadis', 'jti', 'starbucks']);
  const nivel = l => Z.nivelPrevio({ directo: null, dooh: l.previo || null, circuito: conPoster.has(Z.etiquetaStock(l)) ? { ok: true, poster: 'https://x.example/p.jpg' } : null, orientacion: Z.orientacionDe(l) }).nivel;
  assert.equal(nivel({ id: 'alcampo-andres-vicente', previo: FACHADA }), 'dooh');
  assert.equal(nivel({ id: 'altadis-bcn-001', circuit: 'altadis_bcn', surfaces: [{ orientation: 'portrait', screen: 'altadis-bcn-001-p1-vertical' }] }), 'circuito');
  assert.equal(nivel({ id: 'alsea-sbux-021', circuit: 'alsea_starbucks' }), 'circuito');
  assert.equal(nivel({ id: 'correos-3511-correos' }), 'ninguno');
});

test('tarjetas: como mucho N, las más cercanas al centro, enteras en la vista, sin solaparse ni pisar la ficha', () => {
  const opciones = { ancho: 1440, alto: 900, max: 6, margenes: { top: 72, right: 8, bottom: 64, left: 8 } };
  const T = Z.TARJETA;
  // Rejilla de 9×6 puntos separados 120 px: caben tarjetas de 172×146 sin solaparse, pero no todas.
  const puntos = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) puntos.push({ id: 'p' + i + '-' + j, x: 240 + i * 120, y: 230 + j * 120 });
  const elegidas = Z.elegirTarjetas(puntos, opciones);
  assert.equal(elegidas.length, 6);
  const cajas = elegidas.map(p => Z.cajaTarjeta(p, T));
  for (let a = 0; a < cajas.length; a++) {
    const c = cajas[a];
    assert.ok(c.l >= 8 && c.r <= 1432 && c.t >= 72 && c.b <= 836, 'dentro de la vista: ' + elegidas[a].id);
    for (let b = a + 1; b < cajas.length; b++) {
      const d = cajas[b];
      assert.ok(!(c.l < d.r + Z.SEPARACION && d.l < c.r + Z.SEPARACION && c.t < d.b + Z.SEPARACION && d.t < c.b + Z.SEPARACION), elegidas[a].id + ' pisa ' + elegidas[b].id);
    }
  }
  // La primera es la más cercana al centro (720, 450).
  const dist = p => Math.hypot(p.x - 720, p.y - 450);
  assert.equal(dist(elegidas[0]), Math.min(...puntos.filter(p => { const c = Z.cajaTarjeta(p, T); return c.t >= 72 && c.b <= 836; }).map(dist)));
  assert.equal(Z.elegirTarjetas(puntos, { ...opciones, max: 3 }).length, 3, 'móvil: 3');
  // Dos Xpacios en el mismo sitio: una sola tarjeta. Un id repetido: una vez.
  assert.equal(Z.elegirTarjetas([{ id: 'a', x: 700, y: 500 }, { id: 'b', x: 702, y: 501 }, { id: 'a', x: 900, y: 500 }], opciones).length, 1);
  // Lo que tapa la ficha (derecha, 400 px) no lleva tarjeta; la de la ficha abierta tampoco (excluir).
  const tapa = { l: 1040, t: 64, r: 1440, b: 900 };
  const conFicha = Z.elegirTarjetas(puntos, { ...opciones, tapas: [tapa], excluir: 'p4-2' });
  assert.ok(conFicha.every(p => Z.cajaTarjeta(p, T).r <= 1040), 'nada bajo la ficha');
  assert.ok(!conFicha.some(p => p.id === 'p4-2'));
  // Un punto pegado al borde de arriba no tiene sitio para su tarjeta.
  assert.equal(Z.elegirTarjetas([{ id: 'arriba', x: 700, y: 120 }], opciones).length, 0);
  // Prioridad: primero los que tienen previo (0), luego los dudosos (1) y al final los que no (2).
  const pr = Z.elegirTarjetas([{ id: 'sin', x: 720, y: 450, prioridad: 2 }, { id: 'con', x: 300, y: 700, prioridad: 0 }], { ...opciones, max: 1 });
  assert.deepEqual(pr.map(p => p.id), ['con']);
  assert.deepEqual(Z.elegirTarjetas([], opciones), []);
});

test('encuadre del Previo DooH: la foto cubre la caja y la pantalla queda en el centro, más grande que en la foto entera', () => {
  const e = Z.encuadreDooh(FACHADA, 164, 100);
  assert.ok(e.x <= 0 && e.y <= 0 && e.x + e.w >= 164 - 0.01 && e.y + e.h >= 100 - 0.01, 'sin huecos');
  const alto = (.757 - .63) * 900 * e.escala;
  assert.ok(Math.abs(alto - 56) < 1, 'la pantalla ocupa ~56 % del alto: ' + alto);
  const cx = e.x + (.701 * 1600) * e.escala;
  assert.ok(Math.abs(cx - 82) < 1, 'centrada: ' + cx);
  assert.ok(e.escala <= 1.1, 'sin pasar de la nitidez de la foto');
  const fit = Z.encuadreDooh({ ...FACHADA, quad: [[0, 0], [1, 0], [1, 1], [0, 1]] }, 160, 90);
  assert.equal(fit.escala, 0.1, 'una pantalla que es toda la foto: la foto entera');
});

test('HTML de la tarjeta: «Anunciarme aquí» ENCIMA del previo, botones de verdad con aria-label, ES/EN y sin inyección', () => {
  const loc = { id: 'alcampo-x', name: 'Alcampo <b>Bretón</b>' };
  const n = Z.nivelPrevio({ dooh: FACHADA, circuito: CIRCUITO });
  const html = Z.tarjetaHtml(loc, n, { lang: 'es' });
  assert.ok(html.indexOf('class="pz-cta"') < html.indexOf('class="pz-previo"'), 'el CTA va primero');
  assert.match(html, /<button type="button" class="pz-cta" data-pz="cta" aria-label="Anunciarme aquí: Alcampo &lt;b&gt;Bretón&lt;\/b&gt;">💼 Anunciarme aquí<\/button>/);
  assert.match(html, /<button type="button" class="pz-previo" data-pz="abrir" aria-label="Abrir la ficha de Alcampo &lt;b&gt;Bretón&lt;\/b&gt; · Previo DooH"/);
  assert.match(html, /<img class="pz-fachada" src="https:\/\/admira\.tv\/api\/previo\/alcampo-x\.jpg" data-pz-src=/);
  assert.match(html, /class="pz-pantalla" style="width:540px;height:960px;transform:matrix3d\(/);
  assert.match(html, /pz-etq-dooh/);
  assert.doesNotMatch(html, /<iframe|<video|autoplay/, 'en el mapa, sin iframe ni vídeo');
  const en = Z.tarjetaHtml(loc, Z.nivelPrevio({ circuito: CIRCUITO }), { lang: 'en' });
  assert.match(en, /💼 Advertise here/); assert.match(en, /Circuit programme/);
  const sinCta = Z.tarjetaHtml(loc, n, { lang: 'es', cta: false });
  assert.doesNotMatch(sinCta, /pz-cta/, 'sin Comercial, sin botón');
  const nada = Z.tarjetaHtml(loc, Z.nivelPrevio({ circuito: null }), { lang: 'es' });
  assert.match(nada, /pz-compacta/); assert.match(nada, /Sin previo todavía/); assert.doesNotMatch(nada, /pz-media/, 'compacta: sin caja vacía');
  // Con el t() de app.js (I18N) manda su texto.
  assert.match(Z.tarjetaHtml(loc, n, { lang: 'es', t: k => k === 'pz_dooh' ? 'Previo DooH (i18n)' : k }), /Previo DooH \(i18n\)/);
  // Un póster con comillas no rompe el atributo.
  assert.equal(Z.mediaHtml({ nivel: 'circuito', poster: 'https://x.example/a"onerror="x.jpg' }).includes('"onerror="'), false);
});

test('ficha: «Anunciarme aquí» a lo ancho y, justo DEBAJO, el previo grande; Tour DooH, Escena y Plano siguen en 2×2', () => {
  const html = read('index.html');
  const fila = html.slice(html.indexOf('<div class="actions panel-navigation">'), html.indexOf('</div>', html.indexOf('<div class="actions panel-navigation">')));
  const orden = [...fila.matchAll(/<(a|figure)\b[^>]*\bid="([^"]+)"/g)].map(m => m[2]);
  assert.deepEqual(orden, ['p-comercial', 'p-emite', 'p-tour', 'p-twin', 'p-twin-hd', 'p-plano']);
  assert.match(fila, /<figure class="p-emite" id="p-emite" hidden><\/figure>/, 'oculto hasta que previos-zoom.js lo pinta');
  const reglas = sel => [...html.matchAll(/^\s*([^{}\n]+)\{([^{}]*)\}/gm)].filter(m => m[1].trim() === sel).map(m => m[2]);
  assert.ok(reglas('aside.panel .actions.panel-navigation #p-comercial').some(d => /grid-column:1\/-1/.test(d)), 'CTA a lo ancho');
  assert.ok(reglas('.p-emite').some(d => /grid-column:1\/-1/.test(d)), 'previo a lo ancho');
  assert.ok(reglas('.p-emite[hidden]').some(d => /display:none/.test(d)));
  // «Sin previo todavía» en la ficha: la etiqueta va en su línea, no flotando sobre «Anunciarme aquí».
  assert.ok(reglas('.p-emite-nada .pz-etq').some(d => /position:static/.test(d)));
  // El bloque que pinta: previo, etiqueta y, en Previo DooH, «▶ Ver emitiendo» (abre openPrevio).
  const dooh = Z.fichaHtml(Z.nivelPrevio({ dooh: FACHADA, circuito: CIRCUITO }), { lang: 'es', ancho: 352 });
  assert.match(dooh, /^<span class="p-emite-media pz-media pz-media-dooh" style="height:198px">/);
  assert.match(dooh, /<button type="button" class="p-emite-accion" data-pz="ver">▶ Ver emitiendo<\/button>/);
  assert.match(dooh, /Previo DooH/); assert.match(dooh, /<span class="p-emite-titulo">Pan<\/span>/);
  assert.match(Z.fichaHtml(Z.nivelPrevio({ circuito: CIRCUITO }), { lang: 'en' }), /data-pz="pieza">▶ Play the spot/);
  assert.equal(Z.fichaHtml(Z.nivelPrevio({ circuito: null }), { lang: 'es' }), '<span class="p-emite-nada"><span class="pz-etq pz-etq-ninguno"><i aria-hidden="true"></i>Sin previo todavía</span></span>');
  assert.match(Z.fichaHtml(Z.nivelPrevio({ circuito: 'pendiente' }), { lang: 'es' }), /Cargando la programación…/);
  // app.js lo pinta al renderizar la ficha, con el mismo local que «Anunciarme aquí».
  const app = read('app.js');
  assert.match(app, /comercialAqui\.dataset\.comercialLocal = loc\.id;\n[^\n]*\n  try \{ if \(window\.__previosZoom\) window\.__previosZoom\.ficha\(loc, document\.getElementById\('p-emite'\)\); \} catch \(_\) \{\}/);
  assert.match(app, /verEmitiendo: loc => openPrevio\(loc\)/);
});

test('app.js: sin peticiones nuevas para el directo (EMIT_NOW sale del sondeo de siempre) y eventos del mapa con antirrebote', () => {
  const app = read('app.js');
  const sondeo = app.slice(app.indexOf('async function pollEmissionStatus'), app.indexOf('function startEmissionStatusPolling'));
  assert.equal((sondeo.match(/fetch\(/g) || []).length, 1, 'el mismo fetch a signage/now de antes');
  assert.match(sondeo, /EMIT_NOW\[sc\] = \{ item: it \|\| null, standby: !!\(j && j\.standby\) \};/);
  assert.match(app, /map\.on\('moveend', \(\) => previosZoom\.programar\(\)\);/);
  assert.match(app, /map\.on\('movestart', e => \{ if \(!e \|\| !e\.originalEvent\) previosZoom\.ocultar\(\); \}\);/, 'vuelos: fuera tarjetas');
  assert.match(app, /ocupado: \(\) => !!\(tourRun \|\| circuitDemo\.running \|\| tourCamera\.isNavigating\(\) \|\| previoState\.open\)/, 'Tour DooH y previo abierto: sin tarjetas');
  assert.match(app, /puedeAnunciar: \(\) => \{ const b = document\.getElementById\('p-comercial'\); return !!\(b && !b\.hidden && window\.AdmiraComercial/);
  assert.match(app, /anunciar: loc => window\.AdmiraComercial\.anunciarAqui\(loc\.id\)/);
  assert.match(app, /abrir: abrirXpacioDelMapa,/);
  assert.match(app, /map\.on\('click', 'unclustered-point'[\s\S]{0,700}abrirXpacioDelMapa\(loc\);/, 'el clic en el punto y en el previo hacen lo mismo (con un solo Xpacio en el punto; con varios, el selector de FLT-102672)');
  // «Anunciarme aquí» de la tarjeta = el de la ficha (comercial.mjs).
  assert.match(read('comercial.mjs'), /anunciarAqui:id=>abrirConLocal\(id\)\};/);
  // Sólo admira.biz: el release lo publica en su lista cerrada, y el worker copia el módulo del endpoint.
  const html = read('index.html');
  assert.ok(html.indexOf('previo.js?v=') < html.indexOf('previos-zoom.js?v=20261024-mismo-punto-1') && html.indexOf('previos-zoom.js?v=') < html.indexOf('app.js?v='));
  assert.match(read('server/biz-assets.mjs'), /'previos-zoom\.js',/);
  assert.match(read('scripts/build-biz-release.mjs'), /copyFileSync\(join\(root, 'server\/previo-circuito\.mjs'\), join\(out, 'server\/previo-circuito\.mjs'\)\);/);
});

// ── El controlador sobre un mapa y un DOM de mentira ──
function montaje({ zoom = 15, puntos = [], locs = {}, cta = true, fuente = null, rapido = false } = {}) {
  const pedidos = [], markers = [], consultas = { n: 0 }, oyentes = { sourcedata: new Set() };
  class El {
    constructor() { this.dataset = {}; this.className = ''; this.innerHTML = ''; this.classList = { toggle() {}, add() {}, remove() {} }; }
    addEventListener() {} querySelectorAll() { return []; } querySelector() { return null; } contains() { return false; }
  }
  const map = {
    z: zoom, getZoom() { return this.z; }, getLayer: () => ({}), getCanvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 900 }) }),
    queryRenderedFeatures() { consultas.n++; return (fuente ? fuente.puntos : puntos).map(p => ({ properties: { id: p.id } })); },
    project: c => ({ x: c[0], y: c[1] }),
  };
  // Fuente con estado (cargada o no, y sus puntos) y avisos `sourcedata`, como la de MapLibre.
  if (fuente) {
    map.isSourceLoaded = id => id === 'locs' && fuente.cargada;
    map.on = (ev, fn) => { (oyentes[ev] || (oyentes[ev] = new Set())).add(fn); };
    map.off = (ev, fn) => { oyentes[ev] && oyentes[ev].delete(fn); };
  }
  const avisar = ev => [...oyentes.sourcedata].forEach(fn => fn(ev));
  class Marker { constructor(o) { this.el = o.element; markers.push(this); } setLngLat(c) { this.c = c; return this; } addTo() { this.on = true; return this; } remove() { this.on = false; } }
  const c = Z.crear({
    map, maplibregl: { Marker }, document: { createElement: () => new El() },
    fetch: (url) => { pedidos.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, poster: url.includes('alcampo') ? 'https://api.admira.store/stock/poster/v1' : null }) }); },
    loc: id => locs[id], fuentes: l => ({ directo: null, dooh: l.previo || null, orientacion: '', tag: Z.etiquetaStock(l) }), t: null, lang: () => 'es',
    ocupado: () => false, activa: () => null, tapas: () => [], margenes: () => ({ top: 72, right: 8, bottom: 64, left: 8 }),
    puedeAnunciar: () => cta, anunciar: () => {}, abrir: () => {}, verEmitiendo: () => {},
    ...(rapido ? { refrescoMs: 5, esperaMs: 20 } : {}),
  });
  return { c, map, pedidos, markers, consultas, oyentes, avisar };
}
const locs = {
  'alcampo-a': { id: 'alcampo-a', name: 'Alcampo A', coords: [700, 450], previo: FACHADA },
  'correos-b': { id: 'correos-b', name: 'Correos B', coords: [400, 450] },
  'otro-c': { id: 'otro-c', name: 'Otro C', coords: [1000, 450] },
};

test('zoom alejado: CERO peticiones, ni consulta de puntos, ni tarjetas', async () => {
  const m = montaje({ zoom: 13.9, puntos: Object.values(locs), locs });
  m.c.programar(); m.c.calcular(); m.c.vigilarZoom();
  await new Promise(r => setTimeout(r, 250));
  assert.equal(m.pedidos.length, 0); assert.equal(m.consultas.n, 0); assert.equal(m.markers.length, 0);
  assert.equal(Z.ZOOM_MIN, 14);
});

test('zoom de calle: un póster por hashtag (una vez), tarjetas con previo primero y fuera al alejar', async () => {
  const m = montaje({ zoom: 15, puntos: Object.values(locs), locs });
  m.c.calcular();
  assert.equal(m.consultas.n, 1);
  assert.deepEqual(m.pedidos.sort(), ['/api/previo/circuito?tag=alcampo', '/api/previo/circuito?tag=correos'], 'sólo los hashtags de lo que se ve; «otro» no tiene');
  await new Promise(r => setTimeout(r, 0));
  m.c.calcular();
  assert.equal(m.pedidos.length, 2, 'no se repiten');
  const est = m.c.estado();
  assert.deepEqual(est.tarjetas.map(t => [t.id, t.nivel]).sort(), [['alcampo-a', 'dooh'], ['correos-b', 'ninguno'], ['otro-c', 'ninguno']]);
  assert.ok(m.markers.every(k => k.on));
  m.map.z = 12; m.c.vigilarZoom();
  assert.equal(m.c.estado().tarjetas.length, 0); assert.ok(m.markers.every(k => !k.on));
  // Sin Comercial, una tarjeta sin previo no aporta: sólo queda la del Previo DooH.
  const sin = montaje({ zoom: 15, puntos: Object.values(locs), locs, cta: false });
  sin.c.calcular(); await new Promise(r => setTimeout(r, 0)); sin.c.calcular();
  assert.deepEqual(sin.c.estado().tarjetas.map(t => t.id), ['alcampo-a']);
});

// Fallo de producción del 24-oct (v.24.10.2026.r3.15:58): tras un jumpTo a zoom 14,2 no salía ninguna tarjeta hasta mover
// el mapa. El moveend llegaba antes de que la fuente `locs` tuviera sus teselas: 0 puntos y nadie volvía a calcular.
const espera = ms => new Promise(r => setTimeout(r, ms));
test('primer cálculo sin puntos (fuente sin cargar): se reintenta al aviso de la fuente y salen las tarjetas', async () => {
  const fuente = { cargada: false, puntos: [] };
  const m = montaje({ zoom: 14.2, locs, fuente, rapido: true });
  m.c.calcular();
  assert.equal(m.c.estado().tarjetas.length, 0);
  assert.equal(m.c.estado().esperandoFuente, true, 'queda esperando a la fuente');
  assert.equal(m.oyentes.sourcedata.size, 1, 'un solo aviso armado');
  m.c.calcular(); assert.equal(m.oyentes.sourcedata.size, 1, 'no se arma dos veces');
  // Llegan las teselas: MapLibre avisa con sourcedata (isSourceLoaded) de la fuente locs.
  fuente.cargada = true; fuente.puntos = Object.values(locs);
  m.avisar({ sourceId: 'otra', isSourceLoaded: true });
  assert.equal(m.c.estado().esperandoFuente, true, 'el aviso de otra fuente no cuenta');
  m.avisar({ sourceId: 'locs', isSourceLoaded: true });
  assert.equal(m.oyentes.sourcedata.size, 0, 'se desarma al cumplirse');
  await espera(15);
  assert.equal(m.c.estado().tarjetas.length, 3, 'sin mover el mapa');
  assert.equal(m.c.estado().esperandoFuente, false);
});

test('si el aviso de la fuente ya pasó, el reintento por tiempo las saca igual', async () => {
  const fuente = { cargada: true, puntos: [] };   // «cargada» pero aún sin pintar los puntos de este zoom
  const m = montaje({ zoom: 14.2, locs, fuente, rapido: true });
  m.c.calcular();
  assert.equal(m.c.estado().tarjetas.length, 0); assert.equal(m.c.estado().esperandoFuente, true);
  fuente.puntos = Object.values(locs);
  await espera(60);
  assert.equal(m.c.estado().tarjetas.length, 3);
  assert.equal(m.c.estado().esperas, 0, 'con puntos, la cuenta vuelve a cero');
});

test('sin bucles: una zona sin puntos de verdad deja de reintentar a las ESPERA_MAX veces; alejar desarma', async () => {
  const fuente = { cargada: true, puntos: [] };
  const m = montaje({ zoom: 15, locs, fuente, rapido: true });
  m.c.calcular();
  await espera(400);
  assert.equal(m.consultas.n, 1 + Z.ESPERA_MAX, 'una consulta y ' + Z.ESPERA_MAX + ' reintentos');
  assert.equal(m.c.estado().esperandoFuente, false); assert.equal(m.oyentes.sourcedata.size, 0);
  await espera(100); assert.equal(m.consultas.n, 1 + Z.ESPERA_MAX, 'y ahí se queda');
  // Moverse (programar) vuelve a dar margen; alejar desarma el aviso pendiente.
  const n = montaje({ zoom: 15, locs, fuente: { cargada: false, puntos: [] }, rapido: true });
  n.c.calcular(); assert.equal(n.oyentes.sourcedata.size, 1);
  n.map.z = 10; n.c.programar();
  assert.equal(n.oyentes.sourcedata.size, 0); assert.equal(n.c.estado().esperandoFuente, false);
});

test('mientras la fuente recarga (catálogo, emisión) sin puntos a la vista, las tarjetas que hay se quedan', async () => {
  const fuente = { cargada: true, puntos: Object.values(locs) };
  const m = montaje({ zoom: 15, locs, fuente, rapido: true });
  m.c.calcular(); await espera(0); m.c.calcular();
  assert.equal(m.c.estado().tarjetas.length, 3);
  fuente.cargada = false; fuente.puntos = [];
  m.c.calcular();
  assert.equal(m.c.estado().tarjetas.length, 3, 'no se borran por una recarga');
  fuente.cargada = true; fuente.puntos = Object.values(locs);
  m.avisar({ sourceId: 'locs', isSourceLoaded: true }); await espera(15);
  assert.equal(m.c.estado().tarjetas.length, 3);
  assert.equal(m.markers.filter(k => k.on).length, 3, 'las mismas, sin parpadeo');
});
