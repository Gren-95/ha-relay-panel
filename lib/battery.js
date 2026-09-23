// Battery alert rules: pure helpers (no I/O, unit-tested in tests/unit/battery.test.js).

const MAX_THRESHOLD = 30;
const DEFAULT_THRESHOLD = 20;
// A battery only counts as recovered once it is this far above the threshold, so a
// reading that wobbles around the line (20 -> 21 -> 20) does not mail every swing.
const RECOVER_MARGIN = 10;
const MAX_RECIPIENTS = 20;

const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  threshold: DEFAULT_THRESHOLD,
  recipients: [],
  exclude: [],
  smtp: { host: '', port: 25, security: 'none', user: '', pass: '', from: '' },
});

const EMAIL_RE = /^[^\s@<>,;:"()[\]\\]+@[^\s@<>,;:"()[\]\\]+\.[^\s@<>,;:"()[\]\\]+$/;
const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;
const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const SECURITY = ['none', 'starttls', 'tls'];

function badRequest(msg) { return Object.assign(new Error(msg), { status: 400 }); }

function withDefaults(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  return {
    ...DEFAULT_CONFIG,
    ...c,
    recipients: Array.isArray(c.recipients) ? c.recipients : [],
    exclude: Array.isArray(c.exclude) ? c.exclude : [],
    smtp: { ...DEFAULT_CONFIG.smtp, ...(c.smtp && typeof c.smtp === 'object' ? c.smtp : {}) },
  };
}

function parseRecipients(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/);
  const out = [];
  for (const raw of list) {
    const e = String(raw || '').trim();
    if (!e) continue;
    if (!EMAIL_RE.test(e) || e.length > 254) throw badRequest(`not an email address: ${e.slice(0, 80)}`);
    if (!out.some((x) => x.toLowerCase() === e.toLowerCase())) out.push(e);
  }
  if (out.length > MAX_RECIPIENTS) throw badRequest(`at most ${MAX_RECIPIENTS} recipients`);
  return out;
}

// Validate a settings form against the stored config. The SMTP password is never
// sent to the browser, so an empty one means "keep what is stored" unless the form
// explicitly asks to clear it.
function sanitizeConfig(input, stored) {
  const b = input && typeof input === 'object' ? input : {};
  const prev = withDefaults(stored);
  const s = b.smtp && typeof b.smtp === 'object' ? b.smtp : {};

  const threshold = Number(b.threshold);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > MAX_THRESHOLD) {
    throw badRequest(`threshold must be a whole number from 0 to ${MAX_THRESHOLD}`);
  }
  const host = String(s.host || '').trim();
  if (host && !HOST_RE.test(host)) throw badRequest('SMTP server must be a host name or IP address');
  const port = s.port === '' || s.port == null ? 25 : Number(s.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw badRequest('SMTP port must be 1-65535');
  const security = SECURITY.includes(s.security) ? s.security : 'none';
  const from = String(s.from || '').trim();
  if (from && !EMAIL_RE.test(from)) throw badRequest('sender must be an email address');
  const user = String(s.user || '').trim().slice(0, 190);
  const newPass = typeof s.pass === 'string' ? s.pass : '';
  if (newPass.length > 256) throw badRequest('password too long');
  const pass = b.clearPass ? '' : (newPass || prev.smtp.pass || '');

  const exclude = (Array.isArray(b.exclude) ? b.exclude : [])
    .map(String).filter((id) => ENTITY_RE.test(id)).slice(0, 500);

  const cfg = {
    enabled: !!b.enabled,
    threshold,
    recipients: parseRecipients(b.recipients),
    exclude: [...new Set(exclude)],
    smtp: { host, port, security, user, pass, from },
  };
  if (cfg.enabled) assertSendable(cfg);
  return cfg;
}

function assertSendable(cfg) {
  if (!cfg.smtp.host) throw badRequest('set the SMTP server first');
  if (!cfg.smtp.from) throw badRequest('set the sender address first');
  if (!cfg.recipients.length) throw badRequest('add at least one recipient');
}

// What the browser may see: everything but the password.
function publicConfig(cfg) {
  const c = withDefaults(cfg);
  const { pass, ...smtp } = c.smtp;
  return { ...c, smtp: { ...smtp, hasPass: !!pass } };
}

const UNUSABLE = new Set(['unavailable', 'unknown', '', 'none']);

// Every battery entity in HA: percentage sensors and the binary "battery low" kind.
function batteryEntities(states) {
  const out = [];
  for (const s of states || []) {
    const a = s.attributes || {};
    if (a.device_class !== 'battery') continue;
    const [domain] = String(s.entity_id).split('.');
    const name = a.friendly_name || s.entity_id;
    const offline = UNUSABLE.has(String(s.state).toLowerCase());
    if (domain === 'sensor') {
      const level = Number(s.state);
      if (!offline && !Number.isFinite(level)) continue; // e.g. a text "charging" state
      out.push({ entity_id: s.entity_id, name, kind: 'percent', level: offline ? null : level, offline });
    } else if (domain === 'binary_sensor') {
      out.push({ entity_id: s.entity_id, name, kind: 'binary', level: offline ? null : s.state === 'on', offline });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

function isLow(b, threshold) {
  if (b.offline) return false;
  return b.kind === 'binary' ? b.level === true : b.level <= threshold;
}

function isRecovered(b, threshold) {
  if (b.offline) return false;
  return b.kind === 'binary' ? b.level === false : b.level >= Math.min(100, threshold + RECOVER_MARGIN);
}

// Compare the current readings with what has already been reported. `prevLow` maps
// entity_id -> { level, since }. Offline entities keep whatever state they had, so a
// sensor dropping off the network neither alerts nor clears.
function evaluate(batteries, cfg, prevLow) {
  const threshold = cfg.threshold;
  const exclude = new Set(cfg.exclude || []);
  const prev = prevLow && typeof prevLow === 'object' ? prevLow : {};
  const seen = new Set();
  const low = {};
  const newlyLow = [];
  const recovered = [];
  const now = Date.now();
  for (const b of batteries) {
    if (exclude.has(b.entity_id)) continue;
    seen.add(b.entity_id);
    const was = prev[b.entity_id];
    if (was) {
      if (isRecovered(b, threshold)) recovered.push(b);
      else low[b.entity_id] = was;
    } else if (isLow(b, threshold)) {
      newlyLow.push(b);
      low[b.entity_id] = { level: b.level, since: now };
    }
  }
  return { low, newlyLow, recovered, dropped: Object.keys(prev).filter((id) => !seen.has(id)) };
}

function fmtLevel(b) {
  if (b.kind === 'binary') return b.level ? 'LOW' : 'OK';
  return `${b.level}%`;
}

function buildEmail({ newlyLow, recovered }, cfg) {
  const lines = [];
  if (newlyLow.length) {
    lines.push(`These batteries are at or below ${cfg.threshold}%:`, '');
    for (const b of newlyLow) lines.push(`  ${fmtLevel(b).padEnd(5)} ${b.name}  (${b.entity_id})`);
    lines.push('');
  }
  if (recovered.length) {
    lines.push('These batteries are back to normal (probably replaced):', '');
    for (const b of recovered) lines.push(`  ${fmtLevel(b).padEnd(5)} ${b.name}  (${b.entity_id})`);
    lines.push('');
  }
  lines.push('--', 'Sent by Relay Panel. Change the threshold or recipients under More > Battery alerts.');
  let subject;
  if (newlyLow.length) {
    subject = newlyLow.length === 1
      ? `Low battery: ${newlyLow[0].name} (${fmtLevel(newlyLow[0])})`
      : `Low battery: ${newlyLow.length} devices at or below ${cfg.threshold}%`;
  } else {
    subject = recovered.length === 1
      ? `Battery OK again: ${recovered[0].name}`
      : `Battery OK again: ${recovered.length} devices`;
  }
  return { subject: `[Relay Panel] ${subject}`, text: lines.join('\n') };
}

module.exports = {
  DEFAULT_CONFIG, MAX_THRESHOLD, DEFAULT_THRESHOLD, RECOVER_MARGIN,
  withDefaults, sanitizeConfig, assertSendable, publicConfig, parseRecipients,
  batteryEntities, isLow, evaluate, buildEmail,
};
