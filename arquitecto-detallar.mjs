// Arquitecto · orden «detallar» (Carlos, 18-oct-2026: «automatizarlo dentro del contexto del arquitecto»). Sin DOM: lo
// usan arquitecto-detallar-ui.mjs y los tests.
//
// Fase 2 del Arquitecto automático: de las fotos de una visita a una receta del Taller 3D de xpaceos
// (admira-xp/tools/taller-3d, esquema xpaceos.taller-3d.receta/1). Quien detalla marca las 4 esquinas de cada cara
// plana (un cartel, la cara de una bolsa, el logo de un vaso) y el navegador la endereza. Las fotos NO salen del
// navegador: la receta sólo lleva los recortes de objetos, dentro (`fuentes_embebidas`), para que no viajen personas.
// El taller las convierte en texturas y modelos Good, Better, Best; la fase 3 (cierre automático) vendrá después.
//
// Dónde va (Carlos, 18-oct-2026, mejora 2): cada pieza se coloca en el plano del local (admira.xpacio-plano/1). Sus
// metros son las unidades de la rejilla del gemelo (col = x, row = y), con el origen en la esquina de la huella, así
// que la fase 3 puede ponerla en el gemelo tal cual. La receta lleva también los datos del alta ITIL en Yokup.

export const RECETA_SCHEMA = 'xpaceos.taller-3d.receta/1';
export const MAX_LADO_RECORTE = 1024;
export const MAX_RECORTES = 24;
export const MAX_PIEZAS = 8;
export const REGISTRO_URL = 'https://www.xpaceos.com/inventario/registry.json';
export const HUELLA = 0.64;
export const GRUPO_ITIL = 'Zona de clientes';
// Inventarios públicos de xpaceos con los códigos ITIL ya dados de alta, por local. Sin inventario, código por asignar.
export const INVENTARIOS = Object.freeze({
  'alsea-sbux-021': 'https://www.xpaceos.com/inventario/starbucks/manifest.json',
  'cafebreria-xpacio-001': 'https://www.xpaceos.com/inventario/cafebreria/manifest.json'
});

// Tamaños nominales de las cestas ya hechas (receta cestas-pg103): borde y fondo [alto, radio] en metros.
export const MUEBLES = Object.freeze({
  cesta_baja: Object.freeze({ familia: 'cesta_trenzada', borde: [0.50, 0.30], fondo: [0.24, 0.14], repeticion: 4, itil: 'CES', es: 'Cesta trenzada baja', en: 'Low woven basket' }),
  cesta_alta: Object.freeze({ familia: 'cesta_trenzada', borde: [0.84, 0.30], fondo: [0.58, 0.14], repeticion: 4, itil: 'CES', es: 'Cesta trenzada alta', en: 'Tall woven basket' })
});
// Contenidos que el taller sabe montar desde recortes y qué caras pide cada uno.
export const CONTENIDOS = Object.freeze({
  vasos: Object.freeze({ es: 'Vasos reutilizables', en: 'Reusable cups', roles: ['logo'], cantidad: 28 }),
  bolsas_de_pie: Object.freeze({ es: 'Bolsas de pie (café…)', en: 'Standing bags (coffee…)', roles: ['frente', 'dorso', 'lado_a', 'lado_b'], cantidad: 11 }),
  bolsas_almohada: Object.freeze({ es: 'Bolsas almohada (snacks…)', en: 'Pillow bags (snacks…)', roles: ['diseno'], cantidad: 26 }),
  ninguno: Object.freeze({ es: 'Sin contenido', en: 'No contents', roles: [], cantidad: 0 })
});
export const ROLES = Object.freeze({
  cartel: { es: 'Cartel', en: 'Sign' }, logo: { es: 'Logo del vaso', en: 'Cup logo' },
  frente: { es: 'Cara frontal', en: 'Front face' }, dorso: { es: 'Trasera', en: 'Back face' },
  lado_a: { es: 'Lateral A', en: 'Side A' }, lado_b: { es: 'Lateral B', en: 'Side B' }, diseno: { es: 'Diseño de bolsa', en: 'Bag design' }
});
const FILAS_CAFE = [[0.045, 0.035, [-0.18, -0.06, 0.06, 0.18]], [-0.045, 0.018, [-0.18, -0.06, 0.06, 0.18]], [-0.135, 0, [-0.12, 0, 0.12]]];

const norm = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const slug = (t, max = 48) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'detalle';
const camel = t => slug(t).split('-').map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join('');
const limpio = (v, max = 160) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ── Enderezar: 4 esquinas (arriba-izq, arriba-dcha, abajo-dcha, abajo-izq) → rectángulo ────────────────────
// Matriz 3x3 que lleva (u, v) del recorte a (x, y) de la foto. Resuelve el sistema 8x8 por Gauss (h33 = 1).
export function homografia(destino, origen) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = destino[i], [x, y] = origen[i];
    A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -y * u, -y * v]); b.push(y);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('esquinas-degeneradas');
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
export function aplicar(H, u, v) {
  const w = H[6] * u + H[7] * v + H[8];
  return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w];
}
// Tamaño del recorte: la media de cada par de lados, con el lado mayor limitado a MAX_LADO_RECORTE.
export function tamRecorte(esquinas, max = MAX_LADO_RECORTE) {
  validarEsquinas(esquinas);
  const [tl, tr, br, bl] = esquinas, w = (dist(tl, tr) + dist(bl, br)) / 2, h = (dist(tl, bl) + dist(tr, br)) / 2;
  const k = Math.min(1, max / Math.max(w, h));
  return [Math.max(8, Math.round(w * k)), Math.max(8, Math.round(h * k))];
}
// Las 4 esquinas en cualquier orden → arriba-izq, arriba-dcha, abajo-dcha, abajo-izq (en la foto, y crece hacia abajo).
export function ordenarEsquinas(puntos) {
  if (!Array.isArray(puntos) || puntos.length !== 4) throw new Error('esquinas');
  const cx = puntos.reduce((s, p) => s + p[0], 0) / 4, cy = puntos.reduce((s, p) => s + p[1], 0) / 4;
  const giro = [...puntos].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  const k = giro.reduce((m, p, i) => (p[0] + p[1] < giro[m][0] + giro[m][1] ? i : m), 0);
  return [0, 1, 2, 3].map(i => giro[(k + i) % 4].slice());
}
export function validarEsquinas(esquinas) {
  if (!Array.isArray(esquinas) || esquinas.length !== 4 || !esquinas.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) throw new Error('esquinas');
  // El cuadrilátero tiene que ser convexo y no estar cruzado: los 4 productos cruzados con el mismo signo.
  const s = esquinas.map((p, i) => { const q = esquinas[(i + 1) % 4], r = esquinas[(i + 2) % 4]; return Math.sign((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0])); });
  if (!(s.every(x => x > 0) || s.every(x => x < 0))) throw new Error('esquinas-cruzadas');
  return true;
}
// imagen {width, height, data RGBA} → {width, height, data} enderezado con interpolación bilineal.
export function enderezar(imagen, esquinas, tam = tamRecorte(esquinas)) {
  validarEsquinas(esquinas);
  const [w, h] = tam, H = homografia([[0, 0], [w, 0], [w, h], [0, h]], esquinas), out = new Uint8ClampedArray(w * h * 4);
  const W = imagen.width, Hh = imagen.height, src = imagen.data;
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    let [x, y] = aplicar(H, u + 0.5, v + 0.5); x = Math.min(Math.max(x - 0.5, 0), W - 1.001); y = Math.min(Math.max(y - 0.5, 0), Hh - 1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, o = (v * w + u) * 4;
    const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
    for (let c = 0; c < 4; c++) out[o + c] = src[i00 + c] * (1 - fx) * (1 - fy) + src[i10 + c] * fx * (1 - fy) + src[i01 + c] * (1 - fx) * fy + src[i11 + c] * fx * fy;
  }
  return { width: w, height: h, data: out };
}

// ── Números de catálogo: los siguientes libres del registro público de xpaceos ─────────────────────────────
export function siguientesNumeros(registro, n) {
  const usados = new Set(Object.values((registro && registro.numbers) || {}).filter(Number.isSafeInteger));
  const out = []; for (let k = Math.max(0, ...usados) + 1; out.length < n; k++) if (!usados.has(k)) out.push(k);
  return out;
}

// ── Dónde va: sitio en el plano del local ───────────────────────────────────────────────────────────────────
// plano admira.xpacio-plano/1: planta {ancho, fondo} en metros, x a lo ancho, y hacia el fondo; mobiliario [{nombre, x, y, w, d}].
const r2 = v => Math.round(v * 100) / 100;
const entre = (v, a, b) => Math.min(Math.max(v, a), b);
const planoValido = pl => !!(pl && pl.planta && pl.planta.ancho > 0 && pl.planta.fondo > 0);
// Punto tocado en el plano → esquina de la huella, centrada en el punto y dentro de la sala.
export function sitioEnPlano(plano, [px, py], huella = HUELLA) {
  if (!planoValido(plano) || ![px, py].every(Number.isFinite)) throw new Error('plano');
  const { ancho, fondo } = plano.planta;
  return { x: r2(entre(px - huella / 2, 0, ancho - huella)), y: r2(entre(py - huella / 2, 0, fondo - huella)) };
}
const cajaDe = (s, huella = HUELLA) => ({ x: s.x, y: s.y, w: huella, d: huella });
const separacion = (a, b) => Math.hypot(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.d), a.y - (b.y + b.d), 0));
// El mueble del plano más cercano a la pieza, a 1,5 m como mucho, para decir «junto a Pilar». A igual distancia entre
// bordes gana el de centro más cercano (la cesta junto al pilar y la caja a la vez es «junto a Pilar»).
export function juntoA(plano, sitio, huella = HUELLA) {
  const a = cajaDe(sitio, huella), centro = b => [b.x + b.w / 2, b.y + b.d / 2];
  let mejor = null, clave = [1.5 + 1e-9, Infinity];
  for (const m of (plano && plano.mobiliario) || []) {
    if (![m.x, m.y, m.w, m.d].every(Number.isFinite)) continue;
    const k = [r2(separacion(a, m)), dist(centro(a), centro(m))];
    if (k[0] < clave[0] || (k[0] === clave[0] && k[1] < clave[1])) { clave = k; mejor = m; }
  }
  return mejor ? limpio(mejor.nombre, 60) : null;
}
// Fuera de la sala (error) y solapes con muebles del plano o con otras piezas (aviso: el plano es esquemático).
export function revisarSitios(plano, piezas, huella = HUELLA) {
  const fuera = [], solapes = [];
  if (!planoValido(plano)) return { fuera, solapes };
  const { ancho, fondo } = plano.planta, dentro = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;
  piezas.forEach((p, i) => {
    const s = p && p.sitio; if (!s) return;
    if (!(s.x >= 0 && s.y >= 0 && s.x + huella <= ancho + 1e-6 && s.y + huella <= fondo + 1e-6)) { fuera.push(i); return; }
    for (const m of plano.mobiliario || []) if (dentro(cajaDe(s, huella), m)) solapes.push({ pieza: i, con: limpio(m.nombre, 60) });
    piezas.forEach((q, j) => { if (j > i && q && q.sitio && dentro(cajaDe(s, huella), cajaDe(q.sitio, huella))) solapes.push({ pieza: i, con: limpio(q.nombre, 60) || `#${j + 1}`, otra: j }); });
  });
  return { fuera, solapes };
}

// ── Alta ITIL: los siguientes códigos libres de la familia en el inventario público del local ──────────────
// PDG103-CES-01…03 → PDG103-CES-04. El prefijo es el del local (el más repetido en sus códigos).
export const CODIGO_ITIL_RE = /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,6}){1,3}$/;
export function siguientesCodigos(inventario, familia, n, usados = []) {
  const codigos = (((inventario && inventario.units) || []).map(u => u && u.itil_code)).filter(c => typeof c === 'string' && CODIGO_ITIL_RE.test(c));
  const veces = {}; for (const c of codigos) { const k = c.split('-')[0]; veces[k] = (veces[k] || 0) + 1; }
  const prefijo = Object.keys(veces).sort((a, b) => veces[b] - veces[a])[0];
  if (!prefijo || !/^[A-Z0-9]{2,6}$/.test(familia || '')) return Array.from({ length: n }, () => null);
  const ocupados = new Set([...codigos, ...usados]), re = new RegExp(`^${prefijo}-${familia}-(\\d+)$`);
  let k = Math.max(0, ...codigos.map(c => { const m = c.match(re); return m ? +m[1] : 0; }));
  const out = [];
  while (out.length < n) { k++; const c = `${prefijo}-${familia}-${String(k).padStart(2, '0')}`; if (!ocupados.has(c)) out.push(c); }
  return out;
}
const rolItil = (numero, contenido) => limpio(`Taller 3D · catálogo ${Number.isSafeInteger(numero) ? numero : 'por asignar'} · ${contenido === 'ninguno' || !CONTENIDOS[contenido] ? 'sin contenido' : CONTENIDOS[contenido].es.replace(/ \(.*\)$/, '').toLowerCase() + ' de relleno visual, sin stock medido'}`, 120);

// ── Revisión del encargo antes de hacer la receta ──────────────────────────────────────────────────────────
// encargo {nombre, local, autor, lugar, fecha, plano (admira.xpacio-plano/1 o null),
//          piezas:[{nombre, nombre_en, numero, mueble, contenido, cantidad, cartel:{ancho, alto, poste}, sitio:{x, y}, itil}],
//          recortes:[{nombre, pieza, rol, png (dataURL), esquinas, foto}]}
export function revisarEncargo(e) {
  const errores = [], avisos = [];
  if (!limpio(e && e.local)) errores.push('local');
  const piezas = (e && e.piezas) || [], recortes = (e && e.recortes) || [];
  if (!piezas.length) errores.push('sin-piezas');
  if (piezas.length > MAX_PIEZAS) errores.push('demasiadas-piezas');
  if (recortes.length > MAX_RECORTES) errores.push('demasiados-recortes');
  piezas.forEach((p, i) => {
    if (!limpio(p.nombre)) errores.push(`pieza-${i}-nombre`);
    if (!MUEBLES[p.mueble]) errores.push(`pieza-${i}-mueble`);
    if (!CONTENIDOS[p.contenido]) errores.push(`pieza-${i}-contenido`);
    if (!Number.isSafeInteger(p.numero)) avisos.push(`pieza-${i}-numero`);
    const suyos = recortes.filter(r => r.pieza === i), roles = new Set(suyos.map(r => r.rol));
    const pide = (CONTENIDOS[p.contenido] || { roles: [] }).roles;
    if (p.contenido === 'vasos' && !roles.has('logo')) errores.push(`pieza-${i}-falta-logo`);
    if (p.contenido === 'bolsas_de_pie' && !roles.has('frente')) errores.push(`pieza-${i}-falta-frente`);
    if (p.contenido === 'bolsas_almohada' && !roles.has('diseno')) errores.push(`pieza-${i}-falta-diseno`);
    if (p.cartel && !roles.has('cartel')) errores.push(`pieza-${i}-falta-cartel`);
    for (const r of suyos) if (r.rol !== 'cartel' && !pide.includes(r.rol)) avisos.push(`pieza-${i}-rol-${r.rol}-sin-uso`);
  });
  for (const r of recortes) if (!/^data:image\/png;base64,/.test(r.png || '')) errores.push(`recorte-${r.nombre}-png`);
  // Dónde va: con plano, cada pieza necesita su sitio dentro de la sala; sin plano, se avisa y la receta sale sin sitio.
  const plano = e && e.plano;
  if (!planoValido(plano)) { if (piezas.length) avisos.push('sin-plano'); }
  else {
    piezas.forEach((p, i) => { if (!p.sitio) errores.push(`pieza-${i}-falta-sitio`); });
    const { fuera, solapes } = revisarSitios(plano, piezas);
    for (const i of fuera) errores.push(`pieza-${i}-fuera`);
    for (const i of new Set(solapes.map(s => s.pieza))) avisos.push(`pieza-${i}-solapa`);
  }
  const codigos = piezas.map(p => p && p.itil).filter(Boolean);
  piezas.forEach((p, i) => {
    if (!p.itil) avisos.push(`pieza-${i}-itil`);
    else if (!CODIGO_ITIL_RE.test(p.itil)) errores.push(`pieza-${i}-itil-formato`);
    else if (codigos.indexOf(p.itil) !== codigos.lastIndexOf(p.itil)) errores.push(`pieza-${i}-itil-repetido`);
  });
  return { ok: !errores.length, errores, avisos };
}

// ── Receta del Taller 3D ───────────────────────────────────────────────────────────────────────────────────
export function recetaDetallar(e) {
  const rev = revisarEncargo(e); if (!rev.ok) throw new Error('encargo: ' + rev.errores.join(', '));
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(e.fecha || '') ? e.fecha : new Date().toISOString().slice(0, 10);
  const encargo = slug(`${e.nombre || 'detalle'}-${e.local}`) + '-' + fecha;
  const fuente = (r, i) => `${slug(r.rol)}-${i + 1}-${slug(r.nombre, 24)}.png`;
  const recortes = e.recortes.map((r, i) => ({ ...r, fichero: fuente(r, i) }));
  const texturas = [
    { op: 'tejido', periodos: 12, filas: 13, tupido_hasta: 0.38, calado_desde: 0.45, liston: 0.28, cordones: [0.74] },
    { op: 'cuerda', vueltas: 160 }, { op: 'acero', rugosidad: 0.38, metal: 0.55, salida: 'acero-orm.png' }
  ];
  const salida = r => r.fichero.replace(/\.png$/, '.jpg');
  for (const r of recortes) {
    if (r.rol === 'cartel') { const [w, h] = r.tam || [512, 1024]; texturas.push({ op: 'cartel_foto', fuente: r.fichero, fraccion_visible: 1, tam: [512, Math.max(64, Math.round(512 * h / w))], salida: salida(r) }); }
    else if (r.rol === 'logo') {
      texturas.push({ op: 'vaso', fuente: r.fichero, salida: salida(r).replace('.jpg', '-caliente.jpg'), cuerpo: [236, 236, 230], tinta: [0, 98, 65] });
      texturas.push({ op: 'vaso', fuente: r.fichero, salida: salida(r).replace('.jpg', '-frio.jpg'), cuerpo: [225, 228, 226], tinta: [0, 98, 65], escala: true });
    } else if (r.rol === 'diseno') texturas.push({ op: 'bolsa_foto', fuente: r.fichero, salida: salida(r) });
    else texturas.push({ op: 'foto', fuente: r.fichero, salida: salida(r) });
  }
  const piezas = e.piezas.map((p, i) => {
    const m = MUEBLES[p.mueble], suyos = recortes.filter(r => r.pieza === i), de = rol => suyos.find(r => r.rol === rol);
    const nombre = limpio(p.nombre), cantidad = Number.isSafeInteger(p.cantidad) && p.cantidad > 0 ? Math.min(p.cantidad, 60) : CONTENIDOS[p.contenido].cantidad;
    const pieza = {
      numero: Number.isSafeInteger(p.numero) ? p.numero : null, id: 'native:' + camel('starbucks ' + (p.id || nombre)).replace(/^starbucksStarbucks/, 'starbucks'),
      nombre, nombre_en: limpio(p.nombre_en) || nombre, referencia: null, instancia: 'sb-' + slug(nombre, 32), origen: 'esquina', huella: 0.64,
      mueble: { familia: m.familia, borde: [...m.borde], fondo: [...m.fondo], repeticion: m.repeticion }, carteles: []
    };
    const c = de('cartel');
    if (p.cartel && c) {
      const ancho = Math.min(Math.max(Number(p.cartel.ancho) || 0.3, 0.05), 0.6), alto = Math.min(Math.max(Number(p.cartel.alto) || 0.8, 0.1), 1.4);
      const base = { nombre: `${nombre} sign board`, material: `${nombre} sign · photo print`, textura: salida(c), rugosidad: 0.55, material_canto: 'Sign board edge', canto: [0.92, 0.92, 0.9], rugosidad_canto: 0.6, ancho, alto, fuente_textura: 'photos_arquitecto' };
      pieza.carteles.push(p.cartel.poste
        ? { ...base, grueso: 0.006, pos: [0, 0.115], z: m.borde[0] + 0.16, poste: { x: 0, y: 0.12, alto: m.borde[0] + 0.16 + alto * 0.55 } }
        : { ...base, pos: [0, 0.10], sobre_fondo: 0.12, inclinacion: 5 });
    }
    if (p.contenido === 'vasos') {
      const l = salida(de('logo'));
      pieza.contenido = { familia: 'vasos', cantidad, tanda: 4, semilla: 100 + i, fuente_textura: 'photos_arquitecto',
        materiales: { caliente: ['Reusable hot cup · photo print', l.replace('.jpg', '-caliente.jpg')], frio: ['Reusable cold cup · frosted PP, photo print', l.replace('.jpg', '-frio.jpg')] } };
    } else if (p.contenido === 'bolsas_de_pie') {
      const f = salida(de('frente')), cara = rol => (de(rol) ? salida(de(rol)) : f);
      pieza.contenido = { familia: 'bolsas_de_pie', semilla: 200 + i, bajo_borde: 0.075, medidas: [0.115, 0.065, 0.215], color_liso: [0.07, 0.42, 0.33], fuente_textura: 'photos_arquitecto',
        caras: { frente: f, dorso: cara('dorso'), lado_a: cara('lado_a'), lado_b: cara('lado_b') }, nombre_producto: `${nombre} · bag`, producto: limpio(p.producto) || nombre,
        filas: FILAS_CAFE.map(([y, l, xs]) => [y, l, [...xs]]).slice(0, Math.max(1, Math.ceil(cantidad / 4))) };
    } else if (p.contenido === 'bolsas_almohada') {
      pieza.contenido = { familia: 'bolsas_almohada', cantidad, semilla: 300 + i, disenos: suyos.filter(r => r.rol === 'diseno').slice(0, 3).map(salida) };
    } else pieza.contenido = null;
    const plano = planoValido(e.plano) ? e.plano : null;
    pieza.colocacion = plano && p.sitio ? { xpacio: limpio(plano.id || e.local, 80), plano: limpio(plano.version, 60) || null, x: r2(p.sitio.x), y: r2(p.sitio.y),
      huella: [HUELLA, HUELLA], junto_a: juntoA(plano, p.sitio) } : null;
    pieza.itil = { admira_store_id: limpio(e.local, 80), itil_code: p.itil && CODIGO_ITIL_RE.test(p.itil) ? p.itil : null, name: nombre, category: 'mobiliario',
      role: rolItil(pieza.numero, p.contenido), group_name: GRUPO_ITIL, position: pieza.instancia };
    return pieza;
  });
  return {
    schema: RECETA_SCHEMA, encargo,
    descripcion: limpio(e.descripcion, 400) || `Detallado en el Arquitecto (admira.biz) para ${e.local}: ${piezas.map(p => p.nombre).join(', ')}.`,
    local: limpio(e.local, 80), origen: 'admira.biz/arquitecto · detallar',
    plano: planoValido(e.plano) ? { id: limpio(e.plano.id || e.local, 80), version: limpio(e.plano.version, 60) || null } : null,
    fotos: { autor: limpio(e.autor) || 'Arquitecto', lugar: limpio(e.lugar) || limpio(e.local), fecha, publicables: false,
      nota: 'Las fotos no salen del navegador; la receta sólo lleva recortes de objetos enderezados en el Arquitecto.' },
    fuentes: encargo, texturas_dir: `inventario/assets/catalog/${encargo}/textures`, texturas, piezas,
    fuentes_embebidas: Object.fromEntries(recortes.map(r => [r.fichero, r.png])),
    recortes: recortes.map(r => ({ fichero: r.fichero, rol: r.rol, pieza: r.pieza, foto: r.foto ?? null, esquinas: r.esquinas }))
  };
}
