// Publicación automática de admira.biz (Carlos, 14-oct-2026): cada merge en main la lanza GitHub Actions con
// deploy-biz.sh; a mano sigue igual desde un Mac con el vault. Contrato del flujo y del script.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const flujo = await readFile(new URL('../.github/workflows/publicar-admira-biz.yml', import.meta.url), 'utf8');
const script = await readFile(new URL('../deploy-biz.sh', import.meta.url), 'utf8');

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
