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
test('exact selected subset is deduplicated and ES/EN exports keep provenance',()=>{const p=proposal(brief,{...snapshot,items:[snapshot.items[0],snapshot.items[0]]},planner,'2026-10-18');assert.equal(p.locations.length,1);assert.equal(p.estimate.points,1);assert.match(proposalText(p,'es'),/no personas únicas/);assert.match(proposalText(p,'en'),/not unique people/);assert.match(proposalText(p,'en'),/Does not book or publish/);assert.equal(normalizeBrief({...brief,email:'excluded'}).email,'');});   // 20-oct: el correo del anunciante es opcional y sólo se guarda si es un correo válido (para «Enviar por correo»); sigue sin salir de la pestaña
test('commercial release is scoped to Biz, including its existing planner UI',()=>{for(const f of ['comercial.mjs','comercial-core.mjs','comercial.css','assets/comercial.svg','planner-ui.js']){assert(BIZ_ASSET_FILES.includes(f));assert(bizAssetPath(new URL('https://www.admira.biz/'+f)));assert.equal(bizAssetPath(new URL('https://clearchannel.tv/'+f)),'');}const source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8');assert(!/localStorage|sessionStorage|fetch\(/.test(source));assert.match(source,/sameSelection\(ctx.snapshot\(\),selected\)/);});
test('commercial has visible entry points: header button and «Anunciarme aquí» in the Xpacio card, hidden until the module loads',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8'),app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/<button type="button" id="header-comercial-toggle" class="mode-toggle header-comercial" hidden/);assert.match(html,/<a href="#" id="p-comercial" class="p-comercial" hidden data-commercial="here">/);
 assert.match(html,/comercial\.mjs\?v=20261020-comercial-12/);assert.match(html,/app\.js\?v=20261020-comercial-9/);
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
test('send by email: mailto with the advertiser as recipient when given, the commercial contact in copy, subject, summary and a bounded body',async()=>{
 const {proposal,proposalMailto,normalizeBrief}=await import('../comercial-core.mjs');
 assert.equal(normalizeBrief({email:' ana@cafe-rico.es '}).email,'ana@cafe-rico.es');assert.equal(normalizeBrief({email:'no es correo'}).email,'');
 const planner={validSettings:()=>true,quote:items=>({estimatedImpr:12345,price:678.9})};
 const muchos={ready:true,circuit:'Todos',target:'Exterior',items:Array.from({length:40},(_,i)=>({id:'loc-'+i,name:'Local número '+i+' con nombre largo',impr:100,cpm:5,demo:false}))};
 const p=proposal({advertiser:'Café Rico',email:'ana@cafe-rico.es',objective:'Lanzar el frappé',audience:'Jóvenes',start:'2026-10-20',end:'2026-10-26',budget:2000,passesDay:1000,durationSec:15},muchos,planner,'2026-10-20');
 const url=proposalMailto(p,{lang:'es'});
 assert.match(url,/^mailto:ana%40cafe-rico\.es\?cc=info%40admira\.com&subject=/);
 const q=new URLSearchParams(url.slice(url.indexOf('?')+1));
 assert.equal(q.get('subject'),'Propuesta de campaña · Café Rico · 2026-10-20');assert.equal(q.get('cc'),'info@admira.com');
 const body=q.get('body');assert.ok(body.length<=1800,'cuerpo acotado: '+body.length);assert.match(body,/^Hola,/);assert.match(body,/PDF adjunto/);assert.match(body,/… y 35 ubicaciones más \(en el PDF\)\./);assert.match(body,/Comercial · info@admira\.com$/);assert.ok(!/\+/.test(url.split('body=')[0]),'sin signos más en el asunto');
 const sin=proposalMailto({...p,brief:{...p.brief,email:''}},{lang:'en'});assert.match(sin,/^mailto:\?cc=/);assert.match(decodeURIComponent(sin),/Campaign proposal · Café Rico/);
 const source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8');assert.match(source,/id="commercial-mail"/);assert.match(source,/name="email" type="email"/);assert.match(source,/a\.href=correoPropuesta\(\)/);assert.ok(!/fetch\(|localStorage/.test(source));
});
test('merchant brief: branded A4 document and mailto with the merchant contact as recipient when it is an email',async()=>{
 const {merchantBrief,merchantHtml,merchantMailto}=await import('../comercial-core.mjs');
 const m=merchantBrief({name:'Panadería <La Espiga>',city:'Barcelona',address:'Carrer Gran de Gràcia 51',contact:'pepe@laespiga.cat',screens:'3',notes:'Dos en el mostrador\ny una en el escaparate'});
 const html=merchantHtml(m,{lang:'es',brand:{wordmark:'ADMIRA·BIZ',domain:'www.admira.biz'},today:'2026-10-20'});
 assert.match(html,/<title>Ficha de captación · Panadería &lt;La Espiga&gt; · 20-10-2026<\/title>/);assert.ok(!/<La Espiga>/.test(html));assert.match(html,/ADMIRA·BIZ/);assert.match(html,/Carrer Gran de Gràcia 51/);assert.match(html,/Dos en el mostrador y una en el escaparate/);   // clean() cambia los saltos de línea por espaciosassert.match(html,/admira\.app\/retailer/);assert.match(html,/no crea una cuenta/);assert.match(html,/info@admira\.com/);assert.match(html,/@page\{size:A4/);
 assert.match(merchantHtml(m,{lang:'en'}),/<html lang="en">[\s\S]*Recruitment brief/);
 const url=merchantMailto(m,{lang:'es'});assert.match(url,/^mailto:pepe%40laespiga\.cat\?cc=info%40admira\.com&subject=/);
 const q=new URLSearchParams(url.slice(url.indexOf('?')+1));assert.equal(q.get('subject'),'Incorporación de pantallas · Panadería <La Espiga> · Barcelona');assert.match(q.get('body'),/^Hola,[\s\S]*PDF adjunto[\s\S]*Pantallas: 3[\s\S]*Comercial · info@admira\.com$/);assert.ok(q.get('body').length<=1800);
 const tel=merchantMailto(merchantBrief({...m,contact:'600 000 000'}),{lang:'en'});assert.match(tel,/^mailto:\?cc=/);assert.match(decodeURIComponent(tel),/Screen onboarding · Panadería <La Espiga>/);
 const source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8');assert.match(source,/id="commercial-merchant-pdf" class="primary"/);assert.match(source,/id="commercial-merchant-mail"/);assert.match(source,/a\.href=correoFicha\(\)/);assert.ok(!/fetch\(|localStorage/.test(source));
});
test('the proposal map: Web Mercator tiles of the portada imagery, one numbered marker per location, close-up for one point and fitted zoom for several',async()=>{
 const {mapaPropuesta,mapaHtml,proposal,proposalHtml,TESELAS}=await import('../comercial-core.mjs');
 assert.equal(mapaPropuesta([{id:'a',name:'A'}]),null,'sin coordenadas, sin mapa');
 const uno=mapaPropuesta([{id:'pg103',coords:[2.1651,41.3932]}]);
 assert.equal(uno.zoom,16);assert.equal(uno.marcadores.length,1);assert.equal(uno.marcadores[0].n,1);
 assert.ok(Math.abs(uno.marcadores[0].left-uno.ancho/2)<=1&&Math.abs(uno.marcadores[0].top-uno.alto/2)<=1,'una ubicación, centrada');
 assert.ok(uno.teselas.length>=6&&uno.teselas.every(t=>/^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/16\/\d+\/\d+$/.test(t.url)),'teselas Esri del zoom 16');
 assert.ok(uno.teselas.every(t=>t.left>-256&&t.left<uno.ancho&&t.top>-256&&t.top<uno.alto),'teselas dentro del hueco');
 const varios=mapaPropuesta([{id:'bcn',coords:[2.17,41.39]},{id:'mad',coords:[-3.70,40.42]},{id:'bil',coords:[-2.93,43.26]}]);
 assert.ok(varios.zoom<16&&varios.zoom>=5,'zoom ajustado: '+varios.zoom);assert.equal(varios.marcadores.length,3);
 for(const m of varios.marcadores)assert.ok(m.left>=40&&m.left<=varios.ancho-40&&m.top>=40&&m.top<=varios.alto-40,'marcador con margen: '+JSON.stringify(m));
 assert.ok(varios.marcadores[0].left>varios.marcadores[1].left,'Barcelona al este de Madrid');assert.ok(varios.marcadores[2].top<varios.marcadores[1].top,'Bilbao al norte de Madrid');
 assert.equal(TESELAS,'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
 const planner={validSettings:()=>true,quote:items=>({estimatedImpr:100,price:10})};
 const p=proposal({advertiser:'Café Rico',objective:'x',audience:'y',start:'2026-10-20',end:'2026-10-26',budget:2000,passesDay:1000,durationSec:15},{ready:true,circuit:'c',target:'t',items:[{id:'pg103',name:'Starbucks PG',impr:10,cpm:1,coords:[2.1651,41.3932],foto:'https://stock.admira.store/x.webp'},{id:'sin',name:'Sin foto',impr:10,cpm:1,coords:[2.17,41.40],foto:'javascript:alert(1)'}]},planner,'2026-10-20');
 assert.deepEqual(p.locations[0].coords,[2.1651,41.3932]);assert.equal(p.locations[0].foto,'https://stock.admira.store/x.webp');assert.equal(p.locations[1].foto,undefined,'sólo fotos https');
 const html=proposalHtml(p,{lang:'es'});assert.match(html,/<h2>Mapa de las ubicaciones<\/h2><div class="mapa"/);assert.match(html,/class="marca-mapa"[^>]*>1<\/span>/);assert.match(html,/<th>Foto<\/th>/);assert.match(html,/<img src="https:\/\/stock\.admira\.store\/x\.webp"/);assert.match(html,/Esri · Maxar/);
 assert.ok(!/Mapa de las ubicaciones/.test(proposalHtml({...p,locations:p.locations.map(l=>({id:l.id,name:l.name,demo:false}))})),'sin coordenadas, sin mapa ni columna de foto');
 assert.equal(mapaHtml({locations:[]}),'');
 const source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8');assert.match(source,/await imagenes\(w\.document\)/);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert.match(app,/coords:Array\.isArray\(loc\.coords\)\?loc\.coords\.slice\(0,2\):null,foto,/);
});
test('dictated brief: advertiser, objective, audience, budget, dates, plays and duration from plain Spanish or English; intents for the other steps; nothing invented',async()=>{
 const {briefDesdeTexto}=await import('../comercial-core.mjs');
 const a=briefDesdeTexto('Campaña para Café Rico que quiere lanzar el frappé de otoño, dirigida a jóvenes urbanos de 20 a 35 años, del 20 al 26 de octubre, con un presupuesto de 2.000 euros, 1000 pases al día y spots de 15 segundos',{hoy:'2026-10-20'});
 assert.deepEqual(a.campos,{advertiser:'Café Rico',budget:2000,start:'2026-10-20',end:'2026-10-26',passesDay:1000,durationSec:15,audience:'jóvenes urbanos de 20 a 35 años',objective:'lanzar el frappé de otoño'});
 assert.deepEqual(a.faltan,[]);assert.equal(a.intencion,'brief');assert.match(a.resumen,/^Apuntado: .*Lo tengo todo/);
 const b=briefDesdeTexto('El anunciante es Panadería La Espiga. Objetivo: dar a conocer la nueva tienda. Público: familias del barrio. Presupuesto 500 euros. Dos semanas desde el 3 de noviembre',{hoy:'2026-10-20'});
 assert.deepEqual(b.campos,{advertiser:'Panadería La Espiga',budget:500,start:'2026-11-03',end:'2026-11-16',audience:'familias del barrio',objective:'dar a conocer la nueva tienda'});
 const c=briefDesdeTexto('For Nike, to launch the new trainers, aimed at runners in Barcelona, budget 3000, two weeks from 3 November',{hoy:'2026-10-20',lang:'en'});
 assert.deepEqual(c.campos,{advertiser:'Nike',budget:3000,start:'2026-11-03',end:'2026-11-16',audience:'runners in Barcelona',objective:'to launch the new trainers'});assert.match(c.resumen,/^Noted: .*I have everything/);
 const d=briefDesdeTexto('Queremos anunciar la terraza de verano',{hoy:'2026-10-20'});
 assert.deepEqual(Object.keys(d.campos),['objective']);assert.deepEqual(d.faltan,['advertiser','audience','budget']);assert.match(d.resumen,/Me falta el anunciante, la audiencia, el presupuesto\./);
 assert.equal(briefDesdeTexto('buenas tardes',{hoy:'2026-10-20'}).resumen,'No he entendido el brief. Dime el anunciante, el objetivo, a quién llegar y el presupuesto.');
 assert.equal(briefDesdeTexto('Quiero captar un comercio nuevo').intencion,'comercios');assert.equal(briefDesdeTexto('prepara la propuesta').intencion,'propuesta');assert.equal(briefDesdeTexto('abre las ubicaciones').intencion,'ubicaciones');assert.equal(briefDesdeTexto('elige audiencias').intencion,'audiencias');
 // Fechas: «una semana desde mañana»; un rango ya pasado salta al año siguiente.
 const e=briefDesdeTexto('una semana desde mañana',{hoy:'2026-10-20'});assert.equal(e.campos.start,'2026-10-21');assert.equal(e.campos.end,'2026-10-27');
 const f=briefDesdeTexto('del 2 al 8 de enero',{hoy:'2026-10-20'});assert.equal(f.campos.start,'2027-01-02');assert.equal(f.campos.end,'2027-01-08');
 // Pases y duración sólo si son de la lista; presupuesto en miles.
 const g=briefDesdeTexto('presupuesto 3 mil euros, 700 pases, 20 segundos',{hoy:'2026-10-20'});assert.equal(g.campos.budget,3000);assert.equal(g.campos.passesDay,undefined);assert.equal(g.campos.durationSec,undefined);
});
test('voice and ear: the Admirito cloud (personaje=comercial) speaks for Commercial and what it hears becomes the brief; own mic and browser voice as fallback; still no fetch',()=>{
 const source=readFileSync(new URL('../comercial.mjs',import.meta.url),'utf8');
 assert.match(source,/NUBE_ORIGEN='https:\/\/digitalavatar\.ai'/);assert.match(source,/personaje=comercial&embed=0&dock=1&tier=good&lang=/);
 assert.match(source,/ev\.source!==nubeFrame\.contentWindow\|\|ev\.origin!==NUBE_ORIGEN/,'sólo mensajes de la nube');assert.match(source,/da-comercial-listo/);assert.match(source,/da-comercial-texto/);assert.match(source,/postMessage\(\{type:'da-comercial',estado,texto:texto\|\|'',silencio,lang:language\(\)\},NUBE_ORIGEN\)/);
 assert.match(source,/function aplicarDictado\(texto\)\{\n const r=briefDesdeTexto\(texto,\{hoy:today\(\),lang:language\(\)\}\);/);assert.match(source,/id="commercial-mic"/);assert.match(source,/webkitSpeechRecognition/);assert.match(source,/SpeechSynthesisUtterance/);
 assert.match(source,/setAttribute\('allow','microphone'\)/);assert.ok(!/nubeFrame\.loading='lazy'/.test(source),'la nube carga aunque su hueco esté oculto');assert.ok(!/fetch\(|localStorage|sessionStorage/.test(source));
});
// 20-oct-2026: un comentario «//» pegado a una línea de una sola función se tragó su «}» y Comercial dejó de cargar en
// producción (SyntaxError). Las pruebas no importan comercial.mjs (DOM), así que la sintaxis se comprueba aparte.
test('comercial.mjs, comercial-core.mjs and movible.mjs parse (node --check)',async()=>{
 const {execFileSync}=await import('node:child_process');
 for(const f of ['comercial.mjs','comercial-core.mjs','movible.mjs'])execFileSync(process.execPath,['--check',new URL('../'+f,import.meta.url).pathname],{stdio:'pipe'});
});
