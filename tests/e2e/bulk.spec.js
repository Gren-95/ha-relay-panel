const { test, expect } = require('@playwright/test');
const demoLayout = require('../../src/demo-layout.json');

const AREAS = [{ id: 'area_living', name: 'Living room' }, { id: 'area_bedroom', name: 'Bedrooms' }];
const bound = demoLayout.relays.filter((r) => r.bound && r.relay && r.sensor);

// Same four relays, but wired into two physical boxes — the demo layout has none,
// so grouping has nothing to show without this.
const BOXES = [
  { id: 'dA', deviceId: 'devA', name: 'hall_r2', area: '', x: 60, y: 80, w: 380, h: 200 },
  { id: 'dB', deviceId: 'devB', name: 'hall_r1', area: '', x: 460, y: 80, w: 380, h: 200 },
];
const boxedLayout = {
  ...demoLayout,
  devices: BOXES,
  relays: demoLayout.relays.map((r, i) => ({ ...r, device: i < 2 ? 'dA' : 'dB' })),
};
// only one of the two boxes has a configuration_url in HA
const RELAY_DEVICES = [{ device_id: 'devA', name: 'hall_r2', url: 'http://192.0.2.10:80', outputs: [] }];

async function mockApi(page, { layout = demoLayout, devices = [] } = {}) {
  await Promise.all([
    page.route('**/api/layout', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: layout })
      : route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/backups', (route) => route.fulfill({ json: { ok: true, backups: [] } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: AREAS })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: devices })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries: [], total: 0, page: 1, per_page: 15 } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '' } })),
  ]);
}

const openBulk = async (page) => {
  await page.click('#btn-mode');            // edit mode: the toolbar is live
  await page.click('#btn-advanced');
  await page.click('#btn-bulk');
  await expect(page.locator('#bulk-editor')).toBeVisible();
};

const rows = (page) => page.locator('#bk-list .bk-row');
const after = (row) => row.locator('span').last();

test.describe('bulk edit', () => {
  test.describe('flat layout (no physical boxes)', () => {
    test.beforeEach(async ({ page }) => {
      await mockApi(page);
      await page.goto('/');
      await openBulk(page);
    });

    // Cooling was dropped from the UI on purpose (ebeea3a). The two selects must not
    // drift apart again — bulk writes the same field the single-relay editor does.
    test('offers exactly the modes the relay editor offers', async ({ page }) => {
      const vals = (sel) => page.locator(`${sel} option`).evaluateAll((o) => o.map((x) => x.value));
      expect(await vals('#bk-mode')).toEqual(await vals('#ed-mode'));
    });

    test('previews the mode being applied, not the relay\'s current one', async ({ page }) => {
      await page.selectOption('#bk-mode', 'auto');
      await page.fill('#bk-temp', '22');
      await expect(rows(page)).toHaveCount(bound.length);
      for (let i = 0; i < bound.length; i++) {
        await expect(after(rows(page).nth(i))).toHaveText('Auto 22°');
      }
    });

    test('shows the deadband in the preview only when it is set', async ({ page }) => {
      await page.selectOption('#bk-mode', 'below');   // Auto is the default selection
      await page.fill('#bk-temp', '20');
      await page.fill('#bk-deadband', '0');
      await expect(after(rows(page).first())).toHaveText('Heating 20°');
      await page.fill('#bk-deadband', '0.5');
      await expect(after(rows(page).first())).toHaveText('Heating 20° ±0.5°');
    });

    test('the area filter narrows the preview and the Apply count', async ({ page }) => {
      await expect(page.locator('#bk-apply')).toHaveText(`Apply to ${bound.length} relays`);
      const inBedrooms = bound.filter((r) => r.area === 'area_bedroom').length;
      await page.selectOption('#bk-area', 'area_bedroom');
      await expect(rows(page)).toHaveCount(inBedrooms);
      await expect(page.locator('#bk-apply')).toHaveText(`Apply to ${inBedrooms} relays`);
    });

    test('an area with no bound relays says so instead of listing nothing', async ({ page }) => {
      await page.route('**/api/areas', (route) => route.fulfill({ json: [...AREAS, { id: 'area_empty', name: 'Empty' }] }));
      await page.reload();
      await openBulk(page);
      await page.selectOption('#bk-area', 'area_empty');
      await expect(page.locator('#bk-list')).toContainText('No bound relays match');
      await expect(page.locator('#bk-apply')).toHaveText('Apply to 0 relays');
    });

    // relays belonging to no box still have to show up (#101's loose group)
    test('relays with no physical box are grouped under "No device"', async ({ page }) => {
      await expect(page.locator('#bk-list .bk-group')).toHaveCount(1);
      await expect(page.locator('#bk-list .bk-group').first()).toContainText('Not in a relay box');
      await expect(rows(page)).toHaveCount(bound.length);
    });
  });

  test.describe('grouped by physical relay', () => {
    test.beforeEach(async ({ page }) => {
      await mockApi(page, { layout: boxedLayout, devices: RELAY_DEVICES });
      await page.goto('/');
      await openBulk(page);
    });

    test('groups the preview by box, in name order, with counts', async ({ page }) => {
      const groups = page.locator('#bk-list .bk-group');
      await expect(groups).toHaveCount(2);
      // hall_r1 sorts before hall_r2 even though it is second in the layout
      await expect(groups.nth(0)).toContainText('hall_r1');
      await expect(groups.nth(1)).toContainText('hall_r2');
      await expect(groups.nth(0).locator('.bk-row')).toHaveCount(2);
      await expect(groups.nth(1).locator('.bk-row')).toHaveCount(2);
    });

    test('a box header carries its address when HA has one', async ({ page }) => {
      const groups = page.locator('#bk-list .bk-group');
      await expect(groups.nth(1)).toContainText('192.0.2.10');   // hall_r2 = devA
      await expect(groups.nth(0)).not.toContainText('192.0.2.10');
    });
  });
});
