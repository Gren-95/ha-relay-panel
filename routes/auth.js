// Auth endpoints: HA-account login (rate-limited) -> DB-backed session cookie.
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const ha = require('../ha');
const extraAuth = require('../lib/extra-auth');
const extraPerm = require('../lib/extra-auth-perm');
const { wrap, currentUser, cookies, SESSION_MS } = require('../lib/middleware');

const router = express.Router();

// --- simple rate limiter for login ---
const loginAttempts = new Map(); // ip -> { count, blockedUntil }
function checkLoginRate(req, res) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  let entry = loginAttempts.get(ip);
  const now = Date.now();
  if (entry && entry.blockedUntil > now) {
    const wait = Math.ceil((entry.blockedUntil - now) / 1000);
    res.status(429).json({ ok: false, error: `Too many login attempts. Try again in ${wait}s.` });
    return false;
  }
  if (!entry || entry.blockedUntil <= now) entry = { count: 0, blockedUntil: 0 };
  loginAttempts.set(ip, entry);
  // Clean old entries every 100 logins
  if (loginAttempts.size > 500) {
    for (const [k, v] of loginAttempts) { if (v.blockedUntil < now) loginAttempts.delete(k); }
  }
  req._loginEntry = entry;
  return true;
}

// Build Set-Cookie header — includes Secure flag when behind TLS (#50 / OWASP A02)
function sessionCookie(token, maxAgeSec) {
  const secure = process.env.SECURE_COOKIE === '1' ? '; Secure' : '';
  return `rp_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}`;
}

router.post('/api/login', wrap(async (req, res) => {
  if (!checkLoginRate(req, res)) return;
  const { username, password, provider } = req.body || {};
  if (!username || !password) {
    req._loginEntry.count++;
    await db.addAuditLog(username || '(empty)', 'login.fail', { reason: 'missing credentials' });
    return res.status(400).json({ ok: false, error: 'username and password required' });
  }
  // The provider is chosen explicitly, never tried in turn: falling through from one
  // to the other would hand every failed password to a second service, and would make
  // "which system rejected me" unanswerable from the audit log.
  const useExtra = provider === 'extra' && extraAuth.enabled();
  if (provider === 'extra' && !extraAuth.enabled()) {
    return res.status(400).json({ ok: false, error: 'That sign-in method is not available.' });
  }
  const r = useExtra
    ? await extraAuth.verifyLogin(String(username), String(password))
    : await ha.verifyHaLogin(String(username), String(password));
  const via = useExtra ? 'extra' : 'ha';
  if (!r.ok) {
    req._loginEntry.count++;
    await db.addAuditLog(username, 'login.fail', { reason: r.error || 'invalid credentials', via });
    if (req._loginEntry.count >= 10) req._loginEntry.blockedUntil = Date.now() + 300000;      // 5 min
    else if (req._loginEntry.count >= 5) req._loginEntry.blockedUntil = Date.now() + 60000;   // 1 min
    return res.status(401).json({ ok: false, error: r.error });
  }
  // Authenticated, but is this account allowed to drive the panel? Only the second
  // provider has a permissions table behind it; HA accounts are governed by HA.
  if (useExtra) {
    const perm = await extraPerm.allows(r.user);
    if (!perm.ok) {
      req._loginEntry.count++;
      await db.addAuditLog(r.user, 'login.fail', { reason: 'not permitted', via });
      return res.status(403).json({ ok: false, error: perm.error });
    }
  }
  // Session rotation: delete any existing sessions for this user before creating a new one
  await db.deleteSessionsForUser(r.user);
  const token = crypto.randomBytes(24).toString('hex');
  await db.saveSession(token, r.user, Date.now() + SESSION_MS);
  loginAttempts.delete(req.ip || req.socket.remoteAddress || 'unknown'); // reset rate limit on success
  await db.addAuditLog(r.user, 'login', { via });
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_MS / 1000));
  res.json({ ok: true, user: r.user });
}));

router.post('/api/logout', wrap(async (req, res) => {
  const u = await currentUser(req);
  const t = cookies(req).rp_session; if (t) db.deleteSession(t).catch(() => {});
  if (u) db.addAuditLog(u, 'logout', {}).catch(() => {});
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ ok: true });
}));

router.get('/api/session', wrap(async (req, res) => {
  const u = await currentUser(req);
  res.json({ ok: true, authed: !!u, user: u || null });
}));

module.exports = router;
