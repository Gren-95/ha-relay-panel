const express = require('express');
const path = require('path');
const db = require('./db');
const ha = require('./ha');
const { startNotifyWatcher } = require('./lib/notify');

const app = express();
app.set('trust proxy', 1); // behind Caddy reverse proxy — req.secure / req.ip reflect the client
app.use(express.json({ limit: '2mb' }));

// Security headers (#50 / OWASP A05)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
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
