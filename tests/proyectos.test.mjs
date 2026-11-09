import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProyectos } from '../server/proyectos.mjs';
import { GOOGLE_SUITE_CLIENT_ID } from '../server/demo-session.mjs';

const project = { id: 'admiraxperience', label: 'Admira Xperience', circuit: 'admiraxperience', dispositivos: ['secreto'] };
const env = { ASSETS: { fetch: async () => Response.json({ proyectos: [project] }) } };
const claims = (email, extra = {}) => ({
  aud: GOOGLE_SUITE_CLIENT_ID,
  iss: 'https://accounts.google.com',
  sub: 'u1',
  exp: Math.floor(Date.now() / 1000) + 600,
  email_verified: true,
  email,
  ...extra,
});

function fetcherFor(email) {
  return async (url) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return Response.json(claims(email));
    }
    throw new Error('unexpected ' + url);
  };
}

test('GET /api/proyectos exige sesión: sin Bearer → 401', async () => {
  const r = await handleProyectos(new Request('https://www.admira.biz/api/proyectos'), env, fetcherFor('x@y.com'));
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'sign_in_required');
});

test('GET /api/proyectos tras login: solo id/label/circuit, sin dispositivos', async () => {
  const r = await handleProyectos(new Request('https://www.admira.biz/api/proyectos', {
    headers: { Authorization: 'Bearer tok' },
  }), env, fetcherFor('csilvasantin@gmail.com'));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.canManageCatalog, true);
  assert.deepEqual(d.projects, [{ id: 'admiraxperience', label: 'Admira Xperience', circuit: 'admiraxperience' }]);
  assert.equal('dispositivos' in d.projects[0], false);
});

test('cuenta registrada (no backoffice) también ve la lista, sin canManageCatalog', async () => {
  const r = await handleProyectos(new Request('https://www.admira.biz/api/proyectos', {
    headers: { Authorization: 'Bearer tok' },
  }), env, fetcherFor('ana@marca.com'));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.registrado, true);
  assert.equal(d.canManageCatalog, false);
  assert.equal(d.projects.length, 1);
});

test('otros dominios no obtienen el endpoint; método distinto de GET → 405', async () => {
  assert.equal((await handleProyectos(new Request('https://www.clearchannel.tv/api/proyectos', {
    headers: { Authorization: 'Bearer tok' },
  }), env, fetcherFor('csilvasantin@gmail.com'))).status, 404);
  assert.equal((await handleProyectos(new Request('https://www.admira.biz/api/proyectos', {
    method: 'POST', headers: { Authorization: 'Bearer tok' },
  }), env, fetcherFor('csilvasantin@gmail.com'))).status, 405);
});
