import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolvePhysicalOrder,FAULTS} from '../bugito-command-core.mjs';
import {bizAssetPath} from '../server/biz-assets.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('guía MCP y help usan comandos que el mando real resuelve al MBP16',()=>{
 const manifest=JSON.parse(read('tools/biz-player-mcp/assets/manifest.json')).bugito;
 assert.deepEqual(manifest.applications,['studio','store','tv','app','biz']);
 assert.equal(manifest.mcp.tool,'help');assert.equal(manifest.mcp.arguments.tema,'bugito');
 const guide=read('mcp/bugito.md');assert.equal(guide,read('tools/biz-player-mcp/assets/bugito.md'));
 for(const examples of [manifest.commands_es,manifest.commands_en]){
   assert.equal(examples.length,6);const found=new Set();
   for(const order of examples){const r=resolvePhysicalOrder(order);assert.equal(r.target?.screen,'macbookpro16',order);found.add(r.fault);assert.ok(guide.includes(order));}
   assert.deepEqual(found,new Set(Object.keys(FAULTS)));
 }
 assert.match(guide,/mantiene la incidencia abierta/);assert.match(guide,/not laptop power-off/);
 for(const order of manifest.commands_es)assert.ok(read('help/index.html').includes(order));
 assert.equal(bizAssetPath(new URL('https://www.admira.biz/mcp/bugito.md')),'/__admira_biz/mcp/bugito.md');
 assert.equal(bizAssetPath(new URL('https://www.clearchannel.tv/mcp/bugito.md')),'');
});
