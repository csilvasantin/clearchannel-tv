// Shared, side-effect-free contract for the campaign preview. No player writes.
export const STORAGE_PREFIX = 'campaign-walk:v1:';
export function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function localeFor(hostname, search = '', saved = '') {
  const p = new URLSearchParams(search);
  if (['en', 'es'].includes(p.get('lang'))) return p.get('lang');
  if (['en', 'es'].includes(saved)) return saved;
  return p.get('brand') === 'admira' || /(^|\.)admira\.(app|biz)$/i.test(hostname) ? 'es' : 'en';
}
export function surfaceKey(location, surface, index) {
  return String(surface.screen || surface.id || `${location.id}:${surface.surface || 'surface'}:${surface.name}:${index}`);
}
export function screenFormat(surface) {
  const match = String(surface.desc || '').match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (match) return { ratio: Number(match[1]) / Number(match[2]), known: true, label: `${match[1]} × ${match[2]}` };
  if (surface.orientation === 'landscape') return { ratio: 16 / 9, known: true, label: '16:9' };
  if (surface.orientation === 'portrait') return { ratio: 9 / 16, known: true, label: '9:16' };
  return { ratio: 9 / 16, known: false, label: '9:16' };
}
export function normalizeAsset(raw) {
  const url = httpsUrl(raw?.url || raw?.assetUrl);
  const type = raw?.type || raw?.assetType;
  if (!url || !['image', 'video', 'animation'].includes(type)) return null;
  return { id: String(raw.id || url).slice(0, 2048), url, type: type === 'image' ? 'image' : 'video', title: String(raw.title || raw.campaign || '').slice(0, 160), version: String(raw.version || raw.updatedAt || raw.createdAt || '').slice(0, 80) };
}
export function restoreCampaign(raw, id) {
  if (!raw || raw.schema !== 1 || raw.id !== id || typeof raw.placements !== 'object' || !raw.placements) return null;
  const placements = {};
  Object.entries(raw.placements).slice(0, 100).forEach(([key, asset]) => { const safe = normalizeAsset(asset); if (safe) placements[key] = safe; });
  return { schema: 1, id, title: String(raw.title || '').slice(0, 100), locationId: String(raw.locationId || ''), surfaceId: String(raw.surfaceId || ''), placements, hour: Math.max(8, Math.min(22, Number(raw.hour) || 12)) };
}
export function previewUrl(location, surface, index, lang, search = '') {
  const p = new URLSearchParams({ locationId: location.id, screenId: surfaceKey(location, surface, index), lang });
  const brand = new URLSearchParams(search).get('brand');
  if (['admira', 'clearchannel'].includes(brand)) p.set('brand', brand);
  const campaignId = new URLSearchParams(search).get('campaignId');
  if (/^[a-zA-Z0-9_-]{1,100}$/.test(campaignId || '')) p.set('campaignId', campaignId);
  return 'walk.html?' + p;
}
export function placementKey(locationId, surfaceId) { return JSON.stringify([locationId, surfaceId]); }
export function selectionSnapshot(raw) {
  if (!raw?.id || !Array.isArray(raw.surfaces)) return null;
  const snapshot = {
    id:String(raw.id).slice(0, 200), name:String(raw.name || '').slice(0, 200), addr:String(raw.addr || '').slice(0, 400), twin:httpsUrl(raw.twin),
    surfaces:raw.surfaces.slice(0, 200).filter(s => s && typeof s === 'object').map(s => Object.fromEntries(['id','name','desc','screen','surface','orientation'].filter(k => s[k] != null).map(k => [k,String(s[k]).slice(0, 500)])))
  };
  // Keep catalogue evidence, never a connection state copied from another page.
  // An own empty xpaceUrl explicitly removes a curated association.
  if (Object.hasOwn(raw, 'xpaceUrl')) snapshot.xpaceUrl = httpsUrl(raw.xpaceUrl);
  if (typeof raw.circuit === 'string') snapshot.circuit = raw.circuit.slice(0, 200);
  for (const flag of ['demo', 'testCircuit']) if (typeof raw[flag] === 'boolean') snapshot[flag] = raw[flag];
  if (raw.external && typeof raw.external === 'object') {
    snapshot.external = {};
    if (typeof raw.external.testCircuit === 'boolean') snapshot.external.testCircuit = raw.external.testCircuit;
    if (typeof raw.external.source === 'string') snapshot.external.source = raw.external.source.slice(0, 200);
  }
  raw.surfaces.slice(0, 200).filter(s => s && typeof s === 'object').forEach((s, index) => {
    for (const flag of ['demo', 'testCircuit']) if (typeof s[flag] === 'boolean') snapshot.surfaces[index][flag] = s[flag];
    if (s.external && typeof s.external === 'object') {
      const external = {};
      if (typeof s.external.testCircuit === 'boolean') external.testCircuit = s.external.testCircuit;
      if (typeof s.external.source === 'string') external.source = s.external.source.slice(0, 200);
      if (Object.keys(external).length) snapshot.surfaces[index].external = external;
    }
  });
  return snapshot;
}
