const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  // The suite has races between assertions and the async boot()/render cycle, so
  // a clean run can still show one red test (#87). Retrying under CI reports those
  // as *flaky* rather than *failed*, which keeps a real regression legible - the
  // whole point of running this before a dependency migration.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8090',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
