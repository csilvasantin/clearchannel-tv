// ▤ Creador de incidencias (DCL-34d5bbccb9cc227bb752a419): detector, salvaguarda de pantallas,
// construcción de órdenes y de incidencias, adaptadores y agente, sin red real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATALOGO, PANTALLAS_LAB, GRACIA_MS, REINTENTO_MS, pantallaLab, tipoIncidencia, orientacionEsperada, pantallasDelPlano, orden,
  pintadaPorGiro, lecturaSenal, evaluar, anotar, recurso, apertura, cierre, fichaYokup, incidenciaDe, pasos
} from '../incidencias-core.mjs';
import { mando, yokupPublico, yokupMcp, carril } from '../incidencias-adaptadores.mjs';
import { pasada } from '../tools/agente-incidencias.mjs';
import { BIZ_ASSET_FILES } from '../server/biz-assets.mjs';
import { validate } from '../plano-core.mjs';

const lab = JSON.parse(readFileSync(new URL('../data/xpacios/lab-gran-de-gracia-51.json', import.meta.url), 'utf8'));
const starbucks = JSON.parse(readFileSync(new URL('../data/xpacios/alsea-sbux-021.json', import.meta.url), 'utf8'));
const MBP16 = () => pantallasDelPlano(lab).find(p => p.itil === 'GDG51-PAN-07');
const T0 = 1_791_970_000_000;
const senal = (display, { lastSeen = T0, standby = false } = {}) => ({ ok: true, screen: 'macbookpro16', lastSeen, standby, device: { display } });
const PANEL = { width: 3456, height: 2234 };

test('el plano del laboratorio liga el CI del MBP16 a su player y sólo él es de laboratorio', () => {
  const m = MBP16();
  assert.deepEqual({ screen: m.screen, esperada: m.esperada, lab: m.lab, itil: m.itil }, { screen: 'macbookpro16', esperada: 'horizontal', lab: true, itil: 'GDG51-PAN-07' });
  const otras = pantallasDelPlano(lab).filter(p => p.itil !== 'GDG51-PAN-07');
  assert.ok(otras.length >= 6);
  assert.ok(otras.every(p => !p.lab), 'las pantallas de los Mac Studio y Mac mini no son de laboratorio');
  assert.equal(lab.yokup.project_id, 'gran-de-gracia');
  assert.deepEqual(validate(lab), [], 'el plano sigue siendo válido');
  assert.equal(pantallasDelPlano(starbucks).filter(p => p.lab).length, 0, 'ninguna pantalla de un cliente');
});

test('la salvaguarda: MBP16 y players virtuales; nada más', () => {
  assert.deepEqual([...PANTALLAS_LAB], ['macbookpro16'], 'misma lista que omnipublicity-api src/fault-lab.js');
  assert.equal(pantallaLab('virtual-lab-gdg51'), true);
  for (const s of ['macmini-starbucks-horizontal', 'macstudio-starbucks-vertical', 'iphone17-mupi', 'virtual-x', '', null]) assert.equal(pantallaLab(s), false, String(s));
});

test('la orden que provoca y la que deshace, siempre dirigida a la propia pantalla', () => {
  assert.equal(CATALOGO[0].id, 'formato-girado');
  assert.deepEqual(orden('formato-girado', 'macbookpro16'), { ok: true, body: { id: 'macbookpro16', screen: 'macbookpro16', cmd: 'fault-rotate' } });
  assert.deepEqual(orden('formato-girado', 'macbookpro16', { vuelta: true }).body.cmd, 'fault-clear');
  assert.deepEqual(orden('formato-girado', 'macmini-starbucks-horizontal'), { ok: false, error: 'pantalla_no_lab' });
  assert.deepEqual(orden('pantalla-negra', 'macbookpro16'), { ok: false, error: 'tipo_desconocido' });
  assert.equal(tipoIncidencia('formato-girado').vuelta, 'fault-clear');
});

test('orientación esperada: la del plano o, si falta, la de la resolución', () => {
  assert.equal(orientacionEsperada({ orientacion: 'vertical', resolucion: [3840, 2160] }), 'vertical');
  assert.equal(orientacionEsperada({ resolucion: [1080, 1920] }), 'vertical');
  assert.equal(orientacionEsperada({ aspecto: [16, 9] }), 'horizontal');
  assert.equal(orientacionEsperada({}), null);
});

test('lo que el player declara que pinta, con la medida por delante', () => {
  const ahora = T0 + 1000;
  assert.equal(lecturaSenal(null).estado, 'sin-senal');
  assert.equal(lecturaSenal({ ok: true, lastSeen: null }).motivo, 'no-declara');
  assert.equal(lecturaSenal(senal({ ...PANEL, painted: 'vertical' }, { lastSeen: T0 - 400000 }), { ahora }).motivo, 'latido-viejo');
  assert.equal(lecturaSenal(senal({ ...PANEL, painted: 'vertical' }, { standby: true }), { ahora }).motivo, 'standby');
  assert.deepEqual(lecturaSenal(senal({ ...PANEL, painted: 'vertical', paintedRotation: 90, rotation: 0 }), { ahora }),
    { estado: 'ok', pintada: 'vertical', giro: 90, fuente: 'medida', visto: T0 });
  assert.equal(lecturaSenal(senal({ ...PANEL, paintedRotation: 270 }), { ahora }).pintada, 'vertical');
  const viejo = lecturaSenal(senal({ ...PANEL, rotation: 0 }), { ahora });
  assert.equal(viejo.pintada, 'horizontal'); assert.equal(viejo.fuente, 'giro-operador');
  assert.equal(lecturaSenal(senal({ ...PANEL }), { ahora }).estado, 'sin-dato', 'sin medida ni giro no se adivina');
  assert.equal(pintadaPorGiro(90, 1080, 1920), 'horizontal');
  assert.equal(pintadaPorGiro(45, 1920, 1080), null);
});

test('el detector: una incidencia por fallo, con gracia al abrir y al cerrar', () => {
  const g = GRACIA_MS, esperada = 'horizontal';
  let e = evaluar(null, { esperada, pintada: 'horizontal' }, { ahora: T0 });
  assert.equal(e.fase, 'casa'); assert.equal(e.accion, null);
  e = evaluar(e, { esperada, pintada: 'vertical' }, { ahora: T0 + 1000 });
  assert.equal(e.fase, 'sospecha'); assert.equal(e.accion, null);
  e = evaluar(e, { esperada, pintada: 'vertical' }, { ahora: T0 + 1000 + g - 1 });
  assert.equal(e.accion, null, 'antes de la gracia no abre');
  e = evaluar(e, { esperada, pintada: 'vertical' }, { ahora: T0 + 1000 + g });
  assert.equal(e.fase, 'fallo'); assert.equal(e.accion, 'abrir');
  e = anotar({ ...e, accion: null }, 'abrir', { ok: true, id: 'INC-ABC12', url: fichaYokup('INC-ABC12') });
  assert.equal(e.incidencia, 'INC-ABC12');
  for (let i = 1; i <= 10; i++) assert.equal(evaluar(e, { esperada, pintada: 'vertical' }, { ahora: T0 + g + i * REINTENTO_MS }).accion, null, 'abierta: no se repite');
  // Sin señal no se mueve ni cierra a ciegas.
  const ciego = evaluar(e, { esperada, pintada: null }, { ahora: T0 + 10 * g });
  assert.equal(ciego.fase, 'fallo'); assert.equal(ciego.accion, null); assert.equal(ciego.sinDato, true);
  // Vuelve a casar, recae, vuelve a casar: sigue siendo la misma incidencia.
  e = evaluar(e, { esperada, pintada: 'horizontal' }, { ahora: T0 + 3 * g });
  assert.equal(e.fase, 'recuperando');
  e = evaluar(e, { esperada, pintada: 'vertical' }, { ahora: T0 + 3 * g + 1000 });
  assert.equal(e.fase, 'fallo'); assert.equal(e.accion, null);
  e = evaluar(e, { esperada, pintada: 'horizontal' }, { ahora: T0 + 4 * g });
  e = evaluar(e, { esperada, pintada: 'horizontal' }, { ahora: T0 + 5 * g });
  assert.equal(e.fase, 'casa'); assert.equal(e.accion, 'resolver');
  e = anotar({ ...e, accion: null }, 'resolver', { ok: true, id: 'INC-ABC12' });
  assert.equal(e.incidencia, null); assert.equal(e.ultima, 'INC-ABC12');
  assert.equal(evaluar(e, { esperada, pintada: 'horizontal' }, { ahora: T0 + 9 * g }).accion, null);
});

test('si Yokup falla, se reintenta una vez por minuto, al abrir y al cerrar', () => {
  let e = { fase: 'sospecha', desde: T0, incidencia: null, intento: 0 };
  e = evaluar(e, { esperada: 'horizontal', pintada: 'vertical' }, { ahora: T0 + GRACIA_MS });
  e = anotar({ ...e, accion: null }, 'abrir', { ok: false, error: 'HTTP 503' });
  assert.equal(e.error, 'HTTP 503');
  assert.equal(evaluar(e, { esperada: 'horizontal', pintada: 'vertical' }, { ahora: T0 + GRACIA_MS + 1000 }).accion, null);
  assert.equal(evaluar(e, { esperada: 'horizontal', pintada: 'vertical' }, { ahora: T0 + GRACIA_MS + REINTENTO_MS }).accion, 'abrir');
  const cerrando = { fase: 'casa', desde: T0, incidencia: 'INC-ABC12', intento: T0 };
  assert.equal(evaluar(cerrando, { esperada: 'horizontal', pintada: 'horizontal' }, { ahora: T0 + REINTENTO_MS }).accion, 'resolver');
});

test('la incidencia: recurso por Xpacio, CI y tipo; proyecto del plano; carril demo: sólo en laboratorio', () => {
  const m = MBP16();
  assert.equal(recurso(lab, m, 'formato-girado'), 'demo:lab-gran-de-gracia-51:GDG51-PAN-07:formato-girado');
  assert.equal(recurso(lab, { ...m, lab: false }, 'formato-girado'), 'itil:lab-gran-de-gracia-51:GDG51-PAN-07:formato-girado');
  const lectura = lecturaSenal(senal({ ...PANEL, painted: 'vertical', paintedRotation: 90 }), { ahora: T0 });
  const body = apertura({ plan: lab, pantalla: m, tipo: 'formato-girado', lectura, esperada: 'horizontal', desde: T0 - 31000, ahora: T0, by: 'Agente detector · test' });
  assert.equal(body.resource, 'demo:lab-gran-de-gracia-51:GDG51-PAN-07:formato-girado');
  assert.equal(body.kind, 'screen'); assert.equal(body.severity, 'alta'); assert.equal(body.project_id, 'gran-de-gracia'); assert.equal(body.loc, 'lab-gran-de-gracia-51');
  assert.ok(body.source.length <= 24);
  assert.match(body.subject, /^GDG51-PAN-07 · Formato girado: .* pinta en vertical y debe ir en horizontal$/);
  assert.ok(body.subject.length <= 200 && body.detail.length <= 2000);
  assert.match(body.detail, /giro medido 90°/); assert.match(body.detail, /hace 31 s/); assert.match(body.detail, /player macbookpro16/);
  const c = cierre({ plan: lab, pantalla: m, tipo: 'formato-girado', id: 'INC-ABC12', by: 'Agente detector · test' });
  assert.deepEqual(Object.keys(c).sort(), ['by', 'close', 'id', 'note', 'resource']);
  assert.equal(cierre({ plan: lab, pantalla: m, tipo: 'formato-girado', id: 'no-es-un-id' }).id, undefined);
  assert.equal(fichaYokup('INC-ABC12'), 'https://www.yokup.com/ticket?id=INC-ABC12');
  assert.equal(fichaYokup('<script>'), 'https://www.yokup.com/incidencias');
});

test('del listado de Yokup, la incidencia de este recurso y los pasos de la UI', () => {
  const res = 'demo:lab-gran-de-gracia-51:GDG51-PAN-07:formato-girado';
  const lista = [
    { id: 'INC-OLD01', resource: res, stage: 'cerrada', resolved_at: 5 },
    { id: 'INC-NEW01', resource: res, stage: 'abierta', created_at: 9 },
    { id: 'INC-OTRA1', resource: 'demo:lab-gran-de-gracia-51:GDG51-PAN-01:formato-girado', stage: 'abierta', created_at: 10 }
  ];
  assert.equal(incidenciaDe(lista, res).id, 'INC-NEW01');
  assert.equal(incidenciaDe(lista.slice(0, 1), res).id, 'INC-OLD01');
  assert.equal(incidenciaDe([], res), null);
  const p = pasos({ envio: { ok: true }, acuse: { seen: true, ack: { status: 'executed' } }, detector: { fase: 'fallo', incidencia: 'INC-NEW01' }, incidencia: { id: 'INC-NEW01', stage: 'abierta' } });
  assert.deepEqual(p.map(x => [x.id, x.hecho]), [['enviada', true], ['acuse', true], ['detectada', true], ['abierta', true], ['resuelta', false]]);
  assert.equal(pasos({ envio: { ok: true }, acuse: { seen: true, ack: { status: 'failed' } } })[1].fallido, true);
});

// ── Adaptadores con una red de mentira ───────────────────────────────────────────────────
function red(rutas) {
  const llamadas = [];
  const fetcher = async (url, init = {}) => {
    llamadas.push({ url: String(url), init });
    for (const [patron, fn] of rutas) if (String(url).includes(patron)) {
      const [status, body] = await fn(String(url), init);
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  };
  return { fetcher, llamadas };
}

test('el mando: cola, 403 de la salvaguarda y acuse', async () => {
  const { fetcher, llamadas } = red([
    ['/locations/cmd/ack', () => [200, { ok: true, seen: true, ack: { status: 'executed', cmd: 'fault-rotate' } }]],
    ['/locations/cmd', (u, i) => JSON.parse(i.body).screen === 'macbookpro16'
      ? [200, { ok: true, id: 'macbookpro16', cid: 7, action: '11111111-1111-4111-8111-111111111111', cmd: 'fault-rotate' }]
      : [403, { error: 'fault_not_allowed', reason: 'screen_not_lab' }]]
  ]);
  const m = mando(fetcher);
  const ok = await m.enviar(orden('formato-girado', 'macbookpro16').body);
  assert.equal(ok.ok, true); assert.equal(ok.cid, 7);
  const no = await m.enviar({ id: 'macmini-starbucks-horizontal', screen: 'macmini-starbucks-horizontal', cmd: 'fault-rotate' });
  assert.deepEqual({ ok: no.ok, status: no.status, error: no.error }, { ok: false, status: 403, error: 'screen_not_lab' });
  const a = await m.acuse('macbookpro16', ok.action);
  assert.equal(a.seen, true); assert.equal(a.ack.status, 'executed');
  assert.equal(llamadas[0].init.method, 'POST');
});

test('Yokup público: sólo recursos demo:, idempotente y con el cierre de un recurso sin abrir', async () => {
  let abiertas = 0;
  const { fetcher, llamadas } = red([
    ['/incident/status', () => [200, { ok: true, incidents: [{ id: 'INC-ABC12', resource: 'demo:x', stage: 'abierta' }] }]],
    ['/incident', (u, i) => {
      const b = JSON.parse(i.body);
      if (b.close) return b.resource.endsWith(':nada') ? [404, { ok: false, error: 'incidencia demo no encontrada' }] : [200, { ok: true, id: 'INC-ABC12', status: 'resolved', stage: 'cerrada', applied: true }];
      abiertas++; return [200, { ok: true, id: 'INC-ABC12' }];
    }]
  ]);
  const y = yokupPublico(fetcher);
  assert.deepEqual(await y.abrir({ resource: 'itil:lab:GDG51-PAN-07:formato-girado' }), { ok: false, error: 'solo_demo' });
  assert.equal(llamadas.length, 0, 'un recurso real no sale por el carril público');
  const a = await y.abrir({ resource: 'demo:lab:GDG51-PAN-07:formato-girado', subject: 's' });
  assert.deepEqual(a, { ok: true, id: 'INC-ABC12', url: 'https://www.yokup.com/ticket?id=INC-ABC12' });
  assert.equal(abiertas, 1);
  assert.equal((await y.cerrar({ close: true, resource: 'demo:lab:GDG51-PAN-07:formato-girado' })).applied, true);
  assert.equal((await y.cerrar({ close: true, resource: 'demo:lab:nada' })).nada, true);
  const st = await y.estado('demo:lab:', ['INC-ABC12', 'malo']);
  assert.equal(st.incidents.length, 1);
  assert.match(llamadas.at(-1).url, /prefix=demo%3Alab%3A&ids=INC-ABC12$/);
});

test('Yokup MCP: sin incidents:write no llama a nada; con ella, Bearer y sin filtrar el token', async () => {
  const sin = red([]);
  const m0 = yokupMcp({ fetcher: sin.fetcher, credencial: { token: 'ykm_secreto', scopes: ['read', 'inbox', 'send', 'work'] } });
  assert.equal(m0.disponible, false);
  assert.deepEqual(await m0.abrir({ resource: 'itil:x' }), { ok: false, error: 'sin_credencial_incidents_write' });
  assert.equal(sin.llamadas.length, 0);
  const con = red([['yokup.com/mcp', (u, i) => {
    const b = JSON.parse(i.body);
    if (b.params.name === 'yokup_incidents_list') return [200, { jsonrpc: '2.0', id: b.id, result: { structuredContent: { incidents: [{ id: 'INC-ITIL1', resource: 'itil:x' }] } } }];
    if (b.params.name === 'yokup_incident_update') return [200, { jsonrpc: '2.0', id: b.id, result: { structuredContent: { ok: true } } }];
    return [200, { jsonrpc: '2.0', id: b.id, result: { content: [{ type: 'text', text: JSON.stringify({ id: 'INC-ITIL1', url: 'https://www.yokup.com/ticket?id=INC-ITIL1', deduplicated: false }) }] } }];
  }]]);
  const m1 = yokupMcp({ fetcher: con.fetcher, credencial: { token: 'ykm_secreto', scopes: ['read', 'incidents', 'incidents:write'] } });
  const a = await m1.abrir({ subject: 's', detail: 'd', kind: 'screen', severity: 'alta', resource: 'itil:x', project_id: 'gran-de-gracia' });
  assert.equal(a.id, 'INC-ITIL1');
  const c = await m1.cerrar({ resource: 'itil:x', note: 'vuelve a casar' });
  assert.deepEqual(c, { ok: true, id: 'INC-ITIL1', applied: true });
  assert.equal(con.llamadas[0].init.headers.Authorization, 'Bearer ykm_secreto');
  assert.doesNotMatch(JSON.stringify([a, c]), /ykm_/);
  assert.equal(JSON.parse(con.llamadas[0].init.body).params.name, 'yokup_incident_open');
  assert.equal(carril('demo:x', { publico: 'P', mcp: m1 }), 'P');
  assert.equal(carril('itil:x', { publico: 'P', mcp: m0 }), null);
  assert.equal(carril('itil:x', { publico: 'P', mcp: m1 }), m1);
});

// ── El agente de consola, de punta a punta ────────────────────────────────────────────────
test('el agente abre una sola incidencia por fallo y la cierra al volver a casar', async () => {
  let pinta = 'horizontal', ahora = T0;
  const posts = [];
  const { fetcher } = red([
    ['/signage/now', () => [200, senal({ ...PANEL, painted: pinta, paintedRotation: pinta === 'vertical' ? 90 : 0 }, { lastSeen: ahora - 2000 })]],
    ['/incident', (u, i) => { const b = JSON.parse(i.body); posts.push(b); return [200, b.close ? { ok: true, id: 'INC-ABC12', applied: true, stage: 'cerrada' } : { ok: true, id: 'INC-ABC12' }]; }]
  ]);
  let estados = {};
  const paso = async (seg, extra = {}) => { ahora += seg * 1000; const r = await pasada({ plan: lab, estados, fetcher, ahora, by: 'Agente detector · test', ...extra }); estados = r.estados; return r.hechos; };
  await paso(0);
  assert.equal(posts.length, 0);
  pinta = 'vertical';                                   // fault-rotate llega al player
  for (let i = 0; i < 3; i++) await paso(10);
  assert.equal(posts.length, 0, 'todavía en la gracia');
  await paso(10);
  assert.equal(posts.length, 1, 'abre al cumplir la gracia');
  assert.equal(posts[0].resource, 'demo:lab-gran-de-gracia-51:GDG51-PAN-07:formato-girado');
  assert.equal(estados['macbookpro16:formato-girado'].incidencia, 'INC-ABC12');
  for (let i = 0; i < 12; i++) await paso(10);
  assert.equal(posts.length, 1, 'una incidencia por fallo, no una por latido');
  pinta = 'horizontal';                                 // fault-clear
  await paso(10); await paso(10); await paso(10);
  assert.equal(posts.length, 1);
  await paso(10);
  assert.equal(posts.length, 2); assert.equal(posts[1].close, true); assert.equal(posts[1].id, 'INC-ABC12');
  assert.equal(estados['macbookpro16:formato-girado'].incidencia, null);
  for (let i = 0; i < 6; i++) await paso(10);
  assert.equal(posts.length, 2);
  // En seco no escribe nada aunque detecte.
  pinta = 'vertical';
  const hechos = [];
  for (let i = 0; i < 5; i++) hechos.push(...await paso(10, { seco: true }));
  assert.equal(posts.length, 2);
  assert.ok(hechos.some(h => h.accion === 'abrir' && h.omitida === 'seco'));
});

test('el agente no vigila pantallas de clientes salvo que se le pida, y entonces sin credencial sólo observa', async () => {
  const { fetcher, llamadas } = red([['/signage/now', () => [200, senal({ width: 2560, height: 1440, painted: 'vertical' })]]]);
  await pasada({ plan: starbucks, fetcher, ahora: T0 });
  assert.equal(llamadas.length, 0);
  let estados = {};
  for (let i = 0; i <= 4; i++) estados = (await pasada({ plan: starbucks, estados, fetcher, ahora: T0 + i * GRACIA_MS, todas: true })).estados;
  assert.ok(llamadas.length > 0);
  assert.ok(llamadas.every(l => !l.url.includes('yokup')), 'sin credencial no se escribe en Yokup');
  assert.ok(Object.values(estados).some(e => e.error === 'sin_carril'));
});

test('la página: sección en el ▤ Modo avanzado debajo de Creación de Xpacios, textos propios y publicada en admira.biz', () => {
  const html = readFileSync(new URL('../plano.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../plano-incidencias.mjs', import.meta.url), 'utf8');
  assert.match(html, /<section id="incidencias"[^>]*data-shell-slot="advanced"/);
  assert.ok(html.indexOf('id="upload"') < html.indexOf('id="incidencias"') && html.indexOf('id="create"') < html.indexOf('id="incidencias"'));
  assert.match(html, /plano-incidencias\.mjs\?v=20261014-incidencias-1/);
  assert.match(html, /plano-incidencias\.css\?v=20261014-incidencias-1/);
  const seccion = html.slice(html.indexOf('<section id="incidencias"'), html.indexOf('</section>', html.indexOf('<section id="incidencias"')));
  assert.doesNotMatch(seccion, /data-copy/, 'plano.mjs reescribe los data-copy con su diccionario');
  for (const k of [...seccion.matchAll(/data-inc="([a-zA-Z]+)"/g)].map(m => m[1])) assert.ok(new RegExp(`\\b${k}:`).test(ui), `falta el texto ${k}`);
  for (const f of ['plano-incidencias.mjs', 'plano-incidencias.css', 'incidencias-core.mjs', 'incidencias-adaptadores.mjs']) assert.ok(BIZ_ASSET_FILES.includes(f), f);
  assert.match(ui, /raiz\.addEventListener\('click', e => e\.stopPropagation\(\)\)/, 'pulsar dentro no cierra el panel');
  assert.match(ui, /en: \{/);
});
