'use strict';
// The escape hatch (#106): DB_HOST set → external MariaDB, embedded SQLite not
// started. Booted in mysql mode against the throwaway database and exercised
// far enough to prove the backend switch and the migration runner both work.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startHaStub, startApp, stopApp, call, login } = require('./harness');

const DB_PORT = Number(process.env.API_DB_PORT || 33070);
const DB_ROOT_PASSWORD = process.env.API_DB_ROOT_PASSWORD || 'test-root-password';
const DBNAME = 'rp_api_hatch';

let ha, app;
before(async () => {
  ha = await startHaStub();
  app = await startApp({ mode: 'mysql', dbPort: DB_PORT, dbRootPassword: DB_ROOT_PASSWORD, haUrl: ha.url, dbname: DBNAME });
});
after(async () => { if (app) await stopApp(app, DBNAME, DB_PORT, DB_ROOT_PASSWORD); if (ha) ha.server.close(); });

test('health reports the mysql driver, and a save round-trips through it', async () => {
  const h = await call(app.port, 'GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.body.driver, 'mysql');
  const cookie = await login(app.port, 'operator');
  const r = await call(app.port, 'PUT', '/api/layout', {
    body: { relays: [{ id: 'r1', name: 'Lamp' }], areas: [], devices: [] },
    cookie,
  });
  assert.equal(r.status, 200);
  const back = await call(app.port, 'GET', '/api/layout');
  assert.equal(back.body.relays[0].id, 'r1');
});
