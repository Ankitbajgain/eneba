# Marketplace implementation: catalog, content and purchases

Implemented locally on 2026-11-22 in separately validated slices. The fixed React/TypeScript/Vite/Tailwind and Laravel 13/PHP 8.3/Sanctum/MySQL stack is preserved. Frontend/backend communication remains REST through nginx or Vite's same-origin API proxy.

## What is available

| Route | Behavior |
|---|---|
| / | Backend-managed campaign banners, bestseller and deal collections, category navigation |
| /store | All published products; platform/region/price filters; availability, sorting, pagination and name search |
| /products/:slug | Details, activation constraints, competing sellers, ratings, prices and add-to-cart |
| /account | Registration/login, persistent cookie session, current account and logout |
| /cart | Guest or persistent cart, quantities, remove, changed-price acknowledgment and totals |
| /checkout | Sign-in required; explicitly simulated successful/declined payment |
| /orders | Private paginated history |
| /orders/:id | Immutable order details and owner-only fictional key reveal/copy |

The browser shell follows the live Eneba reference: purple surfaces, darker navigation/cards, bright yellow actions, global search, campaign panels, portrait covers and dense card grids. Responsive desktop/mobile screenshots are in [screenshots](../screenshots/home-desktop.png). This is an internship demo, not an official Eneba service. Promotions and seller offers are fictional. The [artwork record](../assets.md) identifies the locally stored promotional images.

## Data model and demo setup

The versioned marketplace migration executes MySQL DDL from backend/database/schema/marketplace.sql, adding 14 domain tables to the existing identity/session tables. It preserves the designed foreign keys, check constraints, integer cents, stock ownership and indexes. No SQL import is needed in addition to migrations.

MarketplaceSeeder supplies 24 games, 3 sellers, 3 platform options, 2 regions, competing offers and encrypted DEMO-only inventory. One product deliberately has no stock. Offers exist for Steam and selected Xbox variants; PlayStation remains a valid empty filter choice, rather than fake stocked inventory. Demo metadata is upserted; deterministic HMAC fingerprints prevent duplicate stock and sold keys are not replenished. Rerunning a seed may restore demo catalog/pricing/content metadata, but does not delete user accounts or purchase history.

HomepageSeeder supplies three campaigns and enabled block metadata. It creates genuine fulfilled demo orders for an inaccessible fixture account, assigning actual demo keys, so bestseller content is computed from fulfilled order items in a 30-day window. Repeated seeds do not duplicate fixture orders or sell more fixture keys. No demo credentials or actual supplier keys are required.

```powershell
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --force
```

The setup script now includes both commands. `DEMO_PAYMENTS_ENABLED=true` in backend/.env enables the simulated provider; it defaults off in application config and is enabled in the local environment example. It must never be mistaken for a real payment integration. APP_KEY must remain stable. Demo fingerprints fall back to APP_KEY; a separate persistent KEY_FINGERPRINT_SECRET must be supplied before any real inventory import, and must not be rotated without a planned fingerprint migration. Only fictional keys are supplied here.

## Catalog and search

Catalog filters operate on a single matching offer, so a platform from one seller cannot combine with a region/price from another to incorrectly match a product. Card prices come from available matching offers. Published sold-out products remain browsable without an availability/price restriction. Sorting has a stable product-ID tie-breaker and null prices last; page sizes are capped at 48. Product and offer resources explicitly select public fields, never ciphertext/fingerprints.

Search normalizes case, accents and whitespace. Exact/prefix/substring candidates rank before typo results. Indexed title trigrams select candidates; Unicode edit distance ranks at most 100 product candidates in PHP. Two/three-character input uses literal partial matching; fuzzy matching begins at four characters. This handles examples such as `eldn` → ELDEN RING and escapes SQL LIKE wildcards. Product saves and seeders maintain the derived gram index. Very broad searches are bounded to 100 ranked matches in this assignment implementation; this is a documented scale limit, not an enterprise search engine or an exhaustive fuzzy-search guarantee. Query plans/load behavior at production scale remain to be benchmarked.

React Router stores catalog query/filter/sort/page in the URL. Changes reset pagination, and browser navigation restores them. Global search debounces approximately 250 ms and cancels stale fetches. TanStack Query manages server state; no arrays of product/promotion content are embedded in React.

## Homepage providers

The backend registry reads ordered enabled homepage_blocks and dispatches each type independently:

- BannerContentService reads scheduled banners from its table.
- BestSellerContentService aggregates fulfilled order-item quantities.
- DealContentService queries stocked offers discounted against their reference price.

The frontend renders blocks in backend order and displays returned titles, images, copy, targets and products. Static navigation/control/error labels are UI chrome, not embedded campaign/catalog data. A provider failure returns an error status and empty items for that block while other blocks continue; errors are reported server-side. Unknown block types are not accepted by the schema. Private order/key data is never in homepage payloads.

## Cart, payment and fulfillment

Guest storage contains offer IDs and quantities only, capped at 50 lines/10 per offer. POST /cart/preview performs bounded read-only server pricing; it does not create a cart/order. On sign-in, a guest cart is merged into the authenticated cart and cleared only after a successful response. Unavailable/capped lines produce warnings. A failed merge can be retried explicitly. Quantities, totals, availability and prices are always revalidated by Laravel.

All private endpoints use session authentication, strict CSRF and no-store responses. Cart mutations and checkout acquire a user-row lock, then the cart. Checkout locks offers and inventory in deterministic ascending order, checks the observed cart revision/price/stock, and creates immutable order/item/payment snapshots in one MySQL transaction. Key assignment and cart clearing commit atomically with success. A decline persists a failed order, keeps the cart and allocates no keys. Exceptions roll back every line; deadlocks can retry the transaction three times.

Checkout requires a UUID Idempotency-Key. `(user_id, key)` is unique, and canonical request hashes detect changed payloads. Replaying a completed success/decline returns its original order even after the cart changes; a different payload with the same key returns 409. The browser retains the same key for an uncertain network retry and offers recovery of the previous attempt if the committed cart is already empty. Writes are not automatically replayed by the generic API client.

Orders and key queries are scoped to the authenticated owner. UUIDs do not substitute for ownership checks. A separate no-store endpoint decrypts keys only for fulfilled owned orders; lists/checkout responses omit them. Reveal/copy stays in component/query memory, and key queries are removed on sign-out. The cookie authentication middleware returns JSON 401 even when a caller omits Accept, rather than attempting an HTML login redirect.

## Validation

```powershell
docker compose run --rm test
docker compose exec backend vendor/bin/pint --test
docker compose run --rm --no-deps node run --prefix frontend build
docker compose run --rm --no-deps node run --prefix frontend test
node scripts/check-marketplace-browser.mjs
node scripts/capture-marketplace.mjs
```

Browser tooling is optional and isolated: install it with `npm.cmd install --prefix .tools/browser playwright`, then use an installed Chrome or set BROWSER_EXECUTABLE. Acceptance checks cover desktop 1440px on 127.0.0.1:5173 and mobile 390px on localhost:8080. Their temporary accounts, carts, orders, payments and key assignments are scoped and cleaned up. Screenshots hide delivered keys. The two-process checkout race uses separate PHP/MySQL connections and a start barrier; exactly one buyer receives a final key, the other gets out_of_stock. It cleans only its own test fixtures and never refreshes the preview database.

Observed: **31 backend tests / 188 assertions**, including the race and provider-failure isolation; **18 frontend tests**, including URL/history state, cent conversion, write retry identity and lost-response recovery; successful full buying flows on both gateways; desktop/mobile captures with no horizontal page overflow. The expected provider-failure fixture logs an injected error while its test passes. See [validation record](../validation.md).

Docker/Windows source watching now uses polling so file edits reach the live preview. nginx explicitly permits Vite's public `/node_modules/.vite/deps/` bundles while continuing to deny sensitive dot-files. These are development-only settings, not production delivery architecture.

## Remaining delivery work

The requested functional demo is implemented and locally validated. Production immutable image packaging, public hosting, GitHub-hosted CI results, deployment/backup/restore checks, exhaustive accessibility/security/load audits and authentic full AI-history export remain delivery tasks. No real money, supplier integration, refunds, tax jurisdiction engine, seller administration or live currency conversion is implemented. Search scaling and multi-instance rate limiting require separate production work.
