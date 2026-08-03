// Read-only HA proxy endpoints: entities, areas, relay devices, live states, history.
const express = require('express');
const ha = require('../ha');
const { wrap } = require('../lib/middleware');

const router = express.Router();

// --- devices available to place/bind (from HA) ---
router.get('/api/entities', wrap(async (req, res) => {
  res.json(await ha.getEntities());
}));

// --- HA areas (for visual grouping) ---
router.get('/api/areas', wrap(async (req, res) => {
  res.json(await ha.getAreas());
}));

// --- physical relay devices with their output switches ---
router.get('/api/relay-devices', wrap(async (req, res) => {
  res.json(await ha.getRelayDevices());
}));

// --- live temps + relay states + automation map (single HA fetch, issue #48) ---
router.get('/api/live', wrap(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  const result = await ha.getStatesAndAutomations(ids);
  res.json({ ...result.states, _automations: result.automations });
}));

// --- 24h sensor history (sparkline) ---
router.get('/api/history', wrap(async (req, res) => {
  const entity = String(req.query.entity || '');
  if (!/^sensor\./.test(entity)) return res.status(400).json({ ok: false, error: 'sensor entity required' });
  res.json({ ok: true, points: await ha.getHistory(entity, Math.min(Number(req.query.hours) || 24, 720)) });
}));

// --- merged sensor + relay history for CSV export ---
router.get('/api/history/export', wrap(async (req, res) => {
  const sensor = String(req.query.sensor || '');
  const relay = String(req.query.relay || '');
  if (!/^sensor\./.test(sensor)) return res.status(400).json({ ok: false, error: 'sensor entity required' });
  const hours = Math.min(Number(req.query.hours) || 24, 720);
  const target = parseFloat(req.query.target);
  const rows = await ha.getHistoryExport(sensor, relay || null, hours);
  res.json({ ok: true, rows, target: isFinite(target) ? target : null });
}));

// --- HA reachability (for the connection banner) ---
router.get('/api/ha-status', wrap(async (req, res) => {
  res.json({ ok: true, reachable: await ha.haReachable() });
}));

module.exports = router;
