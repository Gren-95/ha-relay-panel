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

// --- area containment: a relay assigned to an area is clamped inside its box ---
const CARD_BOX_W = 370, CARD_BOX_H = 106, GAP = 10, HDR_AREA = 54, HDR_DEV = 84, PAD = 16;
const hdr = (box) => box.deviceId ? HDR_DEV : HDR_AREA;
function boxFor(r) {
  if (r.device) { const d = state.layout.devices.find((x) => x.id === r.device); if (d) return d; }
  return r.area ? state.layout.areas.find((a) => a.areaId === r.area) : null;
}
function clampToBox(r, box) {
  const minX = box.x + PAD, maxX = Math.max(minX, box.x + box.w - CARD_BOX_W - PAD);
  const minY = box.y + hdr(box), maxY = Math.max(minY, box.y + box.h - CARD_BOX_H - PAD);
  r.x = Math.min(Math.max(r.x, minX), maxX);
  r.y = Math.min(Math.max(r.y, minY), maxY);
}
function centerInBox(r, box) {
  r.x = Math.round(box.x + (box.w - CARD_BOX_W) / 2);
  r.y = Math.round(box.y + hdr(box) + (box.h - hdr(box) - CARD_BOX_H) / 2);
}

// Stack a device's output cards vertically inside its box and size the box to fit.
function reflowDeviceOutputs(dev) {
  const outs = state.layout.relays.filter((r) => r.device === dev.id);
  dev.w = CARD_BOX_W + 2 * PAD;
  dev.h = HDR_DEV + PAD + Math.max(1, outs.length) * CARD_BOX_H + Math.max(0, outs.length - 1) * GAP + PAD;
  outs.forEach((r, i) => { r.x = dev.x + PAD; r.y = dev.y + HDR_DEV + i * (CARD_BOX_H + GAP); });
}

// Grow an area box so it contains all its pinned device boxes + loose member cards.
function fitAreaToContents(area) {
  let right = area.x + 200, bottom = area.y + HDR_AREA + 100;
  for (const d of state.layout.devices.filter((x) => x.area === area.areaId)) {
    right = Math.max(right, d.x + (d.w || 320)); bottom = Math.max(bottom, d.y + (d.h || 220));
  }
  for (const r of state.layout.relays.filter((x) => x.area === area.areaId && !x.device)) {
    right = Math.max(right, (r.x || 20) + CARD_BOX_W); bottom = Math.max(bottom, (r.y || 20) + CARD_BOX_H);
  }
  // only GROW — never shrink below the current (possibly manually-set) size,
  // so an area always contains its devices/cards but manual resizing survives.
  area.w = Math.max(area.w || 240, right - area.x + PAD);
  area.h = Math.max(area.h || 140, bottom - area.y + PAD);
}

// Keep every device box sized to its outputs and every area big enough to contain
// its contents — called on each render so sizes can never drift out of sync
// (e.g. after renames, adds, or a card-size change).
function normalizeLayout() {
  for (const d of state.layout.devices) reflowDeviceOutputs(d);
  for (const a of state.layout.areas) fitAreaToContents(a);
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
  const box = areaId && state.layout.areas.find((a) => a.areaId === areaId);
  if (box) {
    g.x = box.x + PAD; g.y = box.y + HDR_AREA;   // slot just inside the area
    reflowDeviceOutputs(g);
    fitAreaToContents(box);                 // grow the area to fit the relay
  } else {
    reflowDeviceOutputs(g);
  }
}

// Pin a device box to whichever area box now contains its center; propagate that
// area to all the device's output relays (so binding/grouping follows the area).
// Returns true if the pinned area changed.
function pinDeviceToArea(g) {
  const cx = (g.x || 20) + (g.w || 320) / 2, cy = (g.y || 20) + (g.h || 220) / 2;
  const area = areaAt(cx, cy);
  const newArea = area ? area.areaId : '';
  if ((g.area || '') === newArea) return false;
  g.area = newArea;
  for (const r of state.layout.relays.filter((x) => x.device === g.id)) r.area = newArea;
  return true;
}

export { fillSelects, refreshAreaPicker, areaColor, areaName, headColor, boxTint,
  CARD_BOX_W, CARD_BOX_H, GAP, HDR_AREA, HDR_DEV, PAD, boxFor, clampToBox, centerInBox, reflowDeviceOutputs,
  fitAreaToContents, normalizeLayout, areaAt, assignDeviceArea, pinDeviceToArea };
