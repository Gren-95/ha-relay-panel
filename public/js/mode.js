import { $, state } from './core.js';
import { t } from './i18n.js';
import { closeEditor } from './editor.js';
import { closeDeviceEditor } from './device-editor.js';
import { openLogin, closeLogin } from './auth.js';
import { closeActivityLog } from './activity.js';
import { closePresets } from './presets.js';
import { closeBulkEdit } from './bulk.js';
import { render } from './board.js';

function applyMode() {
  $('#mode-label').textContent = state.edit ? t('mode_edit') : t('mode_live');
  const i = $('#btn-mode i'); if (i) i.className = state.edit ? 'bi bi-pencil-square' : 'bi bi-eye';
  document.body.classList.toggle('live-mode', !state.edit);
  if (!state.edit) { closeEditor(); closeDeviceEditor(); }
}
function toggleMode() {
  if (state.kiosk) return; // kiosk: view-only, no edit toggle
  if (!state.edit && !state.authed) { openLogin(); return; } // entering Edit needs sign-in
  state.edit = !state.edit; applyMode(); render();
}

// Esc closes the top-most open thing (in priority order)
function closeTopmost() {
  if (!$('#chart-modal').classList.contains('hidden')) { $('#chart-modal').classList.add('hidden'); return true; }
  if (!$('#login-modal').classList.contains('hidden')) { closeLogin(); return true; }
  if (!$('#advanced-menu').classList.contains('hidden')) { $('#advanced-menu').classList.add('hidden'); return true; }
  if (!$('#activity-editor').classList.contains('hidden')) { closeActivityLog(); return true; }
  if (!$('#preset-editor').classList.contains('hidden')) { closePresets(); return true; }
  if (!$('#bulk-editor').classList.contains('hidden')) { closeBulkEdit(); return true; }
  if (!$('#editor').classList.contains('hidden')) { closeEditor(); return true; }
  if (!$('#dev-editor').classList.contains('hidden')) { closeDeviceEditor(); return true; }
  return false;
}

// wiring: Edit/View mode button
export function initMode() {
$('#btn-mode').addEventListener('click', toggleMode);
}

export { applyMode, toggleMode, closeTopmost };
