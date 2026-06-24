#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node database/migrate.js
fi

exec node server.js
