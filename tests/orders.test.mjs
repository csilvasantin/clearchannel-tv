import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleOrders } from '../server/orders.mjs';
import { OrdersClient } from '../orders-client.mjs';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_orders.sql', import.meta.url), 'utf8'));
  return { prepare(sql) { return { bind(...params) { const stmt = sqlite.prepare(sql); return {
    async run() { return stmt.run(...params); }, async first() { return stmt.get(...params); },
    async all() { return { results: stmt.all(...params) }; }
  }; } }; } };
}
const payload = () => ({ ids:['xtanco'], circuit:'all', circuitScope:{value:'local'}, start:'2026-09-06',end:'2026-09-07',passDate:'2026-09-06',passTime:'10:00',passesDay:250,durationSec:15,brand:'Test',campaign:'Campaign',email:'test@example.com',price:10.25,target:{},creative:null });
const origin='https://www.clearchannel.tv';
function request(method='GET', body, cookie='', key='test-request-00001') {
  return new Request(origin+'/api/orders', {method, headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','Idempotency-Key':key}, ...(body ? {body:JSON.stringify(body)} : {})});
}
async function session(env) { return (await handleOrders(request(),env)).headers.get('Set-Cookie').split(';')[0]; }

test('persists across requests, cookie is secure, no payment or reservation asserted', async()=>{
 const env={ORDERS_DB:database()}; const initial=await handleOrders(request(),env);
 assert.match(initial.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict/);assert.match(initial.headers.get('Set-Cookie'),/Secure/);
 const cookie=initial.headers.get('Set-Cookie').split(';')[0];
 const r=await handleOrders(request('POST',payload(),cookie),env);assert.equal(r.status,201);
 const {order}=await r.json();assert.equal(order.status,'received');assert.equal(order.reservationStatus,'pending');assert.equal(order.paymentStatus,'not_started');
 const loaded=await handleOrders(request('GET',null,cookie),{ORDERS_DB:env.ORDERS_DB});
 assert.match(loaded.headers.get('Cache-Control'),/no-store/);assert.deepEqual((await loaded.json()).orders,[order]);
});
test('concurrent duplicate submissions create exactly one record; changed payload conflicts',async()=>{
 const env={ORDERS_DB:database()},cookie=await session(env);
 const responses=await Promise.all(Array.from({length:8},()=>handleOrders(request('POST',payload(),cookie),env)));
 assert.equal(responses.filter(r=>r.status===201).length,1);
 const ids=await Promise.all(responses.map(async r=>(await r.json()).order.id));assert.equal(new Set(ids).size,1);
 const conflict=await handleOrders(request('POST',{...payload(),price:99},cookie),env);assert.equal(conflict.status,409);
 assert.equal((await (await handleOrders(request('GET',null,cookie),env)).json()).orders.length,1);
});
test('browser owners and origins isolated, POST cannot forge confirmation',async()=>{
 const env={ORDERS_DB:database()},cookie=await session(env);
 assert.equal((await handleOrders(request('POST',payload()),env)).status,401);
 await handleOrders(request('POST',{...payload(),status:'paid',paymentStatus:'paid',reservationStatus:'confirmed'},cookie),env);
 const other=await session(env);assert.equal((await (await handleOrders(request('GET',null,other),env)).json()).orders.length,0);
 const stored=(await (await handleOrders(request('GET',null,cookie),env)).json()).orders[0];assert.equal(stored.paymentStatus,'not_started');assert.equal(stored.reservationStatus,'pending');
 const cross=request('POST',payload(),cookie);cross.headers.set('Origin','https://attacker.test');assert.equal((await handleOrders(cross,env)).status,403);
});
test('validates dates, contact, sizes and rejects card data; fails closed without DB',async()=>{
 const env={ORDERS_DB:database()},cookie=await session(env);
 for (const patch of [{cardLast4:'4242'},{cvc:'123'},{email:'bad'},{ids:[]},{start:'2026-02-30'},{end:'2026-01-01'},{passesDay:0},{price:-1},{creative:{assetUrl:'javascript:alert(1)'}}]) {
  assert.equal((await handleOrders(request('POST',{...payload(),...patch},cookie),env)).status,400,JSON.stringify(patch));
 }
 assert.equal((await handleOrders(request(),{})).status,503);
 const big=request('POST',{...payload(),extra:'x'.repeat(1048577)},cookie);assert.equal((await handleOrders(big,env)).status,413);
});
test('per-owner cap does not prevent retry of an existing request',async()=>{
 const env={ORDERS_DB:database()},cookie=await session(env);
 for(let i=0;i<30;i++)assert.equal((await handleOrders(request('POST',payload(),cookie,'request-test-key-'+i),env)).status,201);
 assert.equal((await handleOrders(request('POST',payload(),cookie,'request-test-key-30'),env)).status,429);
 assert.equal((await handleOrders(request('POST',payload(),cookie,'request-test-key-0'),env)).status,200);
});
test('client retries a lost response and recovers after page/client restart',async()=>{
 const env={ORDERS_DB:database()}; let cookie='', drop=true;
 const fetcher=async(url,options)=>{
  const r=await handleOrders(new Request(origin+url,{...options,headers:{...options.headers,Origin:origin,Cookie:cookie}}),env);
  if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];
  if(options.method==='POST'&&drop){drop=false;throw Error('connection lost after save');}return r;
 };
 const client=new OrdersClient(fetcher);
 await assert.rejects(()=>client.create(payload()),/connection lost/);
 const restored=new OrdersClient(fetcher);const order=await restored.create(payload());
 const all=await restored.list();assert.equal(all.length,1);assert.equal(all[0].id,order.id);
});

test('idempotency survives cosmetic labels and draft timestamp changes',async()=>{
 const env={ORDERS_DB:database()};let cookie='';
 const fetcher=async(url,options)=>{const r=await handleOrders(new Request(origin+url,{...options,headers:{...options.headers,Origin:origin,Cookie:cookie}}),env);if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return r;};
 const client=new OrdersClient(fetcher);
 const first=await client.create({...payload(),circuitScope:{value:'local',label:'Local'}});
 const second=await new OrdersClient(fetcher).create({...payload(),circuitScope:{value:'local',label:'Localized label'},createdAt:'later'});
 assert.equal(first.id,second.id);
});

test('planner budget survives storage and participates in idempotency',async()=>{
 const env={ORDERS_DB:database()},cookie=await session(env);
 const r=await handleOrders(request('POST',{...payload(),budget:500},cookie),env);assert.equal(r.status,201);
 const stored=(await (await handleOrders(request('GET',null,cookie),env)).json()).orders[0];assert.equal(stored.budget,500);
 assert.equal((await handleOrders(request('POST',{...payload(),budget:600},cookie),env)).status,409);
 for(const budget of [-1,0,1e13,'500'])assert.equal((await handleOrders(request('POST',{...payload(),budget},cookie),env)).status,400);
});
