# Docker runbook

## Services

| Service | Role | Host exposure |
|---|---|---|
| nginx | Combined gateway + dedicated API HTTP listener | 127.0.0.1:8080 (gateway), 127.0.0.1:8000 (API) |
| backend | PHP 8.3 FPM with required extensions and Composer 2 | Private FastCGI :9000; HTTP through nginx :8000 |
| frontend | React/Vite dev server in latest stable Node slim image | 127.0.0.1:5173 |
| database | Persistent PostgreSQL 17 | None |
| adminer | Database administration UI with PostgreSQL login | 127.0.0.1:8888 |
| composer | Tools profile; Composer using backend source mount | None |
| node | Tools profile; npm with shared frontend source/dependency volume | None |
| test | Tools profile; PHP suite against dedicated `<POSTGRES_DATABASE>_test` | None |

`node:slim` tracks the latest stable Node release while reducing the initial download. This satisfies the requested latest Node.js runtime; it does not pin a release. `PHP_IMAGE`, `NODE_IMAGE`, `POSTGRES_IMAGE` and `NGINX_IMAGE` can be overridden for tested builds. Production must pin resolved image digests. Dependency versions are locked by backend/composer.lock and frontend/package-lock.json.

## First setup

Adminer is available at `http://localhost:8888`. Start it with `docker compose up -d --wait adminer`; it waits for PostgreSQL readiness and connects to `database:5432`. Sign in using `POSTGRES_USER` and `POSTGRES_PASSWORD` from the root `.env` (normally user `marketplace`). Select PostgreSQL and database `marketplace` in the login form. Credentials are entered through the login form; they are not embedded for automatic login. Set `DATABASE_ADMIN_PORT` in root `.env` to change the default 8888 port. The host binding is loopback-only and PostgreSQL itself stays unpublished.

For an isolated production/Render **local Compose rehearsal**, use `docker compose --env-file .env.production -f compose.render.yaml -f compose.adminer.yaml up -d --wait adminer` and that environment file's PostgreSQL credentials. Only one local service can use port 8888 at a time. This optional overlay is not a publicly hosted Render Adminer service; Render's public HTTP endpoints use its assigned HTTPS hostname.

Windows: `./scripts/setup-dev.ps1` from the repository root. It preserves existing environment files and APP_KEY. Root `.env` contains Compose settings and local database credentials; backend `.env` contains Laravel settings and APP_KEY. Compose injects the database credentials into the backend service. Browser code receives neither file.

Root `.env` controls host ports: `FRONTEND_PORT=5173`, `BACKEND_PORT=8000`, `HTTP_PORT=8080`. The API address is `http://localhost:8000/api/v1/health`; backend `/` intentionally returns 404 because it has no HTML homepage. These host ports must be distinct and available. Apply changes with `docker compose up -d --wait`; Compose recreates the affected services, sets Laravel APP_URL to BACKEND_PORT and adds all three localhost origins to Sanctum.

Keep `SESSION_DOMAIN` empty for local development. Cookies are then host-only and work at both `localhost` and `127.0.0.1`; Sanctum includes both hostnames with the configured ports. A cookie with `Domain=localhost` is rejected on `127.0.0.1`, preventing browser registration even when the API works in an HTTP client. Sessions are separate between those hostnames, so stay on one hostname while signed in. A custom deployment domain can be configured explicitly in root `.env`.

`frontend/.env.example` documents the internal Vite listener (`DEV_SERVER_PORT=5173`) and server-side `API_PROXY_TARGET=http://nginx:8081`. Setup copies it to frontend/.env without replacing existing settings; Compose supplies those internal values explicitly. Host port changes belong in root `.env`, not the internal listener. Vite proxies `/api` and `/sanctum` to nginx's dedicated API listener while preserving the browser Host/Origin, so clients continue using relative URLs and cookie authentication. No cross-origin API base URL or permissive CORS policy is introduced. Backend `.env.example` documents the default API URL; Compose supplies actual port-derived values at runtime.

Equivalent manual commands, valid in a POSIX shell:

```sh
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Replace the local-only password examples in root .env before sharing an environment.
docker compose config --quiet
docker compose build backend frontend
docker compose run --rm --no-deps composer install --no-interaction --prefer-dist
docker compose up -d --wait database
docker compose run --rm --no-deps backend php artisan key:generate
docker compose run --rm --no-deps backend php artisan migrate --force
docker compose run --rm --no-deps backend php artisan db:seed --force
docker compose run --rm --no-deps frontend npm ci
docker compose up -d --wait
```

These manual copy/key-generation commands are for first setup only. Do not overwrite existing `.env` files or regenerate APP_KEY on later starts. Source mounts let PHP/Vite pick up local changes. FPM's entrypoint creates and assigns writable storage/cache directories to its worker. Composer intentionally uses its own entrypoint. Migrations are release/setup commands, never an automatic side effect of starting PHP-FPM.

Authentication tests now write test users. Setup also executes `docker compose exec -T database sh /opt/marketplace/prepare-test-db.sh` to prepare a separate test database. Existing installs need `docker compose up -d --wait database` once to add that script mount, then the preparation command. Run `docker compose run --rm test`; runner and TestCase reject the preview database. The test service migrates normally and transactions roll back test user writes. Avoid `_test` suffixes for the preview database name.

Authentication limits use a file cache shared by FPM workers through backend/storage. Array cache remains appropriate only for transient data and isolated tests. Multiple production instances need a shared atomic limiter store.

The frontend image installs dependencies and gives the node user ownership. Its named node_modules volume is private to Linux containers; do not install Windows npm dependencies into it. After package/lockfile changes run `docker compose run --rm --no-deps frontend npm ci` to refresh this volume, then restart frontend if necessary. The node tooling profile uses the node user and shares the same dependency volume. Laravel dependencies are in the ignored backend/vendor source directory.

## Common commands

```sh
docker compose ps
docker compose logs --tail=100 backend frontend nginx
docker compose exec backend php artisan route:list --path=api
docker compose run --rm test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend composer check-platform-reqs
docker compose run --rm --no-deps node run --prefix frontend build
docker compose run --rm --no-deps node run --prefix frontend test
docker compose exec nginx nginx -t
docker compose down
```

Windows runtime smoke check: `./scripts/check-foundation.ps1`; add `-Build` to pull/rebuild images first. It now expects the React page and application readiness endpoint to return 200, undefined catalog endpoints to return JSON 404, and sensitive paths to be denied.

Authentication HTTP check: `./scripts/check-auth.ps1`, with optional `-Origin` for a custom gateway origin. See [identity module](modules/03-authentication.md) for the flow and temporary-account cleanup. Frequent immediate reruns may be throttled by the real rate limits.

Use `./scripts/check-foundation.ps1 -DatabaseOutage` to additionally stop this project's PostgreSQL briefly, verify a safe 503 and restore it in a finally block, then verify readiness recovers. This is a deliberate development-only outage check. PowerShell scripts convert native Docker progress to text and use exit codes to distinguish failures.

Gateway liveness is `/healthz`. Application/database readiness is `/api/v1/health`, returning `{"status":"ok"}` or a safe 503. Frontend health checks Vite's listener, FPM health checks FastCGI ping, and PostgreSQL health uses `pg_isready`; the application readiness endpoint executes authenticated `SELECT 1`. A service process running alone does not establish readiness. nginx waits for both frontend and FPM health; application readiness is checked separately.

Frontend publishes port 5173 and nginx publishes ports 8080 and 8000, all on loopback only. `database`, `backend`, and `frontend` are container DNS names. FPM port 9000 speaks FastCGI and stays private. nginx listens internally on 80 for the combined gateway and 8081 for API-only HTTP; both use a shared API/FastCGI configuration. Vite can be reached directly on 5173 or through the combined gateway, including HMR/WebSockets. A future production build serves static frontend output from nginx and will not publish a Vite development port.

PostgreSQL initializes credentials only for a new volume. Editing passwords in `.env` does not rotate the existing database user's password. `docker compose down` preserves data. Database reset/deletion is a separate deliberate action, never a troubleshooting default. Avoid publishing `docker compose config` output, which interpolates secrets; `--quiet` validates without displaying them.

## Verification and release limits

Optional static validation (Python contributor tooling only):

```sh
py -m pip install --target .tools/python -r scripts/requirements-design.txt
py scripts/check-design.py
```

This validates OpenAPI, selected Compose structural constraints, SQL references and Markdown links. Runtime evidence is tracked in [validation.md](validation.md). Design SQL is a review artifact; never import it on top of Laravel migrations. Phase 2 migrates only standard identity/session tables, not the full marketplace schema.

The marketplace migration now installs the domain tables too. Setup seeds 24 demo games, seller offers, encrypted fictional keys, homepage content and fulfilled demo bestseller fixtures. Seeding is explicit in setup, never performed by FPM startup; repeat runs do not replenish sold keys. The runtime demo payment switch is DEMO_PAYMENTS_ENABLED in backend/.env. See [marketplace modules](modules/04-marketplace.md).

Docker/Windows Vite source mounts use polling, enabled by VITE_USE_POLLING in Compose, so code changes reach the live preview. The combined nginx listener allows the specific public `/node_modules/.vite/deps/` asset prefix; unrelated dot-file paths remain denied. These settings are limited to development.

Production images, rootless runtime, separate release migrations, persistent database stores and local backup/restore checks are now implemented. See [deployment](deployment.md) for the selected Render Docker hosting + private Render PostgreSQL topology, environment configuration, local rehearsal and pending cloud gates. OPcache timestamps remain enabled for development and are disabled in production. APP_KEY must be persistent and backed up.

The Sites workflow was reviewed in the foundation increment. Its static/Cloudflare Worker deployment targets cannot host this full Dockerized PHP-FPM/PostgreSQL stack. Preserve the fixed stack and select an appropriate hosting service during the delivery phase.
