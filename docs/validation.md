# Validation record

## Public maintenance APIs - 2026-11-23

The user explicitly removed maintenance login/token requirements. This supersedes the operator-only implementation recorded below. The four maintenance POST endpoints are now public with no enable flag, operator credential, session or CSRF middleware. Customer checkout/history authentication remains unchanged.

- Passed full PostgreSQL suite: **38 tests / 232 assertions**. The seven maintenance tests cover unauthenticated fixed Artisan dispatch (including an Origin header with no session cookie), allowed HTTP methods/actions, rejected command options, database outage errors, cache/optimization calls, real idempotent storage links/conflicts, safe command failures and PostgreSQL lock contention/release.
- Passed live local HTTP calls without Authorization/cookies: migrate, cache-clear, optimize and storage-link all returned 200/completed; caches cleared afterward to restore the development workflow.
- Passed production-container HTTP checks on a fresh empty PostgreSQL database: no Authorization, cookies, CSRF token, enable settings or HTTPS override; migrations succeeded twice, optimization artifacts were created, subsequent public requests worked through cached routes, storage linking was idempotent, and cache clearing removed data/config/route/event caches. Temporary production test services were stopped afterward.
- Passed production PHP image build, Pint **74 files**, OpenAPI **25 paths / 26 operations**, design/document-link checks and whitespace checks. These are local results, not a remote Render deployment claim.
- Removed maintenance auth middleware/config, token-generation script, Compose/environment/Render settings and OpenAPI authentication requirements. Updated API/deployment examples to plain POST requests. Only fixed maintenance commands remain callable; PostgreSQL advisory locking/no-store responses and safe error handling remain.

Earlier token/revocation validation below is historical, not a current access requirement. See [current usage](modules/05-maintenance.md).

## Operator maintenance APIs - 2026-11-23

- Implemented POST-only migrate, cache-clear, optimize and storage-link endpoints using fixed `Artisan::call` invocations. Dedicated hashed operator credentials, disabled by default; customer auth and arbitrary arguments do not authorize operations.
- Passed full PostgreSQL regression: **41 tests / 246 assertions**, including 10 maintenance tests. Checks cover missing/wrong/customer/query credentials, disabled/no-query behavior, production HTTPS/runtime revocation/rotation despite cached settings, command options, redacted exceptions/nonzero exits, refused DB connection, real idempotent symlinks/conflicts and a second PostgreSQL session contending for the shared advisory lock.
- Passed real HTTP production-image checks on a new isolated PostgreSQL DB with no users/session/cache tables: rejected absent credentials and insecure requests, migrated twice successfully with an Origin header, created config/event/route caches, reauthorized through cached routes, invoked storage:link twice, then cleared shared cache data and bootstrap artifacts. Rootless image contains the pre-created standard public storage link. Local forwarded HTTPS metadata was simulated; actual cloud TLS remains pending.
- Passed final Render image build, Pint **76 files**, OpenAPI **25 paths / 26 operations**, Compose/design/local links, official Render Blueprint JSON schema and whitespace validation. Cloud deployment remains separate.
- Generated operator credentials only in ignored `.tools/maintenance-credentials.json`; plaintext tokens were not printed, embedded in frontend code or included in image builds. Test credentials are independent of the generated operator credential. Temporary maintenance test services are stopped after validation; development defaults remain disabled.

See [maintenance commands and setup](modules/05-maintenance.md). Optimization/symlink changes are instance-local; PostgreSQL migrations and the maintenance lock use the shared DB. Existing development data was not reset by these checks.

## PostgreSQL migration ? 2026-11-23

The user explicitly replaced the original MySQL requirement with Render Postgres to use the free demo tier. Current Docker development, production rehearsal and CI target PostgreSQL 17. Historical MySQL records below remain evidence of earlier increments.

| Check | Result | Evidence |
|---|---|---|
| Schema/runtime | Passed locally | PHP PDO PostgreSQL compiled; Laravel identity, 14-table PostgreSQL domain schema and shared cache migrations applied; five healthy local services |
| Existing data | Passed locally | Private MySQL snapshot imported into empty PostgreSQL; all 17 snapshot table counts matched; identity sequences advanced; user password hashes, prices, order identities/status/totals and encrypted payloads/fingerprints compared directly; all demo keys decrypted with unchanged APP_KEY |
| Backend regression | Passed | 31 tests / 188 assertions on dedicated PostgreSQL test DB, including real two-process last-key checkout race, idempotency/rollback/ownership, auth/CSRF and safe DB outage handling |
| Development browser acceptance | Passed locally | Desktop 127.0.0.1:5173 and mobile localhost:8080: homepage/search/filters/offers, account/cart, decline/success, keys/history/logout; generated fixtures cleaned up |
| Production image | Passed locally | Render Docker target built with PDO pgsql, fresh isolated PostgreSQL migrations/seeds and HTTP readiness; full checkout/session/order/key flow survived DB/app restart on localhost:9082 |
| Backup/recovery | Passed locally | pg_dump restored into a new disposable PostgreSQL DB: 24 products, 892 keys, 80 offers, 3 homepage blocks and 3 migrations; full encrypted inventory checksum matched; recovery DB removed |
| Database UI | Passed locally | Adminer replaces MySQL-only phpMyAdmin on 127.0.0.1:8888; real PostgreSQL login and marketplace tables verified without printing passwords |
| HTTP hardening | Passed locally | Foundation runtime and real gateway auth smoke: cookies, CSRF, login/logout rotation, old-session rejection and persistent limits |
| Code/docs checks | Passed | Pint 71 files, Compose/OpenAPI/SQL reference inventory/local Markdown links, whitespace and official Render Blueprint JSON schema |
| Render configuration | Passed schema validation | Free managed Postgres 17 + free web service, same-region database references, TLS require, external access closed by default; no paid MySQL/disk resources |
| Cloud gates | Pending | Account connection, source publishing, actual Render deployment/HTTPS/TLS verification/public URL; free Postgres expires after 30 days and has no managed backups |

MySQL volumes and private original environment backups are preserved. No old volume was mounted as PostgreSQL or deleted. The CLI transfer snapshot is private, ignored and excluded from image builds. Only isolated test/restore fixtures were removed. See [deployment](deployment.md) for restricted external release migrations and exports.


## phpMyAdmin and Render MySQL configuration — 2026-11-23

- Passed: official phpMyAdmin Apache image pulled; `docker compose up -d --wait phpmyadmin` completed with healthy MySQL/phpMyAdmin. Host binding is `127.0.0.1:8888:80`; MySQL stays private.
- Passed: real browser login with existing application DB credentials and read-only display of marketplace tables, including products/digital_keys. Passwords were not printed and no database records were changed. Credentials are entered through cookie authentication, not embedded for automatic login.
- Corrected health probe: this image disables PHP `allow_url_fopen`; the final HTTP probe uses installed curl and returns 200.
- Passed: development Compose parser, optional phpMyAdmin overlay merged with the Render rehearsal, design/OpenAPI/local documentation links and whitespace checks.
- Previous request completed at configuration level: Render Blueprint now includes `mysql:8.4` as a private Starter service with a 1 GB `/var/lib/mysql` disk, separate generated application/root passwords, and automatic app host/credential references. Official Render schema validation passed. Same-region free web services can send private requests to the database.
- Cloud provisioning is still pending Render connection and review of billable MySQL resources. Private-network migrations need a suitable release runner; the free app has no shell/pre-deploy command. No paid compute, disk or hosted phpMyAdmin was created. Earlier Railway deployment notes below are historical.

## Render target — 2026-11-22

User changed application hosting to Render; the previously selected Railway MySQL remains the database target. `render.yaml` defines a free web service, external DB secret prompts and manual deployments; it does not create paid MySQL/disks. `compose.render.yaml` rehearses the same image locally. Shared Vercel runtime configuration is reused without requiring Vercel.

- Passed: `render.yaml` validated with Draft 2020-12 against the official `https://render.com/schema/render.yaml.json` schema. Validation caught YAML boolean parsing of unquoted `off`; the final value is quoted.
- Passed: Docker `render` target build, resolved Compose configuration and healthy runtime using the isolated release MySQL volume.
- Passed: desktop localhost:9081 and mobile 127.0.0.1:9081 browser purchase checks, including typo search, offers, guest/account cart, registration, declined/successful checkout, key delivery/history and logout protection; no uncaught browser exceptions.
- Passed: on both viewports, the authenticated session/completed order survived database/application restart and encrypted keys were revealed successfully afterward. Generated accounts/orders were cleaned up.
- Passed: design/OpenAPI/local documentation links. CI now rehearses `compose.render.yaml`; remote GitHub Actions has not been run here.
- Pending: Render/Railway authenticated account access, publishing release source, remote MySQL provisioning/TLS verification, public Render deployment/URL, HTTPS cookies and cloud persistence/backup acceptance.

See [current deployment runbook](deployment.md). Earlier Vercel results below are historical local validation, not the selected hosting target or proof of any cloud deployment.

## Deployment preparation — 2026-11-22

The user selected Vercel Docker containers and Railway MySQL. These are **local production-image checks**, not evidence of a public cloud deployment.

| Check | Result | Evidence |
|---|---|---|
| Immutable images | Passed locally | FPM no-dev Composer image, compiled React/nginx image and combined `vercel` HTTP target all built; production PHP runs as www-data; local Laravel provider caches excluded |
| Production startup | Passed locally | Separate projects/volumes/secrets; three migrations and explicit demo seeds; healthy MySQL/FPM/nginx services on port 9080; combined Vercel-image/MySQL rehearsal on port 9081 |
| Production browser flows | Passed locally | Both separate-service and combined-image layouts: desktop localhost and mobile 127.0.0.1; homepage, typo search, filters, offers, registration/cart merge, decline/success, keys/history/logout; no uncaught browser errors |
| Restart durability | Passed locally | Existing browser session and successful order survived database/application restart; encrypted key successfully revealed afterward in both layouts; both viewports checked for combined image |
| Backup/restore | Passed locally | Consistent mysqldump restored into a newly created disposable database: 24 products, 892 keys, 80 offers, 3 blocks, 3 migrations; encrypted key checksum compared; recovery database removed |
| Regression | Passed | MySQL suite rerun: 31 tests / 188 assertions; focused Pint formatting; production TypeScript/Vite asset compilation; design/OpenAPI/document link validation |
| Secret initializer | Passed locally | Created an ignored independent environment file; Docker parsed its configuration; runtime requires a persistent APP_KEY and rejects debug mode |
| CI configuration | Added, remote run pending | Production job builds/rehearses combined Vercel image, migrates, seeds, checks HTTP readiness/deep link and creates backup; no claimed GitHub Actions result |
| Cloud deployment | Pending | Vercel and Railway connections absent at last check; no cloud resource IDs/public URL; remote MySQL hostname/cert/TLS verification, HTTPS cookies, region/connection limits, tier retention, cloud backup and recycle checks remain |

Release files exclude real secrets and backups from Git/build context. Development services/data were preserved. HTTP-only rehearsal explicitly disables Secure cookies for loopback; public settings require HTTPS and Secure cookies. See [deployment runbook](deployment.md).

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
