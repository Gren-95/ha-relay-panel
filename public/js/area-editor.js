import { state, $, esc, setMsg, api } from './core.js';
import { t } from './i18n.js';
import { areaColor, hueToHex, hexToHue, fitAreaToContents } from './layout.js';
import { render, updateBoxColors } from './board.js';
import { openEditor, closeEditor, clearBlur, applyBlur } from './editor.js';
import { closeActivityLog } from './activity.js';
import { closeBulkEdit } from './bulk.js';
import { closePresets } from './presets.js';
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
  closeEditor(); closeActivityLog(); closeBulkEdit(); closePresets();
  state.selectedArea = g.id;
  // Populate before showing so the blur paints on a finished panel
  $('#ae-name').value = g.name || '';
  $('#ae-color').value = hueToHex(g.hue != null ? g.hue : areaColor(g.areaId));

  const relays = areaRelays(g);
  const bound = relays.filter((r) => r.bound && r.temp != null);
  const same = bound.length && bound.every((r) => r.temp === bound[0].temp);
  $('#ae-temp').value = same ? bound[0].temp : '';
  $('#ae-temp').placeholder = bound.length && !same ? t('mixed_word') : '';

  $('#ae-relays').innerHTML = relays.map((r) => {
    const on = (state.live[r.relay] || {}).state === 'on';
    return `<div class="ae-rel flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 border-2 border-border rounded-[10px] cursor-pointer text-base" data-id="${esc(r.id)}">
      <span class="w-[46px] h-[30px] rounded-lg flex-none border-2 ${r.relay ? (on ? 'bg-on border-on' : 'bg-off border-border-strong') : 'bg-danger border-danger'}"></span>
      <span class="flex-auto overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.name || r.relay || 'relay')}</span>
      <span class="text-muted text-[.8rem]">${r.bound ? `${r.temp}°` : '<i class="bi bi-circle"></i>'}</span>
    </div>`;
  }).join('') || `<div class="text-muted text-[.9rem]">${t('no_relays_here')}</div>`;
  $('#ae-relays').querySelectorAll('.ae-rel').forEach((row) => {
    row.addEventListener('click', () => {
      const r = state.layout.relays.find((x) => x.id === row.dataset.id);
      if (r) openEditor(r);
    });
  });

  aeMsg('');
  $('#area-editor').classList.remove('hidden');
  $('#backdrop').classList.remove('hidden');
  document.body.classList.add('editor-open');
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
  $('#backdrop').classList.add('hidden');
  document.body.classList.remove('editor-open');
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
