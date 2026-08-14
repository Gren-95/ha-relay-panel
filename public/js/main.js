import { $, state, api, setStatus, flashStatus } from './core.js';
import { t, setLang, LANG } from './i18n.js';
import { fillSelects, reflowDeviceOutputs, fitAreaToContents, packArea } from './layout.js';
import { render, isMobile, addArea, addPhysicalRelay } from './board.js';
import { addRelay, initEditor } from './editor.js';
import { openActivityLog, initActivity } from './activity.js';
import { openBulkEdit, initBulk } from './bulk.js';
import { allOff, setRelaysTemp, refreshLive, initRelayActions } from './relay-actions.js';
import { exportLayout, importLayout } from './import-export.js';
import { saveLayout, initHistory, undo, redo } from './history-undo.js';
import { applyMode, toggleMode, closeTopmost, initMode } from './mode.js';
import { updateAuthUI, openLogin, initAuth, closeAccountMenu } from './auth.js';
import { initResize } from './resize.js';
import { initTheme } from './theme.js';
import { initChart } from './chart.js';
import { initDeviceEditor } from './device-editor.js';
import { initAreaEditor } from './area-editor.js';
import { initModals, registerModal } from './modals.js';

async function boot() {
  try {
    const layout = await api('/api/layout');   // must succeed before we ever save
    const [entities, areas, devices, config] = await Promise.all([
      api('/api/entities').catch(() => state.entities), api('/api/areas').catch(() => []), api('/api/relay-devices').catch(() => []),
      api('/api/config').catch(() => ({})),
    ]);
    state.layoutVersion = layout.updated_at || null;  // for optimistic concurrency (#46)
    delete layout.updated_at;
    state.layout = layout; state.loaded = true;   // only now is it safe to persist
    state.entities = entities;
    state.config = config && typeof config === 'object' ? config : {};
    state.haAreas = Array.isArray(areas) ? areas : [];
    state.relayDevices = Array.isArray(devices) ? devices : [];
  } catch {
    // DATA-SAFETY: layout failed to load — do NOT mark loaded, so no save can
    // overwrite the real DB layout with this empty fallback. Retry shortly.
    setStatus(t('load_error_retrying')); setTimeout(boot, 4000); return;
  }
  state.layout.relays = state.layout.relays || [];
  state.layout.areas = state.layout.areas || [];
  state.layout.devices = state.layout.devices || [];
  // migrate existing layouts to the slim vertical card design
  for (const d of state.layout.devices) reflowDeviceOutputs(d);
  // one-time tidy for areas saved with the old (oversized) box geometry: stack their
  // members from the inner corner and shrink the box onto them. `packed` is stored
  // per area, so a hand-made arrangement is only ever re-packed once.
  for (const a of state.layout.areas) (a.packed ? fitAreaToContents : packArea)(a);
  fillSelects();
  render();
  initHistory();
  if (state.loaded && state.layout.devices.length) saveLayout();
  // #62 — first poll fires immediately; no need for a separate eager refreshLive()
  (function poll() { refreshLive().finally(() => setTimeout(poll, 10000)); })();
}

// ---- top-level wiring (runs after all modules have evaluated) ----
// wiring
const closeAdvanced = () => $('#advanced-menu').classList.add('hidden');
const closeAdd = () => $('#add-menu').classList.add('hidden');
// +Add menu
// These two stopPropagation, so the document listener that would shut the account
// menu (#104) never runs — close it by hand or two dropdowns end up open at once.
$('#btn-add-menu').addEventListener('click', (e) => { e.stopPropagation(); closeAccountMenu(); $('#add-menu').classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.tb-add')) $('#add-menu').classList.add('hidden'); });
$('#btn-add-single').addEventListener('click', () => { closeAdd(); addRelay(); });
// Advanced/More menu
$('#btn-advanced').addEventListener('click', (e) => { e.stopPropagation(); closeAccountMenu(); $('#advanced-menu').classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.tb-advanced')) $('#advanced-menu').classList.add('hidden'); });
$('#btn-export').addEventListener('click', exportLayout);
$('#btn-import').addEventListener('click', () => { $('#advanced-menu').classList.add('hidden'); $('#import-file').click(); });
$('#btn-activity').addEventListener('click', () => { closeAdvanced(); openActivityLog(); });
$('#btn-bulk').addEventListener('click', () => { closeAdvanced(); openBulkEdit(); });
$('#btn-alloff').addEventListener('click', () => { closeAdvanced(); allOff(); });
// About modal (#78)
function openAbout() {
  closeAdvanced();
  const c = state.config || {};
  $('#about-version').textContent = (c.version && c.version !== 'unknown') ? c.version : 'dev';
  if (c.buildDate) { $('#about-build').classList.remove('hidden'); $('#about-build-date').textContent = c.buildDate; }
  else $('#about-build').classList.add('hidden');
  $('#about-desc').textContent = c.description || '';
  updateAboutHAStatus();
  $('#about-modal').classList.remove('hidden');
}
function closeAbout() { $('#about-modal').classList.add('hidden'); }
function updateAboutHAStatus() {
  const el = $('#about-ha-reachable'); if (!el) return;
  el.textContent = state.live && Object.keys(state.live).length ? t('about_ha_reachable') : t('about_ha_checking');
  el.className = state.live && Object.keys(state.live).length ? 'text-ok' : 'text-muted';
}
registerModal('about-modal', closeAbout);
$('#btn-about').addEventListener('click', openAbout);
$('#about-close').addEventListener('click', closeAbout);
$('#about-dismiss').addEventListener('click', closeAbout);
$('#import-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importLayout(f); e.target.value = ''; });
$('#area-picker').addEventListener('change', (e) => { closeAdd(); addArea(e.target.value); e.target.value = ''; });
$('#device-picker').addEventListener('change', (e) => { closeAdd(); addPhysicalRelay(e.target.value); e.target.value = ''; });

// Canvas zoom buttons
const ZOOM_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2];
$('#btn-zoom-in').addEventListener('click', () => {
  const idx = ZOOM_STEPS.indexOf(state.canvasScale);
  if (idx < ZOOM_STEPS.length - 1) { state.canvasScale = ZOOM_STEPS[idx + 1]; render(); }
});
$('#btn-zoom-out').addEventListener('click', () => {
  const idx = ZOOM_STEPS.indexOf(state.canvasScale);
  if (idx > 0) { state.canvasScale = ZOOM_STEPS[idx - 1]; render(); }
});

// Global temperature set point (#81) — click to edit, applies to all bound relays
const gTempText = $('#global-temp-text');
const gTempInput = $('#global-temp-input');
function updateGlobalTempDisplay() {
  const bound = state.layout.relays.filter((r) => r.bound && r.temp != null);
  if (!bound.length) { gTempText.textContent = '—'; return; }
  const vals = bound.map((r) => r.temp);
  const same = vals.every((v) => v === vals[0]);
  gTempText.textContent = same ? vals[0] + '°' : 'mixed';
}
$('#btn-global-temp').addEventListener('click', () => {
  if (!state.authed) { openLogin(); return; }
  if (!state.edit) return;
  gTempText.classList.add('hidden');
  $('#btn-global-temp').classList.add('hidden');
  gTempInput.classList.remove('hidden');
  gTempInput.value = state.layout.relays.find((r) => r.bound && r.temp != null)?.temp || 20;
  gTempInput.focus();
});
const commitGlobalTemp = async () => {
  // Enter hides the input, which blurs it and fires this again - the second pass
  // would re-bind every relay on the board.
  if (gTempInput.classList.contains('hidden')) return;
  const v = parseFloat(gTempInput.value);
  gTempInput.classList.add('hidden');
  $('#btn-global-temp').classList.remove('hidden');
  gTempText.classList.remove('hidden');
  if (isFinite(v) && v >= 1) {
    await setRelaysTemp(state.layout.relays, v);
    updateGlobalTempDisplay();
  }
};
gTempInput.addEventListener('blur', commitGlobalTemp);
gTempInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitGlobalTemp(); });
// refresh the global temp display whenever the board re-renders
document.getElementById('canvas').addEventListener('render', updateGlobalTempDisplay);


// keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName || '');
  const ctrl = e.ctrlKey || e.metaKey;
  const k = (e.key || '').toLowerCase();

  if (e.key === 'Escape') { if (closeTopmost()) e.preventDefault(); return; }
  if (!ctrl) return;

  if (k === 'e' && !typing) {                    // Ctrl+E: toggle Edit/View
    if (!$('#login-modal').classList.contains('hidden')) return;
    e.preventDefault(); toggleMode();
  } else if (k === 's') {                          // Ctrl+S: save layout
    e.preventDefault();
    if (state.edit && state.authed) saveLayout(); else { flashStatus(t('sign_in_to_save'), 1200); }
  } else if (k === 'z' && !typing) {               // Ctrl+Z / Ctrl+Shift+Z: undo/redo
    e.preventDefault(); e.shiftKey ? redo() : undo();
  } else if (k === 'y' && !typing) {               // Ctrl+Y: redo (alt)
    e.preventDefault(); redo();
  }
});

// language: init from storage (default English), toggle button
// Language now lives in the account/options menu (#104); close it so the switch feels
// decisive. Zoom is deliberately left alone — it is a repeat action, so it keeps the
// menu open for a second press.
$('#btn-lang').addEventListener('click', () => { closeAccountMenu(); setLang(LANG === 'et' ? 'en' : 'et'); });
(function initLang() {
  let l = 'en'; try { l = localStorage.getItem('relaypanel-lang') || 'en'; } catch {}
  // snapshot English defaults now, then apply chosen language
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (!el.children.length && el.dataset.i18nEn == null) el.dataset.i18nEn = el.textContent; });
  setLang(l);
})();

// mobile hamburger: toggle the toolbar dropdown; close on outside tap
$('#btn-menu').addEventListener('click', (e) => {
  e.stopPropagation();
  const open = $('#toolbar').classList.toggle('!flex');
  $('#btn-menu').setAttribute('aria-expanded', String(open)); // #63
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#toolbar') && !e.target.closest('#btn-menu')) {
    $('#toolbar').classList.remove('!flex');
    $('#btn-menu').setAttribute('aria-expanded', 'false');
  }
});

// re-render when crossing the mobile/desktop breakpoint
let _wasMobile = isMobile();
window.addEventListener('resize', () => { const m = isMobile(); if (m !== _wasMobile) { _wasMobile = m; render(); } });

// ---- init sequence ----
initModals();
initTheme();
initResize();
initMode();
initEditor();
initChart();
initDeviceEditor();
initAreaEditor();
initActivity();
initBulk();
initRelayActions();
initAuth();
applyMode();
boot();
