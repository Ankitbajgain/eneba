#!/bin/sh
set -eu
test_database="${POSTGRES_DB}_test"
case "$test_database:$POSTGRES_USER" in
    *[!a-zA-Z0-9_:]*|'') echo 'Use letters, digits and underscores for database/user names.' >&2; exit 1 ;;
esac
if ! psql -U "$POSTGRES_USER" -d postgres -Atc 'SELECT datname FROM pg_database' | grep -Fxq "$test_database"; then
    createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$test_database"
fi
echo 'Dedicated PostgreSQL test database is ready.'
