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

db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`relay-panel on :${PORT}, HA ${ha.HA_URL}`);
      startNotifyWatcher();
    });
  })
  .catch((e) => { console.error('DB init failed:', e.message); process.exit(1); });
