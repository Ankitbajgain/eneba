# Maintenance APIs - partial outcome record

## Later user correction

> remove all the maintenance login, just add api endpoints and make the previous request work

The implementation was changed to public maintenance POST endpoints with no token, login, enable flag, session or CSRF requirement. Removed maintenance auth/configuration and credential generation. Fixed Artisan calls, shared PostgreSQL locking and command-result handling remain. All four local HTTP requests succeeded without credentials; the updated suite passed 38 tests / 232 assertions. The operator-only description below records the earlier version and is superseded by this correction.

This is a partial user-visible prose/outcome record, not a full conversation export.

## User

> create an API endpoint to migrate the database, clear cache and optimize app, link storage. All these apis should make a artisan call

## Outcome

Implemented four POST-only maintenance endpoints with fixed Artisan calls, independent operator Bearer authentication and shared PostgreSQL advisory locking. The first migration requires no session/cache tables. Defaults are disabled; setup uses a generated private token and server-side SHA-256 digest. Customer authentication cannot invoke maintenance. Production requires HTTPS and reads runtime enable/hash settings to honor token revocation after config caching. Documented individual optimization/cache commands, safe errors, idempotent storage links and deployment limitations.

Validated 41 tests / 246 assertions and real production-image HTTP calls on an initially empty PostgreSQL database, including cache artifacts, cached routes and storage links. Local HTTPS metadata was simulated; no cloud deployment or real remote TLS result is claimed. Test services are stopped and development maintenance remains disabled by default.
