import {handleDemoSession} from './demo-session.mjs';
import {parseIncidentOrder,uniqueMatch,screensOf,equipmentKey} from '../bugito-xpacios-core.mjs';
const CATALOG='https://brain.digitalavatar.ai';
const OWNERS=new Set(['csilvasantin@gmail.com','csilva@admira.com']);
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const fail=(code,status=400)=>Object.assign(Error(code),{status});
let catalogue=null,expires=0;
async function getJSON(url,fetcher) {const r=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!r.ok)throw fail('catalogue_unavailable',503);return r.json();}
async function authorized(req,fetcher) {
 const token=req.headers.get('Authorization')||'';
 if(!/^Bearer \S+$/.test(token))throw fail('sign_in_required',401);
 // The official agent login validates the shared fleet credential on its own server.
 // It is used by CLI verification; it is never sent to or stored in a page.
 if(req.headers.has('X-Agente')){
  const r=await fetcher('https://api.yokup.com/auth/agente',{method:'POST',headers:{Authorization:token,'X-Agente':req.headers.get('X-Agente'),'Content-Type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(8000)});
  const d=await r.json();if(!r.ok||d.ok!==true||d.agent!==true||d.email!=='agentes@silicio.admiranext.com')throw fail('sign_in_required',401);return d.name;
 }
 const r=await handleDemoSession(new Request('https://www.admira.biz/api/demo-session',{method:'POST',headers:{Authorization:token}}),fetcher);
 if(!r.ok)throw fail('sign_in_required',401);
 const d=await r.json();if(!OWNERS.has(d.email))throw fail('owner_required',403);return d.email;
}
async function projects(env,origin) {
 const r=await env.ASSETS.fetch(new Request(origin+'/__admira_biz/bugito-objetivos.json'));
 if(!r.ok)throw fail('project_registry_unavailable',503);const d=await r.json();
 if(!Array.isArray(d.proyectos))throw fail('project_registry_unavailable',503);
 return d.proyectos.map(p=>({id:p.id,label:p.label,circuit:p.circuit}));
}
async function locations(fetcher) {
 if(catalogue&&Date.now()<expires)return catalogue;
 const d=await getJSON(CATALOG+'/locations',fetcher);
 if(!Array.isArray(d.locations))throw fail('catalogue_unavailable',503);
 catalogue=d.locations;expires=Date.now()+30000;return catalogue;
}
export async function handleBugitoXpacios(req,env,fetcher=fetch) {
 const url=new URL(req.url);
 if(!/^(?:www\.)?admira\.biz$|(?:^|\.)clearchannel-tv\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(url.hostname))return reply({ok:false,error:'not_found'},404);
 try {
  if((url.pathname.endsWith('/targets')&&req.method!=='GET')||(url.pathname.endsWith('/incidents')&&req.method!=='POST'))return reply({ok:false,error:'method_not_allowed'},405);
  if(!['GET','POST'].includes(req.method))return reply({ok:false,error:'method_not_allowed'},405);
  let b={};let actor='';
  if(req.method==='POST'){
   actor=await authorized(req,fetcher);
   const raw=await req.text();if(raw.length>4096)throw fail('body_too_large',413);
   try{b=JSON.parse(raw);}catch{throw fail('invalid_json');}
   if(!b||typeof b!=='object'||Array.isArray(b))throw fail('invalid_json');
   if(b.order){const parsed=parseIncidentOrder(b.order);if(!parsed)throw fail('order_format');b=parsed;}
   if(Object.keys(b).some(k=>!['project','location','screen','severity','fault'].includes(k)))throw fail('invalid_fields');
  }else b=Object.fromEntries(url.searchParams);
  const ps=await projects(env,url.origin);
  if(req.method==='GET'&&!b.project)return reply({ok:true,projects:ps});
  const p=uniqueMatch(ps,b.project,x=>[x.id,x.label,x.circuit]);if(p.error)throw fail('project_'+p.error,p.error.endsWith('ambiguous')?409:404);
  const project=p.item;
  const ls=(await locations(fetcher)).filter(l=>l.circuit===project.circuit);
  if(req.method==='GET'&&!b.location)return reply({ok:true,project,locations:ls.map(l=>({id:l.id,name:l.name}))});
  const l=uniqueMatch(ls,b.location,x=>[x.id,x.name]);if(l.error)throw fail('location_'+l.error,l.error.endsWith('ambiguous')?409:404);
  const d=await getJSON(CATALOG+'/locations/'+encodeURIComponent(l.item.id),fetcher),loc=d.location;
  if(!loc||loc.id!==l.item.id||loc.circuit!==project.circuit)throw fail('target_scope_changed',409);
  const screens=screensOf(loc);
  if(req.method==='GET')return reply({ok:true,project,location:{id:loc.id,name:loc.name},screens});
  const s=uniqueMatch(screens,b.screen,x=>[x.id,x.name,x.number,...x.aliases]);if(s.error)throw fail('screen_'+s.error,s.error.endsWith('ambiguous')?409:404);
  const screen=s.item,severity=b.severity||'normal',fault=b.fault||'incident';
  if(!['normal','baja','alta','urgente'].includes(severity)||!['incident','rotate','popup','black','canvas','half'].includes(fault))throw fail('invalid_incident');
  // One active canonical incident per exact destination, fault and severity.
  const identity=JSON.stringify([project.id,loc.id,screen.id,fault,severity]);
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity)))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
  const resource=loc.id+':'+equipmentKey(screen)+':bugito:'+digest;
  if(resource.length>160)throw fail('equipment_reference_too_long',409);
  const payload={resource,subject:('PRUEBA BUGITO · '+screen.name+' · '+fault).slice(0,200),kind:'screen',severity,source:'bugito-xpacios',by:'Bugito · '+actor,loc:loc.id,loc_name:loc.name,
   detail:('Incidencia de prueba solicitada por '+actor+'. Proyecto: '+project.label+' ('+project.id+'). Establecimiento: '+loc.name+' ('+loc.id+'). Pantalla: '+screen.name+' ('+screen.id+'). Tipo: '+fault+'. Gravedad: '+severity+'. Registro lógico solicitado; no acredita un fallo físico. Queda abierta hasta su gestión y cierre desde la ficha.').slice(0,1800)};
  const r=await fetcher('https://api.yokup.com/incident',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(15000)});
  const result=await r.json();if(!r.ok||result.ok!==true||!/^INC-[A-Z0-9]{4,10}$/.test(result.id||''))throw fail('incident_not_confirmed',502);
  return reply({ok:true,id:result.id,url:'https://www.admira.app/ticket?id='+result.id,project,location:{id:loc.id,name:loc.name},screen,severity,level:['alta','urgente'].includes(severity)?2:1,persistent:true,physical_fault:false},201);
 }catch(e){return reply({ok:false,error:e.status?e.message:'service_unavailable'},e.status||503);}
}
