#!/usr/bin/env bash
# Applies every migration to an empty Postgres and runs the SQL security suite.
# Uses $TEST_DATABASE_URL when set (CI service container); otherwise starts a
# throwaway local cluster.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tests="$root/supabase/tests"
cleanup() { :; }

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  pg_bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  data_dir="$(mktemp -d)"
  port=54329
  run_pg() { if [[ "$(id -u)" == "0" ]]; then su postgres -c "$*"; else bash -c "$*"; fi; }
  [[ "$(id -u)" == "0" ]] && chown postgres "$data_dir"
  run_pg "$pg_bin/initdb -D $data_dir -U postgres --auth=trust >/dev/null"
  run_pg "$pg_bin/pg_ctl -D $data_dir -o '-p $port -k /tmp' -l $data_dir/log -w start >/dev/null"
  cleanup() { run_pg "$pg_bin/pg_ctl -D $data_dir -m immediate stop >/dev/null" || true; rm -rf "$data_dir"; }
  TEST_DATABASE_URL="postgresql://postgres@localhost:$port/postgres"
fi
trap cleanup EXIT

psql_run() { psql "$TEST_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_run -f "$tests/00_bootstrap.sql"
for migration in "$root"/supabase/migrations/*.sql; do
  psql_run -f "$migration"
done
psql_run -f "$tests/01_helpers.sql"

for test in "$tests"/[1-9]*.sql; do
  echo "── $(basename "$test")"
  if grep -q '^-- session:' "$test"; then
    # One connection per block, each wrapped in its own rolled-back transaction.
    blocks_dir="$(mktemp -d)"
    awk -v dir="$blocks_dir" '/^-- session:/{n++} n>0 {print > (dir "/block-" n ".sql")}' "$test"
    for block in $(ls "$blocks_dir" | sort -V); do
      { echo 'begin;'; cat "$blocks_dir/$block"; echo 'rollback;'; } | psql_run 2>&1 | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p'
      [[ ${PIPESTATUS[1]} -eq 0 ]] || exit 1
    done
    rm -rf "$blocks_dir"
    continue
  elif grep -q 'outside a wrapping transaction' "$test"; then
    psql_run -f "$test" 2>&1 | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p'
  else
    { echo 'begin;'; cat "$test"; echo 'rollback;'; } | psql_run 2>&1 | sed -n -e 's/^.*NOTICE:  //p' -e '/ERROR/p'
  fi
  [[ ${PIPESTATUS[0]} -eq 0 ]] || exit 1
done

echo "database suite passed"
