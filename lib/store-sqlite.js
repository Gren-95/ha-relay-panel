'use strict';
// Embedded storage backend (#106): SQLite via node:sqlite, no second process,
// no credentials, the data is one file. Same function surface as the MariaDB
// backend in store-mysql.js — db.js picks between them (DB_HOST set → MariaDB).
//
// Wire-compatibility notes: layout versions (updated_at) and every timestamp
// are epoch ms (MariaDB's are second-precision datetimes the app already turns
// into ms), audit detail is a JSON string, and getRelayEvents keeps its shape.
// updated_at is bumped explicitly on writes — SQLite has no ON UPDATE clause —
// which also gives it millisecond concurrency granularity, where MariaDB's
// TIMESTAMP had seconds.

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DIR = process.env.SQLITE_DIR || path.join(__dirname, '..', 'data');
const FILE = process.env.SQLITE_FILE || path.join(DIR, 'panel.db');

const EMPTY = { relays: [], areas: [], devices: [] };

let db;

async function initDb() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  db = new DatabaseSync(FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS panel (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT 'Main',
      layout     TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS panel_backup (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      layout     TEXT NOT NULL,
      relays     INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      username   TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      actor      TEXT NOT NULL DEFAULT '',
      action     TEXT NOT NULL,
      detail     TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
    CREATE TABLE IF NOT EXISTS settings (
      k          TEXT PRIMARY KEY,
      v          TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  db.prepare('INSERT OR IGNORE INTO panel (id, name, layout, updated_at) VALUES (1, ?, ?, ?)')
    .run('Main', JSON.stringify(EMPTY), Date.now());
  // A pre-SQLite install switches over with a JSON export produced by
  // scripts/export-for-sqlite.sh: dropped next to the database as import.json,
  // it is imported exactly once (a marker file keeps it from ever re-running)
  // on the first boot that sees it — no hand-run SQL.
  if (!fs.existsSync(`${FILE}.imported`)) importOnce();
  return module.exports;
}

// --- one-shot import from the MariaDB era (#106 migration path) ---
function importOnce() {
  const importFile = process.env.SQLITE_IMPORT || path.join(DIR, 'import.json');
  if (!fs.existsSync(importFile)) return;
  try {
    const dump = JSON.parse(fs.readFileSync(importFile, 'utf8'));
    const tx = (fn) => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };
    tx(() => {
      for (const p of dump.panel || []) {
        db.prepare('INSERT OR REPLACE INTO panel (id, name, layout, updated_at) VALUES (?, ?, ?, ?)')
          .run(p.id, p.name || 'Main', p.layout, Number(p.updated_at) || Date.now());
      }
      for (const b of dump.panel_backup || []) {
        db.prepare('INSERT INTO panel_backup (layout, relays, created_at) VALUES (?, ?, ?)')
          .run(b.layout, Number(b.relays) || 0, Number(b.created_at) || Date.now());
      }
      for (const s of dump.sessions || []) {
        db.prepare('INSERT OR REPLACE INTO sessions (token, username, expires_at, created_at) VALUES (?, ?, ?, ?)')
          .run(s.token, s.username, Number(s.expires_at) || 0, Number(s.created_at) || Date.now());
      }
      for (const a of dump.audit_log || []) {
        db.prepare('INSERT INTO audit_log (actor, action, detail, created_at) VALUES (?, ?, ?, ?)')
          .run(a.actor || '', a.action, a.detail == null ? null : String(a.detail), Number(a.created_at) || Date.now());
      }
      for (const [k, v] of Object.entries(dump.settings || {})) {
        db.prepare('INSERT OR REPLACE INTO settings (k, v, updated_at) VALUES (?, ?, ?)')
          .run(k, typeof v === 'string' ? v : JSON.stringify(v), Date.now());
      }
    });
    console.log(`imported ${dump.panel?.length || 0} panel row(s) from ${importFile}`);
    fs.writeFileSync(`${FILE}.imported`, new Date().toISOString());
  } catch (e) {
    // Loud but not fatal: a corrupt import must not brick a working panel —
    // the empty-board path is worse than a skip the operator can redo.
    console.error(`import from ${importFile} failed:`, e.message);
  }
}

// Readiness: the store must actually accept a write before /api/health says ok.
function ping() {
  db.prepare('UPDATE panel SET updated_at = ? WHERE id = 1').run(Date.now());
}

function normalize(l) {
  try {
    const layout = typeof l === 'string' ? JSON.parse(l) : (l || {});
    if (!Array.isArray(layout.relays)) layout.relays = [];
    if (!Array.isArray(layout.areas)) layout.areas = [];
    if (!Array.isArray(layout.devices)) layout.devices = [];
    return layout;
  } catch {
    return { ...EMPTY };
  }
}
const isEmpty = (l) => !l || (!l.relays.length && !l.devices.length && !l.areas.length);

function getLayout() {
  const row = db.prepare('SELECT layout, updated_at FROM panel WHERE id = 1').get();
  if (!row) return { ...EMPTY, updated_at: null };
  const layout = normalize(row.layout);
  layout.updated_at = row.updated_at;
  return layout;
}

function saveLayout(layout, expectedUpdatedAt) {
  const next = normalize(layout);
  const cur = getLayout();
  const curVersion = cur.updated_at;
  if (expectedUpdatedAt != null && curVersion != null && curVersion !== expectedUpdatedAt) {
    throw Object.assign(new Error('Conflict — layout was modified by another session'), { status: 409 });
  }
  delete next.updated_at;
  delete cur.updated_at;
  if (!isEmpty(cur) && JSON.stringify(cur) !== JSON.stringify(next)) {
    db.prepare('INSERT INTO panel_backup (layout, relays, created_at) VALUES (?, ?, ?)')
      .run(JSON.stringify(cur), cur.relays.length, Date.now());
    db.prepare('DELETE FROM panel_backup WHERE id NOT IN (SELECT id FROM panel_backup ORDER BY id DESC LIMIT 30)').run();
  }
  db.prepare('UPDATE panel SET layout = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(next), Date.now());
  return getLayout();
}

// Z-order only — no snapshot, no version check, touches nothing but `z`.
function saveZOrder(order) {
  const cur = getLayout();
  delete cur.updated_at;
  const apply = (list, map) => {
    if (!map || typeof map !== 'object') return;
    for (const o of list) {
      if (!Object.prototype.hasOwnProperty.call(map, o.id)) continue;
      const v = Number(map[o.id]);
      if (Number.isFinite(v)) o.z = Math.max(0, Math.round(v));
    }
  };
  apply(cur.areas, order.areas);
  apply(cur.devices, order.devices);
  apply(cur.relays, order.relays);
  db.prepare('UPDATE panel SET layout = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(cur), Date.now());
  return getLayout();
}

function listBackups() {
  return db.prepare('SELECT id, relays, created_at FROM panel_backup ORDER BY id DESC').all();
}

function restoreBackup(id) {
  const row = db.prepare('SELECT layout FROM panel_backup WHERE id = ?').get(id);
  if (!row) return null;
  return saveLayout(normalize(row.layout));
}

const RELAY_EVENTS = ['relay.bind', 'relay.unbind', 'relay.delete', 'automation.pause', 'automation.resume'];

function addAuditLog(actor, action, detail) {
  db.prepare('INSERT INTO audit_log (actor, action, detail, created_at) VALUES (?, ?, ?, ?)')
    .run(actor || '', action, JSON.stringify(detail || {}), Date.now());
  db.prepare(`DELETE FROM audit_log WHERE action NOT IN (${RELAY_EVENTS.map(() => '?').join(',')}) AND id NOT IN
    (SELECT id FROM (SELECT id FROM audit_log WHERE action NOT IN (${RELAY_EVENTS.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1000) x)`)
    .run(...RELAY_EVENTS, ...RELAY_EVENTS);
  db.prepare(`DELETE FROM audit_log WHERE action IN (${RELAY_EVENTS.map(() => '?').join(',')}) AND created_at < ?`)
    .run(...RELAY_EVENTS, Date.now() - 90 * 24 * 60 * 60 * 1000);
}

function getRelayEvents() {
  return db.prepare(
    `SELECT created_at AS t, action, detail FROM audit_log WHERE action IN (${RELAY_EVENTS.map(() => '?').join(',')}) ORDER BY created_at, id`
  ).all(...RELAY_EVENTS).map((r) => {
    let d = r.detail;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
    return { t: Number(r.t), action: r.action, rid: d && d.rid, temp: d && d.temp };
  });
}

function getActivityLog(page, perPage) {
  page = Math.max(1, page || 1);
  perPage = Math.min(100, Math.max(1, perPage || 50));
  const total = db.prepare('SELECT COUNT(*) AS total FROM audit_log').get().total;
  const entries = db.prepare(
    'SELECT id, actor, action, detail, created_at AS created_at FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(perPage, (page - 1) * perPage)
    .map((r) => ({ ...r, detail: r.detail == null ? null : (() => { try { return JSON.parse(r.detail); } catch { return r.detail; } })() }));
  return { entries, total, page, per_page: perPage };
}

function saveSession(token, username, expiresAt) {
  db.prepare('INSERT OR REPLACE INTO sessions (token, username, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(token, username, Number(expiresAt), Date.now());
}

function getSession(token) {
  const row = db.prepare('SELECT username, expires_at FROM sessions WHERE token = ? AND expires_at >= ?')
    .get(token, Date.now());
  return row ? { user: row.username, exp: row.expires_at } : null;
}

function startSessionSweep() {
  const sweep = () => { try { db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()); } catch { /* best effort */ } };
  sweep();
  return setInterval(sweep, 10 * 60 * 1000);
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function deleteSessionsForUser(username) {
  db.prepare('DELETE FROM sessions WHERE username = ?').run(username);
}

function getSetting(key) {
  const row = db.prepare('SELECT v FROM settings WHERE k = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.v); } catch { return null; }
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (k, v, updated_at) VALUES (?, ?, ?)')
    .run(key, JSON.stringify(value), Date.now());
}

module.exports = {
  driver: 'sqlite', initDb, ping, getLayout, saveLayout, saveZOrder, listBackups, restoreBackup,
  addAuditLog, getActivityLog, getRelayEvents, saveSession, getSession, deleteSession,
  deleteSessionsForUser, startSessionSweep, getSetting, setSetting,
};
