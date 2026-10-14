// Estudio del Arquitecto (DCL-66d9ae0d5e756d0067127f24): fotos y vídeo → imágenes para POST /xpacio/estimar, con las
// reglas de «Con foto o vídeo» de la Creación de Xpacios (plano-foto.mjs, DCL-ddf3203078fe9471f3796130): qué se admite
// (clasificarFicheros), cuántos fotogramas y dónde (tiemposFotogramas), los escalones de tamaño y calidad hasta caber en
// 1,5 MB (ESCALONES), la URL del estimador (urlEstimador: en producción siempre api.admira.store) y los errores
// (claveError). Aquí sólo el lienzo del navegador. Nada sale del navegador hasta pulsar el botón; el worker no guarda fotos.
import { MAX_FOTOS, MAX_BYTES_FOTO, ESCALONES, ESPERA_ESTIMADOR, escalaFoto, tiemposFotogramas, bytesDataUrl, clasificarFicheros, claveError, urlEstimador } from './plano-foto.mjs?v=20261014-foto-1';

export { MAX_FOTOS, urlEstimador };
function aJpeg(fuente, w, h) {
  for (const { lado, calidad } of ESCALONES) {
    const t = escalaFoto(w, h, lado), c = document.createElement('canvas');
    c.width = t.w; c.height = t.h;
    c.getContext('2d').drawImage(fuente, 0, 0, t.w, t.h);
    const d = c.toDataURL('image/jpeg', calidad);
    if (bytesDataUrl(d) <= MAX_BYTES_FOTO) return d;
  }
  return null;
}
async function deImagen(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try { return aJpeg(bmp, bmp.width, bmp.height); } finally { bmp.close && bmp.close(); }
}
function espera(el, ev, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('video-' + ev)), ms);
    el.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
    el.addEventListener('error', () => { clearTimeout(t); reject(new Error('video')); }, { once: true });
  });
}
async function deVideo(file) {
  const url = URL.createObjectURL(file), v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  try {
    await espera(v, 'loadedmetadata');
    let dur = v.duration;
    if (!Number.isFinite(dur)) { v.currentTime = 1e7; await espera(v, 'seeked'); dur = v.duration; }   // webm sin duración en la cabecera
    const out = [];
    for (const t of tiemposFotogramas(dur)) { v.currentTime = t; await espera(v, 'seeked'); const d = aJpeg(v, v.videoWidth, v.videoHeight); if (d) out.push(d); }
    return out;
  } finally { URL.revokeObjectURL(url); v.removeAttribute('src'); }
}
// files (FileList o array) → { fotos: [dataURL…], errores: [{fichero, error}] } (un vídeo, o hasta 8 fotos).
export async function prepararFotos(files) {
  const { video, fotos: imagenes, errores } = clasificarFicheros(files);
  const fotos = [];
  if (video) { try { fotos.push(...await deVideo(video)); } catch { errores.push({ fichero: video.name, error: 'ilegible' }); } }
  for (const f of imagenes) { try { const d = await deImagen(f); if (d) fotos.push(d); else errores.push({ fichero: f.name, error: 'phTooBig' }); } catch { errores.push({ fichero: f.name, error: 'ilegible' }); } }
  return { fotos: fotos.slice(0, MAX_FOTOS), errores };
}
// POST /xpacio/estimar ({fotos, tipo, notas, lang}) → la respuesta {ok, estimacion, modelo, …} o {ok:false, error: clave}.
export async function estimar(url, { fotos, tipo, notas, lang }, fetcher = fetch) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ESPERA_ESTIMADOR);
  let r;
  try { r = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos, tipo, notas: String(notas || '').slice(0, 500), lang }), signal: ctl.signal }); }
  catch (e) { return { ok: false, error: e && e.name === 'AbortError' ? 'phTimeout' : 'phError' }; }
  finally { clearTimeout(t); }
  let d = null;
  try { d = await r.json(); } catch {}
  if (!r.ok || !d || d.ok !== true || !d.estimacion) return { ok: false, error: claveError(r.status, d) };
  return d;
}
