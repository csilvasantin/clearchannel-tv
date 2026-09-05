import { STORAGE_PREFIX, httpsUrl, localeFor, surfaceKey, screenFormat, normalizeAsset, restoreCampaign, placementKey, selectionSnapshot } from './walk-core.mjs';

const copy = {
  en: {
    previewOnly:'Campaign preview · no live delivery',back:'← Back to the network',eyebrow:'Walk the campaign',headline:'See it where\nit matters.',campaign:'Your campaign',loading:'Loading the space…',perspective:'Perspective',illustration:'Illustrative placement · not a measured digital twin',yourCreative:'Your creative,\nin context.',chooseBelow:'Choose a piece from Pixeria below',light:'Preview lighting',placement:'Your placement',surface:'Surface',format:'Format',creative:'Creative',version:'Version / source date',none:'Not selected',connected:'Connected workspace',openTwin:'Explore the registered twin ↗',openStudio:'Create in Pixeria ↗',keepHere:'Your selection stays here while you work in the other tab. Choose the finished asset from the shared library when you return.',clear:'Remove creative from this surface',libraryKicker:'Pixeria / Shared creative library',libraryTitle:'Find your next impression.',refresh:'Refresh library',search:'Search creatives',importTitle:'Already have a published creative URL?',assetUrl:'HTTPS image or video URL',mediaType:'Media type',image:'Image',video:'Video',previewAsset:'Preview on this surface',footer:'Preview and planning. Nothing is purchased or sent to a player.',defaultCampaign:'My retail campaign',saved:'Saved in this tab',notSaved:'Browser storage unavailable. Keep this tab open to retain your selection.',missingLocation:'This space is not available in the catalogue. Return to the network and choose a current placement.',missingSurface:'This surface is no longer in the catalogue. Select a current surface to continue.',noSurfaces:'This space has no registered surfaces yet.',noTwin:'No digital twin is registered for this space. The scene is an illustrative preview.',twinNote:'The registered twin opens in a separate tab. The creative shown here is a local preview and is not sent to it.',spaces:'Explore XpaceOS ↗',unknownFormat:'Preview format · size not registered',missingVersion:'Not supplied',libraryLoading:'Loading the shared Pixeria library…',libraryError:'The library could not be loaded. Retry, or paste a published creative URL below.',noAssets:'No matching images or videos. Try another search or refresh after creating in the studio.',assetCount:'visual creatives',mediaLoading:'Loading the selected creative…',mediaReady:'Local preview only · original proportions preserved',mediaError:'This creative could not be displayed. Check its published URL or choose another asset.',invalidUrl:'Enter a public HTTPS image or video URL without login credentials.',imported:'Imported creative',title:'Walk the campaign',language:'Switch to Spanish',preview:'Preview',catalogFallback:'Showing the locally available catalogue; current availability has not been confirmed.',noPublish:'Nothing has been published.'
  },
  es: {
    previewOnly:'Vista previa de campaña · sin emisión',back:'← Volver a la red',eyebrow:'Recorre tu campaña',headline:'Así se verá\ntu campaña.',campaign:'Tu campaña',loading:'Cargando el espacio…',perspective:'Perspectiva',illustration:'Ubicación ilustrativa · no es un gemelo medido',yourCreative:'Tu creatividad,\nen contexto.',chooseBelow:'Elige una pieza de la biblioteca inferior',light:'Iluminación de prueba',placement:'Tu ubicación',surface:'Superficie',format:'Formato',creative:'Creatividad',version:'Versión / fecha de origen',none:'Sin seleccionar',connected:'Espacio de trabajo conectado',openTwin:'Explorar el gemelo registrado ↗',openStudio:'Crear en Admira Studio ↗',keepHere:'La selección se conserva aquí mientras trabajas en la otra pestaña. Al volver, elige la pieza terminada en la biblioteca compartida.',clear:'Quitar creatividad de esta superficie',libraryKicker:'Admira Studio / Biblioteca compartida',libraryTitle:'Encuentra tu próxima impresión.',refresh:'Actualizar biblioteca',search:'Buscar creatividades',importTitle:'¿Ya tienes una URL de la creatividad publicada?',assetUrl:'URL HTTPS de imagen o vídeo',mediaType:'Tipo de contenido',image:'Imagen',video:'Vídeo',previewAsset:'Previsualizar en esta superficie',footer:'Vista previa y planificación. No se compra ni se envía nada al player.',defaultCampaign:'Mi campaña retail',saved:'Guardado en esta pestaña',notSaved:'El almacenamiento del navegador no está disponible. Mantén esta pestaña abierta para conservar la selección.',missingLocation:'Este espacio no está disponible en el catálogo. Vuelve a la red y elige una ubicación actual.',missingSurface:'Esta superficie ya no aparece en el catálogo. Selecciona una superficie actual para continuar.',noSurfaces:'Este espacio aún no tiene superficies registradas.',noTwin:'Este espacio no tiene un gemelo digital registrado. La escena es una vista previa ilustrativa.',twinNote:'El gemelo registrado se abre en otra pestaña. La creatividad que ves aquí es una vista previa local y no se envía al gemelo.',spaces:'Explorar Admira Store ↗',unknownFormat:'Formato de prueba · tamaño sin registrar',missingVersion:'No facilitada',libraryLoading:'Cargando la biblioteca compartida de Pixeria…',libraryError:'No se ha podido cargar la biblioteca. Reintenta o pega abajo la URL de una creatividad publicada.',noAssets:'No hay imágenes o vídeos coincidentes. Prueba otra búsqueda o actualiza después de crear en el estudio.',assetCount:'creatividades visuales',mediaLoading:'Cargando la creatividad seleccionada…',mediaReady:'Vista previa local · proporciones originales conservadas',mediaError:'No se ha podido mostrar esta creatividad. Comprueba su URL publicada o elige otra pieza.',invalidUrl:'Introduce una URL HTTPS pública de imagen o vídeo sin credenciales.',imported:'Creatividad importada',title:'Recorre tu campaña',language:'Switch to English',preview:'Vista previa',catalogFallback:'Mostrando el catálogo disponible localmente; no se ha confirmado la disponibilidad actual.',noPublish:'No se ha publicado nada.'
  }
};
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let savedLang = '';
try { savedLang = localStorage.getItem('omnip-lang') || ''; } catch {}
let lang = localeFor(location.hostname, location.search, savedLang);
const campaignId = /^[a-zA-Z0-9_-]{1,100}$/.test(params.get('campaignId') || '') ? params.get('campaignId') : 'CC-' + crypto.randomUUID();
let state;
try { state = restoreCampaign(JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + campaignId)), campaignId); } catch {}
state ||= { schema:1, id:campaignId, title:copy[lang].defaultCampaign, locationId:'', surfaceId:'', placements:{}, hour:12 };
let place = null, surface = null, stock = [], selectedAsset = null, request = null, catalogueSource = 'local';
const tr = key => copy[lang][key];
let pageStatusKey = 'loading';
function setPageStatus(key) { pageStatusKey = key; $('page-status').textContent = key ? tr(key) : ''; }
copy.en.savedSelection = 'Selection saved from the network · reopen the space from the map to refresh its details.';
copy.es.savedSelection = 'Selección guardada desde la red · vuelve a abrir el espacio desde el mapa para actualizar sus datos.';
const brand = window.ADMIRA_SITE_BRAND?.name || 'Clear Channel';
const key = () => placementKey(state.locationId, state.surfaceId);

function save() {
  let saved = true;
  try { sessionStorage.setItem(STORAGE_PREFIX + campaignId, JSON.stringify(state)); } catch { saved = false; }
  $('saved').textContent = tr(saved ? 'saved' : 'notSaved');
  const next = new URL(location.href);
  next.searchParams.set('campaignId', campaignId);
  next.searchParams.set('lang', lang);
  if (state.locationId) next.searchParams.set('locationId', state.locationId);
  if (state.surfaceId) next.searchParams.set('screenId', state.surfaceId); else next.searchParams.delete('screenId');
  history.replaceState(null, '', next);
}
function links() {
  const back = new URL('/', location.origin);
  back.searchParams.set('lang', lang);
  back.searchParams.set('locationId', state.locationId);
  back.searchParams.set('campaignId', campaignId);
  const forced = params.get('brand');
  if (['admira', 'clearchannel'].includes(forced)) back.searchParams.set('brand', forced);
  $('back').href = back.href;
  document.querySelector('.wordmark').href = back.href;
  const studio = new URL(lang === 'es' ? 'https://admira.studio/publicidad.html' : 'https://www.pixeria.com/en/publicidad.html');
  // Existing Pixeria briefing fields. Return integration is intentionally not assumed.
  studio.searchParams.set('from', 'admira');
  studio.searchParams.set('campaign', state.title);
  $('studio').href = studio.href;
  $('spaces').href = lang === 'es' ? 'https://admira.store/' : 'https://www.xpaceos.com/';
  $('spaces').textContent = tr('spaces');
  $('ecosystem').textContent = lang === 'es' ? 'Admira App → Admira Studio → Admira Store' : 'Clear Channel → Pixeria → XpaceOS';
  const twin = httpsUrl(place?.twin);
  $('twin').hidden = !twin;
  if (twin) $('twin').href = twin;
  else $('twin').removeAttribute('href');
  $('twin-note').textContent = tr(twin ? 'twinNote' : 'noTwin');
}
function translate() {
  document.documentElement.lang = lang;
  document.title = tr('title') + ' · ' + brand;
  document.querySelectorAll('[data-copy]').forEach(el => { el.textContent = tr(el.dataset.copy); });
  $('language').textContent = lang === 'en' ? 'ESP' : 'ENG';
  $('language').setAttribute('aria-label', tr('language'));
  $('asset-search').placeholder = tr('search');
  setPageStatus(pageStatusKey);
  $('scene-title').textContent = place?.name || '';
  links();
}
function stopMedia() {
  const video = $('media').querySelector('video');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  $('media').replaceChildren();
}
function renderAsset() {
  stopMedia();
  selectedAsset = state.placements[key()] || null;
  $('empty-media').hidden = Boolean(selectedAsset);
  $('asset-title').textContent = selectedAsset?.title || (selectedAsset ? tr('imported') : tr('none'));
  $('asset-version').textContent = selectedAsset?.version || tr('missingVersion');
  $('clear').disabled = !selectedAsset;
  $('media-status').textContent = selectedAsset ? tr('mediaLoading') : tr('noPublish');
  if (selectedAsset) {
    const element = document.createElement(selectedAsset.type === 'image' ? 'img' : 'video');
    if (selectedAsset.type === 'image') element.alt = selectedAsset.title || tr('creative');
    else { element.controls = true; element.muted = true; element.playsInline = true; element.preload = 'metadata'; }
    element.referrerPolicy = 'no-referrer';
    element.addEventListener(selectedAsset.type === 'image' ? 'load' : 'loadedmetadata', () => { if (element.isConnected) $('media-status').textContent = tr('mediaReady'); });
    element.addEventListener('error', () => { if (element.isConnected) $('media-status').textContent = tr('mediaError'); });
    element.src = selectedAsset.url;
    $('media').append(element);
  }
  renderStock();
}
function renderSurface() {
  const list = place?.surfaces || [];
  const index = list.findIndex((s, i) => surfaceKey(place, s, i) === state.surfaceId);
  surface = list[index] || null;
  $('surface').value = surface ? state.surfaceId : '';
  $('surface-description').textContent = surface?.desc || '';
  $('screen-caption').textContent = surface?.name || tr('missingSurface');
  const format = screenFormat(surface || {});
  $('screen').classList.toggle('wide', format.ratio > 1);
  $('screen').style.aspectRatio = String(format.ratio);
  $('format-detail').textContent = format.known ? format.label : tr('unknownFormat');
  $('format-label').textContent = format.known ? format.label : tr('unknownFormat');
  $('import-form').querySelector('button').disabled = !surface;
  renderAsset();
}
function choose(asset) {
  if (!surface) return;
  const clean = normalizeAsset(asset);
  if (!clean) return;
  state.placements[key()] = clean;
  save(); renderAsset();
}
function renderStock() {
  const search = $('asset-search').value.trim().toLocaleLowerCase(lang);
  const filtered = stock.filter(asset => asset.title.toLocaleLowerCase(lang).includes(search));
  $('assets').replaceChildren();
  if (!request) $('library-status').textContent = stock.length ? `${filtered.length} ${tr('assetCount')}` : tr('noAssets');
  filtered.forEach(asset => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'asset';
    button.disabled = !surface;
    button.setAttribute('aria-pressed', String(selectedAsset?.url === asset.url));
    button.setAttribute('aria-label', tr('preview') + ': ' + (asset.title || tr(asset.type)));
    const thumb = document.createElement('span'); thumb.className = 'asset-thumb';
    if (asset.type === 'image') {
      const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = asset.url;
      img.addEventListener('error', () => { thumb.textContent = tr('image'); }); thumb.append(img);
    } else thumb.textContent = '▶ ' + tr('video');
    const title = document.createElement('span'); title.textContent = asset.title || tr(asset.type);
    button.append(thumb, title); button.addEventListener('click', () => choose(asset)); $('assets').append(button);
  });
  if (stock.length && !filtered.length) $('library-status').textContent = tr('noAssets');
}
async function loadStock() {
  if (request) request.abort();
  const controller = new AbortController(); request = controller;
  const timeout = setTimeout(() => controller.abort(), 12000);
  $('refresh').disabled = true; $('library-status').textContent = tr('libraryLoading');
  try {
    const response = await fetch('https://api.admira.store/stock/list?limit=160', { signal:controller.signal, cache:'no-store' });
    if (!response.ok) throw new Error('stock');
    const json = await response.json();
    if (!Array.isArray(json.items)) throw new Error('stock');
    stock = json.items.map(normalizeAsset).filter(Boolean); request = null; renderStock();
  } catch { if (request === controller) { request = null; $('library-status').textContent = tr('libraryError'); } }
  finally { clearTimeout(timeout); $('refresh').disabled = false; }
}
function lighting() {
  $('hour').textContent = `${state.hour}:00`;
  $('lighting').value = state.hour;
  $('stage').style.setProperty('--room-light', state.hour >= 18 ? '.55' : '1');
}
$('campaign').value = state.title;
$('campaign').addEventListener('input', e => { state.title = e.target.value; save(); links(); });
$('language').addEventListener('click', () => { lang = lang === 'en' ? 'es' : 'en'; try { localStorage.setItem('omnip-lang', lang); } catch {} translate(); save(); renderSurface(); });
$('surface').addEventListener('change', e => { state.surfaceId = e.target.value; setPageStatus(catalogueSource === 'local' ? 'catalogFallback' : catalogueSource === 'selection' ? 'savedSelection' : ''); save(); renderSurface(); });
$('clear').addEventListener('click', () => { delete state.placements[key()]; save(); renderAsset(); });
$('lighting').addEventListener('input', e => { state.hour = Number(e.target.value); lighting(); save(); });
$('view-angle').addEventListener('click', e => { const on = $('stage').classList.toggle('angle'); e.currentTarget.setAttribute('aria-pressed', String(on)); });
$('refresh').addEventListener('click', loadStock);
$('asset-search').addEventListener('input', renderStock);
$('import-form').addEventListener('submit', e => {
  e.preventDefault();
  const asset = normalizeAsset({ url:$('asset-url').value.trim(), type:$('asset-kind').value, title:tr('imported') });
  $('import-error').textContent = asset ? '' : tr('invalidUrl');
  if (asset) choose(asset);
});
translate();
setPageStatus('loading');
lighting();
async function start() {
  state.locationId = params.get('locationId') || state.locationId;
  let snapshot;
  try { snapshot = selectionSnapshot(JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + campaignId + ':selection'))); } catch {}
  if (snapshot?.id === state.locationId) { place = snapshot; catalogueSource = 'selection'; }
  else {
    const result = await window.loadOmnipLocationsAsync(4500);
    catalogueSource = result.source;
    place = result.locations.find(loc => String(loc.id) === state.locationId) || null;
  }
  if (!place) { setPageStatus('missingLocation'); save(); return; }
  if (!place.surfaces?.length) { setPageStatus('noSurfaces'); save(); return; }
  const requested = params.get('screenId') || state.surfaceId;
  const valid = place.surfaces.some((s, i) => surfaceKey(place, s, i) === requested);
  state.surfaceId = valid ? requested : requested ? '' : surfaceKey(place, place.surfaces[0], 0);
  const options = place.surfaces.map((s, i) => { const option = document.createElement('option'); option.value = surfaceKey(place, s, i); option.textContent = s.name; return option; });
  if (requested && !valid) { const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = tr('surface'); placeholder.disabled = true; options.unshift(placeholder); }
  $('surface').replaceChildren(...options);
  $('scene-address').textContent = place.addr || '';
  setPageStatus(requested && !valid ? 'missingSurface' : catalogueSource === 'local' ? 'catalogFallback' : catalogueSource === 'selection' ? 'savedSelection' : '');
  // Only import an explicit creative on the explicitly resolved placement.
  const incoming = normalizeAsset({ assetUrl:params.get('assetUrl'), assetType:params.get('assetType'), campaign:params.get('campaign') });
  if (incoming && state.surfaceId) state.placements[key()] = incoming;
  // Remove consumed media parameters so a reload cannot undo subsequent edits.
  const clean = new URL(location.href); ['assetUrl','assetType','campaign'].forEach(k => clean.searchParams.delete(k)); history.replaceState(null, '', clean);
  $('workspace').hidden = false;
  translate(); save(); renderSurface(); loadStock();
}
start().catch(() => { setPageStatus('missingLocation'); });
