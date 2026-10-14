// ▤ Modo avanzado · Creador de incidencias (DCL-34d5bbccb9cc227bb752a419). Mando de fallos de
// laboratorio + el agente detector corriendo en esta pestaña mientras está a la vista:
//   orden enviada → acuse del player → detectada → incidencia abierta (enlace a Yokup) → resuelta.
// Lógica en incidencias-core.mjs; red en incidencias-adaptadores.mjs. Los textos usan data-inc,
// no data-copy: el traductor de plano.mjs reescribe todos los data-copy con SU diccionario.
import { localeFor } from './walk-core.mjs?v=20261010-evidence-1';
import {
  CATALOGO, GRACIA_MS, DEMO_PREFIX, pantallasDelPlano, tipoIncidencia, orden, anotar,
  recurso, fichaYokup, incidenciaDe, pasos, vueltaDetector, medidaTexto
} from './incidencias-core.mjs?v=20261014-bugito-1';
import { mando, yokupPublico } from './incidencias-adaptadores.mjs?v=20261014-bugito-1';

const $ = id => document.getElementById(id);
const raiz = $('incidencias');
const SONDEO_MS = 5000, ACUSE_MAX_MS = 90000, ESTADO_YOKUP_MS = 15000;

const textos = {
  es: {
    title: 'Creador de incidencias', hint: 'Envía un fallo a una pantalla de laboratorio y comprueba que el agente lo detecta y abre la incidencia en Yokup.',
    screen: 'Pantalla', type: 'Incidencia', send: 'Enviar al player', clear: 'Volver a la normalidad',
    note: 'Sólo players virtuales de laboratorio (virtual-lab-*): el mando rechaza cualquier otra pantalla. El fallo caduca solo a los 30 min.',
    loading: 'Cargando las pantallas del plano…', noPlan: 'Este Xpacio no tiene plano publicado.',
    noLab: 'Este Xpacio no tiene pantallas de laboratorio: el Creador de incidencias sólo actúa sobre players virtuales de laboratorio (virtual-lab-*). El MBP16 (GDG51-PAN-07) entrará cuando tenga un id de pantalla dedicado.',
    enviada: 'Orden enviada', acuse: 'Acuse del player', detectada: 'Detectada', abierta: 'Incidencia abierta', resuelta: 'Resuelta',
    sending: 'Enviando…', sent: c => `Orden «${c}» en la cola del player.`, rejected: r => `El mando la rechaza: ${r}.`, netError: 'Sin conexión con el mando.',
    waitAck: 'esperando al player…', noAck: 'sin acuse: ¿está el player encendido?', ackOk: 'ejecutada', ackFail: 'el player no la pudo ejecutar',
    clearSent: 'Vuelta a la normalidad', expects: (e, p, g) => `Espera ${e} · pinta ${p}${g !== null && g !== undefined ? ` (giro medido ${g}°)` : ''}`,
    noSignal: m => ({ 'sin-respuesta': 'sin respuesta de /signage/now', 'no-declara': 'el player no declara estado: arráncalo en el MBP16', 'latido-viejo': 'el último latido es de hace más de 5 min', standby: 'el player está en standby' }[m] || m),
    noData: 'el player no declara la orientación pintada (versión anterior del canal)',
    noMeasure: 'el player no declara esta medida (versión anterior del canal o lienzo editorial)',
    bugito: 'Probar con Bugito',
    suspect: s => `no casa · abre la incidencia en ${s} s`, failing: 'no casa', recovering: s => `vuelve a casar · se cierra en ${s} s`, matches: 'casa con el plano',
    opened: id => `Incidencia ${id} abierta en Yokup.`, closed: id => `Incidencia ${id || ''} cerrada: vuelve a casar.`, yokupError: e => `Yokup no responde: ${e}.`,
    held: id => `Vuelve a casar, pero la incidencia ${id || ''} la lleva un técnico del portal: se cierra allí con evidencia.`,
    stage: { abierta: 'abierta', en_curso: 'en curso', recuperada: 'recuperada', cerrada: 'cerrada' }, lab: 'laboratorio'
  },
  en: {
    title: 'Incident creator', hint: 'Send a fault to a lab screen and check that the agent detects it and opens the incident in Yokup.',
    screen: 'Screen', type: 'Incident', send: 'Send to player', clear: 'Back to normal',
    note: 'Lab virtual players only (virtual-lab-*): the remote rejects any other screen. The fault expires by itself after 30 min.',
    loading: 'Loading the plan screens…', noPlan: 'This Xpace has no published floor plan.',
    noLab: 'This Xpace has no lab screens: the incident creator only acts on lab virtual players (virtual-lab-*). The MBP16 (GDG51-PAN-07) will join once it has a dedicated screen id.',
    enviada: 'Order sent', acuse: 'Player receipt', detectada: 'Detected', abierta: 'Incident opened', resuelta: 'Resolved',
    sending: 'Sending…', sent: c => `Order “${c}” queued for the player.`, rejected: r => `The remote rejects it: ${r}.`, netError: 'No connection to the remote.',
    waitAck: 'waiting for the player…', noAck: 'no receipt: is the player on?', ackOk: 'executed', ackFail: 'the player could not run it',
    clearSent: 'Back to normal', expects: (e, p, g) => `Expects ${e} · paints ${p}${g !== null && g !== undefined ? ` (measured turn ${g}°)` : ''}`,
    noSignal: m => ({ 'sin-respuesta': 'no answer from /signage/now', 'no-declara': 'the player reports no state: start it on the MBP16', 'latido-viejo': 'last heartbeat is older than 5 min', standby: 'the player is in standby' }[m] || m),
    noData: 'the player does not report its painted orientation (older channel release)',
    noMeasure: 'the player does not report this measure (older channel release or editorial canvas)',
    bugito: 'Try it with Bugito',
    suspect: s => `mismatch · opens the incident in ${s} s`, failing: 'mismatch', recovering: s => `matches again · closes in ${s} s`, matches: 'matches the plan',
    opened: id => `Incident ${id} opened in Yokup.`, closed: id => `Incident ${id || ''} closed: it matches again.`, yokupError: e => `Yokup is not answering: ${e}.`,
    held: id => `It matches again, but incident ${id || ''} is held by a portal technician: it is closed there with evidence.`,
    stage: { abierta: 'open', en_curso: 'in progress', recuperada: 'recovered', cerrada: 'closed' }, lab: 'lab'
  }
};
const orient = { es: { horizontal: 'horizontal', vertical: 'vertical' }, en: { horizontal: 'landscape', vertical: 'portrait' } };
const LANGUAGE_KEY = (window.ADMIRA_SITE_BRAND?.id || 'clearchannel') + '-lang';
let lang = 'es';
try { lang = localeFor(location.hostname, location.search, localStorage.getItem(LANGUAGE_KEY) || ''); } catch { lang = localeFor(location.hostname, location.search, ''); }
const tr = (k, ...a) => { const v = textos[lang][k]; return typeof v === 'function' ? v(...a) : v; };
const o = v => (orient[lang][v] || v || '—');

const params = new URLSearchParams(location.search);
const xpacioId = /^[a-z0-9][a-z0-9-]{0,79}$/.test(params.get('locationId') || '') ? params.get('locationId') : 'alsea-sbux-021';
const red = { mando: mando((...a) => fetch(...a)), yokup: yokupPublico((...a) => fetch(...a)) };
const by = 'Creador de incidencias · admira.biz';

let plan = null, lista = [];
// Una prueba = lo que se pinta en los cinco pasos. Los pasos se quedan marcados (latch) hasta la siguiente.
const prueba = { envio: null, acuse: null, vuelta: null, vueltaAcuse: null, marcas: new Set(), mensaje: '', error: false };
let observado = null;
let detector = null, lectura = null, incidencia = null, sondeo = 0, ultimoYokup = 0, ocupado = false;

const sel = () => lista.find(p => p.screen === $('inc-screen').value) || null;
const tipo = () => tipoIncidencia($('inc-type').value) || CATALOGO[0];
const claveEstado = () => `admira.incidencias.${xpacioId}.${$('inc-screen').value}.${tipo().id}`;
function leerEstado() { try { return JSON.parse(localStorage.getItem(claveEstado()) || 'null'); } catch { return null; } }
function guardarEstado() { try { localStorage.setItem(claveEstado(), JSON.stringify(detector)); } catch { /* sin almacenamiento: dura hasta recargar */ } }

function traducir() {
  raiz.querySelectorAll('[data-inc]').forEach(n => { n.textContent = tr(n.dataset.inc); });
  pintarOpciones(); pintar();
}
function pintarOpciones() {
  const s = $('inc-screen'), t = $('inc-type'), prevS = s.value, prevT = t.value;
  s.replaceChildren(...lista.map(p => new Option(`${p.itil ? p.itil + ' · ' : ''}${p.nombre} (${o(p.esperada)})`, p.screen)));
  if (lista.some(p => p.screen === prevS)) s.value = prevS;
  t.replaceChildren(...CATALOGO.map(c => new Option(c[lang] || c.es, c.id)));
  if (CATALOGO.some(c => c.id === prevT)) t.value = prevT;
  const c = tipo();
  $('inc-help').textContent = c ? (c.ayuda[lang] || c.ayuda.es) : '';
}

function pintar() {
  const hayLab = lista.length > 0;
  for (const id of ['inc-screen', 'inc-type', 'inc-send', 'inc-clear']) $(id).disabled = !hayLab || (ocupado && (id === 'inc-send' || id === 'inc-clear'));
  const p = sel();
  // Pasos
  const pz = pasos({ envio: prueba.envio, acuse: prueba.acuse, detector, incidencia });
  for (const paso of pz) if (paso.hecho && prueba.envio) prueba.marcas.add(paso.id);
  const ol = $('inc-steps');
  ol.hidden = !prueba.envio;
  ol.replaceChildren(...pz.map(paso => {
    const li = document.createElement('li');
    const hecho = prueba.marcas.has(paso.id);
    li.className = paso.fallido ? 'err' : hecho ? 'ok' : '';
    const nombre = document.createElement('span'); nombre.textContent = tr(paso.id); li.append(nombre);
    const extra = detalle(paso.id);
    if (extra) { const d = document.createElement('small'); if (extra instanceof Node) d.append(extra); else d.textContent = extra; li.append(' · ', d); }
    return li;
  }));
  // Vuelta a la normalidad
  if (prueba.vuelta) {
    const li = document.createElement('li');
    li.className = prueba.vueltaAcuse && prueba.vueltaAcuse.seen ? (prueba.vueltaAcuse.ack && prueba.vueltaAcuse.ack.status === 'executed' ? 'ok' : 'err') : '';
    li.textContent = `${tr('clearSent')} · ${!prueba.vuelta.ok ? (prueba.vuelta.error || '') : acuseTexto(prueba.vueltaAcuse, prueba.vuelta)}`;
    ol.append(li); ol.hidden = false;
  }
  // En vivo
  $('inc-live').textContent = p ? vivo(p) : '';
  const st = $('inc-status'); st.textContent = prueba.mensaje; st.classList.toggle('err', prueba.error);
}
function acuseTexto(acuse, envio) {
  if (acuse && acuse.seen) return acuse.ack && acuse.ack.status === 'executed' ? tr('ackOk') : tr('ackFail');
  return envio && Date.now() - envio.en > ACUSE_MAX_MS ? tr('noAck') : tr('waitAck');
}
function detalle(paso) {
  if (paso === 'enviada' && prueba.envio) return prueba.envio.ok ? prueba.envio.cmd : prueba.envio.error;
  if (paso === 'acuse' && prueba.envio && prueba.envio.ok) return acuseTexto(prueba.acuse, prueba.envio);
  if (paso === 'abierta') {
    const id = (incidencia && incidencia.id) || (detector && (detector.incidencia || detector.ultima));
    if (!id) return '';
    const a = document.createElement('a');
    a.href = fichaYokup(id); a.target = '_blank'; a.rel = 'noopener';
    a.textContent = id + (incidencia && incidencia.stage ? ` · ${tr('stage')[incidencia.stage] || incidencia.stage}` : '');
    return a;
  }
  return '';
}
function vivo(p) {
  if (!lectura) return '';
  if (lectura.estado === 'sin-senal') return tr('noSignal', lectura.motivo);
  // Bugito: los tipos de superficie enseñan su medida (lienzo, % tapado, % visible).
  const t = tipo(), superficie = t.detector !== 'orientacion';
  if (superficie && (!observado || observado.pintada == null)) return tr('noMeasure');
  if (!superficie && lectura.estado !== 'ok') return tr('noData');
  const base = superficie ? medidaTexto(t.id, observado, lang) : tr('expects', o(p.esperada), o(lectura.pintada), lectura.giro);
  const ahora = Date.now(), quedan = d => Math.max(0, Math.ceil((GRACIA_MS - (ahora - d)) / 1000));
  if (!detector) return base;
  if (detector.fase === 'sospecha') return `${base} · ${tr('suspect', quedan(detector.desde))}`;
  if (detector.fase === 'fallo') return `${base} · ${tr('failing')}`;
  if (detector.fase === 'recuperando') return `${base} · ${tr('recovering', quedan(detector.desde))}`;
  return `${base} · ${tr('matches')}`;
}

// ── El agente detector, en esta pestaña ──────────────────────────────────────────────────
// Una vuelta cada vez: el sondeo, el envío y volver a la pestaña no se pisan (ni abren dos veces).
let enCurso = null;
function vuelta() {
  if (!enCurso) enCurso = vueltaUnica().finally(() => { enCurso = null; });
  return enCurso;
}
// El detector de esta pestaña sólo corre con la sección ▤ a la vista: el panel abierto y la
// pestaña visible. Siempre encendido está el agente de consola (tools/agente-incidencias.mjs).
function activo() {
  if (document.hidden) return false;
  const panel = raiz.closest('details');
  return !panel || panel.open;
}
async function vueltaUnica() {
  const p = sel(); if (!p || !activo()) return;
  const c = tipo(), ahora = Date.now();
  let senal = null;
  try { senal = await red.mando.senal(p.screen); } catch { senal = null; }
  const v = vueltaDetector(detector, { plan, pantalla: p, tipo: c.id, senal, ahora, by, planoUrl: location.href.split('#')[0] });
  lectura = v.observacion.lectura; observado = v.observacion; detector = v.estado;
  if (detector.accion) {
    const accion = detector.accion, body = v.body;
    let r;
    try { r = body ? await (accion === 'abrir' ? red.yokup.abrir(body) : red.yokup.cerrar(body)) : { ok: false, error: 'sin_recurso' }; }
    catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    detector = anotar(detector, accion, r);
    if (r.ok) { prueba.mensaje = accion === 'abrir' ? tr('opened', r.id) : tr('closed', r.id || detector.ultima); prueba.error = false; ultimoYokup = 0; }
    else if (r.retenida) { prueba.mensaje = tr('held', detector.ultima); prueba.error = false; }
    else { prueba.mensaje = tr('yokupError', r.error); prueba.error = true; }
  }
  detector = { ...detector, accion: null };
  guardarEstado();
  // Acuses pendientes
  if (prueba.envio && prueba.envio.ok && !(prueba.acuse && prueba.acuse.seen) && ahora - prueba.envio.en <= ACUSE_MAX_MS)
    prueba.acuse = await red.mando.acuse(prueba.envio.id, prueba.envio.action).catch(() => prueba.acuse);
  if (prueba.vuelta && prueba.vuelta.ok && !(prueba.vueltaAcuse && prueba.vueltaAcuse.seen) && ahora - prueba.vuelta.en <= ACUSE_MAX_MS)
    prueba.vueltaAcuse = await red.mando.acuse(prueba.vuelta.id, prueba.vuelta.action).catch(() => prueba.vueltaAcuse);
  // Estado del ticket en Yokup (carril público, recursos demo:)
  const res = recurso(plan, p, c.id);
  if (res.startsWith(DEMO_PREFIX) && ahora - ultimoYokup >= ESTADO_YOKUP_MS) {
    ultimoYokup = ahora;
    const ids = [detector.incidencia, detector.ultima].filter(Boolean);
    const e = await red.yokup.estado(`${DEMO_PREFIX}${plan.id}:`, ids).catch(() => null);
    if (e && e.ok) incidencia = incidenciaDe(e.incidents, res) || incidencia;
  }
  pintar();
}
function programar() { clearTimeout(sondeo); sondeo = setTimeout(async () => { try { await vuelta(); } catch { /* el siguiente sondeo lo reintenta */ } programar(); }, SONDEO_MS); }

async function enviar(vueltaANormalidad) {
  const p = sel(); if (!p || ocupado) return;
  const o2 = orden(tipo().id, p.screen, { vuelta: vueltaANormalidad });
  if (!o2.ok) { prueba.mensaje = tr('rejected', o2.error); prueba.error = true; pintar(); return; }
  ocupado = true; prueba.mensaje = tr('sending'); prueba.error = false; pintar();
  let r;
  try { r = await red.mando.enviar(o2.body); } catch { r = { ok: false, error: tr('netError') }; }
  r = { ...r, en: Date.now(), cmd: o2.body.cmd };
  if (vueltaANormalidad) { prueba.vuelta = r; prueba.vueltaAcuse = null; }
  else {
    Object.assign(prueba, { envio: r, acuse: null, vuelta: null, vueltaAcuse: null }); prueba.marcas = new Set(); incidencia = null;
    // Una prueba nueva no hereda el «resuelta» de la anterior.
    if (detector) { detector = { ...detector, ultima: null }; guardarEstado(); }
  }
  prueba.mensaje = r.ok ? tr('sent', o2.body.cmd) : tr('rejected', r.error); prueba.error = !r.ok;
  ocupado = false; pintar();
  try { await vuelta(); } catch { /* sigue el sondeo */ }
}

function alCambiarPantalla() { detector = leerEstado(); lectura = null; observado = null; incidencia = null; ultimoYokup = 0; pintarOpciones(); pintar(); vuelta().catch(() => {}); }

async function arrancar() {
  if (!raiz) return;
  // Los botones de .advanced-actions cierran el panel al pulsarlos (responsive-shell.js): aquí no.
  raiz.addEventListener('click', e => e.stopPropagation());
  $('inc-send').addEventListener('click', () => enviar(false));
  $('inc-clear').addEventListener('click', () => enviar(true));
  $('inc-screen').addEventListener('change', alCambiarPantalla);
  $('inc-type').addEventListener('change', alCambiarPantalla);
  document.addEventListener('admira:lang', e => { const next = e.detail?.lang === 'es' ? 'es' : 'en'; if (next !== lang) { lang = next; traducir(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) vuelta().catch(() => {}); });
  // Al abrir el panel ▤ el detector arranca al momento (galaxy-shell mete la sección en un <details>).
  document.addEventListener('toggle', e => { if (e.target && e.target.contains && e.target.contains(raiz) && e.target.open) vuelta().catch(() => {}); }, true);
  traducir();
  $('inc-status').textContent = tr('loading');
  try {
    const r = await fetch(`data/xpacios/${xpacioId}.json`, { cache: 'no-store' });
    plan = r.ok ? await r.json() : null;
  } catch { plan = null; }
  lista = plan ? pantallasDelPlano(plan).filter(p => p.lab && p.esperada) : [];
  prueba.mensaje = !plan ? tr('noPlan') : lista.length ? '' : tr('noLab');
  prueba.error = false;
  pintarOpciones();
  if (lista.length) { detector = leerEstado(); programar(); vuelta().catch(() => {}); }
  pintar();
}
arrancar();
