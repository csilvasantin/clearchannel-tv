import test from 'node:test';
import assert from 'node:assert/strict';
import { bizAssetPath, BIZ_ASSET_FILES } from '../server/biz-assets.mjs';
import worker from '../_worker.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('only admira.biz and its Pages verification host select the corrected assets', () => {
  for (const host of ['admira.biz','www.admira.biz','preview.clearchannel-tv.pages.dev']) {
    assert.equal(bizAssetPath(new URL('https://' + host + '/')), '/__admira_biz/');
    assert.equal(bizAssetPath(new URL('https://' + host + '/walk?locationId=xtanco-bcn')), '/__admira_biz/walk');
    assert.equal(bizAssetPath(new URL('https://' + host + '/help/')), '/__admira_biz/help/');
    assert.equal(bizAssetPath(new URL('https://' + host + '/expert-commands.js?v=20261010-evidence-1')), '/__admira_biz/expert-commands.js');
    assert.equal(bizAssetPath(new URL('https://' + host + '/intro.js?v=20261010-evidence-1')), '/__admira_biz/intro.js');
  }
  for (const host of ['clearchannel.tv','www.clearchannel.tv','admira.app','fakeadmira.biz.example']) {
    assert.equal(bizAssetPath(new URL('https://' + host + '/app.js')), '');
    assert.equal(bizAssetPath(new URL('https://' + host + '/version.json')), '');
    assert.equal(bizAssetPath(new URL('https://' + host + '/expert-commands.js')), '');
  }
});
test('API/auth and mutations keep their existing routing', () => {
  for (const path of ['/auth/agente','/api/orders','/api/demo-session','/server/biz-assets.mjs']) {
    assert.equal(bizAssetPath(new URL('https://admira.biz' + path)), '');
  }
  assert.equal(bizAssetPath(new URL('https://admira.biz/app.js'), 'POST'), '');
});
test('the worker serves JS/version by host and denies direct internal paths', async () => {
  const env = {ASSETS:{fetch(request) { return new Response(new URL(request.url).pathname, {headers:{'content-type':'application/json'}}); }}};
  assert.equal(await (await worker.fetch(new Request('https://admira.biz/app.js?v=truth'), env)).text(), '/__admira_biz/app.js');
  assert.equal(await (await worker.fetch(new Request('https://www.clearchannel.tv/app.js'), env)).text(), '/app.js');
  assert.equal(await (await worker.fetch(new Request('https://admira.biz/version.json'), env)).text(), '/__admira_biz/version.json');
  assert.equal((await worker.fetch(new Request('https://www.clearchannel.tv/__admira_biz/app.js'), env)).status, 404);
});
test('the built release serves corrected biz assets while preserving the other domains', async () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const output = mkdtempSync(join(tmpdir(), 'admira-biz-release-test-'));
  const config = JSON.parse(readFileSync(join(root, 'deployment-biz.json'), 'utf8'));
  const version = 'v.10.10.2026.r99.17:47';
  try {
    execFileSync(process.execPath, [join(root, 'scripts/build-biz-release.mjs'), output, version, 'TestAgent', 'TestMachine']);
    for (const file of BIZ_ASSET_FILES) {
      const built = readFileSync(join(output, '__admira_biz', file), 'utf8');
      if (file === 'version.json') {
        assert.equal(JSON.parse(built).version, version);
        assert.deepEqual(JSON.parse(readFileSync(join(output, file), 'utf8')), config.preservedVersion);
        continue;
      }
      assert.equal(built, readFileSync(join(root, file), 'utf8').replaceAll('__ADMIRANEXT_VERSION__', version), `scoped ${file}`);
      const baselineHasFile = spawnSync('git', ['cat-file', '-e', config.preservedRevision + ':' + file], {cwd:root, stdio:'ignore'}).status === 0;
      if (!baselineHasFile) { assert.equal(existsSync(join(output, file)), false, `no new root ${file}`); continue; }
      const baseline = execFileSync('git', ['show', config.preservedRevision + ':' + file], {cwd:root, encoding:'utf8'});
      assert.equal(readFileSync(join(output, file), 'utf8'), baseline.replaceAll('__ADMIRANEXT_VERSION__', config.preservedVersion.version), `preserved ${file}`);
    }
    const baselineHeaders = execFileSync('git', ['show', config.preservedRevision + ':_headers'], {cwd:root, encoding:'utf8'});
    const builtHeaders = readFileSync(join(output, '_headers'), 'utf8');
    assert.ok(builtHeaders.startsWith(baselineHeaders), 'existing domain cache rules are preserved');
    assert.match(builtHeaders, /\n\/__admira_biz\/version\.json\n  Cache-Control: no-store\n/);
    const env = {ASSETS:{fetch(request) {
      let path = new URL(request.url).pathname;
      if (path.endsWith('/')) path += 'index.html';
      else if (!path.split('/').pop().includes('.')) path += '.html';
      const target = join(output, path);
      return existsSync(target) ? new Response(readFileSync(target), {headers:{'content-type':'application/octet-stream'}}) : new Response('Not found', {status:404});
    }}};
    const routes = [['/','index.html'],['/app.js?v=truth','app.js'],['/walk','walk.html'],['/walk.html','walk.html'],['/walk-core.mjs?v=truth','walk-core.mjs'],['/walk-launch.mjs?v=truth','walk-launch.mjs'],['/detail','detail.html'],['/help/','help/index.html'],['/version.json','version.json']];
    for (const host of ['admira.biz','www.admira.biz','preview.clearchannel-tv.pages.dev','www.clearchannel.tv','admira.app']) {
      const scoped = ['admira.biz','www.admira.biz','preview.clearchannel-tv.pages.dev'].includes(host);
      for (const [route, file] of routes) {
        const response = await worker.fetch(new Request('https://' + host + route), env);
        assert.equal(response.status, 200, host + route);
        assert.equal(await response.text(), readFileSync(join(output, scoped ? '__admira_biz' : '', file), 'utf8'), host + route);
      }
    }
  } finally { rmSync(output, {recursive:true, force:true}); }
});
