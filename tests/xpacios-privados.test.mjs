// Xpacios públicos y privados (Carlos, 29-oct-2026 · MorfeoMacMini). Quién ve un privado lo decide la API del catálogo
// (omnipublicity-api, src/visibilidad.js); esta web le manda la sesión de Google, deja registrarse a cualquier cuenta
// verificada y deja marcar un Xpacio como privado en el backoffice. La marca es de la ubicación, no del gemelo.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { registroFromClaims, handleRegistro, sessionFromClaims, GOOGLE_SUITE_CLIENT_ID } from '../server/demo-session.mjs';

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const API = 'https://brain.digitalavatar.ai';
const ahora = Date.UTC(2026, 9, 29, 20, 0);
const claims = { aud: GOOGLE_SUITE_CLIENT_ID, iss: 'https://accounts.google.com', sub: '1', exp: Math.floor(ahora / 1000) + 600, email_verified: true, email: 'Ana@Gmail.com' };

test('registro: cualquier cuenta de Google verificada entra como registrada, sin backoffice ni demos', async () => {
  assert.deepEqual(registroFromClaims(claims, ahora), { email: 'ana@gmail.com', expiresAt: claims.exp * 1000, registrado: true });
  assert.equal(sessionFromClaims(claims, ahora), null, 'la sesión del backoffice sigue cerrada a esa cuenta');
  for (const patch of [{ aud: 'otra-app' }, { iss: 'attacker' }, { exp: 1 }, { email_verified: false }, { sub: '' }, { email: 'sin-arroba' }]) {
    assert.equal(registroFromClaims({ ...claims, ...patch }, ahora), null, JSON.stringify(patch));
  }
  const req = (auth = 'Bearer t') => new Request('https://www.admira.biz/api/registro', { method: 'POST', headers: auth ? { Authorization: auth } : {} });
  assert.equal((await handleRegistro(new Request('https://www.admira.biz/api/registro'))).status, 405);
  assert.equal((await handleRegistro(req(''))).status, 401);
  assert.equal((await handleRegistro(req(), async () => { throw new Error('offline'); })).status, 503);
  const ok = await handleRegistro(req(), async () => Response.json({ ...claims, exp: Math.floor(Date.now() / 1000) + 600 }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal((await ok.json()).registrado, true);
  assert.match(read('_worker.js'), /pathname === '\/api\/registro'\) return handleRegistro\(request\);/);
});

function memoria(inicial) {
  const mem = new Map(inicial ? Object.entries(inicial) : []);
  return { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
}
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const idToken = exp => b64({ alg: 'RS256' }) + '.' + b64({ email: 'ana@gmail.com', exp }) + '.firma';
function cargar(sesion, fetch) {
  const win = { localStorage: memoria(sesion ? { 'omnip-bo-gtoken': JSON.stringify(sesion) } : null), sessionStorage: memoria() };
  const ctx = vm.createContext({ window: win, localStorage: win.localStorage, fetch, AbortController, setTimeout, clearTimeout, atob });
  vm.runInContext(read('locations.js'), ctx);
  return win;
}
const resp = body => ({ ok: true, status: 200, json: async () => body });

test('con sesión vigente, las lecturas del catálogo la envían; sin ella, o a punto de caducar, se piden como siempre', async () => {
  const vigente = idToken(Math.floor(Date.now() / 1000) + 3600);
  const pedidas = [];
  const fetch = async (url, init) => { pedidas.push([url, init && init.headers && init.headers.Authorization]); return resp({ locations: [{ id: 'p', name: 'P', coords: [2, 41], surfaces: [], visibilidad: 'privado' }], visibilidad: 1, source: 'kv', count: 1 }); };
  const win = cargar({ token: vigente, email: 'ana@gmail.com', registrado: true }, fetch);
  assert.equal(win.omnipCatalogToken(), vigente);
  const full = await win.loadOmnipLocationsAsync(1000);
  assert.equal(full.visibilidad, true, 'la API ya separa públicos y privados');
  assert.equal(win.isOmnipPrivate(full.locations.find(l => l.id === 'p')), true);
  await win.loadOmnipLocationsSlimAsync(1000);
  await win.loadOmnipLocationDetail('p', 1000);
  assert.deepEqual(pedidas.map(p => p[1]), Array(3).fill('Bearer ' + vigente));
  assert.deepEqual(pedidas.map(p => p[0]), [API + '/locations', API + '/locations?slim=1', API + '/locations/p']);

  for (const sesion of [null, { token: idToken(Math.floor(Date.now() / 1000) + 10) }, { token: 'roto' }]) {
    const sin = [];
    const w = cargar(sesion, async (url, init) => { sin.push(init && init.headers); return resp({ locations: [], source: 'kv' }); });
    assert.equal(w.omnipCatalogToken(), '');
    await w.loadOmnipLocationsSlimAsync(1000);
    assert.equal(sin[0], undefined, 'sin cabecera Authorization');
  }
});

test('el catálogo completo de la portada (Web Worker) recibe la sesión en el mensaje y la manda', () => {
  assert.match(read('locations.js'), /chunk, token: window\.omnipCatalogToken\(\) \}\);/);
  const worker = read('catalogo-worker.js');
  assert.match(worker, /if \(typeof o\.token === 'string' && o\.token\) init\.headers = \{ Authorization: 'Bearer ' \+ o\.token \};/);
  assert.match(worker, /fetch\(\(o\.api \|\| self\.OMNIP_API\) \+ '\/locations', init\)/);
});

test('publicar manda los privados borrados a propósito en «quitar»; sin ellos, no manda la clave', async () => {
  const cuerpos = [];
  const win = cargar(null, async (url, init) => { cuerpos.push(JSON.parse(init.body)); return resp({ ok: true }); });
  const locs = [{ id: 'a', name: 'A', coords: [2, 41], surfaces: [] }];
  await win.publishOmnipLocations(locs, 'tok', ['bus-marca']);
  await win.publishOmnipLocations(locs, 'tok');
  assert.deepEqual(cuerpos[0].quitar, ['bus-marca']);
  assert.equal('quitar' in cuerpos[1], false);
  const bo = read('backoffice.html');
  assert.match(bo, /const quitar = catalogoBase\.filter\(l => l && l\.visibilidad === 'privado' && !actuales\.has\(l\.id\)\)\.map\(l => l\.id\);/);
});

test('backoffice: Público/Privado en la ficha, «Privado» sólo si la API lo cumple, y el acceso sólo en un privado', () => {
  const bo = read('backoffice.html');
  assert.match(bo, /<select id="f-visibility"><option value="publico"[^>]*>Público · lo ve todo el mundo y se comercializa<\/option><option value="privado"[^>]*>Privado · solo con registro<\/option><\/select>/);
  assert.match(bo, /sel\.querySelector\('option\[value="privado"\]'\)\.disabled = !apiVisibilidad && !yaPrivado;/);
  assert.match(bo, /apiVisibilidad = res\.visibilidad === true;/);
  // Un público no guarda el campo (el catálogo de siempre queda igual) ni la lista de acceso.
  assert.match(bo, /\} else \{ delete loc\.visibilidad; delete loc\.acceso; \}/);
  // La visibilidad no depende del Xpacio asociado (gemelo): son campos independientes del formulario.
  assert.ok(bo.indexOf('id="f-visibility"') > bo.indexOf('id="f-xpace"'));
  const acceso = new RegExp(bo.match(/const ACCESO_OK = \/(.+)\/;/)[1]);
  for (const ok of ['ana@marca.com', '@marca.com', '@sub.marca.es']) assert.ok(acceso.test(ok), ok);
  for (const mal of ['ana', 'marca.com', '@', 'a@b']) assert.equal(acceso.test(mal), false, mal);
});

test('portada: al iniciar sesión vuelve a pedir el catálogo y añade los privados; la ficha dice «Privado»', () => {
  const app = read('app.js');
  assert.match(app, /window\.addEventListener\('admira:session', \(\) => \{ traerXpaciosPrivados\(\); \}\);/);
  assert.match(app, /const nuevos = res\.locations\.filter\(l => l && l\.id != null && !ya\.has\(l\.id\)\);/);
  assert.match(app, /private_xpace:'🔒 Privado · solo con registro'/);
  assert.match(app, /\.\.\.\(m\.visibilidad === 'privado' \? \{ visibilidad: 'privado' \} : \{\}\)/, 'el ligero conserva la marca');
  const login = read('login-google.js');
  assert.match(login, /if \(session\.registrado\) \{/);
  assert.match(login, /link\.addEventListener\('click', cerrarSesion\);/);
});
