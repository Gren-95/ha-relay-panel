'use strict';


// ---- i18n (English default in the HTML; Estonian overrides here) ----
const TR = {
  et: {
    ha_unreachable: 'Home Assistant pole saadaval — näidud võivad olla vananenud',
    app_title: 'Relee paneel',
    physical_relay_ph: '+ Füüsiline relee…', area_ph: '+ Ala…',
    save: 'Salvesta', sign_out: 'Logi välja', toggle_dark: 'Tumeda režiimi lüliti',
    advanced: 'Rohkem', add_single_relay: 'Lisa üksik relee',
    export_layout: 'Ekspordi paigutus', import_layout: 'Impordi paigutus',
    edit_relay: 'Muuda releed', name: 'Nimi', name_ph: 'nt Masterwoodi küte',
    relay_to_switch: 'Lülitatav relee', rename_this_relay: 'Nimeta see relee ümber',
    temp_sensor: 'Temperatuuriandur', rename_this_sensor: 'Nimeta see andur ümber',
    area: 'Ala', none_opt: '— puudub —', heat_or_cool: 'Küte või jahutus?',
    heating_opt: 'Küte — lülita SISSE, kui liiga külm',
    cooling_opt: 'Jahutus — lülita SISSE, kui liiga kuum',
    target_temp: 'Sihttemperatuur (°C)',
    switchback_gap: 'Tagasilülituse vahe (°C) — valikuline, 0 = lülita täpselt sihil',
    use_schedule: 'Kasuta ajakava (erinev siht kellaaja järgi)',
    add_time_block: 'Lisa ajavahemik',
    fallback_temp: 'Muul ajal, siht (°C)',
    sched_hint: 'Kui ükski plokk ei sobi, kasutatakse ülemist sihttemperatuuri (kui varuväärtus pole seatud).',
    last_24h: 'Viimased 24 tundi',
    save_turn_on_auto: 'Salvesta ja lülita automaatjuhtimine sisse',
    duplicate_relay: 'Klooni', remove_automation: 'Eemalda automaatika',
    delete_this_relay: 'Kustuta see relee',
    activity_log: 'Tegevuste logi', newer: 'Uuemad', older: 'Vanimad',
    act_login: 'Sisselogimine', act_logout: 'Väljalogimine',
    act_relay_bind: 'Relee sidumine', act_relay_unbind: 'Sidumise eemaldamine',
    act_device_rename: 'Ümbernimetamine', act_switch_toggle: 'Käsitsi lülitamine',
    act_automation_pause: 'Automaatika peatatud', act_automation_resume: 'Automaatika jätkatud',
    act_automation_reapply: 'Automaatikate taaskandmine',
    act_layout_save: 'Paigutus salvestatud', act_layout_restore: 'Paigutus taastatud',
    act_relay_delete: 'Relee kustutatud', act_device_delete: 'Seade eemaldatud',
    act_area_delete: 'Ala eemaldatud', download_csv: 'Laadi alla CSV',
    notify_on_issues: 'Teavita probleemidest', notify_deviation: 'Teavita kui temp hälbib (°C)',
    bulk_edit: 'Hulgimuutmine', all_relays: 'Kõik releed', apply_to_n: 'Rakenda',
    min_on: 'Minimaalne tööaeg (min)', min_off: 'Minimaalne puhkeaeg (min)',
    min_on_hint: 'Väldi lühitsükleid: relee ei lülitu välja enne seda aega',
    min_off_hint: 'Väldi lühitsükleid: relee ei lülitu sisse enne seda aega',
    presets: 'Eelseaded', preset_name_ph: 'Eelseade nimi',
    preset_saved: 'Eelseade salvestatud', preset_deleted: 'Eelseade kustutatud',
    preset_applied: 'Eelseade rakendatud',
    all_off_confirm: 'Lülita kõik releed välja?', all_off_done: 'Kõik releed välja lülitatud',
    all_off_title: 'Lülita kõik releed välja',
    confirm_remove_device: 'Eemalda "{name}" tahvlilt?',
    confirm_remove_area: 'Eemalda ala "{name}"? Releed jäävad tahvlile.',
    confirm_delete_preset: 'Kustuta eelseade?',
    confirm_delete_relay: 'Kustuta relee "{name}"?',
    confirm_delete_relay_bound: 'Selle automaatjuhtimine eemaldatakse ka.',
    confirm_import_layout: 'Import asendab praeguse paigutuse:',
    confirm_continue: 'Jätka?',
    loading: 'laadin…', no_sensor_bound: 'andur pole seotud',
    not_enough_history: 'pole piisavalt ajalugu', history_unavailable: '(ajalugu pole saadaval)',
    no_data_to_export: 'pole andmeid eksportimiseks', export_error: 'ekspordi viga',
    automation_state_unknown: 'automaatika olek teadmata',
    automation_enabled: 'automaatika lubatud', automation_disabled_maint: 'automaatika hoolduseks peatatud',
    output_not_on_device: 'see väljund pole sellel seadmel', already_added: 'juba lisatud',
    no_bound_relays: 'Ühtegi seotud releed pole', no_bound_relays_match: 'Ühtegi seotud releed ei leitud',
    enter_target_temp: 'Sisesta sihttemperatuur', applied_to_n: 'Rakendatud {n} releele',
    n_failed: '{n} ebaõnnestus', new_name_for: 'Uus nimi:',
    turning_area_on: 'ala sisse lülitamine…', turning_area_off: 'ala välja lülitamine…',
    switching: 'lülitamine…', switch_error: 'lülitamise viga',
    no_presets: 'Ühtegi eelseadet pole salvestatud',
    no_output_to_rename: 'pole ümbernimetatavat väljundit',
    physical_relay_h: 'Füüsiline relee', label_shown: 'Silt (kuvatakse kastil)',
    rename_device_ha: 'Nimeta seade Home Assistantis ümber', group_area: 'Rühm / ala',
    outputs: 'Väljundid', add_output_ph: '+ Lisa väljund…', remove_from_board: 'Eemalda tahvlilt',
    sign_in_to_edit: 'Muutmiseks logi sisse', use_ha_1: 'Kasuta oma ', use_ha_2: ' kontot.',
    username: 'Kasutajanimi', password: 'Parool', sign_in: 'Logi sisse', cancel: 'Tühista',
    // dynamic
    mode_edit: 'Muuda', mode_live: 'Vaade',
    saved: 'salvestatud', save_error: 'salvestamise viga', sign_in_to_save: 'salvestamiseks logi sisse',
    signing_in: 'logib sisse…', signed_in_loading: 'sisse logitud — laen…',
    enter_user_pass: 'Sisesta kasutajanimi ja parool.', sign_in_failed: 'Sisselogimine ebaõnnestus.',
    timed_out: 'Aegus — kontrolli ühendust ja proovi uuesti.',
    exported: 'eksporditud', imported: 'imporditud',
    undo: 'võta tagasi', redo: 'tee uuesti', nothing_undo: 'pole midagi tagasi võtta', nothing_redo: 'pole midagi uuesti teha',
    relays: 'releed', on_word: 'sees', in_maintenance: 'hoolduses', offline_word: 'ühenduseta',
    warn_relay_missing: 'Relee olem puudub Home Assistantis (ümber nimetatud või eemaldatud). Ava see relee, vali see uuesti ja salvesta.',
    warn_relay_offline: 'Relee on ühenduseta / kättesaamatu — seda ei saa praegu lülitada. Kontrolli seadme toidet ja võrku.',
    warn_sensor_missing: 'Temperatuuriandur puudub Home Assistantis (ümber nimetatud või eemaldatud). Ava see relee, vali andur uuesti ja salvesta.',
    warn_sensor_offline: 'Temperatuuriandur on ühenduseta. Automaatjuhtimine on peatatud (relee jääb ohutult VÄLJA). Releed saab siiski käsitsi lülitada.',
    auto_on: 'automaatjuhtimine on SEES', auto_paused: 'hoolduseks peatatud', auto_none: 'automaatjuhtimine puudub',
    pause_maint: 'Peata hoolduseks', resume_auto: 'Jätka automaatjuhtimist',
    turn_relay_off: 'Lülita relee VÄLJA', turn_relay_on: 'Lülita relee SISSE',
    maint_badge: 'hooldus', relay_offline_short: 'relee ühenduseta', no_relay: 'releed pole',
    click_turn_on: 'Klõpsa, et lülitada SISSE', click_turn_off: 'Klõpsa, et lülitada VÄLJA',
    already_on_board: ' on juba tahvlil', all_on: 'Kõik sisse', all_off: 'Kõik välja',
  },
};
const EN = {  // English fallbacks for dynamic (non-HTML) strings
  mode_edit: 'Edit', mode_live: 'Live',
  saved: 'saved', save_error: 'save error', sign_in_to_save: 'sign in to save',
  signing_in: 'signing in…', signed_in_loading: 'signed in — loading…',
  enter_user_pass: 'Enter username and password.', sign_in_failed: 'Sign in failed.',
  timed_out: 'Timed out — check the connection and try again.',
  exported: 'exported', imported: 'imported',
  undo: 'undo', redo: 'redo', nothing_undo: 'nothing to undo', nothing_redo: 'nothing to redo',
  relays: 'relays', on_word: 'on', in_maintenance: 'in maintenance', offline_word: 'offline',
  warn_relay_missing: 'Relay entity is missing in Home Assistant (renamed or removed). Open this relay, pick it again and Save.',
  warn_relay_offline: 'Relay is offline / unreachable — it cannot be switched right now. Check the device power and network.',
  warn_sensor_missing: 'Temperature sensor is missing in Home Assistant (renamed or removed). Open this relay, pick the sensor again and Save.',
  warn_sensor_offline: 'Temperature sensor is offline. Automatic control is paused (the relay fails safe to OFF). You can still switch the relay manually.',
  auto_on: 'automatic control is ON', auto_paused: 'paused for maintenance', auto_none: 'no automatic control',
  pause_maint: 'Pause for maintenance', resume_auto: 'Resume automatic control',
  turn_relay_off: 'Turn relay OFF', turn_relay_on: 'Turn relay ON',
  maint_badge: 'maint', relay_offline_short: 'relay offline', no_relay: 'no relay',
  click_turn_on: 'Click to turn ON', click_turn_off: 'Click to turn OFF',
  already_on_board: ' is already on the board', all_on: 'All on', all_off: 'All off',
  activity_log: 'Activity log', newer: 'Newer', older: 'Older',
  act_login: 'Login', act_logout: 'Logout',
  act_relay_bind: 'Bind relay', act_relay_unbind: 'Unbind relay',
  act_device_rename: 'Rename', act_switch_toggle: 'Manual switch',
  act_automation_pause: 'Automation paused', act_automation_resume: 'Automation resumed',
  act_automation_reapply: 'Reapply automations',
  act_layout_save: 'Layout saved', act_layout_restore: 'Layout restored',
  act_relay_delete: 'Relay deleted', act_device_delete: 'Device removed',
  act_area_delete: 'Area removed', download_csv: 'Download CSV',
  notify_on_issues: 'Notify on issues', notify_deviation: 'Alert if temp deviates by (°C)',
  bulk_edit: 'Bulk edit', all_relays: 'All relays', apply_to_n: 'Apply',
  min_on: 'Minimum on-time (min)', min_off: 'Minimum off-time (min)',
  min_on_hint: 'Prevent short cycling: relay won\'t turn off before this time',
  min_off_hint: 'Prevent short cycling: relay won\'t turn on before this time',
  presets: 'Presets', preset_name_ph: 'Preset name',
  preset_saved: 'Preset saved', preset_deleted: 'Preset deleted',
  preset_applied: 'Preset applied',
  all_off_confirm: 'Turn off all relays?', all_off_done: 'All relays turned off',
  all_off_title: 'Turn all relays off',
  confirm_remove_device: 'Remove "{name}" from the board?',
  confirm_remove_area: 'Remove area "{name}"? Relays inside will stay on the board.',
  confirm_delete_preset: 'Delete preset?',
  confirm_delete_relay: 'Delete relay "{name}"?',
  confirm_delete_relay_bound: 'Its automatic control will also be removed.',
  confirm_import_layout: 'Import will REPLACE the current layout with:',
  confirm_continue: 'Continue?',
  loading: 'loading…', no_sensor_bound: 'no sensor bound',
  not_enough_history: 'not enough history', history_unavailable: '(history unavailable)',
  no_data_to_export: 'no data to export', export_error: 'export error',
  automation_state_unknown: 'automation state unknown',
  automation_enabled: 'automation enabled', automation_disabled_maint: 'automation disabled for maintenance',
  output_not_on_device: 'that output is not on this device', already_added: 'already added',
  no_bound_relays: 'No bound relays to save', no_bound_relays_match: 'No bound relays match',
  enter_target_temp: 'Enter a target temperature', applied_to_n: 'Applied to {n} relays',
  n_failed: '{n} failed', new_name_for: 'New name for',
  turning_area_on: 'turning area on…', turning_area_off: 'turning area off…',
  switching: 'switching…', switch_error: 'switch error',
  no_presets: 'No presets saved yet',
  no_output_to_rename: 'no output entity to rename',
};
let LANG = 'en';
function t(key) { return (LANG === 'et' && TR.et[key] != null) ? TR.et[key] : (EN[key] != null ? EN[key] : key); }
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    if (el.children.length) return; // never overwrite an element that wraps other elements
    const v = LANG === 'et' ? TR.et[el.dataset.i18n] : null; if (v != null) el.textContent = v; else if (el.dataset.i18nEn != null) el.textContent = el.dataset.i18nEn;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const v = LANG === 'et' ? TR.et[el.dataset.i18nPh] : null; if (v != null) el.placeholder = v; });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { const v = LANG === 'et' ? TR.et[el.dataset.i18nTitle] : null; if (v != null) el.title = v; });
  const lb = document.getElementById('btn-lang'); if (lb) lb.textContent = LANG === 'et' ? 'EN' : 'ET';
  document.documentElement.lang = LANG;
}
function setLang(l) {
  LANG = l === 'et' ? 'et' : 'en';
  try { localStorage.setItem('relaypanel-lang', LANG); } catch {}
  // snapshot English defaults once so we can switch back
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (!el.children.length && el.dataset.i18nEn == null) el.dataset.i18nEn = el.textContent; });
  applyI18n();
  if (typeof render === 'function') { applyMode(); render(); }
}

const state = {
  layout: { relays: [], areas: [], devices: [] },
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
const CANVAS_DESKTOP = 'canvas relative m-5 min-h-[calc(100vh_-_130px)] bg-surface-2 border border-border rounded-2xl overflow-auto [background-image:radial-gradient(var(--dot)_1.4px,transparent_1.4px)] [background-size:26px_26px] mobile:m-2.5 mobile:overflow-auto [.kiosk_&]:m-0 [.kiosk_&]:border-0 [.kiosk_&]:rounded-none [.kiosk_&]:min-h-screen [.kiosk_&]:bg-surface [.kiosk_&]:[background-image:radial-gradient(var(--border)_1.3px,transparent_1.3px)] [.kiosk_&]:[background-size:32px_32px]';
const CANVAS_MOBILE = 'canvas flex flex-col gap-3.5 bg-transparent border-0 p-0 m-3 min-h-0 overflow-visible';

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { // session missing/expired -> back to view, prompt sign-in
    state.authed = false; state.user = null; state.edit = false;
    if (typeof applyMode === 'function') { applyMode(); updateAuthUI(); render(); openLogin(); }
    throw new Error(data.error || 'Sign in required');
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function setStatus(m) { $('#status').textContent = m || ''; }
function esc(v) { const d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }

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

function fillSelects() {
  const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
  $('#ed-relay').innerHTML = opt('', '— pick relay —') + state.entities.switches.map((s) => opt(s.entity_id, s.name)).join('');
  $('#ed-sensor').innerHTML = opt('', '— pick sensor —') + state.entities.sensors.map((s) => opt(s.entity_id, s.name)).join('');
  $('#ed-area').innerHTML = opt('', '— none —') + state.haAreas.map((a) => opt(a.id, a.name)).join('');
  $('#device-picker').innerHTML = opt('', '+ Physical relay…') +
    state.relayDevices.map((d) => opt(d.device_id, `${d.name} (${d.outputs.length})`)).join('');
  refreshAreaPicker();
}

// Area picker: already-placed areas shown disabled (can't add the same area twice).
function refreshAreaPicker() {
  const placed = new Set((state.layout.areas || []).map((a) => a.areaId));
  $('#area-picker').innerHTML = '<option value="">+ Area…</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}"${placed.has(a.id) ? ' disabled' : ''}>${esc(a.name)}${placed.has(a.id) ? ' ✓' : ''}</option>`).join('');
}

function areaColor(id) {
  let h = 0; const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
function areaName(id) { const a = state.haAreas.find((x) => x.id === id); return a ? a.name : id; }
// readable header colour for area/device boxes: dark on light theme, light on dark
function headColor(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark ? `hsl(${hue},65%,68%)` : `hsl(${hue},55%,32%)`;
}
function boxTint(hue) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return `hsla(${hue},55%,45%,${dark ? 0.07 : 0.10})`;
}

// --- area containment: a relay assigned to an area is clamped inside its box ---
const CARD_W = 340, CARD_H = 84, GAP = 10, HDR = 44, PAD = 10;
function boxFor(r) {
  if (r.device) { const d = state.layout.devices.find((x) => x.id === r.device); if (d) return d; }
  return r.area ? state.layout.areas.find((a) => a.areaId === r.area) : null;
}
function clampToBox(r, box, w, h) {
  w = w || CARD_W; h = h || CARD_H;
  const minX = box.x + PAD, maxX = Math.max(minX, box.x + box.w - w - PAD);
  const minY = box.y + HDR, maxY = Math.max(minY, box.y + box.h - h - PAD);
  r.x = Math.min(Math.max(r.x, minX), maxX);
  r.y = Math.min(Math.max(r.y, minY), maxY);
}
function centerInBox(r, box, w, h) {
  w = w || CARD_W; h = h || CARD_H;
  r.x = Math.round(box.x + (box.w - w) / 2);
  r.y = Math.round(box.y + HDR + (box.h - HDR - h) / 2);
}

// Stack a device's output cards vertically inside its box and size the box to fit.
function reflowDeviceOutputs(dev) {
  const outs = state.layout.relays.filter((r) => r.device === dev.id);
  dev.w = CARD_W + 2 * PAD;
  dev.h = HDR + PAD + Math.max(1, outs.length) * CARD_H + Math.max(0, outs.length - 1) * GAP + PAD;
  outs.forEach((r, i) => { r.x = dev.x + PAD; r.y = dev.y + HDR + i * (CARD_H + GAP); });
}

// Grow an area box so it contains all its pinned device boxes + loose member cards.
function fitAreaToContents(area) {
  let right = area.x + 200, bottom = area.y + HDR + 100;
  for (const d of state.layout.devices.filter((x) => x.area === area.areaId)) {
    right = Math.max(right, d.x + (d.w || 320)); bottom = Math.max(bottom, d.y + (d.h || 220));
  }
  for (const r of state.layout.relays.filter((x) => x.area === area.areaId && !x.device)) {
    right = Math.max(right, (r.x || 20) + CARD_W); bottom = Math.max(bottom, (r.y || 20) + CARD_H);
  }
  // only GROW — never shrink below the current (possibly manually-set) size,
  // so an area always contains its devices/cards but manual resizing survives.
  area.w = Math.max(area.w || 240, right - area.x + PAD);
  area.h = Math.max(area.h || 140, bottom - area.y + PAD);
}

// Keep every device box sized to its outputs and every area big enough to contain
// its contents — called on each render so sizes can never drift out of sync
// (e.g. after renames, adds, or a card-size change).
function normalizeLayout() {
  for (const d of state.layout.devices) reflowDeviceOutputs(d);
  for (const a of state.layout.areas) fitAreaToContents(a);
}

// The area box whose bounds contain point (px,py), if any.
function areaAt(px, py) {
  return state.layout.areas.find((a) => px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) || null;
}

// Explicitly assign a device box to an HA area (from the box's dropdown).
// Propagates the area to its outputs, and if that area has a box on the board,
// moves the device (with outputs) inside it so it's visually grouped too.
function assignDeviceArea(g, areaId) {
  g.area = areaId || '';
  const outs = state.layout.relays.filter((r) => r.device === g.id);
  outs.forEach((r) => { r.area = areaId || ''; });
  const box = areaId && state.layout.areas.find((a) => a.areaId === areaId);
  if (box) {
    g.x = box.x + PAD; g.y = box.y + HDR;   // slot just inside the area
    reflowDeviceOutputs(g);
    fitAreaToContents(box);                 // grow the area to fit the relay
  } else {
    reflowDeviceOutputs(g);
  }
}

// Pin a device box to whichever area box now contains its center; propagate that
// area to all the device's output relays (so binding/grouping follows the area).
// Returns true if the pinned area changed.
function pinDeviceToArea(g) {
  const cx = (g.x || 20) + (g.w || 320) / 2, cy = (g.y || 20) + (g.h || 220) / 2;
  const area = areaAt(cx, cy);
  const newArea = area ? area.areaId : '';
  if ((g.area || '') === newArea) return false;
  g.area = newArea;
  for (const r of state.layout.relays.filter((x) => x.device === g.id)) r.area = newArea;
  return true;
}

const isMobile = () => window.innerWidth <= 700;

function render() {
  refreshAreaPicker();
  normalizeLayout();
  updateSummary();
  if (isMobile()) return renderMobile();
  canvas.className = CANVAS_DESKTOP + (state.edit ? ' edit cursor-default' : '');
  canvas.innerHTML = '';
  for (const a of state.layout.areas) canvas.appendChild(renderBox(a, 'area'));
  for (const d of state.layout.devices) canvas.appendChild(renderBox(d, 'device'));
  for (const r of state.layout.relays) canvas.appendChild(card(r));

  // Auto-size canvas to fit all content with padding
  let maxX = 600, maxY = 400;
  for (const r of state.layout.relays) {
    maxX = Math.max(maxX, (r.x || 0) + 400);
    maxY = Math.max(maxY, (r.y || 0) + 150);
  }
  for (const g of [...state.layout.areas, ...state.layout.devices]) {
    maxX = Math.max(maxX, (g.x || 0) + (g.w || 320) + 40);
    maxY = Math.max(maxY, (g.y || 0) + (g.h || 220) + 40);
  }
  canvas.style.minWidth = Math.max(maxX, window.innerWidth - 40) + 'px';
  canvas.style.minHeight = Math.max(maxY, window.innerHeight - 130) + 'px';
}

// shared area master on/off buttons (keeps .area-master hook for live-mode hide + .am-btn hooks)
const AM_BTN = 'am-btn text-[.72rem] font-bold px-[9px] py-[3px] rounded-lg cursor-pointer border-[1.5px] border-border-strong bg-surface text-fg';
const areaMaster = () => `<span class="area-master inline-flex gap-1 ml-auto [.live-mode_&]:hidden"><button class="${AM_BTN}" data-act="on">${t('all_on')}</button><button class="${AM_BTN}" data-act="off">${t('all_off')}</button></span>`;

// Mobile: ignore x/y positions, render a nested flex list (area -> device -> outputs).
function renderMobile() {
  canvas.className = CANVAS_MOBILE;
  canvas.innerHTML = '';
  const doneDev = new Set(), doneRel = new Set();

  const deviceBlock = (d) => {
    doneDev.add(d.id);
    const hue = areaColor(d.deviceId);
    const box = document.createElement('div');
    box.className = 'border-2 border-border rounded-[14px] p-2.5 bg-surface-2 flex flex-col gap-2.5';
    box.style.borderColor = `hsl(${hue},45%,55%)`;
    const head = document.createElement('div');
    head.className = 'font-bold text-fg text-base cursor-pointer';
    head.style.color = headColor(hue);
    head.innerHTML = `<i class="bi bi-hdd-stack"></i> ${esc(d.name || d.deviceId)}`;
    head.addEventListener('click', () => openDeviceEditor(d));
    box.appendChild(head);
    for (const r of state.layout.relays.filter((x) => x.device === d.id)) { box.appendChild(card(r, true)); doneRel.add(r.id); }
    return box;
  };

  // areas with their nested devices + loose cards
  for (const a of state.layout.areas) {
    const hue = areaColor(a.areaId);
    const box = document.createElement('div');
    box.className = 'border-[3px] border-dashed border-border-strong rounded-[14px] p-2.5 flex flex-col gap-2.5';
    box.style.borderColor = `hsl(${hue},50%,55%)`;
    box.innerHTML = `<div class="flex items-center justify-between font-extrabold text-[1.05rem] p-0.5" style="color:${headColor(hue)}"><span><i class="bi bi-grid-3x3-gap"></i> ${esc(a.name || a.areaId)}</span>
      ${areaMaster()}</div>`;
    box.querySelectorAll('.am-btn').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setAreaRelays(a.areaId, b.dataset.act === 'on'); }));
    for (const d of state.layout.devices.filter((x) => x.area === a.areaId)) box.appendChild(deviceBlock(d));
    for (const r of state.layout.relays.filter((x) => x.area === a.areaId && !x.device)) { box.appendChild(card(r, true)); doneRel.add(r.id); }
    canvas.appendChild(box);
  }
  // device boxes not in any area
  for (const d of state.layout.devices) if (!doneDev.has(d.id)) canvas.appendChild(deviceBlock(d));
  // loose relays (no device, not already shown)
  for (const r of state.layout.relays) if (!r.device && !doneRel.has(r.id)) canvas.appendChild(card(r, true));
}

// ---- group boxes: HA areas ('area') and physical relay devices ('device') ----
function memberFilter(g, kind) { return kind === 'device' ? (r) => r.device === g.id : (r) => r.area === g.areaId; }

function renderBox(g, kind) {
  const isDev = kind === 'device';
  const refId = isDev ? g.deviceId : g.areaId;
  const hue = areaColor(refId);
  const el = document.createElement('div');
  // border-color + background come from inline style (dynamic per-area hue)
  el.className = 'area absolute border-2 rounded-2xl [.kiosk_&]:border-[3px] ' + (isDev ? 'border-solid z-[2]' : 'border-dashed z-[1]');
  el.dataset.gid = g.id;
  el.style.left = (g.x || 20) + 'px';
  el.style.top = (g.y || 20) + 'px';
  el.style.width = (g.w || 320) + 'px';
  el.style.height = (g.h || 220) + 'px';
  el.style.borderColor = `hsl(${hue},50%,55%)`;
  el.style.background = boxTint(hue);
  const pin = isDev && g.area ? ` <span class="area-pin text-[.85rem] opacity-90 font-medium ml-[5px]"><i class="bi bi-geo-alt-fill"></i> ${esc(areaName(g.area))}</span>` : '';
  // area boxes get a master on/off for all their relays (works in Live mode too)
  const master = !isDev ? areaMaster() : '';
  el.innerHTML = `<div class="area-head flex items-center justify-between px-3 py-2 text-base font-bold cursor-grab active:cursor-grabbing select-none touch-none" style="color:${headColor(hue)}">
      <span>${isDev ? '<i class="bi bi-hdd-stack"></i>' : '<i class="bi bi-grid-3x3-gap"></i>'} ${esc(g.name || refId)}${pin}</span>
      ${master}${state.edit ? '<button class="area-del bg-transparent border-0 text-inherit opacity-60 text-[1.4rem] cursor-pointer leading-none" title="Remove group">&times;</button>' : ''}
    </div>${state.edit ? '<div class="area-resize absolute right-[3px] bottom-[3px] w-5 h-5 cursor-nwse-resize border-r-[3px] border-b-[3px] border-border-strong rounded-br-[12px] touch-none"></div>' : ''}`;

  const isMember = memberFilter(g, kind);
  el.querySelectorAll('.am-btn').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); setAreaRelays(g.areaId, b.dataset.act === 'on'); });
  });
  if (state.edit) {
    groupHeaderDrag(el.querySelector('.area-head'), el, g, isMember, isDev);
    const rz = el.querySelector('.area-resize');
    dragMove(rz, el, (dx, dy, ow, oh) => { g.w = Math.max(160, ow + dx); g.h = Math.max(120, oh + dy); el.style.width = g.w + 'px'; el.style.height = g.h + 'px'; },
      () => (g.w || 320), () => (g.h || 220),
      () => { if (isDev) pinDeviceToArea(g); for (const r of state.layout.relays.filter(isMember)) clampToBox(r, g); render(); saveLayout(); });
    el.querySelector('.area-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(isDev
        ? t('confirm_remove_device').replace('{name}', g.name || 'physical relay')
        : t('confirm_remove_area').replace('{name}', g.name || 'group'))) return;
      if (isDev) state.layout.devices = state.layout.devices.filter((x) => x.id !== g.id);
      else state.layout.areas = state.layout.areas.filter((x) => x.id !== g.id);
      api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isDev ? 'device.delete' : 'area.delete', detail: { name: g.name, id: g.id } })
      }).catch(() => {});
      render(); saveLayout();
    });
  }
  return el;
}

// Drag a group by its header; everything nested moves along. For an AREA box that
// means loose member cards + pinned device boxes (and their outputs). For a DEVICE
// box it means its output cards, and on drop it pins to the area that contains it.
function groupHeaderDrag(head, el, g, isMember, isDev) {
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.area-del')) return; // let the delete button get its click
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;

    // things that move with this group: {obj, kind, x0, y0, el}
    const movers = [];
    const relEl = (id) => canvas.querySelector('.relay[data-id="' + id + '"]');
    const boxEl = (id) => canvas.querySelector('.area[data-gid="' + id + '"]');
    if (isDev) {
      for (const r of state.layout.relays.filter((x) => x.device === g.id)) movers.push({ obj: r, x0: r.x || 20, y0: r.y || 20, el: relEl(r.id) });
    } else {
      // pinned device boxes + their outputs
      for (const d of state.layout.devices.filter((x) => x.area === g.areaId)) {
        movers.push({ obj: d, x0: d.x || 20, y0: d.y || 20, el: boxEl(d.id) });
        for (const r of state.layout.relays.filter((x) => x.device === d.id)) movers.push({ obj: r, x0: r.x || 20, y0: r.y || 20, el: relEl(r.id) });
      }
      // loose cards assigned to this area (not inside a device box)
      for (const r of state.layout.relays.filter((x) => x.area === g.areaId && !x.device)) movers.push({ obj: r, x0: r.x || 20, y0: r.y || 20, el: relEl(r.id) });
    }

    const gx = g.x || 20, gy = g.y || 20;
    let moved = false;
    head.setPointerCapture(e.pointerId);
    // a device box locked to an area stays inside that area box
    const lockBox = isDev && g.area ? state.layout.areas.find((a) => a.areaId === g.area) : null;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      let nx = Math.max(0, gx + dx), ny = Math.max(0, gy + dy);
      if (lockBox) {
        const minX = lockBox.x + PAD, maxX = Math.max(minX, lockBox.x + lockBox.w - (g.w || 320) - PAD);
        const minY = lockBox.y + HDR, maxY = Math.max(minY, lockBox.y + lockBox.h - (g.h || 220) - PAD);
        nx = Math.min(Math.max(nx, minX), maxX); ny = Math.min(Math.max(ny, minY), maxY);
      }
      const adx = nx - gx, ady = ny - gy; // effective (clamped) delta
      g.x = nx; g.y = ny; el.style.left = nx + 'px'; el.style.top = ny + 'px';
      for (const m of movers) { m.obj.x = Math.max(0, m.x0 + adx); m.obj.y = Math.max(0, m.y0 + ady); if (m.el) { m.el.style.left = m.obj.x + 'px'; m.el.style.top = m.obj.y + 'px'; } }
    };
    const up = () => {
      head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up);
      if (!moved) { if (isDev) openDeviceEditor(g); return; } // click (no drag) -> open editor
      if (isDev && pinDeviceToArea(g)) { const a = state.layout.areas.find((x) => x.areaId === g.area); if (a) fitAreaToContents(a); }
      render(); saveLayout();
    };
    head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
  });
}

// generic pointer drag helper: onMove(dx,dy, baseA, baseB); getA/getB give base values
function dragMove(handle, el, onMove, getA, getB, onEnd) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, a0 = getA(), b0 = getB();
    handle.setPointerCapture(e.pointerId);
    const mv = (ev) => onMove(ev.clientX - sx, ev.clientY - sy, a0, b0);
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); onEnd && onEnd(); };
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
  });
}

function addArea(areaId) {
  if (!areaId) return;
  if (state.layout.areas.some((a) => a.areaId === areaId)) { setStatus('“' + areaName(areaId) + '”' + t('already_on_board')); setTimeout(() => setStatus(''), 1800); return; }
  const id = 'a' + Date.now().toString(36);
  state.layout.areas.push({ id, areaId, name: areaName(areaId), x: 24, y: 24, w: 340, h: 240 });
  render(); saveLayout();
}

// Add a physical relay: a device box + one relay card per output, grouped inside.
function addPhysicalRelay(deviceId) {
  if (!deviceId) return;
  const dev = state.relayDevices.find((d) => d.device_id === deviceId);
  if (!dev) return;
  const id = 'd' + Date.now().toString(36);
  const box = { id, deviceId, name: dev.name, x: 40, y: 40, w: CARD_W + 2 * PAD, h: 200 };
  state.layout.devices.push(box);
  dev.outputs.forEach((o, i) => {
    state.layout.relays.push({
      id: 'r' + Date.now().toString(36) + i, name: o.name, relay: o.entity_id,
      sensor: '', area: '', device: id, mode: 'below', temp: 20, deadband: 0, bound: false, x: 0, y: 0,
    });
  });
  reflowDeviceOutputs(box);
  render(); saveLayout();
}

// ---- relay cards ----
function card(r, mobile) {
  const el = document.createElement('div');
  // maintenance = bound automation currently disabled — needed up-front for the card border
  const maint = r.bound && r.automationId && state.autoStates[r.automationId] === false;
  el.className = [
    'relay bg-surface rounded-[14px] px-[14px] shadow-panel select-none flex items-center gap-3 box-border touch-none',
    maint ? 'border-2 border-heat' : 'border border-border',
    mobile ? 'static w-full h-auto min-h-[84px]'
           : 'absolute z-[3] w-[340px] h-[84px]' + (state.edit ? ' cursor-grab' : ''),
  ].join(' ');
  el.dataset.id = r.id;
  if (!mobile) { el.style.left = (r.x || 20) + 'px'; el.style.top = (r.y || 20) + 'px'; }
  if (r.area) { const hue = areaColor(r.area); el.style.borderLeft = `4px solid hsl(${hue},60%,50%)`; }

  const live = state.live[r.sensor] || {};
  const relLive = state.live[r.relay] || {};
  const temp = live.state != null && live.state !== '' && !isNaN(+live.state) ? (+live.state).toFixed(1) : '—';
  const sensLive = state.live[r.sensor] || {};
  const on = relLive.state === 'on';
  // offline / stale-binding detection — distinguish the RELAY from its SENSOR.
  // A relay stays usable when only its sensor is down (just no auto-control).
  const relMissing = !!(r.relay && relLive.missing);
  const relOffline = !!(r.relay && (relLive.state === 'unavailable' || relLive.state === 'unknown'));
  const senMissing = !!(r.sensor && sensLive.missing);
  const senOffline = !!(r.sensor && (sensLive.state === 'unavailable' || sensLive.state === 'unknown'));
  const relayBad = relMissing || relOffline;  // relay itself unreachable -> can't switch
  // one clear "!" icon per problem; message shown on hover/click
  let warnMsg = '', warnLevel = '';
  if (relMissing) { warnMsg = t('warn_relay_missing'); warnLevel = 'error'; }
  else if (relOffline) { warnMsg = t('warn_relay_offline'); warnLevel = 'error'; }
  else if (senMissing) { warnMsg = t('warn_sensor_missing'); warnLevel = 'error'; }
  else if (senOffline) { warnMsg = t('warn_sensor_offline'); warnLevel = 'warn'; }
  const warnColor = warnLevel === 'error' ? 'text-danger' : 'text-[#d97706]';
  const warnIcon = warnMsg ? `<button class="warn-icon p-0 border-0 bg-transparent cursor-pointer leading-none text-[1.35rem] flex-none align-[-.12em] ${warnColor}" title="${esc(warnMsg)}" data-msg="${esc(warnMsg)}" aria-label="warning"><i class="bi bi-exclamation-triangle-fill"></i></button>` : '';
  // the on/off toggle is the coloured dot: emit exactly one bg + border per state
  const togBase = 'r-toggle p-0 cursor-pointer w-[34px] h-[34px] rounded-full border-2 disabled:cursor-default disabled:opacity-40 [.kiosk_&]:w-14 [.kiosk_&]:h-14';
  const togState = !r.relay ? 'bg-off border-border-strong'
    : on ? 'bg-on border-on shadow-[0_0_0_3px_rgba(21,128,61,.2)]'
    : 'bg-[var(--toggle-off)] border-border-strong';
  // temperature styling: colour the current reading by demand vs satisfied
  const curNum = temp !== '—' ? +temp : null;
  let curColor = 'text-fg';
  if (curNum != null && r.temp != null) {
    if (r.mode === 'above') curColor = curNum > r.temp ? 'text-cool' : 'text-ok';
    else curColor = curNum < r.temp ? 'text-heat' : 'text-ok';
  }
  const modeIcon = on
    ? (r.mode === 'above' ? '<i class="bi bi-arrow-down text-cool animate-mode-pulse"></i>' : '<i class="bi bi-arrow-up text-heat animate-mode-pulse"></i>')
    : '';
  const limitIcon = (r.min_on || r.min_off) ? '<i class="bi bi-shield-lock text-[.8rem] text-muted mx-[2px]" title="Cycle protection active"></i>' : '';

  el.innerHTML = `
    <button class="${togBase} ${togState}" title="${!r.relay ? t('no_relay') : relayBad ? t('relay_offline_short') : (on ? t('click_turn_off') : t('click_turn_on'))}"${r.relay && !relayBad ? '' : ' disabled'}></button>
    <div class="r-info flex-auto min-w-0">
      <div class="r-name font-bold text-[1.1rem] overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.name || 'Relay')}${r.bound ? '' : ' <span class="text-heat text-[.9rem]"><i class="bi bi-circle"></i></span>'}${(r.schedule && r.schedule.blocks && r.schedule.blocks.length) ? ' <i class="bi bi-clock text-cool text-base ml-1" title="scheduled"></i>' : ''}</div>
      <div class="r-relay text-[.82rem] text-muted overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.relay || 'no relay')}${r.area ? ' · ' + esc(areaName(r.area)) : ''}</div>
    </div>
    ${warnIcon}${limitIcon}${maint ? '<span class="text-[.68rem] font-extrabold px-[7px] py-[2px] rounded-md whitespace-nowrap flex-none bg-[var(--maint-bg)] text-[var(--maint-fg)]"><i class="bi bi-pause-fill"></i> ' + t('maint_badge') + '</span>' : ''}
    <div class="r-metric text-right flex-none flex flex-col items-end gap-1">
      <div class="${curColor} text-[2rem] [.kiosk_&]:text-[2.4rem] font-extrabold leading-none tabular-nums">${temp}${temp === '—' ? '' : '<span class="text-[1.1rem] font-bold opacity-50 ml-px">°</span>'}</div>
      <div class="inline-flex items-center text-[.85rem] font-semibold text-fg bg-surface-2 border-[1.5px] border-border rounded-full px-2.5 py-0.5 tabular-nums whitespace-nowrap">${r.bound ? `<button class="adj-btn" data-rid="${r.id}" data-dir="-1" title="-0.5°"><i class="bi bi-dash"></i></button>` : ''}${modeIcon}${modeIcon ? '&nbsp;' : ''}${r.temp != null ? r.temp + '°' : '—'}${r.bound ? `<button class="adj-btn" data-rid="${r.id}" data-dir="1" title="+0.5°"><i class="bi bi-plus"></i></button>` : ''}${r.deadband ? `<span class="text-muted ml-1">±${r.deadband}</span>` : ''}</div>
    </div>`;

  // manual on/off toggle (works in both edit & live modes)
  const tog = el.querySelector('.r-toggle');
  tog.addEventListener('pointerdown', (e) => e.stopPropagation()); // don't start a drag
  tog.addEventListener('click', (e) => { e.stopPropagation(); toggleRelay(r); });

  const wi = el.querySelector('.warn-icon');
  if (wi) {
    wi.addEventListener('pointerdown', (e) => e.stopPropagation());
    wi.addEventListener('click', (e) => { e.stopPropagation(); showWarnPop(wi, wi.dataset.msg); });
  }

  if (mobile) {
    // list mode: tap the card (not the toggle) to edit; no dragging
    el.addEventListener('click', (e) => { if (!e.target.closest('.r-toggle')) openEditor(r); });
  } else if (state.edit) dragMove(el, el, (dx, dy, ox, oy) => {
    const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3; el._moved = el._moved || moved;
    r.x = Math.max(0, ox + dx); r.y = Math.max(0, oy + dy);
    const box = boxFor(r); if (box) clampToBox(r, box, el.offsetWidth, el.offsetHeight); // hard-linked: stay inside its area
    el.style.left = r.x + 'px'; el.style.top = r.y + 'px';
  }, () => (r.x || 20), () => (r.y || 20), () => { if (el._moved) { el._moved = false; saveLayout(); } else openEditor(r); });
  return el;
}

function openEditor(r) {
  closeDeviceEditor(); closeActivityLog(); closeBulkEdit(); closePresets();
  state.selected = r.id;
  $('#ed-name').value = r.name || '';
  $('#ed-relay').value = r.relay || '';
  $('#ed-sensor').value = r.sensor || '';
  $('#ed-area').value = r.area || '';
  $('#ed-mode').value = r.mode || 'below';
  $('#ed-temp').value = r.temp != null ? r.temp : 20;
  $('#ed-deadband').value = r.deadband != null ? r.deadband : 0;
  $('#ed-minon').value = r.min_on != null ? r.min_on : 0;
  $('#ed-minoff').value = r.min_off != null ? r.min_off : 0;
  $('#ed-notify').checked = !!r.notify;
  $('#ed-notify-deviation').value = r.notify_deviation != null ? r.notify_deviation : 5;
  $('#ed-notify-deviation-label').classList.toggle('hidden', !r.notify);
  loadScheduleUI(r.schedule);
  edMsg('');
  loadAutomationState(r);
  showStaleWarning(r);
  loadHistory(r);
  // Hide mutation buttons when not signed in (they'd silently fail or 401)
  const show = !!state.authed;
  ['ed-bind', 'ed-duplicate', 'ed-unbind', 'ed-delete'].forEach((id) => {
    const btn = $('#' + id); if (btn) btn.classList.toggle('hidden', !show);
  });
  $('#editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
}

// ---- schedule editor ----
const SCHED_DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
function schedBlockRow(b) {
  b = b || { days: [1, 2, 3, 4, 5], start: '06:00', end: '18:00', temp: 21 };
  const row = document.createElement('div');
  row.className = 'sched-row border border-border rounded-lg p-2 bg-surface flex flex-col gap-1.5';
  const fieldSm = 'min-h-0 px-2 py-1.5 text-[.9rem] w-auto bg-input border-2 border-border text-fg rounded-[10px] focus:outline-none focus:border-primary';
  row.innerHTML =
    `<div class="sched-days flex flex-wrap gap-1">${SCHED_DAYS.map(([n, lbl]) =>
      `<label class="inline-flex flex-row items-center gap-[3px] text-[.8rem] font-semibold text-muted"><input type="checkbox" class="min-h-0 w-auto" value="${n}"${b.days.includes(n) ? ' checked' : ''}>${lbl}</label>`).join('')}</div>` +
    `<div class="sched-times flex items-center flex-wrap gap-1.5 text-[.9rem]"><input type="time" class="s-start ${fieldSm}" value="${esc(b.start)}"> – <input type="time" class="s-end ${fieldSm}" value="${esc(b.end)}">` +
    ` <input type="number" step="0.5" class="s-temp ${fieldSm} !w-[72px]" value="${b.temp}" title="target °C"> °C` +
    ` <button type="button" class="sched-del ${TINY} ml-auto !px-[9px] !py-[2px]" title="remove">&times;</button></div>`;
  row.querySelector('.sched-del').addEventListener('click', () => { row.remove(); });
  return row;
}
function loadScheduleUI(schedule) {
  const on = !!(schedule && Array.isArray(schedule.blocks) && schedule.blocks.length);
  $('#ed-sched-on').checked = on;
  $('#ed-sched-body').classList.toggle('hidden', !on);
  const wrap = $('#ed-sched-blocks'); wrap.innerHTML = '';
  (on ? schedule.blocks : []).forEach((b) => wrap.appendChild(schedBlockRow(b)));
  $('#ed-sched-fallback').value = schedule && schedule.fallback != null ? schedule.fallback : '';
}
function readScheduleUI() {
  if (!$('#ed-sched-on').checked) return null;
  const blocks = [...$('#ed-sched-blocks').querySelectorAll('.sched-row')].map((row) => ({
    days: [...row.querySelectorAll('.sched-days input:checked')].map((c) => +c.value),
    start: row.querySelector('.s-start').value,
    end: row.querySelector('.s-end').value,
    temp: Number(row.querySelector('.s-temp').value),
  })).filter((b) => b.days.length && b.start && b.end && isFinite(b.temp));
  if (!blocks.length) return null;
  const fb = Number($('#ed-sched-fallback').value);
  return { blocks, fallback: isFinite(fb) ? fb : null };
}

// warn if the bound relay/sensor entity no longer exists in HA (e.g. after a rename)
function showStaleWarning(r) {
  const box = $('#ed-stale');
  const relMissing = r.relay && !state.entities.switches.some((s) => s.entity_id === r.relay);
  const senMissing = r.sensor && !state.entities.sensors.some((s) => s.entity_id === r.sensor);
  if (!relMissing && !senMissing) { box.classList.add('hidden'); return; }
  const which = [relMissing && `relay (${r.relay})`, senMissing && `sensor (${r.sensor})`].filter(Boolean).join(' and ');
  box.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> The ${which} no longer exists in Home Assistant (renamed or removed). Pick it again and Save.`;
  box.classList.remove('hidden');
}

// relay last-changed duration + temperature chart
let historyRange = 24;
async function loadHistory(r) {
  const box = $('#ed-history'), info = $('#ed-history-info'), spark = $('#ed-spark');
  if (!r.sensor && !r.relay) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  spark.innerHTML = ''; info.textContent = t('loading');
  // relay on/off duration
  const rl = state.live[r.relay] || {};
  let dur = '';
  if (r.relay && rl.last_changed && (rl.state === 'on' || rl.state === 'off')) {
    dur = `Relay ${rl.state.toUpperCase()} for ${fmtAgo(Date.now() - Date.parse(rl.last_changed))}. `;
  }
  if (!r.sensor) { info.textContent = dur || t('no_sensor_bound'); spark.innerHTML = ''; return; }
  try {
    const params = `sensor=${encodeURIComponent(r.sensor)}&hours=${historyRange}` +
      (r.relay ? `&relay=${encodeURIComponent(r.relay)}` : '') +
      (r.temp != null ? `&target=${r.temp}` : '');
    const data = await api('/api/history/export?' + params);
    if (!data.rows || data.rows.length < 2) { info.textContent = dur + t('not_enough_history'); return; }
    drawChart(spark, data.rows, data.target);
    addChartTooltip(spark, data.rows, '#ed-tooltip');
    const temps = data.rows.map((p) => p.temp);
    info.textContent = `${dur}min ${Math.min(...temps).toFixed(1)}° · max ${Math.max(...temps).toFixed(1)}° · now ${temps[temps.length - 1].toFixed(1)}°`;
  } catch { info.textContent = dur + t('history_unavailable'); }
}

async function exportHistory() {
  const r = selected(); if (!r || !r.sensor) return;
  try {
    const hours = $('#chart-modal').classList.contains('hidden') ? historyRange : modalRange;
    const params = new URLSearchParams({ sensor: r.sensor, hours: String(hours) });
    if (r.relay) params.set('relay', r.relay);
    if (r.temp != null) params.set('target', String(r.temp));
    const data = await api('/api/history/export?' + params.toString());
    if (!data.rows || !data.rows.length) { edMsg(t('no_data_to_export'), 'err'); return; }
    const header = 'timestamp,temperature,relay_state' + (data.target != null ? ',target' : '');
    const csv = header + '\n' + data.rows.map((p) =>
      `${new Date(p.t).toISOString()},${p.temp.toFixed(1)},${p.state}` +
      (data.target != null ? `,${data.target}` : '')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const span = hours >= 720 ? '30d' : hours >= 168 ? '7d' : '24h';
    a.download = `${r.sensor.replace(/\./g,'_')}_${span}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    edMsg('CSV downloaded', 'ok');
  } catch (e) { edMsg(t('export_error') + ': ' + e.message, 'err'); }
}

function fmtAgo(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}

// draw a temperature chart with axes, target line, and relay-ON bands
function drawChart(svg, rows, target) {
  if (target != null && isFinite(target)) svg.dataset.target = target;
  else delete svg.dataset.target;
  // Use the SVG's viewBox dimensions so the chart fills whatever size it's given
  const vb = svg.viewBox.baseVal;
  const W = vb.width, H = vb.height, padL = 45, padR = 10, padT = 12, padB = 28;
  const cw = W - padL - padR, ch = H - padT - padB;
  if (!rows || rows.length < 2) { svg.innerHTML = ''; return; }
  const temps = rows.map((p) => p.temp), ts = rows.map((p) => p.t);
  let lo = Math.min(...temps), hi = Math.max(...temps);
  if (target != null && isFinite(+target)) { lo = Math.min(lo, +target); hi = Math.max(hi, +target); }
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const t0 = ts[0], t1 = ts[ts.length - 1] || t0 + 1;
  const x = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * cw;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * ch;

  let out = '';

  // Band drawing helper
  function drawBands(stateClass, fillColor) {
    let start = null;
    for (const p of rows) {
      if (p.state === stateClass && start == null) { start = p.t; }
      else if (p.state !== stateClass && start != null) {
        out += `<rect x="${x(start).toFixed(1)}" y="${padT}" width="${Math.max(0.5, x(p.t) - x(start)).toFixed(1)}" height="${ch.toFixed(1)}" class="${fillColor} pointer-events-none"/>`;
        start = null;
      }
    }
    if (start != null) {
      out += `<rect x="${x(start).toFixed(1)}" y="${padT}" width="${Math.max(0.5, x(t1) - x(start)).toFixed(1)}" height="${ch.toFixed(1)}" class="${fillColor} pointer-events-none"/>`;
    }
  }
  drawBands('unavailable', '[fill:rgba(220,38,38,.10)]');  // red — offline
  drawBands('on', '[fill:rgba(34,197,94,.12)]');           // green — running

  // Y-axis ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const val = lo + (i / yTicks) * (hi - lo);
    const yy = y(val);
    out += `<line x1="${padL - 4}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`;
    out += `<text x="${padL - 6}" y="${(yy + 3).toFixed(1)}" class="[fill:var(--muted)] [font-size:9px]" text-anchor="end">${val.toFixed(1)}°</text>`;
  }

  // X-axis time labels
  const xTicks = 4;
  for (let i = 0; i <= xTicks; i++) {
    const mt = t0 + (i / xTicks) * (t1 - t0);
    const xx = x(mt);
    const d = new Date(mt);
    const label = xTicks > 4 ? d.toLocaleDateString(undefined, { month:'short', day:'numeric' })
      : d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
    out += `<line x1="${xx.toFixed(1)}" y1="${padT}" x2="${xx.toFixed(1)}" y2="${H - padB}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4 4"/>`;
    out += `<text x="${xx.toFixed(1)}" y="${H - 4}" class="[fill:var(--muted)] [font-size:9px]" text-anchor="middle">${label}</text>`;
  }

  // Target line
  if (target != null && isFinite(+target)) {
    const ty = y(+target);
    out += `<line x1="${padL}" y1="${ty.toFixed(1)}" x2="${W - padR}" y2="${ty.toFixed(1)}" class="[stroke:var(--ok)] [stroke-width:1.5] [stroke-dasharray:6_4] [vector-effect:non-scaling-stroke]"/>`;
    out += `<text x="${W - padR}" y="${(ty - 3).toFixed(1)}" class="[fill:var(--muted)] [font-size:9px]" text-anchor="end">${+target}°</text>`;
  }

  // Temperature line
  const d = rows.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.temp).toFixed(1)).join(' ');
  out += `<path d="${d}" class="fill-none [stroke:#f59e0b] [stroke-width:2] [vector-effect:non-scaling-stroke]"/>`;

  svg.innerHTML = out;
}

// maintenance controls — a manual relay toggle (whenever a relay is set) and,
// for bound relays, the automation enable/disable.
async function loadAutomationState(r) {
  const box = $('#ed-automation');
  if (!r.relay) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  updateRelayToggleBtn(r);

  const row = $('#ed-automation-row');
  if (!r.bound) { row.classList.add('hidden'); return; }
  row.classList.remove('hidden');
  $('#ed-automation-status').textContent = 'checking…';
  $('#ed-automation-toggle').disabled = true;
  try { updateAutomationUI(await api(`/api/relays/${r.id}/automation`)); }
  catch { $('#ed-automation-status').textContent = t('automation_state_unknown'); }
}

function updateRelayToggleBtn(r) {
  const btn = $('#ed-relay-toggle');
  const on = (state.live[r.relay] || {}).state === 'on';
  btn.innerHTML = '<i class="bi bi-power"></i> ' + (on ? t('turn_relay_off') : t('turn_relay_on'));
  ['bg-on', 'border-on', 'text-white'].forEach((c) => btn.classList.toggle(c, on));
}
async function toggleRelayFromEditor() {
  const r = selected(); if (!r || !r.relay) return;
  await toggleRelay(r);          // flips via HA + updates state.live + re-renders
  updateRelayToggleBtn(r);
}
function updateAutomationUI(s) {
  const on = s.exists && s.enabled;
  $('#ed-automation-status').innerHTML = !s.exists ? `<span class="text-heat text-[.95rem] font-bold">${t('auto_none')}</span>`
    : (on ? `<span class="text-ok text-[.95rem] font-bold"><i class="bi bi-record-fill"></i> ${t('auto_on')}</span>` : `<span class="text-heat text-[.95rem] font-bold"><i class="bi bi-pause-fill"></i> ${t('auto_paused')}</span>`);
  const btn = $('#ed-automation-toggle');
  btn.innerHTML = on ? `<i class="bi bi-pause-fill"></i> ${t('pause_maint')}` : `<i class="bi bi-play-fill"></i> ${t('resume_auto')}`;
  btn.disabled = !s.exists;
  btn.dataset.enable = on ? '0' : '1';
}
async function toggleAutomation() {
  const r = selected(); if (!r) return;
  const enable = $('#ed-automation-toggle').dataset.enable === '1';
  $('#ed-automation-toggle').disabled = true;
  try {
    updateAutomationUI(await api(`/api/relays/${r.id}/automation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: enable }),
    }));
    edMsg(enable ? t('automation_enabled') : t('automation_disabled_maint'), 'ok');
  } catch (e) { edMsg('error: ' + e.message, 'err'); loadAutomationState(r); }
}
function closeEditor() { state.selected = null; $('#editor').classList.add('hidden'); }
function edMsg(m, cls) { setMsg($('#ed-msg'), m, cls); }
function selected() { return state.layout.relays.find((x) => x.id === state.selected); }

// ---- device (physical relay) editor ----
function openDeviceEditor(g) {
  closeEditor(); closeActivityLog(); closeBulkEdit(); closePresets();
  state.selectedDev = g.id;
  $('#de-name').value = g.name || '';
  $('#de-area').innerHTML = '<option value="">— none —</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}"${g.area === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
  const outs = state.layout.relays.filter((r) => r.device === g.id);
  $('#de-outputs').innerHTML = outs.map((r) => {
    const on = (state.live[r.relay] || {}).state === 'on';
    return `<div class="de-out flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 border-2 border-border rounded-[10px] cursor-pointer text-base" data-id="${esc(r.id)}">
      <span class="w-3 h-3 rounded-full flex-none ${r.relay ? (on ? 'bg-on' : 'bg-off') : 'bg-off'}"></span>
      <span class="flex-auto overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.name || r.relay || 'output')}</span>
      <span class="text-muted text-[.8rem]">${r.bound ? '<i class="bi bi-record-fill"></i> bound' : '<i class="bi bi-circle"></i>'}</span>
    </div>`;
  }).join('') || '<div class="text-muted text-[.9rem]">no outputs</div>';
  // clicking an output row opens that output's relay editor
  $('#de-outputs').querySelectorAll('.de-out').forEach((row) => {
    row.addEventListener('click', () => { const r = state.layout.relays.find((x) => x.id === row.dataset.id); if (r) openEditor(r); });
  });
  // "+ Add output": only this physical device's own outputs that aren't placed yet
  const dev = state.relayDevices.find((d) => d.device_id === g.deviceId);
  const used = new Set(outs.map((r) => r.relay));
  const avail = dev ? dev.outputs.filter((o) => !used.has(o.entity_id)) : [];
  const sel = $('#de-add-output');
  sel.innerHTML = '<option value="">+ Add output…</option>' +
    avail.map((o) => `<option value="${esc(o.entity_id)}">${esc(o.name)}</option>`).join('');
  sel.classList.toggle('hidden', avail.length === 0);
  deMsg('');
  $('#dev-editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
}

// Add one of the device's own outputs back into its box.
function addOutputToDevice(entityId) {
  const g = selectedDev(); if (!g || !entityId) return;
  const dev = state.relayDevices.find((d) => d.device_id === g.deviceId);
  const o = dev && dev.outputs.find((x) => x.entity_id === entityId);
  if (!o) { deMsg(t('output_not_on_device'), 'err'); return; }
  if (state.layout.relays.some((r) => r.device === g.id && r.relay === entityId)) { deMsg(t('already_added'), 'err'); return; }
  state.layout.relays.push({
    id: 'r' + Date.now().toString(36), name: o.name, relay: o.entity_id,
    sensor: '', area: g.area || '', device: g.id, mode: 'below', temp: 20, deadband: 0, bound: false, x: 0, y: 0,
  });
  reflowDeviceOutputs(g);
  const a = g.area && state.layout.areas.find((x) => x.areaId === g.area); if (a) fitAreaToContents(a);
  render(); saveLayout();
  openDeviceEditor(g); // refresh the list + dropdown
}
function closeDeviceEditor() { state.selectedDev = null; $('#dev-editor').classList.add('hidden'); }
function deMsg(m, cls) { setMsg($('#de-msg'), m, cls); }
function selectedDev() { return state.layout.devices.find((x) => x.id === state.selectedDev); }

// ---- activity log ----
const activity = { page: 1, total: 0, perPage: 15 };

function openActivityLog(page) {
  page = page || 1;
  closeEditor(); closeDeviceEditor(); closeBulkEdit(); closePresets();
  activity.page = page;
  $('#activity-editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
  loadActivity(page);
}

async function exportActivityCSV() {
  try {
    const data = await api(`/api/activity-log?page=1&per_page=1000`);
    if (!data.entries || !data.entries.length) return;
    const csvEscape = (v) => String(v == null ? '' : v).replace(/"/g, '""');
    const header = 'timestamp,actor,action,detail';
    const csv = header + '\n' + data.entries.map((e) =>
      `"${csvEscape(new Date(e.created_at).toISOString())}","${csvEscape(e.actor || '')}","${csvEscape(t('act_' + e.action.replace('.','_')) || e.action)}","${csvEscape(JSON.stringify(e.detail || {}))}"`
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'activity-log.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch {}
}

// ---- bulk edit ----
function openBulkEdit() {
  closeEditor(); closeDeviceEditor(); closeActivityLog(); closePresets();
  // populate area dropdown
  const sel = $('#bk-area');
  sel.innerHTML = '<option value="" data-i18n="all_relays">All relays</option>' +
    state.haAreas.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  sel.value = '';
  updateBulkList();
  $('#bulk-editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
}

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
canvas.addEventListener('click', (e) => {
  const btn = e.target.closest('.adj-btn');
  if (!btn) return;
  e.stopPropagation();
  adjustTemp(btn.dataset.rid, parseInt(btn.dataset.dir));
});

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

// ---- presets ----
function openPresets() {
  closeEditor(); closeDeviceEditor(); closeActivityLog(); closeBulkEdit();
  state.layout.presets = state.layout.presets || [];
  renderPresets();
  $('#preset-editor').classList.remove('hidden');
  requestAnimationFrame(positionResizeHandles);
}

function closePresets() {
  $('#preset-editor').classList.add('hidden');
  $('#pr-list').innerHTML = '';
}

function renderPresets() {
  const presets = state.layout.presets || [];
  const list = $('#pr-list');
  list.innerHTML = presets.length
    ? presets.map((p, i) => `<div class="flex items-center gap-2 px-2.5 py-2 bg-surface-2 border-[1.5px] border-border rounded-[10px] text-[.85rem]">
        <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold">${esc(p.name)}</span>
        <span class="text-muted">${Object.keys(p.relays || {}).length} relays</span>
        <button class="pr-apply ${TINY}" data-idx="${i}"><i class="bi bi-play-fill"></i></button>
        <button class="pr-del ${TINY} bg-danger border-danger text-white" data-idx="${i}"><i class="bi bi-trash"></i></button>
      </div>`).join('')
    : `<div style="text-align:center;padding:20px;color:var(--muted)">${t('no_presets')}</div>`;
  list.querySelectorAll('.pr-apply').forEach((b) => b.addEventListener('click', () => applyPreset(parseInt(b.dataset.idx))));
  list.querySelectorAll('.pr-del').forEach((b) => b.addEventListener('click', () => deletePreset(parseInt(b.dataset.idx))));
  $('#pr-msg').textContent = '';
}

async function savePreset() {
  const name = $('#pr-name').value.trim();
  if (!name) return;
  const relays = {};
  for (const r of state.layout.relays) {
    if (!r.bound || !r.relay || !r.sensor) continue;
    relays[r.id] = { temp: r.temp, mode: r.mode, deadband: r.deadband };
  }
  if (!Object.keys(relays).length) { $('#pr-msg').textContent = t('no_bound_relays'); return; }
  state.layout.presets = state.layout.presets || [];
  state.layout.presets.push({ name, relays });
  await saveLayout();
  $('#pr-name').value = '';
  renderPresets();
  $('#pr-msg').textContent = t('preset_saved');
}

async function applyPreset(idx) {
  const preset = (state.layout.presets || [])[idx];
  if (!preset) return;
  for (const [rid, cfg] of Object.entries(preset.relays || {})) {
    const r = state.layout.relays.find((x) => x.id === rid);
    if (!r || !r.bound) continue;
    try {
      await api(`/api/relays/${r.id}/bind`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: r.name, relay: r.relay, sensor: r.sensor, area: r.area || '',
          mode: cfg.mode, temp: cfg.temp, deadband: cfg.deadband != null ? cfg.deadband : (r.deadband || 0),
          schedule: r.schedule || null,
          min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
          notify: !!r.notify, notify_deviation: Number(r.notify_deviation) || 5,
        }),
      });
      r.mode = cfg.mode; r.temp = cfg.temp; if (cfg.deadband != null) r.deadband = cfg.deadband;
    } catch {}
  }
  await saveLayout(); render(); refreshLive();
  $('#pr-msg').textContent = t('preset_applied');
}

async function deletePreset(idx) {
  if (!confirm(t('confirm_delete_preset'))) return;
  state.layout.presets.splice(idx, 1);
  await saveLayout();
  renderPresets();
  $('#pr-msg').textContent = t('preset_deleted');
}

function closeBulkEdit() {
  $('#bulk-editor').classList.add('hidden');
  $('#bk-list').innerHTML = '';
}

function updateBulkList() {
  const area = $('#bk-area').value;
  const mode = $('#bk-mode').value;
  const temp = Number($('#bk-temp').value);
  const deadband = Number($('#bk-deadband').value) || 0;
  const matches = state.layout.relays.filter((r) =>
    r.bound && r.relay && r.sensor && (!area || r.area === area)
  );
  const list = $('#bk-list');
  list.innerHTML = matches.map((r) => {
    const curTemp = r.temp != null ? r.temp : '?';
    const curMode = r.mode === 'above' ? 'cool' : 'heat';
    const newTemp = isFinite(temp) ? temp : curTemp;
    return `<div class="flex items-center gap-2 px-2.5 py-2 bg-surface-2 border-[1.5px] border-border rounded-[10px] text-[.85rem]">
      <span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold">${esc(r.name || r.relay)}</span>
      <span class="text-muted">${curMode} ${curTemp}° → ${newTemp}° @ ${mode === 'above' ? 'cool' : 'heat'}</span>
    </div>`;
  }).join('') || `<div style="text-align:center;padding:20px;color:var(--muted)">${t('no_bound_relays_match')}</div>`;
  $('#bk-count').textContent = matches.length ? `${matches.length} relay${matches.length === 1 ? '' : 's'}` : '';
  $('#bk-apply').innerHTML = `<i class="bi bi-check-lg"></i> <span data-i18n="apply_to_n">Apply to ${matches.length || 0} relays</span>`;
}

async function applyBulk() {
  const area = $('#bk-area').value;
  const mode = $('#bk-mode').value;
  const temp = Number($('#bk-temp').value);
  const deadband = Number($('#bk-deadband').value) || 0;
  if (!isFinite(temp)) { setMsg($('#bk-msg'), t('enter_target_temp'), 'err'); return; }
  const matches = state.layout.relays.filter((r) =>
    r.bound && r.relay && r.sensor && (!area || r.area === area)
  );
  if (!matches.length) { setMsg($('#bk-msg'), t('no_bound_relays_match'), 'err'); return; }
  $('#bk-apply').disabled = true;
  let ok = 0, fail = 0;
  for (const r of matches) {
    try {
      await api(`/api/relays/${r.id}/bind`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: r.name, relay: r.relay, sensor: r.sensor, area: r.area || '',
          mode, temp, deadband,
          schedule: r.schedule || null,
          min_on: Number(r.min_on) || 0, min_off: Number(r.min_off) || 0,
          notify: !!r.notify, notify_deviation: Number(r.notify_deviation) || 5,
        }),
      });
      r.mode = mode; r.temp = temp; r.deadband = deadband; r.bound = true;
      ok++;
    } catch { fail++; }
  }
  $('#bk-apply').disabled = false;
  setMsg($('#bk-msg'), t('applied_to_n').replace('{n}', ok) + (fail ? ', ' + t('n_failed').replace('{n}', fail) : ''), fail ? 'err' : 'ok');
  render(); saveLayout(); refreshLive();
  updateBulkList();
}

function closeActivityLog() {
  $('#activity-editor').classList.add('hidden');
  $('#act-list').innerHTML = '';
}

async function loadActivity(page) {
  page = page || activity.page;
  $('#act-msg').textContent = '';
  try {
    const data = await api(`/api/activity-log?page=${page}&per_page=${activity.perPage}`);
    activity.page = data.page;
    activity.total = data.total;
    renderActivity(data.entries, data.total, data.page);
  } catch (e) {
    setMsg($('#act-msg'), e.message, 'err');
  }
}

function renderActivity(entries, total, page) {
  const list = $('#act-list');
  list.innerHTML = '';
  const totalPages = Math.ceil(total / activity.perPage) || 1;
  $('#act-page-info').textContent = `${page} / ${totalPages}`;
  $('#act-prev').classList.toggle('hidden', page <= 1);
  $('#act-next').classList.toggle('hidden', page >= totalPages);

  if (!entries || !entries.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted)">No events recorded yet.</div>`;
    return;
  }
  entries.forEach((e) => {
    const icon = actionIcon(e.action);
    const time = fmtTime(e.created_at);
    const actor = e.actor || 'anonymous';
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2.5 px-2.5 py-2 bg-surface-2 border-[1.5px] border-border rounded-[10px] text-[.9rem]';
    row.innerHTML =
      `<div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[.9rem] ${icon.cls}"><i class="bi ${icon.icon}"></i></div>` +
      `<div class="flex-1 min-w-0"><div class="font-semibold">${esc(t('act_' + e.action.replace('.','_'))) || esc(e.action)}</div>` +
      `<div class="text-muted text-[.8rem]">${esc(actor)}${formatDetail(e.action, e.detail) ? ' · ' + formatDetail(e.action, e.detail) : ''}</div></div>` +
      `<div class="text-muted text-[.75rem] shrink-0 text-right whitespace-nowrap">${esc(time)}</div>`;
    list.appendChild(row);
  });
}

function formatDetail(action, d) {
  if (!d || !Object.keys(d).length) return '';
  switch (action) {
    case 'relay.delete': return esc(d.name || d.rid || '');
    case 'device.delete': return esc(d.name || d.device_id || '');
    case 'area.delete': return esc(d.name || '');
    case 'relay.bind': return `${esc(d.relay || '')} · ${esc(d.sensor || '')} · ${d.mode === 'above' ? 'cool' : 'heat'} ${d.temp}°C`;
    case 'relay.unbind': return esc(d.name || d.rid || '');
    case 'switch.toggle': return `${esc(d.entity_id || '')} → ${esc(d.action || '')}`;
    case 'device.rename': return `${esc(d.entity_id || '')} → ${esc(d.new_name || '')}`;
    case 'layout.save': return `${d.relays || 0} relays, ${d.areas || 0} areas, ${d.devices || 0} devices`;
    case 'layout.restore': return `backup #${d.backup_id || '?'}`;
    case 'automation.reapply': return `${d.count || 0} automation${d.count === 1 ? '' : 's'}`;
    case 'automation.pause':
    case 'automation.resume': return esc(d.rid || '');
    default: return '';
  }
}

function actionIcon(action) {
  const C = {
    green: 'bg-[#dcfce7] text-[#16a34a]', gray: 'bg-[#f3f4f6] text-[#6b7280]',
    red: 'bg-[#fef2f2] text-[#dc2626]', blue: 'bg-[#eff6ff] text-[#2563eb]',
    sky: 'bg-[#f0f9ff] text-[#0284c7]', yellow: 'bg-[#fefce8] text-[#ca8a04]',
    amber: 'bg-[#fef3c7] text-[#d97706]', amber2: 'bg-[#fffbeb] text-[#d97706]',
  };
  const m = {
    'login':               { icon: 'bi-box-arrow-in-right', cls: C.green },
    'logout':              { icon: 'bi-box-arrow-right',    cls: C.gray },
    'relay.bind':          { icon: 'bi-link-45deg',         cls: C.green },
    'relay.unbind':        { icon: 'bi-link',               cls: C.red },
    'switch.toggle':       { icon: 'bi-power',              cls: C.blue },
    'device.rename':       { icon: 'bi-pencil',             cls: C.sky },
    'layout.save':         { icon: 'bi-floppy',             cls: C.yellow },
    'layout.restore':      { icon: 'bi-arrow-counterclockwise', cls: C.amber },
    'automation.reapply':  { icon: 'bi-arrow-repeat',       cls: C.gray },
    'automation.pause':    { icon: 'bi-pause-fill',         cls: C.amber2 },
    'automation.resume':   { icon: 'bi-play-fill',          cls: C.green },
    'relay.delete':        { icon: 'bi-trash',              cls: C.red },
    'device.delete':       { icon: 'bi-trash',              cls: C.red },
    'area.delete':         { icon: 'bi-trash',              cls: C.red },
  };
  return m[action] || { icon: 'bi-circle', cls: C.gray };
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function saveDevice() {
  const g = selectedDev(); if (!g) return;
  g.name = $('#de-name').value.trim() || g.name;
  const area = $('#de-area').value;
  assignDeviceArea(g, area);
  const a = area && state.layout.areas.find((x) => x.areaId === area); if (a) fitAreaToContents(a);
  deMsg('saved', 'ok');
  render(); saveLayout();
}

async function renameDeviceHa() {
  const g = selectedDev(); if (!g) return;
  const first = state.layout.relays.find((r) => r.device === g.id && r.relay);
  if (!first) { deMsg(t('no_output_to_rename'), 'err'); return; }
  const nm = prompt('New Home Assistant name for this physical relay:', g.name || '');
  if (nm == null || !nm.trim()) return;
  try {
    deMsg('renaming…');
    const res = await api('/api/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: first.relay, name: nm.trim(), parent: true }) });
    g.name = nm.trim().replace(/\s+/g, '_');
    deMsg('renamed in ' + res.where, 'ok');
    render(); saveLayout();
  } catch (e) { deMsg('error: ' + e.message, 'err'); }
}

async function deleteDevice() {
  const g = selectedDev(); if (!g) return;
  const outputs = state.layout.relays.filter((r) => r.device === g.id);
  const bound = outputs.filter((r) => r.bound);
  const msg = `Remove "${g.name || 'physical relay'}" and its ${outputs.length} output${outputs.length === 1 ? '' : 's'} from the board?` +
    (bound.length ? `\n${bound.length} bound automation${bound.length === 1 ? '' : 's'} will also be removed.` : '');
  if (!confirm(msg)) return;
  // Unbind each bound output so HA automations are cleaned up
  for (const r of bound) {
    try { await api(`/api/relays/${r.id}/unbind`, { method: 'POST' }); } catch {}
  }
  api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'device.delete', detail: { name: g.name, device_id: g.deviceId, outputs: outputs.length } })
  }).catch(() => {});
  state.layout.relays = state.layout.relays.filter((r) => r.device !== g.id);
  state.layout.devices = state.layout.devices.filter((x) => x.id !== g.id);
  closeDeviceEditor(); render(); saveLayout();
}

async function saveLayout() {
  if (!state.authed) return; // viewers don't persist layout (and shouldn't be prompted to log in)
  if (!state.loaded) return; // never overwrite the DB before the real layout has loaded
  try {
    await api('/api/layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.layout) });
    pushHistory();
    setStatus(t('saved')); setTimeout(() => setStatus(''), 1000);
  } catch { setStatus(t('save_error')); }
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
  if (history.idx <= 0) { setStatus(t('nothing_undo')); setTimeout(() => setStatus(''), 1000); return; }
  history.idx--; await applyHistory(); setStatus(t('undo')); setTimeout(() => setStatus(''), 800);
}
async function redo() {
  if (!state.edit || !state.authed) return;
  if (history.idx >= history.stack.length - 1) { setStatus(t('nothing_redo')); setTimeout(() => setStatus(''), 1000); return; }
  history.idx++; await applyHistory(); setStatus(t('redo')); setTimeout(() => setStatus(''), 800);
}

function addRelay() {
  const id = 'r' + Date.now().toString(36);
  const n = state.layout.relays.length;
  state.layout.relays.push({ id, name: 'Relay ' + (n + 1), x: 40 + (n % 5) * 24, y: 40 + (n % 5) * 24, relay: '', sensor: '', area: '', mode: 'below', temp: 20, deadband: 0, bound: false });
  render(); saveLayout(); openEditor(state.layout.relays[state.layout.relays.length - 1]);
}

function duplicateRelay() {
  const src = selected(); if (!src) return;
  const id = 'r' + Date.now().toString(36);
  const schedule = src.schedule ? JSON.parse(JSON.stringify(src.schedule)) : undefined;
  const dup = {
    id,
    name: (src.name || 'Relay') + ' (copy)',
    x: (src.x != null ? src.x : 40) + 24,
    y: (src.y != null ? src.y : 40) + 24,
    relay: '',
    sensor: src.sensor || '',
    area: src.area || '',
    mode: src.mode || 'below',
    temp: src.temp != null ? src.temp : 20,
    deadband: src.deadband != null ? src.deadband : 0,
    bound: false,
    schedule,
  };
  state.layout.relays.push(dup);
  closeEditor();
  render(); saveLayout();
  openEditor(state.layout.relays[state.layout.relays.length - 1]);
}

async function bind() {
  const r = selected(); if (!r) return;
  const oldArea = r.area;
  const body = {
    name: $('#ed-name').value.trim(), relay: $('#ed-relay').value, sensor: $('#ed-sensor').value,
    area: $('#ed-area').value, mode: $('#ed-mode').value,
    temp: Number($('#ed-temp').value), deadband: Number($('#ed-deadband').value),
    min_on: Number($('#ed-minon').value) || 0, min_off: Number($('#ed-minoff').value) || 0,
    notify: $('#ed-notify').checked, notify_deviation: Number($('#ed-notify-deviation').value) || 5,
    schedule: readScheduleUI(),
  };
  Object.assign(r, body);
  try {
    edMsg('binding…');
    const res = await api(`/api/relays/${r.id}/bind`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    r.bound = true; r.automationId = res.automationId;
    // swapped into a (different) area -> teleport to the middle of that area
    // (device outputs stay put inside their physical-relay box)
    if (!r.device && r.area && r.area !== oldArea) { const box = boxFor(r); if (box) centerInBox(r, box); }
    edMsg('bound ✓ ' + res.automationId, 'ok');
    loadAutomationState(r);
    render(); saveLayout(); refreshLive();
  } catch (e) { edMsg('error: ' + e.message, 'err'); }
}

// rename the HA device behind an entity (and Z2M too if it's zigbee)
async function renameDevice(entityId) {
  if (!entityId) { edMsg('pick a device first', 'err'); return; }
  const nm = prompt(t('new_name_for') + ' ' + entityId + ':');
  if (nm == null || !nm.trim()) return;
  try {
    edMsg('renaming…');
    const res = await api('/api/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_id: entityId, name: nm.trim() }) });
    edMsg('renamed in ' + res.where, 'ok');
    // reload the device lists to show the new name (keep current selections)
    setTimeout(async () => {
      try {
        const rv = $('#ed-relay').value, sv = $('#ed-sensor').value, av = $('#ed-area').value;
        state.entities = await api('/api/entities'); fillSelects();
        $('#ed-relay').value = rv; $('#ed-sensor').value = sv; $('#ed-area').value = av;
      } catch {}
    }, 1600);
  } catch (e) { edMsg('rename error: ' + e.message, 'err'); }
}

async function unbind() {
  const r = selected(); if (!r) return;
  try { await api(`/api/relays/${r.id}/unbind`, { method: 'POST' }); r.bound = false; delete r.automationId; loadAutomationState(r); edMsg('automation removed', 'ok'); render(); }
  catch (e) { edMsg('error: ' + e.message, 'err'); }
}

async function deleteRelay() {
  const r = selected(); if (!r) return;
  if (!confirm(t('confirm_delete_relay').replace('{name}', r.name || r.relay || 'relay') + (r.bound ? '\n' + t('confirm_delete_relay_bound') : ''))) return;
  if (r.bound) { try { await api(`/api/relays/${r.id}/unbind`, { method: 'POST' }); } catch {} }
  api('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'relay.delete', detail: { rid: r.id, name: r.name, relay: r.relay } })
  }).catch(() => {});
  state.layout.relays = state.layout.relays.filter((x) => x.id !== r.id);
  closeEditor(); render(); saveLayout();
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
document.addEventListener('click', (e) => {
  const p = document.getElementById('warn-pop');
  if (p && !e.target.closest('.warn-icon') && e.target !== p) p.remove();
});

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
    const [live, autos, haStatus] = await Promise.all([
      ids.size ? api('/api/live?ids=' + encodeURIComponent([...ids].join(','))) : Promise.resolve(state.live),
      api('/api/automations').catch(() => state.autoStates || {}),
      api('/api/ha-status').catch(() => ({ reachable: true })),
    ]);
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

// theme: follows the OS/browser preference by default; an explicit toggle
// (remembered per browser) overrides it.
const savedTheme = () => { try { return localStorage.getItem('relaypanel-theme'); } catch { return null; } };
const systemTheme = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; } };
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('#btn-theme').innerHTML = t === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
  $('#btn-theme').title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}
$('#btn-theme').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('relaypanel-theme', next); } catch {}
  applyTheme(next);
  render();
});
applyTheme(savedTheme() || systemTheme());

// language: init from storage (default English), toggle button
$('#btn-lang').addEventListener('click', () => setLang(LANG === 'et' ? 'en' : 'et'));
(function initLang() {
  let l = 'en'; try { l = localStorage.getItem('relaypanel-lang') || 'en'; } catch {}
  // snapshot English defaults now, then apply chosen language
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (!el.children.length && el.dataset.i18nEn == null) el.dataset.i18nEn = el.textContent; });
  setLang(l);
})();
// follow OS theme changes while the user hasn't picked one explicitly
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { if (!savedTheme()) applyTheme(e.matches ? 'dark' : 'light'); }); } catch {}

// mobile hamburger: toggle the toolbar dropdown; close on outside tap
$('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); $('#toolbar').classList.toggle('!flex'); });
document.addEventListener('click', (e) => {
  if (!e.target.closest('#toolbar') && !e.target.closest('#btn-menu')) $('#toolbar').classList.remove('!flex');
});

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
  setStatus(t('exported')); setTimeout(() => setStatus(''), 1500);
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
  for (const a of state.layout.areas) fitAreaToContents(a);
  closeEditor(); closeDeviceEditor();
  await saveLayout();
  fillSelects(); render(); refreshLive();
  setStatus(t('imported')); setTimeout(() => setStatus(''), 1500);
}

// wiring
const closeAdvanced = () => $('#advanced-menu').classList.add('hidden');
$('#btn-add').addEventListener('click', () => { closeAdvanced(); addRelay(); });
$('#btn-advanced').addEventListener('click', (e) => { e.stopPropagation(); $('#advanced-menu').classList.toggle('hidden'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.tb-advanced')) $('#advanced-menu').classList.add('hidden'); });
$('#btn-export').addEventListener('click', exportLayout);
$('#btn-import').addEventListener('click', () => { $('#advanced-menu').classList.add('hidden'); $('#import-file').click(); });
$('#btn-activity').addEventListener('click', () => { closeAdvanced(); openActivityLog(); });
$('#btn-bulk').addEventListener('click', () => { closeAdvanced(); openBulkEdit(); });
$('#btn-presets').addEventListener('click', () => { closeAdvanced(); openPresets(); });
$('#btn-alloff').addEventListener('click', allOff);
$('#import-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importLayout(f); e.target.value = ''; });
$('#area-picker').addEventListener('change', (e) => { closeAdvanced(); addArea(e.target.value); e.target.value = ''; });
$('#device-picker').addEventListener('change', (e) => { closeAdvanced(); addPhysicalRelay(e.target.value); e.target.value = ''; });
$('#btn-save').addEventListener('click', saveLayout);
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
$('#btn-mode').addEventListener('click', toggleMode);
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

// --- auth (validates against Home Assistant) ---
function updateAuthUI() {
  $('#btn-logout').classList.toggle('hidden', !state.authed);
  $('#btn-logout').title = state.user ? 'Sign out (' + state.user + ')' : 'Sign out';
}
async function checkSession() {
  try { const s = await api('/api/session'); state.authed = !!s.authed; state.user = s.user || null; }
  catch { state.authed = false; state.user = null; }
  updateAuthUI();
  // just signed in via the login-reload? drop straight into Edit mode
  let enter = false; try { enter = sessionStorage.getItem('rp-enter-edit') === '1'; if (enter) sessionStorage.removeItem('rp-enter-edit'); } catch {}
  if (enter && state.authed) { state.edit = true; applyMode(); render(); }
}
function openLogin() { $('#login-msg').textContent = ''; $('#login-user').value = ''; $('#login-pass').value = ''; $('#login-modal').classList.remove('hidden'); $('#login-user').focus(); }
function closeLogin() { $('#login-modal').classList.add('hidden'); }
async function doLogin() {
  const username = $('#login-user').value.trim(), password = $('#login-pass').value;
  if (!username || !password) { $('#login-msg').textContent = t('enter_user_pass'); return; }
  $('#login-submit').disabled = true;
  $('#login-msg').textContent = t('signing_in');
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 12000); // never spin forever
  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }), signal: ac.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { $('#login-msg').textContent = data.error || t('sign_in_failed'); return; }
    // Signed in: the session cookie is set. Reload for a clean, fully-authed state
    // (avoids any client-state edge cases in the success path), landing in Edit mode.
    $('#login-msg').textContent = t('signed_in_loading');
    try { sessionStorage.setItem('rp-enter-edit', '1'); } catch {}
    location.reload();
    return;
  } catch (e) {
    $('#login-msg').textContent = e.name === 'AbortError' ? t('timed_out') : (e.message || t('sign_in_failed'));
  } finally { clearTimeout(to); $('#login-submit').disabled = false; }
}
async function doLogout() {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  state.authed = false; state.user = null; state.edit = false; applyMode(); render(); updateAuthUI();
}
$('#login-submit').addEventListener('click', doLogin);
$('#login-cancel').addEventListener('click', closeLogin);
$('#login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#login-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#login-pass').focus(); });
$('#btn-logout').addEventListener('click', doLogout);
checkSession();
applyMode();
$('#ed-close').addEventListener('click', closeEditor);
$('#ed-duplicate').addEventListener('click', duplicateRelay);
$('#ed-bind').addEventListener('click', bind);
$('#ed-unbind').addEventListener('click', unbind);
$('#ed-delete').addEventListener('click', deleteRelay);
$('#ed-automation-toggle').addEventListener('click', toggleAutomation);
$('#ed-relay-toggle').addEventListener('click', toggleRelayFromEditor);
$('#ed-rename-relay').addEventListener('click', () => renameDevice($('#ed-relay').value));
$('#ed-rename-sensor').addEventListener('click', () => renameDevice($('#ed-sensor').value));
$('#ed-sched-on').addEventListener('change', (e) => {
  $('#ed-sched-body').classList.toggle('hidden', !e.target.checked);
  if (e.target.checked && !$('#ed-sched-blocks').children.length) $('#ed-sched-blocks').appendChild(schedBlockRow());
});
$('#ed-sched-add').addEventListener('click', () => $('#ed-sched-blocks').appendChild(schedBlockRow()));
$('#ed-notify').addEventListener('change', (e) => {
  $('#ed-notify-deviation-label').classList.toggle('hidden', !e.target.checked);
});
$('#chart-modal-close').addEventListener('click', () => $('#chart-modal').classList.add('hidden'));
$('#chart-modal-csv').addEventListener('click', exportHistory);
$('#chart-modal').addEventListener('click', (e) => { if (e.target === $('#chart-modal')) $('#chart-modal').classList.add('hidden'); });

// ---- resizable sidebar ----
function initResizeHandles() {
  document.querySelectorAll('.editor').forEach((el) => {
    if (el.querySelector('.editor-resize')) return;
    const h = document.createElement('div');
    h.className = 'editor-resize fixed w-[6px] cursor-ew-resize z-[5] pointer-events-auto active:bg-[rgba(59,110,245,.15)]';
    h.dataset.target = el.id;
    el.appendChild(h);
  });
}
initResizeHandles();

function positionResizeHandles() {
  document.querySelectorAll('.editor-resize').forEach((h) => {
    const editor = h.closest('.editor');
    if (!editor || editor.classList.contains('hidden')) { h.style.display = 'none'; return; }
    const r = editor.getBoundingClientRect();
    h.style.display = '';
    h.style.top = r.top + 'px';
    h.style.left = r.left + 'px';
    h.style.height = r.height + 'px';
  });
}
window.addEventListener('scroll', positionResizeHandles, { passive: true });
window.addEventListener('resize', positionResizeHandles);

let resizeState = null;
document.addEventListener('mousedown', (e) => {
  if (!e.target.classList.contains('editor-resize')) return;
  const editor = e.target.closest('.editor');
  if (!editor) return;
  resizeState = { editor, startX: e.clientX, startW: editor.offsetWidth };
  e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (!resizeState) return;
  const dx = resizeState.startX - e.clientX;
  const w = Math.max(280, Math.min(800, resizeState.startW + dx));
  resizeState.editor.style.width = w + 'px';
  positionResizeHandles();
  if (resizeState.editor.id === 'editor') setEditorWidth(w);
});
document.addEventListener('mouseup', () => { resizeState = null; });

function setEditorWidth(w) { try { localStorage.setItem('rp-editor-w', w); } catch {} }
function getEditorWidth() { try { return parseInt(localStorage.getItem('rp-editor-w')) || 400; } catch { return 400; } }
const editorWidth = getEditorWidth();
$('#editor').style.width = editorWidth + 'px';

// ---- expandable history chart ----
let modalRange = 24;

function openChartModal(r) {
  if (!r) { r = selected(); } if (!r || !r.sensor) return;
  // sync range to sidebar
  document.querySelectorAll('#chart-modal-range .range-btn').forEach((b) => {
    setRangeActive(b, parseInt(b.dataset.range) === historyRange);
  });
  modalRange = historyRange;
  loadChartModal(r);
  $('#chart-modal').classList.remove('hidden');
}

async function loadChartModal(r) {
  const svg = $('#chart-modal-svg');
  const params = `sensor=${encodeURIComponent(r.sensor)}&hours=${modalRange}` +
    (r.relay ? `&relay=${encodeURIComponent(r.relay)}` : '') +
    (r.temp != null ? `&target=${r.temp}` : '');
  try {
    const data = await api('/api/history/export?' + params);
    if (data.rows) {
      $('#chart-modal-title').textContent = `${r.name || r.sensor} — ${modalRange}h`;
      drawChart(svg, data.rows, data.target);
      addChartTooltip(svg, data.rows, '#chart-tooltip');
    }
  } catch {}
}

$('#ed-spark').addEventListener('click', () => openChartModal());

// Modal range buttons
document.querySelectorAll('#chart-modal-range .range-btn').forEach((b) => b.addEventListener('click', () => {
  modalRange = parseInt(b.dataset.range);
  document.querySelectorAll('#chart-modal-range .range-btn').forEach((x) => setRangeActive(x, false));
  setRangeActive(b, true);
  loadChartModal(selected());
}));

// ---- chart tooltip ----
function addChartTooltip(svg, data, tipSel) {
  const tip = $(tipSel || '#chart-tooltip');
  if (!tip) return;
  if (svg._mm) svg.removeEventListener('mousemove', svg._mm);
  if (svg._ml) svg.removeEventListener('mouseleave', svg._ml);
  // Create a marker circle if it doesn't exist
  let marker = svg.querySelector('.spark-marker');
  if (!marker) {
    marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('class', 'spark-marker');
    marker.setAttribute('r', '4');
    marker.setAttribute('fill', '#f59e0b');
    marker.setAttribute('stroke', '#fff');
    marker.setAttribute('stroke-width', '2');
    svg.appendChild(marker);
  }
  const mm = (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vb = svg.viewBox.baseVal;
    const vx = (mx / rect.width) * vb.width;
    const W = vb.width, H = vb.height, padL = 45, padR = 10, padT = 12, padB = 28;
    const ch = H - padT - padB, cw = W - padL - padR;
    const t0 = data[0].t, t1 = data[data.length - 1].t;
    let nearest = data[0], best = Infinity;
    for (const p of data) {
      const px = padL + ((p.t - t0) / (t1 - t0 || 1)) * cw;
      const d = Math.abs(px - vx);
      if (d < best) { best = d; nearest = p; }
    }
    if (best > 80) { tip.classList.add('hidden'); marker.setAttribute('display', 'none'); return; }
    const temps = data.map((p) => p.temp);
    let lo = Math.min(...temps), hi = Math.max(...temps);
    const target = parseFloat(svg.dataset.target);
    if (isFinite(target)) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * ch;
    const px = padL + ((nearest.t - t0) / (t1 - t0 || 1)) * cw;
    const py = y(nearest.temp);
    marker.setAttribute('cx', px.toFixed(1));
    marker.setAttribute('cy', py.toFixed(1));
    marker.removeAttribute('display');
    const d = new Date(nearest.t);
    const time = d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    tip.innerHTML = `${time}<br>${nearest.temp.toFixed(1)}°C · ${nearest.state === 'on' ? 'ON' : nearest.state === 'off' ? 'OFF' : nearest.state}`;
    tip.style.left = mx + 'px';
    tip.style.top = my + 'px';
    tip.classList.remove('hidden');
  };
  const ml = () => { tip.classList.add('hidden'); marker.setAttribute('display', 'none'); };
  svg.addEventListener('mousemove', mm);
  svg.addEventListener('mouseleave', ml);
  svg._mm = mm; svg._ml = ml;
}
$('#ed-csv').addEventListener('click', exportHistory);
document.querySelectorAll('.range-btn').forEach((b) => b.addEventListener('click', () => {
  historyRange = parseInt(b.dataset.range);
  document.querySelectorAll('.range-btn').forEach((x) => setRangeActive(x, false));
  setRangeActive(b, true);
  const r = selected(); if (r) loadHistory(r);
}));
$('#de-close').addEventListener('click', closeDeviceEditor);
$('#de-save').addEventListener('click', saveDevice);
$('#de-add-output').addEventListener('change', (e) => { addOutputToDevice(e.target.value); e.target.value = ''; });
$('#de-rename-ha').addEventListener('click', renameDeviceHa);
$('#de-delete').addEventListener('click', deleteDevice);
$('#act-close').addEventListener('click', closeActivityLog);
$('#act-prev').addEventListener('click', () => { if (activity.page > 1) loadActivity(activity.page - 1); });
$('#act-next').addEventListener('click', () => loadActivity(activity.page + 1));
$('#act-csv').addEventListener('click', exportActivityCSV);
$('#bk-close').addEventListener('click', closeBulkEdit);
$('#bk-area').addEventListener('change', updateBulkList);
['change', 'input'].forEach((ev) => {
  $('#bk-mode').addEventListener(ev, updateBulkList);
  $('#bk-temp').addEventListener(ev, updateBulkList);
  $('#bk-deadband').addEventListener(ev, updateBulkList);
});
$('#bk-apply').addEventListener('click', applyBulk);
$('#pr-close').addEventListener('click', closePresets);
$('#pr-save').addEventListener('click', savePreset);

// re-render when crossing the mobile/desktop breakpoint
let _wasMobile = isMobile();
window.addEventListener('resize', () => { const m = isMobile(); if (m !== _wasMobile) { _wasMobile = m; render(); } });

boot();
