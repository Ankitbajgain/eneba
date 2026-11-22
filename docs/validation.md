# Validation record

## Functional marketplace — 2026-11-22

Implemented and validated in slices: (1) versioned MySQL domain schema, deterministic demo data and catalog/search; (2) independent homepage content providers and fixture sales; (3) transactional cart/checkout/key delivery; (4) routed responsive storefront and browser acceptance. The design snapshot remains a review artifact; setup uses migrations only.

| Check | Result | Evidence |
|---|---|---|
| Catalog/data | Passed | 24 seeded published products, 3 sellers, 3 platforms, 2 regions; same-offer filters, stable sorting, pages, sold-out visibility, seed repeatability and no private inventory fields |
| Search | Passed | Exact, partial and typo fixtures, publication boundaries, escaped wildcard query; 100 ranked-candidate bound |
| Homepage | Passed | Three ordered block types; separate banner, sales-aggregation and deal providers; DB content edits reflected in API; provider failure isolated; seed orders not duplicated |
| Commerce | Passed | Cart ownership/quantity limits, stale revision/price, explicit price acknowledgment, atomic all-lines stock failure, demo decline retention, success with exact key count, owner-only orders/keys, idempotent replay/payload conflicts and demo switch |
| Actual concurrency | Passed | Two independent PHP processes/MySQL connections synchronized at a start barrier compete for one key: exactly one order succeeds, the other gets 409 out_of_stock; fixtures are scoped and removed |
| Full backend regression | Passed | **31 tests / 188 assertions** on MySQL test database; no preview data refresh/truncate |
| Frontend regression | Passed | **18 tests** covering auth/CSRF, catalog URL/history and integer-cent bounds, checkout retry identity and recovery of a committed response after the cart empties |
| Frontend production asset build | Passed | TypeScript + Vite build; dependency lockfile updated for router, query state and icons |
| Browser acceptance | Passed | Desktop 1440px on 127.0.0.1:5173 and mobile 390px on localhost:8080: responsive home, typo search, filter empty state, seller comparison, guest cart, registration/merge, declined payment, successful payment, reveal/hide fictional key, history, logout and unauthorized key rejection; no uncaught browser exceptions |
| Visual checks | Passed for captured views | Six final homepage/catalog/product desktop/mobile captures; no horizontal document overflow; game artwork loaded locally; comparison against a public Eneba reference screenshot |
| PHP/platform/runtime | Passed | Pint 69 files, Composer platform requirements on PHP 8.3.37, nginx config and foundation HTTP checks, four healthy Docker services |
| Contract/docs | Passed | OpenAPI 3.1, selected Compose structural constraints, schema reference inventory and local Markdown links |

Browser checks clean their random demo accounts, carts, payments/orders and their own key assignments; no genuine activation keys or card details exist. Screenshots of order results hide keys. A provider-failure test intentionally reports its injected error while asserting that other homepage blocks render normally.

Browser QA exposed and resolved two existing dev infrastructure limits: Docker/Windows bind-mount watching now uses polling, and nginx permits only Vite's public dependency-bundle prefix while retaining sensitive dot-file denial. Acceptance also caught an HTML redirect attempt for private API requests without Accept; API middleware now guarantees JSON 401 instead.

The final backend-driven homepage render preserves the returned block order and contains no embedded campaigns/product lists. The catalog UI requests 12 products/page so the 24-record demo visibly demonstrates pagination. A later empty-cart recovery branch reuses the original checkout body/key after a lost committed response and has its own frontend regression test.

Screenshots: [home desktop](screenshots/home-desktop.png), [home mobile](screenshots/home-mobile.png), [catalog desktop](screenshots/store-desktop.png), [catalog mobile](screenshots/store-mobile.png), [product desktop](screenshots/product-desktop.png), [product mobile](screenshots/product-mobile.png). Module details and repeatable commands: [marketplace implementation](modules/04-marketplace.md).

Not claimed: pixel-for-pixel equivalence across every Eneba page, exhaustive accessibility/security/load certification, enterprise-scale search, real payment/supplier integration, immutable production image deployment, remote CI execution, public hosting or complete AI-history export. These are delivery/production tasks beyond the locally verified functional demo.

## Browser registration cookie fix — 2026-11-22

Browser request logs showed CSRF bootstrap requests from 127.0.0.1:5173 without a subsequent registration POST. The configured Domain=localhost cookie cannot be accepted on that IP hostname. Fixed Compose and environment examples to use host-only cookies by default, and added all configured 127.0.0.1 origins to Sanctum alongside localhost. Applied the environment and cleared Laravel's configuration cache without rotating APP_KEY or clearing user sessions globally.

Executed successfully: isolated headless Chrome registration, host-only/HttpOnly cookies, reload persistence, login and logout on **both 127.0.0.1:5173 and localhost:5173**. Temporary accounts were removed. TypeScript/Vite production build and **14 frontend tests** passed, including a missing-cookie message regression. Static design checks also pass. See the [module instructions](modules/03-authentication.md). Missing-cookie errors now have their own UI explanation; the REST client still does not replay writes.

## Development port configuration — 2026-11-22

Root `.env` now assigns FRONTEND_PORT=5173 and BACKEND_PORT=8000 alongside HTTP_PORT=8080. The frontend publishes its Vite listener; nginx publishes a dedicated API-only listener and retains the combined gateway. PHP-FPM :9000 and MySQL remain private. Frontend/backend environment examples and the setup script document these settings; local environment files were updated without changing passwords or APP_KEY.

Executed successfully: Docker Compose configuration/startup, four healthy services with the expected loopback mappings, nginx configuration and existing gateway smoke checks, TypeScript/Vite build, and full cookie/CSRF/authentication/rate-limit HTTP smoke checks through both localhost:5173 and localhost:8000. Both checks cleaned up their temporary accounts.

Verified the running non-secret environment: backend APP_URL=http://localhost:8000 and Sanctum origins localhost:8080,localhost:5173,localhost:8000; frontend DEV_SERVER_PORT=5173 and API_PROXY_TARGET=http://nginx:8081. Alternate host values (15173,18000,18080) were verified with Compose configuration interpolation only; the running environment stayed on the defaults. Static OpenAPI/infrastructure/documentation checks pass. No new marketplace features or production deployment are included in this port fix.

## Phase 3A: authentication — 2026-11-18

| Check | Result | Observed evidence |
|---|---|---|
| Isolated MySQL tests | Passed | Dedicated marketplace_test created without dropping preview data; normal migrations; transaction-scoped authentication fixtures; test runner refuses non-test database names |
| PHP integration suite | Passed | 15 tests, 76 assertions: 13 authentication/security cases plus 2 readiness cases |
| React/REST-client suite | Passed | 13 tests across account forms (6), CSRF writes (3), readiness (4) |
| Frontend build/typecheck | Passed | TypeScript and Vite production asset compilation in Docker |
| PHP formatting | Passed | Pint formatted/checked 33 files; no remaining style findings |
| Gateway authentication | Passed | Real nginx HTTP requests: CSRF bootstrap, readable XSRF cookie, HttpOnly session cookie, strict missing-token 419, safe registration resource, session persistence, wrong-password rejection, successful login, cookie updates, logout and old-session replay rejection |
| Persistent rate limits | Passed | HTTP login attempts reached 429 across separate real requests; backend tests also verify both configured limiters and Retry-After |
| Temporary account cleanup | Passed | HTTP script's finally block successfully removed its random smoke account; secrets/cookies were never printed |
| API/design documents | Passed | OpenAPI 3.1, structural infrastructure checks and local links checked after updates |

Registration/login use the existing user/session schema; no marketplace-domain migration or seed data is implemented in this slice. PHP tests use `<MYSQL_DATABASE>_test`, selected by the new Docker `test` service. Use `docker compose run --rm test` instead of running the writing suite inside the preview backend container. Existing identity tests roll back their fixture writes; the HTTP check uses a narrowly scoped temporary account and cleanup.

The previous build directory had been produced by root in the earlier increment. Its ownership was repaired within the workspace so the current node-user build could replace generated assets; typecheck/build then passed. Laravel resource status inference was made explicit (register 201, login/me 200), and test guards are reset where repeated requests share an application in a session test. Real HTTP logout/replay checks establish the persisted behavior independently of those test-process caches.

CI now includes the Dockerized HTTP authentication smoke flow, but GitHub-hosted execution has not run here. Browser-rendered visual/keyboard QA, fresh-clone bootstrap after this slice and multi-instance/TLS deployment remain unverified. Source mounts expose the current feature in the running development preview; new immutable production images remain delivery-phase work. Full AI history export remains outstanding; the maintained prose logs are partial records.

Current commands and behavior: [authentication module](modules/03-authentication.md), [Docker runbook](infrastructure.md).

## Phase 2: framework integration — 2026-11-17

Docker is now available and the framework slice has been exercised in Linux containers. This section supersedes the foundation-era environment limits below for the implemented slice only.

| Check | Result | Evidence |
|---|---|---|
| Container image builds | Passed | PHP-FPM development image and React/Vite development image built successfully |
| Locked dependency resolution | Passed | Composer platform 8.3.0; framework 13.43.0, Sanctum 4.4.0; npm package-lock generated and npm ci succeeded during image build |
| PHP platform requirements | Passed | composer check-platform-reqs passed on PHP 8.3.36 with required extensions |
| Frontend typecheck/build | Passed | tsc -b + Vite 8.3.8 production asset build inside Node container |
| Frontend behavior | Passed | Four Vitest tests: successful readiness, outage/retry, malformed payload, unmount cancellation |
| Identity/session migrations | Passed | MySQL migration applied; repeat migration reports nothing to migrate; marketplace domain migrations remain future work |
| Backend readiness | Passed | Two tests, 10 assertions; real configured MySQL query and real refused connection with browser-origin headers; safe 503 without SQLSTATE leakage |
| PHP style | Passed | Pint checked 25 application/config/test files |
| nginx/gateway smoke | Passed | nginx -t; HTTP / and /api/v1/health 200, undefined /api/v1/products 404, /hidden.php 404, /.env 403 |
| Actual database outage | Passed | check-foundation.ps1 -DatabaseOutage stopped this project's MySQL, verified safe API 503 and restarted it in finally; readiness recovered to 200 |
| Service readiness | Passed | backend, database, frontend and nginx all running and healthy after startup/recovery |
| Static design checks | Passed | OpenAPI 3.1, Compose constraints, SQL reference inventory and documentation links |
| Setup script | Passed on repeat run | setup-dev.ps1 completed; existing backend/.env file hash unchanged (including APP_KEY); no pending migrations; all four services healthy |

Resolved runtime versions: PHP **8.3.36**, Laravel **13.43.0**, Sanctum **4.4.0**, Composer **2.11.2**, Node **26.13.1**, MySQL **8.4.13**. Frontend lockfile includes React **19.3.1**, Vite **8.3.8**, Tailwind **4.3.5**, TypeScript **7.0.2**, Vitest **5.1.0**. Docker Engine **29.9.3**, Compose **5.7.0**. Development base-image tags remain mutable; releases must pin tested digests.

The outage checks prompted exclusion of Sanctum's stateful session middleware from health, so readiness does not load DB-backed browser sessions first. The failure test now exercises a real refused connection rather than mocking the entire DB manager, which Laravel's response factory also resolves. PHPUnit environment/server settings force isolated test sessions even when Compose provides local settings. PowerShell wrappers interpret native exit codes and treat normal Docker stderr progress as informational text.

Not yet verified: a fresh clone through the complete setup script, browser screenshots/keyboard QA, GitHub-hosted CI execution, production builds/deployment, the full design SQL on MySQL, or any account/catalog/purchase behavior. Component tests and HTTP checks do not substitute for browser QA. Phase 3 onward remains unimplemented.

Repeatable commands:

```powershell
docker compose exec backend composer check-platform-reqs
docker compose exec backend vendor/bin/pint --test
docker compose exec backend php artisan test
docker compose run --rm --no-deps node run --prefix frontend build
docker compose run --rm --no-deps node run --prefix frontend test
./scripts/check-foundation.ps1 -DatabaseOutage
```

The last command deliberately causes a brief outage of this development project's database and restores it. Omit `-DatabaseOutage` for normal smoke checks. Detailed behavior is in the [module notes](modules/02-framework.md).

## Phase 1 historical record

Date: 2026-11-17, before Docker became available. Increment: foundation only. The observations below describe that earlier state, not current framework readiness.

### Executed locally

| Check | Result | Evidence / limits |
|---|---|---|
| Assignment review | Passed | Both PDF pages extracted with pypdf 7.1.0 and read; requirements/deliverables mapped in assignment.md |
| Framework compatibility research | Passed | Official Laravel 13 framework requires PHP ^8.3; links retained in architecture.md; installed framework compatibility still needs a container build |
| OpenAPI 3.1 validation | Passed | openapi-spec-validator 0.9.0: 20 paths, 21 unique operations; references and schema validate |
| Compose static checks | Passed | YAML parses; four active services, two tooling services; healthy dependency gates; only nginx publishes a loopback port; named MySQL volume; Dockerfile paths exist |
| SQL inventory | Passed | 17 table definitions; all referenced tables defined; does not prove MySQL syntax or invariants |
| JavaScript syntax | Passed | `node --check` for standby listener and standalone smoke check |
| Standby runtime smoke | Passed | Node v24.14.0 on host: /healthz JSON 200; /, /products and /api/v1/products explicit JSON 503; no-store headers; child process stopped after test |
| PowerShell syntax | Passed | PowerShell AST parser reports no errors for check-foundation.ps1 |
| Local documentation links | Passed | check-design.py resolves relative Markdown file links |

Repeat with the commands in [infrastructure.md](infrastructure.md). Static checks originally caught a missing validation document while it was being written; the final check is rerun after all documents exist. The host Node version is only local smoke evidence; the container uses `node:latest` and its resolved version is not yet known.

### Pending runtime gates at the foundation increment

Docker CLI/daemon and host PHP/MySQL are unavailable in this environment. The following have **not** run:

- `docker compose config --quiet` using Docker's own parser.
- Image pulls/builds and actual image/platform/dependency compatibility.
- `docker compose up -d --wait`, service health ordering and restart behavior.
- nginx parsing and FastCGI routing inside containers.
- MySQL execution of the design SQL on a disposable database, constraint/index checks and EXPLAIN.
- Laravel installation, migrations, application/database readiness and REST integration.
- Application unit/integration/browser tests, production image builds and deployment checks.

Run `./scripts/check-foundation.ps1 -Build` on a Docker-enabled host for the first container gate. Record actual outputs and versions here before declaring the foundation runtime-verified. Execute the SQL design only on an empty disposable database if validating it before migrations exist. Do not import it into the future Laravel application database.

### Known foundation limits at that time

Frontend is an infrastructure standby listener, not React yet. Backend is a PHP-FPM image, not an installed Laravel project yet. Application routes deliberately fail with 503. Production images, CI, deployment, migrations and all marketplace features are later increments. Full authentic conversation export is still a submission deliverable; the local prose record is explicitly partial.
