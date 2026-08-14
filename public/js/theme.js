import { $ } from './core.js';
import { render } from './board.js';
import { refreshThemeLabel } from './i18n.js';

// theme: follows the OS/browser preference by default; an explicit toggle
// (remembered per browser) overrides it.
const savedTheme = () => { try { return localStorage.getItem('relaypanel-theme'); } catch { return null; } };
const systemTheme = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; } };
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  // Swap ONLY the glyph. Assigning className here wiped whatever layout classes the
  // markup had put on the icon — the menus' w-4 alignment column, in this case (#104).
  const icon = $('#btn-theme i');
  if (icon) { icon.classList.toggle('bi-sun', t === 'dark'); icon.classList.toggle('bi-moon-stars', t !== 'dark'); }
  refreshThemeLabel();   // the label names the mode it switches TO, so it flips with the icon
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
