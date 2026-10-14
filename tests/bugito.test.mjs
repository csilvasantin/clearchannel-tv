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
  estadoBugito, mensajeBugito, esDeBugito, bancoEsLab, debePausar, INACTIVO_MS
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
  assert.deepEqual(Object.fromEntries(pu.searchParams), { screen: 'virtual-lab-bugito', playerType: 'virtual', clean: '1', muted: '1', fit: 'screen',
    medio: 'image', max: '3', img: '40', name: 'Player virtual de Bugito' }, 'playlist corta y lenta: sólo imágenes, 3 piezas de 40 s');
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
  assert.match(html, /<script type="module" src="bugito\.mjs\?v=20261014-bugito-3"><\/script>/);
  assert.ok(html.indexOf('id="bb-player-frame"') < html.indexOf('id="bb-cara-frame"'), 'player a la izquierda, Bugito a la derecha');
  for (const k of [...html.matchAll(/data-bb="([a-zA-Z]+)"/g)].map((m) => m[1])) assert.ok(new RegExp(`\\b${k}:`).test(ui), `falta el texto ${k}`);
  assert.match(ui, /en: \{/);
  assert.match(ui, /window\.AdmiraBugito = \{/, 'el verbo /bugito del ⌘ Experto llega a la página');
  assert.match(ui, /esDeBugito\(ev, \$\('bb-cara-frame'\)\.contentWindow, caraOrigen\)/, 'sólo la cara que incrusta la página puede pedir fallos');
  assert.match(plano, /<a id="inc-bugito" class="header-circuit-btn inc-bugito" href="bugito\.html" data-inc="bugito">Probar con Bugito<\/a>/);
  assert.match(inc, /bugito: 'Probar con Bugito'/); assert.match(inc, /bugito: 'Try it with Bugito'/);
  for (const f of ['bugito.html', 'bugito.mjs', 'bugito.css', 'bugito-core.mjs', 'bugito-objetivos.json', 'bugito-super.js']) assert.ok(BIZ_ASSET_FILES.includes(f), f);
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/bugito')), '/__admira_biz/bugito');
  assert.equal(bizAssetPath(new URL('https://www.admira.biz/bugito.html')), '/__admira_biz/bugito');
});

test('revisión: con credencial y --todas, las pantallas de clientes tampoco abren incidencias ITIL de ningún tipo', async () => {
  const starbucks = JSON.parse(readFileSync(new URL('../data/xpacios/alsea-sbux-021.json', import.meta.url), 'utf8'));
  const llamadas = [];
  const fetcher = async (url) => {
    llamadas.push(String(url));
    if (String(url).includes('/signage/now')) return new Response(JSON.stringify(senal({ width: 2560, height: 1440, painted: 'vertical', canvas: { w: 600, h: 1440 }, overlay: 40, visible: 40, fit: 'fill' })), { status: 200 });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { structuredContent: { id: 'INC-ITIL9' } } }), { status: 200 });
  };
  const credencial = { token: 'ykm_x', scopes: ['incidents', 'incidents:write'], endpoint: 'https://yokup.com/mcp' };
  let estados = {}, hechos = [];
  for (let i = 0; i <= 4; i++) { const r = await pasada({ plan: starbucks, estados, fetcher, ahora: T0 + i * GRACIA_MS, todas: true, credencial }); estados = r.estados; hechos.push(...r.hechos); }
  assert.ok(hechos.some((h) => h.accion === 'abrir'), 'detecta');
  assert.ok(hechos.filter((h) => h.accion).every((h) => h.omitida === 'seco'), 'pero todo en seco');
  assert.equal(llamadas.filter((u) => /yokup/.test(u)).length, 0, 'ni MCP ni carril público');
  // Aunque alguien llame a pasada con todas:false y seco:false sobre un plano de clientes: no vigila nada.
  const nada = await pasada({ plan: starbucks, fetcher, ahora: T0, credencial });
  assert.deepEqual(nada.hechos, []);
});

test('revisión: el player del banco es real; se pausa con la pestaña oculta y tras 5 min sin actividad', () => {
  assert.equal(INACTIVO_MS, 5 * 60000);
  assert.equal(debePausar({ oculta: true, ultimoGesto: T0, ahora: T0 }), 'oculta');
  assert.equal(debePausar({ ultimoGesto: T0, ahora: T0 + INACTIVO_MS - 1 }), '');
  assert.equal(debePausar({ ultimoGesto: T0, ahora: T0 + INACTIVO_MS }), 'inactivo');
  const ui = readFileSync(new URL('../bugito.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../bugito.html', import.meta.url), 'utf8');
  assert.match(ui, /\$\('bb-player-frame'\)\.src = 'about:blank';/, 'pausar = descargar el iframe');
  assert.match(ui, /if \(document\.hidden\) \{ pausarPlayer\('oculta'\); return; \}/);
  assert.match(ui, /setInterval\(vigilarPausa, 15000\)/);
  assert.match(ui, /if \(!P \|\| document\.hidden \|\| pausado\) return;/, 'pausado, el detector no sondea');
  assert.match(ui, /gesto\(\); if \(pausado\) reanudarPlayer\(\);/, 'lanzar una incidencia lo reanuda');
  assert.match(html, /<button type="button" id="bb-reanudar" data-bb="resume">Reanudar<\/button>/);
});

// ── Objetivo acotado: proyecto · circuito · dispositivo (Carlos 14-oct-2026, Opción A) ───────
import { OBJETIVO_BANCO, labScreenPara, bancoPara, pantallaDe } from '../bugito-core.mjs';
import { VIRTUAL_LAB_RE } from '../incidencias-core.mjs';

test('el objetivo deriva SIEMPRE un player de laboratorio válido (virtual-lab-*), nunca uno de cliente', () => {
  const casos = [
    { circuito: 'alsea_starbucks', dispositivo: 'Menu board digital' },
    { circuito: 'alsea_mexico', dispositivo: 'Pantalla recogida' },
    { circuito: 'un-circuito-con-un-nombre-larguisimo-de-verdad-y-mas', dispositivo: 'y-un-dispositivo-aun-mas-largo-todavia-xxxx' },
    { circuito: '', dispositivo: '' },
  ];
  for (const c of casos) {
    const s = labScreenPara(c);
    assert.match(s, VIRTUAL_LAB_RE, `${s} debe ser virtual-lab-*`);
    assert.ok(s.length <= 48, `${s} cabe en 48`);
  }
  assert.equal(labScreenPara({}), 'virtual-lab-bugito', 'sin objetivo → el banco');
  assert.equal(labScreenPara({ circuito: 'alsea_starbucks', dispositivo: 'Escaparate' }), 'virtual-lab-alsea-starbucks-escaparate');
});

test('bancoPara/pantallaDe: el plano del objetivo usa la pantalla de laboratorio derivada y el proyecto elegido', () => {
  const obj = { proyecto: 'starbucks', proyectoLabel: 'Starbucks', circuito: 'alsea_starbucks', dispositivo: 'Escaparate',
    screen: labScreenPara({ circuito: 'alsea_starbucks', dispositivo: 'Escaparate' }) };
  const plan = bancoPara(obj);
  assert.equal(plan.id, BANCO.id, 'el id del banco no cambia (claves estables)');
  assert.equal(plan.yokup.project_id, 'starbucks');
  assert.equal(plan.pantallas[0].screenId, 'virtual-lab-alsea-starbucks-escaparate');
  const p = pantallaDe(obj);
  assert.ok(p && p.lab, 'la pantalla del objetivo sigue siendo de laboratorio');
  assert.equal(p.screen, 'virtual-lab-alsea-starbucks-escaparate');
  // El banco por defecto no cambia de comportamiento.
  assert.equal(pantallaDe(OBJETIVO_BANCO).screen, BUGITO_SCREEN);
});

test('catálogo de objetivos: proyectos con circuito y dispositivos, servido en admira.biz', () => {
  const cat = JSON.parse(readFileSync(new URL('../bugito-objetivos.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(cat.proyectos) && cat.proyectos.length >= 10, 'hay proyectos');
  for (const p of cat.proyectos) {
    assert.ok(p.id && p.label && p.circuit, `proyecto completo: ${JSON.stringify(p)}`);
    assert.ok(Array.isArray(p.dispositivos) && p.dispositivos.length, `${p.id} tiene dispositivos`);
    // Cada dispositivo deriva un player de laboratorio válido.
    for (const d of p.dispositivos) assert.match(labScreenPara({ circuito: p.circuit, dispositivo: d }), VIRTUAL_LAB_RE);
  }
  const sbux = cat.proyectos.find((p) => p.id === 'starbucks');
  assert.equal(sbux.circuit, 'alsea_starbucks');
  assert.ok(BIZ_ASSET_FILES.includes('bugito-objetivos.json'), 'el catálogo se publica');
});

test('la página trae el selector de objetivo y la UI lo cablea sin tocar la salvaguarda', () => {
  const html = readFileSync(new URL('../bugito.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../bugito.mjs', import.meta.url), 'utf8');
  for (const id of ['bb-sel-proyecto', 'bb-sel-dispositivo', 'bb-objetivo-breadcrumb']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(ui, /labScreenPara\(/, 'la UI deriva el player de laboratorio del objetivo');
  assert.match(ui, /bugito-objetivos\.json/, 'la UI lee el catálogo');
  // El mando sigue construyendo la orden contra objetivo.screen (lab), no una pantalla de cliente.
  assert.match(ui, /orden\(normal \? CATALOGO\[0\]\.id : id, objetivo\.screen/);
  assert.doesNotMatch(ui, /orden\([^)]*(sel-dispositivo|real)/i);
});

// ── Opción B · modo superusuario (dispositivo real, login de owner) ──────────────────────────
import { MANDO_ARM, MANDO_CMD_REAL, SIGNAGE_SCREENS, esPantallaReal, objetivoReal } from '../bugito-core.mjs';

test('core B: endpoints, pantalla real vs laboratorio y objetivoReal', () => {
  assert.equal(MANDO_ARM, 'https://api.admira.store/locations/cmd/fault-arm');
  assert.equal(MANDO_CMD_REAL, 'https://api.admira.store/locations/cmd');
  assert.equal(SIGNAGE_SCREENS, 'https://api.admira.store/signage/screens');
  assert.equal(esPantallaReal('alsea-sbux-001-menu'), true);
  assert.equal(esPantallaReal('virtual-lab-bugito'), false, 'un player de laboratorio no es «real»');
  assert.equal(esPantallaReal(''), false);
  const o = objetivoReal('alsea-sbux-001-menu', 'Starbucks A Coruña', 'alsea_starbucks');
  assert.deepEqual(o, { proyecto: '', proyectoLabel: '', circuito: 'alsea_starbucks', dispositivo: 'Starbucks A Coruña', screen: 'alsea-sbux-001-menu', real: true });
});

test('la UI del dispositivo real usa LOGIN DE OWNER (Google), nunca un token pegado', () => {
  const html = readFileSync(new URL('../bugito.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../bugito.mjs', import.meta.url), 'utf8');
  const sup = readFileSync(new URL('../bugito-super.js', import.meta.url), 'utf8');
  // La página carga Google Identity Services y el módulo de login; y tiene la sección de superusuario.
  assert.match(html, /accounts\.google\.com\/gsi\/client/);
  assert.match(html, /bugito-super\.js\?v=/);
  for (const id of ['bb-super', 'bb-super-signin', 'bb-super-real', 'bb-super-banner', 'bb-real-overlay']) assert.ok(html.includes(`id="${id}"`), id);
  // El token sale del login de Google (window.BugitoSuper), no de un campo de texto pegado.
  assert.match(ui, /superApi\(\)/);
  assert.match(ui, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(ui, /superToken/, 'no hay token maestro pegado en memoria');
  assert.doesNotMatch(html, /type="password"/, 'no se pide pegar ningún token');
  // El módulo de login usa el ID token de Google del propio usuario, en sessionStorage.
  assert.match(sup, /google\.accounts\.id\.initialize/);
  assert.match(sup, /sessionStorage/);
  assert.doesNotMatch(sup, /localStorage/, 'el token de sesión no se persiste en localStorage');
  assert.ok(BIZ_ASSET_FILES.includes('bugito-super.js'), 'el login se publica en admira.biz');
  // El lanzamiento real arma el nonce y envía con confirm; el laboratorio sigue sin pedir nada.
  assert.match(ui, /MANDO_ARM/); assert.match(ui, /confirm: nonce/);
  assert.match(ui, /if \(objetivoRealActivo\) return lanzarReal\(id\)/);
});
