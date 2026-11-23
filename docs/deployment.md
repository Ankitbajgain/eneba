# Render deployment runbook

Current target: **free Render Docker web service + free Render Postgres 17** in Frankfurt. The user explicitly changed the database from MySQL on 2026-11-23. `render.yaml` uses Render's managed `databases` collection; no paid MySQL private service or disk is configured. Public provisioning is still pending Render account access and publishing the release source.

## Free-tier limits

Render's free Postgres expires **30 days after creation**, has **1 GB storage**, and offers no managed backups. It is suitable for this assignment demo, not durable production hosting. Arrange logical exports and a replacement/upgrade before expiry. The free web service sleeps after 15 idle minutes and can take about a minute to wake up. See [free limits](https://render.com/docs/free) and [Postgres connections](https://render.com/docs/postgresql-creating-connecting). No paid upgrade is performed automatically by this configuration.

## Application and database

The HTTP image runs compiled React assets, nginx and PHP 8.3 FPM/Laravel 13 as www-data. Supervisor manages nginx/FPM. REST and Sanctum requests share one HTTPS origin. Node is used during the build only. The final `render` Dockerfile stage reuses shared HTTP configuration under `docker/vercel/`; no Vercel account is required.

PostgreSQL stores users, sessions, carts, orders, cache/locks and encrypted demo keys. `render.yaml` injects host, port, database, user and password through `fromDatabase`, with `DB_CONNECTION=pgsql` and `DB_SSLMODE=require`. Both services must share the workspace/region. The Blueprint blocks external database access by default (`ipAllowList: []`); private app connections remain available. Keep APP_KEY and KEY_FINGERPRINT_SECRET stable and securely backed up separately from database dumps. Previews need separate databases/secrets.

## Publish and migrate

1. Connect Render and publish these files to the deployment branch of `https://github.com/Ankitbajgain/eneba`. Local working files cannot alter Render's Git build.
2. Import `render.yaml` as a Blueprint. Confirm **both** the web service and Postgres database show the free plan. Use repository-root Docker context, `docker/php/Dockerfile`, its default command, and `PORT=8080`. Leave framework build/output overrides empty.
3. Supply the prompted HTTPS APP_URL, persistent APP_KEY, KEY_FINGERPRINT_SECRET and hostname-only SANCTUM_STATEFUL_DOMAINS. Use blank SESSION_DOMAIN, Secure cookies and database session/cache stores. TRUSTED_PROXIES=* assumes Render is the only public ingress. DB credentials are injected automatically; `.env.render.example` documents the shape without real secrets.
4. Free web services do not provide shell/pre-deploy commands. For an explicit release migration from a trusted local/CI Docker runner, temporarily allow **only that runner's public IP /32** in the Postgres Networking settings. Use the database's **external hostname** in an ignored `.env.render.release`, with the same app secrets and `DB_SSLMODE=require`. Its internal hostname is not reachable from your machine. Do not put credentials in Docker build arguments, frontend variables or chat.

   ```powershell
   docker build --target render -f docker/php/Dockerfile -t eneba-render:production .
   docker run --rm --env-file .env.render.release --entrypoint production-entrypoint eneba-render:production php artisan migrate --force
   docker run --rm --env-file .env.render.release --entrypoint production-entrypoint eneba-render:production php artisan db:seed --force
   ```

   Seed explicitly on initial deployment only; repeat seeds do not replenish sold demo keys. An existing MySQL SQL dump cannot be imported directly into PostgreSQL. For real existing data use a verified transfer with original encryption secrets before switching traffic. Never migrate/seed during build or application startup.
5. Remove the temporary external allow-list rule after the release action, restoring the Blueprint's closed external access. For ongoing exports/migrations use the same restricted-access procedure or a trusted runner inside Render's private network. Do not leave public access open to all addresses.
6. Start a manual deployment after migrations succeed. Blueprint creation may attempt a deploy immediately; readiness can fail until schema initialization finishes. Redeploy afterward. Automatic deployments remain disabled to preserve migration ordering.
7. Verify HTTPS `/api/v1/health`, assets/deep links, cookies/CSRF, registration/login/logout, exact/partial/typo search, filters, seller offers, declined/successful fictional payments, order ownership and key delivery. Recycle the app and recheck the same session/order/key. Record the real public URL, source commit, provider IDs, expiry date and cloud backup/recovery evidence before marking delivery complete.

Render currently documents self-signed TLS for internal Postgres connections, so `require` enforces encrypted transport without asserting `verify-full` identity verification. External connections use Render-managed TLS certificates. Cloud behavior remains unverified until accounts are connected; local production-image results are recorded separately in [validation](validation.md).

## Local production rehearsal

Local Docker uses PostgreSQL 17 and no TLS on its private bridge (`DB_SSLMODE=disable`). Public Render settings require TLS. Existing MySQL data/volumes are not deleted or reused as PostgreSQL volumes.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/initialize-release.ps1 -AppUrl http://localhost:9080 -AllowLocalHttp -ProjectName eneba-postgres
docker compose --env-file .env.production -f compose.render.yaml build backend release
docker compose --env-file .env.production -f compose.render.yaml up -d --wait database
docker compose --env-file .env.production -f compose.render.yaml run --rm release migrate --force
docker compose --env-file .env.production -f compose.render.yaml run --rm release db:seed --force
docker compose --env-file .env.production -f compose.render.yaml up -d --wait backend
```

Open http://localhost:9080. The initializer refuses to overwrite secrets. Change RELEASE_HTTP_PORT, APP_URL and SANCTUM_STATEFUL_DOMAINS consistently if that port is occupied. Loopback HTTP disables Secure cookies only for this rehearsal. Optional Adminer: add `-f compose.adminer.yaml` after `-f compose.render.yaml` and start `adminer`; it binds to 127.0.0.1:8888 and uses PostgreSQL/database credentials. Only one local UI can own port 8888 at a time.

Browser acceptance (isolated Playwright tooling described in README):

```powershell
$env:MARKETPLACE_BROWSER_ORIGINS='http://localhost:9080'
$env:MARKETPLACE_ENV_FILE='.env.production'
$env:MARKETPLACE_COMPOSE_FILE='compose.render.yaml'
$env:MARKETPLACE_RESTART_CHECK='true'
$env:MARKETPLACE_RESTART_SERVICES='database,backend'
node scripts/check-marketplace-browser.mjs
```

Restart checks are for isolated rehearsal; cleanup removes only generated test accounts/orders.

## Backup and recovery

`docker compose --env-file .env.production -f compose.render.yaml run --rm backup` uses PostgreSQL `pg_dump` to write an atomic, restricted-permission SQL dump into ignored `.backups/`. It backs up the local Compose DB only. For Render, run a matching PostgreSQL client with its endpoint/credentials over the approved network path and TLS. The free tier has no managed backups. Store exports off-host; they contain account data and encrypted inventory.

Restore into a **new empty recovery database** using `psql --set ON_ERROR_STOP=on` and the dump file. Compare domain row counts, inventory payloads and identity sequences, then boot the matching application image with original secrets to verify decryption and authorization. Never test by importing over a live DB. Container file copy/client input avoids PowerShell SQL-encoding conversions. Preserve separate encryption-secret backups. A DB snapshot or MySQL dump is not a PostgreSQL restore plan.

Retain a compatible previous app image/commit. An application-only rollback must continue using PostgreSQL-compatible queries/schema. Switching back to a stale MySQL volume would discard new PostgreSQL orders; any reverse transfer needs a maintenance window and reconciliation. nginx /healthz is liveness; /api/v1/health includes authenticated DB readiness. Logs go to stderr; local Docker logs rotate. The separate nginx/FPM option is `compose.production.yaml`.
