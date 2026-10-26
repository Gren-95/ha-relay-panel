'use strict';
// Assembles the import.json consumed by lib/store-sqlite.js from the TSV files
// scripts/migrate-to-sqlite.sh produced (CONCAT_WS(0x01, ...) rows, blobs hex
// encoded). Usage: node scripts/build-import-json.js <tmpdir>
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const hex = (s) => (s == null || s === 'NULL' ? null : Buffer.from(s, 'hex').toString('utf8'));
// 0x01-separated: the only risk is a 0x01 byte inside a value — none of these
// columns can carry one (they are ids, JSON, usernames).
const rows = (file, cols) =>
  fs.readFileSync(path.join(dir, file), 'utf8').split('\n')
    .filter((l) => l.length)
    .map((l) => {
      const parts = l.split('\x01');
      return Object.fromEntries(cols.map((c, i) => [c, parts[i] === 'NULL' ? null : parts[i]]));
    });

const out = {
  panel: rows('panel.tsv', ['id', 'name', 'layout', 'updated_at']).map((r) => ({
    id: Number(r.id), name: r.name, layout: hex(r.layout), updated_at: Number(r.updated_at),
  })),
  panel_backup: rows('panel_backup.tsv', ['id', 'layout', 'relays', 'created_at']).map((r) => ({
    id: Number(r.id), layout: hex(r.layout), relays: Number(r.relays), created_at: Number(r.created_at),
  })),
  sessions: rows('sessions.tsv', ['token', 'username', 'expires_at', 'created_at']).map((r) => ({
    token: r.token, username: r.username, expires_at: Number(r.expires_at), created_at: Number(r.created_at),
  })),
  audit_log: rows('audit_log.tsv', ['id', 'actor', 'action', 'detail', 'created_at']).map((r) => ({
    id: Number(r.id), actor: r.actor, action: r.action, detail: hex(r.detail), created_at: Number(r.created_at),
  })),
  settings: Object.fromEntries(rows('settings.tsv', ['k', 'v']).map((r) => [r.k, hex(r.v)])),
};
process.stdout.write(JSON.stringify(out));
