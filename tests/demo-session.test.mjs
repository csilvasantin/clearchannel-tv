import test from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_CLIENT_ID, GOOGLE_SUITE_CLIENT_ID, sessionFromClaims, handleDemoSession } from '../server/demo-session.mjs';
const claims = { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', sub: 'user-1', exp: Date.now() / 1000 + 3600, email_verified: true, email: 'csilva@admira.com' };
test('both Carlos identities receive separate JTI, Alsea and Cafebrería demos; both verified identities can edit the catalogue', () => {
  for (const email of ['csilva@admira.com', 'csilvasantin@gmail.com']) {
    const session = sessionFromClaims({ ...claims, email });
    assert.deepEqual(session.demos.map(d => d.id), ['jti', 'alsea', 'cafebreria']);
    assert.equal(session.canManageCatalog, true);
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
test('admira.biz signs in with the suite client: both audiences of the project are accepted, any other is not', () => {
  assert.equal(sessionFromClaims({ ...claims, aud: GOOGLE_SUITE_CLIENT_ID }).email, 'csilva@admira.com');
  assert.equal(sessionFromClaims({ ...claims, aud: GOOGLE_CLIENT_ID }).email, 'csilva@admira.com');
  assert.equal(sessionFromClaims({ ...claims, aud: '861856772040-otro.apps.googleusercontent.com' }), null);
});
test('the backoffice picks the suite client only on admira.biz (the site client has no admira.biz origin)', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../backoffice.html', import.meta.url), 'utf8');
  const m = html.match(/const GOOGLE_CLIENT_ID = (\/.*?\/i)\.test\(location\.hostname\) \? GOOGLE_SUITE_CLIENT_ID : GOOGLE_SITE_CLIENT_ID;/);
  assert.ok(m, 'host-based client selection present');
  const re = eval(m[1]);
  for (const h of ['admira.biz', 'www.admira.biz', 'WWW.ADMIRA.BIZ']) assert.equal(re.test(h), true, h);
  for (const h of ['www.clearchannel.tv', 'clearchannel.tv', 'www.admira.app', 'admira.biz.evil.test', 'fakeadmira.biz.example']) assert.equal(re.test(h), false, h);
  assert.ok(html.includes(GOOGLE_SUITE_CLIENT_ID) && html.includes(GOOGLE_CLIENT_ID));
});
