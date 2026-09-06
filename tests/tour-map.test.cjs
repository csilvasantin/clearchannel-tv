const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../tour-map.js');
const {createTourCamera, destinationTiles} = globalThis.TourMap;
const source = {type:'raster', tiles:['https://tiles.test/{z}/{y}/{x}'], tileSize:256, maxzoom:19};
const target = {center:[2.17,41.38], zoom:16.8, pitch:45, bearing:-20};
const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
class FakeMap {
  constructor({far=false, raster=false} = {}) {
    this.listeners = new Map(); this.calls = []; this.center = far ? {lng:-28, lat:16} : {lng:2.17, lat:41.38};
    this.zoom = far ? 2 : 16.8; this.moving=false; this.loaded=true; this.raster=raster;
  }
  on(name, fn) { if(!this.listeners.has(name)) this.listeners.set(name,new Set()); this.listeners.get(name).add(fn); }
  off(name,fn) { this.listeners.get(name)?.delete(fn); }
  emit(name,event={}) { for(const fn of [...(this.listeners.get(name)||[])]) fn(event); }
  getStyle() { return {sources:this.raster?{esri:source}:{}}; }
  getCanvas() { return {clientWidth:1400}; }
  getCenter() { return this.center; }
  getZoom() { return this.zoom; }
  isMoving() { return this.moving; }
  isStyleLoaded() { return true; }
  areTilesLoaded() { return this.loaded; }
  triggerRepaint() {}
  stop() { this.moving=false; }
  flyTo(camera) { this.calls.push(camera); this.moving=true; }
  easeTo(camera) { this.flyTo(camera); }
  land() { const c=this.calls.at(-1); this.center={lng:c.center[0],lat:c.center[1]}; this.zoom=c.zoom;this.moving=false;this.emit('moveend'); }
  paint() { this.emit('render'); }
  listenerCount() { return [...this.listeners.values()].reduce((sum,s)=>sum+s.size,0); }
}
const create = (map, extra={}) => createTourCamera(map, {fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),warmupBudget:0,...extra});

test('raster preparation is bounded and uses source tile zoom, latitude clamp, wrapped longitude',()=>{
  const urls=destinationTiles(source,target,5000);
  assert.ok(urls.length<=80);
  assert.equal(new Set(urls).size,urls.length);
  assert.ok(urls.some(url=>url.includes('/18/')));
  for(const url of destinationTiles(source,{center:[181,90],zoom:19},1000)) {
    const [z,y,x]=url.split('/').slice(-3).map(Number);
    assert.ok(Number.isFinite(y)&&y>=0&&y<2**z);assert.ok(x>=0&&x<2**z);
  }
});
test('never accepts old loaded state at moveend; needs two destination renders',async()=>{
  const map=new FakeMap(); const camera=create(map);let finished=false;
  const flight=camera.navigate(target).then(status=>{finished=true;return status;}); await flush();
  assert.equal(map.calls.length,1);map.land();await flush();assert.equal(finished,false);
  map.paint();await flush();assert.equal(finished,false);
  map.paint();assert.equal(await flight,'ready');assert.equal(map.listenerCount(),0);camera.cancel();
});
test('long flight waits for actual tiles before descending',async()=>{
  const map=new FakeMap({far:true});const camera=create(map);const flight=camera.navigate(target);await flush();
  assert.equal(map.calls[0].zoom,13);assert.equal(map.calls[0].pitch,0);
  map.loaded=false;map.land();map.paint();map.paint();await flush();assert.equal(map.calls.length,1);
  map.loaded=true;map.paint();await flush();assert.equal(map.calls[1].zoom,15);
  map.land();map.paint();map.paint();await flush();assert.equal(map.calls[2].zoom,16.8);
  map.land();map.paint();map.paint();assert.equal(await flight,'ready');assert.equal(map.listenerCount(),0);camera.cancel();
});
test('stop during loading removes all callbacks and prevents descent',async()=>{
  const map=new FakeMap({far:true});const camera=create(map);const phases=[];
  const flight=camera.navigate(target,p=>phases.push(p));await flush();map.loaded=false;map.land();map.paint();
  camera.cancel();const count=phases.length;assert.equal(await flight,'cancelled');
  map.loaded=true;map.paint();map.emit('moveend');await flush();
  assert.equal(map.calls.length,1);assert.equal(map.listenerCount(),0);assert.equal(phases.length,count);
});
test('superseded navigation cannot complete old destination',async()=>{
  const map=new FakeMap();const camera=create(map);const first=camera.navigate(target);await flush();
  const second=camera.navigate({...target,center:[2.171,41.38]});await flush();
  assert.equal(await first,'cancelled');map.land();map.paint();map.paint();assert.equal(await second,'ready');camera.cancel();
});
test('external camera interruption cannot count as arrival',async()=>{
  const map=new FakeMap({far:true});const camera=create(map);const flight=camera.navigate(target);await flush();
  map.stop();map.emit('moveend');assert.equal(await flight,'cancelled');assert.equal(map.calls.length,1);assert.equal(map.listenerCount(),0);camera.cancel();
});
test('failed tiles do not count as a successful load even when MapLibre says loaded',async()=>{
  const map=new FakeMap({far:true});const camera=create(map);const flight=camera.navigate(target);await flush();
  map.emit('error',{sourceId:'esri'});map.land();map.paint();map.paint();
  assert.equal(await flight,'error');assert.equal(map.calls.length,1);assert.equal(map.listenerCount(),0);camera.cancel();
});
test('timeout retires callbacks and does not continue the tour',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const map=new FakeMap({far:true});const camera=create(map,{readyTimeout:50});const flight=camera.navigate(target);await flush();
  map.loaded=false;map.land();map.paint();t.mock.timers.tick(5000);
  assert.equal(await flight,'timeout');assert.equal(map.calls.length,1);assert.equal(map.listenerCount(),0);assert.equal(map.moving,false);camera.cancel();
});
test('prepare shares the next destination, caps concurrency and aborts on stop',async()=>{
  const map=new FakeMap({raster:true});let calls=0,active=0,maxActive=0,aborted=0;
  const camera=create(map,{fetch:(_,{signal})=>new Promise((resolve,reject)=>{
    calls++;active++;maxActive=Math.max(active,maxActive);
    signal.addEventListener('abort',()=>{active--;aborted++;reject(new Error('aborted'));},{once:true});
  })});
  const prepared=camera.prepare(target);const repeated=camera.prepare(target);assert.equal(prepared,repeated);
  assert.equal(calls,3);camera.cancel();await prepared;assert.equal(aborted,3);assert.equal(maxActive,3);
});
test('no speculative topographic requests; error fetch cannot reject navigation',async()=>{
  const map=new FakeMap();let calls=0;
  const camera=create(map,{fetch:async()=>{calls++;throw new Error('offline');}});
  await camera.prepare(target);assert.equal(calls,0);
  map.raster=true;await camera.prepare(target);assert.ok(calls<=80);camera.cancel();
});
test('stop during preparation cancels requests without starting a camera movement',async()=>{
  const map=new FakeMap({raster:true});
  const camera=create(map,{warmupBudget:1500,fetch:(_,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  })});
  const flight=camera.navigate(target);assert.equal(camera.isNavigating(),true);
  camera.cancel();assert.equal(await flight,'cancelled');assert.equal(camera.isNavigating(),false);assert.equal(map.calls.length,0);
});
test('a failed warmup is retried rather than remembered as successfully prepared',async()=>{
  const map=new FakeMap({raster:true});let calls=0;
  const camera=create(map,{fetch:async()=>{calls++;return {ok:false};}});
  const first=camera.prepare(target);await first;const firstCalls=calls;
  const retry=camera.prepare(target);assert.notEqual(retry,first);await retry;
  assert.ok(firstCalls<=3);assert.ok(calls>firstCalls);assert.ok(calls<=6);camera.cancel();
});
test('data saving mode disables speculative requests',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{value:{connection:{saveData:true}},configurable:true});
  try {
    const map=new FakeMap({raster:true});let calls=0;
    const camera=create(map,{fetch:async()=>{calls++;}});await camera.prepare(target);assert.equal(calls,0);camera.cancel();
  } finally { if(original) Object.defineProperty(globalThis,'navigator',original); else delete globalThis.navigator; }
});
