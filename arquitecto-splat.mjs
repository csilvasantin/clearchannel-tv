// Arquitecto · escenas de SuperSplat (Carlos, 19-oct-2026: «tengo un nuevo vídeo 360 con mucho más detalle, pásaselo al
// arquitecto para que lo pase a 3D con todos los objetos separados en el ITIL»). Sin DOM salvo `decodificarWebp`.
//
// Un «splat» gaussiano (superspl.at/scene/<id>) se publica en formato SOG (splat-transform v3): un `lod-meta.json` con el
// árbol de trozos y, por trozo, `meta.json` más imágenes WebP sin pérdida: `means_l/means_u` (posición, 16 bits por eje con
// transformación logarítmica), `sh0` (color base por libro de códigos y opacidad en el alfa), `scales`, `quats` y `shN`.
// Aquí sólo hacen falta las posiciones, el color y la opacidad: cada gaussiana es un punto de la nube, ya en metros
// (los escaneos de móvil vienen a escala real), y el resto lo hace «video» (levantar) y «objetos» (separar).
// El CDN de SuperSplat responde con CORS; superspl.at no, así que el id del enlace se traduce a la URL del CDN.

export const SUPERSPLAT_CDN = 'https://d28zzqy0iyovbz.cloudfront.net';
export const SUPERSPLAT_RE = /superspl\.at\/(?:scene\/|s\?id=|view\?id=|editor\?id=)?([0-9a-f]{8})\b/i;
export const SH_C0 = 0.28209479177387814;
export const MAX_GAUSSIANAS = 1500000;   // nivel de detalle: el más fino que quepa en este tope
export const ALFA_MIN = 0.3;             // gaussianas más transparentes que esto son brumas y se dejan fuera

const limpio = s => String(s || '').trim();
// De lo que escriba la persona (enlace de superspl.at, un id de 8 hex o la URL de un lod-meta.json / meta.json) a las URL
// candidatas del lod-meta.json, en orden de prueba.
export function urlSuperSplat(texto) {
  const t = limpio(texto);
  if (!t) return null;
  const m = t.match(SUPERSPLAT_RE) || (/^[0-9a-f]{8}$/i.test(t) ? [null, t] : null);
  if (m) { const id = m[1].toLowerCase(); return { id, candidatas: [`${SUPERSPLAT_CDN}/${id}/v2/lod-meta.json`, `${SUPERSPLAT_CDN}/${id}/v1/lod-meta.json`], enlace: `https://superspl.at/scene/${id}` }; }
  if (/^https:\/\/[^\s]+\/(lod-)?meta\.json(\?.*)?$/i.test(t)) { const id = (t.match(/\/([0-9a-f]{8})\//i) || [])[1] || null; return { id, candidatas: [t], enlace: id ? `https://superspl.at/scene/${id}` : t }; }
  return null;
}

// Un trozo SOG a puntos. `imagenes` = { means_l, means_u, sh0? } ya decodificadas: { width, height, data } con RGBA de 8 bits
// (lo que da getImageData). Devuelve { n, x, y, z, rgb?, alfa? }.
export function leerSOG(meta, imagenes) {
  const n = meta && meta.count | 0, me = meta && meta.means;
  if (!(n > 0) || !me || !Array.isArray(me.mins) || !Array.isArray(me.maxs)) throw new Error('sog-meta');
  const L = imagenes && imagenes.means_l, U = imagenes && imagenes.means_u;
  if (!L || !U || L.data.length < n * 4 || U.data.length < n * 4) throw new Error('sog-means');
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), out = [x, y, z];
  const mins = me.mins.map(Number), maxs = me.maxs.map(Number);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    for (let c = 0; c < 3; c++) {
      const q = (L.data[o + c] | (U.data[o + c] << 8)) / 65535, lg = mins[c] + q * (maxs[c] - mins[c]);
      out[c][i] = Math.sign(lg) * (Math.exp(Math.abs(lg)) - 1);
    }
  }
  const nube = { n, x, y, z };
  const S = imagenes.sh0, cb = meta.sh0 && meta.sh0.codebook;
  if (S && S.data.length >= n * 4 && Array.isArray(cb) && cb.length) {
    const rgb = new Uint8Array(n * 3), alfa = new Uint8Array(n), tabla = cb.map(v => Math.max(0, Math.min(255, Math.round((0.5 + SH_C0 * Number(v)) * 255))));
    for (let i = 0; i < n; i++) { const o = i * 4; rgb[i * 3] = tabla[S.data[o]] ?? 128; rgb[i * 3 + 1] = tabla[S.data[o + 1]] ?? 128; rgb[i * 3 + 2] = tabla[S.data[o + 2]] ?? 128; alfa[i] = S.data[o + 3]; }
    nube.rgb = rgb; nube.alfa = alfa;
  }
  return nube;
}

// Varias nubes en una (mismo marco). Las que traen color lo conservan; si alguna no lo trae, el conjunto va sin color.
export function unirNubes(nubes) {
  const lista = nubes.filter(nb => nb && nb.n > 0), n = lista.reduce((t, nb) => t + nb.n, 0);
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), conColor = lista.length > 0 && lista.every(nb => nb.rgb && nb.alfa);
  const rgb = conColor ? new Uint8Array(n * 3) : null, alfa = conColor ? new Uint8Array(n) : null;
  let k = 0;
  for (const nb of lista) { x.set(nb.x, k); y.set(nb.y, k); z.set(nb.z, k); if (conColor) { rgb.set(nb.rgb, k * 3); alfa.set(nb.alfa, k); } k += nb.n; }
  return conColor ? { n, x, y, z, rgb, alfa } : { n, x, y, z };
}

// Fuera las gaussianas casi transparentes (brumas y restos). Sin alfa, la nube vuelve tal cual.
export function filtrarPorAlfa(nube, alfaMin = ALFA_MIN) {
  if (!nube || !nube.alfa || !(alfaMin > 0)) return nube;
  const tope = alfaMin * 255; let n = 0; for (let i = 0; i < nube.n; i++) if (nube.alfa[i] >= tope) n++;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), rgb = nube.rgb ? new Uint8Array(n * 3) : null, alfa = new Uint8Array(n);
  for (let i = 0, k = 0; i < nube.n; i++) {
    if (nube.alfa[i] < tope) continue;
    x[k] = nube.x[i]; y[k] = nube.y[i]; z[k] = nube.z[i]; alfa[k] = nube.alfa[i];
    if (rgb) { rgb[k * 3] = nube.rgb[i * 3]; rgb[k * 3 + 1] = nube.rgb[i * 3 + 1]; rgb[k * 3 + 2] = nube.rgb[i * 3 + 2]; }
    k++;
  }
  return rgb ? { n, x, y, z, rgb, alfa } : { n, x, y, z, alfa };
}

// Qué nivel de detalle leer: el más fino (0) cuyo recuento quepa en `maxPuntos`; si ninguno cabe, el más grueso.
export function nivelParaTope(lodMeta, maxPuntos = MAX_GAUSSIANAS) {
  const counts = Array.isArray(lodMeta && lodMeta.counts) ? lodMeta.counts : [lodMeta && lodMeta.count || 0];
  const i = counts.findIndex(c => c <= maxPuntos);
  return i < 0 ? counts.length - 1 : i;
}

// Ficheros de un nivel en el orden del lod-meta.json (carpetas `<nivel>_<k>/`).
export function trozosDeNivel(lodMeta, nivel) {
  return (Array.isArray(lodMeta && lodMeta.filenames) ? lodMeta.filenames : []).filter(f => new RegExp(`^${nivel}_\\d+/meta\\.json$`).test(f));
}

// Lee una escena de SuperSplat: lod-meta.json → trozos del nivel → nube con color, ya filtrada por opacidad.
// `decodificar(blob) → {width, height, data}` lo pone quien llama (en el navegador, decodificarWebp). `progreso(hechos, total)`.
export async function cargarSuperSplat(entrada, { fetchImpl = (...a) => fetch(...a), decodificar, maxPuntos = MAX_GAUSSIANAS, nivel = null, alfaMin = ALFA_MIN, progreso = () => {} } = {}) {
  const ref = typeof entrada === 'string' ? urlSuperSplat(entrada) : entrada;
  if (!ref || !ref.candidatas || !ref.candidatas.length) throw new Error('splat-enlace');
  if (typeof decodificar !== 'function') throw new Error('splat-decodificador');
  let base = null, lodMeta = null;
  for (const url of ref.candidatas) {
    try { const r = await fetchImpl(url, { cache: 'no-store' }); if (!r.ok) continue; lodMeta = await r.json(); base = url.replace(/[^/]*$/, ''); break; } catch { /* siguiente candidata */ }
  }
  if (!lodMeta) throw new Error('splat-no-encontrado');
  // Un meta.json suelto (un solo trozo) también vale.
  const trozos = lodMeta.filenames ? trozosDeNivel(lodMeta, nivel == null ? nivelParaTope(lodMeta, maxPuntos) : nivel) : ['meta.json'];
  if (!trozos.length) throw new Error('splat-sin-trozos');
  const nubes = []; let hechos = 0; progreso(0, trozos.length);
  for (const t of trozos) {
    const dir = base + t.replace(/meta\.json$/, ''), meta = t === 'meta.json' && !lodMeta.filenames ? lodMeta : await (await fetchImpl(base + t, { cache: 'no-store' })).json();
    const imagenes = {};
    for (const nombre of ['means_l', 'means_u', 'sh0']) {
      const fichero = nombre === 'sh0' ? (meta.sh0 && meta.sh0.files && meta.sh0.files[0]) || 'sh0.webp' : (meta.means && meta.means.files && meta.means.files[nombre === 'means_l' ? 0 : 1]) || `${nombre}.webp`;
      const r = await fetchImpl(dir + fichero, { cache: 'no-store' });
      if (!r.ok) { if (nombre === 'sh0') continue; throw new Error('splat-fichero'); }
      imagenes[nombre] = await decodificar(await r.blob());
    }
    nubes.push(leerSOG(meta, imagenes)); progreso(++hechos, trozos.length);
  }
  const todo = unirNubes(nubes), nube = filtrarPorAlfa(todo, alfaMin);
  const nivelLeido = lodMeta.filenames ? Number(trozos[0].split('_')[0]) : 0;
  return { nube, origen: { tipo: 'supersplat', id: ref.id, enlace: ref.enlace, url: base, nivel: nivelLeido, niveles: lodMeta.lodLevels || 1, gaussianas: todo.n, total: lodMeta.count || todo.n, trozos: trozos.length, alfaMin, metrica: true } };
}

// Navegador: WebP → píxeles RGBA. Sin premultiplicar el alfa, para que el color de las gaussianas translúcidas no se
// deforme (el lienzo 2D lo premultiplica por dentro: queda algo de pérdida en las muy transparentes, que se filtran igual).
export async function decodificarWebp(blob) {
  const bm = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const lienzo = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bm.width, bm.height) : Object.assign(document.createElement('canvas'), { width: bm.width, height: bm.height });
  const ctx = lienzo.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bm, 0, 0);
  const img = ctx.getImageData(0, 0, bm.width, bm.height); if (bm.close) bm.close();
  return { width: img.width, height: img.height, data: img.data };
}
