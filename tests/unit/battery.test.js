'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../../lib/battery');

const st = (entity_id, state, attrs = {}) => ({ entity_id, state, attributes: { device_class: 'battery', ...attrs } });

test('batteryEntities: percent sensors and binary low flags, skips non-battery and text states', () => {
  const out = B.batteryEntities([
    st('sensor.a_battery', '15', { friendly_name: 'A' }),
    st('sensor.b_battery', 'unavailable', { friendly_name: 'B' }),
    st('binary_sensor.c_battery_low', 'on', { friendly_name: 'C' }),
    st('sensor.d_battery_state', 'Charging', { friendly_name: 'D' }),
    { entity_id: 'sensor.temp', state: '21', attributes: { device_class: 'temperature' } },
  ]);
  assert.deepEqual(out.map((b) => [b.entity_id, b.kind, b.level, b.offline]), [
    ['sensor.a_battery', 'percent', 15, false],
    ['sensor.b_battery', 'percent', null, true],
    ['binary_sensor.c_battery_low', 'binary', true, false],
  ]);
});

test('evaluate: alerts once, holds while low, recovers only past the margin', () => {
  const cfg = { threshold: 20, exclude: [] };
  const bat = (level) => [{ entity_id: 'sensor.x', name: 'X', kind: 'percent', level, offline: false }];

  let r = B.evaluate(bat(20), cfg, {});
  assert.equal(r.newlyLow.length, 1);
  r = B.evaluate(bat(19), cfg, r.low);
  assert.equal(r.newlyLow.length, 0);
  assert.ok(r.low['sensor.x']);
  r = B.evaluate(bat(25), cfg, r.low); // above the line but inside the margin
  assert.equal(r.recovered.length, 0);
  assert.ok(r.low['sensor.x']);
  r = B.evaluate(bat(30), cfg, r.low);
  assert.equal(r.recovered.length, 1);
  assert.deepEqual(r.low, {});
});

test('evaluate: offline keeps state, excluded entities are dropped silently', () => {
  const cfg = { threshold: 20, exclude: ['sensor.y'] };
  const prev = { 'sensor.x': { level: 5, since: 1 }, 'sensor.y': { level: 5, since: 1 } };
  const r = B.evaluate([
    { entity_id: 'sensor.x', name: 'X', kind: 'percent', level: null, offline: true },
    { entity_id: 'sensor.y', name: 'Y', kind: 'percent', level: 100, offline: false },
  ], cfg, prev);
  assert.deepEqual(Object.keys(r.low), ['sensor.x']);
  assert.equal(r.recovered.length, 0);
  assert.deepEqual(r.dropped, ['sensor.y']);
});

test('sanitizeConfig: validates and keeps the stored password unless cleared', () => {
  const stored = { smtp: { pass: 'secret' } };
  const form = { enabled: true, threshold: '20', recipients: 'a@example.com\nb@example.com, a@example.com',
    smtp: { host: 'smtp.example.com', port: '587', security: 'starttls', from: 'panel@example.com', pass: '' } };
  const cfg = B.sanitizeConfig(form, stored);
  assert.deepEqual(cfg.recipients, ['a@example.com', 'b@example.com']);
  assert.equal(cfg.smtp.pass, 'secret');
  assert.equal(cfg.smtp.port, 587);
  assert.equal(B.sanitizeConfig({ ...form, clearPass: true }, stored).smtp.pass, '');
  assert.equal(B.publicConfig(cfg).smtp.pass, undefined);
  assert.equal(B.publicConfig(cfg).smtp.hasPass, true);
});

test('sanitizeConfig: rejects bad input', () => {
  const ok = { threshold: 20, recipients: 'a@example.com', smtp: { host: 'smtp.example.com', from: 'p@example.com' } };
  assert.throws(() => B.sanitizeConfig({ ...ok, threshold: 31 }), /threshold/);
  assert.throws(() => B.sanitizeConfig({ ...ok, threshold: 2.5 }), /threshold/);
  assert.throws(() => B.sanitizeConfig({ ...ok, recipients: 'nope' }), /email/);
  assert.throws(() => B.sanitizeConfig({ ...ok, recipients: 'a@example.com\r\nBcc: x@example.com' }), /email/);
  assert.throws(() => B.sanitizeConfig({ ...ok, smtp: { ...ok.smtp, host: 'bad host' } }), /SMTP server/);
  assert.throws(() => B.sanitizeConfig({ ...ok, enabled: true, recipients: '' }), /recipient/);
  assert.equal(B.sanitizeConfig({ ...ok, threshold: 0 }).threshold, 0);
});

test('buildEmail: subject names a single device, counts several', () => {
  const cfg = { threshold: 20 };
  const one = B.buildEmail({ newlyLow: [{ entity_id: 'sensor.x', name: 'X', kind: 'percent', level: 12 }], recovered: [] }, cfg);
  assert.match(one.subject, /Low battery: X \(12%\)/);
  assert.match(one.text, /sensor\.x/);
  const rec = B.buildEmail({ newlyLow: [], recovered: [{ entity_id: 'a.b', name: 'A', kind: 'binary', level: false }, { entity_id: 'a.c', name: 'C', kind: 'percent', level: 90 }] }, cfg);
  assert.match(rec.subject, /OK again: 2 devices/);
});
