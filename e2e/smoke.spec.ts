import { test, expect } from '@playwright/test';

/**
 * SMOKE TESTS - Fast CI Tests (<2 minutes total)
 *
 * These tests verify critical functionality without heavy waits.
 * Run on every PR/push. For comprehensive tests, see nightly workflow.
 *
 * Rules:
 * - No networkidle waits
 * - No arbitrary timeouts
 * - Skip unavailable features with test.skip()
 * - Each test should complete in <10 seconds
 */

test.describe('Smoke Tests @ci', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Angular app to bootstrap
    await page.waitForSelector('app-root', { timeout: 15000 });
    // Wait for scene container which indicates Three.js has initialized
    await page.waitForSelector('.scene-container', { timeout: 10000 });
  });

  test('app loads without crashing', async ({ page }) => {
    // Verify main container exists
    const appRoot = page.locator('app-root');
    await expect(appRoot).toBeVisible({ timeout: 5000 });
  });

  test('globe container renders', async ({ page }) => {
    const sceneContainer = page.locator('.scene-container');
    await expect(sceneContainer).toBeVisible({ timeout: 5000 });
  });

  test('sidebar is visible', async ({ page }) => {
    // Check for sidebar's inner visible content (nav.glass-card)
    const sidebarNav = page.locator('app-sidebar nav.glass-card');
    await expect(sidebarNav).toBeVisible({ timeout: 5000 });
  });

  test('sidebar toggle works', async ({ page }) => {
    // The 'collapsed' class is on the inner <aside> element, not <app-sidebar>
    const sidebarAside = page.locator('app-sidebar aside.sidebar');
    const toggle = page.locator('app-sidebar .toggle');

    // Wait for toggle to be ready
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Click to collapse
    await toggle.click();
    await expect(sidebarAside).toHaveClass(/collapsed/, { timeout: 3000 });

    // Click to expand
    await toggle.click();
    await expect(sidebarAside).not.toHaveClass(/collapsed/, { timeout: 3000 });
  });

  test('menu items are clickable', async ({ page }) => {
    const menuItems = page.locator('app-sidebar .menu-item');

    // Wait for menu to load
    await expect(menuItems.first()).toBeVisible({ timeout: 5000 });

    // Click second item
    await menuItems.nth(1).click();
    await expect(menuItems.nth(1)).toHaveClass(/active/, { timeout: 3000 });
  });

  test('page has required accessibility landmarks', async ({ page }) => {
    // Check for main landmark (required for WCAG)
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 5000 });

    // Check for h1 (required for WCAG)
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1, { timeout: 5000 });
  });

  test('canvas has accessibility attributes', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });

    // Verify ARIA attributes exist
    const ariaLabel = await canvas.getAttribute('aria-label');
    const role = await canvas.getAttribute('role');
    expect(ariaLabel || role).toBeTruthy();
  });

  test('no critical console errors', async ({ page }) => {
    const criticalErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Only capture truly critical errors
        if (
          text.includes('Uncaught') ||
          text.includes('WebGL') ||
          text.includes('FATAL')
        ) {
          criticalErrors.push(text);
        }
      }
    });

    // Navigate and wait briefly
    await page.goto('/');
    await page.waitForSelector('.scene-container', { timeout: 5000 });

    expect(criticalErrors).toHaveLength(0);
  });
});
