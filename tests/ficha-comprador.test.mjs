// La ficha pensada para el comprador (FLT-102664 · encargo #7138, 24-oct-2026).
// A · «Anunciarme aquí» es la acción principal de la ficha; sin él, el Tour DooH vuelve a serlo.
// B · La botonera es una rejilla 2×2 que no parte palabras («EXPLORA/R», «ANUNCIA/RME»).
// C · Con ?circuit=…&loc=<id>, la ficha se pinta con ESE local (GET /locations/:id) y la cámara vuela detrás.
// D · La cabecera de Comercial es opaca y la nube tiene sitio para el bocadillo.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js'),css=read('comercial.css'),comercial=read('comercial.mjs');
const fila=html.slice(html.indexOf('<div class="actions panel-navigation">'),html.indexOf('</div>',html.indexOf('<div class="actions panel-navigation">')));
const enlaces=[...fila.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]);
const reglas=sel=>[...html.matchAll(/^\s*([^{}\n]+)\{([^{}]*)\}/gm)].filter(m=>m[1].includes(sel)).map(m=>({sel:m[1].trim(),decl:m[2]}));

test('A · «Anunciarme aquí» va primero y con estilo primario; conserva id, data-commercial, oculto de serie e i18n',()=>{
 assert.deepEqual(enlaces.map(a=>a.match(/id="([^"]+)"/)[1]),['p-comercial','p-tour','p-twin','p-twin-hd','p-plano'],'orden de la botonera');
 assert.equal(enlaces[0],'<a href="#" id="p-comercial" class="p-comercial primary" hidden data-commercial="here">');
 assert.match(fila,/data-commercial="here">💼 Anunciarme aquí<\/a>/);
 assert.match(enlaces[1],/id="p-tour" class="primary" data-i18n="tour_start"/,'el Tour DooH conserva su clase: es el principal cuando Comercial no está');
 assert.match(comercial,/here:\['💼 Anunciarme aquí','💼 Advertise here'\]/,'i18n ES/EN del botón');
 assert.match(comercial,/if\(aqui\)\{aqui\.hidden=false;/,'sólo se muestra cuando carga Comercial');
 assert.match(app,/comercialAqui\.dataset\.comercialLocal = loc\.id/);
 // El Tour DooH sólo baja a secundario con «Anunciarme aquí» a la vista (combinador de hermanos: no hace falta :has).
 const baja=reglas('#p-comercial:not([hidden]) ~ #p-tour.primary');
 assert.equal(baja.length,2,'reposo y hover');
 assert.match(baja[0].decl,/background:transparent;color:var\(--brand\)/);
 assert.match(baja[1].sel,/:hover$/);assert.match(baja[1].decl,/background:var\(--brand\);color:#001620/);
 // Sin el azul !important de antes, que sobre el fondo de marca no se leía.
 assert.doesNotMatch(css,/#p-comercial\{[^}]*!important/);
 assert.match(css,/#p-comercial\[hidden\]\{display:none!important\}/);
});

test('B · rejilla 2×2 sin cortar palabras; los ocultos no dejan hueco',()=>{
 const rejilla=reglas('.actions.panel-navigation').find(r=>r.sel==='aside.panel .actions.panel-navigation'&&/grid/.test(r.decl));
 assert.ok(rejilla,'la fila de navegación es una rejilla');
 assert.match(rejilla.decl,/display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 const boton=reglas('.actions.panel-navigation a').find(r=>r.sel==='aside.panel .actions.panel-navigation a');
 assert.ok(boton,'regla de los botones');
 for(const d of ['word-break:normal','overflow-wrap:normal','hyphens:manual'])assert.ok(boton.decl.includes(d),d);
 for(const r of reglas('panel-navigation'))assert.doesNotMatch(r.decl,/break-all|overflow-wrap:anywhere|word-break:break-word/,r.sel);
 // responsive-shell.css pone overflow-wrap:anywhere a «aside.panel .actions a»: la regla de la ficha es más específica.
 assert.match(read('responsive-shell.css'),/aside\.panel \.actions a\{min-width:0;overflow-wrap:anywhere\}/);
 assert.ok(reglas('.actions.panel-navigation a[hidden]').some(r=>/display:none/.test(r.decl)),'un botón oculto no ocupa celda');
});

// C · comportamiento de la vía rápida, con el código de app.js y el entorno simulado.
const via=app.slice(app.indexOf('var fichaEnlaceTourListo'),app.indexOf('\nabrirFichaPorEnlace();'));
function montar({loc='altadis-es-05-madrid',circuit='altadis_espana',catalogo=[],detalle,estiloListo=true}={}){
 const log=[];const timers=[];const onceLoad=[];
 const env={
  LOC_BY_ID:new Map(catalogo.map(l=>[l.id,l])),LOCATIONS_ALL:catalogo.slice(),circuitLocDone:false,activeLocation:null,rotating:true,
  circuitParam:()=>circuit,circuitLocParam:()=>loc,
  setLocations(list){env.LOCATIONS_ALL=list;env.LOC_BY_ID=new Map(list.map(l=>[l.id,l]));log.push('setLocations');},
  renderPanel(l){env.activeLocation=l;log.push('renderPanel:'+l.id);},
  updateLocationsSource(){log.push('updateLocationsSource');},
  flyToLocation(l,o){log.push('flyToLocation:'+l.id+':'+JSON.stringify(o));},
  setTimeout(fn,ms){timers.push({fn,ms});},
  splash:{classList:{add:c=>log.push('splash.'+c)}},
  panel:{open:false,classList:{add(c){if(c==='open'){env.panel.open=true;log.push('panel.open');}},contains:c=>c==='open'&&env.panel.open}},
  map:{isStyleLoaded:()=>estiloListo,loaded:()=>estiloListo,once:(ev,fn)=>onceLoad.push(fn)},
  window:{
   loadOmnipLocationDetail:async(id,ms)=>{log.push('GET /locations/'+id+' ('+ms+' ms)');return detalle===undefined?{id,name:'Estanco Exp. nº 167 · Fuencarral',coords:[-3.7,40.42],surfaces:[{}]}:detalle;},
   mergeOmnipLocations:list=>[{id:'otra-del-bundle'},...list.map(l=>({...l,cosido:true}))],
  },
 };
 const api=new Function('env',`with(env){${via}\nreturn {abrir:abrirFichaPorEnlace,volar:volarFichaPorEnlace,refrescar:refrescarFichaPorEnlace,tourListo(){fichaEnlaceTourListo=true;volarFichaPorEnlace();}};}`)(env);
 return {env,log,timers,onceLoad,api};
}

test('C · ?loc= pide ESE local por id, pinta la ficha y sólo después vuela la cámara (sin cerrarla)',async()=>{
 const {env,log,timers,api}=montar({catalogo:[{id:'altadis-es-05-madrid',_slim:true,coords:[-3.7,40.42]}]});
 assert.equal(await api.abrir(),true);
 assert.deepEqual(log.slice(0,5),['GET /locations/altadis-es-05-madrid (8000 ms)','setLocations','splash.hidden','renderPanel:altadis-es-05-madrid','panel.open'],'el detalle por id, no el catálogo de 10 MB');
 assert.equal(env.activeLocation.cosido,true,'el mismo cosido que el catálogo completo (mergeOmnipLocations)');
 assert.equal(env.LOC_BY_ID.get('altadis-es-05-madrid'),env.activeLocation,'el local entra en LOC_BY_ID: la marca activa no cierra la ficha');
 assert.equal(env.circuitLocDone,true,'applyCircuitDeepLink ya no vuelve a volar');assert.equal(env.rotating,false);
 assert.ok(!log.some(l=>l.startsWith('flyToLocation')),'la cámara espera a que wireTour fije el circuito');
 api.tourListo();
 assert.equal(log.at(-1),'flyToLocation:altadis-es-05-madrid:{"fichaAbierta":true}');
 timers.forEach(t=>t.fn());assert.ok(log.includes('updateLocationsSource'),'el punto se repinta en el mapa sin retrasar la ficha');
 assert.match(app,/abrirFichaPorEnlace\(\);\n/,'arranca con la página, no espera a wireTour (600 ms)');
});

test('C · la petición temprana del <head> (misma URL que loadOmnipLocationDetail) se aprovecha; si falla, se pide otra vez por id',async()=>{
 const cabeza=html.slice(0,html.indexOf('<script src="/brand.js'));
 assert.match(cabeza,/window\.__fichaEnlaceTemprana=\{id:id,datos:fetch\('https:\/\/brain\.digitalavatar\.ai\/locations\/'\+encodeURIComponent\(id\)/,'antes que brand.js, el mapa y los catálogos');
 assert.match(cabeza,/if\(!id\|\|!q\.get\('circuit'\)\|\|!window\.fetch\)return;/,'sólo con ?circuit=…&loc=…');
 assert.match(read('locations.js'),/window\.OMNIP_API = 'https:\/\/brain\.digitalavatar\.ai';[\s\S]*fetch\(window\.OMNIP_API \+ '\/locations\/' \+ encodeURIComponent\(String\(id\)\)/,'la misma URL que loadOmnipLocationDetail');
 const ya=montar();ya.env.window.__fichaEnlaceTemprana={id:'altadis-es-05-madrid',datos:Promise.resolve({location:{id:'altadis-es-05-madrid',name:'Estanco',coords:[-3.7,40.42],surfaces:[]}})};
 ya.env.window.normalizeOmnipLocations=list=>list.map(l=>({...l,normalizado:true}));
 assert.equal(await ya.api.abrir(),true);
 assert.ok(!ya.log.some(l=>l.startsWith('GET')),'no repite la petición');
 assert.equal(ya.env.activeLocation.normalizado,true);assert.equal(ya.env.activeLocation.cosido,true);
 const falla=montar();falla.env.window.__fichaEnlaceTemprana={id:'altadis-es-05-madrid',datos:Promise.resolve(null)};
 assert.equal(await falla.api.abrir(),true);assert.equal(falla.log[0],'GET /locations/altadis-es-05-madrid (8000 ms)');
 const otro=montar();otro.env.window.__fichaEnlaceTemprana={id:'otro-local',datos:Promise.resolve({location:{id:'otro-local'}})};
 assert.equal(await otro.api.abrir(),true);assert.equal(otro.log[0],'GET /locations/altadis-es-05-madrid (8000 ms)','sólo vale la del mismo id');
});

test('C · con el mapa sin estilo, la cámara espera a «load» (o 2,5 s) y vuela una sola vez',async()=>{
 const {log,timers,onceLoad,api}=montar({estiloListo:false});
 api.tourListo();assert.equal(await api.abrir(),true);
 assert.ok(!log.some(l=>l.startsWith('flyToLocation')));
 assert.equal(onceLoad.length,1);assert.ok(timers.some(t=>t.ms===2500));
 onceLoad[0]();timers.forEach(t=>t.fn());
 assert.equal(log.filter(l=>l.startsWith('flyToLocation')).length,1);
});

test('C · catálogo completo en caché: sin petición; sin local, sin ?loc= o ya resuelto: manda el camino de siempre',async()=>{
 const cache=montar({catalogo:[{id:'altadis-es-05-madrid',coords:[-3.7,40.42],surfaces:[]}]});
 assert.equal(await cache.api.abrir(),true);assert.ok(!cache.log.some(l=>l.startsWith('GET')));assert.ok(!cache.log.includes('setLocations'));
 const sinLocal=montar({detalle:null});
 assert.equal(await sinLocal.api.abrir(),false);assert.equal(sinLocal.env.circuitLocDone,false,'applyCircuitDeepLink sigue a cargo');assert.ok(!sinLocal.log.includes('panel.open'));
 const sinLoc=montar({loc:''});
 assert.equal(await sinLoc.api.abrir(),false);assert.equal(sinLoc.log.length,0,'la portada sin ?loc= no pide nada');
 const sinCircuito=montar({circuit:''});
 assert.equal(await sinCircuito.api.abrir(),false);assert.equal(sinCircuito.log.length,0,'el enlace profundo sigue siendo ?circuit=…&loc=…');
 const yaHecho=montar();yaHecho.env.circuitLocDone=true;
 assert.equal(await yaHecho.api.abrir(),false);assert.ok(!yaHecho.log.includes('renderPanel:altadis-es-05-madrid'));
 const otroPunto=montar();otroPunto.env.activeLocation={id:'otro'};
 assert.equal(await otroPunto.api.abrir(),false,'no se le quita la ficha que ya mira');
 const fueraDeMarca=montar();fueraDeMarca.env.setLocations=list=>{fueraDeMarca.env.LOC_BY_ID=new Map();};
 assert.equal(await fueraDeMarca.api.abrir(),false);assert.equal(fueraDeMarca.env.circuitLocDone,false);
});

test('C · al llegar el catálogo, la ficha se queda con su versión: repinta si cambió, no toca si es igual; y conserva su CPM',async()=>{
 const {env,log,api}=montar();assert.equal(await api.abrir(),true);
 const pintada=env.activeLocation;
 env.LOC_BY_ID=new Map([[pintada.id,JSON.parse(JSON.stringify(pintada))]]);log.length=0;
 api.refrescar();assert.equal(log.length,0,'mismos datos: no se repinta');assert.equal(env.activeLocation,env.LOC_BY_ID.get(pintada.id),'pero se queda con el objeto del catálogo');
 env.LOC_BY_ID=new Map([[pintada.id,{...pintada,surfaces:[{},{}]}]]);
 api.refrescar();assert.deepEqual(log,['renderPanel:altadis-es-05-madrid'],'datos nuevos: se repinta');
 env.activeLocation={id:'otro'};log.length=0;api.refrescar();assert.equal(log.length,0,'otra ficha: no se toca');
 assert.match(app,/plannerCatalogReady = true;\n    try \{ applyCircuitDeepLink\(\); \} catch \(_\) \{\}\n    try \{ refrescarFichaPorEnlace\(\); \} catch \(_\) \{\}/);
 // El catálogo pintaba en #p-cpm el rango de TODO el catálogo encima de la ficha abierta («€1-€16» en vez de «€8»).
 assert.match(app,/const el = document\.getElementById\('p-cpm'\); if \(el && !activeLocation\) el\.textContent = /);
});

test('C · applyCircuitDeepLink sigue de respaldo y flyToLocation no cierra una ficha ya pintada',()=>{
 const fn=app.slice(app.indexOf('function applyCircuitDeepLink'),app.indexOf('function watchCircuitDeepLink'));
 assert.match(fn,/const target = locId && !circuitLocDone \? def\.items\.find\(l => l\.id === locId\) : null;/);
 assert.match(fn,/panelEl\.classList\.toggle\('collapsed', !!locId\)/,'con ?loc= el selector sigue plegado (PR #140)');
 const fly=app.slice(app.indexOf('async function flyToLocation'),app.indexOf('// ─── Network tour'));
 assert.match(fly,/fichaAbierta = false\} = \{\}\)/);
 assert.match(fly,/const yaAbierta = !!\(fichaAbierta && activeLocation && activeLocation\.id === loc\.id && panel\.classList\.contains\('open'\)\);\n  if \(!yaAbierta\) panel\.classList\.remove\('open'\);/);
 assert.match(fly,/let abierta = yaAbierta;/,'no vuelve a pintar la ficha al aterrizar');
 const wire=app.slice(app.indexOf('function wireTour'),app.indexOf("if (document.readyState !== 'loading') setTimeout(wireTour, 600);"));
 assert.ok(wire.indexOf("sel.dispatchEvent(new Event('change'")<wire.indexOf('fichaEnlaceTourListo = true;'),'el «change» del selector (que para vuelos) va antes del vuelo');
 // «Anunciarme aquí» sigue esperando al catálogo hasta 3 minutos antes de incorporar el local.
 assert.match(comercial,/if\(esperas\+\+<360\)/);
});

test('D · Comercial: cabecera y fondo opacos, nube con sitio para el bocadillo y scroll de la ventana en el móvil',()=>{
 const panel=css.match(/#comercial-panel\{[^}]*\}/)[0];
 assert.match(panel,/background:var\(--card,#100c20\) linear-gradient\(180deg,var\(--com-deep\),var\(--card,#100c20\) 38%\)/,'fondo opaco debajo del degradado');
 assert.doesNotMatch(panel,/rgba\(19,47,77,\.55\)/,'sin el arranque translúcido');
 const cabecera=css.match(/#comercial-panel>header\{position:static[^}]*\}/)[0];
 assert.match(cabecera,/background:var\(--com-deep\)/);assert.doesNotMatch(cabecera,/background:rgba/);
 assert.match(css,/#comercial-panel \.commercial-nube\{flex:0 0 auto;height:clamp\(350px,40vh,370px\)/,'escenario de 202-222 px: cara y dos líneas de bocadillo');
 assert.doesNotMatch(css,/commercial-nube\{height:190px\}/);
 assert.match(css,/@media\(max-width:600px\)\{#comercial-panel\{overflow-y:auto;overscroll-behavior:contain\}#comercial-panel>header\{position:sticky;top:0;z-index:3\}#comercial-panel \.commercial-nube\{height:clamp\(360px,48vh,400px\)\}#comercial-panel \.commercial-cuerpo\{flex:0 0 auto;overflow:visible\}\}/);
 assert.match(comercial,/panel\.querySelector\('\.commercial-cuerpo'\)\.scrollTop=0;panel\.scrollTop=0;/,'al abrir, arriba del todo también en el móvil');
});

test('sellos: app.js, comercial.css y comercial.mjs piden la versión nueva',()=>{
 // Los previos al hacer zoom (FLT-102666) vuelven a tocar app.js y comercial.mjs; comercial.css sigue igual.
 for(const f of ['app.js','/comercial.mjs'])assert.ok(html.includes(f+'?v=20261024-previos-zoom-1'),f);
 assert.ok(html.includes('/comercial.css?v=20261024-ficha-comprador-1'),'/comercial.css');
});
