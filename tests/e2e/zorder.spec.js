const { test, expect } = require('@playwright/test');
const demoLayout = require('../../src/demo-layout.json');

// Same HA mocks as the smoke suite, but signed in (stacking order is only
// persisted for an authenticated session) and with a stateful layout: whatever
// the page PUTs to /api/layout/zorder is what the next GET /api/layout serves,
// so a reload really does read back what the last click wrote.
function mockApi(page, store) {
  const layout = () => ({ ...store.layout, updated_at: store.version });

  return Promise.all([
    page.route('**/api/layout', (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: layout() });
      const b = route.request().postDataJSON() || {};
      store.layout = { relays: b.relays || [], areas: b.areas || [], devices: b.devices || [] };
      store.version += 1;
      return route.fulfill({ json: layout() });
    }),
    page.route('**/api/layout/zorder', (route) => {
      const b = route.request().postDataJSON() || {};
      store.puts.push(b);
      for (const [key, map] of [['areas', b.areas], ['devices', b.devices], ['relays', b.relays]]) {
        for (const o of store.layout[key] || []) if (map && map[o.id] != null) o.z = map[o.id];
      }
      store.version += 1;
      return route.fulfill({ json: layout() });
    }),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: true, user: 'tester' } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [
      { id: 'area_living', name: 'Living room' }, { id: 'area_bedroom', name: 'Bedrooms' },
      { id: 'area_plant', name: 'Plant room' },
    ] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries: [], total: 0, page: 1, per_page: 15 } })),
    page.route('**/api/history**', (route) => route.fulfill({ json: { ok: true, rows: [], target: null } })),
  ]);
}

const newStore = () => ({ layout: JSON.parse(JSON.stringify(demoLayout)), version: 1, puts: [] });

// Wait for the app's explicit ready signal instead of racing boot()/render() (#87)
const ready = (page) => page.waitForSelector('body[data-ready="true"]', { timeout: 10000 });

// Rendered level of every board object — group boxes and cards share one scale.
const levelsOf = (page) => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#canvas .area, #canvas .relay')]
    .map((el) => [el.dataset.gid || el.dataset.id, Number(getComputedStyle(el).zIndex)])
));

// Two overlapping physical relays, three outputs each. Output positions are
// recomputed by reflowDeviceOutputs on every render, so only the boxes need x/y.
//
// The offsets matter: the boards have to overlap for stacking to mean anything,
// but each one's titlebar and the left half of its cards (where .r-name sits)
// must stay clear of the other, or the test can't click what it wants to click.
// A 360x384 box puts its cards at +10/+54, +164, +274, each 340x100.
function hardwareLayout(areaId) {
  const outputs = (dev, n) => Array.from({ length: n }, (_, i) => ({
    id: `${dev}o${i}`, name: `${dev} out ${i}`, relay: `switch.${dev}_${i}`, sensor: '',
    area: areaId || '', device: dev, mode: 'below', temp: 20, deadband: 0, bound: true, x: 0, y: 0,
  }));
  return {
    devices: [
      { id: 'dA', deviceId: 'devA', name: 'Relay board A', area: areaId || '', x: 40, y: 40 },
      { id: 'dB', deviceId: 'devB', name: 'Relay board B', area: areaId || '', x: 300, y: 240 },
    ],
    relays: [...outputs('dA', 3), ...outputs('dB', 3)],
    areas: areaId ? [{ id: 'a1', areaId, name: 'Plant room', x: 20, y: 20, w: 700, h: 700 }] : [],
  };
}

// Every level held by a physical relay: the box plus all of its outputs. This is
// the unit that has to move together.
const boardLevels = (z, dev) => Object.keys(z)
  .filter((id) => id === dev || id.startsWith(dev + 'o')).map((id) => z[id]);

// A container is painted under the things inside it — the one ordering rule that
// no click may ever break, or a box would swallow its own cards.
function expectContainment(z, layout) {
  const boxOfArea = (areaId) => (layout.areas.find((a) => a.areaId === areaId) || {}).id;
  for (const d of layout.devices) {
    const a = boxOfArea(d.area);
    if (a) expect(z[d.id], `device ${d.id} above its area`).toBeGreaterThan(z[a]);
  }
  for (const r of layout.relays) {
    if (r.device) expect(z[r.id], `card ${r.id} above its box`).toBeGreaterThan(z[r.device]);
    else {
      const a = boxOfArea(r.area);
      if (a) expect(z[r.id], `card ${r.id} above its area`).toBeGreaterThan(z[a]);
    }
  }
}

// A card click also opens the relay editor, whose backdrop then swallows the next
// click — so dismiss it before clicking the board again.
async function closeEditor(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#backdrop')).toBeHidden();
}

test.describe('board stacking order', () => {
  test('every object gets its own level, ten apart, containers underneath', async ({ page }) => {
    await mockApi(page, newStore());
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay').first()).toBeVisible();

    const z = await levelsOf(page);
    const n = demoLayout.relays.length + demoLayout.areas.length;
    const sorted = Object.values(z).sort((a, b) => a - b);
    expect(sorted.length).toBe(n);
    expect(new Set(sorted).size).toBe(n);                       // nothing shares a level
    expect(sorted).toEqual(sorted.map((_, i) => (i + 1) * 10)); // one contiguous run, step 10
    expectContainment(z, demoLayout);
  });

  // The production layout carries an orphaned `z: 3` on every relay, left behind
  // by something no version of the app ever read. Equal ranks must fall back to
  // list order, not collapse everything back onto one level.
  test('a layout where every object already has the same z still separates', async ({ page }) => {
    const seeded = newStore();
    seeded.layout.relays.forEach((r) => { r.z = 3; });
    await mockApi(page, seeded);
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay').first()).toBeVisible();
    const withZ = await levelsOf(page);

    expect(new Set(Object.values(withZ)).size).toBe(Object.keys(withZ).length);
    expectContainment(withZ, demoLayout);

    // and it lands on exactly the stack a layout with no `z` at all produces
    await page.context().clearCookies();
    const fresh = newStore();
    await mockApi(page, fresh);
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay').first()).toBeVisible();
    expect(await levelsOf(page)).toEqual(withZ);
  });

  test('clicking a card raises it above the others', async ({ page }) => {
    await mockApi(page, newStore());
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay').first()).toBeVisible();

    const before = await levelsOf(page);
    const cards = demoLayout.relays.map((r) => r.id);
    const lowest = cards.reduce((a, b) => (before[a] < before[b] ? a : b));

    await page.locator(`#canvas .relay[data-id="${lowest}"] .r-name`).click();
    const after = await levelsOf(page);
    expect(after[lowest]).toBe(Math.max(...Object.values(after)));
    expectContainment(after, demoLayout);
  });

  // Cards get one level each counting up from the bottom of the board, so on a
  // busy board they run straight through the range the overlays sit in. #canvas
  // isolates them into its own stacking context; drop that and they paint over.
  test('overlays still cover the board', async ({ page }) => {
    await mockApi(page, newStore());
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay').first()).toBeVisible();

    await page.locator('#canvas .relay').first().locator('.r-name').click();
    await expect(page.locator('#editor')).toBeVisible();

    // whatever is painted at the editor's centre must be the editor, not a card
    const onTop = await page.locator('#editor').evaluate((ed) => {
      const b = ed.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!(hit && hit.closest('#editor'));
    });
    expect(onTop).toBe(true);
    await expect(page.locator('header')).toBeVisible();
  });

  // A physical relay is one object: the box plus the outputs pinned inside it.
  // Clicking any part of it must lift the whole thing over the whole of the board
  // next to it — box included, not just the cards.
  for (const areaId of ['', 'area_plant']) {
    const where = areaId ? 'inside an area' : 'on the bare canvas';

    test(`clicking one output raises the whole physical relay (${where})`, async ({ page }) => {
      const store = newStore();
      store.layout = hardwareLayout(areaId);
      await mockApi(page, store);
      await page.goto('/');
      await ready(page);
      await expect(page.locator('#canvas .relay')).toHaveCount(6);

      await page.locator('#canvas .relay[data-id="dBo1"] .r-name').click();
      const z = await levelsOf(page);
      // board B — its box AND its outputs — clears the whole of board A
      expect(Math.min(...boardLevels(z, 'dB'))).toBeGreaterThan(Math.max(...boardLevels(z, 'dA')));
      expectContainment(z, store.layout);

      // now the other board, to prove it swaps back rather than sticking
      await closeEditor(page);
      await page.locator('#canvas .relay[data-id="dAo2"] .r-name').click();
      const z2 = await levelsOf(page);
      expect(Math.min(...boardLevels(z2, 'dA'))).toBeGreaterThan(Math.max(...boardLevels(z2, 'dB')));
      expectContainment(z2, store.layout);
    });
  }

  test('clicking the physical relay box raises it the same way', async ({ page }) => {
    const store = newStore();
    store.layout = hardwareLayout('');
    await mockApi(page, store);
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay')).toHaveCount(6);

    await page.locator('#canvas .area[data-gid="dB"] .area-head').click();
    const z = await levelsOf(page);
    expect(Math.min(...boardLevels(z, 'dB'))).toBeGreaterThan(Math.max(...boardLevels(z, 'dA')));
    expectContainment(z, store.layout);
  });

  test('a board keeps its outputs in output order, and they stay put', async ({ page }) => {
    const store = newStore();
    store.layout = hardwareLayout('');
    await mockApi(page, store);
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay')).toHaveCount(6);

    // outputs are pinned in a vertical stack inside the box and can never overlap
    // each other, so their levels follow output order — clicking one does not
    // reshuffle the board's own cards
    await page.locator('#canvas .relay[data-id="dBo1"] .r-name').click();
    const z = await levelsOf(page);
    expect(z.dBo0).toBeLessThan(z.dBo1);
    expect(z.dBo1).toBeLessThan(z.dBo2);

    const tops = await page.evaluate(() => ['dBo0', 'dBo1', 'dBo2']
      .map((id) => document.querySelector(`.relay[data-id="${id}"]`).getBoundingClientRect().top));
    expect(tops[0]).toBeLessThan(tops[1]);
    expect(tops[1]).toBeLessThan(tops[2]);
  });

  test('the click order is written to the server and survives a reload', async ({ page }) => {
    const store = newStore();
    store.layout = hardwareLayout('');
    await mockApi(page, store);
    await page.goto('/');
    await ready(page);
    await expect(page.locator('#canvas .relay')).toHaveCount(6);

    await page.locator('#canvas .relay[data-id="dAo0"] .r-name').click();
    await expect.poll(() => store.puts.length, { timeout: 5000 }).toBeGreaterThan(0);

    await page.reload();
    await ready(page);
    await expect(page.locator('#canvas .relay')).toHaveCount(6);
    const z = await levelsOf(page);
    expect(Math.min(...boardLevels(z, 'dA'))).toBeGreaterThan(Math.max(...boardLevels(z, 'dB')));
  });
});
