// The customer domains share one Pages project. A scoped release keeps the
// existing Clear Channel assets at the root and selects updated files only for
// admira.biz (and the Pages preview used to verify that release).
export const BIZ_ASSET_PREFIX = '/__admira_biz';
export const BIZ_ASSET_FILES = Object.freeze([
  'suite/experto.js', 'suite/experto.css', 'suite/demo-ios.mjs', 'suite/demo-android.mjs', 'suite/biz-native-context.js',
  'galaxy-shell.js', 'expert-panel.js', 'responsive-shell.js',
  'index.html', 'app.js', 'planner-core.js', 'inventory-evidence.js', 'expert-commands.js', 'intro.js', 'detail.html',
  'walk.html', 'walk.mjs', 'walk-launch.mjs', 'walk-core.mjs', 'walk.css', 'help/index.html',
  // /redistribucion (FLT-102063): plano y obras del Xpacio; ▤ Subir plano (DCL-58288891486617b36ed8777d);
  // laboratorio de Gran de Gràcia 51 (DCL-6ae9d5b0e2d48ee2fd9c7b19).
  'plano.html', 'plano.mjs', 'plano-core.mjs', 'plano-subida.mjs', 'plano.css', 'data/xpacios/alsea-sbux-021.json',
  'data/xpacios/lab-gran-de-gracia-51.json',
  // ▤ Creación de Xpacios (DCL-35708977d7b8520386dad95f): planos inventados por tipo; «Con foto o vídeo»
  // (DCL-ddf3203078fe9471f3796130): estimación con Gemini Pro en api.admira.store/xpacio/estimar.
  'plano-generador.mjs', 'plano-foto.mjs',
  // ▤ Creador de incidencias (DCL-34d5bbccb9cc227bb752a419): mando de fallos de laboratorio + agente detector.
  'plano-incidencias.mjs', 'plano-incidencias.css', 'incidencias-core.mjs', 'incidencias-adaptadores.mjs',
  // Bugito (DCL-5da4653d859552490fd5ae1d): banco de pruebas del Creador de incidencias (admira.biz/bugito).
  'bugito.html', 'bugito.mjs', 'bugito.css', 'bugito-core.mjs', 'bugito-objetivos.json', 'bugito-super.js',
  // Estudio del Arquitecto (DCL-66d9ae0d5e756d0067127f24): /arquitecto crear · reformar · inventariar (admira.biz/arquitecto).
  'arquitecto.html', 'arquitecto.mjs', 'arquitecto.css', 'arquitecto-core.mjs', 'arquitecto-dibujo.mjs', 'arquitecto-fotos.mjs',
  // El laboratorio también como ficha del mapa (OMNIP_LOCATIONS_EXTRA): sin tocar el catálogo KV.
  'locations.js',
  'about.html', 'marketplace.html', 'players/index.html', 'page-language.css',
  'backoffice.html', 'central-project-backoffice.mjs', 'tutorial/index.html',
  'demo/index.html', 'demo/demo.mjs', 'version.json',
  'mcp/native-players.md', 'mcp/player-sync-evidence/fronteras.json',
  'mcp/player-sync-evidence/reapertura.json', 'mcp/player-sync-evidence/por-pieza.json'
]);
const assets = new Set(BIZ_ASSET_FILES);

export function bizAssetPath(url, method = 'GET') {
  if (method !== 'GET' && method !== 'HEAD') return '';
  if (!/^(?:www\.)?admira\.biz$/i.test(url.hostname)
      && !/(?:^|\.)clearchannel-tv\.pages\.dev$/i.test(url.hostname)) return '';
  let file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (/^(help|players|tutorial|demo)\/?$/.test(file)) file = file.replace(/\/$/, '') + '/index.html';
  if (['walk', 'detail', 'about', 'marketplace', 'backoffice', 'plano', 'bugito', 'arquitecto'].includes(file)) file += '.html';
  if (!assets.has(file)) return '';
  // Pages' clean URLs serve HTML without exposing the internal namespace in a
  // redirect (a direct fetch of an .html asset may redirect to its clean URL).
  const path = file === 'index.html' ? '/' : file.endsWith('/index.html') ? '/' + file.slice(0, -10) : '/' + file.replace(/\.html$/, '');
  return BIZ_ASSET_PREFIX + path;
}
