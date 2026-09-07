import assert from 'node:assert/strict';
import { ADMIRA_HOST, replaceBrand } from '../_worker.js';

assert.equal(ADMIRA_HOST.test('admira.app'), true);
assert.equal(ADMIRA_HOST.test('www.admira.app'), true);
assert.equal(ADMIRA_HOST.test('clearchannel.tv'), false);
assert.equal(ADMIRA_HOST.test('fakeadmira.app.example'), false);

assert.equal(replaceBrand('Clear Channel'), 'Admira App');
assert.equal(replaceBrand('CLEAR·CHANNEL'), 'ADMIRA·APP');
assert.equal(replaceBrand('https://www.clearchannel.tv/about.html'), 'https://www.admira.app/about.html');
assert.equal(replaceBrand('clearchannel.tv · RetailMedia'), 'admira.app · RetailMedia');

console.log('brand worker: ok');

// La puerta MCP de admira.app habla de admira.app (7-sep-2026): el manifest y el
// llms.txt propios existen, no arrastran la marca gemela y el worker los sirve
// cuando el Host es admira.app — y NO cuando es clearchannel.tv.
import { readFile } from 'node:fs/promises';
import worker, { ADMIRA_MCP_FILES } from '../_worker.js';

assert.equal(ADMIRA_MCP_FILES['/mcp/manifest.json'], '/mcp/admira-app/manifest.json');
assert.equal(ADMIRA_MCP_FILES['/mcp/llms.txt'], '/mcp/admira-app/llms.txt');

const manifest = JSON.parse(await readFile(new URL('../mcp/admira-app/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.name, 'admira-app-audience');
assert.equal(manifest.site, 'https://www.admira.app');
assert.equal(manifest.llms_txt, 'https://www.admira.app/mcp/llms.txt');
assert.equal(manifest.mcp_server.endpoint, 'https://mcp.admira.store/mcp');
for (const k of ['name', 'title', 'description', 'site', 'hub']) assert.doesNotMatch(String(manifest[k]), /clear\s*channel/i, k);
const llms = await readFile(new URL('../mcp/admira-app/llms.txt', import.meta.url), 'utf8');
assert.match(llms.split('\n')[0], /admira\.app/);
assert.match(llms, /https:\/\/www\.admira\.app\/mcp\/manifest\.json/);

const env = { ASSETS: { fetch(req) { return new Response(new URL(req.url).pathname, { headers: { 'content-type': 'application/json' } }); } } };
assert.equal(await (await worker.fetch(new Request('https://www.admira.app/mcp/manifest.json'), env)).text(), '/mcp/admira-app/manifest.json');
assert.equal(await (await worker.fetch(new Request('https://admira.app/mcp/llms.txt'), env)).text(), '/mcp/admira-app/llms.txt');
assert.equal(await (await worker.fetch(new Request('https://www.clearchannel.tv/mcp/manifest.json'), env)).text(), '/mcp/manifest.json');

console.log('brand worker · puerta MCP de admira.app: ok');
