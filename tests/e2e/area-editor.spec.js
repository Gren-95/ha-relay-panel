const { test, expect } = require('@playwright/test');

// The area editor (#95): an area's controls used to live in its titlebar, which
// crowded the name and gave areas a different interaction model from device
// boxes. Both are now "click the gear, get a panel" — so what this suite really
// guards is that the two panels stay the same kind of thing.

const AREA = 'plantroom';

function layout() {
  const outputs = (dev, n) => Array.from({ length: n }, (_, i) => ({
    id: `${dev}o${i}`, name: `${dev} out ${i}`, relay: `switch.${dev}_${i}`,
    sensor: `sensor.${dev}_${i}`, area: AREA, device: dev,
    mode: 'below', temp: 21, deadband: 0, bound: true, x: 0, y: 0,
  }));
  return {
    areas: [{ id: 'a1', areaId: AREA, name: 'Plant room', x: 20, y: 20, w: 700, h: 640 }],
    devices: [{ id: 'dA', deviceId: 'devA', name: 'Relay board A', area: AREA, x: 60, y: 80 }],
    relays: outputs('dA', 3),
  };
}

async function mockApi(page) {
  const store = { layout: layout(), version: 1 };
  const body = () => ({ ...store.layout, updated_at: store.version });
  await Promise.all([
    page.route('**/api/layout', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: body() });
      const b = route.request().postDataJSON() || {};
      store.layout = { relays: b.relays || [], areas: b.areas || [], devices: b.devices || [] };
      store.version += 1;
      return route.fulfill({ json: body() });
    }),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [{ id: AREA, name: 'Plant room' }] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries: [], total: 0, page: 1, per_page: 15 } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '' } })),
  ]);
}

// The area's gear, told apart from the device box's by its titlebar text.
async function areaGear(page) {
  const i = await page.evaluate(() => [...document.querySelectorAll('.area-head .area-gear')]
    .findIndex((g) => g.closest('.area-head').textContent.includes('Plant room')));
  expect(i, 'area titlebar has a gear').toBeGreaterThanOrEqual(0);
  return page.locator('.area-head .area-gear').nth(i);
}

test.describe('area editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.click('#btn-mode');                       // edit mode
    await expect(page.locator('.area-head').first()).toBeVisible();
  });

  test('the gear opens a panel with every area control', async ({ page }) => {
    await expect(page.locator('#area-editor')).toBeHidden();
    await (await areaGear(page)).click();

    const panel = page.locator('#area-editor');
    await expect(panel).toBeVisible();
    await expect(page.locator('#backdrop')).toBeVisible();
    await expect(page.locator('#ae-name')).toHaveValue('Plant room');
    await expect(page.locator('#ae-temp')).toHaveValue('21');
    // every relay in the area, including the ones inside its device box
    await expect(page.locator('#ae-relays .ae-rel')).toHaveCount(3);
    for (const id of ['ae-color', 'ae-color-reset', 'ae-temp-apply', 'ae-all-on', 'ae-all-off', 'ae-save', 'ae-delete']) {
      await expect(page.locator('#' + id)).toBeVisible();
    }
  });

  test('the titlebar keeps All on / All off and nothing else', async ({ page }) => {
    const head = page.locator('.area-head', { hasText: 'Plant room' });
    await expect(head.locator('.am-btn[data-act]')).toHaveCount(2);
    await expect(head.locator('.area-temp')).toHaveCount(0);        // set point -> panel
    await expect(head.locator('.area-color-picker')).toHaveCount(0); // colour -> panel
  });

  test('the master buttons on the bar still switch the whole area', async ({ page }) => {
    const calls = [];
    await page.route('**/api/switch', (route) => {
      calls.push(route.request().postDataJSON());
      route.fulfill({ json: { ok: true, state: 'on' } });
    });
    await page.locator('.area-head', { hasText: 'Plant room' })
      .locator('.am-btn[data-act="on"]').click();
    await expect.poll(() => calls.length).toBe(3);
    expect(calls.every((c) => c.action === 'on')).toBe(true);
  });

  test('it is the same kind of panel as the physical-relay editor', async ({ page }) => {
    await (await areaGear(page)).click();
    const same = await page.evaluate(() => {
      const strip = (el) => el.className.split(/\s+/).filter((c) => c !== 'hidden').sort().join(' ');
      const a = document.querySelector('#area-editor'), d = document.querySelector('#dev-editor');
      return strip(a) === strip(d) && a.getAttribute('role') === d.getAttribute('role');
    });
    expect(same, 'area and device editors share their chrome').toBe(true);
  });

  test('Escape and the close button both dismiss it', async ({ page }) => {
    await (await areaGear(page)).click();
    await expect(page.locator('#area-editor')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#area-editor')).toBeHidden();
    await expect(page.locator('#backdrop')).toBeHidden();

    await (await areaGear(page)).click();
    await page.click('#ae-close');
    await expect(page.locator('#area-editor')).toBeHidden();
    await expect(page.locator('#backdrop')).toBeHidden();
  });

  test('renaming the area through the panel updates the box', async ({ page }) => {
    await (await areaGear(page)).click();
    await page.fill('#ae-name', 'Boiler house');
    await page.click('#ae-save');
    await expect(page.locator('.area-head', { hasText: 'Boiler house' })).toBeVisible();
  });
});
