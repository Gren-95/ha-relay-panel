// Audit trail: client-logged actions + paginated activity log.
const express = require('express');
const db = require('../db');
const { wrap, requireAuth, currentUser } = require('../lib/middleware');

const router = express.Router();

// --- audit helper: let the client log non-CRUD actions like relay/device delete ---
router.post('/api/audit', requireAuth, wrap(async (req, res) => {
  const { action, detail } = req.body || {};
  if (!action) return res.status(400).json({ ok: false, error: 'action required' });
  await db.addAuditLog(await currentUser(req), String(action), detail || {});
  res.json({ ok: true });
}));

// --- activity log (audit trail) ---
router.get('/api/activity-log', wrap(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 50;
  res.json(await db.getActivityLog(page, perPage));
}));

module.exports = router;
