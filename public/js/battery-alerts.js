import { $, esc, setMsg, api } from './core.js';
import { t, fmtAgo } from './i18n.js';
import { registerModal, closeOthers, syncBackdrop } from './modals.js';
import { positionResizeHandles } from './resize.js';

// ---- battery alerts: email settings + the list of every HA battery ----
let data = null;

function openBatteryAlerts() {
  closeOthers('alerts-editor');
  $('#alerts-editor').classList.remove('hidden');
  syncBackdrop();
  requestAnimationFrame(positionResizeHandles);
  setMsg($('#al-msg'), '');
  load();
}

function closeBatteryAlerts() {
  $('#alerts-editor').classList.add('hidden');
  $('#al-pass').value = '';
  syncBackdrop();
}

async function load() {
  $('#al-list').innerHTML = `<div class="p-3 text-muted">${esc(t('loading'))}</div>`;
  try {
    data = await api('/api/battery-alerts');
    fill();
  } catch (e) {
    $('#al-list').innerHTML = '';
    setMsg($('#al-msg'), e.message, 'err');
  }
}

function fill() {
  const c = data.config;
  $('#al-enabled').checked = !!c.enabled;
  $('#al-threshold').value = c.threshold;
  $('#al-threshold').max = data.limits.maxThreshold;
  $('#al-threshold-hint').textContent = t('al_threshold_hint', { max: data.limits.maxThreshold, margin: data.limits.recoverMargin });
  $('#al-recipients').value = c.recipients.join('\n');
  $('#al-host').value = c.smtp.host;
  $('#al-port').value = c.smtp.port;
  $('#al-security').value = c.smtp.security;
  $('#al-user').value = c.smtp.user;
  $('#al-pass').value = '';
  $('#al-pass').placeholder = c.smtp.hasPass ? t('al_pass_saved') : '';
  $('#al-clear-pass').checked = false;
  $('#al-clear-pass-wrap').classList.toggle('hidden', !c.smtp.hasPass);
  $('#al-from').value = c.smtp.from;
  renderStatus();
  renderList();
}

function renderStatus() {
  const s = data.status || {};
  const parts = [];
  if (s.lastSentAt) parts.push(t('al_last_sent', { ago: fmtAgo(Date.now() - s.lastSentAt) }));
  if (s.lastError) parts.push(t('al_last_error', { ago: fmtAgo(Date.now() - (s.lastErrorAt || Date.now())), err: s.lastError }));
  const el = $('#al-status');
  el.textContent = parts.join(' · ');
  el.classList.toggle('text-danger', !!s.lastError);
}

function levelBadge(b) {
  if (b.offline) return `<span class="text-muted">${esc(t('al_offline'))}</span>`;
  const text = b.kind === 'binary' ? (b.level ? t('al_low') : t('al_ok')) : `${b.level}%`;
  return `<span class="${b.low ? 'text-danger' : ''} font-semibold tabular-nums">${esc(text)}</span>`;
}

function renderList() {
  const list = $('#al-list');
  if (data.haError) { list.innerHTML = `<div class="p-3 text-danger">${esc(t('ha_unreachable'))}</div>`; return; }
  if (!data.batteries.length) { list.innerHTML = `<div class="p-3 text-muted">${esc(t('al_none'))}</div>`; return; }
  list.innerHTML = data.batteries.map((b) =>
    `<label class="flex items-center gap-2.5 px-3 py-2 cursor-pointer">` +
    `<input type="checkbox" class="al-inc min-h-0 w-auto m-0" data-id="${esc(b.entity_id)}"${b.excluded ? '' : ' checked'} />` +
    `<span class="flex-1 min-w-0"><span class="block font-semibold truncate">${esc(b.name)}</span>` +
    `<span class="block text-muted text-[.78rem] truncate">${esc(b.entity_id)}${b.alerted ? ' · ' + esc(t('al_reported')) : ''}</span></span>` +
    levelBadge(b) +
    `</label>`).join('');
}

function formBody() {
  return {
    enabled: $('#al-enabled').checked,
    threshold: Number($('#al-threshold').value),
    recipients: $('#al-recipients').value,
    exclude: [...document.querySelectorAll('#al-list .al-inc')].filter((c) => !c.checked).map((c) => c.dataset.id),
    clearPass: $('#al-clear-pass').checked,
    smtp: {
      host: $('#al-host').value,
      port: $('#al-port').value,
      security: $('#al-security').value,
      user: $('#al-user').value,
      pass: $('#al-pass').value,
      from: $('#al-from').value,
    },
  };
}

async function save() {
  const btn = $('#al-save');
  btn.disabled = true;
  try {
    data = await api('/api/battery-alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formBody()) });
    fill();
    setMsg($('#al-msg'), t('al_saved'), 'ok');
  } catch (e) {
    setMsg($('#al-msg'), e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function sendTest() {
  const btn = $('#al-test');
  btn.disabled = true;
  setMsg($('#al-msg'), t('al_sending'));
  try {
    await api('/api/battery-alerts/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formBody()) });
    setMsg($('#al-msg'), t('al_test_sent'), 'ok');
  } catch (e) {
    setMsg($('#al-msg'), e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

function initBatteryAlerts() {
  registerModal('alerts-editor', closeBatteryAlerts, { dim: true });
  $('#al-close').addEventListener('click', closeBatteryAlerts);
  $('#al-save').addEventListener('click', save);
  $('#al-test').addEventListener('click', sendTest);
}

export { openBatteryAlerts, closeBatteryAlerts, initBatteryAlerts };
