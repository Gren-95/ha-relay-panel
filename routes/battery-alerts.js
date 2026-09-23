// Battery alert settings (recipients, threshold, SMTP) and a test-mail endpoint.
// Everything here needs a session: the settings hold addresses and SMTP credentials.
const express = require('express');
const db = require('../db');
const B = require('../lib/battery');
const alerts = require('../lib/battery-alerts');
const { wrap, requireAuth, currentUser } = require('../lib/middleware');

const router = express.Router();

async function snapshot() {
  const cfg = await alerts.loadConfig();
  const st = await alerts.loadState();
  let batteries = [];
  let haError = false;
  try { batteries = await alerts.currentBatteries(); } catch { haError = true; }
  const excluded = new Set(cfg.exclude);
  return {
    ok: true,
    config: B.publicConfig(cfg),
    limits: { maxThreshold: B.MAX_THRESHOLD, recoverMargin: B.RECOVER_MARGIN },
    batteries: batteries.map((b) => ({
      ...b,
      low: B.isLow(b, cfg.threshold),
      alerted: !!st.low[b.entity_id],
      excluded: excluded.has(b.entity_id),
    })),
    haError,
    status: { lastSentAt: st.lastSentAt, lastError: st.lastError, lastErrorAt: st.lastErrorAt },
  };
}

const sendError = (res, e) => res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'internal error' });

router.get('/api/battery-alerts', requireAuth, wrap(async (req, res) => {
  res.json(await snapshot());
}));

router.put('/api/battery-alerts', requireAuth, wrap(async (req, res) => {
  let cfg;
  try { cfg = B.sanitizeConfig(req.body, await alerts.loadConfig()); } catch (e) { return sendError(res, e); }
  await alerts.saveConfig(cfg);
  await db.addAuditLog(await currentUser(req), 'alerts.save',
    { enabled: cfg.enabled, threshold: cfg.threshold, recipients: cfg.recipients.length });
  // Check right away rather than on the next tick, so saving shows its effect.
  alerts.runCheck().catch(() => {});
  res.json(await snapshot());
}));

// Sends with the settings in the form, saved or not, so they can be tried first.
router.post('/api/battery-alerts/test', requireAuth, wrap(async (req, res) => {
  let cfg;
  try {
    cfg = B.sanitizeConfig({ ...req.body, enabled: false }, await alerts.loadConfig());
    B.assertSendable(cfg);
  } catch (e) { return sendError(res, e); }
  try {
    await alerts.sendMail(cfg, {
      subject: '[Relay Panel] Test email',
      text: `This is a test from Relay Panel's battery alerts.\n\nIf you can read this, the SMTP settings work. ` +
        `Alerts go out when a battery drops to ${cfg.threshold}% or lower.\n`,
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
  await db.addAuditLog(await currentUser(req), 'alerts.test', { recipients: cfg.recipients.length });
  res.json({ ok: true });
}));

module.exports = router;
