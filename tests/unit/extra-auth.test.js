'use strict';
// The optional second sign-in provider. Everything here is offline: the one case that
// would reach the network is asserted NOT to.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const extra = require('../../lib/extra-auth');

const saved = { url: process.env.EXTRA_AUTH_URL, label: process.env.EXTRA_AUTH_LABEL };
beforeEach(() => { delete process.env.EXTRA_AUTH_URL; delete process.env.EXTRA_AUTH_LABEL; });
afterEach(() => {
  saved.url == null ? delete process.env.EXTRA_AUTH_URL : (process.env.EXTRA_AUTH_URL = saved.url);
  saved.label == null ? delete process.env.EXTRA_AUTH_LABEL : (process.env.EXTRA_AUTH_LABEL = saved.label);
});

test('unset EXTRA_AUTH_URL means the provider does not exist', () => {
  assert.equal(extra.enabled(), false);
  assert.deepEqual(extra.publicConfig(), { enabled: false });
});

test('publicConfig never carries the URL, only whether it exists and its name', () => {
  process.env.EXTRA_AUTH_URL = 'http://auth.invalid/verify.php';
  process.env.EXTRA_AUTH_LABEL = 'Acme SSO';
  assert.deepEqual(extra.publicConfig(), { enabled: true, label: 'Acme SSO' });
  assert.doesNotMatch(JSON.stringify(extra.publicConfig()), /https?:\/\//);
});

test('a configured provider with no label still gets a usable one', () => {
  process.env.EXTRA_AUTH_URL = 'http://auth.invalid/verify.php';
  assert.equal(extra.publicConfig().label, 'Company account');
});

test('when disabled, verifyLogin refuses without touching the network', async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => { called = true; throw new Error('should not be reached'); };
  try {
    const r = await extra.verifyLogin('someone', 'secret');
    assert.equal(r.ok, false);
    assert.equal(called, false);
  } finally { globalThis.fetch = realFetch; }
});

test('only a 200 carrying exactly TRUE is a valid sign-in', async () => {
  process.env.EXTRA_AUTH_URL = 'http://auth.invalid/verify.php';
  const realFetch = globalThis.fetch;
  const reply = (status, body) => () => Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(body) });
  try {
    globalThis.fetch = reply(200, 'TRUE\n');            // trailing newline is fine
    assert.deepEqual(await extra.verifyLogin('u', 'p'), { ok: true, user: 'u' });

    globalThis.fetch = reply(200, 'FALSE');
    assert.equal((await extra.verifyLogin('u', 'p')).ok, false);

    globalThis.fetch = reply(200, '');                  // empty body
    assert.equal((await extra.verifyLogin('u', 'p')).ok, false);

    // the reference implementation ignored the status and read the body either way
    globalThis.fetch = reply(500, 'TRUE');
    assert.equal((await extra.verifyLogin('u', 'p')).ok, false);
  } finally { globalThis.fetch = realFetch; }
});

test('a transport failure is a rejection, and does not leak the endpoint', async () => {
  process.env.EXTRA_AUTH_URL = 'http://auth.invalid/verify.php';
  const realFetch = globalThis.fetch;
  const realError = console.error;
  console.error = () => {};
  globalThis.fetch = () => Promise.reject(new Error('connect ECONNREFUSED http://auth.invalid'));
  try {
    const r = await extra.verifyLogin('u', 'p');
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.error, /auth\.invalid|https?:\/\//);
  } finally { globalThis.fetch = realFetch; console.error = realError; }
});

test('credentials are form-encoded, so a password with & or = survives', async () => {
  process.env.EXTRA_AUTH_URL = 'http://auth.invalid/verify.php';
  const realFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = (url, opts) => { sent = opts.body; return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('TRUE') }); };
  try {
    await extra.verifyLogin('a&b', 'p=q&r');
    assert.deepEqual([...new URLSearchParams(sent)], [['user', 'a&b'], ['pass', 'p=q&r']]);
  } finally { globalThis.fetch = realFetch; }
});
