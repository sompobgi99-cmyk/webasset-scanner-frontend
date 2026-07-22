const { defineConfig, devices } = require('@playwright/test');
const fs = require('node:fs');

const staticRoot = fs.existsSync('dist/index.html') ? 'dist' : '.';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  snapshotPathTemplate: '{testDir}/visual-snapshots/{projectName}/{arg}{ext}',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx http-server ${staticRoot} -p 4173 -c-1`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'mobile-light', use: { ...devices['Pixel 5'], colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['Pixel 5'], colorScheme: 'dark' } },
  ],
});
