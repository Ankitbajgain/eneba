# Eneba-style internship marketplace

An incrementally built digital gaming marketplace inspired by Eneba. React + TypeScript + Vite + Tailwind CSS communicate with Laravel 13 / PHP 8.3 / Sanctum through REST. MySQL, nginx, PHP-FPM and the latest stable Node.js run in Docker.

**Implemented locally:** an Eneba-style storefront with 24 demo games, platform/region/price filters, sorting and pagination, global partial/typo search, backend-driven homepage campaigns/bestsellers/deals, multi-seller product pages, guest/persistent carts, registration/login, simulated checkout, fictional digital-key delivery and private order history. All catalog/campaign content and prices come from REST APIs and MySQL. No real money or genuine activation keys are involved.

## Start development

Requires Docker Desktop/Engine running Linux containers and Docker Compose. No host PHP, Composer, Node.js or MySQL is needed. On Windows PowerShell, from this directory:

```powershell
./scripts/setup-dev.ps1
./scripts/check-foundation.ps1
```

Open **http://localhost:5173** for the frontend, **http://localhost:8000/api/v1/health** for API readiness, or **http://localhost:8080** for the combined gateway. The setup script creates ignored environment files, generates random local database passwords only on first setup, builds images, installs locked dependencies, generates APP_KEY only when absent, runs versioned migrations and starts the four services. Existing environment files and database data are preserved.

For manual commands and other shells, see the [Docker runbook](docs/infrastructure.md). Root `.env` assigns `FRONTEND_PORT=5173`, `BACKEND_PORT=8000`, and `HTTP_PORT=8080`; Compose applies the matching app URL and Sanctum origins. Run `docker compose up -d --wait` after changing these values. Do not change initialized MySQL passwords merely by editing `.env`; see the runbook.

## Validate

```powershell
docker compose exec backend composer check-platform-reqs
docker compose exec backend vendor/bin/pint --test
docker compose run --rm test
docker compose run --rm --no-deps node run --prefix frontend build
docker compose run --rm --no-deps node run --prefix frontend test
```

Setup prepares a separate MySQL database named `<MYSQL_DATABASE>_test`. The test service migrates it and authentication tests use transactions; a guard rejects database names without the `_test` suffix. Do not run the writing test suite inside the preview backend service. CI checks are defined in [.github/workflows/ci.yml](.github/workflows/ci.yml); remote execution is separate from local validation.

For an existing setup:

```powershell
docker compose up -d --wait database
docker compose exec -T database sh /opt/marketplace/prepare-test-db.sh
docker compose run --rm test
./scripts/check-auth.ps1
```

For the new marketplace module on an existing checkout, also run:

```powershell
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --force
```

The setup script now runs those commands too. Demo seeds upsert catalog/content without duplicating or replenishing sold keys. Set `DEMO_PAYMENTS_ENABLED=true` in backend/.env to use the simulated payment flow; it is enabled in the development example. Production deployment is a separate phase.

Optional real-browser acceptance checks (isolated tooling; an installed Chrome or Playwright Chromium is required):

```powershell
npm.cmd install --prefix .tools/browser playwright
node scripts/check-marketplace-browser.mjs
node scripts/capture-marketplace.mjs
```

The first browser check covers desktop/mobile purchase flows on both development gateways and cleans up its test accounts/orders. The second saves screenshots to docs/screenshots. See [marketplace module notes](docs/modules/04-marketplace.md) for the behavior, security boundaries and verification limits.

The HTTP smoke check creates one random demo account, verifies real cookies/CSRF/logout/rate limiting through nginx, and deletes that account in cleanup. It never prints passwords or cookies. A custom local origin can be passed with `-Origin`.

## Documentation

- [Assignment analysis and requirement traceability](docs/assignment.md)
- [Architecture and security decisions](docs/architecture.md)
- [Database design](docs/database.md) and [SQL review artifact](docs/schema.sql)
- [REST contract](docs/api.md) and [OpenAPI](docs/openapi.yaml)
- [Framework module: scope, decisions and testing](docs/modules/02-framework.md)
- [Authentication module](docs/modules/03-authentication.md)
- [Storefront, content, catalog and purchase modules](docs/modules/04-marketplace.md)
- [Artwork sources](docs/assets.md)
- [Docker runbook](docs/infrastructure.md)
- [Implementation phases](docs/phases.md) and [validation evidence](docs/validation.md)
- [Conversation history coverage and submission requirements](docs/conversations/README.md)

Use `docker compose down` to stop services while preserving the MySQL and frontend dependency volumes. Production packaging and deployment are scheduled for the delivery phase; this configuration is for development.
