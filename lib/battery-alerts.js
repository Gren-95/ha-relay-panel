// Battery alert watcher: polls every battery entity in HA and mails the recipients
// configured in the panel (settings key `battery_alerts`) when one runs low.
const nodemailer = require('nodemailer');
const db = require('../db');
const ha = require('../ha');
const B = require('./battery');

const CONFIG_KEY = 'battery_alerts';
// Which batteries have already been reported, so a restart does not re-send them.
const STATE_KEY = 'battery_alert_state';
const INTERVAL_MS = 60 * 1000;

async function loadConfig() { return B.withDefaults(await db.getSetting(CONFIG_KEY)); }
async function saveConfig(cfg) { await db.setSetting(CONFIG_KEY, cfg); }

async function loadState() {
  const s = await db.getSetting(STATE_KEY);
  return { low: {}, lastSentAt: null, lastError: null, lastErrorAt: null, ...(s && typeof s === 'object' ? s : {}) };
}
async function saveState(s) { await db.setSetting(STATE_KEY, s); }

function transportFor(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.security === 'tls',
    requireTLS: smtp.security === 'starttls',
    // "none" means none: plenty of internal relays offer STARTTLS with a cert that
    // would fail verification, and nodemailer would otherwise try it on its own.
    ignoreTLS: smtp.security === 'none',
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

async function sendMail(cfg, { subject, text }) {
  const t = transportFor(cfg.smtp);
  try {
    await t.sendMail({ from: cfg.smtp.from, to: cfg.recipients.join(', '), subject, text });
  } finally {
    t.close();
  }
}

async function currentBatteries() {
  return B.batteryEntities(await ha.getAllStates());
}

let running = false;

async function runCheck() {
  if (running) return;
  running = true;
  try {
    const cfg = await loadConfig();
    if (!cfg.enabled) return;
    try { B.assertSendable(cfg); } catch { return; }
    let batteries;
    try { batteries = await currentBatteries(); } catch { return; } // HA down: try next tick
    const st = await loadState();
    const r = B.evaluate(batteries, cfg, st.low);
    if (!r.newlyLow.length && !r.recovered.length) {
      if (r.dropped.length) await saveState({ ...st, low: r.low });
      return;
    }
    try {
      await sendMail(cfg, B.buildEmail(r, cfg));
      await saveState({ ...st, low: r.low, lastSentAt: Date.now(), lastError: null, lastErrorAt: null });
      console.log(`battery alerts: mailed ${r.newlyLow.length} low, ${r.recovered.length} recovered`);
    } catch (e) {
      // State is left alone, so the same alert is retried on the next tick.
      await saveState({ ...st, lastError: String(e.message || e).slice(0, 300), lastErrorAt: Date.now() });
      console.error('battery alerts: send failed:', e.message);
    }
  } catch (e) {
    console.error('battery alerts:', e.message);
  } finally {
    running = false;
  }
}

function startBatteryWatcher() {
  (function loop() { runCheck().finally(() => setTimeout(loop, INTERVAL_MS)); })();
}

module.exports = { loadConfig, saveConfig, loadState, saveState, sendMail, currentBatteries, runCheck, startBatteryWatcher, INTERVAL_MS };
