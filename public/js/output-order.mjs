// Pure helpers for a physical relay's output list: ordering and config swapping.
//
// Kept free of DOM and app-state imports so the unit tests can import this file
// directly (tests/unit/output-order.test.js). The flat `state.layout.relays` array
// is shared by every device on the board, so the ordering helpers put the device's
// entries back into the same slots they occupied — moving one output never shifts
// another device's cards.

// The fields that make up an output's "config" — what a swap moves between two
// channels. Everything else on the entry (`relay`, `bound`, `automationId`,
// `device`, `area`, `name`, `x`, `y`, `z`) belongs to the channel and stays put.
// `name` deliberately stays with the channel: it is the label of the physical
// output (the thing printed on the contactor), not a setting of the loop.
const CONFIG_FIELDS = [
  'sensor', 'mode', 'temp', 'deadband', 'min_on', 'min_off',
  'notify', 'notify_deviation', 'schedule',
];

const outputsOf = (relays, deviceId) => relays.filter((r) => r.device === deviceId);

// Slots the device's outputs occupy in the flat array, in array order.
function outputSlots(relays, deviceId) {
  const slots = [];
  relays.forEach((r, i) => { if (r.device === deviceId) slots.push(i); });
  return slots;
}

// Move one output from index `from` to index `to` among the device's own outputs.
// Out-of-range or no-op moves return an unchanged copy.
function moveOutput(relays, deviceId, from, to) {
  const slots = outputSlots(relays, deviceId);
  const n = slots.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return relays.slice();
  const outs = slots.map((i) => relays[i]);
  const [moved] = outs.splice(from, 1);
  outs.splice(to, 0, moved);
  const next = relays.slice();
  slots.forEach((slot, k) => { next[slot] = outs[k]; });
  return next;
}

// Apply a complete id order to the device's outputs. Returns an unchanged copy
// when the ids do not describe exactly the device's current outputs (a stale
// draft, e.g. an output added from another client while the panel was open).
function applyOrder(relays, deviceId, ids) {
  const slots = outputSlots(relays, deviceId);
  const byId = new Map(relays.map((r) => [r.id, r]));
  const outs = (ids || []).map((id) => byId.get(id)).filter((r) => r && r.device === deviceId);
  if (outs.length !== slots.length) return relays.slice();
  const next = relays.slice();
  slots.forEach((slot, k) => { next[slot] = outs[k]; });
  return next;
}

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

// Why a swap would be refused, or null when it is allowed. Split out so the panel
// can check before asking for confirmation — a refused swap must not mutate first.
function swapRefusal(a, b) {
  if (!a || !b) return 'missing';
  if (a === b) return 'same';
  if (a.bound || b.bound) return 'bound';
  if (!a.relay || !b.relay) return 'no_relay';
  return null;
}

// Swap the config of two outputs. Refuses when either output is bound: its
// generated automation is keyed to that channel, so moving the config would leave
// the automation driving the wrong physical contactor. Refuses when either has no
// relay entity, since there is nothing to swap onto.
function swapConfigs(a, b) {
  const reason = swapRefusal(a, b);
  if (reason) return { ok: false, reason };
  for (const f of CONFIG_FIELDS) {
    const tmp = a[f];
    a[f] = clone(b[f]);
    b[f] = clone(tmp);
  }
  return { ok: true };
}

export { CONFIG_FIELDS, outputsOf, outputSlots, moveOutput, applyOrder, swapRefusal, swapConfigs };
