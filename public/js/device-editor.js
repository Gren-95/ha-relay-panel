import { state, $, esc, setMsg, api } from './core.js';
import { t } from './i18n.js';
import { reflowDeviceOutputs, fitAreaToContents, growToInclude, assignDeviceArea, areaColor, hueToHex, hexToHue } from './layout.js';
import { render } from './board.js';
import { openEditor, closeEditor, clearBlur, applyBlur } from './editor.js';
import { closeActivityLog } from './activity.js';
import { closeBulkEdit } from './bulk.js';
import { closePresets } from './presets.js';
import { closeAreaEditor } from './area-editor.js';
import { saveLayout } from './history-undo.js';
import { positionResizeHandles } from './resize.js';

// ---- device (physical relay) editor ----
function openDeviceEditor(g) {
  if (!state.authed) return; // #63
  closeEditor(); closeActivityLog(); closeBulkEdit(); closePresets(); closeAreaEditor();
  state.selectedDev = g.id;
  // Populate fields first (like the relay editor does) so the blur paints instantly
  $('#de-name').value = g.name || '';
  // Colour picker (#73) — convert stored hue to hex for <input type="color">
  if (g.hue != null) $('#de-color').value = hueToHex(g.hue);
  else $('#de-color').value = hueToHex(areaColor(g.deviceId)); // show hashed colour
  $('#de-area').innerHTML = '<option value="">— none —</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}"${g.area === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
  const outs = state.layout.relays.filter((r) => r.device === g.id);
  $('#de-outputs').innerHTML = outs.map((r) => {
    const on = (state.live[r.relay] || {}).state === 'on';
    return `<div class="de-out flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 border-2 border-border rounded-[10px] cursor-pointer text-base" data-id="${esc(r.id)}">
      <span class="w-[46px] h-[30px] rounded-lg flex-none border-2 ${r.relay ? (on ? 'bg-on border-on' : 'bg-off border-border-strong') : 'bg-danger border-danger'}"></span>
      <span class="flex-auto overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.name || r.relay || 'output')}</span>
      <span class="text-muted text-[.8rem]">${r.bound ? '<i class="bi bi-record-fill"></i> bound' : '<i class="bi bi-circle"></i>'}</span>
    </div>`;
  }).join('') || '<div class="text-muted text-[.9rem]">no outputs</div>';
  $('#de-outputs').querySelectorAll('.de-out').forEach((row) => {
    row.addEventListener('click', () => { const r = state.layout.relays.find((x) => x.id === row.dataset.id); if (r) openEditor(r); });
  });
  const dev = state.relayDevices.find((d) => d.device_id === g.deviceId);
  const used = new Set(outs.map((r) => r.relay));
  const avail = dev ? dev.outputs.filter((o) => !used.has(o.entity_id)) : [];
  const sel = $('#de-add-output');
  sel.innerHTML = '<option value="">+ Add output…</option>' +
    avail.map((o) => `<option value="${esc(o.entity_id)}">${esc(o.name)}</option>`).join('');
  sel.classList.toggle('hidden', avail.length === 0);
  deMsg('');
  // Show the modal + blur all at once (fields already populated)
  $('#dev-editor').classList.remove('hidden');
  $('#backdrop').classList.remove('hidden');
  document.body.classList.add('editor-open');
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
function closeDeviceEditor() { state.selectedDev = null; $('#dev-editor').classList.add('hidden'); $('#backdrop').classList.add('hidden'); document.body.classList.remove('editor-open'); clearBlur(); }
function deMsg(m, cls) { setMsg($('#de-msg'), m, cls); }
function selectedDev() { return state.layout.devices.find((x) => x.id === state.selectedDev); }

function saveDevice() {
  const g = selectedDev(); if (!g) return;
  const scrollTop = $('#dev-editor').scrollTop;
  g.name = $('#de-name').value.trim() || g.name;
  // Save colour override (#73) — store hue, not hex
  const hex = $('#de-color').value;
  if (hex) g.hue = hexToHue(hex);
  const area = $('#de-area').value;
  assignDeviceArea(g, area);
  const a = area && state.layout.areas.find((x) => x.areaId === area); if (a) fitAreaToContents(a);
  deMsg('saved', 'ok');
  render(); saveLayout();
  // Restore scroll position after render
  requestAnimationFrame(() => { $('#dev-editor').scrollTop = scrollTop; });
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

// wiring for the physical-relay (device) editor panel
export function initDeviceEditor() {
$('#de-close').addEventListener('click', closeDeviceEditor);
$('#de-save').addEventListener('click', saveDevice);
// Reset colour to auto (hashed) — #73
$('#de-color-reset').addEventListener('click', () => {
  const g = selectedDev(); if (!g) return;
  delete g.hue;
  $('#de-color').value = hueToHex(areaColor(g.deviceId));
  deMsg('colour reset to auto', 'ok');
});
$('#de-add-output').addEventListener('change', (e) => { addOutputToDevice(e.target.value); e.target.value = ''; });
$('#de-rename-ha').addEventListener('click', renameDeviceHa);
$('#de-delete').addEventListener('click', deleteDevice);
}

export { openDeviceEditor, addOutputToDevice, closeDeviceEditor, deMsg, selectedDev,
  saveDevice, renameDeviceHa, deleteDevice };
