# Maintenance APIs

These four public POST endpoints invoke fixed Artisan commands. They require no login, Bearer token, enable flag, session cookie or CSRF token. Anyone who can reach these URLs can execute the listed operations.

| Endpoint | Artisan calls |
|---|---|
| `/api/v1/maintenance/migrate` | `migrate --force --no-interaction` |
| `/api/v1/maintenance/cache-clear` | `cache:clear`, `config:clear`, `route:clear`, `view:clear`, `event:clear`, `clear-compiled` |
| `/api/v1/maintenance/optimize` | `config:cache`, `event:cache`, `route:cache`, `view:cache` |
| `/api/v1/maintenance/storage-link` | `storage:link` |

Every command runs through `Artisan::call()`, with interactivity disabled. Clear/optimize invoke Laravel's underlying commands individually so a failed child command returns an error. No arbitrary command or command arguments are accepted. The migration endpoint works before user/session/cache tables exist; the PostgreSQL database itself must already exist and be reachable. Run migrations before the other operations on a new database.

## Usage

From PowerShell, replace the final path for each operation:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/maintenance/migrate
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/maintenance/cache-clear
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/maintenance/optimize
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/maintenance/storage-link
```

For Render use the deployed HTTPS origin instead of localhost. Deploy the latest source/image; an existing container running an older image will retain the old authentication behavior. No maintenance environment variables are needed. Remove obsolete MAINTENANCE_API_ENABLED/MAINTENANCE_API_TOKEN_HASH variables from hosting settings if present; this implementation ignores them.

POST with an empty body. GET returns 405; unknown actions return 404; body/query parameters return 422. Success is JSON such as `{"data":{"action":"migrate","status":"completed","commands":["migrate"],"exit_code":0}}` with private/no-store caching. Raw Artisan output, paths, SQL errors and credentials are omitted. Command failures return 500, database unavailability 503, and another active maintenance operation 409.

## Runtime behavior

A shared PostgreSQL advisory lock serializes maintenance across instances. It needs no session/cache tables, survives cache clearing, and releases on completion/error or connection close. Commands stop at the first failure; a sequence may have partially completed. HTTP timeouts do not prove a migration stopped. Migrations apply pending versions only, with no seed/reset/rollback action exposed.

Config, route, event and view caches are local to the app instance. Cache clearing also removes shared application cache data and may reset its rate-limit counters. Multiple replicas require coordinated deployment for consistent local caches; the current free Render web target has one instance. `/api/v1/health` checks DB connectivity, not whether migrations completed.

`storage:link` is idempotent for the standard Laravel link. The rootless production image pre-creates that link and writable target; the endpoint still makes the Artisan call and verifies the resulting link. It will not overwrite a conflicting regular file/directory. Storage links do not add durable uploads to Render's ephemeral filesystem or share files with a separate nginx container. The app currently has no upload feature.

## Deployment

For an empty Render Postgres database, deploy the current web image, POST `/api/v1/maintenance/migrate`, and verify success before using the marketplace. No public database access or paid migration hook is needed for this endpoint. Initial demo catalog seeding still uses the documented trusted release runner; this API exposes no seeding action. Customer checkout/history authentication is unchanged.
