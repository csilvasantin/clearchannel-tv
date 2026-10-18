import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantBrief,merchantText,STEPS} from '../comercial-core.mjs';
test('merchant brief validates screen count and required location',()=>{
 for(const screens of [0,-1,1.5,10001,'no'])assert.throws(()=>merchantBrief({name:'Shop',city:'Barcelona',address:'Gran de Gracia',screens}));
 assert.throws(()=>merchantBrief({screens:2}));
 const p=merchantBrief({name:' Local\nuno ',city:'Barcelona',address:'Calle 1',screens:2});
 assert.equal(p.name,'Local uno');assert.equal(p.status,'draft');assert(STEPS.includes('comercios'));
 for(const lang of ['es','en'])assert(merchantText(p,lang).includes('https://admira.app/retailer'));
 assert(merchantText(p).includes('no incorpora el comercio'));
});
