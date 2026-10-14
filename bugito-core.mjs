// Bugito · banco de pruebas del ▤ Creador de incidencias (DCL-5da4653d859552490fd5ae1d, Carlos 14-oct-2026):
// «en el modo avanzado tenemos que poder probar el creador de incidencias que le llamaremos bugito y será un
// admirito pero en lugar de con pinta angelical con pinta de demonio gracioso rojo y negro y con cuernos, lo
// desplegaremos a la derecha del player virtual y le diremos que genere incidencias en el player».
//
// Lógica PURA del banco (sin red ni DOM): la pantalla de laboratorio, las URL del player virtual y de la cara de
// Bugito (la nube de Admirito con ?personaje=bugito), el alias de cada incidencia y en qué estado está Bugito.
// La red es la del Creador de incidencias (incidencias-adaptadores.mjs) y el detector, el suyo (incidencias-core.mjs).
import { CATALOGO, tipoIncidencia, pantallasDelPlano, pantallaLab, pasos, VIRTUAL_LAB_RE } from './incidencias-core.mjs?v=20261014-bugito-1';

// El player virtual de laboratorio del banco. La salvaguarda del backend (omnipublicity-api src/fault-lab.js)
// sólo acepta órdenes fault-* para `virtual-lab-*`: nunca una pantalla de cliente.
export const BUGITO_SCREEN = 'virtual-lab-bugito';
export const PLAYER_BASE = 'https://admira.tv/canal.html';
// La cara: la nube de Admirito con la piel de Bugito (mismo cargador: admiranext.com/assets/avatar.js).
export const BUGITO_CARA = 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito';
export const BUGITO_ORIGIN = 'https://digitalavatar.ai';
// En el banco el detector no espera 30 s: el player es de laboratorio y los fallos son deterministas.
export const GRACIA_BANCO_MS = 10000;

// El «plano» del banco: una sola pantalla, horizontal, el player virtual de laboratorio.
export const BANCO = Object.freeze({
  id: 'banco-bugito', nombre: 'Banco de pruebas Bugito',
  yokup: Object.freeze({ project_id: 'gran-de-gracia' }),
  pantallas: Object.freeze([Object.freeze({
    id: 'player-virtual-bugito', nombre: 'Player virtual de Bugito', corto: 'Bugito',
    screenId: BUGITO_SCREEN, orientacion: 'horizontal', resolucion: Object.freeze([1920, 1080])
  })])
});
export function pantallaBanco() {
  const p = pantallasDelPlano(BANCO)[0];
  return p && p.lab ? p : null;
}

// ── Objetivo acotado: proyecto · circuito · dispositivo (Carlos 14-oct-2026) ───────────────
// El superusuario escoge sobre qué quiere ver actuar a Bugito. En la Opción A, Bugito NO toca
// un dispositivo de cliente: actúa sobre un player virtual de LABORATORIO nombrado por ese
// circuito y dispositivo (`virtual-lab-<circuito>-<dispositivo>`), así el impacto se ve acotado
// y la salvaguarda del backend (sólo `virtual-lab-*`) sigue intacta. Sin objetivo → el banco.
const slug = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function labScreenPara({ circuito = '', dispositivo = '' } = {}) {
  const cuerpo = [slug(circuito), slug(dispositivo)].filter(Boolean).join('-').slice(0, 36).replace(/-+$/,'');
  const id = `virtual-lab-${cuerpo || 'bugito'}`;
  return VIRTUAL_LAB_RE.test(id) ? id : BUGITO_SCREEN;
}
export const OBJETIVO_BANCO = Object.freeze({ proyecto: '', proyectoLabel: '', circuito: '', dispositivo: '', screen: BUGITO_SCREEN });
// El plano del banco para un objetivo: misma forma que BANCO pero con la pantalla de laboratorio
// derivada. El id del banco no cambia (claves de almacenamiento estables); sí el screenId destino.
export function bancoPara(objetivo = OBJETIVO_BANCO) {
  const screen = objetivo && objetivo.screen && VIRTUAL_LAB_RE.test(objetivo.screen) ? objetivo.screen : BUGITO_SCREEN;
  const nombre = objetivo && objetivo.dispositivo
    ? `${objetivo.proyectoLabel || objetivo.proyecto} · ${objetivo.circuito} · ${objetivo.dispositivo}` : BANCO.nombre;
  return Object.freeze({
    id: BANCO.id, nombre: BANCO.nombre,
    yokup: Object.freeze({ project_id: objetivo && objetivo.proyecto ? objetivo.proyecto : BANCO.yokup.project_id }),
    pantallas: Object.freeze([Object.freeze({
      id: 'player-virtual-bugito', nombre, corto: 'Bugito',
      screenId: screen, orientacion: 'horizontal', resolucion: Object.freeze([1920, 1080])
    })])
  });
}
export function pantallaDe(objetivo = OBJETIVO_BANCO) {
  const p = pantallasDelPlano(bancoPara(objetivo))[0];
  return p && p.lab ? p : null;
}

// Alias de las órdenes (verbo /bugito <x>, chips de Bugito, ?incidencia=) → id del catálogo o «normal».
const ALIAS = [
  ['normal', /^(normal|normalidad|clear|fault-clear|limpiar|limpia|arregla|arreglar|fix|restaurar|back|vuelve)\b|normalidad/],
  ['formato-girado', /^(formato-girado|girar|gira|girado|rotar|rotate|rotated|giro|vuelta|turn)\b/],
  ['cambio-resolucion', /^(cambio-resolucion|resolucion|resolution|lienzo|canvas|cambia-la-resolucion|change)\b/],
  ['popup-encima', /^(popup-encima|popup|pop-up|pop|ventana|aviso|alerta|alert|lanza-un-popup)\b/],
  ['medio-abrir', /^(medio-abrir|medias|a-medias|medio|half|persiana|shutter|abrela-a-medias|half-open)\b/]
];
export function resolverIncidencia(texto) {
  const t = String(texto == null ? '' : texto).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!t) return null;
  if (t === 'normal' || tipoIncidencia(t)) return t;
  for (const [id, re] of ALIAS) if (re.test(t)) return id;
  return null;
}
export const INCIDENCIAS = Object.freeze(CATALOGO.map(t => t.id));

// URL del player virtual (iframe a la izquierda): limpio, sin sonido y a pantalla completa (fit=screen), que es
// como emite un player físico; así el lienzo es la ventana y los detectores de superficie tienen sentido.
export function playerUrl({ base = PLAYER_BASE, lang = 'es', screen = BUGITO_SCREEN } = {}) {
  const u = new URL(base);
  u.searchParams.set('screen', VIRTUAL_LAB_RE.test(screen) ? screen : BUGITO_SCREEN);
  u.searchParams.set('playerType', 'virtual');
  u.searchParams.set('clean', '1');
  u.searchParams.set('muted', '1');
  u.searchParams.set('fit', 'screen');
  // Playlist corta y lenta: es un player real que escribe /signage/now en cada cambio de pieza.
  for (const [k, v] of Object.entries(PLAYLIST_BANCO)) u.searchParams.set(k, v);
  u.searchParams.set('name', lang === 'en' ? "Bugito's virtual player" : 'Player virtual de Bugito');
  return u.href;
}
// Sólo imágenes, tres piezas de 40 s: ~1,5 cambios de pieza por minuto mientras el banco está a la vista.
export const PLAYLIST_BANCO = Object.freeze({ medio: 'image', max: '3', img: '40' });
// El banco pausa (descarga) el player con la pestaña oculta y tras INACTIVO_MS sin que nadie lo toque.
export const INACTIVO_MS = 5 * 60000;
export function debePausar({ oculta = false, ultimoGesto = 0, ahora = Date.now(), inactivoMs = INACTIVO_MS } = {}) {
  if (oculta) return 'oculta';
  return ahora - ultimoGesto >= inactivoMs ? 'inactivo' : '';
}
export function caraUrl({ base = BUGITO_CARA, lang = 'es' } = {}) {
  const u = new URL(base);
  u.searchParams.set('personaje', 'bugito');
  u.searchParams.set('dock', '1');
  u.searchParams.set('lang', lang === 'en' ? 'en' : 'es');
  u.searchParams.set('audio', 'off');
  return u.href;
}
// Sólo en desarrollo (la página servida desde localhost): ?player= y ?cara= pueden apuntar a copias locales.
// En producción se ignoran siempre.
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/;
export function baseLocal(valor, origenPagina) {
  if (!LOCAL.test(String(origenPagina || ''))) return '';
  try { const u = new URL(String(valor || '')); return LOCAL.test(u.origin) ? u.origin + u.pathname : ''; } catch { return ''; }
}

// ── Bugito: en qué estado está, a partir de la prueba en curso ───────────────────────────
// aburrido (nada lanzado) → lanzando (orden en la cola) → tramando (el player la ejecutó; ¿la pillarán?) →
// celebrando (¡incidencia abierta en Yokup!) → derrotado (resuelta: vuelta a la normalidad). Si el mando o
// el player la rechazan: rechazado (Bugito lo cuenta derrotado).
export const ESTADOS = Object.freeze(['aburrido', 'lanzando', 'tramando', 'celebrando', 'derrotado', 'rechazado']);
export function estadoBugito({ envio = null, acuse = null, detector = null, incidencia = null } = {}) {
  if (!envio) return 'aburrido';
  if (!envio.ok) return 'rechazado';
  const ps = pasos({ envio, acuse, detector, incidencia }), hecho = Object.fromEntries(ps.map(p => [p.id, p.hecho]));
  if (ps.some(p => p.fallido)) return 'rechazado';
  if (hecho.resuelta) return 'derrotado';
  if (hecho.abierta) return 'celebrando';
  if (hecho.acuse || hecho.detectada) return 'tramando';
  return 'lanzando';
}
const TICKET = /^[A-Z]{3}-[A-Z0-9]{4,10}$/;
// Mensaje para la cara (nube.js, piel Bugito): {type:'da-bugito', estado, incidencia?, ticket?, lang}.
export function mensajeBugito(estado, { incidencia = '', ticket = '', lang = 'es', silencio = false } = {}) {
  const m = { type: 'da-bugito', estado: ESTADOS.includes(estado) ? estado : 'aburrido', lang: lang === 'en' ? 'en' : 'es' };
  if (incidencia === 'normal' || tipoIncidencia(incidencia)) m.incidencia = incidencia;
  if (TICKET.test(String(ticket || ''))) m.ticket = ticket;
  if (silencio) m.silencio = true;
  return m;
}
// ¿El mensaje viene de la cara de Bugito que incrusta esta página? Origen exacto y la ventana del iframe.
export function esDeBugito(ev, ventanaCara, origenCara = BUGITO_ORIGIN) {
  return !!(ev && ventanaCara && ev.source === ventanaCara && ev.origin === origenCara && ev.data && typeof ev.data === 'object');
}
// La pantalla del banco es de laboratorio para el mando (espejo de la salvaguarda del backend).
export const bancoEsLab = () => pantallaLab(BUGITO_SCREEN);
