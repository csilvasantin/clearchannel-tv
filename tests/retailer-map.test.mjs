import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const section=app.slice(app.indexOf('let walkReturnRestored ='),app.indexOf('// ─── Refresh asincrónico desde el worker (KV)'));
test('direct map links load a new retailer place and refreshes do not duplicate markers',async()=>{
 const place={id:'yokup-abc',name:'Estanco importado',source:'yokup-retailer',coords:[2.1,41.4],surfaces:[]},flights=[],timers=[];
 const ctx=vm.createContext({LOCATIONS:[{id:'legacy'}],URLSearchParams,location:{search:'?locationId=yokup-abc'},document:{hidden:false},window:{loadOmnipLocationDetail:async()=>place,loadYokupLocationsAsync:async()=>[place]},map:{loaded:()=>true},setLocations:next=>ctx.LOCATIONS=next,updateLocationsSource:()=>{},renderCircuitSelector:()=>{},flyToLocation:loc=>flights.push(loc.id),setInterval:(fn,ms)=>timers.push({fn,ms})});
 vm.runInContext(section,ctx);await ctx.mergeRetailerLocations();await ctx.mergeRetailerLocations();
 assert.equal(ctx.LOCATIONS.filter(l=>l.id===place.id).length,1);assert.ok(ctx.LOCATIONS.some(l=>l.id==='legacy'));assert.deepEqual(flights,['yokup-abc']);assert.deepEqual(Array.from(ctx.LOCATIONS.find(l=>l.id===place.id).coords),[2.1,41.4]);assert.equal(timers[0].ms,60000);
 ctx.window.loadYokupLocationsAsync=async()=>{throw Error('offline');};await ctx.mergeRetailerLocations();assert.equal(ctx.LOCATIONS.filter(l=>l.id===place.id).length,1);
});
