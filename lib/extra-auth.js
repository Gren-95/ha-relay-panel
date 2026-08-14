/*
 * Optional second sign-in provider.
 *
 * Some sites already run a company account service and would rather not hand every
 * operator a Home Assistant account as well. Point EXTRA_AUTH_URL at a verification
 * endpoint and the login modal grows a second choice; leave it unset and nothing about
 * the panel changes - no option is offered, no route behaves differently.
 *
 * The contract is deliberately the smallest thing that works, because it has to match
 * whatever the site already has: POST `user=<u>&pass=<p>` form-encoded, and answer with
 * the bare word TRUE for a valid pair. Anything else - any other body, any transport
 * error, any timeout - is a failed sign-in.
 *
 * The URL, and the provider's name, live ONLY in .env. Neither the address nor the
 * organisation behind it appears in this repository, and the client is told a boolean
 * and a label, never the endpoint (see /api/config).
 */

const TIMEOUT_MS = 10000;

const enabled = () => !!process.env.EXTRA_AUTH_URL;
const label = () => process.env.EXTRA_AUTH_LABEL || 'Company account';

// What the browser is allowed to know: that the option exists, and what to call it.
const publicConfig = () => (enabled() ? { enabled: true, label: label() } : { enabled: false });

async function verifyLogin(username, password) {
  if (!enabled()) return { ok: false, error: 'Second sign-in provider is not configured.' };
  let res;
  try {
    res = await fetch(process.env.EXTRA_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ user: username, pass: password }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // Never leak the endpoint into a response the browser will render.
    console.error('extra-auth: verification request failed:', e.message);
    return { ok: false, error: 'Sign-in service is unreachable. Try again later.' };
  }
  // The reference implementation ignores the status code and reads the body either
  // way, so a 500 carrying "TRUE" would have counted. Require both here.
  const body = (await res.text().catch(() => '')).trim();
  if (res.ok && body === 'TRUE') return { ok: true, user: username };
  if (!res.ok) console.error('extra-auth: verifier answered HTTP', res.status);
  return { ok: false, error: 'Invalid username or password.' };
}

module.exports = { enabled, label, publicConfig, verifyLogin };
