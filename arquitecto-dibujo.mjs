// Estudio del Arquitecto (DCL-66d9ae0d5e756d0067127f24): planta y alzado en SVG, en texto y sin DOM (se prueba en
// node). Las mismas clases que plano.css (floor, wall, gap-door, furniture, scr-body…) para que el plano del estudio
// se vea igual que el de plano.html; las pantallas nuevas de una propuesta llevan la clase «new» (verde lima) y las
// retiradas quedan como fantasma. 100 unidades SVG por metro y la escala --k de plano.mjs.
import { round, wallLength, pointOnWall, inwardNormal, footprint, furnitureAgainstWall, criteria } from './plano-core.mjs?v=20261014-plano-1';

export const U = 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n = v => round(v, 1);
const attrs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
const tag = (t, o, inner) => inner === undefined ? `<${t}${attrs(o)}/>` : `<${t}${attrs(o)}>${inner}</${t}>`;
const fmt = (v, lang = 'es') => String(round(v, 2).toFixed(2)).replace('.', lang === 'es' ? ',' : '.');

// Escala de rótulos (como scaleOf de plano.mjs): 1 en un local de 14 m; proporcional en uno pequeño.
export function escala(plan) {
  const xs = plan.paredes.flatMap(w => [w.a[0], w.b[0]]), ys = plan.paredes.flatMap(w => [w.a[1], w.b[1]]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.min(1, Math.max(0.2, round(span / 14, 3)));
}
const corto = s => s.corto || s.nombre || s.id;

// Planta: suelo, muebles, paredes (la elegida resaltada), huecos, pantallas (con su cono) y rótulos de pared.
export function svgPlanta(plan, pantallas = plan.pantallas, { wallId, nuevos = new Set(), retiradas = [], lang = 'es' } = {}) {
  const K = escala(plan), xs = plan.paredes.flatMap(w => [w.a[0], w.b[0]]), ys = plan.paredes.flatMap(w => [w.a[1], w.b[1]]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), m = 90 * K;
  const out = [];
  out.push(tag('polygon', { class: 'floor', points: plan.paredes.map(w => `${n(w.a[0] * U)},${n(w.a[1] * U)}`).join(' ') }));
  for (const f of plan.mobiliario || []) {
    out.push(tag('rect', { class: 'furniture', x: n(f.x * U), y: n(f.y * U), width: n(f.w * U), height: n(f.d * U), rx: 6 }));
    const name = String(f.nombre || f.id), size = 26 * K, fits = name.length * 0.55 * size <= f.w * U;
    if (fits) out.push(tag('text', { class: 'furniture-label', x: n((f.x + f.w / 2) * U), y: n((f.y + f.d / 2) * U + 7 * K), 'text-anchor': 'middle' }, esc(name)));
  }
  for (const w of plan.paredes) out.push(tag('line', { class: 'wall' + (w.id === wallId ? ' active' : ''), x1: n(w.a[0] * U), y1: n(w.a[1] * U), x2: n(w.b[0] * U), y2: n(w.b[1] * U) }));
  for (const h of plan.huecos || []) {
    const w = plan.paredes.find(x => x.id === h.pared); if (!w) continue;
    const p0 = pointOnWall(w, h.desde), p1 = pointOnWall(w, h.desde + h.ancho);
    if (h.tipo === 'puerta') {
      out.push(tag('line', { class: 'gap-door', x1: n(p0[0] * U), y1: n(p0[1] * U), x2: n(p1[0] * U), y2: n(p1[1] * U) }));
      const [nx, ny] = inwardNormal(w), r = h.ancho * U, tip = [p0[0] * U + nx * r, p0[1] * U + ny * r];
      out.push(tag('path', { class: 'door-arc', d: `M${n(tip[0])},${n(tip[1])} A${n(r)},${n(r)} 0 0 1 ${n(p1[0] * U)},${n(p1[1] * U)}` }));
    } else out.push(tag('line', { class: 'gap-glass', x1: n(p0[0] * U), y1: n(p0[1] * U), x2: n(p1[0] * U), y2: n(p1[1] * U) }));
  }
  const pinta = (s, cls) => {
    const w = plan.paredes.find(x => x.id === s.pared); if (!w) return;
    const f = footprint(s), [nx, ny] = inwardNormal(w), p0 = pointOnWall(w, f.x0), p1 = pointOnWall(w, f.x1), off = 10, depth = 12;
    const q = (p, d) => `${n(p[0] * U + nx * d)},${n(p[1] * U + ny * d)}`;
    const body = `${q(p0, off)} ${q(p1, off)} ${q(p1, off + depth)} ${q(p0, off + depth)}`;
    if (cls === 'ghost') { out.push(tag('polygon', { class: 'scr-ghost', points: body })); return; }
    const reach = 1.4 * U * Math.max(K, 0.35), c = pointOnWall(w, s.s), cx = c[0] * U + nx * (off + depth), cy = c[1] * U + ny * (off + depth);
    const len = wallLength(w), ux = (w.b[0] - w.a[0]) / len, uy = (w.b[1] - w.a[1]) / len, spread = reach * 0.6;
    const cone = `${q(p0, off + depth)} ${q(p1, off + depth)} ${n(cx + nx * reach + ux * spread)},${n(cy + ny * reach + uy * spread)} ${n(cx + nx * reach - ux * spread)},${n(cy + ny * reach - uy * spread)}`;
    out.push(tag('g', { class: 'scr' + (cls ? ' ' + cls : ''), 'data-id': s.id }, tag('polygon', { class: 'scr-cone', points: cone }) + tag('polygon', { class: 'scr-body', points: body }) + tag('title', {}, esc(s.nombre || s.id))));
  };
  for (const s of retiradas) pinta(s, 'ghost');
  for (const s of pantallas) pinta(s, nuevos.has(s.id) ? 'new' : '');
  for (const w of plan.paredes) {
    const mid = pointOnWall(w, wallLength(w) / 2), [nx, ny] = inwardNormal(w), lx = mid[0] * U - nx * 45 * K, ly = mid[1] * U - ny * 45 * K + 7 * K;
    const vertical = Math.abs(nx) > Math.abs(ny);
    out.push(tag('text', { class: 'wall-label', x: n(lx), y: n(ly), 'text-anchor': 'middle', transform: vertical ? `rotate(-90 ${n(lx)} ${n(ly)})` : undefined, 'data-wall': w.id }, esc(`${w.nombre || w.id} · ${fmt(wallLength(w), lang)} m`)));
  }
  return { viewBox: `${n(minX * U - m)} ${n(minY * U - m)} ${n((maxX - minX) * U + 2 * m)} ${n((maxY - minY) * U + 2 * m)}`, k: K, cuerpo: out.join('') };
}

// Alzado de una pared: huecos, criterio de altura, pantallas (nuevas en lima, retiradas en fantasma), muebles
// delante y cotas.
export function svgAlzado(plan, pantallas = plan.pantallas, wallId, { nuevos = new Set(), retiradas = [], lang = 'es' } = {}) {
  const w = plan.paredes.find(x => x.id === wallId) || plan.paredes[0];
  const K = escala(plan), len = wallLength(w), alto = w.alto || plan.planta.alto, mL = 70 * K, mT = 50 * K, mB = 80 * K;
  const Y = z => n((alto - z) * U), out = [];
  out.push(tag('rect', { class: 'elev-wall', x: 0, y: 0, width: n(len * U), height: n(alto * U) }));
  for (const h of (plan.huecos || []).filter(h => h.pared === w.id)) {
    out.push(tag('rect', { class: h.tipo === 'puerta' ? 'elev-door' : 'elev-glass', x: n(h.desde * U), y: Y((h.base || 0) + h.alto), width: n(h.ancho * U), height: n(h.alto * U) }));
    out.push(tag('text', { class: 'dim', x: n((h.desde + h.ancho / 2) * U), y: n(Y((h.base || 0) + h.alto) - 10 * K), 'text-anchor': 'middle' }, esc(h.nombre || h.tipo)));
  }
  const crit = criteria(plan);
  out.push(tag('line', { class: 'guide', x1: 0, y1: Y(crit.alturaMinima), x2: n(len * U), y2: Y(crit.alturaMinima) }));
  for (const s of retiradas.filter(s => s.pared === w.id)) { const f = footprint(s); out.push(tag('rect', { class: 'scr-ghost', x: n(f.x0 * U), y: Y(f.z1), width: n(f.w * U), height: n(f.h * U) })); }
  for (const s of pantallas.filter(s => s.pared === w.id)) {
    const f = footprint(s);
    out.push(tag('g', { class: 'scr' + (nuevos.has(s.id) ? ' new' : ''), 'data-id': s.id },
      tag('rect', { class: 'scr-body', x: n(f.x0 * U), y: Y(f.z1), width: n(f.w * U), height: n(f.h * U), rx: 2 }) +
      tag('text', { class: 'scr-label', x: n(s.s * U), y: n(Y(f.z0 + f.h / 2) + 7 * K), 'text-anchor': 'middle' }, esc(corto(s))) + tag('title', {}, esc(s.nombre || s.id))));
  }
  for (const m of plan.mobiliario || []) {
    const p = furnitureAgainstWall(m, w);
    if (p.dist > crit.profundidadMueble || p.dist < -0.05) continue;
    const s0 = Math.max(0, p.s0), s1 = Math.min(len, p.s1); if (s1 <= s0) continue;
    out.push(tag('rect', { class: 'elev-furn', x: n(s0 * U), y: Y(m.alto), width: n((s1 - s0) * U), height: n(m.alto * U) }));
  }
  out.push(tag('line', { class: 'elev-floor', x1: n(-30 * K), y1: Y(0), x2: n(len * U + 30 * K), y2: Y(0) }));
  out.push(tag('line', { class: 'dim-line', x1: 0, y1: n(Y(0) + 34 * K), x2: n(len * U), y2: n(Y(0) + 34 * K) }));
  out.push(tag('text', { class: 'dim', x: n(len * U / 2), y: n(Y(0) + 62 * K), 'text-anchor': 'middle' }, `${fmt(len, lang)} m`));
  out.push(tag('text', { class: 'dim', x: n(-16 * K), y: Y(alto / 2), 'text-anchor': 'middle', transform: `rotate(-90 ${n(-16 * K)} ${Y(alto / 2)})` }, `${fmt(alto, lang)} m`));
  return { viewBox: `${n(-mL)} ${n(-mT)} ${n(len * U + mL * 2)} ${n(alto * U + mT + mB)}`, k: K, pared: w.id, cuerpo: out.join('') };
}
