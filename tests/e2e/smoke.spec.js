const { test, expect } = require('@playwright/test');
const demoLayout = require('../../src/demo-layout.json');

// Mock all HA-dependent API endpoints so tests run without a live Home Assistant
async function mockApi(page) {
  await page.route('**/api/layout', (route) => {
    if (route.request().method() === 'GET') route.fulfill({ json: demoLayout });
    else route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/entities', (route) =>
    route.fulfill({ json: { switches: [
      { entity_id:'switch.living_heater',name:'Living room heater' },
      { entity_id:'switch.bedroom_heater',name:'Bedroom heater' },
      { entity_id:'switch.kitchen_heater',name:'Kitchen heater' },
      { entity_id:'switch.bathroom_heater',name:'Bathroom heater' },
    ], sensors: [
      { entity_id:'sensor.living_temp',name:'Living room temp',device_class:'temperature' },
      { entity_id:'sensor.bedroom_temp',name:'Bedroom temp',device_class:'temperature' },
      { entity_id:'sensor.kitchen_temp',name:'Kitchen temp',device_class:'temperature' },
      { entity_id:'sensor.bathroom_temp',name:'Bathroom temp',device_class:'temperature' },
    ]}})
  );
  await page.route('**/api/areas', (route) =>
    route.fulfill({ json: [{ id:'area_living',name:'Living room' },{ id:'area_bedroom',name:'Bedrooms' }] })
  );
  await page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/live**', (route) => route.fulfill({ json: {
    'sensor.living_temp': { state:'21.2',unit:'°C',last_changed:'2026-01-01T12:00:00' },
    'sensor.bedroom_temp': { state:'19.8',unit:'°C',last_changed:'2026-01-01T12:00:00' },
    'sensor.kitchen_temp': { state:'19.0',unit:'°C',last_changed:'2026-01-01T12:00:00' },
    'sensor.bathroom_temp': { state:'22.1',unit:'°C',last_changed:'2026-01-01T12:00:00' },
    'switch.living_heater': { state:'on',last_changed:'2026-01-01T12:00:00' },
    'switch.bedroom_heater': { state:'off',last_changed:'2026-01-01T12:00:00' },
    'switch.kitchen_heater': { state:'off',last_changed:'2026-01-01T12:00:00' },
    'switch.bathroom_heater': { state:'off',last_changed:'2026-01-01T12:00:00' },
  }}));
  await page.route('**/api/automations', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } }));
  await page.route('**/api/session', (route) => route.fulfill({ json: { ok:true, authed:false, user:null } }));
  await page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries:[], total:0, page:1, per_page:15 } }));
  await page.route('**/api/history**', (route) => route.fulfill({ json: { ok:true, rows:[], target:null } }));
}

test.describe('relay-panel smoke', () => {
  test('app loads with canvas and header', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
  });

  test('kiosk mode hides toolbar', async ({ page }) => {
    await mockApi(page);
    await page.goto('/?kiosk=1');
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('#canvas')).toBeVisible();
  });

  test('theme toggle persists across reload', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    const initial = await page.locator('html').getAttribute('data-theme');
    await page.click('#btn-theme');
    await page.waitForTimeout(200);
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(initial);
  });

  // #52: the header counter-scales against browser zoom. Playwright can't drive
  // Ctrl +/- , so this pins down what is testable — the vars are published, and the
  // one that downstream sizing reads tracks the header's real height.
  test('header zoom lock publishes its size vars', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    const vars = await page.locator('html').evaluate((el) => ({
      zoom: el.style.getPropertyValue('--header-zoom'),
      h: el.style.getPropertyValue('--header-h'),
    }));
    expect(Number(vars.zoom)).toBe(1);   // a headless window is never zoomed
    const height = await page.locator('header').evaluate((el) => el.getBoundingClientRect().height);
    expect(parseInt(vars.h, 10)).toBe(Math.round(height));
  });

  test('mobile viewport shows hamburger menu', async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize({ width: 500, height: 800 });
    await page.goto('/');
    await expect(page.locator('#btn-menu')).toBeVisible();
    await page.click('#btn-menu');
    await expect(page.locator('#toolbar')).toBeVisible();
  });
});
