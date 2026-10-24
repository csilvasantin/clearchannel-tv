// Catálogo completo fuera del hilo principal (FLT-102675 · encargo #7158, 24-oct-2026).
// Lo arranca loadOmnipLocationsInWorker (locations.js) en la portada de admira.biz, después del primer pintado y en un
// momento ocioso. Aquí se hace lo que bloqueaba la portada: bajar GET /locations (~10 MB de JSON, 494 KB gzip), el
// JSON.parse y el cosido con el bundle (mergeOmnipLocations), importando el MISMO locations.js que la página (su URL
// con ?v=, que sale de la caché HTTP). Al hilo principal vuelve el catálogo cosido en trozos de `chunk` Xpacios, cada
// uno un mensaje corto, y al final una firma para saber si cambió sin volver a serializarlo.
//
// Mensajes:  entra {api, locationsSrc, timeoutMs, chunk}
//            sale  {type:'chunk', items:[…], total} …  {type:'done', count, source, updatedAt, signature}
//                  {type:'error', stage:'import'|'fetch'|'parse', error}
'use strict';
self.window = self;   // locations.js cuelga todo de window.*

function catalogoFirma(d, merged, text) {
  // La misma idea que la firma vieja de app.js (updatedAt, cuenta, extremos y tamaño serializado: el KV puede cambiar
  // por dentro sin variar cuenta ni updatedAt), pero con el tamaño del JSON recibido: sin un JSON.stringify de 10 MB.
  const n = merged.length;
  return [d.updatedAt || '', n, n ? merged[0] && merged[0].id : '', n ? merged[n - 1] && merged[n - 1].id : '', text.length].join('|');
}

self.onmessage = async function (e) {
  const o = e.data || {};
  try {
    if (typeof self.mergeOmnipLocations !== 'function') importScripts(o.locationsSrc || '/locations.js');
    if (typeof self.mergeOmnipLocations !== 'function') throw new Error('mergeOmnipLocations no está');
  } catch (err) {
    self.postMessage({ type: 'error', stage: 'import', error: String((err && err.message) || err) });
    return;
  }
  let text = '';
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), o.timeoutMs || 20000) : null;
    try {
      // no-cache: con el no-store de hoy es lo mismo; con el ETag del encargo #7156, un 304 sin descargar nada.
      const r = await fetch((o.api || self.OMNIP_API) + '/locations', { cache: 'no-cache', signal: ctrl ? ctrl.signal : undefined });
      if (!r.ok) throw new Error('http ' + r.status);
      text = await r.text();
    } finally { if (timer) clearTimeout(timer); }
  } catch (err) {
    self.postMessage({ type: 'error', stage: 'fetch', error: String((err && err.message) || err) });
    return;
  }
  try {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.locations) || !d.locations.length) throw new Error('catálogo vacío');
    const merged = self.mergeOmnipLocations(d.locations);
    const chunk = Math.max(50, (o.chunk | 0) || 500);
    for (let i = 0; i < merged.length; i += chunk) self.postMessage({ type: 'chunk', items: merged.slice(i, i + chunk), total: merged.length });
    self.postMessage({ type: 'done', count: merged.length, source: d.source || 'kv', updatedAt: d.updatedAt || null, signature: catalogoFirma(d, merged, text) });
  } catch (err) {
    self.postMessage({ type: 'error', stage: 'parse', error: String((err && err.message) || err) });
  }
};
