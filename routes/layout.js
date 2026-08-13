// Layout persistence: the DB-stored board JSON plus rolling backups.
const express = require('express');
const db = require('../db');
const ha = require('../ha');
const { wrap, requireAuth, currentUser } = require('../lib/middleware');
const { boundAutomationIds } = require('../lib/util');

const router = express.Router();

// Drop the HA automations left behind by bindings that are no longer on the board.
// Never allowed to fail the caller: HA being unreachable must not lose a layout
// save, and the next save/restore/reapply will prune again anyway.
async function prune(layout, actor) {
  try {
    const removed = await ha.pruneOrphanAutomations(boundAutomationIds(layout));
    if (removed.length) await db.addAuditLog(actor, 'automation.prune', { removed });
    return removed;
  } catch (e) {
    console.error('orphan automation prune failed:', e.message);
    return [];
  }
}

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
  const before = boundAutomationIds(await db.getLayout());
  try {
    const result = await db.saveLayout(layout, b.updated_at);
    const actor = await currentUser(req);
    await db.addAuditLog(actor, 'layout.save',
      { relays: layout.relays.length, areas: layout.areas.length, devices: layout.devices.length });
    // Only when this save actually dropped a binding - an ordinary drag/save must
    // not pay for the /api/states fetch the prune needs.
    const after = boundAutomationIds(layout);
    if ([...before].some((id) => !after.has(id))) await prune(layout, actor);
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
  const actor = await currentUser(req);
  await db.addAuditLog(actor, 'layout.restore', { backup_id: id });
  // A restore can swap the whole board out, so prune unconditionally here.
  await prune(restored, actor);
  res.json({ ok: true, layout: restored });
}));

module.exports = router;
