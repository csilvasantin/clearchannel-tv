// The customer domains share one Pages project. A scoped release keeps the
// existing Clear Channel assets at the root and selects updated files only for
// admira.biz (and the Pages preview used to verify that release).
export const BIZ_ASSET_PREFIX = '/__admira_biz';
export const BIZ_ASSET_FILES = Object.freeze([
  'index.html', 'app.js', 'inventory-evidence.js', 'expert-commands.js', 'intro.js', 'detail.html',
  'walk.html', 'walk.mjs', 'walk-launch.mjs', 'walk-core.mjs', 'walk.css', 'help/index.html', 'version.json'
]);
const assets = new Set(BIZ_ASSET_FILES);

export function bizAssetPath(url, method = 'GET') {
  if (method !== 'GET' && method !== 'HEAD') return '';
  if (!/^(?:www\.)?admira\.biz$/i.test(url.hostname)
      && !/(?:^|\.)clearchannel-tv\.pages\.dev$/i.test(url.hostname)) return '';
  let file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (file === 'help' || file === 'help/') file = 'help/index.html';
  if (file === 'walk' || file === 'detail') file += '.html';
  if (!assets.has(file)) return '';
  // Pages' clean URLs serve HTML without exposing the internal namespace in a
  // redirect (a direct fetch of an .html asset may redirect to its clean URL).
  const path = file === 'index.html' ? '/' : file === 'help/index.html' ? '/help/' : '/' + file.replace(/\.html$/, '');
  return BIZ_ASSET_PREFIX + path;
}
