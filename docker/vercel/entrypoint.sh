#!/bin/sh
set -eu
if [ "${RENDER:-}" = 'true' ]; then
    php -r '
        $url = getenv("DB_URL");
        $host = $url ? parse_url($url, PHP_URL_HOST) : getenv("DB_HOST");
        if (!$host || in_array(strtolower($host), ["database", "localhost", "127.0.0.1", "[::1]"], true)) {
            fwrite(STDERR, "Render requires the PostgreSQL internal hostname in DB_HOST or the internal database URL in DB_URL. Check the web service environment settings.\n");
            exit(1);
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
