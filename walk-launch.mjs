import { previewUrl, selectionSnapshot, STORAGE_PREFIX } from './walk-core.mjs';

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
  // The map can include locally enriched/player-registered surfaces absent from
  // the base KV catalogue. Carry the exact selected snapshot, not a guessed index.
  try { sessionStorage.setItem(STORAGE_PREFIX + url.searchParams.get('campaignId') + ':selection', JSON.stringify(selectionSnapshot(context.location))); } catch {}
  location.assign(url.href);
});
