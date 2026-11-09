// Lista de proyectos activos de admira.biz (Carlos, 9-nov-2026 · t848u).
// Solo tras autenticar: Bearer = ID token de Google verificado por /api/demo-session
// (backoffice) o /api/registro (cuenta registrada). Sin token → 401; la lista no
// sale en HTML ni en JS público. Origen: bugito-objetivos.json (mismo catálogo
// proyecto→circuito que ya usa el mapa).
import { handleDemoSession, handleRegistro } from './demo-session.mjs';

const reply = (value, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store', Vary: 'Authorization' } });

async function authorize(request, fetcher) {
  const token = request.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/.test(token)) return null;
  const init = { method: 'POST', headers: { Authorization: token } };
  let r = await handleDemoSession(new Request('https://www.admira.biz/api/demo-session', init), fetcher);
  if (r.status === 401) r = await handleRegistro(new Request('https://www.admira.biz/api/registro', init), fetcher);
  if (!r.ok) return null;
  const session = await r.json();
  if (!session || typeof session.email !== 'string' || !session.email.trim()) return null;
  return { email: session.email, registrado: session.registrado === true, canManageCatalog: session.canManageCatalog === true };
}

async function catalog(env, origin) {
  const r = await env.ASSETS.fetch(new Request(origin + '/__admira_biz/bugito-objetivos.json'));
  if (!r.ok) throw Object.assign(Error('project_registry_unavailable'), { status: 503 });
  const d = await r.json();
  if (!Array.isArray(d.proyectos)) throw Object.assign(Error('project_registry_unavailable'), { status: 503 });
  // Solo id/label/circuit: nada de dispositivos ni notas internas.
  return d.proyectos
    .filter(p => p && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.circuit === 'string')
    .map(p => ({ id: p.id, label: p.label, circuit: p.circuit }));
}

export async function handleProyectos(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (!/^(?:www\.)?admira\.biz$|(?:^|\.)clearchannel-tv\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(url.hostname)) {
    return reply({ ok: false, error: 'not_found' }, 404);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return reply({ ok: false, error: 'method_not_allowed' }, 405);
  }
  try {
    const session = await authorize(request, fetcher);
    if (!session) return reply({ ok: false, error: 'sign_in_required' }, 401);
    const projects = await catalog(env, url.origin);
    return reply({ ok: true, projects, email: session.email, registrado: session.registrado, canManageCatalog: session.canManageCatalog });
  } catch (e) {
    return reply({ ok: false, error: e.status ? e.message : 'service_unavailable' }, e.status || 503);
  }
}
