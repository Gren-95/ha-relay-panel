'use strict';
// Storage facade (#106): DB_HOST set → external MariaDB (the escape hatch for
// people already running one; lib/store-mysql.js). Otherwise the embedded
// SQLite store (lib/store-sqlite.js) — the default, one container, no
// credentials, the data is one file under data/. Both backends expose the
// same function surface; nothing below this file knows which is active.
const backend = process.env.DB_HOST ? require('./lib/store-mysql') : require('./lib/store-sqlite');

// Async-ness differs between backends (mysql2 is async, SQLite sync), so every
// call is wrapped: the API layer can keep awaiting uniformly.
const wrap = (fn) => (...args) => Promise.resolve(fn(...args));

module.exports = {
  driver: backend.driver,
  initDb: backend.initDb,
  ping: backend.ping,
  getSetting: wrap(backend.getSetting),
  setSetting: wrap(backend.setSetting),
  getLayout: wrap(backend.getLayout),
  saveLayout: wrap(backend.saveLayout),
  saveZOrder: wrap(backend.saveZOrder),
  listBackups: wrap(backend.listBackups),
  restoreBackup: wrap(backend.restoreBackup),
  addAuditLog: wrap(backend.addAuditLog),
  getActivityLog: wrap(backend.getActivityLog),
  getRelayEvents: wrap(backend.getRelayEvents),
  saveSession: wrap(backend.saveSession),
  getSession: wrap(backend.getSession),
  deleteSession: wrap(backend.deleteSession),
  deleteSessionsForUser: wrap(backend.deleteSessionsForUser),
  startSessionSweep: backend.startSessionSweep,
};
