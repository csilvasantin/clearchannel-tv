import test from 'node:test';
import assert from 'node:assert/strict';
import { urlSuperSplat, leerSOG, unirNubes, filtrarPorAlfa, nivelParaTope, trozosDeNivel, cargarSuperSplat, SUPERSPLAT_CDN, SH_C0 } from '../arquitecto-splat.mjs';

// Arquitecto · SuperSplat (19-oct-2026): del enlace superspl.at/scene/<id> a una nube de puntos con color, ya en metros.

// Un trozo SOG sintético: posiciones conocidas → means_l/means_u (16 bits por eje, log) y sh0 (color por libro + alfa).
function trozo(puntos, { colores = null, alfas = null } = {}) {
  const n = puntos.length, lado = Math.ceil(Math.sqrt(n)), lg = puntos.map(p => p.map(v => Math.sign(v) * Math.log(1 + Math.abs(v))));
  const mins = [0, 1, 2].map(c => Math.min(...lg.map(p => p[c]))), maxs = [0, 1, 2].map(c => Math.max(...lg.map(p => p[c]), mins[c] + 1e-6));
  const L = new Uint8ClampedArray(lado * lado * 4), U = new Uint8ClampedArray(lado * lado * 4), S = new Uint8ClampedArray(lado * lado * 4);
  const codebook = [-1.5, 0, 1.5];   // → 0.5 + SH_C0·v
  lg.forEach((p, i) => {
    for (let c = 0; c < 3; c++) { const q = Math.round((p[c] - mins[c]) / (maxs[c] - mins[c]) * 65535); L[i * 4 + c] = q & 255; U[i * 4 + c] = q >> 8; }
    L[i * 4 + 3] = U[i * 4 + 3] = 255;
    const col = colores ? colores[i] : [1, 1, 1]; for (let c = 0; c < 3; c++) S[i * 4 + c] = col[c]; S[i * 4 + 3] = alfas ? alfas[i] : 255;
  });
  const img = d => ({ width: lado, height: lado, data: d });
  return { meta: { version: 2, count: n, means: { mins, maxs, files: ['means_l.webp', 'means_u.webp'] }, sh0: { codebook, files: ['sh0.webp'] } }, imagenes: { means_l: img(L), means_u: img(U), sh0: img(S) } };
}
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} frente a ${b}`);

test('the superspl.at link, the bare id and a direct meta URL all resolve to the CDN lod-meta.json', () => {
  const r = urlSuperSplat('https://superspl.at/scene/8f6bd2f6');
  assert.equal(r.id, '8f6bd2f6'); assert.equal(r.candidatas[0], `${SUPERSPLAT_CDN}/8f6bd2f6/v2/lod-meta.json`); assert.equal(r.enlace, 'https://superspl.at/scene/8f6bd2f6');
  assert.equal(urlSuperSplat('8F6BD2F6').id, '8f6bd2f6'); assert.equal(urlSuperSplat(' superspl.at/s?id=8f6bd2f6 ').id, '8f6bd2f6');
  assert.deepEqual(urlSuperSplat('https://otro.cdn.net/abcdef01/v2/lod-meta.json').candidatas, ['https://otro.cdn.net/abcdef01/v2/lod-meta.json']);
  assert.equal(urlSuperSplat('https://admira.biz/'), null); assert.equal(urlSuperSplat(''), null);
});

test('a SOG chunk decodes to its positions (16-bit log encoding) and its colours and opacities', () => {
  const puntos = [[0, 0, 0], [1.5, -2, 0.25], [-9.75, 3, 20], [4.8, 0.1, -0.3]], colores = [[0, 1, 2], [2, 2, 2], [1, 1, 1], [0, 0, 0]], alfas = [255, 128, 40, 0];
  const { meta, imagenes } = trozo(puntos, { colores, alfas }), nube = leerSOG(meta, imagenes);
  assert.equal(nube.n, 4);
  puntos.forEach((p, i) => { cerca(nube.x[i], p[0], 0.002, `x${i}`); cerca(nube.y[i], p[1], 0.002, `y${i}`); cerca(nube.z[i], p[2], 0.002, `z${i}`); });
  const esperado = v => Math.max(0, Math.min(255, Math.round((0.5 + SH_C0 * v) * 255)));
  assert.deepEqual([...nube.rgb.slice(0, 3)], [esperado(-1.5), esperado(0), esperado(1.5)]); assert.deepEqual([...nube.alfa], alfas);
  assert.throws(() => leerSOG({ count: 0 }, imagenes), /sog-meta/); assert.throws(() => leerSOG(meta, { means_l: imagenes.means_l }), /sog-means/);
});

test('chunks join into one cloud and the translucent gaussians are filtered out', () => {
  const a = leerSOG(...Object.values(trozo([[0, 0, 0], [1, 1, 1]], { alfas: [255, 20] }))), b = leerSOG(...Object.values(trozo([[2, 2, 2]], { alfas: [200] })));
  const todo = unirNubes([a, b]); assert.equal(todo.n, 3); assert.equal(todo.rgb.length, 9);
  const limpia = filtrarPorAlfa(todo, 0.3); assert.equal(limpia.n, 2); cerca(limpia.x[1], 2, 0.002, 'queda el tercero');
  assert.equal(filtrarPorAlfa({ n: 1, x: [0], y: [0], z: [0] }, 0.3).n, 1, 'sin alfa, tal cual');
});

test('the level of detail is the finest one under the cap, and its chunks come from the lod-meta', () => {
  const lod = { count: 4858098, counts: [2776056, 1388028, 694014], lodLevels: 3, filenames: ['1_0/meta.json', '0_0/meta.json', '2_0/meta.json', '0_1/meta.json', '1_1/meta.json'] };
  assert.equal(nivelParaTope(lod, 1500000), 1); assert.equal(nivelParaTope(lod, 3e6), 0); assert.equal(nivelParaTope(lod, 1000), 2);
  assert.deepEqual(trozosDeNivel(lod, 1), ['1_0/meta.json', '1_1/meta.json']); assert.deepEqual(trozosDeNivel(lod, 0), ['0_0/meta.json', '0_1/meta.json']);
});

test('cargarSuperSplat walks lod-meta → chunk meta → images with an injected fetch and decoder, in metres', async () => {
  const t1 = trozo([[0, 0, 0], [1, 0, 0], [0, 2, 0]], { alfas: [255, 255, 10] }), t2 = trozo([[3, 3, 3]]);
  const lod = { count: 4, counts: [4, 2], lodLevels: 2, filenames: ['1_0/meta.json', '0_0/meta.json', '0_1/meta.json'] };
  const ficheros = { 'lod-meta.json': lod, '0_0/meta.json': t1.meta, '0_1/meta.json': t2.meta, '0_0/means_l.webp': t1.imagenes.means_l, '0_0/means_u.webp': t1.imagenes.means_u, '0_0/sh0.webp': t1.imagenes.sh0, '0_1/means_l.webp': t2.imagenes.means_l, '0_1/means_u.webp': t2.imagenes.means_u, '0_1/sh0.webp': t2.imagenes.sh0 };
  const pedidos = [];
  const fetchImpl = async url => { const rel = url.replace(`${SUPERSPLAT_CDN}/8f6bd2f6/v2/`, ''); pedidos.push(rel); const f = ficheros[rel]; return f ? { ok: true, json: async () => f, blob: async () => f } : { ok: false, status: 404 }; };
  const r = await cargarSuperSplat('https://superspl.at/scene/8f6bd2f6', { fetchImpl, decodificar: async img => img, maxPuntos: 10 });
  assert.equal(r.origen.tipo, 'supersplat'); assert.equal(r.origen.nivel, 0); assert.equal(r.origen.metrica, true); assert.equal(r.origen.gaussianas, 4);
  assert.equal(r.nube.n, 3, 'la translúcida fuera'); cerca(r.nube.x[2], 3, 0.002, 'el trozo 2 detrás');
  assert.ok(pedidos.includes('0_1/sh0.webp') && !pedidos.some(p => p.startsWith('1_')), 'sólo el nivel elegido');
  await assert.rejects(cargarSuperSplat('https://superspl.at/scene/00000000', { fetchImpl, decodificar: async img => img }), /splat-no-encontrado/);
  await assert.rejects(cargarSuperSplat('nada', { fetchImpl, decodificar: async img => img }), /splat-enlace/);
});
