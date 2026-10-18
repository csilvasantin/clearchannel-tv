import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {serverSession}=createRequire(import.meta.url)('../login-google.js');
test('server cookie session uses fixed official endpoint and explicit credentials',async()=>{
 let call;const s=await serverSession(async(url,options)=>{call={url,options};return Response.json({ok:true,email:'agentes@silicio.admiranext.com'});});
 assert.equal(call.url,'https://api.admira.biz/auth/session');assert.equal(call.options.credentials,'include');assert.equal(call.options.cache,'no-store');assert.equal(s.source,'server');
});
test('denied, malformed or unreachable sessions do not unlock Expert',async()=>{
 for(const fetcher of [async()=>new Response('',{status:401}),async()=>new Response('',{status:403}),async()=>Response.json({ok:false,email:'x'}),async()=>Response.json({ok:true}),async()=>{throw Error('network');}])assert.equal(await serverSession(fetcher),null);
});
