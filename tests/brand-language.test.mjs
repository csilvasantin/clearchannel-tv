import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const brand=readFileSync(new URL('../brand.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const language=app.slice(app.indexOf('const BRAND_LANGUAGE_KEY'),app.indexOf('Object.assign(I18N.es, {live_bidding_label'));
function resolve(host,search='',saved={}){
 const root={dataset:{}};
 const context=vm.createContext({window:{location:{hostname:host,search}},location:{search},URLSearchParams,document:{documentElement:root,readyState:'loading',addEventListener(){}},localStorage:{getItem:key=>saved[key]??null}});
 vm.runInContext(brand,context);vm.runInContext(language,context);
 return {brand:context.window.ADMIRA_SITE_BRAND,lang:vm.runInContext('LANG',context),key:vm.runInContext('BRAND_LANGUAGE_KEY',context),root};
}
test('each production domain retains its identity, default language and independent preference',()=>{
 for(const host of ['admira.app','www.admira.app']){const r=resolve(host,'',{ 'omnip-lang':'en','clearchannel-lang':'en'});assert.equal(r.brand.name,'admira.app');assert.equal(r.lang,'es');assert.equal(r.key,'admira-lang');assert.equal(r.root.lang,'es');}
 for(const host of ['clearchannel.tv','www.clearchannel.tv']){const r=resolve(host,'',{'omnip-lang':'es','admira-lang':'es'});assert.equal(r.brand.wordmark,'CLEAR·CHANNEL');assert.equal(r.lang,'en');assert.equal(r.key,'clearchannel-lang');}
});
test('production host wins over a conflicting preview brand parameter',()=>{
 assert.equal(resolve('admira.app','?brand=clearchannel').brand.id,'admira');
 assert.equal(resolve('www.clearchannel.tv','?brand=admira').brand.id,'clearchannel');
 assert.equal(resolve('localhost','?brand=admira').brand.id,'admira');
});
test('explicit language and that brand’s own saved preference remain available',()=>{
 assert.equal(resolve('admira.app','?lang=en').lang,'en');
 assert.equal(resolve('clearchannel.tv','',{'clearchannel-lang':'es'}).lang,'es');
 assert.equal(resolve('admira.app','',{'clearchannel-lang':'es','admira-lang':'en'}).lang,'en');
});
test('admira.biz is the same Admira face with its own name, domain, origin and wordmark',()=>{
 for(const host of ['admira.biz','www.admira.biz']){const r=resolve(host,'',{'clearchannel-lang':'en'});assert.equal(r.brand.id,'admira');assert.equal(r.brand.name,'admira.biz');assert.equal(r.brand.domain,'www.admira.biz');assert.equal(r.brand.origin,'https://www.admira.biz');assert.equal(r.brand.wordmark,'ADMIRA·BIZ');assert.equal(r.lang,'es');assert.equal(r.key,'admira-lang');}
 for(const host of ['admira.app','www.admira.app']){const r=resolve(host);assert.equal(r.brand.domain,'www.admira.app');assert.equal(r.brand.origin,'https://www.admira.app');assert.equal(r.brand.wordmark,'ADMIRA·APP');}
 assert.equal(resolve('localhost','?brand=admira').brand.origin,'https://www.admira.app');
 assert.equal(resolve('admira.biz','?brand=clearchannel').brand.id,'admira');
 for(const host of ['fakeadmira.biz.example','admira.bizz'])assert.equal(resolve(host).brand.id,'clearchannel');
});
