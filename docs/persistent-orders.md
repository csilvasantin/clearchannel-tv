# Campaign requests

The checkout now stores campaign requests in Cloudflare D1 through the same-origin
`/api/orders` API. Submitting does not confirm inventory, take payment or broadcast
creative. Estimated prices supplied by the browser are explicitly indicative.

`received`, `reservation_status=pending`, `payment_status=not_started` are written
by the server, never trusted from the client. There is deliberately no public
status-update route. A future authenticated confirmation/payment integration must
verify inventory and price and update these states using actual evidence.

An opaque HttpOnly/Secure/SameSite cookie owns the records; only its SHA-256 hash is
stored. The latest 20 requests are recoverable from the same browser and domain for
as long as its cookie remains (one-year lifetime). Cross-device recovery and login
linking are not part of this change. Legacy sessionStorage orders were not verified
by a server and are not imported as reservations. Card fields have been removed.

An atomic unique (owner, idempotency key) constraint makes retries safe. The client
hashes a canonical payload, including the quote, so reloads, duplicate clicks and
cosmetic label changes reuse the same request. Changing substantive details creates
a new request. A reused explicit key with different details returns 409. No more
than 30 new requests per owner/day; a retry still works after that limit.

## Operations

Production D1 binding: `ORDERS_DB`, database `clearchannel-orders`.
Preview builds have no production database binding and fail closed with HTTP 503.
Apply schema before deploying:

    wrangler d1 migrations apply ORDERS_DB --remote

Local development and checks:

    wrangler d1 migrations apply ORDERS_DB --local
    wrangler pages dev . --port 8795
    node --test tests/*.test.mjs

Deploy from clean, current main using deploy.sh. Where the vault's Pages token lacks
D1 permission, use the existing authorized Wrangler login by setting
`ADMIRANEXT_USE_WRANGLER_SESSION=1` (no token rotation or access expansion).

Rollback web changes without dropping the D1 table: saved requests must survive.
Do not restore the old misleading checkout as a remedy for a temporary database
failure; the new UI reports failure and permits an idempotent retry.
