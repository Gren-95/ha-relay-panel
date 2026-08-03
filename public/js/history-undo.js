import { state, setStatus, flashStatus, api } from './core.js';
import { t } from './i18n.js';
import { closeEditor } from './editor.js';
import { closeDeviceEditor } from './device-editor.js';
import { fillSelects } from './layout.js';
import { render } from './board.js';

async function saveLayout() {
  if (!state.authed) return; // viewers don't persist layout (and shouldn't be prompted to log in)
  if (!state.loaded) return; // never overwrite the DB before the real layout has loaded
  try {
    const body = { ...state.layout, updated_at: state.layoutVersion };
    const result = await api('/api/layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    state.layoutVersion = result.updated_at; // bump to the version we just wrote
    pushHistory();
    flashStatus(t('saved'), 1000);
  } catch (e) {
    if (e.status === 409) {
      // Stale write — fetch the fresh version token & retry with our local changes
      try {
        setStatus(t('save_conflict'));
        const latest = await api('/api/layout');
        state.layoutVersion = latest.updated_at;
        const retryBody = { ...state.layout, updated_at: state.layoutVersion };
        const retryResult = await api('/api/layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(retryBody) });
        state.layoutVersion = retryResult.updated_at;
        pushHistory();
        flashStatus(t('saved'), 1000);
      } catch (retryErr) {
        setStatus(t('save_error') + (retryErr.message ? ': ' + retryErr.message : ''));
      }
    } else {
      setStatus(t('save_error') + (e.message ? ': ' + e.message : ''));
    }
  }
}

// --- undo / redo history (snapshots of the layout) ---
const history = { stack: [], idx: -1, restoring: false };
const snapshot = () => JSON.stringify(state.layout);
function initHistory() { history.stack = [snapshot()]; history.idx = 0; }
function pushHistory() {
  if (history.restoring) return;
  const snap = snapshot();
  if (history.stack[history.idx] === snap) return;      // unchanged
  history.stack = history.stack.slice(0, history.idx + 1); // drop redo tail
  history.stack.push(snap);
  if (history.stack.length > 60) history.stack.shift();
  history.idx = history.stack.length - 1;
}
async function applyHistory() {
  state.layout = JSON.parse(history.stack[history.idx]);
  closeEditor(); closeDeviceEditor();
  history.restoring = true;
  try { await saveLayout(); } finally { history.restoring = false; }
  fillSelects(); render();
}
async function undo() {
  if (!state.edit || !state.authed) return;
  if (history.idx <= 0) { flashStatus(t('nothing_undo'), 1000); return; }
  history.idx--; await applyHistory(); flashStatus(t('undo'), 800);
}
async function redo() {
  if (!state.edit || !state.authed) return;
  if (history.idx >= history.stack.length - 1) { flashStatus(t('nothing_redo'), 1000); return; }
  history.idx++; await applyHistory(); flashStatus(t('redo'), 800);
}

export { saveLayout, initHistory, pushHistory, applyHistory, undo, redo };
