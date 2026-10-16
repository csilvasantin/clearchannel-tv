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
  // /demo dooh se atiende antes del parser, como /demo global (FLT-102469).
  for (const r of routines) assert.equal(C.parse(r.command).ok || /^\/(?:demo dooh|vision general) /.test(r.command), true, r.command);
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

test('/redistribucion opens the floor plan in works mode for the named or open Xpacio', () => {
  for (const input of ['/redistribucion starbucks', '/redistribución Starbucks Paseo de Gracia', '/plano alsea-sbux-021', '/obras pg103', 'redistribuir xpacio=paseo de gracia']) {
    const opened = [];
    const r = C.execute(input, fakeCtx({open: url => { opened.push(url); return {ok: true}; }}), 'es');
    assert.equal(r.ok, true, input);
    assert.deepEqual(opened, ['/plano.html?locationId=alsea-sbux-021&modo=obra&lang=es'], input);
  }
  const fromProfile = [];
  C.execute('/redistribucion', fakeCtx({location: () => ({id: 'alsea-sbux-021', name: 'Starbucks Paseo de Gracia'}), open: url => fromProfile.push(url)}), 'en');
  assert.deepEqual(fromProfile, ['/plano.html?locationId=alsea-sbux-021&modo=obra&lang=en']);
  const noPlan = C.execute('/redistribucion', fakeCtx({location: () => ({id: 'xtanco-valencia', name: 'Xtanco Valencia'}), open: () => assert.fail('must not open')}), 'es');
  assert.equal(noPlan.ok, false);
  assert.match(noPlan.lines[0], /Xtanco Valencia aún no tiene plano/);
  assert.equal(C.execute('/plano mercadona', fakeCtx({open: () => assert.fail('must not open')}), 'es').ok, false);
  // Sin plano registrado: enlace para subirlo desde ▤ Modo avanzado con el id normalizado (DCL-58288891486617b36ed8777d).
  assert.match(noPlan.lines[0], /Súbelo desde ▤ Modo avanzado: \/plano\.html\?locationId=xtanco-valencia&subir=1&lang=es$/);
  const upload = C.execute('/redistribucion mi-tienda', fakeCtx({open: () => assert.fail('must not open')}), 'en');
  assert.equal(upload.ok, false);
  assert.match(upload.lines[0], /“mi-tienda” has no floor plan yet\..*Upload it from ▤ Advanced mode: \/plano\.html\?locationId=mi-tienda&subir=1&lang=en$/);
  const away = C.execute('/plano Mi-Tienda', fakeCtx({planoOrigin: 'https://www.admira.biz/', open: () => assert.fail('must not open')}), 'es');
  assert.match(away.lines[0], /https:\/\/www\.admira\.biz\/plano\.html\?locationId=mi-tienda&subir=1&lang=es$/);
  const accents = C.execute('/plano Café Gràcia', fakeCtx({open: () => assert.fail('must not open')}), 'es');
  assert.equal(accents.ok, false);
  assert.match(accents.lines[0], /«Café Gràcia» aún no tiene plano.*locationId=cafe-gracia&subir=1&lang=es$/);
  const nothing = C.execute('/plano ¿?', fakeCtx({open: () => assert.fail('must not open')}), 'es');
  assert.equal(nothing.ok, false);
  assert.doesNotMatch(nothing.lines[0], /subir=1/);
  assert.equal(C.planoId('  Starbucks Paseo de Gracia 103 '), 'starbucks-paseo-de-gracia-103');
  assert.equal(C.subirPlanoUrl('mi tienda', 'en', ''), '/plano.html?locationId=mi%20tienda&subir=1&lang=en');
  // Laboratorio de Gran de Gràcia 51 (DCL-6ae9d5b0e2d48ee2fd9c7b19).
  for (const input of ['/plano laboratorio', '/redistribucion lab', '/obras gran de gracia 51', '/plano Gran de Gràcia 51', '/plano gdg51', '/plano lab-gran-de-gracia-51']) {
    const opened = [];
    const r = C.execute(input, fakeCtx({open: url => { opened.push(url); return {ok: true}; }}), 'es');
    assert.equal(r.ok, true, input);
    assert.deepEqual(opened, ['/plano.html?locationId=lab-gran-de-gracia-51&modo=obra&lang=es'], input);
  }
  // Con dos planos, sin xpacio ni ficha abierta hay que decir cuál.
  const which = C.execute('/redistribucion', fakeCtx({open: () => assert.fail('must not open')}), 'es');
  assert.equal(which.ok, false);
  assert.match(which.lines[0], /Indica el Xpacio.*Starbucks Paseo de Gracia 103, Laboratorio AdmiraNeXT · Gran de Gràcia 51/);
  // El motor común de la suite no quita tildes: la forma acentuada va como alias literal.
  assert.ok(C.VERBS.find(v => v.id === 'redistribucion').aliases.includes('redistribución'));
  assert.equal(C.planoUrl('alsea-sbux-021', 'es', 'https://www.admira.biz/'), 'https://www.admira.biz/plano.html?locationId=alsea-sbux-021&modo=obra&lang=es');
});

test('every floor plan in the registry has its data file', () => {
  for (const p of C.PLANOS) {
    const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'xpacios', p.id + '.json'), 'utf8'));
    assert.equal(plan.id, p.id);
  }
});

// /demo dooh (Carlos, 15-oct-2026 · FLT-102469): Tour DooH del circuito; Alsea México con tour global.
test('/demo dooh alsea lanza el tour global de Alsea México, no el circuito de España', () => {
  require('../global-tour.js');
  assert.equal(C.resolveDoohClient('alsea').id, 'starbucks-mexico');
  assert.equal(C.resolveDoohClient('Starbucks').id, 'starbucks-mexico');
  assert.equal(C.resolveDoohClient('').id, 'starbucks-mexico');
  assert.equal(C.resolveDoohClient('alcampo').id, 'alcampo');
  assert.equal(C.resolveDoohClient('starbucks espana').id, 'starbucks');
  assert.equal(C.resolveDoohClient('nadie'), null);
  const calls = [];
  const ctx = {dooh: id => { calls.push(id); return {ok: true, count: 10, global: true}; }};
  const r = C.execute('/demo dooh alsea', ctx, 'es');
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ['alsea_mexico']);
  assert.equal(r.command, '/demo dooh starbucks-mexico');
  assert.match(r.lines[0], /Tour DooH de Starbucks México \(Alsea\) · 10 Xpacios: del país entero a la puerta/);
  assert.match(C.execute('demo DOOH Alsea', ctx, 'en').lines[0], /DooH Tour · 10 Xpaces: from the whole country/);
});

test('/demo dooh: otros circuitos, catálogo sin cargar, cliente desconocido y fuera de la portada', () => {
  const plain = C.execute('/demo dooh alcampo', {dooh: () => ({ok: true, count: 102, global: false})}, 'es');
  assert.equal(plain.ok, true);
  assert.match(plain.lines[0], /^Tour DooH de Alcampo · supermercados · 102 Xpacios\. \/parar lo detiene\.$/);
  const empty = C.execute('/demo dooh alsea', {dooh: () => ({ok: false, reason: 'empty'})}, 'es');
  assert.equal(empty.ok, false);
  assert.match(empty.lines[0], /aún no tiene puntos en el catálogo cargado/);
  const unknown = C.execute('/demo dooh zzz', {dooh: () => assert.fail('no debe arrancar')}, 'es');
  assert.equal(unknown.ok, false);
  assert.match(unknown.lines[0], /Cliente no reconocido: «zzz»/);
  const opened = [];
  const away = C.execute('/demo dooh alsea', {handoff: () => assert.fail('sin savePending'), open: url => { opened.push(url); return {ok: true}; }}, 'es');
  assert.equal(away.ok, true);
  // Con la marca de Starbucks (DCL-97f84ae3e5b2cb2311c55101).
  assert.deepEqual(opened, ['/?circuit=alsea_mexico&tour=1&lang=es&marca=starbucks']);
});

test('la rutina de un clic «Tour DooH Starbucks México» va la primera', () => {
  // Antes «Tour DooH Alsea México» (/demo dooh alsea, que sigue valiendo): DCL-97f84ae3e5b2cb2311c55101.
  const [first] = C.defaultRoutines('es');
  assert.deepEqual([first.label, first.command], ['Tour DooH Starbucks México', '/demo dooh starbucks']);
  assert.equal(C.defaultRoutines('en')[0].label, 'DooH Tour Starbucks Mexico');
});

test('el panel registra /demo dooh en el motor común y sabe arrancar el tour sobre el mapa', () => {
  const panel = fs.readFileSync(path.join(__dirname, '..', 'expert-panel.js'), 'utf8');
  assert.match(panel, /\{name:'dooh',run:dooh\}/);
  assert.match(panel, /dooh\(circuitId\) \{\s*const r = ctx\.circuit\(circuitId\);[\s\S]*?startCircuitDemo\(\);/);
});

test('enlace ?ax_cmd: solo /demo dooh [cliente], con guiones o espacios', () => {
  assert.equal(C.linkedCommand('?ax_cmd=demo-dooh-alsea'), '/demo dooh alsea');
  assert.equal(C.linkedCommand('?lang=es&ax_cmd=%2Fdemo%20dooh%20alsea'), '/demo dooh alsea');
  assert.equal(C.linkedCommand('?ax_cmd=DEMO+DOOH+Alcampo'), '/demo dooh alcampo');
  assert.equal(C.linkedCommand('?ax_cmd=demo-dooh'), '/demo dooh');
  for (const bad of ['', '?x=1', '?ax_cmd=marca-off', '?ax_cmd=demo-alsea', '?ax_cmd=demo-dooh-alsea;parar', '?ax_cmd=demo dooh <script>', '?ax_cmd=demo-dooh-' + 'a'.repeat(30)]) {
    assert.equal(C.linkedCommand(bad), null, bad);
  }
});

test('el panel ejecuta la orden del enlace por su formulario cuando el circuito y el mapa están listos', () => {
  const panel = fs.readFileSync(path.join(__dirname, '..', 'expert-panel.js'), 'utf8');
  assert.match(panel, /const linked = !away && C\.linkedCommand \? C\.linkedCommand\(root\.location && root\.location\.search\) : null;/);
  assert.match(panel, /circuitDefinitions\(\)\[client\.circuit\][\s\S]*?map\.getSource\('locs'\)/);
  assert.match(panel, /input\.value = linked; if \(form\.requestSubmit\) form\.requestSubmit\(\)/);
});

test('/tour alsea mexico launches Mexico in Spanish and English and survives handoff', () => {
  for (const lang of ['es','en']) {
    const calls=[];
    const ctx={dooh:id=>{calls.push(id);return {ok:true,count:10,global:true};}};
    assert.equal(C.parse('/tour alsea mexico').ok,true);
    assert.equal(C.execute('/tour alsea mexico',ctx,lang).ok,true);
    assert.deepEqual(calls,['alsea_mexico']);
    assert.equal(C.execute('/tour desconocido',ctx,lang).ok,false);
    assert.deepEqual(calls,['alsea_mexico']);
  }
  let pending;
  assert.equal(C.execute('/tour alsea mexico',{handoff:cmd=>{pending=cmd;return {ok:true};}}).ok,true);
  assert.equal(pending,'/tour alsea mexico');
  assert.equal(C.linkedCommand('?ax_cmd=tour-alsea-mexico'),'/tour alsea mexico');
});

test('new circuits register commands and tour routines automatically, then disappear with their catalogue',()=>{
 const definitions={demo_new_coffee:{label:'New coffee',items:[{id:'x',city:'Barcelona',coords:[2.16,41.4],client:'new-coffee'}]}};
 C.setCircuits(definitions);
 assert.equal(C.resolveDoohClient('new coffee').circuit,'demo_new_coffee');
 const calls=[];
 const ctx={dooh:id=>{calls.push(id);return {ok:true,count:1,global:true};}};
 for(const lang of ['es','en'])assert.equal(C.execute('/tour new coffee',ctx,lang).ok,true);
 assert.deepEqual(calls,['demo_new_coffee','demo_new_coffee']);
 assert.ok(C.defaultRoutines().some(r=>r.command==='/tour demo_new_coffee'));
 C.setCircuits(definitions);
 assert.equal(C.CLIENTS.filter(c=>c.circuit==='demo_new_coffee').length,1);
 C.setCircuits({});
 assert.equal(C.resolveDoohClient('new coffee'),null);
 assert.equal(C.defaultRoutines().some(r=>r.command==='/tour demo_new_coffee'),false);
});

test('/tour DooH total dispatches the total circuit and removes a visual brand filter',()=>{
 const calls=[];
 for(const lang of ['es','en'])assert.equal(C.execute('/tour DooH total',{dooh:id=>{calls.push(id);return{ok:true,count:20,global:true};}},lang).ok,true);
 assert.deepEqual(calls,['dooh_total','dooh_total']);
 const opened=[];
 assert.equal(C.execute('/tour DooH total',{segmento:()=> 'starbucks',open:url=>{opened.push(url);return{ok:true};}}).ok,true);
 assert.match(opened[0],/circuit=dooh_total&tour=1&marca=off/);
 assert.ok(C.defaultRoutines().some(r=>r.command==='/tour DooH total'));
});
