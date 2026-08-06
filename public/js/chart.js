import { state, $, setRangeActive, api } from './core.js';
import { t } from './i18n.js';
import { selected, edMsg } from './editor.js';

// relay last-changed duration + temperature chart
let historyRange = 24;
async function loadHistory(r) {
  const box = $('#ed-history'), info = $('#ed-history-info'), spark = $('#ed-spark');
  if (!r.sensor && !r.relay) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  spark.innerHTML = ''; info.textContent = t('loading');
  // relay on/off duration
  const rl = state.live[r.relay] || {};
  let dur = '';
  if (r.relay && rl.last_changed && (rl.state === 'on' || rl.state === 'off')) {
    dur = `Relay ${rl.state.toUpperCase()} for ${fmtAgo(Date.now() - Date.parse(rl.last_changed))}. `;
  }
  if (!r.sensor) { info.textContent = dur || t('no_sensor_bound'); spark.innerHTML = ''; return; }
  try {
    const params = `sensor=${encodeURIComponent(r.sensor)}&hours=${historyRange}` +
      (r.relay ? `&relay=${encodeURIComponent(r.relay)}` : '') +
      (r.temp != null ? `&target=${r.temp}` : '');
    const data = await api('/api/history/export?' + params);
    if (!data.rows || data.rows.length < 2) { info.textContent = dur + t('not_enough_history'); return; }
    drawChart(spark, data.rows, data.target);
    addChartTooltip(spark, data.rows, '#ed-tooltip');
    const temps = data.rows.map((p) => p.temp);
    info.textContent = `${dur}min ${Math.min(...temps).toFixed(1)}° · max ${Math.max(...temps).toFixed(1)}° · now ${temps[temps.length - 1].toFixed(1)}°`;
  } catch { info.textContent = dur + t('history_unavailable'); }
}

async function exportHistory() {
  const r = modalRelay || selected(); if (!r || !r.sensor) return;
  try {
    const hours = $('#chart-modal').classList.contains('hidden') ? historyRange : modalRange;
    const params = new URLSearchParams({ sensor: r.sensor, hours: String(hours) });
    if (r.relay) params.set('relay', r.relay);
    if (r.temp != null) params.set('target', String(r.temp));
    const data = await api('/api/history/export?' + params.toString());
    if (!data.rows || !data.rows.length) { edMsg(t('no_data_to_export'), 'err'); return; }
    const header = 'timestamp,temperature,relay_state' + (data.target != null ? ',target' : '');
    const csv = header + '\n' + data.rows.map((p) =>
      `${new Date(p.t).toISOString()},${p.temp.toFixed(1)},${p.state}` +
      (data.target != null ? `,${data.target}` : '')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const span = hours >= 720 ? '30d' : hours >= 168 ? '7d' : '24h';
    a.download = `${r.sensor.replace(/\./g,'_')}_${span}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    edMsg('CSV downloaded', 'ok');
  } catch (e) { edMsg(t('export_error') + ': ' + e.message, 'err'); }
}

function fmtAgo(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}

// draw a temperature chart with axes, target line, and relay-ON bands
function drawChart(svg, rows, target) {
  if (target != null && isFinite(target)) svg.dataset.target = target;
  else delete svg.dataset.target;
  // Use the SVG's viewBox dimensions so the chart fills whatever size it's given
  const vb = svg.viewBox.baseVal;
  const W = vb.width, H = vb.height, padL = 45, padR = 10, padT = 12, padB = 28;
  const cw = W - padL - padR, ch = H - padT - padB;
  if (!rows || rows.length < 2) { svg.innerHTML = ''; return; }
  const temps = rows.map((p) => p.temp), ts = rows.map((p) => p.t);
  let lo = Math.min(...temps), hi = Math.max(...temps);
  if (target != null && isFinite(+target)) { lo = Math.min(lo, +target); hi = Math.max(hi, +target); }
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const t0 = ts[0], t1 = ts[ts.length - 1] || t0 + 1;
  const x = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * cw;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * ch;

  let out = '';

  // Band drawing helper
  function drawBands(stateClass, fillColor) {
    let start = null;
    for (const p of rows) {
      if (p.state === stateClass && start == null) { start = p.t; }
      else if (p.state !== stateClass && start != null) {
        out += `<rect x="${x(start).toFixed(1)}" y="${padT}" width="${Math.max(0.5, x(p.t) - x(start)).toFixed(1)}" height="${ch.toFixed(1)}" class="${fillColor} pointer-events-none"/>`;
        start = null;
      }
    }
    if (start != null) {
      out += `<rect x="${x(start).toFixed(1)}" y="${padT}" width="${Math.max(0.5, x(t1) - x(start)).toFixed(1)}" height="${ch.toFixed(1)}" class="${fillColor} pointer-events-none"/>`;
    }
  }
  drawBands('unavailable', '[fill:rgba(220,38,38,.10)]');  // red — offline
  drawBands('on', '[fill:rgba(34,197,94,.12)]');           // green — running

  // Y-axis ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const val = lo + (i / yTicks) * (hi - lo);
    const yy = y(val);
    out += `<line x1="${padL - 4}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`;
    out += `<text x="${padL - 6}" y="${(yy + 3).toFixed(1)}" class="[fill:var(--muted)] [font-size:9px]" text-anchor="end">${val.toFixed(1)}°</text>`;
  }

  // X-axis time labels
  const xTicks = 4;
  for (let i = 0; i <= xTicks; i++) {
    const mt = t0 + (i / xTicks) * (t1 - t0);
    const xx = x(mt);
    const d = new Date(mt);
    const label = d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
    out += `<line x1="${xx.toFixed(1)}" y1="${padT}" x2="${xx.toFixed(1)}" y2="${H - padB}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4 4"/>`;
    out += `<text x="${xx.toFixed(1)}" y="${H - 4}" class="[fill:var(--muted)] [font-size:9px]" text-anchor="middle">${label}</text>`;
  }

  // Target line
  if (target != null && isFinite(+target)) {
    const ty = y(+target);
    out += `<line x1="${padL}" y1="${ty.toFixed(1)}" x2="${W - padR}" y2="${ty.toFixed(1)}" class="[stroke:var(--ok)] [stroke-width:1.5] [stroke-dasharray:6_4] [vector-effect:non-scaling-stroke]"/>`;
    out += `<text x="${W - padR}" y="${(ty - 3).toFixed(1)}" class="[fill:var(--muted)] [font-size:9px]" text-anchor="end">${+target}°</text>`;
  }

  // Temperature line
  const d = rows.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.temp).toFixed(1)).join(' ');
  out += `<path d="${d}" class="fill-none [stroke:#f59e0b] [stroke-width:2] [vector-effect:non-scaling-stroke]"/>`;

  svg.innerHTML = out;
}

// ---- expandable history chart ----
let modalRange = 24;
// --- facility-map link (combo sensors only) --------------------------------------
// The map plots a combo sensor (temperature + humidity on one device) as a single
// marker, bound to the identifier "HA <base>". Server-side `getEntities` tags such
// sensors with `combo: '<base>'`; a temperature-only sensor gets no link.
function comboBase(sensorId) {
  if (!sensorId) return '';
  const e = (state.entities.sensors || []).find((s) => s.entity_id === sensorId);
  return (e && e.combo) || '';
}

function sensorMapUrl(base) {
  const root = (state.config && state.config.kwsMapUrl) || '';   // unset -> no button
  if (!root || !base) return '';
  return root + (root.includes('?') ? '&' : '?') + 'sensor=' + encodeURIComponent('HA ' + base);
}

let modalRelay = null; // track which relay the chart modal is showing (#62 — 7d/30d fix)

function openChartModal(r) {
  if (!r) { r = selected(); } if (!r || !r.sensor) return;
  modalRelay = r;
  // map button: shown only for a combo sensor with KWS_MAP_URL configured
  const mapBtn = $('#chart-modal-map');
  if (mapBtn) {
    const url = sensorMapUrl(comboBase(r.sensor));
    mapBtn.dataset.url = url;
    mapBtn.classList.toggle('hidden', !url);
  }
  // sync range to sidebar
  document.querySelectorAll('#chart-modal-range .range-btn').forEach((b) => {
    setRangeActive(b, parseInt(b.dataset.range) === historyRange);
  });
  modalRange = historyRange;
  loadChartModal(r);
  $('#chart-modal').classList.remove('hidden');
}

async function loadChartModal(r) {
  const svg = $('#chart-modal-svg');
  const params = `sensor=${encodeURIComponent(r.sensor)}&hours=${modalRange}` +
    (r.relay ? `&relay=${encodeURIComponent(r.relay)}` : '') +
    (r.temp != null ? `&target=${r.temp}` : '');
  try {
    const data = await api('/api/history/export?' + params);
    if (data.rows) {
      const sensorName = (state.entities.sensors.find(s => s.entity_id === r.sensor) || {}).name || r.sensor;
      $('#chart-modal-title').textContent = `${sensorName} — ${modalRange}h`;
      drawChart(svg, data.rows, data.target);
      addChartTooltip(svg, data.rows, '#chart-tooltip');
    }
  } catch {}
}

// ---- chart tooltip ----
function addChartTooltip(svg, data, tipSel) {
  const tip = $(tipSel || '#chart-tooltip');
  if (!tip) return;
  if (svg._mm) svg.removeEventListener('mousemove', svg._mm);
  if (svg._ml) svg.removeEventListener('mouseleave', svg._ml);
  // Create a marker circle if it doesn't exist
  let marker = svg.querySelector('.spark-marker');
  if (!marker) {
    marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('class', 'spark-marker');
    marker.setAttribute('r', '4');
    marker.setAttribute('fill', '#f59e0b');
    marker.setAttribute('stroke', '#fff');
    marker.setAttribute('stroke-width', '2');
    svg.appendChild(marker);
  }
  const mm = (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vb = svg.viewBox.baseVal;
    const vx = (mx / rect.width) * vb.width;
    const W = vb.width, H = vb.height, padL = 45, padR = 10, padT = 12, padB = 28;
    const ch = H - padT - padB, cw = W - padL - padR;
    const t0 = data[0].t, t1 = data[data.length - 1].t;
    let nearest = data[0], best = Infinity;
    for (const p of data) {
      const px = padL + ((p.t - t0) / (t1 - t0 || 1)) * cw;
      const d = Math.abs(px - vx);
      if (d < best) { best = d; nearest = p; }
    }
    if (best > 80) { tip.classList.add('hidden'); marker.setAttribute('display', 'none'); return; }
    const temps = data.map((p) => p.temp);
    let lo = Math.min(...temps), hi = Math.max(...temps);
    const target = parseFloat(svg.dataset.target);
    if (isFinite(target)) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * ch;
    const px = padL + ((nearest.t - t0) / (t1 - t0 || 1)) * cw;
    const py = y(nearest.temp);
    marker.setAttribute('cx', px.toFixed(1));
    marker.setAttribute('cy', py.toFixed(1));
    marker.removeAttribute('display');
    const d = new Date(nearest.t);
    const time = d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    tip.innerHTML = `${time}<br>${nearest.temp.toFixed(1)}°C · ${nearest.state === 'on' ? 'ON' : nearest.state === 'off' ? 'OFF' : nearest.state}`;
    tip.style.left = mx + 'px';
    tip.style.top = my + 'px';
    tip.classList.remove('hidden');
  };
  const ml = () => { tip.classList.add('hidden'); marker.setAttribute('display', 'none'); };
  svg.addEventListener('mousemove', mm);
  svg.addEventListener('mouseleave', ml);
  svg._mm = mm; svg._ml = ml;
}

// wiring for the history chart + expandable modal
export function initChart() {
$('#chart-modal-close').addEventListener('click', () => $('#chart-modal').classList.add('hidden'));
$('#chart-modal-csv').addEventListener('click', exportHistory);
// open this sensor's marker on the facility map, in a new tab
$('#chart-modal-map').addEventListener('click', () => {
  const url = $('#chart-modal-map').dataset.url;
  if (url) window.open(url, '_blank', 'noopener');
});
$('#chart-modal').addEventListener('click', (e) => { if (e.target === $('#chart-modal')) $('#chart-modal').classList.add('hidden'); });

$('#ed-spark').addEventListener('click', () => openChartModal());

// Modal range buttons
document.querySelectorAll('#chart-modal-range .range-btn').forEach((b) => b.addEventListener('click', () => {
  modalRange = parseInt(b.dataset.range);
  document.querySelectorAll('#chart-modal-range .range-btn').forEach((x) => setRangeActive(x, false));
  setRangeActive(b, true);
  updateHistoryLabel(modalRange);
  loadChartModal(modalRelay || selected());
}));

function updateHistoryLabel(range) {
  const label = document.querySelector('[data-i18n="last_24h"]');
  if (!label) return;
  const h = range >= 720 ? '30d' : range >= 168 ? '7d' : '24h';
  label.textContent = label.dataset.i18nEn === 'History' ? `Last ${h}` : `Viimased ${h}`;
}

$('#ed-csv').addEventListener('click', exportHistory);
document.querySelectorAll('.range-btn').forEach((b) => b.addEventListener('click', () => {
  historyRange = parseInt(b.dataset.range);
  document.querySelectorAll('.range-btn').forEach((x) => setRangeActive(x, false));
  setRangeActive(b, true);
  updateHistoryLabel(historyRange);
  const r = selected(); if (r) loadHistory(r);
}));
}

export { loadHistory, exportHistory, drawChart, addChartTooltip, openChartModal, loadChartModal };
