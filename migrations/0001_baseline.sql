-- Baseline schema (#107). This is the DDL that initDb() used to fire on every
-- boot, moved verbatim into the first migration. It stays IF NOT EXISTS on
-- purpose: on a fresh install it creates the tables, and on an existing install
-- that already has them it changes nothing while the runner records it as
-- applied — so both worlds converge on the same recorded version.
--
-- How to add a migration: a new file here, named NNNN_description.sql, applied
-- exactly once in filename order. Write plain ALTERs (no IF NOT EXISTS) — the
-- schema_migrations table is what makes it once-only.

-- One panel row holds the whole layout JSON (relay widgets + bindings).
CREATE TABLE IF NOT EXISTS panel (
  id         INT PRIMARY KEY,
  name       VARCHAR(190) NOT NULL DEFAULT 'Main',
  layout     JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rolling backups so a layout is never lost — every change snapshots the
-- PREVIOUS layout here before overwriting; the newest ~30 are kept.
CREATE TABLE IF NOT EXISTS panel_backup (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  layout     JSON NOT NULL,
  relays     INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Persistent login sessions (survive container restarts).
CREATE TABLE IF NOT EXISTS sessions (
  token      VARCHAR(64) PRIMARY KEY,
  username   VARCHAR(190) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expires (expires_at)
);

-- Audit trail for "who did what and when".
CREATE TABLE IF NOT EXISTS audit_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  actor      VARCHAR(190) NOT NULL DEFAULT '',
  action     VARCHAR(60)  NOT NULL,
  detail     JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
);

-- Small key -> JSON store for app settings edited in the panel (battery alerts).
CREATE TABLE IF NOT EXISTS settings (
  k          VARCHAR(64) PRIMARY KEY,
  v          JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO panel (id, name, layout) VALUES (1, 'Main', ?);
