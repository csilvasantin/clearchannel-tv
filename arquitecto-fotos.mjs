// Estudio del Arquitecto (DCL-66d9ae0d5e756d0067127f24): fotos y vídeo → imágenes listas para POST /xpacio/estimar
// (el endpoint de la vía «Con foto o vídeo» de la Creación de Xpacios, en pixer-eleven). En el navegador: cada foto se
// reescala a 1600 px y JPEG (≤ 1,5 MB, el tope del endpoint) y de un vídeo se sacan fotogramas repartidos por su
// duración. Nada sale del navegador hasta que el usuario pulsa «Estimar»; el endpoint no guarda las fotos.
export const MAX_FOTOS = 8;
export const LADO = 1600;
export const MAX_BYTES = 1.5 * 1024 * 1024;
const bytesDe = dataUrl => Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);

function lienzo(fuente, w, h) {
  const k = Math.min(1, LADO / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(fuente, 0, 0, c.width, c.height);
  return c;
}
function aJpeg(c) {
  for (const q of [0.85, 0.75, 0.62, 0.5]) { const d = c.toDataURL('image/jpeg', q); if (bytesDe(d) <= MAX_BYTES) return d; }
  return null;
}
async function deImagen(file) {
  const bmp = await createImageBitmap(file);
  try { return aJpeg(lienzo(bmp, bmp.width, bmp.height)); } finally { bmp.close && bmp.close(); }
}
function espera(el, ev, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('video-' + ev)), ms);
    el.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
    el.addEventListener('error', () => { clearTimeout(t); reject(new Error('video')); }, { once: true });
  });
}
async function deVideo(file, n) {
  const url = URL.createObjectURL(file), v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  try {
    await espera(v, 'loadedmetadata');
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0, out = [];
    for (let k = 0; k < n; k++) {
      v.currentTime = dur ? Math.min(dur - 0.05, (k + 0.5) * dur / n) : 0;
      await espera(v, 'seeked');
      const d = aJpeg(lienzo(v, v.videoWidth, v.videoHeight));
      if (d) out.push(d);
      if (!dur) break;
    }
    return out;
  } finally { URL.revokeObjectURL(url); v.removeAttribute('src'); }
}
// files (FileList o array) → { fotos: [dataURL…], descartes: [{nombre, motivo}] }. Los vídeos se reparten el cupo.
export async function prepararFotos(files) {
  const lista = Array.from(files || []), fotos = [], descartes = [];
  const videos = lista.filter(f => /^video\//.test(f.type)), imagenes = lista.filter(f => /^image\/(jpeg|png|webp|heic|heif|gif|bmp)$/.test(f.type));
  for (const f of lista) if (!videos.includes(f) && !imagenes.includes(f)) descartes.push({ nombre: f.name, motivo: 'formato' });
  for (const f of imagenes) {
    if (fotos.length >= MAX_FOTOS) { descartes.push({ nombre: f.name, motivo: 'tope' }); continue; }
    try { const d = await deImagen(f); if (d) fotos.push(d); else descartes.push({ nombre: f.name, motivo: 'grande' }); } catch { descartes.push({ nombre: f.name, motivo: 'ilegible' }); }
  }
  for (const [i, f] of videos.entries()) {
    const libres = MAX_FOTOS - fotos.length; if (libres <= 0) { descartes.push({ nombre: f.name, motivo: 'tope' }); continue; }
    try { fotos.push(...await deVideo(f, Math.max(1, Math.floor(libres / (videos.length - i))))); } catch { descartes.push({ nombre: f.name, motivo: 'ilegible' }); }
  }
  return { fotos: fotos.slice(0, MAX_FOTOS), descartes };
}
// POST /xpacio/estimar ({fotos, tipo, notas, lang}) → {ok, estimacion, …} o {ok:false, error}.
export async function estimar(url, { fotos, tipo, notas, lang }, fetcher = fetch) {
  let r;
  try { r = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos, tipo, notas: String(notas || '').slice(0, 500), lang }) }); }
  catch { return { ok: false, error: 'sin-conexion' }; }
  let d = null;
  try { d = await r.json(); } catch {}
  if (!r.ok || !d || d.ok !== true || !d.estimacion) return { ok: false, error: (d && d.error) || `http-${r.status}` };
  return d;
}
