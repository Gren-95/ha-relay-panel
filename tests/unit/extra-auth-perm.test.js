'use strict';
// The authorisation gate. Never touches a database: api.query is stubbed throughout.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const perm = require('../../lib/extra-auth-perm');

const KEYS = ['EXTRA_AUTH_PERM_QUERY', 'EXTRA_AUTH_PERM_DB_HOST', 'EXTRA_AUTH_PERM_DB_USER'];
const saved = {};
const realQuery = perm.query;
let quiet;

function configure(sql = 'SELECT 1 FROM t WHERE user = ? LIMIT 1') {
  process.env.EXTRA_AUTH_PERM_QUERY = sql;
  process.env.EXTRA_AUTH_PERM_DB_HOST = 'db.invalid';
  process.env.EXTRA_AUTH_PERM_DB_USER = 'reader';
}

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  quiet = console.error; console.error = () => {};
});
afterEach(() => {
  for (const k of KEYS) { saved[k] == null ? delete process.env[k] : (process.env[k] = saved[k]); }
  perm.query = realQuery;
  console.error = quiet;
});

test('no gate configured: every authenticated account is allowed through', async () => {
  assert.equal(perm.enabled(), false);
  perm.query = () => { throw new Error('should not be reached'); };
  assert.deepEqual(await perm.allows('anyone'), { ok: true });
});

test('a row means allowed, no rows means refused', async () => {
  configure();
  perm.query = () => Promise.resolve([{ 1: 1 }]);
  assert.equal((await perm.allows('ants')).ok, true);
  perm.query = () => Promise.resolve([]);
  assert.equal((await perm.allows('ants')).ok, false);
});

test('the username is the only thing bound, and it is bound not interpolated', async () => {
  configure();
  let got = null;
  perm.query = (sql, params) => { got = { sql, params }; return Promise.resolve([{ 1: 1 }]); };
  await perm.allows("o'brien; DROP TABLE users--");
  assert.deepEqual(got.params, ["o'brien; DROP TABLE users--"]);
  assert.equal(got.sql, 'SELECT 1 FROM t WHERE user = ? LIMIT 1');   // untouched
});

test('a query without exactly one placeholder is refused, not guessed at', async () => {
  for (const sql of ['SELECT 1 FROM t', 'SELECT 1 FROM t WHERE a = ? AND b = ?']) {
    configure(sql);
    perm.query = () => Promise.resolve([{ 1: 1 }]);   // would say yes if it ran
    assert.equal((await perm.allows('ants')).ok, false);
  }
});

test('fails CLOSED when the database is unreachable', async () => {
  configure();
  perm.query = () => Promise.reject(new Error('connect ECONNREFUSED db.invalid:3306'));
  const r = await perm.allows('ants');
  assert.equal(r.ok, false);
  // and the reason handed to the browser names neither host nor schema
  assert.doesNotMatch(r.error, /db\.invalid|ECONNREFUSED|3306/);
});

test('a hanging database refuses rather than holding the sign-in open', async () => {
  configure();
  perm.query = () => new Promise(() => {});      // never settles
  const started = Date.now();
  const r = await perm.allows('ants');
  assert.equal(r.ok, false);
  assert.ok(Date.now() - started < 8000, 'should give up on its own timeout');
});
