// Thin Home Assistant REST client (uses Node 20 global fetch).
const WebSocket = require('ws');
const HA_URL = (process.env.HA_URL || 'http://homeassistant.local:8123').replace(/\/$/, '');
const HA_TOKEN = process.env.HA_TOKEN || '';

function headers() {
  return {
    Authorization: `Bearer ${HA_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function haFetch(path, opts = {}) {
  const res = await fetch(`${HA_URL}${path}`, { ...opts, headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HA ${opts.method || 'GET'} ${path} -> ${res.status} ${body.slice(0, 200)}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// All states, split into switches (relays) and temperature sensors.
async function getEntities() {
  const states = await haFetch('/api/states');
  const switches = [];
  const sensors = [];
  for (const s of states) {
    const [domain] = s.entity_id.split('.');
    const attr = s.attributes || {};
    const name = attr.friendly_name || s.entity_id;
    if (domain === 'switch') {
      switches.push({ entity_id: s.entity_id, name, state: s.state });
    } else if (
      domain === 'sensor' &&
      (attr.device_class === 'temperature' ||
        (attr.unit_of_measurement || '').includes('C'))
    ) {
      sensors.push({
        entity_id: s.entity_id,
        name,
        state: s.state,
        unit: attr.unit_of_measurement || '°C',
      });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  return { switches: switches.sort(byName), sensors: sensors.sort(byName) };
}

// HA areas (via the template endpoint — REST doesn't expose the area registry).
async function getAreas() {
  const tmpl =
    "{%- set ns = namespace(a=[]) -%}" +
    "{%- for a in areas() -%}" +
    "{%- set ns.a = ns.a + [{'id': a, 'name': area_name(a)}] -%}" +
    "{%- endfor -%}" +
    "{{ ns.a | tojson }}";
  const out = await haFetch('/api/template', { method: 'POST', body: JSON.stringify({ template: tmpl }) });
  // /api/template returns the rendered string; parse it.
  try { return typeof out === 'string' ? JSON.parse(out) : out; }
  catch { return []; }
}

// Physical relay devices: switches grouped by their HA device, keeping the ones
// that look like relay outputs (…_output_N / …_relay). Feeds "add physical relay".
async function getRelayDevices() {
  // Group by the PARENT device (via_device) so a multi-channel relay whose channels
  // are separate HA sub-devices (e.g. Shelly Pro) collapses into one physical relay.
  // BUT a Zigbee device's via_device is the Zigbee2MQTT Bridge — don't roll up to
  // that; a Zigbee relay (e.g. Shelly 1 Gen4 over Zigbee) IS its own physical relay.
  const tmpl =
    "{%- set ns = namespace(rows=[]) -%}" +
    "{%- for s in states.switch -%}" +
    "{%- set d = device_id(s.entity_id) -%}" +
    "{%- if d -%}" +
    "{%- set p = device_attr(d,'via_device_id') -%}" +
    "{%- set roll = p and device_attr(p,'model') != 'Bridge' and device_attr(p,'manufacturer') != 'Zigbee2MQTT' -%}" +
    "{%- set g = p if roll else d -%}" +
    "{%- set ns.rows = ns.rows + [{'entity_id': s.entity_id, 'name': s.name, 'device_id': g, 'device_name': (device_attr(g,'name_by_user') or device_attr(g,'name'))}] -%}" +
    "{%- endif -%}" +
    "{%- endfor -%}" +
    "{{ ns.rows | tojson }}";
  const out = await haFetch('/api/template', { method: 'POST', body: JSON.stringify({ template: tmpl }) });
  const list = typeof out === 'string' ? JSON.parse(out) : out;
  const byDev = {};
  for (const r of list) {
    const d = (byDev[r.device_id] = byDev[r.device_id] || { device_id: r.device_id, name: r.device_name, outputs: [] });
    if (/(output_\d+|_relay(_\d+)?|_switch)$/i.test(r.entity_id)) d.outputs.push({ entity_id: r.entity_id, name: r.name });
  }
  return Object.values(byDev).filter((d) => d.outputs.length).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Live state for a set of entity_ids.
async function getStates(ids) {
  const out = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        const s = await haFetch(`/api/states/${encodeURIComponent(id)}`);
        out[id] = { state: s.state, unit: (s.attributes || {}).unit_of_measurement || '', last_changed: s.last_changed };
      } catch (e) {
        out[id] = { state: 'unavailable', unit: '', missing: / -> 404/.test(e.message) };
      }
    })
  );
  return out;
}

// 24h numeric history for a sensor (for the sparkline). Returns [{t, v}].
async function getHistory(entity, hours = 24) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600 * 1000);
  const path = `/api/history/period/${start.toISOString()}?filter_entity_id=${encodeURIComponent(entity)}&minimal_response&significant_changes_only&end_time=${encodeURIComponent(end.toISOString())}`;
  const data = await haFetch(path);
  const series = (data && data[0]) || [];
  return series
    .map((p) => ({ t: Date.parse(p.last_changed || p.last_updated), v: parseFloat(p.state) }))
    .filter((p) => isFinite(p.v));
}

// Merged sensor + relay history for CSV export. Returns [{t, temp, state}].
async function getHistoryExport(sensor, relay, hours = 24) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600 * 1000);
  const base = `/api/history/period/${start.toISOString()}?minimal_response&significant_changes_only&end_time=${encodeURIComponent(end.toISOString())}`;
  const [sData, rData] = await Promise.all([
    haFetch(`${base}&filter_entity_id=${encodeURIComponent(sensor)}`),
    relay ? haFetch(`${base}&filter_entity_id=${encodeURIComponent(relay)}`) : Promise.resolve(null),
  ]);
  const sPoints = ((sData && sData[0]) || []).map((p) => ({
    t: Date.parse(p.last_changed || p.last_updated), temp: parseFloat(p.state),
  })).filter((p) => isFinite(p.temp));

  if (!rData) return sPoints.map((p) => ({ ...p, state: '?' }));

  // Build a timeline of relay state changes
  const rSeries = ((rData && rData[0]) || []);
  const states = rSeries.map((p) => ({
    t: Date.parse(p.last_changed || p.last_updated), state: p.state,
  })).sort((a, b) => a.t - b.t);

  // For each sensor point, find the relay state at that time
  let si = 0;
  return sPoints.map((p) => {
    while (si < states.length - 1 && states[si + 1].t <= p.t) si++;
    return { ...p, state: states[si] ? states[si].state : '?' };
  });
}

// Validate a username+password against Home Assistant using its login-flow API
// (the same flow the HA frontend uses). Returns {ok, user} or {ok:false, error}.
async function verifyHaLogin(username, password) {
  const cid = HA_URL.replace(/\/$/, '') + '/';
  const jfetch = async (url, body) => {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 8000);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
      const txt = await res.text();
      try { return JSON.parse(txt); } catch { return { _raw: txt, _status: res.status }; }
    } finally { clearTimeout(to); }
  };

  let sf;
  try { sf = await jfetch(`${HA_URL}/auth/login_flow`, { client_id: cid, handler: ['homeassistant', null], redirect_uri: cid }); }
  catch (e) { console.log('login start error:', e.message); return { ok: false, error: 'cannot reach Home Assistant' }; }
  if (!sf || !sf.flow_id) { console.log('login start bad resp:', JSON.stringify(sf).slice(0, 200)); return { ok: false, error: 'HA login unavailable' }; }

  let r;
  try { r = await jfetch(`${HA_URL}/auth/login_flow/${sf.flow_id}`, { client_id: cid, username, password }); }
  catch (e) { console.log('login submit error:', e.message); return { ok: false, error: 'Home Assistant did not respond' }; }
  console.log('login result for', JSON.stringify(username), '->', r && (r.type || JSON.stringify(r).slice(0, 120)));

  if (r && r.type === 'create_entry') return { ok: true, user: username };
  // abandon the flow, translate the outcome
  fetch(`${HA_URL}/auth/login_flow/${sf.flow_id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: cid }) }).catch(() => {});
  if (r && r.type === 'form' && /mfa|totp|2fa/i.test(r.step_id || '')) return { ok: false, error: 'this account uses 2-factor login (not supported here)' };
  return { ok: false, error: 'invalid username or password' };
}

// Quick reachability check (short of a full states fetch).
async function haReachable() {
  try { await haFetch('/api/'); return true; } catch { return false; }
}

// Device behind an entity (id + name + identifiers + parent) via the template endpoint.
async function getDeviceInfo(entity) {
  const tmpl =
    `{% set d = device_id('${entity}') %}{% set p = device_attr(d,'via_device_id') %}` +
    `{{ {'device_id': d, 'name': device_attr(d,'name'), 'name_by_user': device_attr(d,'name_by_user'), 'identifiers': device_attr(d,'identifiers')|list, ` +
    `'parent_id': p, 'parent_identifiers': (device_attr(p,'identifiers')|list if p else []) } | tojson }}`;
  const out = await haFetch('/api/template', { method: 'POST', body: JSON.stringify({ template: tmpl }) });
  return typeof out === 'string' ? JSON.parse(out) : out;
}

// If the device is a Zigbee2MQTT device, return its IEEE address, else null.
// Z2M device identifiers look like ['mqtt', 'zigbee2mqtt_0x<ieee>'].
function zigbeeIeee(identifiers) {
  for (const pair of identifiers || []) {
    const v = Array.isArray(pair) ? pair[pair.length - 1] : pair;
    const m = /^zigbee2mqtt_(0x[0-9a-fA-F]+)$/.exec(String(v));
    if (m) return m[1];
  }
  return null;
}

// One-shot HA WebSocket command (auth with the token, send, resolve result).
function haWs(type, payload) {
  return new Promise((resolve, reject) => {
    const url = HA_URL.replace(/^http/, 'ws') + '/api/websocket';
    const ws = new WebSocket(url);
    const fin = (fn, v) => { try { ws.close(); } catch {} fn(v); };
    const to = setTimeout(() => fin(reject, new Error('HA WS timeout')), 8000);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }));
      else if (m.type === 'auth_invalid') { clearTimeout(to); fin(reject, new Error('HA WS auth invalid')); }
      else if (m.type === 'auth_ok') ws.send(JSON.stringify({ id: 1, type, ...payload }));
      else if (m.type === 'result') { clearTimeout(to); m.success ? fin(resolve, m.result) : fin(reject, new Error(JSON.stringify(m.error))); }
    });
    ws.on('error', (e) => { clearTimeout(to); fin(reject, e); });
  });
}

// Rename an HA device (user override name).
async function renameHaDevice(deviceId, name) {
  return haWs('config/device_registry/update', { device_id: deviceId, name_by_user: name });
}

// Manually switch a relay on/off/toggle. HA switch services sometimes return a
// transient 500 ("Server got itself in trouble") even though the relay actually
// flipped, so we don't trust the service response — we read back the real state.
async function setSwitch(entity, action) {
  const svc = action === 'on' ? 'turn_on' : action === 'off' ? 'turn_off' : 'toggle';
  try {
    await haFetch(`/api/services/switch/${svc}`, { method: 'POST', body: JSON.stringify({ entity_id: entity }) });
  } catch (e) { /* ignore — verify via state read below */ }
  await new Promise((r) => setTimeout(r, 400)); // let the device settle
  const s = await haFetch(`/api/states/${encodeURIComponent(entity)}`);
  return s.state;
}

// Create/replace an automation, then reload so it takes effect.
async function upsertAutomation(automationId, config) {
  await haFetch(`/api/config/automation/config/${automationId}`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
  await haFetch('/api/services/automation/reload', { method: 'POST', body: '{}' });
}

// Find the automation entity created for a given automation id (HA derives the
// entity_id from the alias, so look it up by the config `id` attribute).
async function findAutomation(automationId) {
  const states = await haFetch('/api/states');
  const a = states.find((s) => s.entity_id.startsWith('automation.') && (s.attributes || {}).id === automationId);
  return a ? { entity_id: a.entity_id, enabled: a.state === 'on' } : null;
}

// Map of every relay-panel automation's config id -> enabled(bool). Lets the UI
// badge relays whose automation is paused for maintenance.
async function listRelayAutomations() {
  const states = await haFetch('/api/states');
  const out = {};
  for (const s of states) {
    if (!s.entity_id.startsWith('automation.')) continue;
    const id = (s.attributes || {}).id;
    if (typeof id === 'string' && id.startsWith('relaypanel_')) out[id] = s.state === 'on';
  }
  return out;
}

// Enable/disable an automation at runtime (maintenance disable, non-destructive).
async function setAutomationEnabled(entity, enabled) {
  await haFetch(`/api/services/automation/${enabled ? 'turn_on' : 'turn_off'}`,
    { method: 'POST', body: JSON.stringify({ entity_id: entity }) });
  const s = await haFetch(`/api/states/${encodeURIComponent(entity)}`);
  return s.state === 'on';
}

async function deleteAutomation(automationId) {
  try {
    await haFetch(`/api/config/automation/config/${automationId}`, { method: 'DELETE' });
    await haFetch('/api/services/automation/reload', { method: 'POST', body: '{}' });
  } catch (e) {
    // already gone is fine
  }
}

// Build a thermostat-style binding. Single setpoint by default (deadband 0):
//   heat (mode 'below'): ON while temp <= target, OFF when temp > target
//   cool (mode 'above'): ON while temp >= target, OFF when temp < target
// Optional hysteresis (deadband > 0) shifts the ON point away from the target so
// it won't switch back until the temp drifts a bit (avoids chatter near the line).
// Re-evaluates on sensor change AND every 5 min (so it self-corrects reliably).
// "HH:MM" -> minutes since midnight (clamped 0..1440)
function hhmmToMin(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  return Math.min(1440, Math.max(0, (+m[1]) * 60 + (+m[2])));
}

// Build the Jinja lines that compute `ns.t` = the effective target right now,
// from a schedule ({ blocks:[{days:[1..7], start:"HH:MM", end:"HH:MM", temp}], fallback }).
// Returns null when there is no usable schedule (caller uses the fixed target).
function scheduleTargetSetup(schedule, fixedTarget) {
  if (!schedule || !Array.isArray(schedule.blocks) || !schedule.blocks.length) return null;
  const fb = Number(schedule.fallback);
  const fallback = isFinite(fb) ? fb : Number(fixedTarget);
  let out = `{% set ns = namespace(t = ${fallback}) %}` +
    `{% set c = now().hour*60 + now().minute %}{% set d = now().isoweekday() %}`;
  let used = 0;
  for (const b of schedule.blocks) {
    const s = hhmmToMin(b.start), e = hhmmToMin(b.end), tp = Number(b.temp);
    const days = (Array.isArray(b.days) ? b.days : []).map(Number).filter((x) => x >= 1 && x <= 7);
    if (s == null || e == null || !isFinite(tp) || !days.length) continue;
    // overnight block (end <= start) wraps past midnight
    const within = e > s ? `c >= ${s} and c < ${e}` : `(c >= ${s} or c < ${e})`;
    out += `{% if d in ${JSON.stringify(days)} and ${within} %}{% set ns.t = ${tp} %}{% endif %}`;
    used++;
  }
  return used ? out : null;
}

function buildAutomation({ id, alias, sensor, relay, mode, temp, deadband = 0, schedule = null, min_on = 0, min_off = 0 }) {
  const heat = mode !== 'above';
  const target = Number(temp);
  const band = Math.max(0, Number(deadband) || 0);
  const mo = Math.max(0, Number(min_on) || 0), mf = Math.max(0, Number(min_off) || 0);
  // effective target: from a runtime-evaluated schedule, or the fixed number
  const setup = scheduleTargetSetup(schedule, target);
  const tgt = setup ? 'ns.t' : String(target);
  const onCond = heat ? `<= ${tgt} - ${band}` : `>= ${tgt} + ${band}`;
  const offCond = heat ? `>= ${tgt}` : `<= ${tgt}`;
  // SAFETY: only act on a valid numeric reading. If the sensor is unavailable/
  // unknown (device offline), fail to OFF — never leave a heater running because
  // states()|float(-999) looked "below target".
  const valid = `is_number(states('${sensor}'))`;
  // schedule setup uses {% %} statements, which must go BEFORE the {{ }} output.
  const cond = (cmp) => `${setup || ''}{{ ${valid} and states('${sensor}')|float ${cmp} }}`;
  // anti-short-cycle: relay must be off long enough before turning on, and on
  // long enough before turning off
  const lastChanged = `states.${relay}.last_changed`;
  const sinceChanged = `now()|as_timestamp - as_timestamp(${lastChanged})`;
  const onConditions = [];
  if (mf > 0) onConditions.push({ condition: 'template', value_template: `{{ ${sinceChanged} >= ${mf * 60} }}` });
  onConditions.push({ condition: 'template', value_template: cond(onCond) });
  const offConditions = [];
  if (mo > 0) offConditions.push({ condition: 'template', value_template: `{{ ${sinceChanged} >= ${mo * 60} }}` });
  offConditions.push({ condition: 'template', value_template: cond(offCond) });

  return {
    id,
    alias,
    description: 'Managed by relay-panel',
    mode: 'single',
    triggers: [
      { trigger: 'state', entity_id: [sensor] },
      { trigger: 'time_pattern', minutes: '/5' },
    ],
    conditions: [],
    actions: [
      {
        choose: [
          {
            // failsafe: sensor not a valid number -> force OFF
            conditions: [{ condition: 'template', value_template: `{{ not ${valid} }}` }],
            sequence: [{ action: 'switch.turn_off', target: { entity_id: relay } }],
          },
          {
            conditions: onConditions,
            sequence: [{ action: 'switch.turn_on', target: { entity_id: relay } }],
          },
          {
            conditions: offConditions,
            sequence: [{ action: 'switch.turn_off', target: { entity_id: relay } }],
          },
        ],
      },
    ],
  };
}

// Send a notification via HA's notify.<service> REST API.
async function sendNotification(service, message, title) {
  const svc = service.startsWith('notify.') ? service.slice(7) : service;
  await haFetch(`/api/services/notify/${encodeURIComponent(svc)}`, {
    method: 'POST',
    body: JSON.stringify({ message, title: title || 'Relay Panel' }),
  });
}

module.exports = {
  HA_URL,
  getEntities,
  getAreas,
  getRelayDevices,
  getStates,
  getHistory,
  getHistoryExport,
  haReachable,
  verifyHaLogin,
  setSwitch,
  getDeviceInfo,
  zigbeeIeee,
  renameHaDevice,
  upsertAutomation,
  deleteAutomation,
  findAutomation,
  listRelayAutomations,
  setAutomationEnabled,
  buildAutomation,
  sendNotification,
};
