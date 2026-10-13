import test from 'node:test';
import assert from 'node:assert/strict';
import {agentLogin} from '../_worker.js';
test('GET serves the correct agent form and POST retains the existing cookie contract',async()=>{
  const real=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,init)=>{
    calls.push({url:String(url),method:init.method,origin:init.headers.get('Origin'),authorization:init.headers.get('Authorization')});
    if(init.method==='GET')return new Response('<form action="'+url+'">agent</form>',{headers:{'content-type':'text/html'}});
    return Response.json({ok:true},{headers:{'Set-Cookie':'__Host-yk_session=test; Path=/; HttpOnly; Secure'}});
  };
  try{
    for(const [host,api] of [['admira.biz','https://api.admira.biz'],['www.admira.biz','https://api.admira.biz'],['www.admira.app','https://api.admira.app']]){
      const url=new URL('https://'+host+'/auth/agente');
      const get=await agentLogin(new Request(url),url);
      assert.equal(get.status,200);assert.match(await get.text(),new RegExp(api.replaceAll('.','\\.')));
      assert.equal(get.headers.get('Cache-Control'),'no-store');
      const post=await agentLogin(new Request(url,{method:'POST',headers:{Authorization:'Bearer test'},body:''}),url);
      assert.equal(post.status,200);assert.match(post.headers.get('Set-Cookie'),/__Host-yk_session/);
      assert.equal(calls.at(-1).url,api+'/auth/agente');assert.equal(calls.at(-1).authorization,'Bearer test');
    }
    const unknown=new URL('https://www.clearchannel.tv/auth/agente');
    assert.equal(await agentLogin(new Request(unknown),unknown),null);
    assert.equal(calls.length,6);
  }finally{globalThis.fetch=real;}
});
