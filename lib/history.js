// Shaping HA history for the history page: many entities from one
// /api/history/period call, split into temperature series and relay timelines.
'use strict';

const MAX_POINTS = 800;               // per sensor series, after downsampling
const MAX_SPAN_MS = 62 * 86400000;    // longest range one request may ask for

// HA answers with one array per entity. With minimal_response only the first
// entry of each array carries entity_id, so it is read from there.
// Sensors come back as [{t, v}], switches as [{t, s}] (state string).
function parseHistory(data) {
  const out = {};
  for (const arr of Array.isArray(data) ? data : []) {
    const id = arr && arr[0] && arr[0].entity_id;
    if (!id) continue;
    const pts = arr.map((p) => ({ t: Date.parse(p.last_changed || p.last_updated), x: p.state }))
      .filter((p) => isFinite(p.t));
    if (id.startsWith('switch.')) {
      out[id] = pts.map((p) => ({ t: p.t, s: p.x }));
    } else {
      out[id] = downsample(pts.map((p) => ({ t: p.t, v: parseFloat(p.x) })).filter((p) => isFinite(p.v)));
    }
  }
  return out;
}

// Keep at most `max` points by splitting the series into equal buckets and
// keeping each bucket's lowest and highest reading, in time order. Averaging
// would shave off exactly the peaks and dips someone opens a chart to find.
function downsample(points, max = MAX_POINTS) {
  if (points.length <= max) return points;
  const buckets = Math.floor(max / 2);
  const size = points.length / buckets;
  const out = [];
  for (let b = 0; b < buckets; b++) {
    const slice = points.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (!slice.length) continue;
    let lo = slice[0], hi = slice[0];
    for (const p of slice) { if (p.v < lo.v) lo = p; if (p.v > hi.v) hi = p; }
    if (lo === hi) out.push(lo);
    else out.push(...(lo.t <= hi.t ? [lo, hi] : [hi, lo]));
  }
  return out;
}

// Resolve the requested window: an explicit start/end, or the last `hours`.
// Returns {start, end} as Dates, or {error} for anything unusable.
function resolveRange({ hours, start, end }, now = Date.now()) {
  const e = end ? new Date(end) : new Date(now);
  const h = Math.min(Number(hours) || 24, MAX_SPAN_MS / 3600000);
  const s = start ? new Date(start) : new Date(e.getTime() - h * 3600000);
  if (!isFinite(s) || !isFinite(e)) return { error: 'invalid date' };
  if (s >= e) return { error: 'start must be before end' };
  if (e - s > MAX_SPAN_MS) return { error: 'range longer than 62 days' };
  return { start: s, end: e };
}

module.exports = { parseHistory, downsample, resolveRange, MAX_POINTS, MAX_SPAN_MS };
