// Plano y obras de un Xpacio (FLT-102063): geometría, validación y orden de obra.
// Sin DOM: lo usan plano.mjs y los tests. Unidades en metros; planta con el eje y
// hacia dentro del local. Cada pared va de `a` a `b` recorriendo el local en el
// sentido de las agujas del reloj (y hacia abajo), así su alzado visto desde dentro
// va de `a` (izquierda) a `b` (derecha).
//
// Cada pantalla física es un elemento (CI) del inventario ITIL. Un mosaico es un
// `grupo` de pantallas contiguas: el «doble H» son dos H (vertical, horizontal
// centrada y vertical) seguidas, V–H–V–V–H–V, como la instalación de admira.studio.

export const SCHEMA = 'admira.xpacio-plano/1';
export const ORDER_SCHEMA = 'admira.orden-obra/1';
const INCH = 0.0254;
const EPS = 1e-6;
const MOVE_EPS = 0.005;
const TOUCH = 0.002;

export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
// Metros en los textos de la orden de obra, que van en castellano: coma decimal.
const metros = (n, d = 2) => String(round(n, d)).replace('.', ',');
const clone = o => JSON.parse(JSON.stringify(o));

export function wallLength(wall) {
  return Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
}

// Punto de la planta a `s` metros del extremo `a` de la pared.
export function pointOnWall(wall, s) {
  const len = wallLength(wall) || 1;
  const t = s / len;
  return [wall.a[0] + (wall.b[0] - wall.a[0]) * t, wall.a[1] + (wall.b[1] - wall.a[1]) * t];
}

// Normal hacia el interior (a la derecha del sentido a→b con el eje y hacia abajo).
export function inwardNormal(wall) {
  const len = wallLength(wall) || 1;
  const dx = (wall.b[0] - wall.a[0]) / len, dy = (wall.b[1] - wall.a[1]) / len;
  return [-dy, dx];
}

// Medidas de un panel por su diagonal y relación de aspecto. `orientacion`
// vertical intercambia ancho y alto. `dimensiones` explícitas mandan (modelo real).
export function panelSize({ pulgadas = 55, aspecto = [16, 9], orientacion = 'horizontal', dimensiones } = {}) {
  if (dimensiones && dimensiones.ancho > 0 && dimensiones.alto > 0) {
    const { ancho, alto } = dimensiones;
    return orientacion === 'vertical' ? { w: Math.min(ancho, alto), h: Math.max(ancho, alto) } : { w: Math.max(ancho, alto), h: Math.min(ancho, alto) };
  }
  const [aw, ah] = aspecto;
  const k = pulgadas * INCH / Math.hypot(aw, ah);
  const long = aw * k, short = ah * k;
  return orientacion === 'vertical' ? { w: short, h: long } : { w: long, h: short };
}

// Medidas físicas y lienzo en píxeles de una pantalla.
export function screenGeometry(screen) {
  const size = panelSize(screen);
  const res = screen.resolucion || [1920, 1080];
  const lienzo = screen.orientacion === 'vertical' ? [Math.min(...res), Math.max(...res)] : [Math.max(...res), Math.min(...res)];
  return { w: size.w, h: size.h, lienzo };
}

// Huella de la pantalla en el alzado de su pared: s es el centro, z la base.
export function footprint(screen) {
  const g = screenGeometry(screen);
  const x0 = screen.s - g.w / 2;
  return { x0, x1: x0 + g.w, z0: screen.z, z1: screen.z + g.h, w: g.w, h: g.h };
}

const overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;
const rectsOverlap = (a, b) => overlap1(a.x0, a.x1, b.x0, b.x1) && overlap1(a.z0, a.z1, b.z0, b.z1);

// Rango [s0, s1] y distancia a la pared de un mueble rectangular de la planta.
export function furnitureAgainstWall(item, wall) {
  const corners = [[item.x, item.y], [item.x + item.w, item.y], [item.x, item.y + item.d], [item.x + item.w, item.y + item.d]];
  const len = wallLength(wall) || 1;
  const ux = (wall.b[0] - wall.a[0]) / len, uy = (wall.b[1] - wall.a[1]) / len;
  const [nx, ny] = inwardNormal(wall);
  const ss = corners.map(([x, y]) => (x - wall.a[0]) * ux + (y - wall.a[1]) * uy);
  const ds = corners.map(([x, y]) => (x - wall.a[0]) * nx + (y - wall.a[1]) * ny);
  return { s0: Math.min(...ss), s1: Math.max(...ss), dist: Math.min(...ds) };
}

const label = s => s.nombre || s.id;
export const criteria = plan => ({ alturaMinima: 0.9, alturaMinimaEscaparate: 0, holguraTecho: 0.05, separacionMinima: 0.05, profundidadMueble: 0.8, ...(plan.criterios || {}) });

// Comprueba la distribución: dentro de la pared, sin solaparse, sin tapar puertas
// ni escaparates (salvo pantallas de escaparate), alturas y muebles delante. Las
// pantallas de un mismo mosaico pueden ir juntas; solo no pueden pisarse.
export function validate(plan, screens = plan.pantallas) {
  const issues = [];
  const walls = new Map(plan.paredes.map(w => [w.id, w]));
  const n = criteria(plan);
  const add = (nivel, screenId, codigo, texto) => issues.push({ nivel, pantalla: screenId, codigo, texto });
  const placed = [];
  for (const s of screens) {
    const wall = walls.get(s.pared);
    if (!wall) { add('error', s.id, 'sin-pared', `${label(s)} no está en ninguna pared del plano`); continue; }
    const f = footprint(s), len = wallLength(wall), alto = wall.alto || plan.planta.alto;
    if (f.x0 < -EPS || f.x1 > len + EPS) add('error', s.id, 'fuera-de-pared', `${label(s)} se sale de la pared ${wall.nombre || wall.id} (${metros(len)} m)`);
    if (f.z1 > alto - n.holguraTecho + EPS) add('error', s.id, 'techo', `${label(s)} llega a ${metros(f.z1)} m y el techo está a ${metros(alto)} m`);
    const minimo = s.escaparate ? n.alturaMinimaEscaparate : n.alturaMinima;
    if (f.z0 < minimo - EPS) add('aviso', s.id, 'baja', `${label(s)} empieza a ${metros(f.z0)} m del suelo (criterio: ${metros(minimo)} m)`);
    for (const h of plan.huecos || []) {
      if (h.pared !== s.pared) continue;
      const hr = { x0: h.desde, x1: h.desde + h.ancho, z0: h.base || 0, z1: (h.base || 0) + h.alto };
      if (!rectsOverlap(f, hr)) continue;
      if (h.tipo === 'escaparate' && s.escaparate) continue;
      add(h.tipo === 'puerta' ? 'error' : 'aviso', s.id, 'tapa-hueco', `${label(s)} tapa ${h.tipo === 'puerta' ? 'la puerta' : 'el ' + h.tipo} «${h.nombre || h.id}»`);
    }
    for (const m of plan.mobiliario || []) {
      const p = furnitureAgainstWall(m, wall);
      if (p.dist > n.profundidadMueble || p.dist < -0.05) continue;
      if (!overlap1(f.x0, f.x1, p.s0, p.s1) || !(m.alto > f.z0 + EPS)) continue;
      add('aviso', s.id, 'mueble-delante', `${m.nombre || m.id} (${metros(m.alto)} m de alto) queda delante de ${label(s)}`);
    }
    placed.push({ s, f });
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const A = placed[i], B = placed[j];
      if (A.s.pared !== B.s.pared) continue;
      const together = A.s.grupo && A.s.grupo === B.s.grupo;
      // Las del mismo mosaico van pegadas: se tolera el milímetro de redondeo.
      const sep = together ? -TOUCH : n.separacionMinima / 2;
      const grow = r => ({ x0: r.x0 - sep, x1: r.x1 + sep, z0: r.z0 - sep, z1: r.z1 + sep });
      if (rectsOverlap(grow(A.f), grow(B.f))) {
        add('error', A.s.id, 'solape', together ? `${label(A.s)} y ${label(B.s)} se pisan` : `${label(A.s)} y ${label(B.s)} se solapan o quedan a menos de ${metros(n.separacionMinima * 100, 0)} cm`);
      }
    }
  }
  return issues;
}

// ── Grupos (mosaicos) ────────────────────────────────────────────────────────
export const groupOf = (screens, grupo) => grupo ? screens.filter(s => s.grupo === grupo) : [];

// Composición de un mosaico de izquierda a derecha: «V–H–V–V–H–V».
export function composition(screens, grupo) {
  return groupOf(screens, grupo).slice().sort((a, b) => String(a.pared || '').localeCompare(String(b.pared || '')) || (a.s || 0) - (b.s || 0))
    .map(s => s.orientacion === 'vertical' ? 'V' : 'H').join('–');
}

// Lienzo de un mosaico en píxeles, como lo compone admira.studio: pantallas en fila
// sin junta, con las horizontales centradas en altura.
export function groupCanvas(screens, grupo) {
  const members = groupOf(screens, grupo);
  if (!members.length) return null;
  const sizes = members.map(s => screenGeometry(s).lienzo);
  return [sizes.reduce((a, [w]) => a + w, 0), Math.max(...sizes.map(([, h]) => h))];
}

// Mueve un grupo entero (o una pantalla suelta) manteniendo su forma y sin salirse
// de la pared. `pared` cambia de pared conservando el centro relativo del conjunto.
export function moveGroup(plan, screens, ids, { ds = 0, dz = 0, pared } = {}) {
  const set = new Set(ids);
  const members = screens.filter(s => set.has(s.id));
  if (!members.length) return screens;
  const fs = members.map(footprint);
  const x0 = Math.min(...fs.map(f => f.x0)), x1 = Math.max(...fs.map(f => f.x1));
  const z0 = Math.min(...fs.map(f => f.z0)), z1 = Math.max(...fs.map(f => f.z1));
  const from = plan.paredes.find(w => w.id === members[0].pared);
  const to = plan.paredes.find(w => w.id === (pared || members[0].pared)) || from;
  if (pared && from && to && to.id !== from.id) {
    // Mismo centro proporcional en la pared nueva.
    const center = (x0 + x1) / 2;
    ds += center / wallLength(from) * wallLength(to) - center;
  }
  const len = wallLength(to), alto = to.alto || plan.planta.alto;
  // Desplazamiento al centímetro, hacia dentro, sumado a todas por igual: el grupo no se descuadra.
  const lo = v => Math.ceil(v * 100) / 100, hi = v => Math.floor(v * 100) / 100;
  ds = Math.min(Math.max(round(ds), lo(-x0)), Math.max(lo(-x0), hi(len - x1)));
  dz = Math.min(Math.max(round(dz), lo(-z0)), Math.max(lo(-z0), hi(alto - z1)));
  return screens.map(s => set.has(s.id) ? { ...s, pared: to.id, s: round(s.s + ds, 3), z: round(s.z + dz, 3) } : s);
}

// ── Plantillas ───────────────────────────────────────────────────────────────
let seq = 0;
export function newId(existing, prefix = 'nueva') {
  const ids = new Set(existing.map(s => s.id));
  let id;
  do { id = `${prefix}-${++seq}`; } while (ids.has(id));
  return id;
}

function panel(id, orientacion, extra = {}) {
  return { id, itil: null, nombre: `Pantalla ${orientacion} (nueva)`, tipo: 'pantalla', estado: 'propuesta', orientacion, pulgadas: 55, resolucion: [1920, 1080], ...extra };
}

// H = vertical + horizontal centrada + vertical, pegadas. Coordenadas relativas:
// la base de las verticales en z = 0 y el borde izquierdo en s = 0.
export function hLayout(pulgadas = 55) {
  const v = panelSize({ pulgadas, orientacion: 'vertical' }), h = panelSize({ pulgadas });
  const lift = (v.h - h.h) / 2;
  return [
    { orientacion: 'vertical', s: v.w / 2, z: 0 },
    { orientacion: 'horizontal', s: v.w + h.w / 2, z: lift },
    { orientacion: 'vertical', s: v.w + h.w + v.w / 2, z: 0 }
  ];
}

// Elementos que añade cada botón del modo obras (uno o varios, ya agrupados).
export function template(kind, existing = []) {
  if (kind === 'vertical' || kind === 'horizontal') return [panel(newId(existing), kind)];
  const pairs = kind === 'mosaico-doble-h' ? 2 : 1;
  const grupo = newId(existing, kind === 'mosaico-doble-h' ? 'mosaico-doble-h' : 'mosaico-h');
  const h = hLayout(55), width = h[2].s + h[0].s;
  const out = [];
  for (let k = 0; k < pairs; k++) {
    h.forEach((p, i) => {
      out.push(panel(newId(existing.concat(out)), p.orientacion, {
        nombre: `${pairs > 1 ? 'Doble H' : 'H'} · ${k * 3 + i + 1} ${p.orientacion === 'vertical' ? 'V' : 'H'} (nueva)`,
        grupo, subgrupo: `H${k + 1}`, s: round(p.s + k * width, 3), z: round(p.z, 3)
      }));
    });
  }
  return out;
}

// Coloca elementos nuevos (relativos a s=0, z=0) en la primera posición libre,
// empezando por la pared preferida y a una altura cómoda.
export function placeNew(plan, screens, items, preferredWall) {
  const rel = items.map(s => ({ ...s, s: s.s || 0, z: s.z || 0 }));
  const fs = rel.map(footprint);
  const x0 = Math.min(...fs.map(f => f.x0)), x1 = Math.max(...fs.map(f => f.x1));
  const z0 = Math.min(...fs.map(f => f.z0)), z1 = Math.max(...fs.map(f => f.z1));
  const width = x1 - x0, height = z1 - z0;
  const base = Math.max(criteria(plan).alturaMinima, 1.5 - height / 2);
  // Un único desplazamiento al centímetro para todas: el mosaico conserva su forma.
  const dz = round(base - z0);
  const shifted = (pared, left) => { const ds = round(left - x0); return rel.map(s => ({ ...s, pared, s: round(s.s + ds, 3), z: round(s.z + dz, 3) })); };
  const order = plan.paredes.filter(w => w.id === preferredWall).concat([...plan.paredes].sort((a, b) => wallLength(b) - wallLength(a)));
  for (const wall of order) {
    const len = wallLength(wall);
    for (let left = 0.1; left + width <= len - 0.1 + EPS; left += 0.05) {
      const candidate = shifted(wall.id, left);
      const ids = new Set(candidate.map(c => c.id));
      const issues = validate(plan, screens.concat(candidate)).filter(i => i.nivel === 'error' && (ids.has(i.pantalla) || i.codigo === 'solape'));
      if (!issues.length) return candidate;
    }
  }
  const wall = order[0] || plan.paredes[0];
  return shifted(wall.id, Math.max(0, (wallLength(wall) - width) / 2));
}

// Cambia orientación o diagonal conservando el centro: girar la horizontal de una H
// la deja alineada con sus verticales en vez de colgada de su base antigua.
export function reshape(screen, patch) {
  const before = screenGeometry(screen), next = { ...screen, ...patch }, after = screenGeometry(next);
  return { ...next, z: round(screen.z + (before.h - after.h) / 2, 3) };
}

export function clampToWall(plan, screen) {
  const wall = plan.paredes.find(w => w.id === screen.pared);
  if (!wall) return screen;
  const g = screenGeometry(screen), len = wallLength(wall), alto = wall.alto || plan.planta.alto;
  // Redondeo hacia dentro: al centímetro sin que el borde asome fuera de la pared.
  const sMin = Math.ceil(g.w / 2 * 100) / 100, sMax = Math.max(sMin, Math.floor((len - g.w / 2) * 100) / 100);
  const zMax = Math.max(0, Math.floor((alto - g.h) * 100) / 100);
  return { ...screen, s: round(Math.min(Math.max(screen.s, sMin), sMax)), z: round(Math.min(Math.max(screen.z, 0), zMax)) };
}

// ── Orden de obra ────────────────────────────────────────────────────────────
function describe(s) {
  const g = screenGeometry(s);
  return `pantalla ${s.orientacion} de ${s.pulgadas}″ (${metros(g.w)}×${metros(g.h)} m, ${g.lienzo.join('×')})`;
}
const wallLabel = (plan, id) => { const w = plan.paredes.find(x => x.id === id); return w ? (w.nombre || w.id) : id; };
const where = (plan, s) => `pared ${wallLabel(plan, s.pared)}, centro a ${metros(s.s)} m y base a ${metros(s.z)} m`;
const ciRef = s => s.itil || (s.screenId ? `pantalla ${s.screenId}, código ITIL por cruzar en Yokup` : s.id);

function screenChange(old, s) {
  return {
    moved: old.pared !== s.pared || Math.abs(old.s - s.s) > MOVE_EPS || Math.abs(old.z - s.z) > MOVE_EPS,
    rotated: old.orientacion !== s.orientacion,
    resized: old.pulgadas !== s.pulgadas,
    regrouped: (old.grupo || null) !== (s.grupo || null)
  };
}

// Compara la distribución actual con la propuesta y devuelve las acciones de
// obra, de inventario ITIL y de contenidos. Un mosaico que se mueve, se retira o
// se añade entero sale como una sola acción. No pone precios ni plazos.
export function workOrder(plan, proposal) {
  const base = new Map(plan.pantallas.map(s => [s.id, s]));
  const next = new Map(proposal.map(s => [s.id, s]));
  const acciones = [];
  const done = new Set();
  const moveHandled = new Set(); // traslado ya contado en la acción del mosaico
  const push = a => acciones.push({ itil: null, ...a });
  const groupName = (screens, g) => (screens.find(s => s.grupo === g && s.grupoNombre) || {}).grupoNombre || `mosaico ${g}`;

  // Mosaicos enteros: retirados, añadidos o trasladados sin cambiar de forma.
  const groups = new Set([...plan.pantallas, ...proposal].map(s => s.grupo).filter(Boolean));
  for (const g of groups) {
    const before = groupOf(plan.pantallas, g), after = groupOf(proposal, g);
    const name = groupName(before.length ? plan.pantallas : proposal, g);
    const list = ss => ss.map(ciRef).join(' · ');
    if (before.length && !after.length && before.every(s => !next.has(s.id))) {
      push({ tipo: 'baja', pantalla: g, grupo: g, nombre: name, cis: before.map(ciRef),
        obra: [`Desmontar y retirar el ${name} (${before.length} pantallas, ${composition(plan.pantallas, g)}) de la pared ${wallLabel(plan, before[0].pared)}`, 'Retirar sus players y anular las tomas eléctricas y de datos, y reparar el paramento'],
        inventario: `Baja de ${before.length} CI en el inventario ITIL (Yokup): ${list(before)}`,
        contenidos: plan.contenidos ? `La instalación ${plan.contenidos.instalacion} de admira.studio deja de emitirse aquí` : undefined });
      before.forEach(s => done.add(s.id));
      continue;
    }
    if (!before.length && after.length) {
      push({ tipo: 'alta', pantalla: g, grupo: g, nombre: name,
        obra: [`Instalar un ${name} de ${after.length} pantallas (${composition(proposal, g)}) en la pared ${wallLabel(plan, after[0].pared)}, desde ${metros(Math.min(...after.map(s => footprint(s).x0)))} m`, 'Tomas eléctricas y de datos detrás del mosaico y estructura de soporte común', 'Player o procesador de vídeo para el conjunto'],
        inventario: `Alta de ${after.length} CI nuevos en el inventario ITIL (Yokup) · códigos pendientes de asignar`,
        contenidos: `Nueva instalación para admira.studio: ${composition(proposal, g)}, lienzo ${groupCanvas(proposal, g).join('×')}` });
      after.forEach(s => done.add(s.id));
      continue;
    }
    if (before.length && before.length === after.length && before.every(s => next.has(s.id))) {
      const changes = before.map(s => screenChange(s, next.get(s.id)));
      const pairs = before.map(s => [s, next.get(s.id)]);
      const [o0, n0] = pairs[0];
      const ds = n0.s - o0.s, dz = n0.z - o0.z;
      // Traslado del conjunto: todas se mueven igual (girar o cambiar alguna va aparte).
      const rigid = changes.some(c => c.moved) && changes.every(c => !c.regrouped) &&
        pairs.every(([o, n]) => n.pared === n0.pared && Math.abs((n.s - o.s) - ds) < MOVE_EPS && Math.abs((n.z - o.z) - dz) < MOVE_EPS);
      if (rigid) {
        push({ tipo: 'modificacion', pantalla: g, grupo: g, nombre: name, cis: before.map(ciRef),
          obra: [o0.pared === n0.pared
            ? `Trasladar el ${name} entero ${metros(Math.abs(ds))} m a la ${ds >= 0 ? 'derecha' : 'izquierda'}${Math.abs(dz) > MOVE_EPS ? ` y ${metros(Math.abs(dz))} m ${dz > 0 ? 'más arriba' : 'más abajo'}` : ''} en la pared ${wallLabel(plan, n0.pared)}`
            : `Trasladar el ${name} entero de la pared ${wallLabel(plan, o0.pared)} a la pared ${wallLabel(plan, n0.pared)}`,
          'Mover la estructura de soporte, las tomas y los players con el mosaico'],
          inventario: `Modificación de ubicación de ${before.length} CI: ${list(before)}` });
        before.forEach((s, i) => (changes[i].rotated || changes[i].resized ? moveHandled : done).add(s.id));
      }
    }
  }

  for (const [id, s] of base) {
    if (done.has(id) || next.has(id)) continue;
    push({ tipo: 'baja', pantalla: id, itil: s.itil || null, nombre: label(s),
      obra: [`Desmontar y retirar la ${describe(s)} de la ${where(plan, s)}`, 'Anular su toma eléctrica y de datos, y reparar el paramento'],
      inventario: `Baja del CI ${ciRef(s)} en el inventario ITIL (Yokup)` });
  }
  for (const [id, s] of next) {
    if (done.has(id)) continue;
    const old = base.get(id);
    if (!old) {
      push({ tipo: 'alta', pantalla: id, nombre: label(s),
        obra: [`Instalar ${describe(s)} en la ${where(plan, s)}`, 'Nueva toma eléctrica y de datos detrás de la pantalla', 'Soporte de pared adecuado al peso y al formato'],
        inventario: 'Alta de un CI nuevo en el inventario ITIL (Yokup) · código pendiente de asignar',
        contenidos: `Nuevo formato para adaptar en admira.studio: ${screenGeometry(s).lienzo.join('×')}` });
      continue;
    }
    const c = screenChange(old, s);
    if (moveHandled.has(id)) c.moved = false;
    if (!c.moved && !c.rotated && !c.resized && !c.regrouped) continue;
    const obra = [], cambios = [];
    if (c.moved) {
      obra.push(`Trasladar de la ${where(plan, old)} a la ${where(plan, s)}`);
      if (old.pared !== s.pared || Math.abs(old.s - s.s) > 0.3) obra.push('Llevar la toma eléctrica y de datos a la nueva posición y anular la anterior');
      cambios.push('ubicación');
    }
    if (c.rotated) { obra.push(`Girar a ${s.orientacion}: soporte nuevo y reconfigurar el player`); cambios.push('orientación'); }
    if (c.resized) { obra.push(`Sustituir la pantalla de ${old.pulgadas}″ por una de ${s.pulgadas}″`); cambios.push('tamaño'); }
    if (c.regrouped) { obra.push(s.grupo ? `Integrar en el mosaico ${s.grupo}` : `Separar del mosaico ${old.grupo}`); cambios.push('grupo'); }
    const oldCanvas = screenGeometry(old).lienzo.join('×'), newCanvas = screenGeometry(s).lienzo.join('×');
    push({ tipo: c.resized && !c.moved && !c.rotated && !c.regrouped ? 'sustitucion' : 'modificacion', pantalla: id, itil: s.itil || null, nombre: label(s),
      obra, inventario: `Modificación del CI ${ciRef(s)}: ${cambios.join(', ')}`,
      contenidos: oldCanvas !== newCanvas ? `El formato pasa de ${oldCanvas} a ${newCanvas}` : undefined });
  }

  // Si cambia la forma de un mosaico, su instalación de admira.studio se rehace.
  for (const g of groups) {
    const before = groupOf(plan.pantallas, g), after = groupOf(proposal, g);
    if (!before.length || !after.length) continue;
    const c0 = composition(plan.pantallas, g), c1 = composition(proposal, g);
    const reshaped = c0 !== c1 || acciones.some(a => a.pantalla !== g && before.some(s => s.id === a.pantalla) && a.tipo !== 'sustitucion');
    // Un mosaico que entra o sale entero ya lleva su línea de contenidos.
    if (!reshaped || acciones.some(a => a.pantalla === g && a.tipo !== 'modificacion')) continue;
    const inst = plan.contenidos && plan.contenidos.grupo === g ? plan.contenidos.instalacion : `del ${groupName(plan.pantallas, g)}`;
    push({ tipo: 'contenidos', pantalla: g, grupo: g, nombre: groupName(plan.pantallas, g), obra: [],
      inventario: 'Sin cambio de CI por esta línea',
      contenidos: `Rehacer la instalación ${inst} en admira.studio: ${c0} (${groupCanvas(plan.pantallas, g).join('×')}) pasa a ${c1 || 'nada'}${c1 ? ` (${groupCanvas(proposal, g).join('×')})` : ''} y revisar la separación real entre pantallas` });
  }
  for (const a of acciones) if (a.contenidos === undefined) delete a.contenidos;
  const resumen = acciones.reduce((r, a) => (r[a.tipo] = (r[a.tipo] || 0) + 1, r), {});
  return { acciones, resumen };
}

// Orden de obra exportable: la propuesta completa, las acciones y la validación.
export function exportOrder(plan, proposal, meta = {}) {
  const { acciones, resumen } = workOrder(plan, proposal);
  return {
    schema: ORDER_SCHEMA,
    xpacio: plan.id, nombre: plan.nombre, version_plano: plan.version || null,
    titulo: meta.titulo || 'Propuesta de obra', creada: meta.creada || new Date().toISOString(),
    estado: 'borrador', resumen, acciones,
    validacion: validate(plan, proposal),
    propuesta: clone(proposal)
  };
}

// Una propuesta guardada solo vale para el plano del que salió.
export function restoreProposal(saved, plan) {
  if (!saved || saved.schema !== ORDER_SCHEMA || saved.xpacio !== plan.id || !Array.isArray(saved.propuesta)) return null;
  if ((saved.version_plano || null) !== (plan.version || null)) return null;
  const walls = new Set(plan.paredes.map(w => w.id));
  const ok = saved.propuesta.every(s => s && typeof s.id === 'string' && walls.has(s.pared) && Number.isFinite(s.s) && Number.isFinite(s.z) &&
    Number.isFinite(s.pulgadas) && (s.orientacion === 'vertical' || s.orientacion === 'horizontal'));
  return ok ? { titulo: saved.titulo || 'Propuesta de obra', propuesta: clone(saved.propuesta) } : null;
}
