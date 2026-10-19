// Arquitecto · orden «fotos» (Carlos, 18-oct-2026: «fotos y 360 por local, asignadas a sus paredes, y la 360 como vista
// Matrix del gemelo»). Sin DOM: lo usan arquitecto-galeria-ui.mjs y los tests.
//
// · Fotos de las paredes: cada foto del local va a una pared del plano (F, D, P, C…). Se quedan en este navegador
//   (IndexedDB): pueden salir personas y no se publican nunca.
// · Foto 360: equirectangular 2:1 (Insta360). Se marca la vista inicial y las esquinas de cada pantalla en píxeles de la
//   foto. El bloque `panorama` es el mismo de los centros de Starbucks (xpaceos/xpacios/starbucks-centros/centros.json) y
//   el que pinta la vista «360 · Matrix» del gemelo desde el plano. Para publicarla hace falta que no salgan personas
//   reconocibles; las imágenes van a xpaceos (`/xpacios/360/<local>/`) con respaldo.
import { ordenarEsquinas, validarEsquinas } from './arquitecto-detallar.mjs?v=20261019-detallar-4';

export const XPACEOS = 'https://www.xpaceos.com';
export const LADO_FOTO = 1600;
export const MAX_FOTOS_LOCAL = 80;
export const SIN_PARED = 'sin-pared';
export const FOV_INICIAL = 100;
// Las tres imágenes de una 360: la buena (hasta 8K, para tarjetas que la admiten), la del móvil (4K) y la previa (rápida).
export const LADOS_360 = Object.freeze({ src: 8192, srcMovil: 4096, previa: 2400 });

// ── Fotos de las paredes ────────────────────────────────────────────────────
// Lado mayor de una foto guardada (y su tamaño), sin agrandar nunca.
export function escalaFoto(w, h, lado = LADO_FOTO) { const k = Math.min(1, lado / Math.max(w, h)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }; }
// Fotos agrupadas por pared, en el orden de las paredes del plano; las que no tienen pared (o una que ya no existe), al final.
export function fotosPorPared(fotos, plan) {
  const paredes = ((plan && plan.paredes) || []).map(w => w.id), grupos = new Map(paredes.map(id => [id, []]));
  grupos.set(SIN_PARED, []);
  for (const f of fotos || []) (grupos.has(f.pared) && f.pared !== SIN_PARED ? grupos.get(f.pared) : grupos.get(SIN_PARED)).push(f);
  return grupos;
}
export const nombrePared = (plan, id) => { const w = ((plan && plan.paredes) || []).find(x => x.id === id); return w ? `${w.id} · ${w.nombre || w.id}` : id; };

// ── Foto 360 ────────────────────────────────────────────────────────────────
export const esEquirectangular = (w, h) => w >= 2000 && h > 0 && Math.abs(w / h - 2) <= 0.02;
// Tamaños de las tres imágenes a partir de la foto original (sin agrandar).
export function tamanos360(w, h) {
  if (!esEquirectangular(w, h)) throw new Error('no-360');
  const t = lado => { const W = Math.min(w, lado); return { w: W, h: Math.round(W / 2) }; };
  return { src: t(LADOS_360.src), srcMovil: t(LADOS_360.srcMovil), previa: t(LADOS_360.previa) };
}
// Píxel de la foto ↔ vista (grados), como el visor de los centros (esfera vista desde dentro, sin corrección):
// yaw = 360·x/ancho + 180, pitch = 90 − 180·y/alto.
const mod360 = v => ((v % 360) + 360) % 360;
export const vistaDesdePixel = (x, y, base) => ({ yaw: Math.round(mod360(360 * x / base[0] + 180) * 100) / 100, pitch: Math.round((90 - 180 * y / base[1]) * 100) / 100 });
export const pixelDesdeVista = (yaw, pitch, base) => [Math.round(mod360(yaw - 180) / 360 * base[0]), Math.round((90 - pitch) / 180 * base[1])];
// Rutas públicas de las imágenes en xpaceos (y en admira.store, su gemelo).
export const rutas360 = (id, ext = 'webp') => ({ src: `/xpacios/360/${id}/${id}-360.${ext}`, srcMovil: `/xpacios/360/${id}/${id}-360-4k.jpg`, previa: `/xpacios/360/${id}/${id}-360-previa.jpg` });
// Una pantalla puede cruzar el borde de la foto (la costura de la esfera: x pasa de ~ancho a ~0). El visor la pinta igual;
// para ordenar y revisar sus esquinas se «desenvuelve» (x + ancho a las de la izquierda) y luego se vuelve a envolver.
export const cruzaBorde = (esquinas, ancho) => Math.max(...esquinas.map(q => q[0])) - Math.min(...esquinas.map(q => q[0])) > ancho / 2;
export const desenvolver = (esquinas, ancho) => (cruzaBorde(esquinas, ancho) ? esquinas.map(([x, y]) => [x < ancho / 2 ? x + ancho : x, y]) : esquinas.map(q => [...q]));
export const envolver = (esquinas, ancho) => esquinas.map(([x, y]) => [x >= ancho ? x - ancho : x, y]);
export const urlDe = src => (typeof src === 'string' && src.startsWith('/') ? XPACEOS + src : src);

// Bloque `panorama` del plano (mismo esquema que los centros).
export function bloquePanorama({ id, base, vista = {}, pantallas = [], origen = '', ext = 'webp', rutas = null } = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '')) throw new Error('id');
  const r = rutas || rutas360(id, ext);
  const v = { yaw: Number(vista.yaw) || 0, pitch: Number(vista.pitch) || 0, fov: Number(vista.fov) || FOV_INICIAL, sphereX: Number(vista.sphereX) || 0, sphereY: Number(vista.sphereY) || 0 };
  return { src: r.src, srcMovil: r.srcMovil, ...(r.previa ? { previa: r.previa } : {}), base: [base[0], base[1]], vista: v,
    pantallas: pantallas.map(p => ({ id: p.id, esquinas: envolver(ordenarEsquinas(desenvolver(p.esquinas, base[0])), base[0]).map(q => q.map(Math.round)) })),
    origen: String(origen || '').replace(/\s+/g, ' ').trim().slice(0, 200) || `Foto 360 del local ${id} (orden «fotos» del Arquitecto)` };
}
// Revisión antes de guardar o publicar: base 2:1, vista con números, pantallas con id único y cuatro esquinas dentro de la foto,
// sin cruzarse. Una pantalla que cruza el borde de la foto (0 / ancho) vale: se revisa desenvuelta.
export function revisarPanorama(p) {
  const errores = [], avisos = [];
  if (!p || typeof p.src !== 'string' || !p.src) errores.push('src');
  const base = p && p.base;
  if (!Array.isArray(base) || base.length !== 2 || !esEquirectangular(base[0], base[1])) errores.push('base');
  if (!p || !p.vista || !['yaw', 'pitch', 'fov'].every(k => Number.isFinite(p.vista[k]))) errores.push('vista');
  const ids = new Set();
  for (const s of (p && p.pantallas) || []) {
    if (!/^[A-Za-z0-9-]{1,40}$/.test(s.id || '')) { errores.push('pantalla-id'); continue; }
    if (ids.has(s.id)) errores.push(`pantalla-${s.id}-repetida`); ids.add(s.id);
    const e = s.esquinas;
    if (!Array.isArray(e) || e.length !== 4) { errores.push(`pantalla-${s.id}-esquinas`); continue; }
    if (Array.isArray(base) && !e.every(([x, y]) => x >= 0 && y >= 0 && x <= base[0] && y <= base[1])) errores.push(`pantalla-${s.id}-fuera`);
    try { validarEsquinas(Array.isArray(base) ? desenvolver(e, base[0]) : e); } catch { errores.push(`pantalla-${s.id}-cruzada`); }
  }
  if (p && Array.isArray(p.pantallas) && !p.pantallas.length) avisos.push('sin-pantallas');
  return { ok: !errores.length, errores, avisos };
}
