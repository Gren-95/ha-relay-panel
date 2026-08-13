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
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 15000); // #63 — don't hang forever if HA is down
  try {
    const res = await fetch(`${HA_URL}${path}`, { ...opts, headers: headers(), signal: ac.signal });
    clearTimeout(to);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HA ${opts.method || 'GET'} ${path} -> ${res.status} ${body.slice(0, 200)}`);
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  } catch (e) {
    clearTimeout(to);
    if (e.name === 'AbortError') throw new Error(`HA ${opts.method || 'GET'} ${path} -> timed out after 15s`, { cause: e });
    throw e;
  }
}

// All states, split into switches (relays) and temperature sensors.
async function getEntities() {
  const states = await haFetch('/api/states');
  // A climate sensor reports temperature and humidity as two entities,
  // sensor.<base>_temperature and sensor.<base>_humidity. A base with both is a
  // "combo" sensor — the facility map plots those as a single marker, so the card
  // can offer a link to it. Collected up-front: humidity may come after its partner.
  const humidityBases = new Set();
  for (const s of states) {
    const m = /^sensor\.(.+)_humidity$/.exec(s.entity_id);
    if (m) humidityBases.add(m[1]);
  }
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
        /^°?[CF]$/.test((attr.unit_of_measurement || '').trim()))
    ) {
      const base = (/^sensor\.(.+)_temperature$/.exec(s.entity_id) || [])[1];
      sensors.push({
        entity_id: s.entity_id,
        name,
        state: s.state,
        unit: attr.unit_of_measurement || '°C',
        // the map identifier, absent for temperature-only sensors
        ...(base && humidityBases.has(base) ? { combo: base } : {}),
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
    "{%- set ns.rows = ns.rows + [{'entity_id': s.entity_id, 'name': s.name, 'device_id': g, 'device_name': (device_attr(g,'name_by_user') or device_attr(g,'name')), 'url': device_attr(g,'configuration_url')}] -%}" +
    "{%- endif -%}" +
    "{%- endfor -%}" +
    "{{ ns.rows | tojson }}";
  const out = await haFetch('/api/template', { method: 'POST', body: JSON.stringify({ template: tmpl }) });
  const list = typeof out === 'string' ? JSON.parse(out) : out;
  const byDev = {};
  for (const r of list) {
    const d = (byDev[r.device_id] = byDev[r.device_id] || { device_id: r.device_id, name: r.device_name, url: r.url || '', outputs: [] });
    if (/(output_\d+|_relay(_\d+)?|_switch)$/i.test(r.entity_id)) d.outputs.push({ entity_id: r.entity_id, name: r.name });
  }
  return Object.values(byDev).filter((d) => d.outputs.length).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Live state for a set of entity_ids.
// Single HA fetch returning both live states and automation map.
// Merges what used to be two separate haFetch('/api/states') calls per poll tick
// (getStates + listRelayAutomations) into one — issue #48.
async function getStatesAndAutomations(ids) {
  const idSet = new Set(ids);
  const out = {};
  const autos = {};
  try {
    const all = await haFetch('/api/states');
    for (const s of all) {
      if (idSet.has(s.entity_id)) {
        out[s.entity_id] = { state: s.state, unit: (s.attributes || {}).unit_of_measurement || '', last_changed: s.last_changed };
      }
      if (s.entity_id.startsWith('automation.')) {
        const aid = (s.attributes || {}).id;
        if (typeof aid === 'string' && aid.startsWith('relaypanel_')) autos[aid] = s.state === 'on';
      }
    }
  } catch {
    for (const id of ids) out[id] = { state: 'unavailable', unit: '', missing: true };
  }
  for (const id of ids) {
    if (!out[id]) out[id] = { state: 'unavailable', unit: '', missing: true };
  }
  return { states: out, automations: autos };
}

async function getStates(ids) {
  const idSet = new Set(ids);
  const out = {};
  // Fetch all states in one call, then filter to the requested IDs
  try {
    const all = await haFetch('/api/states');
    for (const s of all) {
      if (idSet.has(s.entity_id)) {
        out[s.entity_id] = { state: s.state, unit: (s.attributes || {}).unit_of_measurement || '', last_changed: s.last_changed };
      }
    }
  } catch {
    // If the bulk fetch fails, mark all requested IDs as unavailable
    for (const id of ids) out[id] = { state: 'unavailable', unit: '', missing: true };
  }
  // Any ID not found in the response was removed/renamed
  for (const id of ids) {
    if (!out[id]) out[id] = { state: 'unavailable', unit: '', missing: true };
  }
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
    .filter((p) => isFinite(p.t) && isFinite(p.v));
}

// Merged sensor + relay history for CSV export. Returns [{t, temp, state}].
async function getHistoryExport(sensor, relay, hours = 24, startDate, endDate) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - hours * 3600 * 1000);
  const base = `/api/history/period/${start.toISOString()}?minimal_response&significant_changes_only&end_time=${encodeURIComponent(end.toISOString())}`;
  const [sData, rData] = await Promise.all([
    haFetch(`${base}&filter_entity_id=${encodeURIComponent(sensor)}`),
    relay ? haFetch(`${base}&filter_entity_id=${encodeURIComponent(relay)}`) : Promise.resolve(null),
  ]);
  const sPoints = ((sData && sData[0]) || []).map((p) => ({
    t: Date.parse(p.last_changed || p.last_updated), temp: parseFloat(p.state),
  })).filter((p) => isFinite(p.t) && isFinite(p.temp));

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
  catch { return { ok: false, error: 'cannot reach Home Assistant' }; }
  if (!sf || !sf.flow_id) { return { ok: false, error: 'HA login unavailable' }; }

  // Always delete the login flow when we're done with it — even on exceptions (#49)
  const deleteFlow = () => fetch(`${HA_URL}/auth/login_flow/${sf.flow_id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: cid }) }).catch(() => {});

  let r;
  try { r = await jfetch(`${HA_URL}/auth/login_flow/${sf.flow_id}`, { client_id: cid, username, password }); }
  catch { deleteFlow(); return { ok: false, error: 'Home Assistant did not respond' }; }

  if (r && r.type === 'create_entry') return { ok: true, user: username };
  // abandon the flow, translate the outcome
  deleteFlow();
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
  } catch { /* ignore — verify via state read below */ }
  await new Promise((r) => setTimeout(r, 400)); // let the device settle
  try {
    const s = await haFetch(`/api/states/${encodeURIComponent(entity)}`);
    return s.state;
  } catch { return 'unavailable'; } // entity was removed/renamed
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
  } catch {
    // already gone is fine
  }
}

// Delete every `relaypanel_*` automation in HA that no longer has a bound relay
// behind it. Deleting a card/device/area only rewrites the layout JSON, so without
// this the old automation keeps running against the same physical switch on its
// old sensor and setpoint, fighting whatever binding replaced it (#84).
// `keepIds` empty means the board is empty or unreadable - never answer that by
// wiping every automation, so bail out instead.
async function pruneOrphanAutomations(keepIds) {
  if (!keepIds || !keepIds.size) return [];
  const orphans = Object.keys(await listRelayAutomations()).filter((id) => !keepIds.has(id));
  for (const id of orphans) {
    try {
      await haFetch(`/api/config/automation/config/${id}`, { method: 'DELETE' });
    } catch { /* already gone is fine */ }
  }
  // One reload for the whole batch, not one per delete.
  if (orphans.length) {
    try {
      await haFetch('/api/services/automation/reload', { method: 'POST', body: '{}' });
    } catch { /* the deletes landed; HA reloads on its own schedule too */ }
  }
  return orphans;
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
  // #61 — block Jinja injection through stored entity strings from layout/reapply
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(String(sensor || ''))) throw new Error('invalid sensor entity');
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(String(relay || ''))) throw new Error('invalid relay entity');
  const isAuto = mode === 'auto';
  const heat = !isAuto && mode !== 'above'; // below = heat, above = cool, auto = both
  const target = Number(temp);
  const band = Math.max(0, Number(deadband) || 0);
  const mo = Math.max(0, Number(min_on) || 0), mf = Math.max(0, Number(min_off) || 0);
  // effective target: from a runtime-evaluated schedule, or the fixed number
  const setup = scheduleTargetSetup(schedule, target);
  const tgt = setup ? 'ns.t' : String(target);
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

  function makeOnCond(cmp) {
    const c = [];
    if (mf > 0) c.push({ condition: 'template', value_template: `{{ ${sinceChanged} >= ${mf * 60} }}` });
    c.push({ condition: 'template', value_template: cond(cmp) });
    return c;
  }
  function makeOffCond(cmp) {
    const c = [];
    if (mo > 0) c.push({ condition: 'template', value_template: `{{ ${sinceChanged} >= ${mo * 60} }}` });
    c.push({ condition: 'template', value_template: cond(cmp) });
    return c;
  }

  let offCond;
  if (isAuto) offCond = `>= ${tgt}`;
  else if (heat) offCond = `>= ${tgt}`;
  else offCond = `<= ${tgt}`;

  const chooseBranches = [
    {
      // failsafe: sensor not a valid number -> force OFF
      conditions: [{ condition: 'template', value_template: `{{ not ${valid} }}` }],
      sequence: [{ action: 'switch.turn_off', target: { entity_id: relay } }],
    },
  ];

  if (isAuto) {
    // Auto mode: heating-only — turn ON when too cold, OFF when at/above target
    chooseBranches.push({
      conditions: makeOnCond(`< ${tgt} - ${band}`),
      sequence: [{ action: 'switch.turn_on', target: { entity_id: relay } }],
    });
  } else {
    const onCond = heat ? `<= ${tgt} - ${band}` : `>= ${tgt} + ${band}`;
    chooseBranches.push({
      conditions: makeOnCond(onCond),
      sequence: [{ action: 'switch.turn_on', target: { entity_id: relay } }],
    });
  }
  chooseBranches.push({
    conditions: makeOffCond(offCond),
    sequence: [{ action: 'switch.turn_off', target: { entity_id: relay } }],
  });

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
    actions: [ { choose: chooseBranches } ],
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
  getStatesAndAutomations,
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
  pruneOrphanAutomations,
  findAutomation,
  listRelayAutomations,
  setAutomationEnabled,
  buildAutomation,
  sendNotification,
};
