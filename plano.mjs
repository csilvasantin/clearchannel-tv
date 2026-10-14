// Plano y obras de un Xpacio (FLT-102063). Planta y alzado en SVG con las pantallas
// del inventario ITIL; en «Propuesta de obra» se mueven, giran, añaden y retiran
// (los mosaicos, enteros o pantalla a pantalla) y se genera la orden de obra.
// La lógica vive en plano-core.mjs.
import { localeFor } from './walk-core.mjs?v=20261010-evidence-1';
import {
  SCHEMA, round, wallLength, pointOnWall, inwardNormal, screenGeometry, footprint, furnitureAgainstWall, criteria,
  validate, workOrder, exportOrder, restoreProposal, template, placeNew, clampToWall, moveGroup, groupOf, composition, groupCanvas, reshape
} from './plano-core.mjs?v=20261014-plano-1';

const copy = {
  es: {
    back: '← Volver a la ficha', eyebrow: 'Plano del Xpacio · inventario ITIL', current: 'Distribución actual', works: 'Propuesta de obra',
    modes: 'Qué distribución ver', loading: 'Cargando el plano…', noPlan: 'Este Xpacio aún no tiene plano en admira.app.', loadError: 'No se pudo cargar el plano.',
    plan: 'Planta', planHint: 'Pulsa una pared para ver su alzado', elevation: 'Alzado', planAria: 'Plano en planta', elevationAria: 'Alzado de la pared',
    dragHint: 'Arrastra una pantalla en el alzado o muévela con las flechas (Mayús: 10 cm). Los mosaicos se mueven enteros salvo que lo desactives.',
    inventory: 'Inventario ITIL · pantallas', selected: 'Pantalla seleccionada',
    order: 'Orden de obra', export: 'Descargar orden de obra (JSON)', add: 'Añadir', addVertical: '▯ Vertical 55″', addHorizontal: '▭ Horizontal 55″', addH: '▯▭▯ Mosaico H', addMosaic: '▯▭▯▯▭▯ Mosaico doble H',
    reset: 'Volver a la distribución actual', proposalName: 'Nombre de la propuesta', defaultTitle: 'Propuesta de obra',
    orderNote: 'Borrador en este navegador. Las altas y bajas de CI se aplican en Yokup, el maestro del ITIL, cuando la obra se apruebe y se ejecute.',
    saved: 'Borrador guardado en este navegador', notSaved: 'No se pudo guardar el borrador en este navegador',
    thItil: 'CI ITIL', thName: 'Pantalla', thType: 'Formato', thGroup: 'Mosaico · player', thWall: 'Pared', thCenter: 'Centro', thBase: 'Base', thSize: 'Tamaño', thState: 'Estado',
    screens: n => `${n} ${n === 1 ? 'pantalla' : 'pantallas'}`, pending: 'por cruzar', vertical: 'vertical', horizontal: 'horizontal',
    name: 'Nombre', wall: 'Pared', center: 'Centro desde la izquierda (m)', base: 'Base sobre el suelo (m)', orientation: 'Orientación', inches: 'Diagonal (″)',
    shopWindow: 'Pantalla de escaparate (mira a la calle)', groupLock: n => `Mover el mosaico entero (${n} pantallas)`, ungroup: 'Separar del mosaico',
    removeGroup: n => `Retirar el mosaico entero (${n})`, remove: 'Retirar esta pantalla', restore: 'Deshacer cambios de esta pantalla', propose: 'Proponer cambios',
    noIssues: 'Sin conflictos en el plano.', noActions: 'La propuesta es igual que la distribución actual: no hay obra.',
    summary: r => ['alta', 'baja', 'modificacion', 'sustitucion', 'contenidos'].filter(k => r[k]).map(k => `${r[k]} ${({ alta: ['alta', 'altas'], baja: ['baja', 'bajas'], modificacion: ['modificación', 'modificaciones'], sustitucion: ['sustitución', 'sustituciones'], contenidos: ['de contenidos', 'de contenidos'] })[k][r[k] > 1 ? 1 : 0]}`).join(' · '),
    types: { alta: 'Alta', baja: 'Baja', modificacion: 'Modificación', sustitucion: 'Sustitución', contenidos: 'Contenidos' }, inventoryLine: 'Inventario', contentLine: 'Contenidos',
    removed: 'retirada', unchanged: 'sin cambios', criterion: m => `criterio: base a ${m} m`, wallOf: (w, l, h) => `${w} · ${l} m de largo · ${h} m de alto`,
    source: 'Fuente', model: 'Modelo', state: 'Estado', size: 'Tamaño', player: 'Player', screenId: 'Pantalla en admira.studio', group: 'Mosaico'
  },
  en: {
    back: '← Back to the profile', eyebrow: 'Xpace floor plan · ITIL inventory', current: 'Current layout', works: 'Works proposal',
    modes: 'Which layout to show', loading: 'Loading the floor plan…', noPlan: 'This Xpace has no floor plan in admira.app yet.', loadError: 'The floor plan could not be loaded.',
    plan: 'Floor plan', planHint: 'Click a wall to see its elevation', elevation: 'Elevation', planAria: 'Floor plan', elevationAria: 'Wall elevation',
    dragHint: 'Drag a screen in the elevation or move it with the arrow keys (Shift: 10 cm). Mosaics move as a whole unless you turn it off.',
    inventory: 'ITIL inventory · screens', selected: 'Selected screen',
    order: 'Work order', export: 'Download work order (JSON)', add: 'Add', addVertical: '▯ Portrait 55″', addHorizontal: '▭ Landscape 55″', addH: '▯▭▯ H mosaic', addMosaic: '▯▭▯▯▭▯ Double-H mosaic',
    reset: 'Back to the current layout', proposalName: 'Proposal name', defaultTitle: 'Works proposal',
    orderNote: 'Draft stored in this browser. CI additions and removals are applied in Yokup, the ITIL master, once the works are approved and done. Work order lines are in Spanish.',
    saved: 'Draft saved in this browser', notSaved: 'The draft could not be saved in this browser',
    thItil: 'ITIL CI', thName: 'Screen', thType: 'Format', thGroup: 'Mosaic · player', thWall: 'Wall', thCenter: 'Centre', thBase: 'Base', thSize: 'Size', thState: 'Status',
    screens: n => `${n} ${n === 1 ? 'screen' : 'screens'}`, pending: 'to match', vertical: 'portrait', horizontal: 'landscape',
    name: 'Name', wall: 'Wall', center: 'Centre from the left (m)', base: 'Bottom above the floor (m)', orientation: 'Orientation', inches: 'Diagonal (″)',
    shopWindow: 'Shop-window screen (faces the street)', groupLock: n => `Move the whole mosaic (${n} screens)`, ungroup: 'Detach from the mosaic',
    removeGroup: n => `Remove the whole mosaic (${n})`, remove: 'Remove this screen', restore: 'Undo changes to this screen', propose: 'Propose changes',
    noIssues: 'No conflicts in the plan.', noActions: 'The proposal matches the current layout: no works needed.',
    summary: r => ['alta', 'baja', 'modificacion', 'sustitucion', 'contenidos'].filter(k => r[k]).map(k => `${r[k]} ${({ alta: ['addition', 'additions'], baja: ['removal', 'removals'], modificacion: ['change', 'changes'], sustitucion: ['replacement', 'replacements'], contenidos: ['content update', 'content updates'] })[k][r[k] > 1 ? 1 : 0]}`).join(' · '),
    types: { alta: 'New', baja: 'Removal', modificacion: 'Change', sustitucion: 'Replacement', contenidos: 'Content' }, inventoryLine: 'Inventory', contentLine: 'Content',
    removed: 'removed', unchanged: 'unchanged', criterion: m => `criterion: bottom at ${m} m`, wallOf: (w, l, h) => `${w} · ${l} m long · ${h} m high`,
    source: 'Source', model: 'Model', state: 'Status', size: 'Size', player: 'Player', screenId: 'Screen in admira.studio', group: 'Mosaic'
  }
};

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const U = 100; // unidades SVG por metro
const params = new URLSearchParams(location.search);
const LANGUAGE_KEY = (window.ADMIRA_SITE_BRAND?.id || 'clearchannel') + '-lang';
let savedLang = '';
try { savedLang = localStorage.getItem(LANGUAGE_KEY) || ''; } catch {}
let lang = localeFor(location.hostname, location.search, savedLang);
const tr = (key, ...args) => { const v = copy[lang][key]; return typeof v === 'function' ? v(...args) : v; };
const fmt = n => round(n).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const xpacioId = /^[a-z0-9][a-z0-9-]{0,79}$/.test(params.get('locationId') || '') ? params.get('locationId') : 'alsea-sbux-021';
const STORE_KEY = 'admira.plano.' + xpacioId;
let plan = null;
const state = { mode: 'actual', wallId: null, selectedId: null, proposal: null, statusKey: 'loading', groupLock: true };

function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}
function text(parent, x, y, value, cls, extra = {}) { const t = el('text', { x, y, class: cls, ...extra }, parent); t.textContent = value; return t; }

const screens = () => state.mode === 'obra' ? state.proposal.propuesta : plan.pantallas;
const original = id => plan.pantallas.find(s => s.id === id);
const wallById = id => plan.paredes.find(w => w.id === id);
const wallName = id => { const w = wallById(id); return w ? (w.nombre || w.id) : id; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function setStatus(key) { state.statusKey = key; $('page-status').textContent = key ? tr(key) : ''; }

function translate() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-copy]').forEach(n => { n.textContent = tr(n.dataset.copy); });
  document.querySelectorAll('[data-copy-aria]').forEach(n => n.setAttribute('aria-label', tr(n.dataset.copyAria)));
  if (state.statusKey) setStatus(state.statusKey);
}

// ── Propuesta ────────────────────────────────────────────────────────────────
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    let ok = true;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(exportOrder(plan, state.proposal.propuesta, { titulo: state.proposal.titulo }))); } catch { ok = false; }
    $('saved').textContent = tr(ok ? 'saved' : 'notSaved');
  }, 250);
}
const copyOf = list => JSON.parse(JSON.stringify(list));
function freshProposal() { return { titulo: tr('defaultTitle'), propuesta: copyOf(plan.pantallas) }; }
function loadProposal() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch {}
  return restoreProposal(saved, plan) || freshProposal();
}
function setProposal(list) { state.proposal.propuesta = list; persist(); }
function updateScreen(id, patch, { clamp = true } = {}) {
  setProposal(state.proposal.propuesta.map(s => {
    if (s.id !== id) return s;
    const next = { ...s, ...patch };
    return clamp ? clampToWall(plan, next) : next;
  }));
}
// Ids que se mueven juntos con la pantalla `id`: su mosaico, si el candado está puesto.
function movingIds(id, list = screens()) {
  const s = list.find(x => x.id === id);
  if (!s) return [];
  return state.groupLock && s.grupo ? groupOf(list, s.grupo).map(x => x.id) : [id];
}
function moveFrom(snapshot, id, ds, dz, pared) {
  const ids = movingIds(id, snapshot);
  setProposal(moveGroup(plan, snapshot, ids, { ds, dz, pared }));
}

// ── Planta ───────────────────────────────────────────────────────────────────
function renderPlanta() {
  const svg = $('planta');
  svg.replaceChildren();
  const xs = plan.paredes.flatMap(w => [w.a[0], w.b[0]]), ys = plan.paredes.flatMap(w => [w.a[1], w.b[1]]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), m = 90;
  svg.setAttribute('viewBox', `${minX * U - m} ${minY * U - m} ${(maxX - minX) * U + 2 * m} ${(maxY - minY) * U + 2 * m}`);
  el('polygon', { class: 'floor', points: plan.paredes.map(w => `${w.a[0] * U},${w.a[1] * U}`).join(' ') }, svg);

  for (const f of plan.mobiliario || []) {
    el('rect', { class: 'furniture', x: f.x * U, y: f.y * U, width: f.w * U, height: f.d * U, rx: 6 }, svg);
    text(svg, (f.x + f.w / 2) * U, (f.y + f.d / 2) * U + 7, f.nombre || f.id, 'furniture-label', { 'text-anchor': 'middle' });
  }
  for (const w of plan.paredes) {
    el('line', { class: 'wall' + (w.id === state.wallId ? ' active' : ''), x1: w.a[0] * U, y1: w.a[1] * U, x2: w.b[0] * U, y2: w.b[1] * U }, svg);
  }
  for (const h of plan.huecos || []) {
    const w = wallById(h.pared); if (!w) continue;
    const p0 = pointOnWall(w, h.desde), p1 = pointOnWall(w, h.desde + h.ancho);
    if (h.tipo === 'puerta') {
      el('line', { class: 'gap-door', x1: p0[0] * U, y1: p0[1] * U, x2: p1[0] * U, y2: p1[1] * U }, svg);
      const [nx, ny] = inwardNormal(w), r = h.ancho * U;
      const tip = [p0[0] * U + nx * r, p0[1] * U + ny * r];
      el('path', { class: 'door-arc', d: `M${tip[0]},${tip[1]} A${r},${r} 0 0 1 ${p1[0] * U},${p1[1] * U}` }, svg);
      el('line', { class: 'door-arc', x1: p0[0] * U, y1: p0[1] * U, x2: tip[0], y2: tip[1] }, svg);
    } else {
      el('line', { class: 'gap-glass', x1: p0[0] * U, y1: p0[1] * U, x2: p1[0] * U, y2: p1[1] * U }, svg);
    }
  }
  // Zona de clic de cada pared y su rótulo por fuera.
  for (const w of plan.paredes) {
    const hit = el('line', { class: 'wall-hit', x1: w.a[0] * U, y1: w.a[1] * U, x2: w.b[0] * U, y2: w.b[1] * U, tabindex: 0, role: 'button', 'aria-label': `${tr('elevation')} · ${w.nombre || w.id}` }, svg);
    hit.addEventListener('click', () => selectWall(w.id));
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectWall(w.id); } });
    const mid = pointOnWall(w, wallLength(w) / 2), [nx, ny] = inwardNormal(w);
    const lx = mid[0] * U - nx * 45, ly = mid[1] * U - ny * 45 + 7;
    const vertical = Math.abs(nx) > Math.abs(ny);
    text(svg, lx, ly, `${w.nombre || w.id} · ${fmt(wallLength(w))} m`, 'wall-label', { 'text-anchor': 'middle', transform: vertical ? `rotate(-90 ${lx} ${ly})` : null });
  }
  const errors = errorIds();
  if (state.mode === 'obra') {
    for (const s of plan.pantallas) {
      const now = screens().find(x => x.id === s.id);
      if (!now || now.pared !== s.pared || Math.abs(now.s - s.s) > 0.005) drawPlanScreen(svg, s, { ghost: true });
    }
  }
  for (const s of screens()) drawPlanScreen(svg, s, { error: errors.has(s.id) });
  // Rótulos más allá del cono de visión: uno por mosaico y uno por pantalla suelta.
  const labels = new Map();
  for (const s of screens()) {
    const key = s.grupo ? 'g:' + s.grupo + ':' + s.pared : 's:' + s.id;
    if (!labels.has(key)) labels.set(key, { wall: s.pared, name: s.grupo ? (s.grupoNombre || s.grupo) : shortName(s), group: !!s.grupo, fs: [] });
    labels.get(key).fs.push(footprint(s));
  }
  for (const { wall, name, group, fs } of labels.values()) {
    const w = wallById(wall); if (!w) continue;
    const mid = (Math.min(...fs.map(f => f.x0)) + Math.max(...fs.map(f => f.x1))) / 2;
    const c = pointOnWall(w, mid), [nx, ny] = inwardNormal(w), d = 1.65 * U;
    text(svg, c[0] * U + nx * d, c[1] * U + ny * d + 9, name, 'scr-label' + (group ? ' group' : ''), { 'text-anchor': 'middle' });
  }
}

function drawPlanScreen(svg, s, { ghost = false, error = false } = {}) {
  const w = wallById(s.pared); if (!w) return;
  const f = footprint(s), [nx, ny] = inwardNormal(w);
  const p0 = pointOnWall(w, f.x0), p1 = pointOnWall(w, f.x1), off = 10, depth = 12;
  const q = (p, d) => `${p[0] * U + nx * d},${p[1] * U + ny * d}`;
  const body = `${q(p0, off)} ${q(p1, off)} ${q(p1, off + depth)} ${q(p0, off + depth)}`;
  if (ghost) { el('polygon', { class: 'scr-ghost', points: body }, svg); return; }
  const g = el('g', { class: groupClass(s, error), 'data-id': s.id }, svg);
  const c = pointOnWall(w, s.s), reach = 1.4 * U;
  const cx = c[0] * U + nx * (off + depth), cy = c[1] * U + ny * (off + depth);
  const len = wallLength(w), ux = (w.b[0] - w.a[0]) / len, uy = (w.b[1] - w.a[1]) / len, spread = reach * 0.6;
  el('polygon', { class: 'scr-cone', points: `${q(p0, off + depth)} ${q(p1, off + depth)} ${cx + nx * reach + ux * spread},${cy + ny * reach + uy * spread} ${cx + nx * reach - ux * spread},${cy + ny * reach - uy * spread}` }, g);
  el('polygon', { class: 'scr-body', points: body }, g);
  g.addEventListener('click', () => select(s.id, { wall: true }));
}

// ── Alzado ───────────────────────────────────────────────────────────────────
function renderAlzado() {
  const svg = $('alzado');
  svg.replaceChildren();
  const w = wallById(state.wallId); if (!w) return;
  const len = wallLength(w), alto = w.alto || plan.planta.alto, mL = 70, mT = 50, mB = 80;
  svg.setAttribute('viewBox', `${-mL} ${-mT} ${len * U + mL * 2} ${alto * U + mT + mB}`);
  svg.setAttribute('aria-label', tr('wallOf', w.nombre || w.id, fmt(len), fmt(alto)));
  const Y = z => (alto - z) * U;
  el('rect', { class: 'elev-wall', x: 0, y: 0, width: len * U, height: alto * U }, svg);
  for (const h of (plan.huecos || []).filter(h => h.pared === w.id)) {
    el('rect', { class: h.tipo === 'puerta' ? 'elev-door' : 'elev-glass', x: h.desde * U, y: Y((h.base || 0) + h.alto), width: h.ancho * U, height: h.alto * U }, svg);
    text(svg, (h.desde + h.ancho / 2) * U, Y((h.base || 0) + h.alto) - 10, h.nombre || h.tipo, 'dim', { 'text-anchor': 'middle' });
  }
  const crit = criteria(plan);
  el('line', { class: 'guide', x1: 0, y1: Y(crit.alturaMinima), x2: len * U, y2: Y(crit.alturaMinima) }, svg);
  text(svg, 8, Y(crit.alturaMinima) - 8, tr('criterion', fmt(crit.alturaMinima)), 'guide-label');

  const errors = errorIds();
  if (state.mode === 'obra') {
    for (const s of plan.pantallas.filter(s => s.pared === w.id)) {
      const now = screens().find(x => x.id === s.id);
      if (now && same(now, s)) continue;
      const f = footprint(s);
      el('rect', { class: 'scr-ghost', x: f.x0 * U, y: Y(f.z1), width: f.w * U, height: f.h * U }, svg);
    }
  }
  const sel = screens().find(s => s.id === state.selectedId);
  const moving = new Set(state.mode === 'obra' && sel ? movingIds(sel.id) : []);
  for (const s of screens().filter(s => s.pared === w.id)) {
    const f = footprint(s);
    const g = el('g', { class: groupClass(s, errors.has(s.id)) + (moving.has(s.id) && s.id !== state.selectedId ? ' moving' : ''), 'data-id': s.id, tabindex: 0, role: 'button', 'aria-label': `${s.nombre || s.id} · ${fmt(f.w)}×${fmt(f.h)} m` }, svg);
    el('rect', { class: 'scr-body', x: f.x0 * U, y: Y(f.z1), width: f.w * U, height: f.h * U, rx: 2 }, g);
    text(g, s.s * U, Y(f.z0 + f.h / 2) + 7, shortName(s), 'scr-label', { 'text-anchor': 'middle' });
    g.addEventListener('pointerdown', e => startDrag(e, s.id));
    g.addEventListener('keydown', e => nudge(e, s.id));
    g.addEventListener('focus', () => { if (state.selectedId !== s.id) select(s.id, { keepFocus: true }); });
  }
  // Rótulo de cada mosaico encima del conjunto.
  for (const gId of new Set(screens().filter(s => s.pared === w.id && s.grupo).map(s => s.grupo))) {
    const members = groupOf(screens(), gId).filter(s => s.pared === w.id), fs = members.map(footprint);
    const x0 = Math.min(...fs.map(f => f.x0)), x1 = Math.max(...fs.map(f => f.x1)), top = Math.max(...fs.map(f => f.z1));
    const name = (members.find(s => s.grupoNombre) || {}).grupoNombre || gId;
    text(svg, (x0 + x1) / 2 * U, Y(top) - 14, `${name} · ${composition(screens(), gId)} · ${groupCanvas(screens(), gId).join('×')} px · ${fmt(x1 - x0)} m`, 'scr-label', { 'text-anchor': 'middle' });
  }
  // Muebles delante de la pared: tapan lo que quede por debajo de su altura.
  for (const m of plan.mobiliario || []) {
    const p = furnitureAgainstWall(m, w);
    if (p.dist > crit.profundidadMueble || p.dist < -0.05) continue;
    const s0 = Math.max(0, p.s0), s1 = Math.min(len, p.s1); if (s1 <= s0) continue;
    el('rect', { class: 'elev-furn', x: s0 * U, y: Y(m.alto), width: (s1 - s0) * U, height: m.alto * U }, svg);
    text(svg, (s0 + s1) / 2 * U, Y(m.alto / 2) + 7, m.nombre || m.id, 'furniture-label', { 'text-anchor': 'middle' });
  }
  el('line', { class: 'elev-floor', x1: -30, y1: Y(0), x2: len * U + 30, y2: Y(0) }, svg);
  el('line', { class: 'dim-line', x1: 0, y1: Y(0) + 34, x2: len * U, y2: Y(0) + 34 }, svg);
  text(svg, len * U / 2, Y(0) + 62, `${fmt(len)} m`, 'dim', { 'text-anchor': 'middle' });
  text(svg, -16, Y(alto / 2), `${fmt(alto)} m`, 'dim', { 'text-anchor': 'middle', transform: `rotate(-90 -16 ${Y(alto / 2)})` });
  if (sel && sel.pared === w.id) {
    const f = footprint(sel);
    text(svg, sel.s * U, Y(0) + 26, `↔ ${fmt(sel.s)} m · ↕ ${fmt(sel.z)} m`, 'dim', { 'text-anchor': 'middle' });
    el('line', { class: 'dim-line', x1: sel.s * U, y1: Y(0), x2: sel.s * U, y2: Y(f.z0) }, svg);
  }
}

function renderTabs() {
  $('wall-tabs').replaceChildren(...plan.paredes.map(w => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab');
    const n = screens().filter(s => s.pared === w.id).length;
    b.textContent = (w.nombre || w.id) + (n ? ` (${n})` : '');
    b.setAttribute('aria-selected', String(w.id === state.wallId));
    b.addEventListener('click', () => selectWall(w.id));
    return b;
  }));
}

// ── Inventario e inspector ───────────────────────────────────────────────────
function typeLabel(s) { return `${tr(s.orientacion)} · ${s.pulgadas}″`; }
function groupLabel(s) {
  const parts = [];
  if (s.grupo) parts.push(`${s.grupoNombre || s.grupo}${s.subgrupo ? ' · ' + s.subgrupo : ''}`);
  if (s.player) parts.push(s.player);
  return parts.join(' · ') || '—';
}
function shortName(s) { return s.corto || s.nombre || s.id; }
function groupClass(s, error) {
  return ['scr', !original(s.id) ? 'new' : '', s.id === state.selectedId ? 'selected' : '', error ? 'has-error' : ''].filter(Boolean).join(' ');
}
function changeTags() {
  if (state.mode !== 'obra') return new Map();
  const tags = new Map();
  for (const a of workOrder(plan, state.proposal.propuesta).acciones) {
    if (a.tipo === 'contenidos') continue;
    if (a.grupo) groupOf(a.tipo === 'baja' ? plan.pantallas : state.proposal.propuesta, a.grupo).forEach(s => tags.set(s.id, a.tipo));
    else tags.set(a.pantalla, a.tipo);
  }
  return tags;
}
function errorIds() {
  return new Set(validate(plan, screens()).filter(i => i.nivel === 'error').map(i => i.pantalla));
}

function renderInventory() {
  const tags = changeTags();
  const rows = screens().map(s => ({ s, tag: tags.get(s.id) }));
  if (state.mode === 'obra') for (const s of plan.pantallas) if (!screens().some(x => x.id === s.id)) rows.push({ s, tag: 'baja', removed: true });
  const head = `<thead><tr><th>${tr('thItil')}</th><th>${tr('thName')}</th><th>${tr('thType')}</th><th>${tr('thGroup')}</th><th>${tr('thWall')}</th><th>${tr('thCenter')}</th><th>${tr('thBase')}</th><th>${tr('thSize')}</th><th>${tr('thState')}</th></tr></thead>`;
  const body = rows.map(({ s, tag, removed }) => {
    const g = screenGeometry(s);
    const status = state.mode === 'obra' ? `<span class="tag ${tag || ''}">${tag ? (removed ? tr('removed') : tr('types')[tag]) : tr('unchanged')}</span>` : esc(s.estado || '');
    return `<tr data-id="${esc(s.id)}" aria-selected="${s.id === state.selectedId}"${removed ? ' data-removed="1"' : ''}>
      <td>${s.itil ? `<code>${esc(s.itil)}</code>` : `<span class="tag">${tr('pending')}</span>`}</td><td>${removed ? `<s>${esc(s.nombre || s.id)}</s>` : esc(s.nombre || s.id)}</td>
      <td>${esc(typeLabel(s))} · ${g.lienzo.join('×')}</td><td>${esc(groupLabel(s))}</td><td>${esc(wallName(s.pared))}</td><td>${fmt(s.s)} m</td><td>${fmt(s.z)} m</td>
      <td>${fmt(g.w)}×${fmt(g.h)} m</td><td>${status}</td></tr>`;
  }).join('');
  $('inventory').innerHTML = head + `<tbody>${body}</tbody>`;
  $('inv-count').textContent = tr('screens', screens().length);
  $('inventory').querySelectorAll('tbody tr').forEach(row => row.addEventListener('click', () => select(row.dataset.id, { wall: true })));
}

function facts(s) {
  const g = screenGeometry(s);
  const line = (k, v) => v ? `<br><b>${tr(k)}:</b> ${esc(v)}` : '';
  return `<p class="facts"><b>${tr('thItil')}:</b> ${s.itil ? esc(s.itil) : tr('pending')}${line('screenId', s.screenId)}${line('group', s.grupo ? `${s.grupoNombre || s.grupo}${s.subgrupo ? ' · ' + s.subgrupo : ''}` : '')}${line('player', s.player)}${line('model', s.modelo)}
    <br><b>${tr('size')}:</b> ${fmt(g.w)}×${fmt(g.h)} m · ${g.lienzo.join('×')} px${line('state', s.estado)}${line('source', s.fuente)}</p>`;
}

function renderInspector() {
  const box = $('inspector'), body = $('inspector-body');
  const s = screens().find(x => x.id === state.selectedId);
  const removed = state.mode === 'obra' && !s ? original(state.selectedId) : null;
  box.hidden = !s && !removed;
  if (box.hidden) { body.replaceChildren(); return; }
  if (removed) {
    body.innerHTML = facts(removed) + `<p class="facts">${tr('removed')}</p><div class="buttons"><button type="button" id="insp-restore">${tr('restore')}</button></div>`;
    $('insp-restore').addEventListener('click', () => { setProposal(state.proposal.propuesta.concat(copyOf([removed]))); state.wallId = removed.pared; renderAll(); });
    return;
  }
  if (state.mode !== 'obra') {
    body.innerHTML = facts(s) + `<p class="facts">${esc(typeLabel(s))} · ${esc(wallName(s.pared))} · ↔ ${fmt(s.s)} m · ↕ ${fmt(s.z)} m</p><div class="buttons"><button type="button" id="insp-propose">${tr('propose')}</button></div>`;
    $('insp-propose').addEventListener('click', () => setMode('obra'));
    return;
  }
  const members = s.grupo ? groupOf(screens(), s.grupo) : [];
  const wallOptions = plan.paredes.map(w => `<option value="${esc(w.id)}"${w.id === s.pared ? ' selected' : ''}>${esc(w.nombre || w.id)}</option>`).join('');
  const inchOptions = [32, 43, 49, 55, 65, 75, 86, 98].map(n => `<option value="${n}"${n === s.pulgadas ? ' selected' : ''}>${n}″</option>`).join('');
  body.innerHTML = facts(s) + `
    ${members.length > 1 ? `<label class="check"><input id="f-lock" type="checkbox"${state.groupLock ? ' checked' : ''}>${esc(tr('groupLock', members.length))}</label>` : ''}
    <label>${tr('name')}<input id="f-name" maxlength="60" value="${esc(s.nombre || '')}"></label>
    <label>${tr('wall')}<select id="f-wall">${wallOptions}</select></label>
    <div class="row"><label>${tr('center')}<input id="f-s" type="number" step="0.01" value="${round(s.s)}"></label><label>${tr('base')}<input id="f-z" type="number" step="0.01" value="${round(s.z)}"></label></div>
    <div class="row"><label>${tr('orientation')}<select id="f-orient"><option value="vertical"${s.orientacion === 'vertical' ? ' selected' : ''}>${tr('vertical')}</option><option value="horizontal"${s.orientacion === 'horizontal' ? ' selected' : ''}>${tr('horizontal')}</option></select></label>
      <label>${tr('inches')}<select id="f-inches">${inchOptions}</select></label></div>
    <label class="check"><input id="f-window" type="checkbox"${s.escaparate ? ' checked' : ''}>${tr('shopWindow')}</label>
    <div class="buttons">
      ${original(s.id) && !same(original(s.id), s) ? `<button type="button" id="insp-restore">${tr('restore')}</button>` : ''}
      ${s.grupo ? `<button type="button" id="insp-ungroup">${tr('ungroup')}</button>` : ''}
      <button type="button" id="insp-remove" class="danger">${tr('remove')}</button>
      ${members.length > 1 ? `<button type="button" id="insp-remove-group" class="danger">${esc(tr('removeGroup', members.length))}</button>` : ''}
    </div>`;
  const on = (id, ev, fn) => { const n = $(id); if (n) n.addEventListener(ev, fn); };
  const snap = () => copyOf(state.proposal.propuesta);
  on('f-lock', 'change', e => { state.groupLock = e.target.checked; renderAll(); });
  on('f-name', 'change', e => { updateScreen(s.id, { nombre: e.target.value.trim() || s.nombre }, { clamp: false }); renderAll(); });
  on('f-wall', 'change', e => { moveFrom(snap(), s.id, 0, 0, e.target.value); state.wallId = e.target.value; renderAll(); });
  on('f-s', 'change', e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) moveFrom(snap(), s.id, v - s.s, 0); renderAll(); });
  on('f-z', 'change', e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) moveFrom(snap(), s.id, 0, v - s.z); renderAll(); });
  on('f-orient', 'change', e => { updateScreen(s.id, reshape(s, { orientacion: e.target.value })); renderAll(); });
  on('f-inches', 'change', e => { updateScreen(s.id, reshape(s, { pulgadas: Number(e.target.value) })); renderAll(); });
  on('f-window', 'change', e => { updateScreen(s.id, { escaparate: e.target.checked }, { clamp: false }); renderAll(); });
  on('insp-ungroup', 'click', () => { updateScreen(s.id, { grupo: undefined, grupoNombre: undefined, subgrupo: undefined }, { clamp: false }); renderAll(); });
  on('insp-remove', 'click', () => { setProposal(state.proposal.propuesta.filter(x => x.id !== s.id)); if (!original(s.id)) state.selectedId = null; renderAll(); });
  on('insp-remove-group', 'click', () => { const ids = new Set(members.map(x => x.id)); setProposal(state.proposal.propuesta.filter(x => !ids.has(x.id))); if (!original(s.id)) state.selectedId = null; renderAll(); });
  on('insp-restore', 'click', () => { const o = original(s.id); updateScreen(s.id, copyOf(o), { clamp: false }); state.wallId = o.pared; renderAll(); });
}

// ── Orden de obra ────────────────────────────────────────────────────────────
function renderOrder() {
  const box = $('order');
  box.hidden = state.mode !== 'obra';
  if (box.hidden) return;
  const issues = validate(plan, state.proposal.propuesta);
  $('validation').innerHTML = issues.length
    ? `<ul class="issues">${issues.map(i => `<li class="${i.nivel}">${esc(i.texto)}</li>`).join('')}</ul>`
    : `<p class="ok">✓ ${tr('noIssues')}</p>`;
  const { acciones, resumen } = workOrder(plan, state.proposal.propuesta);
  $('order-title').textContent = `${tr('order')}${acciones.length ? ' · ' + tr('summary', resumen) : ''}`;
  $('actions').innerHTML = acciones.length ? acciones.map(a => `<li><strong><span class="tag ${a.tipo}">${tr('types')[a.tipo]}</span> ${esc(a.nombre)}${a.itil ? ` · <code>${esc(a.itil)}</code>` : ''}</strong>
    <ul>${a.obra.map(o => `<li>${esc(o)}</li>`).join('')}<li class="itil">${tr('inventoryLine')}: ${esc(a.inventario)}</li>${a.contenidos ? `<li class="contenidos">${tr('contentLine')}: ${esc(a.contenidos)}</li>` : ''}</ul></li>`).join('')
    : `<li class="empty">${tr('noActions')}</li>`;
}

function exportJson() {
  const order = exportOrder(plan, state.proposal.propuesta, { titulo: state.proposal.titulo });
  const blob = new Blob([JSON.stringify(order, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const slug = (state.proposal.titulo || 'propuesta').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'propuesta';
  a.href = URL.createObjectURL(blob);
  a.download = `orden-obra-${plan.id}-${slug}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Interacción ──────────────────────────────────────────────────────────────
function renderAll({ focusId } = {}) {
  renderPlanta(); renderTabs(); renderAlzado(); renderInventory(); renderInspector(); renderOrder();
  const obra = state.mode === 'obra';
  $('toolbar').hidden = !obra;
  $('drag-hint').hidden = !obra;
  $('mode-actual').setAttribute('aria-pressed', String(!obra));
  $('mode-obra').setAttribute('aria-pressed', String(obra));
  if (focusId) document.querySelector(`#alzado [data-id="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
}
function selectWall(id) { state.wallId = id; renderAll(); }
function select(id, { wall = false, keepFocus = false } = {}) {
  state.selectedId = id;
  const s = screens().find(x => x.id === id) || original(id);
  if (wall && s) state.wallId = s.pared;
  renderAll({ focusId: keepFocus ? id : null });
}
function setMode(mode) {
  state.mode = mode;
  if (mode === 'obra' && !state.proposal) state.proposal = loadProposal();
  if (mode === 'obra') $('proposal-title').value = state.proposal.titulo;
  if (state.selectedId && !screens().some(s => s.id === state.selectedId) && !original(state.selectedId)) state.selectedId = null;
  renderAll();
}

let drag = null;
function svgPoint(svg, e) {
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
function startDrag(e, id) {
  if (e.button !== 0) return;
  if (state.selectedId !== id) select(id);
  if (state.mode !== 'obra') return;
  const svg = $('alzado'), p = svgPoint(svg, e);
  drag = { id, pointer: e.pointerId, x: p.x, y: p.y, snapshot: copyOf(state.proposal.propuesta) };
  svg.setPointerCapture(e.pointerId);
  e.preventDefault();
}
$('alzado').addEventListener('pointermove', e => {
  if (!drag || drag.pointer !== e.pointerId) return;
  const p = svgPoint($('alzado'), e), snap = e.altKey ? 0.01 : 0.05;
  const ds = Math.round((p.x - drag.x) / U / snap) * snap, dz = Math.round(-(p.y - drag.y) / U / snap) * snap;
  moveFrom(drag.snapshot, drag.id, ds, dz);
  renderAll();
});
const endDrag = e => { if (drag && drag.pointer === e.pointerId) drag = null; };
$('alzado').addEventListener('pointerup', endDrag);
$('alzado').addEventListener('pointercancel', endDrag);
function nudge(e, id) {
  if (state.mode !== 'obra') return;
  const step = e.shiftKey ? 0.1 : 0.01;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
  if (!d) { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('insp-remove')?.click(); } return; }
  e.preventDefault();
  moveFrom(copyOf(state.proposal.propuesta), id, d[0], d[1]);
  renderAll({ focusId: id });
}

$('mode-actual').addEventListener('click', () => setMode('actual'));
$('mode-obra').addEventListener('click', () => setMode('obra'));
$('proposal-title').addEventListener('input', e => { state.proposal.titulo = e.target.value.trim() || tr('defaultTitle'); persist(); });
$('reset').addEventListener('click', () => {
  state.proposal = freshProposal(); $('proposal-title').value = state.proposal.titulo;
  try { localStorage.removeItem(STORE_KEY); } catch {}
  $('saved').textContent = ''; renderAll();
});
$('export').addEventListener('click', exportJson);
document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
  const list = state.proposal.propuesta;
  const placed = placeNew(plan, list, template(b.dataset.add, list.concat(plan.pantallas)), state.wallId);
  setProposal(list.concat(placed));
  state.selectedId = placed[0].id; state.wallId = placed[0].pared;
  renderAll();
}));
document.addEventListener('admira:lang', e => {
  const next = e.detail?.lang === 'es' ? 'es' : 'en'; if (next === lang) return;
  lang = next; translate(); if (plan) { renderSource(); renderAll(); }
});

function renderSource() {
  const src = plan.fuente || {};
  const lines = [src.medidas, src.pantallas, src.itil].filter(Boolean).map(esc);
  $('source').hidden = !lines.length;
  $('source').innerHTML = `<strong>${esc(src.titulo || tr('source'))}</strong> · ${lines.join(' · ')}`;
}

async function init() {
  translate();
  $('back').href = `/?locationId=${encodeURIComponent(xpacioId)}&lang=${lang}`;
  let res;
  try { res = await fetch(`data/xpacios/${xpacioId}.json`, { cache: 'no-store' }); } catch { setStatus('loadError'); return; }
  if (res.status === 404) { setStatus('noPlan'); return; }
  try { plan = await res.json(); } catch { plan = null; }
  if (!res.ok || !plan || plan.schema !== SCHEMA || !Array.isArray(plan.paredes) || !Array.isArray(plan.pantallas)) { plan = null; setStatus('loadError'); return; }
  document.title = `${plan.nombre} · ${tr('plan')} · ${window.ADMIRA_SITE_BRAND?.name || 'Clear Channel'}`;
  $('title').textContent = plan.nombre;
  $('address').textContent = plan.direccion || '';
  renderSource();
  state.wallId = (plan.pantallas[0] && plan.pantallas[0].pared) || plan.paredes[0].id;
  setStatus('');
  $('workspace').hidden = false;
  setMode(params.get('modo') === 'obra' ? 'obra' : 'actual');
}
init();
