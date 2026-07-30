const mysql = require('mysql2/promise');

let pool;

async function initDb() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'relay-panel-db',
    user: process.env.DB_USER || 'relay',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'relaypanel',
    waitForConnections: true,
    connectionLimit: 5,
  });

  // One panel row holds the whole layout JSON (relay widgets + bindings).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS panel (
      id         INT PRIMARY KEY,
      name       VARCHAR(190) NOT NULL DEFAULT 'Main',
      layout     JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  // Rolling backups so a layout is never lost — every change snapshots the
  // PREVIOUS layout here before overwriting; the newest ~30 are kept.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS panel_backup (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      layout     JSON NOT NULL,
      relays     INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Persistent login sessions (survive container restarts).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token      VARCHAR(64) PRIMARY KEY,
      username   VARCHAR(190) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_expires (expires_at)
    )
  `);
  // Audit trail for "who did what and when".
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      actor      VARCHAR(190) NOT NULL DEFAULT '',
      action     VARCHAR(60)  NOT NULL,
      detail     JSON,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at)
    )
  `);
  await pool.query(
    `INSERT IGNORE INTO panel (id, name, layout) VALUES (1, 'Main', ?)`,
    [JSON.stringify({ relays: [], areas: [], devices: [] })]
  );
  return pool;
}

function normalize(l) {
  try {
    const layout = typeof l === 'string' ? JSON.parse(l) : (l || {});
    if (!Array.isArray(layout.relays)) layout.relays = [];
    if (!Array.isArray(layout.areas)) layout.areas = [];
    if (!Array.isArray(layout.devices)) layout.devices = [];
    return layout;
  } catch {
    return { relays: [], areas: [], devices: [] };
  }
}
const isEmpty = (l) => !l || (!l.relays.length && !l.devices.length && !l.areas.length);

async function getLayout() {
  const [rows] = await pool.query('SELECT layout, updated_at FROM panel WHERE id = 1');
  if (!rows.length) return { relays: [], areas: [], devices: [], updated_at: null };
  const layout = normalize(rows[0].layout);
  layout.updated_at = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : null;
  return layout;
}

async function saveLayout(layout, expectedUpdatedAt) {
  const next = normalize(layout);
  const cur = await getLayout();
  const curVersion = cur.updated_at;   // snapshot before we strip it
  // Optimistic concurrency: if caller expects a specific version, reject stale writes
  if (expectedUpdatedAt != null && curVersion != null && curVersion !== expectedUpdatedAt) {
    throw Object.assign(new Error('Conflict — layout was modified by another session'), { status: 409 });
  }
  // metadata — belongs alongside the layout, not inside the stored JSON
  delete next.updated_at;
  delete cur.updated_at;
  // back up the current layout before overwriting (only when it has content and
  // actually differs), so any change — including a wipe — is recoverable.
  if (!isEmpty(cur) && JSON.stringify(cur) !== JSON.stringify(next)) {
    await pool.query('INSERT INTO panel_backup (layout, relays) VALUES (?, ?)', [JSON.stringify(cur), cur.relays.length]);
    await pool.query('DELETE FROM panel_backup WHERE id NOT IN (SELECT id FROM (SELECT id FROM panel_backup ORDER BY id DESC LIMIT 30) x)');
  }
  await pool.query('UPDATE panel SET layout = ? WHERE id = 1', [JSON.stringify(next)]);
  return getLayout();
}

async function listBackups() {
  const [rows] = await pool.query('SELECT id, relays, created_at FROM panel_backup ORDER BY id DESC');
  return rows.map((r) => ({ id: r.id, relays: r.relays, created_at: r.created_at }));
}

async function restoreBackup(id) {
  const [rows] = await pool.query('SELECT layout FROM panel_backup WHERE id = ?', [id]);
  if (!rows.length) return null;
  return saveLayout(normalize(rows[0].layout)); // saving also snapshots current first
}

async function addAuditLog(actor, action, detail) {
  await pool.query(
    'INSERT INTO audit_log (actor, action, detail) VALUES (?, ?, ?)',
    [actor || '', action, JSON.stringify(detail || {})]
  );
  await pool.query(
    `DELETE FROM audit_log WHERE id NOT IN
      (SELECT id FROM (SELECT id FROM audit_log ORDER BY id DESC LIMIT 1000) x)`
  );
}

async function getActivityLog(page, perPage) {
  page = Math.max(1, page || 1);
  perPage = Math.min(100, Math.max(1, perPage || 50));
  const offset = (page - 1) * perPage;
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM audit_log');
  const [rows] = await pool.query('SELECT id, actor, action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?', [perPage, offset]);
  const total = Number((countRows[0] && countRows[0].total) || 0);
  return { entries: rows, total, page, per_page: perPage };
}

async function saveSession(token, username, expiresAt) {
  await pool.query(
    'INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username), expires_at = VALUES(expires_at)',
    [token, username, new Date(expiresAt)]
  );
}

async function getSession(token) {
  const [rows] = await pool.query('SELECT username, expires_at FROM sessions WHERE token = ? AND expires_at >= NOW()', [token]);
  if (!rows.length) return null;
  return { user: rows[0].username, exp: new Date(rows[0].expires_at).getTime() };
}

// Periodic sweep — run once every 10 min instead of on every auth read (#49)
function startSessionSweep() {
  const sweep = () => pool.query('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {});
  sweep(); // run once at startup
  setInterval(sweep, 10 * 60 * 1000);
}

async function deleteSession(token) {
  await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
}

async function deleteSessionsForUser(username) {
  await pool.query('DELETE FROM sessions WHERE username = ?', [username]);
}

module.exports = { initDb, getLayout, saveLayout, listBackups, restoreBackup, addAuditLog, getActivityLog, saveSession, getSession, deleteSession, deleteSessionsForUser, startSessionSweep };
