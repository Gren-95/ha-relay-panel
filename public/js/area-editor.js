import { state, $, esc, setMsg, api } from './core.js';
import { t } from './i18n.js';
import { areaColor, hueToHex, hexToHue, fitAreaToContents } from './layout.js';
import { render, updateBoxColors } from './board.js';
import { openEditor, clearBlur, applyBlur } from './editor.js';
import { registerModal, closeOthers, syncBackdrop } from './modals.js';
import { openDeviceEditor } from './device-editor.js';
import { saveLayout } from './history-undo.js';
import { positionResizeHandles } from './resize.js';
import { setAreaRelays, setRelaysTemp } from './relay-actions.js';

// ---- area editor ----
// Deliberately the same shape as the physical-relay (device) editor: an area's
// controls used to sit in its titlebar, which crowded the name on a busy board
// and gave areas a different interaction model from device boxes for no reason.
// Both are now "click the gear, get a panel".
function openAreaEditor(g) {
  if (!state.authed) return;                                  // #63, as the device editor does
  closeOthers('area-editor');
  state.selectedArea = g.id;
  // Populate before showing so the blur paints on a finished panel
  $('#ae-name').value = g.name || '';
  $('#ae-color').value = hueToHex(g.hue != null ? g.hue : areaColor(g.areaId));

  const relays = areaRelays(g);
  const bound = relays.filter((r) => r.bound && r.temp != null);
  const same = bound.length && bound.every((r) => r.temp === bound[0].temp);
  $('#ae-temp').value = same ? bound[0].temp : '';
  $('#ae-temp').placeholder = bound.length && !same ? t('mixed_word') : '';

  // Grouped by physical relay (#101). A flat list of nine outputs says nothing
  // about which box to go and look at; grouped, the panel mirrors the wiring.
  const row = (r) => {
    const on = (state.live[r.relay] || {}).state === 'on';
    return `<div class="ae-rel flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 border-2 border-border rounded-[10px] cursor-pointer text-base" data-id="${esc(r.id)}">
      <span class="w-[46px] h-[30px] rounded-lg flex-none border-2 ${r.relay ? (on ? 'bg-on border-on' : 'bg-off border-border-strong') : 'bg-danger border-danger'}"></span>
      <span class="flex-auto overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.name || r.relay || 'relay')}</span>
      <span class="text-muted text-[.8rem]">${r.bound ? `${r.temp}°` : '<i class="bi bi-circle"></i>'}</span>
    </div>`;
  };

  const boxes = state.layout.devices
    .filter((d) => d.area === g.areaId)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const groups = boxes.map((d) => ({
    boxId: d.id,
    title: d.name || d.deviceId || 'relay box',
    relays: state.layout.relays.filter((r) => r.device === d.id),
  }));
  // cards pinned straight to the area belong to no box - they still have to show
  const loose = state.layout.relays.filter((r) => r.area === g.areaId && !r.device);
  if (loose.length) groups.push({ boxId: null, title: t('no_device'), relays: loose });

  $('#ae-relays').innerHTML = groups.filter((gr) => gr.relays.length).map((gr) => `
    <div class="flex flex-col gap-1.5">
      <div class="ae-box flex items-center gap-1.5 text-[.82rem] font-bold text-muted px-0.5 ${gr.boxId ? 'cursor-pointer hover:text-fg' : ''}"${gr.boxId ? ` data-box="${esc(gr.boxId)}"` : ''}>
        <i class="bi ${gr.boxId ? 'bi-hdd-stack' : 'bi-dash-circle-dotted'}"></i>
        <span class="overflow-hidden text-ellipsis whitespace-nowrap">${esc(gr.title)}</span>
        <span class="ml-auto tabular-nums">${gr.relays.length}</span>
      </div>
      ${gr.relays.map(row).join('')}
    </div>`).join('') || `<div class="text-muted text-[.9rem]">${t('no_relays_here')}</div>`;

  $('#ae-relays').querySelectorAll('.ae-rel').forEach((el) => {
    el.addEventListener('click', () => {
      const r = state.layout.relays.find((x) => x.id === el.dataset.id);
      if (r) openEditor(r);
    });
  });
  // a row opens its relay, so the header opens its box - the obvious parallel
  $('#ae-relays').querySelectorAll('.ae-box[data-box]').forEach((el) => {
    el.addEventListener('click', () => {
      const d = state.layout.devices.find((x) => x.id === el.dataset.box);
      if (d) openDeviceEditor(d);
    });
  });

  aeMsg('');
  $('#area-editor').classList.remove('hidden');
  syncBackdrop();
  applyBlur();
  requestAnimationFrame(positionResizeHandles);
}


// Dragging the colour input repaints the box behind the backdrop, the way the old
// titlebar swatch did (#73). Purely visual: the value is only committed on Save,
// so closing without saving has to put the real colours back - hence the flag.
let previewed = false;
function previewColour() {
  const g = selectedArea(); if (!g) return;
  const el = document.querySelector(`.area[data-gid="${g.id}"]`);
  if (!el) return;
  previewed = true;
  updateBoxColors(el, hexToHue($('#ae-color').value), false, g);
}

function closeAreaEditor() {
  state.selectedArea = null;
  if (previewed) { previewed = false; render(); }   // discard an unsaved preview
  $('#area-editor').classList.add('hidden');
  syncBackdrop();
  clearBlur();
}
function aeMsg(m, cls) { setMsg($('#ae-msg'), m, cls); }
function selectedArea() { return state.layout.areas.find((x) => x.id === state.selectedArea); }
// Cards pinned straight to the area plus the ones inside its device boxes.
function areaRelays(g) {
  const devs = new Set(state.layout.devices.filter((d) => d.area === g.areaId).map((d) => d.id));
  return state.layout.relays.filter((r) => r.area === g.areaId || devs.has(r.device));
}

function saveArea() {
  const g = selectedArea(); if (!g) return;
  const scrollTop = $('#area-editor').scrollTop;
  g.name = $('#ae-name').value.trim() || g.name;
  const hex = $('#ae-color').value;
  if (hex) g.hue = hexToHue(hex);
  fitAreaToContents(g);
  aeMsg(t('saved'), 'ok');
  render(); saveLayout();
  requestAnimationFrame(() => { $('#area-editor').scrollTop = scrollTop; });
}

// Push one target temperature onto every bound relay in the area. setRelaysTemp
// re-binds each one through /api/relays/:rid/bind, so it reports what landed.
async function applyAreaTemp() {
  const g = selectedArea(); if (!g) return;
  const v = parseFloat($('#ae-temp').value);
  if (!isFinite(v) || v < 1) { aeMsg(t('enter_target_temp'), 'err'); return; }
  const targets = areaRelays(g).filter((r) => r.bound && r.relay && r.sensor);
  if (!targets.length) { aeMsg(t('no_bound_relays_match'), 'err'); return; }
  $('#ae-temp-apply').disabled = true;
  const ok = await setRelaysTemp(targets, v);
  $('#ae-temp-apply').disabled = false;
  aeMsg(t('applied_to_n').replace('{n}', ok || 0), ok === targets.length ? 'ok' : 'err');
  openAreaEditor(g);   // refresh the relay list with the new set points
}

async function deleteArea() {
  const g = selectedArea(); if (!g) return;
  if (!confirm(t('confirm_remove_area').replace('{name}', g.name || 'group'))) return;
  api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'area.delete', detail: { name: g.name, id: g.id } }),
  }).catch(() => {});
  state.layout.areas = state.layout.areas.filter((x) => x.id !== g.id);
  closeAreaEditor(); render(); saveLayout();
}

export function initAreaEditor() {
registerModal('area-editor', closeAreaEditor, { dim: true, blur: true });
  $('#ae-close').addEventListener('click', closeAreaEditor);
  $('#ae-save').addEventListener('click', saveArea);
  $('#ae-color-reset').addEventListener('click', () => {
    const g = selectedArea(); if (!g) return;
    delete g.hue;
    $('#ae-color').value = hueToHex(areaColor(g.areaId));
    previewColour();
    aeMsg(t('colour_reset'), 'ok');
  });
  $('#ae-color').addEventListener('input', previewColour);
  $('#ae-temp-apply').addEventListener('click', applyAreaTemp);
  $('#ae-all-on').addEventListener('click', () => { const g = selectedArea(); if (g) setAreaRelays(g.areaId, true); });
  $('#ae-all-off').addEventListener('click', () => { const g = selectedArea(); if (g) setAreaRelays(g.areaId, false); });
  $('#ae-delete').addEventListener('click', deleteArea);
}

export { openAreaEditor, closeAreaEditor, aeMsg, selectedArea, saveArea, deleteArea };
