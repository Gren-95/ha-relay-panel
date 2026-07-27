import { $, state, api, setStatus } from './core.js';
import { t, setLang, LANG } from './i18n.js';
import { fillSelects, reflowDeviceOutputs, fitAreaToContents } from './layout.js';
import { render, isMobile, addArea, addPhysicalRelay } from './board.js';
import { addRelay, initEditor } from './editor.js';
import { openActivityLog, initActivity } from './activity.js';
import { openBulkEdit, initBulk } from './bulk.js';
import { openPresets, initPresets } from './presets.js';
import { allOff, refreshLive, initRelayActions } from './relay-actions.js';
import { exportLayout, importLayout } from './import-export.js';
import { saveLayout, initHistory, undo, redo } from './history-undo.js';
import { applyMode, toggleMode, closeTopmost, initMode } from './mode.js';
import { updateAuthUI, initAuth } from './auth.js';
import { initResize } from './resize.js';
import { initTheme } from './theme.js';
import { initChart } from './chart.js';
import { initDeviceEditor } from './device-editor.js';

async function boot() {
  try {
    const layout = await api('/api/layout');   // must succeed before we ever save
    const [entities, areas, devices] = await Promise.all([
      api('/api/entities').catch(() => state.entities), api('/api/areas').catch(() => []), api('/api/relay-devices').catch(() => []),
    ]);
    state.layout = layout; state.loaded = true;   // only now is it safe to persist
    state.entities = entities;
    state.haAreas = Array.isArray(areas) ? areas : [];
    state.relayDevices = Array.isArray(devices) ? devices : [];
  } catch (e) {
    // DATA-SAFETY: layout failed to load — do NOT mark loaded, so no save can
    // overwrite the real DB layout with this empty fallback. Retry shortly.
    setStatus('load error — retrying…'); setTimeout(boot, 4000); return;
  }
  state.layout.relays = state.layout.relays || [];
  state.layout.areas = state.layout.areas || [];
  state.layout.devices = state.layout.devices || [];
  // migrate existing layouts to the slim vertical card design
  for (const d of state.layout.devices) reflowDeviceOutputs(d);
  for (const a of state.layout.areas) fitAreaToContents(a);
  fillSelects();
  render();
  initHistory();
  if (state.loaded && state.layout.devices.length) saveLayout();
  refreshLive();
  (function poll() { refreshLive().finally(() => setTimeout(poll, 10000)); })();

  // Kiosk mode: ?kiosk=1 — fullscreen read-only, no toolbar, no edit
  const qs = new URLSearchParams(window.location.search);
  if (qs.get('kiosk') === '1') {
    state.kiosk = true;
    document.body.classList.add('kiosk');
    // Disable edit — kiosk is view-only
    if (state.edit) { state.edit = false; applyMode(); }
    updateAuthUI();
  }
}

// ---- top-level wiring (runs after all modules have evaluated) ----
// wiring
const closeAdvanced = () => $('#advanced-menu').classList.add('hidden');
const closeAdd = () => $('#add-menu').classList.add('hidden');
// +Add menu
$('#btn-add-menu').addEventListener('click', (e) => { e.stopPropagation(); $('#add-menu').classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.tb-add')) $('#add-menu').classList.add('hidden'); });
$('#btn-add-single').addEventListener('click', () => { closeAdd(); addRelay(); });
// Advanced/More menu
$('#btn-advanced').addEventListener('click', (e) => { e.stopPropagation(); $('#advanced-menu').classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.tb-advanced')) $('#advanced-menu').classList.add('hidden'); });
$('#btn-export').addEventListener('click', exportLayout);
$('#btn-import').addEventListener('click', () => { $('#advanced-menu').classList.add('hidden'); $('#import-file').click(); });
$('#btn-activity').addEventListener('click', () => { closeAdvanced(); openActivityLog(); });
$('#btn-bulk').addEventListener('click', () => { closeAdvanced(); openBulkEdit(); });
$('#btn-presets').addEventListener('click', () => { closeAdvanced(); openPresets(); });
$('#btn-alloff').addEventListener('click', allOff);
$('#import-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importLayout(f); e.target.value = ''; });
$('#area-picker').addEventListener('change', (e) => { closeAdd(); addArea(e.target.value); e.target.value = ''; });
$('#device-picker').addEventListener('change', (e) => { closeAdd(); addPhysicalRelay(e.target.value); e.target.value = ''; });

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
    if (state.edit && state.authed) saveLayout(); else { setStatus(t('sign_in_to_save')); setTimeout(() => setStatus(''), 1200); }
  } else if (k === 'z' && !typing) {               // Ctrl+Z / Ctrl+Shift+Z: undo/redo
    e.preventDefault(); e.shiftKey ? redo() : undo();
  } else if (k === 'y' && !typing) {               // Ctrl+Y: redo (alt)
    e.preventDefault(); redo();
  }
});

// language: init from storage (default English), toggle button
$('#btn-lang').addEventListener('click', () => setLang(LANG === 'et' ? 'en' : 'et'));
(function initLang() {
  let l = 'en'; try { l = localStorage.getItem('relaypanel-lang') || 'en'; } catch {}
  // snapshot English defaults now, then apply chosen language
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (!el.children.length && el.dataset.i18nEn == null) el.dataset.i18nEn = el.textContent; });
  setLang(l);
})();

// mobile hamburger: toggle the toolbar dropdown; close on outside tap
$('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); $('#toolbar').classList.toggle('!flex'); });
document.addEventListener('click', (e) => {
  if (!e.target.closest('#toolbar') && !e.target.closest('#btn-menu')) $('#toolbar').classList.remove('!flex');
});

// re-render when crossing the mobile/desktop breakpoint
let _wasMobile = isMobile();
window.addEventListener('resize', () => { const m = isMobile(); if (m !== _wasMobile) { _wasMobile = m; render(); } });

// ---- init sequence ----
initTheme();
initResize();
initMode();
initEditor();
initChart();
initDeviceEditor();
initActivity();
initBulk();
initPresets();
initRelayActions();
initAuth();
applyMode();
boot();
