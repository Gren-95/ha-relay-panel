/*
 * Issue #52 — hold the header at a constant physical size while the page zooms.
 *
 * Browser zoom (Ctrl +/-) scales the CSS pixel itself, so no CSS unit can opt out of
 * it: at 200% a `px` box is painted twice as large, and getBoundingClientRect() still
 * reports the same number it did at 100%. Switching the header off rem and onto px
 * therefore changes nothing here — the only way to pin it is to counter-scale it by
 * 1/zoom, which is what this module measures and publishes:
 *
 *   --header-zoom  1/zoom, consumed by <header class="[zoom:var(--header-zoom)]">.
 *                  `zoom` rather than `transform: scale()` because it takes part in
 *                  layout: the header keeps a real box, stays sticky, and every child
 *                  — toolbar buttons, icons, dropdowns — inherits the correction, so
 *                  no child needs its own fixed-px treatment.
 *   --header-h     the header's resulting layout height. It used to be a constant
 *                  72px; now that it shrinks as the page zooms in, the two rules that
 *                  hard-coded it (canvas min-height, editor panel top padding) read
 *                  this instead.
 */

// The zoom steps desktop browsers actually cycle through with Ctrl +/-.
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const snap = (z) => STEPS.reduce((best, s) => (Math.abs(s - z) < Math.abs(best - z) ? s : best), 1);

const root = document.documentElement;
let baseDpr = 0;

/*
 * devicePixelRatio = display scale x zoom, so on its own it can't tell a 2x laptop
 * panel at 100% from a 1x monitor at 200% — it needs the display's own scale first.
 * outerWidth/innerWidth is the one zoom signal that needs no baseline. It is too
 * coarse to use as the answer (window borders, scrollbar, docked devtools all skew
 * it by a few percent) but it is easily accurate enough to pick the right rung of
 * the ladder above, and that rung divides out to the exact display scale. Measured
 * once; from then on devicePixelRatio alone tracks every zoom step precisely.
 */
function displayScale() {
  if (!baseDpr) {
    const dpr = window.devicePixelRatio || 1;
    const guess = window.innerWidth ? window.outerWidth / window.innerWidth : 1;
    baseDpr = dpr / snap(guess);
  }
  return baseDpr;
}

const zoom = () => snap((window.devicePixelRatio || 1) / displayScale());

// Off below the mobile breakpoint: phones zoom by pinching, which leaves
// devicePixelRatio alone, and a toolbar that refuses to grow with the rest of a
// phone-sized page is a downgrade rather than a fix.
const locked = () => !window.matchMedia('(max-width: 700px)').matches;

// write-if-changed: --header-zoom resizes the header, which re-enters this through
// the ResizeObserver below. Values converge after one pass; skipping the no-op write
// stops the observer from being handed a second round of notifications.
function setVar(name, value) {
  if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
}

function apply() {
  const header = document.querySelector('header');
  setVar('--header-zoom', locked() ? String(+(1 / zoom()).toFixed(4)) : '1');
  // read back after the write, so the height reflects the zoom just applied
  if (header) setVar('--header-h', Math.round(header.getBoundingClientRect().height) + 'px');
}

export function initZoomLock() {
  apply();
  // a zoom step always resizes the viewport, so resize is the zoom event
  window.addEventListener('resize', apply);
  // the observer covers the rest: toolbar wrapping, the summary text filling in,
  // kiosk mode hiding the header entirely
  const header = document.querySelector('header');
  if (header && window.ResizeObserver) new ResizeObserver(apply).observe(header);
}
