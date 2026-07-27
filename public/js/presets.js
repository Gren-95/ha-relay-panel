import { $, state, esc, TINY, api } from './core.js';
import { t } from './i18n.js';
import { closeEditor } from './editor.js';
import { closeDeviceEditor } from './device-editor.js';
import { closeActivityLog } from './activity.js';
import { closeBulkEdit } from './bulk.js';
import { render } from './board.js';
import { saveLayout } from './history-undo.js';
import { refreshLive } from './relay-actions.js';
import { positionResizeHandles } from './resize.js';

// ---- presets ----
function openPresets() {
  closeEditor(); closeDeviceEditor(); closeActivityLog(); closeBulkEdit();
  state.layout.presets = state.layout.presets || [];
  renderPresets();
  $('#preset-editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
}

function closePresets() {
  $('#preset-editor').classList.add('hidden');
  $('#pr-list').innerHTML = '';
}

function renderPresets() {
  const presets = state.layout.presets || [];
  const list = $('#pr-list');
  list.innerHTML = presets.length
    ? presets.map((p, i) => `<div class="flex items-center gap-2 px-2.5 py-2 bg-surface-2 border-[1.5px] border-border rounded-[10px] text-[.85rem]">
        <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold">${esc(p.name)}</span>
        <span class="text-muted">${Object.keys(p.relays || {}).length} relays</span>
        <button class="pr-apply ${TINY}" data-idx="${i}"><i class="bi bi-play-fill"></i></button>
        <button class="pr-del ${TINY} bg-danger border-danger text-white" data-idx="${i}"><i class="bi bi-trash"></i></button>
      </div>`).join('')
    : `<div style="text-align:center;padding:20px;color:var(--muted)">${t('no_presets')}</div>`;
  list.querySelectorAll('.pr-apply').forEach((b) => b.addEventListener('click', () => applyPreset(parseInt(b.dataset.idx))));
  list.querySelectorAll('.pr-del').forEach((b) => b.addEventListener('click', () => deletePreset(parseInt(b.dataset.idx))));
  $('#pr-msg').textContent = '';
}

async function savePreset() {
  const name = $('#pr-name').value.trim();
  if (!name) return;
  const relays = {};
  for (const r of state.layout.relays) {
    if (!r.bound || !r.relay || !r.sensor) continue;
    relays[r.id] = { temp: r.temp, mode: r.mode, deadband: r.deadband };
  }
  if (!Object.keys(relays).length) { $('#pr-msg').textContent = t('no_bound_relays'); return; }
  state.layout.presets = state.layout.presets || [];
  state.layout.presets.push({ name, relays });
  await saveLayout();
  $('#pr-name').value = '';
  renderPresets();
  $('#pr-msg').textContent = t('preset_saved');
}

async function applyPreset(idx) {
  const preset = (state.layout.presets || [])[idx];
  if (!preset) return;
  for (const [rid, cfg] of Object.entries(preset.relays || {})) {
    const r = state.layout.relays.find((x) => x.id === rid);
    if (!r || !r.bound) continue;
    try {
      await api(`/api/relays/${r.id}/bind`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: r.name, relay: r.relay, sensor: r.sensor, area: r.area || '',
          mode: cfg.mode, temp: cfg.temp, deadband: cfg.deadband != null ? cfg.deadband : (r.deadband || 0),
          schedule: r.schedule || null,
          min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
          notify: !!r.notify, notify_deviation: Number(r.notify_deviation) || 5,
        }),
      });
      r.mode = cfg.mode; r.temp = cfg.temp; if (cfg.deadband != null) r.deadband = cfg.deadband;
    } catch {}
  }
  await saveLayout(); render(); refreshLive();
  $('#pr-msg').textContent = t('preset_applied');
}

async function deletePreset(idx) {
  if (!confirm(t('confirm_delete_preset'))) return;
  state.layout.presets.splice(idx, 1);
  await saveLayout();
  renderPresets();
  $('#pr-msg').textContent = t('preset_deleted');
}

// wiring for the presets panel
export function initPresets() {
$('#pr-close').addEventListener('click', closePresets);
$('#pr-save').addEventListener('click', savePreset);
}

export { openPresets, closePresets, renderPresets, savePreset, applyPreset, deletePreset };
