/* previo.js — Previo DooH: la pantalla emitiendo sobre la foto de fachada.
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
  function storageKey(id) { return STORAGE_PREFIX + String(id || ''); }
  function readLocal(id, storage) {
    try {
      const raw = (storage || root.localStorage).getItem(storageKey(id));
      const o = raw ? JSON.parse(raw) : null;
      return o && typeof o === 'object' ? o : null;
    } catch (_) { return null; }
  }
  function writeLocal(id, data, storage) {
    try {
      const st = storage || root.localStorage;
      if (!data) st.removeItem(storageKey(id)); else st.setItem(storageKey(id), JSON.stringify(data));
      return true;
    } catch (_) { return false; }
  }
  // Previo efectivo: el del KV con el ajuste local (quad/orientación) por encima.
  function effectivePrevio(loc, local) {
    const kv = loc && loc.previo && typeof loc.previo === 'object' ? loc.previo : null;
    const ov = local && typeof local === 'object' ? local : null;
    if (!kv && !(ov && ov.imagen)) return null;
    const out = Object.assign({}, kv || {}, ov || {});
    if (!validQuad(out.quad)) out.quad = validQuad(kv && kv.quad) ? kv.quad : [[.3, .3], [.7, .3], [.7, .7], [.3, .7]];
    out.orientacion = out.orientacion === 'horizontal' ? 'horizontal' : 'vertical';
    out.tipo = out.tipo === 'real' ? 'real' : 'virtual';
    out.fuente = ov && ov.quad ? 'ajuste-manual' : (kv && kv.fuente) || out.fuente || '';
    out.local = !!(ov && ov.quad);
    return out;
  }
  function playerUrl(id, { circuit = 'alcampo', stream = true } = {}) {
    const p = new URLSearchParams({ clean: '1', screen: String(id || ''), circuit, muted: '1' });
    if (stream) { p.set('playerType', 'virtual'); p.set('stream', '1'); }
    return PLAYER_BASE + '?' + p.toString();
  }
  // JSON del previo para subir al KV (sin campos de sesión).
  function exportPrevio(loc, previo) {
    const p = Object.assign({}, previo || {});
    delete p.local;
    return JSON.stringify({ id: loc && loc.id, previo: p }, null, 2);
  }
  const api = { validQuad, quadMatrix, applyMatrix, playerSize, fitRect, screenTransform, storageKey, readLocal, writeLocal, effectivePrevio, playerUrl, exportPrevio, PLAYER_SIZE, STORAGE_PREFIX, PLAYER_BASE };
  root.AdmiraPrevio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
