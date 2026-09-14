import { $, state, api, esc, setRangeActive } from './core.js';
import { t } from './i18n.js';
import { registerModal } from './modals.js';

/*
 * Temperature history page: every temperature sensor over ONE shared time window,
 * as small multiples. All sensors, one HA area, or one sensor; 24h / 7d / 30d or a
 * date range.
 *
 * - One request (/api/history/multi) fetches every visible sensor plus the relays
 *   bound to them, so a sensor that drives a relay also shows when that relay was
 *   ON and its target - the same bands and dashed line as the relay's own chart.
 * - The grid picks its column count so the whole set fits on screen when it can;
 *   past that the cards stop shrinking at a readable size and the page scrolls.
 * - The charts share the x axis, so hovering one draws a hairline at the same
 *   moment on all of them.
 */

const PAD = { l: 34, r: 8, t: 6, b: 16 };        // plot inset inside each chart, px
const MIN_W = 220;                                  // card width floor
const NARROW_W = 290;                               // below this a card drops its min-max
const minH = () => (window.innerWidth <= 700 ? 150 : 110);
const DEVICE_TEMP = /_device_temperature$/;        // a device's own chip temperature, not the room
const PREF_KEY = 'rp-history-view';
const LINE = '#f59e0b';
// every HA temperature entity is called "<device> Temperature"; the suffix only costs room
const shortName = (n) => String(n).replace(/\s+temperature$/i, '') || n;

const hp = {
  view: 'all', hours: 24, start: '', end: '', sameScale: false, deviceTemps: false,
  areas: null,      // {entity_id: area_id|null}, fetched on first open
  data: null,       // last /api/history/multi answer
  charts: [],       // per card: {id, name, area, pts, bands, targets, lo, hi, svg, geom}
  req: 0,           // drops answers that arrive after a newer request
};

// ---- prefs (per viewer, best effort) ----
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    for (const k of ['view', 'hours', 'start', 'end', 'sameScale', 'deviceTemps']) if (p[k] != null) hp[k] = p[k];
  } catch {}
}
function savePrefs() {
  const { view, hours, start, end, sameScale, deviceTemps } = hp;
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ view, hours, start, end, sameScale, deviceTemps })); } catch {}
}

// ---- which sensors ----
const areaOf = (id) => (hp.areas && hp.areas[id]) || null;
function areaName(a) {
  if (!a) return t('hp_no_area');
  return ((state.haAreas || []).find((x) => x.id === a) || {}).name || a;
}
// named areas alphabetically, "no area" last
const areaCmp = (a, b) => (!a) - (!b) || areaName(a).localeCompare(areaName(b));
const sensorCmp = (a, b) => areaCmp(areaOf(a.entity_id), areaOf(b.entity_id)) || a.name.localeCompare(b.name);

function listedSensors() {
  return (state.entities.sensors || []).filter((s) => hp.deviceTemps || !DEVICE_TEMP.test(s.entity_id)).sort(sensorCmp);
}
function visibleSensors() {
  if (hp.view.startsWith('sensor:')) {
    // an explicit pick shows even a device temperature the list is hiding
    return (state.entities.sensors || []).filter((s) => s.entity_id === hp.view.slice(7));
  }
  const list = listedSensors();
  if (hp.view.startsWith('area:')) { const a = hp.view.slice(5) || null; return list.filter((s) => areaOf(s.entity_id) === a); }
  return list;
}
const relaysFor = (sensorId) => (state.layout.relays || []).filter((r) => r.sensor === sensorId && r.relay);

function fillViewSelect() {
  const sel = $('#hp-view');
  const list = listedSensors();
  const counts = new Map();
  for (const s of list) { const a = areaOf(s.entity_id); counts.set(a, (counts.get(a) || 0) + 1); }
  const areas = [...counts.keys()].sort(areaCmp);
  sel.innerHTML =
    `<option value="all">${esc(t('hp_all'))} (${list.length})</option>` +
    `<optgroup label="${esc(t('hp_areas'))}">` +
    areas.map((a) => `<option value="area:${esc(a || '')}">${esc(areaName(a))} (${counts.get(a)})</option>`).join('') +
    `</optgroup><optgroup label="${esc(t('hp_sensors'))}">` +
    list.map((s) => `<option value="sensor:${esc(s.entity_id)}">${esc(shortName(s.name))}</option>`).join('') +
    '</optgroup>';
  if (hp.view.startsWith('sensor:') && ![...sel.options].some((o) => o.value === hp.view)) {
    const s = (state.entities.sensors || []).find((x) => x.entity_id === hp.view.slice(7));
    if (s) sel.insertAdjacentHTML('beforeend', `<option value="${esc(hp.view)}">${esc(shortName(s.name))}</option>`);
  }
  if (![...sel.options].some((o) => o.value === hp.view)) hp.view = 'all';   // stale pref
  sel.value = hp.view;
}

function syncControls() {
  document.querySelectorAll('#hp-ranges [data-hours]').forEach((b) => setRangeActive(b, String(hp.hours) === b.dataset.hours));
  $('#hp-custom').classList.toggle('hidden', hp.hours !== 'custom');
  $('#hp-start').value = hp.start || '';
  $('#hp-end').value = hp.end || '';
  $('#hp-same-scale').checked = !!hp.sameScale;
  $('#hp-device-temps').checked = !!hp.deviceTemps;
}
const setStatus = (m) => { $('#hp-status').textContent = m || ''; };

// ---- data ----
async function load() {
  const sensors = visibleSensors();
  const my = ++hp.req;
  hp.data = null;
  if (!sensors.length) { setStatus(t('hp_no_sensors')); build(sensors); return; }
  const ids = new Set(sensors.map((s) => s.entity_id));
  for (const s of sensors) for (const r of relaysFor(s.entity_id)) ids.add(r.relay);
  const q = new URLSearchParams({ ids: [...ids].join(',') });
  if (hp.hours === 'custom') {
    if (!hp.start || !hp.end) { setStatus(t('hp_pick_dates')); build(sensors); return; }
    const end = Math.min(new Date(hp.end + 'T23:59:59').getTime(), Date.now());
    q.set('start', new Date(hp.start + 'T00:00:00').toISOString());
    q.set('end', new Date(end).toISOString());
  } else q.set('hours', String(hp.hours));
  setStatus(t('loading'));
  try {
    const d = await api('/api/history/multi?' + q.toString());
    if (my !== hp.req) return;
    hp.data = d; setStatus('');
  } catch (e) {
    if (my !== hp.req) return;
    setStatus(e.status === 400 && e.message ? e.message : t('history_unavailable'));
  }
  build(sensors);
}

// relay ON intervals for one sensor, merged across every relay it drives
function onBands(relays, T0, T1) {
  const iv = [];
  for (const r of relays) {
    const pts = (hp.data.series[r.relay] || []);
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].s !== 'on') continue;
      const a = Math.max(pts[i].t, T0), b = Math.min(i + 1 < pts.length ? pts[i + 1].t : T1, T1);
      if (b > a) iv.push([a, b]);
    }
  }
  iv.sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const b of iv) { const last = out[out.length - 1]; if (last && b[0] <= last[1]) last[1] = Math.max(last[1], b[1]); else out.push(b); }
  return out;
}

// ---- cards ----
function build(sensors) {
  const g = $('#hp-grid');
  const single = sensors.length === 1;
  const T0 = hp.data ? hp.data.start : 0, T1 = hp.data ? Math.min(hp.data.end, Date.now()) : 1;
  hp.charts = sensors.map((s) => {
    const pts = hp.data ? (hp.data.series[s.entity_id] || []) : [];
    const relays = relaysFor(s.entity_id);
    const targets = [...new Set(relays.filter((r) => r.bound && r.temp != null && isFinite(+r.temp)).map((r) => +r.temp))];
    // the y range follows the readings; a target outside them is marked at the edge
    // instead, or a 17° set point under a 24° room squeezes the curve into a line
    const vals = pts.length ? pts.map((p) => p.v) : targets;
    return {
      id: s.entity_id, name: shortName(s.name), area: areaOf(s.entity_id), pts, targets, T0, T1,
      bands: hp.data ? onBands(relays, T0, T1) : [],
      lo: vals.length ? Math.min(...vals) : null, hi: vals.length ? Math.max(...vals) : null,
    };
  });
  if (hp.sameScale) {
    const all = hp.charts.filter((c) => c.lo != null);
    const lo = Math.min(...all.map((c) => c.lo)), hi = Math.max(...all.map((c) => c.hi));
    for (const c of all) { c.lo = lo; c.hi = hi; }
  }
  g.innerHTML = hp.charts.map((c, i) => {
    const last = c.pts.length ? c.pts[c.pts.length - 1].v : null;
    const readings = c.pts.map((p) => p.v);
    const stats = last == null ? '' :
      `<b class="text-fg">${last.toFixed(1)}°</b> <span class="text-muted [.hp-narrow_&]:hidden">${Math.min(...readings).toFixed(1)}–${Math.max(...readings).toFixed(1)}°</span>`;
    const area = hp.view.startsWith('area:') ? '' : `<span class="min-w-0 shrink-[3] truncate text-muted text-[.7rem] font-semibold">${esc(areaName(c.area))}</span>`;
    return `<div class="bg-surface border border-border rounded-xl px-2.5 pt-1.5 pb-1 flex flex-col min-w-0 min-h-0">
      <div class="flex items-baseline gap-2 text-[.78rem] leading-tight min-w-0">
        <button type="button" data-open="${esc(c.id)}" class="min-w-0 truncate p-0 bg-transparent border-0 font-sans text-fg text-[.82rem] font-semibold text-left ${single ? 'cursor-default' : 'cursor-pointer hover:underline'}" title="${esc(c.id)}">${esc(c.name)}</button>
        ${area}
        <span class="ml-auto shrink-0 tabular-nums whitespace-nowrap">${stats}</span>
      </div>
      <svg class="hp-svg flex-1 min-h-0 w-full block touch-pan-y" data-i="${i}"></svg>
    </div>`;
  }).join('');
  hp.charts.forEach((c, i) => { c.svg = g.querySelector(`svg[data-i="${i}"]`); });
  layoutGrid(hp.charts.length);
  drawAll();
}

// Column count that gives the biggest plots while fitting the whole set on screen;
// when even the densest grid doesn't fit, cards hold at minH() and the grid scrolls.
function layoutGrid(n) {
  const g = $('#hp-grid'), cs = getComputedStyle(g);
  const W = g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const H = g.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const GAP = parseFloat(cs.rowGap) || 0;   // gap-2.5 is rem, and the root font is 19px
  let best = null;
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const w = (W - GAP * (cols - 1)) / cols;
    if (cols > 1 && w < MIN_W) break;
    const rows = Math.ceil(n / cols);
    const h = (H - GAP * (rows - 1)) / rows;
    const score = Math.min(w / 2.2, h);          // a plot reads best around 2.2:1
    if (!best || score > best.score) best = { cols, w, h, score };
  }
  const h = Math.max(minH(), Math.min(best.h, best.w * 0.75));   // never taller than 4:3
  g.style.gridTemplateColumns = `repeat(${best.cols}, minmax(0, 1fr))`;
  g.style.gridAutoRows = `${Math.floor(h)}px`;
  g.classList.toggle('hp-narrow', best.w < NARROW_W);
}

// ---- drawing ----
function niceStep(range, maxTicks) {
  const raw = range / Math.max(1, maxTicks), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
}
const H_MS = 3600000, D_MS = 86400000;
const TIME_STEPS = [1, 2, 3, 6, 12, 24, 48, 72, 168].map((h) => h * H_MS);
// tick times on local-clock boundaries (whole hours / midnights), at most `max` of them
function timeTicks(T0, T1, max) {
  const step = TIME_STEPS.find((s) => (T1 - T0) / s <= max) || TIME_STEPS[TIME_STEPS.length - 1];
  const d = new Date(T0);
  if (step < D_MS) {
    const sh = step / H_MS; d.setMinutes(0, 0, 0);
    while (d.getTime() < T0 || d.getHours() % sh) d.setHours(d.getHours() + 1);
  } else { d.setHours(0, 0, 0, 0); if (d.getTime() < T0) d.setDate(d.getDate() + 1); }
  const out = [];
  while (d.getTime() <= T1 && out.length < 50) {
    out.push(d.getTime());
    if (step < D_MS) d.setHours(d.getHours() + step / H_MS); else d.setDate(d.getDate() + step / D_MS);
  }
  return out;
}
const pad2 = (n) => String(n).padStart(2, '0');
// the date at midnight, so the day boundary shows; the time everywhere else
function tickLabel(tm) {
  const d = new Date(tm);
  if (d.getHours() === 0 && d.getMinutes() === 0) return `${d.getDate()}.${d.getMonth() + 1}`;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function draw(c) {
  const svg = c.svg; if (!svg) return;
  const W = svg.clientWidth, H = svg.clientHeight;
  if (!W || !H) return;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b;
  const { T0, T1 } = c;
  const x = (tm) => PAD.l + ((tm - T0) / (T1 - T0 || 1)) * cw;
  let lo = c.lo, hi = c.hi;
  if (lo == null) { lo = 0; hi = 1; }
  if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.5; hi = m + 0.5; }
  const m = (hi - lo) * 0.06; lo -= m; hi += m;
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * ch;
  let out = '';

  for (const [a, b] of c.bands) {
    out += `<rect x="${x(a).toFixed(1)}" y="${PAD.t}" width="${Math.max(1, x(b) - x(a)).toFixed(1)}" height="${ch}" fill="rgba(34,197,94,.14)"/>`;
  }
  const ys = niceStep(hi - lo, Math.min(8, Math.max(2, Math.floor(ch / 20))));
  const dec = ys < 1 ? 1 : 0;
  for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) {
    const yy = y(v).toFixed(1);
    out += `<line x1="${PAD.l}" y1="${yy}" x2="${W - PAD.r}" y2="${yy}" stroke="var(--border)" stroke-width="1"/>`;
    out += `<text x="${PAD.l - 4}" y="${(+yy + 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="var(--muted)">${v.toFixed(dec)}°</text>`;
  }
  if (hp.data) {
    for (const tm of timeTicks(T0, T1, Math.max(2, Math.floor(cw / 62)))) {
      const xx = x(tm).toFixed(1);
      out += `<line x1="${xx}" y1="${PAD.t}" x2="${xx}" y2="${H - PAD.b}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 3"/>`;
      out += `<text x="${xx}" y="${H - 4}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${tickLabel(tm)}</text>`;
    }
  }
  for (const tg of c.targets) {
    if (tg >= lo && tg <= hi) {
      const ty = y(tg).toFixed(1);
      out += `<line x1="${PAD.l}" y1="${ty}" x2="${W - PAD.r}" y2="${ty}" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 4"/>`;
      out += `<text x="${W - PAD.r}" y="${(+ty - 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="var(--ok)">${tg}°</text>`;
    } else {
      const below = tg < lo;
      out += `<text x="${W - PAD.r}" y="${below ? H - PAD.b - 3 : PAD.t + 9}" text-anchor="end" font-size="9.5" font-weight="600" fill="var(--ok)">${below ? '▼' : '▲'} ${tg}°</text>`;
    }
  }
  if (c.pts.length) {
    // readings are changes only, so the last one holds until the end of the window
    const pts = c.pts.filter((p) => p.t <= T1);
    let d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(Math.max(p.t, T0)).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    if (pts.length) d += ` L${x(T1).toFixed(1)} ${y(pts[pts.length - 1].v).toFixed(1)}`;
    out += `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"/>`;
  } else if (hp.data) {
    out += `<text x="${PAD.l + cw / 2}" y="${PAD.t + ch / 2}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(t('hp_no_data'))}</text>`;
  }
  out += `<line class="hp-hair" x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" stroke="var(--muted)" stroke-width="1" display="none"/>`;
  out += `<circle class="hp-dot" r="3.5" fill="${LINE}" stroke="var(--surface)" stroke-width="1.5" display="none"/>`;
  svg.innerHTML = out;
  c.geom = { x, y, cw };
}
function drawAll() { for (const c of hp.charts) draw(c); }

// ---- hover: hairline on every chart, tooltip on the one under the pointer ----
// value on the drawn line at time tm (linear between readings, flat after the last)
function valueAt(pts, tm) {
  if (!pts.length || tm < pts[0].t) return null;
  let i = 0, j = pts.length - 1;
  while (i < j) { const k = (i + j + 1) >> 1; if (pts[k].t <= tm) i = k; else j = k - 1; }
  const a = pts[i], b = pts[i + 1];
  return b ? a.v + (b.v - a.v) * ((tm - a.t) / (b.t - a.t || 1)) : a.v;
}
function hideHover() {
  $('#hp-tip').classList.add('hidden');
  for (const c of hp.charts) {
    if (!c.svg) continue;
    c.svg.querySelector('.hp-hair')?.setAttribute('display', 'none');
    c.svg.querySelector('.hp-dot')?.setAttribute('display', 'none');
  }
}
function onPointer(e) {
  const svg = e.target.closest && e.target.closest('svg.hp-svg');
  const c = svg && hp.charts[+svg.dataset.i];
  if (!c || !c.geom || !hp.data) return hideHover();
  const rect = svg.getBoundingClientRect();
  const tm = c.T0 + ((e.clientX - rect.left - PAD.l) / c.geom.cw) * (c.T1 - c.T0);
  if (tm < c.T0 || tm > c.T1) return hideHover();
  for (const k of hp.charts) {
    if (!k.geom) continue;
    const hair = k.svg.querySelector('.hp-hair'), dot = k.svg.querySelector('.hp-dot');
    const xx = k.geom.x(tm).toFixed(1), v = valueAt(k.pts, tm);
    hair.setAttribute('x1', xx); hair.setAttribute('x2', xx); hair.removeAttribute('display');
    if (v == null) dot.setAttribute('display', 'none');
    else { dot.setAttribute('cx', xx); dot.setAttribute('cy', k.geom.y(v).toFixed(1)); dot.removeAttribute('display'); }
  }
  const v = valueAt(c.pts, tm);
  const on = c.bands.some(([a, b]) => tm >= a && tm <= b);
  const hasRelay = relaysFor(c.id).length > 0;
  const when = new Date(tm).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tip = $('#hp-tip');
  tip.innerHTML = `<b>${esc(c.name)}</b><br>${when}<br>${v == null ? '—' : v.toFixed(1) + ' °C'}` +
    (hasRelay ? ` · ${on ? t('hp_relay_on') : t('hp_relay_off')}` : '');
  tip.classList.remove('hidden');
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.min(e.clientX + 14, window.innerWidth - tw - 8) + 'px';
  tip.style.top = Math.max(8, e.clientY - th - 10) + 'px';
}

// ---- open / close ----
async function openHistoryPage() {
  loadPrefs();
  $('#history-page').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  syncControls();
  if (!hp.areas) {
    setStatus(t('loading'));
    try { hp.areas = await api('/api/sensor-areas'); } catch { hp.areas = {}; }
  }
  fillViewSelect();
  load();
}
function closeHistoryPage() {
  $('#history-page').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  hideHover();
  hp.req++;           // drop anything still in flight
}

export function initHistoryPage() {
  $('#btn-history').addEventListener('click', () => {
    $('#toolbar').classList.remove('!flex');   // the phone menu stays shut behind the page
    openHistoryPage();
  });
  $('#hp-close').addEventListener('click', closeHistoryPage);
  registerModal('history-page', closeHistoryPage);
  $('#hp-reload').addEventListener('click', load);
  $('#hp-view').addEventListener('change', (e) => { hp.view = e.target.value; savePrefs(); load(); });
  document.querySelectorAll('#hp-ranges [data-hours]').forEach((b) => b.addEventListener('click', () => {
    const h = b.dataset.hours;
    hp.hours = h === 'custom' ? 'custom' : Number(h);
    if (h === 'custom' && !hp.start) {      // seed the pickers with the last week
      const d = new Date(), iso = (x) => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
      hp.end = iso(d); d.setDate(d.getDate() - 6); hp.start = iso(d);
    }
    syncControls(); savePrefs();
    if (h !== 'custom') load(); else if (hp.start && hp.end) load();
  }));
  $('#hp-apply').addEventListener('click', () => {
    hp.start = $('#hp-start').value; hp.end = $('#hp-end').value;
    if (hp.start && hp.end && hp.start > hp.end) [hp.start, hp.end] = [hp.end, hp.start];
    syncControls(); savePrefs(); load();
  });
  $('#hp-same-scale').addEventListener('change', (e) => { hp.sameScale = e.target.checked; savePrefs(); build(visibleSensors()); });
  $('#hp-device-temps').addEventListener('change', (e) => { hp.deviceTemps = e.target.checked; savePrefs(); fillViewSelect(); load(); });
  const g = $('#hp-grid');
  g.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b || hp.charts.length === 1) return;
    hp.view = 'sensor:' + b.dataset.open; savePrefs(); fillViewSelect(); load();
  });
  g.addEventListener('pointermove', onPointer);
  g.addEventListener('pointerleave', hideHover);
  let raf = 0;
  new ResizeObserver(() => {
    if ($('#history-page').classList.contains('hidden')) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { layoutGrid(hp.charts.length); drawAll(); });
  }).observe(g);
}
