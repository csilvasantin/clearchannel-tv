const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../xpace-link.js');
const evidence = require('../inventory-evidence.js');
const now = 1800000000000;
const telemetry = byScreen => ({ byScreen, fetchedAt: now - 1000, error: '' });

test('catalogue LIVE and a location-level connection never prove an individual screen is connected', () => {
  const loc = { id:'venue', surfaces:[] };
  const data = { ...telemetry({ other:{ online:true } }), byLoc:{venue:['other']}, online:1 };
  assert.equal(evidence.surface(loc, {status:'live'}, data, now).connection, 'unknown');
  assert.equal(evidence.surface(loc, {status:'live', screen:'expected'}, data, now).connection, 'unknown');
  assert.equal(evidence.surface(loc, {screen:'OTHER'}, data, now).connection, 'unknown');
});

test('exact screen and pixerScreens matches distinguish fresh online and explicitly offline evidence', () => {
  const data = telemetry({ horizontal:{ online:true }, vertical:{ online:false } });
  const connected = evidence.surface({}, {screen:'horizontal'}, data, now);
  assert.deepEqual(connected, {connection:'online', demo:false, checkedAt:now - 1000, source:'/signage/screens'});
  assert.equal(evidence.surface({}, {pixerScreens:['vertical']}, data, now).connection, 'offline');
  assert.equal(evidence.surface({}, {pixerScreens:['vertical', 'not-reported']}, data, now).connection, 'unknown');
  assert.equal(evidence.surface({}, {pixerScreens:['vertical', 'horizontal']}, data, now).connection, 'online');
});

test('stale, future, failed and malformed telemetry degrades to unknown', () => {
  const surf = {screen:'screen-1', status:'live'};
  const data = telemetry({'screen-1':{online:true}});
  for (const bad of [null, {...data, fetchedAt:0}, {...data, fetchedAt:now - 120001},
    {...data, fetchedAt:now + 1}, {...data,error:'timeout'}, {...data,ok:false},
    {...data,byScreen:[]}, telemetry({'screen-1':{online:'true'}}), telemetry({'screen-1':null})]) {
    assert.deepEqual(evidence.surface({}, surf, bad, now), {connection:'unknown',demo:false,checkedAt:0,source:''});
  }
  assert.equal(evidence.surface({}, surf, {...data,fetchedAt:now - 120000}, now).connection, 'online');
});

test('demo provenance survives a genuine connection and covers both curated Xtanco IDs', () => {
  const data = telemetry({screen:{online:true}});
  for (const loc of [{id:'xtanco-bcn'}, {id:'xtanco-barcelona'}, {circuit:'demo_lenovo'}, {circuit:'sim-gracia'},
    {external:{testCircuit:true}}, {demo:true}, {testCircuit:true}]) {
    const state = evidence.surface(loc, {screen:'screen'}, data, now);
    assert.equal(state.connection, 'online');
    assert.equal(state.demo, true);
    assert.equal(evidence.copy(state, 'es').demoLabel, 'DEMO');
    assert.equal(evidence.copy(state, 'en').demoLabel, 'DEMO');
  }
  assert.equal(evidence.surface({circuit:'demographics'}, {}, null, now).demo, false);
  assert.equal(evidence.surface({}, {demo:true}, null, now).demo, true);
});

test('legacy twin links do not prove a registered scene; explicit removal beats curated association', () => {
  const url = 'https://www.admira.store/admira-xp/?loc=store';
  assert.deepEqual(evidence.scene({twin:url}), {kind:'illustrative',url:''});
  assert.deepEqual(evidence.scene({xpaceUrl:url}), {kind:'linked',url});
  assert.equal(evidence.scene({id:'alsea-sbux-021'}).kind, 'linked');
  assert.deepEqual(evidence.scene({id:'alsea-sbux-021',xpaceUrl:'',twin:url}), {kind:'illustrative',url:''});
  for (const invalid of ['javascript:alert(1)', 'http://xpaceos.com/xpacios/shop/', 'https://xpaceos.com/',
    'https://user:pass@xpaceos.com/xpacios/shop/', 'https://example.com/shop/', 'https://evil.admira.store/shop/']) {
    assert.equal(evidence.scene({xpaceUrl:invalid}).kind, 'illustrative');
  }
});

test('kind labels remove inherited digital-twin claims and distinguish linked from illustrative in both languages', () => {
  const loc = {id:'xtanco-bcn',kind:'Estanco · Retail físico · GEMELO DIGITAL'};
  assert.equal(evidence.kindLabel(loc, 'es'), 'Estanco · Retail físico · Vista ilustrativa');
  assert.equal(evidence.kindLabel(loc, 'en'), 'Tobacco shop · Physical retail · Illustrative view');
  const linked = {kind:'Office · Digital twin',xpaceUrl:'https://www.xpaceos.com/xpacios/office/'};
  assert.equal(evidence.kindLabel(linked, 'en'), 'Office · Linked scene');
  assert.equal(evidence.kindLabel(linked, 'es'), 'Office · Escena vinculada');
  assert.equal(evidence.copy({connection:'unknown'}, 'es').connectionLabel, 'Conexión sin verificar');
  assert.equal(evidence.copy({connection:'offline'}, 'en').connectionLabel, 'Offline · verified signal');
});

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const loaderSource = app.slice(app.indexOf('window.LIVE_SCREENS ='), app.indexOf('\nfunction liveScreensForLoc'));
function loader(fetch, timers = {}) {
  const context = vm.createContext({window:{}, PIXER:'https://api.admira.store', fetch, AbortController, Date, setTimeout, clearTimeout, ...timers});
  vm.runInContext(loaderSource, context);
  return context;
}

test('screen loader keeps exact offline records and invalidates a previous success after HTTP/schema/network failure', async () => {
  let response = {ok:true,json:async () => ({screens:[{screen:'known',loc:'venue',online:true},{screen:'off',loc:'venue',online:false}]})};
  const context = loader(async () => { if (response instanceof Error) throw response; return response; });
  await context.loadLiveScreens();
  assert.equal(context.window.LIVE_SCREENS.byScreen.known.online, true);
  assert.equal(context.window.LIVE_SCREENS.byScreen.off.online, false);
  assert.equal(context.window.LIVE_SCREENS.byLoc.venue.length, 1);
  for (const bad of [{ok:false,status:503,json:async () => ({screens:[]})},
    {ok:true,json:async () => ({screens:'invalid'})},
    {ok:true,json:async () => ({screens:[{screen:'known',online:'true'}]})},
    new Error('network')]) {
    response = bad;
    await context.loadLiveScreens();
    assert.equal(context.window.LIVE_SCREENS.error, 'unavailable');
    assert.equal(context.window.LIVE_SCREENS.fetchedAt, 0);
    assert.equal(Object.keys(context.window.LIVE_SCREENS.byScreen).length, 0);
  }
});

test('a timed-out screen request degrades to unknown and clears its timer', async () => {
  let cleared = false;
  const context = loader((url, {signal}) => new Promise((resolve,reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), {once:true});
  }), {setTimeout(fn){queueMicrotask(fn);return 1;}, clearTimeout(){cleared=true;}});
  await context.loadLiveScreens();
  assert.equal(context.window.LIVE_SCREENS.error, 'unavailable');
  assert.equal(cleared, true);
});

test('actual search rendering never presents catalogue LIVE as a connection, and keeps demo alongside verified connection', () => {
  const context = vm.createContext({window:{InventoryEvidence:evidence,LIVE_SCREENS:telemetry({})},LANG:'es',
    t:key => ({evidence_unknown:'Conexión sin verificar',evidence_offline:'Sin conexión verificada',connected_count:'conectadas',evidence_demo:'DEMO'})[key] || key,
    escHtml:value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
  vm.runInContext(app.slice(app.indexOf('function inventorySurfaceState'), app.indexOf('// Pantallas targetables')), context);
  vm.runInContext(app.slice(app.indexOf('function storeItemsHTML'), app.indexOf('let suggIdx')), context);
  context.loc = {id:'xtanco-bcn',name:'Xtanco Barcelona',kind:'Estanco · Gemelo digital',addr:'Barcelona',surfaces:[{status:'live',screen:'screen-1'}]};
  const unknown = vm.runInContext('storeItemsHTML([loc])', context);
  assert.match(unknown, /Vista ilustrativa/);
  assert.match(unknown, /Conexión sin verificar/);
  assert.match(unknown, /DEMO/);
  assert.doesNotMatch(unknown, /LIVE|Gemelo digital/i);
  context.window.LIVE_SCREENS = {byScreen:{'screen-1':{online:true}},fetchedAt:Date.now(),error:''};
  const online = vm.runInContext('storeItemsHTML([loc])', context);
  assert.match(online, /1 conectadas/);
  assert.match(online, /DEMO/);
});

test('engine decisions retain demo provenance and do not invent a zero price when none was supplied', () => {
  const context = vm.createContext({window:{InventoryEvidence:evidence},Date});
  vm.runInContext(app.slice(app.indexOf('function decisionToRow'), app.indexOf('async function pollRtbFeed')), context);
  context.decision = {circuit:'sim-gracia',screen:'test',advertiser:'Test campaign',ts:Date.now()};
  const row = vm.runInContext('decisionToRow(decision)', context);
  assert.equal(row.demo, true);
  assert.equal(row.price, null);
  context.decision.price = 0;
  assert.equal(vm.runInContext('decisionToRow(decision).price', context), '0.00');
});

test('player acknowledgements never become an invented auction clearing price', () => {
  const context = vm.createContext({Date,bidFeedItems:[],inventorySurfaceState:() => ({demo:true}),renderBidFeed(){}});
  vm.runInContext(app.slice(app.indexOf('function spawnRealBid'), app.indexOf('function handlePixerItem')), context);
  context.spawnRealBid({}, {name:'Test display',cpm:'€12'}, {title:'Creative',acked_at:Date.now()});
  assert.equal(context.bidFeedItems[0].price, null);
  assert.equal(context.bidFeedItems[0].eventKind, 'player');
  assert.equal(context.bidFeedItems[0].demo, true);
});
