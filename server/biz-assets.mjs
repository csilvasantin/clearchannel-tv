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
  if (['walk', 'detail', 'about', 'marketplace', 'backoffice', 'plano'].includes(file)) file += '.html';
  if (!assets.has(file)) return '';
  // Pages' clean URLs serve HTML without exposing the internal namespace in a
  // redirect (a direct fetch of an .html asset may redirect to its clean URL).
  const path = file === 'index.html' ? '/' : file.endsWith('/index.html') ? '/' + file.slice(0, -10) : '/' + file.replace(/\.html$/, '');
  return BIZ_ASSET_PREFIX + path;
}
