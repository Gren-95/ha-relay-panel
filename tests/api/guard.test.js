'use strict';
// The authorization net (#79): every mutating endpoint must refuse an
// unauthenticated request with 401 and a JSON ok:false — never a silent
// success. Viewing stays open, so read endpoints are asserted to still answer
// (200/other) without a session.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startHaStub, startApp, stopApp, call } = require('./harness');

const DB_PORT = Number(process.env.API_DB_PORT || 33070);
const DB_ROOT_PASSWORD = process.env.API_DB_ROOT_PASSWORD || 'test-root-password';
const DBNAME = 'rp_api_guard';

let ha, app;
before(async () => {
  ha = await startHaStub();
  app = await startApp({ dbPort: DB_PORT, dbRootPassword: DB_ROOT_PASSWORD, haUrl: ha.url, dbname: DBNAME });
});
after(async () => { await stopApp(app, DBNAME, DB_PORT, DB_ROOT_PASSWORD); ha.server.close(); });

// Mutating endpoints, all behind requireAuth. Each entry is [method, path, body]
// — the body only has to be shaped well enough to get past express.json().
const MUTATING = [
  ['PUT', '/api/layout', { relays: [], areas: [], devices: [] }],
  ['PUT', '/api/layout/zorder', { relays: {} }],
  ['POST', '/api/layout/restore', { id: 1 }],
  ['POST', '/api/relays/r1/bind', { entity_id: 'switch.x', name: 'X' }],
  ['POST', '/api/relays/r1/unbind', {}],
  ['POST', '/api/rename', { rid: 'r1', name: 'X' }],
  ['POST', '/api/switch', { rid: 'r1', on: true }],
  ['POST', '/api/reapply', {}],
  ['POST', '/api/relays/r1/automation', {}],
  ['GET', '/api/battery-alerts', undefined],
  ['PUT', '/api/battery-alerts', { threshold: 20, exclude: [] }],
  ['POST', '/api/battery-alerts/test', {}],
  ['POST', '/api/audit', { action: 'switch.toggle', detail: {} }],
];

test('every mutating endpoint refuses an unauthenticated request with 401', async () => {
  for (const [method, p, body] of MUTATING) {
    const r = await call(app.port, method, p, { body });
    assert.equal(r.status, 401, `${method} ${p} must be 401 unauthenticated`);
    assert.equal(r.body && r.body.ok, false, `${method} ${p} must not report success`);
  }
});

test('a forged or stale session cookie is still unauthenticated', async () => {
  const r = await call(app.port, 'PUT', '/api/layout', {
    cookie: 'rp_session=0000000000000000000000000000000000000000000000000000000000000000',
    body: { relays: [], areas: [], devices: [] },
  });
  assert.equal(r.status, 401);
  assert.equal(r.body.ok, false);
});

test('viewing stays open without a session', async () => {
  // DB-backed reads only — the HA-proxied reads (/api/automations etc.) need a
  // live Home Assistant to answer 200 and belong to the e2e tier.
  for (const p of ['/api/layout', '/api/layout/backups', '/api/activity-log?page=1&per_page=5']) {
    const r = await call(app.port, 'GET', p);
    assert.equal(r.status, 200, `GET ${p} is a read endpoint and must stay open`);
  }
});
