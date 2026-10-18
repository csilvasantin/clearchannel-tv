// Publicación automática de admira.biz (Carlos, 14-oct-2026): cada merge en main la lanza GitHub Actions con
// deploy-biz.sh; a mano sigue igual desde un Mac con el vault. Contrato del flujo y del script.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { BIZ_ASSET_FILES } from '../server/biz-assets.mjs';

const flujo = await readFile(new URL('../.github/workflows/publicar-admira-biz.yml', import.meta.url), 'utf8');
const script = await readFile(new URL('../deploy-biz.sh', import.meta.url), 'utf8');
const paquete = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('el flujo publica al mergear en main, de uno en uno y con historial completo', () => {
  assert.match(flujo, /on:\s*\n\s*push:\s*\n\s*branches: \[main\]/);
  assert.match(flujo, /workflow_dispatch:/);
  assert.match(flujo, /concurrency:\s*\n\s*group: publicar-admira-biz\s*\n\s*cancel-in-progress: false/);
  assert.match(flujo, /fetch-depth: 0/, 'build-biz-release.mjs archiva la revisión preservada de clearchannel.tv');
  assert.match(flujo, /if: github\.repository == 'csilvasantin\/clearchannel-tv'/, 'los forks no publican');
});

test('el flujo usa los secretos de Cloudflare y firma con el agente del cambio · GitHubActions', () => {
  assert.match(flujo, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(flujo, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(flujo, /HEAD\^2/, 'en un merge, el autor del PR');
  assert.match(flujo, /ADMIRA_RELEASE_MACHINE=GitHubActions/);
  assert.match(flujo, /\.\/deploy-biz\.sh/);
  assert.match(flujo, /gitShort/, 'comprueba que producción sirve el commit publicado');
  assert.match(flujo, /grep -oE '\[A-Za-z0-9_-\]\{40,\}'/, 'limpia un token mal pegado');
  assert.match(flujo, /::add-mask::\$token/, 'el token limpio también se enmascara en los logs');
});

test('no se publica en rojo: los tests corren en cada PR y antes de publicar, y luego se revisa la consola', () => {
  assert.match(flujo, /pull_request:\s*\n\s*branches: \[main\]/);
  assert.match(flujo, /tests:[\s\S]*?run: npm test/);
  assert.match(flujo, /publicar:\s*\n\s*needs: tests/, 'publicar espera a los tests');
  assert.match(flujo, /github\.event_name != 'pull_request'/, 'un PR prueba pero no publica');
  const tras = flujo.slice(flujo.indexOf('Comprobar producción'));
  assert.match(tras, /run: node tools\/consola-produccion\.mjs/, 'la consola se revisa después de comprobar el commit');
});

test('deploy-biz.sh en CI no empuja ni usa el vault, se adelanta si main ya va por delante y respeta 4 por hora', () => {
  const ci = script.slice(script.indexOf('if (( BIZ_CI )); then'), script.indexOf('BIZ_DAY='));
  const [rama, local] = ci.split(/\nelse\n/);
  assert.doesNotMatch(rama, /git push|guarda-rama/);
  assert.match(rama, /biz_al_dia \|\|/);
  assert.match(rama, /BIZ_LAST \+ 900/, '15 minutos entre publicaciones');
  assert.match(local, /source ~\/Claude\/admira-vault\/guarda-rama\.sh/);
  assert.match(local, /git push origin main/);
});

test('deploy-biz.sh sigue exigiendo firma y es bash válido', () => {
  assert.match(script, /Declare ADMIRA_RELEASE_AGENT and ADMIRA_RELEASE_MACHINE/);
  const r = spawnSync('bash', ['-n', new URL('../deploy-biz.sh', import.meta.url).pathname]);
  assert.equal(r.status, 0, String(r.stderr));
});

// En el Mac Mini el repo vive bajo ~/Documents/Admirito, cuyo package.json es «type»: «module»: sin uno propio,
// los .cjs que hacen require() de los .js clásicos daban unos 128 fallos falsos (18-oct-2026).
test('npm test da lo mismo en cualquier carpeta: package.json propio, sin «type» y fuera del release', () => {
  assert.equal(paquete.private, true);
  assert.equal('type' in paquete, false, 'con «commonjs» no carga _worker.js (ESM); con «module», los .js clásicos');
  assert.match(paquete.scripts.test, /^node (--disable-warning=MODULE_TYPELESS_PACKAGE_JSON )?--test tests\/\*\.test\.mjs tests\/\*\.test\.cjs$/);
  assert.equal(BIZ_ASSET_FILES.includes('package.json'), false, 'no se publica en admira.biz');
});
