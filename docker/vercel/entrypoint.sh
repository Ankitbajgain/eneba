#!/bin/sh
set -eu
if [ "${RENDER:-}" = 'true' ]; then
    php -r '
        function fail($message) {
            fwrite(STDERR, "Render PostgreSQL: ".$message.PHP_EOL);
            exit(1);
        }
        $url = getenv("DB_URL");
        $source = $url ? "DB_URL" : "DB_HOST";
        $parts = $url ? parse_url($url) : [];
        if ($url && (!is_array($parts) || !in_array($parts["scheme"] ?? "", ["postgres", "postgresql", "pgsql"], true))) {
            fail("DB_URL must be a PostgreSQL URL. Copy Internal Database URL from Render Postgres Connect.");
        }
        $host = $url ? ($parts["host"] ?? "") : getenv("DB_HOST");
        if (!$host || in_array(strtolower($host), ["database", "localhost", "127.0.0.1", "[::1]", "::1"], true)) {
            fail($source." is missing a Render PostgreSQL hostname. Sync the Blueprint or set DB_URL to the Internal Database URL in the web service environment.");
        }
        if (preg_match("~[\s/@]~", $host)) {
            fail($source." has an invalid hostname. Put the full internal connection URL in DB_URL.");
        }
    '
fi
case "$PORT" in ''|*[!0-9]*) echo 'PORT must be numeric.' >&2; exit 1;; esac
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    echo 'Set PORT to an unprivileged port between 1024 and 65535.' >&2
    exit 1
fi
envsubst '${PORT} ${PHP_FPM_UPSTREAM}' < /etc/nginx/marketplace.conf.template > /tmp/marketplace-server.conf
exec production-entrypoint "$@"
