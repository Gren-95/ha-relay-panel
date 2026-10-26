'use strict';
// Login, session lifecycle and the login rate limiter, against the real
// server with the HA login-flow stubbed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { HA_PASSWORD, startHaStub, startApp, stopApp, call, login } = require('./harness');

const DB_PORT = Number(process.env.API_DB_PORT || 33070);
const DB_ROOT_PASSWORD = process.env.API_DB_ROOT_PASSWORD || 'test-root-password';
const DBNAME = 'rp_api_auth';

let ha, app;
before(async () => {
  ha = await startHaStub();
  app = await startApp({ dbPort: DB_PORT, dbRootPassword: DB_ROOT_PASSWORD, haUrl: ha.url, dbname: DBNAME });
});
after(async () => { if (app) await stopApp(app, DBNAME, DB_PORT, DB_ROOT_PASSWORD); if (ha) ha.server.close(); });

test('valid HA credentials sign in and set the session cookie', async () => {
  const r = await call(app.port, 'POST', '/api/login', { body: { username: 'risto', password: HA_PASSWORD } });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.match(r.cookie || '', /^rp_session=[0-9a-f]{48}/);
  assert.match(r.setCookieHeader || '', /HttpOnly/);
});

test('the session round-trips and /api/session answers authed', async () => {
  const cookie = await login(app.port, 'alice');
  const r = await call(app.port, 'GET', '/api/session', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, authed: true, user: 'alice' });
});

test('wrong password is a 401, not a crash and not a session', async () => {
  const r = await call(app.port, 'POST', '/api/login', { body: { username: 'alice', password: 'wrong' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.ok, false);
  assert.equal(r.cookie, null);
});

test('missing credentials are a 400', async () => {
  const r = await call(app.port, 'POST', '/api/login', { body: { username: 'alice' } });
  assert.equal(r.status, 400);
});

test('logout invalidates the session — the old cookie stops working', async () => {
  const cookie = await login(app.port, 'bob');
  const out = await call(app.port, 'POST', '/api/logout', { cookie });
  assert.equal(out.status, 200);
  const r = await call(app.port, 'GET', '/api/session', { cookie });
  assert.deepEqual(r.body, { ok: true, authed: false, user: null });
});

test('signing in again rotates the session — the old cookie is dead', async () => {
  const c1 = await login(app.port, 'carol');
  const c2 = await login(app.port, 'carol');
  assert.notEqual(c1, c2);
  const r = await call(app.port, 'GET', '/api/session', { cookie: c1 });
  assert.deepEqual(r.body, { ok: true, authed: false, user: null });
});

// Its own app so the per-IP limiter state cannot leak into the tests above.
test('the login rate limiter: 5 bad attempts buy a 60s lockout (429)', { timeout: 30000 }, async () => {
  const app2 = await startApp({ dbPort: DB_PORT, dbRootPassword: DB_ROOT_PASSWORD, haUrl: ha.url, dbname: `${DBNAME}_limiter` });
  try {
    const bad = { username: 'mallory', password: 'nope' };
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await call(app2.port, 'POST', '/api/login', { body: bad });
      statuses.push(r.status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429], 'the 6th attempt must hit the lockout');
    // Even the CORRECT password is refused while locked out.
    const locked = await call(app2.port, 'POST', '/api/login', { body: { username: 'mallory', password: HA_PASSWORD } });
    assert.equal(locked.status, 429);
  } finally {
    await stopApp(app2, `${DBNAME}_limiter`, DB_PORT, DB_ROOT_PASSWORD);
  }
});
