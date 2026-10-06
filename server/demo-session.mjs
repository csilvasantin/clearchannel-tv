// Google verifies the signature; this endpoint enforces our audience and access policy.
// Two OAuth clients of the same Google Cloud project (861856772040) sign in here:
// - GOOGLE_CLIENT_ID: the site client, authorized for clearchannel.tv and admira.app.
// - GOOGLE_SUITE_CLIENT_ID: the AdmiraNeXT suite client, authorized for admira.biz
//   (and admira.tv, admiranext.com, yokup.com). admira.biz is served by this project
//   since the domain swap (oct-2026) but is not an origin of the site client, so its
//   backoffice signs in with the suite client (Google answered origin_mismatch).
// omnipublicity-api already accepts both audiences (GOOGLE_CLIENT_ID + GOOGLE_CONTROL_CLIENT_ID).
export const GOOGLE_CLIENT_ID = '861856772040-quq6ut76k4mqj3fdq87h6g6caht3nm4l.apps.googleusercontent.com';
export const GOOGLE_SUITE_CLIENT_ID = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
export const GOOGLE_CLIENT_IDS = new Set([GOOGLE_CLIENT_ID, GOOGLE_SUITE_CLIENT_ID]);
const DEMO_EMAILS = new Set(['csilva@admira.com', 'csilvasantin@gmail.com']);
export const DEMOS = [
  { id: 'jti', title: 'JTI · Xtanco', locationId: 'xtanco-valencia', circuit: 'jti_xtanco', twinUrl: 'https://www.xpaceos.com/admira-xp/?play=1&loc=xtanco-valencia' },
  { id: 'alsea', title: 'Alsea · Starbucks', locationId: 'alsea-sbux-021', circuit: 'alsea_starbucks', twinUrl: 'https://www.xpaceos.com/admira-xp/?autostart=xtanco&visual=matrix&loc=alsea-sbux-021' },
  { id: 'cafebreria', title: 'Cafebrería · Proyecto independiente', locationId: 'cafebreria-barcelona', circuit: 'cafebreria', twinUrl: 'https://www.pixeria.com/stock.html?type=xpaces&highlight=1790375438696-1ladz7' },
];
export function sessionFromClaims(claims, now = Date.now()) {
  if (!claims || !GOOGLE_CLIENT_IDS.has(claims.aud) || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || !claims.sub || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) * 1000 <= now || ![true, 'true'].includes(claims.email_verified)) return null;
  const email = String(claims.email || '').toLowerCase();
  const canManageCatalog = email.endsWith('@admira.com');
  if (!canManageCatalog && !DEMO_EMAILS.has(email)) return null;
  return { email, expiresAt: Number(claims.exp) * 1000, canManageCatalog, demos: DEMO_EMAILS.has(email) ? DEMOS : [] };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Authorization' } });
export async function handleDemoSession(request, fetcher = fetch) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = (request.headers.get('Authorization') || '').match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token || token.length > 8192) return json({ error: 'unauthorized' }, 401);
  try {
    const response = await fetcher('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return json({ error: 'unauthorized' }, 401);
    const session = sessionFromClaims(await response.json());
    if (!session) return json({ error: 'unauthorized' }, 401);
    return json(session);
  } catch { return json({ error: 'verification_unavailable' }, 503); }
}
