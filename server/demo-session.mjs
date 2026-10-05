// Google verifies the signature; this endpoint enforces our audience and access policy.
export const GOOGLE_CLIENT_ID = '861856772040-quq6ut76k4mqj3fdq87h6g6caht3nm4l.apps.googleusercontent.com';
const DEMO_EMAILS = new Set(['csilva@admira.com', 'csilvasantin@gmail.com']);
export const DEMOS = [
  { id: 'jti', title: 'JTI · Xtanco', locationId: 'xtanco-valencia', circuit: 'jti_xtanco', twinUrl: 'https://www.xpaceos.com/admira-xp/?play=1&loc=xtanco-valencia' },
  { id: 'alsea', title: 'Alsea · Starbucks', locationId: 'alsea-sbux-021', circuit: 'alsea_starbucks', twinUrl: 'https://www.xpaceos.com/admira-xp/?autostart=xtanco&visual=matrix&loc=alsea-sbux-021' },
  { id: 'cafebreria', title: 'Cafebrería · Proyecto independiente', locationId: 'cafebreria-barcelona', circuit: 'cafebreria', twinUrl: 'https://www.pixeria.com/stock.html?type=xpaces&highlight=1790375438696-1ladz7' },
];
export function sessionFromClaims(claims, now = Date.now()) {
  if (!claims || claims.aud !== GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || !claims.sub || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) * 1000 <= now || ![true, 'true'].includes(claims.email_verified)) return null;
  const email = String(claims.email || '').toLowerCase();
  const canManageCatalog = email.endsWith('@admira.com');
  if (!canManageCatalog && !DEMO_EMAILS.has(email)) return null;
  return { email, expiresAt: Number(claims.exp) * 1000, canManageCatalog, demos: DEMO_EMAILS.has(email) ? DEMOS : [] };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Authorization' } });
// Entrada de agentes sin Google (encargo #5055): /auth/agente deja la cookie de la mesa
// (__Host-yk_session) y aquí se comprueba contra el mismo API que la emitió. Solo vale la
// cuenta de servicio de los agentes; cualquier otra sesión sigue necesitando Google.
export const AGENT_EMAIL = 'agentes@silicio.admiranext.com';
const AGENT_COOKIE = '__Host-yk_session';
const AGENT_TTL_MS = 12 * 3600 * 1000;
export function agentSessionApi(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (host === 'admira.biz' || host === 'www.admira.biz') return { api: 'https://api.admira.biz', origin: 'https://' + host };
  if (/^(www\.)?admira\.app$|(^|\.)clearchannel-tv\.pages\.dev$/.test(host)) return { api: 'https://api.admira.app', origin: 'https://www.admira.app' };
  return null;
}
export async function agentSession(request, fetcher = fetch, now = Date.now()) {
  const target = agentSessionApi(new URL(request.url).hostname);
  const cookie = (request.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith(AGENT_COOKIE + '='));
  if (!target || !cookie || cookie.length > 4096) return null;
  const response = await fetcher(target.api + '/auth/session', { headers: { Cookie: cookie, Origin: target.origin }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const who = await response.json();
  if (!who || who.ok !== true || String(who.email || '').toLowerCase() !== AGENT_EMAIL) return null;
  return { email: AGENT_EMAIL, name: String(who.name || 'agente').slice(0, 80), agent: true, expiresAt: now + AGENT_TTL_MS, canManageCatalog: true, demos: [] };
}
export async function handleDemoSession(request, fetcher = fetch) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = (request.headers.get('Authorization') || '').match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) {
    try { const agent = await agentSession(request, fetcher); if (agent) return json(agent); }
    catch { return json({ error: 'verification_unavailable' }, 503); }
  }
  if (!token || token.length > 8192) return json({ error: 'unauthorized' }, 401);
  try {
    const response = await fetcher('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return json({ error: 'unauthorized' }, 401);
    const session = sessionFromClaims(await response.json());
    if (!session) return json({ error: 'unauthorized' }, 401);
    return json(session);
  } catch { return json({ error: 'verification_unavailable' }, 503); }
}
