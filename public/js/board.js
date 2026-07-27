import { state, canvas, CANVAS_DESKTOP, CANVAS_MOBILE, esc, setStatus, api } from './core.js';
import { t } from './i18n.js';
import { refreshAreaPicker, normalizeLayout, areaColor, headColor, boxTint, areaName,
  pinDeviceToArea, clampToBox, fitAreaToContents, reflowDeviceOutputs, CARD_W, PAD, HDR } from './layout.js';
import { updateSummary, setAreaRelays } from './relay-actions.js';
import { card } from './card.js';
import { openDeviceEditor } from './device-editor.js';
import { saveLayout } from './history-undo.js';

const isMobile = () => window.innerWidth <= 700;

function render() {
  refreshAreaPicker();
  normalizeLayout();
  updateSummary();
  if (isMobile()) return renderMobile();
  canvas.className = CANVAS_DESKTOP + (state.edit ? ' edit cursor-default' : '');
  canvas.innerHTML = '';
  for (const a of state.layout.areas) canvas.appendChild(renderBox(a, 'area'));
  for (const d of state.layout.devices) canvas.appendChild(renderBox(d, 'device'));
  for (const r of state.layout.relays) canvas.appendChild(card(r));

  // Auto-size canvas to fit all content with padding
  let maxX = 600, maxY = 400;
  for (const r of state.layout.relays) {
    maxX = Math.max(maxX, (r.x || 0) + 400);
    maxY = Math.max(maxY, (r.y || 0) + 150);
  }
  for (const g of [...state.layout.areas, ...state.layout.devices]) {
    maxX = Math.max(maxX, (g.x || 0) + (g.w || 320) + 40);
    maxY = Math.max(maxY, (g.y || 0) + (g.h || 220) + 40);
  }
  canvas.style.minWidth = Math.max(maxX, window.innerWidth - 40) + 'px';
  canvas.style.minHeight = Math.max(maxY, window.innerHeight - 130) + 'px';
}

// shared area master on/off buttons (keeps .area-master hook for live-mode hide + .am-btn hooks)
const AM_BTN = 'am-btn text-[.72rem] font-bold px-[9px] py-[3px] rounded-lg cursor-pointer border-[1.5px] border-border-strong bg-surface text-fg';
const areaMaster = () => `<span class="area-master inline-flex gap-1 ml-auto [.live-mode_&]:hidden"><button class="${AM_BTN}" data-act="on">${t('all_on')}</button><button class="${AM_BTN}" data-act="off">${t('all_off')}</button></span>`;

// Mobile: ignore x/y positions, render a nested flex list (area -> device -> outputs).
function renderMobile() {
  canvas.className = CANVAS_MOBILE;
  canvas.innerHTML = '';
  const doneDev = new Set(), doneRel = new Set();

  const deviceBlock = (d) => {
    doneDev.add(d.id);
    const hue = areaColor(d.deviceId);
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
    const hue = areaColor(a.areaId);
    const box = document.createElement('div');
    box.className = 'border-[3px] border-dashed border-border-strong rounded-[14px] p-2.5 flex flex-col gap-2.5';
    box.style.borderColor = `hsl(${hue},50%,55%)`;
    box.innerHTML = `<div class="flex items-center justify-between font-extrabold text-[1.05rem] p-0.5" style="color:${headColor(hue)}"><span><i class="bi bi-grid-3x3-gap"></i> ${esc(a.name || a.areaId)}</span>
      ${areaMaster()}</div>`;
    box.querySelectorAll('.am-btn').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setAreaRelays(a.areaId, b.dataset.act === 'on'); }));
    for (const d of state.layout.devices.filter((x) => x.area === a.areaId)) box.appendChild(deviceBlock(d));
    for (const r of state.layout.relays.filter((x) => x.area === a.areaId && !x.device)) { box.appendChild(card(r, true)); doneRel.add(r.id); }
    canvas.appendChild(box);
  }
  // device boxes not in any area
  for (const d of state.layout.devices) if (!doneDev.has(d.id)) canvas.appendChild(deviceBlock(d));
  // loose relays (no device, not already shown)
  for (const r of state.layout.relays) if (!r.device && !doneRel.has(r.id)) canvas.appendChild(card(r, true));
}

// ---- group boxes: HA areas ('area') and physical relay devices ('device') ----
function memberFilter(g, kind) { return kind === 'device' ? (r) => r.device === g.id : (r) => r.area === g.areaId; }

function renderBox(g, kind) {
  const isDev = kind === 'device';
  const refId = isDev ? g.deviceId : g.areaId;
  const hue = areaColor(refId);
  const el = document.createElement('div');
  // border-color + background come from inline style (dynamic per-area hue)
  el.className = 'area absolute border-2 rounded-2xl [.kiosk_&]:border-[3px] ' + (isDev ? 'border-solid z-[2]' : 'border-dashed z-[1]');
  el.dataset.gid = g.id;
  el.style.left = (g.x || 20) + 'px';
  el.style.top = (g.y || 20) + 'px';
  el.style.width = (g.w || 320) + 'px';
  el.style.height = (g.h || 220) + 'px';
  el.style.borderColor = `hsl(${hue},50%,55%)`;
  el.style.background = boxTint(hue);
  const pin = isDev && g.area ? ` <span class="area-pin text-[.85rem] opacity-90 font-medium ml-[5px]"><i class="bi bi-geo-alt-fill"></i> ${esc(areaName(g.area))}</span>` : '';
  // area boxes get a master on/off for all their relays (works in Live mode too)
  const master = !isDev ? areaMaster() : '';
  el.innerHTML = `<div class="area-head flex items-center justify-between px-3 py-2 text-base font-bold cursor-grab active:cursor-grabbing select-none touch-none" style="color:${headColor(hue)}">
      <span>${isDev ? '<i class="bi bi-hdd-stack"></i>' : '<i class="bi bi-grid-3x3-gap"></i>'} ${esc(g.name || refId)}${pin}</span>
      ${master}${state.edit ? '<button class="area-del bg-transparent border-0 text-inherit opacity-60 text-[1.4rem] cursor-pointer leading-none" title="Remove group">&times;</button>' : ''}
    </div>${state.edit ? '<div class="area-resize absolute right-[3px] bottom-[3px] w-7 h-7 cursor-nwse-resize border-r-[3px] border-b-[3px] border-border-strong rounded-br-[12px] touch-none"></div>' : ''}`;

  const isMember = memberFilter(g, kind);
  el.querySelectorAll('.am-btn').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); setAreaRelays(g.areaId, b.dataset.act === 'on'); });
  });
  if (state.edit) {
    groupHeaderDrag(el.querySelector('.area-head'), el, g, isMember, isDev);
    const rz = el.querySelector('.area-resize');
    dragMove(rz, el, (dx, dy, ow, oh) => { g.w = Math.max(160, ow + dx); g.h = Math.max(120, oh + dy); el.style.width = g.w + 'px'; el.style.height = g.h + 'px'; },
      () => (g.w || 320), () => (g.h || 220),
      () => { if (isDev) pinDeviceToArea(g); for (const r of state.layout.relays.filter(isMember)) clampToBox(r, g); render(); saveLayout(); });
    el.querySelector('.area-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(isDev
        ? t('confirm_remove_device').replace('{name}', g.name || 'physical relay')
        : t('confirm_remove_area').replace('{name}', g.name || 'group'))) return;
      if (isDev) state.layout.devices = state.layout.devices.filter((x) => x.id !== g.id);
      else state.layout.areas = state.layout.areas.filter((x) => x.id !== g.id);
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
      for (const r of state.layout.relays.filter((x) => x.device === g.id)) movers.push({ obj: r, x0: r.x || 20, y0: r.y || 20, el: relEl(r.id) });
    } else {
      // pinned device boxes + their outputs
      for (const d of state.layout.devices.filter((x) => x.area === g.areaId)) {
        movers.push({ obj: d, x0: d.x || 20, y0: d.y || 20, el: boxEl(d.id) });
        for (const r of state.layout.relays.filter((x) => x.device === d.id)) movers.push({ obj: r, x0: r.x || 20, y0: r.y || 20, el: relEl(r.id) });
      }
      // loose cards assigned to this area (not inside a device box)
      for (const r of state.layout.relays.filter((x) => x.area === g.areaId && !x.device)) movers.push({ obj: r, x0: r.x || 20, y0: r.y || 20, el: relEl(r.id) });
    }

    const gx = g.x || 20, gy = g.y || 20;
    let moved = false;
    head.setPointerCapture(e.pointerId);
    // a device box locked to an area stays inside that area box
    const lockBox = isDev && g.area ? state.layout.areas.find((a) => a.areaId === g.area) : null;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      let nx = Math.max(0, gx + dx), ny = Math.max(0, gy + dy);
      if (lockBox) {
        const minX = lockBox.x + PAD, maxX = Math.max(minX, lockBox.x + lockBox.w - (g.w || 320) - PAD);
        const minY = lockBox.y + HDR, maxY = Math.max(minY, lockBox.y + lockBox.h - (g.h || 220) - PAD);
        nx = Math.min(Math.max(nx, minX), maxX); ny = Math.min(Math.max(ny, minY), maxY);
      }
      const adx = nx - gx, ady = ny - gy; // effective (clamped) delta
      g.x = nx; g.y = ny; el.style.left = nx + 'px'; el.style.top = ny + 'px';
      for (const m of movers) { m.obj.x = Math.max(0, m.x0 + adx); m.obj.y = Math.max(0, m.y0 + ady); if (m.el) { m.el.style.left = m.obj.x + 'px'; m.el.style.top = m.obj.y + 'px'; } }
    };
    const up = () => {
      head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up);
      if (!moved) { if (isDev) openDeviceEditor(g); return; } // click (no drag) -> open editor
      if (isDev && pinDeviceToArea(g)) { const a = state.layout.areas.find((x) => x.areaId === g.area); if (a) fitAreaToContents(a); }
      render(); saveLayout();
    };
    head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
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
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); onEnd && onEnd(); };
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
  });
}

function addArea(areaId) {
  if (!areaId) return;
  if (state.layout.areas.some((a) => a.areaId === areaId)) { setStatus('“' + areaName(areaId) + '”' + t('already_on_board')); setTimeout(() => setStatus(''), 1800); return; }
  const id = 'a' + Date.now().toString(36);
  state.layout.areas.push({ id, areaId, name: areaName(areaId), x: 24, y: 24, w: 340, h: 240 });
  render(); saveLayout();
}

// Add a physical relay: a device box + one relay card per output, grouped inside.
function addPhysicalRelay(deviceId) {
  if (!deviceId) return;
  const dev = state.relayDevices.find((d) => d.device_id === deviceId);
  if (!dev) return;
  const id = 'd' + Date.now().toString(36);
  const box = { id, deviceId, name: dev.name, x: 40, y: 40, w: CARD_W + 2 * PAD, h: 200 };
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
  dragMove, addArea, addPhysicalRelay, areaMaster };
