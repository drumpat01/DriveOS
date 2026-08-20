import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './artifacts/playwright-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: './artifacts/playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: './artifacts/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8790',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }
    }
  ],
  webServer: {
    command: 'node tests/mock-web-server.mjs',
    url: 'http://127.0.0.1:8790/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
