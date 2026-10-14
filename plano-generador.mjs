// Creación de Xpacios (▤ Modo avanzado de plano.html · DCL-35708977d7b8520386dad95f). Sin DOM:
// lo usan plano.mjs y los tests. Si no tenemos el plano de un Xpacio, nos lo inventamos: una
// sala rectangular (salaRectangular de plano-subida.mjs) con su puerta en la fachada, el
// escaparate en los locales de calle, el mobiliario típico del tipo y sus pantallas típicas en
// estado «propuesta» y sin código ITIL, colocadas sin solapes ni tapar huecos (validate() de
// plano-core sin errores ni avisos). Con «creación total» las medidas se sortean según la media
// del tipo; la semilla queda en el JSON para regenerar el mismo plano.
//
// Convenio de la sala (como Starbucks 103): ancho = fachada (x), largo = fondo (y), alto. La
// pared F es el fondo (y = 0), D el lateral derecho (x = ancho), P la fachada (y = largo) e I el
// lateral izquierdo (x = 0), en el sentido de las agujas del reloj.
import { validate, round, footprint, panelSize, wallLength } from './plano-core.mjs?v=20261014-plano-1';
import { salaRectangular, comprobarSala, ID_RE } from './plano-subida.mjs?v=20261014-subir-1';

// Tipos de Xpacio. ESTIMACIÓN DE LA CASA, no una estadística oficial: superficies de sala de
// venta habituales en locales de calle de ciudad en España (portales inmobiliarios, guías de
// apertura de franquicias y los Xpacios que ya conocemos), redondeadas. m2 = [mín, media, máx];
// alto = [mín, típico, máx] en metros; proporcion = largo / ancho (fondo / fachada) [mín, máx].
export const TIPOS = Object.freeze({
  cafeteria: { es: 'Cafetería', en: 'Coffee shop', m2: [70, 100, 140], alto: [2.8, 3.0, 3.4], proporcion: [1.2, 2.0], calle: true, puerta: 1.0, receta: 'barra' },
  estanco: { es: 'Estanco', en: 'Tobacconist', m2: [25, 45, 70], alto: [2.7, 2.9, 3.2], proporcion: [1.2, 2.2], calle: true, puerta: 0.9, receta: 'estanco' },
  kiosco: { es: 'Kiosco', en: 'Kiosk', m2: [4, 8, 12], alto: [2.4, 2.6, 2.8], proporcion: [0.7, 1.3], calle: true, puerta: 0.7, receta: 'kiosco' },
  farmacia: { es: 'Farmacia', en: 'Pharmacy', m2: [80, 120, 180], alto: [2.8, 3.0, 3.4], proporcion: [1.0, 1.8], calle: true, puerta: 1.2, receta: 'farmacia' },
  moda: { es: 'Tienda de moda', en: 'Fashion store', m2: [80, 150, 250], alto: [3.0, 3.2, 3.5], proporcion: [1.4, 2.6], calle: true, puerta: 1.4, receta: 'moda' },
  restaurante: { es: 'Restaurante', en: 'Restaurant', m2: [100, 160, 250], alto: [2.8, 3.0, 3.5], proporcion: [1.2, 2.2], calle: true, puerta: 1.2, receta: 'barra' },
  supermercado: { es: 'Supermercado de proximidad', en: 'Convenience supermarket', m2: [250, 400, 600], alto: [3.0, 3.3, 3.5], proporcion: [1.0, 2.0], calle: true, puerta: 1.8, receta: 'super' },
  panaderia: { es: 'Panadería', en: 'Bakery', m2: [35, 60, 90], alto: [2.7, 2.9, 3.2], proporcion: [1.0, 2.0], calle: true, puerta: 1.0, receta: 'barra' },
  banco: { es: 'Oficina bancaria', en: 'Bank branch', m2: [90, 150, 250], alto: [2.7, 3.0, 3.3], proporcion: [1.0, 2.0], calle: true, puerta: 1.2, receta: 'banco' },
  oficina: { es: 'Oficina', en: 'Office', m2: [40, 90, 200], alto: [2.6, 2.7, 3.0], proporcion: [1.0, 1.8], calle: false, puerta: 0.9, receta: 'oficina' },
  laboratorio: { es: 'Laboratorio / showroom', en: 'Lab / showroom', m2: [15, 40, 80], alto: [2.7, 3.0, 3.3], proporcion: [0.8, 1.6], calle: false, puerta: 0.9, receta: 'laboratorio' }
});
export const TITULO = 'Plano generado · inventado, no es un levantamiento';
export const TITULO_ESTIMADO = 'Plano estimado · medidas y elementos aproximados, no es un levantamiento';
const PAREDES = ['F', 'D', 'P', 'I'];
const EPS = 1e-6;

// ── Azar reproducible ────────────────────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const nuevaSemilla = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
const semillaValida = s => Number.isInteger(s) && s > 0 && s <= 0xffffffff;
// Triangular entre mín y máx con moda en la media: lo normal es lo frecuente.
const triangular = (rnd, [a, c, b]) => { const u = rnd(), f = (c - a) / (b - a); return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); };
const r05 = v => Math.round(v * 20) / 20;
const metros = n => String(round(n, 2)).replace('.', ',');

// Medidas medias de un tipo (para precargar el formulario): superficie media, proporción media.
export function medidasMedias(tipo) {
  const t = TIPOS[tipo]; if (!t) throw new TypeError('tipo de Xpacio desconocido: ' + tipo);
  const ratio = (t.proporcion[0] + t.proporcion[1]) / 2, ancho = r05(Math.sqrt(t.m2[1] / ratio));
  return { ancho, largo: r05(t.m2[1] / ancho), alto: t.alto[1] };
}

// Medidas sorteadas según la media del tipo, dentro de su rango de superficie y de alto.
export function sortearMedidas(tipo, rnd) {
  const t = TIPOS[tipo];
  const area = triangular(rnd, t.m2), ratio = t.proporcion[0] + rnd() * (t.proporcion[1] - t.proporcion[0]);
  const ancho = Math.max(1, r05(Math.sqrt(area / ratio)));
  let largo = Math.max(1, r05(area / ancho));
  while (ancho * largo < t.m2[0] - EPS) largo = round(largo + 0.05);
  while (ancho * largo > t.m2[2] + EPS) largo = round(largo - 0.05);
  return { ancho, largo, alto: r05(triangular(rnd, t.alto)) };
}

// ── Geometría auxiliar ───────────────────────────────────────────────────────
const solapa = (a, b, g = 0) => a.x < b.x + b.w + g - EPS && b.x < a.x + a.w + g - EPS && a.y < b.y + b.d + g - EPS && b.y < a.y + a.d + g - EPS;

// ── Elementos ya situados (vía «con foto o vídeo», plano-foto.mjs) ───────────
// La estimación a partir de fotos o vídeo del local (tamaños conocidos y ángulos de la óptica,
// como el levantamiento del laboratorio con la webcam; Gemini Pro en /xpacio/estimar) da medidas y elementos ya situados:
// { huecos?, mobiliario?, pantallas? } con el convenio de la sala (paredes F, D, P e I; muebles en
// x, y, w, d; pantallas con pared, s y z). Se respetan tal cual y lo que traen no se inventa: si
// trae pantallas, no se añaden las típicas; si trae muebles, no se añaden muebles; si trae huecos,
// no se inventan, salvo la puerta si no hay ninguna. Lo que esté mal formado se descarta.
const num = v => typeof v === 'number' && Number.isFinite(v);
export function normalizarElementos(elementos, { W, F }) {
  if (!elementos || typeof elementos !== 'object') return null;
  const lista = k => Array.isArray(elementos[k]) ? elementos[k].filter(e => e && typeof e === 'object') : null;
  const huecos = lista('huecos'), mobiliario = lista('mobiliario'), pantallas = lista('pantallas');
  return {
    huecos: huecos && huecos.filter(h => PAREDES.includes(h.pared) && ['desde', 'ancho', 'alto'].every(k => num(h[k])))
      .map((h, i) => ({ id: h.id || `hueco-${i + 1}`, tipo: h.tipo || 'puerta', nombre: h.nombre || ({ puerta: 'Puerta', escaparate: 'Escaparate', ventana: 'Ventana' })[h.tipo || 'puerta'] || 'Hueco', pared: h.pared, desde: round(h.desde), ancho: round(h.ancho), base: num(h.base) ? round(h.base) : 0, alto: round(h.alto) })),
    mobiliario: mobiliario && mobiliario.filter(m => ['x', 'y', 'w', 'd', 'alto'].every(k => num(m[k])) && m.w > 0 && m.d > 0 && m.x >= -EPS && m.y >= -EPS && m.x + m.w <= W + EPS && m.y + m.d <= F + EPS)
      .map((m, i) => ({ id: m.id || `e-${i + 1}`, nombre: m.nombre || 'Mueble', x: round(m.x), y: round(m.y), w: round(m.w), d: round(m.d), alto: round(m.alto) })),
    pantallas: pantallas && pantallas.filter(p => PAREDES.includes(p.pared) && num(p.s) && num(p.z) && (p.orientacion === 'vertical' || p.orientacion === 'horizontal') && num(p.pulgadas) && p.pulgadas > 0)
      .map((p, i) => ({ itil: null, tipo: 'pantalla', estado: 'estimada', resolucion: [1920, 1080], fuente: 'Elemento estimado', ...p, id: p.id || `est-${i + 1}` }))
  };
}

// ── Generador ────────────────────────────────────────────────────────────────
// generarXpacio({ tipo, ancho?, largo?, alto?, semilla?, total?, id?, nombre?, direccion?, elementos? })
// → plano admira.xpacio-plano/1. Sin `total`, las medidas que falten salen de la media del tipo.
// `elementos` (huecos, muebles y pantallas ya situados) es la entrada de la vía «con foto o vídeo».
export function generarXpacio({ tipo = 'cafeteria', ancho, largo, alto, semilla, total = false, id = 'xpacio-generado', nombre, direccion, elementos } = {}) {
  const t = TIPOS[tipo]; if (!t) throw new TypeError('tipo de Xpacio desconocido: ' + tipo);
  if (!ID_RE.test(id)) throw new TypeError('id de Xpacio no válido');
  const seed = semillaValida(semilla) ? semilla : nuevaSemilla();
  const rnd = mulberry32(seed);
  const media = medidasMedias(tipo);
  const m = total ? sortearMedidas(tipo, rnd) : {
    ancho: Number.isFinite(ancho) ? round(ancho) : media.ancho,
    largo: Number.isFinite(largo) ? round(largo) : media.largo,
    alto: Number.isFinite(alto) ? round(alto) : media.alto
  };
  const errs = comprobarSala({ ancho: m.ancho, fondo: m.largo, alto: m.alto });
  if (errs.length) throw new RangeError('generarXpacio: ' + errs.map(e => e.texto).join(' '));
  const W = m.ancho, F = m.largo, H = m.alto, area = round(W * F, 1);
  const plan = salaRectangular({ id, nombre: nombre || `${t.es} · ${id}`, ancho: W, fondo: F, alto: H, version: `generado-${tipo}-${seed}` });
  if (direccion) plan.direccion = String(direccion).slice(0, 160);
  plan.paredes.find(w => w.id === 'P').nombre = t.calle ? 'Fachada · calle' : 'Frente · acceso';
  plan.fuente = {
    titulo: `${TITULO} · ${t.es} · ${String(area).replace('.', ',')} m² · semilla ${seed}`,
    medidas: `${t.es} de ${metros(W)} × ${metros(F)} m (${String(area).replace('.', ',')} m²) y ${metros(H)} m de alto, ${total ? `sorteada según la media del tipo (${t.m2[1]} m², de ${t.m2[0]} a ${t.m2[2]})` : 'con las medidas indicadas'}`,
    pantallas: 'Pantallas típicas del tipo, en estado «propuesta» y sin código ITIL',
    itil: 'Sin inventario: el maestro del ITIL es Yokup'
  };
  plan.generador = { tipo, semilla: seed, total: !!total, medidas: { ancho: W, largo: F, alto: H }, version: 1 };

  const ctx = crearContexto(plan, t, rnd, tipo);
  const dados = normalizarElementos(elementos, { W, F });
  if (dados) {
    plan.fuente.titulo = `${TITULO_ESTIMADO} · ${t.es} · ${String(area).replace('.', ',')} m² · semilla ${seed}`;
    plan.fuente.pantallas = dados.pantallas ? 'Pantallas estimadas, sin código ITIL hasta darlas de alta en Yokup' : plan.fuente.pantallas;
    plan.generador.elementos = { huecos: dados.huecos ? dados.huecos.length : null, mobiliario: dados.mobiliario ? dados.mobiliario.length : null, pantallas: dados.pantallas ? dados.pantallas.length : null };
    ctx.ponerElementos(dados);
  }
  if (!dados || !dados.huecos) ctx.huecos();
  else if (!plan.huecos.some(h => h.tipo === 'puerta')) ctx.huecos({ soloPuerta: true });
  RECETAS[t.receta](ctx);
  plan.pantallas = ctx.pantallas;
  return plan;
}

// Contexto de una receta: la sala, el azar, los huecos, los muebles y las pantallas ya puestos.
function crearContexto(plan, t, rnd, tipo) {
  const W = plan.planta.ancho, F = plan.planta.fondo, H = plan.planta.alto;
  const ctx = {
    // muebles es plan.mobiliario: validate() ve cada mueble en cuanto se pone.
    plan, t, tipo, rnd, W, F, H, muebles: plan.mobiliario, zonas: [], pantallas: [], n: 0, escaparate: null, puerta: null,
    inventarMuebles: true, inventarPantallas: true,
    // Elementos ya situados: se ponen tal cual y bloquean lo que tapan (puertas incluidas).
    ponerElementos({ huecos, mobiliario, pantallas }) {
      if (huecos) {
        plan.huecos.push(...huecos);
        for (const h of huecos.filter(h => h.tipo === 'puerta')) ctx.zonas.push(zonaPuerta(h, W, F));
        const p = huecos.find(h => h.tipo === 'puerta' && h.pared === 'P');
        ctx.puerta = p ? { x0: round(W - p.desde - p.ancho), x1: round(W - p.desde) } : { x0: W / 2, x1: W / 2 };
        const e = huecos.find(h => h.tipo === 'escaparate');
        if (e) ctx.escaparate = { pared: e.pared, s0: e.desde, s1: round(e.desde + e.ancho), base: e.base, top: round(e.base + e.alto) };
      }
      if (mobiliario) { ctx.muebles.push(...mobiliario); ctx.inventarMuebles = false; }
      if (pantallas) { ctx.pantallas.push(...pantallas); ctx.inventarPantallas = false; }
    },
    entre: (a, b) => a + rnd() * (b - a),
    elegir: arr => arr[Math.floor(rnd() * arr.length)],
    // Puerta en la fachada a un lado (sorteado) y, en los locales de calle, escaparate en el resto.
    // El escaparate se guarda en coordenadas de su pared: { pared, s0, s1, base, top }.
    huecos({ soloPuerta = false } = {}) {
      const kiosco = tipo === 'kiosco', margen = kiosco ? 0.15 : 0.3;
      const dw = Math.min(t.puerta, Math.max(0.6, W - 2 * margen));
      const izquierda = kiosco || rnd() < 0.5; // el kiosco, a la izquierda: la ventanilla, en el resto
      const x0 = izquierda ? Math.min(margen, (W - dw) / 2) : Math.max(W - margen - dw, (W - dw) / 2);
      const p = { x0: round(x0), x1: round(x0 + dw) };
      ctx.puerta = p;
      plan.huecos.push({ id: 'acceso', tipo: 'puerta', nombre: 'Acceso', pared: 'P', desde: round(W - p.x1), ancho: round(dw), base: 0, alto: round(Math.min(2.3, H - 0.2)) });
      // Delante de la puerta no va nada.
      ctx.zonas.push({ x: p.x0 - 0.3, y: F - 1.3, w: dw + 0.6, d: 1.3 });
      if (!t.calle || soloPuerta) return;
      const e = izquierda ? { x0: p.x1 + margen, x1: W - margen } : { x0: margen, x1: p.x0 - margen };
      const base = kiosco ? 1.0 : 0.3, top = round(Math.min(kiosco ? 2.1 : 2.6, H - 0.3));
      if (e.x1 - e.x0 >= 0.8) ctx.escaparate = { pared: 'P', s0: round(W - e.x1), s1: round(W - e.x0), base, top };
      else if (kiosco && F - 2 * margen >= 0.8) ctx.escaparate = { pared: 'D', s0: margen, s1: round(F - margen), base, top }; // kiosco estrecho: ventanilla en el lateral
      else return;
      const v = ctx.escaparate;
      plan.huecos.push({ id: 'escaparate', tipo: 'escaparate', nombre: kiosco ? 'Ventanilla' : 'Escaparate', pared: v.pared, desde: v.s0, ancho: round(v.s1 - v.s0), base, alto: round(top - base) });
      // Zona de entrada junto a la fachada: libre (el kiosco pone su mostrador bajo la ventanilla).
      if (!kiosco) ctx.zonas.push({ x: 0, y: F - 0.9, w: W, d: 0.9 });
    },
    // Mueble si cabe: dentro de la sala, sin pisar otro (con `holgura`) ni una zona libre.
    mueble(nombre, x, y, w, d, alto, { holgura = 0.05, zonas = true } = {}) {
      if (!ctx.inventarMuebles) return null;
      const r = { x: round(x), y: round(y), w: round(w), d: round(d) };
      if (r.w < 0.2 || r.d < 0.2 || r.x < -EPS || r.y < -EPS || r.x + r.w > W + EPS || r.y + r.d > F + EPS) return null;
      if (zonas && ctx.zonas.some(z => solapa(r, z))) return null;
      if (ctx.muebles.some(o => solapa(r, o, holgura))) return null;
      const m = { id: `m-${++ctx.n}`, nombre, ...r, alto: round(alto) };
      // Con pantallas ya situadas (elementos estimados), un mueble no puede quedar delante de ellas.
      const antes = ctx.pantallas.length ? validate(plan, ctx.pantallas).length : 0;
      ctx.muebles.push(m);
      if (ctx.pantallas.length && validate(plan, ctx.pantallas).length > antes) { ctx.muebles.pop(); return null; }
      return m;
    },
    // Rejilla de muebles iguales (mesas, burros, puestos) en un rectángulo, con pasillos.
    rejilla(nombre, area, w, d, alto, { paso = 1.0, prob = 1, max = Infinity } = {}) {
      let n = 0;
      for (let y = area.y; y + d <= area.y + area.d + EPS && n < max; y += d + paso) {
        for (let x = area.x; x + w <= area.x + area.w + EPS && n < max; x += w + paso) {
          if (rnd() > prob) continue;
          if (ctx.mueble(nombre, x, y, w, d, alto)) n++;
        }
      }
      return n;
    },
    // Pantalla (o grupo de pantallas pegadas) en su pared: prueba la posición pedida y, si choca
    // con algo (validate: solape, hueco, techo, mueble delante, altura), la desliza por la pared
    // dentro de `rango` y, si hace falta, la baja hasta `zMin`. Si no cabe, no se pone.
    pantalla(miembros, { rango, zMin } = {}) {
      if (!ctx.inventarPantallas) return null;
      const list = (Array.isArray(miembros) ? miembros : [miembros]).map(p => ({
        id: `pan-${ctx.pantallas.length + 1}`, itil: null, tipo: 'pantalla', estado: 'propuesta', resolucion: [1920, 1080],
        fuente: 'Plano generado · pantalla típica del tipo, por confirmar', ...p
      }));
      list.forEach((p, i) => { p.id = `pan-${ctx.pantallas.length + i + 1}`; });
      const wall = plan.paredes.find(w => w.id === list[0].pared), len = wallLength(wall);
      const fs = list.map(footprint), x0 = Math.min(...fs.map(f => f.x0)), x1 = Math.max(...fs.map(f => f.x1));
      const [lo, hi] = rango || [0.05, len - 0.05];
      const z0 = Math.min(...list.map(p => p.z)), zTop = Math.max(...fs.map(f => f.z1));
      const zs = [0];
      for (let dz = 0.1; z0 - dz >= (zMin ?? z0) - EPS; dz = round(dz + 0.1)) zs.push(-dz);
      // Si se pasa del techo, primero se baja lo justo.
      const over = zTop - (H - criteriaHolgura);
      if (over > 0) zs.unshift(-round(Math.ceil(over * 100) / 100 + 0.01));
      const ids = new Set(list.map(p => p.id));
      const steps = [0];
      for (let k = 1; k <= Math.ceil(len / 0.1); k++) steps.push(round(k * 0.1), round(-k * 0.1));
      for (const dz of zs) {
        if (z0 + dz < 0) continue;
        for (const ds of steps) {
          if (x0 + ds < lo - EPS || x1 + ds > hi + EPS) continue;
          const cand = list.map(p => ({ ...p, s: round(p.s + ds, 3), z: round(p.z + dz, 3) }));
          const issues = validate(plan, ctx.pantallas.concat(cand)).filter(i => ids.has(i.pantalla) || i.codigo === 'solape');
          if (!issues.length) { ctx.pantallas.push(...cand); return cand; }
        }
      }
      return null;
    },
    // Pantalla de escaparate: mira a la calle, dentro del escaparate de la fachada.
    escaparatePantalla(pulgadas = 55) {
      const e = ctx.escaparate; if (!e) return null;
      const v = panelSize({ pulgadas, orientacion: 'vertical' }), kiosco = tipo === 'kiosco';
      return ctx.pantalla({ nombre: kiosco ? 'Ventanilla · vertical' : 'Escaparate · vertical', corto: kiosco ? 'VENT' : 'ESC', orientacion: 'vertical', pulgadas, escaparate: true,
        pared: e.pared, s: round((e.s0 + e.s1) / 2, 3), z: round(Math.min(e.base + (kiosco ? 0.05 : 0.25), e.top - v.h)) }, { rango: [e.s0, e.s1], zMin: e.base });
    }
  };
  return ctx;
}
const criteriaHolgura = 0.05;

// Zona libre delante de una puerta de cualquier pared de la sala rectangular.
function zonaPuerta(h, W, F) {
  const a = h.desde - 0.3, b = h.desde + h.ancho + 0.3;
  return ({
    F: { x: a, y: 0, w: b - a, d: 1.3 },
    D: { x: W - 1.3, y: a, w: 1.3, d: b - a },
    P: { x: W - b, y: F - 1.3, w: b - a, d: 1.3 },
    I: { x: 0, y: F - b, w: 1.3, d: b - a }
  })[h.pared];
}

// Grupo de pantallas pegadas en fila (menu boards): centradas en `centro` de la pared.
function fila(n, { pulgadas, orientacion = 'horizontal', pared, centro, z, grupo, grupoNombre, nombre, corto }) {
  const w = panelSize({ pulgadas, orientacion }).w, x0 = centro - n * w / 2;
  return Array.from({ length: n }, (_, i) => ({ nombre: `${nombre} ${i + 1}`, corto: `${corto}${i + 1}`, orientacion, pulgadas, pared, s: round(x0 + w / 2 + i * w, 3), z, grupo, grupoNombre }));
}
// s de un punto (x, y) en cada pared de la sala rectangular.
const sEn = (ctx, pared, x, y) => ({ F: x, D: y, P: ctx.W - x, I: ctx.F - y })[pared];

// ── Recetas por tipo ─────────────────────────────────────────────────────────
const RECETAS = {
  // Cafetería, restaurante y panadería: contrabarra al fondo, barra delante, mesas en la sala,
  // menu boards sobre la contrabarra, una vertical junto a la caja y la del escaparate.
  barra(ctx) {
    const { W, F, rnd } = ctx, restaurante = ctx.tipo === 'restaurante', panaderia = ctx.tipo === 'panaderia';
    const L = Math.max(1.6, Math.min(W * ctx.entre(0.45, 0.7), 8, W - 1.2));
    const izquierda = rnd() < 0.5, bx = W < 4 ? (W - L) / 2 : izquierda ? 0.6 : W - 0.6 - L;
    ctx.mueble(panaderia ? 'Obrador · hornos' : restaurante ? 'Cocina vista · pase' : 'Contrabarra · cafetera', bx, 0, L, 0.6, 0.9);
    const barra = ctx.mueble(panaderia ? 'Mostrador vitrina' : 'Barra · caja', bx, 1.5, L, 0.6, 1.1);
    const y0 = barra ? barra.y + barra.d + 1.2 : 1.2;
    const mesa = restaurante ? [0.8, 0.8] : panaderia ? [0.6, 0.6] : [0.7, 0.7];
    ctx.rejilla(restaurante ? 'Mesa' : 'Mesa', { x: 0.5, y: y0, w: W - 1.0, d: F - 1.0 - y0 }, mesa[0], mesa[1], 0.75,
      { paso: restaurante ? 1.2 : 1.0, prob: ctx.entre(0.7, 1), max: panaderia ? 4 : Infinity });
    // Menu boards sobre la contrabarra (grupo pegado), entre 1 y 4 según la barra.
    const n = Math.max(1, Math.min(4, Math.floor(L / 1.0), restaurante ? 2 : 4));
    const pulgadas = restaurante ? 49 : 43, h = panelSize({ pulgadas }).h;
    ctx.pantalla(fila(n, { pulgadas, pared: 'F', centro: bx + L / 2, z: round(Math.min(1.95, ctx.H - 0.1 - h), 2), grupo: 'menu-boards', grupoNombre: 'Menu boards', nombre: 'Menu board', corto: 'MB' }),
      { rango: [Math.max(0.05, bx - 0.3), Math.min(W - 0.05, bx + L + 0.3)], zMin: 1.0 });
    // Vertical junto a la caja, en el lateral más cercano a la barra.
    const lado = bx + L / 2 < W / 2 ? 'I' : 'D';
    ctx.pantalla({ nombre: 'Junto a caja · vertical', corto: 'CAJA', orientacion: 'vertical', pulgadas: 43, pared: lado, s: sEn(ctx, lado, 0, barra ? barra.y + 0.3 : 1.5), z: 1.2 }, { zMin: 0.9 });
    if (restaurante) ctx.pantalla({ nombre: 'Sala · horizontal', corto: 'SALA', orientacion: 'horizontal', pulgadas: 55, pared: lado === 'I' ? 'D' : 'I', s: sEn(ctx, lado === 'I' ? 'D' : 'I', 0, F * 0.55), z: 1.6 }, { zMin: 0.9 });
    ctx.escaparatePantalla(panaderia ? 43 : 55);
  },
  // Estanco: expositor de tabaco al fondo, mostrador delante, un lineal lateral; vertical junto
  // a la caja en el otro lateral, una horizontal sobre el expositor si cabe y la del escaparate.
  estanco(ctx) {
    const { W, F, rnd } = ctx;
    ctx.mueble('Expositor de tabaco', 0.4, 0, Math.min(W - 0.8, 6), 0.45, 2.1);
    const mw = Math.min(W - 1.6, 4), mx = (W - mw) / 2;
    const mostrador = ctx.mueble('Mostrador · caja', mx, 1.35, mw, 0.6, 1.0);
    const lineal = rnd() < 0.5 ? 'I' : 'D', y0 = mostrador ? mostrador.y + mostrador.d + 1.0 : 2.4;
    ctx.mueble('Lineal · regalo y papelería', lineal === 'I' ? 0 : W - 0.4, y0, 0.4, F - 1.0 - y0, 1.8);
    const otro = lineal === 'I' ? 'D' : 'I';
    ctx.pantalla({ nombre: 'Junto a caja · vertical', corto: 'CAJA', orientacion: 'vertical', pulgadas: 55, pared: otro, s: sEn(ctx, otro, 0, 1.6), z: 1.0 }, { zMin: 0.9 });
    ctx.pantalla({ nombre: 'Sobre el expositor · horizontal', corto: 'EXP', orientacion: 'horizontal', pulgadas: 43, pared: 'F', s: W / 2, z: 2.15 }, { rango: [0.05, W - 0.05], zMin: 2.15 });
    ctx.escaparatePantalla(55);
  },
  // Kiosco: mostrador bajo la ventanilla, expositor al fondo; una pantalla dentro y otra en la ventanilla.
  kiosco(ctx) {
    const { W, F } = ctx, e = ctx.escaparate;
    if (e && e.pared === 'P') ctx.mueble('Mostrador · ventanilla', W - e.s1, F - 0.5, e.s1 - e.s0, 0.5, 1.0, { zonas: false });
    if (e && e.pared === 'D') ctx.mueble('Mostrador · ventanilla', W - 0.5, e.s0, 0.5, e.s1 - e.s0, 1.0, { zonas: false });
    ctx.mueble('Expositor · prensa y golosinas', 0.15, 0, W - 0.3 - (e && e.pared === 'D' ? 0.5 : 0), 0.3, 1.6);
    ctx.pantalla({ nombre: 'Interior · horizontal', corto: 'INT', orientacion: 'horizontal', pulgadas: 32, pared: 'I', s: F / 2, z: 1.3 }, { zMin: 0.9 })
      || ctx.pantalla({ nombre: 'Interior · horizontal', corto: 'INT', orientacion: 'horizontal', pulgadas: 32, pared: 'F', s: W / 2, z: 1.7 }, { zMin: 0.9 });
    ctx.escaparatePantalla(32);
  },
  // Farmacia: cajonera al fondo, mostrador de dispensación, lineales murales y góndola central.
  farmacia(ctx) {
    const { W, F } = ctx;
    ctx.mueble('Cajonera · medicamentos', 0.8, 0, W - 1.6, 0.5, 2.0);
    const mw = Math.min(W - 2.4, 5), mostrador = ctx.mueble('Mostrador · dispensación', (W - mw) / 2, 1.5, mw, 0.7, 1.0);
    const y0 = mostrador ? mostrador.y + mostrador.d + 0.6 : 2.8;
    ctx.mueble('Lineal mural · parafarmacia', 0, y0, 0.45, F - 1.0 - y0, 2.0);
    ctx.mueble('Lineal mural · parafarmacia', W - 0.45, y0, 0.45, F - 1.0 - y0, 2.0);
    if (W >= 6) ctx.mueble('Góndola central', W / 2 - 0.3, y0 + 1.4, 0.6, Math.max(0.6, F - 1.0 - 1.6 - y0 - 1.4), 1.4);
    ctx.pantalla({ nombre: 'Sobre el mostrador · horizontal', corto: 'MOS', orientacion: 'horizontal', pulgadas: 49, pared: 'F', s: W / 2, z: 2.05 }, { zMin: 2.05 });
    const lado = ctx.rnd() < 0.5 ? 'I' : 'D';
    ctx.pantalla({ nombre: 'Junto a caja · vertical', corto: 'CAJA', orientacion: 'vertical', pulgadas: 43, pared: lado, s: sEn(ctx, lado, 0, 1.6), z: 1.0 }, { zMin: 0.9 });
    ctx.escaparatePantalla(55);
  },
  // Moda: murales en los laterales, probadores y caja al fondo, burros en la sala.
  moda(ctx) {
    const { W, F, rnd } = ctx;
    ctx.mueble('Mural · perchas', 0, 0.5, 0.5, F - 1.5, 2.2);
    ctx.mueble('Mural · perchas', W - 0.5, 0.5, 0.5, F - 1.5, 2.2);
    const probIzq = rnd() < 0.5, n = W >= 7 ? 3 : 2, pw = 1.0;
    const px = probIzq ? 0.6 : W - 0.6 - n * pw;
    for (let i = 0; i < n; i++) ctx.mueble('Probador', px + i * pw, 0, pw, 1.2, 2.2, { holgura: 0 });
    const caja = ctx.mueble('Caja', probIzq ? W - 0.6 - 1.6 : 0.6, 0.4, 1.6, 0.6, 1.0);
    ctx.rejilla('Burro · perchas', { x: 1.3, y: 2.6, w: W - 2.6, d: F - 3.6 }, 1.4, 0.5, 1.5, { paso: 1.2, prob: ctx.entre(0.6, 1) });
    if (caja) ctx.pantalla({ nombre: 'Junto a caja · vertical', corto: 'CAJA', orientacion: 'vertical', pulgadas: 55, pared: 'F', s: caja.x + caja.w / 2, z: 1.1 }, { zMin: 1.05 });
    ctx.pantalla({ nombre: 'Fondo · horizontal', corto: 'FON', orientacion: 'horizontal', pulgadas: 55, pared: 'F', s: W / 2, z: 1.6 }, { zMin: 1.2 });
    ctx.escaparatePantalla(55);
    const e = ctx.escaparate;
    if (e && e.s1 - e.s0 >= 2.4) ctx.escaparatePantalla(55); // segunda vertical si el escaparate es ancho
  },
  // Supermercado de proximidad: murales en tres paredes, góndolas en filas y cajas junto a la salida.
  super(ctx) {
    const { W, F } = ctx;
    ctx.mueble('Lineal mural · frescos', 0, 0, W, 0.5, 2.0, { holgura: 0 });
    ctx.mueble('Lineal mural', 0, 0.5, 0.5, F - 3.4, 2.0, { holgura: 0 });
    ctx.mueble('Lineal mural', W - 0.5, 0.5, 0.5, F - 3.4, 2.0, { holgura: 0 });
    const yc = F - 2.6;
    for (let x = 2.1; x + 0.9 <= W - 2.1 + EPS; x += 0.9 + 1.6) ctx.mueble('Góndola', x, 2.1, 0.9, Math.max(0.6, yc - 1.4 - 2.1), 1.8);
    let cajas = 0;
    for (let x = ctx.puerta.x0 < W / 2 ? W - 2.2 : 0.6; cajas < Math.min(4, Math.floor((W - 1.2) / 2.6)) && x > -EPS && x + 1.6 <= W + EPS; x += ctx.puerta.x0 < W / 2 ? -2.6 : 2.6) {
      if (ctx.mueble('Caja', x, yc, 1.6, 0.8, 0.9)) cajas++;
    }
    const n = W >= 12 ? 3 : 2;
    for (let i = 0; i < n; i++) ctx.pantalla({ nombre: 'Sección · horizontal', corto: `SEC${i + 1}`, orientacion: 'horizontal', pulgadas: 55, pared: 'F', s: W * (i + 1) / (n + 1), z: 2.1 }, { zMin: 2.05 });
    const lado = ctx.puerta.x0 < W / 2 ? 'D' : 'I';
    ctx.pantalla({ nombre: 'Junto a cajas · horizontal', corto: 'CAJA', orientacion: 'horizontal', pulgadas: 43, pared: lado, s: sEn(ctx, lado, 0, yc + 0.4), z: 2.05 }, { zMin: 1.2 });
    ctx.escaparatePantalla(55);
  },
  // Oficina bancaria: puestos de atención, sillas de espera y cajero; turnos al fondo, sala de espera y escaparate.
  banco(ctx) {
    const { W, F, rnd } = ctx;
    const n = Math.max(1, Math.min(4, Math.floor((W - 1.2) / 2.2)));
    for (let i = 0; i < n; i++) ctx.mueble('Puesto de atención', 0.8 + i * 2.2, 1.2, 1.4, 0.7, 0.75);
    const lado = rnd() < 0.5 ? 'I' : 'D';
    ctx.mueble('Sillas de espera', lado === 'I' ? 0 : W - 0.5, 3.2, 0.5, Math.min(2.4, F - 4.4), 0.9);
    ctx.mueble('Cajero automático', lado === 'I' ? W - 0.7 : 0, F - 2.4, 0.7, 0.6, 1.6);
    ctx.pantalla({ nombre: 'Turnos · horizontal', corto: 'TUR', orientacion: 'horizontal', pulgadas: 43, pared: 'F', s: W / 2, z: 2.0 }, { zMin: 1.2 });
    ctx.pantalla({ nombre: 'Sala de espera · horizontal', corto: 'ESP', orientacion: 'horizontal', pulgadas: 55, pared: lado, s: sEn(ctx, lado, 0, 4.4), z: 1.5 }, { zMin: 1.0 });
    ctx.escaparatePantalla(55);
  },
  // Oficina: ventana al fondo, puestos en filas y mesa de reunión; pantalla de reunión y una en recepción.
  oficina(ctx) {
    const { W, F, plan } = ctx;
    const vw = Math.min(W * 0.4, 3);
    plan.huecos.push({ id: 'ventana', tipo: 'ventana', nombre: 'Ventana', pared: 'F', desde: round((W - vw) / 2), ancho: round(vw), base: 0.9, alto: round(Math.min(1.4, ctx.H - 1.2)) });
    const reunion = F >= 6 && W >= 4 ? ctx.mueble('Mesa de reunión', (W - 2.4) / 2, 1.0, 2.4, 1.0, 0.75) : null;
    const y0 = reunion ? reunion.y + reunion.d + 1.2 : 1.0;
    ctx.rejilla('Puesto de trabajo', { x: 0.6, y: y0, w: W - 1.2, d: F - 1.4 - y0 }, 1.4, 0.7, 0.75, { paso: 1.2 });
    const lado = ctx.rnd() < 0.5 ? 'I' : 'D';
    ctx.pantalla({ nombre: 'Reunión · horizontal', corto: 'REU', orientacion: 'horizontal', pulgadas: 65, pared: lado, s: sEn(ctx, lado, 0, 1.5), z: 1.0 }, { zMin: 0.9 });
    ctx.pantalla({ nombre: 'Recepción · vertical', corto: 'REC', orientacion: 'vertical', pulgadas: 43, pared: 'P', s: W - (ctx.puerta.x1 + 0.6), z: 1.0 }, { zMin: 0.9 });
  },
  // Laboratorio / showroom: mesas de trabajo perimetrales, mosaico V–H–V de 27″ al fondo y una vertical junto a la puerta.
  laboratorio(ctx) {
    const { W, F, rnd } = ctx;
    ctx.mueble('Mesa de trabajo', 0.3, 0, Math.min(W - 0.6, 4), 0.7, 0.75);
    const lado = rnd() < 0.5 ? 'I' : 'D';
    ctx.mueble('Mesa larga', lado === 'I' ? 0 : W - 0.7, 1.0, 0.7, Math.min(2.6, F - 2.6), 0.75);
    ctx.mueble('Puesto central', (W - 1.4) / 2, Math.min(F - 2.6, 2.2), 1.4, 0.7, 0.75);
    const v = panelSize({ pulgadas: 27, orientacion: 'vertical' }), h = panelSize({ pulgadas: 27 });
    const c = Math.min(Math.max(W / 2, v.w + h.w / 2 + 0.4), W - v.w - h.w / 2 - 0.4), lift = round((v.h - h.h) / 2, 3);
    ctx.pantalla([
      { nombre: 'V–H–V · V izquierda', corto: 'V1', orientacion: 'vertical', pulgadas: 27, pared: 'F', s: round(c - h.w / 2 - v.w / 2, 3), z: 0.95, grupo: 'vhv', grupoNombre: 'V–H–V' },
      { nombre: 'V–H–V · H centro', corto: 'H', orientacion: 'horizontal', pulgadas: 27, pared: 'F', s: round(c, 3), z: round(0.95 + lift, 3), grupo: 'vhv', grupoNombre: 'V–H–V' },
      { nombre: 'V–H–V · V derecha', corto: 'V2', orientacion: 'vertical', pulgadas: 27, pared: 'F', s: round(c + h.w / 2 + v.w / 2, 3), z: 0.95, grupo: 'vhv', grupoNombre: 'V–H–V' }
    ], { zMin: 0.9 });
    ctx.pantalla({ nombre: 'Junto a la puerta · vertical', corto: 'PTA', orientacion: 'vertical', pulgadas: 43, pared: 'P', s: W - (ctx.puerta.x1 + 0.5), z: 1.0 }, { zMin: 0.9 });
  }
};

// Resumen para la vista previa de la UI.
export function resumenGenerado(plan) {
  const huecos = plan.huecos || [];
  return {
    tipo: plan.generador && plan.generador.tipo, semilla: plan.generador && plan.generador.semilla,
    m2: round(plan.planta.ancho * plan.planta.fondo, 1), ancho: plan.planta.ancho, largo: plan.planta.fondo, alto: plan.planta.alto,
    puertas: huecos.filter(h => h.tipo === 'puerta').length, escaparates: huecos.filter(h => h.tipo === 'escaparate').length,
    muebles: (plan.mobiliario || []).length, pantallas: (plan.pantallas || []).length
  };
}
