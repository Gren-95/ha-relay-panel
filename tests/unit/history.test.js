'use strict';
// History page shaping: pure functions, no HA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseHistory, downsample, resolveRange, MAX_SPAN_MS } = require('../../lib/history');

const iso = (ms) => new Date(ms).toISOString();

test('parseHistory splits sensors and switches, reading entity_id from the first entry only', () => {
  const out = parseHistory([
    [{ entity_id: 'sensor.a_temperature', state: '21.5', last_changed: iso(1000) }, { state: 'unavailable', last_changed: iso(2000) }, { state: '22', last_changed: iso(3000) }],
    [{ entity_id: 'switch.r1', state: 'off', last_changed: iso(1000) }, { state: 'on', last_changed: iso(2500) }],
  ]);
  assert.deepEqual(out['sensor.a_temperature'], [{ t: 1000, v: 21.5 }, { t: 3000, v: 22 }]);
  assert.deepEqual(out['switch.r1'], [{ t: 1000, s: 'off' }, { t: 2500, s: 'on' }]);
});

test('parseHistory tolerates junk', () => {
  assert.deepEqual(parseHistory(null), {});
  assert.deepEqual(parseHistory([[], [{ state: '1' }]]), {});
});

test('downsample leaves short series alone', () => {
  const pts = [{ t: 1, v: 1 }, { t: 2, v: 2 }];
  assert.equal(downsample(pts, 10), pts);
});

test('downsample caps the length and keeps the extremes in time order', () => {
  const pts = Array.from({ length: 5000 }, (_, i) => ({ t: i, v: Math.sin(i / 50) * 10 }));
  pts[1234] = { t: 1234, v: 99 };   // a spike averaging would flatten
  pts[4321] = { t: 4321, v: -99 };
  const out = downsample(pts, 400);
  assert.ok(out.length <= 400);
  assert.ok(out.some((p) => p.v === 99) && out.some((p) => p.v === -99));
  for (let i = 1; i < out.length; i++) assert.ok(out[i].t > out[i - 1].t);
});

test('resolveRange: last N hours by default, custom start/end, and the guards', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const r = resolveRange({}, now);
  assert.equal(r.end.getTime() - r.start.getTime(), 24 * 3600000);
  assert.equal(resolveRange({ hours: '168' }, now).start.toISOString(), '2026-09-07T12:00:00.000Z');
  const c = resolveRange({ start: '2026-09-01T00:00:00Z', end: '2026-09-02T00:00:00Z' }, now);
  assert.equal(c.start.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.ok(resolveRange({ start: 'nope' }, now).error);
  assert.ok(resolveRange({ start: '2026-09-02T00:00:00Z', end: '2026-09-01T00:00:00Z' }, now).error);
  assert.ok(resolveRange({ start: '2026-01-01T00:00:00Z', end: '2026-09-01T00:00:00Z' }, now).error);
  // hours is clamped to the span limit rather than refused
  assert.equal(resolveRange({ hours: '99999' }, now).end - resolveRange({ hours: '99999' }, now).start, MAX_SPAN_MS);
});
