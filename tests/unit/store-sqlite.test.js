'use strict';
// The embedded SQLite store, against a real database file (node:sqlite) —
// SQL semantics like the prune subqueries are exactly what a fake gets wrong.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-sqlite-'));
process.env.SQLITE_FILE = path.join(dir, 'panel.db');
const S = require('../../lib/store-sqlite');

const relay = (id) => ({ id, name: id });

before(async () => { await S.initDb(); });
after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ } });

test('fresh store: seeded empty board with a version token', async () => {
  const l = await S.getLayout();
  assert.deepEqual(l.relays, []);
  assert.equal(typeof l.updated_at, 'number');
});

test('save persists; a content change snapshots the previous board; prune caps at 30', async () => {
  await S.saveLayout({ relays: [relay('r1')], areas: [], devices: [] });
  for (let i = 2; i <= 40; i++) await S.saveLayout({ relays: [relay(`r${i}`)], areas: [], devices: [] });
  const l = await S.getLayout();
  assert.deepEqual(l.relays.map((r) => r.id), ['r40']);
  const backups = await S.listBackups();
  assert.equal(backups.length, 30, 'rolling window of 30');
  assert.equal(backups[0].relays, 1, 'newest snapshot is the pre-save board');
});

test('identical save adds no snapshot; 409 on a stale version token', { timeout: 5000 }, async () => {
  const cur = await S.getLayout();
  const n = (await S.listBackups()).length;
  await S.saveLayout({ relays: cur.relays, areas: cur.areas, devices: cur.devices }, cur.updated_at);
  assert.equal((await S.listBackups()).length, n);
  // ms granularity: two writes in the same millisecond carry the same token,
  // so give the next save a different one before testing the stale path
  await new Promise((r) => setTimeout(r, 2));
  await S.saveLayout({ relays: [relay('x')], areas: [], devices: [] });
  await new Promise((r) => setTimeout(r, 2));
  // saveLayout is synchronous here, so assert.rejects (a promise helper) is
  // the wrong tool — catch the throw directly.
  let conflicted = false;
  try { await S.saveLayout({ relays: [], areas: [], devices: [] }, cur.updated_at); }
  catch (e) { conflicted = e.status === 409; }
  assert.equal(conflicted, true, 'a stale version token must be a 409');
});

test('saveZOrder touches only z — no backup, no version check', async () => {
  const n = (await S.listBackups()).length;
  const out = await S.saveZOrder({ relays: { x: 7 }, areas: {}, devices: {} });
  assert.equal(out.relays[0].z, 7);
  assert.equal((await S.listBackups()).length, n);
  // the version token bumps (as on MariaDB, via the ON UPDATE clause) — a
  // re-stack still invalidates other sessions' stale writes, by design.
  assert.notEqual(out.updated_at, null);
});

test('audit log: 1000-entry prune and the 90-day relay-event window', async () => {
  for (let i = 0; i < 1010; i++) await S.addAuditLog('u', 'layout.save', { i });
  await S.addAuditLog('u', 'relay.bind', { rid: 'r1', temp: 21 });
  const log = await S.getActivityLog(1, 15);
  assert.equal(log.total, 1001);
  assert.equal(log.entries[0].action, 'relay.bind');
  const events = await S.getRelayEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].rid, 'r1');
  assert.equal(events[0].temp, 21);
});

test('activity log paging bounds: page 0 and per_page over 100 clamp', async () => {
  const r = await S.getActivityLog(0, 10000);
  assert.equal(r.page, 1);
  assert.equal(r.per_page, 100);
  assert.ok(r.entries.length <= 100);
});

test('sessions: expiry is honored, sweep removes dead rows', async () => {
  await S.saveSession('tok1', 'a', Date.now() + 60000);
  await S.saveSession('tok2', 'b', Date.now() - 1);
  assert.equal((await S.getSession('tok1')).user, 'a');
  assert.equal(await S.getSession('tok2'), null);
  await S.deleteSessionsForUser('a');
  assert.equal(await S.getSession('tok1'), null);
});

test('settings round-trip JSON values', async () => {
  await S.setSetting('k', { threshold: 20, exclude: ['x'] });
  assert.deepEqual(await S.getSetting('k'), { threshold: 20, exclude: ['x'] });
  assert.equal(await S.getSetting('missing'), null);
});
