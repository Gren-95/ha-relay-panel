const { test, expect } = require('@playwright/test');

// A physical relay either answers or it does not: when the box drops, HA marks every
// one of its outputs unavailable at once. The board says that once, on the box.

const BOX = { id: 'dA', deviceId: 'devA', name: 'hall_r1', area: '', x: 60, y: 80, w: 380, h: 220 };
const OUT = (n) => ({
  id: 'r' + n, name: 'Output ' + n, relay: `switch.out_${n}`, sensor: `sensor.temp_${n}`,
  device: 'dA', area: '', mode: 'below', temp: 21, deadband: 0, bound: true, x: 70, y: 120 + n * 62,
});
const LAYOUT = { relays: [OUT(1), OUT(2), OUT(3)], areas: [], devices: [BOX] };

const SENSORS_OK = {
  'sensor.temp_1': { state: '21.0', unit: '°C', last_changed: '2026-01-01T12:00:00' },
  'sensor.temp_2': { state: '21.0', unit: '°C', last_changed: '2026-01-01T12:00:00' },
  'sensor.temp_3': { state: '21.0', unit: '°C', last_changed: '2026-01-01T12:00:00' },
};

async function mockApi(page, live) {
  await Promise.all([
    page.route('**/api/layout', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: LAYOUT })
      : route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/backups', (route) => route.fulfill({ json: { ok: true, backups: [] } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] })),
    page.route('**/api/live**', (route) => route.fulfill({ json: { ...SENSORS_OK, ...live } })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries: [], total: 0, page: 1, per_page: 15 } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '' } })),
  ]);
}

const gone = { state: 'unavailable', last_changed: '2026-01-01T12:00:00' };
const on = { state: 'on', last_changed: '2026-01-01T12:00:00' };

const boxWarn = (page) => page.locator('.area[data-gid="dA"] .box-warn');
const cardWarns = (page) => page.locator('.relay .warn-icon');

test.describe('a dead relay box speaks once', () => {
  test('all outputs unavailable: the box is flagged, the cards are not', async ({ page }) => {
    await mockApi(page, { 'switch.out_1': gone, 'switch.out_2': gone, 'switch.out_3': gone });
    await page.goto('/');
    await expect(boxWarn(page)).toBeVisible();
    await expect(boxWarn(page)).toHaveAttribute('title', /all 3 outputs are unreachable/);
    await expect(cardWarns(page)).toHaveCount(0);
  });

  test('the wash covers the outputs and does not swallow their clicks', async ({ page }) => {
    await mockApi(page, { 'switch.out_1': gone, 'switch.out_2': gone, 'switch.out_3': gone });
    await page.goto('/');
    const wash = page.locator('.box-off-wash');
    await expect(wash).toBeVisible();
    // it has to paint ABOVE the outputs, or it is just a background tint
    const [washZ, cardZ] = await Promise.all([
      wash.evaluate((e) => +getComputedStyle(e).zIndex),
      page.locator('.relay').first().evaluate((e) => +getComputedStyle(e).zIndex),
    ]);
    expect(washZ).toBeGreaterThan(cardZ);
    // ...while still letting the card underneath take the click
    await expect(wash).toHaveCSS('pointer-events', 'none');
    const box = await page.locator('.relay').first().boundingBox();
    expect(await page.locator('.box-off-wash').boundingBox()).not.toBeNull();
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return !!(el && el.closest('.relay'));
    }, [box.x + box.width / 2, box.y + box.height / 2]);
    expect(hit).toBe(true);
  });

  test('one output down is still that output\'s problem', async ({ page }) => {
    await mockApi(page, { 'switch.out_1': gone, 'switch.out_2': on, 'switch.out_3': on });
    await page.goto('/');
    await expect(boxWarn(page)).toHaveCount(0);
    await expect(cardWarns(page)).toHaveCount(1);
  });

  test('a missing entity is a binding fault, never a dead box', async ({ page }) => {
    // every output gone, but one is missing from HA rather than unavailable
    await mockApi(page, {
      'switch.out_1': { missing: true }, 'switch.out_2': gone, 'switch.out_3': gone,
    });
    await page.goto('/');
    await expect(boxWarn(page)).toHaveCount(0);
    await expect(cardWarns(page)).toHaveCount(3);   // 1 missing + 2 offline, each on its card
  });

  test('the block-level warning survives the mobile list layout', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 900 });
    await mockApi(page, { 'switch.out_1': gone, 'switch.out_2': gone, 'switch.out_3': gone });
    await page.goto('/');
    await expect(page.locator('.box-warn')).toBeVisible();   // cards are suppressed here too
    await expect(cardWarns(page)).toHaveCount(0);
  });
});
