# PostgreSQL change ? partial outcome record

This is a partial prose/outcome record, not a complete session export.

## User

> change databese to Render Postgres as its free to host on render.

## Outcome

Changed the current database choice to PostgreSQL 17, including Render free managed database configuration, Docker images/volumes/credentials, migrations/schema, search/sort SQL, test guards, CI and pg_dump backups. Preserved local MySQL data via a private snapshot, verified imports and key decryption, and left old MySQL volumes intact. Replaced phpMyAdmin with PostgreSQL-capable Adminer on local port 8888. Recorded local backend, browser, production restart and restore validation separately from pending cloud deployment. Render's free Postgres 30-day expiry/no-managed-backup limits are documented. No cloud resources were provisioned.
