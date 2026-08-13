import { state, canvas, CANVAS_DESKTOP, CANVAS_MOBILE, esc, setStatus, flashStatus, api } from './core.js';
import { t } from './i18n.js';
import { refreshAreaPicker, normalizeLayout, areaColor, headColor, boxTint, headTint, opaque, bodyFill, dashedSides, areaName, hueToHex, hexToHue,
  pinDeviceToArea, containArea, fitAreaToContents, minAreaSize, reflowDeviceOutputs,
  num, CARD_W, CARD_H, PAD, HDR, DEV_W, MIN_AREA_W, MIN_AREA_H,
  zIndexOf, bringToFront } from './layout.js';
import { updateSummary, setAreaRelays } from './relay-actions.js';
import { card } from './card.js';
import { openDeviceEditor } from './device-editor.js';
import { saveLayout, saveZOrder } from './history-undo.js';

const isMobile = () => window.innerWidth <= 700;

// --- click-to-front ----------------------------------------------------------
// Push the current z ranks straight into the live DOM. This is deliberately not
// a render(): raising happens on pointerdown, and rebuilding the canvas there
// would destroy the very element that is about to capture the pointer, killing
// the drag on its first move.
function applyZ() {
  const set = (el, o) => { if (el) el.style.zIndex = zIndexOf(o); };
  const box = (id) => canvas.querySelector('.area[data-gid="' + id + '"]');
  for (const a of state.layout.areas) set(box(a.id), a);
  for (const d of state.layout.devices) set(box(d.id), d);
  for (const r of state.layout.relays) set(canvas.querySelector('.relay[data-id="' + r.id + '"]'), r);
}

// Clicking anything on the board brings it (and its group) to the front, and the
// new order is persisted so the board looks the same on the next visit.
function raise(o, kind) {
  if (isMobile()) return;              // the list layout has no overlap to resolve
  if (!bringToFront(o, kind)) return;  // already on top — don't churn the DB
  applyZ();
  saveZOrder();
}

function render() {
  refreshAreaPicker();
  normalizeLayout();
  updateSummary();
  // An inline target-temp input is open: rebuilding the canvas would destroy it
  // mid-keystroke (the live poll calls render() every 10s). Hold off the redraw —
  // the header summary above still updates. Self-heal if the input vanished anyway.
  if (state.tgtEditing) {
    if (canvas.querySelector('.tgt-input:not(.hidden)')) return;
    state.tgtEditing = false;
  }
  if (isMobile()) return renderMobile();
  canvas.className = CANVAS_DESKTOP + (state.edit ? ' edit cursor-default' : '');
  canvas.style.zoom = state.canvasScale !== 1 ? String(state.canvasScale) : '';
  canvas.innerHTML = '';
  for (const a of state.layout.areas) canvas.appendChild(renderBox(a, 'area'));
  for (const d of state.layout.devices) canvas.appendChild(renderBox(d, 'device'));
  for (const r of state.layout.relays) canvas.appendChild(card(r));

  // Auto-size canvas to fit all content with padding
  let maxX = 600, maxY = 400;
  for (const r of state.layout.relays) {
    maxX = Math.max(maxX, num(r.x) + CARD_W + 2 * PAD);
    maxY = Math.max(maxY, num(r.y) + CARD_H + 2 * PAD);
  }
  for (const g of [...state.layout.areas, ...state.layout.devices]) {
    maxX = Math.max(maxX, num(g.x) + num(g.w, MIN_AREA_W) + 2 * PAD);
    maxY = Math.max(maxY, num(g.y) + num(g.h, MIN_AREA_H) + 2 * PAD);
  }
  canvas.style.minWidth = Math.round(Math.max(maxX, (window.innerWidth - 40) / state.canvasScale)) + 'px';
  canvas.style.minHeight = Math.round(Math.max(maxY, (window.innerHeight - 130) / state.canvasScale)) + 'px';
  // Signal that the canvas DOM has been rebuilt (editor blur re-apply, etc.)
  canvas.dispatchEvent(new CustomEvent('render'));
}

// shared area master on/off buttons (keeps .area-master hook for live-mode hide + .am-btn hooks)
// AM_STYLE is the look; `am-btn` is the ON/OFF click hook and must NOT be on the
// temperature pill - it has its own `.area-temp` handler and no data-act (#86).
const AM_STYLE = 'text-[.72rem] font-bold px-[9px] py-[3px] rounded-lg cursor-pointer border-[1.5px] border-border-strong bg-surface text-fg';
const AM_BTN = `am-btn ${AM_STYLE}`;
const areaMaster = (g) => {
  // per-area temperature set point (#81)
  const bound = state.layout.relays.filter((r) => r.bound && r.area === g.areaId && r.temp != null);
  const same = bound.length && bound.every((r) => r.temp === bound[0].temp);
  const tempLabel = bound.length ? (same ? bound[0].temp + '°' : 'mixed') : '—';
  return `<span class="area-master inline-flex gap-1">
    <button class="${AM_BTN} [.live-mode_&]:opacity-40 [.live-mode_&]:pointer-events-none" data-act="on">${t('all_on')}</button>
    <button class="${AM_BTN} [.live-mode_&]:opacity-40 [.live-mode_&]:pointer-events-none" data-act="off">${t('all_off')}</button>
    <button class="${AM_STYLE} area-temp [.live-mode_&]:opacity-40 [.live-mode_&]:pointer-events-none" data-area="${esc(g.areaId)}" title="Set area temperature"><i class="bi bi-thermometer-half"></i> ${tempLabel}</button>
  </span>`;
};

// Mobile: ignore x/y positions, render a nested flex list (area -> device -> outputs).
function renderMobile() {
  canvas.className = CANVAS_MOBILE;
  canvas.innerHTML = '';
  const doneDev = new Set(), doneRel = new Set();

  const deviceBlock = (d) => {
    doneDev.add(d.id);
    const hue = areaColor(d.deviceId, d);
    const box = document.createElement('div');
    box.className = 'border-2 border-border rounded-[14px] p-2.5 bg-surface-2 flex flex-col gap-2.5';
    box.style.borderColor = `hsl(${hue},45%,55%)`;
    const head = document.createElement('div');
    head.className = 'font-bold text-fg text-base cursor-pointer';
    head.style.color = headColor(hue);
    head.innerHTML = `<i class="bi bi-hdd-stack"></i> ${esc(d.name || d.deviceId)}`;
    head.addEventListener('click', () => openDeviceEditor(d));
    box.appendChild(head);
    for (const r of state.layout.relays.filter((x) => x.device === d.id)) { box.appendChild(card(r, true)); doneRel.add(r.id); }
    return box;
  };

  // areas with their nested devices + loose cards
  for (const a of state.layout.areas) {
    const hue = areaColor(a.areaId, a);
    const box = document.createElement('div');
    box.className = 'border-[3px] border-solid border-border-strong rounded-[14px] p-2.5 flex flex-col gap-2.5';
    box.style.borderColor = `hsl(${hue},50%,55%)`;
    box.innerHTML = `<div class="flex items-center justify-between font-extrabold text-[1.05rem] p-0.5" style="color:${headColor(hue)}"><span><i class="bi bi-grid-3x3-gap"></i> ${esc(a.name || a.areaId)}</span>
      ${areaMaster(a)}</div>`;
    box.querySelectorAll('.am-btn').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setAreaRelays(a.areaId, b.dataset.act === 'on'); }));
    for (const d of state.layout.devices.filter((x) => x.area === a.areaId)) box.appendChild(deviceBlock(d));
    for (const r of state.layout.relays.filter((x) => x.area === a.areaId && !x.device)) { box.appendChild(card(r, true)); doneRel.add(r.id); }
    canvas.appendChild(box);
  }
  // device boxes not in any area
  for (const d of state.layout.devices) if (!doneDev.has(d.id)) canvas.appendChild(deviceBlock(d));
  // loose relays (no device, not already shown)
  for (const r of state.layout.relays) if (!r.device && !doneRel.has(r.id)) canvas.appendChild(card(r, true));
  canvas.dispatchEvent(new CustomEvent('render'));
}

// Update box border/background colours from a hue instantly (#73)
function updateBoxColors(el, hue, isDev, g) {
  const line = `hsl(${hue},50%,55%)`;
  const head = el.querySelector('.area-head');
  if (head) {
    head.style.color = headColor(hue);
    head.style.borderColor = line;
    head.style.background = opaque(headTint(hue));
  }
  const body = el.querySelector('.area-body');
  if (body) {
    body.style.borderColor = line;
    body.style.background = (() => {
      const ox = Math.round(-num(g.x) % 26);
      const oy = Math.round(-(num(g.y) + HDR) % 26);
      const dots = bodyFill(boxTint(hue)).replace(' 0 0 /', ` ${ox}px ${oy}px /`);
      return isDev ? dots : `${dashedSides(num(g.w, MIN_AREA_W), num(g.h, MIN_AREA_H) - HDR, line)} 0 0 / 100% 100% no-repeat, ${dots}`;
    })();
  }
}

// ---- group boxes: HA areas ('area') and physical relay devices ('device') ----
function memberFilter(g, kind) { return kind === 'device' ? (r) => r.device === g.id : (r) => r.area === g.areaId; }

// Push an area's (re-clamped) member coordinates straight into the DOM. Used mid-drag,
// where a full render() would destroy the element currently holding pointer capture.
function syncMemberEls(a) {
  for (const d of state.layout.devices) {
    if (d.area !== a.areaId) continue;
    const de = canvas.querySelector('.area[data-gid="' + d.id + '"]');
    if (de) { de.style.left = d.x + 'px'; de.style.top = d.y + 'px'; }
  }
  for (const r of state.layout.relays) {
    if (r.area !== a.areaId) continue;
    const re = canvas.querySelector('.relay[data-id="' + r.id + '"]');
    if (re) { re.style.left = r.x + 'px'; re.style.top = r.y + 'px'; }
  }
}

function renderBox(g, kind) {
  const isDev = kind === 'device';
  const refId = isDev ? g.deviceId : g.areaId;
  const hue = areaColor(refId, g);
  const el = document.createElement('div');
  // border-color + background come from inline style (dynamic per-area hue)
  // The box carries no border of its own: the titlebar and the body each draw their
  // own, so the bar can be fully boxed in solid while the canvas below it is dotted.
  el.className = 'area absolute';
  el.style.zIndex = zIndexOf(g);
  el.dataset.gid = g.id;
  el.style.left = num(g.x) + 'px';
  el.style.top = num(g.y) + 'px';
  el.style.width = num(g.w, isDev ? DEV_W : MIN_AREA_W) + 'px';
  el.style.height = num(g.h, MIN_AREA_H) + 'px';
  const line = `hsl(${hue},50%,55%)`;
  // a pinned device names its area inline — the titlebar stays one fixed-height row
  // so HDR in layout.js keeps matching what is actually rendered.
  // area boxes get a master on/off for all their relays (works in Live mode too)
  const master = !isDev ? areaMaster(g) : '';
  const colorBtn = state.edit ? `<span class="area-color-picker inline-block w-[16px] h-[16px] rounded-full border border-border-strong cursor-pointer flex-none opacity-60 hover:opacity-100" style="background:${hueToHex(hue)}" data-gid="${g.id}" title="Pick colour"><input type="color" class="hidden" value="${hueToHex(hue)}" /></span>` : '';
  const delBtn = `<button class="area-del bg-transparent border-0 text-inherit text-[1.15rem] cursor-pointer leading-none${state.edit ? ' opacity-60' : ' hidden'}" title="Remove group">&times;</button>`;
  // only areas are resizable — a device box is always sized to its outputs
  const resize = state.edit && !isDev
    ? '<div class="area-resize absolute right-[3px] bottom-[3px] w-[26px] h-[26px] cursor-nwse-resize border-r-[3px] border-b-[3px] border-border-strong rounded-br-[12px] touch-none"></div>' : '';
  // Two wrapped parts. The titlebar is a solid-bordered bar on all four sides; the
  // body below it is the box's own dotted canvas, boxed in on left/bottom/right
  // (no top border — the bar's bottom edge already draws that line).
  // h-[44px] = 2px border + 40px row + 2px border, i.e. exactly HDR, so the body
  // starts where layout.js says content begins.
  const head = `<div class="area-head h-[44px] px-2.5 flex items-center gap-1.5 font-bold select-none touch-none border-2 border-solid rounded-t-2xl${state.edit ? ' cursor-grab active:cursor-grabbing' : ''}" style="color:${headColor(hue)};border-color:${line};background:${opaque(headTint(hue))}">
      <i class="bi ${isDev ? (state.edit ? 'bi-gear area-gear cursor-pointer' : 'bi-hdd-stack') : 'bi-grid-3x3-gap'} text-[.95rem] flex-none"></i>
      <span class="text-[.95rem] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">${esc(g.name || refId)}</span>
      ${colorBtn}
      <span class="ml-auto flex items-center gap-1.5 flex-none">${master}${delBtn}</span>
    </div>`;
  // A device box keeps a plain solid CSS border; an area's body is outlined with the
  // wide-gap dashed SVG stroke, which has to be re-emitted whenever the box resizes.
  // `top` comes from HDR via inline style, not a Tailwind class: an interpolated
  // `top-[${HDR}px]` is invisible to Tailwind's source scan and would never compile.
  const bodyBg = () => {
    // Offset the dotted grid so it aligns with the canvas grid — makes dots appear
    // to stay pinned to the canvas when the area is dragged, instead of looking static.
    const ox = Math.round(-num(g.x) % 26);
    const oy = Math.round(-(num(g.y) + HDR) % 26);
    const dots = bodyFill(boxTint(hue)).replace(' 0 0 /', ` ${ox}px ${oy}px /`);
    return isDev ? dots : `${dashedSides(num(g.w, MIN_AREA_W), num(g.h, MIN_AREA_H) - HDR, line)} 0 0 / 100% 100% no-repeat, ${dots}`;
  };
  const body = `<div class="area-body absolute inset-x-0 bottom-0 rounded-b-2xl pointer-events-none opacity-75 ${isDev ? 'border-2 border-t-0 border-solid' : ''}" style="top:${HDR}px;border-color:${line};background:${bodyBg()}"></div>`;
  el.innerHTML = head + body + resize;

  // capture phase: the header drag and the master buttons both stopPropagation,
  // and a box must come forward no matter which of its controls was hit
  el.addEventListener('pointerdown', () => raise(g, kind), true);

  const isMember = memberFilter(g, kind);
  const gearBtn = el.querySelector('.area-gear');
  if (gearBtn) {
    gearBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    gearBtn.addEventListener('click', (e) => { e.stopPropagation(); if (isDev) openDeviceEditor(g); });
  }
  // Inline colour picker (#73) — hidden input inside a coloured circle span
  const swatch = el.querySelector('.area-color-picker');
  if (swatch) {
    const cp = swatch.querySelector('input');
    swatch.addEventListener('pointerdown', (e) => e.stopPropagation());
    swatch.addEventListener('click', () => { cp.click(); });
    cp.addEventListener('input', () => {
      const h = hexToHue(cp.value);
      g.hue = h;
      swatch.style.background = hueToHex(h);
      updateBoxColors(el, h, isDev, g);
    });
    cp.addEventListener('change', () => {
      g.hue = hexToHue(cp.value);
      saveLayout();
    });
  }
  el.querySelectorAll('.am-btn, .area-temp').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
  });
  el.querySelectorAll('.am-btn').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); setAreaRelays(g.areaId, b.dataset.act === 'on'); });
  });
  if (state.edit) {
    groupHeaderDrag(el.querySelector('.area-head'), el, g, isMember, isDev);
    const rz = el.querySelector('.area-resize');
    // an area can never be dragged smaller than the members it has to hold, and
    // its members are pulled in as it shrinks — not only once the drag ends
    if (rz) dragMove(rz, el, (dx, dy, ow, oh) => {
      const min = minAreaSize(g);
      g.w = Math.max(min.w, ow + dx); g.h = Math.max(min.h, oh + dy);
      el.style.width = g.w + 'px'; el.style.height = g.h + 'px';
      const bodyEl = el.querySelector('.area-body');
      if (bodyEl) bodyEl.style.background = bodyBg();   // redraw the dashes at the new size
      containArea(g); syncMemberEls(g);
    }, () => num(g.w, MIN_AREA_W), () => num(g.h, MIN_AREA_H),
      () => { containArea(g); render(); saveLayout(); });
    el.querySelector('.area-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(isDev
        ? t('confirm_remove_device').replace('{name}', g.name || 'physical relay')
        : t('confirm_remove_area').replace('{name}', g.name || 'group'))) return;
      if (isDev) {
        state.layout.relays = state.layout.relays.filter((r) => r.device !== g.id);
        state.layout.devices = state.layout.devices.filter((x) => x.id !== g.id);
      } else state.layout.areas = state.layout.areas.filter((x) => x.id !== g.id);
      api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isDev ? 'device.delete' : 'area.delete', detail: { name: g.name, id: g.id } })
      }).catch(() => {});
      render(); saveLayout();
    });
  }
  return el;
}

// Drag a group by its header; everything nested moves along. For an AREA box that
// means loose member cards + pinned device boxes (and their outputs). For a DEVICE
// box it means its output cards, and on drop it pins to the area that contains it.
function groupHeaderDrag(head, el, g, isMember, isDev) {
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.area-del')) return; // let the delete button get its click
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;

    // things that move with this group: {obj, kind, x0, y0, el}
    const movers = [];
    const relEl = (id) => canvas.querySelector('.relay[data-id="' + id + '"]');
    const boxEl = (id) => canvas.querySelector('.area[data-gid="' + id + '"]');
    if (isDev) {
      for (const r of state.layout.relays.filter((x) => x.device === g.id)) movers.push({ obj: r, x0: num(r.x), y0: num(r.y), el: relEl(r.id) });
    } else {
      // pinned device boxes + their outputs
      for (const d of state.layout.devices.filter((x) => x.area === g.areaId)) {
        movers.push({ obj: d, x0: num(d.x), y0: num(d.y), el: boxEl(d.id) });
        for (const r of state.layout.relays.filter((x) => x.device === d.id)) movers.push({ obj: r, x0: num(r.x), y0: num(r.y), el: relEl(r.id) });
      }
      // loose cards assigned to this area (not inside a device box)
      for (const r of state.layout.relays.filter((x) => x.area === g.areaId && !x.device)) movers.push({ obj: r, x0: num(r.x), y0: num(r.y), el: relEl(r.id) });
    }

    const gx = num(g.x), gy = num(g.y);
    let moved = false;
    head.setPointerCapture(e.pointerId);
    // a device box locked to an area stays inside that area box
    const lockBox = isDev && g.area ? state.layout.areas.find((a) => a.areaId === g.area) : null;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      let nx = Math.max(0, gx + dx), ny = Math.max(0, gy + dy);
      if (lockBox) {
        // stays inside its area: below the titlebar, inside the padding on the other three sides
        const minX = num(lockBox.x) + PAD, maxX = Math.max(minX, num(lockBox.x) + num(lockBox.w) - num(g.w, DEV_W) - PAD);
        const minY = num(lockBox.y) + HDR + PAD, maxY = Math.max(minY, num(lockBox.y) + num(lockBox.h) - num(g.h, MIN_AREA_H) - PAD);
        nx = Math.min(Math.max(nx, minX), maxX); ny = Math.min(Math.max(ny, minY), maxY);
      }
      const adx = nx - gx, ady = ny - gy; // effective (clamped) delta
      g.x = nx; g.y = ny; el.style.left = nx + 'px'; el.style.top = ny + 'px';
      // Shift the dotted grid so dots stay pinned to the canvas during drag
      const bodyEl = el.querySelector('.area-body');
      if (bodyEl) bodyEl.style.backgroundPosition = isDev
        ? `${-nx % 26}px ${-(ny + HDR) % 26}px`
        : `0 0, ${-nx % 26}px ${-(ny + HDR) % 26}px`;
      for (const m of movers) { m.obj.x = Math.max(0, m.x0 + adx); m.obj.y = Math.max(0, m.y0 + ady); if (m.el) { m.el.style.left = m.obj.x + 'px'; m.el.style.top = m.obj.y + 'px'; } }
    };
    const up = () => {
      head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up);
      if (!moved) return; // click (no drag) — gear icon handles device editor
      if (isDev && pinDeviceToArea(g)) { const a = state.layout.areas.find((x) => x.areaId === g.area); if (a) fitAreaToContents(a); }
      render(); saveLayout();
    };
    head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
  });
}

// generic pointer drag helper: onMove(dx,dy, baseA, baseB); getA/getB give base values
function dragMove(handle, el, onMove, getA, getB, onEnd) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, a0 = getA(), b0 = getB();
    handle.setPointerCapture(e.pointerId);
    const mv = (ev) => onMove(ev.clientX - sx, ev.clientY - sy, a0, b0);
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); onEnd && onEnd(); };
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up); // #63 — cleanup on gesture/scroll cancel
  });
}

function addArea(areaId) {
  if (!areaId) return;
  if (state.layout.areas.some((a) => a.areaId === areaId)) { flashStatus('”' + areaName(areaId) + '”' + t('already_on_board'), 1800); return; }
  const id = 'a' + Date.now().toString(36);
  // starts at its minimum (one device box wide) and grows as things are put in it;
  // `packed` marks it as already tidy so the one-time migration skips it
  const maxZ = [...state.layout.areas, ...state.layout.devices, ...state.layout.relays].reduce((m, o) => Math.max(m, num(o.z, 0)), 0);
  state.layout.areas.push({ id, areaId, name: areaName(areaId), x: 24, y: 24, z: maxZ + 1, w: MIN_AREA_W, h: MIN_AREA_H, packed: 1 });
  render(); saveLayout();
}

// Add a physical relay: a device box + one relay card per output, grouped inside.
function addPhysicalRelay(deviceId) {
  if (!deviceId) return;
  const dev = state.relayDevices.find((d) => d.device_id === deviceId);
  if (!dev) return;
  const id = 'd' + Date.now().toString(36);
  const maxZ = [...state.layout.areas, ...state.layout.devices, ...state.layout.relays].reduce((m, o) => Math.max(m, num(o.z, 0)), 0);
  const box = { id, deviceId, name: dev.name, x: 40, y: 40, z: maxZ + 1, w: DEV_W, h: MIN_AREA_H };
  state.layout.devices.push(box);
  dev.outputs.forEach((o, i) => {
    state.layout.relays.push({
      id: 'r' + Date.now().toString(36) + i, name: o.name, relay: o.entity_id,
      sensor: '', area: '', device: id, mode: 'below', temp: 20, deadband: 0, bound: false, x: 0, y: 0,
    });
  });
  reflowDeviceOutputs(box);
  render(); saveLayout();
}

export { isMobile, render, renderMobile, memberFilter, renderBox, groupHeaderDrag,
  dragMove, addArea, addPhysicalRelay, areaMaster, applyZ, raise };
