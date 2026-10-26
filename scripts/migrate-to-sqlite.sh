#!/usr/bin/env bash
# One-command migration from the MariaDB era to embedded storage (#106).
#
#   scripts/migrate-to-sqlite.sh
#
# Run AFTER upgrading to the single container (the new compose file keeps the
# old relay-panel-db container running as an orphan, so its data is still
# readable). The script dumps every table from it, drops the result into the
# app container as /app/data/import.json and restarts the app — the first boot
# that sees the file imports it once and marks it done. Nothing else is
# touched; the old volume keeps its data until you delete it.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="relay-panel-db"     # the old MariaDB container
DST="relay-panel-web"    # the new single container

die() { echo "error: $*" >&2; exit 1; }
docker ps --format '{{.Names}}' | grep -qx "$SRC" || die "$SRC is not running — nothing to export"
docker ps --format '{{.Names}}' | grep -qx "$DST" || die "$DST is not running — upgrade first (docker compose up -d --build)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Tab-separated with hex-encoded blobs: immune to quotes, newlines and JSON
# characters inside the stored payloads. Timestamps leave as epoch ms — the
# unit the embedded store keeps.
q() { # q "SELECT ..." > file
  docker exec "$SRC" sh -c 'exec mariadb --batch --skip-column-names -uroot -p"$MARIADB_ROOT_PASSWORD" relaypanel -e "$1"' sh "$1"
}
q "SELECT CONCAT_WS(0x01, id, name, HEX(layout), IFNULL(UNIX_TIMESTAMP(updated_at)*1000,0)) FROM panel" > "$TMP/panel.tsv"
q "SELECT CONCAT_WS(0x01, id, HEX(layout), relays, IFNULL(UNIX_TIMESTAMP(created_at)*1000,0)) FROM panel_backup" > "$TMP/panel_backup.tsv"
q "SELECT CONCAT_WS(0x01, token, username, IFNULL(UNIX_TIMESTAMP(expires_at)*1000,0), IFNULL(UNIX_TIMESTAMP(created_at)*1000,0)) FROM sessions" > "$TMP/sessions.tsv"
q "SELECT CONCAT_WS(0x01, id, actor, action, IFNULL(HEX(detail),'NULL'), IFNULL(UNIX_TIMESTAMP(created_at)*1000,0)) FROM audit_log" > "$TMP/audit_log.tsv"
q "SELECT CONCAT_WS(0x01, k, HEX(v)) FROM settings" > "$TMP/settings.tsv"

node scripts/build-import-json.js "$TMP" > "$TMP/import.json"

docker cp "$TMP/import.json" "$DST:/app/data/import.json"
docker restart "$DST" >/dev/null
sleep 3
docker logs "$DST" --since 1m 2>&1 | grep -i "imported" \
  && echo "done — verify the board at :$(grep HTTP_PORT .env 2>/dev/null | cut -d= -f2 || echo 8090), then remove the old stack: docker rm -f $SRC && docker volume rm relay-panel-data" \
  || die "import did not complete — check docker logs $DST"
