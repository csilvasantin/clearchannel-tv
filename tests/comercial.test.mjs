import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import planner from '../planner-core.js';
import {proposal,proposalText,normalizeBrief,sameSelection} from '../comercial-core.mjs';
import {BIZ_ASSET_FILES,bizAssetPath} from '../server/biz-assets.mjs';
const brief={advertiser:'Anunciante de prueba',objective:'Presentar una campaña',audience:'Público adulto',start:'2026-10-20',end:'2026-10-21',passesDay:500,durationSec:30,budget:100};
const snapshot={ready:true,circuit:'Circuito elegido',target:'Target elegido',items:[{id:'a',name:'Punto A',impr:1000,surfaces:1,cpm:5},{id:'b',name:'Punto B',impr:3000,surfaces:2,cpm:10}]};
test('proposal uses the shared quote exactly and never claims availability or unique people',()=>{const p=proposal(brief,snapshot,planner,'2026-10-18');assert.deepEqual(p.estimate,planner.quote(snapshot.items,brief));assert.equal(p.availability,'unconfirmed');assert.equal(p.status,'draft');assert.equal(p.audienceMetric,'estimated_opportunities_not_unique_people');assert.deepEqual(p.locations.map(x=>x.id),['a','b']);assert.equal(p.budgetExceeded,false);assert.equal(proposal({...brief,budget:1},snapshot,planner,'2026-10-18').budgetExceeded,true);});
test('missing metrics do not use an invented CPM or zero reach',()=>{const p=proposal(brief,{...snapshot,items:[{id:'a',name:'A',impr:null,cpm:null}]},planner,'2026-10-18');assert.equal(p.estimate,null);assert.equal(p.budgetExceeded,null);assert.match(proposalText(p),/Faltan datos/);});
test('expired dates, missing briefs, unavailable catalogue and empty selection require review',()=>{for(const patch of [{advertiser:''},{objective:''},{audience:''},{start:'2026-02-30'},{end:'2026-10-19'},{budget:0}])assert.throws(()=>proposal({...brief,...patch},snapshot,planner,'2026-10-18'));assert.throws(()=>proposal(brief,{...snapshot,ready:false},planner,'2026-10-18'),/catalogue_loading/);assert.throws(()=>proposal(brief,{...snapshot,items:[]},planner,'2026-10-18'),/locations_required/);});
test('exact selected subset is deduplicated and ES/EN exports keep provenance',()=>{const p=proposal(brief,{...snapshot,items:[snapshot.items[0],snapshot.items[0]]},planner,'2026-10-18');assert.equal(p.locations.length,1);assert.equal(p.estimate.points,1);assert.match(proposalText(p,'es'),/no personas únicas/);assert.match(proposalText(p,'en'),/not unique people/);assert.match(proposalText(p,'en'),/Does not book or publish/);assert.equal(normalizeBrief({...brief,email:'excluded'}).email,undefined);});
test('commercial release is scoped to Biz, including its existing planner UI',()=>{for(const f of ['comercial.mjs','comercial-core.mjs','comercial.css','assets/comercial.svg','planner-ui.js']){assert(BIZ_ASSET_FILES.includes(f));assert(bizAssetPath(new URL('https://www.admira.biz/'+f)));assert.equal(bizAssetPath(new URL('https://clearchannel.tv/'+f)),'');}const source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8');assert(!/localStorage|sessionStorage|fetch\(/.test(source));assert.match(source,/sameSelection\(ctx.snapshot\(\),selected\)/);});
test('commercial has visible entry points: header button and «Anunciarme aquí» in the Xpacio card, hidden until the module loads',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/<button type="button" id="header-comercial-toggle" class="mode-toggle header-comercial" hidden/);assert.match(html,/<a href="#" id="p-comercial" class="p-comercial" hidden data-commercial="here">/);
 assert.match(html,/comercial\.mjs\?v=20261020-comercial-6/);assert.match(html,/app\.js\?v=20261020-comercial-5/);
 assert.match(source,/entrada\.hidden=false/);assert.match(source,/aqui\.hidden=false/);assert.match(source,/function abrirConLocal\(id\)/);assert.match(source,/ctx\.seleccionar\(id\)/);
 assert.match(app,/seleccionar\(id\) \{/);assert.match(app,/selectedLocationIds=new Set\(\[loc\.id\]\);\n    try\{renderCircuitSelector\(\);\}/);assert.match(app,/comercialAqui\.dataset\.comercialLocal = loc\.id/);
});

test('demonstration provenance stays explicit in a draft and both exports',()=>{const p=proposal(brief,{...snapshot,items:[{...snapshot.items[0],demo:true}]},planner,'2026-10-18');assert.equal(p.hasDemonstration,true);assert.equal(p.locations[0].demo,true);assert.match(proposalText(p,'es'),/demostración/);assert.match(proposalText(p,'en'),/demonstration/);});

test('selection identity survives language changes but rejects target or location changes',()=>{const a={...snapshot,circuitKey:'c1',targetKey:'t1'},b={...a,circuit:'English label',target:'English target'};assert(sameSelection(a,b));assert(!sameSelection(a,{...b,targetKey:'t2'}));assert(!sameSelection(a,{...b,items:[]}));});
test('the branded proposal document escapes the brief, carries brand, figures, locations and caveats, and prints from an iframe',async()=>{
 const {proposal,proposalHtml}=await import('../comercial-core.mjs');
 const planner={validSettings:()=>true,quote:items=>({estimatedImpr:12345,price:678.9})};
 const snapshot={ready:true,circuit:'Starbucks España · 3 destinos',target:'Exterior + interior',items:[{id:'alsea-sbux-021',name:'Starbucks Paseo de Gracia',impr:1000,cpm:5,demo:false},{id:'lab-1',name:'Laboratorio <b>demo</b>',impr:10,cpm:1,demo:true}]};
 const p=proposal({advertiser:'Café <script>alert(1)</script> Rico',objective:'Lanzar el "frappé" de otoño',audience:'Jóvenes & urbanos',start:'2026-10-20',end:'2026-10-26',budget:2000,passesDay:1000,durationSec:15},snapshot,planner,'2026-10-20');
 const html=proposalHtml(p,{lang:'es',brand:{wordmark:'ADMIRA·BIZ',domain:'www.admira.biz'},colors:{band:'#100c20',accent:'#7dffd0'}});
 assert.match(html,/^<!doctype html><html lang="es">/);assert.match(html,/<title>Propuesta de campaña · Café &lt;script&gt;alert\(1\)&lt;\/script&gt; Rico · 20-10-2026<\/title>/);assert.ok(!/<script>/.test(html),'sin script del brief');
 assert.match(html,/ADMIRA·BIZ/);assert.match(html,/www\.admira\.biz/);assert.match(html,/info@admira\.com/);assert.match(html,/12\.345/);assert.match(html,/678,90/);assert.match(html,/2000,00/);
 assert.match(html,/Starbucks Paseo de Gracia/);assert.match(html,/Laboratorio &lt;b&gt;demo&lt;\/b&gt;/);assert.match(html,/demostración/);assert.match(html,/no personas únicas/);assert.match(html,/no reserva ni publica/);
 assert.match(html,/@page\{size:A4/);assert.match(html,/#100c20/);
 const en=proposalHtml(p,{lang:'en'});assert.match(en,/<html lang="en">/);assert.match(en,/Campaign proposal/);assert.match(en,/20\/10\/2026/);
 const source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8');assert.match(source,/id="commercial-pdf" class="primary"/);assert.match(source,/f\.srcdoc=html/);assert.match(source,/w\.print\(\)/);assert.ok(!/fetch\(|localStorage/.test(source));
});
