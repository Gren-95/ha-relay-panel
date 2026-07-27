'use strict';
// Smoke tests for the pure server-side helpers (no DB/HA needed).
// Run with: npm run test:unit  (uses Node's built-in test runner)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { slug, sanitizeSchedule } = require('../../lib/util');

test('slug: lowercases, replaces non-[a-z0-9_] runs with _, caps at 60 chars', () => {
  assert.equal(slug('Living Room 1'), 'living_room_1');
  assert.equal(slug('a!!!b'), 'a_b');
  assert.equal(slug('switch.foo-bar'), 'switch_foo_bar');
  assert.equal(slug('x'.repeat(80)).length, 60);
});

test('sanitizeSchedule: rejects non-objects and empty/invalid blocks', () => {
  assert.equal(sanitizeSchedule(null), null);
  assert.equal(sanitizeSchedule({}), null);
  assert.equal(sanitizeSchedule({ blocks: [] }), null);
  // invalid: missing days / bad time / non-finite temp
  assert.equal(sanitizeSchedule({ blocks: [{ days: [], start: '06:00', end: '18:00', temp: 21 }] }), null);
  assert.equal(sanitizeSchedule({ blocks: [{ days: [1], start: 'nope', end: '18:00', temp: 21 }] }), null);
  assert.equal(sanitizeSchedule({ blocks: [{ days: [1], start: '06:00', end: '18:00', temp: 'x' }] }), null);
});

test('sanitizeSchedule: keeps valid blocks, clamps days to 1..7, parses fallback', () => {
  const out = sanitizeSchedule({
    blocks: [{ days: [1, 2, 9, 0], start: '06:00', end: '18:00', temp: '21.5' }],
    fallback: '15',
  });
  assert.deepEqual(out.blocks[0].days, [1, 2]);
  assert.equal(out.blocks[0].temp, 21.5);
  assert.equal(out.fallback, 15);
});

test('sanitizeSchedule: non-numeric fallback becomes null; caps at 20 blocks', () => {
  const one = { days: [1], start: '06:00', end: '18:00', temp: 20 };
  const out = sanitizeSchedule({ blocks: Array.from({ length: 30 }, () => ({ ...one })), fallback: 'x' });
  assert.equal(out.blocks.length, 20);
  assert.equal(out.fallback, null);
});
