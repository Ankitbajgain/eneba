#!/bin/sh
set -eu
umask 077
mkdir -p /backups
partial=$(mktemp "/backups/marketplace-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.sql.partial")
file=${partial%.partial}
trap 'rm -f "$partial"' EXIT
pg_dump --no-owner --no-acl > "$partial"
mv "$partial" "$file"
printf 'Backup written: %s\n' "$file"
