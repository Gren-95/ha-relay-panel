import { state, $, esc, TINY, setMsg, api } from './core.js';
import { t } from './i18n.js';
import { boxFor, centerInBox, fillSelects } from './layout.js';
import { loadHistory } from './chart.js';
import { toggleRelay, refreshLive } from './relay-actions.js';
import { render } from './board.js';
import { saveLayout } from './history-undo.js';
import { positionResizeHandles } from './resize.js';
import { closeDeviceEditor } from './device-editor.js';
import { closeActivityLog } from './activity.js';
import { closeBulkEdit } from './bulk.js';
import { closePresets } from './presets.js';

function openEditor(r) {
  if (!state.authed) return;
  closeDeviceEditor(); closeActivityLog(); closeBulkEdit(); closePresets();
  state.selected = r.id;
  $('#ed-name').value = r.name || '';
  $('#ed-relay').value = r.relay || '';
  $('#ed-sensor').value = r.sensor || '';
  $('#ed-area').value = r.area || '';
  // Auto-detect mode from current temp vs target if not already set
  let defaultMode = r.mode;
  if (!defaultMode) {
    const live = state.live[r.sensor] || {};
    const cur = parseFloat(live.state);
    const tgt = r.temp != null ? r.temp : 20;
    if (!isNaN(cur)) defaultMode = cur > tgt ? 'above' : 'below';
    else defaultMode = 'below';
  }
  $('#ed-mode').value = defaultMode || 'below';
  $('#ed-temp').value = r.temp != null ? r.temp : 20;
  $('#ed-deadband').value = r.deadband != null ? r.deadband : 0;
  $('#ed-minon').value = r.min_on != null ? r.min_on : 0;
  $('#ed-minoff').value = r.min_off != null ? r.min_off : 0;
  $('#ed-notify').checked = !!r.notify;
  $('#ed-notify-deviation').value = r.notify_deviation != null ? r.notify_deviation : 5;
  $('#ed-notify-deviation-label').classList.toggle('hidden', !r.notify);
  loadScheduleUI(r.schedule);
  edMsg('');
  loadAutomationState(r);
  showStaleWarning(r);
  loadHistory(r);
  // Hide mutation buttons when not signed in (they'd silently fail or 401)
  const show = !!state.authed;
  ['ed-bind', 'ed-duplicate', 'ed-unbind', 'ed-delete'].forEach((id) => {
    const btn = $('#' + id); if (btn) btn.classList.toggle('hidden', !show);
  });
  $('#editor').classList.remove('hidden');
  $('#backdrop').classList.remove('hidden');
  document.body.classList.add('editor-open');
  applyBlur();
  requestAnimationFrame(positionResizeHandles);
}

// ---- schedule editor ----
const SCHED_DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
function schedBlockRow(b) {
  b = b || { days: [1, 2, 3, 4, 5], start: '06:00', end: '18:00', temp: 21 };
  const row = document.createElement('div');
  row.className = 'sched-row border border-border rounded-lg p-2 bg-surface flex flex-col gap-1.5';
  const fieldSm = 'min-h-0 px-2 py-1.5 text-[.9rem] w-auto bg-input border-2 border-border text-fg rounded-[10px] focus:outline-none focus:border-primary';
  row.innerHTML =
    `<div class="sched-days flex flex-wrap gap-1">${SCHED_DAYS.map(([n, lbl]) =>
      `<label class="inline-flex flex-row items-center gap-[3px] text-[.8rem] font-semibold text-muted"><input type="checkbox" class="min-h-0 w-auto" value="${n}"${b.days.includes(n) ? ' checked' : ''}>${lbl}</label>`).join('')}</div>` +
    `<div class="sched-times flex items-center flex-wrap gap-1.5 text-[.9rem]"><input type="time" class="s-start ${fieldSm}" value="${esc(b.start)}"> – <input type="time" class="s-end ${fieldSm}" value="${esc(b.end)}">` +
    ` <input type="number" step="0.5" class="s-temp ${fieldSm} !w-[72px]" value="${b.temp}" title="target °C"> °C` +
    ` <button type="button" class="sched-del ${TINY} ml-auto !px-[9px] !py-[2px]" title="remove">&times;</button></div>`;
  row.querySelector('.sched-del').addEventListener('click', () => { row.remove(); });
  return row;
}
function loadScheduleUI(schedule) {
  const on = !!(schedule && Array.isArray(schedule.blocks) && schedule.blocks.length);
  $('#ed-sched-on').checked = on;
  $('#ed-sched-body').classList.toggle('hidden', !on);
  const wrap = $('#ed-sched-blocks'); wrap.innerHTML = '';
  (on ? schedule.blocks : []).forEach((b) => wrap.appendChild(schedBlockRow(b)));
  $('#ed-sched-fallback').value = schedule && schedule.fallback != null ? schedule.fallback : '';
}
function readScheduleUI() {
  if (!$('#ed-sched-on').checked) return null;
  const blocks = [...$('#ed-sched-blocks').querySelectorAll('.sched-row')].map((row) => ({
    days: [...row.querySelectorAll('.sched-days input:checked')].map((c) => +c.value),
    start: row.querySelector('.s-start').value,
    end: row.querySelector('.s-end').value,
    temp: Number(row.querySelector('.s-temp').value),
  })).filter((b) => b.days.length && b.start && b.end && isFinite(b.temp));
  if (!blocks.length) return null;
  const fb = Number($('#ed-sched-fallback').value);
  return { blocks, fallback: isFinite(fb) ? fb : null };
}

// warn if the bound relay/sensor entity no longer exists in HA (e.g. after a rename)
function showStaleWarning(r) {
  const box = $('#ed-stale');
  const relMissing = r.relay && !state.entities.switches.some((s) => s.entity_id === r.relay);
  const senMissing = r.sensor && !state.entities.sensors.some((s) => s.entity_id === r.sensor);
  if (!relMissing && !senMissing) { box.classList.add('hidden'); return; }
  const which = [relMissing && `relay (${r.relay})`, senMissing && `sensor (${r.sensor})`].filter(Boolean).join(' and ');
  box.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> The ${which} no longer exists in Home Assistant (renamed or removed). Pick it again and Save.`;
  box.classList.remove('hidden');
}

// maintenance controls — a manual relay toggle (whenever a relay is set) and,
// for bound relays, the automation enable/disable.
async function loadAutomationState(r) {
  const box = $('#ed-automation');
  if (!r.relay) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  updateRelayToggleBtn(r);

  const row = $('#ed-automation-row');
  if (!r.bound) { row.classList.add('hidden'); return; }
  row.classList.remove('hidden');
  $('#ed-automation-status').textContent = 'checking…';
  $('#ed-automation-toggle').disabled = true;
  try { updateAutomationUI(await api(`/api/relays/${r.id}/automation`)); }
  catch { $('#ed-automation-status').textContent = t('automation_state_unknown'); }
}

function updateRelayToggleBtn(r) {
  const btn = $('#ed-relay-toggle');
  const on = (state.live[r.relay] || {}).state === 'on';
  btn.innerHTML = '<i class="bi bi-power"></i> ' + (on ? t('turn_relay_off') : t('turn_relay_on'));
  ['bg-on', 'border-on', 'text-white'].forEach((c) => btn.classList.toggle(c, on));
}
async function toggleRelayFromEditor() {
  const r = selected(); if (!r || !r.relay) return;
  await toggleRelay(r);          // flips via HA + updates state.live + re-renders
  updateRelayToggleBtn(r);
}
function updateAutomationUI(s) {
  const on = s.exists && s.enabled;
  $('#ed-automation-status').innerHTML = !s.exists ? `<span class="text-heat text-[.95rem] font-bold">${t('auto_none')}</span>`
    : (on ? `<span class="text-ok text-[.95rem] font-bold"><i class="bi bi-record-fill"></i> ${t('auto_on')}</span>` : `<span class="text-heat text-[.95rem] font-bold"><i class="bi bi-pause-fill"></i> ${t('auto_paused')}</span>`);
  const btn = $('#ed-automation-toggle');
  btn.innerHTML = on ? `<i class="bi bi-pause-fill"></i> ${t('pause_maint')}` : `<i class="bi bi-play-fill"></i> ${t('resume_auto')}`;
  btn.disabled = !s.exists;
  btn.dataset.enable = on ? '0' : '1';
}
async function toggleAutomation() {
  const r = selected(); if (!r) return;
  const enable = $('#ed-automation-toggle').dataset.enable === '1';
  $('#ed-automation-toggle').disabled = true;
  try {
    updateAutomationUI(await api(`/api/relays/${r.id}/automation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: enable }),
    }));
    edMsg(enable ? t('automation_enabled') : t('automation_disabled_maint'), 'ok');
  } catch (e) { edMsg('error: ' + e.message, 'err'); loadAutomationState(r); }
}
function closeEditor() { state.selected = null; $('#editor').classList.add('hidden'); $('#backdrop').classList.add('hidden'); document.body.classList.remove('editor-open'); clearBlur(); }

// Apply .blurred to everything except the relay being edited and its containing
// area / device group.  Called on editor open + re-applied after every render().
function applyBlur() {
  if ($('#editor').classList.contains('hidden')) return; // not open
  const selId = state.selected;
  const r = state.layout.relays.find(x => x.id === selId);
  if (!r) return;

  // Container boxes (class="area") that contain the selected relay
  const selArea = state.layout.areas.find(a => a.areaId === r.area);
  const selAreaGid = selArea ? selArea.id : null;
  const selDevGid = r.device || null;

  // Blur every area/device box EXCEPT the ones wrapping the selected relay
  document.querySelectorAll('#canvas .area').forEach(el => {
    const gid = el.dataset.gid;
    el.classList.toggle('blurred', gid !== selAreaGid && gid !== selDevGid);
  });

  // Blur every relay card EXCEPT the selected one
  document.querySelectorAll('#canvas .relay').forEach(el => {
    el.classList.toggle('blurred', el.dataset.id !== selId);
  });
}
function clearBlur() {
  document.querySelectorAll('.blurred').forEach(el => el.classList.remove('blurred'));
}
function edMsg(m, cls) { setMsg($('#ed-msg'), m, cls); }
function selected() { return state.layout.relays.find((x) => x.id === state.selected); }

function addRelay() {
  const id = 'r' + Date.now().toString(36);
  const n = state.layout.relays.length;
  const r = { id, name: 'Relay ' + (n + 1), x: 40, y: 40, relay: '', sensor: '', area: '', mode: 'below', temp: 20, deadband: 0, bound: false };
  state.layout.relays.push(r);
  // If there's a selected area, center the new relay inside it
  const box = state.layout.areas.length ? state.layout.areas[state.layout.areas.length - 1] : null;
  if (box) { r.area = box.areaId; centerInBox(r, box); }
  render(); saveLayout(); openEditor(r);
}

function duplicateRelay() {
  const src = selected(); if (!src) return;
  const id = 'r' + Date.now().toString(36);
  const schedule = src.schedule ? JSON.parse(JSON.stringify(src.schedule)) : undefined;
  const dup = {
    id,
    name: (src.name || 'Relay') + ' (copy)',
    x: (src.x != null ? src.x : 40) + 24,
    y: (src.y != null ? src.y : 40) + 24,
    relay: '',
    sensor: src.sensor || '',
    area: src.area || '',
    mode: src.mode || 'below',
    temp: src.temp != null ? src.temp : 20,
    deadband: src.deadband != null ? src.deadband : 0,
    bound: false,
    schedule,
  };
  state.layout.relays.push(dup);
  closeEditor();
  render(); saveLayout();
  openEditor(state.layout.relays[state.layout.relays.length - 1]);
}

async function bind() {
  const r = selected(); if (!r) return;
  const oldArea = r.area;
  const body = {
    name: $('#ed-name').value.trim(), relay: $('#ed-relay').value, sensor: $('#ed-sensor').value,
    area: $('#ed-area').value, mode: $('#ed-mode').value,
    temp: Number($('#ed-temp').value), deadband: Number($('#ed-deadband').value),
    min_on: Number($('#ed-minon').value) || 0, min_off: Number($('#ed-minoff').value) || 0,
    notify: $('#ed-notify').checked, notify_deviation: Number($('#ed-notify-deviation').value) || 5,
    schedule: readScheduleUI(),
  };
  Object.assign(r, body);
  try {
    edMsg('binding…');
    const res = await api(`/api/relays/${r.id}/bind`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    r.bound = true; r.automationId = res.automationId;
    // swapped into a (different) area -> teleport to the middle of that area
    // (device outputs stay put inside their physical-relay box)
    if (!r.device && r.area && r.area !== oldArea) { const box = boxFor(r); if (box) centerInBox(r, box); }
    edMsg('bound ✓ ' + res.automationId, 'ok');
    loadAutomationState(r);
    render(); saveLayout(); refreshLive();
  } catch (e) { edMsg('error: ' + e.message, 'err'); }
}

// rename the HA device behind an entity (and Z2M too if it's zigbee)
async function renameDevice(entityId) {
  if (!entityId) { edMsg('pick a device first', 'err'); return; }
  const nm = prompt(t('new_name_for') + ' ' + entityId + ':');
  if (nm == null || !nm.trim()) return;
  try {
    edMsg('renaming…');
    const res = await api('/api/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: entityId, name: nm.trim() }) });
    edMsg('renamed in ' + res.where, 'ok');
    // reload the device lists to show the new name (keep current selections)
    setTimeout(async () => {
      try {
        const rv = $('#ed-relay').value, sv = $('#ed-sensor').value, av = $('#ed-area').value;
        state.entities = await api('/api/entities'); fillSelects();
        $('#ed-relay').value = rv; $('#ed-sensor').value = sv; $('#ed-area').value = av;
      } catch {}
    }, 1600);
  } catch (e) { edMsg('rename error: ' + e.message, 'err'); }
}

async function unbind() {
  const r = selected(); if (!r) return;
  try { await api(`/api/relays/${r.id}/unbind`, { method: 'POST' }); r.bound = false; delete r.automationId; loadAutomationState(r); edMsg('automation removed', 'ok'); render(); }
  catch (e) { edMsg('error: ' + e.message, 'err'); }
}

async function deleteRelay() {
  const r = selected(); if (!r) return;
  if (!confirm(t('confirm_delete_relay').replace('{name}', r.name || r.relay || 'relay') + (r.bound ? '\n' + t('confirm_delete_relay_bound') : ''))) return;
  if (r.bound) { try { await api(`/api/relays/${r.id}/unbind`, { method: 'POST' }); } catch {} }
  api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'relay.delete', detail: { rid: r.id, name: r.name, relay: r.relay } })
  }).catch(() => {});
  state.layout.relays = state.layout.relays.filter((x) => x.id !== r.id);
  closeEditor(); render(); saveLayout();
}

// wiring for the relay editor panel
export function initEditor() {
$('#ed-close').addEventListener('click', closeEditor);
$('#backdrop').addEventListener('click', closeEditor);
// Re-apply blur synchronously after every render() rebuilds the canvas DOM.
// Using a custom event dispatched at the end of render() — no debounce, no flash.
$('#canvas').addEventListener('render', applyBlur);
$('#ed-duplicate').addEventListener('click', duplicateRelay);
$('#ed-bind').addEventListener('click', bind);
$('#ed-unbind').addEventListener('click', unbind);
$('#ed-delete').addEventListener('click', deleteRelay);
$('#ed-automation-toggle').addEventListener('click', toggleAutomation);
$('#ed-relay-toggle').addEventListener('click', toggleRelayFromEditor);
$('#ed-rename-relay').addEventListener('click', () => renameDevice($('#ed-relay').value));
$('#ed-rename-sensor').addEventListener('click', () => renameDevice($('#ed-sensor').value));
$('#ed-sched-on').addEventListener('change', (e) => {
  $('#ed-sched-body').classList.toggle('hidden', !e.target.checked);
  if (e.target.checked && !$('#ed-sched-blocks').children.length) $('#ed-sched-blocks').appendChild(schedBlockRow());
});
$('#ed-sched-add').addEventListener('click', () => $('#ed-sched-blocks').appendChild(schedBlockRow()));
$('#ed-notify').addEventListener('change', (e) => {
  $('#ed-notify-deviation-label').classList.toggle('hidden', !e.target.checked);
});
}

export { openEditor, closeEditor, edMsg, selected, addRelay, duplicateRelay, bind,
  unbind, deleteRelay, renameDevice, loadScheduleUI, readScheduleUI, schedBlockRow,
  loadAutomationState };
