const { test, expect } = require('@playwright/test');

// #111: in the Edit relay panel, "Relay to switch" always says which output of the
// physical relay an entry is. Display only — the values and the order are untouched.

const AREA = 'plantroom';
const DEVICE = { id: 'dA', deviceId: 'devA', name: 'hall_r1', area: AREA, x: 60, y: 80 };

const layout = (boardName = 'Line_1') => ({
  areas: [{ id: 'a1', areaId: AREA, name: 'Plant room', x: 40, y: 40 }],
  devices: [DEVICE],
  relays: [{
    id: 'r1', name: boardName, relay: 'switch.dA_output_0', sensor: 'sensor.s1',
    area: AREA, device: 'dA', mode: 'below', temp: 20, deadband: 0, bound: false,
    x: 0, y: 0, z: 1,
  }],
});

// Four switches covering every case: a renamed output, HA's default name (which
// already carries the number), a plain switch, and a legacy _relay_ id.
const SWITCHES = ({ defaultHaName } = {}) => [
  { entity_id: 'switch.dA_output_0', name: defaultHaName ? 'dA Output 0' : 'Line_1', state: 'off' },
  { entity_id: 'switch.dA_output_1', name: 'shellypro3-abc Output 1', state: 'off' },
  { entity_id: 'switch.kraani_keeraja_demo', name: 'kraani_keeraja_demo', state: 'off' },
  { entity_id: 'switch.dA_relay_2', name: 'Legacy', state: 'off' },
];

// The physical relay HA knows the first two outputs under. Its name is what the label
// shows beside the output number.
const RELAY_DEVICES = () => [{
  device_id: 'devA', name: 'prodk1_r1', url: 'http://10.0.0.5:80',
  outputs: [
    { entity_id: 'switch.dA_output_0', name: 'Line_1' },
    { entity_id: 'switch.dA_output_1', name: 'shellypro3-abc Output 1' },
  ],
}];

async function mockApi(page, { boardName, defaultHaName } = {}) {
  const entities = { switches: SWITCHES({ defaultHaName }), sensors: [] };
  await Promise.all([
    page.route('**/api/layout', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: layout(boardName) })
      : route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: entities })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [{ id: AREA, name: 'Plant room' }] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: RELAY_DEVICES() })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '' } })),
    // The rename flow renames in HA, then refetches /api/entities.
    page.route('**/api/rename', (route) => {
      const { entity_id, name } = route.request().postDataJSON();
      const s = entities.switches.find((x) => x.entity_id === entity_id);
      if (s) s.name = name;
      return route.fulfill({ json: { ok: true } });
    }),
  ]);
  return entities;
}

const openEditor = async (page) => {
  await page.click('#btn-mode');                       // edit mode
  await page.locator('#canvas .relay .r-name').first().click();
  await expect(page.locator('#editor')).toBeVisible();
};

// option text keyed by value, so the assertion does not depend on list order
const optionTexts = (page) => page.evaluate(() => {
  const out = {};
  document.querySelectorAll('#ed-relay option').forEach((o) => { out[o.value] = o.textContent; });
  return out;
});

test.describe('relay select shows the output number', () => {
  test('every entry that has an output number says so', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await openEditor(page);

    expect(await optionTexts(page)).toEqual({
      '': '— pick relay —',
      'switch.dA_output_0': 'Line_1 (prodk1_r1 Output 0)',
      'switch.dA_output_1': 'prodk1_r1 Output 1',           // HA's default name, device shown
      'switch.kraani_keeraja_demo': 'kraani_keeraja_demo',  // not an output
      'switch.dA_relay_2': 'Legacy',                        // _relay_ is not _output_
    });
  });

  // A relay renamed on the board keeps HA's default name on the entity. The board name is
  // what the card shows, so the select must show it too — "vaba", not "prodk1_r1 Output 0".
  test('the board name wins when HA still has its default name', async ({ page }) => {
    await mockApi(page, { boardName: 'vaba', defaultHaName: true });
    await page.goto('/');
    await openEditor(page);

    expect((await optionTexts(page))['switch.dA_output_0']).toBe('vaba (prodk1_r1 Output 0)');
  });

  // ...but a real HA rename must not be hidden by a stale board name.
  test('a real HA name wins over the board name', async ({ page }) => {
    await mockApi(page, { boardName: 'old board name' });
    await page.goto('/');
    await openEditor(page);

    expect((await optionTexts(page))['switch.dA_output_0']).toBe('Line_1 (prodk1_r1 Output 0)');
  });

  test('the closed field shows the suffix too', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await openEditor(page);

    await page.selectOption('#ed-relay', 'switch.dA_output_0');
    const shown = await page.locator('#ed-relay').evaluate((el) => el.selectedOptions[0].textContent);
    expect(shown).toBe('Line_1 (prodk1_r1 Output 0)');
  });

  test('after a rename the refreshed list shows the new name with its output', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await openEditor(page);

    await page.selectOption('#ed-relay', 'switch.dA_output_0');
    page.once('dialog', (d) => d.accept('TM_liin'));
    await page.click('#ed-rename-relay');

    // the panel refetches entities ~1.6s after the rename
    await expect.poll(async () => (await optionTexts(page))['switch.dA_output_0'], { timeout: 6000 })
      .toBe('TM_liin (prodk1_r1 Output 0)');
    // and the selection survived the refresh
    expect(await page.locator('#ed-relay').inputValue()).toBe('switch.dA_output_0');
  });

  test('nothing else in the panel gained a suffix', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await openEditor(page);

    // the sensor select is untouched (it shares fillSelects with the relay one)
    expect(await page.locator('#ed-sensor option').first().textContent()).toBe('— pick sensor —');
  });
});
