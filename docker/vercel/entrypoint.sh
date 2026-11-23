#!/bin/sh
set -eu
case "$PORT" in ''|*[!0-9]*) echo 'PORT must be numeric.' >&2; exit 1;; esac
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    echo 'Set PORT to an unprivileged port between 1024 and 65535.' >&2
    exit 1
fi
envsubst '${PORT} ${PHP_FPM_UPSTREAM}' < /etc/nginx/marketplace.conf.template > /tmp/marketplace-server.conf
exec production-entrypoint "$@"
