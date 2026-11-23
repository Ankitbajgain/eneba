# REST contract v1

The marketplace endpoints below are implemented locally, including simulated checkout and private key delivery. Machine-readable schemas are in [openapi.yaml](openapi.yaml). API origin is the frontend origin. Prefix `/api/v1`, JSON bodies, UTF-8; no GraphQL. API routes force JSON authentication errors even when Accept is missing. The Sanctum bootstrap route remains `/sanctum/csrf-cookie`.

## Endpoints

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| GET | /sanctum/csrf-cookie | Public | Set CSRF/session cookies; 204 |
| GET | /api/v1/health | Public | Application + DB readiness; 200 or 503, no environment details |
| POST | /api/v1/auth/register | CSRF | Create account and session; 201 |
| POST | /api/v1/auth/login | CSRF | Establish session; 200 |
| POST | /api/v1/auth/logout | Session + CSRF | Invalidate session; 204 |
| GET | /api/v1/auth/me | Session | Current user; 200 |
| GET | /api/v1/home | Public | Ordered provider-backed homepage blocks |
| GET | /api/v1/products | Public | Paginated catalog and filters |
| GET | /api/v1/products/{slug} | Public | Published product detail |
| GET | /api/v1/products/{slug}/offers | Public | Paginated active offers; available first, then price/id |
| GET | /api/v1/catalog/filters | Public | Platform and region options from DB |
| GET | /api/v1/search | Public | Ranked exact/partial/fuzzy product suggestions |
| GET | /api/v1/cart | Session | Current cart including price/stock validity |
| POST | /api/v1/cart/preview | Public, read-only | Server-price bounded guest offer IDs/quantities without persisting a cart |
| POST | /api/v1/cart/items | Session + CSRF | Add offer quantity; upsert, server acknowledges current price |
| PATCH | /api/v1/cart/items/{itemId} | Session + CSRF | Set quantity and acknowledge current price |
| DELETE | /api/v1/cart/items/{itemId} | Session + CSRF | Remove line; 204 |
| POST | /api/v1/cart/merge | Session + CSRF | Merge bounded guest lines; return cart and warnings |
| POST | /api/v1/checkout | Session + CSRF | Idempotent synchronous simulated purchase |
| GET | /api/v1/orders | Session | Own paginated orders, latest first |
| GET | /api/v1/orders/{orderId} | Session | Own order with snapshots, no keys |
| GET | /api/v1/orders/{orderId}/keys | Session | Own fulfilled order's demo keys; no-store |

## Query and data conventions

Catalog query: `q` (2–100 chars when present), `platform` and `region` (codes), `min_price`/`max_price` (integer cents, inclusive, min ≤ max), `available` (boolean), `sort` (`relevance`, `price_asc`, `price_desc`, `name_asc`, `newest`), `page` (≥1), `per_page` (1–48, default 24). Missing `q` means browse. Empty `q` is omitted by the client; a supplied invalid query returns 422. Default sorting is relevance when q exists, otherwise newest; a relevance request without q falls back to newest. Every sort uses product ID as a stable final tie-breaker; null prices sort last in either price direction. Matching offer predicates are applied together. Out-of-range pages return empty data with valid metadata.

Search query: required `q`, same length limits, `limit` 1–20 (default 8); response includes match type and no private inventory fields. Exact/partial/typo acceptance tests pass. Ranked candidate evaluation is capped at 100 titles; short queries use literal partial matching and fuzzy matching begins at four characters. This assignment implementation is not an exhaustive fuzzy search across an arbitrarily large catalog.

Single resource: `{ "data": ... }`. Collections: `{ "data": [...], "meta": {"page":1,"per_page":24,"total":30,"last_page":2} }`. Prices: `{ "amount_minor":1299,"currency":"EUR" }`; API never sends floating point money. Product IDs, offers and cart item IDs are integers; public order identifiers and idempotency keys are UUID strings. Dates use ISO 8601 UTC.

## Authentication and errors

Cookie name: `marketplace_session` (HttpOnly); CSRF cookie `XSRF-TOKEN` (readable by the client for header construction). All unsafe requests need `X-XSRF-TOKEN`, including register/login. Credentials must be included by the client. Return a safe user resource: id, name and email only.

Implemented authentication: normalized email; name ≤100; email ≤255; registration password confirmed, 12–72 characters and ≤72 UTF-8 bytes (bcrypt). Login uses the same byte ceiling. Valid login/register requests while signed in return 409 `already_authenticated`. Unknown emails and wrong passwords have identical 401 responses. Auth routes always run web session/CSRF middleware, even without Origin/Referer and with same-origin Fetch Metadata. Bearer authentication is disabled.

Login limits: 20 requests/minute per IP and 5 per normalized-email/IP pair. Registration: 5/minute per IP. Limits count requests, including successes. File cache persists limits across requests in this single-instance development deployment; use shared atomic cache before multiple instances. API errors and private auth responses are no-store. Unimplemented routes return safe JSON 404. See the [identity module](modules/03-authentication.md).

Errors use `{ "message":"...", "code":"...", "errors":{ "field":["..."] } }`; `errors` is present only for validation. Planned statuses: 401 session required / invalid credentials, 403 policy rejection, 404 missing or unowned resource, 409 state conflict, 419 invalid CSRF, 422 validation, 429 throttled with Retry-After, 500 generic internal failure, 503 readiness/provider unavailability. Configure Laravel exception rendering to match this contract; defaults alone do not provide these stable codes. Do not leak SQL, traces or existence of another user's orders/items.

## Cart and checkout semantics

Adding items returns 201 with the entire cart, including on existing-line upsert. PATCH returns 200. Every successful mutation increments revision. Requests are serialized using the same cart lock; owner-scoped item resolution prevents cross-cart access. Server bounds cart to 50 lines and quantity 10 per offer. GET reports current prices and validity but does not acknowledge price changes. PATCH/POST explicitly acknowledges current price. Merge returns warnings for unavailable or capped quantities so the browser can explain adjustments.

Checkout body: `{ "cart_revision":7,"simulate_result":"success" }`; header `Idempotency-Key: <UUID>`. Success creates and returns an order with 201. Simulated decline also creates an order with 201, `status=failed` and `payment_status=declined`; it is a recorded business outcome, not an HTTP transport error. Replay returns the same resource with 200 and `Idempotency-Replayed: true`. Header reuse with a different canonical request body, stale cart revision, changed price, empty cart or insufficient keys returns 409 with a stable code (`idempotency_conflict`, `cart_changed`, `price_changed`, `cart_empty`, `out_of_stock`). Missing/invalid idempotency header returns 422. A checkout conflict creates no order. Cart clearing and key delivery happen only on success.

Keys are fetched separately after fulfillment; do not embed them in order lists or checkout responses. Every private response uses `Cache-Control: no-store`. No actual payment card inputs or external payment tokens are accepted.

## Maintenance

Public POST `/api/v1/maintenance/migrate`, `/api/v1/maintenance/cache-clear`, `/api/v1/maintenance/optimize` and `/api/v1/maintenance/storage-link` invoke fixed Artisan calls without login, a token or an enable flag. Empty body/no query options; responses are private/no-store. See [commands and usage](modules/05-maintenance.md).
