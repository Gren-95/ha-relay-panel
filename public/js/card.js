import { state, esc } from './core.js';
import { t, fmtAgo } from './i18n.js';
import { boxFor, clampToBox, num, zIndexOf } from './layout.js';
import { toggleRelay, showWarnPop, adjustTemp } from './relay-actions.js';
import { openLogin } from './auth.js';
import { openEditor } from './editor.js';
import { openChartModal } from './chart.js';
import { dragMove, raise } from './board.js';
import { saveLayout } from './history-undo.js';

function card(r, mobile) {
  const el = document.createElement('div');
  // maintenance = bound automation currently disabled — needed up-front for the card border
  const maint = r.bound && r.automationId && state.autoStates[r.automationId] === false;
  el.className = [
    'relay bg-surface rounded-[14px] px-[14px] shadow-panel select-none flex items-center gap-3 box-border touch-none',
    maint ? 'border-2 border-heat' : 'border border-border',
    mobile ? 'static w-full h-auto min-h-[84px]'
           : 'absolute w-[340px] h-[100px]' + (state.edit && !r.device ? ' cursor-grab' : ' cursor-pointer'),
  ].join(' ');
  el.dataset.id = r.id;
  if (!mobile) {
    el.style.left = num(r.x) + 'px'; el.style.top = num(r.y) + 'px';
    el.style.zIndex = zIndexOf(r);
    // capture phase: the toggle, warn icon and target-temp pill all stopPropagation
    // on pointerdown, and the card still has to come forward when they are hit
    el.addEventListener('pointerdown', () => raise(r, 'relay'), true);
  }
  const live = state.live[r.sensor] || {};
  const relLive = state.live[r.relay] || {};
  const temp = live.state != null && live.state !== '' && !isNaN(+live.state) ? (+live.state).toFixed(1) : '—';
  const sensLive = state.live[r.sensor] || {};
  // Last-seen timestamp
  let ago = '';
  if (r.sensor && live.last_changed) {
    ago = fmtAgo(Date.now() - Date.parse(live.last_changed));
  }
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
  // the on/off toggle is a rectangular state lamp: green = ON, grey = OFF,
  // red = cannot be switched (no relay bound, or the relay is offline/missing).
  // Signed-out visitors get the same colours, just dimmed by disabled:opacity-40 —
  // red stays at full strength so a dead relay never reads as "just logged out".
  const togDead = !r.relay || relayBad;
  // The toggle IS the card's left edge: a full-height bar where the thin area-colour
  // accent used to be, just thick enough to hit. -ml cancels the card's px-[14px] so
  // it sits flush against the border; rounded-l matches the card's 14px corner minus
  // its 1px border. flex-none + self-stretch: full height, never squeezed by a long name.
  // NO disabled:opacity-40 here (the dot used to have it): the bar is the board's
  // state readout and signed-out visitors are the common case in Live mode — dimming
  // it to 40% made ON vs OFF unreadable for them. Not-clickable shows in the cursor.
  const togBase = 'r-toggle p-0 border-0 cursor-pointer flex-none self-stretch w-[26px] -ml-[14px] rounded-l-[13px] disabled:cursor-default [.kiosk_&]:w-[38px]';
  // bg-off, not var(--toggle-off): that variable is defined nowhere, so the OFF state
  // used to compute to transparent
  const togState = togDead ? 'bg-danger' : maint ? 'bg-[#f59e0b]' : on ? 'bg-on' : 'bg-off';
  // temperature styling: colour the current reading by demand vs satisfied
  const curNum = temp !== '—' ? +temp : null;
  let curColor = 'text-fg';
  if (curNum != null && r.temp != null) {
    curColor = curNum < r.temp ? 'text-heat' : 'text-ok';
    // Visual alert: pulse border when temp deviates beyond notify threshold
    const threshold = Number(r.notify_deviation) || 5;
    if (r.notify && Math.abs(curNum - r.temp) >= threshold) {
      el.classList.add('border-danger', 'animate-mode-pulse');
    }
  }
  // Show heating arrow when relay is ON — disappears when target is reached
  const atTarget = curNum != null && r.temp != null && curNum >= r.temp;
  const modeIcon = (on && !atTarget)
    ? '<i class="bi bi-arrow-up text-heat animate-mode-pulse"></i>'
    : '';
  const limitIcon = (r.min_on || r.min_off) ? '<i class="bi bi-shield-lock text-[.8rem] text-muted mx-[2px]" title="Cycle protection active"></i>' : '';

  el.innerHTML = `
    <button class="${togBase} ${togState}" title="${!r.relay ? t('no_relay') : relayBad ? t('relay_offline_short') : (on ? t('click_turn_off') : t('click_turn_on'))}"${r.relay && !relayBad && state.authed ? '' : ' disabled'}></button>
    <div class="r-info flex-auto min-w-0">
      <div class="r-name font-bold text-[1rem] leading-[1.2]" style="overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(r.name || 'Relay')}${r.bound ? '' : ' <span class="text-heat text-[.9rem]"><i class="bi bi-circle"></i></span>'}${(r.schedule && r.schedule.blocks && r.schedule.blocks.length) ? ' <i class="bi bi-clock text-cool text-base ml-1" title="scheduled"></i>' : ''}</div>
      <div class="r-relay text-[.82rem] text-muted overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1.5">${(() => { const m = (r.relay || '').match(/_output_(\d+)$/); return m ? `Output ${m[1]}` : esc(r.relay || 'no relay'); })()}${maint ? '<span class="text-[.68rem] font-extrabold px-[5px] py-px rounded-md whitespace-nowrap flex-none bg-[var(--maint-bg)] text-[var(--maint-fg)]"><i class="bi bi-pause-fill"></i> ' + t('maint_badge') + '</span>' : ''}</div>
    </div>
    ${warnIcon}${limitIcon}
    <div class="r-metric text-right flex-none flex flex-col items-end gap-1">
      <div class="r-temp cursor-pointer ${curColor} text-[2rem] [.kiosk_&]:text-[2.4rem] font-extrabold leading-none tabular-nums">${temp}${temp === '—' ? '' : '<span class="text-[1.1rem] font-bold opacity-50 ml-px">°</span>'}</div>
      ${ago ? `<div class="text-[.68rem] text-muted leading-none -mt-[3px]">${ago}</div>` : ''}
      <div class="inline-flex items-center text-[.85rem] font-semibold text-fg border-[1.5px] border-border rounded-full px-2.5 py-0.5 tabular-nums whitespace-nowrap cursor-pointer hover:border-primary">${modeIcon}${modeIcon ? '&nbsp;' : ''}<span class="tgt-text">${r.temp != null ? r.temp + '°' : '—'}</span><input class="tgt-input hidden min-h-0 w-[52px] bg-transparent text-center text-inherit font-semibold text-[.85rem] border-0 outline-none p-0" type="number" step="0.5" value="${r.temp || 20}" />${r.deadband ? `<span class="text-muted ml-1">±${r.deadband}</span>` : ''}</div>
    </div>`;

  // manual on/off toggle (disabled in maintenance mode)
  const tog = el.querySelector('.r-toggle');
  if (maint) tog.disabled = true;
  tog.addEventListener('pointerdown', (e) => e.stopPropagation()); // don't start a drag
  tog.addEventListener('click', (e) => { e.stopPropagation(); if (!state.authed) { openLogin(); return; } if (maint) return; toggleRelay(r); });

  // Click temperature reading to open history chart
  const tempEl = el.querySelector('.r-temp');
  if (tempEl) {
    tempEl.addEventListener('click', (e) => { e.stopPropagation(); openChartModal(r); });
  }

  const wi = el.querySelector('.warn-icon');
  if (wi) {
    wi.addEventListener('pointerdown', (e) => e.stopPropagation());
    wi.addEventListener('click', (e) => { e.stopPropagation(); showWarnPop(wi, wi.dataset.msg); });
  }

  // Click target temp to edit inline.
  // Rules: Enter saves; Esc cancels; blur saves only if the value actually changed,
  // otherwise it just closes. While the input is open, state.tgtEditing holds off the
  // 10s live re-render — render() rebuilds every card, which would eat the edit.
  const tgtPill = el.querySelector('.tgt-text');
  const tgtInput = el.querySelector('.tgt-input');
  if (tgtPill && tgtInput) {
    const tgtWrap = tgtPill.parentNode;
    const shown = () => (r.temp != null ? r.temp : 20);
    let editing = false;
    let openVal = '';       // input value at the moment editing started
    const close = () => {
      editing = false;
      state.tgtEditing = false;
      tgtInput.classList.add('hidden');
      tgtPill.classList.remove('hidden');
    };
    tgtWrap.addEventListener('pointerdown', (e) => e.stopPropagation());
    tgtWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (editing) return;
      if (!state.authed) { openLogin(); return; }
      editing = true;
      state.tgtEditing = true;
      openVal = tgtInput.value;
      tgtPill.classList.add('hidden');
      tgtInput.classList.remove('hidden');
      tgtInput.focus();
      tgtInput.select();
    });
    const cancel = () => {
      if (!editing) return;
      tgtInput.value = openVal;
      close();
    };
    const commit = async () => {
      if (!editing) return;
      const v = parseFloat(tgtInput.value);
      close();
      if (!state.authed) { tgtInput.value = openVal; tgtPill.textContent = shown() + '°'; openLogin(); return; }
      if (!r.bound || !isFinite(v) || v < 1) { tgtInput.value = openVal; tgtPill.textContent = shown() + '°'; return; }
      const prev = r.temp;
      tgtPill.textContent = v + '°';
      tgtInput.value = v;
      if (!await adjustTemp(r.id, v)) {
        r.temp = prev;
        tgtPill.textContent = (prev != null ? prev : 20) + '°';
        tgtInput.value = prev != null ? prev : 20;
      }
    };
    // blur: unchanged → just close, changed → save
    tgtInput.addEventListener('blur', () => { if (tgtInput.value === openVal) cancel(); else commit(); });
    tgtInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commit(); }       // blur that follows is a no-op
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
  }

  // Card body click → open editor sidebar (except when clicking toggle / warn / target-temp)
  if (!mobile && (!state.edit || r.device)) {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.r-toggle') || e.target.closest('.warn-icon') || e.target.closest('.tgt-text') || e.target.closest('.tgt-input')) return;
      if (!state.authed) { openLogin(); return; }
      openEditor(r);
    });
  }

  if (mobile) {
    // list mode: tap the card (not the toggle) to edit; no dragging
    el.addEventListener('click', (e) => { if (!e.target.closest('.r-toggle')) { if (!state.authed) { openLogin(); return; } openEditor(r); } });
  } else if (state.edit && !r.device) dragMove(el, el, (dx, dy, ox, oy) => {
    const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3; el._moved = el._moved || moved;
    r.x = Math.max(0, ox + dx); r.y = Math.max(0, oy + dy);
    const box = boxFor(r); if (box) clampToBox(r, box);
    el.style.left = r.x + 'px'; el.style.top = r.y + 'px';
  }, () => num(r.x), () => num(r.y), () => { if (el._moved) { el._moved = false; saveLayout(); } else openEditor(r); });
  return el;
}

export { card };
