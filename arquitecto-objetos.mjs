// Arquitecto · objetos separados de una nube densa (Carlos, 19-oct-2026: «que lo pase a 3D con todos los objetos
// separados en el ITIL»). Sin DOM: lo usan arquitecto-video-ui.mjs y los tests.
//
// Con la sala levantada (arquitecto-video.mjs: vertical, suelo, paredes), aquí:
//   1. aSala: todos los puntos de la nube en coordenadas de sala (x, y desde la esquina F–C y altura desde el suelo).
//   2. objetosDetectados: la nube en vóxeles de 5 cm; por columna, lo que arranca del suelo es «cuerpo» (muebles), lo que
//      queda por encima con un hueco es «encima» (lo que hay sobre los muebles) y lo que no toca el suelo es «flotante»
//      (estantes de pared, pantallas, lámparas). Los cuerpos se separan por la altura de su tapa (barra a 0,95 m y
//      vitrina a 1,30 m son dos piezas aunque se toquen); lo de encima y lo flotante, por contacto en 3D.
//   3. clasificar: un tipo del plano (barra, caja, vitrina, estantería, pilar, mesa, silla, cesta, mueble) por medidas.
//   4. cruzarConInventario: cada objeto con su código ITIL: el ya dado de alta en Yokup si hay uno de su familia libre
//      (inventario público de xpaceos), o el siguiente libre (<PREFIJO>-<FAMILIA>-NN) como propuesta.
//   5. cisDeObjetos: las altas propuestas con los campos de itil_ci_upsert, con `parent_itil_code` para lo que está encima.
// Medidas en metros, redondeadas al centímetro. Nada se escribe en Yokup desde aquí: el alta la confirma la persona.

import { prefijoDe } from './arquitecto-core.mjs?v=20261019-splat-1';

export const CELDA = 0.05;
export const MAX_OBJETOS = 80;
export const CLASES = Object.freeze(['cuerpo', 'encima', 'flotante']);
// Familia ITIL (token del código) y nombre por tipo del plano.
export const FAMILIAS = Object.freeze({ barra: 'BAR', caja: 'MOS', vitrina: 'VIT', estanteria: 'EST', pilar: 'PIL', mesa: 'MES', silla: 'SIL', cesta: 'CES', ipad: 'IPAD', nevera: 'NEV', recreativa: 'REC', lampara: 'LUM', pantalla: 'PAN', mueble: 'OBJ' });
export const NOMBRES = Object.freeze({ barra: 'Barra', caja: 'Mostrador de caja', vitrina: 'Vitrina', estanteria: 'Estantería', pilar: 'Pilar', mesa: 'Mesa', silla: 'Silla', cesta: 'Cesta', ipad: 'iPad', nevera: 'Nevera', recreativa: 'Recreativa', lampara: 'Lámpara', pantalla: 'Pantalla (posible)', mueble: 'Objeto' });
const CATEGORIA = Object.freeze({ lampara: 'iluminacion', pantalla: 'pantalla', ipad: 'pantalla' });
const r2 = v => Math.round(v * 100) / 100;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ── 1. Todos los puntos en coordenadas de sala ──────────────────────────────
// {n, x, y, z, rgb?, alfa?} con el marco de `levantar` → { n, s: Float32Array(3n) [x, y, h] en unidades de la nube, rgb? }.
// `alfaMin` deja fuera las gaussianas translúcidas si la nube trae alfa; `paso` submuestrea (1 = todos).
export function aSala(lev, nube, { alfaMin = 0, paso = 1 } = {}) {
  const m = lev && lev.marco; if (!m) throw new Error('sin-marco');
  const tope = alfaMin * 255, idx = [];
  for (let i = 0; i < nube.n; i += paso) if (!nube.alfa || nube.alfa[i] >= tope) idx.push(i);
  const n = idx.length, s = new Float32Array(n * 3), rgb = nube.rgb ? new Uint8Array(n * 3) : null;
  for (let k = 0; k < n; k++) {
    const i = idx[k], p = [nube.x[i], nube.y[i], nube.z[i]], a = dot(p, m.e1) - m.ca, b = dot(p, m.e2) - m.cb;
    s[k * 3] = a * m.ejeX[0] + b * m.ejeX[1] - m.x0; s[k * 3 + 1] = a * m.ejeY[0] + b * m.ejeY[1] - m.y0; s[k * 3 + 2] = dot(p, m.v) - m.suelo;
    if (rgb) { rgb[k * 3] = nube.rgb[i * 3]; rgb[k * 3 + 1] = nube.rgb[i * 3 + 1]; rgb[k * 3 + 2] = nube.rgb[i * 3 + 2]; }
  }
  return rgb ? { n, s, rgb } : { n, s };
}

// ── 1b. Ampliar la sala hasta donde llegan las cosas bajas ──────────────────
// Las «paredes» del levantamiento pueden ser la cara de la barra o un mueble (en un escaneo desde el lado del cliente, la
// barra es el plano vertical más fuerte). Aquí la sala crece hasta la envolvente (1 %–99 %) de los puntos bajos (de 5 cm
// a 1,2 m) y el origen se mueve, para que lo que queda delante o al lado entre en el plano. Devuelve un `lev` nuevo.
export function ampliarSala(lev, sala, k, { pct = 0.01, hMin = 0.05, hMax = 1.2 } = {}) {
  const S = sala && sala.s ? sala.s : lev.sala, xs = [], ys = [];
  for (let i = 0; i < S.length; i += 3) { const h = S[i + 2] * k; if (h >= hMin && h <= hMax) { xs.push(S[i]); ys.push(S[i + 1]); } }
  if (xs.length < 100) return lev;
  const q = (arr, p) => { const o = Float64Array.from(arr).sort(); return o[Math.min(o.length - 1, Math.max(0, Math.round(p * (o.length - 1))))]; };
  const A = lev.unidades.ancho, F = lev.unidades.fondo, c = 0.05 / k;   // a vóxeles de 5 cm
  // Sólo crece si hay más de 10 cm de cosas fuera por ese lado: los 5 cm de redondeo no cuentan.
  const crece = (v, lim, signo) => signo * (v - lim) > 0.1 / k ? v : lim;
  const x0 = crece(Math.floor(q(xs, pct) / c) * c, 0, -1), x1 = crece(Math.ceil(q(xs, 1 - pct) / c) * c, A, 1), y0 = crece(Math.floor(q(ys, pct) / c) * c, 0, -1), y1 = crece(Math.ceil(q(ys, 1 - pct) / c) * c, F, 1);
  if (x0 === 0 && y0 === 0 && x1 === A && y1 === F) return lev;
  const m = lev.marco;
  return { ...lev, unidades: { ...lev.unidades, ancho: x1 - x0, fondo: y1 - y0 }, marco: { ...m, x0: m.x0 + x0, y0: m.y0 + y0 },
    ampliada: { izquierda: r2(-x0 * k), derecha: r2((x1 - A) * k), fondo: r2(-y0 * k), frente: r2((y1 - F) * k), paredes: { ancho: r2(A * k), fondo: r2(F * k) } } };
}

// ── 2. Objetos por vóxeles ──────────────────────────────────────────────────
// `sala`: {n, s, rgb?} de aSala (o lev.sala, la submuestra de levantar, sin color). `k`: metros por unidad.
// Devuelve { objetos, rejilla: {celda, nx, ny, nz}, etiquetas? } (etiquetas: Int32Array por punto, −1 = ninguno).
export function objetosDetectados(lev, k, sala, { celda = CELDA, bordeSuelo = 0.04, bordeTecho = 0.10, bordePared = 0.06, minPorVoxel = 2, minVoxeles = 10, minAreaCuerpo = 0.04, saltoTapa = 0.15, hueco = 0.30, max = MAX_OBJETOS, etiquetar = false } = {}) {
  const S = sala && sala.s ? sala.s : lev.sala, RGB = sala && sala.s ? sala.rgb : null, N = S.length / 3;
  const A = lev.unidades.ancho * k, F = lev.unidades.fondo * k, H = lev.unidades.alto * k;
  if (!(A > 0 && F > 0 && H > 0)) throw new Error('sin-sala');
  // Celda: 5 cm, o más gruesa si la rejilla se dispara (locales enormes).
  while (Math.ceil(A / celda) * Math.ceil(F / celda) * Math.ceil(H / celda) > 12e6) celda *= 1.5;
  const nx = Math.ceil(A / celda), ny = Math.ceil(F / celda), nz = Math.ceil(H / celda), nxy = nx * ny, V = nxy * nz;
  const cuenta = new Uint16Array(V), col = RGB ? new Float32Array(V * 3) : null;
  const vox = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const x = S[i * 3] * k, y = S[i * 3 + 1] * k, h = S[i * 3 + 2] * k;
    if (!(h >= bordeSuelo && h <= H - bordeTecho && x >= bordePared && x <= A - bordePared && y >= bordePared && y <= F - bordePared)) continue;
    const ix = Math.min(nx - 1, (x / celda) | 0), iy = Math.min(ny - 1, (y / celda) | 0), iz = Math.min(nz - 1, (h / celda) | 0), j = iz * nxy + iy * nx + ix;
    if (cuenta[j] < 65535) cuenta[j]++; vox[i] = j;
    if (col) { col[j * 3] += RGB[i * 3]; col[j * 3 + 1] += RGB[i * 3 + 1]; col[j * 3 + 2] += RGB[i * 3 + 2]; }
  }
  const lleno = j => cuenta[j] >= minPorVoxel;
  // Por columna: el tramo que arranca del suelo (hasta 30 cm) es cuerpo y su tapa es `soporte`. Los huecos de hasta `hueco`
  // (30 cm) no lo cortan: una cara vertical algo inclinada deja huecos en la columna, y lo que está posado en la tapa sube
  // con el cuerpo (lo separa después la tapa: un cuerpo pequeño y más alto pegado a otro mayor y más bajo es algo encima).
  const izSuelo = Math.ceil(0.30 / celda), huecoMax = Math.max(2, Math.round(hueco / celda));
  const soporte = new Float32Array(nxy).fill(-1), claseVox = new Uint8Array(V);   // 0 vacío · 1 cuerpo · 2 encima · 3 flotante
  for (let c = 0; c < nxy; c++) {
    let iz0 = -1; for (let iz = 0; iz <= izSuelo && iz < nz; iz++) if (lleno(iz * nxy + c)) { iz0 = iz; break; }
    let tope = -1;
    if (iz0 >= 0) {
      let hueco = 0; tope = iz0;
      for (let iz = iz0; iz < nz; iz++) { if (lleno(iz * nxy + c)) { tope = iz; hueco = 0; claseVox[iz * nxy + c] = 1; } else if (++hueco > huecoMax) break; }
      soporte[c] = (tope + 1) * celda;
    }
    for (let iz = Math.max(0, tope + 1); iz < nz; iz++) if (lleno(iz * nxy + c)) claseVox[iz * nxy + c] = iz0 >= 0 ? 2 : 3;
  }
  // Cuerpos: componentes 2D de columnas con soporte, uniendo vecinas de tapa parecida (± saltoTapa).
  const etiquetaCol = new Int32Array(nxy).fill(-1), piezas = [];
  for (let c = 0; c < nxy; c++) {
    if (soporte[c] < 0 || etiquetaCol[c] >= 0) continue;
    const id = piezas.length, cola = [c], celdas = []; etiquetaCol[c] = id;
    while (cola.length) {
      const q = cola.pop(); celdas.push(q); const qx = q % nx, qy = (q / nx) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = qx + dx, Y = qy + dy; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
        const r = Y * nx + X; if (soporte[r] < 0 || etiquetaCol[r] >= 0 || Math.abs(soporte[r] - soporte[q]) > saltoTapa) continue;
        etiquetaCol[r] = id; cola.push(r);
      }
    }
    piezas.push({ clase: 'cuerpo', celdas });
  }
  // Encima y flotante: componentes 3D (26 vecinos) de sus vóxeles.
  const etiquetaVox = new Int32Array(V).fill(-1);
  for (const p of piezas) for (const c of p.celdas) for (let iz = 0; iz < nz; iz++) if (claseVox[iz * nxy + c] === 1) etiquetaVox[iz * nxy + c] = piezas.indexOf(p);
  const componentes3d = clase => {
    for (let j = 0; j < V; j++) {
      if (claseVox[j] !== clase || etiquetaVox[j] >= 0) continue;
      const id = piezas.length, cola = [j], voxeles = []; etiquetaVox[j] = id;
      while (cola.length) {
        const q = cola.pop(); voxeles.push(q); const qz = (q / nxy) | 0, qy = ((q % nxy) / nx) | 0, qx = q % nx;
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = qx + dx, Y = qy + dy, Z = qz + dz; if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
          const r = Z * nxy + Y * nx + X; if (claseVox[r] !== clase || etiquetaVox[r] >= 0) continue; etiquetaVox[r] = id; cola.push(r);
        }
      }
      piezas.push({ clase: clase === 2 ? 'encima' : 'flotante', voxeles });
    }
  };
  componentes3d(2); componentes3d(3);
  // Medidas de cada pieza: caja, base, altura, puntos y color.
  const medir = p => {
    let x0 = nx, x1 = -1, y0 = ny, y1 = -1, z0 = nz, z1 = -1, puntos = 0, nv = 0; const c3 = [0, 0, 0];
    const suma = j => { const qz = (j / nxy) | 0, qy = ((j % nxy) / nx) | 0, qx = j % nx; if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy; if (qz < z0) z0 = qz; if (qz > z1) z1 = qz; puntos += cuenta[j]; nv++; if (col) { c3[0] += col[j * 3]; c3[1] += col[j * 3 + 1]; c3[2] += col[j * 3 + 2]; } };
    if (p.clase === 'cuerpo') { for (const c of p.celdas) for (let iz = 0; iz < nz; iz++) { const j = iz * nxy + c; if (claseVox[j] === 1) suma(j); } } else for (const j of p.voxeles) suma(j);
    const tapas = p.clase === 'cuerpo' ? p.celdas.map(c => soporte[c]).sort((a, b) => a - b) : null;
    Object.assign(p, { x: x0 * celda, y: y0 * celda, w: (x1 - x0 + 1) * celda, d: (y1 - y0 + 1) * celda, base: p.clase === 'cuerpo' ? 0 : z0 * celda,
      alto: p.clase === 'cuerpo' ? tapas[tapas.length >> 1] : (z1 - z0 + 1) * celda, puntos, nVoxeles: nv, area: p.clase === 'cuerpo' ? p.celdas.length * celda * celda : (x1 - x0 + 1) * (y1 - y0 + 1) * celda * celda,
      color: col && puntos ? c3.map(v => Math.round(v / puntos)) : null });
    return p;
  };
  piezas.forEach(medir);
  for (const p of piezas) if (p.clase === 'flotante' && p.base <= 0.5 && p.area >= 0.15) { p.clase = 'cuerpo'; p.alto = p.base + p.alto; p.base = 0; p.pies = 'tapados'; p.celdas = []; }
  // Lo flotante que toca un cuerpo es parte de él hasta su tapa (la tapa de una mesa alrededor de su pata, la tapa de la barra
  // cuyo interior no se ve): lo que queda por encima de la tapa (+ 8 cm) es algo posado sobre el mueble y se separa después.
  const vecinoCuerpo = p => { for (const j of p.voxeles) { const qz = (j / nxy) | 0, qy = ((j % nxy) / nx) | 0, qx = j % nx;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = qx + dx, Y = qy + dy, Z = qz + dz; if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue; const e = etiquetaVox[Z * nxy + Y * nx + X]; if (e >= 0 && piezas[e].clase === 'cuerpo') return e; } } return -1; };
  let sueltos = 0;
  const tocan = piezas.map(p => (p.clase === 'flotante' && p.base <= 1.3) ? vecinoCuerpo(p) : -1);
  // La tapa real de cada cuerpo: si lo flotante que lo toca forma una losa horizontal ancha (la tapa de la barra cuyo frente
  // sólo se ve hasta media altura) por encima de su tapa, la tapa sube hasta la losa. Se mira la cobertura en columnas de
  // cada capa de 5 cm, sumando todo lo flotante que toca el cuerpo, hasta 60 cm por encima de la tapa que tenía.
  const capasDe = new Map();
  piezas.forEach((p, i) => { const e = tocan[i]; if (e < 0) return; if (!capasDe.has(e)) capasDe.set(e, new Map()); const capas = capasDe.get(e);
    for (const j of p.voxeles) { const qz = (j / nxy) | 0; if (!capas.has(qz)) capas.set(qz, new Set()); capas.get(qz).add(j % nxy); } });
  for (const [e, capas] of capasDe) {
    const q = piezas[e]; let mejorZ = -1, mejorN = 0;
    for (const [z, cols] of capas) if ((z + 1) * celda > q.alto + 0.1 && z * celda <= q.alto + 0.6 && cols.size > mejorN) { mejorN = cols.size; mejorZ = z; }
    // Cobertura frente a la caja del cuerpo (no a sus columnas: un mueble del que sólo se ven las caras tiene pocas).
    if (mejorZ >= 0 && mejorN * celda * celda >= 0.25 * q.w * q.d) { q.alto = (mejorZ + 1) * celda; for (const c of q.celdas) soporte[c] = q.alto; }
  }
  for (const p of piezas) {
    const e = tocan[piezas.indexOf(p)]; if (e < 0) continue;
    const q = piezas[e];
    const izTapa = Math.round((q.alto + 0.08) / celda); let x0 = q.x, y0 = q.y, x1 = q.x + q.w, y1 = q.y + q.d, puntos = 0, nv = 0;
    for (const j of p.voxeles) {
      const qz = (j / nxy) | 0, c = j % nxy;
      if (qz < izTapa) { etiquetaVox[j] = e; claseVox[j] = 1; puntos += cuenta[j]; nv++; const qx = c % nx, qy = (c / nx) | 0; x0 = Math.min(x0, qx * celda); y0 = Math.min(y0, qy * celda); x1 = Math.max(x1, (qx + 1) * celda); y1 = Math.max(y1, (qy + 1) * celda);
        if (etiquetaCol[c] < 0) { etiquetaCol[c] = e; soporte[c] = q.alto; q.celdas.push(c); } }
      else { etiquetaVox[j] = -1; claseVox[j] = 2; sueltos++; if (etiquetaCol[c] < 0) { etiquetaCol[c] = e; soporte[c] = q.alto; q.celdas.push(c); } }
    }
    q.x = x0; q.y = y0; q.w = x1 - x0; q.d = y1 - y0; q.puntos += puntos; q.nVoxeles += nv; q.area = q.celdas.length * celda * celda; p.absorbida = true;
  }
  // Lo que quedó sobre las tapas se agrupa ahora como «encima».
  if (sueltos) { const antes = piezas.length; componentes3d(2); for (let i = antes; i < piezas.length; i++) medir(piezas[i]); }
  // Un cuerpo pequeño y más alto pegado a otro mayor y más bajo es algo encima de ese mueble (la cafetera sobre la barra).
  const vecinasCol = p => { const s = new Set(); for (const c of p.celdas) { const qx = c % nx, qy = (c / nx) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = qx + dx, Y = qy + dy; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue; const e = etiquetaCol[Y * nx + X]; if (e >= 0 && e !== piezas.indexOf(p)) s.add(e); } } return [...s]; };
  for (const p of piezas) {
    if (p.clase !== 'cuerpo' || p.area > 0.6) continue;
    if (!p.celdas.length) continue;
    const bajo = vecinasCol(p).map(e => piezas[e]).filter(q => q.clase === 'cuerpo' && !q.absorbida && q.area > p.area * 2 && q.alto < p.alto - 0.1).sort((a, b) => b.area - a.area)[0];
    if (!bajo) continue;
    p.clase = 'encima'; p.apoyadoEnIdx = piezas.indexOf(bajo); p.base = bajo.alto; p.alto = Math.max(celda, p.alto - bajo.alto);
  }
  // Lo de encima: sobre qué cuerpo está (el que más columnas comparte bajo su huella).
  for (const p of piezas) {
    if (p.clase !== 'encima' || p.apoyadoEnIdx != null || p.absorbida) continue;
    const votos = new Map();
    for (const j of p.voxeles) { const e = etiquetaCol[j % nxy]; if (e >= 0) votos.set(e, (votos.get(e) || 0) + 1); }
    const mejor = [...votos.entries()].sort((a, b) => b[1] - a[1])[0];
    if (mejor) { p.apoyadoEnIdx = mejor[0]; p.base = piezas[mejor[0]].alto; }
  }
  // Salida: fuera lo absorbido y lo minúsculo; de mayor a menor volumen; ids estables por orden.
  const utiles = piezas.filter(p => !p.absorbida && (p.clase === 'cuerpo' ? p.area >= minAreaCuerpo && p.nVoxeles >= minVoxeles : p.nVoxeles >= minVoxeles));
  utiles.sort((a, b) => (b.w * b.d * b.alto) - (a.w * a.d * a.alto));
  const lista = utiles.slice(0, max), idDe = new Map(lista.map((p, i) => [piezas.indexOf(p), `obj-${i + 1}`]));
  const objetos = lista.map((p, i) => ({ id: `obj-${i + 1}`, clase: p.clase, x: r2(p.x), y: r2(p.y), w: r2(p.w), d: r2(p.d), base: r2(p.base), alto: r2(p.alto), puntos: p.puntos, voxeles: p.nVoxeles, area: r2(p.area),
    color: p.color, apoyadoEn: p.apoyadoEnIdx != null ? idDe.get(p.apoyadoEnIdx) || null : null, ...(p.pies ? { pies: p.pies } : {}) }));
  const out = { objetos, rejilla: { celda, nx, ny, nz }, sala: { ancho: r2(A), fondo: r2(F), alto: r2(H) } };
  if (etiquetar) {
    const indice = new Int32Array(piezas.length).fill(-1); lista.forEach((p, i) => { indice[piezas.indexOf(p)] = i; });
    const et = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) { const j = vox[i]; if (j < 0) continue; let e = etiquetaVox[j]; if (e < 0) e = etiquetaCol[j % nxy]; if (e >= 0) et[i] = indice[e]; }
    out.etiquetas = et;
  }
  return out;
}

// ── 3. Clasificación por medidas ────────────────────────────────────────────
// Devuelve el objeto con `tipo` (del plano) y `nombre`. `H`: alto de la sala.
export function clasificar(o, { H = 2.7 } = {}) {
  const largo = Math.max(o.w, o.d), corto = Math.min(o.w, o.d), area = o.w * o.d, tope = o.base + o.alto;
  let tipo = 'mueble';
  if (o.clase === 'cuerpo') {
    if (o.alto >= 0.8 * H && area <= 0.6) tipo = 'pilar';
    else if (o.alto >= 1.5) tipo = corto <= 0.7 ? 'estanteria' : 'mueble';
    else if (o.alto >= 1.1 && largo >= 0.8) tipo = 'vitrina';
    else if (o.alto >= 0.8 && o.alto < 1.1 && largo >= 1.8) tipo = 'barra';
    else if (o.alto >= 0.8 && o.alto < 1.1 && largo >= 0.9 && corto <= 1.0) tipo = 'caja';
    else if (o.alto >= 0.6 && o.alto < 1.1 && area >= 0.15 && area <= 1.2 && largo / corto <= 2.2) tipo = 'mesa';
    else if (o.alto >= 0.35 && o.alto < 1.1 && area >= 0.08 && area < 0.5) tipo = 'silla';
  } else if (o.clase === 'encima') {
    if (o.alto >= 0.1 && o.alto <= 0.6 && largo >= 0.3 && largo <= 0.9 && corto >= 0.15) tipo = 'cesta';
    else if (o.alto <= 0.3 && largo >= 0.2 && largo <= 0.35 && corto <= 0.25) tipo = 'ipad';
  } else {
    if (o.base >= 2.0) tipo = 'lampara';
    else if (corto <= 0.15 && o.alto >= 0.4 && o.alto <= 1.6 && largo >= 0.4 && o.base >= 0.6) tipo = 'pantalla';
    else if (o.base >= 0.6 && corto <= 0.6 && largo >= 0.4) tipo = 'estanteria';
  }
  // Menudencias (vasos, bolsas, carteles pequeños): menos de 30 cm de largo y de alto. Se separan pero no van al ITIL.
  const menor = largo < 0.3 && o.alto < 0.3;
  if (menor && tipo === 'cesta') tipo = 'mueble';
  const nombre = menor ? 'Objeto pequeño' : o.clase === 'encima' && tipo === 'mueble' ? 'Objeto sobre el mueble' : o.clase === 'flotante' && tipo === 'estanteria' ? 'Estante de pared' : o.clase === 'flotante' && tipo === 'mueble' ? 'Objeto colgado'
    : tipo === 'mueble' && o.alto >= 1.5 ? 'Mueble alto' : tipo === 'mueble' ? 'Mueble' : NOMBRES[tipo] || 'Objeto';
  return { ...o, tipo, nombre, tope: r2(tope), menor };
}

// ── 4. Cruce con el inventario ITIL ──────────────────────────────────────────
// `inventario`: {units:[{itil_code, name, category}]} (manifiesto público de xpaceos) o una lista de CI de Yokup.
// Los códigos de mobiliario ya dados de alta se reparten por familia a los objetos de su tipo, de mayor a menor; el resto
// de objetos recibe el siguiente código libre de su familia como propuesta. Las posibles pantallas no reciben código
// (las pantallas del plano ya tienen el suyo). Devuelve { objetos, prefijo, noVistos }.
export function cruzarConInventario(objetos, inventario, { prefijo = null, localId = '' } = {}) {
  // El manifiesto público trae `units` (piezas con modelo y foto) y, desde el 19-10-2026, `scan_units` (CI dados de alta desde un escaneo).
  const unidades = (Array.isArray(inventario) ? inventario : [...((inventario && inventario.units) || []), ...((inventario && inventario.scan_units) || []), ...((inventario && inventario.cis) || [])]).filter(u => u && typeof u.itil_code === 'string');
  const re = /^([A-Z0-9]{2,12})-([A-Z0-9]{2,12})-(\d{1,4})$/;
  const veces = {}; for (const u of unidades) { const m = u.itil_code.match(re); if (m) veces[m[1]] = (veces[m[1]] || 0) + 1; }
  const P = prefijo || Object.keys(veces).sort((a, b) => veces[b] - veces[a])[0] || prefijoDe(localId || 'xpacio');
  const libres = new Map();   // familia → códigos existentes de mobiliario aún sin objeto
  for (const u of unidades) { const m = u.itil_code.match(re); if (!m || m[1] !== P) continue; if (u.category && !['mobiliario', 'iluminacion', 'otro', 'kiosk'].includes(u.category)) continue; if (!libres.has(m[2])) libres.set(m[2], []); libres.get(m[2]).push(u); }
  for (const l of libres.values()) l.sort((a, b) => a.itil_code.localeCompare(b.itil_code));
  const usados = new Set(unidades.map(u => u.itil_code)), siguiente = {};
  const nuevo = fam => { const re2 = new RegExp(`^${P}-${fam}-(\\d+)$`); if (siguiente[fam] == null) siguiente[fam] = Math.max(0, ...[...usados].map(c => { const m = c.match(re2); return m ? +m[1] : 0; })); let c; do { c = `${P}-${fam}-${String(++siguiente[fam]).padStart(2, '0')}`; } while (usados.has(c)); usados.add(c); return c; };
  const orden = [...objetos].sort((a, b) => (b.w * b.d * b.alto) - (a.w * a.d * a.alto)), salida = new Map();
  for (const o of orden) {
    if (o.tipo === 'pantalla') { salida.set(o.id, { ...o, itil: null, itilEstado: 'sin-codigo', itilNota: 'posible pantalla: las pantallas del plano ya llevan su código' }); continue; }
    if (o.menor) { salida.set(o.id, { ...o, itil: null, itilEstado: 'menor', itilNota: 'objeto pequeño: se separa pero no se inventaría' }); continue; }
    const fam = FAMILIAS[o.tipo] || 'OBJ', cola = libres.get(fam);
    if (cola && cola.length) { const u = cola.shift(); salida.set(o.id, { ...o, itil: u.itil_code, itilEstado: 'existente', itilNombre: u.name || '', nombre: u.name || o.nombre }); }
    else salida.set(o.id, { ...o, itil: nuevo(fam), itilEstado: 'propuesto' });
  }
  const out = objetos.map(o => salida.get(o.id));
  const noVistos = [...libres.values()].flat().map(u => ({ itil_code: u.itil_code, name: u.name || '' }));
  return { objetos: out, prefijo: P, noVistos };
}

// ── 5. Altas propuestas para Yokup (itil_ci_upsert) ──────────────────────────
export function cisDeObjetos(objetos, { local, escena = '', fecha = new Date().toISOString().slice(0, 10) } = {}) {
  const porId = new Map(objetos.map(o => [o.id, o])), limpio = (v, n = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n), m = v => String(r2(v)).replace('.', ',');
  return objetos.filter(o => o.itilEstado === 'propuesto' && o.itil).map(o => {
    const padre = o.apoyadoEn && porId.get(o.apoyadoEn), categoria = CATEGORIA[o.tipo] || 'mobiliario';
    return { admira_store_id: local, itil_code: o.itil, name: limpio(`${o.nombre} ${o.itil.split('-').pop()}`, 160), category: categoria,
      role: limpio(`Visto en el escaneo 3D ${escena} (${fecha}) · ${m(o.w)} × ${m(o.d)} × ${m(o.alto)} m aprox. · sin confirmar en el local`),
      group_name: o.clase === 'flotante' ? 'Paredes y techo' : padre ? `Sobre ${padre.nombre}` : 'Sala',
      position: limpio(`x ${m(o.x)} m · y ${m(o.y)} m${o.base > 0 ? ` · a ${m(o.base)} m del suelo` : ''}${padre && padre.itil ? ` · sobre ${padre.itil}` : ''}`, 160),
      orientation: '', parent_itil_code: padre && padre.itil ? padre.itil : '' };
  });
}
