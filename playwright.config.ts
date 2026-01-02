import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for 3D Global Dashboard
 *
 * Optimized for:
 * - Fast CI execution (chromium only, 15-minute timeout)
 * - Comprehensive local testing (all browsers)
 * - Heavy 3D rendering workloads
 * - Accessibility testing
 */

const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',

  // Run tests in parallel locally, serial in CI for stability
  fullyParallel: !isCI,

  // Fail CI build if test.only is committed
  forbidOnly: isCI,

  // Retry failed tests in CI
  retries: isCI ? 2 : 0,

  // Single worker in CI for heavy 3D pages, auto-detect locally
  workers: isCI ? 1 : undefined,

  // HTML report for local viewing
  reporter: isCI ? [['html'], ['github']] : 'html',

  // Global test timeout (2 minutes per test)
  timeout: 120_000,

  // Expect timeout for assertions
  expect: {
    timeout: 10_000,
  },

  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:4200',

    // Debugging features
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',

    // Browser settings
    headless: isCI,
    viewport: { width: 1600, height: 900 },

    // Timeouts for actions and navigation
    actionTimeout: 30_000,
    navigationTimeout: 60_000,

    // Ignore HTTPS errors (for development)
    ignoreHTTPSErrors: true,

    // Browser launch options
    launchOptions: {
      args: [
        '--disable-dev-shm-usage', // Prevents memory issues on GitHub runners
        '--no-sandbox', // Required for CI environments
        '--disable-gpu', // Prevents GPU issues in headless mode
        '--disable-web-security', // For local API testing
      ],
    },
  },

  // Browser projects
  // CI: Only chromium (58 tests × 8s = ~8 minutes, stays under 15-minute timeout)
  // Local: All browsers for comprehensive testing
  projects: isCI
    ? [
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
            // Additional chromium settings for CI
            launchOptions: {
              args: [
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dev-shm-usage',
              ],
            },
          },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'Mobile Chrome',
          use: { ...devices['Pixel 5'] },
        },
        {
          name: 'Mobile Safari',
          use: { ...devices['iPhone 12'] },
        },
      ],

  // Dev server configuration
  webServer: {
    command: 'pnpm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !isCI,
    timeout: 180_000, // 3 minutes for dev server to start
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      CI: process.env['CI'] || '',
      VITE_SUPABASE_URL: process.env['VITE_SUPABASE_URL'] || '',
      VITE_SUPABASE_ANON_KEY: process.env['VITE_SUPABASE_ANON_KEY'] || '',
    },
  },
});
