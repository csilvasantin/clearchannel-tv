import test from 'node:test';
import assert from 'node:assert/strict';
import { levantar, escala, planoDesdeLevantamiento } from '../arquitecto-video.mjs';
import { aSala, ampliarSala, objetosDetectados, clasificar, cruzarConInventario, cisDeObjetos, FAMILIAS } from '../arquitecto-objetos.mjs';
import { leerPlanoJson } from '../plano-subida.mjs';

// Arquitecto · objetos separados (19-oct-2026): de la nube densa de un escaneo a cada mueble, lo que hay encima y lo que
// cuelga, con su código ITIL.

// Sala densa W × D × H en metros, ya en el marco del gemelo (x, altura, y) sin girar: paredes, suelo, techo y piezas.
function salaDensa({ W = 8, D = 4, H = 2.8, semilla = 11, piezas = [] } = {}) {
  let q = semilla >>> 0; const r = () => ((q = (q * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pts = [], col = [], ruido = 0.01, add = (x, y, h, c = [128, 128, 128]) => { pts.push([x + (r() - 0.5) * 2 * ruido, h + (r() - 0.5) * 2 * ruido, y + (r() - 0.5) * 2 * ruido]); col.push(c); };
  const caja = ({ x, y, w, d, base = 0, alto, color = [200, 160, 120], densidad = 60000 }) => {
    for (let i = 0; i < densidad; i++) {
      const f = r(); // tapa y cuatro caras
      if (f < 0.4) add(x + r() * w, y + r() * d, base + alto, color);
      else if (f < 0.55) add(x + r() * w, y, base + r() * alto, color); else if (f < 0.7) add(x + r() * w, y + d, base + r() * alto, color);
      else if (f < 0.85) add(x, y + r() * d, base + r() * alto, color); else add(x + w, y + r() * d, base + r() * alto, color);
    }
  };
  // Densidades del orden de un escaneo real (1,4 millones de puntos en 30 m²): suelo, techo y paredes densos.
  for (let i = 0; i < 160000; i++) add(r() * W, r() * D, 0);
  for (let i = 0; i < 60000; i++) add(r() * W, r() * D, H);
  for (let i = 0; i < 120000; i++) { add(r() * W, 0, r() * H); add(r() * W, D, r() * H); }
  for (let i = 0; i < 60000; i++) { add(0, r() * D, r() * H); add(W, r() * D, r() * H); }
  for (const p of piezas) caja(p);
  const n = pts.length, x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), rgb = new Uint8Array(n * 3);
  pts.forEach(([px, py, pz], i) => { x[i] = px + 2.5; y[i] = py - 1; z[i] = pz + 0.7; rgb.set(col[i], i * 3); });
  return { n, x, y, z, rgb };
}
const PIEZAS = [
  { x: 1, y: 0.1, w: 3, d: 0.7, alto: 0.95, color: [160, 120, 80] },                 // barra
  { x: 1.4, y: 0.25, w: 0.5, d: 0.4, base: 0.95, alto: 0.35, color: [120, 90, 60], densidad: 12000 },  // cesta sobre la barra
  { x: 3.2, y: 0.3, w: 0.4, d: 0.3, base: 0.95, alto: 0.4, color: [230, 230, 230], densidad: 12000 },  // cafetera sobre la barra
  { x: 5, y: 0.1, w: 1.2, d: 0.6, alto: 1.3, color: [90, 90, 90] },                 // vitrina (pegada a la barra, más alta)
  { x: 6.5, y: 3.4, w: 1.2, d: 0.5, base: 1.5, alto: 1.0, color: [70, 70, 70], densidad: 24000 },  // estante de pared (flota)
  { x: 2, y: 2.5, w: 0.7, d: 0.7, alto: 0.75, color: [60, 60, 60], densidad: 20000 },   // mesa
  { x: 7, y: 1, w: 0.4, d: 0.4, alto: 2.8, color: [200, 200, 200], densidad: 24000 }    // pilar
];
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} frente a ${b}`);
function separar(nube, opciones = {}) {
  const lev = levantar(nube), k = escala(lev, { tipo: 'metrica' }).k, sala = aSala(lev, nube), det = objetosDetectados(lev, k, sala, opciones);
  return { lev, k, sala, det, objetos: det.objetos.map(o => clasificar(o, { H: lev.unidades.alto * k })) };
}
const el = (objetos, tipo) => objetos.filter(o => o.tipo === tipo);
// La sala puede salir girada 180° (el levantamiento no sabe cuál es el fondo): una medida vale en su sitio o en el simétrico.
const W = 8, D = 4, enSitio = (o, x, y, tol = 0.1) => (Math.abs(o.x - x) <= tol || Math.abs(o.x - (W - x - o.w)) <= tol) && (Math.abs(o.y - y) <= tol || Math.abs(o.y - (D - y - o.d)) <= tol);

test('the metric scale is 1 unit = 1 m, and every point of the cloud lands in room coordinates', () => {
  const nube = salaDensa({ piezas: [] }), lev = levantar(nube), e = escala(lev, { tipo: 'metrica' });
  assert.equal(e.k, 1); assert.equal(e.supuesta, false); assert.equal(e.tipo, 'metrica');
  cerca(lev.unidades.ancho, 8, 0.06, 'ancho'); cerca(lev.unidades.fondo, 4, 0.06, 'fondo'); cerca(lev.unidades.alto, 2.8, 0.06, 'alto');
  const sala = aSala(lev, nube); assert.equal(sala.n, nube.n); assert.equal(sala.rgb.length, nube.n * 3);
  let dentro = 0; for (let i = 0; i < sala.n; i++) if (sala.s[i * 3] > -0.1 && sala.s[i * 3] < 8.1 && sala.s[i * 3 + 1] > -0.1 && sala.s[i * 3 + 1] < 4.1 && sala.s[i * 3 + 2] > -0.1 && sala.s[i * 3 + 2] < 2.9) dentro++;
  assert.ok(dentro / sala.n > 0.995, 'todos dentro de la sala');
  assert.throws(() => aSala({}, nube), /sin-marco/);
});

test('a counter, what sits on it, a taller display next to it, a wall shelf, a table and a pillar come out as separate objects', () => {
  const { objetos } = separar(salaDensa({ piezas: PIEZAS }));
  const barra = el(objetos, 'barra')[0]; assert.ok(barra, 'la barra'); assert.ok(enSitio(barra, 1, 0.1), 'barra en su sitio: ' + JSON.stringify(barra)); cerca(barra.w, 3, 0.15, 'barra ancho'); cerca(barra.alto, 0.95, 0.06, 'barra alto'); assert.equal(barra.clase, 'cuerpo');
  const encima = objetos.filter(o => o.clase === 'encima' && o.apoyadoEn === barra.id); assert.equal(encima.length, 2, 'dos cosas sobre la barra: ' + JSON.stringify(encima.map(o => [o.tipo, o.w, o.d, o.alto])));
  for (const o of encima) cerca(o.base, 0.95, 0.06, 'posadas en la tapa');
  assert.ok(encima.some(o => o.tipo === 'cesta'), 'la cesta es una cesta');
  const vitrina = el(objetos, 'vitrina')[0]; assert.ok(vitrina, 'la vitrina, separada de la barra por su tapa'); cerca(vitrina.alto, 1.3, 0.06, 'vitrina alto'); assert.ok(enSitio(vitrina, 5, 0.1), 'vitrina en su sitio');
  const estante = objetos.find(o => o.clase === 'flotante' && o.tipo === 'estanteria'); assert.ok(estante, 'el estante de pared'); cerca(estante.base, 1.5, 0.06, 'estante base');
  assert.ok(el(objetos, 'mesa').some(m => enSitio(m, 2, 2.5)), 'la mesa');
  assert.ok(el(objetos, 'pilar').some(p => enSitio(p, 7, 1)), 'el pilar');
  for (const o of objetos) assert.ok(o.color && o.color.length === 3, 'con color');
});

test('the room grows to the low things in front of the fitted walls, and the origin moves with it', () => {
  const nube = salaDensa({ piezas: PIEZAS }), lev = levantar(nube), sala = aSala(lev, nube);
  assert.equal(ampliarSala(lev, sala, 1), lev, 'sin nada fuera, el mismo levantamiento');
  // Puntos bajos delante de la pared F (y < 0): una cesta en el suelo fuera de la sala levantada.
  const extra = 9000, n = nube.n + extra, x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n);
  x.set(nube.x); y.set(nube.y); z.set(nube.z);
  for (let i = 0; i < extra; i++) { const px = 4 + (i % 50) / 100, py = -0.6 + ((i / 50) | 0) % 10 / 25, h = 0.06 + (i % 7) / 20; x[nube.n + i] = px + 2.5; y[nube.n + i] = h - 1; z[nube.n + i] = py + 0.7; }
  const nube2 = { n, x, y, z }, lev2 = levantar(nube2), sala2 = aSala(lev2, nube2), amp = ampliarSala(lev2, sala2, 1);
  // Según cómo quede orientada la sala, lo de delante cae en «fondo» o en «frente».
  assert.ok(amp.ampliada && amp.ampliada.fondo + amp.ampliada.frente >= 0.5, 'crece hacia delante: ' + JSON.stringify(amp.ampliada));
  cerca(amp.unidades.fondo, lev2.unidades.fondo + amp.ampliada.fondo + amp.ampliada.frente, 0.01, 'fondo nuevo');
  const s3 = aSala(amp, nube2); let min = Infinity; for (let i = 0; i < s3.n; i++) if (s3.s[i * 3 + 2] > 0.05 && s3.s[i * 3 + 2] < 1) min = Math.min(min, s3.s[i * 3 + 1]);
  assert.ok(min > -0.1, 'lo de delante ya está dentro (y ≥ 0)');
});

test('objects are crossed with the ITIL inventory: existing codes by family, then the next free ones; small things are left out', () => {
  const objetos = [
    clasificar({ id: 'obj-1', clase: 'cuerpo', x: 1, y: 0, w: 3, d: 0.7, base: 0, alto: 0.95, puntos: 9000, voxeles: 900, area: 2.1 }, { H: 2.8 }),
    clasificar({ id: 'obj-2', clase: 'cuerpo', x: 5, y: 0, w: 1.2, d: 0.6, base: 0, alto: 1.3, puntos: 5000, voxeles: 500, area: 0.72 }, { H: 2.8 }),
    clasificar({ id: 'obj-3', clase: 'encima', x: 1.4, y: 0.2, w: 0.5, d: 0.4, base: 0.95, alto: 0.35, puntos: 900, voxeles: 90, area: 0.2, apoyadoEn: 'obj-1' }, { H: 2.8 }),
    clasificar({ id: 'obj-4', clase: 'encima', x: 2.4, y: 0.2, w: 0.5, d: 0.4, base: 0.95, alto: 0.35, puntos: 900, voxeles: 90, area: 0.2, apoyadoEn: 'obj-1' }, { H: 2.8 }),
    clasificar({ id: 'obj-5', clase: 'encima', x: 3, y: 0.2, w: 0.1, d: 0.1, base: 0.95, alto: 0.12, puntos: 60, voxeles: 12, area: 0.01, apoyadoEn: 'obj-1' }, { H: 2.8 }),
    clasificar({ id: 'obj-6', clase: 'flotante', x: 6, y: 3.9, w: 1.0, d: 0.08, base: 1.2, alto: 0.6, puntos: 800, voxeles: 80, area: 0.08 }, { H: 2.8 })
  ];
  assert.deepEqual(objetos.map(o => o.tipo), ['barra', 'vitrina', 'cesta', 'cesta', 'mueble', 'pantalla']);
  assert.equal(objetos[4].menor, true); assert.equal(objetos[4].nombre, 'Objeto pequeño');
  const inventario = { units: [{ itil_code: 'PDG103-BAR-01', name: 'Barra de preparación Starbucks', category: 'mobiliario' }, { itil_code: 'PDG103-CES-01', name: 'Cesta de vasos', category: 'mobiliario' }, { itil_code: 'PDG103-PAN-01', name: 'Pantalla 1', category: 'pantalla' }, { itil_code: 'PDG103-MES-01', name: 'Mesa 1', category: 'mobiliario' }] };
  const { objetos: con, prefijo, noVistos } = cruzarConInventario(objetos, inventario);
  assert.equal(prefijo, 'PDG103');
  const por = Object.fromEntries(con.map(o => [o.id, o]));
  assert.equal(por['obj-1'].itil, 'PDG103-BAR-01'); assert.equal(por['obj-1'].itilEstado, 'existente'); assert.equal(por['obj-1'].nombre, 'Barra de preparación Starbucks');
  assert.equal(por['obj-2'].itil, 'PDG103-VIT-01'); assert.equal(por['obj-2'].itilEstado, 'propuesto');
  assert.deepEqual([por['obj-3'].itil, por['obj-4'].itil].sort(), ['PDG103-CES-01', 'PDG103-CES-02'], 'una existente y la siguiente libre');
  assert.equal(por['obj-5'].itil, null); assert.equal(por['obj-5'].itilEstado, 'menor');
  assert.equal(por['obj-6'].itil, null); assert.equal(por['obj-6'].itilEstado, 'sin-codigo');
  assert.deepEqual(noVistos.map(u => u.itil_code), ['PDG103-MES-01'], 'la mesa del inventario no se ha visto');
  // Los CI dados de alta desde un escaneo (`scan_units` del manifiesto) cuentan como existentes y ocupan su número.
  const conEscaneo = cruzarConInventario(objetos, { units: inventario.units, scan_units: [{ itil_code: 'PDG103-CES-02', name: 'Cesta 02', category: 'mobiliario' }, { itil_code: 'PDG103-CES-03', name: 'Cesta 03', category: 'mobiliario' }] });
  assert.deepEqual(conEscaneo.objetos.filter(o => o.tipo === 'cesta').map(o => o.itil).sort(), ['PDG103-CES-01', 'PDG103-CES-02']); assert.ok(conEscaneo.objetos.every(o => o.itil !== 'PDG103-CES-03' || o.itilEstado === 'existente'));
  // Sin inventario: prefijo del id del local y códigos nuevos desde 01.
  const sin = cruzarConInventario(objetos.slice(0, 2), null, { localId: 'cafe-gracia' }); assert.equal(sin.prefijo, 'CAFEGRACIA'); assert.equal(sin.objetos[0].itil, 'CAFEGRACIA-BAR-01');
  // Altas propuestas con los campos de itil_ci_upsert; lo de encima cuelga de su mueble.
  const cis = cisDeObjetos(con, { local: 'alsea-sbux-021', escena: 'superspl.at/scene/8f6bd2f6', fecha: '2026-10-19' });
  assert.deepEqual(cis.map(c => c.itil_code).sort(), ['PDG103-CES-02', 'PDG103-VIT-01']);
  const cesta = cis.find(c => c.itil_code === 'PDG103-CES-02'); assert.equal(cesta.parent_itil_code, 'PDG103-BAR-01'); assert.equal(cesta.category, 'mobiliario'); assert.match(cesta.role, /escaneo 3D superspl\.at\/scene\/8f6bd2f6 \(2026-10-19\)/); assert.ok(cesta.role.length <= 120);
  for (const c of cis) { assert.match(c.itil_code, /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){1,3}$/); assert.ok(['mobiliario', 'iluminacion', 'pantalla'].includes(c.category)); assert.ok(c.name.length >= 2 && c.name.length <= 160); }
  assert.equal(FAMILIAS.lampara, 'LUM');
});

test('the plan from a SuperSplat scan carries the separated objects with base, height and ITIL code, and is a valid plan', () => {
  const nube = salaDensa({ piezas: PIEZAS }), { lev, k, objetos } = separar(nube);
  const { objetos: con } = cruzarConInventario(objetos, { units: [{ itil_code: 'PDG103-BAR-01', name: 'Barra', category: 'mobiliario' }] });
  const p = planoDesdeLevantamiento(lev, { id: 'alsea-sbux-021', nombre: 'Prueba', referencia: { tipo: 'metrica' }, objetos: con, origen: { tipo: 'supersplat', enlace: 'https://superspl.at/scene/8f6bd2f6' }, fecha: '2026-10-19' });
  assert.equal(p.version, 'splat-2026-10-19-1'); assert.match(p.fuente.titulo, /SuperSplat/); assert.match(p.fuente.titulo, /ya está en metros/); assert.equal(p.fuente.escena, 'https://superspl.at/scene/8f6bd2f6');
  assert.equal(p.fuente.referencia.tipo, 'metrica'); assert.equal(p.fuente.objetos.total, con.length); assert.ok(p.fuente.objetos.propuestos > 0);
  const barra = p.mobiliario.find(m => m.itil === 'PDG103-BAR-01'); assert.ok(barra, 'la barra con su código'); assert.equal(barra.tipo, 'barra'); assert.equal(barra.itilEstado, 'existente'); assert.equal(barra.detectado, true);
  const encima = p.mobiliario.filter(m => m.apoyadoEn === barra.id); assert.ok(encima.length >= 2 && encima.every(m => m.base > 0.9), 'lo de encima con su base');
  const r = leerPlanoJson(JSON.stringify(p), 'alsea-sbux-021'); assert.equal(r.ok, true, r.error && r.error.es);
  cerca(p.planta.alto, lev.unidades.alto * k, 0.01, 'alto en metros');
});
