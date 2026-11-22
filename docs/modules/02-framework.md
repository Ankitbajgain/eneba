# Phase 2: framework integration

## Scope

The first implemented slice connects a React page to Laravel over REST and verifies MySQL readiness. It establishes the development and test workflow before adding accounts or marketplace data.

- React/TypeScript from create-vite's react-ts template, with Tailwind's Vite integration.
- Official Laravel 13 skeleton, constrained to framework ^13.0 and PHP ^8.3; Composer platform 8.3.0 prevents resolving dependencies that require a later PHP minor.
- Sanctum installed and stateful SPA middleware enabled. Registration/login/logout/me routes are phase 3, so no sign-in buttons are presented yet.
- `GET /api/v1/health` executes `SELECT 1` on the configured MySQL connection. Success returns 200; query/connection failure returns a safe 503 without database messages. Both responses disable caching. This public route excludes Sanctum's stateful middleware so a database-backed browser session cannot fail before the readiness handler runs.
- Typed same-origin REST client with JSON Accept header, session credentials, an eight-second timeout and caller cancellation. Readiness payload is validated at runtime.
- Responsive development preview with loading, ready, unavailable and retry states, live status announcements, visible keyboard focus and an explicit demo disclaimer. No hardcoded catalog/banner data or unimplemented shopping controls.
- Dockerized Vite, PHP-FPM, MySQL and nginx; dependency lockfiles, repeatable setup/smoke scripts and a CI workflow.

## Implementation decisions

The Laravel skeleton was downloaded from the official 13.x GitHub branch while Docker dependencies built. Its starter instructions for installing host PHP/agent tooling were omitted: this project follows the user's fixed PHP 8.3/Docker workflow. Laravel's bundled JS/CSS/Vite build and welcome view were removed because React is a separate REST client. Unused cache/queue migrations were removed; the app uses array cache and synchronous execution at this stage. The standard user, password-reset-token and session migration is retained and aligned with the designed user-name length and UTC datetime precision.

The upstream database config referenced `Pdo\Mysql`, introduced after PHP 8.3. The app uses `PDO::MYSQL_ATTR_SSL_CA` instead and sets a three-second connection timeout. This is an application config compatibility adjustment, not a framework downgrade. Actual installation/platform checks are required alongside the declared Composer constraint.

The frontend readiness display deliberately uses product-neutral copy instead of showing internal database, runtime or secret details. Failed requests display a fixed safe message. Unmount and retry cleanup cancel stale requests. Domain server-state management and routing will be added when catalog/auth require them; no unused global store is introduced here.

MySQL is persistent, private to the Docker network, and not replaced by SQLite for tests. The current readiness integration test reads only. Future domain tests must use a separate MySQL test database before using destructive migration/refresh traits.

## Acceptance checks

1. Install dependencies from committed lockfiles on PHP 8.3 and latest stable Node in Docker.
2. Build/typecheck React and run its four connection-behavior tests.
3. Migrate identity/session tables on MySQL; rerun migrations without changes.
4. Run PHP platform requirements and formatting checks; test real database readiness and safe failure handling.
5. Start four healthy services; verify nginx config, React page, API JSON readiness, JSON 404 for undefined catalog route and sensitive-path restrictions.
6. Temporarily stop this project's database, verify API readiness returns safe 503, and restart the database in a finally block; verify recovery to 200.

Actual results and resolved versions belong in [validation.md](../validation.md). CI is defined but remote GitHub execution is not implied by local passing checks. Browser-rendered screenshot and keyboard QA remain distinct from component tests.

## Next increment

Phase 3 adds registration, login, logout, current user, CSRF/session lifecycle, shared error responses, authentication UI and ownership policies. Domain migrations/demo seeders can then be introduced in a separate validated data slice before catalog development. No payment or digital-key feature is implemented here.
