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

function areaColor(id, obj) {
  if (obj && obj.hue != null) return obj.hue; // #73 — user-picked override
  let h = 0; const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
function hueToHex(h) { return `hsl(${h},55%,45%)`; } // approximate hex for color input
function hexToHue(hex) {
  // Parse hex to RGB, then to HSL, return the hue
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d) { if (max === r) h = ((g-b)/d)%6; else if (max === g) h = (b-r)/d+2; else h = (r-g)/d+4; }
  return Math.round(h*60)%360;
}
function areaName(id) { const a = state.haAreas.find((x) => x.id === id); return a ? a.name : id; }
// readable header colour for area/device boxes: dark on light theme, light on dark
function headColor(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark ? `hsl(${hue},75%,74%)` : `hsl(${hue},70%,26%)`;
}
function boxTint(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return `hsla(${hue},70%,38%,${dark ? 0.10 : 0.20})`;
}
// the titlebar sits on top of boxTint, so it needs a stronger wash to read as a bar
function headTint(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return `hsla(${hue},70%,38%,${dark ? 0.20 : 0.30})`;
}
// Semi-transparent area body so relays underneath remain visible
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
// A physical relay is ONE thing on the board: the box and the outputs pinned
// inside it by reflowDeviceOutputs. So it has to stack as one — click it and the
// box comes forward along with its cards, over the whole of the board next to it.
//
// That rules out banding by kind (all boxes under all cards): a box could then
// never rise above a neighbouring board's outputs, so a raised group always came
// forward half-buried. Instead the rendered z-index comes from a depth-first walk
// of the board's containment tree:
//
//   area box, [ device box, its outputs | loose card ]…, next area box, …
//
// A container is emitted before its contents, so it is always painted underneath
// them, and each group's objects land on consecutive levels — one contiguous band
// that moves as a unit. `z` itself is just click recency, used to order siblings.
const Z_STEP = 10;

const devOf = (o) => (o && o.device ? state.layout.devices.find((d) => d.id === o.device) : null);
const areaOf = (o, kind) => {
  const id = kind === 'area' ? o.areaId : o.area;
  return (id && state.layout.areas.find((a) => a.areaId === id)) || null;
};
const byZ = (a, b) => num(a.o.z) - num(b.o.z);
// a device box and a loose card are siblings: both are children of an area (or of
// the canvas itself, when areaId is '')
const devsIn = (areaId) => state.layout.devices.filter((d) => (d.area || '') === areaId).map((o) => ({ o, kind: 'device' }));
const cardsIn = (areaId) => state.layout.relays.filter((r) => !r.device && (r.area || '') === areaId).map((o) => ({ o, kind: 'relay' }));
const childrenOf = (areaId) => [...devsIn(areaId), ...cardsIn(areaId)].sort(byZ);

// Bottom-to-top walk of the containment tree.
function zStack() {
  const out = [];
  const emit = ({ o, kind }) => {
    out.push(o);
    if (kind === 'device') {
      // outputs in array order — that is the order reflowDeviceOutputs stacks them
      // down the box, and they are pinned inside it so they never overlap anyway
      for (const r of state.layout.relays) if (r.device === o.id) out.push(r);
    } else if (kind === 'area') {
      for (const c of childrenOf(o.areaId)) emit(c);
    }
  };
  const top = [...state.layout.areas.map((o) => ({ o, kind: 'area' })), ...childrenOf('')].sort(byZ);
  for (const t of top) emit(t);
  // Safety net: anything the walk missed (a device pinned to an area that is not
  // on the board, say) still needs a level, or it would render with no z-index.
  const seen = new Set(out);
  for (const o of [...state.layout.areas, ...state.layout.devices, ...state.layout.relays]) if (!seen.has(o)) out.push(o);
  return out;
}

// The walk is recomputed only when something actually changes, and cached by
// object identity — render() and applyZ() both need every object's level.
let zMap = new Map();
function zRefresh() {
  zMap = new Map();
  zStack().forEach((o, i) => zMap.set(o, (i + 1) * Z_STEP));
}
const zIndexOf = (o) => zMap.get(o) || Z_STEP;

// Compact click ranks to 0..n-1 across the whole board — one shared number space,
// since an area box, a device box and a loose card can all be siblings. Objects
// with no `z` yet (a layout saved before this existed, or a box just added) fall
// back to their position in the concatenated lists.
function normalizeZ() {
  const all = [...state.layout.areas, ...state.layout.devices, ...state.layout.relays];
  all.map((o, i) => ({ o, i }))
    .sort((a, b) => (num(a.o.z, a.i) - num(b.o.z, b.i)) || (a.i - b.i))
    .forEach((e, rank) => { e.o.z = rank; });
  zRefresh();
}

// ids in stack order — the whole of what a click can change visually
const zSignature = () => zStack().map((o) => o.id).join(',');
const bumpAbove = (o, siblings) => { o.z = siblings.reduce((m, x) => Math.max(m, num(x.o.z)), 0) + 1; };

// Raise whatever was clicked, as a unit with everything it belongs to: the group
// goes to the front of the board, and inside an area the clicked box/card goes to
// the front of that area. Returns false when nothing moved, so a click on
// something already in front doesn't churn the DB.
function bringToFront(o, kind) {
  const before = zSignature();
  const area = areaOf(o, kind);
  const dev = kind === 'device' ? o : devOf(o);
  bumpAbove(area || dev || o, [...state.layout.areas.map((x) => ({ o: x })), ...childrenOf('')]);
  if (area && kind !== 'area') bumpAbove(dev || o, childrenOf(area.areaId));
  zRefresh();
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

export { fillSelects, refreshAreaPicker, areaColor, areaName, headColor, boxTint, headTint, opaque, bodyFill, dashedSides, hueToHex, hexToHue,
  num, CARD_W, CARD_H, GAP, PAD, HDR, DEV_W, MIN_AREA_W, MIN_AREA_H, innerX, innerY,
  boxFor, clampToBox, clampBoxToArea, centerInBox, reflowDeviceOutputs, minAreaSize,
  slotInArea, growToInclude, containArea, fitAreaToContents, packArea, normalizeLayout,
  areaAt, assignDeviceArea, pinDeviceToArea,
  Z_STEP, zIndexOf, zStack, normalizeZ, bringToFront };
