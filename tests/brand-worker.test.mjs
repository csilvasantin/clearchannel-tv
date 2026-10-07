import assert from 'node:assert/strict';
import { ADMIRA_HOST, replaceBrand } from '../_worker.js';

assert.equal(ADMIRA_HOST.test('admira.app'), true);
assert.equal(ADMIRA_HOST.test('www.admira.app'), true);
assert.equal(ADMIRA_HOST.test('clearchannel.tv'), false);
assert.equal(ADMIRA_HOST.test('fakeadmira.app.example'), false);

assert.equal(replaceBrand('Clear Channel'), 'admira.app');
assert.equal(replaceBrand('CLEAR·CHANNEL'), 'ADMIRA·APP');
assert.equal(replaceBrand('https://www.clearchannel.tv/about.html'), 'https://www.admira.app/about.html');
assert.equal(replaceBrand('clearchannel.tv · RetailMedia'), 'admira.app · RetailMedia');

console.log('brand worker: ok');

// La puerta MCP de admira.app habla de admira.app (7-sep-2026): el manifest y el
// llms.txt propios existen, no arrastran la marca gemela y el worker los sirve
// cuando el Host es admira.app — y NO cuando es clearchannel.tv.
import { readFile } from 'node:fs/promises';
import worker, { ADMIRA_MCP_FILES, AVATAR_TAG, SELLO_TAG } from '../_worker.js';

// The native HTML injection must fetch the ACK-capable avatar after a reload,
// without relying on an expired edge/browser cache of the old pill query.
const avatarUrl = new URL(AVATAR_TAG.match(/src="([^"]+)"/)[1]);
assert.equal(avatarUrl.origin, 'https://www.admiranext.com');
assert.equal(avatarUrl.pathname, '/assets/avatar.js');
assert.equal(avatarUrl.searchParams.get('v'), '20261007-demo-ack-1');
assert.doesNotMatch(AVATAR_TAG, /20261007-pill-1/);

assert.equal(ADMIRA_MCP_FILES['/mcp/manifest.json'], '/mcp/admira-app/manifest.json');
assert.equal(ADMIRA_MCP_FILES['/mcp/llms.txt'], '/mcp/admira-app/llms.txt');

const manifest = JSON.parse(await readFile(new URL('../mcp/admira-app/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.name, 'admira-app-audience');
assert.equal(manifest.site, 'https://www.admira.app');
assert.equal(manifest.llms_txt, 'https://www.admira.app/mcp/llms.txt');
assert.equal(manifest.mcp_server.endpoint, 'https://mcp.admira.store/mcp');
for (const k of ['name', 'title', 'description', 'site', 'hub']) assert.doesNotMatch(String(manifest[k]), /clear\s*channel/i, k);
const llms = await readFile(new URL('../mcp/admira-app/llms.txt', import.meta.url), 'utf8');
assert.match(llms.split('\n')[0], /admira\.app/);
assert.match(llms, /https:\/\/www\.admira\.app\/mcp\/manifest\.json/);

const env = { ASSETS: { fetch(req) { return new Response(new URL(req.url).pathname, { headers: { 'content-type': 'application/json' } }); } } };
assert.equal(await (await worker.fetch(new Request('https://www.admira.app/mcp/manifest.json'), env)).text(), '/mcp/admira-app/manifest.json');
assert.equal(await (await worker.fetch(new Request('https://admira.app/mcp/llms.txt'), env)).text(), '/mcp/admira-app/llms.txt');
assert.equal(await (await worker.fetch(new Request('https://www.clearchannel.tv/mcp/manifest.json'), env)).text(), '/mcp/manifest.json');

console.log('brand worker · puerta MCP de admira.app: ok');

// Intercambio de dominios (oct-2026, paso 1 sin corte): admira.biz pasa a servir esta
// cara Admira y admira.app la de Yokup. La marca sale del apex del Host y las rutas de
// Yokup en admira.biz se mandan a www.admira.app; con admira.app o clearchannel.tv nada cambia.
import { admiraApex, isYokupPath, YOKUP_MOVED_HOST } from '../_worker.js';

for (const host of ['admira.biz', 'www.admira.biz', 'WWW.ADMIRA.BIZ']) assert.equal(ADMIRA_HOST.test(host), true, host);
for (const host of ['fakeadmira.biz.example', 'admira.bizz', 'admira.business']) assert.equal(ADMIRA_HOST.test(host), false, host);
assert.equal(admiraApex('www.admira.biz'), 'admira.biz');
assert.equal(admiraApex('admira.app'), 'admira.app');
assert.equal(admiraApex('www.clearchannel.tv'), 'admira.app');
assert.equal(replaceBrand('Clear Channel', 'admira.biz'), 'admira.biz');
assert.equal(replaceBrand('CLEAR·CHANNEL', 'admira.biz'), 'ADMIRA·BIZ');
assert.equal(replaceBrand('https://www.clearchannel.tv/about.html', 'admira.biz'), 'https://www.admira.biz/about.html');
assert.equal(replaceBrand('CLEAR·CHANNEL', 'admira.app'), 'ADMIRA·APP');

// Reescritor HTML con un HTMLRewriter de juguete: título, metas y canónica con el apex del Host.
class FakeRewriter {
  constructor() { this.handlers = []; }
  on(selector, handlers) { this.handlers.push([selector, handlers]); return this; }
  transform() { return this; }
}
globalThis.HTMLRewriter = FakeRewriter;
const htmlEnv = { ASSETS: { fetch() { return new Response('<html></html>', { headers: { 'content-type': 'text/html' } }); } } };
async function rewrite(url) {
  const rw = await worker.fetch(new Request(url), htmlEnv);
  const of = sel => rw.handlers.find(([s]) => s === sel)[1];
  const el = (attrs = {}) => ({ attrs: { ...attrs }, inner: null, getAttribute(k) { return this.attrs[k] ?? null; }, setAttribute(k, v) { this.attrs[k] = v; }, setInnerContent(v) { this.inner = v; } });
  const pathname = new URL(url).pathname;
  const canonical = el({ href: 'https://www.clearchannel.tv' + pathname }); of('link[rel="canonical"]').element(canonical);
  const title = el(); of('title').element(title);
  const ogTitle = el({ property: 'og:title', content: 'Clear Channel' }); of('meta[content]').element(ogTitle);
  const desc = el({ name: 'description', content: 'Clear Channel' }); of('meta[content]').element(desc);
  return { canonical: canonical.attrs.href, title: title.inner, ogTitle: ogTitle.attrs.content, desc: desc.attrs.content };
}
assert.deepEqual(await rewrite('https://www.admira.biz/'), {
  canonical: 'https://www.admira.biz/', title: 'Mapa de espacios comerciales | admira.biz', ogTitle: 'Mapa de espacios comerciales | admira.biz',
  desc: 'Mapa de espacios comerciales de admira.biz. Busca un punto, consulta sus pantallas y planifica campañas.'
});
assert.deepEqual(await rewrite('https://www.admira.app/'), {
  canonical: 'https://www.admira.app/', title: 'Mapa de espacios comerciales | admira.app', ogTitle: 'Mapa de espacios comerciales | admira.app',
  desc: 'Mapa de espacios comerciales de admira.app. Busca un punto, consulta sus pantallas y planifica campañas.'
});
const about = await rewrite('https://admira.biz/about.html');
assert.equal(about.canonical, 'https://www.admira.biz/about.html');
assert.equal(about.ogTitle, 'admira.biz');
// clearchannel.tv no pasa por el reescritor de marca: solo recibe el cargador del avatar en <head>.
{
  const rw = await worker.fetch(new Request('https://www.clearchannel.tv/'), htmlEnv);
  assert.deepEqual(rw.handlers.map(([s]) => s), ['head']);
  let appended = ''; rw.handlers[0][1].element({ append(v) { appended += v; } });
  assert.equal(appended, AVATAR_TAG + SELLO_TAG); // avatar + sello con novedades (06-10-2026)
  // La cara Admira lo lleva junto a la presencia.
  const biz = await worker.fetch(new Request('https://www.admira.biz/'), htmlEnv);
  let head = ''; biz.handlers.find(([s]) => s === 'head')[1].element({ append(v) { head += v; } });
  assert.ok(head.includes('live-presence.js') && head.includes(AVATAR_TAG) && head.includes(SELLO_TAG));
  // /auth/ queda fuera.
  assert.equal(await (await worker.fetch(new Request('https://www.clearchannel.tv/auth/login'), htmlEnv)).text(), '<html></html>');
}

// La puerta MCP propia también se sirve en admira.biz.
assert.equal(await (await worker.fetch(new Request('https://www.admira.biz/mcp/manifest.json'), env)).text(), '/mcp/admira-app/manifest.json');
assert.equal(await (await worker.fetch(new Request('https://admira.biz/mcp/llms.txt'), env)).text(), '/mcp/admira-app/llms.txt');

// Rutas de Yokup en admira.biz → 308 a www.admira.app con la misma ruta y query.
const YOKUP = ['/retailer', '/retailer-incidencia', '/incidencias', '/ticket', '/intervencion', '/informe-incidencia', '/instalador',
  '/alta-instalador', '/alta-punto', '/asistencia', '/dashboard', '/agentica', '/carbono', '/agentes', '/agentDetail', '/consumos',
  '/supervisor', '/superusuario', '/misiones', '/tareas', '/objetivos', '/decisiones', '/ideas', '/informes', '/notificaciones',
  '/normativa', '/equipo', '/equipo-inventario', '/estrategia', '/entrenamiento', '/entrar', '/recuperar', '/contactanos',
  '/circuitos', '/highscore', '/highscoreDetail', '/status', '/llamadas', '/llamadas-mcp', '/demo-llamadas', '/trackandfield', '/admira-live'];
const YOKUP_PREFIXED = ['/app/', '/app/tareas.js', '/asignaciones/42', '/pruebas/x.html', '/mcp/portales', '/mcp/portales.html',
  '/mcp/smith-azul.json', '/mcp/installer.json', '/mcp/portals.json', '/mcp/retailer.json', '/mcp/portals-llms.txt', '/yk-shell.js',
  '/yk-shell.css', '/manifest.webmanifest', '/instalador.webmanifest', '/api/fleet-census', '/api/fleet-census/today'];
const neverAssets = { ASSETS: { fetch() { throw new Error('una ruta movida no debe llegar a ASSETS'); } } };
for (const path of [...YOKUP, ...YOKUP.map(p => p + '.html'), ...YOKUP_PREFIXED]) {
  for (const host of ['www.admira.biz', 'admira.biz']) {
    const res = await worker.fetch(new Request(`https://${host}${path}?id=7&lang=es`), neverAssets);
    assert.equal(res.status, 308, `${host}${path}`);
    assert.equal(res.headers.get('Location'), `https://www.admira.app${path}?id=7&lang=es`, `${host}${path}`);
  }
}
const postMoved = await worker.fetch(new Request('https://www.admira.biz/api/fleet-census', { method: 'POST', body: '{}' }), neverAssets);
assert.equal(postMoved.status, 308);

// Login de Yokup en admira.biz: el callback vuelve a /entrar de admira.app y el challenge se da por movido.
const cb = await worker.fetch(new Request('https://www.admira.biz/auth/callback', { method: 'POST', body: 'credential=x' }), neverAssets);
assert.equal(cb.status, 303);
assert.equal(cb.headers.get('Location'), 'https://www.admira.app/entrar');
const ch = await worker.fetch(new Request('https://admira.biz/auth/challenge', { method: 'POST', body: '{}' }), neverAssets);
assert.equal(ch.status, 410);
assert.deepEqual(await ch.json(), { moved_to: 'https://www.admira.app' });

// Las rutas propias de este sitio no se redirigen en admira.biz.
for (const path of ['/', '/index.html', '/about.html', '/detail.html', '/app.js', '/brand.js', '/mcp/', '/mcp/index.html', '/walk.html',
  '/backoffice.html', '/cafebreria/', '/help/', '/version.json', '/data/projects/cafebreria.json', '/retailers', '/statusbar.js', '/equipos']) {
  assert.equal(isYokupPath(path), false, path);
}

// Inerte con admira.app y clearchannel.tv: ni 308, ni 303, ni 410.
const passthrough = { ASSETS: { fetch(req) { return new Response('asset:' + new URL(req.url).pathname, { headers: { 'content-type': 'text/plain' } }); } } };
for (const host of ['www.admira.app', 'admira.app', 'www.clearchannel.tv', 'clearchannel.tv', 'admira.biz.example.com']) {
  assert.equal(YOKUP_MOVED_HOST.test(host), false, host);
  for (const path of ['/retailer', '/entrar.html', '/app/', '/yk-shell.js', '/api/fleet-census', '/manifest.webmanifest']) {
    const res = await worker.fetch(new Request(`https://${host}${path}`), passthrough);
    assert.equal(res.status, 200, `${host}${path}`);
    assert.equal(await res.text(), 'asset:' + path, `${host}${path}`);
  }
  for (const path of ['/auth/callback', '/auth/challenge']) {
    const res = await worker.fetch(new Request(`https://${host}${path}`, { method: 'POST', body: '{}' }), passthrough);
    assert.equal(res.status, 200, `${host}${path}`);
  }
}

console.log('brand worker · admira.biz (marca, canónica, Yokup movido, /auth/*): ok');

// Entrada de agentes (#5067): el POST a /auth/agente en admira.app va a api.admira.app con
// método, Authorization y cuerpo; el GET sigue en ASSETS; clearchannel.tv no reenvía.
{
  const { AGENT_LOGIN_HOST, agentUpstream } = await import('../_worker.js');
  assert.equal(AGENT_LOGIN_HOST.test('www.admira.app'), true);
  assert.equal(AGENT_LOGIN_HOST.test('admira.app'), true);
  assert.equal(AGENT_LOGIN_HOST.test('www.clearchannel.tv'), false);
  assert.equal(AGENT_LOGIN_HOST.test('www.admira.biz'), false);
  assert.equal(agentUpstream('www.admira.app').api, 'https://api.admira.app');
  assert.equal(agentUpstream('admira.biz').api, 'https://api.admira.biz');
  assert.equal(agentUpstream('www.admira.biz').origin, 'https://www.admira.biz');
  assert.equal(agentUpstream('www.clearchannel.tv'), null);
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (u, init) => {
    seen.push({ url: String(u), method: init.method, auth: init.headers.get('authorization'), origin: init.headers.get('origin'), body: new TextDecoder().decode(init.body) });
    return new Response('{"ok":false}', { status: 401, headers: { 'content-type': 'application/json', 'set-cookie': '__Host-yk_session=x; Path=/; Secure; HttpOnly' } });
  };
  try {
    const assets = { ASSETS: { fetch() { return new Response('page', { headers: { 'content-type': 'text/plain' } }); } } };
    const r = await worker.fetch(new Request('https://www.admira.app/auth/agente', { method: 'POST', headers: { Authorization: 'Bearer malo', 'content-type': 'application/json' }, body: '{"agente":"t"}' }), assets);
    assert.equal(r.status, 401);
    assert.match(r.headers.get('set-cookie'), /__Host-yk_session/);
    assert.deepEqual(seen[0], { url: 'https://api.admira.app/auth/agente', method: 'POST', auth: 'Bearer malo', origin: 'https://www.admira.app', body: '{"agente":"t"}' });
    const biz = await worker.fetch(new Request('https://admira.biz/auth/agente', { method: 'POST', headers: { Authorization: 'Bearer malo', 'X-Agente': 'SmithMacMini' }, body: '{}' }), assets);
    assert.equal(biz.status, 401);
    assert.match(biz.headers.get('set-cookie'), /__Host-yk_session/);
    assert.equal(seen[1].url, 'https://api.admira.biz/auth/agente');
    assert.equal(seen[1].origin, 'https://admira.biz');
    const wwwBiz = await worker.fetch(new Request('https://www.admira.biz/auth/agente', { method: 'POST', headers: { Authorization: 'Bearer malo' }, body: '{}' }), assets);
    assert.equal(wwwBiz.status, 401);
    assert.equal(seen[2].url, 'https://api.admira.biz/auth/agente');
    assert.equal(seen[2].origin, 'https://www.admira.biz');
    assert.equal(await (await worker.fetch(new Request('https://www.admira.app/auth/agente'), assets)).text(), 'page');
    assert.equal(await (await worker.fetch(new Request('https://admira.biz/auth/agente'), assets)).text(), 'page');
    assert.equal((await worker.fetch(new Request('https://www.clearchannel.tv/auth/agente', { method: 'POST' }), assets)).status, 200);
    assert.equal(seen.length, 3);
  } finally { globalThis.fetch = realFetch; }
  console.log('brand worker · /auth/agente proxy: ok');
}
