#!/bin/sh
set -eu

if [ -z "${APP_KEY:-}" ]; then
    echo 'APP_KEY must be supplied as a persistent deployment secret.' >&2
    exit 1
fi
if [ "${APP_DEBUG:-false}" != 'false' ]; then
    echo 'APP_DEBUG must be false for this production image.' >&2
    exit 1
fi
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
if [ -n "${MYSQL_SSL_CA_BASE64:-}" ]; then
    umask 077
    printf '%s' "$MYSQL_SSL_CA_BASE64" | base64 -d > /tmp/marketplace-mysql-ca.pem
    export MYSQL_ATTR_SSL_CA=/tmp/marketplace-mysql-ca.pem
fi
exec docker-php-entrypoint "$@"
