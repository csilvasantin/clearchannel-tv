// Bugito · banco de pruebas del ▤ Creador de incidencias (DCL-5da4653d859552490fd5ae1d). Player virtual de
// laboratorio a la izquierda (admira.tv/canal.html, virtual-lab-bugito) y Bugito a la derecha: la nube de Admirito
// con piel de diablillo (digitalavatar.ai/nube.html?personaje=bugito), la misma que abre el cargador común
// admiranext.com/assets/avatar.js. Bugito manda la orden por el MISMO adaptador del Creador de incidencias
// (cola /locations/cmd), ve el acuse, el detector corre en esta pestaña sobre lo que el player DECLARA en
// /signage/now y, cuando se abre la incidencia en Yokup (carril público demo:), Bugito lo celebra; cuando se
// resuelve, se lamenta. /bugito del ⌘ Experto llega aquí por window.AdmiraBugito.
import { localeFor } from './walk-core.mjs?v=20261010-evidence-1';
import {
  CATALOGO, DEMO_PREFIX, tipoIncidencia, orden, anotar, recurso, fichaYokup, incidenciaDe, pasos, vueltaDetector, medidaTexto
} from './incidencias-core.mjs?v=20261014-bugito-1';
import { mando, yokupPublico } from './incidencias-adaptadores.mjs?v=20261014-bugito-1';
import {
  BANCO, BUGITO_SCREEN, BUGITO_ORIGIN, GRACIA_BANCO_MS, pantallaBanco, resolverIncidencia, playerUrl, caraUrl, baseLocal,
  estadoBugito, mensajeBugito, esDeBugito
} from './bugito-core.mjs?v=20261014-bugito-1';

const $ = id => document.getElementById(id);
const SONDEO_MS = 3000, ACUSE_MAX_MS = 90000, ESTADO_YOKUP_MS = 12000;
const ICONO = { 'formato-girado': '↻', 'cambio-resolucion': '⇋', 'popup-encima': '❐', 'medio-abrir': '◒' };

const textos = {
  es: {
    back: '← Creador de incidencias (▤ Modo avanzado del plano)', eyebrow: 'Creador de incidencias · banco de pruebas', title: 'Bugito rompe, el agente vigila',
    intro: 'Bugito lanza un fallo en el player virtual de laboratorio; el detector lo mide en lo que el player declara y abre la incidencia en Yokup. Cuando vuelve a la normalidad, la cierra.',
    player: 'Player virtual de laboratorio', landscape: 'horizontal · 16:9', bugito: 'Bugito', hide: 'Ocultar a Bugito', show: 'Mostrar a Bugito', menu: '¿Qué rompo?',
    normal: 'Volver a la normalidad', note: 'Sólo players virtuales de laboratorio (virtual-lab-*): el mando rechaza cualquier otra pantalla. Cada fallo caduca solo a los 30 min.',
    enviada: 'Orden enviada', acuse: 'Acuse del player', detectada: 'Detectada', abierta: 'Incidencia abierta', resuelta: 'Resuelta',
    estados: { aburrido: 'aburrido', lanzando: 'lanzando', tramando: 'tramando', celebrando: 'celebrando', derrotado: 'derrotado', rechazado: 'rechazado' },
    sending: 'Bugito manda la orden…', sent: c => `Orden «${c}» en la cola del player virtual.`, rejected: r => `El mando la rechaza: ${r}.`, netError: 'Sin conexión con el mando.',
    waitAck: 'esperando al player…', noAck: 'sin acuse: ¿está el player virtual abierto?', ackOk: 'ejecutada', ackFail: 'el player no la pudo ejecutar',
    clearSent: 'Vuelta a la normalidad',
    noSignal: m => ({ 'sin-respuesta': 'esperando el primer latido del player virtual (/signage/now)…', 'no-declara': 'el player virtual aún no ha declarado su estado', 'latido-viejo': 'el último latido es de hace más de 5 min', standby: 'el player está en standby' }[m] || m),
    noMeasure: 'sin medida (el canal aún no declara esta medida)', waiting: 'esperando al player…',
    fases: { casa: 'en orden', sospecha: s => `no casa · abre en ${s} s`, fallo: 'incidencia', recuperando: s => `vuelve a casar · cierra en ${s} s` },
    opened: id => `Incidencia ${id} abierta en Yokup.`, closed: id => `Incidencia ${id || ''} cerrada: vuelve a la normalidad.`, yokupError: e => `Yokup no responde: ${e}.`,
    held: id => `La incidencia ${id || ''} la lleva un técnico del portal: se cierra allí.`,
    stage: { abierta: 'abierta', en_curso: 'en curso', recuperada: 'recuperada', cerrada: 'cerrada' },
    unknown: x => `Bugito no conoce «${x}». Prueba: girar, resolucion, popup, medias o normal.`,
    launched: (n) => `Bugito lanza «${n}» en el player virtual.`, shown: 'Bugito a la vista.', hidden: 'Bugito escondido (vuelve con /bugito).',
    presel: n => `Preseleccionada: ${n}. Pulsa el botón para lanzarla.`
  },
  en: {
    back: '← Incident creator (▤ floor plan advanced mode)', eyebrow: 'Incident creator · test bench', title: 'Bugito breaks, the agent watches',
    intro: 'Bugito injects a fault into the lab virtual player; the detector measures it in what the player reports and opens the incident in Yokup. When it goes back to normal, it closes it.',
    player: 'Lab virtual player', landscape: 'landscape · 16:9', bugito: 'Bugito', hide: 'Hide Bugito', show: 'Show Bugito', menu: 'What shall I break?',
    normal: 'Back to normal', note: 'Lab virtual players only (virtual-lab-*): the remote rejects any other screen. Each fault expires by itself after 30 min.',
    enviada: 'Order sent', acuse: 'Player receipt', detectada: 'Detected', abierta: 'Incident opened', resuelta: 'Resolved',
    estados: { aburrido: 'bored', lanzando: 'launching', tramando: 'scheming', celebrando: 'celebrating', derrotado: 'defeated', rechazado: 'rejected' },
    sending: 'Bugito sends the order…', sent: c => `Order “${c}” queued for the virtual player.`, rejected: r => `The remote rejects it: ${r}.`, netError: 'No connection to the remote.',
    waitAck: 'waiting for the player…', noAck: 'no receipt: is the virtual player open?', ackOk: 'executed', ackFail: 'the player could not run it',
    clearSent: 'Back to normal',
    noSignal: m => ({ 'sin-respuesta': 'waiting for the virtual player\'s first heartbeat (/signage/now)…', 'no-declara': 'the virtual player has not reported its state yet', 'latido-viejo': 'last heartbeat is older than 5 min', standby: 'the player is in standby' }[m] || m),
    noMeasure: 'no measure (the channel does not report it yet)', waiting: 'waiting for the player…',
    fases: { casa: 'all good', sospecha: s => `mismatch · opens in ${s} s`, fallo: 'incident', recuperando: s => `matches again · closes in ${s} s` },
    opened: id => `Incident ${id} opened in Yokup.`, closed: id => `Incident ${id || ''} closed: back to normal.`, yokupError: e => `Yokup is not answering: ${e}.`,
    held: id => `Incident ${id || ''} is handled by a portal technician: it is closed there.`,
    stage: { abierta: 'open', en_curso: 'in progress', recuperada: 'recovered', cerrada: 'closed' },
    unknown: x => `Bugito does not know “${x}”. Try: rotate, resolution, popup, half or normal.`,
    launched: (n) => `Bugito launches “${n}” on the virtual player.`, shown: 'Bugito in sight.', hidden: 'Bugito hidden (/bugito brings him back).',
    presel: n => `Preselected: ${n}. Press the button to launch it.`
  }
};
const LANGUAGE_KEY = (window.ADMIRA_SITE_BRAND?.id || 'clearchannel') + '-lang';
let lang = 'es';
try { lang = localeFor(location.hostname, location.search, localStorage.getItem(LANGUAGE_KEY) || ''); } catch { lang = localeFor(location.hostname, location.search, ''); }
const tr = (k, ...a) => { const v = textos[lang][k]; return typeof v === 'function' ? v(...a) : v; };
const nombre = id => { const t = tipoIncidencia(id); return t ? (t[lang] || t.es) : tr('normal'); };

const params = new URLSearchParams(location.search);
const red = { mando: mando((...a) => fetch(...a)), yokup: yokupPublico((...a) => fetch(...a)) };
const by = 'Bugito · banco de pruebas · admira.biz';
const P = pantallaBanco();
// En producción, siempre los de verdad; en localhost se pueden apuntar a copias locales (?player=, ?cara=).
const playerBase = baseLocal(params.get('player'), location.origin) || undefined;
const caraBase = baseLocal(params.get('cara'), location.origin);
const caraOrigen = caraBase ? new URL(caraBase).origin : BUGITO_ORIGIN;
function urlCara() {
  if (caraBase) return caraUrl({ base: caraBase + '?personaje=bugito', lang });
  // El mismo cargador que Admirito: si avatar.js está en la página, la URL de la cara sale de él.
  try { const A = window.AdmiraAvatar; if (A && A.bugito && typeof A.bugito.url === 'function') return caraUrl({ base: A.bugito.url({ lang }), lang }); } catch { /* cae a la constante */ }
  return caraUrl({ lang });
}

// ── Estado del banco ──────────────────────────────────────────────────────────────────────
// La prueba = la última orden de Bugito (con su acuse); los detectores corren para TODOS los tipos a la vez.
const prueba = { tipo: '', envio: null, acuse: null, vuelta: null, vueltaAcuse: null, marcas: new Set(), mensaje: '', error: false };
const detectores = {}, observaciones = {}, incidencias = {};
let lectura = null, ultimoYokup = 0, ocupado = false, sondeo = 0, ultimoMensaje = '', caraLista = false;
const clave = id => `admira.bugito.${BANCO.id}.${id}`;
for (const t of CATALOGO) { try { detectores[t.id] = JSON.parse(localStorage.getItem(clave(t.id)) || 'null'); } catch { detectores[t.id] = null; } }
const guardar = id => { try { localStorage.setItem(clave(id), JSON.stringify(detectores[id])); } catch { /* sin almacenamiento */ } };

// ── Bugito (la cara) ──────────────────────────────────────────────────────────────────────
function estadoActual() {
  if (prueba.vuelta) {
    // «Volver a la normalidad»: lanzando hasta que el player la ejecuta y el detector ya no ve nada raro.
    const a = prueba.vueltaAcuse;
    if (!prueba.vuelta.ok || (a && a.seen && !(a.ack && a.ack.status === 'executed'))) return { estado: 'rechazado', incidencia: 'normal' };
    const algoRaro = CATALOGO.some(t => { const d = detectores[t.id]; return d && (d.incidencia || ['sospecha', 'fallo', 'recuperando'].includes(d.fase)); });
    return { estado: a && a.seen && !algoRaro ? 'derrotado' : 'lanzando', incidencia: 'normal' };
  }
  const t = prueba.tipo;
  const e = estadoBugito({ envio: prueba.envio, acuse: prueba.acuse, detector: t ? detectores[t] : null, incidencia: t ? incidencias[t] : null });
  const ticket = t ? ((incidencias[t] && incidencias[t].id) || (detectores[t] && (detectores[t].incidencia || detectores[t].ultima)) || '') : '';
  return { estado: e, incidencia: t, ticket };
}
function avisarBugito(forzar = false) {
  const { estado, incidencia, ticket } = estadoActual();
  const m = mensajeBugito(estado, { incidencia, ticket, lang });
  const firma = JSON.stringify(m);
  $('bb-bugito-estado').textContent = tr('estados')[estado] || estado;
  if (!forzar && firma === ultimoMensaje) return;
  // Al cargar la cara se le cuenta el estado sin que repita la frase si ya está aburrido.
  const envio = forzar && estado === 'aburrido' ? { ...m, silencio: true } : m;
  ultimoMensaje = firma;
  const w = $('bb-cara-frame').contentWindow;
  if (w && caraLista) { try { w.postMessage(envio, caraOrigen); } catch { /* la cara no está */ } }
}
function montarCara() {
  const f = $('bb-cara-frame');
  f.addEventListener('load', () => {
    caraLista = true;
    // da-context: la cara fija este origen como anfitrión de confianza (aunque llegue sin referrer).
    try { f.contentWindow.postMessage({ type: 'da-context', lang }, caraOrigen); } catch { /* sin cara */ }
    avisarBugito(true);
  });
  f.src = urlCara();
}
window.addEventListener('message', ev => {
  if (!esDeBugito(ev, $('bb-cara-frame').contentWindow, caraOrigen)) return;
  const d = ev.data;
  if (d.type === 'da-bugito-listo') { caraLista = true; avisarBugito(true); }
  else if (d.type === 'da-bugito-lanzar') lanzar(String(d.incidencia || ''));
});

// ── Pintar ────────────────────────────────────────────────────────────────────────────────
function traducir() {
  document.querySelectorAll('[data-bb]').forEach(n => { const v = textos[lang][n.dataset.bb]; if (typeof v === 'string') n.textContent = v; });
  $('bb-toggle').textContent = document.querySelector('.bugito-banco').classList.contains('sin-bugito') ? tr('show') : tr('hide');
  pintarMenu(); pintar();
}
function pintarMenu() {
  const menu = $('bb-menu'), titulo = $('bb-menu-title');
  menu.replaceChildren(titulo, ...CATALOGO.map(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.tipo = t.id; b.title = t.ayuda[lang] || t.ayuda.es;
    b.setAttribute('aria-pressed', String(prueba.tipo === t.id && !!prueba.envio && !prueba.vuelta));
    const ico = document.createElement('span'); ico.className = 'ico'; ico.setAttribute('aria-hidden', 'true'); ico.textContent = ICONO[t.id] || '⚡';
    const txt = document.createElement('span'); txt.textContent = t[lang] || t.es;
    b.append(ico, txt);
    b.addEventListener('click', () => lanzar(t.id));
    return b;
  }));
  const pre = resolverIncidencia(params.get('incidencia'));
  if (pre && pre !== 'normal' && !prueba.envio) { const b = menu.querySelector(`[data-tipo="${pre}"]`); if (b) b.classList.add('pre'); }
}
function acuseTexto(acuse, envio) {
  if (acuse && acuse.seen) return acuse.ack && acuse.ack.status === 'executed' ? tr('ackOk') : tr('ackFail');
  return envio && Date.now() - envio.en > ACUSE_MAX_MS ? tr('noAck') : tr('waitAck');
}
function enlace(id, stage) {
  const a = document.createElement('a');
  a.href = fichaYokup(id); a.target = '_blank'; a.rel = 'noopener';
  a.textContent = id + (stage ? ` · ${tr('stage')[stage] || stage}` : '');
  return a;
}
function pintar() {
  for (const b of $('bb-menu').querySelectorAll('button')) {
    b.disabled = ocupado || !P;
    b.setAttribute('aria-pressed', String(prueba.tipo === b.dataset.tipo && !!prueba.envio && !prueba.vuelta));
  }
  $('bb-normal').disabled = ocupado || !P;
  // Pasos de la prueba en curso.
  const t = prueba.tipo, det = t ? detectores[t] : null, inc = t ? incidencias[t] : null;
  const pz = pasos({ envio: prueba.envio, acuse: prueba.acuse, detector: det, incidencia: inc });
  for (const paso of pz) if (paso.hecho && prueba.envio) prueba.marcas.add(paso.id);
  const ol = $('bb-pasos');
  ol.hidden = !prueba.envio;
  ol.replaceChildren(...pz.map(paso => {
    const li = document.createElement('li');
    li.className = paso.fallido ? 'err' : prueba.marcas.has(paso.id) ? 'ok' : '';
    const n = document.createElement('span'); n.textContent = tr(paso.id); li.append(n);
    let extra = '';
    if (paso.id === 'enviada' && prueba.envio) extra = prueba.envio.ok ? `${nombre(t)} · ${prueba.envio.cmd}` : prueba.envio.error;
    else if (paso.id === 'acuse' && prueba.envio && prueba.envio.ok) extra = acuseTexto(prueba.acuse, prueba.envio);
    else if (paso.id === 'abierta') { const id = (inc && inc.id) || (det && (det.incidencia || det.ultima)); if (id) extra = enlace(id, inc && inc.stage); }
    if (extra) { const s = document.createElement('small'); if (extra instanceof Node) s.append(extra); else s.textContent = extra; li.append(' · ', s); }
    return li;
  }));
  if (prueba.vuelta) {
    const li = document.createElement('li'), a = prueba.vueltaAcuse;
    li.className = a && a.seen ? (a.ack && a.ack.status === 'executed' ? 'ok' : 'err') : '';
    li.textContent = `${tr('clearSent')} · ${!prueba.vuelta.ok ? (prueba.vuelta.error || '') : acuseTexto(a, prueba.vuelta)}`;
    ol.append(li); ol.hidden = false;
  }
  // Detectores: uno por tipo, con su medida en vivo.
  const ahora = Date.now(), quedan = d => Math.max(0, Math.ceil((GRACIA_BANCO_MS - (ahora - d)) / 1000));
  $('bb-detectores').replaceChildren(...CATALOGO.map(c => {
    const li = document.createElement('li'), d = detectores[c.id], o = observaciones[c.id];
    const b = document.createElement('b'); b.textContent = c[lang] || c.es; li.append(b);
    const fase = d && !d.sinDato ? d.fase : '';
    if (fase === 'fallo' || fase === 'sospecha' || fase === 'recuperando') li.className = 'fallo'; else if (fase === 'casa') li.className = 'casa';
    const f = tr('fases'), texto = !fase ? '' : typeof f[fase] === 'function' ? f[fase](quedan(d.desde)) : f[fase];
    const sinSenal = !o || !o.lectura || o.lectura.estado === 'sin-senal';
    const medida = o && o.pintada != null ? medidaTexto(c.id, o, lang) : sinSenal ? tr('waiting') : tr('noMeasure');
    li.append(document.createTextNode(medida + (texto ? ` · ${texto}` : '')));
    const id = (incidencias[c.id] && incidencias[c.id].id) || (d && d.incidencia);
    if (id) { li.append(' · '); li.append(enlace(id, incidencias[c.id] && incidencias[c.id].stage)); }
    return li;
  }));
  $('bb-vivo').textContent = !lectura ? '' : lectura.estado === 'sin-senal' ? tr('noSignal', lectura.motivo) : '';
  const st = $('bb-status'); st.textContent = prueba.mensaje; st.classList.toggle('err', prueba.error);
  avisarBugito();
}

// ── El detector, en esta pestaña ──────────────────────────────────────────────────────────
let enCurso = null;
function vuelta() {
  if (!enCurso) enCurso = vueltaUnica().finally(() => { enCurso = null; });
  return enCurso;
}
async function vueltaUnica() {
  if (!P || document.hidden) return;
  const ahora = Date.now();
  let senal = null;
  try { senal = await red.mando.senal(BUGITO_SCREEN); } catch { senal = null; }
  for (const c of CATALOGO) {
    const v = vueltaDetector(detectores[c.id], { plan: BANCO, pantalla: P, tipo: c.id, senal, ahora, graciaMs: GRACIA_BANCO_MS, by, planoUrl: location.href.split('#')[0] });
    lectura = v.observacion.lectura; observaciones[c.id] = v.observacion;
    let e = v.estado;
    if (e.accion) {
      const accion = e.accion;
      let r;
      try { r = v.body ? await (accion === 'abrir' ? red.yokup.abrir(v.body) : red.yokup.cerrar(v.body)) : { ok: false, error: 'sin_recurso' }; }
      catch (err) { r = { ok: false, error: String(err && err.message || err) }; }
      e = anotar(e, accion, r);
      if (r.ok) { prueba.mensaje = accion === 'abrir' ? tr('opened', r.id) : tr('closed', r.id || e.ultima); prueba.error = false; ultimoYokup = 0; }
      else if (r.retenida) { prueba.mensaje = tr('held', e.ultima); prueba.error = false; }
      else { prueba.mensaje = tr('yokupError', r.error); prueba.error = true; }
    }
    detectores[c.id] = { ...e, accion: null };
    guardar(c.id);
  }
  // Acuses pendientes.
  if (prueba.envio && prueba.envio.ok && !(prueba.acuse && prueba.acuse.seen) && ahora - prueba.envio.en <= ACUSE_MAX_MS)
    prueba.acuse = await red.mando.acuse(prueba.envio.id, prueba.envio.action).catch(() => prueba.acuse);
  if (prueba.vuelta && prueba.vuelta.ok && !(prueba.vueltaAcuse && prueba.vueltaAcuse.seen) && ahora - prueba.vuelta.en <= ACUSE_MAX_MS)
    prueba.vueltaAcuse = await red.mando.acuse(prueba.vuelta.id, prueba.vuelta.action).catch(() => prueba.vueltaAcuse);
  // Estado de los tickets en Yokup (carril público, recursos demo:).
  if (ahora - ultimoYokup >= ESTADO_YOKUP_MS) {
    ultimoYokup = ahora;
    const ids = CATALOGO.flatMap(c => [detectores[c.id] && detectores[c.id].incidencia, detectores[c.id] && detectores[c.id].ultima]).filter(Boolean);
    const e = await red.yokup.estado(`${DEMO_PREFIX}${BANCO.id}:`, ids).catch(() => null);
    if (e && e.ok) for (const c of CATALOGO) incidencias[c.id] = incidenciaDe(e.incidents, recurso(BANCO, P, c.id)) || incidencias[c.id] || null;
  }
  pintar();
}
function programar() { clearTimeout(sondeo); sondeo = setTimeout(async () => { try { await vuelta(); } catch { /* el siguiente sondeo lo reintenta */ } programar(); }, SONDEO_MS); }

// ── Lanzar (botones, chips de Bugito y /bugito <incidencia>) ──────────────────────────────
async function lanzar(texto) {
  const id = resolverIncidencia(texto);
  if (!id) { prueba.mensaje = tr('unknown', String(texto || '').slice(0, 40)); prueba.error = true; pintar(); return prueba.mensaje; }
  if (!P || ocupado) return '';
  const normal = id === 'normal';
  // La orden la construye el Creador de incidencias: dirigida a la cola de la propia pantalla de laboratorio.
  const o = orden(normal ? CATALOGO[0].id : id, BUGITO_SCREEN, { vuelta: normal });
  if (!o.ok) { prueba.mensaje = tr('rejected', o.error); prueba.error = true; pintar(); return prueba.mensaje; }
  ocupado = true; prueba.mensaje = tr('sending'); prueba.error = false;
  if (!normal) Object.assign(prueba, { tipo: id, envio: { ok: true, en: Date.now(), cmd: o.body.cmd, pendiente: true }, acuse: null, vuelta: null, vueltaAcuse: null, marcas: new Set() });
  pintar();
  let r;
  try { r = await red.mando.enviar(o.body); } catch { r = { ok: false, error: tr('netError') }; }
  r = { ...r, en: Date.now(), cmd: o.body.cmd };
  if (normal) { prueba.vuelta = r; prueba.vueltaAcuse = null; }
  else {
    prueba.envio = r; incidencias[id] = null;
    // Una prueba nueva no hereda el «resuelta» de la anterior.
    if (detectores[id]) { detectores[id] = { ...detectores[id], ultima: null }; guardar(id); }
  }
  prueba.mensaje = r.ok ? tr('sent', o.body.cmd) : tr('rejected', r.error); prueba.error = !r.ok;
  ocupado = false; pintar();
  vuelta().catch(() => {});
  return r.ok ? tr('launched', nombre(id)) : prueba.mensaje;
}
function alternarBugito(mostrar) {
  const main = document.querySelector('.bugito-banco');
  const ver = typeof mostrar === 'boolean' ? mostrar : main.classList.contains('sin-bugito');
  main.classList.toggle('sin-bugito', !ver);
  $('bb-toggle').textContent = ver ? tr('hide') : tr('show');
  return ver ? tr('shown') : tr('hidden');
}
// /bugito del ⌘ Experto (admiranext.com/assets/avatar.js y suite/experto.js): aquí lo atiende la página.
window.AdmiraBugito = {
  toggle: () => alternarBugito(),
  lanzar: arg => lanzar(arg),
  estado: () => ({ ...estadoActual(), screen: BUGITO_SCREEN, detectores: JSON.parse(JSON.stringify(detectores)) })
};

function arrancar() {
  $('bb-normal').addEventListener('click', () => lanzar('normal'));
  $('bb-toggle').addEventListener('click', () => alternarBugito());
  document.addEventListener('admira:lang', e => {
    const next = e.detail?.lang === 'es' ? 'es' : 'en';
    if (next === lang) return;
    lang = next; traducir();
    try { $('bb-cara-frame').contentWindow.postMessage({ type: 'da-bugito', ...mensajeBugito(estadoActual().estado, { lang, silencio: true }) }, caraOrigen); } catch { /* sin cara */ }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) vuelta().catch(() => {}); });
  $('bb-screen').textContent = BUGITO_SCREEN;
  $('bb-player-frame').src = playerUrl({ base: playerBase, lang });
  montarCara();
  traducir();
  const pre = resolverIncidencia(params.get('incidencia'));
  if (pre && pre !== 'normal') { prueba.mensaje = tr('presel', nombre(pre)); pintar(); }
  programar(); vuelta().catch(() => {});
}
arrancar();
