import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {leerTablero, leerSupervisor, veredicto, esperado, textoVeredicto, parteSupervisor, SUPERVISOR_API, FRESCO_MS, VEREDICTO_MS} from '../supervisor-core.mjs';
import {montarSupervisor} from '../supervisor-live.mjs';
import {BIZ_ASSET_FILES} from '../server/biz-assets.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const T0 = Date.parse('2026-10-18T07:07:08Z');
const FOTO = 'https://api.yokup.com/media/fleet/affa7d1ab353b1dc.jpeg';
// Forma real del tablero publicado por la Insta360 (api.yokup.com/supervisor/soluciones?id=macmini-insta360, 18-oct-2026).
function tablero({estado = 'encendida', publicado = T0, capturada = publicado - 3000, abiertas = [], incidencia = null} = {}) {
  return {ok: true, id: 'macmini-insta360', ciclo: 26111, en: 'mbp16-pantalla', cuando: new Date(publicado).toISOString(),
    posiciones: [{id: 'mbp16-pantalla', luz: 0.6, estado, foto: FOTO, cuando: new Date(capturada).toISOString(), incidencia}],
    abiertas, cerradas: [{id: 'INC-LXF9FB', posicion: 'pantallas-derecha', url: 'https://www.admira.app/ticket?id=INC-LXF9FB', cuando: ''}]};
}
const VIEJA = {id: 'INC-KOBKYX', posicion: 'mbp16-pantalla', url: 'https://www.admira.app/ticket?id=INC-KOBKYX', cuando: '2026-10-16T08:35:38+0200'};

test('lee el MBP16 del tablero real: estado, frescura, foto e incidencias abiertas sólo de su posición', () => {
  const l = leerTablero(tablero({abiertas: [VIEJA, {id: 'INC-OTRA1', posicion: 'pantallas-derecha', cuando: ''}], incidencia: VIEJA}), T0 + 4000);
  assert.equal(l.estado, 'encendida'); assert.equal(l.fresco, true); assert.equal(l.edadMs, 4000); assert.equal(l.ciclo, 26111);
  assert.equal(l.foto, FOTO); assert.equal(l.capturada, T0 - 3000);
  assert.deepEqual(l.abiertas.map(i => i.id), ['INC-KOBKYX'], 'sin duplicar la propia ni traer otras posiciones');
  assert.equal(l.abiertas[0].url, 'https://www.admira.app/ticket?id=INC-KOBKYX');
  assert.equal(l.abiertas[0].cuando, Date.parse('2026-10-16T06:35:38Z'));
});

test('un tablero viejo, caído o sin el MBP16 es «sin señal»; un estado desconocido nunca es «encendida»', () => {
  assert.equal(leerTablero(tablero(), T0 + FRESCO_MS).estado, 'sin-senal');
  assert.equal(leerTablero(tablero(), T0 - 60000).estado, 'sin-senal', 'fecha futura');
  for (const p of [null, {}, {ok: false}, {ok: true, posiciones: []}, {...tablero(), cuando: 'ayer'}]) assert.equal(leerTablero(p, T0).estado, 'sin-senal');
  assert.equal(leerTablero(tablero({estado: 'sin-dato'}), T0).estado, 'sin-dato');
  assert.equal(leerTablero(tablero({estado: 'directo'}), T0).estado, 'sin-dato');
  const raro = tablero({abiertas: [{id: '<img src=x>', posicion: 'mbp16-pantalla'}]});
  raro.posiciones[0].foto = 'https://evil.example/x.jpeg';
  const l = leerTablero(raro, T0);
  assert.equal(l.foto, ''); assert.deepEqual(l.abiertas, []);
});

test('leerSupervisor pide el tablero sin caché y un fallo de red es «sin señal», no un error', async () => {
  const urls = [];
  const ok = await leerSupervisor(async (url, init) => { urls.push([url, init.cache]); return Response.json(tablero()); }, {ahora: () => T0});
  assert.equal(ok.estado, 'encendida'); assert.deepEqual(urls, [[SUPERVISOR_API, 'no-store']]);
  assert.equal((await leerSupervisor(async () => { throw Error('red'); }, {ahora: () => T0})).estado, 'sin-senal');
  assert.equal((await leerSupervisor(async () => new Response('', {status: 503}), {ahora: () => T0})).estado, 'sin-senal');
});

test('qué debe ver el Supervisor según la orden física', () => {
  assert.equal(esperado('black'), 'apagada'); assert.equal(esperado('display-off'), 'apagada');
  assert.equal(esperado('clear'), 'encendida'); assert.equal(esperado('display-on'), 'encendida');
  for (const f of ['rotate', 'popup', 'canvas', 'half']) assert.equal(esperado(f), 'incidencia');
  assert.equal(esperado('otra'), '');
});

test('veredicto de un apagado: sólo cuenta una captura posterior a la orden', () => {
  const desde = T0, antes = leerTablero(tablero({abiertas: [VIEJA]}), T0 - 1000);
  const previa = leerTablero(tablero({estado: 'apagada', publicado: T0 + 2000, capturada: T0 - 500, abiertas: [VIEJA]}), T0 + 2000);
  assert.equal(veredicto({fault: 'display-off', antes, lectura: previa, desde, ahora: T0 + 2000}).estado, 'esperando', 'captura anterior a la orden');
  const vista = leerTablero(tablero({estado: 'apagada', publicado: T0 + 9000, capturada: T0 + 8000, abiertas: [VIEJA]}), T0 + 9000);
  const v = veredicto({fault: 'display-off', antes, lectura: vista, desde, ahora: T0 + 9000});
  assert.deepEqual([v.estado, v.por, v.incidencia.id], ['visto', 'camara', 'INC-KOBKYX']);
  assert.match(textoVeredicto(v, 'es'), /la cámara ve la pantalla del MBP16 a oscuras · INC-KOBKYX/);
  assert.match(textoVeredicto(v, 'en'), /camera sees the MBP16 screen dark/);
});

test('sin ver el cambio no hay «visto»: persona delante, sin señal o simplemente no lo vio', () => {
  const desde = T0, antes = leerTablero(tablero(), T0), fin = T0 + VEREDICTO_MS + 1000;
  const tapada = leerTablero(tablero({estado: 'sin-dato', publicado: fin, capturada: fin - 1000}), fin);
  assert.equal(veredicto({fault: 'black', antes, lectura: tapada, desde, ahora: fin}).estado, 'sin-dato');
  assert.equal(veredicto({fault: 'black', antes, lectura: leerTablero(null, fin), desde, ahora: fin}).estado, 'sin-senal');
  assert.equal(veredicto({fault: 'black', antes, lectura: leerTablero(null, T0 + 5000), desde, ahora: T0 + 5000}).estado, 'esperando-senal');
  const sigue = leerTablero(tablero({publicado: fin, capturada: fin - 1000}), fin);
  const v = veredicto({fault: 'black', antes, lectura: sigue, desde, ahora: fin});
  assert.equal(v.estado, 'no-visto');
  for (const estado of ['sin-dato', 'sin-senal', 'no-visto', 'esperando', 'esperando-senal'])
    assert.doesNotMatch(textoVeredicto({estado, espera: 'apagada'}, 'es'), /lo ha visto|a oscuras|encendida otra vez/, estado);
});

test('giro, popup, lienzo y recorte: «visto» sólo con una incidencia nueva; la que ya estaba abierta no cuenta', () => {
  const desde = T0, antes = leerTablero(tablero({abiertas: [VIEJA]}), T0), fin = T0 + VEREDICTO_MS + 1000;
  const nueva = {id: 'INC-NUEVA7', posicion: 'mbp16-pantalla', url: '', cuando: new Date(T0 + 40000).toISOString()};
  const conNueva = leerTablero(tablero({publicado: T0 + 45000, capturada: T0 + 44000, abiertas: [VIEJA, nueva]}), T0 + 45000);
  const v = veredicto({fault: 'rotate', antes, lectura: conNueva, desde, ahora: T0 + 45000});
  assert.deepEqual([v.estado, v.por, v.incidencia.id], ['visto', 'incidencia', 'INC-NUEVA7']);
  assert.match(textoVeredicto(v, 'es'), /incidencia nueva · INC-NUEVA7/);
  const igual = leerTablero(tablero({publicado: fin, capturada: fin - 1000, abiertas: [VIEJA]}), fin);
  assert.equal(veredicto({fault: 'popup', antes, lectura: igual, desde, ahora: T0 + 30000}).estado, 'esperando');
  const s = veredicto({fault: 'popup', antes, lectura: igual, desde, ahora: fin});
  assert.deepEqual([s.estado, s.incidencia.id], ['sin-nueva', 'INC-KOBKYX']);
  assert.match(textoVeredicto(s, 'es'), /no ha abierto una incidencia nueva/);
  // Una incidencia vieja que no estaba en la lectura previa tampoco se presenta como nueva.
  const sinAntes = veredicto({fault: 'canvas', antes: null, lectura: igual, desde, ahora: fin});
  assert.equal(sinAntes.estado, 'sin-nueva');
});

test('restaurar: el Supervisor la ve encendida y la incidencia sigue abierta para revisión', () => {
  const antes = leerTablero(tablero({estado: 'apagada', abiertas: [VIEJA]}), T0);
  const luz = leerTablero(tablero({publicado: T0 + 15000, capturada: T0 + 14000, abiertas: [VIEJA]}), T0 + 15000);
  const v = veredicto({fault: 'clear', antes, lectura: luz, desde: T0, ahora: T0 + 15000});
  assert.equal(v.estado, 'visto');
  assert.match(textoVeredicto(v, 'es'), /encendida otra vez\. INC-KOBKYX sigue abierta hasta que alguien la revise/);
  assert.match(textoVeredicto(v, 'en'), /stays open until someone reviews it/);
});

test('el parte de /supervisor estado da una línea por dato y no inventa incidencias ni frescura', () => {
  const l = leerTablero(tablero({abiertas: [VIEJA]}), T0 + 4000);
  const es = parteSupervisor(l, 'es');
  assert.equal(es[0], 'Supervisor · MBP16 (GDG51-PAN-07)');
  assert.equal(es[1], 'Pantalla encendida · lectura hace 4 s · ciclo 26111');
  assert.ok(es.includes('Incidencia abierta: INC-KOBKYX · https://www.admira.app/ticket?id=INC-KOBKYX'));
  assert.ok(es.includes('Última foto publicada: ' + FOTO));
  assert.match(es.at(-1), /admira\.app\/supervisor · cámara con controles: \/supervisor/);
  const caido = parteSupervisor(leerTablero(null, T0), 'en');
  assert.equal(caido[1], 'No signal from Supervisor');
  assert.equal(caido.some(x => /incident|cycle|photo/i.test(x)), false);
  assert.equal(parteSupervisor(leerTablero(tablero(), T0), 'es')[2], 'Sin incidencias abiertas en el MBP16.');
});

// DOM mínimo: lo justo que usa supervisor-live.mjs.
function fakeDom(ids) {
  const listeners = {};
  const mk = tag => {
    const el = {tagName: tag, dataset: {}, attrs: {}, children: [], hidden: false, alt: '', href: '', target: '', rel: '',
      _text: '',
      get textContent() { return this._text + this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); },
      set textContent(v) { this._text = String(v); this.children = []; },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      append(...xs) { this.children.push(...xs); }, replaceChildren() { this._text = ''; this.children = []; },
      querySelectorAll() { return []; }};
    return el;
  };
  const byId = Object.fromEntries(ids.map(id => [id, mk('div')]));
  byId['bb-sv-title'].dataset.sv = 'titulo';
  const doc = {hidden: false, documentElement: {lang: 'es'}, getElementById: id => byId[id] || null, createElement: mk,
    querySelectorAll: () => Object.values(byId).filter(e => e.dataset.sv),
    addEventListener(t, f) { (listeners[t] ||= []).push(f); }};
  const win = {addEventListener(t, f) { (listeners['win:' + t] ||= []).push(f); }, removeEventListener() {}};
  return {doc, win, byId, fire: (t, detail) => Promise.all((listeners['win:' + t] || []).map(f => f({detail})))};
}

test('el banco pinta el Supervisor y da el veredicto de la orden de Bugito', async () => {
  const ids = ['bb-supervisor', 'bb-sv-title', 'bb-sv-estado', 'bb-sv-web', 'bb-sv-img', 'bb-sv-lectura', 'bb-sv-incidencias', 'bb-sv-veredicto'];
  const {doc, win, byId, fire} = fakeDom(ids);
  let reloj = T0 + 2000, respuesta = tablero({abiertas: [VIEJA], incidencia: VIEJA});
  const sv = montarSupervisor(doc, {fetcher: async () => Response.json(respuesta), ahora: () => reloj, cada: 3600000, win});
  try {
    await sv.refrescar();
    assert.equal(byId['bb-sv-estado'].textContent, 'Pantalla encendida');
    assert.equal(byId['bb-sv-estado'].dataset.estado, 'encendida');
    assert.equal(byId['bb-sv-img'].getAttribute('src'), FOTO); assert.equal(byId['bb-sv-img'].hidden, false);
    assert.equal(byId['bb-sv-lectura'].textContent, 'Lectura hace 2 s · ciclo 26111');
    assert.match(byId['bb-sv-incidencias'].textContent, /^Incidencia abierta: INC-KOBKYX · desde 16 oct/);
    assert.equal(byId['bb-sv-web'].href, 'https://www.admira.app/supervisor');
    assert.equal(byId['bb-sv-title'].textContent, 'Supervisor · lo que ve la cámara');
    await fire('bugito:command-queued', {fault: 'black', after: T0 + 3000});
    assert.match(byId['bb-sv-veredicto'].textContent, /^Esperando a que el Supervisor lo vea/);
    reloj = T0 + 12000; respuesta = tablero({estado: 'apagada', publicado: reloj, capturada: T0 + 10000, abiertas: [VIEJA]});
    await sv.refrescar();
    assert.equal(byId['bb-sv-veredicto'].dataset.estado, 'visto');
    assert.match(byId['bb-sv-veredicto'].textContent, /la cámara ve la pantalla del MBP16 a oscuras · INC-KOBKYX\. Ver la ficha$/);
    assert.equal(sv.estado().orden, null, 'el veredicto queda fijado');
    doc.documentElement.lang = 'en'; reloj += 1000; await sv.refrescar();
    assert.equal(byId['bb-sv-estado'].textContent, 'Screen dark');
    assert.match(byId['bb-sv-veredicto'].textContent, /^Supervisor saw it/);
    respuesta = null; reloj = T0 + FRESCO_MS * 3; await sv.refrescar();
    assert.equal(byId['bb-sv-estado'].textContent, 'No signal from Supervisor');
  } finally { sv.parar(); }
});

test('cableado: tarjeta antes del banco, botones de pantalla con veredicto, /supervisor común de la suite y assets de Biz', () => {
  const html = read('bugito.html'), ui = read('bugito.mjs'), panel = read('expert-panel.js'), live = read('supervisor-live.mjs');
  assert.ok(html.indexOf('id="bb-supervisor"') > html.indexOf('id="bugito-xpacios"') && html.indexOf('id="bb-supervisor"') < html.indexOf('class="bb-grid"'));
  assert.match(html, /<script type="module" src="supervisor-live\.mjs\?v=20261018-supervisor-1"><\/script>/);
  assert.match(html, /<a href="#bb-supervisor" data-sv="ir">/);
  assert.doesNotMatch(html, /data-bb="[^"]*"[^>]*id="bb-sv-/, 'los textos del Supervisor son suyos (data-sv), no del diccionario de bugito.mjs');
  assert.match(ui, /dispatchEvent\(new CustomEvent\('bugito:command-queued', \{ detail: \{ fault: apagar \? 'display-off' : 'display-on'/);
  // /supervisor y /supervisor estado son el verbo común de la suite (admira-next-web#216, con la cara del Supervisor):
  // Biz ya no lo sustituye con su adaptador (norma «un único manejador de comandos»).
  assert.doesNotMatch(panel, /biz-supervisor|supervisorVerb|name:'supervisor'/);
  assert.match(panel, /visionVerb\(engine\);\}/);
  assert.match(live, /supervisor-core\.mjs\?v=20261018-supervisor-1/, 'la suite pide esta misma versión del núcleo');
  for (const f of ['supervisor-core.mjs', 'supervisor-live.mjs']) assert.ok(BIZ_ASSET_FILES.includes(f), f);
});

// La suite (admiranext suite/experto.js, /supervisor estado) importa https://www.admira.biz/supervisor-core.mjs y usa
// estas tres funciones con esta forma: cambiarlas rompe el verbo común en todas las aplicaciones.
test('contrato con la suite: leerSupervisor, parteSupervisor y textoEstado', async () => {
  const core = await import('../supervisor-core.mjs');
  for (const f of ['leerSupervisor', 'parteSupervisor', 'textoEstado']) assert.equal(typeof core[f], 'function', f);
  const l = core.leerTablero(null, Date.now());
  assert.equal(l.estado, 'sin-senal');
  assert.ok(Array.isArray(l.abiertas));
  assert.equal(core.textoEstado('encendida', 'es'), 'Pantalla encendida');
  assert.equal(core.textoEstado('sin-senal', 'en'), 'No signal from Supervisor');
  assert.ok(core.parteSupervisor(l, 'es').length >= 2);
});
