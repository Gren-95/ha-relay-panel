const { test, expect } = require('@playwright/test');
const demoLayout = require('../../src/demo-layout.json');

// #98: every dismissible panel behaves the same way — Escape closes it, clicking
// outside closes it, and opening one closes whatever was open. Before the modal
// registry those three things were hand-written per panel and disagreed: the
// backdrop closed two of six, three panels never dimmed the board at all, and the
// area editor was missing from three of the mutual-exclusion chains.

async function mockApi(page) {
  await Promise.all([
    page.route('**/api/layout', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: demoLayout })
      : route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/backups', (route) => route.fulfill({ json: { ok: true, backups: [] } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries: [], total: 0, page: 1, per_page: 15 } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '' } })),
  ]);
}

// The panels reachable from the toolbar, with how to open each.
const PANELS = [
  { id: 'activity-editor', open: async (p) => { await p.click('#btn-advanced'); await p.click('#btn-activity'); } },
  { id: 'bulk-editor', open: async (p) => { await p.click('#btn-advanced'); await p.click('#btn-bulk'); } },
  { id: 'preset-editor', open: async (p) => { await p.click('#btn-advanced'); await p.click('#btn-presets'); } },
  { id: 'about-modal', open: async (p) => { await p.click('#btn-advanced'); await p.click('#btn-about'); } },
];

test.describe('modal dismissal', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.click('#btn-mode');                 // edit mode: the toolbar is live
    await expect(page.locator('#toolbar')).toBeVisible();
  });

  for (const panel of PANELS) {
    test(`${panel.id}: Escape closes it`, async ({ page }) => {
      await panel.open(page);
      await expect(page.locator('#' + panel.id)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#' + panel.id)).toBeHidden();
    });

    test(`${panel.id}: clicking outside closes it`, async ({ page }) => {
      await panel.open(page);
      const el = page.locator('#' + panel.id);
      await expect(el).toBeVisible();
      // click well away from the panel — top-left corner of the viewport
      await page.mouse.click(5, 400);
      await expect(el).toBeHidden();
    });
  }

  test('opening one panel closes the one already open', async ({ page }) => {
    await page.click('#btn-advanced');
    await page.click('#btn-activity');
    await expect(page.locator('#activity-editor')).toBeVisible();

    await page.click('#btn-advanced');
    await page.click('#btn-bulk');
    await expect(page.locator('#bulk-editor')).toBeVisible();
    await expect(page.locator('#activity-editor')).toBeHidden();
  });

  test('the backdrop tracks whether a dimming panel is open', async ({ page }) => {
    await expect(page.locator('#backdrop')).toBeHidden();
    await page.click('#btn-advanced');
    await page.click('#btn-activity');
    await expect(page.locator('#backdrop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#backdrop')).toBeHidden();
  });

  test('closing the last panel leaves nothing dimmed or blurred', async ({ page }) => {
    await page.click('#btn-advanced');
    await page.click('#btn-bulk');
    await page.mouse.click(5, 400);
    await expect(page.locator('#bulk-editor')).toBeHidden();
    await expect(page.locator('#backdrop')).toBeHidden();
    expect(await page.evaluate(() => document.body.classList.contains('editor-open'))).toBe(false);
  });
});
