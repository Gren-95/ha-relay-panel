import { $ } from './core.js';

/*
 * One place that knows what a dismissible panel is (#98).
 *
 * Before this, each panel hand-listed its siblings — openBulkEdit() called
 * closeEditor(); closeDeviceEditor(); closeActivityLog(); closePresets() — so the
 * set had to be edited in N places every time a panel was added, and the area
 * editor was duly missed by three of them. Dismissal was just as uneven: clicking
 * the backdrop closed two of the six board panels, and three of them never dimmed
 * the board at all, so there was nothing to click outside of.
 *
 * Panels register themselves at init. Everything else — Escape, click-outside,
 * "opening one closes the others" — is implemented once, here.
 */

// Escape priority, topmost first. The overlay modals sit above the board panels.
const ORDER = [
  'chart-modal', 'about-modal', 'login-modal',
  'activity-editor', 'preset-editor', 'bulk-editor',
  'editor', 'dev-editor', 'area-editor',
];

const registry = new Map();   // id -> { close, dim, blur }

const el = (id) => document.getElementById(id);
const isOpen = (id) => { const e = el(id); return !!e && !e.classList.contains('hidden'); };

/**
 * @param id    element id of the panel
 * @param close its own close function (owns whatever state it has to clear)
 * @param dim   shows #backdrop while open — also what makes click-outside possible
 * @param blur  blurs the board behind it (the three per-object editors do)
 */
export function registerModal(id, close, { dim = false, blur = false } = {}) {
  registry.set(id, { close, dim, blur });
}

// Show/hide the shared backdrop according to whether any dimming panel is open.
export function syncBackdrop() {
  const any = [...registry].some(([id, m]) => m.dim && isOpen(id));
  $('#backdrop').classList.toggle('hidden', !any);
  const blurred = [...registry].some(([id, m]) => m.blur && isOpen(id));
  document.body.classList.toggle('editor-open', blurred);
  return any;
}

// Close every registered panel except one. Replaces the hand-listed chains.
export function closeOthers(except) {
  for (const [id, m] of registry) if (id !== except && isOpen(id)) m.close();
  syncBackdrop();
}

export function closeAllModals() { closeOthers(null); }

// Esc, and the backdrop click, both mean "dismiss the thing on top".
export function closeTopmost() {
  for (const id of ORDER) {
    if (registry.has(id) && isOpen(id)) { registry.get(id).close(); syncBackdrop(); return true; }
  }
  // dropdowns are not registered panels but Esc should still shut them
  for (const id of ['advanced-menu', 'add-menu']) {
    if (isOpen(id)) { el(id).classList.add('hidden'); return true; }
  }
  return false;
}

export function anyModalOpen() {
  return [...registry].some(([id]) => isOpen(id));
}

export function initModals() {
  // Click-outside for the board panels: the backdrop covers everything they sit
  // over, so a click landing on it is by definition a click outside the panel.
  $('#backdrop').addEventListener('click', closeTopmost);

  // The overlay modals paint their own dim layer, so "outside" is the element
  // itself rather than the shared backdrop.
  for (const id of ['chart-modal', 'about-modal', 'login-modal']) {
    const e = el(id);
    if (e) e.addEventListener('click', (ev) => { if (ev.target === e) closeTopmost(); });
  }
}
