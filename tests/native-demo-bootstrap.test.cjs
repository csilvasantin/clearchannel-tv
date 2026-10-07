const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.match(/<script data-admira-suite-bootstrap>([\s\S]*?)<\/script>/)[1];
const base = 'https://www.admiranext.com/suite/experto.js?v=';
function page(url, existing) {
  const nodes = existing ? [existing] : [], location = new URL(url);
  const document = {
    querySelector: () => nodes.find(n => n.src?.startsWith(base.slice(0, -3))),
    createElement: () => ({attrs:{}, setAttribute(k, v) {this.attrs[k] = v;}}),
    head: {appendChild: n => nodes.push(n)}
  };
  const context = vm.createContext({document, location, URLSearchParams,
    fetch() {throw Error('bootstrap must not call APIs');}});
  return {nodes, run: () => vm.runInContext(source, context)};
}

test('native launch is scoped to matching exact App and Biz hosts', () => {
  for (const [demo, hosts] of [['app',['admira.app','www.admira.app']],
    ['biz',['admira.biz','www.admira.biz','clearchannel.tv','www.clearchannel.tv']]]) {
    for (const host of hosts) {
      const p = page(`https://${host}/?ax_demo=${demo}&marca=starbucks`); p.run();
      assert.equal(p.nodes.length, 1); const engine = p.nodes[0];
      assert.equal(engine.src, base + '20261007-native-demo-control-1');
      assert.equal(engine.attrs['data-admira-demo-engine'], '');
      assert.equal(engine.attrs['data-pata'], 'admira.' + demo);
      assert.equal(engine.attrs['data-min'], 'hide'); assert.equal(engine.attrs['data-toggle'], '');
      assert.equal(engine.defer, true); assert.equal(engine.async, false);
    }
  }
});

test('normal visits and unmatched launch requests retain the normal engine', () => {
  for (const url of ['https://www.admira.biz/', 'https://www.admira.biz/?ax_demo=app',
    'https://www.admira.app/?ax_demo=biz', 'https://www.clearchannel.tv/?ax_demo=store',
    'https://sub.admira.biz/?ax_demo=biz', 'https://admira.biz.evil.example/?ax_demo=biz',
    'https://localhost/?ax_demo=biz']) {
    const p = page(url); p.run();
    assert.equal(p.nodes[0].src, base + '20261007-pill-1', url);
    assert.equal(p.nodes[0].attrs['data-pata'], undefined);
    assert.equal(p.nodes[0].attrs['data-admira-demo-engine'], undefined);
  }
});

test('repeated bootstrap and preexisting suite scripts load exactly once', () => {
  const p = page('https://www.admira.biz/?ax_demo=biz'); p.run(); p.run();
  assert.equal(p.nodes.length, 1);
  for (const stamp of ['20261007-pill-1','20261007-native-demo-control-1']) {
    const existing = {src:base + stamp};
    const reused = page('https://www.admira.biz/?ax_demo=biz', existing); reused.run();
    assert.deepEqual(reused.nodes, [existing]);
  }
  assert.equal((html.match(/suite\/experto\.js\?v=/g) || []).length, 1, 'one source prevents old and new script races');
});
