import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined, // keep 1 worker in CI for heavy 3D pages
  reporter: 'html',
  timeout: 120_000, // ✅ Increase test timeout to 2 minutes per test

  use: {
    baseURL: 'http://localhost:4200',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    headless: process.env['CI'] ? true : false, // ✅ Headless in CI
    viewport: { width: 1600, height: 900 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,

    launchOptions: {
      args: [
        '--disable-dev-shm-usage', // ✅ avoids memory issues on GitHub runners
        '--no-sandbox',
        '--disable-gpu',
      ],
    },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],

  webServer: {
    command: 'pnpm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000, // ✅ Increase dev server timeout for CI
    env: {
      CI: process.env['CI'] || '',
      VITE_SUPABASE_URL: process.env['VITE_SUPABASE_URL'] || '',
      VITE_SUPABASE_ANON_KEY: process.env['VITE_SUPABASE_ANON_KEY'] || '',
    },
  },
});
