import { state, $, canvas, setStatus, api } from './core.js';
import { t } from './i18n.js';
import { render } from './board.js';
import { saveLayout } from './history-undo.js';

// ---- quick temp adjust (±0.5°C) ----
async function adjustTemp(rid, dir) {
  const r = state.layout.relays.find((x) => x.id === rid);
  if (!r || !r.bound || !r.relay || !r.sensor) return;
  const newTemp = Math.max(1, (r.temp || 20) + dir * 0.5);
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
    r.temp = newTemp; r.bound = true;
    render(); saveLayout();
  } catch {}
}

// ---- global all-off ----
async function allOff() {
  const relays = state.layout.relays.filter((r) => r.relay);
  if (!relays.length) return;
  if (!confirm(t('all_off_confirm'))) return;
  setStatus('turning all off…');
  await Promise.all(relays.map((r) => api('/api/switch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: r.relay, action: 'off' }),
  }).then((res) => { state.live[r.relay] = { ...(state.live[r.relay] || {}), state: res.state }; }).catch(() => {})));
  setStatus(t('all_off_done')); setTimeout(() => setStatus(''), 1500);
  render();
}

// Master control: turn every relay in an area on/off at once.
async function setAreaRelays(areaId, on) {
  const relays = state.layout.relays.filter((r) => r.area === areaId && r.relay);
  if (!relays.length) return;
  setStatus(on ? t('turning_area_on') : t('turning_area_off'));
  await Promise.all(relays.map((r) => api('/api/switch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: r.relay, action: on ? 'on' : 'off' }),
  }).then((res) => { state.live[r.relay] = { ...(state.live[r.relay] || {}), state: res.state }; }).catch(() => {})));
  setStatus(''); render();
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
  } catch (e) { setStatus(t('switch_error')); }
}

async function refreshLive() {
  const ids = new Set();
  for (const r of state.layout.relays) { if (r.sensor) ids.add(r.sensor); if (r.relay) ids.add(r.relay); }
  try {
    const promises = [
      ids.size ? api('/api/live?ids=' + encodeURIComponent([...ids].join(','))) : Promise.resolve(state.live),
      api('/api/automations').catch(() => state.autoStates || {}),
      api('/api/ha-status').catch(() => ({ reachable: true })),
    ];
    // In kiosk mode, wait for layout refresh before rendering
    if (state.kiosk) {
      try {
        const layout = await api('/api/layout');
        state.layout = layout;
      } catch {}
    }
    const [live, autos, haStatus] = await Promise.all(promises.slice(0, 3));
    state.live = live; state.autoStates = autos || {};
    $('#ha-banner').classList.toggle('hidden', haStatus.reachable !== false);
    render();
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
  const bits = [`${relays.length} ${t('relays')}`];
  if (on) bits.push(`${on} ${t('on_word')}`);
  if (maint) bits.push(`${maint} ${t('in_maintenance')}`);
  if (offline) bits.push(`<i class="bi bi-exclamation-triangle-fill"></i> ${offline} ${t('offline_word')}`);
  $('#summary').innerHTML = relays.length ? bits.join(' · ') : '';
}

// wiring: canvas quick-adjust buttons + warning-popover dismissal
export function initRelayActions() {
canvas.addEventListener('click', (e) => {
  const btn = e.target.closest('.adj-btn');
  if (!btn) return;
  e.stopPropagation();
  adjustTemp(btn.dataset.rid, parseInt(btn.dataset.dir));
});

document.addEventListener('click', (e) => {
  const p = document.getElementById('warn-pop');
  if (p && !e.target.closest('.warn-icon') && e.target !== p) p.remove();
});
}

export { adjustTemp, allOff, setAreaRelays, showWarnPop, toggleRelay, refreshLive, updateSummary };
