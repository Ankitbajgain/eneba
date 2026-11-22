# Phase 3A: accounts and session authentication

Implemented 2026-11-18. This is the identity slice of phase 3; marketplace migrations, demo catalog data and order/cart policies remain separate increments.

## Behavior

| Endpoint | Result |
|---|---|
| GET /sanctum/csrf-cookie | Initializes CSRF/session cookies; 204 |
| POST /api/v1/auth/register | Validates input, stores a hashed password, signs in and rotates session; 201 |
| POST /api/v1/auth/login | Checks credentials and rotates session; 200 or generic 401 |
| GET /api/v1/auth/me | Current authenticated user only; 200 or 401 |
| POST /api/v1/auth/logout | Invalidates session and regenerates CSRF token; 204 |

The React account panel restores the existing session on load. Guests can switch between sign-in and account creation. Signed-in users see their name/email and can sign out. Requests disable forms while pending, server validation is attached to fields, and status/errors are announced accessibly. An unavailable server shows retry rather than pretending the user is a guest. Credentials exist only in the form/request memory; successful submissions reset/remove the form. No access tokens, passwords or user state are persisted in localStorage.

## Security and boundaries

- Session-cookie authentication via Sanctum; personal access tokens are disabled. User responses explicitly contain id, name and email, with no model-wide serialization.
- Auth REST routes always use Laravel's web session middleware and exclude duplicate Sanctum stateful middleware. This enforces sessions and CSRF even for requests without Origin/Referer. They still return JSON; no server-rendered views are involved.
- Laravel 13 normally accepts valid same-origin Fetch Metadata in place of a token. This app overrides that shortcut to enforce the documented XSRF token contract. The health endpoint stays stateless.
- Every mutation first fetches the CSRF bootstrap endpoint, reads URL-decoded XSRF-TOKEN and sends X-XSRF-TOKEN with same-origin credentials. Failed writes are never automatically retried: a timeout may follow a committed action. Session cookie is HttpOnly; CSRF cookie intentionally is not.
- Registration lowercases/trims email, validates uniqueness, and handles the database uniqueness race as 422. Password is at least 12 characters and at most 72 UTF-8 bytes because the chosen bcrypt has that ceiling. Multibyte over-limit and non-string inputs return validation errors. Passwords are not trimmed.
- Session ID rotates on registration/login. Logout invalidates the session, regenerates CSRF state and denies replay of the previous authenticated cookie. Login has the same generic failure for nonexistent accounts and wrong passwords.
- Persistent file-backed rate limits: registration 5/IP/minute; login 20/IP/minute plus 5/email-and-IP/minute. Keys hash normalized email/IP, rather than embedding email in cache filenames. Limits count all attempts, including successful requests. Tests use an isolated array limiter; the HTTP smoke proves production-style cross-request persistence. Multi-instance deployment needs a shared atomic limiter store.
- API validation/authentication/CSRF/throttle/not-found errors use stable safe codes. 429 preserves Retry-After. Private auth responses and API errors disable caching. Server exceptions do not send traces or SQL to the client.
- Local HTTP uses development cookies. Production still requires TLS, Secure cookies, correct stateful hosts/domain, trusted proxies and a shared/persistent deployment setup.

## Isolated tests

`scripts/prepare-test-db.sh` creates `<MYSQL_DATABASE>_test` and grants the application user access without dropping/recreating existing data. Setup invokes it explicitly. The Docker `test` service selects this database; its runner and TestCase reject names without `_test`. Migrations run normally; authentication tests use DatabaseTransactions, not destructive refreshes. Run:

```powershell
docker compose up -d --wait database
docker compose exec -T database sh /opt/marketplace/prepare-test-db.sh
docker compose run --rm test
docker compose exec backend vendor/bin/pint --test
docker compose run --rm --no-deps node run --prefix frontend build
docker compose run --rm --no-deps node run --prefix frontend test
./scripts/check-auth.ps1
```

Do not run the writing test suite using `exec backend php artisan test`; that service points at preview data and the guard will reject it. CI supplies a dedicated test database too. Test commands from historical phase 2 notes describe the earlier read-only suite.

The HTTP smoke uses the running nginx origin, a real cookie jar and production CSRF enforcement. It checks guest rejection, cookie flags, missing-token 419 even with same-origin metadata, registration, safe user fields, persistent session, wrong-password/login, logout, old-cookie replay rejection and rate limiting. A finally block deletes only its random `auth-smoke-<uuid>@example.test` account and associated authenticated sessions. Cookie values/passwords are not printed. Framework garbage collection handles anonymous session rows. Pass `-Origin http://localhost:<port>` for a custom local port. Wait for the one-minute limiter window if rerunning many times.

## Verification and remaining work

### Browser regression check added 2026-11-22

The first browser-reported registration bug was a hostname mismatch: the user opened `127.0.0.1:5173`, while cookies specified Domain=localhost. The earlier .NET HTTP checks used localhost and did not reveal this browser cookie-policy failure. Default local cookies are now host-only (`SESSION_DOMAIN` empty), and Sanctum recognizes localhost and 127.0.0.1 on every configured port. Missing XSRF cookies have a distinct client error explaining that cookies were not accepted; no mutation is replayed.

Optional real-browser check using an installed Chrome, or a Playwright Chromium installation:

```powershell
npm.cmd install --prefix .tools/browser playwright
node scripts/check-auth-browser.mjs
```

The script defaults to the installed Windows Chrome path and launches isolated headless contexts, never the user's browser profile. Set `BROWSER_EXECUTABLE` for another executable or install Playwright Chromium. `AUTH_BROWSER_ORIGINS` accepts a comma-separated list for custom frontend ports. It verifies form-driven registration, host-only cookies, persistence after reload, login and logout on both local hostnames, and removes its temporary accounts in finally blocks. This is browser-flow coverage; it does not claim a complete visual/accessibility audit.

See [validation.md](../validation.md) for exact observed counts/outcomes. Component tests and real HTTP cookie tests cover the flow; browser-rendered visual/keyboard QA and remote CI execution are still separate checks. No email verification, password reset, seller roles, cart/order policies or marketplace data are claimed implemented.

Primary references: [Sanctum](https://laravel.com/docs/13.x/sanctum), [session authentication](https://laravel.com/docs/13.x/authentication), [Laravel 13 CSRF](https://laravel.com/docs/13.x/csrf), plus the installed framework/middleware source checked during implementation.
