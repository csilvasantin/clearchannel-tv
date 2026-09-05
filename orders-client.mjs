import { normalizeOrder } from './order-model.mjs?v=20260905-2';
// Idempotency is derived from the request, so retry/reload/another tab is safe.
export class OrdersClient {
  constructor(fetcher = (...args) => fetch(...args)) { this.fetcher = fetcher; }
  async request(options = {}) {
    const response = await this.fetcher('/api/orders', { credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.timeout(15000), ...options });
    let data; try { data = await response.json(); } catch { throw Error('orders_unavailable'); }
    if (!response.ok) throw Error(data.error || 'orders_unavailable');
    return data;
  }
  async list() {
    // Serialize first cookie issuance across tabs; subsequent reads use the same owner.
    const read = () => this.request();
    const data = typeof navigator !== 'undefined' && navigator.locks
      ? await navigator.locks.request('cc-orders-session', read) : await read();
    return data.orders;
  }
  async create(payload) {
    await this.list();
    const body = JSON.stringify(payload);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalizeOrder(payload))));
    const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body };
    try { return (await this.request(options)).order; }
    catch (error) {
      if (error.message !== 'session_required') throw error;
      await this.list();
      return (await this.request(options)).order;
    }
  }
}
