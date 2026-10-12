import {test} from 'node:test';
import assert from 'node:assert/strict';
import planner from '../planner-core.js';
const settings={start:'2026-09-07',end:'2026-09-08',passesDay:500,durationSec:30,budget:100};
const plan={version:1,...settings,scope:'city',circuitId:'madrid',metroLine:'all',ids:['a','b'],target:{placements:['all'],genders:['all'],ages:['all'],timeSlots:['all']}};
test('quote preserves inclusive dates, weighted CPM, passes and duration',()=>{
 const q=planner.quote([{id:'a',impr:1000,surfaces:1,cpm:5},{id:'b',impr:3000,surfaces:2,cpm:10}],settings);
 assert.equal(q.days,2);assert.equal(q.estimatedImpr,4000);assert.equal(q.cpm,8.75);assert.equal(q.price,70);assert.equal(q.surfaces,3);
 assert.equal(planner.quote([{id:'a',impr:1000,cpm:5},{id:'a',impr:1000,cpm:5}],settings).price,10);
});
test('DST and demand dates use calendar days and impossible dates fail',()=>{
 assert.equal(planner.quote([],{...settings,start:'2026-10-24',end:'2026-10-26'}).days,3);
 const q=planner.quote([{id:'a',impr:1000,cpm:10}],{...settings,start:'2026-12-12',end:'2026-12-12',passesDay:1000,durationSec:15});
 assert.equal(q.demand,1.37);assert.equal(q.price,14);
 for(const patch of [{start:'2026-02-30'},{end:'2026-01-01'},{budget:0},{budget:Infinity},{passesDay:1},{durationSec:0},{end:'2028-09-08'}])assert.equal(planner.validSettings({...settings,...patch}),false);
 assert.equal(planner.validSettings(settings,'2026-09-09'),false);
});
test('saved plan restores exact subset and reports removed catalogue points',()=>{
 const storage={data:null,setItem(k,v){this.data=v},getItem(){return this.data}};
 planner.save(storage,{...plan,ids:['a','b','a'],email:'must not persist'});
 const restored=planner.read(storage);assert.deepEqual(restored.ids,['a','b']);assert.equal(restored.email,undefined);
 assert.deepEqual(planner.reconcile(restored,['b','c']),{ids:['b'],missing:['a']});assert.deepEqual(restored.ids,['a','b']);
 storage.data='broken';assert.equal(planner.read(storage),null);
 storage.data=JSON.stringify({...plan,version:2});assert.equal(planner.read(storage),null);
 assert.throws(()=>planner.save({setItem(){throw Error('quota')}},plan),/quota/);
 assert.throws(()=>planner.save(storage,{...plan,ids:[]}),/invalid_plan/);
});

test('estimate (#5804): alcance y precio por defecto, con margen ±15 % y sin puntos = 0', () => {
  const items = [{id:'a', impr:1000, surfaces:2, cpm:4}, {id:'b', impr:3000, surfaces:1, cpm:6}];
  const e = planner.estimate(items, '2026-10-12');
  assert.equal(e.days, 7); assert.equal(e.points, 2); assert.equal(e.surfaces, 3);
  assert.equal(e.start, '2026-10-12'); assert.equal(e.end, '2026-10-18');
  assert.equal(e.impressions, 28000); // (1000+3000) × 7 días × 1000/1000 pases
  assert.equal(e.impressionsMin, Math.round(28000 * 0.85));
  assert.equal(e.impressionsMax, Math.round(28000 * 1.15));
  assert.equal(e.priceMin, Math.round(e.price * 0.85));
  assert.equal(e.priceMax, Math.round(e.price * 1.15));
  assert.ok(e.price > 0 && e.priceMin < e.price && e.priceMax > e.price);
  const quoted = planner.quote(items, {start:'2026-10-12', end:'2026-10-18', passesDay:1000, durationSec:15});
  assert.equal(e.price, quoted.price);
  assert.equal(e.cpm, quoted.cpm);
  const vacio = planner.estimate([], '2026-10-12');
  assert.equal(vacio.points, 0); assert.equal(vacio.impressions, 0); assert.equal(vacio.price, 0);
  assert.equal(planner.estimate(items, 'no-es-fecha', {days:1, passesDay:250, durationSec:30}).days, 1);
});
