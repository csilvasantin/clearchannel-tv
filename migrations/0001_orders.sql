CREATE TABLE IF NOT EXISTS campaign_orders (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','cancelled')),
  reservation_status TEXT NOT NULL DEFAULT 'pending' CHECK(reservation_status IN ('pending','confirmed','rejected')),
  payment_status TEXT NOT NULL DEFAULT 'not_started' CHECK(payment_status IN ('not_started','paid','failed','refunded')),
  created_at TEXT NOT NULL,
  UNIQUE(owner_hash, idempotency_key)
);
CREATE INDEX IF NOT EXISTS campaign_orders_owner_date ON campaign_orders(owner_hash, created_at DESC);
