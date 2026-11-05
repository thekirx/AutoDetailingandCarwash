#!/usr/bin/env bash
# Explicit local-only runner. NOT executed by the Points shop implementation session.
set -euo pipefail
case "${PGHOST:-}" in 127.0.0.1|localhost) ;; *) echo 'Set PGHOST=127.0.0.1 (throwaway local Postgres only)' >&2; exit 1;; esac
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
db="points_shop_test"
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists $db" -c "create database $db"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$here/stub.sql"
# Prove sized pending claims block the whole migration before any carry-over.
psql -v ON_ERROR_STOP=1 -q -d "$db" -c "update products set size_options='[{\"label\":\"M\"}]'"
if psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/migrations/20261105070344_points_shop.sql" > /tmp/points-shop-preflight.log 2>&1; then
  echo 'FAIL: sized legacy claim did not block' >&2; exit 1
fi
grep -q 'Pending sized claims need manual resolution' /tmp/points-shop-preflight.log
psql -v ON_ERROR_STOP=1 -q -d "$db" -c "update products set size_options='[]'"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/migrations/20261105070344_points_shop.sql"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$here/scenarios.sql"
