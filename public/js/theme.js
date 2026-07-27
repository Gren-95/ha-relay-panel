import { $ } from './core.js';
import { render } from './board.js';

// theme: follows the OS/browser preference by default; an explicit toggle
// (remembered per browser) overrides it.
const savedTheme = () => { try { return localStorage.getItem('relaypanel-theme'); } catch { return null; } };
const systemTheme = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; } };
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('#btn-theme').innerHTML = t === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
  $('#btn-theme').title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

// wiring: theme toggle button + follow-OS listener
export function initTheme() {
$('#btn-theme').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('relaypanel-theme', next); } catch {}
  applyTheme(next);
  render();
});
applyTheme(savedTheme() || systemTheme());

try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { if (!savedTheme()) applyTheme(e.matches ? 'dark' : 'light'); }); } catch {}
}

export { applyTheme, savedTheme, systemTheme };
