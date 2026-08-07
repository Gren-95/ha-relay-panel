import { $, state, esc, setMsg, api } from './core.js';
import { t } from './i18n.js';
import { closeEditor } from './editor.js';
import { closeDeviceEditor } from './device-editor.js';
import { closeActivityLog } from './activity.js';
import { closePresets } from './presets.js';
import { render } from './board.js';
import { saveLayout } from './history-undo.js';
import { refreshLive } from './relay-actions.js';
import { positionResizeHandles } from './resize.js';

// ---- bulk edit ----
function openBulkEdit() {
  closeEditor(); closeDeviceEditor(); closeActivityLog(); closePresets();
  // populate area dropdown
  const sel = $('#bk-area');
  sel.innerHTML = '<option value="" data-i18n="all_relays">All relays</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  sel.value = '';
  updateBulkList();
  $('#bulk-editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
}

function closeBulkEdit() {
  $('#bulk-editor').classList.add('hidden');
  $('#bk-list').innerHTML = '';
}

function updateBulkList() {
  const area = $('#bk-area').value;
  const mode = $('#bk-mode').value;
  const temp = Number($('#bk-temp').value);
  const deadband = Number($('#bk-deadband').value) || 0;
  const matches = state.layout.relays.filter((r) =>
    r.bound && r.relay && r.sensor && (!area || r.area === area)
  );
  const list = $('#bk-list');
  list.innerHTML = matches.map((r) => {
    const curTemp = r.temp != null ? r.temp : '?';
    const curMode = r.mode === 'above' ? 'cool' : 'heat';
    const newTemp = isFinite(temp) ? temp : curTemp;
    return `<div class="flex items-center gap-2 px-2.5 py-2 bg-surface-2 border-[1.5px] border-border rounded-[10px] text-[.85rem]">
      <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold">${esc(r.name || r.relay)}</span>
      <span class="text-muted">${curMode} ${curTemp}° → ${newTemp}° @ ${mode === 'above' ? 'cool' : r.mode === 'above' ? 'cool' : 'heat'}</span>
    </div>`;
  }).join('') || `<div style="text-align:center;padding:20px;color:var(--muted)">${t('no_bound_relays_match')}</div>`;
  $('#bk-count').textContent = matches.length ? `${matches.length} relay${matches.length === 1 ? '' : 's'}` : '';
  $('#bk-apply').innerHTML = `<i class="bi bi-check-lg"></i> ${t('apply_to_n', { n: matches.length || 0 })}`;
}

async function applyBulk() {
  const area = $('#bk-area').value;
  const mode = $('#bk-mode').value;
  const temp = Number($('#bk-temp').value);
  const deadband = Number($('#bk-deadband').value) || 0;
  if (!isFinite(temp)) { setMsg($('#bk-msg'), t('enter_target_temp'), 'err'); return; }
  const matches = state.layout.relays.filter((r) =>
    r.bound && r.relay && r.sensor && (!area || r.area === area)
  );
  if (!matches.length) { setMsg($('#bk-msg'), t('no_bound_relays_match'), 'err'); return; }
  $('#bk-apply').disabled = true;
  let ok = 0, fail = 0;
  for (const r of matches) {
    try {
      await api(`/api/relays/${r.id}/bind`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: r.name, relay: r.relay, sensor: r.sensor, area: r.area || '',
          mode, temp, deadband,
          schedule: r.schedule || null,
          min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
          notify: !!r.notify, notify_deviation: Number(r.notify_deviation) || 5,
        }),
      });
      r.mode = mode; r.temp = temp; r.deadband = deadband; r.bound = true;
      ok++;
    } catch { fail++; }
  }
  $('#bk-apply').disabled = false;
  setMsg($('#bk-msg'), t('applied_to_n', { n: ok }) + (fail ? ', ' + t('n_failed', { n: fail }) : ''), fail ? 'err' : 'ok');
  render(); saveLayout(); refreshLive();
  updateBulkList();
}

// wiring for the bulk-edit panel
export function initBulk() {
$('#bk-close').addEventListener('click', closeBulkEdit);
$('#bk-area').addEventListener('change', updateBulkList);
['change', 'input'].forEach((ev) => {
  $('#bk-mode').addEventListener(ev, updateBulkList);
  $('#bk-temp').addEventListener(ev, updateBulkList);
  $('#bk-deadband').addEventListener(ev, updateBulkList);
});
$('#bk-apply').addEventListener('click', applyBulk);
}

export { openBulkEdit, closeBulkEdit, updateBulkList, applyBulk };
