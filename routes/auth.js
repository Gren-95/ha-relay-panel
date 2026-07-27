// Auth endpoints: HA-account login (rate-limited) -> DB-backed session cookie.
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const ha = require('../ha');
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

router.post('/api/login', wrap(async (req, res) => {
  if (!checkLoginRate(req, res)) return;
  const { username, password } = req.body || {};
  if (!username || !password) { req._loginEntry.count++; return res.status(400).json({ ok: false, error: 'username and password required' }); }
  const r = await ha.verifyHaLogin(String(username), String(password));
  if (!r.ok) {
    req._loginEntry.count++;
    if (req._loginEntry.count >= 10) req._loginEntry.blockedUntil = Date.now() + 300000;      // 5 min
    else if (req._loginEntry.count >= 5) req._loginEntry.blockedUntil = Date.now() + 60000;   // 1 min
    return res.status(401).json({ ok: false, error: r.error });
  }
  const token = crypto.randomBytes(24).toString('hex');
  await db.saveSession(token, r.user, Date.now() + SESSION_MS);
  loginAttempts.delete(req.ip || req.socket.remoteAddress || 'unknown'); // reset rate limit on success
  await db.addAuditLog(r.user, 'login', {});
  res.setHeader('Set-Cookie', `rp_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`);
  res.json({ ok: true, user: r.user });
}));

router.post('/api/logout', wrap(async (req, res) => {
  const u = await currentUser(req);
  const t = cookies(req).rp_session; if (t) db.deleteSession(t).catch(() => {});
  if (u) db.addAuditLog(u, 'logout', {}).catch(() => {});
  res.setHeader('Set-Cookie', 'rp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
}));

router.get('/api/session', wrap(async (req, res) => {
  const u = await currentUser(req);
  res.json({ ok: true, authed: !!u, user: u || null });
}));

module.exports = router;
