const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../expert-commands.js');

const fakeCtx = (over = {}) => {
  const calls = [];
  return Object.assign({
    calls,
    demo: cliente => { calls.push(['demo', cliente]); return {ok: true, name: 'Xpacio X'}; },
    circuit: id => { calls.push(['circuit', id]); return {ok: true, count: 7}; },
    search: text => { calls.push(['search', text]); return {ok: true}; },
    stop: () => calls.push(['stop']),
    clear: () => calls.push(['clear']),
  }, over);
};

test('client aliases tolerate case, accents, spaces and circuit ids', () => {
  for (const [input, id] of [
    ['Starbucks', 'starbucks'], ['SBUX', 'starbucks'], ['alsea_starbucks', 'starbucks'],
    ['Starbucks México', 'starbucks-mexico'], ['starbucks-mexico', 'starbucks-mexico'], ['alsea_mexico', 'starbucks-mexico'],
    ['ALCAMPO', 'alcampo'], ['CanalKiosk', 'canalkiosk'], ['canal kiosk', 'canalkiosk'], ['Kioskos', 'canalkiosk'],
    ['jti', 'jti'], ['Xtanco', 'jti'], ['xtanco nacional', 'estancos'], ['El Corte Inglés', 'elcorteingles'], ['alcam', 'alcampo'],
  ]) assert.equal(C.resolveClient(input)?.id, id, input);
  assert.equal(C.resolveClient('pepsi'), null);
  assert.equal(C.resolveClient('st'), null, 'too short to guess');
  assert.equal(C.resolveClient('starb'), null, 'ambiguous prefix: Spain or Mexico');
});

test('every client maps to a real circuit of app.js', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const all = app.match(/CIRCUIT_IDS_BY_SCOPE = \{\s*all: \[([^\]]+)\]/)[1];
  const ids = [...all.matchAll(/'([^']+)'/g)].map(m => m[1]);
  for (const client of C.CLIENTS) assert.ok(ids.includes(client.circuit), client.circuit);
  assert.equal(new Set(C.CLIENTS.map(c => c.id)).size, C.CLIENTS.length);
});

test('parser accepts positional and named attributes and canonicalises the command', () => {
  let p = C.parse('/demo starbucks');
  assert.equal(p.ok, true); assert.equal(p.verb.id, 'demo'); assert.deepEqual(p.args, {cliente: 'starbucks'}); assert.equal(p.command, '/demo starbucks');
  p = C.parse('/demo cliente=Alcampo');
  assert.deepEqual(p.args, {cliente: 'alcampo'}); assert.equal(p.command, '/demo alcampo');
  p = C.parse('  /DEMO client: Starbucks México ');
  assert.deepEqual(p.args, {cliente: 'starbucks-mexico'});
  assert.equal(C.parse('/cli').verb.id, 'demo');
  assert.deepEqual(C.parse('/demo').args, {});
  assert.deepEqual(C.parse('/buscar Gran Vía 28, Madrid').args, {texto: 'Gran Vía 28, Madrid'});
  assert.deepEqual(C.parse('/buscar texto=Calle: Mayor').args, {texto: 'Calle: Mayor'});
});

test('parser reports unknown verbs, unknown clients, missing and extra attributes', () => {
  assert.equal(C.parse('').error, 'empty');
  assert.equal(C.parse('/foo').error, 'unknown_verb');
  const bad = C.parse('/demo pepsi');
  assert.equal(bad.error, 'unknown_value'); assert.equal(bad.input, 'pepsi');
  assert.equal(C.parse('/circuito').error, 'missing_attribute');
  assert.equal(C.parse('/buscar').error, 'missing_attribute');
  assert.equal(C.parse('/help starbucks').error, 'no_attributes');
  const r = C.execute('/foo', fakeCtx());
  assert.equal(r.ok, false); assert.match(r.lines[0], /Comando no reconocido: foo/);
  assert.match(C.execute('/demo pepsi', fakeCtx()).lines.join(' '), /Cliente no reconocido.*starbucks/);
  assert.match(C.execute('/circuito', fakeCtx(), 'en').lines[0], /Missing client\. Usage: \/circuito <client>/);
});

test('execute dispatches verbs to the injected actions with resolved attributes', () => {
  const ctx = fakeCtx();
  assert.equal(C.execute('/demo Starbucks', ctx).ok, true);
  C.execute('/demo', ctx);
  C.execute('/circuito canal kiosk', ctx);
  C.execute('/buscar Xtanco', ctx);
  C.execute('/parar', ctx);
  assert.equal(C.execute('/limpiar', ctx).cleared, true);
  assert.deepEqual(ctx.calls, [['demo', 'starbucks'], ['demo', null], ['circuit', 'kioskos'], ['search', 'Xtanco'], ['stop'], ['clear']]);
  const honest = C.execute('/demo alcampo', fakeCtx({demo: () => ({ok: false, reason: 'no_xpacio'})}));
  assert.equal(honest.ok, false); assert.match(honest.lines[0], /no tiene ningún Xpacio de Alcampo/);
  const sched = C.execute('/demo alcampo', fakeCtx({demo: () => ({ok: true, name: 'Alcampo Z', live: false})}));
  assert.match(sched.lines[0], /pantallas programadas; conexión no verificada/);
  const registered = C.execute('/demo alcampo', fakeCtx({demo: () => ({ok:true,name:'Alcampo Z',live:true})}));
  assert.match(registered.lines[0], /pantallas registradas; conexión no verificada/);
  const registeredEn = C.execute('/demo alcampo', fakeCtx({demo: () => ({ok:true,name:'Alcampo Z',live:true})}), 'en');
  assert.match(registeredEn.lines[0], /registered screens; connection unverified/);
  assert.doesNotMatch(registered.lines[0] + registeredEn.lines[0], /en directo|live screens/);
  assert.match(C.execute('/demo', fakeCtx({demo: () => ({ok: false, reason: 'loading'})})).lines[0], /cargando/);
});

test('/help lists every verb, every client attribute value and every routine', () => {
  const mine = [{id: 'mine:/buscar BCN', label: 'Mi búsqueda', command: '/buscar BCN', builtin: false}];
  const routines = [...C.defaultRoutines('es'), ...mine];
  const help = C.execute('/help', fakeCtx({routines: () => routines})).lines.join('\n');
  for (const verb of C.VERBS) assert.ok(help.includes(verb.command), verb.command);
  for (const client of C.CLIENTS) assert.ok(help.includes(client.id) && help.includes(client.circuit), client.id);
  for (const r of routines) assert.ok(help.includes(`${r.label} → ${r.command}`), r.label);
  assert.match(help, /VERBOS[\s\S]*ATRIBUTOS[\s\S]*RUTINAS/);
  assert.match(C.helpLines('en').join('\n'), /VERBS[\s\S]*ATTRIBUTES[\s\S]*ROUTINES/);
});

test('default routines combine each featured client with demo and circuito', () => {
  const routines = C.defaultRoutines('es');
  const commands = routines.map(r => r.command);
  for (const id of ['starbucks', 'starbucks-mexico', 'alcampo', 'canalkiosk', 'jti']) {
    assert.ok(commands.includes('/demo ' + id)); assert.ok(commands.includes('/circuito ' + id));
  }
  assert.ok(routines.some(r => r.label === 'Demo CanalKiosk'));
  assert.ok(routines.some(r => r.label === 'Circuito Alcampo'));
  for (const r of routines) assert.equal(C.parse(r.command).ok, true, r.command);
});

test('own routines are validated, deduplicated, persisted and deletable', () => {
  const mem = new Map();
  const storage = {getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v))};
  let list = C.loadRoutines(storage);
  assert.deepEqual(list, []);
  let r = C.addRoutine(list, '/demo cliente=Alcampo');
  assert.equal(r.ok, true); list = r.list;
  assert.equal(list[0].command, '/demo alcampo');
  assert.equal(C.addRoutine(list, '/DEMO alcampo').duplicate, true);
  assert.equal(C.addRoutine(list, '/foo').ok, false);
  assert.equal(C.addRoutine(list, '/limpiar').ok, false);
  list = C.addRoutine(list, '/buscar Gran Vía').list;
  C.saveRoutines(storage, list);
  assert.deepEqual(C.loadRoutines(storage).map(x => x.command), ['/demo alcampo', '/buscar Gran Vía']);
  C.saveRoutines(storage, C.removeRoutine(list, list[0].id));
  assert.deepEqual(C.loadRoutines(storage).map(x => x.command), ['/buscar Gran Vía']);
  mem.set(C.ROUTINES_KEY, '{broken');
  assert.deepEqual(C.loadRoutines(storage), []);
  mem.set(C.ROUTINES_KEY, JSON.stringify([{command: '/evil();'}, {command: '/demo jti', label: 'JTI'}]));
  assert.deepEqual(C.loadRoutines(storage).map(x => x.label), ['JTI']);
});

test('Tab completion finishes verbs and client values', () => {
  assert.equal(C.complete('/de').value, '/demo ');
  assert.equal(C.complete('ci').value, '/circuito ');
  assert.equal(C.complete('/demo alc').value, '/demo alcampo');
  assert.equal(C.complete('/demo canal').value, '/demo canalkiosk');
  assert.equal(C.complete('/demo cliente=jt').value, '/demo cliente=jti');
  const multiple = C.complete('/demo starb');
  assert.deepEqual(multiple.options, ['starbucks', 'starbucks-mexico']);
  assert.equal(multiple.value, '/demo starbucks');
  assert.ok(C.complete('/demo ').options.length === C.CLIENTS.length);
  assert.deepEqual(C.complete('/help ').options, []);
});

test('demo Xpacio prefers registered, priced and grid-linked screens; falls back to scheduled without proving connection', () => {
  const live = {id: 'a', coords: [0, 0], surfaces: [{status: 'live', surface: 'pantalla', impr: 100, cpm: '€5', screen: 'a-1'}]};
  const unlinked = {id: 'b', coords: [0, 0], surfaces: [{status: 'live', surface: 'pantalla', impr: 100, cpm: '€5'}]};
  const sched = {id: 'c', coords: [0, 0], surfaces: [{status: 'sched', surface: 'pantalla', impr: 100, cpm: '€5'}]};
  const pwaOnly = {id: 'd', coords: [0, 0], surfaces: [{status: 'live', surface: 'pwa'}]};
  assert.equal(C.pickDemoXpacio([unlinked, live]).id, 'a');
  assert.equal(C.pickDemoXpacio([sched, unlinked]).id, 'b');
  assert.equal(C.pickDemoXpacio([pwaOnly, sched]).id, 'c');
  assert.equal(C.demoSurfaces(sched).live, false);
  assert.equal(C.demoSurfaces(sched).catalogueState, 'scheduled');
  assert.equal(C.demoSurfaces(live).catalogueState, 'registered');
  assert.equal(C.pickDemoXpacio([pwaOnly]), null);
  assert.equal(C.pickDemoXpacio([]), null);
  assert.deepEqual(C.demoScreens({surfaces: [{screen: 'x'}, {pixerScreens: ['y', 'x']}]}), ['x', 'y']);
});

test('every verb is documented in docs and the public help page', () => {
  const docs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'responsive-navigation.md'), 'utf8');
  const help = fs.readFileSync(path.join(__dirname, '..', 'help', 'index.html'), 'utf8');
  for (const verb of C.VERBS) {
    assert.ok(docs.includes('`' + verb.command), 'docs: ' + verb.command);
    assert.ok(help.includes(verb.command), 'help: ' + verb.command);
  }
  for (const client of C.CLIENTS.filter(c => c.featured)) assert.ok(docs.includes('`' + client.id + '`') && help.includes(client.id), client.id);
});

test('el avatar no se come el alias /cli de /demo', () => {
  assert.equal(C.isAvatarCommand('/cli ayudante'), true);
  assert.equal(C.isAvatarCommand('/cli helper off'), true);
  assert.equal(C.isAvatarCommand('/avatarDigital'), true);
  assert.equal(C.isAvatarCommand('/digitalAvatar mostrar'), true);
  assert.equal(C.isAvatarCommand('/cli starbucks'), false);
  assert.equal(C.isAvatarCommand('/cli'), false);
  assert.equal(C.isAvatarCommand('/avatarON'), true);
  assert.equal(C.isAvatarCommand('/avatarOFF'), true);
  assert.equal(C.isAvatarCommand('/avatar reset'), true);
  assert.equal(C.isAvatarCommand('/avatar'), true);
  assert.equal(C.isAvatarCommand('/avatar3d on'), false);
  assert.equal(C.isAvatarCommand('/avatar quizas'), false);
  assert.equal(C.isAvatarCommand('/avatar good'), true);
  assert.equal(C.isAvatarCommand('/avatar better'), true);
  assert.equal(C.isAvatarCommand('/avatar best'), true);
  const demo = C.parse('/cli starbucks');
  assert.equal(demo.ok, true);
  assert.equal(demo.verb.id, 'demo');
  assert.equal(demo.args.cliente, 'starbucks');
  const on = C.execute('/avatarDigital on', {}, 'en');
  assert.equal(on.ok, true);
  assert.equal(on.parsed.verb.local, true);
  assert.equal(on.parsed.verb.id, 'avatardigital');
  const help = C.helpLines('es').join('\n');
  assert.match(help, /\/avatarDigital/);
  assert.match(help, /\/avatar good/);
  assert.match(help, /\/avatar better/);
  assert.match(help, /\/avatar best/);
  assert.match(help, /sigue siendo \/demo/);
});
