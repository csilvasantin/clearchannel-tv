// Supervisor visto desde admira.biz (Morfeo, 18-oct-2026): lectura pura del tablero que publica la Insta360
// del MacMini en api.yokup.com/supervisor. La cámara mira sólo el MBP16 del laboratorio (GDG51-PAN-07) y ve si
// su pantalla luce o está a oscuras; los fallos que no la apagan (giro, popup, lienzo, recorte) los mide el
// reproductor y el Supervisor los registra como incidencia. Este módulo no envía, no anota y no cierra nada:
// lo usan el banco de Bugito (supervisor-live.mjs) y /supervisor estado del ⌘ Experto (expert-panel.js).
export const SUPERVISOR_API = 'https://api.yokup.com/supervisor/soluciones?id=macmini-insta360';
export const SUPERVISOR_WEB = 'https://www.admira.app/supervisor';
export const POSICION = 'mbp16-pantalla';
export const OBJETIVO = Object.freeze({nombre: 'MBP16', ci: 'GDG51-PAN-07', screen: 'macbookpro16'});
// El tablero se publica cada ~5 s: más de un minuto sin publicarse es que el Supervisor no está mirando.
export const FRESCO_MS = 60000;
// La cámara confirma un negro con dos fotos (2 s) y la telemetría pide dos medidas frescas del reproductor.
export const VEREDICTO_MS = 120000;
const INC = /^INC-[A-Z0-9]{3,16}$/;
const FOTO = /^https:\/\/api\.yokup\.com\/media\/fleet\/[A-Za-z0-9_-]{6,64}\.(?:jpe?g|png|webp)$/;

const fecha = v => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : NaN; };
function ticket(i) {
  if (!i || !INC.test(String(i.id))) return null;
  return {id: i.id, url: 'https://www.admira.app/ticket?id=' + encodeURIComponent(i.id), cuando: fecha(i.cuando)};
}

// estado: encendida | apagada | sin-dato (la cámara no puede ver: persona delante o poca luz)
//         | sin-senal (el tablero no responde, no trae el MBP16 o lleva más de un minuto sin publicarse).
// capturada es la hora de la última captura; la foto publicada puede ser anterior (se sube al cambiar o cada 3 min).
export function leerTablero(payload, ahora = Date.now(), posicion = POSICION) {
  const ok = !!payload && payload.ok === true && Array.isArray(payload.posiciones);
  const p = ok ? payload.posiciones.find(x => x && x.id === posicion) : null;
  const publicado = fecha(ok && payload.cuando);
  const edad = ahora - publicado;
  const fresco = !!p && Number.isFinite(publicado) && edad > -5000 && edad < FRESCO_MS;
  const abiertas = (ok && Array.isArray(payload.abiertas) ? payload.abiertas : [])
    .filter(i => i && i.posicion === posicion).map(ticket).filter(Boolean);
  const propia = ticket(p && p.incidencia);
  if (propia && !abiertas.some(i => i.id === propia.id)) abiertas.push(propia);
  abiertas.sort((a, b) => (Number.isFinite(b.cuando) ? b.cuando : -1) - (Number.isFinite(a.cuando) ? a.cuando : -1));
  return {
    estado: !fresco ? 'sin-senal' : (p.estado === 'encendida' || p.estado === 'apagada' ? p.estado : 'sin-dato'),
    fresco,
    edadMs: Number.isFinite(edad) ? Math.max(0, edad) : null,
    ciclo: ok && Number.isInteger(payload.ciclo) ? payload.ciclo : null,
    foto: p && FOTO.test(String(p.foto || '')) ? p.foto : '',
    capturada: fecha(p && p.cuando),
    abiertas
  };
}

export async function leerSupervisor(fetcher = globalThis.fetch, {ahora = () => Date.now(), signal} = {}) {
  try {
    const r = await fetcher(SUPERVISOR_API, {cache: 'no-store', signal});
    return leerTablero(r.ok ? await r.json() : null, ahora());
  } catch { return leerTablero(null, ahora()); }
}

// Lo que debería ver el Supervisor tras cada orden física al MBP16 (bugito-command-core.mjs FAULTS + pantalla).
export function esperado(fault) {
  if (fault === 'black' || fault === 'display-off') return 'apagada';
  if (fault === 'clear' || fault === 'display-on') return 'encendida';
  if (['rotate', 'popup', 'canvas', 'half'].includes(fault)) return 'incidencia';
  return '';
}

// Veredicto honesto: «visto» sólo con una captura posterior a la orden en el estado esperado o con una
// incidencia que no estaba abierta antes. Mientras dura el plazo, «esperando»; al acabar, nunca se supone nada.
export function veredicto({fault, antes = null, lectura = null, desde, ahora = Date.now(), plazo = VEREDICTO_MS}) {
  const espera = esperado(fault);
  if (!espera || !Number.isFinite(desde)) return {estado: 'desconocido', espera};
  const previas = new Set((antes && antes.abiertas || []).map(i => i.id));
  const nueva = (lectura && lectura.abiertas || []).find(i => !previas.has(i.id) && !(i.cuando < desde - 5000)) || null;
  const despues = !!lectura && lectura.fresco && lectura.capturada >= desde;
  const abierta = nueva || (lectura && lectura.abiertas[0]) || null;
  if (espera !== 'incidencia' && despues && lectura.estado === espera) return {estado: 'visto', por: 'camara', espera, incidencia: abierta};
  // Un negro puede llegar antes por la telemetría del reproductor (standby) que por la cámara.
  if (nueva && espera !== 'encendida') return {estado: 'visto', por: 'incidencia', espera, incidencia: nueva};
  if (ahora - desde < plazo) return {estado: lectura && lectura.estado === 'sin-senal' ? 'esperando-senal' : 'esperando', espera};
  if (!lectura || lectura.estado === 'sin-senal') return {estado: 'sin-senal', espera};
  if (espera !== 'incidencia' && lectura.estado === 'sin-dato') return {estado: 'sin-dato', espera};
  if (espera === 'incidencia' && abierta) return {estado: 'sin-nueva', espera, incidencia: abierta};
  return {estado: 'no-visto', espera, incidencia: abierta};
}

const L = (lang, es, en) => (lang === 'en' ? en : es);
const ESTADOS = {
  encendida: ['Pantalla encendida', 'Screen on'],
  apagada: ['Pantalla a oscuras', 'Screen dark'],
  'sin-dato': ['No se ve: persona delante o poca luz', 'Not visible: someone in front or low light'],
  'sin-senal': ['Sin señal del Supervisor', 'No signal from Supervisor']
};
export function textoEstado(estado, lang) { const t = ESTADOS[estado] || ESTADOS['sin-senal']; return lang === 'en' ? t[1] : t[0]; }
export function textoEdad(ms, lang) {
  if (!Number.isFinite(ms)) return '';
  const s = Math.round(ms / 1000);
  if (s < 90) return L(lang, `hace ${s} s`, `${s} s ago`);
  const m = Math.round(s / 60);
  return m < 90 ? L(lang, `hace ${m} min`, `${m} min ago`) : L(lang, `hace ${Math.round(m / 60)} h`, `${Math.round(m / 60)} h ago`);
}

export function textoVeredicto(v, lang) {
  const inc = v.incidencia ? ' · ' + v.incidencia.id : '';
  switch (v.estado) {
    case 'visto':
      if (v.espera === 'apagada' && v.por === 'camara') return L(lang, 'El Supervisor lo ha visto: la cámara ve la pantalla del MBP16 a oscuras', 'Supervisor saw it: the camera sees the MBP16 screen dark') + inc + '.';
      if (v.espera === 'encendida') return L(lang, 'El Supervisor ve la pantalla del MBP16 encendida otra vez', 'Supervisor sees the MBP16 screen on again') +
        (v.incidencia ? L(lang, `. ${v.incidencia.id} sigue abierta hasta que alguien la revise.`, `. ${v.incidencia.id} stays open until someone reviews it.`) : '.');
      return L(lang, 'El Supervisor lo ha registrado en una incidencia nueva', 'Supervisor recorded it in a new incident') + inc + '.';
    case 'esperando': return L(lang, 'Esperando a que el Supervisor lo vea (cámara cada 5 s, telemetría hasta 2 min)…', 'Waiting for Supervisor to see it (camera every 5 s, telemetry up to 2 min)…');
    case 'esperando-senal': return L(lang, 'Esperando al Supervisor: ahora mismo no publica lecturas…', 'Waiting for Supervisor: it is not publishing readings right now…');
    case 'sin-senal': return L(lang, 'Sin veredicto: el Supervisor no ha publicado lecturas en este tiempo.', 'No verdict: Supervisor published no readings in this time.');
    case 'sin-dato': return L(lang, 'Sin veredicto: la cámara no ve la pantalla (persona delante o poca luz).', 'No verdict: the camera cannot see the screen (someone in front or low light).');
    case 'sin-nueva': return L(lang, `El Supervisor no ha abierto una incidencia nueva en 2 min; sigue abierta ${v.incidencia.id}, donde puede haberlo anotado.`, `Supervisor opened no new incident in 2 min; ${v.incidencia.id} is still open and may hold the note.`);
    case 'no-visto': return v.espera === 'incidencia'
      ? L(lang, 'El Supervisor no ha registrado el fallo en 2 min.', 'Supervisor did not record the fault in 2 min.')
      : L(lang, 'El Supervisor no ha visto el cambio en la pantalla en 2 min.', 'Supervisor did not see the screen change in 2 min.');
    default: return L(lang, 'Esta orden no tiene veredicto del Supervisor.', 'This command has no Supervisor verdict.');
  }
}

// Parte para la consola: una línea por dato, sin inventar lo que el tablero no trae.
export function parteSupervisor(lectura, lang) {
  const lines = [`Supervisor · ${OBJETIVO.nombre} (${OBJETIVO.ci})`];
  const edad = textoEdad(lectura.edadMs, lang);
  lines.push(textoEstado(lectura.estado, lang) + (lectura.fresco && edad ? L(lang, ' · lectura ', ' · read ') + edad : '') +
    (lectura.fresco && lectura.ciclo != null ? L(lang, ' · ciclo ', ' · cycle ') + lectura.ciclo : ''));
  if (lectura.abiertas.length) for (const i of lectura.abiertas) lines.push(L(lang, 'Incidencia abierta: ', 'Open incident: ') + i.id + ' · ' + i.url);
  else if (lectura.fresco) lines.push(L(lang, 'Sin incidencias abiertas en el MBP16.', 'No open incidents on the MBP16.'));
  if (lectura.foto) lines.push(L(lang, 'Última foto publicada: ', 'Latest published photo: ') + lectura.foto);
  lines.push(L(lang, 'Tablero: ', 'Board: ') + SUPERVISOR_WEB + L(lang, ' · cámara con controles: /supervisor', ' · camera with controls: /supervisor'));
  return lines;
}
