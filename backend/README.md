# Marketplace API

Laravel 13 / PHP 8.3 REST API. Run through the root Docker Compose configuration.

Implemented: MySQL readiness plus `/api/v1/auth/register`, `/login`, `/logout`, and `/me`. Account endpoints always run session and strict CSRF middleware. Sanctum authenticates cookies only. Safe JSON errors, explicit user resources and persistent rate limits protect the account flow.

Setup and commands: [root README](../README.md). Module decisions and verification: [phase 2 documentation](../docs/modules/02-framework.md). No host PHP or Composer is required.

Authentication details: [identity module](../docs/modules/03-authentication.md). Run tests from the root with `docker compose run --rm test`; the suite refuses the preview database.
