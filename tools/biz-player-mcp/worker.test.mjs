import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const env = {RELEASE:'test', ASSETS:{fetch:async r=>new Response(new URL(r.url).pathname)}, GATE:{fetch:async r=>new Response(JSON.stringify({url:r.url,auth:r.headers.get('Authorization'),body:await r.text()}))}};
test('documentation maps only exact paths and preserves HEAD',async()=>{
 let r=await worker.fetch(new Request('https://www.admira.biz/mcp/manifest.json'),env);
 assert.equal(await r.text(),'/manifest.json');assert.equal(r.headers.get('X-Admira-Player-Docs'),'test');
 r=await worker.fetch(new Request('https://www.admira.biz/mcp/missing'),env);assert.equal(r.status,404);
});
test('frozen domains excluded',async()=>{for(const host of ['yokup.com','www.clearchannel.tv','admira.app','pixeria.com'])assert.equal((await worker.fetch(new Request('https://'+host+'/mcp/'),env)).status,404)});
test('RPC body URL credentials forwarded untouched',async()=>{
 const r=await worker.fetch(new Request('https://www.admira.biz/mcp/',{method:'POST',headers:{Authorization:'Bearer test-only'},body:'{"method":"tools/list"}'}),env);
 assert.deepEqual(await r.json(),{url:'https://www.admira.biz/mcp/',auth:'Bearer test-only',body:'{"method":"tools/list"}'});
});
test('SSE remains server-owned',async()=>{
 const r=await worker.fetch(new Request('https://www.admira.biz/mcp/',{headers:{Accept:'text/event-stream'}}),env);assert.equal((await r.json()).url,'https://www.admira.biz/mcp/');
});

test('only named public evidence is accessible, with no traversal fallback',async()=>{
 for(const path of ['/mcp/player-sync-evidence/fronteras.json','/mcp/player-sync-evidence/evidencias.zip'])assert.equal((await worker.fetch(new Request('https://admira.biz'+path),env)).status,200);
 for(const path of ['/mcp/player-sync-evidence/private.json','/mcp/player-sync-evidence/../secret.json'])assert.equal((await worker.fetch(new Request('https://admira.biz'+path),env)).status,404);
});

test('Bugito guide is a read-only exact doc route, RPC still goes to the gate',async()=>{
 const r=await worker.fetch(new Request('https://www.admira.biz/mcp/bugito.md'),env);assert.equal(await r.text(),'/bugito.md');
 const post=await worker.fetch(new Request('https://admira.biz/mcp/bugito.md',{method:'POST',headers:{Authorization:'Bearer test-only'},body:'{}'}),env);
 assert.equal((await post.json()).auth,'Bearer test-only');
 assert.equal((await worker.fetch(new Request('https://admira.biz/mcp/bugito-private.md'),env)).status,404);
});
