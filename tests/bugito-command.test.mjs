import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {resolvePhysicalOrder,parsePhysicalOrder,observedFault,PHYSICAL_TARGETS} from '../bugito-command-core.mjs';
import {handleBugitoCommand} from '../server/bugito-command.mjs';
const ORDER='/bugito error starbucks gran de gracia 51 pantalla girada',ID='2858e8c4-6167-4263-8559-b67b8ec5e3d9',ACTION='943608dc-6951-4198-a921-6346fac53104';
function setup(t,{owner=true,fresh=true,lostReply=false}={}){
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());const calls=[];
 const db={prepare(sql){const stmt=sqlite.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}};},async first(){return stmt.get(...args);}};}};
 const signal=()=>({screen:'macbookpro16',producer:'native-producer',lastSeen:Date.now()-(fresh?0:90000),device:{display:{paintedRotation:90,overlay:0,visible:100}},standby:false});
 const fetcher=async(url,init={})=>{
  calls.push({url,body:init.body?JSON.parse(init.body):null});
  if(url.includes('/signage/now'))return Response.json(signal());
  if(url.endsWith('/fault-arm'))return Response.json(owner?{ok:true,nonce:'private-one-use-nonce'}:{ok:false},{status:owner?200:403});
  if(url.endsWith('/locations/cmd')){if(lostReply)throw Error('response lost');return Response.json({ok:true,action:ACTION,cid:14});}
  if(url.includes('/cmd/ack?'))return Response.json({seen:true,ack:{status:'executed'}});
  throw Error('unexpected');
 };
 const env={ORDERS_DB:db,ASSETS:{fetch:async()=>new Response('<html><head><script src="bugito-super.js"></script><link rel="stylesheet" href="bugito.css"></head><body>Bugito</body></html>')}};
 const request=(order=ORDER,id=ID)=>new Request('https://www.admira.biz/api/bugito/commands',{method:'POST',headers:{Authorization:'Bearer approved-owner','Content-Type':'application/json'},body:JSON.stringify({order,request_id:id})});
 return {env,fetcher,calls,request};
}
test('ES/EN resolve the complete explicit demo binding to MBP16, never MBP14',()=>{
 for(const text of [ORDER,'/bugito fault Starbucks Gran de Gràcia 51 rotated screen']){const d=resolvePhysicalOrder(text);assert.equal(d.target.screen,'macbookpro16');assert.equal(d.fault,'rotate');assert.equal(d.target.demo,true);}
 assert.equal(resolvePhysicalOrder('error starbucks gran de gracia 51 mbp14 pantalla girada').error,'physical_target_not_configured');
 assert.equal(resolvePhysicalOrder(ORDER,[...PHYSICAL_TARGETS,...PHYSICAL_TARGETS]).error,'target_ambiguous');
 assert.equal(parsePhysicalOrder('restaurar starbucks gran de gracia 51').fault,'clear');assert.equal(parsePhysicalOrder('error cualquier equipo'),null);
});
test('nonce-authorized dispatch queues once; response does not assert execution or expose credentials',async t=>{
 const s=setup(t),r=await handleBugitoCommand(s.request(),s.env,s.fetcher),d=await r.json();assert.equal(r.status,202);assert.equal(d.executed,false);assert.equal(d.detected,false);assert.equal(d.command,'fault-rotate');assert.equal(JSON.stringify(d).includes('private-one-use-nonce'),false);
 const repeat=await handleBugitoCommand(s.request(),s.env,s.fetcher);assert.equal(repeat.status,202);assert.equal(s.calls.filter(c=>c.url.endsWith('/locations/cmd')).length,1);
 const conflict=await handleBugitoCommand(s.request('/bugito error starbucks gran de gracia 51 popup'),s.env,s.fetcher);assert.equal(conflict.status,409);
});
test('unauthorized, unbound and stale targets never receive a physical command',async t=>{
 for(const options of [{owner:false},{fresh:false}]){const s=setup(t,options);const r=await handleBugitoCommand(s.request(),s.env,s.fetcher);assert.ok([403,409].includes(r.status));assert.equal(s.calls.some(c=>c.url.endsWith('/locations/cmd')),false);}
 const s=setup(t);const r=await handleBugitoCommand(s.request('error starbucks otra tienda pantalla girada'),s.env,s.fetcher);assert.equal(r.status,400);assert.equal(s.calls.length,0);
});
test('unknown delivery is persisted and a retry never sends a second command',async t=>{
 const s=setup(t,{lostReply:true});assert.equal((await handleBugitoCommand(s.request(),s.env,s.fetcher)).status,502);assert.equal((await handleBugitoCommand(s.request(),s.env,s.fetcher)).status,409);assert.equal(s.calls.filter(c=>c.url.endsWith('/locations/cmd')).length,1);
});
test('status requires measured recent data as well as ACK; previous measurements are not evidence',async t=>{
 const s=setup(t);await handleBugitoCommand(s.request(),s.env,s.fetcher);await new Promise(r=>setTimeout(r,3));const r=await handleBugitoCommand(new Request('https://www.admira.biz/api/bugito/status?id='+ID),s.env,s.fetcher);const d=await r.json();assert.equal(d.executed,true);assert.equal(d.detected,true);
 assert.equal(observedFault('rotate',{lastSeen:10,device:{display:{paintedRotation:90}}},20,30),false);
 assert.equal(observedFault('rotate',{lastSeen:30,device:{display:{paintedRotation:0}}},20,40),false);
});
test('suite POST launch preserves the order; GET, unknown origins and arbitrary fields cannot autoexecute',async t=>{
 const s=setup(t);const body=new URLSearchParams({order:ORDER,request_id:ID});
 for(const host of ['admira.tv','admira.app','admira.biz','admira.store','admira.studio','admiranext.com','pixeria.com','xpaceos.com']){
  const r=await handleBugitoCommand(new Request('https://www.admira.biz/api/bugito/launch',{method:'POST',headers:{Origin:'https://www.'+host,'Content-Type':'application/x-www-form-urlencoded'},body}),s.env,s.fetcher);assert.equal(r.status,200,host);const html=await r.text();assert.match(html,/id="bugito-command-intent"/);assert.ok(html.indexOf('<base href="/bugito">')<html.indexOf('src="bugito-super.js"'),'base precedes relative resources');assert.equal(new URL('bugito-super.js',new URL('/bugito',r.url||'https://www.admira.biz/api/bugito/launch')).pathname,'/bugito-super.js');
 }
 assert.equal((await handleBugitoCommand(new Request('https://www.admira.biz/api/bugito/launch?order='+encodeURIComponent(ORDER)),s.env,s.fetcher)).status,405);
 assert.equal((await handleBugitoCommand(new Request('https://www.admira.biz/api/bugito/launch',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/x-www-form-urlencoded'},body}),s.env,s.fetcher)).status,403);
 assert.equal(s.calls.length,0,'navigation does not execute hardware commands');
});
