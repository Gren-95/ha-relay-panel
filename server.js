const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const ha = require('./ha');
const z2m = require('./z2m');

const app = express();
app.use(express.json({ limit: '2mb' }));
// no-store so browsers never serve stale JS/CSS (the app updates in place)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false, lastModified: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store, must-revalidate'),
}));

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 60);

// Validate/normalize an incoming schedule; returns null if there are no usable blocks.
function sanitizeSchedule(sc) {
  if (!sc || typeof sc !== 'object' || !Array.isArray(sc.blocks)) return null;
  const hhmm = (s) => /^\d{1,2}:\d{2}$/.test(String(s || '').trim());
  const blocks = sc.blocks.map((b) => ({
    days: (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 1 && d <= 7),
    start: String(b.start || '').trim(),
    end: String(b.end || '').trim(),
    temp: Number(b.temp),
  })).filter((b) => b.days.length && hhmm(b.start) && hhmm(b.end) && isFinite(b.temp)).slice(0, 20);
  if (!blocks.length) return null;
  const fb = Number(sc.fallback);
  return { blocks, fallback: isFinite(fb) ? fb : null };
}


// --- auth: HA-account login -> in-memory session cookie ---
const SESSION_MS = 12 * 60 * 60 * 1000; // 12h
const sessions = new Map(); // token -> { user, exp }
function cookies(req) {
  const out = {}; (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function currentUser(req) {
  const t = cookies(req).rp_session; if (!t) return null;
  const s = sessions.get(t); if (!s || s.exp < Date.now()) { sessions.delete(t); return null; }
  return s.user;
}
// gate config-CHANGE routes; viewing + relay toggling stay open
function requireAuth(req, res, next) {
  if (currentUser(req)) return next();
  res.status(401).json({ ok: false, error: 'Sign in with your Home Assistant account to make changes.' });
}
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e.message);
    res.status(500).json({ ok: false, error: e.message });
  });

// --- devices available to place/bind (from HA) ---
app.get('/api/entities', wrap(async (req, res) => {
  res.json(await ha.getEntities());
}));

// --- HA areas (for visual grouping) ---
app.get('/api/areas', wrap(async (req, res) => {
  res.json(await ha.getAreas());
}));

// --- physical relay devices with their output switches ---
app.get('/api/relay-devices', wrap(async (req, res) => {
  res.json(await ha.getRelayDevices());
}));

// --- layout (the DB-stored JSON) ---
app.get('/api/layout', wrap(async (req, res) => {
  res.json(await db.getLayout());
}));

app.put('/api/layout', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const layout = {
    relays: Array.isArray(b.relays) ? b.relays : [],
    areas: Array.isArray(b.areas) ? b.areas : [],
    devices: Array.isArray(b.devices) ? b.devices : [],
  };
  const result = await db.saveLayout(layout);
  await db.addAuditLog(currentUser(req), 'layout.save',
    { relays: layout.relays.length, areas: layout.areas.length, devices: layout.devices.length });
  res.json(result);
}));

// --- layout backups (recover a wiped/old layout) ---
app.get('/api/layout/backups', wrap(async (req, res) => {
  res.json({ ok: true, backups: await db.listBackups() });
}));
app.post('/api/layout/restore', requireAuth, wrap(async (req, res) => {
  const id = Number((req.body || {}).id);
  const restored = await db.restoreBackup(id);
  if (!restored) return res.status(404).json({ ok: false, error: 'backup not found' });
  await db.addAuditLog(currentUser(req), 'layout.restore', { backup_id: id });
  res.json({ ok: true, layout: restored });
}));

// --- live temps + relay states ---
app.get('/api/live', wrap(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  res.json(await ha.getStates(ids));
}));

// --- bind: create/update the HA automation for a relay widget ---
app.post('/api/relays/:rid/bind', requireAuth, wrap(async (req, res) => {
  const { rid } = req.params;
  const { name, relay, sensor, mode, temp, deadband, area, schedule, min_on, min_off } = req.body || {};
  if (!/^switch\./.test(relay || '')) return res.status(400).json({ ok: false, error: 'pick a relay (switch.*)' });
  if (!/^sensor\./.test(sensor || '')) return res.status(400).json({ ok: false, error: 'pick a temperature sensor' });
  const t = Number(temp);
  if (!isFinite(t)) return res.status(400).json({ ok: false, error: 'target temperature must be a number' });
  const band = isFinite(Number(deadband)) ? Math.max(0, Number(deadband)) : 0;
  const md = mode === 'above' ? 'above' : 'below';
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
  await db.addAuditLog(currentUser(req), 'relay.bind',
    { rid, relay, sensor, mode: md, temp: t });
  res.json({ ok: true, automationId });
}));

// --- unbind: remove the HA automation ---
app.post('/api/relays/:rid/unbind', requireAuth, wrap(async (req, res) => {
  const { rid } = req.params;
  const layout = await db.getLayout();
  const r = (layout.relays || []).find((x) => x.id === rid);
  const automationId = (r && r.automationId) || `relaypanel_${slug(rid)}`;
  await ha.deleteAutomation(automationId);
  if (r) { r.bound = false; delete r.automationId; await db.saveLayout(layout); }
  await db.addAuditLog(currentUser(req), 'relay.unbind',
    { rid, relay: r ? r.relay : '', name: r ? r.name : '' });
  res.json({ ok: true });
}));

// --- rename a device in HA (and in Z2M too, if it's a Zigbee device) ---
app.post('/api/rename', requireAuth, wrap(async (req, res) => {
  const { entity_id, name, parent } = req.body || {};
  const nm = (name || '').trim().replace(/\s+/g, '_'); // spaces -> _ (safe for Z2M topics)
  if (!entity_id || !nm) return res.status(400).json({ ok: false, error: 'entity_id and name required' });
  const info = await ha.getDeviceInfo(entity_id);
  if (!info || !info.device_id) return res.status(400).json({ ok: false, error: 'no HA device for that entity' });
  // Zigbee (on the entity's own device or its parent) -> rename in Z2M.
  const ieee = ha.zigbeeIeee(info.identifiers) || (parent ? ha.zigbeeIeee(info.parent_identifiers) : null);
  if (ieee) {
    const base = await z2m.renameZigbee(ieee, nm);
    await db.addAuditLog(currentUser(req), 'device.rename', { entity_id, new_name: nm, via: 'z2m' });
    return res.json({ ok: true, zigbee: true, where: `Zigbee2MQTT (${base}) → HA` });
  }
  // For a physical relay whose channels are sub-devices, rename the PARENT device.
  const target = parent && info.parent_id ? info.parent_id : info.device_id;
  await ha.renameHaDevice(target, nm);
  await db.addAuditLog(currentUser(req), 'device.rename', { entity_id, new_name: nm, via: 'ha' });
  res.json({ ok: true, zigbee: false, where: parent && info.parent_id ? 'Home Assistant (device)' : 'Home Assistant' });
}));

// --- manual relay control (on/off/toggle) ---
app.post('/api/switch', wrap(async (req, res) => {
  const { entity_id, action } = req.body || {};
  if (!/^switch\./.test(entity_id || '')) return res.status(400).json({ ok: false, error: 'switch entity required' });
  const state = await ha.setSwitch(entity_id, action);
  await db.addAuditLog(currentUser(req), 'switch.toggle', { entity_id, action, result_state: state });
  res.json({ ok: true, state });
}));

// --- 24h sensor history (sparkline) ---
app.get('/api/history', wrap(async (req, res) => {
  const entity = String(req.query.entity || '');
  if (!/^sensor\./.test(entity)) return res.status(400).json({ ok: false, error: 'sensor entity required' });
  res.json({ ok: true, points: await ha.getHistory(entity, Number(req.query.hours) || 24) });
}));

// --- merged sensor + relay history for CSV export ---
app.get('/api/history/export', wrap(async (req, res) => {
  const sensor = String(req.query.sensor || '');
  const relay = String(req.query.relay || '');
  if (!/^sensor\./.test(sensor)) return res.status(400).json({ ok: false, error: 'sensor entity required' });
  const hours = Number(req.query.hours) || 24;
  const target = parseFloat(req.query.target);
  const rows = await ha.getHistoryExport(sensor, relay || null, hours);
  res.json({ ok: true, rows, target: isFinite(target) ? target : null });
}));

// --- HA reachability (for the connection banner) ---
app.get('/api/ha-status', wrap(async (req, res) => {
  res.json({ ok: true, reachable: await ha.haReachable() });
}));

// --- re-apply every bound relay's automation with the current (safe) template ---
app.post('/api/reapply', requireAuth, wrap(async (req, res) => {
  const layout = await db.getLayout();
  const bound = (layout.relays || []).filter((r) => r.bound && r.relay && r.sensor);
  let n = 0;
  for (const r of bound) {
    const automationId = `relaypanel_${slug(r.id)}`;
    const config = ha.buildAutomation({
      id: automationId, alias: `RelayPanel: ${r.name || r.relay}`,
      sensor: r.sensor, relay: r.relay, mode: r.mode === 'above' ? 'above' : 'below',
      temp: Number(r.temp), deadband: Number(r.deadband) || 0, schedule: sanitizeSchedule(r.schedule),
      min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
    });
    await ha.upsertAutomation(automationId, config);
    n++;
  }
  await db.addAuditLog(currentUser(req), 'automation.reapply', { count: n });
  res.json({ ok: true, reapplied: n });
}));

// --- all relay-panel automation states (config id -> enabled) ---
app.get('/api/automations', wrap(async (req, res) => {
  res.json(await ha.listRelayAutomations());
}));

// --- automation enable/disable (maintenance) for a relay's binding ---
app.get('/api/relays/:rid/automation', wrap(async (req, res) => {
  const automationId = `relaypanel_${slug(req.params.rid)}`;
  const a = await ha.findAutomation(automationId);
  res.json({ ok: true, exists: !!a, enabled: a ? a.enabled : false, entity_id: a ? a.entity_id : null });
}));

app.post('/api/relays/:rid/automation', requireAuth, wrap(async (req, res) => {
  const automationId = `relaypanel_${slug(req.params.rid)}`;
  const a = await ha.findAutomation(automationId);
  if (!a) return res.status(404).json({ ok: false, error: 'no automation for this relay' });
  const enabled = await ha.setAutomationEnabled(a.entity_id, !!(req.body && req.body.enabled));
  await db.addAuditLog(currentUser(req), enabled ? 'automation.resume' : 'automation.pause',
    { rid: req.params.rid });
  res.json({ ok: true, exists: true, enabled });
}));

// --- auth endpoints ---
app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });
  const r = await ha.verifyHaLogin(String(username), String(password));
  if (!r.ok) return res.status(401).json({ ok: false, error: r.error });
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { user: r.user, exp: Date.now() + SESSION_MS });
  await db.addAuditLog(r.user, 'login', {});
  res.setHeader('Set-Cookie', `rp_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`);
  res.json({ ok: true, user: r.user });
}));

app.post('/api/logout', (req, res) => {
  const u = currentUser(req);
  const t = cookies(req).rp_session; if (t) sessions.delete(t);
  if (u) db.addAuditLog(u, 'logout', {}).catch(() => {});
  res.setHeader('Set-Cookie', 'rp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const u = currentUser(req);
  res.json({ ok: true, authed: !!u, user: u || null });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- audit helper: let the client log non-CRUD actions like relay/device delete ---
app.post('/api/audit', requireAuth, wrap(async (req, res) => {
  const { action, detail } = req.body || {};
  if (!action) return res.status(400).json({ ok: false, error: 'action required' });
  await db.addAuditLog(currentUser(req), String(action), detail || {});
  res.json({ ok: true });
}));

// --- activity log (audit trail) ---
app.get('/api/activity-log', wrap(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 50;
  res.json(await db.getActivityLog(page, perPage));
}));

const PORT = process.env.PORT || 3000;

// --- notification watcher: alerts on offline sensors/relays or temp deviations ---
const NOTIFY_SERVICE = (process.env.NOTIFY_SERVICE || '').trim();
const NOTIFY_INTERVAL = 60 * 1000; // check every 60s
const notifyAlerts = new Map(); // key -> timestamp of last alert

function notifyKey(rid, type) { return `${rid}:${type}`; }

async function runNotifyCheck() {
  if (!NOTIFY_SERVICE) return;
  let layout;
  try { layout = await db.getLayout(); } catch { return; }
  const relays = (layout.relays || []).filter((r) => r.relay && r.sensor && r.bound);
  if (!relays.length) return;

  // Collect entity IDs and fetch live states
  const ids = new Set();
  for (const r of relays) { ids.add(r.relay); ids.add(r.sensor); }
  let live;
  try { live = await ha.getStates([...ids]); } catch { return; }

  for (const r of relays) {
    if (!r.notify) continue;
    const rl = live[r.relay] || {};
    const sn = live[r.sensor] || {};
    const threshold = Number(r.notify_deviation) || 5;
    const name = r.name || r.relay;

    // Relay offline
    if (rl.state === 'unavailable' || rl.state === 'unknown' || rl.missing) {
      const key = notifyKey(r.id, 'relay_offline');
      if (!notifyAlerts.has(key)) {
        notifyAlerts.set(key, Date.now());
        ha.sendNotification(NOTIFY_SERVICE,
          `Relay "${name}" (${r.relay}) is offline/unreachable.`, 'Relay Panel').catch(() => {});
      }
    } else {
      // Relay recovered
      const key = notifyKey(r.id, 'relay_offline');
      if (notifyAlerts.has(key)) {
        notifyAlerts.delete(key);
        ha.sendNotification(NOTIFY_SERVICE,
          `Relay "${name}" (${r.relay}) is back online.`, 'Relay Panel').catch(() => {});
      }
    }

    // Sensor offline
    if (sn.state === 'unavailable' || sn.state === 'unknown' || sn.missing) {
      const key = notifyKey(r.id, 'sensor_offline');
      if (!notifyAlerts.has(key)) {
        notifyAlerts.set(key, Date.now());
        ha.sendNotification(NOTIFY_SERVICE,
          `Sensor "${name}" (${r.sensor}) is offline. Automatic control is paused.`, 'Relay Panel').catch(() => {});
      }
    } else {
      const key = notifyKey(r.id, 'sensor_offline');
      if (notifyAlerts.has(key)) {
        notifyAlerts.delete(key);
        ha.sendNotification(NOTIFY_SERVICE,
          `Sensor "${name}" (${r.sensor}) is back online.`, 'Relay Panel').catch(() => {});
      }
    }

    // Temp deviation (only if relay and sensor are both online)
    if (r.temp != null && sn.state && !isNaN(parseFloat(sn.state)) &&
        rl.state !== 'unavailable' && rl.state !== 'unknown' && !rl.missing &&
        sn.state !== 'unavailable' && sn.state !== 'unknown' && !sn.missing) {
      const current = parseFloat(sn.state);
      const target = Number(r.temp);
      const diff = Math.abs(current - target);
      if (diff >= threshold) {
        const dir = current > target ? 'above' : 'below';
        const key = notifyKey(r.id, 'temp_' + dir);
        if (!notifyAlerts.has(key)) {
          notifyAlerts.set(key, Date.now());
          ha.sendNotification(NOTIFY_SERVICE,
            `"${name}" is ${current.toFixed(1)}°C (target ${target}°C, off by ${diff.toFixed(1)}°C).`,
            'Relay Panel').catch(() => {});
        }
      } else {
        // Temp back in range — clear both directions
        ['temp_above', 'temp_below'].forEach((d) => notifyAlerts.delete(notifyKey(r.id, d)));
      }
    }
  }
}

db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`relay-panel on :${PORT}, HA ${ha.HA_URL}`);
      if (NOTIFY_SERVICE) {
        console.log(`notify watcher active: ${NOTIFY_SERVICE}`);
        (function loop() { runNotifyCheck().finally(() => setTimeout(loop, NOTIFY_INTERVAL)); })();
      }
    });
  })
  .catch((e) => { console.error('DB init failed:', e.message); process.exit(1); });
