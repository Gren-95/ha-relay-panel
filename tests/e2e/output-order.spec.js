const { test, expect } = require('@playwright/test');

// #110: the physical-relay panel orders its outputs by drag & drop, and can swap
// the configs of two outputs while the channels stay put. The board order *is* the
// relays[] array order, so "reorder" means reordering entries in that array.

const AREA = 'plantroom';
const DEVICE = { id: 'dA', deviceId: 'devA', name: 'hall_r1', area: AREA, x: 60, y: 80 };

function output(id, n, extra = {}) {
  return {
    id, name: 'out ' + n, relay: 'switch.dA_' + n, sensor: 'sensor.s' + n, area: AREA,
    device: 'dA', mode: 'below', temp: 20, deadband: 0, bound: false, x: 0, y: 0, z: 1, ...extra,
  };
}

function layout(relays) {
  return {
    areas: [{ id: 'a1', areaId: AREA, name: 'Plant room', x: 20, y: 20, w: 700, h: 640 }],
    devices: [DEVICE],
    relays: relays || [output('o1', 1), output('o2', 2), output('o3', 3)],
  };
}

// Every PUT /api/layout body is kept so the tests can assert what was saved.
async function mockApi(page, { relays } = {}) {
  const saved = [];
  await Promise.all([
    page.route('**/api/layout', (route) => {
      if (route.request().method() === 'PUT') {
        saved.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true, version: 'v2' } });
      }
      return route.fulfill({ json: layout(relays) });
    }),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({
      json: {
        switches: [1, 2, 3].map((n) => ({ entity_id: 'switch.dA_' + n, name: 'out ' + n })),
        sensors: [1, 2, 3].map((n) => ({ entity_id: 'sensor.s' + n, name: 'sensor ' + n })),
      },
    })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [{ id: AREA, name: 'Plant room' }] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({
      json: [{
        device_id: 'devA', name: 'hall_r1', url: '',
        outputs: [1, 2, 3].map((n) => ({ entity_id: 'switch.dA_' + n, name: 'out ' + n })),
      }],
    })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: [] })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsUrl: '' } })),
    page.route('**/api/audit', (route) => route.fulfill({ json: { ok: true } })),
  ]);
  return saved;
}

async function openPanel(page) {
  await page.goto('/');
  await page.click('#btn-mode');
  const i = await page.evaluate(() => [...document.querySelectorAll('.area-head .area-gear')]
    .findIndex((g) => g.closest('.area-head').textContent.includes('hall_r1')));
  await page.locator('.area-head .area-gear').nth(i).click();
  await expect(page.locator('#dev-editor')).toBeVisible();
}

const rows = (page) => page.locator('#de-outputs .de-out');

test.describe('physical relay output order (#110)', () => {
  test('each output row shows a one-line config summary', async ({ page }) => {
    await mockApi(page);
    await openPanel(page);
    await expect(rows(page)).toHaveCount(3);
    const first = rows(page).first();
    await expect(first).toContainText('out 1');
    await expect(first).toContainText('sensor 1');   // the summary line
    await expect(first).toContainText('20');
    await expect(first.locator('.de-grip')).toBeVisible();
  });

  test('dragging a row to the bottom reorders the saved array', async ({ page }) => {
    const saved = await mockApi(page);
    await openPanel(page);
    const baseline = saved.length;   // the first load normalises + saves the board

    const grip = rows(page).first().locator('.de-grip');
    const g = await grip.boundingBox();
    const last = await rows(page).last().boundingBox();
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(rows(page).last()).toContainText('out 1');
    await page.click('#de-save');

    await expect.poll(() => saved.length).toBeGreaterThan(baseline);
    const body = saved[saved.length - 1];
    expect(body.relays.map((r) => r.id)).toEqual(['o2', 'o3', 'o1']);
    // the config did not change — only the order
    const byId = Object.fromEntries(body.relays.map((r) => [r.id, r]));
    expect(byId.o1.sensor).toBe('sensor.s1');
    expect(byId.o1.temp).toBe(20);
    expect(byId.o1.relay).toBe('switch.dA_1');
  });

  test('closing without saving discards the draft order', async ({ page }) => {
    const saved = await mockApi(page);
    await openPanel(page);
    const baseline = saved.length;

    const grip = rows(page).first().locator('.de-grip');
    const g = await grip.boundingBox();
    const last = await rows(page).last().boundingBox();
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(rows(page).last()).toContainText('out 1');

    await page.click('#de-close');
    await expect(page.locator('#dev-editor')).toBeHidden();
    expect(saved.length).toBe(baseline);

    // reopen: the original order is back
    await openPanel(page);
    await expect(rows(page).first()).toContainText('out 1');
  });

  test('swap moves the configs and leaves the channels in place', async ({ page }) => {
    const saved = await mockApi(page);
    await openPanel(page);

    await page.click('#de-swap');
    await rows(page).nth(0).click();
    page.once('dialog', (d) => d.accept());
    await rows(page).nth(2).click();

    await expect.poll(() => saved.length).toBeGreaterThan(0);
    const body = saved[saved.length - 1];
    const byId = Object.fromEntries(body.relays.map((r) => [r.id, r]));
    // config travels
    expect(byId.o1.sensor).toBe('sensor.s3');
    expect(byId.o3.sensor).toBe('sensor.s1');
    // channel stays
    expect(byId.o1.relay).toBe('switch.dA_1');
    expect(byId.o3.relay).toBe('switch.dA_3');
    // order is untouched by a swap
    expect(body.relays.map((r) => r.id)).toEqual(['o1', 'o2', 'o3']);
  });

  test('a bound output cannot be swapped', async ({ page }) => {
    const saved = await mockApi(page, {
      relays: [output('o1', 1, { bound: true }), output('o2', 2), output('o3', 3)],
    });
    await openPanel(page);
    const baseline = saved.length;

    await page.click('#de-swap');
    await rows(page).nth(0).click();
    await rows(page).nth(1).click();

    await expect(page.locator('#de-msg')).toContainText('bound');
    expect(saved.length).toBe(baseline);
  });
});
