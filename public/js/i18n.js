import { render } from './board.js';
import { applyMode } from './mode.js';

// ---- i18n (English default in the HTML; Estonian overrides here) ----
const TR = {
  et: {
    ha_unreachable: 'Home Assistant pole saadaval — näidud võivad olla vananenud',
    app_title: 'Relee paneel',
    physical_relay_ph: '+ Füüsiline relee…', area_ph: '+ Ala…',
    save: 'Salvesta', sign_out: 'Logi välja',
    dark_mode: 'Tume režiim', light_mode: 'Hele režiim',
    advanced: 'Rohkem', add_single_relay: 'Lisa üksik relee',
    export_layout: 'Ekspordi', import_layout: 'Impordi', about: 'Teave',
    edit_relay: 'Muuda releed', name: 'Nimi', name_ph: 'nt Tehnoruumi küte',
    relay_to_switch: 'Lülitatav relee', rename_this_relay: 'Nimeta see relee ümber',
    temp_sensor: 'Temperatuuriandur', rename_this_sensor: 'Nimeta see andur ümber',
    area: 'Ala', none_opt: '— puudub —', heat_or_cool: 'Küte või jahutus?',
    auto_opt: 'Auto — küta või jahuta vastavalt vajadusele',
    heating_opt: 'Küte — lülita SISSE, kui liiga külm',
    cooling_opt: 'Jahutus — lülita SISSE, kui liiga kuum',
    target_temp: 'Sihttemperatuur (°C)',
    switchback_gap: 'Tagasilülituse vahe (°C) — valikuline, 0 = lülita täpselt sihil',
    use_schedule: 'Kasuta ajakava (erinev siht kellaaja järgi)',
    add_time_block: 'Lisa ajavahemik',
    fallback_temp: 'Muul ajal, siht (°C)',
    sched_hint: 'Kui ükski plokk ei sobi, kasutatakse ülemist sihttemperatuuri (kui varuväärtus pole seatud).',
    last_24h: 'Viimased 24 tundi',
    save_turn_on_auto: 'Salvesta ja aktiveeri termostaat',
    thermostat_active: 'Termostaat aktiivne',
    thermostat_inactive: 'Termostaat pole aktiivne — klõpsa Salvesta',
    duplicate_relay: 'Klooni', remove_automation: 'Eemalda automaatika',
    delete_this_relay: 'Kustuta see relee',
    activity_log: 'Tegevuste logi', newer: 'Uuemad', older: 'Vanimad',
    download_csv: 'Laadi alla CSV',
    notify_on_issues: 'Teavita probleemidest', notify_deviation: 'Teavita kui temp hälbib (°C)',
    bulk_edit: 'Hulgimuutmine',
    min_on: 'Minimaalne tööaeg (min)', min_off: 'Minimaalne puhkeaeg (min)',
    min_on_hint: 'Väldi lühitsükleid: relee ei lülitu välja enne seda aega',
    min_off_hint: 'Väldi lühitsükleid: relee ei lülitu sisse enne seda aega',
    all_off_confirm: 'Lülita kõik releed välja?', all_off_done: 'Kõik releed välja lülitatud',
    all_off_title: 'Lülita kõik releed välja',
    confirm_remove_device: 'Eemalda "{name}" tahvlilt?',
    confirm_remove_area: 'Eemalda ala "{name}"? Releed jäävad tahvlile.',
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
    no_events: 'Sündmusi pole veel salvestatud.',
    enter_target_temp: 'Sisesta sihttemperatuur', applied_to_n: 'Rakendatud {n} releele',
    n_failed: '{n} ebaõnnestus', new_name_for: 'Uus nimi:',
    turning_area_on: 'ala sisse lülitamine…', turning_area_off: 'ala välja lülitamine…',
    switching: 'lülitamine…', switch_error: 'lülitamise viga',
    no_output_to_rename: 'pole ümbernimetatavat väljundit',
    physical_relay_h: 'Füüsiline relee', label_shown: 'Silt (kuvatakse kastil)',
    rename_device_ha: 'Nimeta seade Home Assistantis ümber', group_area: 'Rühm / ala',
    outputs: 'Väljundid', add_output_ph: '+ Lisa väljund…', remove_from_board: 'Eemalda tahvlilt',
    sign_in_to_edit: 'Muutmiseks logi sisse', use_ha_1: 'Kasuta oma ', use_ha_2: ' kontot.',
    username: 'Kasutajanimi', password: 'Parool', sign_in: 'Logi sisse', cancel: 'Tühista',
    // dynamic
    mode_edit: 'Muuda', mode_live: 'Vaade',
    mode_auto: 'Auto', mode_heat: 'Küte', mode_cool: 'Jahutus', unchanged: 'muutmata',
    saved: 'salvestatud', save_error: 'salvestamise viga', save_conflict: 'konflikt — uuesti salvestamine…', sign_in_to_save: 'salvestamiseks logi sisse',
    signing_in: 'logib sisse…', signed_in_loading: 'sisse logitud — laen…',
    logged_in_as: 'Sisse logitud: {user}', options: 'Valikud',
    language: 'Keel', zoom: 'Suurendus',
    enter_user_pass: 'Sisesta kasutajanimi ja parool.', sign_in_failed: 'Sisselogimine ebaõnnestus.',
    timed_out: 'Aegus — kontrolli ühendust ja proovi uuesti.',
    exported: 'eksporditud', imported: 'imporditud',
    undo: 'võta tagasi', redo: 'tee uuesti', nothing_undo: 'pole midagi tagasi võtta', nothing_redo: 'pole midagi uuesti teha',
    relays: 'releed', on_word: 'sees', in_maintenance: 'hoolduses', offline_word: 'ühenduseta',
    warn_relay_missing: 'Relee olem puudub Home Assistantis (ümber nimetatud või eemaldatud). Ava see relee, vali see uuesti ja salvesta.',
    warn_relay_offline: 'Relee on ühenduseta / kättesaamatu — seda ei saa praegu lülitada. Kontrolli seadme toidet ja võrku.',
    warn_box_offline: 'Releekarp on ühenduseta — kõik {n} väljundit on kättesaamatud. Kontrolli karbi toidet ja võrku.',
    warn_sensor_missing: 'Temperatuuriandur puudub Home Assistantis (ümber nimetatud või eemaldatud). Ava see relee, vali andur uuesti ja salvesta.',
    warn_sensor_offline: 'Temperatuuriandur on ühenduseta. Automaatjuhtimine on peatatud (relee jääb ohutult VÄLJA). Releed saab siiski käsitsi lülitada.',
    auto_on: 'automaatjuhtimine on SEES', auto_paused: 'hoolduseks peatatud', auto_none: 'automaatjuhtimine puudub',
    pause_maint: 'Peata hoolduseks', resume_auto: 'Jätka automaatjuhtimist',
    turn_relay_off: 'Lülita relee VÄLJA', turn_relay_on: 'Lülita relee SISSE',
    show_on_map: 'Näita kaardil', map_word: 'Kaart',
    maint_badge: 'hooldus', relay_offline_short: 'relee ühenduseta', no_relay: 'releed pole',
    click_turn_on: 'Klõpsa, et lülitada SISSE', click_turn_off: 'Klõpsa, et lülitada VÄLJA',
    already_on_board: ' on juba tahvlil', all_on: 'Kõik sisse', all_off: 'Kõik välja',
    // activity log actions (act_*) - the only definitions; keep in step with EN
    act_login: 'Sisselogimine', act_login_fail: 'Ebaõnnestunud sisselogimine', act_logout: 'Väljalogimine',
    act_relay_bind: 'Relee seotud', act_relay_unbind: 'Relee seos eemaldatud', act_relay_delete: 'Relee kustutatud',
    act_device_rename: 'Ümbernimetamine', act_device_delete: 'Seade eemaldatud', act_area_delete: 'Ala eemaldatud',
    act_switch_toggle: 'Käsitsi lülitus',
    act_automation_pause: 'Automaatika peatatud', act_automation_resume: 'Automaatika jätkatud',
    act_automation_reapply: 'Automaatika uuesti rakendatud',
    act_automation_prune: 'Orbautomaatika eemaldatud',
    // area editor panel (#95)
    device_address: 'Aadress', no_device: 'Ilma releekarbita', area_h: 'Ala', area_target_temp: 'Sihttemperatuur kõigile siinsetele releedele',
    master_control: 'Üldjuhtimine', relays_word: 'Releed', apply_word: 'Rakenda',
    no_relays_here: 'siin pole releesid', mixed_word: 'erinevad',
    colour_reset: 'värv lähtestatud automaatseks',
    act_layout_save: 'Paigutus salvestatud', act_layout_restore: 'Paigutus taastatud',
    // JS-built strings (#71)
    add: 'Lisa', all_relays: 'Kõik releed', apply_to_n: 'Rakenda {n} releele',
    binding: 'sidumine…', bound: 'seotud', pick_device_first: 'vali enne seade',
    renaming: 'ümbernimetamine…', renamed_in: 'ümbernimetatud: {where}',
    automation_removed: 'automaatika eemaldatud',
    error_label: 'viga', rename_error_label: 'ümbernimetamise viga',
    turning_all_off: 'kõik välja lülitamine…',
    not_valid_json: 'pole kehtiv JSON', not_relaypanel_layout: 'pole relay-panel paigutus',
    csv_downloaded: 'CSV alla laaditud',
    just_now: 'just nüüd', m_ago: '{n} min tagasi', h_ago: '{n} h tagasi', d_ago: '{n} p tagasi',
    zoom_in: 'Suurenda', zoom_out: 'Vähenda', pick_dates: 'Vali kuupäevad',
    box_color: 'Karbi värv', reset_to_auto: 'Lähtesta automaatseks',
    lock: 'Lukusta', unlock: 'Ava lukustus',
    global_temp_title: 'Määra temperatuur kõigile releedele',
    load_error_retrying: 'laadimise viga — uuesti proovimine…',
    about_title: 'Relay Panel', about_version: 'Versioon', about_built: 'Ehitatud',
    about_ha_status: 'Home Assistant', about_ha_reachable: 'ühendatud', about_ha_checking: 'kontrollin…',
    about_view_repo: 'Vaata GitHubis',
    about_report_issue: 'Teata veast', about_license: 'Litsents',
    refresh_info: 'Värskendussagedus',
    rc_live: 'Temperatuurid ja releede olekud', rc_live_desc: 'Leht küsib Home Assistantilt hetkeväärtused.',
    rc_sensor: 'Anduri näidud', rc_sensor_every: 'kui andur saadab',
    rc_sensor_desc: 'Iga andur saadab näidu oma graafiku järgi, tavaliselt siis, kui temperatuur muutub. Number võib püsida minuteid samana, kuigi leht värskendub.',
    rc_ha: 'Home Assistanti ühendus', rc_ha_desc: 'Kontrollitakse koos väärtustega. Kui ühendust pole, ilmub punane riba.',
    rc_auto: 'Automaatne lülitamine',
    rc_auto_desc: 'Home Assistant võrdleb temperatuuri sihtväärtusega iga uue näidu korral ja lisaks iga 5 minuti järel. Muudetud sihtväärtus rakendub kohe.',
    rc_alerts: 'Teavitused', rc_alerts_desc: 'Ühenduse kadumise ja sihtväärtusest kõrvalekalde kontroll releedel, millel on „Teavita probleemidest“ sisse lülitatud.',
    rc_history: 'Ajaloo graafikud ja tegevuste logi', rc_history_desc: 'Laaditakse avamisel. Uuemate andmete nägemiseks sulge ja ava uuesti.',
    rc_on_open: 'avamisel',
    rc_layout: 'Paneeli paigutus', rc_layout_desc: 'Teiste tehtud muudatused paneelil ilmuvad pärast lehe uuesti laadimist.',
    rc_on_load: 'lehe laadimisel',
    rc_session: 'Sisselogimine', rc_session_desc: 'Kehtib 8 tundi ja pikeneb, kui teed muudatusi.',
    history_btn: 'Ajalugu', temp_history: 'Temperatuuride ajalugu', hp_custom: 'Kuupäevad',
    hp_same_scale: 'Ühine skaala', hp_device_temps: 'Seadmete temperatuurid', hp_reload: 'Laadi uuesti',
    hp_all: 'Kõik andurid', hp_areas: 'Alad', hp_sensors: 'Andurid', hp_no_area: 'Alata',
    hp_no_sensors: 'andureid pole', hp_pick_dates: 'vali kuupäevad', hp_no_data: 'andmed puuduvad',
    hp_relay_on: 'relee SEES', hp_relay_off: 'relee VÄLJAS',
    hp_relay_offline: 'relee võrguühenduseta', hp_setpoint: 'sihtväärtus', hp_paused: 'peatatud',
    hp_on_time: 'Relee sees-aeg valitud vahemikus', hp_below_time: 'Aeg alla sihtväärtuse valitud vahemikus',
    hp_lg_on: 'relee SEES', hp_lg_paused: 'peatatud', hp_lg_offline: 'võrguühenduseta',
    hp_lg_below: 'alla sihtväärtuse', hp_lg_setpoint: 'sihtväärtus',
    hp_rf_title: 'Filtreeri relee järgi', hp_rf_all: 'Kõik', hp_rf_bound: 'Releega', hp_rf_unbound: 'Releeta',
    // battery alerts
    battery_alerts: 'Aku teavitused', al_enabled: 'Saada e-posti teavitusi',
    al_threshold: 'Teavita, kui aku on sama või alla (%)',
    al_threshold_hint: '0–{max}. Aku loetakse taas korras olevaks, kui see on vähemalt {margin}% üle piiri.',
    al_recipients: 'Saajad', al_recipients_ph: 'Üks e-posti aadress rea kohta',
    al_smtp: 'SMTP server', al_host: 'Server', al_port: 'Port', al_security: 'Krüpteerimine',
    al_sec_none: 'Puudub (tavaline, nt pordi 25 relee)', al_sec_starttls: 'STARTTLS (tavaliselt port 587)', al_sec_tls: 'TLS (tavaliselt port 465)',
    al_user: 'Kasutajanimi (valikuline)', al_pass: 'Parool', al_pass_saved: 'salvestatud, jäta tühjaks, et alles hoida',
    al_clear_pass: 'Eemalda salvestatud parool', al_from: 'Saatja aadress',
    al_test: 'Saada testkiri', al_sending: 'saadan…', al_test_sent: 'Testkiri saadetud.', al_saved: 'Salvestatud.',
    al_entities: 'Akud', al_entities_hint: 'Kõik Home Assistanti akud. Eemalda linnuke, et seda kirjades mitte näidata.',
    al_none: 'Home Assistantis pole ühtegi akut.', al_offline: 'pole saadaval', al_low: 'MADAL', al_ok: 'OK',
    al_reported: 'teavitatud', al_last_sent: 'Viimane kiri saadeti {ago}', al_last_error: 'Viimane viga {ago}: {err}',
    rc_battery: 'Aku teavitused', rc_battery_desc: 'Kontrollitakse kõiki Home Assistanti akusid ja kiri saadetakse, kui mõni langeb seatud piirini.',
    act_alerts_save: 'Aku teavitused salvestatud', act_alerts_test: 'Aku teavituste testkiri saadetud',
  },
};
const EN = {  // English fallbacks for dynamic (non-HTML) strings
  mode_edit: 'Edit', mode_live: 'Live',
  mode_auto: 'Auto', mode_heat: 'Heating', mode_cool: 'Cooling', unchanged: 'unchanged',
  saved: 'saved', save_error: 'save error', save_conflict: 'conflict — retrying…', sign_in_to_save: 'sign in to save',
  signing_in: 'signing in…', signed_in_loading: 'signed in — loading…',
  logged_in_as: 'Logged in as {user}', options: 'Options',
  dark_mode: 'Dark mode', light_mode: 'Light mode',
  enter_user_pass: 'Enter username and password.', sign_in_failed: 'Sign in failed.',
  timed_out: 'Timed out — check the connection and try again.',
  exported: 'exported', imported: 'imported',
  undo: 'undo', redo: 'redo', nothing_undo: 'nothing to undo', nothing_redo: 'nothing to redo',
  relays: 'relays', on_word: 'on', in_maintenance: 'in maintenance', offline_word: 'offline',
  warn_relay_missing: 'Relay entity is missing in Home Assistant (renamed or removed). Open this relay, pick it again and Save.',
  warn_relay_offline: 'Relay is offline / unreachable — it cannot be switched right now. Check the device power and network.',
  warn_box_offline: 'Relay box is offline — all {n} outputs are unreachable. Check the box power and network.',
  warn_sensor_missing: 'Temperature sensor is missing in Home Assistant (renamed or removed). Open this relay, pick the sensor again and Save.',
  warn_sensor_offline: 'Temperature sensor is offline. Automatic control is paused (the relay fails safe to OFF). You can still switch the relay manually.',
  auto_on: 'automatic control is ON', auto_paused: 'paused for maintenance', auto_none: 'no automatic control',
  pause_maint: 'Pause for maintenance', resume_auto: 'Resume automatic control',
  turn_relay_off: 'Turn relay OFF', turn_relay_on: 'Turn relay ON',
  show_on_map: 'Show on map', map_word: 'Map',
  maint_badge: 'maint', relay_offline_short: 'relay offline', no_relay: 'no relay',
  click_turn_on: 'Click to turn ON', click_turn_off: 'Click to turn OFF',
  already_on_board: ' is already on the board', all_on: 'All on', all_off: 'All off',
  activity_log: 'Activity log', newer: 'Newer', older: 'Older',
  act_login: 'Login', act_login_fail: 'Failed login', act_logout: 'Logout',
  act_relay_bind: 'Bind relay', act_relay_unbind: 'Unbind relay',
  act_device_rename: 'Rename', act_switch_toggle: 'Manual switch',
  act_automation_pause: 'Automation paused', act_automation_resume: 'Automation resumed',
  act_automation_reapply: 'Reapply automations',
  act_automation_prune: 'Orphan automation removed',
  // area editor panel (#95)
  device_address: 'Address', no_device: 'Not in a relay box', area_h: 'Area', area_target_temp: 'Target temperature for every relay here',
  master_control: 'Master control', relays_word: 'Relays', apply_word: 'Apply',
  no_relays_here: 'no relays here', mixed_word: 'mixed',
  colour_reset: 'colour reset to auto',
  act_layout_save: 'Layout saved', act_layout_restore: 'Layout restored',
  battery_alerts: 'Battery alerts',
  al_threshold_hint: '0–{max}. A battery counts as OK again once it is {margin}% above the line.',
  al_pass_saved: 'saved, leave empty to keep it',
  al_test: 'Send test email', al_sending: 'sending…', al_test_sent: 'Test email sent.', al_saved: 'Saved.',
  al_none: 'No batteries in Home Assistant.', al_offline: 'unavailable', al_low: 'LOW', al_ok: 'OK',
  al_reported: 'reported', al_last_sent: 'Last email sent {ago}', al_last_error: 'Last error {ago}: {err}',
  act_alerts_save: 'Battery alerts saved', act_alerts_test: 'Battery alert test email sent',
  act_relay_delete: 'Relay deleted', act_device_delete: 'Device removed',
  act_area_delete: 'Area removed', download_csv: 'Download CSV',
  notify_on_issues: 'Notify on issues', notify_deviation: 'Alert if temp deviates by (°C)',
  bulk_edit: 'Bulk edit',
  min_on: 'Minimum on-time (min)', min_off: 'Minimum off-time (min)',
  min_on_hint: 'Prevent short cycling: relay won\'t turn off before this time',
  min_off_hint: 'Prevent short cycling: relay won\'t turn on before this time',
  all_off_confirm: 'Turn off all relays?', all_off_done: 'All relays turned off',
  all_off_title: 'Turn all relays off',
  confirm_remove_device: 'Remove "{name}" from the board?',
  confirm_remove_area: 'Remove area "{name}"? Relays inside will stay on the board.',
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
  no_events: 'No events recorded yet.',
  enter_target_temp: 'Enter a target temperature', applied_to_n: 'Applied to {n} relays',
  n_failed: '{n} failed', new_name_for: 'New name for',
  turning_area_on: 'turning area on…', turning_area_off: 'turning area off…',
  switching: 'switching…', switch_error: 'switch error',
  no_output_to_rename: 'no output entity to rename',
  // JS-built strings (#71)
  add: 'Add', all_relays: 'All relays', apply_to_n: 'Apply to {n} relays',
  binding: 'binding…', bound: 'bound', pick_device_first: 'pick a device first',
  renaming: 'renaming…', renamed_in: 'renamed in {where}',
  automation_removed: 'automation removed',
  error_label: 'error', rename_error_label: 'rename error',
  turning_all_off: 'turning all off…',
  not_valid_json: 'not valid JSON', not_relaypanel_layout: 'not a relay-panel layout',
  csv_downloaded: 'CSV downloaded',
  just_now: 'just now', m_ago: '{n}m ago', h_ago: '{n}h ago', d_ago: '{n}d ago',
  zoom_in: 'Zoom in', zoom_out: 'Zoom out', pick_dates: 'Pick dates',
  box_color: 'Box colour', reset_to_auto: 'Reset to auto',
  lock: 'Lock', unlock: 'Unlock',
  global_temp_title: 'Set temperature for all relays',
  load_error_retrying: 'load error — retrying…',
  about_title: 'Relay Panel', about_version: 'Version', about_built: 'Built',
  about_ha_status: 'Home Assistant', about_ha_reachable: 'reachable', about_ha_checking: 'checking…',
  about_view_repo: 'View on GitHub',
  about_report_issue: 'Report a problem', about_license: 'License',
  hp_all: 'All sensors', hp_areas: 'Areas', hp_sensors: 'Sensors', hp_no_area: 'No area',
  hp_no_sensors: 'no sensors', hp_pick_dates: 'pick dates', hp_no_data: 'no data',
  hp_relay_on: 'relay ON', hp_relay_off: 'relay OFF',
  hp_relay_offline: 'relay offline', hp_setpoint: 'set point', hp_paused: 'paused',
  hp_on_time: 'Relay ON time in this range', hp_below_time: 'Time below the set point in this range',
};
let LANG = 'en';
function t(key, params) {
  let s = (LANG === 'et' && TR.et[key] != null) ? TR.et[key] : (EN[key] != null ? EN[key] : key);
  if (params) { for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v); }
  return s;
}
function fmtAgo(ms) {
  if (ms < 60000) return t('just_now');
  if (ms < 3600000) return t('m_ago', { n: Math.round(ms / 60000) });
  if (ms < 86400000) return t('h_ago', { n: Math.round(ms / 3600000) });
  return t('d_ago', { n: Math.round(ms / 86400000) });
}
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    if (el.children.length) return; // never overwrite an element that wraps other elements
    const v = LANG === 'et' ? TR.et[el.dataset.i18n] : null; if (v != null) el.textContent = v; else if (el.dataset.i18nEn != null) el.textContent = el.dataset.i18nEn;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const v = LANG === 'et' ? TR.et[el.dataset.i18nPh] : null; if (v != null) el.placeholder = v; });
  // Titles need the same English snapshot the text path keeps in dataset.i18nEn.
  // Without it the et branch was one-way: switching back to English left every
  // translated tooltip in Estonian until a reload, because `null` skipped the write.
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    if (el.dataset.i18nTitleEn == null) el.dataset.i18nTitleEn = el.title;
    const v = LANG === 'et' ? TR.et[el.dataset.i18nTitle] : el.dataset.i18nTitleEn;
    if (v != null) el.title = v;
  });
  // the flag lives in its own span (#104) — #btn-lang now also carries a "Language" label
  const lb = document.getElementById('btn-lang-flag'); if (lb) lb.textContent = LANG === 'et' ? '🇪🇪' : '🇬🇧';
  refreshThemeLabel();
  document.documentElement.lang = LANG;
}

/*
 * The theme item names the mode it switches TO, so it cannot be a data-i18n span:
 * applyI18n's English branch restores dataset.i18nEn, the text snapshotted at load,
 * which would drag a stale "Dark mode" back on every language switch. Same reason
 * #mode-label is written from applyMode() rather than declared in the markup.
 *
 * It lives here, not in theme.js, so theme.js can import it without i18n importing
 * theme back — and so the string and the code that picks it stay together.
 */
function refreshThemeLabel() {
  const el = document.getElementById('theme-label'); if (!el) return;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  el.textContent = dark ? t('light_mode') : t('dark_mode');
}
function setLang(l) {
  LANG = l === 'et' ? 'et' : 'en';
  try { localStorage.setItem('relaypanel-lang', LANG); } catch {}
  // snapshot English defaults once so we can switch back
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (!el.children.length && el.dataset.i18nEn == null) el.dataset.i18nEn = el.textContent; });
  applyI18n();
  if (typeof render === 'function') { applyMode(); render(); }
}

export { t, fmtAgo, applyI18n, setLang, refreshThemeLabel, LANG };
