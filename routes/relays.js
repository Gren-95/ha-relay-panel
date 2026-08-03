// Relay binding, manual control, device renames, and automation maintenance.
const express = require('express');
const db = require('../db');
const ha = require('../ha');
const z2m = require('../z2m');
const { wrap, requireAuth, currentUser } = require('../lib/middleware');
const { slug, sanitizeSchedule, validEntity } = require('../lib/util');
const { notifyAlerts, notifyKey } = require('../lib/notify');

const router = express.Router();

// --- bind: create/update the HA automation for a relay widget ---
router.post('/api/relays/:rid/bind', requireAuth, wrap(async (req, res) => {
  const { rid } = req.params;
  const { name, relay, sensor, mode, temp, deadband, area, schedule, min_on, min_off } = req.body || {};
  if (!validEntity(relay)) return res.status(400).json({ ok: false, error: 'invalid relay entity' });
  if (!validEntity(sensor)) return res.status(400).json({ ok: false, error: 'invalid sensor entity' });
  const t = Number(temp);
  if (!isFinite(t)) return res.status(400).json({ ok: false, error: 'target temperature must be a number' });
  const band = isFinite(Number(deadband)) ? Math.max(0, Number(deadband)) : 0;
  const md = mode === 'above' || mode === 'auto' ? mode : 'below';
  const sched = sanitizeSchedule(schedule);

  const automationId = `relaypanel_${slug(rid)}`;
  const alias = `RelayPanel: ${name || relay}`;
  const config = ha.buildAutomation({ id: automationId, alias, sensor, relay, mode: md, temp: t, deadband: band, schedule: sched, min_on: Number(min_on) || 0, min_off: Number(min_off) || 0 });
  await ha.upsertAutomation(automationId, config);

  const layout = await db.getLayout();
  const r = (layout.relays || []).find((x) => x.id === rid);
  if (r) {
    Object.assign(r, { name, relay, sensor, mode: md, temp: t, deadband: band, area: area || null, schedule: sched, automationId, bound: true,
      min_on: Number(min_on) || 0, min_off: Number(min_off) || 0,
      notify: !!req.body.notify, notify_deviation: Number(req.body.notify_deviation) || 5 });
    await db.saveLayout(layout);
  }
  await db.addAuditLog(await currentUser(req), 'relay.bind',
    { rid, relay, sensor, mode: md, temp: t });
  res.json({ ok: true, automationId });
}));

// --- unbind: remove the HA automation ---
router.post('/api/relays/:rid/unbind', requireAuth, wrap(async (req, res) => {
  const { rid } = req.params;
  const layout = await db.getLayout();
  const r = (layout.relays || []).find((x) => x.id === rid);
  const automationId = (r && r.automationId) || `relaypanel_${slug(rid)}`;
  await ha.deleteAutomation(automationId);
  if (r) { r.bound = false; delete r.automationId; await db.saveLayout(layout); }
  // Clean up any stale notify alert keys for this relay
  for (const suffix of ['relay_offline', 'sensor_offline', 'temp_above', 'temp_below']) {
    notifyAlerts.delete(notifyKey(rid, suffix));
  }
  await db.addAuditLog(await currentUser(req), 'relay.unbind',
    { rid, relay: r ? r.relay : '', name: r ? r.name : '' });
  res.json({ ok: true });
}));

// --- rename a device in HA (and in Z2M too, if it's a Zigbee device) ---
router.post('/api/rename', requireAuth, wrap(async (req, res) => {
  const { entity_id, name, parent } = req.body || {};
  const nm = (name || '').trim().replace(/\s+/g, '_'); // spaces -> _ (safe for Z2M topics)
  if (!entity_id || !nm) return res.status(400).json({ ok: false, error: 'entity_id and name required' });
  if (!validEntity(entity_id)) return res.status(400).json({ ok: false, error: 'invalid entity_id' }); // #61 — block Jinja injection
  const info = await ha.getDeviceInfo(entity_id);
  if (!info || !info.device_id) return res.status(400).json({ ok: false, error: 'no HA device for that entity' });
  // Zigbee (on the entity's own device or its parent) -> rename in Z2M.
  const ieee = ha.zigbeeIeee(info.identifiers) || (parent ? ha.zigbeeIeee(info.parent_identifiers) : null);
  if (ieee) {
    const base = await z2m.renameZigbee(ieee, nm);
    await db.addAuditLog(await currentUser(req), 'device.rename', { entity_id, new_name: nm, via: 'z2m' });
    return res.json({ ok: true, zigbee: true, where: `Zigbee2MQTT (${base}) → HA` });
  }
  // For a physical relay whose channels are sub-devices, rename the PARENT device.
  const target = parent && info.parent_id ? info.parent_id : info.device_id;
  await ha.renameHaDevice(target, nm);
  await db.addAuditLog(await currentUser(req), 'device.rename', { entity_id, new_name: nm, via: 'ha' });
  res.json({ ok: true, zigbee: false, where: parent && info.parent_id ? 'Home Assistant (device)' : 'Home Assistant' });
}));

// --- manual relay control (on/off/toggle) ---
router.post('/api/switch', requireAuth, wrap(async (req, res) => {
  const { entity_id, action } = req.body || {};
  if (!/^switch\./.test(entity_id || '')) return res.status(400).json({ ok: false, error: 'switch entity required' });
  const state = await ha.setSwitch(entity_id, action);
  await db.addAuditLog(await currentUser(req), 'switch.toggle', { entity_id, action, result_state: state });
  res.json({ ok: true, state });
}));

// --- re-apply every bound relay's automation with the current (safe) template ---
router.post('/api/reapply', requireAuth, wrap(async (req, res) => {
  const layout = await db.getLayout();
  const bound = (layout.relays || []).filter((r) => r.bound && r.relay && r.sensor);
  let n = 0;
  for (const r of bound) {
    const automationId = `relaypanel_${slug(r.id)}`;
    const config = ha.buildAutomation({
      id: automationId, alias: `RelayPanel: ${r.name || r.relay}`,
      sensor: r.sensor, relay: r.relay, mode: r.mode === 'above' || r.mode === 'auto' ? r.mode : 'below',
      temp: Number(r.temp), deadband: Number(r.deadband) || 0, schedule: sanitizeSchedule(r.schedule),
      min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
    });
    await ha.upsertAutomation(automationId, config);
    n++;
  }
  await db.addAuditLog(await currentUser(req), 'automation.reapply', { count: n });
  res.json({ ok: true, reapplied: n });
}));

// --- all relay-panel automation states (config id -> enabled) ---
router.get('/api/automations', wrap(async (req, res) => {
  res.json(await ha.listRelayAutomations());
}));

// --- automation enable/disable (maintenance) for a relay's binding ---
router.get('/api/relays/:rid/automation', wrap(async (req, res) => {
  const automationId = `relaypanel_${slug(req.params.rid)}`;
  const a = await ha.findAutomation(automationId);
  res.json({ ok: true, exists: !!a, enabled: a ? a.enabled : false, entity_id: a ? a.entity_id : null });
}));

router.post('/api/relays/:rid/automation', requireAuth, wrap(async (req, res) => {
  const automationId = `relaypanel_${slug(req.params.rid)}`;
  const a = await ha.findAutomation(automationId);
  if (!a) return res.status(404).json({ ok: false, error: 'no automation for this relay' });
  const enabled = await ha.setAutomationEnabled(a.entity_id, !!(req.body && req.body.enabled));
  await db.addAuditLog(await currentUser(req), enabled ? 'automation.resume' : 'automation.pause',
    { rid: req.params.rid });
  res.json({ ok: true, exists: true, enabled });
}));

module.exports = router;
