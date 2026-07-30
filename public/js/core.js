import { applyMode } from './mode.js';
import { updateAuthUI, openLogin } from './auth.js';
import { render } from './board.js';

const state = {
  layout: { relays: [], areas: [], devices: [] },
  layoutVersion: null,  // updated_at from DB — sent back on PUT for optimistic concurrency (#46)
  entities: { switches: [], sensors: [] },
  haAreas: [],
  relayDevices: [],
  edit: false,      // start in view (Live) mode; editing requires sign-in
  kiosk: false,     // ?kiosk=1 — fullscreen read-only, no toolbar, no edit
  loaded: false,    // true only after the layout loads from the DB (never save before)
  authed: false,
  user: null,
  selected: null,
  selectedDev: null,
  live: {},
  autoStates: {},
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
const CANVAS_DESKTOP = 'canvas relative m-5 mt-[calc(var(--header-h,72px)_+_18px)] min-h-[calc(100vh_-_var(--header-h,72px)_-_58px)] bg-surface-2 border border-border rounded-2xl overflow-auto bg-local [background-image:radial-gradient(var(--dot)_1.4px,transparent_1.4px)] [background-size:26px_26px] mobile:m-2.5 mobile:overflow-auto [.kiosk_&]:m-0 [.kiosk_&]:border-0 [.kiosk_&]:rounded-none [.kiosk_&]:min-h-screen [.kiosk_&]:bg-surface [.kiosk_&]:[background-image:radial-gradient(var(--border)_1.3px,transparent_1.3px)] [.kiosk_&]:[background-size:32px_32px]';
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
function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }

export { state, $, canvas, BTN, TINY, FIELD, MSG, CANVAS_DESKTOP, CANVAS_MOBILE, setMsg, setRangeActive, api, setStatus, esc };
