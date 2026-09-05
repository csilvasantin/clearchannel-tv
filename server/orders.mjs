import { normalizeOrder } from '../order-model.mjs';
export { normalizeOrder } from '../order-model.mjs';
// A received request is neither an inventory reservation nor a payment.
const COOKIE = '__Host-cc-orders';
const MAX_BODY = 1048576;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff', ...headers }
});
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
function publicOrder(row) {
  return { id: row.id, status: row.status, reservationStatus: row.reservation_status,
    paymentStatus: row.payment_status, createdAt: row.created_at, ...JSON.parse(row.payload) };
}
export async function handleOrders(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/orders') return json({ error: 'not_found' }, 404);
  if (!['GET','POST'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || (request.method === 'POST' && request.headers.get('Origin') !== url.origin)) return json({ error: 'origin_not_allowed' }, 403);
  if (!env.ORDERS_DB) return json({ error: 'orders_unavailable' }, 503);
  const local = ['localhost','127.0.0.1'].includes(url.hostname) && url.protocol === 'http:';
  const cookieName = local ? 'cc-orders-local' : COOKIE;
  let token = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!/^[a-f0-9]{64}$/.test(token || '')) token = null;
  const headers = {};
  if (!token) {
    if (request.method === 'POST') return json({ error: 'session_required' }, 401);
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    headers['Set-Cookie'] = `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${local ? '' : '; Secure'}`;
  }
  const owner = await hash(token);
  try {
    // Primary reads give immediate read-after-write consistency, including retries.
    const db = env.ORDERS_DB.withSession ? env.ORDERS_DB.withSession('first-primary') : env.ORDERS_DB;
    if (request.method === 'GET') {
      const rows = await db.prepare('SELECT * FROM campaign_orders WHERE owner_hash=? ORDER BY created_at DESC, id DESC LIMIT 20').bind(owner).all();
      return json({ orders: rows.results.map(publicOrder) }, 200, headers);
    }
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'json_required' }, 415);
    if (Number(request.headers.get('Content-Length')) > MAX_BODY) return json({ error: 'body_too_large' }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY) return json({ error: 'body_too_large' }, 413);
    const key = request.headers.get('Idempotency-Key') || '';
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return json({ error: 'idempotency_key_required' }, 400);
    let order; try { order = normalizeOrder(JSON.parse(raw)); } catch (error) { return json({ error: error instanceof SyntaxError ? 'invalid_json' : error.message }, 400); }
    const payload = JSON.stringify(order), payloadHash = await hash(payload);
    const id = 'CC-' + crypto.randomUUID();
    const now = new Date().toISOString();
    // One atomic INSERT and a unique owner/key pair prevent concurrent duplicates.
    await db.prepare(`INSERT INTO campaign_orders (id,owner_hash,idempotency_key,payload_hash,payload,created_at)
      SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM campaign_orders WHERE owner_hash=? AND created_at>=?) < 30
      ON CONFLICT(owner_hash,idempotency_key) DO NOTHING`).bind(id,owner,key,payloadHash,payload,now,owner,now.slice(0,10)).run();
    const row = await db.prepare('SELECT * FROM campaign_orders WHERE owner_hash=? AND idempotency_key=?').bind(owner,key).first();
    if (!row) return json({ error: 'daily_limit' }, 429);
    if (row.payload_hash !== payloadHash) return json({ error: 'idempotency_conflict' }, 409);
    return json({ order: publicOrder(row), replayed: row.id !== id }, row.id === id ? 201 : 200);
  } catch {
    // Do not leak SQL, contact details, or cookie values in responses/logs.
    return json({ error: 'orders_unavailable' }, 503);
  }
}
