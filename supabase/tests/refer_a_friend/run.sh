#!/usr/bin/env bash
# Runs the refer-a-friend migration against a throwaway LOCAL Postgres with stub
# tables, then the scenarios. Never point this at the live project.
#   PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres bash supabase/tests/refer_a_friend/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
db="refer_a_friend_test"
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists $db" -c "create database $db"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$here/stub.sql"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$root/supabase/migrations/20261018120000_refer_a_friend.sql"
psql -v ON_ERROR_STOP=1 -q -d "$db" -f "$here/scenarios.sql"
