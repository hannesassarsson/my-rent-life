#!/usr/bin/env bash
# Kör alla migrationer mot en tom Postgres-databas och sedan databastesterna.
# Kräver psql och en anslutning via PG*-variabler (PGHOST, PGUSER, ...).
# Databasen i PGDATABASE skapas om från början.
set -euo pipefail

cd "$(dirname "$0")/.."
db="${PGDATABASE:-boende_test}"
psql_db() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }

psql -X -q -d postgres -c "drop database if exists \"$db\"" -c "create database \"$db\""

psql_db -f supabase/tests/00_setup.sql
# Drizzle-migrationerna kördes i produktion efter grundschemat (10 september)
# men före de senare Supabase-migrationerna; samma ordning här.
drizzle_done=0
for f in supabase/migrations/*.sql; do
  if [ "$drizzle_done" = 0 ] && [[ "$(basename "$f")" > "20260911" ]]; then
    for d in drizzle/migrations/*.sql; do
      echo "→ $d"
      psql_db -f "$d"
    done
    drizzle_done=1
  fi
  echo "→ $f"
  psql_db -f "$f"
done

for f in supabase/tests/[1-9]*.sql; do
  echo "→ $f"
  psql_db -t -A -f "$f"
done
