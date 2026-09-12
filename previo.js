/* previo.js — Previo DooH: la pantalla emitiendo sobre la foto de fachada,
 * el plano de detalle y las fotoesferas interiores (vistas con quad propio).
 * Homografía de 4 esquinas → matrix3d (patrón CanalKiosk / Xtore core.mjs),
 * sin dependencias. Mismo módulo para el navegador (window.AdmiraPrevio) y
 * para node:test (require). FLT-100364. */
(function (root) {
  'use strict';
  const PLAYER_SIZE = { vertical: [540, 960], horizontal: [960, 540] };
  const STORAGE_PREFIX = 'admira.previo.quad.';
  const PLAYER_BASE = 'https://admira.tv/canal.html';

  // Esquinas TL, TR, BR, BL normalizadas 0..1, en sentido horario y sin cruces.
  function validQuad(q) {
    if (!Array.isArray(q) || q.length !== 4 || q.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1))) return false;
    return q.every((p, i) => {
      const b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      return (b[0] - p[0]) * (c[1] - b[1]) - (b[1] - p[1]) * (c[0] - b[0]) > .0001;
    });
  }
  function adj(m) { return [m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4], m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5], m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]]; }
  function mm(a, b) { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3*i+k] * b[3*k+j]; c[3*i+j] = s; } return c; }
  function basis(x1, y1, x2, y2, x3, y3, x4, y4) {
    const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1], a = adj(m);
    const v = [a[0]*x4 + a[1]*y4 + a[2], a[3]*x4 + a[4]*y4 + a[5], a[6]*x4 + a[7]*y4 + a[8]];
    return mm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
  }
  // quadMatrix(w, h, d): lleva el rectángulo (0,0)-(w,h) a las 4 esquinas d
  // (en píxeles del lienzo). Devuelve los 16 valores de matrix3d (column-major).
  function quadMatrix(w, h, d) {
    const s = basis(0, 0, w, 0, w, h, 0, h), t = basis(...d.flat()), m = mm(t, adj(s));
    const divisor = m[8];
    if (!divisor || !Number.isFinite(divisor)) throw new Error('Degenerate panel');
    for (let i = 0; i < 9; i++) m[i] /= divisor;
    return [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]];
  }
  // Aplica la homografía a un punto del player (px) → punto del lienzo (px).
  function applyMatrix(m, x, y) {
    const X = m[0]*x + m[4]*y + m[12], Y = m[1]*x + m[5]*y + m[13], W = m[3]*x + m[7]*y + m[15];
    return [X / W, Y / W];
  }
  function playerSize(orientacion) { return (PLAYER_SIZE[orientacion === 'horizontal' ? 'horizontal' : 'vertical']).slice(); }
  // Rectángulo que ocupa la foto con object-fit:contain dentro del escenario.
  function fitRect(W, H, w, h) {
    if (!(W > 0 && H > 0 && w > 0 && h > 0)) return { x: 0, y: 0, w: 0, h: 0, scale: 0 };
    const scale = Math.min(W / w, H / h), rw = w * scale, rh = h * scale;
    return { x: (W - rw) / 2, y: (H - rh) / 2, w: rw, h: rh, scale };
  }
  // matrix3d(...) listo para CSS: quad normalizado × tamaño renderizado de la foto.
  function screenTransform(previo, rendered) {
    const [pw, ph] = playerSize(previo && previo.orientacion);
    const quad = previo && previo.quad;
    if (!validQuad(quad) || !(rendered && rendered.w > 0 && rendered.h > 0)) return '';
    const m = quadMatrix(pw, ph, quad.map(([x, y]) => [x * rendered.w, y * rendered.h]));
    return 'matrix3d(' + m.map(v => Number(v.toFixed(6))).join(',') + ')';
  }
  // Vistas: 'fachada' (previo raíz), 'detalle' (previo.detalle) e 'interior-n' (previo.interior[n-1]).
  const VIEW_FACHADA = 'fachada';
  const PREVIO_VIEW_MS = 4000;      // tour: segundos por vista cuando hay más de una
  const PREVIO_SINGLE_MS = 8000;    // tour: solo fachada
  function viewOrder(key) {
    if (key === VIEW_FACHADA) return 0;
    if (key === 'detalle') return 1;
    const m = /^interior-(\d+)$/.exec(String(key || ''));
    return m ? 10 + Number(m[1]) : 99;
  }
  function storageKey(id, view) {
    return STORAGE_PREFIX + String(id || '') + (view && view !== VIEW_FACHADA ? '.' + String(view) : '');
  }
  function readLocal(id, view, storage) {
    try {
      const raw = (storage || root.localStorage).getItem(storageKey(id, view));
      const o = raw ? JSON.parse(raw) : null;
      return o && typeof o === 'object' ? o : null;
    } catch (_) { return null; }
  }
  function writeLocal(id, view, data, storage) {
    try {
      const st = storage || root.localStorage;
      if (!data) st.removeItem(storageKey(id, view)); else st.setItem(storageKey(id, view), JSON.stringify(data));
      return true;
    } catch (_) { return false; }
  }
  // Previo efectivo de UNA vista: el del KV con el ajuste local (quad/orientación) por encima.
  function effectivePrevio(loc, local) {
    const kv = loc && loc.previo && typeof loc.previo === 'object' ? loc.previo : null;
    const ov = local && typeof local === 'object' ? local : null;
    if (!kv && !(ov && ov.imagen)) return null;
    const out = Object.assign({}, kv || {}, ov || {});
    delete out.detalle; delete out.interior; delete out.interior_disponible;
    if (!validQuad(out.quad)) out.quad = validQuad(kv && kv.quad) ? kv.quad : [[.3, .3], [.7, .3], [.7, .7], [.3, .7]];
    out.orientacion = out.orientacion === 'horizontal' ? 'horizontal' : 'vertical';
    out.tipo = out.tipo === 'real' ? 'real' : 'virtual';
    out.fuente = ov && ov.quad ? 'ajuste-manual' : (kv && kv.fuente) || out.fuente || '';
    out.local = !!(ov && ov.quad);
    return out;
  }
  // Fuentes del KV por vista. Detalle e interiores heredan tipo/orientación/confianza de la fachada si no traen.
  function viewSources(loc) {
    const kv = loc && loc.previo && typeof loc.previo === 'object' ? loc.previo : null;
    const out = [{ key: VIEW_FACHADA, kv }];
    if (!kv) return out;
    const inherit = { tipo: kv.tipo, orientacion: kv.orientacion, confianza: kv.confianza };
    if (kv.detalle && typeof kv.detalle === 'object' && kv.detalle.imagen) out.push({ key: 'detalle', kv: Object.assign({}, inherit, kv.detalle) });
    (Array.isArray(kv.interior) ? kv.interior : []).forEach((it, i) => {
      if (it && typeof it === 'object' && it.imagen) out.push({ key: 'interior-' + (i + 1), kv: Object.assign({}, inherit, it) });
    });
    return out;
  }
  // Vistas efectivas de una ubicación: [{key, previo}], en orden fachada · detalle · interior-n.
  // Un ajuste local con `imagen` crea la vista aunque el KV no la tenga (mock/pruebas).
  function previoViews(loc, readLocalFn) {
    if (!loc) return [];
    const read = typeof readLocalFn === 'function' ? readLocalFn : (id, view) => readLocal(id, view);
    const views = [];
    viewSources(loc).forEach(src => {
      const eff = effectivePrevio({ id: loc.id, previo: src.kv }, read(loc.id, src.key));
      if (eff) views.push({ key: src.key, previo: eff });
    });
    ['detalle', 'interior-1', 'interior-2', 'interior-3'].forEach(key => {
      if (views.some(v => v.key === key)) return;
      const local = read(loc.id, key);
      if (local && local.imagen) { const eff = effectivePrevio({ id: loc.id, previo: null }, local); if (eff) views.push({ key, previo: eff }); }
    });
    return views.sort((a, b) => viewOrder(a.key) - viewOrder(b.key));
  }
  // Vistas que recorre el tour: fachada → detalle → interior-1 (las que existan).
  function tourViews(views) {
    return (views || []).filter(v => v && (v.key === VIEW_FACHADA || v.key === 'detalle' || v.key === 'interior-1'));
  }
  function tourDwell(views) {
    const n = tourViews(views).length;
    return n <= 1 ? PREVIO_SINGLE_MS : PREVIO_VIEW_MS * n;
  }
  function playerUrl(id, { circuit = 'alcampo', stream = true } = {}) {
    const p = new URLSearchParams({ clean: '1', screen: String(id || ''), circuit, muted: '1' });
    if (stream) { p.set('playerType', 'virtual'); p.set('stream', '1'); }
    return PLAYER_BASE + '?' + p.toString();
  }
  // JSON del previo para subir al KV: el del KV con el quad/orientación efectivos de cada vista.
  function exportPrevio(loc, kvPrevio, views) {
    let p = {};
    try { p = JSON.parse(JSON.stringify(kvPrevio && typeof kvPrevio === 'object' ? kvPrevio : {})); } catch (_) { p = {}; }
    (views || []).forEach(v => {
      if (!v || !v.previo) return;
      const patch = { quad: v.previo.quad, orientacion: v.previo.orientacion };
      if (v.previo.local) patch.fuente = 'ajuste-manual';
      if (v.key === VIEW_FACHADA) {
        Object.assign(p, patch);
        ['imagen', 'w', 'h', 'tipo', 'confianza', 'pano', 'capturado', 'nota'].forEach(k => { if (p[k] == null && v.previo[k] != null) p[k] = v.previo[k]; });
      } else if (v.key === 'detalle') {
        p.detalle = Object.assign({}, p.detalle || {}, p.detalle ? {} : { imagen: v.previo.imagen, w: v.previo.w, h: v.previo.h }, patch);
      } else {
        const m = /^interior-(\d+)$/.exec(v.key);
        if (!m) return;
        p.interior = Array.isArray(p.interior) ? p.interior : [];
        const i = Number(m[1]) - 1;
        p.interior[i] = Object.assign({}, p.interior[i] || { imagen: v.previo.imagen, w: v.previo.w, h: v.previo.h }, patch);
      }
    });
    return JSON.stringify({ id: loc && loc.id, previo: p }, null, 2);
  }
  const api = { validQuad, quadMatrix, applyMatrix, playerSize, fitRect, screenTransform, storageKey, readLocal, writeLocal, effectivePrevio, viewSources, previoViews, tourViews, tourDwell, viewOrder, playerUrl, exportPrevio, PLAYER_SIZE, STORAGE_PREFIX, PLAYER_BASE, VIEW_FACHADA, PREVIO_VIEW_MS, PREVIO_SINGLE_MS };
  root.AdmiraPrevio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
