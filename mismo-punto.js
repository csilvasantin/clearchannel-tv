/* mismo-punto.js — Elegir entre Xpacios del mismo punto (FLT-102672 · encargo #7155, 24-oct-2026).
 * En Plaça de la Vila de Gràcia, `ipad-luna` y `canalkiosk-gracia` comparten coordenada y `bcn-kiosk-016` está a
 * ~7 m: un clic en ese punto abría el primero (ipad-luna) sin dejar elegir. Ahora, si bajo el clic hay más de un Xpacio
 * en la misma coordenada o a 8 px o menos, sale un selector pequeño anclado al punto; con uno solo, abre directo.
 * Aquí, la parte pura (agrupar, ordenar, vecinos para las tarjetas de previo, teclado y HTML del selector); el popup
 * de MapLibre lo monta app.js. Mismo patrón que previo.js: window.AdmiraMismoPunto y require() en node:test. */
(function (root) {
  'use strict';
  const UMBRAL_PX = 8;          // dos puntos a 8 px o menos son «el mismo punto» (el punto mide 18 px a zoom de calle)
  const MAX_ITEMS = 12;         // un selector, no un listado: si hubiera más, los 12 primeros
  const TEXTOS = {
    es: { mp_titulo: '{n} Xpacios en este punto', mp_aria: 'Elige un Xpacio: {n} en este punto', mp_cerrar: 'Cerrar',
      mp_mas: '+{n}', mp_mas_aria: 'Hay {n} Xpacios más en este punto: elegir', mp_pista: 'y {n} más en este punto · clic para elegir' },
    en: { mp_titulo: '{n} venues at this spot', mp_aria: 'Choose a venue: {n} at this spot', mp_cerrar: 'Close',
      mp_mas: '+{n}', mp_mas_aria: '{n} more venues at this spot: choose', mp_pista: 'and {n} more at this spot · click to choose' },
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v && v[k] != null ? String(v[k]) : '');
  function textoPor(t, lang) {
    const base = TEXTOS[lang === 'en' ? 'en' : 'es'];
    return (k, v) => { let x = typeof t === 'function' ? t(k) : null; if (x == null || x === k) x = base[k] != null ? base[k] : k; return fmt(x, v); };
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mismaCoordenada = (a, b) => Array.isArray(a.coords) && Array.isArray(b.coords) && a.coords[0] === b.coords[0] && a.coords[1] === b.coords[1];

  // ── Agrupar los Xpacios bajo un clic ──
  // candidatos = [{id, x, y, coords?, incidente?, nombre?}] (lo que pinta el mapa alrededor del clic, en px de pantalla);
  // ancla = el punto que eligió el clic ({x, y, coords?}); clic = dónde se hizo clic ({x, y}).
  // Entran los que están a `umbral` px o menos del ancla, en su misma coordenada o justo bajo el clic (`bajoClic`: los
  // ids cuyo punto pintado contiene el clic, e.features de MapLibre; dos puntos que se solapan son ambiguos aunque sus
  // centros estén a más de 8 px). Orden: la incidencia más grave primero (como el clic de siempre, que nunca tapa una
  // incidencia), luego el más cercano al clic y luego por nombre.
  function agrupar(candidatos, ancla, { umbral = UMBRAL_PX, clic = null, bajoClic = null } = {}) {
    if (!ancla || !Number.isFinite(ancla.x) || !Number.isFinite(ancla.y)) return [];
    const ref = clic && Number.isFinite(clic.x) && Number.isFinite(clic.y) ? clic : ancla;
    const bajo = new Set([].concat(bajoClic ? [...bajoClic] : []).map(String));
    const vistos = new Set(), grupo = [];
    for (const c of candidatos || []) {
      if (!c || c.id == null || vistos.has(String(c.id)) || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
      if (dist(c, ancla) > umbral && !mismaCoordenada(c, ancla) && !bajo.has(String(c.id))) continue;
      vistos.add(String(c.id));
      grupo.push(c);
    }
    return ordenar(grupo, ref).slice(0, MAX_ITEMS);
  }
  function ordenar(grupo, ref) {
    const inc = c => Number.isFinite(+c.incidente) ? +c.incidente : -1;
    return grupo.slice().sort((a, b) => (inc(b) - inc(a))
      || (ref ? Math.round(dist(a, ref)) - Math.round(dist(b, ref)) : 0)
      || String(a.nombre || a.id).localeCompare(String(b.nombre || b.id), 'es', { sensitivity: 'base' })
      || String(a.id).localeCompare(String(b.id)));
  }

  // ── Vecinos: qué puntos comparten sitio (para las tarjetas de previo) ──
  // puntos = [{id, x, y}]. Devuelve Map id → [ids de los otros a `umbral` px o menos]. Rejilla de celdas de `umbral`
  // px: lineal aunque haya miles de puntos a la vista.
  function vecinos(puntos, { umbral = UMBRAL_PX } = {}) {
    const celda = Math.max(1, umbral), rejilla = new Map(), out = new Map();
    const clave = (i, j) => i + ',' + j;
    const lista = (puntos || []).filter(p => p && p.id != null && Number.isFinite(p.x) && Number.isFinite(p.y));
    for (const p of lista) { const k = clave(Math.floor(p.x / celda), Math.floor(p.y / celda)); (rejilla.get(k) || rejilla.set(k, []).get(k)).push(p); }
    for (const p of lista) {
      const i = Math.floor(p.x / celda), j = Math.floor(p.y / celda), cerca = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of rejilla.get(clave(i + a, j + b)) || []) {
        if (String(q.id) !== String(p.id) && dist(p, q) <= umbral && !cerca.includes(String(q.id))) cerca.push(String(q.id));
      }
      if (cerca.length) out.set(String(p.id), cerca);
    }
    return out;
  }

  // ── Teclado del selector: flechas, Inicio y Fin, con vuelta ──
  function mover(indice, tecla, n) {
    if (!(n > 0)) return -1;
    const i = Number.isInteger(indice) && indice >= 0 && indice < n ? indice : 0;
    if (tecla === 'ArrowDown' || tecla === 'ArrowRight') return (i + 1) % n;
    if (tecla === 'ArrowUp' || tecla === 'ArrowLeft') return (i - 1 + n) % n;
    if (tecla === 'Home') return 0;
    if (tecla === 'End') return n - 1;
    return i;
  }

  // ── HTML del selector ──
  // items = [{id, nombre, tipo, nivel}] (nivel = texto de la etiqueta de previo o ''). Un menú con botones de verdad.
  function selectorHtml(items, { t, lang } = {}) {
    const tx = textoPor(t, lang), n = (items || []).length;
    return '<div class="xp-selector-cab"><strong id="xp-selector-titulo">' + esc(tx('mp_titulo', { n })) + '</strong>'
      + '<button type="button" class="xp-selector-cerrar" data-xp-cerrar aria-label="' + esc(tx('mp_cerrar')) + '">×</button></div>'
      + '<div class="xp-selector-lista" role="menu" aria-labelledby="xp-selector-titulo" aria-label="' + esc(tx('mp_aria', { n })) + '">'
      + (items || []).map((it, i) => '<button type="button" role="menuitem" class="xp-selector-item" data-xp-elegir="' + esc(it.id) + '" tabindex="' + (i ? -1 : 0) + '">'
        + '<span class="xp-selector-nombre">' + esc(it.nombre || it.id) + '</span>'
        + (it.tipo ? '<span class="xp-selector-tipo">' + esc(it.tipo) + '</span>' : '')
        + (it.nivel ? '<span class="xp-selector-nivel pz-etq pz-etq-' + esc(it.nivelClave || 'ninguno') + '"><i aria-hidden="true"></i>' + esc(it.nivel) + '</span>' : '')
        + '</button>').join('')
      + '</div>';
  }

  const api = { UMBRAL_PX, MAX_ITEMS, TEXTOS, agrupar, ordenar, vecinos, mover, selectorHtml, textoPor };
  root.AdmiraMismoPunto = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
