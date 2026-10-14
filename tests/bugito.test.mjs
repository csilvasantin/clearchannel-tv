// Bugito · banco de pruebas del ▤ Creador de incidencias (DCL-5da4653d859552490fd5ae1d): catálogo ampliado, detectores
// de las tres incidencias de superficie, órdenes, la lógica del banco y el agente de punta a punta, sin red real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATALOGO, GRACIA_MS, UMBRAL_TAPADO, UMBRAL_VISIBLE, tipoIncidencia, orden, lecturaSuperficie, observacion, vueltaDetector,
  apertura, cierre, recurso, anotar, medidaTexto, pasos
} from '../incidencias-core.mjs';
import {
  BANCO, BUGITO_SCREEN, BUGITO_ORIGIN, GRACIA_BANCO_MS, pantallaBanco, resolverIncidencia, INCIDENCIAS, playerUrl, caraUrl, baseLocal,
  estadoBugito, mensajeBugito, esDeBugito, bancoEsLab
} from '../bugito-core.mjs';
import { pasada } from '../tools/agente-incidencias.mjs';
import { BIZ_ASSET_FILES, bizAssetPath } from '../server/biz-assets.mjs';

const T0 = 1_791_970_000_000;
const P = pantallaBanco();
const panel = { width: 1600, height: 900, cssWidth: 1600, cssHeight: 900, fit: 'fill', rotation: 0, paintedRotation: 0, painted: 'horizontal' };
const senal = (display, { lastSeen = T0 } = {}) => ({ ok: true, screen: BUGITO_SCREEN, lastSeen, standby: false, device: { display: { ...panel, ...display } } });
const NORMAL = { canvas: { w: 1600, h: 900 }, overlay: 0, visible: 100 };

test('el catálogo crece con las tres incidencias de Bugito, cada una con su orden fault-* y su vuelta', () => {
  assert.deepEqual(CATALOGO.map((t) => [t.id, t.orden, t.vuelta, t.detector]), [
    ['formato-girado', 'fault-rotate', 'fault-clear', 'orientacion'],
    ['cambio-resolucion', 'fault-canvas', 'fault-clear', 'lienzo'],
    ['popup-encima', 'fault-popup', 'fault-clear', 'capa'],
    ['medio-abrir', 'fault-half', 'fault-clear', 'visible']
  ]);
  for (const t of CATALOGO) {
    assert.match(t.orden, /^fault-/, 'la salvaguarda del backend cubre todo fault*');
    assert.ok(t.es && t.en && t.ayuda.es && t.ayuda.en, t.id);
    assert.match(t.ayuda.es, /30 min/);
  }
  assert.deepEqual(orden('popup-encima', BUGITO_SCREEN), { ok: true, body: { id: BUGITO_SCREEN, screen: BUGITO_SCREEN, cmd: 'fault-popup' } });
  assert.deepEqual(orden('medio-abrir', BUGITO_SCREEN, { vuelta: true }).body.cmd, 'fault-clear');
  assert.deepEqual(orden('cambio-resolucion', 'macmini-starbucks-horizontal'), { ok: false, error: 'pantalla_no_lab' });
});

test('lo que el player mide de su superficie, con tipos estrictos', () => {
  assert.deepEqual(lecturaSuperficie(senal(NORMAL)), { canvas: { w: 1600, h: 900 }, lienzo: 'horizontal', overlay: 0, visible: 100, fit: 'fill' });
  assert.deepEqual(lecturaSuperficie(senal({ canvas: { w: 506, h: 900 } })).lienzo, 'vertical');
  const raro = lecturaSuperficie(senal({ canvas: '1600x900', overlay: 140, visible: '50', fit: 'loquesea' }));
  assert.deepEqual(raro, { canvas: null, lienzo: null, overlay: null, visible: null, fit: null });
  assert.deepEqual(lecturaSuperficie(null), { canvas: null, lienzo: null, overlay: null, visible: null, fit: null });
});

test('observación por tipo: qué espera el plano y qué ve el detector', () => {
  const o = (tipo, d, opt) => observacion(tipo, senal(d), P, { ahora: T0, ...opt });
  assert.deepEqual([o('cambio-resolucion', NORMAL).esperada, o('cambio-resolucion', NORMAL).pintada], ['horizontal', 'horizontal']);
  assert.equal(o('cambio-resolucion', { ...NORMAL, canvas: { w: 506, h: 900 } }).pintada, 'vertical');
  assert.equal(o('cambio-resolucion', { ...NORMAL, canvas: { w: 506, h: 900 }, fit: 'editorial' }).pintada, null, 'en editorial el marco sigue a la pieza: no se juzga');
  assert.equal(o('popup-encima', NORMAL).pintada, 'despejada');
  assert.equal(o('popup-encima', { ...NORMAL, overlay: UMBRAL_TAPADO - 1 }).pintada, 'despejada');
  assert.equal(o('popup-encima', { ...NORMAL, overlay: 26 }).pintada, 'tapada');
  assert.equal(o('medio-abrir', NORMAL).pintada, 'entera');
  assert.equal(o('medio-abrir', { ...NORMAL, visible: UMBRAL_VISIBLE }).pintada, 'entera');
  assert.equal(o('medio-abrir', { ...NORMAL, visible: 50 }).pintada, 'a-medias');
  // Los detectores son independientes: cada fallo sólo mueve el suyo.
  const popup = { ...NORMAL, overlay: 26 };
  assert.equal(o('medio-abrir', popup).pintada, 'entera'); assert.equal(o('cambio-resolucion', popup).pintada, 'horizontal'); assert.equal(o('formato-girado', popup).pintada, 'horizontal');
  // Sin señal fresca o sin la medida, nada.
  assert.equal(observacion('popup-encima', senal({ ...NORMAL, overlay: 50 }, { lastSeen: T0 - 400000 }), P, { ahora: T0 }).pintada, null);
  assert.equal(o('popup-encima', { overlay: undefined }).pintada, null, 'un canal anterior no declara overlay');
  // Formato girado: igual que antes.
  assert.equal(o('formato-girado', { painted: 'vertical', paintedRotation: 90 }).pintada, 'vertical');
});

test('una incidencia por fallo de superficie: abre tras la gracia y cierra al volver a la normalidad', () => {
  for (const [tipo, roto] of [['popup-encima', { overlay: 26 }], ['medio-abrir', { visible: 50 }], ['cambio-resolucion', { canvas: { w: 506, h: 900 } }]]) {
    const paso = (prev, d, t) => vueltaDetector(prev, { plan: BANCO, pantalla: P, tipo, senal: senal(d, { lastSeen: t }), ahora: t, graciaMs: GRACIA_BANCO_MS, by: 'test' });
    let v = paso(null, NORMAL, T0);
    assert.equal(v.estado.fase, 'casa', tipo);
    v = paso(v.estado, { ...NORMAL, ...roto }, T0 + 1000);
    assert.equal(v.estado.fase, 'sospecha', tipo); assert.equal(v.body, null);
    v = paso(v.estado, { ...NORMAL, ...roto }, T0 + 1000 + GRACIA_BANCO_MS);
    assert.equal(v.estado.accion, 'abrir', tipo);
    assert.equal(v.body.resource, `demo:banco-bugito:player-virtual-bugito:${tipo}`);
    assert.equal(v.body.kind, 'screen'); assert.equal(v.body.project_id, 'gran-de-gracia'); assert.equal(v.body.loc, 'banco-bugito');
    assert.match(v.body.subject, new RegExp(`^player-virtual-bugito · ${tipoIncidencia(tipo).es}: Player virtual de Bugito `));
    assert.match(v.body.detail, /fault-(popup|half|canvas)/); assert.match(v.body.detail, /Bugito/);
    let e = anotar({ ...v.estado, accion: null }, 'abrir', { ok: true, id: 'INC-BUG42' });
    v = paso(e, { ...NORMAL, ...roto }, T0 + 3 * GRACIA_BANCO_MS);
    assert.equal(v.estado.accion, null, 'abierta: no se repite');
    v = paso(v.estado, NORMAL, T0 + 4 * GRACIA_BANCO_MS);
    assert.equal(v.estado.fase, 'recuperando');
    v = paso(v.estado, NORMAL, T0 + 5 * GRACIA_BANCO_MS);
    assert.equal(v.estado.accion, 'resolver', tipo);
    assert.deepEqual(Object.keys(v.body).sort(), ['by', 'close', 'id', 'note', 'resource']);
    assert.match(v.body.note, /Vuelve a la normalidad/);
  }
});

test('textos de la incidencia y de la medida en vivo, por tipo', () => {
  const obs = (tipo, d) => observacion(tipo, senal(d), P, { ahora: T0 });
  const a = apertura({ plan: BANCO, pantalla: P, tipo: 'popup-encima', esperada: 'despejada', observado: obs('popup-encima', { ...NORMAL, overlay: 26 }), ahora: T0, desde: T0 - 12000 });
  assert.match(a.subject, /una capa ajena tapa el 26 % de la emisión$/);
  assert.match(a.detail, /desde hace 12 s/);
  assert.equal(a.severity, 'media', 'un popup tapa, no apaga');
  const m = apertura({ plan: BANCO, pantalla: P, tipo: 'medio-abrir', observado: obs('medio-abrir', { ...NORMAL, visible: 50 }), ahora: T0 });
  assert.match(m.subject, /sólo el 50 % del lienzo muestra contenido$/);
  const c = apertura({ plan: BANCO, pantalla: P, tipo: 'cambio-resolucion', observado: obs('cambio-resolucion', { ...NORMAL, canvas: { w: 506, h: 900 } }), ahora: T0 });
  assert.match(c.subject, /emite en un lienzo vertical de 506×900 px y la pantalla es horizontal$/);
  assert.ok([a, m, c].every((b) => b.subject.length <= 200 && b.detail.length <= 2000));
  assert.equal(medidaTexto('popup-encima', obs('popup-encima', { ...NORMAL, overlay: 26 }), 'es'), '26 % de la emisión tapado (popup desde el 10 %)');
  assert.equal(medidaTexto('medio-abrir', obs('medio-abrir', { ...NORMAL, visible: 50 }), 'en'), '50 % of the canvas shows content (half open below 90 %)');
  assert.equal(medidaTexto('cambio-resolucion', obs('cambio-resolucion', NORMAL), 'es'), 'Pantalla horizontal · lienzo 1600×900 (horizontal)');
  assert.equal(medidaTexto('popup-encima', obs('popup-encima', { overlay: undefined }), 'es'), '');
  // Formato girado no cambia de textos.
  assert.match(apertura({ plan: BANCO, pantalla: P, tipo: 'formato-girado', lectura: { pintada: 'vertical', giro: 90 }, esperada: 'horizontal', ahora: T0 }).subject, /pinta en vertical y debe ir en horizontal$/);
  assert.match(cierre({ plan: BANCO, pantalla: P, tipo: 'formato-girado' }).note, /Vuelve a casar/);
});

test('el banco: el player virtual de laboratorio, horizontal, y nada más', () => {
  assert.equal(BUGITO_SCREEN, 'virtual-lab-bugito');
  assert.equal(bancoEsLab(), true);
  assert.deepEqual({ screen: P.screen, esperada: P.esperada, lab: P.lab, id: P.id }, { screen: 'virtual-lab-bugito', esperada: 'horizontal', lab: true, id: 'player-virtual-bugito' });
  assert.equal(recurso(BANCO, P, 'popup-encima'), 'demo:banco-bugito:player-virtual-bugito:popup-encima', 'carril público demo:, nunca itil:');
  assert.deepEqual(INCIDENCIAS, CATALOGO.map((t) => t.id));
  assert.equal(GRACIA_BANCO_MS < GRACIA_MS, true);
});

test('alias de las órdenes (verbo /bugito, chips de Bugito, ?incidencia=)', () => {
  for (const [t, id] of [['girar', 'formato-girado'], ['Gira la pantalla', 'formato-girado'], ['rotate', 'formato-girado'], ['resolución', 'cambio-resolucion'],
    ['Cambia la resolución', 'cambio-resolucion'], ['popup', 'popup-encima'], ['Lanza un popup', 'popup-encima'], ['pop-up', 'popup-encima'], ['medias', 'medio-abrir'],
    ['Ábrela a medias', 'medio-abrir'], ['half', 'medio-abrir'], ['normal', 'normal'], ['Vuelve a la normalidad', 'normal'], ['clear', 'normal'],
    ['popup-encima', 'popup-encima'], ['medio-abrir', 'medio-abrir'], ['cambio-resolucion', 'cambio-resolucion'], ['formato-girado', 'formato-girado']]) {
    assert.equal(resolverIncidencia(t), id, t);
  }
  for (const no of ['', null, 'borrar todo', 'apagar', 'pantalla-negra']) assert.equal(resolverIncidencia(no), null, String(no));
});

test('URL del player virtual y de la cara de Bugito; las copias locales sólo valen en localhost', () => {
  const pu = new URL(playerUrl());
  assert.equal(pu.origin + pu.pathname, 'https://admira.tv/canal.html');
  assert.deepEqual(Object.fromEntries(pu.searchParams), { screen: 'virtual-lab-bugito', playerType: 'virtual', clean: '1', muted: '1', fit: 'screen', name: 'Player virtual de Bugito' });
  const cu = new URL(caraUrl({ lang: 'en' }));
  assert.equal(cu.origin + cu.pathname, 'https://digitalavatar.ai/nube.html', 'la nube de Admirito: no hay página aparte');
  assert.deepEqual(Object.fromEntries(cu.searchParams), { dock: '1', personaje: 'bugito', lang: 'en', audio: 'off' });
  assert.equal(baseLocal('http://127.0.0.1:8853/canal.html', 'http://127.0.0.1:8852'), 'http://127.0.0.1:8853/canal.html');
  assert.equal(baseLocal('http://127.0.0.1:8853/canal.html', 'https://www.admira.biz'), '', 'en producción se ignora');
  assert.equal(baseLocal('https://evil.example/canal.html', 'http://127.0.0.1:8852'), '');
  assert.equal(baseLocal('javascript:alert(1)', 'http://localhost:8852'), '');
});

test('Bugito: de aburrido a celebrando y derrotado, según la prueba', () => {
  const env = { ok: true, en: T0 }, ack = (status) => ({ seen: true, ack: { status } });
  assert.equal(estadoBugito({}), 'aburrido');
  assert.equal(estadoBugito({ envio: { ok: false, error: 'screen_not_lab' } }), 'rechazado');
  assert.equal(estadoBugito({ envio: env }), 'lanzando');
  assert.equal(estadoBugito({ envio: env, acuse: ack('failed') }), 'rechazado');
  assert.equal(estadoBugito({ envio: env, acuse: ack('executed') }), 'tramando');
  assert.equal(estadoBugito({ envio: env, acuse: ack('executed'), detector: { fase: 'fallo' } }), 'tramando');
  assert.equal(estadoBugito({ envio: env, acuse: ack('executed'), detector: { fase: 'fallo', incidencia: 'INC-BUG42' } }), 'celebrando');
  assert.equal(estadoBugito({ envio: env, acuse: ack('executed'), detector: { fase: 'casa', incidencia: null, ultima: 'INC-BUG42' } }), 'derrotado');
  assert.equal(estadoBugito({ envio: env, incidencia: { id: 'INC-BUG42', stage: 'cerrada' } }), 'derrotado');
  assert.deepEqual(pasos({ envio: env }).map((p) => p.id), ['enviada', 'acuse', 'detectada', 'abierta', 'resuelta']);
});

test('mensajes con la cara: tipos cerrados y origen exacto', () => {
  assert.deepEqual(mensajeBugito('celebrando', { incidencia: 'popup-encima', ticket: 'INC-BUG42', lang: 'es' }),
    { type: 'da-bugito', estado: 'celebrando', lang: 'es', incidencia: 'popup-encima', ticket: 'INC-BUG42' });
  assert.deepEqual(mensajeBugito('hackeado', { incidencia: '<x>', ticket: '<img>', lang: 'fr' }), { type: 'da-bugito', estado: 'aburrido', lang: 'es' });
  assert.equal(mensajeBugito('lanzando', { incidencia: 'normal' }).incidencia, 'normal');
  assert.equal(mensajeBugito('aburrido', { silencio: true }).silencio, true);
  const cara = {};
  assert.equal(esDeBugito({ source: cara, origin: BUGITO_ORIGIN, data: { type: 'da-bugito-lanzar' } }, cara), true);
  assert.equal(esDeBugito({ source: {}, origin: BUGITO_ORIGIN, data: {} }, cara), false, 'otra ventana');
  assert.equal(esDeBugito({ source: cara, origin: 'https://evil.example', data: {} }, cara), false, 'otro origen');
  assert.equal(esDeBugito({ source: cara, origin: BUGITO_ORIGIN, data: 'x' }, cara), false);
});

test('el agente de consola vigila también los fallos de superficie (popup) de una pantalla de laboratorio', async () => {
  // Un plano de laboratorio con el player virtual (el banco mismo), red de mentira.
  let display = NORMAL, ahora = T0;
  const posts = [];
  const fetcher = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/signage/now')) return new Response(JSON.stringify(senal(display, { lastSeen: ahora - 1000 })), { status: 200 });
    if (u.includes('/incident')) { const b = JSON.parse(init.body); posts.push(b); return new Response(JSON.stringify(b.close ? { ok: true, id: 'INC-BUG42', applied: true, stage: 'cerrada' } : { ok: true, id: 'INC-BUG42' }), { status: 200 }); }
    return new Response('{}', { status: 404 });
  };
  let estados = {};
  const paso = async (seg) => { ahora += seg * 1000; estados = (await pasada({ plan: BANCO, estados, fetcher, ahora, graciaMs: GRACIA_BANCO_MS, by: 'Agente · test' })).estados; };
  await paso(0);
  display = { ...NORMAL, overlay: 26 };
  await paso(5); await paso(5); assert.equal(posts.length, 0);
  await paso(6);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].resource, 'demo:banco-bugito:player-virtual-bugito:popup-encima');
  assert.equal(estados['virtual-lab-bugito:popup-encima'].incidencia, 'INC-BUG42');
  assert.equal(estados['virtual-lab-bugito:medio-abrir'].fase, 'casa', 'los otros detectores siguen en orden');
  display = NORMAL;
  await paso(5); await paso(6); await paso(6);
  assert.equal(posts.length, 2); assert.equal(posts[1].close, true);
});

test('la página del banco y el botón «Probar con Bugito» del ▤ Creador de incidencias', () => {
  const html = readFileSync(new URL('../bugito.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../bugito.mjs', import.meta.url), 'utf8');
  const plano = readFileSync(new URL('../plano.html', import.meta.url), 'utf8');
  const inc = readFileSync(new URL('../plano-incidencias.mjs', import.meta.url), 'utf8');
  assert.match(html, /<script defer src="\/galaxy-shell\.js/, 'el shell cuadrático como el plano');
  assert.match(html, /<script type="module" src="bugito\.mjs\?v=20261014-bugito-1"><\/script>/);
  assert.ok(html.indexOf('id="bb-player-frame"') < html.indexOf('id="bb-cara-frame"'), 'player a la izquierda, Bugito a la derecha');
  for (const k of [...html.matchAll(/data-bb="([a-zA-Z]+)"/g)].map((m) => m[1])) assert.ok(new RegExp(`\\b${k}:`).test(ui), `falta el texto ${k}`);
  assert.match(ui, /en: \{/);
  assert.match(ui, /window\.AdmiraBugito = \{/, 'el verbo /bugito del ⌘ Experto llega a la página');
  assert.match(ui, /esDeBugito\(ev, \$\('bb-cara-frame'\)\.contentWindow, caraOrigen\)/, 'sólo la cara que incrusta la página puede pedir fallos');
  assert.match(plano, /<a id="inc-bugito" class="header-circuit-btn inc-bugito" href="bugito\.html" data-inc="bugito">Probar con Bugito<\/a>/);
  assert.match(inc, /bugito: 'Probar con Bugito'/); assert.match(inc, /bugito: 'Try it with Bugito'/);
  for (const f of ['bugito.html', 'bugito.mjs', 'bugito.css', 'bugito-core.mjs']) assert.ok(BIZ_ASSET_FILES.includes(f), f);
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/bugito')), '/__admira_biz/bugito');
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/bugito.html')), '/__admira_biz/bugito');
});
