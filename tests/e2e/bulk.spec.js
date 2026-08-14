const { test, expect } = require('@playwright/test');
const demoLayout = require('../../src/demo-layout.json');

const AREAS = [{ id: 'area_living', name: 'Living room' }, { id: 'area_bedroom', name: 'Bedrooms' }];
const bound = demoLayout.relays.filter((r) => r.bound && r.relay && r.sensor);

async function mockApi(page) {
  await Promise.all([
    page.route('**/api/layout', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: demoLayout })
      : route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/backups', (route) => route.fulfill({ json: { ok: true, backups: [] } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: AREAS })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] })),
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

test.describe('bulk edit', () => {
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
    const rows = page.locator('#bk-list > div');
    await expect(rows).toHaveCount(bound.length);
    // every row's "after" cell is the chosen mode + temperature
    for (let i = 0; i < bound.length; i++) {
      await expect(rows.nth(i).locator('span').last()).toHaveText('Auto 22°');
    }
  });

  test('shows the deadband in the preview only when it is set', async ({ page }) => {
    await page.selectOption('#bk-mode', 'below');   // Auto is the default selection
    await page.fill('#bk-temp', '20');
    await page.fill('#bk-deadband', '0');
    await expect(page.locator('#bk-list > div').first().locator('span').last()).toHaveText('Heating 20°');
    await page.fill('#bk-deadband', '0.5');
    await expect(page.locator('#bk-list > div').first().locator('span').last()).toHaveText('Heating 20° ±0.5°');
  });

  test('the area filter narrows the preview and the Apply count', async ({ page }) => {
    await expect(page.locator('#bk-apply')).toHaveText(`Apply to ${bound.length} relays`);
    const inBedrooms = bound.filter((r) => r.area === 'area_bedroom').length;
    await page.selectOption('#bk-area', 'area_bedroom');
    await expect(page.locator('#bk-list > div')).toHaveCount(inBedrooms);
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
});
