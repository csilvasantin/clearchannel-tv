const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../xpace-link.js');
const InventoryEvidence = require('../inventory-evidence.js');

const html = fs.readFileSync(path.join(__dirname, '../detail.html'), 'utf8');
const script = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];

class Node {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.textContent = ''; this.children = []; this.style = {}; this.attrs = {}; this.dataset = {}; this.hidden = false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this.textContent = ''; }
  setAttribute(name, value) { this.attrs[name] = value; }
  get innerHTML() { return this._html || ''; }
  set innerHTML(value) { this._html = value; this.children = []; }
  querySelector(selector) { this.parts ||= {}; return this.parts[selector] ||= new Node(); }
}

async function detail(location, decisions = [], lang = 'es', fail = false, scenario = {}) {
  const nodes = new Map([...html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)].map(([tag, id]) => [id, Object.assign(new Node(), {hidden:/\bhidden\b/.test(tag)})]));
  const translated = [...html.matchAll(/data-detail-es="([^"]+)" data-detail-en="([^"]+)"/g)].map(([, es, en]) => Object.assign(new Node(), {dataset:{detailEs:es, detailEn:en}}));
  const requests = [], lookups = [], events = new Map();
  const document = {
    documentElement: {lang}, title:'',
    getElementById: id => { assert.ok(nodes.has(id), `missing element ${id}`); return nodes.get(id); },
    createElement: tag => new Node(tag), createTextNode: text => ({textContent:text}),
    querySelectorAll: () => translated,
    addEventListener: (name, callback) => events.set(name, callback),
  };
  const context = vm.createContext({
    document, URLSearchParams, localStorage:{getItem:()=>null},
    location:{search:`?loc=${scenario.requestedId || location.id}&lang=${lang}`},
    window:{loadOmnipLocations:()=>[location], loadOmnipLocationDetail:async id=>{lookups.push(id); return scenario.remote || null;}, InventoryEvidence, ADMIRA_SITE_BRAND:{id:'admira', name:'admira.biz', defaultLanguage:'es'}},
    setInterval:()=>{},
    fetch:async (url, options) => {
      requests.push({url, options});
      if (fail) throw Error('offline');
      const response = Object.entries(scenario.responses || {}).find(([endpoint]) => url.includes(endpoint))?.[1];
      if (response instanceof Error) throw response;
      if (response) return {ok:response.ok !== false, status:response.status || 200, json:async()=>response.body};
      const body = url.includes('/rtb/feed') ? {decisions} : url.includes('/day/range') ? {days:{}} : {screens:{}};
      return {ok:true, json:async()=>body};
    },
  });
  vm.runInContext(script, context);
  await new Promise(resolve => setImmediate(resolve));
  return {nodes, translated, requests, lookups, events, document, context};
}

const fixture = {
  id:'test-shop', name:'Test shop', addr:'Test address', kind:'Retail físico · Gemelo digital',
  twin:'https://www.xpaceos.com/xpacios/legacy/',
  surfaces:[{name:'Front', desc:'1920×1080', status:'live', impr:100, cpm:'€6', screen:'screen-1'}, {name:'Side', status:'live', impr:50, cpm:'€4'}],
};

test('detail displays catalogue estimates and leaves unverified measurements empty', async () => {
  const {nodes, document, requests} = await detail(fixture);
  assert.equal(nodes.get('m-impr').textContent, '150');
  assert.equal(nodes.get('m-audience').textContent, '—');
  assert.equal(nodes.get('m-screens').textContent, '2');
  assert.equal(nodes.get('m-cpm').textContent, '€5,00');
  assert.match(nodes.get('catalogue-source').textContent, /catálogo local/);
  assert.equal(document.title, 'Test shop | admira.biz');
  for (const row of nodes.get('surfaces').children) {
    assert.match(row.children[1].textContent, /Conexión sin verificar/);
    assert.doesNotMatch(row.children[1].textContent, /LIVE|Conectada/);
  }
  assert.equal(nodes.get('scene-kind').textContent, 'Vista ilustrativa');
  assert.doesNotMatch(nodes.get('kind').textContent, /gemelo digital/i);
  assert.equal(nodes.get('scene-note').children.length, 0, 'legacy twin does not establish a linked scene');
  assert.ok(requests.every(request => !request.options?.method || request.options.method === 'GET'));
});

test('missing estimates stay empty; linked scenes never certify a measured replica and new copy switches language', async () => {
  const {nodes, events, translated} = await detail({...fixture, xpaceUrl:'https://www.xpaceos.com/xpacios/shop/', surfaces:[{name:'Front', status:'live'}]}, [], 'en');
  assert.equal(nodes.get('m-impr').textContent, '—');
  assert.equal(nodes.get('m-cpm').textContent, '—');
  assert.match(nodes.get('kind').textContent, /Linked scene/);
  assert.equal(nodes.get('scene-note').children[0].href, 'https://www.xpaceos.com/xpacios/shop/');
  assert.match(nodes.get('scene-note').children[1].textContent, /does not certify a measured replica/);
  assert.match(nodes.get('surfaces').children[0].children[1].textContent, /Connection unverified/);
  events.get('admira:lang')({detail:{lang:'es'}});
  assert.match(nodes.get('surfaces').children[0].children[1].textContent, /Conexión sin verificar/);
  assert.equal(translated[0].textContent, translated[0].dataset.detailEs);
});

test('RTB records require an exact location; unavailable feeds cannot expose invented brands or prices', async () => {
  const foreign = await detail(fixture, [{advertiser:'Other shop', loc:'foreign', price:5}, {advertiser:'No location', price:4}]);
  assert.ok(['a','b','c'].every(key => foreign.nodes.get(`bid-row-${key}`).hidden));
  assert.match(foreign.nodes.get('bidding-status').textContent, /Sin decisiones vinculadas/);
  const matching = await detail(fixture, [{advertiser:'Local record', loc:'test-shop', price:0.2}, {advertiser:'Other shop', loc:'foreign', price:5}]);
  assert.equal(matching.nodes.get('bid-row-a').hidden, false);
  assert.equal(matching.nodes.get('bid-row-a').querySelector('.line strong').textContent, 'Local record');
  assert.match(matching.nodes.get('bidding-status').textContent, /No confirman emisión ni cobro/);
  const offline = await detail(fixture, [], 'en', true);
  assert.match(offline.nodes.get('bidding-status').textContent, /Feed unavailable/);
  assert.ok(['a','b','c'].every(key => offline.nodes.get(`bid-row-${key}`).hidden));
});

test('HTTP, network and invalid report responses are unavailable, never empty measurement results', async () => {
  for (const response of [{ok:false, status:503, body:{}}, new Error('network failure'), {body:{screens:[]}}, {body:{}}]) {
    const {nodes, context} = await detail(fixture, [], 'en', false, {responses:{'/emit/range':response, '/audience/range':response}});
    assert.match(nodes.get('rep-body').textContent, /Report unavailable/);
    assert.doesNotMatch(nodes.get('rep-body').textContent, /No emission or audience records/);
    assert.equal(vm.runInContext('REPORT', context), null);
  }
});

test('one unavailable source produces an explicit partial report without invented zeroes or export', async () => {
  for (const failing of ['/emit/range', '/audience/range']) {
    const {nodes, context} = await detail(fixture, [], 'en', false, {responses:{[failing]:{ok:false, status:502}}});
    assert.match(nodes.get('rep-body').textContent, /Partial report/);
    assert.match(nodes.get('rep-body').textContent, new RegExp(failing + ' unavailable'));
    assert.equal(vm.runInContext('REPORT', context), null);
    assert.doesNotMatch(nodes.get('rep-body').innerHTML, /exportReport/);
  }
  const {nodes} = await detail(fixture, [], 'en');
  assert.match(nodes.get('rep-body').textContent, /No emission or audience records/, 'valid successful empty sources remain distinguishable');
});

test('invalid RTB schemas and HTTP errors are source failures, not a successful empty feed', async () => {
  for (const response of [{ok:false, status:502, body:{}}, {body:{}}, {body:{decisions:{}}}, {body:null}]) {
    const {nodes} = await detail(fixture, [], 'en', false, {responses:{'/rtb/feed':response}});
    assert.match(nodes.get('bidding-status').textContent, /Feed unavailable/);
    assert.ok(['a','b','c'].every(key => nodes.get(`bid-row-${key}`).hidden));
  }
});

test('an uncached exact location resolves via API and never borrows the first catalogue record', async () => {
  const remote = {...fixture, id:'xtanco-bcn', name:'Xtanco Barcelona', addr:"Portal de l'Àngel 20"};
  const found = await detail(fixture, [], 'es', false, {requestedId:'xtanco-bcn', remote});
  assert.deepEqual(found.lookups, ['xtanco-bcn']);
  assert.equal(found.nodes.get('name').textContent, 'Xtanco Barcelona');
  assert.equal(found.nodes.get('addr').textContent, "Portal de l'Àngel 20");
  assert.match(found.nodes.get('catalogue-source').textContent, /catálogo API, \/locations\/xtanco-bcn/);
  assert.ok(found.requests.filter(request=>/\/(emit|audience|day)\/range/.test(request.url)).every(request=>request.url.includes('loc=xtanco-bcn')));
  for (const remote of [null, {...fixture, id:'unrelated'}]) {
    const missing = await detail(fixture, [], 'en', false, {requestedId:'xtanco-bcn', remote});
    assert.equal(missing.nodes.get('detail-content').hidden, true);
    assert.match(missing.nodes.get('location-status').textContent, /requested location is unavailable/);
    assert.equal(missing.requests.length, 0, 'unresolved locations must not request reports for a different store');
    assert.notEqual(missing.nodes.get('name').textContent, 'Test shop');
  }
});
