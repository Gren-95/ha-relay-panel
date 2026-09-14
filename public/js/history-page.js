import { $, state, api, esc, setRangeActive } from './core.js';
import { t } from './i18n.js';
import { registerModal } from './modals.js';
import { comboBase, sensorMapUrl } from './chart.js';

/*
 * Temperature history page: every temperature sensor over ONE shared time window,
 * as small multiples. All sensors, one HA area, or one sensor; 24h / 7d / 30d or a
 * date range.
 *
 * - One request (/api/history/multi) fetches every visible sensor plus the relays
 *   bound to them, and those relays' set point + pause history (rebuilt from the
 *   audit log). A sensor that drives a relay gets a strip under its plot showing
 *   when the relay ran, sat paused or was offline, the set point as the steps it
 *   actually took, and blue wherever the room was below the set point in force
 *   then - with the total ON time and time below in the card header.
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
  relays: 'all',    // 'all' | 'bound' (drives a relay on the panel) | 'unbound'
  areas: null,      // {entity_id: area_id|null}, fetched on first open
  data: null,       // last /api/history/multi answer
  charts: [],       // per card: {id, name, area, pts, bands, targets, lo, hi, svg, geom}
  req: 0,           // drops answers that arrive after a newer request
};

// ---- prefs (per viewer, best effort) ----
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    for (const k of ['view', 'hours', 'start', 'end', 'sameScale', 'deviceTemps', 'relays']) if (p[k] != null) hp[k] = p[k];
  } catch {}
}
function savePrefs() {
  const { view, hours, start, end, sameScale, deviceTemps, relays } = hp;
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ view, hours, start, end, sameScale, deviceTemps, relays })); } catch {}
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

// every sensor the lists offer: device temperatures only when asked for
function allListed() {
  return (state.entities.sensors || []).filter((s) => hp.deviceTemps || !DEVICE_TEMP.test(s.entity_id)).sort(sensorCmp);
}
// ...narrowed by the relay filter: sensors a panel relay is bound to, or the rest
function listedSensors() {
  if (hp.relays === 'all') return allListed();
  const bound = hp.relays === 'bound';
  return allListed().filter((s) => (relaysFor(s.entity_id).length > 0) === bound);
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
  // areas come from the unfiltered list, so flipping the relay filter can't pull
  // the area being looked at out from under the view - it just shows (0)
  const areas = [...new Set(allListed().map((s) => areaOf(s.entity_id)))].sort(areaCmp);
  sel.innerHTML =
    `<option value="all">${esc(t('hp_all'))} (${list.length})</option>` +
    `<optgroup label="${esc(t('hp_areas'))}">` +
    areas.map((a) => `<option value="area:${esc(a || '')}">${esc(areaName(a))} (${counts.get(a) || 0})</option>`).join('') +
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
  document.querySelectorAll('#hp-relay-filter [data-rf]').forEach((b) => setRangeActive(b, hp.relays === b.dataset.rf));
}
const setStatus = (m) => { $('#hp-status').textContent = m || ''; };

// ---- data ----
async function load() {
  const sensors = visibleSensors();
  const my = ++hp.req;
  hp.data = null;
  if (!sensors.length) { setStatus(t('hp_no_sensors')); build(sensors); return; }
  const ids = new Set(sensors.map((s) => s.entity_id)), rids = new Set();
  for (const s of sensors) for (const r of relaysFor(s.entity_id)) { ids.add(r.relay); rids.add(r.id); }
  const q = new URLSearchParams({ ids: [...ids].join(',') });
  if (rids.size) q.set('rids', [...rids].join(','));
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

// ---- time spans ----
// [a, b] spans of a recorded state series ([{t, s}] or steps [{t, v}]) where
// `test` holds, clipped to the window. Each entry holds until the next one.
function spans(pts, T0, T1, test) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (!test(pts[i])) continue;
    const a = Math.max(pts[i].t, T0), b = Math.min(i + 1 < pts.length ? pts[i + 1].t : T1, T1);
    if (b > a) out.push([a, b]);
  }
  return out;
}
function mergeSpans(iv) {
  const out = [];
  for (const b of [...iv].sort((p, q) => p[0] - q[0])) {
    const last = out[out.length - 1];
    if (last && b[0] <= last[1]) last[1] = Math.max(last[1], b[1]); else out.push([...b]);
  }
  return out;
}
const spanMs = (iv) => iv.reduce((n, [a, b]) => n + (b - a), 0);
// the entry in force at tm (last one at or before it)
function entryAt(pts, tm) {
  let i = 0, j = pts.length - 1;
  if (j < 0 || pts[0].t > tm) return null;
  while (i < j) { const k = (i + j + 1) >> 1; if (pts[k].t <= tm) i = k; else j = k - 1; }
  return pts[i];
}
// The set point this sensor is held to: the highest among the heating relays it
// drives (every relay on the panel today heats, one per sensor - this only
// matters if that ever changes). Steps [{t, v}], v null where none is set.
function combineTargets(timelines) {
  if (!timelines.length) return [];
  if (timelines.length === 1) return timelines[0];
  const times = [...new Set(timelines.flatMap((tl) => tl.map((p) => p.t)))].sort((a, b) => a - b);
  const out = [];
  for (const tm of times) {
    const vals = timelines.map((tl) => (entryAt(tl, tm) || {}).v).filter((v) => v != null);
    const v = vals.length ? Math.max(...vals) : null;
    if (!out.length || out[out.length - 1].v !== v) out.push({ t: tm, v });
  }
  return out;
}
// Time the drawn line spent under the set point: linear between readings, flat
// after the last, split wherever the set point changed.
function belowMs(pts, target, T0, T1) {
  if (!pts.length || !target.length) return 0;
  const cuts = [...new Set([...pts.map((p) => p.t), ...target.map((p) => p.t), T1]
    .filter((tm) => tm >= Math.max(T0, pts[0].t) && tm <= T1))].sort((a, b) => a - b);
  let ms = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1];
    const tg = (entryAt(target, a) || {}).v;
    const va = valueAt(pts, a), vb = valueAt(pts, b);
    if (tg == null || va == null || vb == null) continue;
    const da = tg - va, db = tg - vb;              // > 0 means below
    if (da > 0 && db > 0) ms += b - a;
    else if (da > 0 || db > 0) ms += (b - a) * Math.max(da, db) / (Math.abs(da) + Math.abs(db));
  }
  return ms;
}
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return h < 10 && m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// ---- cards ----
function build(sensors) {
  const g = $('#hp-grid');
  const single = sensors.length === 1;
  const d = hp.data;
  const T0 = d ? d.start : 0, T1 = d ? Math.min(d.end, Date.now()) : 1;
  hp.charts = sensors.map((s, idx) => {
    const pts = d ? (d.series[s.entity_id] || []) : [];
    // one lane per relay this sensor drives: when it ran, sat paused, or was offline
    const lanes = relaysFor(s.entity_id).map((r) => {
      const st = d ? (d.series[r.relay] || []) : [];
      const tl = d && d.relays && d.relays[r.id];
      const fallback = r.bound && isFinite(+r.temp) ? +r.temp : null;
      return {
        name: r.name || r.relay, heat: r.mode !== 'above', states: st,
        on: spans(st, T0, T1, (p) => p.s === 'on'),
        offline: spans(st, T0, T1, (p) => p.s === 'unavailable' || p.s === 'unknown'),
        paused: tl ? spans(tl.paused, T0, T1, (p) => p.v) : [],
        pausedSteps: tl ? tl.paused : [],
        target: tl ? tl.target : [{ t: T0, v: fallback }],
      };
    });
    const target = combineTargets(lanes.filter((l) => l.heat).map((l) => l.target));
    const below = belowMs(pts, target, T0, T1);
    const setVals = target.map((p) => p.v).filter((v) => v != null);
    // The y range follows the readings, and takes in a set point only within
    // SET_NEAR of them. Stretching to every set point would let a 17° one under a
    // 24° room, or a 3-minute excursion to 30°, flatten a week of curve; one off
    // the scale runs off the edge instead, and so does the blue below it.
    const rv = pts.map((p) => p.v), rlo = Math.min(...rv), rhi = Math.max(...rv);
    const vals = pts.length ? rv.concat(setVals.filter((v) => v >= rlo - SET_NEAR && v <= rhi + SET_NEAR)) : setVals;
    return {
      idx, id: s.entity_id, name: shortName(s.name), area: areaOf(s.entity_id), pts, T0, T1,
      lanes, target, below, onMs: spanMs(mergeSpans(lanes.flatMap((l) => l.on))),
      bands: mergeSpans(lanes.flatMap((l) => l.on)),
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
    const badges = (c.onMs > 0 ? `<span class="text-ok font-semibold" title="${esc(t('hp_on_time'))}"><i class="bi bi-power"></i>${fmtDur(c.onMs)}</span>` : '') +
      (c.below > 0 ? `<span class="text-cool font-semibold" title="${esc(t('hp_below_time'))}"><i class="bi bi-thermometer-snow"></i>${fmtDur(c.below)}</span>` : '');
    const area = hp.view.startsWith('area:') ? '' : `<span class="min-w-0 shrink-[3] truncate text-muted text-[.7rem] font-semibold">${esc(areaName(c.area))}</span>`;
    // the facility map, as on the relay's own chart: combo sensors only, and only
    // when the deployment configured a map URL
    const mapUrl = sensorMapUrl(comboBase(c.id));
    const map = mapUrl ? `<button type="button" data-map="${esc(mapUrl)}" class="shrink-0 self-center inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-transparent border border-border text-muted font-sans text-[.72rem] font-semibold cursor-pointer hover:text-fg hover:border-border-strong" title="${esc(t('show_on_map'))}"><i class="bi bi-map"></i>${single ? ` ${esc(t('map_word'))}` : ''}</button>` : '';
    return `<div class="bg-surface border border-border rounded-xl px-2.5 pt-1.5 pb-1 flex flex-col min-w-0 min-h-0">
      <div class="flex items-baseline gap-2 text-[.78rem] leading-tight min-w-0">
        <button type="button" data-open="${esc(c.id)}" class="min-w-0 shrink-0 max-w-[60%] truncate p-0 bg-transparent border-0 font-sans text-fg text-[.82rem] font-semibold text-left ${single ? 'cursor-default' : 'cursor-pointer hover:underline'}" title="${esc(c.id)}">${esc(c.name)}</button>
        ${area}
        <span class="ml-auto shrink-0 inline-flex items-baseline gap-2 tabular-nums whitespace-nowrap">${badges}<span>${stats}</span></span>
        ${map}
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

const LANE_GAP = 2;               // between relay strips
const laneH = (H) => (H > 300 ? 8 : 5);   // relay strip height, per relay
const SET_NEAR = 3;               // °C: how far from the readings a set point may widen the axis

function draw(c) {
  const svg = c.svg; if (!svg) return;
  const W = svg.clientWidth, H = svg.clientHeight;
  if (!W || !H) return;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const LANE_H = laneH(H);
  const lanesH = hp.data && c.lanes.length ? c.lanes.length * (LANE_H + LANE_GAP) + 3 : 0;
  const plotB = H - PAD.b - lanesH;                 // bottom of the temperature plot
  const cw = W - PAD.l - PAD.r, ch = plotB - PAD.t;
  const { T0, T1 } = c;
  const x = (tm) => PAD.l + ((tm - T0) / (T1 - T0 || 1)) * cw;
  let lo = c.lo, hi = c.hi;
  if (lo == null) { lo = 0; hi = 1; }
  if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.5; hi = m + 0.5; }
  const m = (hi - lo) * 0.06; lo -= m; hi += m;
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * ch;
  const f = (n) => n.toFixed(1);
  const clipId = `hp-below-${c.idx}`, hatchId = `hp-hatch-${c.idx}`, plotId = `hp-plot-${c.idx}`;
  let out = '';

  // relay-ON wash across the plot, so a run lines up with what the room did
  for (const [a, b] of c.bands) {
    out += `<rect x="${f(x(a))}" y="${PAD.t}" width="${f(Math.max(1, x(b) - x(a)))}" height="${f(ch)}" fill="var(--on)" fill-opacity=".09"/>`;
  }
  const ys = niceStep(hi - lo, Math.min(8, Math.max(2, Math.floor(ch / 20))));
  const dec = ys < 1 ? 1 : 0;
  for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) {
    const yy = y(v);
    out += `<line x1="${PAD.l}" y1="${f(yy)}" x2="${W - PAD.r}" y2="${f(yy)}" stroke="var(--border)" stroke-width="1"/>`;
    out += `<text x="${PAD.l - 4}" y="${f(yy + 3)}" text-anchor="end" font-size="9.5" fill="var(--muted)">${v.toFixed(dec)}°</text>`;
  }
  if (hp.data) {
    for (const tm of timeTicks(T0, T1, Math.max(3, Math.floor(cw / 62)))) {
      const xx = f(x(tm));
      out += `<line x1="${xx}" y1="${PAD.t}" x2="${xx}" y2="${f(plotB)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 3"/>`;
      out += `<text x="${xx}" y="${H - 4}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${tickLabel(tm)}</text>`;
    }
  }

  // the set point, as the steps it actually took
  const steps = c.target.filter((p) => p.t <= T1);
  let setPath = '', clipRects = '';
  steps.forEach((p, i) => {
    if (p.v == null) return;
    const a = x(Math.max(p.t, T0)), b = x(i + 1 < steps.length ? steps[i + 1].t : T1), yy = y(p.v);
    setPath += `${i && steps[i - 1].v != null ? 'L' : 'M'}${f(a)} ${f(yy)} L${f(b)} ${f(yy)} `;
    const top = Math.max(PAD.t, Math.min(plotB, yy));
    clipRects += `<rect x="${f(a)}" y="${f(top)}" width="${f(Math.max(0, b - a))}" height="${f(plotB - top)}"/>`;
  });

  let line = '';
  if (c.pts.length) {
    // readings are changes only, so the last one holds until the end of the window
    const pts = c.pts.filter((p) => p.t <= T1);
    line = pts.map((p, i) => `${i ? 'L' : 'M'}${f(x(Math.max(p.t, T0)))} ${f(y(p.v))}`).join(' ');
    if (pts.length) line += ` L${f(x(T1))} ${f(y(pts[pts.length - 1].v))}`;
  }
  // below the set point: fill between the curve and the set point, and turn that
  // stretch of the curve blue. Both are the curve clipped to "under the set point".
  // everything tied to the set point stays inside the plot: a set point off the
  // scale leaves as a line running off the edge, not a stretched axis
  out += `<defs><clipPath id="${plotId}"><rect x="${PAD.l}" y="${PAD.t}" width="${f(cw)}" height="${f(ch)}"/></clipPath>` +
    (clipRects ? `<clipPath id="${clipId}">${clipRects}</clipPath>` : '') + '</defs>';
  if (line && c.below > 0 && clipRects) {
    const x0 = f(x(Math.max(c.pts[0].t, T0)));
    out += `<g clip-path="url(#${plotId})"><path d="${line} L${f(x(T1))} ${PAD.t} L${x0} ${PAD.t} Z" fill="var(--cool)" fill-opacity=".28" clip-path="url(#${clipId})"/></g>`;
  }
  if (setPath) out += `<path d="${setPath}" fill="none" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 4" clip-path="url(#${plotId})"/>`;
  const cur = steps.length ? steps[steps.length - 1].v : null;    // set point now
  if (cur != null && cur >= lo && cur <= hi) {
    out += `<text x="${W - PAD.r}" y="${f(y(cur) - 3)}" text-anchor="end" font-size="9.5" fill="var(--ok)">${cur}°</text>`;
  } else if (cur != null) {
    out += `<text x="${W - PAD.r}" y="${f(cur < lo ? plotB - 3 : PAD.t + 9)}" text-anchor="end" font-size="9.5" font-weight="600" fill="var(--ok)">${cur < lo ? '▼' : '▲'} ${cur}°</text>`;
  }
  if (line) {
    out += `<path d="${line}" fill="none" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"/>`;
    if (c.below > 0 && clipRects) out += `<path d="${line}" fill="none" stroke="var(--cool)" stroke-width="2.2" stroke-linejoin="round" clip-path="url(#${clipId})"/>`;
  } else if (hp.data) {
    out += `<text x="${PAD.l + cw / 2}" y="${f(PAD.t + ch / 2)}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(t('hp_no_data'))}</text>`;
  }

  // relay strips: OFF as the track, then offline (red), ON (green), and paused as
  // see-through hatching on top - a relay run by hand during a pause shows as both
  if (lanesH) {
    out += `<defs><pattern id="${hatchId}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="4" fill="var(--muted)"/></pattern></defs>`;
    c.lanes.forEach((l, k) => {
      const ly = plotB + 3 + k * (LANE_H + LANE_GAP);
      const bar = (iv, fill, min) => iv.map(([a, b]) => `<rect x="${f(x(a))}" y="${f(ly)}" width="${f(Math.max(min, x(b) - x(a)))}" height="${LANE_H}" fill="${fill}"/>`).join('');
      out += `<rect x="${PAD.l}" y="${f(ly)}" width="${f(cw)}" height="${LANE_H}" rx="1.5" fill="var(--off)" fill-opacity=".45"/>`;
      out += bar(l.offline, 'var(--danger)', 1) + bar(l.on, 'var(--on)', 1.5) + bar(l.paused, `url(#${hatchId})`, 1);
    });
  }
  out += `<line class="hp-hair" x1="0" x2="0" y1="${PAD.t}" y2="${f(H - PAD.b)}" stroke="var(--muted)" stroke-width="1" display="none"/>`;
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
function relayWord(s) {
  if (s === 'on') return t('hp_relay_on');
  if (s === 'off') return t('hp_relay_off');
  return s ? t('hp_relay_offline') : '—';
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
  const tg = (entryAt(c.target, tm) || {}).v;
  const when = new Date(tm).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  let html = `<b>${esc(c.name)}</b><br>${when}<br>${v == null ? '—' : v.toFixed(1) + ' °C'}`;
  if (tg != null) {
    html += ` · ${esc(t('hp_setpoint'))} ${tg}°`;
    if (v != null && v < tg) html += ` <span class="text-cool font-semibold">(−${(tg - v).toFixed(1)}°)</span>`;
  }
  for (const l of c.lanes) {
    const st = (entryAt(l.states, tm) || {}).s;
    const paused = (entryAt(l.pausedSteps, tm) || {}).v;
    html += `<br>${c.lanes.length > 1 ? esc(l.name) + ': ' : ''}${esc(relayWord(st))}${paused ? ' · ' + esc(t('hp_paused')) : ''}`;
  }
  const tip = $('#hp-tip');
  tip.innerHTML = html;
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
  document.querySelectorAll('#hp-relay-filter [data-rf]').forEach((b) => b.addEventListener('click', () => {
    hp.relays = b.dataset.rf;
    // a filter is about the set, so a single-sensor view goes back to all of them
    if (hp.view.startsWith('sensor:')) hp.view = 'all';
    syncControls(); savePrefs(); fillViewSelect(); load();
  }));
  const g = $('#hp-grid');
  g.addEventListener('click', (e) => {
    const mb = e.target.closest('[data-map]');
    if (mb) { window.open(mb.dataset.map, '_blank', 'noopener'); return; }
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
