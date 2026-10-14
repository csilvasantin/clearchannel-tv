// ▤ Creador de incidencias (DCL-34d5bbccb9cc227bb752a419): la red. Mando (cola /locations/cmd y su
// acuse), señal del player (/signage/now) y Yokup. `fetcher` inyectable: lo usan el navegador, el
// agente de consola y las pruebas. Ningún adaptador imprime ni devuelve credenciales.
import { MANDO_CMD, MANDO_ACK, SIGNAGE_NOW, YOKUP_INCIDENT, YOKUP_STATUS, YOKUP_MCP, DEMO_PREFIX, fichaYokup } from './incidencias-core.mjs?v=20261014-bugito-1';

async function leerJson(r) { try { return await r.json(); } catch { return {}; } }
// Un 4xx que repetir no arregla (petición inválida, recurso que no es suyo…). 408/425/429 sí se reintentan.
export const permanente = status => status >= 400 && status < 500 && ![408, 425, 429].includes(status);

// ── Mando a distancia ────────────────────────────────────────────────────────────────────────
export function mando(fetcher = fetch) {
  return {
    async enviar(body) {
      const r = await fetcher(MANDO_CMD, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await leerJson(r);
      if (!r.ok || !d.ok) return { ok: false, status: r.status, error: d.reason || d.error || `HTTP ${r.status}` };
      return { ok: true, id: d.id || body.id, cid: d.cid, action: d.action, cmd: d.cmd, ts: d.ts };
    },
    async acuse(id, action) {
      const r = await fetcher(`${MANDO_ACK}?id=${encodeURIComponent(id)}&action=${encodeURIComponent(action)}&t=${Date.now()}`, { cache: 'no-store' });
      const d = await leerJson(r);
      return r.ok ? { seen: !!d.seen, ack: d.ack || null } : { seen: false, ack: null, error: d.error || `HTTP ${r.status}` };
    },
    async senal(screen) {
      const r = await fetcher(`${SIGNAGE_NOW}?screen=${encodeURIComponent(screen)}&t=${Date.now()}`, { cache: 'no-store' });
      return r.ok ? leerJson(r) : { ok: false, error: `HTTP ${r.status}` };
    }
  };
}

// ── Yokup · carril público (POST /incident, GET /incident/status) ───────────────────────────
// Sin credenciales y con CORS abierto, pero Yokup sólo deja leer el estado y cerrar recursos
// `demo:`: aquí se usa únicamente para pantallas de laboratorio. Idempotente: con una incidencia
// activa para el recurso, Yokup devuelve esa misma.
export function yokupPublico(fetcher = fetch) {
  const post = async body => {
    const r = await fetcher(YOKUP_INCIDENT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { r, d: await leerJson(r) };
  };
  return {
    disponible: true,
    async abrir(body) {
      if (!body || !String(body.resource || '').startsWith(DEMO_PREFIX)) return { ok: false, error: 'solo_demo' };
      const { r, d } = await post(body);
      if (!r.ok || !d.ok || !d.id) return { ok: false, status: r.status, permanente: permanente(r.status), error: d.error || `HTTP ${r.status}` };
      return { ok: true, id: d.id, url: fichaYokup(d.id) };
    },
    async cerrar(body) {
      if (!body || !String(body.resource || '').startsWith(DEMO_PREFIX)) return { ok: false, error: 'solo_demo' };
      const { r, d } = await post(body);
      if (r.status === 404) return { ok: true, id: null, applied: false, nada: true };   // no había ninguna activa
      // Final: la lleva un técnico del portal del comercio y se cierra allí con evidencia.
      if (r.status === 409 && d.portal_assigned) return { ok: false, status: 409, retenida: true, permanente: true, error: d.error || 'la lleva un técnico del portal' };
      if (!r.ok || !d.ok) return { ok: false, status: r.status, permanente: permanente(r.status), error: d.error || `HTTP ${r.status}` };
      return { ok: true, id: d.id || null, applied: d.applied !== false, stage: d.stage || 'cerrada' };
    },
    async estado(prefijo, ids = []) {
      const q = new URLSearchParams({ prefix: prefijo });
      const validos = ids.filter(id => /^[A-Z]{3}-[A-Z0-9]{4,10}$/.test(String(id || ''))).slice(-20);
      if (validos.length) q.set('ids', validos.join(','));
      const r = await fetcher(`${YOKUP_STATUS}?${q}`, { cache: 'no-store' });
      const d = await leerJson(r);
      return r.ok && d.ok ? { ok: true, incidents: d.incidents || [] } : { ok: false, error: d.error || `HTTP ${r.status}`, incidents: [] };
    }
  };
}

// ── Yokup · MCP de flota (yokup_incident_open / _update / _list) ─────────────────────────────
// Para pantallas reales (recurso `itil:`), que el carril público no deja cerrar ni leer. Exige
// una credencial con el scope `incidents:write` (fichero de tools/mcp-credential.mjs o la clave
// de flota persona + equipo). Sin ella el adaptador queda `disponible:false` y no llama a nada:
// no se emiten credenciales desde aquí.
export function yokupMcp({ fetcher = fetch, credencial = null } = {}) {
  const token = credencial && typeof credencial.token === 'string' ? credencial.token : '';
  const scopes = credencial && Array.isArray(credencial.scopes) ? credencial.scopes : [];
  const disponible = !!token && scopes.includes('incidents') && scopes.includes('incidents:write');
  const endpoint = credencial && /^https:\/\/(www\.)?yokup\.com\/mcp\/?$/.test(String(credencial.endpoint || '')) ? credencial.endpoint : YOKUP_MCP;
  let seq = 0;
  async function call(name, args) {
    if (!disponible) return { ok: false, error: 'sin_credencial_incidents_write' };
    const r = await fetcher(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: 'tools/call', params: { name, arguments: args } })
    });
    const d = await leerJson(r);
    if (!r.ok || d.error) return { ok: false, status: r.status, permanente: permanente(r.status), error: (d.error && (d.error.message || d.error)) || `HTTP ${r.status}` };
    const res = d.result || {};
    if (res.isError) return { ok: false, error: (res.content && res.content[0] && res.content[0].text) || 'tool_error' };
    let out = res.structuredContent;
    if (!out) { try { out = JSON.parse(res.content[0].text); } catch { out = {}; } }
    return { ok: true, out };
  }
  return {
    disponible,
    async abrir(body) {
      const args = { subject: body.subject, detail: body.detail, kind: body.kind, severity: body.severity, resource: body.resource };
      if (body.loc) args.loc = body.loc;
      if (body.project_id) args.project_id = body.project_id;
      const c = await call('yokup_incident_open', args);
      return c.ok ? { ok: true, id: c.out.id, url: c.out.url || fichaYokup(c.out.id), deduplicated: !!c.out.deduplicated } : c;
    },
    async cerrar(body) {
      let id = body.id || '';
      if (!id) {
        const l = await call('yokup_incidents_list', { state: 'vivas', q: body.resource, limit: 20 });
        if (!l.ok) return l;
        const hit = (l.out.incidents || []).find(i => i.resource === body.resource);
        if (!hit) return { ok: true, id: null, applied: false, nada: true };
        id = hit.id;
      }
      const c = await call('yokup_incident_update', { id, status: 'resolved', note: body.note });
      return c.ok ? { ok: true, id, applied: true } : c;
    }
  };
}

// Qué carril toca a cada recurso: `demo:` → público; el resto → MCP si hay credencial; si no, ninguno.
export function carril(res, { publico, mcp }) {
  if (String(res || '').startsWith(DEMO_PREFIX)) return publico || null;
  return mcp && mcp.disponible ? mcp : null;
}
