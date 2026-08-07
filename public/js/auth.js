import { $, state, api } from './core.js';
import { t } from './i18n.js';
import { applyMode } from './mode.js';
import { render } from './board.js';

// --- auth (validates against Home Assistant) ---
function updateAuthUI() {
  // Sign in/out — exactly one visible at a time (#72)
  $('#btn-login').classList.toggle('hidden', state.authed);
  $('#btn-logout').classList.toggle('hidden', !state.authed);
  if (state.user) $('#btn-logout').title = 'Sign out (' + state.user + ')';
  const alloff = $('#btn-alloff'); alloff.classList.toggle('hidden', !state.authed); alloff.classList.toggle('opacity-40', !state.edit); alloff.disabled = !state.edit;
}
async function checkSession() {
  try { const s = await api('/api/session'); state.authed = !!s.authed; state.user = s.user || null; }
  catch { state.authed = false; state.user = null; }
  updateAuthUI();
  // just signed in via the login-reload? drop straight into Edit mode
  let enter = false; try { enter = sessionStorage.getItem('rp-enter-edit') === '1'; if (enter) sessionStorage.removeItem('rp-enter-edit'); } catch {}
  if (enter && state.authed) { state.edit = true; applyMode(); render(); }
  else if (state.authed) render(); // re-render so toggle buttons enable now that auth is confirmed
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

// wiring: login modal + logout, then restore any existing session
export function initAuth() {
$('#login-submit').addEventListener('click', doLogin);
$('#login-cancel').addEventListener('click', closeLogin);
$('#login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#login-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#login-pass').focus(); });
$('#btn-logout').addEventListener('click', doLogout);
$('#btn-login').addEventListener('click', openLogin);
checkSession();
}

export { updateAuthUI, checkSession, openLogin, closeLogin, doLogin, doLogout };
