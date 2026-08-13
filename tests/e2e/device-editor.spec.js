const { test, expect } = require('@playwright/test');

// #100: the physical relay panel shows the device's address, so you can get from
// "this box is misbehaving" to its web UI without going via Home Assistant. The
// address is HA's configuration_url, carried through /api/relay-devices.

const AREA = 'plantroom';
const DEVICE = { id: 'dA', deviceId: 'devA', name: 'prodl1_r1', area: AREA, x: 60, y: 80 };

function layout() {
  return {
    areas: [{ id: 'a1', areaId: AREA, name: 'Plant room', x: 20, y: 20, w: 700, h: 640 }],
    devices: [DEVICE],
    relays: Array.from({ length: 3 }, (_, i) => ({
      id: `dAo${i}`, name: `out ${i}`, relay: `switch.dA_${i}`, sensor: `sensor.dA_${i}`,
      area: AREA, device: 'dA', mode: 'below', temp: 21, deadband: 0, bound: true, x: 0, y: 0,
    })),
  };
}

async function mockApi(page, { url } = { url: 'http://10.72.4.88:80' }) {
  await Promise.all([
    page.route('**/api/layout', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: layout() })
      : route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [{ id: AREA, name: 'Plant room' }] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({
      json: [{
        device_id: 'devA', name: 'prodl1_r1', url,
        outputs: [0, 1, 2].map((i) => ({ entity_id: `switch.dA_${i}`, name: `out ${i}` })),
      }],
    })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '' } })),
  ]);
}

const openDevice = async (page) => {
  const i = await page.evaluate(() => [...document.querySelectorAll('.area-head .area-gear')]
    .findIndex((g) => g.closest('.area-head').textContent.includes('prodl1_r1')));
  await page.locator('.area-head .area-gear').nth(i).click();
};

test.describe('physical relay editor', () => {
  test('shows the device address, linked to its web UI', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.click('#btn-mode');
    await openDevice(page);

    await expect(page.locator('#dev-editor')).toBeVisible();
    const addr = page.locator('#de-addr');
    await expect(page.locator('#de-addr-row')).toBeVisible();
    // shown bare - "http://10.72.4.88:80" would be noise
    await expect(addr).toHaveText('10.72.4.88');
    await expect(addr).toHaveAttribute('href', 'http://10.72.4.88:80');
    await expect(addr).toHaveAttribute('target', '_blank');
    await expect(addr).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('hides the row when HA has no address for the device', async ({ page }) => {
    await mockApi(page, { url: '' });          // e.g. a Zigbee relay, no configuration_url
    await page.goto('/');
    await page.click('#btn-mode');
    await openDevice(page);

    await expect(page.locator('#dev-editor')).toBeVisible();
    await expect(page.locator('#de-addr-row')).toBeHidden();
  });
});
