'use strict';
// Pure helpers behind the physical-relay output list (#110): ordering and
// config swapping. The module is an ES module under public/js, so it is loaded
// with a dynamic import from this CommonJS test.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../../public/js/output-order.mjs');

const relay = (id, device, extra = {}) => ({
  id, device, name: id, relay: 'switch.' + id, sensor: 'sensor.' + id,
  mode: 'below', temp: 20, deadband: 0, bound: false, x: 0, y: 0, z: 1, ...extra,
});

test('outputsOf: only the device\'s own outputs, in array order', async () => {
  const { outputsOf } = await load();
  const relays = [relay('a1', 'g1'), relay('b1', 'g2'), relay('a2', 'g1'), relay('loose', undefined)];
  assert.deepEqual(outputsOf(relays, 'g1').map((r) => r.id), ['a1', 'a2']);
  assert.deepEqual(outputsOf(relays, 'g2').map((r) => r.id), ['b1']);
  assert.deepEqual(outputsOf(relays, 'nope'), []);
});

test('moveOutput: reorders inside the device and leaves other entries in place', async () => {
  const { moveOutput } = await load();
  const relays = [relay('a1', 'g1'), relay('b1', 'g2'), relay('a2', 'g1'), relay('b2', 'g2'), relay('a3', 'g1')];
  const next = moveOutput(relays, 'g1', 0, 2); // a1 to the bottom
  assert.deepEqual(next.map((r) => r.id), ['a2', 'b1', 'a3', 'b2', 'a1']);
  // the other device's entries keep their slots, and the input is not mutated
  assert.deepEqual(relays.map((r) => r.id), ['a1', 'b1', 'a2', 'b2', 'a3']);
});

test('moveOutput: no-op and out-of-range moves return an unchanged copy', async () => {
  const { moveOutput } = await load();
  const relays = [relay('a1', 'g1'), relay('a2', 'g1')];
  for (const [from, to] of [[0, 0], [-1, 1], [0, 2], [2, 0]]) {
    const next = moveOutput(relays, 'g1', from, to);
    assert.deepEqual(next.map((r) => r.id), ['a1', 'a2']);
    assert.notEqual(next, relays, 'returns a copy');
  }
});

test('applyOrder: applies a full id order to the device slots', async () => {
  const { applyOrder } = await load();
  const relays = [relay('a1', 'g1'), relay('b1', 'g2'), relay('a2', 'g1'), relay('a3', 'g1')];
  const next = applyOrder(relays, 'g1', ['a3', 'a1', 'a2']);
  assert.deepEqual(next.map((r) => r.id), ['a3', 'b1', 'a1', 'a2']);
});

test('applyOrder: a draft that does not match the device is refused', async () => {
  const { applyOrder } = await load();
  const relays = [relay('a1', 'g1'), relay('a2', 'g1')];
  // missing an id, or naming another device's id, must not drop or steal entries
  assert.deepEqual(applyOrder(relays, 'g1', ['a1']).map((r) => r.id), ['a1', 'a2']);
  assert.deepEqual(applyOrder(relays, 'g1', ['a1', 'b9']).map((r) => r.id), ['a1', 'a2']);
});

test('swapRefusal: explains why a swap is not allowed', async () => {
  const { swapRefusal } = await load();
  const a = relay('a1', 'g1');
  const b = relay('a2', 'g1');
  assert.equal(swapRefusal(a, b), null);
  assert.equal(swapRefusal(a, a), 'same');
  assert.equal(swapRefusal(a, null), 'missing');
  assert.equal(swapRefusal({ ...a, bound: true }, b), 'bound');
  assert.equal(swapRefusal(a, { ...b, relay: '' }), 'no_relay');
});

test('swapConfigs: moves the config, keeps the channel', async () => {
  const { swapConfigs } = await load();
  const a = relay('a1', 'g1', { sensor: 'sensor.hot', mode: 'above', temp: 24, deadband: 2, bound: false, z: 5 });
  const b = relay('a2', 'g1', { sensor: 'sensor.cold', mode: 'below', temp: 16, deadband: 0, bound: false, z: 9 });
  const res = swapConfigs(a, b);
  assert.equal(res.ok, true);
  // config travels
  assert.equal(a.sensor, 'sensor.cold');
  assert.equal(a.mode, 'below');
  assert.equal(a.temp, 16);
  assert.equal(b.sensor, 'sensor.hot');
  assert.equal(b.mode, 'above');
  assert.equal(b.temp, 24);
  // channel stays
  assert.equal(a.relay, 'switch.a1');
  assert.equal(b.relay, 'switch.a2');
  assert.equal(a.z, 5);
  assert.equal(b.z, 9);
});

test('swapConfigs: a bound output is refused and nothing is mutated', async () => {
  const { swapConfigs } = await load();
  const a = relay('a1', 'g1', { bound: true, sensor: 'sensor.hot' });
  const b = relay('a2', 'g1', { sensor: 'sensor.cold' });
  const res = swapConfigs(a, b);
  assert.deepEqual(res, { ok: false, reason: 'bound' });
  assert.equal(a.sensor, 'sensor.hot');
  assert.equal(b.sensor, 'sensor.cold');
});

test('swapConfigs: schedule is cloned, so the two outputs never share one object', async () => {
  const { swapConfigs } = await load();
  const sched = { blocks: [{ days: [1], temp: 21 }], fallback: 18 };
  const a = relay('a1', 'g1', { schedule: sched });
  const b = relay('a2', 'g1', { schedule: undefined });
  swapConfigs(a, b);
  assert.equal(b.schedule.blocks[0].temp, 21);
  b.schedule.blocks[0].temp = 5;
  assert.equal(sched.blocks[0].temp, 21, 'original schedule untouched');
  assert.equal(a.schedule, undefined);
});
