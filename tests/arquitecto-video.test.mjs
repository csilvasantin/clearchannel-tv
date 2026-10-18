import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerPLY, autovectores3, levantar, escala, mueblesDetectados, planoDesdeLevantamiento, ALTO_SUPUESTO, AJUSTES } from '../arquitecto-video.mjs';
import { leerPlanoJson } from '../plano-subida.mjs';

// Arquitecto · «video» (18-oct-2026): del recorrido de XpaceScan (nube COLMAP) a un plano con medidas reales.

// Sala sintética W × D × H m con un mueble, puesta como la dejaría COLMAP: girada en 3D, a escala y desplazada.
// Del plano al mundo como el gemelo 3D (x, altura, y), sin espejo.
function salaSintetica({ W = 9, D = 6, H = 3, escala: s = 0.37, semilla = 7, mueble = { x: 3, y: 2, w: 1.2, d: 0.6, h: 0.9 }, rot = [0.7, -0.4, 2.1], desplaza = [1.3, -0.8, 4.2], ruido = 0.01 } = {}) {
  let q = semilla >>> 0; const r = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pts = [], add = (x, y, h) => pts.push([x + (r() - 0.5) * 2 * ruido, y + (r() - 0.5) * 2 * ruido, h + (r() - 0.5) * 2 * ruido]);
  for (let i = 0; i < 9000; i++) add(r() * W, r() * D, 0);
  for (let i = 0; i < 4000; i++) add(r() * W, r() * D, H);
  for (let i = 0; i < 3000; i++) { add(r() * W, 0, r() * H); add(r() * W, D, r() * H); }
  for (let i = 0; i < 2000; i++) { add(0, r() * D, r() * H); add(W, r() * D, r() * H); }
  if (mueble) for (let i = 0; i < 2500; i++) { const f = r(); add(mueble.x + r() * mueble.w, mueble.y + r() * mueble.d, f < 0.5 ? mueble.h : r() * mueble.h); }
  for (let i = 0; i < 600; i++) add(r() * W, r() * D, r() * 0.3);
  const [a, b, c] = rot, cx = Math.cos(a), sx = Math.sin(a), cy = Math.cos(b), sy = Math.sin(b), cz = Math.cos(c), sz = Math.sin(c);
  const mul = (A, B) => A.map((f, i) => B[0].map((_, j) => f.reduce((t, _, k) => t + A[i][k] * B[k][j], 0)));
  const R = mul([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], mul([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]));
  const n = pts.length, x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n);
  pts.forEach(([px, py, ph], i) => { const w = [px, ph, py]; const p = [0, 1, 2].map(k => (R[k][0] * w[0] + R[k][1] * w[1] + R[k][2] * w[2]) * s + desplaza[k]); x[i] = p[0]; y[i] = p[1]; z[i] = p[2]; });
  return { nube: { n, x, y, z }, arriba: [R[0][1], R[1][1], R[2][1]] };
}
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} frente a ${b}`);

test('the eigen-solver returns orthonormal axes sorted by variance', () => {
  const e = autovectores3([[4, 1, 0], [1, 3, 0.5], [0, 0.5, 1]]);
  assert.ok(e[0].valor <= e[1].valor && e[1].valor <= e[2].valor);
  for (const { valor, vector: v } of e) {
    const Mv = [4 * v[0] + v[1], v[0] + 3 * v[1] + 0.5 * v[2], 0.5 * v[1] + v[2]];
    for (let i = 0; i < 3; i++) cerca(Mv[i], valor * v[i], 1e-6, 'M·v = λ·v');
  }
});

test('PLY clouds are read in binary little-endian and in ASCII', () => {
  const real = leerPLY(readFileSync(new URL('./fixtures/xpacio-starwars-points.ply', import.meta.url)));
  assert.equal(real.n, 11660); assert.ok([real.x[0], real.y[0], real.z[0]].every(Number.isFinite));
  const ascii = leerPLY(new TextEncoder().encode('ply\nformat ascii 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nend_header\n1 2 3 255\n4 5 6 0\n'));
  assert.deepEqual([...ascii.x, ...ascii.y, ...ascii.z], [1, 4, 2, 5, 3, 6]);
  assert.throws(() => leerPLY(new TextEncoder().encode('nada')), /ply/);
});

test('synthetic rooms come back with their real sizes from one measurement, whatever the COLMAP frame', () => {
  for (const sala of [{}, { W: 5, D: 4.5, H: 3.2, mueble: null, rot: [-1.1, 0.3, 0.2], escala: 2.4 }, { W: 14, D: 3.5, H: 2.6, rot: [0.2, 1.3, -0.7], escala: 0.05 }]) {
    const { nube, arriba } = salaSintetica(sala), W = sala.W || 9, D = sala.D || 6, H = sala.H || 3;
    const lev = levantar(nube);
    assert.ok(Math.abs(lev.vertical[0] * arriba[0] + lev.vertical[1] * arriba[1] + lev.vertical[2] * arriba[2] - 1) < 0.01, 'vertical hacia arriba');
    const k = escala(lev, { tipo: 'alto', valor: H }).k;
    cerca(lev.unidades.ancho * k, W, 0.05, 'ancho'); cerca(lev.unidades.fondo * k, D, 0.05, 'fondo');
    assert.equal(lev.confianza, 'alta');
    // La misma escala sale con el ancho medido en lugar del alto.
    cerca(escala(lev, { tipo: 'ancho', valor: W }).k, k, k * 0.01, 'escala por el ancho');
  }
});

test('the plan is not mirrored: x × y points down, like the 3D twin (x, height, y)', () => {
  const lev = levantar(salaSintetica().nube), { x, y, arriba } = lev.ejes3d;
  const c = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  cerca(c[0] * arriba[0] + c[1] * arriba[1] + c[2] * arriba[2], -1, 1e-6, 'x × y · arriba');
});

test('large furniture seen in the cloud is found where it is (to within one 20 cm cell)', () => {
  const lev = levantar(salaSintetica().nube), k = escala(lev, { tipo: 'alto', valor: 3 }).k, [m] = mueblesDetectados(lev, k);
  assert.ok(m, 'un mueble'); cerca(m.x, 3, 0.25, 'x'); cerca(m.y, 2, 0.25, 'y'); cerca(m.w, 1.2, 0.45, 'ancho'); cerca(m.d, 0.6, 0.45, 'fondo'); cerca(m.alto, 0.9, 0.1, 'alto');
  assert.equal(mueblesDetectados(levantar(salaSintetica({ mueble: null }).nube), k).length, 0, 'sin mueble, nada');
});

test('manual controls: swap floor and ceiling, turn 90°, envelope fit', () => {
  const { nube } = salaSintetica(), a = levantar(nube);
  const inv = levantar(nube, { invertir: true }); assert.ok(a.vertical.every((v, i) => Math.abs(v + inv.vertical[i]) < 1e-6), 'invertida');
  const g = levantar(nube, { girar: true }); cerca(g.unidades.ancho, a.unidades.fondo, 1e-6, 'girada'); cerca(g.unidades.fondo, a.unidades.ancho, 1e-6, 'girada');
  const env = levantar(nube, { ajuste: 'envolvente' }); assert.equal(env.ajuste, 'envolvente'); assert.deepEqual(AJUSTES, ['paredes', 'envolvente']);
  cerca(env.unidades.ancho / a.unidades.ancho, 1, 0.02, 'en una sala rectangular, casi igual');
});

test('without a measurement the scale is an assumed 2.70 m ceiling, and the plan says so', () => {
  const lev = levantar(salaSintetica().nube), e = escala(lev, null);
  assert.equal(e.supuesta, true); cerca(lev.unidades.alto * e.k, ALTO_SUPUESTO, 1e-9, 'techo supuesto');
  const p = planoDesdeLevantamiento(lev, { id: 'sala-prueba', nombre: 'Sala de prueba', escena: 'escena-1', fecha: '2026-10-18' });
  assert.match(p.fuente.titulo, /supuesta/); assert.equal(p.fuente.referencia.supuesta, true);
  const real = planoDesdeLevantamiento(lev, { id: 'sala-prueba', referencia: { tipo: 'ancho', valor: 9 }, fecha: '2026-10-18' });
  assert.equal(real.fuente.referencia.supuesta, false); assert.match(real.fuente.titulo, /ancho = 9 m/);
  cerca(real.planta.ancho, 9, 0.01, 'ancho'); cerca(real.planta.fondo, 6, 0.06, 'fondo'); cerca(real.planta.alto, 3, 0.06, 'alto');
  assert.throws(() => planoDesdeLevantamiento(lev, { id: 'Mal Id' }), /id/);
});

test('the plan from the video is a valid Architect plan (admira.xpacio-plano/1), ready for «modelar»', () => {
  const lev = levantar(salaSintetica().nube);
  const p = planoDesdeLevantamiento(lev, { id: 'sala-prueba', referencia: { tipo: 'alto', valor: 3 }, fecha: '2026-10-18' });
  assert.equal(p.schema, 'admira.xpacio-plano/1'); assert.equal(p.version, 'video-2026-10-18-1');
  assert.deepEqual(p.paredes.map(w => w.id), ['F', 'D', 'P', 'C']); assert.deepEqual(p.pantallas, []);
  assert.ok(p.mobiliario.length === 1 && p.mobiliario[0].detectado === true && p.mobiliario[0].tipo === 'mueble');
  const r = leerPlanoJson(JSON.stringify(p), 'sala-prueba'); assert.equal(r.ok, true, r.error && r.error.es);
  assert.equal(planoDesdeLevantamiento(lev, { id: 'sala-prueba', muebles: false }).mobiliario.length, 0);
});

test('a real XpaceScan cloud (Star Wars Xpacio, 11 660 points) is surveyed without failing', () => {
  const lev = levantar(leerPLY(readFileSync(new URL('./fixtures/xpacio-starwars-points.ply', import.meta.url))));
  const u = lev.unidades;
  assert.ok(u.alto < u.fondo && u.fondo <= u.ancho, 'el alto es la medida menor');
  assert.ok(['alta', 'media', 'baja'].includes(lev.confianza));
  const p = planoDesdeLevantamiento(lev, { id: 'xpacio-starwars', referencia: { tipo: 'alto', valor: 2.7 }, fecha: '2026-10-18' });
  assert.ok(p.planta.ancho > 5 && p.planta.ancho < 20 && p.planta.fondo > 3 && p.planta.fondo < 12, JSON.stringify(p.planta));
});
