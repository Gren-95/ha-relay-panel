'use strict';
// Schema migrations (#107): numbered .sql files in ../migrations, applied once
// each, tracked in a schema_migrations table. No new dependencies — this runs
// before the app serves, and a failure is loud and fatal (the server's
// initDb().catch exits the process).
//
// To add a schema change: drop migrations/NNNN_description.sql in place. Plain
// ALTERs; the runner guarantees once-only. Never edit an applied file.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LOCK_NAME = 'relaypanel_schema_migrate';

// Pure part, unit-tested: given the migration files on disk (already sorted by
// name) and the names recorded as applied, return the ones still to run.
function plan(files, applied) {
  const done = new Set(applied);
  return files.filter((f) => f.endsWith('.sql') && !done.has(f));
}

// pool: the app's mysql2 pool, used for bookkeeping and the lock. opts: the
// connect config, reused for the per-file connection — a migration is several
// statements at once, and `multipleStatements` is a mysql2 *client* option set
// at connect time, not a server variable, so it cannot be SET on a pooled
// session. The app's own queries stay single-statement; this connection is
// opened and closed per boot and never re-enters the pool.
async function runMigrations(pool, opts) {
  const files = fs.readdirSync(MIGRATIONS_DIR).sort();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name        VARCHAR(190) PRIMARY KEY,
    applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const [rows] = await pool.query('SELECT name FROM schema_migrations');
  const pending = plan(files, rows.map((r) => r.name));
  if (!pending.length) return { applied: [] };

  // Two replicas of the panel booting at once must not race: the advisory lock
  // is per-server, not per-table, so a second boot waits instead of applying a
  // migration twice.
  const [[lock]] = await pool.query('SELECT GET_LOCK(?, 30) AS got', [LOCK_NAME]);
  if (!lock || !lock.got) throw new Error('could not acquire migration lock');

  try {
    const [again] = await pool.query('SELECT name FROM schema_migrations');
    for (const file of plan(files, again.map((r) => r.name))) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const conn = await mysql.createConnection({ ...opts, multipleStatements: true });
      try {
        // The `?` placeholder, when a migration carries one, is fed from here
        // — only the baseline's seed row uses it.
        const seed = sql.includes('?') ? [{ relays: [], areas: [], devices: [] }] : [];
        await conn.query(sql, seed.map((o) => JSON.stringify(o)));
        await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        console.log(`migration applied: ${file}`);
      } finally {
        await conn.end();
      }
    }
  } finally {
    await pool.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
  }
  return { applied: pending };
}

module.exports = { plan, runMigrations, MIGRATIONS_DIR };
