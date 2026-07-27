import { state, esc } from './core.js';
import { t } from './i18n.js';
import { areaColor, areaName, boxFor, clampToBox } from './layout.js';
import { toggleRelay, showWarnPop } from './relay-actions.js';
import { openEditor } from './editor.js';
import { dragMove } from './board.js';
import { saveLayout } from './history-undo.js';

function card(r, mobile) {
  const el = document.createElement('div');
  // maintenance = bound automation currently disabled — needed up-front for the card border
  const maint = r.bound && r.automationId && state.autoStates[r.automationId] === false;
  el.className = [
    'relay bg-surface rounded-[14px] px-[14px] shadow-panel select-none flex items-center gap-3 box-border touch-none',
    maint ? 'border-2 border-heat' : 'border border-border',
    mobile ? 'static w-full h-auto min-h-[84px]'
           : 'absolute z-[3] w-[340px] h-[84px]' + (state.edit ? ' cursor-grab' : ''),
  ].join(' ');
  el.dataset.id = r.id;
  if (!mobile) { el.style.left = (r.x || 20) + 'px'; el.style.top = (r.y || 20) + 'px'; }
  if (r.area) { const hue = areaColor(r.area); el.style.borderLeft = `4px solid hsl(${hue},60%,50%)`; }

  const live = state.live[r.sensor] || {};
  const relLive = state.live[r.relay] || {};
  const temp = live.state != null && live.state !== '' && !isNaN(+live.state) ? (+live.state).toFixed(1) : '—';
  const sensLive = state.live[r.sensor] || {};
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
  // the on/off toggle is the coloured dot: emit exactly one bg + border per state
  const togBase = 'r-toggle p-0 cursor-pointer w-[34px] h-[34px] rounded-full border-2 disabled:cursor-default disabled:opacity-40 [.kiosk_&]:w-14 [.kiosk_&]:h-14';
  const togState = !r.relay ? 'bg-off border-border-strong'
    : on ? 'bg-on border-on shadow-[0_0_0_3px_rgba(21,128,61,.2)]'
    : 'bg-[var(--toggle-off)] border-border-strong';
  // temperature styling: colour the current reading by demand vs satisfied
  const curNum = temp !== '—' ? +temp : null;
  let curColor = 'text-fg';
  if (curNum != null && r.temp != null) {
    if (r.mode === 'above') curColor = curNum > r.temp ? 'text-cool' : 'text-ok';
    else curColor = curNum < r.temp ? 'text-heat' : 'text-ok';
    // Visual alert: pulse border when temp deviates beyond notify threshold
    const threshold = Number(r.notify_deviation) || 5;
    if (r.notify && Math.abs(curNum - r.temp) >= threshold) {
      el.classList.add('border-danger', 'animate-mode-pulse');
    }
  }
  const modeIcon = on
    ? (r.mode === 'above' ? '<i class="bi bi-arrow-down text-cool animate-mode-pulse"></i>' : '<i class="bi bi-arrow-up text-heat animate-mode-pulse"></i>')
    : '';
  const limitIcon = (r.min_on || r.min_off) ? '<i class="bi bi-shield-lock text-[.8rem] text-muted mx-[2px]" title="Cycle protection active"></i>' : '';

  el.innerHTML = `
    <button class="${togBase} ${togState}" title="${!r.relay ? t('no_relay') : relayBad ? t('relay_offline_short') : (on ? t('click_turn_off') : t('click_turn_on'))}"${r.relay && !relayBad ? '' : ' disabled'}></button>
    <div class="r-info flex-auto min-w-0">
      <div class="r-name font-bold text-[1.1rem] overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.name || 'Relay')}${r.bound ? '' : ' <span class="text-heat text-[.9rem]"><i class="bi bi-circle"></i></span>'}${(r.schedule && r.schedule.blocks && r.schedule.blocks.length) ? ' <i class="bi bi-clock text-cool text-base ml-1" title="scheduled"></i>' : ''}</div>
      <div class="r-relay text-[.82rem] text-muted overflow-hidden text-ellipsis whitespace-nowrap">${esc(r.relay || 'no relay')}${r.area ? ' · ' + esc(areaName(r.area)) : ''}</div>
    </div>
    ${warnIcon}${limitIcon}${maint ? '<span class="text-[.68rem] font-extrabold px-[7px] py-[2px] rounded-md whitespace-nowrap flex-none bg-[var(--maint-bg)] text-[var(--maint-fg)]"><i class="bi bi-pause-fill"></i> ' + t('maint_badge') + '</span>' : ''}
    <div class="r-metric text-right flex-none flex flex-col items-end gap-1">
      <div class="${curColor} text-[2rem] [.kiosk_&]:text-[2.4rem] font-extrabold leading-none tabular-nums">${temp}${temp === '—' ? '' : '<span class="text-[1.1rem] font-bold opacity-50 ml-px">°</span>'}</div>
      <div class="inline-flex items-center text-[.85rem] font-semibold text-fg bg-surface-2 border-[1.5px] border-border rounded-full px-2.5 py-0.5 tabular-nums whitespace-nowrap">${r.bound ? `<button class="adj-btn" data-rid="${r.id}" data-dir="-1" title="-0.5°"><i class="bi bi-dash"></i></button>` : ''}${modeIcon}${modeIcon ? '&nbsp;' : ''}${r.temp != null ? r.temp + '°' : '—'}${r.bound ? `<button class="adj-btn" data-rid="${r.id}" data-dir="1" title="+0.5°"><i class="bi bi-plus"></i></button>` : ''}${r.deadband ? `<span class="text-muted ml-1">±${r.deadband}</span>` : ''}</div>
    </div>`;

  // manual on/off toggle (works in both edit & live modes)
  const tog = el.querySelector('.r-toggle');
  tog.addEventListener('pointerdown', (e) => e.stopPropagation()); // don't start a drag
  tog.addEventListener('click', (e) => { e.stopPropagation(); toggleRelay(r); });

  const wi = el.querySelector('.warn-icon');
  if (wi) {
    wi.addEventListener('pointerdown', (e) => e.stopPropagation());
    wi.addEventListener('click', (e) => { e.stopPropagation(); showWarnPop(wi, wi.dataset.msg); });
  }

  if (mobile) {
    // list mode: tap the card (not the toggle) to edit; no dragging
    el.addEventListener('click', (e) => { if (!e.target.closest('.r-toggle')) openEditor(r); });
  } else if (state.edit) dragMove(el, el, (dx, dy, ox, oy) => {
    const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3; el._moved = el._moved || moved;
    r.x = Math.max(0, ox + dx); r.y = Math.max(0, oy + dy);
    const box = boxFor(r); if (box) clampToBox(r, box, el.offsetWidth, el.offsetHeight); // hard-linked: stay inside its area
    el.style.left = r.x + 'px'; el.style.top = r.y + 'px';
  }, () => (r.x || 20), () => (r.y || 20), () => { if (el._moved) { el._moved = false; saveLayout(); } else openEditor(r); });
  return el;
}

export { card };
