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
