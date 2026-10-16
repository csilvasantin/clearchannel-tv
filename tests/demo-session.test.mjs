import test from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_CLIENT_ID, GOOGLE_SUITE_CLIENT_ID, sessionFromClaims, handleDemoSession } from '../server/demo-session.mjs';
const claims = { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', sub: 'user-1', exp: Date.now() / 1000 + 3600, email_verified: true, email: 'csilva@admira.com' };
test('both Carlos identities receive separate JTI, Alsea and Cafebrería demos; both verified identities can edit the catalogue', () => {
  for (const email of ['csilva@admira.com', 'csilvasantin@gmail.com']) {
    const session = sessionFromClaims({ ...claims, email });
    assert.deepEqual(session.demos.map(d => d.id), ['jti', 'alsea', 'alsea-mexico', 'cafebreria', 'altadis-espana']);
    assert.equal(session.canManageCatalog, true);
    assert.equal(session.demos[1].locationId, 'alsea-sbux-021');
    assert.equal(session.demos[1].circuit, 'alsea_starbucks');
    assert.equal(session.demos[2].locationId, 'alsea-mx-sbux-06-cdmx');
    assert.equal(session.demos[2].circuit, 'alsea_mexico');
    assert.equal(session.demos[3].locationId, 'cafebreria-barcelona');
    assert.equal(session.demos[3].circuit, 'cafebreria');
    assert.match(session.demos[3].twinUrl, /highlight=1790375438696-1ladz7/);
    // Altadis España · 10 Xtancos (DCL-a6cb621be0ce5932f50960de): ficha de Madrid, con su marca blanca.
    assert.equal(session.demos[4].locationId, 'altadis-es-05-madrid');
    assert.equal(session.demos[4].circuit, 'altadis_espana');
    assert.equal(session.demos[4].marca, 'altadis');
  }
});
test('other staff retain management and get only the open Alsea México tour; unrelated and lookalike accounts get no access', () => {
  // Carlos, 15-oct-2026 (FLT-102469): el Tour DooH de Alsea México, para cualquier usuario registrado.
  const staff = sessionFromClaims({ ...claims, email: 'staff@admira.com' });
  assert.equal(staff.canManageCatalog, true);
  assert.deepEqual(staff.demos.map(d => d.id), ['alsea-mexico', 'altadis-espana']);
  assert.equal(staff.demos[0].command, '/demo dooh alsea');
  assert.equal(staff.demos[0].overview, '/vision general alsea');
  // Altadis España, abierta como la de Alsea México (DCL-a6cb621be0ce5932f50960de).
  assert.equal(staff.demos[1].command, '/demo dooh altadis');
  assert.equal(staff.demos[1].overview, '/vision general altadis');
  assert.equal(staff.demos[1].title, 'Altadis España · 10 Xtancos');
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
  assert.equal((await ok.json()).demos.length, 5);
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
test('la tarjeta de Alsea México lanza el Tour DooH por el modo experto (?ax_cmd)', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../backoffice.html', import.meta.url), 'utf8');
  assert.match(html, /d\.command \? '&ax_cmd=' \+ encodeURIComponent\(d\.command\)/);
  // Botón «Visión general» (FLT-102505) → ?ax_cmd=/vision general alsea, en ES y EN.
  assert.match(html, /const overviewUrl = d\.overview \? 'index\.html\?lang=' \+ LANG \+ '&ax_cmd=' \+ encodeURIComponent\(d\.overview\)/);
  assert.match(html, /demo_overview:'Visión general'/);
  assert.match(html, /demo_overview:'Overview'/);
  const C = (await import('../expert-commands.js')).default || globalThis.AdmiraExpertCommands;
  assert.equal(C.linkedCommand('?lang=es&ax_cmd=' + encodeURIComponent('/demo dooh alsea')), '/demo dooh alsea');
  assert.equal(C.linkedCommand('?lang=es&ax_cmd=' + encodeURIComponent('/vision general alsea')), '/vision general alsea');
});
test('puerta del backoffice: botón de Google sin recuadro blanco y texto de demos para registrados', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../backoffice.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="g-signin" style="[^"]*color-scheme:light/);
  assert.doesNotMatch(html, /cuentas autorizadas de Carlos|Carlos’s authorized accounts/);
  assert.match(html, /Mis demos para los usuarios registrados/);
  assert.match(html, /My demos for registered users/);
});
test('la tarjeta de Altadis España lleva marca=altadis en la ficha, el Tour DooH y la visión general', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../backoffice.html', import.meta.url), 'utf8');
  // Las demos sin marca propia llevan marca=off: limpian la marca guardada de una demo anterior (Altadis → Alsea).
  assert.match(html, /const brand = '&marca=' \+ encodeURIComponent\(d\.marca \|\| 'off'\);/);
  assert.match(html, /const mapUrl = [^\n]*\+ brand;/);
  assert.match(html, /const tourUrl = [^\n]*\+ brand;/);
  assert.match(html, /const overviewUrl = [^\n]*\+ brand : '';/);
  const altadis = sessionFromClaims({ ...claims, email: 'staff@admira.com' }).demos.find(d => d.id === 'altadis-espana');
  assert.equal(altadis.twinUrl, 'https://www.admira.store/xpacios/altadis-18/?espacio=altadis-xtanco-08&loc=altadis-es-05-madrid&marca=altadis');
  // Las demás tarjetas no cambian: sin marca propia.
  for (const d of sessionFromClaims(claims).demos.filter(d => d.id !== 'altadis-espana')) assert.equal(d.marca, undefined, d.id);
  const C = (await import('../expert-commands.js')).default || globalThis.AdmiraExpertCommands;
  assert.equal(C.linkedCommand('?lang=es&ax_cmd=' + encodeURIComponent(altadis.command) + '&marca=altadis'), '/demo dooh altadis');
  assert.equal(C.linkedCommand('?lang=es&ax_cmd=' + encodeURIComponent(altadis.overview) + '&marca=altadis'), '/vision general altadis');
});
