import {PHYSICAL_TARGETS,FAULTS,resolvePhysicalOrder,observedFault} from '../bugito-command-core.mjs';
const CONTROL='https://brain.digitalavatar.ai';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOSTS=new Set(['admira.tv','admira.app','admira.biz','admira.store','admira.studio','admiranext.com','pixeria.com','xpaceos.com','yokup.com','clearchannel.tv']);
const fail=(code,status=400)=>Object.assign(Error(code),{status});
const reply=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
const schemas=new WeakMap();
async function database(env){
 const root=env.ORDERS_DB;if(!root)throw fail('command_store_unavailable',503);
 if(!schemas.has(root))schemas.set(root,root.prepare('CREATE TABLE IF NOT EXISTS bugito_physical_commands (id TEXT PRIMARY KEY,owner_hash TEXT NOT NULL,identity TEXT NOT NULL,status TEXT NOT NULL,result TEXT,created_at INTEGER NOT NULL)').run());
 await schemas.get(root);return root.withSession?root.withSession('first-primary'):root;
}
async function read(req){const raw=await req.text();if(raw.length>4096)throw fail('body_too_large',413);try{const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;return b;}catch{throw fail('invalid_json');}}
async function upstream(fetcher,path,body,auth){
 const r=await fetcher(CONTROL+path,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json();if(!r.ok||d.ok===false)throw fail(r.status===401||r.status===403?'owner_required':'control_not_confirmed',r.status===401||r.status===403?403:502);return d;
}
async function get(fetcher,url){const r=await fetcher(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw fail('telemetry_unavailable',502);return r.json();}
export async function handleBugitoCommand(req,env,fetcher=fetch){
 const url=new URL(req.url);
 if(!/^(?:www\.)?admira\.biz$|(?:^|\.)clearchannel-tv\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(url.hostname))return reply({ok:false,error:'not_found'},404);
 try{
  if(url.pathname.endsWith('/launch')){
   // Cross-site navigation is a POST from the actual suite console. GET links,
   // query strings and third-party forms never execute physical commands.
   if(req.method!=='POST')throw fail('method_not_allowed',405);
   let origin;try{origin=new URL(req.headers.get('Origin'));}catch{throw fail('origin_forbidden',403);}
   if(origin.protocol!=='https:'||origin.port||!HOSTS.has(origin.hostname.replace(/^www\./,'')))throw fail('origin_forbidden',403);
   if(!req.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))throw fail('invalid_content_type',415);
   const raw=await req.text();if(raw.length>4096)throw fail('body_too_large',413);
   const b=Object.fromEntries(new URLSearchParams(raw));if(Object.keys(b).some(k=>!['order','request_id'].includes(k))||!UUID.test(b.request_id||'')||!resolvePhysicalOrder(b.order).target)throw fail('order_format');
   const page=await env.ASSETS.fetch(new Request(url.origin+'/__admira_biz/bugito'));
   if(!page.ok)throw fail('page_unavailable',503);
   const payload=JSON.stringify({order:b.order,request_id:b.request_id}).replace(/</g,'\\u003c');
   // The browser resolves scripts/styles while parsing the head. Set the base
   // before those resources, since this document is served at /api/bugito/launch.
   const html=(await page.text()).replace(/<head\b[^>]*>/i,head=>`${head}<base href="/bugito"><script type="application/json" id="bugito-command-intent">${payload}</script>`);
   return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin'}});
  }
  if(req.method==='GET'&&url.pathname.endsWith('/status')){
   const id=url.searchParams.get('id');if(!UUID.test(id||''))throw fail('invalid_receipt');
   const db=await database(env),row=await db.prepare('SELECT * FROM bugito_physical_commands WHERE id=?').bind(id).first();
   if(!row)throw fail('order_not_found',404);
   if(!row.result)return reply({ok:true,status:row.status,executed:false,detected:false});
   const receipt=JSON.parse(row.result),{fault,action,after}=receipt,screen=receipt.target.screen;
   const [ack,signal]=await Promise.all([get(fetcher,CONTROL+'/locations/cmd/ack?'+new URLSearchParams({id:screen,action})),get(fetcher,'https://api.admira.store/signage/now?screen='+encodeURIComponent(screen))]);
   const detected=observedFault(fault,signal,after);
   return reply({ok:true,screen,action,executed:ack.seen===true&&ack.ack?.status==='executed',detected,lastSeen:signal.lastSeen||null,display:signal.device?.display||null,standby:signal.standby===true});
  }
  if(req.method!=='POST'||!url.pathname.endsWith('/commands'))throw fail('method_not_allowed',405);
  const auth=req.headers.get('Authorization')||'';if(!/^Bearer \S+$/.test(auth))throw fail('sign_in_required',401);
  const b=await read(req);if(Object.keys(b).some(k=>!['order','request_id'].includes(k))||!UUID.test(b.request_id||''))throw fail('invalid_fields');
  const r=resolvePhysicalOrder(b.order);if(r.error)throw fail(r.error,r.error.endsWith('ambiguous')?409:400);
  const {target,fault}=r;
  const db=await database(env);
  const signal=await get(fetcher,'https://api.admira.store/signage/now?screen='+target.screen);
  if(signal.screen!==target.screen||!signal.device?.display||!signal.producer||!Number(signal.lastSeen)||Date.now()-signal.lastSeen>30000||signal.lastSeen>Date.now()+10000)throw fail('device_without_recent_signal',409);
  // The control authority verifies the owner's Google token (or its existing
  // server credential) and issues a nonce scoped to this exact physical screen.
  // No master credential is configured in Pages or returned to a browser.
  const arm=await upstream(fetcher,'/locations/cmd/fault-arm',{screen:target.screen},auth);
  if(typeof arm.nonce!=='string'||!arm.nonce)throw fail('control_not_confirmed',502);
  const owner=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(auth)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const identity=JSON.stringify([target.screen,fault]);
  const reserved=await db.prepare("INSERT OR IGNORE INTO bugito_physical_commands(id,owner_hash,identity,status,created_at) VALUES(?,?,?,'sending',?)").bind(b.request_id,owner,identity,Date.now()).run();
  if(!reserved.meta?.changes){
   const prior=await db.prepare('SELECT * FROM bugito_physical_commands WHERE id=?').bind(b.request_id).first();
   if(prior?.owner_hash!==owner||prior?.identity!==identity)throw fail('request_conflict',409);
   return prior.result?reply(JSON.parse(prior.result),202):reply({ok:false,error:'command_'+prior.status,request_id:b.request_id},409);
  }
  try{
   if(fault==='clear')await upstream(fetcher,'/locations/cmd',{id:target.screen,screen:target.screen,cmd:'resume'},auth);
   const receipt=await upstream(fetcher,'/locations/cmd',{id:target.screen,screen:target.screen,cmd:FAULTS[fault],confirm:arm.nonce},auth);
   if(receipt.ok!==true||!UUID.test(receipt.action||'')||!Number.isSafeInteger(receipt.cid))throw fail('control_not_confirmed',502);
   const result={ok:true,request_id:b.request_id,queued:true,executed:false,detected:false,target,fault,command:FAULTS[fault],action:receipt.action,cid:receipt.cid,after:Date.now(),supervisor:'https://www.admira.app/supervisor'};
   await db.prepare("UPDATE bugito_physical_commands SET status='queued',result=? WHERE id=?").bind(JSON.stringify(result),b.request_id).run();
   return reply(result,202);
  }catch{
   await db.prepare("UPDATE bugito_physical_commands SET status='unknown' WHERE id=?").bind(b.request_id).run();
   return reply({ok:false,error:'command_unknown',request_id:b.request_id,supervisor:'https://www.admira.app/supervisor'},502);
  }
 }catch(e){return reply({ok:false,error:e.status?e.message:'service_unavailable'},e.status||503);}
}
