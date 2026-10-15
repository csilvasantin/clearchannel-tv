// Los 18 espacios Altadis (DCL-d7966deb02734a6f34beb54e · «Hoy #22»). Sin DOM: lo usan arquitecto.mjs,
// tools/genera-espacios-altadis.mjs y los tests.
//
// Carlos, 15-oct-2026: para la presentación a Alsea / Starbucks del 16-oct, el Arquitecto define 18 espacios tipo,
// uno por cada formato de pantalla que pide Altadis, en estanco (Xtanco) y en cafetería (Starbucks), para crear,
// adaptar y mostrar contenido en gemelos digitales a medida de cada formato.
//
// De dónde sale cada cosa (sin inventar lo que ya está decidido en otro sitio):
//   · Formatos  → admira.studio/adaptaciones/perfil-cliente-18.json, cliente-01…18 (los 19-24 son MyBlu y quedan
//                 fuera), copia del PDF «ALTADIS Resoluciones y formatos», p. 3. MP4 / H264 / 25 fps; SINCRO VW y
//                 SINCRO LOGO con la misma duración.
//   · Rejilla   → la regla de twinGeometry de admira.studio (adaptaciones/gemelo-core.mjs): «VIDEOWALL|SINCRO VW
//                 CxR» da columnas × filas; si no, 1×1. El lienzo se parte a partes iguales y cada celda es una
//                 pantalla física.
//   · Zona      → FORMAT_REFERENCE_MAP de admira.studio (adaptaciones/gemelo-catalog.mjs).
//   · Espacio   → generarXpacio (plano-generador.mjs) con semilla fija y las medidas medias del tipo: se quitan
//                 las pantallas típicas y se colocan sólo las del formato, en su zona, sin un solo aviso de
//                 validate() de plano-core. Es un plano tipo inventado, no un levantamiento.
//   · Pantallas → tamaños físicos SUPUESTOS (estimación de la casa, por confirmar con Altadis): LCD por diagonal y
//                 orientación; LED por dimensiones con su paso de píxel.
import { round, validate, panelSize, footprint, wallLength, furnitureAgainstWall, criteria } from './plano-core.mjs?v=20261014-plano-1';
import { generarXpacio } from './plano-generador.mjs?v=20261014-foto-1';

export const SERIE = 'altadis-18';
export const INDICE_SCHEMA = 'admira.espacios-formato/1';
// Sello de los datos (normativa 07: v.DD.MM.AAAA.rN.HH:MM). Va en el índice y en `version` de cada plano: si cambia
// algo del espacio, se sube aquí y se regeneran los JSON (node tools/genera-espacios-altadis.mjs).
export const SELLO = 'v.15.10.2026.r1.09:58';
export const FUENTE = Object.freeze({ perfil: 'admira.studio/adaptaciones/perfil-cliente-18.json', sha256: '16a17b2f81c5713d5d0fc676a02d2192fb95ad07ecb13e29dbec1b09da5239f7', pdf: 'ALTADIS Resoluciones y formatos, p. 3' });
// La copia exacta del perfil que se usó: commit de csilvasantin/admira-studio y sha256 del fichero.
export const PERFIL = Object.freeze({ repo: 'csilvasantin/admira-studio', commit: '50d46a617083b023c5b15cc3cee4be5c9ee65df9', sha256: 'c5447f56e724e3ddbbb460201c5ed46a3acc04b5e66044e3182b462b5eb37901' });
export const REQUISITOS = Object.freeze({ es: 'MP4 / H264 / 25 fps; SINCRO VW y SINCRO LOGO con la misma duración', en: 'MP4 / H.264 / 25 fps; SINCRO VW and SINCRO LOGO with the same duration' });
export const URL_GEMELO = 'https://www.admira.store/xpacios/altadis-18/';
export const URL_STUDIO = 'https://admira.studio/adaptaciones/';
const EPS = 1e-6;
const INCH = 0.0254;
const dos = n => String(n).padStart(2, '0');
const metros = (n, d = 2) => String(round(n, d)).replace('.', ',');

// ── Los 18 formatos (cliente-01…18 del perfil, tal cual) ────────────────────
const F = (n, nombre, ancho, alto, es, en) => Object.freeze({ id: `cliente-${dos(n)}`, n, nombre, ancho, alto, fps: 25, uso: Object.freeze({ es, en }) });
export const FORMATOS_ALTADIS = Object.freeze([
  F(1, 'VERTICAL', 1080, 1920, 'tótem / escaparate', 'totem / shop window'),
  F(2, 'HORIZONTAL', 1920, 1080, 'mostrador', 'counter'),
  F(3, 'VIDEOWALL 2X1 H', 1920, 540, 'videowall', 'video wall'),
  F(4, 'SINCRO LOGO', 1920, 1080, 'logo sincronizado', 'synchronised logo'),
  F(5, 'SINCRO VW', 1920, 540, 'videowall sincronizado', 'synchronised video wall'),
  F(6, 'SINCRO VW 4X1 H', 3840, 540, 'videowall sincronizado', 'synchronised video wall'),
  F(7, 'TABLET', 768, 1024, 'tablet', 'tablet'),
  F(8, 'LED CUBO MADRID-062', 1600, 600, 'cubo LED', 'LED cube'),
  F(9, 'LED GRANADA-021', 1536, 192, 'barra LED', 'LED strip'),
  F(10, 'GONDOLA LED LIMITS-006', 64, 384, 'góndola LED', 'LED gondola'),
  F(11, 'VIDEOWALL 1X2 H', 1920, 2160, 'videowall', 'video wall'),
  F(12, 'VIDEOWALL 1X2 V', 540, 1920, 'videowall vertical', 'portrait video wall'),
  F(13, 'VIDEOWALL 2X1 V', 2160, 1920, 'videowall', 'video wall'),
  F(14, 'VIDEOWALL 3X1 H', 2880, 540, 'videowall', 'video wall'),
  F(15, 'VIDEOWALL 4X1 H', 3840, 540, 'videowall', 'video wall'),
  F(16, 'VIDEOWALL 4X1 V', 1920, 852, 'videowall', 'video wall'),
  F(17, 'VIDEOWALL 8X1 H', 2880, 640, 'videowall', 'video wall'),
  F(18, 'SHUTTLE STRETCH', 1920, 158, 'sede / stretch', 'head office / stretch')
]);
const POR_ID = new Map(FORMATOS_ALTADIS.map(f => [f.id, f]));
export const FORMATO_RE = /^cliente-(0[1-9]|1[0-8])$/;
export function formatoDe(f) {
  if (f && typeof f === 'object') return POR_ID.get(f.id) || null;
  return POR_ID.get(String(f ?? '')) || null;
}
const exigir = f => { const x = formatoDe(f); if (!x) throw new TypeError('formato Altadis desconocido: ' + (f && f.id || f)); return x; };

// ── Rejilla (regla de twinGeometry de admira.studio) ────────────────────────
// «VIDEOWALL 2X1 H» → 2 columnas × 1 fila; «SINCRO VW 4X1 H» → 4 × 1; cualquier otro nombre → 1 × 1.
export const REJILLA_RE = /(?:VIDEOWALL|SINCRO VW)\s+(\d+)X(\d+)/i;
export function gridDe(formato) {
  const m = String((formato && formato.nombre) ?? formato ?? '').match(REJILLA_RE);
  const cols = m ? Number(m[1]) : 1, rows = m ? Number(m[2]) : 1;
  if (!(cols >= 1 && rows >= 1) || cols * rows > 64) throw new RangeError('rejilla no válida');
  return { cols, rows };
}
// Celdas en píxeles del lienzo, de izquierda a derecha y de arriba abajo (la n de los segmentos de Studio). Los
// bordes son enteros contiguos: sin huecos ni solapes aunque el lienzo no se parta exacto.
export function celdas(formato) {
  const f = exigir(formato), { cols, rows } = gridDe(f), out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = Math.round(c * f.ancho / cols), y = Math.round(r * f.alto / rows);
    out.push({ n: out.length + 1, col: c, fila: r, x, y, w: Math.round((c + 1) * f.ancho / cols) - x, h: Math.round((r + 1) * f.alto / rows) - y });
  }
  return out;
}

// ── Zonas (FORMAT_REFERENCE_MAP de admira.studio) ───────────────────────────
export const ZONAS = Object.freeze({
  mostrador: Object.freeze({ es: 'mostrador', en: 'counter', formatos: Object.freeze(['cliente-01', 'cliente-02', 'cliente-04', 'cliente-07']),
    regla: Object.freeze({ es: 'sobre o tras el mostrador; el tótem vertical, en el escaparate', en: 'on or behind the counter; the portrait totem, in the shop window' }) }),
  mural: Object.freeze({ es: 'mural', en: 'wall', formatos: Object.freeze(['cliente-03', 'cliente-05', 'cliente-06', 'cliente-14', 'cliente-15', 'cliente-16', 'cliente-17']),
    regla: Object.freeze({ es: 'pared del fondo, base a 1,1–1,3 m', en: 'back wall, bottom at 1.1–1.3 m' }) }),
  columna: Object.freeze({ es: 'columna', en: 'column', formatos: Object.freeze(['cliente-10', 'cliente-11', 'cliente-12', 'cliente-13']),
    regla: Object.freeze({ es: 'de pie junto al lineal', en: 'standing next to the shelving' }) }),
  superstretch: Object.freeze({ es: 'superstretch', en: 'superstretch', formatos: Object.freeze(['cliente-09', 'cliente-18']),
    regla: Object.freeze({ es: 'banda alta sobre el mostrador, a 2,2–2,9 m', en: 'high band over the counter, at 2.2–2.9 m' }) }),
  cubo: Object.freeze({ es: 'cubo', en: 'cube', formatos: Object.freeze(['cliente-08']),
    regla: Object.freeze({ es: 'LED de 4 caras sobre peana', en: '4-sided LED on a plinth' }) })
});
export function zonaDe(formato) {
  const f = exigir(formato);
  for (const [k, z] of Object.entries(ZONAS)) if (z.formatos.includes(f.id)) return k;
  return 'mural'; // como recommendedReferenceId de Studio
}

// ── Pantallas físicas supuestas (ESTIMACIÓN DE LA CASA, por confirmar con Altadis) ──
// LCD: diagonal en pulgadas por celda (videowall de 46–55″). `siNoCabe`: la diagonal de reserva cuando la primera no
// cabe en la sala (la columna 1X2 V de 46″ no cabe bajo los 2,9 m del Xtanco con la base a 0,9 m; en el Starbucks sí).
// LED: paso de píxel en mm; dimensiones = píxeles × paso. El cubo: 4 caras iguales del lienzo partido a lo ancho.
export const FISICO = Object.freeze({
  'cliente-01': Object.freeze({ tecnologia: 'lcd', pulgadas: 55 }),
  'cliente-02': Object.freeze({ tecnologia: 'lcd', pulgadas: 55 }),
  'cliente-03': Object.freeze({ tecnologia: 'lcd', pulgadas: 55 }),
  'cliente-04': Object.freeze({ tecnologia: 'lcd', pulgadas: 55 }),
  'cliente-05': Object.freeze({ tecnologia: 'lcd', pulgadas: 88 }), // LCD estirada 32:9 («ultra stretch» de 88″)
  'cliente-06': Object.freeze({ tecnologia: 'lcd', pulgadas: 49 }),
  'cliente-07': Object.freeze({ tecnologia: 'lcd', pulgadas: 9.7 }), // tablet 4:3
  'cliente-08': Object.freeze({ tecnologia: 'led', pasoPixelMm: 1.875, forma: 'cubo-4-caras', caras: 4, peana: 0.9 }),
  'cliente-09': Object.freeze({ tecnologia: 'led', pasoPixelMm: 2.5 }),
  'cliente-10': Object.freeze({ tecnologia: 'led', pasoPixelMm: 2.5 }),
  'cliente-11': Object.freeze({ tecnologia: 'lcd', pulgadas: 49 }),
  'cliente-12': Object.freeze({ tecnologia: 'lcd', pulgadas: 46, siNoCabe: 43 }),
  'cliente-13': Object.freeze({ tecnologia: 'lcd', pulgadas: 55 }),
  'cliente-14': Object.freeze({ tecnologia: 'lcd', pulgadas: 55 }),
  'cliente-15': Object.freeze({ tecnologia: 'lcd', pulgadas: 49 }),
  'cliente-16': Object.freeze({ tecnologia: 'lcd', pulgadas: 55 }),
  'cliente-17': Object.freeze({ tecnologia: 'lcd', pulgadas: 46 }),
  'cliente-18': Object.freeze({ tecnologia: 'lcd', pulgadas: 87 }) // barra LCD estirada de unos 2,2 m
});
const mcd = (a, b) => b ? mcd(b, a % b) : a;
// Aspecto [largo, corto] de una celda; null si es 16:9 (±1 %), el panel estándar.
export function aspectoDe(w, h) {
  const L = Math.max(w, h), C = Math.min(w, h);
  if (Math.abs(L / C - 16 / 9) / (16 / 9) < 0.01) return null;
  const g = mcd(L, C);
  return [L / g, C / g];
}
const CORTO = Object.freeze({ 'cliente-01': 'VERT', 'cliente-02': 'HORIZ', 'cliente-04': 'LOGO', 'cliente-05': 'VW', 'cliente-07': 'TAB', 'cliente-08': 'CUBO', 'cliente-09': 'LED', 'cliente-10': 'GOND', 'cliente-18': 'STR' });

// Las pantallas físicas de un formato, relativas a s = 0 (borde izquierdo) y z = 0 (base): pegadas, sin junta, la
// fila de arriba del lienzo arriba. Cada una con su celda del lienzo. `pulgadas` cambia la diagonal de las LCD.
// El cubo es una sola pantalla de Studio (1×1), pero en el plano 2D cuenta UNA cara: su recorte, su resolución y sus
// medidas son las de una cara (colocar elige la que da a la sala); el prisma entero va en `cubo`.
export function pantallasDeFormato(formato, { pulgadas } = {}) {
  const f = exigir(formato), fis = FISICO[f.id], { rows } = gridDe(f), NN = dos(f.n);
  const cs = fis.forma ? [{ n: 1, col: 0, fila: 0, x: 0, y: 0, w: f.ancho / fis.caras, h: f.alto }] : celdas(f), N = cs.length;
  return cs.map(c => {
    const orientacion = c.w >= c.h ? 'horizontal' : 'vertical';
    const base = { id: `f${NN}-${c.n}`, itil: null, nombre: N > 1 ? `${f.nombre} · ${c.n} de ${N}` : f.nombre, corto: N > 1 ? `${c.n}/${N}` : (CORTO[f.id] || f.nombre.slice(0, 5)),
      tipo: 'pantalla', estado: 'propuesta', formato: f.id, celda: c.n, lienzo: [f.ancho, f.alto], recorte: { x: c.x, y: c.y, w: c.w, h: c.h }, resolucion: [c.w, c.h], tecnologia: fis.tecnologia, orientacion };
    let medidas;
    if (fis.tecnologia === 'led') {
      const dimensiones = { ancho: round(c.w * fis.pasoPixelMm / 1000, 3), alto: round(c.h * fis.pasoPixelMm / 1000, 3) };
      // `pulgadas`: diagonal equivalente (plano.html y leerPlanoJson la piden); las medidas las dan `dimensiones`.
      medidas = { pulgadas: round(Math.hypot(dimensiones.ancho, dimensiones.alto) / INCH, 1), dimensiones, pasoPixelMm: fis.pasoPixelMm };
    } else {
      const aspecto = aspectoDe(c.w, c.h);
      medidas = { pulgadas: pulgadas || fis.pulgadas, ...(aspecto ? { aspecto } : {}) };
    }
    const g = panelSize({ orientacion, ...medidas });
    const grupo = N > 1 ? { grupo: `formato-${NN}`, grupoNombre: f.nombre, ...(rows > 1 ? { subgrupo: `F${c.fila + 1}` } : {}) } : {};
    return { ...base, ...medidas, ...grupo, s: round(g.w / 2 + c.col * g.w, 4), z: round((rows - 1 - c.fila) * g.h, 4), _w: g.w, _h: g.h };
  });
}

// ── Tipos de espacio ────────────────────────────────────────────────────────
// Semillas fijas, elegidas por la planta que dan con las medidas medias del tipo: el Xtanco con la puerta a la
// derecha y el lineal en el lateral izquierdo; el Starbucks con la barra a la izquierda y la puerta a la derecha.
export const TIPOS_ESPACIO = Object.freeze({
  xtanco: Object.freeze({ es: 'Xtanco', en: 'Xtanco', tipoArquitecto: 'estanco', prefijo: 'Xtanco', semilla: 1 }),
  cafe: Object.freeze({ es: 'Cafetería Starbucks', en: 'Starbucks café', tipoArquitecto: 'cafeteria', prefijo: 'Starbucks', semilla: 2 })
});
// Un tipo que no sea propio de TIPOS_ESPACIO («constructor», «__proto__», «toString»…) es el Xtanco.
export const tipoEspacio = tipo => typeof tipo === 'string' && Object.hasOwn(TIPOS_ESPACIO, tipo) ? tipo : 'xtanco';
export const idEspacio = (formato, tipo) => `altadis-${tipoEspacio(tipo)}-${dos(exigir(formato).n)}`;
export const nombreEspacio = (formato, tipo) => { const f = exigir(formato); return `${TIPOS_ESPACIO[tipoEspacio(tipo)].prefijo} · ${f.nombre} (${f.ancho}×${f.alto})`; };
export const ESPACIO_RE = /^altadis-(xtanco|cafe)-(0[1-9]|1[0-8])$/;

// Cómo va montada cada pantalla (código en el JSON; texto para la ficha).
export const MONTAJES = Object.freeze({
  escaparate: Object.freeze({ es: 'tótem de pie en el escaparate', en: 'standing totem in the shop window' }),
  'tras-mostrador': Object.freeze({ es: 'tras el mostrador, integrada en el expositor', en: 'behind the counter, built into the display' }),
  'sobre-contrabarra': Object.freeze({ es: 'sobre la contrabarra, tras el mostrador', en: 'over the back bar, behind the counter' }),
  'junto-caja': Object.freeze({ es: 'soporte de pared junto a la caja, a la altura del mostrador', en: 'wall bracket next to the till, at counter height' }),
  'pared-fondo': Object.freeze({ es: 'mural en la pared del fondo', en: 'wall display on the back wall' }),
  'cabecera-lineal': Object.freeze({ es: 'de pie en la cabecera del lineal', en: 'standing at the head of the shelving' }),
  'banda-alta': Object.freeze({ es: 'banda alta sobre el mostrador', en: 'high band over the counter' }),
  peana: Object.freeze({ es: 'cubo LED de 4 caras sobre peana', en: '4-sided LED cube on a plinth' })
});

// Avisos de cada formato: incoherencias del PDF o supuestos que hay que confirmar antes de emitir.
export const AVISOS = Object.freeze({
  'cliente-01': Object.freeze({ es: 'Studio lo pone en la zona mostrador, pero su uso es «tótem / escaparate»: aquí va de pie en el escaparate.', en: 'Studio puts it in the counter zone, but its use is “totem / shop window”: here it stands in the shop window.' }),
  'cliente-05': Object.freeze({ es: 'El nombre dice videowall pero no trae rejilla: Studio lo trata como 1×1 y aquí es una LCD estirada 32:9. Si en la tienda son dos pantallas (como el 2X1 H de 1920×540), hay que cambiarlo.', en: 'The name says video wall but has no grid: Studio treats it as 1×1 and here it is a 32:9 stretched LCD. If the store has two screens (like the 1920×540 2X1 H), change it.' }),
  'cliente-08': Object.freeze({ es: 'Cubo LED de 4 caras de 400×600 px cada una (medidas supuestas). En el plano se ve la cara que da a la sala; las 4 caras, en el gemelo 3D.', en: '4-sided LED cube, 400×600 px per side (assumed sizes). The plan shows the side facing the room; all 4 sides, in the 3D twin.' }),
  'cliente-16': Object.freeze({ es: 'Celdas de 480×852: casi 9:16 (852 en vez de 853,3).', en: '480×852 cells: almost 9:16 (852 instead of 853.3).' }),
  'cliente-17': Object.freeze({ es: 'Nombre y proporción no cuadran: «8X1 H» con 2880×640 da celdas de 360×640, verticales. Se modelan 8 verticales; hay que confirmarlo con Altadis.', en: 'Name and aspect do not match: “8X1 H” at 2880×640 gives 360×640 portrait cells. Modelled as 8 portrait screens; confirm with Altadis.' }),
  'cliente-18': Object.freeze({ es: 'Su uso es «sede / stretch»: en un Xtanco o un Starbucks es un supuesto.', en: 'Its use is “head office / stretch”: in a Xtanco or a Starbucks it is an assumption.' })
});
// Regla del PDF: SINCRO VW y SINCRO LOGO, con la misma duración. El logo va con el videowall sincronizado que haya.
export const SINCRO = Object.freeze({ 'cliente-04': Object.freeze(['cliente-05', 'cliente-06']), 'cliente-05': Object.freeze(['cliente-04']), 'cliente-06': Object.freeze(['cliente-04']) });
// Avisos de un espacio: los del formato y, si la diagonal preferida no cabía en esa sala, el de la de reserva.
export function avisosEspacio(plan) {
  const f = exigir(plan.formato.id), fis = FISICO[f.id], p0 = plan.pantallas[0], out = AVISOS[f.id] ? [AVISOS[f.id]] : [];
  if (fis.siNoCabe && p0 && p0.pulgadas !== fis.pulgadas) {
    const H = String(plan.planta.alto).replace('.', ','), He = String(plan.planta.alto), b = String(criteria(plan).alturaMinima);
    out.push({ es: `Dos LCD verticales apiladas de ${fis.siNoCabe}″: con ${fis.pulgadas}″ la columna no cabe bajo el techo de ${H} m con la base a ${b.replace('.', ',')} m.`,
      en: `Two stacked ${fis.siNoCabe}″ portrait LCDs: at ${fis.pulgadas}″ the column does not fit under the ${He} m ceiling with its bottom at ${b} m.` });
  }
  return out;
}

// ── Mobiliario: recortes para dejar sitio a las pantallas ───────────────────
const sEn = (W, F, pared, x, y) => ({ F: x, D: y, P: W - x, I: F - y })[pared];
// Tramo [a, b] de una pared en coordenadas de la planta: [eje, desde, hasta].
const ejeDe = (W, F, pared, a, b) => ({ F: ['x', a, b], D: ['y', a, b], P: ['x', W - b, W - a], I: ['y', F - b, F - a] })[pared];
const RECORTABLE = /^(Expositor de tabaco|Lineal)\b/;
// Parte los muebles recortables que quedarían delante del conjunto (expositor, lineal): quedan los tramos a los
// lados (de 30 cm o más) y, si `bajo`, un mueble bajo debajo de las pantallas.
function recortar(plan, pantallas, { bajo } = {}) {
  if (!pantallas.length) return plan.mobiliario;
  const W = plan.planta.ancho, Fo = plan.planta.fondo, pared = pantallas[0].pared, wall = plan.paredes.find(w => w.id === pared), crit = criteria(plan);
  const fs = pantallas.map(footprint), x0 = Math.min(...fs.map(f => f.x0)), x1 = Math.max(...fs.map(f => f.x1)), z0 = Math.min(...fs.map(f => f.z0));
  const out = [];
  for (const m of plan.mobiliario) {
    const p = furnitureAgainstWall(m, wall);
    const delante = RECORTABLE.test(m.nombre) && p.dist <= crit.profundidadMueble && p.dist >= -0.05 && Math.min(x1 + 0.05, p.s1) - Math.max(x0 - 0.05, p.s0) > EPS && m.alto > z0 + EPS;
    if (!delante) { out.push(m); continue; }
    const [eje, a, b] = ejeDe(W, Fo, pared, Math.floor((x0 - 0.05) * 100) / 100, Math.ceil((x1 + 0.05) * 100) / 100);
    const lo = eje === 'x' ? m.x : m.y, hi = eje === 'x' ? m.x + m.w : m.y + m.d;
    const tramo = (u, v, extra) => eje === 'x' ? { ...m, ...extra, x: round(u), w: round(v - u) } : { ...m, ...extra, y: round(u), d: round(v - u) };
    if (Math.max(lo, a) - lo >= 0.3 - EPS) out.push(tramo(lo, Math.max(lo, a), { id: `${m.id}-1` }));
    const c0 = Math.max(lo, a), c1 = Math.min(hi, b);
    if (bajo && c1 - c0 > EPS) out.push(tramo(c0, c1, { id: `${m.id}-bajo`, nombre: /^Expositor/.test(m.nombre) ? 'Expositor bajo · cajones de tabaco' : `${m.nombre} · bajo`, alto: round(Math.min(bajo, z0 - 0.05)) }));
    if (hi - Math.min(hi, b) >= 0.3 - EPS) out.push(tramo(Math.min(hi, b), hi, { id: `${m.id}-2` }));
  }
  return out;
}
const solapa = (a, b, g = 0) => a.x < b.x + b.w + g - EPS && b.x < a.x + a.w + g - EPS && a.y < b.y + b.d + g - EPS && b.y < a.y + a.d + g - EPS;
// Añade un mueble; las mesas que lo pisen (con `despejar` de paso) se quitan. Cualquier otro choque es un error.
function anadirMueble(plan, m, { despejar = 0 } = {}) {
  const fuera = plan.mobiliario.filter(o => solapa(m, o, despejar));
  if (fuera.some(o => !/^Mesa\b/.test(o.nombre))) throw new RangeError(`${m.nombre} no cabe en ${plan.id}`);
  plan.mobiliario = plan.mobiliario.filter(o => !fuera.includes(o)).concat(m);
}

// Coloca el conjunto (relativo) en su pared: prueba el centro pedido y, si algo choca, lo desliza por la pared en
// pasos de 5 cm y prueba las otras alturas. Con `recortable`, el expositor o el lineal se parten para dejarle sitio.
function situar(plan, miembros, { pared, centro, zs, rango, recortable = false, bajo, extra = {} }) {
  const wall = plan.paredes.find(w => w.id === pared), len = wallLength(wall);
  const ancho = Math.max(...miembros.map(p => p.s + p._w / 2)), [lo, hi] = rango || [0.05, len - 0.05];
  const c0 = Math.min(Math.max(centro, lo + ancho / 2), hi - ancho / 2);
  const pasos = [0];
  for (let k = 1; k <= Math.ceil(len / 0.05); k++) pasos.push(round(k * 0.05), round(-k * 0.05));
  for (const z of zs) for (const d of pasos) {
    const c = c0 + d;
    if (c - ancho / 2 < lo - EPS || c + ancho / 2 > hi + EPS) continue;
    const cand = miembros.map(({ _w, _h, ...p }) => ({ ...p, ...extra, pared, s: round(p.s + c - ancho / 2, 3), z: round(p.z + z, 3) }));
    const mobiliario = recortable ? recortar(plan, cand, { bajo }) : plan.mobiliario;
    if (!validate({ ...plan, mobiliario }, cand).length) return { pantallas: cand, mobiliario };
  }
  throw new RangeError(`no caben las pantallas de ${plan.id} en la pared ${pared}`);
}

// Dónde va cada zona en cada tipo (la planta la da generarXpacio con la semilla del tipo).
function colocar(plan, f, tipo, miembros) {
  const W = plan.planta.ancho, Fo = plan.planta.fondo, zona = zonaDe(f), fis = FISICO[f.id];
  const busca = re => plan.mobiliario.find(m => re.test(m.nombre));
  const cx = m => round(m.x + m.w / 2, 3);
  const alto = Math.max(...miembros.map(p => p.z + p._h)), xt = tipo === 'xtanco';
  const mostrador = xt ? busca(/^Mostrador/) : busca(/^Barra/), trasera = xt ? busca(/^Expositor de tabaco/) : busca(/^Contrabarra/);
  // Lateral libre: el que no tiene el lineal (Xtanco) o el que no tiene la barra (Starbucks).
  const libre = xt ? ((busca(/^Lineal/) || { x: 0 }).x < W / 2 ? 'D' : 'I') : (cx(mostrador) < W / 2 ? 'D' : 'I');
  const fondo = (z, montaje, extra) => ({ pared: 'F', centro: xt ? W / 2 : cx(trasera), zs: z, recortable: xt, bajo: 1.0, extra: { montaje, separacion: 0.03, ...extra } });

  if (zona === 'mostrador') {
    if (f.id === 'cliente-01') {
      const e = plan.huecos.find(h => h.tipo === 'escaparate');
      return { pared: e.pared, centro: e.desde + e.ancho / 2, rango: [e.desde, e.desde + e.ancho], zs: [round(Math.min(e.base + 0.25, e.base + e.alto - alto), 2)], extra: { escaparate: true, montaje: 'escaparate', separacion: 0.15 } };
    }
    if (f.id === 'cliente-07') {
      const lado = xt ? libre : (cx(mostrador) < W / 2 ? 'I' : 'D');
      return { pared: lado, centro: sEn(W, Fo, lado, 0, mostrador.y + mostrador.d / 2), zs: [round(mostrador.alto + 0.05, 2), round(mostrador.alto + 0.1, 2)], extra: { montaje: 'junto-caja', separacion: 0.03 } };
    }
    return xt ? fondo([1.35, 1.3, 1.4], 'tras-mostrador') : fondo([1.75, 1.7, 1.8], 'sobre-contrabarra');
  }
  if (zona === 'mural') return fondo(alto > 0.8 ? [1.1, 1.15, 1.2] : [1.2, 1.15, 1.25, 1.1, 1.3], 'pared-fondo');
  if (zona === 'superstretch') return { ...fondo([2.25, 2.2, 2.3], 'banda-alta'), recortable: false };
  if (zona === 'columna') {
    let L = xt ? busca(/^Lineal/) : null;
    if (!L) {
      // Starbucks: lineal de café en grano y merchandising en el lateral sin barra, entre la barra y las mesas.
      L = { id: 'm-lineal', nombre: 'Lineal · café en grano y merchandising', x: libre === 'D' ? round(W - 0.45) : 0, y: 0.8, w: 0.45, d: 2.4, alto: 1.8 };
      anadirMueble(plan, L, { despejar: 0.6 });
    }
    const pared = L.x < W / 2 ? 'I' : 'D', ancho = Math.max(...miembros.map(p => p.s + p._w / 2));
    // La cabecera del lineal que da a la sala (la más cercana a la mitad del local).
    const y = Math.abs(L.y - Fo / 2) <= Math.abs(L.y + L.d - Fo / 2) ? L.y + 0.05 + ancho / 2 : L.y + L.d - 0.05 - ancho / 2;
    return { pared, centro: sEn(W, Fo, pared, 0, y), zs: [criteria(plan).alturaMinima], recortable: true, extra: { montaje: 'cabecera-lineal', separacion: 0.05 } };
  }
  // Cubo: peana junto al lateral libre, a media sala; en el alzado, sus 4 caras desplegadas.
  const cara = f.ancho / fis.caras, lado = round(cara * fis.pasoPixelMm / 1000, 3), inward = libre === 'D' ? [-1, 0] : [1, 0];
  const yc = round(xt ? Fo * 0.55 : Fo * 0.5, 2), dist = 0.35, xc = libre === 'D' ? round(W - dist - lado / 2, 3) : round(dist + lado / 2, 3);
  anadirMueble(plan, { id: 'm-peana', nombre: 'Peana · cubo LED', x: round(xc - lado / 2, 3), y: round(yc - lado / 2, 3), w: lado, d: lado, alto: fis.peana }, { despejar: 0.4 });
  const nCara = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const cubo = { centro: [xc, yc], lado, alto: round(miembros[0]._h, 3), peana: fis.peana, caras: nCara.map((n, i) => ({ cara: i + 1, n, recorte: { x: i * cara, y: 0, w: cara, h: f.alto } })) };
  // En el plano 2D, la cara que da a la sala (su normal es la de la pared hacia dentro), a lado + 0,35 m de la pared.
  const frente = cubo.caras.find(c => c.n[0] === inward[0] && c.n[1] === inward[1]);
  return { pared: libre, centro: sEn(W, Fo, libre, xc, yc), zs: [fis.peana], extra: { recorte: { ...frente.recorte }, resolucion: [frente.recorte.w, frente.recorte.h], forma: fis.forma, cubo, montaje: 'peana', separacion: round(dist + lado, 3) } };
}

// ── El espacio de un formato ────────────────────────────────────────────────
// espacioDeFormato('cliente-15', 'xtanco') → plano admira.xpacio-plano/1 del Xtanco con el VIDEOWALL 4X1 H. Siempre el
// mismo (semilla fija), con validate() vacío.
export function espacioDeFormato(formatoId, tipoPedido = 'xtanco') {
  const f = exigir(formatoId), tipo = tipoEspacio(tipoPedido), t = TIPOS_ESPACIO[tipo];
  const id = idEspacio(f, tipo), nombre = nombreEspacio(f, tipo), zona = zonaDe(f), { cols, rows } = gridDe(f), fis = FISICO[f.id];
  // La diagonal preferida y, si no cabe en esta sala, la de reserva (siNoCabe).
  let colocado = null, base;
  for (const pulgadas of [fis.pulgadas, fis.siNoCabe].filter((v, i) => i === 0 || v)) {
    base = generarXpacio({ tipo: t.tipoArquitecto, semilla: t.semilla, id, nombre });
    base.pantallas = [];
    const miembros = pantallasDeFormato(f, { pulgadas });
    try { colocado = situar(base, miembros, colocar(base, f, tipo, miembros)); break; } catch (e) { if (!fis.siNoCabe || pulgadas === fis.siNoCabe) throw e; }
  }
  const { pantallas, mobiliario } = colocado;
  pantallas.forEach(s => { s.fuente = 'Espacio tipo Altadis · pantalla física supuesta, por confirmar'; });
  const W = base.planta.ancho, Fo = base.planta.fondo, H = base.planta.alto, area = round(W * Fo, 1), p0 = pantallas[0], paso = String(fis.pasoPixelMm).replace('.', ',');
  const fisica = fis.forma ? `cubo LED de ${fis.caras} caras de ${p0.recorte.w}×${p0.recorte.h} px (${metros(p0.dimensiones.ancho, 3)} × ${metros(p0.dimensiones.alto, 3)} m cada una, paso ${paso} mm) sobre peana de ${metros(fis.peana)} m`
    : fis.tecnologia === 'led' ? `LED de ${metros(p0.dimensiones.ancho, 3)} × ${metros(p0.dimensiones.alto, 3)} m (paso ${paso} mm)` : `LCD de ${String(p0.pulgadas).replace('.', ',')}″ ${p0.orientacion}`;
  const sincro = (SINCRO[f.id] || []).map(id => `${id} (${exigir(id).nombre})`);
  const plan = {
    schema: base.schema, id, version: SELLO, nombre, publico: true,
    espacio: { serie: SERIE, tipo, n: f.n },
    formato: { id: f.id, nombre: f.nombre, ancho: f.ancho, alto: f.alto, grid: { cols, rows }, fps: f.fps, uso: { es: f.uso.es, en: f.uso.en }, zona },
    fuente: {
      titulo: `Espacio tipo Altadis 18 · plano tipo inventado, no es un levantamiento · ${t.es} · ${f.nombre}`,
      medidas: `${t.es} de ${metros(W)} × ${metros(Fo)} m (${String(area).replace('.', ',')} m²) y ${metros(H)} m de alto: las medidas medias del tipo ${t.tipoArquitecto} del generador de Xpacios (semilla ${t.semilla})`,
      pantallas: `${pantallas.length} × ${fisica} del formato ${f.id} (${f.nombre}, ${f.ancho}×${f.alto}), en la zona ${zona}: tamaños físicos supuestos, por confirmar con Altadis`,
      formato: `${FUENTE.perfil} · ${f.id} · «${FUENTE.pdf}» (sha256 ${FUENTE.sha256})`,
      requisitos: REQUISITOS.es,
      ...(sincro.length ? { sincro: `Se emite sincronizado con ${sincro.join(' o ')}, con la misma duración (SINCRO VW y SINCRO LOGO, regla del PDF)` } : {}),
      itil: 'Sin inventario: pantallas en estado «propuesta» e itil null; el maestro del ITIL es Yokup'
    },
    planta: base.planta, paredes: base.paredes, huecos: base.huecos, mobiliario, pantallas,
    generador: base.generador
  };
  const avisos = avisosEspacio(plan);
  if (avisos.length) { const { itil, ...resto } = plan.fuente; plan.fuente = { ...resto, avisos: avisos.map(a => a.es), itil }; }
  return plan;
}

// ── Resumen para la ficha ───────────────────────────────────────────────────
// Medidas sin redondear (la página redondea una sola vez al pintarlas): el conjunto son las pantallas pegadas.
export function resumenEspacio(plan) {
  const f = exigir(plan.formato.id), ps = plan.pantallas, fs = ps.map(footprint), p0 = ps[0];
  const g = panelSize(p0), { cols, rows } = p0.forma ? { cols: 1, rows: 1 } : plan.formato.grid;
  return {
    id: plan.id, tipo: plan.espacio.tipo, formato: f.id, n: f.n, nombre: f.nombre, ancho: f.ancho, alto: f.alto, grid: plan.formato.grid, fps: f.fps,
    uso: f.uso, zona: plan.formato.zona, pantallas: ps.length, tecnologia: p0.tecnologia, orientacion: p0.orientacion, pulgadas: p0.pulgadas,
    pasoPixelMm: p0.pasoPixelMm || null, forma: p0.forma || null, caras: p0.cubo ? p0.cubo.caras.length : null, peana: p0.cubo ? p0.cubo.peana : null,
    celda: [p0.recorte.w, p0.recorte.h], panel: { w: g.w, h: g.h }, conjunto: { w: cols * g.w, h: rows * g.h },
    pared: p0.pared, base: Math.min(...fs.map(x => x.z0)), montaje: p0.montaje,
    sala: { ancho: plan.planta.ancho, fondo: plan.planta.fondo, alto: plan.planta.alto },
    sincro: SINCRO[f.id] ? [...SINCRO[f.id]] : [], avisos: avisosEspacio(plan)
  };
}

// ── Índice compartido (contrato admira.espacios-formato/1) y ficheros ───────
export function indiceAltadis({ version = SELLO } = {}) {
  return {
    schema: INDICE_SCHEMA, version, cliente: 'Altadis',
    fuente: { perfil: FUENTE.perfil, sha256: FUENTE.sha256, pdf: FUENTE.pdf },
    tipos: Object.fromEntries(Object.entries(TIPOS_ESPACIO).map(([k, t]) => [k, { es: t.es, en: t.en, tipoArquitecto: t.tipoArquitecto }])),
    formatos: FORMATOS_ALTADIS.map(f => {
      const grid = gridDe(f);
      return { formato: f.id, n: f.n, nombre: f.nombre, ancho: f.ancho, alto: f.alto, grid, pantallas: grid.cols * grid.rows, uso: { es: f.uso.es, en: f.uso.en }, zona: zonaDe(f),
        espacios: { xtanco: idEspacio(f, 'xtanco'), cafe: idEspacio(f, 'cafe') } };
    })
  };
}
export const RUTA_INDICE = `data/xpacios/${SERIE}.json`;
export const rutaEspacio = id => `data/xpacios/${id}.json`;
const json = o => JSON.stringify(o, null, 2) + '\n';
// Los 37 ficheros: 18 Xtancos, 18 Starbucks y el índice. Mismo resultado en cada llamada.
export function ficherosAltadis() {
  const out = [];
  for (const tipo of Object.keys(TIPOS_ESPACIO)) for (const f of FORMATOS_ALTADIS) { const plan = espacioDeFormato(f.id, tipo); out.push({ ruta: rutaEspacio(plan.id), texto: json(plan) }); }
  out.push({ ruta: RUTA_INDICE, texto: json(indiceAltadis()) });
  return out;
}

// ── Enlaces y parámetros ────────────────────────────────────────────────────
export const urlGemelo = id => `${URL_GEMELO}?espacio=${encodeURIComponent(id)}`;
export const urlStudio = formato => `${URL_STUDIO}?formato=${encodeURIComponent(exigir(formato).id)}`;
export const urlArquitecto = (formato, tipo) => `arquitecto.html?formato=${encodeURIComponent(exigir(formato).id)}&tipo=${tipoEspacio(tipo)}`;

const norm = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export function tipoEspacioDe(texto) {
  const t = norm(texto);
  if (/\b(xtanco|estanco|tobacconist|tabaco)\b/.test(t)) return 'xtanco';
  if (/\b(starbucks|cafe|cafeteria|coffee ?shop|coffee)\b/.test(t)) return 'cafe';
  return '';
}
// «formatos 15 starbucks», «cliente-08 xtanco», «videowall 4x1 h en un starbucks», «cubo» → {formato, tipo}. Si se
// nombra un formato que no es de los 18 («99», «pantalla gigante»), `desconocido: true`.
const RELLENO = /\b(xtanco|estanco|tobacconist|tabaco|starbucks|cafe|cafeteria|coffee ?shop|coffee|formatos?|formats?|altadis|en|un|una|el|la|los|las|de|del|in|a|an|the|for|para)\b/g;
export function leerEspacio(texto) {
  const t = norm(texto).replace(/[–—]/g, '-');
  const tipo = tipoEspacioDe(t);
  let formato = '', desconocido = false;
  const id = /\bcliente[\s-]*(\d{1,3})\b/.exec(t) || /(?:^|\s)(\d{1,3})(?=\s|$)/.exec(t);
  if (id && +id[1] >= 1 && +id[1] <= 18) formato = `cliente-${dos(+id[1])}`;
  else if (id) desconocido = true;
  if (!formato && !desconocido) {
    // Por nombre: el más largo que aparezca entero («sincro vw 4x1 h» antes que «sincro vw»).
    const porNombre = FORMATOS_ALTADIS.filter(f => t.includes(norm(f.nombre))).sort((a, b) => b.nombre.length - a.nombre.length)[0];
    const palabra = [[/\b(cubo|cube)\b/, 'cliente-08'], [/\bgondola\b/, 'cliente-10'], [/\btablet\b/, 'cliente-07'], [/\bgranada\b/, 'cliente-09'], [/\b(stretch|shuttle)\b/, 'cliente-18'], [/\blogo\b/, 'cliente-04'], [/\btotem\b/, 'cliente-01']].find(([re]) => re.test(t));
    formato = porNombre ? porNombre.id : palabra ? palabra[1] : '';
    desconocido = !formato && !!t.replace(RELLENO, ' ').replace(/[^a-z0-9]+/g, '');
  }
  return { formato, tipo, ...(desconocido ? { desconocido } : {}) };
}
// ?formato=cliente-NN&tipo=xtanco|cafe · ?espacio=altadis-cafe-NN · ?arg=formatos-15-cafe (cargador común) → {formato, tipo} o null.
export function parametrosEspacio(search = '') {
  const q = new URLSearchParams(search);
  const e = ESPACIO_RE.exec(q.get('espacio') || '');
  if (e) return { formato: `cliente-${e[2]}`, tipo: e[1] };
  const formato = FORMATO_RE.test(q.get('formato') || '') ? q.get('formato') : '';
  const tipo = Object.hasOwn(TIPOS_ESPACIO, q.get('tipo') || '') ? q.get('tipo') : tipoEspacioDe(q.get('tipo') || '');
  if (formato) return { formato, tipo: tipo || 'xtanco' };
  const arg = /^[a-z0-9-]{1,60}$/.test(q.get('arg') || '') ? q.get('arg').replace(/-/g, ' ') : '';
  const m = /^(formatos?|formats?|altadis)\b\s*(.*)$/.exec(arg);
  if (!m) return null;
  // Un formato que no es de los 18 abre el primero, pero lo dice (`desconocido`).
  const r = leerEspacio(m[2]);
  return { formato: r.formato || FORMATOS_ALTADIS[0].id, tipo: r.tipo || 'xtanco', ...(r.desconocido ? { desconocido: true } : {}) };
}
