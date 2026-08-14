'use strict';
// The authorisation gate. Never touches the network: api.ask is stubbed throughout.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const perm = require('../../lib/extra-auth-perm');

const KEYS = ['EXTRA_AUTH_PERM_URL', 'EXTRA_AUTH_PERM_TOKEN', 'EXTRA_AUTH_PERM_VALUE'];
const saved = {};
const realAsk = perm.ask;
let quiet;

function configure() {
  process.env.EXTRA_AUTH_PERM_URL = 'http://perm.invalid/api?action=check';
  process.env.EXTRA_AUTH_PERM_TOKEN = 's3cret';
  process.env.EXTRA_AUTH_PERM_VALUE = 'relay-panel-edit';
}
const answer = (status, text) => () => Promise.resolve({ status, text });

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  quiet = console.error; console.error = () => {};
});
afterEach(() => {
  for (const k of KEYS) { saved[k] == null ? delete process.env[k] : (process.env[k] = saved[k]); }
  perm.ask = realAsk;
  console.error = quiet;
});

test('no gate configured: every authenticated account is allowed through', async () => {
  assert.equal(perm.enabled(), false);
  perm.ask = () => { throw new Error('should not be reached'); };
  assert.deepEqual(await perm.allows('anyone'), { ok: true });
});

test('a half-configured gate is not a gate, and does not pretend to be one', () => {
  process.env.EXTRA_AUTH_PERM_URL = 'http://perm.invalid/api';
  assert.equal(perm.enabled(), false);            // token and permission still missing
  process.env.EXTRA_AUTH_PERM_TOKEN = 's3cret';
  assert.equal(perm.enabled(), false);
  process.env.EXTRA_AUTH_PERM_VALUE = 'relay-panel-edit';
  assert.equal(perm.enabled(), true);
});

test('allowed:true admits, and nothing else does', async () => {
  configure();
  perm.ask = answer(200, '{"allowed":true}');
  assert.deepEqual(await perm.allows('ants'), { ok: true });

  for (const body of ['{"allowed":false}', '{"allowed":"true"}', '{"allowed":1}', '{}', 'TRUE', '']) {
    perm.ask = answer(200, body);
    assert.equal((await perm.allows('ants')).ok, false, `body ${JSON.stringify(body)} must not admit`);
  }
});

test('the username, permission and token are what get sent', async () => {
  configure();
  let sent = null;
  perm.ask = (body) => { sent = body; return Promise.resolve({ status: 200, text: '{"allowed":true}' }); };
  await perm.allows('ants');
  assert.deepEqual(sent, { user: 'ants', permission: 'relay-panel-edit', token: 's3cret' });
});

test('fails CLOSED on a non-200, and does not leak the endpoint', async () => {
  configure();
  for (const status of [403, 404, 500, 503]) {
    perm.ask = answer(status, '{"allowed":true}');   // would admit if the status were ignored
    const r = await perm.allows('ants');
    assert.equal(r.ok, false, `HTTP ${status} must refuse`);
    assert.doesNotMatch(r.error, /perm\.invalid|https?:\/\//);
  }
});

test('fails CLOSED when the service is unreachable', async () => {
  configure();
  perm.ask = () => Promise.reject(new Error('connect ECONNREFUSED perm.invalid:80'));
  const r = await perm.allows('ants');
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.error, /perm\.invalid|ECONNREFUSED/);
});

test('a non-JSON answer is a refusal, not a crash', async () => {
  configure();
  perm.ask = answer(200, '<html>Gateway Timeout</html>');
  assert.equal((await perm.allows('ants')).ok, false);
});
