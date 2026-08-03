// Layout persistence: the DB-stored board JSON plus rolling backups.
const express = require('express');
const db = require('../db');
const { wrap, requireAuth, currentUser } = require('../lib/middleware');

const router = express.Router();

// --- layout (the DB-stored JSON) ---
router.get('/api/layout', wrap(async (req, res) => {
  res.json(await db.getLayout());
}));

router.put('/api/layout', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const layout = {
    relays: Array.isArray(b.relays) ? b.relays : [],
    areas: Array.isArray(b.areas) ? b.areas : [],
    devices: Array.isArray(b.devices) ? b.devices : [],
  };
  try {
    const result = await db.saveLayout(layout, b.updated_at);
    await db.addAuditLog(await currentUser(req), 'layout.save',
      { relays: layout.relays.length, areas: layout.areas.length, devices: layout.devices.length });
    res.json(result);
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ ok: false, error: e.message });
    throw e;
  }
}));

// Stacking order only (click-to-front). Kept off the full-save path on purpose:
// re-stacking must not snapshot a backup, must not fill the activity log, and
// must not fail on a stale version token.
router.put('/api/layout/zorder', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  res.json(await db.saveZOrder({ areas: b.areas, devices: b.devices, relays: b.relays }));
}));

// --- layout backups (recover a wiped/old layout) ---
router.get('/api/layout/backups', wrap(async (req, res) => {
  res.json({ ok: true, backups: await db.listBackups() });
}));

router.post('/api/layout/restore', requireAuth, wrap(async (req, res) => {
  const id = Number((req.body || {}).id);
  const restored = await db.restoreBackup(id);
  if (!restored) return res.status(404).json({ ok: false, error: 'backup not found' });
  await db.addAuditLog(await currentUser(req), 'layout.restore', { backup_id: id });
  res.json({ ok: true, layout: restored });
}));

module.exports = router;
