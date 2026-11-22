# Incremental implementation plan

Each phase is a reviewable increment. Update API/schema docs when decisions change, record exact verification outcomes in `validation.md`, and keep the conversation record. Do not call an untested phase complete. The suggested seven-day allocation is relative to receipt of the assignment, not an asserted deadline.

| Phase | Suggested time | Work | Completion gate |
|---|---|---|---|
| 1. Foundation | Day 1 | Read both PDF pages; requirements; architecture; schema; REST contract; Docker services | Design/static checks pass; Docker build/start and health checks recorded when Docker available |
| 2. Framework skeleton | Day 1 | Laravel 13/Sanctum + React TS/Vite/Tailwind; locks; REST client; app readiness; dev workflow | Versions verified inside containers; clean install/build/typecheck; React fetches Laravel health and MySQL readiness; DB outage returns 503 |
| 3. Identity + data | Day 2 | Migrations, Eloquent relations, fictional seed data, registration/login/logout/me, policies | Real MySQL migrations and seed twice safely; CSRF/session tests; invalid credentials and cross-user ownership tests |
| 4. Catalog + search | Day 3 | Catalog, filters, facets, product detail/offers, global search; URL state | Combined same-offer filtering, deterministic pagination, exact/partial/typo fixtures; responsive loading/empty/error UI; bounded query EXPLAIN |
| 5. Homepage | Day 4 | Block registry and independent banner/bestseller/deal services; backend-driven rendering | Data changes reflected without frontend changes; provider failure isolated; no hardcoded product/banner content in React |
| 6. Purchase flow | Days 5–6 | Guest/persistent cart, merge, simulated checkout, encrypted keys, own order history | MySQL transactional tests: last-key race, rollback, decline, replay, mismatched idempotency payload, stale price/revision, ownership; full browser purchase |
| 7. UI and hardening | Day 6 | Eneba-inspired design refinement, a11y, responsive layout, error handling, rate limits, redacted logs | Desktop/mobile screenshots; keyboard flow; no console errors; relevant feature suite and end-to-end happy/declined flows pass |
| 8. Delivery | Day 7 | Production images and deployment; clean-clone docs; submission artifacts | CI passes; Docker smoke suite passes; public demo works; persistence/restart verified; GitHub/public links and full AI history ready |

## Current state

Functional phases 3B–7 are implemented and locally validated: marketplace migrations/demo seeds, catalog/filter/sort/search, backend-driven homepage blocks, seller offers, guest/persistent carts, simulated checkout, key delivery, private history and responsive Eneba-style UI. Changes were checked in slices, then with full regressions and real desktop/mobile purchase flows. See [marketplace notes](modules/04-marketplace.md) and [validation](validation.md). Phase 8 production packaging/public hosting/submission is still pending; do not represent the development stack as a production deployment.

## Test strategy

- Use focused PHP unit tests for search normalization/ranking and price arithmetic, not mock-heavy copies of Eloquent behavior.
- Use Laravel feature/integration tests with MySQL 8.4 for authentication, filtering, authorization and transactional checkout. SQLite is insufficient evidence for MySQL row locks or constraints.
- Use frontend tests for consequential behavior such as URL filter state, stale search cancellation and cart error handling. Avoid tests that merely repeat static markup.
- Use Playwright for registration/login → product/offer → cart → simulated payment → key/order history, and for an explicit declined-payment path.
- Add CI in phase 2: lockfile installation, lint/typecheck, frontend build, PHP formatting/tests, MySQL services and Docker configuration/build checks. Add browser checks as the flow becomes usable. No empty CI badge or claim of passing future tests.

## Delivery checklist

- All R1–R9 requirements have demonstrable evidence or an explicit, justified limitation.
- README can be followed from a clean clone; no hidden host PHP/Node assumptions.
- No genuine activation keys, payment data, credentials or personal session cookies in repo/demo.
- Demo payment outcomes and demo credentials are documented and visible.
- Production deployment and database persistence verified on the actual hosting tier.
- Full prompts/responses exported and compared with the session; a work summary is not a substitute.
- Candidate can explain architecture, key allocation, idempotency, search tradeoffs and scope choices.
