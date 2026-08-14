/*
 * Optional authorisation gate for the second sign-in provider (see extra-auth.js).
 *
 * Authenticating proves who someone is; it does not say they may drive this panel. Point
 * EXTRA_AUTH_PERM_URL at a service that answers "may this account do X?" and a verified
 * account is admitted only when the answer is yes.
 *
 * It asks over HTTP rather than reading a permissions table directly, and that is the
 * whole point of the shape. Querying the database would mean database credentials in
 * this panel's .env, a route from this host to that server, and this repo carrying table
 * and column names. Asking a question instead means the panel holds one URL, one shared
 * secret and one permission name, learns nothing about the schema, and cannot read
 * anything it was not asked to read. The site that owns the accounts keeps the logic.
 *
 * Contract: POST `user`, `permission` and `token` form-encoded; answer JSON
 * {"allowed":true} to admit. The token is what stops the endpoint being an open oracle
 * for "does this person have that permission", so it travels in the body rather than the
 * query string, where it would land in every access log on the way.
 *
 * FAILS CLOSED. Unreachable, non-200, unparseable, or anything but an explicit
 * allowed:true means refused - a gate that opens when it breaks is not a gate. Home
 * Assistant sign-ins skip it entirely, so an outage here can never lock the panel.
 */

const TIMEOUT_MS = 5000;

const enabled = () => !!(process.env.EXTRA_AUTH_PERM_URL
  && process.env.EXTRA_AUTH_PERM_TOKEN
  && process.env.EXTRA_AUTH_PERM_VALUE);

// Split out so the tests can stand in for it without a network (see api.ask below).
async function ask(body) {
  const res = await fetch(process.env.EXTRA_AUTH_PERM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, text: await res.text() };
}

async function allows(username) {
  if (!enabled()) return { ok: true };            // no gate configured — nothing to check
  let res;
  try {
    res = await api.ask({
      user: username,
      permission: process.env.EXTRA_AUTH_PERM_VALUE,
      token: process.env.EXTRA_AUTH_PERM_TOKEN,
    });
  } catch (e) {
    // The message can name the host, so it goes to the log and never to a browser.
    console.error('extra-auth-perm: permission lookup failed:', e.message);
    return { ok: false, error: 'Permission could not be verified. Try again later.' };
  }
  if (res.status !== 200) {
    console.error('extra-auth-perm: permission service answered HTTP', res.status);
    return { ok: false, error: 'Permission could not be verified. Try again later.' };
  }
  let body;
  try { body = JSON.parse(res.text); } catch {
    console.error('extra-auth-perm: permission service did not answer JSON');
    return { ok: false, error: 'Permission could not be verified. Try again later.' };
  }
  // Strictly true. A truthy string, a 1, or a missing key are all "no".
  if (body && body.allowed === true) return { ok: true };
  return { ok: false, error: 'This account is not permitted to use the relay panel.' };
}

// `allows` calls api.ask rather than ask directly, so a test can swap in a stub.
const api = { enabled, allows, ask };
module.exports = api;
