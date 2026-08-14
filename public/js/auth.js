import { $, state, api } from './core.js';
import { t } from './i18n.js';
import { applyMode } from './mode.js';
import { render } from './board.js';
import { registerModal } from './modals.js';

// --- account menu (#104) — the chip IS the control; Sign out lives inside it ---
function closeAccountMenu() {
  $('#account-menu').classList.add('hidden');
  $('#user-badge').setAttribute('aria-expanded', 'false');
}
function toggleAccountMenu() {
  const open = $('#account-menu').classList.toggle('hidden') === false;
  $('#user-badge').setAttribute('aria-expanded', String(open));
}

// --- auth (validates against Home Assistant) ---
function updateAuthUI() {
  $('#btn-login').classList.toggle('hidden', state.authed);
  // The chip is BOTH the identity (#82) and the options menu's trigger (#104). It stays
  // put when signed out — language and zoom live in that menu and are open to everyone —
  // and only swaps its face: avatar + name signed in, a neutral sliders icon otherwise.
  const signedIn = !!(state.authed && state.user);
  const badge = $('#user-badge');
  if (state.user) {
    $('#user-avatar').textContent = state.user.trim().charAt(0) || '?';
    $('#user-name').textContent = state.user;
  }
  // The name carries the identity, so the full "Logged in as …" phrasing is the tooltip
  // rather than width in an already crowded bar.
  badge.title = signedIn ? t('logged_in_as', { user: state.user }) : t('options');
  $('#user-avatar').classList.toggle('hidden', !signedIn);
  $('#user-name').classList.toggle('hidden', !signedIn);
  $('#prefs-icon').classList.toggle('hidden', signedIn);
  $('#btn-logout').classList.toggle('hidden', !signedIn);
  $('#logout-sep').classList.toggle('hidden', !signedIn);
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
  closeAccountMenu();
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  state.authed = false; state.user = null; state.edit = false; applyMode(); render(); updateAuthUI();
}

// wiring: login modal + logout, then restore any existing session
export function initAuth() {
registerModal('login-modal', closeLogin);
$('#login-submit').addEventListener('click', doLogin);
$('#login-cancel').addEventListener('click', closeLogin);
$('#login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#login-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#login-pass').focus(); });
$('#btn-logout').addEventListener('click', doLogout);
$('#btn-login').addEventListener('click', openLogin);
// The chip opens its menu. No stopPropagation here on purpose: the click still reaches
// the document listeners that shut the +Add and More dropdowns, so only one is ever open.
$('#user-badge').addEventListener('click', toggleAccountMenu);
document.addEventListener('click', (e) => { if (!e.target.closest('.tb-account')) closeAccountMenu(); });
checkSession();
}

export { updateAuthUI, checkSession, openLogin, closeLogin, doLogin, doLogout, closeAccountMenu };
