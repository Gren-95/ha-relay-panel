// Pure helpers shared across routes (no I/O, easy to unit-test).

// Turn an arbitrary string into a safe automation/config id fragment.
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 60);

// The automation id a relay widget owns. Must match the id built in the bind route.
const automationIdFor = (rid) => `relaypanel_${slug(rid)}`;

// Every automation id the board legitimately owns right now. Anything else under
// the `relaypanel_` prefix in HA is an orphan: a binding whose card, device box or
// area was deleted, still driving its physical switch off its old sensor.
// `automationId` is kept as well as the derived id - older bindings stored one.
function boundAutomationIds(layout) {
  const out = new Set();
  for (const r of (layout && layout.relays) || []) {
    if (!r || !r.bound || !r.relay || !r.sensor) continue;
    out.add(automationIdFor(r.id));
    if (typeof r.automationId === 'string' && r.automationId) out.add(r.automationId);
  }
  return out;
}

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

// Strict entity_id validator to prevent Jinja template injection in HA queries.
const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const validEntity = (id) => ENTITY_RE.test(String(id || ''));

module.exports = { slug, sanitizeSchedule, validEntity, automationIdFor, boundAutomationIds };
