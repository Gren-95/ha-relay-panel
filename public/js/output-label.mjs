// Output-number labels for the "Relay to switch" select (#111).
//
// The board card derives the channel from the entity id; this keeps that derivation
// in one place. Pure (no DOM, no app state) so the unit tests import it directly.
//
// The label says which physical relay and which output: "TM_liin (prodk1_r1 Output 0)".
// The device name is what HA calls the box, so a row tells you both the friendly name
// and the contactor behind it.

const OUTPUT_ID_RE = /_output_(\d+)$/;
// HA's default name for an output nobody renamed: "<device> Output N".
const NAMED_RE = /(?:output|väljund)\s+(\d+)\s*$/i;

// The output number in an entity id, or null when the id carries none.
function outputNum(entityId) {
  const m = String(entityId || '').match(OUTPUT_ID_RE);
  return m ? Number(m[1]) : null;
}

// "Name (Device Output N)". `opts.device` is the physical relay's name from HA (may be
// empty when HA has no device for the entity); `opts.format` turns the number into the
// word to show, so the suffix is translated ("Output 0" / "Väljund 0").
//
// A name that is only HA's default ("shellypro3-abc123 Output 2") adds nothing beside
// the device name — its prefix is the device's own hash — so the label becomes
// "prodk1_r2 Output 2" instead of repeating itself.
function outputLabel(name, entityId, opts = {}) {
  const device = opts.device || '';
  const format = opts.format;
  const n = outputNum(entityId);
  if (n == null) return name || '';

  const word = format ? format(n) : `Output ${n}`;
  const channel = device ? `${device} ${word}` : word;
  const clean = String(name || '');
  // No friendly name at all: the device + output is more use than "(Output 0)".
  if (!clean) return device ? channel : String(entityId || '');

  // Checked first: a name that already says the channel verbatim is left alone, even
  // when it differs only in case from the canonical form.
  if (clean && clean.toLowerCase().endsWith(channel.toLowerCase())) return clean;
  const m = clean.match(NAMED_RE);
  if (m && Number(m[1]) === n) return device ? channel : clean;   // HA's default name
  return `${clean} (${channel})`;
}

// True when the name is only HA's default for this entity ("shellypro3-abc123 Output 2"):
// the device's own slug plus the output number. A relay renamed on the board keeps that
// default on the entity, so the board's name is the one worth showing.
function isDefaultOutputName(name, entityId) {
  const n = outputNum(entityId);
  if (n == null || !name) return false;
  const m = String(name).match(/^(.*?)\s+(?:output|väljund)\s+(\d+)\s*$/i);
  if (!m || Number(m[2]) !== n) return false;
  const slug = String(entityId).replace(/^switch\./, '').replace(new RegExp(`_output_${n}$`), '');
  const norm = (s) => s.toLowerCase().replace(/[-_]/g, '');
  return norm(m[1]) === norm(slug);
}

export { outputNum, outputLabel, isDefaultOutputName };
