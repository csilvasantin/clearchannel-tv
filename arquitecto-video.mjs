// Arquitecto · orden «video» (Carlos, 18-oct-2026: «del recorrido grabado con el móvil (XpaceScan) al plano con
// medidas reales»). Sin DOM: lo usan arquitecto-video-ui.mjs y los tests.
//
// El recorrido se graba con XpaceScan (xpaceos.com/scan), se sube por trozos a scan.admira.store y un Mac con COLMAP
// lo reconstruye (scan-pull.sh): la escena queda «ready» con su nube de puntos `points.ply`. Aquí, en el navegador:
//   1. leerPLY: la nube (binaria little-endian o ASCII).
//   2. levantar: la vertical (la dirección con dos planos fuertes, suelo y techo), el suelo y el techo, el giro de la
//      sala (el que alinea las paredes con los ejes) y sus cuatro paredes. Todo en unidades de COLMAP, sin escala.
//   3. planoDesdeLevantamiento: la escala sale de UNA medida tomada en el local (alto libre, ancho o fondo) y da un
//      plano `admira.xpacio-plano/1` rectangular, con los muebles grandes que se ven en la nube si se piden.
// COLMAP no sabe de metros: sin una medida, la escala se supone (techo de 2,70 m) y el plano lo dice.
// Desde el 19-oct-2026 la nube también puede venir de un escaneo de SuperSplat (arquitecto-splat.mjs): ya en metros
// (`referencia.tipo = 'metrica'`), con color, y lo bastante densa para separar los objetos (arquitecto-objetos.mjs).

export const SCAN_API = 'https://scan.admira.store';
export const SCAN_APP = 'https://www.xpaceos.com/scan/';
export const ALTO_SUPUESTO = 2.7;
export const REFERENCIAS = Object.freeze(['alto', 'ancho', 'fondo', 'metrica']);
export const MAX_PUNTOS = 120000;

// ── Nube de puntos PLY ──────────────────────────────────────────────────────
const TIPOS_PLY = { char: [1, 'getInt8'], int8: [1, 'getInt8'], uchar: [1, 'getUint8'], uint8: [1, 'getUint8'], short: [2, 'getInt16'], int16: [2, 'getInt16'],
  ushort: [2, 'getUint16'], uint16: [2, 'getUint16'], int: [4, 'getInt32'], int32: [4, 'getInt32'], uint: [4, 'getUint32'], uint32: [4, 'getUint32'],
  float: [4, 'getFloat32'], float32: [4, 'getFloat32'], double: [8, 'getFloat64'], float64: [8, 'getFloat64'] };
export function leerPLY(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const cab = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const fin = cab.indexOf('end_header');
  if (!cab.startsWith('ply') || fin < 0) throw new Error('ply');
  const lineas = cab.slice(0, fin).split(/\r?\n/);
  const formato = (lineas.find(l => l.startsWith('format ')) || '').split(/\s+/)[1];
  if (!['ascii', 'binary_little_endian'].includes(formato)) throw new Error('ply-formato');
  let n = 0, props = [], enVertice = false;
  for (const l of lineas) {
    const p = l.trim().split(/\s+/);
    if (p[0] === 'element') { enVertice = p[1] === 'vertex'; if (enVertice) n = parseInt(p[2], 10); }
    else if (p[0] === 'property' && enVertice) { if (p[1] === 'list') throw new Error('ply-lista'); props.push({ tipo: p[1], nombre: p[2] }); }
  }
  const ix = ['x', 'y', 'z'].map(k => props.findIndex(p => p.nombre === k));
  if (!(n > 0) || ix.some(i => i < 0)) throw new Error('ply-xyz');
  // Color y opacidad si los trae (red/green/blue o r/g/b, alpha/opacity de 8 bits): los usa la separación de objetos.
  const ic = [['red', 'r', 'diffuse_red'], ['green', 'g', 'diffuse_green'], ['blue', 'b', 'diffuse_blue']].map(ks => props.findIndex(p => ks.includes(p.nombre) && /^u?char$|^u?int8$/.test(p.tipo)));
  const ia = props.findIndex(p => ['alpha', 'opacity', 'a'].includes(p.nombre) && /^u?char$|^u?int8$/.test(p.tipo));
  const conColor = ic.every(i => i >= 0), rgb = conColor ? new Uint8Array(n * 3) : null, alfa = ia >= 0 ? new Uint8Array(n) : null;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n);
  let inicio = fin + 'end_header'.length; while (inicio < bytes.length && bytes[inicio] !== 10) inicio++; inicio++;
  if (formato === 'ascii') {
    const filas = new TextDecoder('latin1').decode(bytes.subarray(inicio)).split(/\r?\n/);
    for (let i = 0, k = 0; i < filas.length && k < n; i++) {
      const v = filas[i].trim().split(/\s+/); if (v.length < props.length) continue;
      x[k] = +v[ix[0]]; y[k] = +v[ix[1]]; z[k] = +v[ix[2]];
      if (rgb) { rgb[k * 3] = +v[ic[0]]; rgb[k * 3 + 1] = +v[ic[1]]; rgb[k * 3 + 2] = +v[ic[2]]; } if (alfa) alfa[k] = +v[ia];
      k++;
    }
  } else {
    const off = [], tam = props.map(p => { const t = TIPOS_PLY[p.tipo]; if (!t) throw new Error('ply-tipo'); return t; });
    let paso = 0; for (const t of tam) { off.push(paso); paso += t[0]; }
    if (inicio + n * paso > bytes.length) throw new Error('ply-corto');
    const dv = new DataView(bytes.buffer, bytes.byteOffset + inicio, n * paso);
    const lee = j => { const [, f] = tam[ix[j]]; return (o) => dv[f](o + off[ix[j]], true); };
    const lx = lee(0), ly = lee(1), lz = lee(2);
    for (let i = 0; i < n; i++) { const o = i * paso; x[i] = lx(o); y[i] = ly(o); z[i] = lz(o); }
    if (rgb) for (let i = 0; i < n; i++) { const o = i * paso; rgb[i * 3] = dv.getUint8(o + off[ic[0]]); rgb[i * 3 + 1] = dv.getUint8(o + off[ic[1]]); rgb[i * 3 + 2] = dv.getUint8(o + off[ic[2]]); }
    if (alfa) for (let i = 0; i < n; i++) alfa[i] = dv.getUint8(i * paso + off[ia]);
  }
  return { n, x, y, z, ...(rgb ? { rgb } : {}), ...(alfa ? { alfa } : {}) };
}

// ── Álgebra pequeña ─────────────────────────────────────────────────────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// Autovectores de una matriz simétrica 3×3 (Jacobi), ordenados de menor a mayor autovalor.
export function autovectores3(m) {
  const a = m.map(f => f.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1; for (const [i, j] of [[0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
  }
  return [0, 1, 2].map(i => ({ valor: a[i][i], vector: norma([v[0][i], v[1][i], v[2][i]]) })).sort((u, w) => u.valor - w.valor);
}
const pct = (ordenado, q) => ordenado[Math.min(ordenado.length - 1, Math.max(0, Math.round(q * (ordenado.length - 1))))];
const ordenar = arr => Float64Array.from(arr).sort();
function histograma(vals, lo, hi, bins) {
  const h = new Float64Array(bins), k = bins / ((hi - lo) || 1);
  for (const v of vals) { const b = Math.floor((v - lo) * k); if (b >= 0 && b < bins) h[b]++; }
  return h;
}
const suave = h => h.map((v, i) => (h[i - 1] || 0) * 0.25 + v * 0.5 + (h[i + 1] || 0) * 0.25);
const mediana = arr => { const s = [...arr].filter(v => v > 0).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
// Centro de un pico con precisión por debajo del paso del histograma (parábola por el pico y sus vecinos).
const centroPico = (H, i) => { const a = H[i - 1] || 0, b = H[i], c = H[i + 1] || 0, den = a - 2 * b + c; return i + 0.5 + (den < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0); };

// Alturas de los puntos a lo largo de `v`: los dos planos fuertes de los extremos (suelo y techo) y lo bien que se ven.
function dosPlanos(h, M) {
  const s = ordenar(h), lo = pct(s, 0.005), hi = pct(s, 0.995), bins = 120, H = suave(histograma(h, lo, hi, bins)), paso = (hi - lo) / bins;
  let a = 0, b = bins - 1;
  for (let i = 0; i < bins * 0.3; i++) if (H[i] > H[a]) a = i;
  for (let i = bins - 1; i > bins * 0.7; i--) if (H[i] > H[b]) b = i;
  const med = mediana(H) || 1, cuenta = i => (H[i - 1] || 0) + H[i] + (H[i + 1] || 0);
  // Sin un pico claro (techos lisos que COLMAP apenas ve), el borde de la nube (1 % / 99 %).
  const fa = H[a] / med, fb = H[b] / med;
  return { bajo: fa >= 1.5 ? lo + centroPico(H, a) * paso : pct(s, 0.01), alto: fb >= 1.5 ? lo + centroPico(H, b) * paso : pct(s, 0.99), fuerzaBajo: fa, fuerzaAlto: fb, rango: hi - lo,
    puntuacion: (cuenta(a) + cuenta(b)) / M, masaAbajo: H.slice(a + 2, (a + b) >> 1).reduce((x, y) => x + y, 0), masaArriba: H.slice(((a + b) >> 1) + 1, b - 1).reduce((x, y) => x + y, 0) };
}

// ── Levantamiento ───────────────────────────────────────────────────────────
// nube {n, x, y, z} → vertical, suelo y techo, giro y paredes (unidades de COLMAP). `invertir` cambia suelo por techo y
// `girar` gira la sala 90° (cambia qué pared es la del fondo, F). Con `vertical` se fuerza la dirección vertical.
// `ajuste`: «paredes» (las paredes claras de la nube; para un local rectangular) o «envolvente» (todo lo que cubre la
// nube, 2 %–98 %; para un local en L o con entrantes).
export const AJUSTES = Object.freeze(['paredes', 'envolvente']);
export function levantar(nube, { invertir = false, girar = false, maxPuntos = MAX_PUNTOS, vertical = null, ajuste = 'paredes' } = {}) {
  if (!nube || !(nube.n >= 200)) throw new Error('pocos-puntos');
  const paso = Math.max(1, Math.ceil(nube.n / maxPuntos)), M = Math.floor(nube.n / paso);
  const P = new Float64Array(M * 3);
  for (let i = 0, k = 0; k < M; i += paso, k++) { P[k * 3] = nube.x[i]; P[k * 3 + 1] = nube.y[i]; P[k * 3 + 2] = nube.z[i]; }
  const finitos = [0, 1, 2].every(c => { for (let k = 0; k < M; k++) if (!Number.isFinite(P[k * 3 + c])) return false; return true; });
  if (!finitos) throw new Error('nube-no-finita');
  // Centro y covarianza robustos (dentro del 1–99 % de cada eje).
  const ejes = [0, 1, 2].map(c => ordenar(Array.from({ length: M }, (_, k) => P[k * 3 + c])));
  const centro = ejes.map(s => pct(s, 0.5)), caja = ejes.map(s => [pct(s, 0.01), pct(s, 0.99)]);
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; let nc = 0;
  for (let k = 0; k < M; k++) {
    const p = [P[k * 3] - centro[0], P[k * 3 + 1] - centro[1], P[k * 3 + 2] - centro[2]];
    if (![0, 1, 2].every(c => P[k * 3 + c] >= caja[c][0] && P[k * 3 + c] <= caja[c][1])) continue;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += p[i] * p[j]; nc++;
  }
  // Vertical: entre los ejes propios y los de COLMAP, la dirección en la que la nube es más corta (un local es menos alto
  // que ancho o largo). «Dos planos fuertes» no basta: dos paredes enfrentadas también lo parecen. A igualdad (≤ 10 %),
  // la que tiene suelo y techo más claros.
  const alturas = v => { const h = new Float64Array(M); for (let k = 0; k < M; k++) h[k] = P[k * 3] * v[0] + P[k * 3 + 1] * v[1] + P[k * 3 + 2] * v[2]; return h; };
  const candidatos = vertical ? [norma(vertical)] : [...autovectores3(cov.map(f => f.map(x => x / (nc || 1)))).map(e => e.vector), [1, 0, 0], [0, 1, 0], [0, 0, 1]]
    .filter((v, i, a) => a.findIndex(w => Math.abs(dot(v, w)) > 0.98) === i);
  const evaluados = candidatos.map(v => ({ v, d: dosPlanos(alturas(v), M) })).sort((p, q) => p.d.rango - q.d.rango);
  const mejor = evaluados.filter(e => e.d.rango <= evaluados[0].d.rango * 1.1).sort((p, q) => q.d.puntuacion - p.d.puntuacion)[0];
  // Afinado: normal media de los puntos del suelo y del techo. Empieza con una franja ancha (una vertical algo torcida
  // sólo deja ver una tira del suelo, y una tira no da plano) y la estrecha hasta que la vertical deja de moverse.
  let v = mejor.v;
  for (let it = 0; it < 6; it++) {
    const h = alturas(v), d = dosPlanos(h, M), banda = (it === 0 ? 0.1 : it === 1 ? 0.06 : 0.03) * Math.abs(d.alto - d.bajo), normales = [];
    for (const [objetivo, fuerza] of [[d.bajo, d.fuerzaBajo], [d.alto, d.fuerzaAlto]]) {
      if (fuerza < 1.8) continue;                          // sólo con un plano de verdad
      const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], m = [0, 0, 0]; let n = 0;
      for (let k = 0; k < M; k++) if (Math.abs(h[k] - objetivo) < banda) { for (let i = 0; i < 3; i++) m[i] += P[k * 3 + i]; n++; }
      if (n < 30) continue;
      for (let i = 0; i < 3; i++) m[i] /= n;
      for (let k = 0; k < M; k++) if (Math.abs(h[k] - objetivo) < banda) { const p = [P[k * 3] - m[0], P[k * 3 + 1] - m[1], P[k * 3 + 2] - m[2]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i][j] += p[i] * p[j]; }
      const nn = autovectores3(c)[0].vector; normales.push(dot(nn, v) < 0 ? nn.map(x => -x) : nn);
    }
    if (!normales.length) break;
    const media = norma(normales.reduce((s, n) => [s[0] + n[0], s[1] + n[1], s[2] + n[2]], [0, 0, 0]));
    const giro = Math.acos(Math.min(1, Math.abs(dot(media, v))));
    if (giro > 0.35) break;                                  // más de 20°: no se fía
    v = media;
    if (giro < 0.0005 && it >= 2) break;                     // quieta (menos de 0,03°)
  }
  let h = alturas(v), d = dosPlanos(h, M);
  // El suelo es el lado con más cosas (muebles y gente) entre los dos planos; `invertir` lo corrige a mano.
  let sueloAbajo = d.masaAbajo >= d.masaArriba; if (invertir) sueloAbajo = !sueloAbajo;
  if (!sueloAbajo) { v = v.map(x => -x); h = h.map(x => -x); d = dosPlanos(h, M); }
  const suelo = d.bajo, techo = d.alto, alto = techo - suelo;
  if (!(alto > 0)) throw new Error('sin-suelo-techo');
  // Base del plano horizontal y puntos de la franja de paredes (sin suelo, techo ni lo que hay a ras de suelo).
  const e1 = norma(cross(v, Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(v, e1);
  const A = [], B = [];
  for (let k = 0; k < M; k++) { const hk = h[k] - suelo; if (hk > 0.2 * alto && hk < 0.85 * alto) { const p = [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]; A.push(dot(p, e1)); B.push(dot(p, e2)); } }
  if (A.length < 100) throw new Error('sin-paredes');
  const ca = pct(ordenar(A), 0.5), cb = pct(ordenar(B), 0.5);
  let R = 0; for (let i = 0; i < A.length; i++) R = Math.max(R, Math.abs(A[i] - ca), Math.abs(B[i] - cb));
  R = Math.min(R, 3 * Math.max(pct(ordenar(A.map(a => Math.abs(a - ca))), 0.98), pct(ordenar(B.map(b => Math.abs(b - cb))), 0.98)));
  // Giro: el que concentra más los puntos de pared en los histogramas de los dos ejes.
  const concentracion = th => {
    const c = Math.cos(th), s = Math.sin(th), bins = 240, hu = new Float64Array(bins), hw = new Float64Array(bins), k = bins / (2 * R);
    for (let i = 0; i < A.length; i++) {
      const a = A[i] - ca, b = B[i] - cb, u = a * c + b * s, w = -a * s + b * c;
      const bu = Math.floor((u + R) * k), bw = Math.floor((w + R) * k);
      if (bu >= 0 && bu < bins) hu[bu]++; if (bw >= 0 && bw < bins) hw[bw]++;
    }
    let sq = 0; for (let i = 0; i < bins; i++) sq += hu[i] * hu[i] + hw[i] * hw[i];
    return sq;
  };
  let th = 0, mejorC = -1;
  for (let g = 0; g < 90; g += 1) { const c = concentracion(g * Math.PI / 180); if (c > mejorC) { mejorC = c; th = g; } }
  for (let g = th - 1; g <= th + 1; g += 0.1) { const c = concentracion(g * Math.PI / 180); if (c > mejorC) { mejorC = c; th = g; } }
  th = th * Math.PI / 180;
  // Paredes: en el 30 % exterior de cada lado, la pared MÁS DE FUERA con fuerza (≥ 35 % del pico de ese lado), no la más
  // fuerte: así un mueble alto junto a una pared floja no la sustituye, y en un local en L la planta envuelve todo.
  // Sin pico claro (≤ 2 veces la mediana), el 2 % / 98 % de los puntos.
  const pared = vals => {
    const s = ordenar(vals), lo = pct(s, 0.005), hi = pct(s, 0.995), bins = 200, Hh = suave(histograma(vals, lo, hi, bins)), paso = (hi - lo) / bins, med = mediana(Hh) || 1;
    const lado = (desde, hasta, dir) => {
      let m = desde; for (let i = desde; i !== hasta; i += dir) if (Hh[i] > Hh[m]) m = i;
      for (let i = desde; i !== hasta; i += dir) if (Hh[i] >= 0.35 * Hh[m] && Hh[i] >= 2 * med && (Hh[i] >= (Hh[i + dir] || 0))) return { i, f: Hh[m] / med };
      return { i: m, f: Hh[m] / med };
    };
    const a = lado(0, Math.floor(bins * 0.3), 1), b = lado(bins - 1, Math.ceil(bins * 0.7), -1);
    return { min: a.f >= 2 ? lo + centroPico(Hh, a.i) * paso : pct(s, 0.02), max: b.f >= 2 ? lo + centroPico(Hh, b.i) * paso : pct(s, 0.98), fuerza: [a.f, b.f] };
  };
  const proyectar = eje => { const out = new Float64Array(A.length); for (let i = 0; i < A.length; i++) out[i] = (A[i] - ca) * eje[0] + (B[i] - cb) * eje[1]; return out; };
  // Ejes del plano: x a lo largo del lado mayor (salvo `girar`); y = x × vertical, para que la planta vista desde arriba
  // no salga en espejo (en el plano, y crece hacia dentro de la sala y la altura sube).
  const u0 = [Math.cos(th), Math.sin(th)], w0 = [-Math.sin(th), Math.cos(th)];
  const largoU = (() => { const p = pared(proyectar(u0)); return p.max - p.min; })(), largoW = (() => { const p = pared(proyectar(w0)); return p.max - p.min; })();
  let cambio = largoU < largoW; if (girar) cambio = !cambio;
  const ejeX = cambio ? w0 : u0, ejeY = [ejeX[1], -ejeX[0]];
  const envolvente = vals => { const s = ordenar(vals); return { min: pct(s, 0.02), max: pct(s, 0.98), fuerza: [0, 0] }; };
  const medir = ajuste === 'envolvente' ? envolvente : pared;
  const pu = medir(proyectar(ejeX)), pw = medir(proyectar(ejeY)), fuerzasParedes = [...pared(proyectar(ejeX)).fuerza, ...pared(proyectar(ejeY)).fuerza];
  const ejes3d = { x: norma([0, 1, 2].map(i => ejeX[0] * e1[i] + ejeX[1] * e2[i])), y: norma([0, 1, 2].map(i => ejeY[0] * e1[i] + ejeY[1] * e2[i])), arriba: v };
  const ancho = pu.max - pu.min, fondo = pw.max - pw.min;
  // Apoyo: qué parte de la franja de paredes cae cerca de alguna de las cuatro paredes.
  const tol = 0.04 * Math.max(ancho, fondo); let apoyo = 0;
  for (let i = 0; i < A.length; i++) {
    const a = A[i] - ca, b = B[i] - cb, x = a * ejeX[0] + b * ejeX[1], y = a * ejeY[0] + b * ejeY[1];
    if (Math.min(Math.abs(x - pu.min), Math.abs(x - pu.max), Math.abs(y - pw.min), Math.abs(y - pw.max)) < tol) apoyo++;
  }
  apoyo /= A.length;
  const fuerte = Math.min(d.fuerzaBajo, d.fuerzaAlto), paredesClaras = fuerzasParedes.filter(f => f >= 2).length;
  const confianza = apoyo > 0.5 && fuerte >= 3 && paredesClaras >= 3 ? 'alta' : apoyo > 0.3 && fuerte >= 1.8 ? 'media' : 'baja';
  // Todos los puntos en coordenadas de sala (x, y desde la esquina de la pared F–C, h desde el suelo), para dibujar y para muebles.
  const sala = new Float32Array(M * 3);
  for (let k = 0; k < M; k++) {
    const p = [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]], a = dot(p, e1) - ca, b = dot(p, e2) - cb;
    sala[k * 3] = a * ejeX[0] + b * ejeX[1] - pu.min; sala[k * 3 + 1] = a * ejeY[0] + b * ejeY[1] - pw.min; sala[k * 3 + 2] = h[k] - suelo;
  }
  return {
    techoVisible: d.fuerzaAlto >= 1.8, sueloVisible: d.fuerzaBajo >= 1.8,
    puntos: nube.n, usados: M, franja: A.length, vertical: v, giro: th, ejes3d, unidades: { ancho, fondo, alto }, confianza, apoyo,
    ajuste: medir === envolvente ? 'envolvente' : 'paredes', fuerzas: { suelo: d.fuerzaBajo, techo: d.fuerzaAlto, paredes: fuerzasParedes }, sala,
    // El marco de la sala, para llevar cualquier punto del mundo a coordenadas de sala (aSala, en arquitecto-objetos.mjs).
    marco: { e1, e2, ca, cb, ejeX, ejeY, x0: pu.min, y0: pw.min, v, suelo }
  };
}

// ── Escala ──────────────────────────────────────────────────────────────────
// Metros por unidad de COLMAP a partir de una medida tomada en el local; sin ella, techo de 2,70 m supuesto.
export function escala(lev, referencia = null) {
  // Nube ya en metros (escaneos de SuperSplat y del móvil): 1 unidad = 1 m, sin medida que tomar.
  if (referencia && referencia.tipo === 'metrica') return { k: 1, tipo: 'metrica', valor: 1, supuesta: false };
  const tipo = referencia && REFERENCIAS.includes(referencia.tipo) && referencia.tipo !== 'metrica' ? referencia.tipo : null, valor = referencia && Number(referencia.valor);
  if (tipo && valor > 0 && lev.unidades[tipo] > 0) return { k: valor / lev.unidades[tipo], tipo, valor, supuesta: false };
  return { k: ALTO_SUPUESTO / lev.unidades.alto, tipo: 'alto', valor: ALTO_SUPUESTO, supuesta: true };
}

// ── Muebles grandes que se ven en la nube ───────────────────────────────────
// Rejilla de 20 cm con los puntos entre 12 cm y 2,2 m (lejos de las paredes): las celdas densas que se tocan son un mueble.
export function mueblesDetectados(lev, k, { celda = 0.2, margen = 0.3, max = 12 } = {}) {
  const A = lev.unidades.ancho * k, F = lev.unidades.fondo * k, H = lev.unidades.alto * k;
  const cols = Math.max(1, Math.ceil(A / celda)), filas = Math.max(1, Math.ceil(F / celda)), cuenta = new Uint32Array(cols * filas), alturas = new Map();
  const tope = Math.min(2.2, H * 0.8), s = lev.sala;
  for (let i = 0; i < s.length; i += 3) {
    const x = s[i] * k, y = s[i + 1] * k, h = s[i + 2] * k;
    if (h < 0.12 || h > tope || x < margen || y < margen || x > A - margen || y > F - margen) continue;
    const c = Math.min(cols - 1, Math.floor(x / celda)), f = Math.min(filas - 1, Math.floor(y / celda)), j = f * cols + c;
    cuenta[j]++; if (!alturas.has(j)) alturas.set(j, []); alturas.get(j).push(h);
  }
  // Umbral: el doble de la celda típica y al menos un 10 % de la más densa, para que lo suelto alrededor no se pegue al mueble.
  const llenas = [...cuenta].filter(v => v > 0).sort((a, b) => a - b), umbral = Math.max(3, 2 * (llenas[llenas.length >> 1] || 0), 0.1 * (llenas[llenas.length - 1] || 0));
  const visto = new Uint8Array(cols * filas), out = [];
  for (let j = 0; j < cuenta.length; j++) {
    if (visto[j] || cuenta[j] < umbral) continue;
    const cola = [j], celdas = []; visto[j] = 1;
    while (cola.length) {
      const q = cola.pop(), c = q % cols, f = (q / cols) | 0; celdas.push(q);
      for (let dc = -1; dc <= 1; dc++) for (let df = -1; df <= 1; df++) {
        const cc = c + dc, ff = f + df, r = ff * cols + cc;
        if (cc >= 0 && ff >= 0 && cc < cols && ff < filas && !visto[r] && cuenta[r] >= umbral) { visto[r] = 1; cola.push(r); }
      }
    }
    if (celdas.length < 3) continue;
    const cs = celdas.map(q => q % cols), fs = celdas.map(q => (q / cols) | 0), hs = celdas.flatMap(q => alturas.get(q) || []).sort((a, b) => a - b);
    const x0 = Math.min(...cs) * celda, y0 = Math.min(...fs) * celda;
    out.push({ x: x0, y: y0, w: (Math.max(...cs) + 1) * celda - x0, d: (Math.max(...fs) + 1) * celda - y0, alto: Math.max(0.3, hs[Math.floor(0.9 * (hs.length - 1))] || 0.3),
      puntos: celdas.reduce((t, q) => t + cuenta[q], 0) });
  }
  return out.sort((a, b) => b.puntos - a.puntos).slice(0, max);
}

// ── Plano admira.xpacio-plano/1 ─────────────────────────────────────────────
const r2 = v => Math.round(v * 100) / 100;
const limpio = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
// `objetos`: la lista de arquitecto-objetos.mjs (objetosDetectados + clasificar + cruzarConInventario) ya en metros; con ella,
// el mobiliario del plano son esos objetos, cada uno con su base, su altura y su código ITIL (existente o propuesto).
// `origen`: de dónde viene la nube ({tipo: 'supersplat', enlace}); sin él, de XpaceScan.
export function planoDesdeLevantamiento(lev, { id, nombre = '', escena = '', referencia = null, muebles = true, objetos = null, origen = null, fecha = new Date().toISOString().slice(0, 10) } = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id || '')) throw new Error('id');
  const esc = escala(lev, referencia), k = esc.k;
  const A = r2(lev.unidades.ancho * k), F = r2(lev.unidades.fondo * k), H = r2(lev.unidades.alto * k);
  const mob = Array.isArray(objetos) ? objetos.map((o, i) => ({ id: o.id || `objeto-${i + 1}`, nombre: limpio(o.nombre || `Objeto ${i + 1}`, 80), tipo: o.tipo || 'mueble',
    x: r2(o.x), y: r2(o.y), w: r2(o.w), d: r2(o.d), alto: r2(o.alto), ...(o.base > 0 ? { base: r2(o.base) } : {}), ...(o.itil ? { itil: o.itil } : {}),
    ...(o.apoyadoEn ? { apoyadoEn: o.apoyadoEn } : {}), ...(o.color ? { color: o.color } : {}), clase: o.clase || 'mueble', itilEstado: o.itilEstado || (o.itil ? 'existente' : 'sin-codigo'), detectado: true }))
    : muebles ? mueblesDetectados(lev, k).map((m, i) => ({ id: `detectado-${i + 1}`, nombre: `Mueble detectado ${i + 1}`, tipo: 'mueble',
      x: r2(m.x), y: r2(m.y), w: r2(m.w), d: r2(m.d), alto: r2(m.alto), detectado: true })) : [];
  const medida = esc.tipo === 'metrica' ? 'escala real: la nube ya está en metros' : esc.supuesta ? `escala supuesta: techo de ${String(ALTO_SUPUESTO).replace('.', ',')} m (sin medida del local)`
    : `escala con una medida del local: ${esc.tipo} = ${String(esc.valor).replace('.', ',')} m`;
  const splat = origen && origen.tipo === 'supersplat';
  return {
    schema: 'admira.xpacio-plano/1', id, version: `${splat ? 'splat' : 'video'}-${fecha}-1`, nombre: limpio(nombre) || id, direccion: '',
    fuente: { titulo: `${splat ? 'Levantado desde un escaneo 3D (SuperSplat)' : 'Levantado desde un vídeo (XpaceScan)'} · ${medida}`, escena: limpio(splat ? origen.enlace || escena : escena, 120) || null, puntos: lev.puntos, confianza: lev.confianza,
      referencia: { tipo: esc.tipo, valor: esc.valor, supuesta: esc.supuesta },
      metodo: Array.isArray(objetos) ? 'nube densa → suelo, techo y cuatro paredes; objetos separados por vóxeles (muebles, lo que hay encima y lo que cuelga), cada uno con su código ITIL' : 'nube COLMAP → suelo, techo y cuatro paredes; sala rectangular',
      ...(Array.isArray(objetos) ? { objetos: { total: mob.length, conItil: mob.filter(m => m.itil).length, propuestos: mob.filter(m => m.itilEstado === 'propuesto').length } } : {}),
      pendiente: 'puertas, ventanas y pantallas: márcalas en plano.html',
      ...(lev.techoVisible && lev.sueloVisible ? {} : { alto: `alto aproximado: el ${lev.sueloVisible ? 'techo' : lev.techoVisible ? 'suelo' : 'suelo y el techo'} apenas se ve${lev.sueloVisible || lev.techoVisible ? '' : 'n'} en la nube` }) },
    planta: { ancho: A, fondo: F, alto: H },
    paredes: [{ id: 'F', nombre: 'Fondo', a: [0, 0], b: [A, 0] }, { id: 'D', nombre: 'Derecha', a: [A, 0], b: [A, F] },
      { id: 'P', nombre: 'Frente', a: [A, F], b: [0, F] }, { id: 'C', nombre: 'Izquierda', a: [0, F], b: [0, 0] }],
    huecos: [], mobiliario: mob, pantallas: [], dispositivos: []
  };
}
