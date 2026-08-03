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

// z-index of every card, keyed by relay id
const cardZ = (page) => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#canvas .relay')].map((el) => [el.dataset.id, Number(getComputedStyle(el).zIndex)])
));
const boxZ = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .area')]
  .map((el) => Number(getComputedStyle(el).zIndex)));
// z-index of every group box, keyed by its layout id
const groupZ = (page) => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#canvas .area')].map((el) => [el.dataset.gid, Number(getComputedStyle(el).zIndex)])
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
const outsOf = (zs, dev) => Object.keys(zs).filter((id) => id.startsWith(dev)).map((id) => zs[id]);

// A card click also opens the relay editor, whose backdrop then swallows the next
// click — so dismiss it before clicking the board again.
async function closeEditor(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#backdrop')).toBeHidden();
}

test.describe('board stacking order', () => {
  test('every card gets its own z-index, ten apart, above the group boxes', async ({ page }) => {
    await mockApi(page, newStore());
    await page.goto('/');
    await expect(page.locator('#canvas .relay').first()).toBeVisible();

    const zs = Object.values(await cardZ(page)).sort((a, b) => a - b);
    expect(zs.length).toBe(demoLayout.relays.length);
    expect(new Set(zs).size).toBe(zs.length);                 // no two cards share a level
    for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBe(10);

    // the tier invariant: an area box can never be raised over the cards it holds
    expect(Math.max(...(await boxZ(page)))).toBeLessThan(Math.min(...zs));
  });

  // The production layout carries an orphaned `z: 3` on every relay, left behind
  // by something no version of the app ever read. Equal ranks must fall back to
  // array order, not collapse back onto one level.
  test('a layout where every object already has the same z still separates', async ({ page }) => {
    const store = newStore();
    store.layout.relays.forEach((r) => { r.z = 3; });
    await mockApi(page, store);
    await page.goto('/');
    await expect(page.locator('#canvas .relay').first()).toBeVisible();

    const zs = await cardZ(page);
    expect(new Set(Object.values(zs)).size).toBe(store.layout.relays.length);
    // ties break on array order, i.e. exactly how the board painted them before
    const order = Object.keys(zs).sort((a, b) => zs[a] - zs[b]);
    expect(order).toEqual(demoLayout.relays.map((r) => r.id));
  });

  test('clicking a card raises it above the others', async ({ page }) => {
    await mockApi(page, newStore());
    await page.goto('/');
    await expect(page.locator('#canvas .relay').first()).toBeVisible();

    const before = await cardZ(page);
    const lowest = Object.keys(before).reduce((a, b) => (before[a] < before[b] ? a : b));
    expect(before[lowest]).toBe(Math.min(...Object.values(before)));

    await page.locator(`#canvas .relay[data-id="${lowest}"] .r-name`).click();
    const after = await cardZ(page);
    expect(after[lowest]).toBe(Math.max(...Object.values(after)));
  });

  // Cards carry z-indexes in the millions. #canvas isolates them into its own
  // stacking context; drop that and they paint straight over the overlays.
  test('overlays still cover the board', async ({ page }) => {
    await mockApi(page, newStore());
    await page.goto('/');
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

  // A physical relay is one object on the board: its outputs are pinned inside the
  // box and cannot be moved out, so the box and every output must travel together.
  // Raising only the clicked card left the rest of the group buried under the
  // neighbouring board — the "finicky" interleaving.
  for (const areaId of ['', 'area_plant']) {
    const where = areaId ? 'inside an area' : 'on the bare canvas';

    test(`clicking one output raises its whole physical relay (${where})`, async ({ page }) => {
      const store = newStore();
      store.layout = hardwareLayout(areaId);
      await mockApi(page, store);
      await page.goto('/');
      await expect(page.locator('#canvas .relay')).toHaveCount(6);

      await page.locator('#canvas .relay[data-id="dBo1"] .r-name').click();

      const zs = await cardZ(page);
      // every output of board B now sits above every output of board A
      expect(Math.min(...outsOf(zs, 'dB'))).toBeGreaterThan(Math.max(...outsOf(zs, 'dA')));
      // and the one actually clicked is on top
      expect(zs.dBo1).toBe(Math.max(...Object.values(zs)));
      // the box itself comes with them, above the other board's box
      const boxes = await groupZ(page);
      expect(boxes.dB).toBeGreaterThan(boxes.dA);

      // now the other board, to prove it swaps back rather than sticking
      await closeEditor(page);
      await page.locator('#canvas .relay[data-id="dAo2"] .r-name').click();
      const zs2 = await cardZ(page);
      expect(Math.min(...outsOf(zs2, 'dA'))).toBeGreaterThan(Math.max(...outsOf(zs2, 'dB')));
      expect(zs2.dAo2).toBe(Math.max(...Object.values(zs2)));
      const boxes2 = await groupZ(page);
      expect(boxes2.dA).toBeGreaterThan(boxes2.dB);
    });
  }

  test('clicking the physical relay box raises its outputs too', async ({ page }) => {
    const store = newStore();
    store.layout = hardwareLayout('');
    await mockApi(page, store);
    await page.goto('/');
    await expect(page.locator('#canvas .relay')).toHaveCount(6);

    await page.locator('#canvas .area[data-gid="dB"] .area-head').click();
    const zs = await cardZ(page);
    expect(Math.min(...outsOf(zs, 'dB'))).toBeGreaterThan(Math.max(...outsOf(zs, 'dA')));
    const boxes = await groupZ(page);
    expect(boxes.dB).toBeGreaterThan(boxes.dA);
  });

  test('outputs keep their order inside the box when it is raised', async ({ page }) => {
    const store = newStore();
    store.layout = hardwareLayout('');
    await mockApi(page, store);
    await page.goto('/');
    await expect(page.locator('#canvas .relay')).toHaveCount(6);

    // the middle output is clicked, so it lands on top — but the other two must
    // still stack in their original order underneath, not shuffle
    await page.locator('#canvas .relay[data-id="dBo1"] .r-name').click();
    const zs = await cardZ(page);
    expect(zs.dBo1).toBeGreaterThan(zs.dBo2);
    expect(zs.dBo2).toBeGreaterThan(zs.dBo0);

    // and the cards are still laid out top-to-bottom in output order
    const tops = await page.evaluate(() => ['dBo0', 'dBo1', 'dBo2']
      .map((id) => document.querySelector(`.relay[data-id="${id}"]`).getBoundingClientRect().top));
    expect(tops[0]).toBeLessThan(tops[1]);
    expect(tops[1]).toBeLessThan(tops[2]);
  });

  test('the click order is written to the server and survives a reload', async ({ page }) => {
    const store = newStore();
    await mockApi(page, store);
    await page.goto('/');
    await expect(page.locator('#canvas .relay').first()).toBeVisible();

    const before = await cardZ(page);
    const lowest = Object.keys(before).reduce((a, b) => (before[a] < before[b] ? a : b));
    await page.locator(`#canvas .relay[data-id="${lowest}"] .r-name`).click();
    await expect.poll(() => store.puts.length, { timeout: 5000 }).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('#canvas .relay').first()).toBeVisible();
    const after = await cardZ(page);
    expect(after[lowest]).toBe(Math.max(...Object.values(after)));
  });
});
