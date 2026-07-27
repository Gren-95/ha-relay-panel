/*
 * Single source of truth for the repeated Tailwind utility bundles that used to be
 * copy-pasted across index.html (the "button 21x / field 18x" drift risk from #32).
 *
 * Each bundle is defined ONCE here; markup opts in with `data-ui="btn btnTb"` etc.
 * This is a classic (non-module) script loaded right before <script type="module">, so
 * it runs after the DOM is parsed but before first paint — the classes are applied with
 * no flash and no visual change. Tailwind scans public/(star)(star)/(star).js, so the CSS
 * for these utilities is still generated from the strings below (no @apply, no component CSS).
 */
(function () {
  var btnCore = 'px-4 py-[11px] rounded-[11px] cursor-pointer text-base font-semibold min-h-[48px] leading-[1.1] active:translate-y-px';
  var UI = {
    // buttons
    btn: 'border border-border-strong bg-surface text-fg ' + btnCore,
    btnPrimary: 'border border-primary bg-primary text-white ' + btnCore,
    btnDanger: 'border border-danger bg-danger text-white ' + btnCore,
    btnTb: 'mobile:basis-[calc(50%_-_5px)] mobile:grow mobile:min-h-[54px]',
    btnMenu: 'w-full text-left mobile:text-center mobile:border-2 mobile:min-h-[54px] mobile:basis-[calc(50%_-_5px)] mobile:grow',
    tiny: 'self-start min-h-0 -mt-[3px] px-3 py-[7px] text-[.82rem] font-semibold rounded-lg bg-surface-2 text-muted border-[1.5px] border-border inline-flex items-center gap-[5px] cursor-pointer active:translate-y-px',
    closeBtn: 'bg-transparent border-0 text-muted text-[1.8rem] cursor-pointer leading-none',
    rangeBtn: 'min-h-[30px] px-2.5 py-1 text-[.78rem] rounded-[7px] font-semibold border-[1.5px] border-border bg-surface-2 text-muted cursor-pointer',
    // form fields + labels
    field: 'bg-input border-2 border-border text-fg rounded-[10px] p-3 text-[1.05rem] min-h-[50px] focus:outline-none focus:border-primary mobile:text-[1.1rem] mobile:min-h-[54px]',
    label: 'flex flex-col gap-[5px] text-[.95rem] font-semibold text-muted',
    // panels
    panelH2: 'm-0 text-[1.25rem] font-extrabold',
    editorAside: 'fixed top-0 right-0 w-[400px] h-full bg-surface border-l-2 border-border pt-[90px] px-[22px] pb-[22px] flex flex-col gap-3 z-20 overflow-y-auto shadow-[-4px_0_16px_rgba(20,18,15,.1)] mobile:w-full mobile:left-0 mobile:right-0 mobile:top-auto mobile:bottom-0 mobile:h-auto mobile:max-h-[85vh] mobile:border-l-0 mobile:border-t-2 mobile:rounded-t-2xl mobile:p-4',
  };

  // Expand each data-ui="tokenA tokenB" into the element's class list (existing
  // element-specific classes — hooks, hidden, one-off overrides — are preserved).
  function apply(root) {
    (root || document).querySelectorAll('[data-ui]').forEach(function (el) {
      var extra = el.dataset.ui.split(/\s+/).map(function (k) { return UI[k] || ''; }).join(' ').trim();
      if (extra) el.className = (extra + ' ' + el.className).trim();
    });
  }

  window.UI = UI;
  window.applyUiClasses = apply;
  apply(document);
})();
