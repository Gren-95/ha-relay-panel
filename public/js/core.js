import { applyMode } from './mode.js';
import { updateAuthUI, openLogin } from './auth.js';
import { render } from './board.js';

const state = {
  layout: { relays: [], areas: [], devices: [] },
  layoutVersion: null,  // updated_at from DB — sent back on PUT for optimistic concurrency (#46)
  entities: { switches: [], sensors: [] },
  config: {},       // server-provided, non-secret settings (see GET /api/config)
  haAreas: [],
  relayDevices: [],
  edit: false,      // start in view (Live) mode; editing requires sign-in
  loaded: false,    // true only after the layout loads from the DB (never save before)
  authed: false,
  user: null,
  selected: null,
  selectedDev: null,
  canvasScale: 0.8,     // relay board zoom level — default 2 clicks below 1.0
  live: {},
  autoStates: {},
  tgtEditing: false, // an inline target-temp input is open — render() holds off the redraw
};

const $ = (s) => document.querySelector(s);
const canvas = $('#canvas');

// ---- shared Tailwind class strings (pure-utility project: no component CSS) ----
const BTN = 'border border-border-strong bg-surface text-fg px-4 py-[11px] rounded-[11px] cursor-pointer text-base font-semibold min-h-[48px] leading-[1.1] shadow-[0_1px_2px_rgba(27,35,54,.04)] active:translate-y-px';
const TINY = 'self-start min-h-0 -mt-[3px] px-3 py-[7px] text-[.82rem] font-semibold rounded-lg bg-surface-2 text-muted border-[1.5px] border-border inline-flex items-center gap-[5px] cursor-pointer active:translate-y-px';
const FIELD = 'bg-input border-2 border-border text-fg rounded-[10px] p-3 text-[1.05rem] min-h-[50px] focus:outline-none focus:border-primary';
const MSG = 'text-[.95rem] min-h-[1.3em] font-semibold';
// message helper: sets full utility class + err/ok colour (JS-owned, replaces .ed-msg)
function setMsg(el, m, cls) { if (!el) return; el.textContent = m || ''; el.className = MSG + (cls === 'err' ? ' text-danger' : cls === 'ok' ? ' text-ok' : ''); }
// range button active state: toggle the primary-fill utilities
function setRangeActive(btn, on) { ['bg-primary', 'border-primary', 'text-white'].forEach((c) => btn.classList.toggle(c, on)); }
// canvas class strings (JS rebuilds #canvas.className each render)
// header height is a variable now (it counter-scales against browser zoom, #52), so
// the canvas subtracts --header-h + its own 2x20px margin rather than a flat 130px
// `isolate` is load-bearing: board objects get one z-index each, counting up from
// the bottom of the board (see zStack in layout.js), so on a busy board they run
// straight through the range the overlays use. Without a stacking context of its
// own the canvas would let a relay card paint over the header, editor and modals.
const CANVAS_DESKTOP = 'canvas relative isolate m-5 mt-[calc(var(--header-h,72px)_+_32px)] min-h-[calc(100vh_-_var(--header-h,72px)_-_58px)] bg-surface-2 border border-border rounded-2xl overflow-auto bg-local [background-image:radial-gradient(var(--dot)_1.4px,transparent_1.4px)] [background-size:26px_26px] mobile:m-2.5 mobile:overflow-auto';
const CANVAS_MOBILE = 'canvas flex flex-col gap-3.5 bg-transparent border-0 p-0 m-3 min-h-0 overflow-visible';

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { // session missing/expired -> back to view, prompt sign-in
    state.authed = false; state.user = null; state.edit = false;
    if (typeof applyMode === 'function') { applyMode(); updateAuthUI(); render(); openLogin(); }
    throw new Error(data.error || 'Sign in required');
  }
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
  return data;
}
function setStatus(m) { $('#status').textContent = m || ''; }
function flashStatus(msg, ms = 1200) { setStatus(msg); setTimeout(() => setStatus(''), ms); }
function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML.replace(/"/g, '&quot;'); }

/*
 * Grouping a set of relays by the physical box they live in (#101). A flat list of
 * outputs says nothing about which box to go and look at; grouped, a panel mirrors
 * the wiring. The area editor and bulk edit both need it, so it lives here rather
 * than in either of them.
 *
 * Takes whatever relays the caller has already selected and returns only non-empty
 * groups, boxes first in name order, then the relays belonging to no box - which
 * come back with `boxId: null` and no title, because the caller owns the wording
 * (core cannot import i18n without closing a cycle back through board.js).
 */
function deviceHost(deviceId) {
  const dev = state.relayDevices.find((x) => x.device_id === deviceId);
  return ((dev && dev.url) || '').replace(/^https?:\/\//, '').replace(/:80$/, '').replace(/\/$/, '');
}
function groupByDevice(relays) {
  const byBox = new Map();
  for (const r of relays) {
    const key = r.device || '';
    if (!byBox.has(key)) byBox.set(key, []);
    byBox.get(key).push(r);
  }
  const groups = [];
  for (const d of [...state.layout.devices].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))) {
    const rs = byBox.get(d.id);
    if (rs && rs.length) {
      groups.push({ boxId: d.id, title: d.name || d.deviceId || 'relay box', host: deviceHost(d.deviceId), relays: rs });
    }
  }
  const loose = byBox.get('') || [];
  if (loose.length) groups.push({ boxId: null, title: null, host: '', relays: loose });
  return groups;
}

export { state, $, canvas, BTN, TINY, FIELD, MSG, CANVAS_DESKTOP, CANVAS_MOBILE, setMsg, setRangeActive, api, setStatus, flashStatus, esc, deviceHost, groupByDevice };
