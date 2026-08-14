import { $, state, esc, setMsg, api, groupByDevice } from './core.js';
import { t } from './i18n.js';
import { registerModal, closeOthers, syncBackdrop } from './modals.js';
import { render } from './board.js';
import { saveLayout } from './history-undo.js';
import { refreshLive } from './relay-actions.js';
import { positionResizeHandles } from './resize.js';

// ---- bulk edit ----
function openBulkEdit() {
  closeOthers('bulk-editor');
  // populate area dropdown
  const sel = $('#bk-area');
  sel.innerHTML = '<option value="" data-i18n="all_relays">All relays</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  sel.value = '';
  updateBulkList();
  $('#bulk-editor').classList.remove('hidden');
  syncBackdrop();
  requestAnimationFrame(positionResizeHandles);
}

function closeBulkEdit() {
  $('#bulk-editor').classList.add('hidden');
  $('#bk-list').innerHTML = '';
  syncBackdrop();
}

// 'above' is no longer offered in the UI (auto/heating only, ebeea3a) but relays bound
// before that can still carry it, so the CURRENT side of the preview must render it.
const modeWord = (m) => (m === 'above' ? t('mode_cool') : m === 'auto' ? t('mode_auto') : t('mode_heat'));

function updateBulkList() {
  const area = $('#bk-area').value;
  const mode = $('#bk-mode').value;
  const temp = Number($('#bk-temp').value);
  const deadband = Number($('#bk-deadband').value) || 0;
  const matches = state.layout.relays.filter((r) =>
    r.bound && r.relay && r.sensor && (!area || r.area === area)
  );
  const list = $('#bk-list');
  // before → after, where "after" is what Apply actually writes: the chosen mode and
  // temperature, not the relay's existing ones. The old preview fell back to the relay's
  // own mode whenever the chosen one was not 'above' — which, with 'above' unreachable,
  // was always — so picking Auto still previewed "heat".
  const row = (r) => {
    const curTemp = r.temp != null ? r.temp + '°' : '—';
    const changed = isFinite(temp) && (r.temp !== temp || r.mode !== mode);
    return `<div class="bk-row flex items-center gap-3 px-3 py-2 text-[.85rem]">
      <span class="flex-1 min-w-0 truncate font-medium">${esc(r.name || r.relay)}</span>
      <span class="shrink-0 text-muted tabular-nums">${esc(modeWord(r.mode))} ${curTemp}</span>
      <i class="bi bi-arrow-right text-muted text-[.75rem]"></i>
      <span class="shrink-0 tabular-nums ${changed ? 'font-semibold text-primary' : 'text-muted'}">${
        isFinite(temp) ? `${esc(modeWord(mode))} ${temp}°${deadband ? ` ±${deadband}°` : ''}` : esc(t('unchanged'))
      }</span>
    </div>`;
  };
  // Grouped by physical relay, as the area editor's list is (#101) — "apply to 23
  // relays" is a lot to agree to, and the boxes are what you would walk over to check.
  list.innerHTML = groupByDevice(matches).map((gr) => `
    <div class="bk-group">
      <div class="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 text-[.78rem] font-bold text-muted">
        <i class="bi ${gr.boxId ? 'bi-hdd-stack' : 'bi-dash-circle-dotted'}"></i>
        <span class="truncate">${esc(gr.title || t('no_device'))}</span>
        ${gr.host ? `<span class="tabular-nums font-normal opacity-70 flex-none">${esc(gr.host)}</span>` : ''}
        <span class="ml-auto tabular-nums">${gr.relays.length}</span>
      </div>
      ${gr.relays.map(row).join('')}
    </div>`).join('') || `<div class="px-3 py-5 text-center text-muted text-[.85rem]">${esc(t('no_bound_relays_match'))}</div>`;
  $('#bk-apply').innerHTML = `<i class="bi bi-check-lg"></i> ${esc(t('apply_to_n', { n: matches.length || 0 }))}`;
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
registerModal('bulk-editor', closeBulkEdit, { dim: true });
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
