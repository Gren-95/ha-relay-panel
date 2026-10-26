'use strict';
// PUT /api/layout: optimistic concurrency (409), the backup snapshot side
// effect, and malformed input — the persistence behaviours the browser-only
// e2e mocks away.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startHaStub, startApp, stopApp, call, login } = require('./harness');

const DB_PORT = Number(process.env.API_DB_PORT || 33070);
const DB_ROOT_PASSWORD = process.env.API_DB_ROOT_PASSWORD || 'test-root-password';
const DBNAME = 'rp_api_layout';

let ha, app, cookie;
const relay = (id) => ({ id, name: id, entity_id: `switch.${id}` });

before(async () => {
  ha = await startHaStub();
  app = await startApp({ dbPort: DB_PORT, dbRootPassword: DB_ROOT_PASSWORD, haUrl: ha.url, dbname: DBNAME });
  cookie = await login(app.port, 'editor');
});
after(async () => { if (app) await stopApp(app, DBNAME, DB_PORT, DB_ROOT_PASSWORD); if (ha) ha.server.close(); });

const put = (body, c = cookie) => call(app.port, 'PUT', '/api/layout', { body, cookie: c });
const backups = () => call(app.port, 'GET', '/api/layout/backups').then((r) => r.body.backups);

test('a fresh install answers with the seeded empty board', async () => {
  const r = await call(app.port, 'GET', '/api/layout');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.relays, []);
  assert.deepEqual(r.body.areas, []);
  assert.deepEqual(r.body.devices, []);
  // The baseline migration seeds row 1, so a version token already exists.
  assert.equal(typeof r.body.updated_at, 'number');
});

test('a signed-in save persists and returns a version token', async () => {
  const r = await put({ relays: [relay('r1')], areas: [], devices: [] });
  assert.equal(r.status, 200);
  assert.equal(r.body.relays.length, 1);
  assert.equal(typeof r.body.updated_at, 'number');
  const back = await call(app.port, 'GET', '/api/layout');
  assert.equal(back.body.relays[0].id, 'r1');
});

// KNOWN GRANULARITY: updated_at is a MariaDB TIMESTAMP — second precision. Two
// saves within the same second carry the same version token, so the 409 path
// only triggers across a second boundary; the wait here is not cosmetic, it is
// what makes the two versions actually differ.
test('a stale write (old version token) is a 409, and the board keeps the newer version', { timeout: 10000 }, async () => {
  const cur = await call(app.port, 'GET', '/api/layout');
  await new Promise((r) => setTimeout(r, 1100));
  await put({ relays: [relay('r1'), relay('r2')], areas: [], devices: [] });  // someone else saves
  const stale = await put({ relays: [relay('r1')], areas: [], devices: [], updated_at: cur.body.updated_at });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.ok, false);
  const after = await call(app.port, 'GET', '/api/layout');
  assert.equal(after.body.relays.length, 2, 'the stale save must not land');
});

test('a content-changing save snapshots the previous layout into backups', async () => {
  const n = (await backups()).length;
  const cur = await call(app.port, 'GET', '/api/layout');
  const r = await put({ relays: [relay('r3')], areas: [], devices: [], updated_at: cur.body.updated_at });
  assert.equal(r.status, 200);
  const list = await backups();
  assert.equal(list.length, n + 1, 'exactly one new snapshot');
  assert.equal(list[0].relays, 2, 'the snapshot holds the pre-save board (r1, r2)');
});

test('restoring a backup brings the old layout back (and snapshots first)', async () => {
  const list = await backups();
  const target = list.find((b) => b.relays === 2); // the [r1, r2] board
  const r = await call(app.port, 'POST', '/api/layout/restore', { body: { id: target.id }, cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.layout.relays.map((x) => x.id), ['r1', 'r2']);
});

test('an identical save does not grow the backup list', async () => {
  const cur = await call(app.port, 'GET', '/api/layout');
  await put({ relays: cur.body.relays, areas: cur.body.areas, devices: cur.body.devices, updated_at: cur.body.updated_at });
  const n = (await backups()).length;
  await put({ relays: cur.body.relays, areas: cur.body.areas, devices: cur.body.devices, updated_at: cur.body.updated_at });
  assert.equal((await backups()).length, n);
});

test('junk fields and non-array relays are normalized, not stored', async () => {
  const cur = await call(app.port, 'GET', '/api/layout');
  const r = await put({ relays: 'nope', areas: null, devices: [relay('d1')], evil: { x: 1 }, updated_at: cur.body.updated_at });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.relays, []);
  assert.deepEqual(r.body.areas, []);
  assert.deepEqual(r.body.devices.map((d) => d.id), ['d1']);
  const back = await call(app.port, 'GET', '/api/layout');
  assert.deepEqual(Object.keys(back.body).sort(), ['areas', 'devices', 'relays', 'updated_at'], 'no smuggled keys');
});

test('an oversized payload is refused by the body limit', async () => {
  const big = { relays: Array.from({ length: 200 }, (_, i) => ({ ...relay(`r${i}`), padding: 'x'.repeat(20000) })) };
  const r = await put(big);
  assert.ok([413, 400].includes(r.status), `oversized payload must be refused, got ${r.status}`);
});
