'use strict';
// The "Relay to switch" label helper (#111): the output number from the entity id, and
// the "Name (Device Output N)" text. The module is an ES module under public/js, so it
// is loaded with a dynamic import from this CommonJS test.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../../public/js/output-label.mjs');
const EN = (n) => `Output ${n}`;
const ET = (n) => `Väljund ${n}`;
const box = (device) => ({ device, format: EN });

test('outputNum reads the channel from the entity id', async () => {
  const { outputNum } = await load();
  assert.equal(outputNum('switch.shellypro3_ece334f7be74_output_0'), 0);
  assert.equal(outputNum('switch.shellypro3_ece334f7be74_output_12'), 12);
  assert.equal(outputNum('switch.relay_abc_output_2'), 2);
});

test('outputNum returns null when the id carries no channel', async () => {
  const { outputNum } = await load();
  assert.equal(outputNum('switch.kraani_keeraja_demo'), null);
  assert.equal(outputNum('switch.x_relay_1'), null);          // _relay_ is not _output_
  assert.equal(outputNum('switch.x_output_1_extra'), null);   // not at the end
  assert.equal(outputNum(''), null);
  assert.equal(outputNum(null), null);
  assert.equal(outputNum(undefined), null);
});

test('outputLabel names the device and the output beside a renamed output', async () => {
  const { outputLabel } = await load();
  assert.equal(outputLabel('TM_liin', 'switch.dA_output_0', box('prodk1_r1')),
    'TM_liin (prodk1_r1 Output 0)');
  assert.equal(outputLabel('Lõpp_ladu', 'switch.dA_output_2', box('prodk2_r1')),
    'Lõpp_ladu (prodk2_r1 Output 2)');
});

test('outputLabel falls back to the output number when HA has no device', async () => {
  const { outputLabel } = await load();
  assert.equal(outputLabel('TM_liin', 'switch.dA_output_0', { format: EN }), 'TM_liin (Output 0)');
  assert.equal(outputLabel('TM_liin', 'switch.dA_output_0'), 'TM_liin (Output 0)');
});

test('outputLabel replaces HA default names with the device + output', async () => {
  const { outputLabel } = await load();
  // the default name's prefix is the device's own hash, so repeating it says nothing
  assert.equal(outputLabel('shellypro3-ece334f89524 Output 2', 'switch.dA_output_2', box('prodk1_r2')),
    'prodk1_r2 Output 2');
  // ...but with no device to show, the name stays as it is
  assert.equal(outputLabel('shellypro3-ece334f89524 Output 2', 'switch.dA_output_2', { format: EN }),
    'shellypro3-ece334f89524 Output 2');
});

test('outputLabel does not repeat a name that already says the channel', async () => {
  const { outputLabel } = await load();
  assert.equal(outputLabel('prodk1_r2 Output 2', 'switch.dA_output_2', box('prodk1_r2')),
    'prodk1_r2 Output 2');
  assert.equal(outputLabel('PRODK1_R2 OUTPUT 2', 'switch.dA_output_2', box('prodk1_r2')),
    'PRODK1_R2 OUTPUT 2');   // case-insensitive
});

test('outputLabel appends when the name names a different output', async () => {
  const { outputLabel } = await load();
  assert.equal(outputLabel('shellypro3-abc Output 2', 'switch.dA_output_1', box('prodk1_r2')),
    'shellypro3-abc Output 2 (prodk1_r2 Output 1)');
});

test('outputLabel leaves ids without a channel untouched', async () => {
  const { outputLabel } = await load();
  assert.equal(outputLabel('kraani_keeraja_demo', 'switch.kraani_keeraja_demo', box('prodk1_r1')),
    'kraani_keeraja_demo');
  assert.equal(outputLabel('Trigger indicator', 'switch.0x54ef_trigger_indicator', box('prodk1_r1')),
    'Trigger indicator');
});

test('outputLabel uses the device + output when the name is empty', async () => {
  const { outputLabel } = await load();
  assert.equal(outputLabel('', 'switch.dA_output_0', box('prodk1_r1')), 'prodk1_r1 Output 0');
  assert.equal(outputLabel(null, 'switch.dA_output_0', box('prodk1_r1')), 'prodk1_r1 Output 0');
  // no device and no name: the entity id is the only handle left
  assert.equal(outputLabel('', 'switch.dA_output_0', { format: EN }), 'switch.dA_output_0');
});

test('outputLabel uses the supplied formatter, and defaults to English', async () => {
  const { outputLabel } = await load();
  assert.equal(outputLabel('Line_1', 'switch.dA_output_1', { device: 'prodk1_r1', format: ET }),
    'Line_1 (prodk1_r1 Väljund 1)');
  assert.equal(outputLabel('Line_1', 'switch.dA_output_1', { device: 'prodk1_r1' }),
    'Line_1 (prodk1_r1 Output 1)');
});

test('isDefaultOutputName spots HA\'s own default name', async () => {
  const { isDefaultOutputName } = await load();
  const id = 'switch.shellypro3_ece334f89508_output_2';
  assert.equal(isDefaultOutputName('shellypro3-ece334f89508 Output 2', id), true);
  assert.equal(isDefaultOutputName('shellypro3-ece334f89508 OUTPUT 2', id), true);  // case-insensitive
  // a different channel number is not this entity's default
  assert.equal(isDefaultOutputName('shellypro3-ece334f89508 Output 1', id), false);
  // a real name, even one that ends in "Output N"
  assert.equal(isDefaultOutputName('Heater Output 2', id), false);
  assert.equal(isDefaultOutputName('vaba', id), false);
  assert.equal(isDefaultOutputName('Line_1', id), false);
  // ids without a channel have no default name to speak of
  assert.equal(isDefaultOutputName('Shelly something Output 2', 'switch.kraani_keeraja_demo'), false);
  assert.equal(isDefaultOutputName('', id), false);
  assert.equal(isDefaultOutputName(null, id), false);
});
