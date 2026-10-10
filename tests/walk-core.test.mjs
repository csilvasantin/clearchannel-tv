import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpsUrl, localeFor, surfaceKey, screenFormat, normalizeAsset, restoreCampaign, previewUrl, placementKey, selectionSnapshot } from '../walk-core.mjs';

test('untrusted media and twin URLs cannot execute scripts or contain credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'http://example.com/a.png', 'https://user:password@example.com/a', '/relative']) assert.equal(httpsUrl(url), '');
  assert.equal(httpsUrl('https://media.example.com/a.mp4'), 'https://media.example.com/a.mp4');
  assert.equal(normalizeAsset({url:'https://example.com/app',type:'interactive'}), null);
});
test('fresh Admira sessions default to Spanish; explicit language and saved preference work', () => {
  assert.equal(localeFor('www.admira.app'), 'es');
  assert.equal(localeFor('www.admira.biz'), 'es');
  assert.equal(localeFor('admira.biz'), 'es');
  assert.equal(localeFor('admira.biz.example.com'), 'en');
  assert.equal(localeFor('www.admira.biz','?lang=en'), 'en');
  assert.equal(localeFor('www.clearchannel.tv'), 'en');
  assert.equal(localeFor('localhost','?brand=admira'), 'es');
  assert.equal(localeFor('www.admira.app','?lang=en','es'), 'en');
  assert.equal(localeFor('www.clearchannel.tv','','es'), 'es');
});
test('same-named screens in different spaces do not share creative selection', () => {
  assert.notEqual(placementKey('madrid','window'), placementKey('barcelona','window'));
  const a={id:'barcelona'}, screen={screen:'real-screen-42',name:'Window'};
  assert.equal(surfaceKey(a, screen, 0), surfaceKey(a, screen, 5));
  const u=new URL(previewUrl(a,screen,0,'es','?brand=admira&campaignId=CC-1'),'https://www.admira.app/');
  assert.equal(u.searchParams.get('screenId'),'real-screen-42');
  assert.equal(u.searchParams.get('locationId'),'barcelona');
  assert.equal(u.searchParams.get('lang'),'es');
  assert.equal(u.searchParams.get('brand'),'admira');
  assert.equal(u.searchParams.get('campaignId'),'CC-1');
});
test('reload preserves each placement and rejects stale schema or foreign campaign', () => {
  const a=placementKey('a','screen'), b=placementKey('b','screen');
  const original={schema:1,id:'CC-1',title:'Launch',locationId:'b',surfaceId:'screen',hour:19,placements:{[a]:{url:'https://example.com/a.png',type:'image',title:'A',version:'3'},[b]:{url:'https://example.com/b.mp4',type:'video',title:'B'},unsafe:{url:'javascript:alert(1)',type:'image'}}};
  const restored=restoreCampaign(JSON.parse(JSON.stringify(original)),'CC-1');
  assert.equal(restored.placements[a].title,'A'); assert.equal(restored.placements[b].title,'B');
  assert.equal(restored.placements[a].version,'3'); assert.equal(restored.hour,19); assert.equal(restored.placements.unsafe,undefined);
  assert.equal(restoreCampaign(original,'CC-2'),null);
  assert.equal(restoreCampaign({...original,schema:2},'CC-1'),null);
});
test('unknown screen dimensions are explicitly a preview assumption', () => {
  assert.deepEqual(screenFormat({desc:'1080×1920'}),{ratio:1080/1920,known:true,label:'1080 × 1920'});
  assert.equal(screenFormat({desc:'1920 x 1080'}).ratio,16/9);
  assert.equal(screenFormat({}).known,false);
});
test('map-enriched screen identities survive the selection handoff', () => {
  const location={id:'valencia',name:'Store',twin:'javascript:alert(1)',surfaces:[{name:'LED',screen:'physical-led',desc:'1920×1080',surface:'pantalla',irrelevant:'omit'}]};
  const snapshot=selectionSnapshot(location);
  assert.equal(snapshot.twin,'');
  assert.equal(surfaceKey(snapshot,snapshot.surfaces[0],0),'physical-led');
  assert.equal(snapshot.surfaces[0].irrelevant,undefined);
  assert.equal(selectionSnapshot({id:'empty'}),null);
});
test('preview handoff keeps scene association and demo evidence without copying connection claims', () => {
  const snapshot=selectionSnapshot({
    id:'test-space', circuit:'demo_retail', demo:true, testCircuit:false,
    xpaceUrl:'https://www.xpaceos.com/xpacios/test-space/',
    external:{testCircuit:true,source:'nominatim-osm',online:true,token:'omit'},
    online:true, status:'live', telemetry:{online:true},
    surfaces:[{id:'screen-1',name:'Window',demo:true,testCircuit:true,online:true,status:'live',checkedAt:Date.now()}]
  });
  assert.equal(snapshot.xpaceUrl,'https://www.xpaceos.com/xpacios/test-space/');
  assert.equal(snapshot.circuit,'demo_retail');
  assert.equal(snapshot.demo,true);
  assert.equal(snapshot.testCircuit,false);
  assert.deepEqual(snapshot.external,{testCircuit:true,source:'nominatim-osm'});
  assert.deepEqual(snapshot.surfaces[0],{id:'screen-1',name:'Window',demo:true,testCircuit:true});
  for (const field of ['online','status','telemetry']) assert.equal(Object.hasOwn(snapshot,field),false);
});
test('preview preserves explicit scene removal and rejects unsafe scene URLs', () => {
  const base={id:'alsea-sbux-021',surfaces:[{name:'Screen'}]};
  assert.equal(Object.hasOwn(selectionSnapshot(base),'xpaceUrl'),false);
  assert.equal(selectionSnapshot({...base,xpaceUrl:''}).xpaceUrl,'');
  assert.equal(selectionSnapshot({...base,xpaceUrl:'javascript:alert(1)'}).xpaceUrl,'');
  assert.equal(selectionSnapshot({...base,xpaceUrl:'https://user:secret@www.xpaceos.com/xpacios/private/'}).xpaceUrl,'');
});
test('surface-specific demo provenance survives the handoff without its telemetry or private metadata', () => {
  const snapshot = selectionSnapshot({id:'venue',surfaces:[{name:'Screen',external:{testCircuit:true,source:'demo-catalogue',online:true,token:'omit'}}]});
  assert.deepEqual(snapshot.surfaces[0].external, {testCircuit:true,source:'demo-catalogue'});
});
