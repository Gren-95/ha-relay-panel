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
