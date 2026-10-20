import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {serverSession}=createRequire(import.meta.url)('../login-google.js');
test('server cookie session is checked same-origin (/auth/sesion, the worker forwards the cookie to the API)',async()=>{
 let call;const s=await serverSession(async(url,options)=>{call={url,options};return Response.json({ok:true,email:'agentes@silicio.admiranext.com'});});
 assert.equal(call.url,'/auth/sesion');assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.cache,'no-store');assert.equal(s.source,'server');
});
test('denied, malformed or unreachable sessions do not unlock Expert',async()=>{
 for(const fetcher of [async()=>new Response('',{status:401}),async()=>Response.json({ok:false,sesion:false}),async()=>new Response('',{status:403}),async()=>Response.json({ok:false,email:'x'}),async()=>Response.json({ok:true}),async()=>{throw Error('network');}])assert.equal(await serverSession(fetcher),null);
});
