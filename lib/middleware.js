// Request-handling helpers: DB-backed session cookie auth + async error wrapper.
const db = require('../db');

// --- auth: HA-account login -> DB-backed session cookie ---
const SESSION_MS = 8 * 60 * 60 * 1000; // 8h

async function getSessionFromDB(token) {
  try { return await db.getSession(token); } catch { return null; }
}

function cookies(req) {
  const out = {}; (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

async function currentUser(req) {
  const t = cookies(req).rp_session; if (!t) return null;
  const s = await getSessionFromDB(t); if (!s) return null;
  // Extend session expiry on activity so active users never get logged out
  db.saveSession(t, s.user, Date.now() + SESSION_MS).catch(() => {});
  return s.user;
}

// gate config-CHANGE routes; viewing + relay toggling stay open
async function requireAuth(req, res, next) {
  if (await currentUser(req)) return next();
  res.status(401).json({ ok: false, error: 'Sign in with your Home Assistant account to make changes.' });
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e.message);  // full details in server logs only
    res.status(500).json({ ok: false, error: 'internal error' });
  });

module.exports = { SESSION_MS, cookies, currentUser, requireAuth, wrap };
