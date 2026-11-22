#!/bin/sh
set -eu
case "${DB_DATABASE:-}" in
    *_test) ;;
    *) echo 'Tests require a dedicated database ending in _test.' >&2; exit 1 ;;
esac
php artisan migrate --force --no-interaction
exec php artisan test "$@"
