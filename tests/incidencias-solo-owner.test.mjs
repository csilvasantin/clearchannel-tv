// El semáforo de incidencias del mapa, solo para owners (FLT-102662 · encargo #7133).
// El público ve los colores por circuito (como antes de 857a8cf) y no consulta api.yokup.com/incident/map.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {handleBugitoXpacios} from '../server/bugito-xpacios.mjs';
import {ownerToken} from '../bugito-xpacios-core.mjs';
import worker from '../_worker.js';
const tooltip=createRequire(import.meta.url)('../incident-map-tooltip.js');
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const SUITE='861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
const env={ASSETS:{fetch:async()=>{throw Error('owner must not read the project registry');}}};
function google(email){const calls=[];const f=async(url,init={})=>{calls.push(url);
 if(String(url).startsWith('https://oauth2.googleapis.com/tokeninfo'))return Response.json({aud:SUITE,iss:'https://accounts.google.com',sub:'u',exp:Math.floor(Date.now()/1000)+300,email_verified:true,email});
 throw Error('unexpected URL '+url);};return {f,calls};}
const owner=(headers={},method='GET',host='www.admira.biz')=>new Request('https://'+host+'/api/bugito/owner',{method,headers});

test('/api/bugito/owner: anónimo 401, no owner 403, owner 200; siempre no-store y sin email',async()=>{
 const anon=await handleBugitoXpacios(owner(),env,google('csilvasantin@gmail.com').f);
 assert.equal(anon.status,401);assert.equal((await anon.json()).error,'sign_in_required');assert.equal(anon.headers.get('Cache-Control'),'no-store');
 const other=await handleBugitoXpacios(owner({Authorization:'Bearer t'}),env,google('otra@admira.com').f);
 assert.equal(other.status,403);assert.equal((await other.json()).error,'owner_required');assert.equal(other.headers.get('Cache-Control'),'no-store');
 // Una cuenta de Google sin acceso a admira.biz ni siquiera tiene sesión.
 assert.equal((await handleBugitoXpacios(owner({Authorization:'Bearer t'}),env,google('alguien@gmail.com').f)).status,401);
 for(const email of ['csilvasantin@gmail.com','csilva@admira.com']){
  const g=google(email),r=await handleBugitoXpacios(owner({Authorization:'Bearer t'}),env,g.f);
  assert.equal(r.status,200,email);assert.equal(r.headers.get('Cache-Control'),'no-store');
  const text=await r.text();assert.deepEqual(JSON.parse(text),{ok:true,owner:true});assert.doesNotMatch(text,/@/,'no devuelve el email');
  assert.equal(g.calls.length,1,'solo verifica el token: no lee catálogo ni incidencias');
 }
});

test('/api/bugito/owner: solo GET y solo en admira.biz, pages.dev y localhost',async()=>{
 const g=google('csilvasantin@gmail.com');
 assert.equal((await handleBugitoXpacios(owner({Authorization:'Bearer t'},'POST'),env,g.f)).status,405);
 assert.equal((await handleBugitoXpacios(owner({Authorization:'Bearer t'},'GET','www.clearchannel.tv'),env,g.f)).status,404);
 assert.equal((await handleBugitoXpacios(owner({Authorization:'Bearer t'},'GET','www.admira.app'),env,g.f)).status,404);
 for(const host of ['admira.biz','clearchannel-tv.pages.dev','localhost'])assert.equal((await handleBugitoXpacios(owner({Authorization:'Bearer t'},'GET',host),env,g.f)).status,200,host);
});

test('el worker enruta /api/bugito/owner al handler de Bugito (sin sesión: 401 JSON, no la portada)',async()=>{
 const r=await worker.fetch(new Request('https://www.admira.biz/api/bugito/owner'),{ASSETS:{fetch:async()=>new Response('<html>portada</html>',{headers:{'Content-Type':'text/html'}})}});
 assert.equal(r.status,401);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(await r.json(),{ok:false,error:'sign_in_required'});
});

test('colores por modo: apagado = colores por circuito exactos de antes de 857a8cf; encendido = semáforo',()=>{
 const palette=['#ff4fd8','#ffb030','#88ffaa'];
 const off=tooltip.paint(false,palette);
 assert.deepEqual(off.point,['coalesce',['get','color'],'#78f3ff']);
 assert.deepEqual(off.cluster,['match',['get','circIdx'],0,'#ff4fd8',1,'#ffb030',2,'#88ffaa','#78f3ff']);
 assert.deepEqual(off.pulseStroke,['case',['==',['get','emit'],1],'#88ffaa',['==',['get','emit'],-1],'#ff4d4d',['coalesce',['get','color'],'#78f3ff']]);
 assert.deepEqual(off.pulseWidth,['case',['!=',['get','emit'],0],3,2]);
 assert.doesNotMatch(JSON.stringify(off),/incident/,'el público no pinta nada por incidencias');
 const on=tooltip.paint(true,palette);
 assert.deepEqual(on.point,['match',['get','incidentLevel'],0,'#39d98a',1,'#ffd23f',2,'#ff4d4d','#80909c']);
 assert.deepEqual(on.cluster,['match',['get','incidentMax'],0,'#39d98a',1,'#ffd23f',2,'#ff4d4d','#80909c']);
 assert.deepEqual(on.pulseStroke,on.point);assert.equal(on.pulseWidth,2);
 // Sin paleta, el cluster no deja un «match» inválido para MapLibre.
 assert.equal(tooltip.paint(false,[]).cluster,'#78f3ff');
});

test('ownerToken: solo un 200 con owner:true del servidor enciende el modo',async()=>{
 const answer=map=>async(url,init)=>{assert.equal(url,'/api/bugito/owner');const t=init.headers.Authorization.slice(7);const a=map[t];if(a instanceof Error)throw a;return Response.json(a[1],{status:a[0]});};
 assert.equal(await ownerToken([],answer({})),'');
 assert.equal(await ownerToken(['a'],answer({a:[401,{ok:false,error:'sign_in_required'}]})),'');
 assert.equal(await ownerToken(['a'],answer({a:[403,{ok:false,error:'owner_required'}]})),'');
 assert.equal(await ownerToken(['a'],answer({a:[200,{ok:true,owner:false}]})),'');
 assert.equal(await ownerToken(['a'],answer({a:[200,{ok:true}]})),'');
 assert.equal(await ownerToken(['a'],answer({a:Error('red')})),'');
 assert.equal(await ownerToken(['a'],answer({a:[200,{ok:true,owner:true}]})),'a');
 // Bugito con otra cuenta y la cabecera con la del owner: vale la que el servidor acepta.
 assert.equal(await ownerToken(['otra','owner'],answer({otra:[403,{ok:false}],owner:[200,{ok:true,owner:true}]})),'owner');
 let calls=0;await ownerToken(['x','x',''],async()=>{calls++;return Response.json({},{status:401});});assert.equal(calls,1,'sin repetir tokens ni mandar vacíos');
});

// El módulo del navegador con un DOM mínimo: qué pide a la red y qué pinta según la sesión.
let instance=0;
async function page({bugito='',header='',ownerOK=false}={}){
 const requests=[],events=[],appended=[],intervals=[],cleared=[];let listener=null;
 const win=new EventTarget();
 Object.assign(win,{localStorage:{},
  BugitoSuper:{token:()=>bugito,signedIn:()=>!!bugito,onChange:cb=>{listener=cb;}},
  AdmiraLoginGoogle:{stored:()=>header?{token:header,email:'x'}:null}});
 win.addEventListener('bugito:incident-mode',e=>events.push(e.detail.enabled));
 const element=()=>{const small={textContent:''};return {setAttribute(){},querySelector:s=>s==='small'?small:null,remove(){this.removed=true;},removed:false};};
 globalThis.window=win;
 globalThis.document={readyState:'complete',hidden:false,documentElement:{lang:'es'},body:{append:el=>appended.push(el)},
  querySelector:s=>s==='#map'?{}:null,querySelectorAll:()=>[],getElementById:()=>null,createElement:element};
 globalThis.fetch=async(url,init={})=>{requests.push({url:String(url),auth:init.headers?.Authorization||''});
  if(url==='/api/bugito/owner')return ownerOK?Response.json({ok:true,owner:true}):Response.json({ok:false,error:'owner_required'},{status:403});
  if(String(url).startsWith('https://api.yokup.com/incident/map'))return Response.json({ok:true,generated_at:Date.now(),locations:[{id:'loc-1',active:1,severe:1}]});
  throw Error('unexpected '+url);};
 globalThis.setInterval=(fn,ms)=>{intervals.push(ms);return 7;};globalThis.clearInterval=id=>cleared.push(id);
 await import('../bugito-xpacios-ui.mjs?caso='+(++instance));
 const settle=()=>new Promise(r=>setImmediate(r));for(let i=0;i<6;i++)await settle();
 return {win,requests,events,appended,intervals,cleared,settle,signOut:async()=>{bugito='';header='';listener?.();for(let i=0;i<6;i++)await settle();}};
}
const realTimers={setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,fetch:globalThis.fetch};
test.after(()=>{Object.assign(globalThis,realTimers);delete globalThis.window;delete globalThis.document;});

test('sin sesión: ni leyenda, ni intervalo, ni una sola petición (tampoco a incident/map)',async()=>{
 const p=await page();
 assert.deepEqual(p.requests,[]);assert.equal(p.appended.length,0);assert.deepEqual(p.intervals,[]);assert.deepEqual(p.events,[]);
 const m=p.win.BugitoIncidentMap;assert.equal(m.enabled,false);assert.equal(m.level('loc-1'),-1);
 await m.poll();p.win.dispatchEvent(new Event('focus'));await p.settle();
 assert.equal(p.requests.filter(r=>r.url.includes('incident/map')).length,0,'poll() y focus no consultan sin modo');
});

test('sesión que el servidor no reconoce como owner: el modo sigue apagado',async()=>{
 const p=await page({header:'tok-otro'});
 assert.deepEqual(p.requests.map(r=>[r.url,r.auth]),[['/api/bugito/owner','Bearer tok-otro']]);
 assert.equal(p.win.BugitoIncidentMap.enabled,false);assert.equal(p.appended.length,0);assert.deepEqual(p.intervals,[]);
});

test('owner verificado: leyenda, polling cada 15 s y evento; al cerrar sesión se apaga todo',async()=>{
 const p=await page({bugito:'tok-owner',ownerOK:true});
 assert.equal(p.requests[0].url,'/api/bugito/owner');assert.equal(p.requests[0].auth,'Bearer tok-owner');
 const m=p.win.BugitoIncidentMap;assert.equal(m.enabled,true);assert.deepEqual(p.events,[true]);
 assert.equal(p.appended.length,1);assert.equal(p.appended[0].id,'incident-legend');assert.match(p.appended[0].innerHTML,/Incidencias/);
 assert.deepEqual(p.intervals,[15000]);assert.ok(p.requests.some(r=>r.url.startsWith('https://api.yokup.com/incident/map')));
 assert.equal(m.level('loc-1'),2);
 await p.signOut();
 assert.equal(m.enabled,false);assert.deepEqual(p.events,[true,false]);assert.equal(p.appended[0].removed,true);assert.deepEqual(p.cleared,[7]);
 assert.equal(m.level('loc-1'),-1);
 const before=p.requests.length;await m.poll();assert.equal(p.requests.length,before,'apagado no vuelve a leer incident/map');
});

test('la cabecera «Iniciar sesión» también vale: el aviso admira:session vuelve a preguntar al servidor',async()=>{
 const p=await page();assert.deepEqual(p.requests,[]);
 p.win.AdmiraLoginGoogle.stored=()=>({token:'tok-cabecera',email:'x'});
 globalThis.fetch=(f=>async(url,init)=>url==='/api/bugito/owner'?(p.requests.push({url,auth:init.headers.Authorization}),Response.json({ok:true,owner:true})):f(url,init))(globalThis.fetch);
 p.win.dispatchEvent(new CustomEvent('admira:session',{detail:{source:'google'}}));for(let i=0;i<6;i++)await p.settle();
 assert.equal(p.requests[0].auth,'Bearer tok-cabecera');assert.equal(p.win.BugitoIncidentMap.enabled,true);assert.deepEqual(p.events,[true]);
});

test('app.js pinta por modo, repinta en caliente y solo enseña la incidencia del tooltip con el modo encendido',()=>{
 const app=read('app.js');
 assert.match(app,/window\.IncidentMapTooltip\.paint\(incidentModeOn\(\), CIRCUIT_PALETTE\)/);
 assert.match(app,/addEventListener\('bugito:incident-mode', \(\) => applyIncidentMode\(\)\)/);
 for(const [layer,prop] of [['clusters','circle-color'],['locs-glow','circle-color'],['unclustered-pulse','circle-stroke-color'],['unclustered-point','circle-color']])
  assert.match(app,new RegExp("set\\('"+layer+"', '"+prop+"'"),layer);
 assert.match(app,/\(incidentModeOn\(\) \? window\.IncidentMapTooltip\.html\(/);
 assert.doesNotMatch(app,/return \['match', \['get', 'incidentLevel'\]/,'el semáforo ya no es el color fijo');
 const login=read('login-google.js');assert.match(login,/dispatchEvent\(new CustomEvent\('admira:session'/);
 const ui=read('bugito-xpacios-ui.mjs');assert.doesNotMatch(ui,/OWNERS|csilva/,'el navegador no decide quién es owner');
 const html=read('index.html');
 for(const f of ['bugito-xpacios-ui.mjs','login-google.js','incident-map-tooltip.js','app.js'])assert.match(html,new RegExp(f.replace('.','\\.')+'\\?v=20261024-incidencias-owner-1'),f);
 assert.ok(html.indexOf('bugito-super.js?v=')<html.indexOf('bugito-xpacios-ui.mjs?v='),'BugitoSuper existe antes que el módulo');
 assert.ok(html.indexOf('incident-map-tooltip.js?v=')<html.indexOf('app.js?v='),'paint() existe antes que app.js');
});
