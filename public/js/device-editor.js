import { state, $, esc, setMsg, api } from './core.js';
import { t } from './i18n.js';
import { reflowDeviceOutputs, fitAreaToContents, growToInclude, assignDeviceArea, areaColor, hueToHex, hexToHue } from './layout.js';
import { outputsOf, applyOrder, swapRefusal, swapConfigs } from './output-order.mjs';
import { render, updateBoxColors } from './board.js';
import { openEditor, clearBlur, applyBlur } from './editor.js';
import { registerModal, closeOthers, syncBackdrop } from './modals.js';
import { saveLayout } from './history-undo.js';
import { positionResizeHandles } from './resize.js';

// ---- device (physical relay) editor ----

// Draft order while the panel is open. The array order *is* the box order, so the
// list order is only committed on Save — closing without saving discards it.
let draftOrder = null;
let swapArmed = false;
let swapPick = [];

function orderedOutputs(g) {
  const outs = outputsOf(state.layout.relays, g.id);
  if (!draftOrder) return outs;
  const byId = new Map(outs.map((r) => [r.id, r]));
  const ordered = draftOrder.map((id) => byId.get(id)).filter(Boolean);
  // anything missing from the draft (added from another client) goes to the end
  // rather than disappearing from the panel
  for (const r of outs) if (!ordered.includes(r)) ordered.push(r);
  return ordered;
}

const outputLabel = (r) => (r && (r.name || r.relay)) || 'output';

function sensorName(id) {
  const s = state.entities.sensors.find((x) => x.entity_id === id);
  return s ? s.name : id;
}

function modeWord(r) {
  if (r.mode === 'auto') return t('mode_auto');
  if (r.mode === 'above') return t('mode_cool');
  return t('mode_heat');
}

// One compact line under the row: sensor · mode/target · schedule.
function configSummary(r) {
  const parts = [];
  if (r.sensor) parts.push(sensorName(r.sensor));
  const target = r.temp != null ? `${r.temp}°C` : '—';
  const band = r.deadband ? ` ±${r.deadband}` : '';
  parts.push(`${modeWord(r)} ${target}${band}`);
  if (r.schedule && r.schedule.blocks && r.schedule.blocks.length) parts.push(t('scheduled_word'));
  return parts.join(' · ');
}

function rowHtml(r, i, n) {
  const on = (state.live[r.relay] || {}).state === 'on';
  const picked = swapPick.includes(r.id);
  return `<div class="de-out flex items-center gap-2 px-2 py-2 bg-surface-2 border-2 ${picked ? 'border-primary' : 'border-border'} rounded-[10px] cursor-pointer text-base" data-id="${esc(r.id)}" data-idx="${i}">
      <button type="button" class="de-grip flex-none min-h-0 w-8 h-9 grid place-items-center rounded-lg text-muted bg-transparent border-0 cursor-grab active:cursor-grabbing touch-none" aria-label="${esc(t('drag_to_reorder'))}" title="${esc(t('drag_to_reorder'))}"><i class="bi bi-grip-vertical"></i></button>
      <span class="w-[46px] h-[30px] rounded-lg flex-none border-2 ${r.relay ? (on ? 'bg-on border-on' : 'bg-off border-border-strong') : 'bg-danger border-danger'}"></span>
      <div class="flex-auto min-w-0 pointer-events-none">
        <div class="overflow-hidden text-ellipsis whitespace-nowrap">${esc(outputLabel(r))}</div>
        <div class="text-muted text-[.8rem] overflow-hidden text-ellipsis whitespace-nowrap">${esc(configSummary(r))}</div>
      </div>
      <div class="flex-none flex items-center gap-0.5">
        <button type="button" class="de-up flex-none min-h-0 w-7 h-8 grid place-items-center rounded-md bg-transparent border-0 text-muted cursor-pointer disabled:opacity-30" aria-label="${esc(t('move_up'))}" title="${esc(t('move_up'))}"${i === 0 ? ' disabled' : ''}><i class="bi bi-arrow-up"></i></button>
        <button type="button" class="de-down flex-none min-h-0 w-7 h-8 grid place-items-center rounded-md bg-transparent border-0 text-muted cursor-pointer disabled:opacity-30" aria-label="${esc(t('move_down'))}" title="${esc(t('move_down'))}"${i === n - 1 ? ' disabled' : ''}><i class="bi bi-arrow-down"></i></button>
      </div>
      <span class="text-muted text-[.8rem] flex-none">${r.bound ? '<i class="bi bi-record-fill"></i> bound' : '<i class="bi bi-circle"></i>'}</span>
    </div>`;
}

function renderOutputs(g) {
  if (!g) return;
  const outs = orderedOutputs(g);
  $('#de-outputs').innerHTML = outs.map((r, i) => rowHtml(r, i, outs.length)).join('') ||
    '<div class="text-muted text-[.9rem]">no outputs</div>';
  const btn = $('#de-swap');
  if (btn) {
    btn.classList.toggle('hidden', outs.length < 2);
    btn.dataset.i18n = swapArmed ? 'swap_cancel' : 'swap_configs';
    const label = btn.querySelector('span');
    if (label) label.textContent = t(btn.dataset.i18n);
    btn.classList.toggle('border-primary', swapArmed);
    btn.classList.toggle('text-primary', swapArmed);
  }
}

function openDeviceEditor(g) {
  if (!state.authed) return; // #63
  closeOthers('dev-editor');
  state.selectedDev = g.id;
  // Populate fields first (like the relay editor does) so the blur paints instantly
  $('#de-name').value = g.name || '';
  // Colour picker (#73) — convert stored hue to hex for <input type="color">
  if (g.hue != null) $('#de-color').value = hueToHex(g.hue);
  else $('#de-color').value = hueToHex(areaColor(g.deviceId)); // show hashed colour
  $('#de-area').innerHTML = '<option value="">— none —</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}"${g.area === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
  draftOrder = null; swapArmed = false; swapPick = [];
  const outs = orderedOutputs(g);
  renderOutputs(g);
  // The device's own web UI, straight from HA's configuration_url. Shown as the
  // bare host - "http://192.0.2.10:80" is noise - but linked in full, since the
  // reason you want the address is usually to go and look at the relay.
  const dev = state.relayDevices.find((d) => d.device_id === g.deviceId);
  const url = (dev && dev.url) || '';
  const host = url.replace(/^https?:\/\//, '').replace(/:80$/, '').replace(/\/$/, '');
  $('#de-addr-row').classList.toggle('hidden', !host);
  if (host) { $('#de-addr').textContent = host; $('#de-addr').href = url; }

  const used = new Set(outs.map((r) => r.relay));
  const avail = dev ? dev.outputs.filter((o) => !used.has(o.entity_id)) : [];
  const sel = $('#de-add-output');
  sel.innerHTML = '<option value="">+ Add output…</option>' +
    avail.map((o) => `<option value="${esc(o.entity_id)}">${esc(o.name)}</option>`).join('');
  sel.classList.toggle('hidden', avail.length === 0);
  deMsg('');
  // Show the modal + blur all at once (fields already populated)
  $('#dev-editor').classList.remove('hidden');
  syncBackdrop();
  applyBlur();
  requestAnimationFrame(positionResizeHandles);
}

// Add one of the device's own outputs back into its box.
function addOutputToDevice(entityId) {
  const g = selectedDev(); if (!g || !entityId) return;
  const dev = state.relayDevices.find((d) => d.device_id === g.deviceId);
  const o = dev && dev.outputs.find((x) => x.entity_id === entityId);
  if (!o) { deMsg(t('output_not_on_device'), 'err'); return; }
  if (state.layout.relays.some((r) => r.device === g.id && r.relay === entityId)) { deMsg(t('already_added'), 'err'); return; }
  state.layout.relays.push({
    id: 'r' + Date.now().toString(36), name: o.name, relay: o.entity_id,
    sensor: '', area: g.area || '', device: g.id, mode: 'below', temp: 20, deadband: 0, bound: false, x: 0, y: 0,
  });
  reflowDeviceOutputs(g);
  // the box just got a card taller — make room for it in its area rather than
  // letting the containment clamp shove the whole box back up
  const a = g.area && state.layout.areas.find((x) => x.areaId === g.area);
  if (a) { growToInclude(a, g.x, g.y, g.w, g.h); fitAreaToContents(a); }
  render(); saveLayout();
  openDeviceEditor(g); // refresh the list + dropdown
}

// Dragging the colour input repaints the box behind the backdrop, the way the old
// titlebar swatch did (#73). Purely visual: the value is only committed on Save,
// so closing without saving has to put the real colours back - hence the flag.
let previewed = false;
function previewColour() {
  const g = selectedDev(); if (!g) return;
  const el = document.querySelector(`.area[data-gid="${g.id}"]`);
  if (!el) return;
  previewed = true;
  updateBoxColors(el, hexToHue($('#de-color').value), true, g);
}

function closeDeviceEditor() {
  state.selectedDev = null;
  draftOrder = null; swapArmed = false; swapPick = [];   // discard an unsaved order
  if (previewed) { previewed = false; render(); }   // discard an unsaved preview
  $('#dev-editor').classList.add('hidden');
  syncBackdrop(); clearBlur();
}
function deMsg(m, cls) { setMsg($('#de-msg'), m, cls); }
function selectedDev() { return state.layout.devices.find((x) => x.id === state.selectedDev); }

function saveDevice() {
  const g = selectedDev(); if (!g) return;
  const scrollTop = $('#dev-editor').scrollTop;
  // Commit the draft order first: the array order is the box order, so a reorder
  // is a pure reordering of the device's own entries (no config, no geometry).
  if (draftOrder) {
    state.layout.relays = applyOrder(state.layout.relays, g.id, draftOrder);
    draftOrder = null;
    reflowDeviceOutputs(g);
  }
  g.name = $('#de-name').value.trim() || g.name;
  // Save colour override (#73) — store hue, not hex
  const hex = $('#de-color').value;
  if (hex) g.hue = hexToHue(hex);
  const area = $('#de-area').value;
  assignDeviceArea(g, area);
  const a = area && state.layout.areas.find((x) => x.areaId === area); if (a) fitAreaToContents(a);
  swapArmed = false; swapPick = [];
  render(); saveLayout();
  renderOutputs(g);
  deMsg('saved', 'ok');
  // Restore scroll position after render
  requestAnimationFrame(() => { $('#dev-editor').scrollTop = scrollTop; });
}

// Move one row by keyboard/arrow buttons. Purely a draft change until Save.
function moveRow(id, delta) {
  const g = selectedDev(); if (!g) return;
  const order = orderedOutputs(g).map((r) => r.id);
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return;
  order.splice(to, 0, order.splice(from, 1)[0]);
  draftOrder = order;
  renderOutputs(g);
  deMsg(t('order_pending'));
}

// Pick two outputs for a config swap. A deliberate, confirmed action: the drag
// gesture never swaps, so nobody triggers it while rearranging the list.
function pickForSwap(r) {
  const g = selectedDev(); if (!g) return;
  const i = swapPick.indexOf(r.id);
  if (i >= 0) { swapPick.splice(i, 1); renderOutputs(g); deMsg(t('swap_pick_first')); return; }
  if (!swapPick.length) { swapPick.push(r.id); renderOutputs(g); deMsg(t('swap_pick_second')); return; }

  const a = state.layout.relays.find((x) => x.id === swapPick[0]);
  const b = r;
  const reason = swapRefusal(a, b);
  if (reason) {
    swapPick = []; swapArmed = false;
    renderOutputs(g);
    if (reason === 'bound') {
      const names = [a, b].filter((x) => x && x.bound).map(outputLabel).join(', ');
      deMsg(t('swap_blocked_bound', { names }), 'err');
    } else {
      deMsg(t('swap_blocked_no_relay'), 'err');
    }
    return;
  }
  if (!confirm(t('swap_confirm', { a: outputLabel(a), b: outputLabel(b) }))) {
    swapPick = []; swapArmed = false; renderOutputs(g); return;
  }
  swapConfigs(a, b);
  swapPick = []; swapArmed = false;
  // A swap saves immediately (it is a deliberate, confirmed action), so commit any
  // pending draft order first — otherwise the save would carry the old order.
  if (draftOrder) {
    state.layout.relays = applyOrder(state.layout.relays, g.id, draftOrder);
    draftOrder = null;
    reflowDeviceOutputs(g);
  }
  api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'device.swap_configs', detail: { device: g.name, a: outputLabel(a), b: outputLabel(b) } })
  }).catch(() => {});
  render(); saveLayout();
  renderOutputs(g);
  deMsg(t('swap_done'), 'ok');
}

async function renameDeviceHa() {
  const g = selectedDev(); if (!g) return;
  const first = state.layout.relays.find((r) => r.device === g.id && r.relay);
  if (!first) { deMsg(t('no_output_to_rename'), 'err'); return; }
  const nm = prompt('New Home Assistant name for this physical relay:', g.name || '');
  if (nm == null || !nm.trim()) return;
  try {
    deMsg('renaming…');
    const res = await api('/api/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: first.relay, name: nm.trim(), parent: true }) });
    g.name = nm.trim().replace(/\s+/g, '_');
    deMsg('renamed in ' + res.where, 'ok');
    render(); saveLayout();
  } catch (e) { deMsg('error: ' + e.message, 'err'); }
}

async function deleteDevice() {
  const g = selectedDev(); if (!g) return;
  const outputs = state.layout.relays.filter((r) => r.device === g.id);
  const bound = outputs.filter((r) => r.bound);
  const msg = `Remove "${g.name || 'physical relay'}" and its ${outputs.length} output${outputs.length === 1 ? '' : 's'} from the board?` +
    (bound.length ? `\n${bound.length} bound automation${bound.length === 1 ? '' : 's'} will also be removed.` : '');
  if (!confirm(msg)) return;
  // Unbind each bound output so HA automations are cleaned up
  for (const r of bound) {
    try { await api(`/api/relays/${r.id}/unbind`, { method: 'POST' }); } catch {}
  }
  api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'device.delete', detail: { name: g.name, device_id: g.deviceId, outputs: outputs.length } })
  }).catch(() => {});
  state.layout.relays = state.layout.relays.filter((r) => r.device !== g.id);
  state.layout.devices = state.layout.devices.filter((x) => x.id !== g.id);
  closeDeviceEditor(); render(); saveLayout();
}

// Drag to reorder the output list. Pointer events on the list container (not the
// row) so the dragged row can be moved in the DOM while the gesture is captured —
// the same pattern as dragMove in board.js, and it works on touch.
function initOutputList() {
  const list = $('#de-outputs');
  let drag = null;
  let swallowClick = false;

  list.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.de-grip');
    if (!grip) return;
    e.preventDefault();
    const row = grip.closest('.de-out');
    drag = { row, startY: e.clientY, moved: false, pointerId: e.pointerId };
    try { list.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
    row.classList.add('opacity-60');
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    const row = drag.row;
    const others = [...list.querySelectorAll('.de-out')].filter((x) => x !== row);
    for (const other of others) {
      const b = other.getBoundingClientRect();
      if (e.clientY >= b.top && e.clientY <= b.bottom) {
        const before = e.clientY < b.top + b.height / 2;
        list.insertBefore(row, before ? other : other.nextSibling);
        break;
      }
    }
  });

  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    d.row.classList.remove('opacity-60');
    try { list.releasePointerCapture(d.pointerId); } catch { /* already released */ }
    if (!d.moved) return;
    swallowClick = true;
    draftOrder = [...list.querySelectorAll('.de-out')].map((x) => x.dataset.id);
    renderOutputs(selectedDev());
    deMsg(t('order_pending'));
    setTimeout(() => { swallowClick = false; }, 0);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);

  list.addEventListener('click', (e) => {
    if (swallowClick) { swallowClick = false; return; }
    const row = e.target.closest('.de-out');
    if (!row) return;
    if (e.target.closest('.de-grip')) return;
    const r = state.layout.relays.find((x) => x.id === row.dataset.id);
    if (!r) return;
    if (e.target.closest('.de-up')) return moveRow(r.id, -1);
    if (e.target.closest('.de-down')) return moveRow(r.id, 1);
    if (swapArmed) return pickForSwap(r);
    openEditor(r);
  });
}

// wiring for the physical-relay (device) editor panel
export function initDeviceEditor() {
registerModal('dev-editor', closeDeviceEditor, { dim: true, blur: true });
$('#de-close').addEventListener('click', closeDeviceEditor);
$('#de-save').addEventListener('click', saveDevice);
$('#de-swap').addEventListener('click', () => {
  const g = selectedDev(); if (!g) return;
  swapArmed = !swapArmed; swapPick = [];
  renderOutputs(g);
  deMsg(swapArmed ? t('swap_pick_first') : '');
});
initOutputList();
// Reset colour to auto (hashed) — #73
$('#de-color-reset').addEventListener('click', () => {
  const g = selectedDev(); if (!g) return;
  delete g.hue;
  $('#de-color').value = hueToHex(areaColor(g.deviceId));
  previewColour();
  deMsg('colour reset to auto', 'ok');
});
$('#de-color').addEventListener('input', previewColour);
$('#de-add-output').addEventListener('change', (e) => { addOutputToDevice(e.target.value); e.target.value = ''; });
$('#de-rename-ha').addEventListener('click', renameDeviceHa);
$('#de-delete').addEventListener('click', deleteDevice);
}

export { openDeviceEditor, addOutputToDevice, closeDeviceEditor, deMsg, selectedDev,
  saveDevice, renameDeviceHa, deleteDevice };
