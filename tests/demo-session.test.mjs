import test from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_CLIENT_ID, sessionFromClaims, handleDemoSession } from '../server/demo-session.mjs';
const claims = { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', sub: 'user-1', exp: Date.now() / 1000 + 3600, email_verified: true, email: 'csilva@admira.com' };
test('both Carlos identities receive separate JTI, Alsea and Cafebrería demos; Gmail does not gain catalog write access', () => {
  for (const email of ['csilva@admira.com', 'csilvasantin@gmail.com']) {
    const session = sessionFromClaims({ ...claims, email });
    assert.deepEqual(session.demos.map(d => d.id), ['jti', 'alsea', 'cafebreria']);
    assert.equal(session.canManageCatalog, email.endsWith('@admira.com'));
    assert.equal(session.demos[1].locationId, 'alsea-sbux-021');
    assert.equal(session.demos[1].circuit, 'alsea_starbucks');
    assert.equal(session.demos[2].locationId, 'cafebreria-barcelona');
    assert.equal(session.demos[2].circuit, 'cafebreria');
    assert.match(session.demos[2].twinUrl, /highlight=1790375438696-1ladz7/);
  }
});
test('other staff retain management; unrelated and lookalike accounts get no access', () => {
  assert.deepEqual(sessionFromClaims({ ...claims, email: 'staff@admira.com' }).demos, []);
  for (const email of ['someone@gmail.com', 'csilva@admira.com.attacker.test', 'csilvasantin+demo@gmail.com']) assert.equal(sessionFromClaims({ ...claims, email }), null);
});
test('reject wrong client, issuer, expired and unverified Google claims', () => {
  for (const patch of [{ aud: 'different-client' }, { iss: 'attacker' }, { exp: 1 }, { exp: 'NaN' }, { sub: '' }, { email_verified: false }, { email_verified: undefined }]) assert.equal(sessionFromClaims({ ...claims, ...patch }), null);
});
test('route fails closed before and after Google validation and never caches identity', async () => {
  const url = 'https://www.admira.app/api/demo-session';
  const req = () => new Request(url, { method: 'POST', headers: { Authorization: 'Bearer test-token' } });
  assert.equal((await handleDemoSession(new Request(url))).status, 405);
  assert.equal((await handleDemoSession(new Request(url, { method: 'POST' }))).status, 401);
  assert.equal((await handleDemoSession(req(), async () => new Response('{}', { status: 400 }))).status, 401);
  assert.equal((await handleDemoSession(req(), async () => { throw new Error('offline'); })).status, 503);
  let requested;
  const ok = await handleDemoSession(req(), async url => { requested = url; return Response.json(claims); });
  assert.equal(ok.status, 200);
  assert.match(requested, /^https:\/\/oauth2\.googleapis\.com\/tokeninfo\?id_token=/);
  assert.equal(ok.headers.get('Cache-Control'), 'no-store');
  assert.equal((await ok.json()).demos.length, 3);
});
test('the demo session does not depend on the host: it works the same on admira.app and admira.biz', async () => {
  for (const host of ['www.admira.app', 'www.admira.biz', 'admira.biz', 'www.clearchannel.tv']) {
    const req = new Request(`https://${host}/api/demo-session`, { method: 'POST', headers: { Authorization: 'Bearer test-token', Origin: `https://${host}` } });
    const res = await handleDemoSession(req, async () => Response.json(claims));
    assert.equal(res.status, 200, host);
    assert.equal((await res.json()).email, 'csilva@admira.com', host);
  }
});

// #5055 · entrada de agentes sin Google
import { agentSession, agentSessionApi, AGENT_EMAIL } from '../server/demo-session.mjs';
test('agent cookie opens the backoffice only for the agents service account', async () => {
  const req = (host, cookie) => new Request(`https://${host}/api/demo-session`, { method: 'POST', headers: cookie ? { Cookie: cookie } : {} });
  const calls = [];
  const fake = (email) => async (url, init) => { calls.push([url, init.headers.Origin]); return new Response(JSON.stringify({ ok: true, email, name: 'Lucas' }), { status: 200 }); };
  const s = await agentSession(req('admira.biz', 'x=1; __Host-yk_session=abc'), fake(AGENT_EMAIL), 0);
  assert.equal(s.agent, true); assert.equal(s.canManageCatalog, true); assert.deepEqual(calls[0], ['https://api.admira.biz/auth/session', 'https://admira.biz']);
  assert.equal(await agentSession(req('admira.biz', '__Host-yk_session=abc'), fake('someone@else.com')), null);
  assert.equal(await agentSession(req('admira.biz'), fake(AGENT_EMAIL)), null);
  assert.equal(agentSessionApi('www.clearchannel.tv'), null);
  assert.equal(agentSessionApi('clearchannel-tv.pages.dev').api, 'https://api.admira.app');
});
