const express = require('express');
const path = require('path');
const db = require('./db');
const ha = require('./ha');
const { startNotifyWatcher } = require('./lib/notify');

const app = express();
// Only trust X-Forwarded-For when behind a reverse proxy (Caddy/nginx).
// Default compose port-mapping exposes the app directly — trusting the header
// would let clients spoof their IP to bypass the login rate limiter (#61).
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// Security headers (#50 / OWASP A05, #61)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  // CSP: default-src 'self' locks down external resources; script-src 'unsafe-inline'
  // allows the inline theme script in index.html. Upgrade to nonce/hash later.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  next();
});

// no-store so browsers never serve stale JS/CSS (the app updates in place)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false, lastModified: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store, must-revalidate'),
}));

// --- routes (grouped by concern; see routes/ and lib/) ---
app.use(require('./routes/ha-proxy'));
app.use(require('./routes/layout'));
app.use(require('./routes/relays'));
app.use(require('./routes/auth'));
app.use(require('./routes/activity'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Client-visible configuration — no secrets. KWS_MAP_URL is the facility-map page that
// plots the HA combo sensors; leave it unset and the cards' map button stays hidden.
app.get('/api/config', (req, res) => res.json({
  kwsMapUrl: process.env.KWS_MAP_URL || '',
  version: process.env.GIT_SHA || 'dev',
  buildDate: process.env.BUILD_DATE || '',
  description: 'Wall-mounted relay control panel for Home Assistant',
  repo: 'https://github.com/Gren-95/ha-relay-panel',
  license: 'MIT',
}));

const PORT = process.env.PORT || 3000;

let server;

db.initDb()
  .then(() => {
    db.startSessionSweep(); // periodic instead of per-request (#49)
    server = app.listen(PORT, () => {
      console.log(`relay-panel on :${PORT}, HA ${ha.HA_URL}`);
      startNotifyWatcher();
    });
  })
  .catch((e) => { console.error('DB init failed:', e.message); process.exit(1); });

// Graceful shutdown — close connections cleanly on SIGTERM/SIGINT (#49)
function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  if (server) server.close(() => console.log('HTTP server closed'));
  // Let in-flight requests finish; docker's stop timeout will force-kill after grace period
  setTimeout(() => process.exit(0), 3000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
