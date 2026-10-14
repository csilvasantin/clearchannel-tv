import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleContextSession} from '../server/biz-context-session.mjs';
import {GOOGLE_SUITE_CLIENT_ID} from '../server/demo-session.mjs';
import {verifyPixeriaApiToken} from './fixtures/pixer-context/paid-auth.mjs';
const now=Date.now(),env={PIXERIA_SIGNING_KEY:'test-key'},claims={aud:GOOGLE_SUITE_CLIENT_ID,iss:'accounts.google.com',sub:'fixture',exp:Math.floor(now/1000)+90,email:'reader@admira.com',email_verified:true};
const request=(headers={})=>new Request('https://www.admira.biz/api/context-session',{method:'POST',headers:{Authorization:'Bearer credential',...headers}});
test('signed identity matches the upstream API verifier and cannot outlive Google',async()=>{
  const r=await handleContextSession(request(),env,async()=>Response.json(claims),now);
  assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
  const d=await r.json();assert.equal(d.exp,claims.exp);assert.equal(d.superusuario,undefined);
  assert.deepEqual(await verifyPixeriaApiToken(d.token,env.PIXERIA_SIGNING_KEY,Math.floor(now/1000)),{email:claims.email,exp:claims.exp});
});
test('no signer, cross-origin, invalid or expired identity fail closed',async()=>{
  assert.equal((await handleContextSession(request(),{})).status,503);
  assert.equal((await handleContextSession(request({Origin:'https://evil.invalid'}),env)).status,403);
  for(const patch of [{aud:'wrong'},{iss:'wrong'},{email_verified:false},{exp:1},{sub:''},{email:'unassigned@external.invalid'}])assert.equal((await handleContextSession(request(),env,async()=>Response.json({...claims,...patch}),now)).status,401);
  assert.equal((await handleContextSession(request(),env,async()=>{throw Error('offline');})).status,503);
});
test('session exchange is confined to Biz routing and rejects missing credential or wrong method',async()=>{
  const {default:worker}=await import('../_worker.js');
  for(const host of ['clearchannel.tv','www.clearchannel.tv','admira.app','eviladmira.biz.invalid'])assert.equal((await worker.fetch(new Request('https://'+host+'/api/context-session',{method:'POST'}),env)).status,404);
  assert.equal((await handleContextSession(new Request('https://www.admira.biz/api/context-session'),env)).status,405);
  assert.equal((await handleContextSession(new Request('https://www.admira.biz/api/context-session',{method:'POST'}),env)).status,401);
});
