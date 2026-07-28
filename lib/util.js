// Pure helpers shared across routes (no I/O, easy to unit-test).

// Turn an arbitrary string into a safe automation/config id fragment.
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

// Strict entity_id validator to prevent Jinja template injection in HA queries.
const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const validEntity = (id) => ENTITY_RE.test(String(id || ''));

module.exports = { slug, sanitizeSchedule, validEntity };
