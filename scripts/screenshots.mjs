// Regenerate the README images in docs/ from seeded demo data.
//
// Every HA- and DB-backed endpoint is mocked in the browser, so all this needs is
// something serving public/ - the deployed panel, or a plain static server. Needs
// Node >= 20 for Playwright; on a host without it, run it in the Playwright image
// (see the Testing section of the README).
//
//   BASE_URL=http://localhost:8090 npm run screenshots
import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:8090';
const outDir = join(__dirname, '..', 'docs');

// The e2e demo layout, plus a two-channel physical relay, with the loose card moved
// clear of the areas (the e2e specs rely on the original, so it is adjusted here).
const demoLayout = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'demo-layout.json'), 'utf-8'));
const byId = (list, id) => list.find((o) => o.id === id);
Object.assign(byId(demoLayout.areas, 'a2'), { x: 460 });
for (const id of ['r2', 'r4']) Object.assign(byId(demoLayout.relays, id), { x: 480 });
Object.assign(byId(demoLayout.relays, 'r3'), { x: 900, y: 60 });
demoLayout.devices.push({ id: 'd1', deviceId: 'dev_workshop', name: 'Workshop relay', x: 900, y: 220 });
demoLayout.relays.push(
  { id: 'd1o0', name: 'Floor heating', relay: 'switch.workshop_ch1', sensor: 'sensor.workshop_temp', device: 'd1', mode: 'below', temp: 18, deadband: 0.5, bound: true, x: 0, y: 0 },
  { id: 'd1o1', name: 'Fan heater', relay: 'switch.workshop_ch2', sensor: 'sensor.workshop_temp', device: 'd1', mode: 'below', temp: 16, deadband: 0, bound: true, x: 0, y: 0 },
);

const NOW = Date.now();
const iso = (minsAgo) => new Date(NOW - minsAgo * 60000).toISOString();

const SWITCHES = [
  ['switch.living_heater', 'Living room heater'],
  ['switch.bedroom_heater', 'Bedroom heater'],
  ['switch.kitchen_heater', 'Kitchen heater'],
  ['switch.bathroom_heater', 'Bathroom heater'],
  ['switch.workshop_ch1', 'Workshop relay CH1'],
  ['switch.workshop_ch2', 'Workshop relay CH2'],
];
const SENSORS = [
  ['sensor.living_temp', 'Living room', 21.2],
  ['sensor.bedroom_temp', 'Bedroom', 19.4],
  ['sensor.kitchen_temp', 'Kitchen', 19.0],
  ['sensor.bathroom_temp', 'Bathroom', 22.1],
  ['sensor.workshop_temp', 'Workshop', 17.6],
];
const ON = new Set(['switch.bedroom_heater', 'switch.workshop_ch1']);

// A smooth-ish run of readings around each sensor's current value, [{t, v}].
function series(id, base, hours) {
  const pts = [];
  const seed = id.length;
  for (let m = hours * 60; m >= 0; m -= 15) {
    const t = m / 60;
    const v = base + 0.7 * Math.sin((t + seed) / 3.8) + 0.12 * Math.sin((t + seed) * 1.3);
    pts.push({ t: NOW - m * 60000, v: +v.toFixed(1) });
  }
  return pts;
}

// A relay that came on for a while every few hours, [{t, s}].
function switchSeries(id, hours) {
  const pts = [{ t: NOW - hours * 3600000, s: 'off' }];
  for (let h = hours - 2 - (id.length % 3); h > 0; h -= 4) {
    pts.push({ t: NOW - h * 3600000, s: 'on' }, { t: NOW - (h - 1.3) * 3600000, s: 'off' });
  }
  return pts;
}

const ACTIVITY = [
  { created_at: iso(3), actor: 'alex', action: 'switch.toggle', detail: { entity_id: 'switch.kitchen_heater', action: 'on' } },
  { created_at: iso(18), actor: 'alex', action: 'relay.bind', detail: { relay: 'switch.bedroom_heater', sensor: 'sensor.bedroom_temp', mode: 'below', temp: 20 } },
  { created_at: iso(42), actor: 'sam', action: 'automation.pause', detail: { rid: 'r4' } },
  { created_at: iso(65), actor: 'sam', action: 'layout.save', detail: { relays: 4, areas: 2, devices: 0 } },
  { created_at: iso(90), actor: 'sam', action: 'login', detail: {} },
  { created_at: iso(240), actor: 'alex', action: 'device.rename', detail: { entity_id: 'switch.kitchen_heater', new_name: 'Kitchen heater' } },
  { created_at: iso(600), actor: 'alex', action: 'login', detail: {} },
].map((e, i) => ({ id: 100 - i, ...e }));

async function mockApi(page, { authed = false } = {}) {
  await page.route('**/api/layout', (route) => {
    if (route.request().method() === 'GET') route.fulfill({ json: demoLayout });
    else route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '', version: 'demo' } }));
  await page.route('**/api/entities', (route) => route.fulfill({ json: {
    switches: SWITCHES.map(([entity_id, name]) => ({ entity_id, name })),
    sensors: SENSORS.map(([entity_id, name]) => ({ entity_id, name, device_class: 'temperature', unit_of_measurement: '°C' })),
  } }));
  await page.route('**/api/areas', (route) => route.fulfill({ json: [
    { id: 'area_living', name: 'Living room' }, { id: 'area_bedroom', name: 'Bedrooms' },
  ] }));
  await page.route('**/api/sensor-areas', (route) => route.fulfill({ json: {
    'sensor.living_temp': 'area_living', 'sensor.bedroom_temp': 'area_bedroom',
    'sensor.bathroom_temp': 'area_bedroom', 'sensor.kitchen_temp': null, 'sensor.workshop_temp': null,
  } }));
  await page.route('**/api/relay-devices', (route) => route.fulfill({ json: [{
    device_id: 'dev_workshop', name: 'Workshop relay', url: 'http://192.0.2.30',
    outputs: [{ entity_id: 'switch.workshop_ch1', name: 'CH1' }, { entity_id: 'switch.workshop_ch2', name: 'CH2' }],
  }] }));
  await page.route('**/api/live**', (route) => route.fulfill({ json: Object.fromEntries([
    ...SENSORS.map(([id, , v]) => [id, { state: String(v), unit: '°C', last_changed: iso(2) }]),
    ...SWITCHES.map(([id]) => [id, { state: ON.has(id) ? 'on' : 'off', last_changed: iso(20) }]),
  ]) }));
  await page.route('**/api/automations', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } }));
  await page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed, user: authed ? 'alex' : null } }));
  await page.route('**/api/activity-log**', (route) => route.fulfill({ json: {
    entries: ACTIVITY, total: ACTIVITY.length, page: 1, per_page: 15,
  } }));
  await page.route('**/api/history/multi**', (route) => {
    const hours = Number(new URL(route.request().url()).searchParams.get('hours')) || 24;
    route.fulfill({ json: {
      ok: true, start: NOW - hours * 3600000, end: NOW,
      series: Object.fromEntries([
        ...SENSORS.map(([id, , v]) => [id, series(id, v, hours)]),
        ...SWITCHES.map(([id]) => [id, switchSeries(id, hours)]),
      ]),
      relays: Object.fromEntries(demoLayout.relays.map((r) => [r.id, {
        target: [{ t: NOW - hours * 3600000, v: r.temp }], paused: [{ t: NOW - hours * 3600000, v: false }],
      }])),
    } });
  });
  await page.route('**/api/history/export**', (route) => {
    const q = new URL(route.request().url()).searchParams;
    const s = SENSORS.find(([id]) => id === q.get('sensor')) || SENSORS[0];
    route.fulfill({ json: { ok: true, rows: series(s[0], s[2], 24).map((p) => ({ t: p.t, temp: p.v, state: 'off' })), target: 21 } });
  });
}

// Boot a page with the mocks in place and wait for the app's own ready signal.
async function open(browser, { width = 1280, height = 720, authed = false, theme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
  const page = await ctx.newPage();
  await mockApi(page, { authed });
  await page.goto(BASE);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 15000 });
  await page.waitForTimeout(800); // first live poll + render
  return { ctx, page };
}

const shot = (page, name) => page.screenshot({ path: join(outDir, name), fullPage: false });

const browser = await chromium.launch();
try {
  // 1. Main board, light
  let { ctx, page } = await open(browser);
  await shot(page, 'screenshot.png');
  await ctx.close();

  // 2. Main board, dark (follows the OS by default)
  ({ ctx, page } = await open(browser, { theme: 'dark' }));
  await shot(page, 'screenshot-dark.png');
  await ctx.close();

  // 3. Relay editor - editing needs a session and Edit mode
  ({ ctx, page } = await open(browser, { authed: true }));
  await page.click('#btn-mode');
  await page.waitForTimeout(300);
  await page.locator('.relay').first().click();
  await page.waitForSelector('#editor:not(.hidden)');
  await page.waitForTimeout(600);
  await shot(page, 'editor.png');
  await page.keyboard.press('Escape');

  // 4. Activity log (gear menu)
  await page.click('#btn-advanced');
  await page.click('#btn-activity');
  await page.waitForSelector('#activity-editor:not(.hidden)');
  await page.waitForTimeout(500);
  await shot(page, 'activity.png');
  await page.keyboard.press('Escape');

  // 5. Temperature history page
  await page.click('#btn-history');
  await page.waitForSelector('#history-page:not(.hidden)');
  await page.waitForTimeout(1000);
  await shot(page, 'history.png');
  await ctx.close();

  // 6. Phone
  ({ ctx, page } = await open(browser, { width: 390, height: 844 }));
  await shot(page, 'mobile.png');
  await ctx.close();

  console.log('Screenshots written to docs/');
} finally {
  await browser.close();
}
