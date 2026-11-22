#!/bin/sh
set -eu

test_database="${MYSQL_DATABASE}_test"
case "$test_database:$MYSQL_USER" in
    *[!a-zA-Z0-9_:]*|'') echo 'Test database/user names must use letters, digits or underscores.' >&2; exit 1 ;;
esac
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root <<SQL
CREATE DATABASE IF NOT EXISTS \`$test_database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`$test_database\`.* TO '$MYSQL_USER'@'%';
SQL
echo 'Dedicated test database is ready.'
