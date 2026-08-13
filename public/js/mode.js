import { $, state } from './core.js';
import { t } from './i18n.js';
import { closeEditor } from './editor.js';
import { closeDeviceEditor } from './device-editor.js';
import { closeAreaEditor } from './area-editor.js';
import { openLogin, updateAuthUI } from './auth.js';
import { closeTopmost as closeTopmostModal } from './modals.js';
import { render } from './board.js';

function applyMode() {
  $('#mode-label').textContent = state.edit ? t('mode_edit') : t('mode_live');
  const i = $('#btn-mode i'); if (i) i.className = state.edit ? 'bi bi-pencil-square' : 'bi bi-eye';
  document.body.classList.toggle('live-mode', !state.edit);
  if (!state.edit) { closeEditor(); closeDeviceEditor(); closeAreaEditor(); }
  updateAuthUI();
}
function toggleMode() {
  if (state.kiosk) return; // kiosk: view-only, no edit toggle
  if (!state.edit && !state.authed) { openLogin(); return; } // entering Edit needs sign-in
  state.edit = !state.edit; applyMode(); render();
}

// Esc closes the top-most open thing. The priority order and every panel's close
// function now live in the registry (#98), so this no longer drifts when a panel
// is added — which is how the area editor came to be missing from three of the
// hand-written mutual-exclusion chains.
const closeTopmost = closeTopmostModal;

// wiring: Edit/View mode button
export function initMode() {
$('#btn-mode').addEventListener('click', toggleMode);
}

export { applyMode, toggleMode, closeTopmost };
