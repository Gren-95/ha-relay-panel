/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.html', './public/**/*.js'],
  // Theme flips via CSS variables on html[data-theme="dark"] (see src/input.css),
  // so utility colors are dark-aware automatically. This selector is here for the
  // rare cases that need an explicit dark: variant.
  darkMode: ['selector', '[data-theme="dark"]'],
  // Preflight (Tailwind's base reset) is intentionally OFF during the migration:
  // the existing hand-written component CSS still governs the look, so adding
  // Tailwind causes zero visual regression. Re-enable once components are migrated.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      // Map to the existing CSS custom properties so light/dark keeps working.
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        fg: 'var(--text)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        primary: { DEFAULT: 'var(--primary)', dark: 'var(--primary-d)' },
        danger: 'var(--danger)',
        on: 'var(--on)',
        off: 'var(--off)',
        heat: 'var(--heat)',
        cool: 'var(--cool)',
        ok: 'var(--ok)',
        input: 'var(--input-bg)',
      },
      borderColor: { DEFAULT: 'var(--border)' },
      boxShadow: { panel: 'var(--shadow)' },
      fontFamily: { sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      screens: { mobile: { max: '700px' } },
      keyframes: {
        'mode-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.3' } },
      },
      animation: { 'mode-pulse': 'mode-pulse 1.2s ease-in-out infinite' },
    },
  },
  plugins: [],
}
