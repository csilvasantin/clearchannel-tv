// ▤ Creación de Xpacios · «Con foto o vídeo» (DCL-ddf3203078fe9471f3796130, Hoy #403). Sin DOM:
// lo usan plano.mjs y los tests. Para dar de alta Xpacios que no podremos visitar: las fotos del
// local (o 6–8 fotogramas de un vídeo, sacados en el propio navegador) se reescalan aquí y van a
// POST https://api.admira.store/xpacio/estimar (worker pixer-eleven), que se las pasa a Gemini Pro
// con visión. Vuelven medidas, confianza, las referencias de tamaño usadas (puertas, pantallas de
// 27″ o 55″, baldosa de 20 cm…) y los huecos, muebles y pantallas vistos con el convenio de la sala
// (paredes F, D, P e I). El generador (plano-generador.mjs) completa el plano con eso: lo que se ve
// se respeta tal cual (pantallas en estado «estimada») y lo que no, sale del tipo de Xpacio.
// El worker no guarda las fotos; el plano resultante se guarda solo en este navegador.
import { round, panelSize } from './plano-core.mjs?v=20261014-plano-1';
import { TIPOS, generarXpacio } from './plano-generador.mjs?v=20261014-foto-1';

export const ESTIMADOR = 'https://api.admira.store/xpacio/estimar';
export const MAX_FOTOS = 8;
// El worker admite fotos de 1 MB y un cuerpo de 9 MB: con 800 KB por foto, 8 caben siempre
// (8 × 0,8 MB × 4/3 del base64 ≈ 8,5 MB).
export const MAX_BYTES_FOTO = 800 * 1024; // binario tras reescalar
export const LADO_FOTO = 1600;                   // lado mayor de la foto que se envía
export const MAX_VIDEO = 1024 * 1024 * 1024;     // el vídeo no sale del navegador: solo sus fotogramas
export const MAX_IMAGEN = 40 * 1024 * 1024;
export const ESPERA_ESTIMADOR = 180000;          // el worker corta a los 150 s
export const ACEPTA_FOTO = 'image/*,video/*';

// URL del estimador. En producción, siempre api.admira.store. Solo con la página servida en
// localhost se puede apuntar a un worker local (?estimador=http://localhost:8787): un enlace no
// puede mandar las fotos a otro host. ?simula=1 pide la respuesta fija (sin Gemini); el worker
// solo la da a una página en localhost contra un worker en `wrangler dev`.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;
const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
export function urlEstimador(search = '', hostname = '') {
  const p = new URLSearchParams(search);
  const pedido = p.get('estimador') || '';
  const base = LOCAL_HOST.test(hostname) && LOCAL_URL.test(pedido) ? pedido.replace(/\/$/, '') + '/xpacio/estimar' : ESTIMADOR;
  return base + (p.get('simula') === '1' ? '?simula=1' : '');
}

// Instantes de los fotogramas de un vídeo: 6 si dura menos de 4 s, 8 si no, repartidos por
// el centro de tramos iguales (ni el primer ni el último fotograma, que suelen salir movidos).
export function tiemposFotogramas(duracion, n) {
  if (!(Number.isFinite(duracion) && duracion > 0)) return [];
  const k = Math.min(MAX_FOTOS, Math.max(1, n || (duracion < 4 ? 6 : 8)));
  const fin = Math.max(0, duracion - 0.05);
  return Array.from({ length: k }, (_, i) => round(Math.min(fin, Math.max(0, duracion * (i + 0.5) / k)), 3));
}

// Tamaño de la foto reescalada: lado mayor ≤ lado, sin agrandar.
export function escalaFoto(w, h, lado = LADO_FOTO) {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, lado / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
// Bytes del binario de un dataURL en base64.
export function bytesDataUrl(dataUrl) {
  const i = String(dataUrl).indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  return Math.floor(b64.length / 4) * 3 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}
// Escalones para que una foto quepa en MAX_BYTES_FOTO: primero calidad, luego tamaño.
export const ESCALONES = Object.freeze([{ lado: 1600, calidad: 0.82 }, { lado: 1600, calidad: 0.7 }, { lado: 1280, calidad: 0.7 }, { lado: 1024, calidad: 0.65 }]);

// Clasifica lo elegido: un vídeo (el primero) o fotos. Devuelve también lo que se ignora y por qué.
export function clasificarFicheros(files, enLista = 0) {
  const lista = Array.from(files || []);
  const video = lista.find(f => /^video\//.test(f.type || '') || /\.(mp4|mov|m4v|webm|ogv)$/i.test(f.name || ''));
  if (video) {
    if (video.size > MAX_VIDEO) return { video: null, fotos: [], errores: [{ fichero: video.name, error: 'videoGrande' }] };
    return { video, fotos: [], errores: lista.length > 1 ? [{ fichero: '', error: 'soloVideo' }] : [] };
  }
  const fotos = [], errores = [];
  for (const f of lista) {
    if (!/^image\//.test(f.type || '') && !/\.(jpe?g|png|webp|heic|heif|avif|gif)$/i.test(f.name || '')) { errores.push({ fichero: f.name, error: 'noImagen' }); continue; }
    if (f.size > MAX_IMAGEN) { errores.push({ fichero: f.name, error: 'imagenGrande' }); continue; }
    if (enLista + fotos.length >= MAX_FOTOS) { errores.push({ fichero: f.name, error: 'maxFotos' }); continue; }
    fotos.push(f);
  }
  return { video: null, fotos, errores };
}

// Orígenes que atiende el estimador (los mismos que el worker; localhost, para pruebas con un
// worker en `wrangler dev`). Desde otro dominio (p. ej. clearchannel.tv) ni se intenta: el
// navegador bloquearía la respuesta por CORS y parecería un fallo de red.
export const ORIGENES_ESTIMADOR = Object.freeze(['https://www.admira.biz', 'https://admira.biz', 'https://www.admira.store', 'https://admira.store']);
export const origenEstimador = origin => ORIGENES_ESTIMADOR.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(String(origin));

// Mensaje del error del worker (código → clave de copy de plano.mjs).
export function claveError(status, cuerpo) {
  const e = cuerpo && cuerpo.error;
  if (e === 'cupo-no-disponible') return 'phQuotaDown';
  if (e === 'desactivado') return 'phOff';
  if (status === 429 || e === 'limite') return cuerpo && cuerpo.motivo === 'ip' ? 'phLimitIp' : 'phLimitDay';
  if (status === 413 || e === 'foto-demasiado-grande' || e === 'cuerpo-demasiado-grande') return 'phTooBig';
  if (status === 403) return 'phOrigin';
  if (status === 504 || e === 'gemini-sin-respuesta' || e === 'timeout') return 'phTimeout';
  if (e === 'estimacion-no-valida') return 'phInvalid';
  if (status === 503 || /^gemini-/.test(e || '')) return 'phBusy';
  return 'phError';
}

// Respuesta del worker → `elementos` del generador. Una categoría vacía no se pasa: así el
// generador pone la puerta y el mobiliario y las pantallas típicas del tipo.
const NOMBRE_HUECO = { puerta: 'Puerta', escaparate: 'Escaparate', ventana: 'Ventana' };
export function elementosDeEstimacion(est, modeloNombre = 'Gemini') {
  const fuente = `Estimada desde fotos · ${modeloNombre}`;
  const lista = k => Array.isArray(est && est[k]) && est[k].length ? est[k] : null;
  const huecos = lista('huecos'), mobiliario = lista('mobiliario'), pantallas = lista('pantallas');
  return {
    huecos: huecos && huecos.map((h, i) => ({ id: `est-hueco-${i + 1}`, tipo: h.tipo, nombre: h.nombre || NOMBRE_HUECO[h.tipo] || 'Hueco', pared: h.pared, desde: h.desde, ancho: h.ancho, base: h.base || 0, alto: h.alto })),
    mobiliario: mobiliario && mobiliario.map((m, i) => ({ id: `est-m-${i + 1}`, nombre: m.nombre || 'Mueble', x: m.x, y: m.y, w: m.w, d: m.d, alto: m.alto })),
    pantallas: pantallas && pantallas.map((p, i) => ({ id: `est-${i + 1}`, nombre: p.nombre || `Pantalla ${i + 1}`, corto: `E${i + 1}`, orientacion: p.orientacion, pulgadas: p.pulgadas, pared: p.pared, s: p.s, z: p.z, fuente, confianza: p.confianza }))
  };
}

// Las posiciones estimadas tienen un margen de decenas de centímetros: dos pantallas vistas que se
// pisan en la misma pared (p. ej. un portátil delante de un monitor) se separan lo justo, en el
// orden en que se vieron, sin salirse de la pared, con los 5 cm de separación mínima de plano-core
// (`hueco` lleva 1 cm de margen). Devuelve cuántas se han movido.
export function desolaparPantallas(pantallas, largos, hueco = 0.06) {
  const m = hueco - 0.01;
  let movidas = 0;
  const porPared = new Map();
  for (const p of pantallas || []) { if (!porPared.has(p.pared)) porPared.set(p.pared, []); porPared.get(p.pared).push(p); }
  for (const [pared, lista] of porPared) {
    const L = largos[pared], caja = p => { const { w, h } = panelSize(p); return { w, h, x0: p.s - w / 2, x1: p.s + w / 2, z0: p.z, z1: p.z + h }; };
    lista.sort((a, b) => a.s - b.s);
    const antes = lista.map(p => p.s);
    for (let i = 1; i < lista.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = caja(lista[j]), b = caja(lista[i]);
        if (a.x1 + m > b.x0 && b.x1 + m > a.x0 && a.z1 + m > b.z0 && b.z1 + m > a.z0) lista[i].s = round(a.x1 + hueco + b.w / 2, 3);
      }
    }
    // Si la última se sale por la derecha, se empujan hacia la izquierda las que haga falta.
    if (Number.isFinite(L)) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const b = caja(lista[i]), limite = i === lista.length - 1 ? L : caja(lista[i + 1]).x0 - hueco;
        const sig = i < lista.length - 1 && caja(lista[i + 1]);
        if (b.x1 > limite + 1e-6 && (!sig || (sig.z0 < b.z1 + m && b.z0 < sig.z1 + m))) lista[i].s = round(Math.max(b.w / 2, limite - b.w / 2), 3);
      }
    }
    movidas += lista.filter((p, i) => Math.abs(p.s - antes[i]) > 1e-6).length;
  }
  return movidas;
}

const pct = v => Math.round((Number(v) || 0) * 100);
const coma = n => String(round(n, 2)).replace('.', ',');
// Plano completo a partir de la respuesta del worker. Nunca se presenta como medido: la fuente dice
// «Plano estimado desde fotos · <modelo> · confianza N %» (y «simulada» con ?simula=1).
export function planoDesdeEstimacion({ respuesta, tipo = 'cafeteria', id = 'xpacio-estimado', nombre, direccion, semilla } = {}) {
  const est = respuesta && respuesta.estimacion;
  if (!est || ![est.ancho, est.largo, est.alto].every(Number.isFinite)) throw new TypeError('estimación sin medidas');
  const modelo = respuesta.modeloNombre || respuesta.modelo || 'Gemini', t = TIPOS[tipo] || TIPOS.cafeteria;
  const elementos = elementosDeEstimacion(est, modelo);
  const ajustadas = desolaparPantallas(elementos.pantallas, { F: est.ancho, P: est.ancho, D: est.largo, I: est.largo });
  const plan = generarXpacio({ tipo: TIPOS[tipo] ? tipo : 'cafeteria', ancho: est.ancho, largo: est.largo, alto: est.alto, semilla, id, nombre, direccion, elementos });
  const c = est.confianza || {}, W = plan.planta.ancho, F = plan.planta.fondo, H = plan.planta.alto;
  const refs = (est.referencias || []).slice(0, 4).map(r => r.supuesto ? `${r.objeto} (${r.supuesto})` : r.objeto).join('; ');
  const vistas = (plan.pantallas || []).filter(p => p.estado === 'estimada').length, tipicas = (plan.pantallas || []).length - vistas;
  plan.version = `estimado-${plan.generador.tipo}-${plan.generador.semilla}`;
  plan.fuente = {
    titulo: `Plano estimado desde fotos · ${modelo} · confianza ${pct(c.global)} %${respuesta.simulada ? ' · respuesta simulada' : ''}`,
    medidas: `${t.es} de ${coma(W)} × ${coma(F)} m y ${coma(H)} m de alto, estimados por ${modelo} con ${respuesta.fotos || 0} ${respuesta.fotos === 1 ? 'foto' : 'fotos'} y tamaños conocidos${refs ? ` (${refs})` : ''}. Confianza: ancho ${pct(c.ancho)} %, largo ${pct(c.largo)} %, alto ${pct(c.alto)} %. Medidas aproximadas, por confirmar en el sitio`,
    pantallas: [vistas ? `${vistas} ${vistas === 1 ? 'pantalla vista' : 'pantallas vistas'} en las fotos, en estado «estimada» y sin código ITIL` : '', tipicas ? `${tipicas} ${tipicas === 1 ? 'pantalla típica' : 'pantallas típicas'} del tipo en propuesta` : ''].filter(Boolean).join('; ') || 'Sin pantallas',
    itil: 'Sin inventario: el maestro del ITIL es Yokup'
  };
  plan.generador.estimacion = {
    modelo: respuesta.modelo || '', modeloNombre: modelo, fotos: respuesta.fotos || 0, simulada: !!respuesta.simulada,
    confianza: { ancho: c.ancho ?? 0, largo: c.largo ?? 0, alto: c.alto ?? 0, global: c.global ?? 0 },
    referencias: (est.referencias || []).slice(0, 12), notas: String(est.notas || '').slice(0, 800), descartes: (est.descartes || []).length, ajustadas
  };
  return plan;
}

// Resumen para la vista previa: lo estimado frente a lo que ha completado el generador.
export function resumenEstimado(plan) {
  const e = (plan.generador && plan.generador.estimacion) || {}, huecos = plan.huecos || [], muebles = plan.mobiliario || [], pantallas = plan.pantallas || [];
  const est = arr => arr.filter(x => /^est-/.test(x.id || '')).length;
  return {
    tipo: plan.generador && plan.generador.tipo, m2: round(plan.planta.ancho * plan.planta.fondo, 1), ancho: plan.planta.ancho, largo: plan.planta.fondo, alto: plan.planta.alto,
    confianza: e.confianza || { ancho: 0, largo: 0, alto: 0, global: 0 }, modelo: e.modeloNombre || '', fotos: e.fotos || 0, simulada: !!e.simulada,
    referencias: e.referencias || [], notas: e.notas || '', descartes: e.descartes || 0,
    puertas: huecos.filter(h => h.tipo === 'puerta').length, huecosEstimados: est(huecos), huecos: huecos.length,
    muebles: muebles.length, mueblesEstimados: est(muebles),
    pantallas: pantallas.length, pantallasEstimadas: pantallas.filter(p => p.estado === 'estimada').length
  };
}
