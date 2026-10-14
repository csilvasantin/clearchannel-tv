// Subir plano (▤ Modo avanzado de plano.html · DCL-58288891486617b36ed8777d). Sin DOM:
// lo usan plano.mjs y los tests. Lee y valida un plano `admira.xpacio-plano/1` en JSON,
// da de alta una sala rectangular a partir de un calco (imagen o PDF del plano real) y
// guarda lo subido en IndexedDB de este navegador. No hay backend: el maestro del ITIL
// es Yokup, y lo que se sube aquí no sale de este navegador.
//
// Los mensajes llevan `texto` en castellano (como la validación de plano-core) y, los
// propios de este módulo, también `en`.
import { SCHEMA, ORDER_SCHEMA, validate, round } from './plano-core.mjs?v=20261014-plano-1';

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const MAX_JSON = 2 * 1024 * 1024; // 2 MB de plano en JSON
export const MAX_CALCO = 25 * 1024 * 1024; // imagen o PDF original, antes de reescalar
export const MAX_LADO = 2400; // px del lado mayor del calco guardado
export const MEDIDAS = { ancho: [1, 500], fondo: [1, 500], alto: [2, 30] }; // metros
const MAX_PAREDES = 200, MAX_PANTALLAS = 2000, MAX_ELEMENTOS = 2000;

const msg = (codigo, texto, en, extra = {}) => ({ codigo, texto, en, ...extra });
const num = v => typeof v === 'number' && Number.isFinite(v);
const positivo = v => num(v) && v > 0;
const punto = p => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]);
const objeto = v => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = o => JSON.parse(JSON.stringify(o));
const bytes = s => new TextEncoder().encode(s).length;
const mb = n => String(round(n / 1024 / 1024, 1)).replace('.', ',');

// ── Ids y nombres ────────────────────────────────────────────────────────────
// Id de Xpacio a partir de cualquier texto: minúsculas, sin acentos, guiones.
export function normalizarId(texto) {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '');
}
const base = nombre => String(nombre ?? '').split(/[\\/]/).pop().replace(/\.[a-z0-9]{1,5}$/i, '');
export const idDeFichero = nombre => normalizarId(base(nombre));
// Nombre legible a partir del fichero: «planta-tienda_valencia.pdf» → «planta tienda valencia».
export function nombreDeFichero(nombre) {
  return base(nombre).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
export const textoCorto = (s, max = 80) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// ── Ficheros ─────────────────────────────────────────────────────────────────
const EXT = { json: ['json'], imagen: ['png', 'jpg', 'jpeg', 'webp', 'svg'], pdf: ['pdf'] };
const MIME = { json: ['application/json'], imagen: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], pdf: ['application/pdf'] };
export const ACEPTA = [...Object.values(EXT).flat().map(e => '.' + e), ...Object.values(MIME).flat()].join(',');

// Tipo de lo subido por su extensión o, si no la tiene, por su tipo MIME.
export function tipoFichero({ name = '', type = '' } = {}) {
  const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (ext) return Object.keys(EXT).find(k => EXT[k].includes(ext)) || null;
  return Object.keys(MIME).find(k => MIME[k].includes(String(type).toLowerCase())) || null;
}
export const limiteFichero = tipo => tipo === 'json' ? MAX_JSON : MAX_CALCO;

// Antes de leerlo: tipo admitido, no vacío y por debajo del límite.
export function comprobarFichero(file = {}) {
  const tipo = tipoFichero(file);
  if (!tipo) return { ok: false, tipo, error: msg('tipo', 'Formato no admitido: sube un JSON del plano, una imagen (PNG, JPG, WebP o SVG) o un PDF.', 'Unsupported format: upload a floor plan JSON, an image (PNG, JPG, WebP or SVG) or a PDF.') };
  if (!(file.size > 0)) return { ok: false, tipo, error: msg('vacio', 'El fichero está vacío.', 'The file is empty.') };
  const max = limiteFichero(tipo);
  if (file.size > max) return { ok: false, tipo, error: msg('grande', `El fichero pesa ${mb(file.size)} MB y el máximo es ${mb(max)} MB.`, `The file is ${mb(file.size)} MB; the limit is ${mb(max)} MB.`) };
  return { ok: true, tipo, error: null };
}

// ── Plano en JSON ────────────────────────────────────────────────────────────
// Valida un plano `admira.xpacio-plano/1`: esquema, sala con medidas, paredes con sus
// extremos y pantallas con los campos que usa plano-core. Los errores bloquean; los
// avisos (paredes en sentido antihorario, la validación de plano-core…) no.
export function leerPlanoJson(texto, idPorDefecto = '') {
  const errores = [], avisos = [];
  if (typeof idPorDefecto !== 'string') idPorDefecto = '';
  const fallo = () => ({ ok: false, plan: null, id: ID_RE.test(idPorDefecto) ? idPorDefecto : null, errores, avisos });
  if (typeof texto !== 'string' || !texto.trim()) { errores.push(msg('vacio', 'El fichero está vacío.', 'The file is empty.')); return fallo(); }
  if (bytes(texto) > MAX_JSON) { errores.push(msg('grande', `El plano pesa más de ${mb(MAX_JSON)} MB.`, `The floor plan is larger than ${mb(MAX_JSON)} MB.`)); return fallo(); }
  let data;
  try { data = JSON.parse(texto.replace(/^﻿/, '')); } catch (e) {
    errores.push(msg('json', `No es un JSON válido (${textoCorto(e.message, 120)}).`, `It is not valid JSON (${textoCorto(e.message, 120)}).`));
    return fallo();
  }
  if (!objeto(data)) { errores.push(msg('esquema', 'El JSON no es un plano: se esperaba un objeto.', 'The JSON is not a floor plan: an object was expected.')); return fallo(); }
  if (data.schema !== SCHEMA) {
    errores.push(data.schema === ORDER_SCHEMA
      ? msg('esquema', 'Es una orden de obra (admira.orden-obra/1), no un plano: sube el plano del Xpacio.', 'This is a work order (admira.orden-obra/1), not a floor plan: upload the Xpace floor plan.')
      : msg('esquema', `El esquema debe ser «${SCHEMA}» y es «${textoCorto(data.schema ?? 'ninguno', 60)}».`, `The schema must be “${SCHEMA}” and it is “${textoCorto(data.schema ?? 'none', 60)}”.`));
    return fallo();
  }
  const plan = clone(data);
  const err = (codigo, texto, en) => errores.push(msg(codigo, texto, en));

  // Id: el del JSON si es válido; si no, el de la URL.
  const idJson = typeof plan.id === 'string' ? plan.id.trim() : '';
  const id = ID_RE.test(idJson) ? idJson : (ID_RE.test(idPorDefecto) ? idPorDefecto : null);
  if (!id) err('id', 'El plano no tiene un id válido (minúsculas, cifras y guiones) ni hay Xpacio en la URL.', 'The floor plan has no valid id (lower case, digits and hyphens) and there is no Xpace in the URL.');
  else if (idJson && !ID_RE.test(idJson)) avisos.push(msg('id-url', `El id «${textoCorto(idJson, 60)}» no es válido: se guarda como «${id}».`, `The id “${textoCorto(idJson, 60)}” is not valid: it is stored as “${id}”.`));
  else if (ID_RE.test(idPorDefecto) && id !== idPorDefecto) avisos.push(msg('otro-id', `El plano es del Xpacio «${id}», no de «${idPorDefecto}»: se abrirá el suyo.`, `The floor plan belongs to the Xpace “${id}”, not “${idPorDefecto}”: its own page will open.`));
  plan.id = id;
  plan.nombre = textoCorto(plan.nombre, 120) || id || '';

  // Sala.
  const p = plan.planta;
  if (!objeto(p) || !positivo(p.ancho) || !positivo(p.fondo) || !positivo(p.alto)) err('planta', 'Falta la sala: «planta» con ancho, fondo y alto en metros (mayores que 0).', 'The room is missing: “planta” with width, depth and height in metres (above 0).');

  // Paredes.
  const paredes = Array.isArray(plan.paredes) ? plan.paredes : null;
  const wallIds = new Set();
  if (!paredes || paredes.length < 3) err('paredes', 'El plano necesita al menos 3 paredes en «paredes».', 'The floor plan needs at least 3 walls in “paredes”.');
  else if (paredes.length > MAX_PAREDES) err('paredes', `Demasiadas paredes (${paredes.length}; máximo ${MAX_PAREDES}).`, `Too many walls (${paredes.length}; maximum ${MAX_PAREDES}).`);
  else {
    paredes.forEach((w, i) => {
      const n = `pared ${i + 1}`, ne = `wall ${i + 1}`;
      if (!objeto(w) || typeof w.id !== 'string' || !w.id.trim()) { err('pared', `La ${n} no tiene id.`, `The ${ne} has no id.`); return; }
      if (wallIds.has(w.id)) err('pared', `El id de pared «${textoCorto(w.id, 40)}» está repetido.`, `The wall id “${textoCorto(w.id, 40)}” is repeated.`);
      wallIds.add(w.id);
      if (!punto(w.a) || !punto(w.b)) err('pared', `La pared «${textoCorto(w.id, 40)}» necesita sus extremos a y b como [x, y] en metros.`, `The wall “${textoCorto(w.id, 40)}” needs its ends a and b as [x, y] in metres.`);
      else if (Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) < 0.05) err('pared', `La pared «${textoCorto(w.id, 40)}» mide menos de 5 cm.`, `The wall “${textoCorto(w.id, 40)}” is shorter than 5 cm.`);
      if (w.alto !== undefined && !positivo(w.alto)) err('pared', `El alto de la pared «${textoCorto(w.id, 40)}» debe ser un número mayor que 0.`, `The height of wall “${textoCorto(w.id, 40)}” must be a number above 0.`);
    });
    // Convenio: sentido horario con el eje y hacia dentro (área con signo positiva).
    if (!errores.length) {
      const area = paredes.reduce((s, w) => s + w.a[0] * w.b[1] - w.b[0] * w.a[1], 0) / 2;
      if (area < 0) avisos.push(msg('antihorario', 'Las paredes van en sentido antihorario: el alzado se verá desde fuera. Recórrelas en el sentido de las agujas del reloj.', 'The walls run anticlockwise: elevations will be seen from outside. List them clockwise.'));
      const abiertas = paredes.some((w, i) => { const nx = paredes[(i + 1) % paredes.length]; return Math.hypot(nx.a[0] - w.b[0], nx.a[1] - w.b[1]) > 0.01; });
      if (abiertas) avisos.push(msg('abiertas', 'Las paredes no cierran la sala: cada una debería empezar donde acaba la anterior.', 'The walls do not close the room: each one should start where the previous one ends.'));
    }
  }

  // Pantallas (cada una es un CI del inventario ITIL).
  const pantallas = plan.pantallas === undefined ? (plan.pantallas = []) : plan.pantallas;
  if (!Array.isArray(pantallas)) err('pantallas', '«pantallas» debe ser una lista.', '“pantallas” must be a list.');
  else if (pantallas.length > MAX_PANTALLAS) err('pantallas', `Demasiadas pantallas (${pantallas.length}; máximo ${MAX_PANTALLAS}).`, `Too many screens (${pantallas.length}; maximum ${MAX_PANTALLAS}).`);
  else {
    const ids = new Set();
    pantallas.forEach((s, i) => {
      const n = objeto(s) && typeof s.id === 'string' && s.id.trim() ? `«${textoCorto(s.id, 40)}»` : `${i + 1}`;
      if (!objeto(s) || typeof s.id !== 'string' || !s.id.trim()) { err('pantalla', `La pantalla ${n} no tiene id.`, `Screen ${n} has no id.`); return; }
      if (ids.has(s.id)) err('pantalla', `El id de pantalla ${n} está repetido.`, `The screen id ${n} is repeated.`);
      ids.add(s.id);
      if (wallIds.size && !wallIds.has(s.pared)) err('pantalla', `La pantalla ${n} está en una pared que no existe («${textoCorto(s.pared ?? '', 40)}»).`, `Screen ${n} is on a wall that does not exist (“${textoCorto(s.pared ?? '', 40)}”).`);
      if (!num(s.s) || !num(s.z)) err('pantalla', `La pantalla ${n} necesita «s» (centro desde la izquierda) y «z» (base) en metros.`, `Screen ${n} needs “s” (centre from the left) and “z” (bottom) in metres.`);
      if (s.orientacion !== 'vertical' && s.orientacion !== 'horizontal') err('pantalla', `La orientación de la pantalla ${n} debe ser «vertical» u «horizontal».`, `The orientation of screen ${n} must be “vertical” or “horizontal”.`);
      if (!positivo(s.pulgadas) || s.pulgadas > 1000) err('pantalla', `La pantalla ${n} necesita su diagonal en «pulgadas».`, `Screen ${n} needs its diagonal in “pulgadas” (inches).`);
      if (s.resolucion !== undefined && !(Array.isArray(s.resolucion) && s.resolucion.length === 2 && s.resolucion.every(positivo))) err('pantalla', `La resolución de la pantalla ${n} debe ser [ancho, alto] en píxeles.`, `The resolution of screen ${n} must be [width, height] in pixels.`);
      if (s.aspecto !== undefined && !(Array.isArray(s.aspecto) && s.aspecto.length === 2 && s.aspecto.every(positivo))) err('pantalla', `El aspecto de la pantalla ${n} debe ser [16, 9] o similar.`, `The aspect of screen ${n} must be [16, 9] or similar.`);
      if (s.dimensiones !== undefined && !(objeto(s.dimensiones) && positivo(s.dimensiones.ancho) && positivo(s.dimensiones.alto))) err('pantalla', `Las dimensiones de la pantalla ${n} deben llevar ancho y alto en metros.`, `The dimensions of screen ${n} need width and height in metres.`);
    });
  }

  // Huecos (puertas, escaparates) y mobiliario: opcionales, pero bien formados.
  for (const [key, campos, es, en] of [['huecos', ['desde', 'ancho', 'alto'], 'hueco', 'opening'], ['mobiliario', ['x', 'y', 'w', 'd', 'alto'], 'mueble', 'furniture item']]) {
    if (plan[key] === undefined) { plan[key] = []; continue; }
    if (!Array.isArray(plan[key]) || plan[key].length > MAX_ELEMENTOS) { err(key, `«${key}» debe ser una lista.`, `“${key}” must be a list.`); continue; }
    plan[key].forEach((h, i) => {
      const n = objeto(h) && h.id ? `«${textoCorto(h.id, 40)}»` : `${i + 1}`;
      if (!objeto(h) || !campos.every(c => num(h[c]))) { err(key, `El ${es} ${n} necesita ${campos.join(', ')} en metros.`, `The ${en} ${n} needs ${campos.join(', ')} in metres.`); return; }
      if (key === 'huecos' && wallIds.size && !wallIds.has(h.pared)) err(key, `El hueco ${n} está en una pared que no existe.`, `The opening ${n} is on a wall that does not exist.`);
      if (h.base !== undefined && !num(h.base)) err(key, `La base del hueco ${n} debe ser un número.`, `The bottom of opening ${n} must be a number.`);
    });
  }
  if (plan.criterios !== undefined && !objeto(plan.criterios)) err('criterios', '«criterios» debe ser un objeto.', '“criterios” must be an object.');

  if (errores.length) return fallo();
  // La validación de plano-core no bloquea: solapes, techo o puertas tapadas salen como aviso.
  for (const i of validate(plan)) avisos.push({ codigo: i.codigo, texto: i.texto, nivel: i.nivel, pantalla: i.pantalla });
  return { ok: true, plan, id, errores, avisos };
}

// Resumen para la vista previa.
export function resumenPlano(plan) {
  const p = plan.planta || {};
  return { id: plan.id, nombre: plan.nombre || plan.id, paredes: (plan.paredes || []).length, pantallas: (plan.pantallas || []).length, ancho: p.ancho, fondo: p.fondo, alto: p.alto };
}

// ── Sala rectangular para un Xpacio nuevo ────────────────────────────────────
// Errores de las medidas de la sala (metros); vacío si valen.
export function comprobarSala({ ancho, fondo, alto } = {}) {
  const out = [];
  for (const [k, v] of Object.entries({ ancho, fondo, alto })) {
    const [lo, hi] = MEDIDAS[k];
    if (!num(v) || v < lo || v > hi) out.push(msg(k, `El ${k} de la sala debe estar entre ${lo} y ${hi} m.`, `The room ${({ ancho: 'width', fondo: 'depth', alto: 'height' })[k]} must be between ${lo} and ${hi} m.`));
  }
  return out;
}

// Plano válido de una sala de ancho × fondo × alto con cuatro paredes en el sentido de
// las agujas del reloj (planta con el eje y hacia dentro), igual que las de Starbucks
// Paseo de Gracia 103: fondo arriba, lateral derecho, frente abajo y lateral izquierdo.
// Sin pantallas ni muebles: se añaden en «Propuesta de obra».
export function salaRectangular({ id, nombre, ancho, fondo, alto, version = 'subido-1' } = {}) {
  if (!ID_RE.test(id || '')) throw new TypeError('salaRectangular: id de Xpacio no válido');
  const errs = comprobarSala({ ancho, fondo, alto });
  if (errs.length) throw new RangeError('salaRectangular: ' + errs.map(e => e.texto).join(' '));
  const [W, F, H] = [round(ancho), round(fondo), round(alto)];
  const m = v => String(v).replace('.', ',');
  return {
    schema: SCHEMA,
    id,
    version,
    nombre: textoCorto(nombre, 120) || id,
    fuente: {
      titulo: 'Sala rectangular sobre un calco',
      medidas: `Sala de ${m(W)} × ${m(F)} m y ${m(H)} m de alto indicada al subir el calco; no es un levantamiento medido`,
      pantallas: 'Sin pantallas todavía: añádelas en Propuesta de obra',
      itil: 'Códigos ITIL por cruzar con Yokup, el maestro del ITIL'
    },
    planta: { ancho: W, fondo: F, alto: H },
    paredes: [
      { id: 'F', nombre: 'Fondo', a: [0, 0], b: [W, 0] },
      { id: 'D', nombre: 'Lateral derecho', a: [W, 0], b: [W, F] },
      { id: 'P', nombre: 'Frente', a: [W, F], b: [0, F] },
      { id: 'I', nombre: 'Lateral izquierdo', a: [0, F], b: [0, 0] }
    ],
    huecos: [],
    mobiliario: [],
    pantallas: []
  };
}

// ── Calco (imagen de referencia bajo la planta) ──────────────────────────────
// Medidas en píxeles para que el lado mayor no pase de `max` (nunca amplía).
export function escalaCalco(w, h, max = MAX_LADO) {
  if (!positivo(w) || !positivo(h)) return null;
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), factor: k };
}

// Escala de render de la página de un PDF para que su lado mayor mida `max` px
// (el PDF viene en puntos: un A4 son 595×842 y se amplía; un A0 se reduce).
export function escalaPdf(w, h, max = MAX_LADO) {
  return positivo(w) && positivo(h) ? max / Math.max(w, h) : 1;
}

// Ancho de la sala en metros: el de «planta» o, si no, el de las paredes.
export function anchoSala(plan) {
  if (positivo(plan?.planta?.ancho)) return plan.planta.ancho;
  const xs = (plan?.paredes || []).flatMap(w => [w.a[0], w.b[0]]);
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 10;
}

// Calco listo para guardar. `dataUrl` es la imagen ya reescalada (webp o png; svg tal cual).
export function nuevoCalco({ dataUrl, pxAncho, pxAlto, fichero = '', ancho, opacidad = 0.5 } = {}) {
  return { dataUrl, pxAncho, pxAlto, fichero: textoCorto(fichero, 120), ancho: round(ancho, 2), opacidad: round(Math.min(1, Math.max(0.05, opacidad)), 2) };
}
export function calcoValido(c) {
  return objeto(c) && typeof c.dataUrl === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/.test(c.dataUrl) &&
    positivo(c.pxAncho) && positivo(c.pxAlto) && positivo(c.ancho) && num(c.opacidad) && c.opacidad > 0 && c.opacidad <= 1;
}
// Rectángulo del calco en la planta (metros): esquina superior izquierda de las paredes
// y el ancho real indicado; el alto sale de la proporción de la imagen.
export function geometriaCalco(calco, plan) {
  const xs = plan.paredes.flatMap(w => [w.a[0], w.b[0]]), ys = plan.paredes.flatMap(w => [w.a[1], w.b[1]]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: calco.ancho, height: calco.ancho * calco.pxAlto / calco.pxAncho };
}

// ── Registro guardado en este navegador ──────────────────────────────────────
// { id, plan | null, calco | null, fichero, subidoEn }. `plan: null` = el plano
// publicado con un calco encima.
export function registroSubida({ id, plan = null, calco = null, fichero = '', subidoEn } = {}) {
  if (!ID_RE.test(id || '')) return null;
  return { id, plan: plan ? clone(plan) : null, calco: calcoValido(calco) ? { ...calco } : null, fichero: textoCorto(fichero, 120), subidoEn: subidoEn || new Date().toISOString() };
}
export function registroValido(r, id) {
  return objeto(r) && r.id === id && (r.plan === null || (objeto(r.plan) && r.plan.schema === SCHEMA && Array.isArray(r.plan.paredes) && Array.isArray(r.plan.pantallas))) &&
    (r.calco === null || calcoValido(r.calco)) && !!(r.plan || r.calco);
}

// IndexedDB `admira-planos` → store `planos`, clave = id del Xpacio. Sin IndexedDB (modo
// privado, almacenamiento bloqueado) cada operación devuelve null/false y la página sigue.
export const DB_NAME = 'admira-planos', DB_STORE = 'planos';
export function almacenPlanos(idb = globalThis.indexedDB) {
  let db = null;
  const abrir = () => db || (db = new Promise((resolve, reject) => {
    if (!idb || typeof idb.open !== 'function') { reject(new Error('IndexedDB no disponible')); return; }
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB bloqueada'));
  }));
  const run = async (mode, fn) => {
    const conn = await abrir();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(DB_STORE, mode), req = fn(tx.objectStore(DB_STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('IndexedDB'));
    });
  };
  return {
    async disponible() { try { await abrir(); return true; } catch { db = null; return false; } },
    async leer(id) { try { const r = await run('readonly', s => s.get(id)); return registroValido(r, id) ? r : null; } catch { return null; } },
    async guardar(registro) { try { await run('readwrite', s => s.put(registro)); return true; } catch { return false; } },
    async borrar(id) { try { await run('readwrite', s => s.delete(id)); return true; } catch { return false; } }
  };
}
