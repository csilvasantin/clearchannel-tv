import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escalaFoto, fotosPorPared, nombrePared, esEquirectangular, tamanos360, vistaDesdePixel, pixelDesdeVista, rutas360, urlDe, bloquePanorama, revisarPanorama, SIN_PARED, LADOS_360 } from '../arquitecto-galeria.mjs';

// Arquitecto · «fotos» (18-oct-2026): fotos del local por pared y su 360 como vista Matrix del gemelo.
const PLANO = JSON.parse(readFileSync(new URL('../data/xpacios/alsea-sbux-021.json', import.meta.url), 'utf8'));

test('wall photos are kept at 1600 px at most and grouped by the plan walls, in their order', () => {
  assert.deepEqual(escalaFoto(4032, 3024), { w: 1600, h: 1200 }); assert.deepEqual(escalaFoto(800, 600), { w: 800, h: 600 });
  const g = fotosPorPared([{ id: 1, pared: 'D' }, { id: 2, pared: 'F' }, { id: 3, pared: 'X' }, { id: 4, pared: 'F' }], PLANO);
  assert.deepEqual([...g.keys()], ['F', 'D', 'P', 'C', SIN_PARED]);
  assert.deepEqual(g.get('F').map(f => f.id), [2, 4]); assert.deepEqual(g.get(SIN_PARED).map(f => f.id), [3], 'una pared que no existe va a «sin pared»');
  assert.equal(nombrePared(PLANO, 'F'), 'F · Fondo · barra');
});

test('a 360 photo is equirectangular 2:1 and gets three sizes, never enlarged', () => {
  assert.ok(esEquirectangular(8192, 4096) && esEquirectangular(5760, 2880)); assert.ok(!esEquirectangular(4032, 3024) && !esEquirectangular(1000, 500));
  assert.deepEqual(tamanos360(11904, 5952), { src: { w: LADOS_360.src, h: 4096 }, srcMovil: { w: 4096, h: 2048 }, previa: { w: 2400, h: 1200 } });
  assert.deepEqual(tamanos360(3000, 1500).src, { w: 3000, h: 1500 }); assert.throws(() => tamanos360(4000, 3000), /no-360/);
});

test('photo pixel ↔ view direction matches the centres viewer (Paseo de Gràcia starting view)', () => {
  const base = [8192, 4096];
  assert.deepEqual(vistaDesdePixel(4096, 2048, base), { yaw: 0, pitch: 0 }, 'el centro de la foto se ve de frente');
  const [x, y] = pixelDesdeVista(PLANO.panorama.vista.yaw, PLANO.panorama.vista.pitch, base);
  // La vista inicial de Paseo de Gràcia mira al mural de menús (pantallas en x 7019–7843): la cruz cae en esa zona.
  assert.ok(x > 7000 && x < 8192 && y > 2000 && y < 2600, `${x}, ${y}`);
  for (const [px, py] of [[100, 300], [5000, 3900], [8000, 10]]) { const v = vistaDesdePixel(px, py, base), [qx, qy] = pixelDesdeVista(v.yaw, v.pitch, base); assert.ok(Math.abs(qx - px) <= 1 && Math.abs(qy - py) <= 1); }
});

test('the panorama block follows the centres schema, with published paths for xpaceos and admira.store', () => {
  const b = bloquePanorama({ id: 'starbucks-diagonal', base: [8192, 4096], vista: { yaw: 10, pitch: -5 }, pantallas: [{ id: 'PANTALLA-01', esquinas: [[110, 220], [100, 100], [200, 100], [210, 220]] }] });
  assert.deepEqual(Object.keys(b), ['src', 'srcMovil', 'previa', 'base', 'vista', 'pantallas', 'origen']);
  assert.deepEqual(b.src, rutas360('starbucks-diagonal').src); assert.equal(b.src, '/xpacios/360/starbucks-diagonal/starbucks-diagonal-360.webp');
  assert.deepEqual(b.pantallas[0].esquinas, [[100, 100], [200, 100], [210, 220], [110, 220]], 'esquinas ordenadas: arriba-izq, arriba-dcha, abajo-dcha, abajo-izq');
  assert.deepEqual(b.vista, { yaw: 10, pitch: -5, fov: 100, sphereX: 0, sphereY: 0 });
  assert.equal(urlDe(b.previa), 'https://www.xpaceos.com/xpacios/360/starbucks-diagonal/starbucks-diagonal-360-previa.jpg');
  assert.equal(rutas360('x', 'jpg').src, '/xpacios/360/x/x-360.jpg'); assert.throws(() => bloquePanorama({ id: 'Mal' }), /id/);
});

test('the review catches what would break the Matrix view before publishing', () => {
  assert.equal(revisarPanorama(PLANO.panorama).ok, true, 'la 360 de Paseo de Gràcia es válida');
  const b = bloquePanorama({ id: 'x', base: [8192, 4096], pantallas: [{ id: 'A', esquinas: [[0, 0], [10, 0], [10, 10], [0, 10]] }] });
  const mal = r => revisarPanorama(r).errores;
  assert.ok(mal({ ...b, base: [4000, 3000] }).includes('base'));
  assert.ok(mal({ ...b, pantallas: [...b.pantallas, b.pantallas[0]] }).includes('pantalla-A-repetida'));
  assert.ok(mal({ ...b, pantallas: [{ id: 'B', esquinas: [[0, 0], [10, 10], [10, 0], [0, 10]] }] }).includes('pantalla-B-cruzada'));
  assert.ok(mal({ ...b, pantallas: [{ id: 'C', esquinas: [[0, 0], [9000, 0], [9000, 10], [0, 10]] }] }).includes('pantalla-C-fuera'));
  // Una pantalla que cruza el borde de la foto (como PG103-MENU-04) vale, y sus esquinas se ordenan desenvueltas.
  assert.equal(revisarPanorama({ ...b, pantallas: [{ id: 'D', esquinas: [[8022, 1550], [20, 1548], [20, 1862], [8025, 1864]] }] }).ok, true);
  const cruzada = bloquePanorama({ id: 'x', base: [8192, 4096], pantallas: [{ id: 'D', esquinas: [[20, 1862], [8022, 1550], [8025, 1864], [20, 1548]] }] });
  assert.deepEqual(cruzada.pantallas[0].esquinas, [[8022, 1550], [20, 1548], [20, 1862], [8025, 1864]]);
  assert.deepEqual(revisarPanorama({ ...b, pantallas: [] }).avisos, ['sin-pantallas']);
});

test('the Paseo de Gràcia plan carries its real 360 for the twin’s Matrix view', () => {
  const p = PLANO.panorama;
  assert.equal(p.src, '/xpacios/starbucks-centros/referencias/paseo-gracia-103.webp'); assert.deepEqual(p.base, [8192, 4096]);
  assert.equal(p.pantallas.length, 6); assert.ok(p.pantallas.every(s => /^PG103-MENU-0\d$/.test(s.id)));
});
