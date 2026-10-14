// ▤ Creador de incidencias (DCL-34d5bbccb9cc227bb752a419, Carlos 14-oct-2026): «un agente que
// testea todas las incidencias posibles en un player; lo iremos alimentando poco a poco, pero
// empezando por formato girado. Una especie de mando a distancia al que le haremos enviar
// incidencias a las pantallas, empezando por el MBP16».
//
// Lógica PURA, sin red ni DOM. La usan la UI del ▤ Modo avanzado del plano (plano-incidencias.mjs)
// y el agente de consola (tools/agente-incidencias.mjs); la red vive en incidencias-adaptadores.mjs.
//
//  1. Inyección: una orden del mando (`fault-rotate` / `fault-clear`, cola /locations/cmd) que el
//     backend sólo acepta para pantallas de laboratorio (omnipublicity-api src/fault-lab.js).
//  2. Detección: el plano dice qué orientación ESPERA cada pantalla; el player DECLARA en
//     /signage/now la que pinta, medida del DOM (display.painted). No hay marca de prueba que
//     leer: el detector compara esperada y pintada y, si no casan durante GRACIA_MS, abre UNA
//     incidencia por fallo; cuando vuelven a casar otros GRACIA_MS, la cierra.

export const MANDO_CMD = 'https://api.admira.store/locations/cmd';
export const MANDO_ACK = 'https://api.admira.store/locations/cmd/ack';
export const SIGNAGE_NOW = 'https://api.admira.store/signage/now';
export const YOKUP_INCIDENT = 'https://api.yokup.com/incident';
export const YOKUP_STATUS = 'https://api.yokup.com/incident/status';
export const YOKUP_TICKET = 'https://www.yokup.com/ticket?id=';
export const YOKUP_INCIDENCIAS = 'https://www.yokup.com/incidencias';
export const YOKUP_MCP = 'https://yokup.com/mcp';

export const GRACIA_MS = 30000;      // N: segundos seguidos sin casar antes de abrir (y casando antes de cerrar)
export const FRESCURA_MS = 330000;   // /signage/now caduca a los 300 s; más viejo que esto = sin señal
export const REINTENTO_MS = 60000;   // si abrir o cerrar falla, se reintenta como mucho una vez por minuto
export const DEMO_PREFIX = 'demo:';  // carril público de Yokup (POST /incident): sólo recursos demo:
export const ORIGEN = 'creador-incidencias';

// Espejo de la lista del backend (omnipublicity-api src/fault-lab.js). MANDA EL BACKEND, que
// devuelve 403 a cualquier otra pantalla: aquí sólo sirve para no ofrecer lo que se rechazaría.
export const PANTALLAS_LAB = Object.freeze(['macbookpro16']);
export const VIRTUAL_RE = /^virtual-[a-z0-9][a-z0-9-]{2,60}$/;
const SCREEN_RE = /^[a-z0-9][a-z0-9_-]{1,59}$/;
const ITIL_RE = /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ID_TICKET = /^[A-Z]{3}-[A-Z0-9]{4,10}$/;

export function pantallaLab(screen) {
  const s = String(screen || '');
  return PANTALLAS_LAB.includes(s) || VIRTUAL_RE.test(s);
}

// ── Catálogo: se alimenta poco a poco. Cada tipo dice qué orden lo provoca, cuál lo deshace y
//    qué detector lo reconoce. Para añadir uno: entrada aquí + orden en el player + detector.
export const CATALOGO = Object.freeze([
  Object.freeze({
    id: 'formato-girado', orden: 'fault-rotate', vuelta: 'fault-clear', detector: 'orientacion',
    es: 'Formato girado', en: 'Rotated format',
    ayuda: Object.freeze({
      es: 'El player gira la emisión 90°: una pantalla horizontal pinta en vertical (y al revés). Caduca sola a los 30 min.',
      en: 'The player turns its output 90°: a landscape screen paints portrait (and vice versa). Expires by itself after 30 min.'
    })
  })
]);
export const tipoIncidencia = id => CATALOGO.find(t => t.id === id) || null;

// ── Pantallas del plano ─────────────────────────────────────────────────────────────────────
export function orientacionEsperada(p) {
  if (p && (p.orientacion === 'horizontal' || p.orientacion === 'vertical')) return p.orientacion;
  const r = p && (Array.isArray(p.resolucion) ? p.resolucion : Array.isArray(p.aspecto) ? p.aspecto : null);
  if (r && Number(r[0]) > 0 && Number(r[1]) > 0) return Number(r[0]) >= Number(r[1]) ? 'horizontal' : 'vertical';
  return null;
}
export function screenDe(p) {
  const s = String((p && (p.screenId || p.playerVirtual)) || '');
  return SCREEN_RE.test(s) ? s : '';
}
export function pantallasDelPlano(plan) {
  const lista = plan && Array.isArray(plan.pantallas) ? plan.pantallas : [];
  return lista.map(p => {
    const screen = screenDe(p);
    return {
      id: String(p.id || ''), itil: ITIL_RE.test(String(p.itil || '')) ? p.itil : '', nombre: String(p.nombre || p.id || ''),
      corto: String(p.corto || ''), screen, esperada: orientacionEsperada(p), lab: !!screen && pantallaLab(screen)
    };
  });
}

// ── Mando: la orden que provoca un tipo y la que lo deshace ────────────────────────────────
export function orden(tipo, screen, { vuelta = false } = {}) {
  const t = tipoIncidencia(tipo);
  if (!t) return { ok: false, error: 'tipo_desconocido' };
  if (!pantallaLab(screen)) return { ok: false, error: 'pantalla_no_lab' };
  // La cola es la de la PROPIA pantalla y la orden va dirigida: nunca un broadcast del circuito.
  return { ok: true, body: { id: screen, screen, cmd: vuelta ? t.vuelta : t.orden } };
}

// ── Lo que el player declara que pinta (/signage/now) ───────────────────────────────────────
const cuarto = v => {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() ? Number(v) : NaN);
  return [0, 90, 180, 270].includes(n) ? n : null;
};
export function pintadaPorGiro(giro, ancho, alto) {
  const g = cuarto(giro), w = Number(ancho), h = Number(alto);
  if (g === null || !(w > 0) || !(h > 0)) return null;
  return ((w >= h) !== (g % 180 !== 0)) ? 'horizontal' : 'vertical';
}
export function lecturaSenal(senal, { ahora = Date.now(), frescuraMs = FRESCURA_MS } = {}) {
  if (!senal || typeof senal !== 'object' || senal.ok === false) return { estado: 'sin-senal', motivo: 'sin-respuesta' };
  const visto = Number(senal.lastSeen);
  if (!(visto > 0)) return { estado: 'sin-senal', motivo: 'no-declara' };
  if (ahora - visto > frescuraMs) return { estado: 'sin-senal', motivo: 'latido-viejo', visto };
  if (senal.standby) return { estado: 'sin-senal', motivo: 'standby', visto };
  const d = (senal.device && senal.device.display) || {};
  const ancho = Number(d.width) || Number(d.cssWidth) || 0, alto = Number(d.height) || Number(d.cssHeight) || 0;
  const giro = cuarto(d.paintedRotation);
  if (d.painted === 'horizontal' || d.painted === 'vertical') return { estado: 'ok', pintada: d.painted, giro, fuente: 'medida', visto };
  const porMedida = pintadaPorGiro(giro, ancho, alto);
  if (porMedida) return { estado: 'ok', pintada: porMedida, giro, fuente: 'medida', visto };
  // Players anteriores: sin medida, el giro del operador sobre el panel (no saben inyectar fallos).
  const porOperador = pintadaPorGiro(d.rotation, ancho, alto);
  if (porOperador) return { estado: 'ok', pintada: porOperador, giro: cuarto(d.rotation), fuente: 'giro-operador', visto };
  return { estado: 'sin-dato', motivo: 'no-declara-orientacion', visto };
}

// ── El detector: una máquina de estados por pantalla y tipo ────────────────────────────────
// casa → sospecha (no casa) → fallo (≥ gracia: ABRIR) → recuperando (casa) → casa (≥ gracia: RESOLVER).
// Sin dato o sin señal NO se mueve: nunca abre ni cierra a ciegas. `incidencia` la rellena quien
// ejecuta la acción; mientras falte en «fallo» (o sobre en «casa») se reintenta cada REINTENTO_MS.
export function evaluar(prev, { esperada, pintada } = {}, { ahora = Date.now(), graciaMs = GRACIA_MS, reintentoMs = REINTENTO_MS } = {}) {
  const s = { fase: 'casa', desde: ahora, incidencia: null, intento: 0, ...(prev || {}) };
  if (!esperada || !pintada) return { ...s, sinDato: true, accion: null };
  const casa = pintada === esperada;
  const out = { ...s, sinDato: false, accion: null, esperada, pintada };
  switch (s.fase) {
    case 'sospecha':
      if (casa) return { ...out, fase: 'casa', desde: ahora };
      if (ahora - s.desde >= graciaMs) return { ...out, fase: 'fallo', desde: ahora, accion: 'abrir', intento: ahora };
      return out;
    case 'fallo':
      if (casa) return { ...out, fase: 'recuperando', desde: ahora };
      if (!s.incidencia && ahora - (s.intento || 0) >= reintentoMs) return { ...out, accion: 'abrir', intento: ahora };
      return out;
    case 'recuperando':
      if (!casa) return { ...out, fase: 'fallo', desde: ahora };
      if (ahora - s.desde >= graciaMs) return { ...out, fase: 'casa', desde: ahora, accion: 'resolver', intento: ahora };
      return out;
    default:
      if (!casa) return { ...out, fase: 'sospecha', desde: ahora };
      if (s.incidencia && ahora - (s.intento || 0) >= reintentoMs) return { ...out, fase: 'casa', accion: 'resolver', intento: ahora };
      return { ...out, fase: 'casa' };
  }
}
// Tras ejecutar la acción: con éxito se apunta (o se olvida) la incidencia; si falla, se reintenta.
export function anotar(estado, accion, resultado) {
  if (!resultado || !resultado.ok) return { ...estado, error: (resultado && resultado.error) || 'error' };
  if (accion === 'abrir') return { ...estado, incidencia: resultado.id || estado.incidencia || 'abierta', url: resultado.url || estado.url || '', error: '' };
  if (accion === 'resolver') return { ...estado, incidencia: null, ultima: estado.incidencia, url: estado.url || '', error: '' };
  return estado;
}

// ── Yokup: el recurso y los cuerpos de apertura y cierre ───────────────────────────────────
// Una incidencia ACTIVA por recurso (Yokup lo garantiza con idx_active_screen): el recurso es
// Xpacio + CI + tipo, así que el mismo fallo nunca abre dos y dos fallos distintos no se mezclan
// con la «pantalla sin señal» del sensor de players (cuyo recurso es la pantalla a secas).
// Las pantallas de laboratorio van por el carril público `demo:` (ciclo completo: abrir, estado,
// cerrar); una pantalla real necesitaría el MCP de flota con incidents:write (adaptador listo).
export function recurso(plan, pantalla, tipo) {
  const xp = SLUG_RE.test(String(plan && plan.id || '')) ? plan.id : '';
  const ci = (pantalla && (pantalla.itil || pantalla.id)) || '';
  if (!xp || !ci || !tipoIncidencia(tipo)) return '';
  const base = `${xp}:${ci}:${tipo}`;
  return (pantalla.lab ? DEMO_PREFIX : 'itil:') + base;
}
export function proyecto(plan) {
  const p = String((plan && plan.yokup && plan.yokup.project_id) || '');
  return SLUG_RE.test(p) ? p : '';
}
const recorta = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').slice(0, n);
export function apertura({ plan, pantalla, tipo, lectura, esperada, desde, ahora = Date.now(), by = 'Creador de incidencias', planoUrl = '' }) {
  const t = tipoIncidencia(tipo), res = recurso(plan, pantalla, tipo);
  if (!t || !res) return null;
  const pintada = (lectura && lectura.pintada) || '?';
  const giro = lectura && lectura.giro !== null && lectura.giro !== undefined ? ` (giro medido ${lectura.giro}°)` : '';
  const seg = desde ? Math.max(0, Math.round((ahora - desde) / 1000)) : 0;
  const ci = pantalla.itil || pantalla.id;
  const body = {
    subject: recorta(`${ci} · ${t.es}: ${pantalla.nombre} pinta en ${pintada} y debe ir en ${esperada}`, 200),
    detail: recorta([
      `Detectado por el agente del Creador de incidencias: la pantalla «${pantalla.nombre}» (CI ${ci}, player ${pantalla.screen}) debe pintar en ${esperada} según el plano y declara en /signage/now que pinta en ${pintada}${giro}${seg ? `, sin casar desde hace ${seg} s` : ''}.`,
      `Xpacio: ${plan.nombre || plan.id}.${planoUrl ? ` Plano: ${planoUrl}` : ''}`,
      pantalla.lab ? 'Pantalla de laboratorio: el fallo puede ser una prueba inyectada desde el ▤ Modo avanzado (orden fault-rotate); se cierra sola cuando vuelve a casar.' : ''
    ].filter(Boolean).join('\n'), 2000),
    resource: res, kind: 'screen', severity: 'alta', source: ORIGEN, by: recorta(by, 60), loc: plan.id
  };
  const pid = proyecto(plan);
  if (pid) body.project_id = pid;
  return body;
}
export function cierre({ plan, pantalla, tipo, id = '', by = 'Creador de incidencias', nota = '' }) {
  const res = recurso(plan, pantalla, tipo);
  if (!res) return null;
  const body = { close: true, resource: res, by: recorta(by, 60),
    note: recorta(nota || `Vuelve a casar: la pantalla pinta en la orientación que espera el plano (${pantalla.esperada}).`, 500) };
  if (ID_TICKET.test(String(id || ''))) body.id = id;
  return body;
}
export const fichaYokup = id => (ID_TICKET.test(String(id || '')) ? YOKUP_TICKET + encodeURIComponent(id) : YOKUP_INCIDENCIAS);
// Del listado público (GET /incident/status) la incidencia de este recurso: la activa más reciente
// o, si no hay, la última cerrada.
export function incidenciaDe(incidencias, res) {
  const mias = (Array.isArray(incidencias) ? incidencias : []).filter(i => i && i.resource === res && i.stage !== 'cancelada');
  const activa = mias.filter(i => i.stage !== 'cerrada').sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
  if (activa) return activa;
  return mias.sort((a, b) => (b.resolved_at || 0) - (a.resolved_at || 0))[0] || null;
}

// ── Pasos que pinta la UI: orden enviada → acuse → detectada → incidencia abierta → resuelta ──
export const PASOS = Object.freeze(['enviada', 'acuse', 'detectada', 'abierta', 'resuelta']);
export function pasos({ envio = null, acuse = null, detector = null, incidencia = null } = {}) {
  const hecho = {
    enviada: !!(envio && envio.ok),
    acuse: !!(acuse && acuse.seen && acuse.ack && acuse.ack.status === 'executed'),
    detectada: !!(detector && (detector.fase === 'fallo' || detector.fase === 'recuperando' || detector.incidencia)),
    abierta: !!((incidencia && incidencia.id) || (detector && detector.incidencia)),
    resuelta: !!((incidencia && incidencia.stage === 'cerrada') || (detector && detector.ultima && !detector.incidencia && detector.fase === 'casa'))
  };
  const fallido = !!(acuse && acuse.seen && acuse.ack && acuse.ack.status === 'failed');
  return PASOS.map(id => ({ id, hecho: hecho[id], fallido: id === 'acuse' && fallido }));
}
