import { previewUrl, selectionSnapshot, STORAGE_PREFIX } from './walk-core.mjs?v=20261010-evidence-1';

document.addEventListener('click', event => {
  const button = event.target.closest('[data-walk-preview]');
  if (!button) return;
  const context = window.getWalkPlacement?.(Number(button.dataset.walkPreview));
  if (!context) return;
  const url = new URL(previewUrl(context.location, context.surface, context.index, document.documentElement.lang, location.search), location.href);
  if (!url.searchParams.has('campaignId')) url.searchParams.set('campaignId', 'CC-' + crypto.randomUUID());
  const draft = context.draft;
  if (draft?.assetUrl && draft.locationId === context.location.id && draft.screenId === url.searchParams.get('screenId')) {
    url.searchParams.set('assetUrl', draft.assetUrl);
    url.searchParams.set('assetType', draft.assetType);
    url.searchParams.set('campaign', draft.campaign || '');
    url.searchParams.set('campaignId', draft.id);
  }
  else if (/^https:\/\//.test(String(context.surface?.media || ''))) {
    // Pantalla con adaptación asignada (p. ej. circuito Altadis): la previsualizamos.
    url.searchParams.set('assetUrl', context.surface.media);
    url.searchParams.set('assetType', 'video');
    url.searchParams.set('campaign', context.surface.campaign || ('Adaptación ' + (context.surface.orient === 'horizontal' ? '16:9' : context.surface.orient === 'vertical' ? '9:16' : '')).trim());
  }
  // The map can include locally enriched/player-registered surfaces absent from
  // the base KV catalogue. Carry the exact selected snapshot, not a guessed index.
  try { sessionStorage.setItem(STORAGE_PREFIX + url.searchParams.get('campaignId') + ':selection', JSON.stringify(selectionSnapshot(context.location))); } catch {}
  location.assign(url.href);
});
