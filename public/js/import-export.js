import { state, $, setStatus, flashStatus } from './core.js';
import { t } from './i18n.js';
import { reflowDeviceOutputs, fitAreaToContents, packArea, fillSelects } from './layout.js';
import { closeEditor } from './editor.js';
import { closeDeviceEditor } from './device-editor.js';
import { saveLayout } from './history-undo.js';
import { render } from './board.js';
import { refreshLive } from './relay-actions.js';

// ---- import / export ----
function exportLayout() {
  const data = { app: 'relay-panel', version: 1, exportedAt: new Date().toISOString(), layout: state.layout };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relay-panel-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  $('#advanced-menu').classList.add('hidden');
  flashStatus(t('exported'), 1500);
}

async function importLayout(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { setStatus('not valid JSON'); return; }
  const l = data && data.layout ? data.layout : data; // accept wrapped export or a raw layout
  if (!l || !Array.isArray(l.relays)) { setStatus('not a relay-panel layout'); return; }
  const counts = `${(l.relays || []).length} relays, ${(l.devices || []).length} devices, ${(l.areas || []).length} areas`;
  if (!confirm(t('confirm_import_layout') + '\n' + counts + '\n\n' + t('confirm_continue'))) return;
  state.layout = { relays: l.relays || [], areas: l.areas || [], devices: l.devices || [] };
  for (const d of state.layout.devices) reflowDeviceOutputs(d);
  for (const a of state.layout.areas) (a.packed ? fitAreaToContents : packArea)(a);
  closeEditor(); closeDeviceEditor();
  await saveLayout();
  fillSelects(); render(); refreshLive();
  flashStatus(t('imported'), 1500);
}

export { exportLayout, importLayout };
