import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8090';
const demoLayout = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'demo-layout.json'), 'utf-8'));

async function mockApi(page) {
  await page.route('**/api/layout', (route) => {
    if (route.request().method() === 'GET') route.fulfill({ json: demoLayout });
    else route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [
    { entity_id:'switch.living_heater',name:'Living room heater' },
    { entity_id:'switch.bedroom_heater',name:'Bedroom heater' },
  ], sensors: [
    { entity_id:'sensor.living_temp',name:'Living room',device_class:'temperature',unit_of_measurement:'°C' },
    { entity_id:'sensor.bedroom_temp',name:'Bedroom',device_class:'temperature',unit_of_measurement:'°C' },
  ]}}));
  await page.route('**/api/areas', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/live**', (route) => route.fulfill({ json: {
    'sensor.living_temp': { state:'21.2',unit:'°C',last_changed:'2026-07-01T12:00:00' },
    'sensor.bedroom_temp': { state:'19.8',unit:'°C',last_changed:'2026-07-01T12:00:00' },
    'switch.living_heater': { state:'on',last_changed:'2026-07-01T12:00:00' },
    'switch.bedroom_heater': { state:'off',last_changed:'2026-07-01T12:00:00' },
  }}));
  await page.route('**/api/automations', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } }));
  await page.route('**/api/session', (route) => route.fulfill({ json: { ok:true, authed:false, user:null } }));
  await page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries:[], total:0, page:1, per_page:15 } }));
  await page.route('**/api/history**', (route) => route.fulfill({ json: { ok:true, rows:[], target:null } }));
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const outDir = join(__dirname, '..', 'docs');
  await mockApi(page);

  // 1. Light theme — main canvas
  await page.goto(BASE);
  await page.waitForSelector('#canvas');
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, 'screenshot.png'), fullPage: false });

  // 2. Dark theme
  await page.click('#btn-theme');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, 'screenshot-dark.png'), fullPage: false });
  await page.click('#btn-theme'); // back to light
  await page.waitForTimeout(200);

  // 3. Relay editor panel
  const card = page.locator('.relay').first();
  if (await card.isVisible()) { await card.click(); await page.waitForTimeout(500); }
  await page.screenshot({ path: join(outDir, 'editor.png'), fullPage: false });

  // 4. Activity log
  await page.click('#btn-advanced');
  await page.waitForTimeout(200);
  const activityBtn = page.locator('#btn-activity');
  if (await activityBtn.isVisible()) { await activityBtn.click(); await page.waitForTimeout(500); }
  await page.screenshot({ path: join(outDir, 'activity.png'), fullPage: false });
  await page.keyboard.press('Escape');

  // 5. Mobile
  await ctx.close();
  const mobileCtx = await browser.newContext({ viewport: { width: 500, height: 800 } });
  const mobilePage = await mobileCtx.newPage();
  await mockApi(mobilePage);
  await mobilePage.goto(BASE);
  await mobilePage.waitForSelector('#canvas');
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: join(outDir, 'mobile.png'), fullPage: false });
  await mobileCtx.close();

  // 6. Kiosk
  const kioskCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const kioskPage = await kioskCtx.newPage();
  await mockApi(kioskPage);
  await kioskPage.goto(BASE + '?kiosk=1');
  await kioskPage.waitForSelector('#canvas');
  await kioskPage.waitForTimeout(500);
  await kioskPage.screenshot({ path: join(outDir, 'kiosk.png'), fullPage: false });
  await kioskCtx.close();

  console.log('Screenshots written to docs/');
} finally {
  await browser.close();
}
