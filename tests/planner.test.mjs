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
