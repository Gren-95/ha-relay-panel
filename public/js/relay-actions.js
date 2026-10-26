import { state, $, canvas, setStatus, flashStatus, api } from './core.js';
import { t } from './i18n.js';
import { openLogin } from './auth.js';
import { render } from './board.js';
import { saveLayout } from './history-undo.js';

// ---- quick temp adjust (±0.5°C) ----
async function adjustTemp(rid, dir) {
  const r = state.layout.relays.find((x) => x.id === rid);
  if (!r || !r.bound || !r.relay || !r.sensor) return;
  // if dir is a number > 0.5, treat it as an absolute target temp, not a direction
  const newTemp = Math.abs(dir) > 1 ? Math.max(1, dir) : Math.max(1, (r.temp || 20) + dir * 0.5);
  r.temp = newTemp; // set immediately so mid-edit renders don't revert
  try {
    await api(`/api/relays/${r.id}/bind`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: r.name, relay: r.relay, sensor: r.sensor, area: r.area || '',
        mode: r.mode, temp: newTemp, deadband: Number(r.deadband) || 0,
        schedule: r.schedule || null,
        min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
        notify: !!r.notify, notify_deviation: Number(r.notify_deviation) || 5,
      }),
    });
    r.bound = true;
    render(); saveLayout();
    return true;
  } catch { return false; }
}

// ---- global all-off ----
async function allOff() {
  if (!state.authed) { openLogin(); return; }
  if (!state.edit) return; // greyed out in live mode
  const relays = state.layout.relays.filter((r) => r.relay);
  if (!relays.length) return;
  if (!confirm(t('all_off_confirm'))) return;
  setStatus(t('turning_all_off'));
  let failed = 0;
  await Promise.all(relays.map((r) => api('/api/switch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: r.relay, action: 'off' }),
  }).then((res) => { state.live[r.relay] = { ...(state.live[r.relay] || {}), state: res.state }; }).catch(() => { failed++; })));
  flashStatus(failed ? `${t('all_off_done')} (${failed} failed)` : t('all_off_done'), 2000); // #64
  render();
}

// Master control: turn every relay in an area on/off at once.
async function setAreaRelays(areaId, on) {
  if (!state.authed) { openLogin(); return; } // #62
  if (!state.edit) return; // the master cluster is hidden in View mode; the area editor also calls this
  const relays = state.layout.relays.filter((r) => r.area === areaId && r.relay);
  if (!relays.length) return;
  setStatus(on ? t('turning_area_on') : t('turning_area_off'));
  let failed = 0;
  await Promise.all(relays.map((r) => api('/api/switch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: r.relay, action: on ? 'on' : 'off' }),
  }).then((res) => { state.live[r.relay] = { ...(state.live[r.relay] || {}), state: res.state }; }).catch(() => { failed++; })));
  setStatus(failed ? `${failed}/${relays.length} failed` : ''); render(); // #64
}

// Set a temperature on a list of bound relays (#81) — reused by the global
// header set point and the per-area set point.
async function setRelaysTemp(relays, temp) {
  if (!state.authed) { openLogin(); return; }
  if (!state.edit) return;
  const targets = relays.filter((r) => r.bound && r.relay && r.sensor);
  if (!targets.length) return;
  let ok = 0;
  for (const r of targets) {
    try {
      await api(`/api/relays/${r.id}/bind`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: r.name, relay: r.relay, sensor: r.sensor, area: r.area || '',
          mode: r.mode || 'below', temp, deadband: Number(r.deadband) || 0,
          schedule: r.schedule || null,
          min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
          notify: !!r.notify, notify_deviation: Number(r.notify_deviation) || 5,
        }),
      });
      r.temp = temp;
      ok++;
    } catch {}
  }
  const fail = targets.length - ok;
  flashStatus(t('applied_to_n', { n: ok }) + (fail ? ', ' + t('n_failed', { n: fail }) : ''));
  render(); saveLayout(); refreshLive();
  return ok;
}

// Warning "!" popover: click the icon to see the plain-language reason.
function showWarnPop(anchor, msg) {
  const existing = document.getElementById('warn-pop');
  if (existing) { const same = existing._anchor === anchor; existing.remove(); if (same) return; }
  const pop = document.createElement('div');
  pop.id = 'warn-pop';
  pop.className = 'fixed z-[60] max-w-[270px] bg-surface text-fg border-2 border-border rounded-[10px] px-3 py-2.5 text-[.88rem] leading-[1.35] shadow-panel';
  pop.textContent = msg || ''; pop._anchor = anchor;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8) + 'px';
}

// Manually flip a relay on/off via HA.
async function toggleRelay(r) {
  if (!r.relay) return;
  const cur = (state.live[r.relay] || {}).state;
  try {
    setStatus(t('switching'));
    const res = await api('/api/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: r.relay, action: cur === 'on' ? 'off' : 'on' }) });
    state.live[r.relay] = { ...(state.live[r.relay] || {}), state: res.state };
    setStatus(''); render();
  } catch { setStatus(t('switch_error')); }
}

function liveIds() {
  const ids = new Set();
  for (const r of state.layout.relays) { if (r.sensor) ids.add(r.sensor); if (r.relay) ids.add(r.relay); }
  return ids;
}

// One shape for "new live data arrived", shared by the poll fallback and the
// SSE stream (#push): automations map, states, HA-reachability banner.
function applyLive(liveData, reachable) {
  state.autoStates = liveData._automations || {};
  delete liveData._automations;
  state.live = liveData;
  $('#ha-banner').classList.toggle('hidden', reachable !== false);
  render();
}

// --- live push (SSE): the server fetches HA once per tick for everyone and
// pushes only on change; polling below is the fallback while the stream is
// down (browser auto-reconnects EventSource on its own).
let es = null;
function openLiveStream() {
  if (es || typeof EventSource === 'undefined') return;
  const ids = liveIds();
  if (!ids.size) return;
  es = new EventSource('/api/live/stream?ids=' + encodeURIComponent([...ids].join(',')));
  es.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data);
      state.liveStream = true;
      applyLive(d.states, d.reachable);
    } catch { /* a torn frame is retried by the server tick */ }
  };
  es.onerror = () => { state.liveStream = false; }; // fallback poll takes over
}
function closeLiveStream() {
  if (es) { es.close(); es = null; }
  state.liveStream = false;
}
// Re-open after a layout save: the id list the stream was opened with may no
// longer match the board. history-undo fires state.liveStreamHook after every
// successful save — set here, so no module cycle is needed.
function reopenLiveStream() { closeLiveStream(); openLiveStream(); }
state.liveStreamHook = reopenLiveStream;

async function refreshLive() {
  const ids = liveIds();
  try {
    // Single /api/live now returns states, the automation map (issue #48) and
    // HA reachability — the separate /api/ha-status round-trip is gone.
    const liveData = ids.size
      ? await api('/api/live?ids=' + encodeURIComponent([...ids].join(',')))
      : { ...state.live, _automations: state.autoStates || {}, _reachable: true };
    const reachable = liveData._reachable;
    delete liveData._reachable;
    applyLive(liveData, reachable);
  } catch {}
}

// header summary: quick counts across all bound relays
function updateSummary() {
  const relays = state.layout.relays.filter((r) => r.relay);
  let on = 0, heat = 0, cool = 0, maint = 0, offline = 0;
  for (const r of relays) {
    const lv = state.live[r.relay] || {};
    if (lv.state === 'unavailable' || lv.state === 'unknown' || lv.missing) { offline++; continue; }
    if (lv.state === 'on') { on++; (r.mode === 'above' ? cool++ : heat++); }
    if (r.bound && r.automationId && state.autoStates[r.automationId] === false) maint++;
  }
  const chip = (count, label, bg, fg, icon) =>
    `<span class="inline-flex items-center gap-1 px-[6px] py-px rounded-md text-[.72rem] font-bold" style="background:${bg};color:${fg}">${icon || ''}${count} ${label}</span>`;
  const bits = [`<span class="text-muted">${relays.length} ${t('relays')}</span>`];
  if (on) bits.push(chip(on, t('on_word'), 'var(--on)', '#fff', ''));
  if (maint) bits.push(chip(maint, t('in_maintenance'), 'var(--maint-bg)', 'var(--maint-fg)', '<i class="bi bi-pause-fill"></i> '));
  if (offline) bits.push(chip(offline, t('offline_word'), 'var(--danger)', '#fff', '<i class="bi bi-exclamation-triangle-fill"></i> '));
  $('#summary').innerHTML = relays.length ? bits.join(' ') : ''; // #75
}

// wiring: canvas quick-adjust buttons + warning-popover dismissal
export function initRelayActions() {
canvas.addEventListener('click', (e) => {
  const btn = e.target.closest('.adj-btn');
  if (btn) {
    e.stopPropagation();
    if (!state.authed) { openLogin(); return; }
    if (!state.edit) return;
    adjustTemp(btn.dataset.rid, parseInt(btn.dataset.dir));
    return;
  }
  // per-area temperature set point (#81)
  const tbtn = e.target.closest('.area-temp');
  if (tbtn) {
    e.stopPropagation();
    if (!state.authed) { openLogin(); return; }
    if (!state.edit) return;
    const areaId = tbtn.dataset.area;
    const relays = state.layout.relays.filter((r) => r.bound && r.relay && r.sensor && r.area === areaId);
    if (!relays.length) return;
    const cur = relays[0].temp != null ? relays[0].temp : 20;
    const v = parseFloat(prompt(t('enter_target_temp'), cur));
    if (isFinite(v) && v >= 1) setRelaysTemp(relays, v);
  }
});

// Capture phase, deliberately: this dismisses the popover that is ALREADY open, and it
// has to do that before the click reaches whatever opened a new one. guard.js anchors
// the same popover to whatever was clicked (a toggle, a set-point pill, a menu item),
// and on the bubble this listener ran on that very click — removing the pop in the same
// tick it appeared. The anchor exemption stays so a second click on the anchor toggles
// the pop off in showWarnPop rather than being reopened here.
document.addEventListener('click', (e) => {
  const p = document.getElementById('warn-pop');
  if (p && e.target !== p && !e.target.closest('.warn-icon') && !(p._anchor && p._anchor.contains(e.target))) p.remove();
}, true);
}

export { adjustTemp, allOff, setAreaRelays, setRelaysTemp, showWarnPop, toggleRelay, refreshLive, updateSummary, openLiveStream };
