const {test}=require('node:test');
const a=require('node:assert/strict');
const H=require('../tour-health.js');
const V=require('../vision-general.js');
const loc={surfaces:[{screen:'a'},{screen:'b'}]};
test('solo reproducción reciente confirma emisión; error, vacío y fecha futura son desconocidos',()=>{
 a.equal(H.signal({item:{ts:900}},1000),'online');
 a.equal(H.signal({item:{ts:1}},200000),'offline');
 for(const item of [null,{}, {ts:1001},{ts:'900'}])a.equal(H.signal({item},1000),'unknown');
});
test('verde requiere todas las pantallas; una sin mapear o desconocida impide todo OK',()=>{
 a.equal(H.health(loc,{a:'online',b:'online'}).state,'online');
 a.equal(H.health(loc,{a:'offline',b:'offline'}).state,'offline');
 a.equal(H.health(loc,{a:'online'}).state,'partial');
 a.equal(H.health({surfaces:[{screen:'a'},{}]},{a:'online'}).state,'partial');
 a.equal(H.health(loc,{}).state,'unknown');
});
test('España sin telemetría mantiene gris, y conexión parcial nunca es OK',()=>{
 const h=V.circuitHealth([loc],()=> 'unknown',null,'alsea_starbucks');
 a.equal(h.demo,false);a.equal(h.totals.sin_datos,1);
 a.equal(V.storeHealth(loc,(l,s)=>s.screen==='a'?'online':'unknown').state,'incidencia');
});
test('España tiene exactamente los tres destinos confirmados y los comandos conservan México',()=>{
 require('../global-tour.js');const cfg=globalThis.GlobalTour.config('alsea_starbucks');
 a.deepEqual(Object.keys(cfg.stops),['lab-gran-de-gracia-51','alsea-sbux-021','alsea-sbux-014']);
 const C=require('../expert-commands.js');
 a.equal(C.resolveDoohClient('starbucks espana').circuit,'alsea_starbucks');
 a.equal(C.resolveDoohClient('starbucks spain').circuit,'alsea_starbucks');
 a.equal(C.resolveDoohClient('starbucks').circuit,'alsea_mexico');
});
test('ausencia explícita de señal en un player vinculado es roja; error HTTP o identidad distinta no lo son',()=>{
 a.equal(H.signal({ok:true,screen:'a',item:null},1000,'a'),'offline');
 a.equal(H.signal({ok:false,screen:'a'},1000,'a'),'unknown');
 a.equal(H.signal({ok:true,screen:'b',item:{ts:900}},1000,'a'),'unknown');
 a.equal(H.signal({ok:true,screen:'a',item:{ts:900},device:{display:{visible:20}}},1000,'a'),'fault');
 a.equal(H.health(loc,{a:'fault',b:'online'}).state,'partial');
});
test('las vinculaciones del laboratorio y del iPad provienen de sus identidades exactas',()=>{
 const vm=require('node:vm'),fs=require('node:fs');const window={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../locations.js'),'utf8'),{window,console,URL,localStorage:{getItem:()=>null}});
 const merged=window.mergeOmnipLocations([{id:'alsea-sbux-021',surfaces:[],iot:[{type:'iPad',player:'ipad-admin-mupi'}]}]);
 const lab=merged.find(l=>l.id==='lab-gran-de-gracia-51');
 a.equal(lab.surfaces.find(s=>s.itil==='GDG51-PAN-07').screen,'macbookpro16');
 a.equal(merged.find(l=>l.id==='alsea-sbux-021').surfaces[0].screen,'ipad-admin-mupi');
 a.equal(merged.find(l=>l.id==='alsea-sbux-014').surfaces.some(s=>s.screen),false);
});
test('Diagonal confirmado sin instalación no es una avería ni se consulta como player',()=>{
 const place={monitoringKind:'location-only',surfaces:[{screen:'catalogue-placeholder'}]};
 a.deepEqual(H.screens(place),[]);a.equal(H.health(place,{}).state,'location');
});
test('la pantalla central reservada no se presenta como avería ni como reproducción falsa',()=>{
 const space={surfaces:[{screen:'a'},{screen:'b',emissionReserved:true}]};
 const h=H.health(space,{a:'online',b:'offline'});
 a.equal(h.state,'online');a.equal(h.online,1);a.equal(h.reserved,1);a.equal(h.offline,0);
 a.equal(H.screenState(space,'b',{b:'offline'}),'reserved');
 a.equal(H.screenState(space,'b',{b:'online'}),'online');
 a.equal(H.health(space,{a:'offline',b:'offline'}).state,'partial');
});
