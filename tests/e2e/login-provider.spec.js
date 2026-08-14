const { test, expect } = require('@playwright/test');
const demoLayout = require('../../src/demo-layout.json');

// The second sign-in provider is optional: configure EXTRA_AUTH_URL and the login
// modal grows a choice, leave it unset and the panel looks exactly as it always did.

async function mockApi(page, config = {}) {
  await Promise.all([
    page.route('**/api/layout', (route) => route.request().method() === 'GET'
      ? route.fulfill({ json: demoLayout })
      : route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/zorder', (route) => route.fulfill({ json: { ok: true } })),
    page.route('**/api/layout/backups', (route) => route.fulfill({ json: { ok: true, backups: [] } })),
    page.route('**/api/session', (route) => route.fulfill({ json: { ok: true, authed: false, user: null } })),
    page.route('**/api/entities', (route) => route.fulfill({ json: { switches: [], sensors: [] } })),
    page.route('**/api/areas', (route) => route.fulfill({ json: [] })),
    page.route('**/api/relay-devices', (route) => route.fulfill({ json: [] })),
    page.route('**/api/live**', (route) => route.fulfill({ json: {} })),
    page.route('**/api/automations', (route) => route.fulfill({ json: {} })),
    page.route('**/api/ha-status', (route) => route.fulfill({ json: { reachable: true } })),
    page.route('**/api/activity-log**', (route) => route.fulfill({ json: { entries: [], total: 0, page: 1, per_page: 15 } })),
    page.route('**/api/config', (route) => route.fulfill({ json: { kwsMapUrl: '', ...config } })),
  ]);
}

// signed out, so clicking Edit opens the login modal
const openLogin = async (page) => {
  await page.click('#btn-mode');
  await expect(page.locator('#login-modal')).toBeVisible();
};

test.describe('sign-in providers', () => {
  test('unconfigured: no choice is offered at all', async ({ page }) => {
    await mockApi(page, { extraAuth: { enabled: false } });
    await page.goto('/');
    await openLogin(page);
    await expect(page.locator('#login-providers')).toBeHidden();
    await expect(page.locator('#login-provider-name')).toHaveText('Home Assistant');
  });

  test('a config with no extraAuth key at all behaves as unconfigured', async ({ page }) => {
    await mockApi(page);                       // older server, or the key simply absent
    await page.goto('/');
    await openLogin(page);
    await expect(page.locator('#login-providers')).toBeHidden();
  });

  test('configured: the choice appears under its configured name', async ({ page }) => {
    await mockApi(page, { extraAuth: { enabled: true, label: 'Acme SSO' } });
    await page.goto('/');
    await openLogin(page);
    await expect(page.locator('#login-providers')).toBeVisible();
    await expect(page.locator('[data-provider="extra"]')).toHaveText('Acme SSO');
    await expect(page.locator('#login-provider-name')).toHaveText('Home Assistant');  // default
  });

  test('the picked provider is what the login request carries', async ({ page }) => {
    await mockApi(page, { extraAuth: { enabled: true, label: 'Acme SSO' } });
    let sent = null;
    await page.route('**/api/login', (route) => {
      sent = route.request().postDataJSON();
      route.fulfill({ status: 401, json: { ok: false, error: 'nope' } });
    });
    await page.goto('/');
    await openLogin(page);

    await page.fill('#login-user', 'someone');
    await page.fill('#login-pass', 'secret');
    await page.click('#login-submit');
    await expect.poll(() => sent && sent.provider).toBe('ha');       // default

    await page.click('[data-provider="extra"]');
    await expect(page.locator('#login-provider-name')).toHaveText('Acme SSO');
    await page.click('#login-submit');
    await expect.poll(() => sent && sent.provider).toBe('extra');
  });

  // Against the REAL server, not a mock: /api/config is the one thing the browser is
  // handed, and it must never carry the verifier's address — configured or not.
  test('the real /api/config never carries the verifier URL', async ({ request }) => {
    const cfg = await (await request.get('/api/config')).json();
    expect(cfg).toHaveProperty('extraAuth');
    expect(Object.keys(cfg.extraAuth).sort()).toEqual(
      cfg.extraAuth.enabled ? ['enabled', 'label'] : ['enabled'],
    );
    expect(JSON.stringify(cfg.extraAuth)).not.toMatch(/https?:\/\//);
  });

});
