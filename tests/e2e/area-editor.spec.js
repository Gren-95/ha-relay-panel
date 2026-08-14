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

  test('the titlebar keeps the master pair and the set point, not the colour', async ({ page }) => {
    const head = page.locator('.area-head', { hasText: 'Plant room' });
    await expect(head.locator('.am-btn[data-act]')).toHaveCount(2);
    await expect(head.locator('.area-temp')).toHaveCount(1);         // #99: on the bar AND in the panel
    await expect(head.locator('.area-color-picker')).toHaveCount(0); // colour lives only in the panel
  });

  // #103: read mode is for reading. Controls it will not let you press are not
  // greyed out any more, they are gone, leaving the titlebar as icon + name.
  test('read mode hides the master controls entirely', async ({ page }) => {
    const head = page.locator('.area-head', { hasText: 'Plant room' });
    await expect(head.locator('.area-master')).toBeVisible();      // still in edit mode

    await page.click('#btn-mode');                                 // -> read mode
    await expect(head.locator('.area-master')).toBeHidden();
    await expect(head.locator('.am-btn').first()).toBeHidden();
    await expect(head.locator('.area-temp')).toBeHidden();
    await expect(head).toContainText('Plant room');                // the name stays

    await page.click('#btn-mode');                                 // back to edit
    await expect(head.locator('.area-master')).toBeVisible();
  });

  test('the bar pill shows the same set point the panel does', async ({ page }) => {
    const pill = page.locator('.area-head', { hasText: 'Plant room' }).locator('.area-temp');
    await expect(pill).toContainText('21');
    await (await areaGear(page)).click();
    await expect(page.locator('#ae-temp')).toHaveValue('21');
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

  // the bug that prompted #98: the backdrop closed the relay and device editors
  // but had never been taught about this one
  test('clicking outside closes it', async ({ page }) => {
    await (await areaGear(page)).click();
    await expect(page.locator('#area-editor')).toBeVisible();
    await page.mouse.click(5, 400);
    await expect(page.locator('#area-editor')).toBeHidden();
    await expect(page.locator('#backdrop')).toBeHidden();
  });

  test('applying a set point in the panel moves the pill on the bar', async ({ page }) => {
    const bound = [];
    await page.route('**/api/relays/*/bind', (route) => {
      bound.push(route.request().postDataJSON());
      route.fulfill({ json: { ok: true, automationId: 'x' } });
    });

    await (await areaGear(page)).click();
    await page.fill('#ae-temp', '19.5');
    await page.click('#ae-temp-apply');

    // every bound relay in the area gets re-bound at the new target
    await expect.poll(() => bound.length).toBe(3);
    expect(bound.every((b) => b.temp === 19.5)).toBe(true);

    await page.keyboard.press('Escape');
    const pill = page.locator('.area-head', { hasText: 'Plant room' }).locator('.area-temp');
    await expect(pill).toContainText('19.5');
  });

  test('renaming the area through the panel updates the box', async ({ page }) => {
    await (await areaGear(page)).click();
    await page.fill('#ae-name', 'Boiler house');
    await page.click('#ae-save');
    await expect(page.locator('.area-head', { hasText: 'Boiler house' })).toBeVisible();
  });
});

// #101: the relay list is grouped by physical relay, so the panel mirrors the
// wiring rather than presenting one flat run of outputs.
test.describe('area editor relay grouping', () => {
  const AREA2 = 'hall';
  const outs = (dev, n, from) => Array.from({ length: n }, (_, i) => ({
    id: `${dev}o${i}`, name: `${dev} out ${i}`, relay: `switch.${dev}_${i}`,
    sensor: `sensor.${dev}_${i}`, area: AREA2, device: dev,
    mode: 'below', temp: from, deadband: 0, bound: true, x: 0, y: 0,
  }));
  const grouped = () => ({
    areas: [{ id: 'a2', areaId: AREA2, name: 'Hall', x: 20, y: 20, w: 800, h: 700 }],
    devices: [
      { id: 'dB', deviceId: 'devB', name: 'hall_r2', area: AREA2, x: 400, y: 80 },
      { id: 'dA', deviceId: 'devA', name: 'hall_r1', area: AREA2, x: 60, y: 80 },
    ],
    relays: [
      ...outs('dA', 3, 21), ...outs('dB', 2, 21),
      // pinned straight to the area, in no box
      { id: 'loose1', name: 'loose card', relay: 'switch.loose', sensor: 'sensor.loose',
        area: AREA2, mode: 'below', temp: 21, deadband: 0, bound: true, x: 60, y: 500 },
    ],
  });

  test.beforeEach(async ({ page }) => {
    await Promise.all([
      page.route('**/api/layout', (r) => r.request().method() === 'GET'
        ? r.fulfill({ json: grouped() }) : r.fulfill({ json: { ok: true } })),
      page.route('**/api/layout/zorder', (r) => r.fulfill({ json: { ok: true } })),
      page.route('**/api/session', (r) => r.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
      page.route('**/api/entities', (r) => r.fulfill({ json: { switches: [], sensors: [] } })),
      page.route('**/api/areas', (r) => r.fulfill({ json: [{ id: AREA2, name: 'Hall' }] })),
      page.route('**/api/relay-devices', (r) => r.fulfill({ json: [
        { device_id: 'devA', name: 'hall_r1', url: 'http://192.0.2.10:80', outputs: [] },
        { device_id: 'devB', name: 'hall_r2', url: '', outputs: [] },   // no address in HA
      ] })),
      page.route('**/api/live**', (r) => r.fulfill({ json: {} })),
      page.route('**/api/automations', (r) => r.fulfill({ json: {} })),
      page.route('**/api/ha-status', (r) => r.fulfill({ json: { reachable: true } })),
      page.route('**/api/activity-log**', (r) => r.fulfill({ json: { entries: [], total: 0, page: 1, per_page: 15 } })),
      page.route('**/api/config', (r) => r.fulfill({ json: { kwsMapUrl: '' } })),
    ]);
    await page.goto('/');
    await page.click('#btn-mode');
    const i = await page.evaluate(() => [...document.querySelectorAll('.area-head .area-gear')]
      .findIndex((g) => g.closest('.area-head').textContent.includes('Hall')));
    await page.locator('.area-head .area-gear').nth(i).click();
    await expect(page.locator('#area-editor')).toBeVisible();
  });

  test('one section per physical relay, plus the loose cards', async ({ page }) => {
    const sections = await page.evaluate(() => [...document.querySelectorAll('#ae-relays > div')].map((sec) => ({
      box: sec.querySelector('.ae-box span').textContent.trim(),
      count: sec.querySelectorAll('.ae-rel').length,
    })));
    // boxes sort by name, and the box-less group always comes last
    expect(sections).toEqual([
      { box: 'hall_r1', count: 3 },
      { box: 'hall_r2', count: 2 },
      { box: 'Not in a relay box', count: 1 },
    ]);
    // every relay still listed exactly once
    await expect(page.locator('#ae-relays .ae-rel')).toHaveCount(6);
  });

  test('each section header counts its own outputs', async ({ page }) => {
    const counts = await page.evaluate(() => [...document.querySelectorAll('#ae-relays .ae-box')]
      .map((h) => h.lastElementChild.textContent.trim()));
    expect(counts).toEqual(['3', '2', '1']);
  });

  test('a section header opens that physical relay, a row opens the relay', async ({ page }) => {
    await page.locator('#ae-relays .ae-box[data-box]').first().click();
    await expect(page.locator('#dev-editor')).toBeVisible();
    await expect(page.locator('#area-editor')).toBeHidden();
    await expect(page.locator('#de-name')).toHaveValue('hall_r1');
  });

  test('a box header shows its address when HA has one', async ({ page }) => {
    const heads = await page.evaluate(() => [...document.querySelectorAll('#ae-relays .ae-box')].map((h) => ({
      box: h.querySelector('span').textContent.trim(),
      ip: (h.querySelector('.ae-box-ip') || {}).textContent || null,
    })));
    expect(heads).toEqual([
      { box: 'hall_r1', ip: '192.0.2.10' },   // shown bare, as in the device editor
      { box: 'hall_r2', ip: null },           // HA has no configuration_url for this one
      { box: 'Not in a relay box', ip: null },  // not a device, so no address
    ]);
  });

  test('the box-less group is not clickable', async ({ page }) => {
    const last = page.locator('#ae-relays .ae-box').last();
    await expect(last).toHaveText(/Not in a relay box/);
    expect(await last.getAttribute('data-box')).toBeNull();
  });
});
