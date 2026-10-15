import test from 'node:test';import assert from 'node:assert/strict';
import {parseIncidentOrder,uniqueMatch,screensOf,incidentLevel,equipmentKey} from '../bugito-xpacios-core.mjs';
import {handleBugitoXpacios} from '../server/bugito-xpacios.mjs';
const project={id:'starbucks',label:'Starbucks',circuit:'alsea_starbucks'};
const loc={id:'alsea-sbux-021',name:'Starbucks Paseo de Gracia',circuit:project.circuit,iot:[{idIoT:'Starbucks_PaseodeGracia_103_Pantalla_1',type:'Pantalla',n:1,name:'Pared · 1'},{idIoT:'Starbucks_PaseodeGracia_103_TPV_1',type:'TPV',n:1,name:'TPV'}],surfaces:[]};
const env={ASSETS:{fetch:async()=>Response.json({proyectos:[project]})}};
const request=b=>new Request('https://www.admira.biz/api/bugito/incidents',{method:'POST',headers:{Authorization:'Bearer approved-agent','X-Agente':'OraculoMacMini','Content-Type':'application/json'},body:JSON.stringify(b)});
function upstream({auth=true,location=loc,postOK=true}={}){const sent=[];const f=async(url,init={})=>{
 if(url==='https://api.yokup.com/auth/agente')return Response.json(auth?{ok:true,email:'agentes@silicio.admiranext.com',agent:true,name:'OraculoMacMini'}:{ok:false},{status:auth?200:401});
 if(url.endsWith('/locations'))return Response.json({locations:[loc]});
 if(url.endsWith('/locations/'+loc.id))return Response.json({location});
 if(url==='https://api.yokup.com/incident'){sent.push(JSON.parse(init.body));return Response.json(postOK?{ok:true,id:'INC-ABC123'}:{ok:false},{status:postOK?200:503});}
 throw Error('unexpected URL '+url);
 };return {f,sent};}
test('Spanish and English full orders preserve exact destination and severity',()=>{
 assert.deepEqual(parseIncidentOrder('/bugito genera una incidencia grave de popup en el proyecto "Starbucks" en el establecimiento alsea-sbux-021 y en la pantalla 1'),{project:'Starbucks',location:loc.id,screen:'1',severity:'alta',fault:'popup'});
 assert.deepEqual(parseIncidentOrder('create a total incident in project Starbucks in store alsea-sbux-021 and on screen 1'),null);
 assert.equal(parseIncidentOrder('create an incident critical in project Starbucks in store alsea-sbux-021 and on screen 1').severity,'urgente');
 assert.equal(parseIncidentOrder('genera una incidencia en el proyecto Starbucks en el establecimiento alsea-sbux-021 y en la pantalla 1 gravedad total').severity,'urgente');
 assert.equal(parseIncidentOrder('genera una incidencia en cualquier pantalla'),null);
});
test('ambiguous names never select first destination; TPV number does not shadow screen 1',()=>{
 assert.equal(uniqueMatch([{id:1,name:'x'},{id:2,name:'x'}],'x',x=>[x.name]).error,'target_ambiguous');
 const ss=screensOf(loc);assert.equal(uniqueMatch(ss,'1',s=>[s.id,s.name,s.number,...s.aliases]).item.name,'Pared · 1');
});
test('server-authorized command creates exact persistent canonical incident without sending hardware commands',async()=>{
 const {f,sent}=upstream();const r=await handleBugitoXpacios(request({order:'genera una incidencia en el proyecto Starbucks en el establecimiento alsea-sbux-021 y en la pantalla 1'}),env,f);
 assert.equal(r.status,201);const d=await r.json();assert.equal(d.id,'INC-ABC123');assert.equal(d.persistent,true);assert.equal(d.physical_fault,false);assert.equal(d.level,1);
 assert.equal(sent.length,1);assert.equal(sent[0].loc,loc.id);assert.equal(sent[0].severity,'normal');assert.match(sent[0].resource,/^alsea-sbux-021:pantalla-1:bugito:[a-f0-9]{32}$/);assert.match(sent[0].detail,/Starbucks_PaseodeGracia_103_Pantalla_1/);assert.ok(!('resolve'in sent[0]));assert.ok(!('close'in sent[0]));
});
test('unauthenticated, wrong project, wrong screen, scope change and uncertain write fail closed',async()=>{
 const body={project:'starbucks',location:loc.id,screen:'1'};
 const anonymous=new Request('https://www.admira.biz/api/bugito/incidents',{method:'POST',body:JSON.stringify(body)});assert.equal((await handleBugitoXpacios(anonymous,env,upstream().f)).status,401);
 for(const [b,opts,status] of [[body,{auth:false},401],[{...body,project:'jti'}, {},404],[{...body,screen:'999'}, {},404],[body,{location:{...loc,circuit:'jti_xtanco'}},409],[body,{postOK:false},502]]){
  const u=upstream(opts),r=await handleBugitoXpacios(request(b),env,u.f);assert.equal(r.status,status);if(status!==502)assert.equal(u.sent.length,0);
 }
});
test('catalogue is read-only and customer domains outside Biz do not acquire the new mutation',async()=>{
 const r=await handleBugitoXpacios(new Request('https://www.admira.biz/api/bugito/targets'),env,upstream().f);assert.deepEqual((await r.json()).projects,[project]);
 const q=request({});const other=new Request('https://www.clearchannel.tv/api/bugito/incidents',q);assert.equal((await handleBugitoXpacios(other,env,upstream().f)).status,404);
});
test('normal, severe and empty incident totals match the requested colors',()=>{assert.equal(incidentLevel(),0);assert.equal(incidentLevel({active:2,severe:0}),1);assert.equal(incidentLevel({active:3,severe:1}),2)});

test('Google signature verification and owner role are required server-side',async()=>{
 for(const [email,status] of [['csilvasantin@gmail.com',201],['other@admira.com',403]]){
  const u=upstream(),now=Date.now();let verified=false;
  const f=async(url,init)=>{if(url.startsWith('https://oauth2.googleapis.com/tokeninfo')){verified=true;return Response.json({aud:'861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com',iss:'https://accounts.google.com',sub:'verified-user',exp:Math.floor(now/1000)+300,email_verified:true,email});}return u.f(url,init);};
  const r=await handleBugitoXpacios(new Request('https://www.admira.biz/api/bugito/incidents',{method:'POST',headers:{Authorization:'Bearer signed-google-id-token'},body:JSON.stringify({project:'starbucks',location:loc.id,screen:'1'})}),env,f);
  assert.equal(r.status,status);assert.equal(verified,true);assert.equal(u.sent.length,status===201?1:0);
 }
});

test('inventory references retain verified codes, catalogue numbers and surface keys',()=>{assert.equal(equipmentKey({id:'PDG103-PAN-01',name:'Screen'}),'PDG103-PAN-01');assert.equal(equipmentKey({id:'idIoT',name:'Pared 1',number:'1'}),'pantalla-1');assert.equal(equipmentKey({id:'idIoT',name:'Menu board digital'}),'menu-board-digital')});
