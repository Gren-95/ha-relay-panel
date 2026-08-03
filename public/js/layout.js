import { state, $, esc } from './core.js';

function fillSelects() {
  const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
  $('#ed-relay').innerHTML = opt('', '— pick relay —') + state.entities.switches.map((s) => opt(s.entity_id, s.name)).join('');
  $('#ed-sensor').innerHTML = opt('', '— pick sensor —') + state.entities.sensors.map((s) => opt(s.entity_id, s.name)).join('');
  $('#ed-area').innerHTML = opt('', '— none —') + state.haAreas.map((a) => opt(a.id, a.name)).join('');
  $('#device-picker').innerHTML = opt('', '+ Physical relay…') +
    state.relayDevices.map((d) => opt(d.device_id, `${d.name} (${d.outputs.length})`)).join('');
  refreshAreaPicker();
}

// Area picker: already-placed areas shown disabled (can't add the same area twice).
function refreshAreaPicker() {
  const placed = new Set((state.layout.areas || []).map((a) => a.areaId));
  $('#area-picker').innerHTML = '<option value="">+ Area…</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}"${placed.has(a.id) ? ' disabled' : ''}>${esc(a.name)}${placed.has(a.id) ? ' ✓' : ''}</option>`).join('');
}

function areaColor(id) {
  let h = 0; const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
function areaName(id) { const a = state.haAreas.find((x) => x.id === id); return a ? a.name : id; }
// readable header colour for area/device boxes: dark on light theme, light on dark
function headColor(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark ? `hsl(${hue},65%,68%)` : `hsl(${hue},55%,32%)`;
}
function boxTint(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return `hsla(${hue},55%,45%,${dark ? 0.07 : 0.10})`;
}
// the titlebar sits on top of boxTint, so it needs a stronger wash to read as a bar
function headTint(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return `hsla(${hue},55%,45%,${dark ? 0.16 : 0.18})`;
}
// A box paints its own dot grid in its body, so it must be opaque — otherwise the
// canvas grid bleeds through and the two misaligned grids moiré against each other.
// Flattens a translucent tint onto the surface colour.
const opaque = (tint) => `linear-gradient(0deg, ${tint}, ${tint}), var(--surface-2)`;
// the body of a group box is its own little canvas: dot grid over the opaque tint
const bodyFill = (tint) => `radial-gradient(var(--dot) 1.4px, transparent 1.4px) 0 0 / 26px 26px, ${opaque(tint)}`;

// Dashed outline down the left, along the bottom and up the right of a w×h box.
// CSS `border-dashed` derives both dash and gap from the border width, so widening
// the gap means drawing the line ourselves: an SVG stroke with a real dash-array,
// emitted at the box's exact pixel size so the pattern is never stretched.
const DASH_LEN = 10, DASH_GAP = 10, DASH_W = 2, DASH_R = 18;  // radius = rounded-b-2xl (19) - half stroke
function dashedSides(w, h, color) {
  const o = DASH_W / 2, r = DASH_R;
  const d = `M${o},0 V${h - o - r} A${r},${r} 0 0 0 ${o + r},${h - o}`
    + ` H${w - o - r} A${r},${r} 0 0 0 ${w - o},${h - o - r} V0`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
    + `<path d="${d}" fill="none" stroke="${color}" stroke-width="${DASH_W}"`
    + ` stroke-dasharray="${DASH_LEN} ${DASH_GAP}"/></svg>`;
  // single quotes: this lands inside an HTML style="..." attribute, and a double
  // quote here would terminate the attribute and drop the whole declaration.
  // encodeURIComponent escapes the SVG's own double quotes, so none survive.
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
}

// --- box geometry ------------------------------------------------------------
// Single source of truth for the board's pixel math. Two of these mirror the DOM
// and must be kept in sync with it:
//   CARD_W/CARD_H — the .relay size in card.js (`w-[340px] h-[100px]`)
//   HDR           — the height of the .area-head titlebar (board.js): a 40px row
//                   plus its own 2px solid border top and bottom. The .area-body
//                   canvas starts exactly there, so HDR is where content begins.
// Everything a box contains lives below HDR and inside PAD on the other three
// sides, so no child can ever overlap the titlebar or bleed past an edge.
const CARD_W = 340, CARD_H = 100;
const GAP = 10;                      // vertical gap between stacked cards / boxes
const PAD = 10;                      // inner padding of a group box
const HDR = 44;                      // titlebar strip height
const DEV_W = CARD_W + 2 * PAD;      // a device box is exactly one card column wide
const MIN_AREA_W = DEV_W + 2 * PAD;  // an area must be able to hold a device box
const MIN_AREA_H = HDR + CARD_H + 2 * PAD;
// Coordinates must never fall back through `||`: x = 0 is a legal position, and
// `x || 20` silently renders such a box 20px away from where the containment math
// believes it is — which is exactly how members end up sticking out of an area.
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
// top-left corner of a box's usable inner area (below the titlebar)
const innerX = (b) => num(b.x) + PAD;
const innerY = (b) => num(b.y) + HDR + PAD;

function boxFor(r) {
  if (r.device) { const d = state.layout.devices.find((x) => x.id === r.device); if (d) return d; }
  return r.area ? state.layout.areas.find((a) => a.areaId === r.area) : null;
}

// Clamp a w×h child so it stays fully inside `box` (all four edges).
function clampInto(pos, w, h, box) {
  const minX = innerX(box), maxX = Math.max(minX, num(box.x) + num(box.w) - w - PAD);
  const minY = innerY(box), maxY = Math.max(minY, num(box.y) + num(box.h) - h - PAD);
  pos.x = Math.min(Math.max(num(pos.x), minX), maxX);
  pos.y = Math.min(Math.max(num(pos.y), minY), maxY);
}
const clampToBox = (r, box) => clampInto(r, CARD_W, CARD_H, box);
const clampBoxToArea = (d, a) => clampInto(d, num(d.w, DEV_W), num(d.h, MIN_AREA_H), a);

function centerInBox(r, box) {
  r.x = Math.round(num(box.x) + (num(box.w) - CARD_W) / 2);
  r.y = Math.round(innerY(box) + (num(box.h) - HDR - PAD - CARD_H) / 2);
  clampToBox(r, box);
}

// Stack a device's output cards vertically inside its box and size the box to fit.
function reflowDeviceOutputs(dev) {
  const outs = state.layout.relays.filter((r) => r.device === dev.id);
  const n = Math.max(1, outs.length);
  dev.w = DEV_W;
  dev.h = HDR + PAD + n * CARD_H + (n - 1) * GAP + PAD;
  outs.forEach((r, i) => { r.x = innerX(dev); r.y = innerY(dev) + i * (CARD_H + GAP); });
}

// The smallest an area may be: big enough to hold its largest member outright.
// (Deliberately NOT the members' bounding box — members are clamped inside the
// box, so sizing to their bounds would let one drag inflate the area for good.)
function minAreaSize(area) {
  let w = MIN_AREA_W, h = MIN_AREA_H;
  for (const d of state.layout.devices) {
    if (d.area !== area.areaId) continue;
    w = Math.max(w, num(d.w, DEV_W) + 2 * PAD);
    h = Math.max(h, HDR + num(d.h) + 2 * PAD);
  }
  return { w, h };
}

// Next free slot below whatever is already parked in this area.
function slotInArea(area, skip) {
  let y = innerY(area);
  for (const d of state.layout.devices) if (d.area === area.areaId && d !== skip) y = Math.max(y, num(d.y) + num(d.h) + GAP);
  for (const r of state.layout.relays) if (r.area === area.areaId && !r.device) y = Math.max(y, num(r.y) + CARD_H + GAP);
  return { x: innerX(area), y };
}

// Grow an area so `x,y,w,h` fits inside it (used right after parking something new).
function growToInclude(area, x, y, w, h) {
  area.w = Math.max(num(area.w), x + w + PAD - num(area.x));
  area.h = Math.max(num(area.h), y + h + PAD - num(area.y));
}

// Pull every member of an area back inside its box.
function containArea(area) {
  for (const d of state.layout.devices) {
    if (d.area !== area.areaId) continue;
    clampBoxToArea(d, area);
    reflowDeviceOutputs(d);        // outputs follow the box they live in
  }
  for (const r of state.layout.relays) if (r.area === area.areaId && !r.device) clampToBox(r, area);
}

// Size an area to at least its minimum, then clamp its members inside it.
function fitAreaToContents(area) {
  const min = minAreaSize(area);
  area.w = Math.max(num(area.w), min.w);
  area.h = Math.max(num(area.h), min.h);
  containArea(area);
}

// One-time tidy for layouts saved before the box geometry was fixed: stack an
// area's members from its inner corner and shrink the box to fit them. Marked
// per-area with `packed` so a later manual arrangement is never re-packed.
function packArea(area) {
  let y = innerY(area), w = 0;
  for (const d of state.layout.devices) {
    if (d.area !== area.areaId) continue;
    d.x = innerX(area); d.y = y;
    reflowDeviceOutputs(d);
    y += d.h + GAP; w = Math.max(w, d.w);
  }
  for (const r of state.layout.relays) {
    if (r.area !== area.areaId || r.device) continue;
    r.x = innerX(area); r.y = y;
    y += CARD_H + GAP; w = Math.max(w, CARD_W);
  }
  area.w = Math.max(MIN_AREA_W, w + 2 * PAD);
  area.h = Math.max(MIN_AREA_H, y - GAP - num(area.y) + PAD);
  area.packed = 1;
}

// Keep every device box sized to its outputs and every area big enough to contain
// its contents — called on each render so sizes can never drift out of sync
// (e.g. after renames, adds, or a card-size change).
function normalizeLayout() {
  // every position is a real number from here on, so nothing downstream has to
  // guess a default (and accidentally treat a legitimate 0 as "unset")
  for (const o of [...state.layout.areas, ...state.layout.devices, ...state.layout.relays]) {
    o.x = num(o.x, 20); o.y = num(o.y, 20);
  }
  for (const d of state.layout.devices) reflowDeviceOutputs(d);
  for (const a of state.layout.areas) fitAreaToContents(a);
  normalizeZ();
}

// --- stacking order ----------------------------------------------------------
// Every board object carries a `z` rank, persisted with the layout, that records
// how recently it was clicked. Rendering turns that rank into a real z-index in
// steps of Z_STEP, offset by tier — so however the ranks move, the invariant
// "area box behind device box behind relay card" can never be clicked away.
// (An area brought to the front would otherwise bury the cards it contains.)
const Z_STEP = 10;
const Z_BASE = { area: 10, device: 100000, relay: 1000000 };
const zList = (kind) => (kind === 'relay' ? state.layout.relays : kind === 'device' ? state.layout.devices : state.layout.areas);
const zIndexOf = (o, kind) => Z_BASE[kind] + num(o.z) * Z_STEP;

// Compact each tier's ranks to 0..n-1 in click order. Objects with no `z` yet —
// a layout saved before this existed, or a box just added — fall back to their
// array index, which is exactly the order the board painted them in before.
function normalizeZ() {
  for (const list of [state.layout.areas, state.layout.devices, state.layout.relays]) {
    list.map((o, i) => ({ o, i }))
      .sort((a, b) => (num(a.o.z, a.i) - num(b.o.z, b.i)) || (a.i - b.i))
      .forEach((e, rank) => { e.o.z = rank; });
  }
}

// Everything that has to travel with `o` when it is raised. Lifting a card alone
// is not enough: if the box it lives in stays buried, its neighbours still cut
// across the group. So a card lifts its containers, and a box lifts its contents.
function zGroup(o, kind) {
  const g = { area: [], device: [], relay: [] };
  const areaOf = (id) => state.layout.areas.find((a) => a.areaId === id);
  if (kind === 'relay') {
    g.relay.push(o);
    const d = o.device && state.layout.devices.find((x) => x.id === o.device);
    if (d) g.device.push(d);
    const a = o.area && areaOf(o.area);
    if (a) g.area.push(a);
  } else if (kind === 'device') {
    g.device.push(o);
    g.relay.push(...state.layout.relays.filter((r) => r.device === o.id));
    const a = o.area && areaOf(o.area);
    if (a) g.area.push(a);
  } else {
    g.area.push(o);
    g.device.push(...state.layout.devices.filter((d) => d.area === o.areaId));
    const ids = new Set(g.device.map((d) => d.id));
    g.relay.push(...state.layout.relays.filter((r) => r.area === o.areaId || ids.has(r.device)));
  }
  return g;
}

const zSignature = () => ['area', 'device', 'relay'].map((k) => zList(k).map((o) => num(o.z)).join(',')).join('|');

// Move `o` (and its group) to the top of the stack. Returns false when nothing
// actually moved, so a click on something already in front doesn't hit the DB.
function bringToFront(o, kind) {
  const before = zSignature();
  const g = zGroup(o, kind);
  for (const k of ['area', 'device', 'relay']) {
    if (!g[k].length) continue;
    const list = zList(k);
    let top = list.reduce((m, x) => Math.max(m, num(x.z)), 0);
    // keep the group's own relative order, but the clicked object ends up last —
    // i.e. highest — so it wins against its own siblings too
    const picked = g[k].filter((x) => x !== o).sort((a, b) => num(a.z) - num(b.z));
    if (g[k].includes(o)) picked.push(o);
    picked.forEach((x) => { x.z = ++top; });
  }
  normalizeZ();
  return zSignature() !== before;
}

// The area box whose bounds contain point (px,py), if any.
function areaAt(px, py) {
  return state.layout.areas.find((a) => px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) || null;
}

// Explicitly assign a device box to an HA area (from the box's dropdown).
// Propagates the area to its outputs, and if that area has a box on the board,
// moves the device (with outputs) inside it so it's visually grouped too.
function assignDeviceArea(g, areaId) {
  g.area = areaId || '';
  const outs = state.layout.relays.filter((r) => r.device === g.id);
  outs.forEach((r) => { r.area = areaId || ''; });
  reflowDeviceOutputs(g);
  const box = areaId && state.layout.areas.find((a) => a.areaId === areaId);
  if (box) {
    const slot = slotInArea(box, g);        // park it under whatever is already there
    g.x = slot.x; g.y = slot.y;
    growToInclude(box, g.x, g.y, g.w, g.h); // make room for it, then re-clamp
    fitAreaToContents(box);
  }
}

// Pin a device box to whichever area box now contains its center; propagate that
// area to all the device's output relays (so binding/grouping follows the area).
// Returns true if the pinned area changed.
function pinDeviceToArea(g) {
  const cx = num(g.x) + num(g.w, DEV_W) / 2, cy = num(g.y) + num(g.h, MIN_AREA_H) / 2;
  const area = areaAt(cx, cy);
  const newArea = area ? area.areaId : '';
  if ((g.area || '') === newArea) return false;
  g.area = newArea;
  for (const r of state.layout.relays.filter((x) => x.device === g.id)) r.area = newArea;
  return true;
}

export { fillSelects, refreshAreaPicker, areaColor, areaName, headColor, boxTint, headTint, opaque, bodyFill, dashedSides,
  num, CARD_W, CARD_H, GAP, PAD, HDR, DEV_W, MIN_AREA_W, MIN_AREA_H, innerX, innerY,
  boxFor, clampToBox, clampBoxToArea, centerInBox, reflowDeviceOutputs, minAreaSize,
  slotInArea, growToInclude, containArea, fitAreaToContents, packArea, normalizeLayout,
  areaAt, assignDeviceArea, pinDeviceToArea,
  Z_STEP, Z_BASE, zIndexOf, normalizeZ, bringToFront };
