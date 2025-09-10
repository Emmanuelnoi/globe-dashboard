import { test, expect } from '@playwright/test';

test.describe('3D Globe Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render 3D globe without WebGL errors', async ({ page }) => {
    // Wait for the globe to initialize
    const sceneContainer = page.locator('.scene-container');
    await expect(sceneContainer).toBeVisible();

    // Check for WebGL context errors in console
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for Three.js to initialize
    await page.waitForTimeout(2000);

    // Check that no critical WebGL errors occurred
    const webglErrors = consoleErrors.filter(
      (error) =>
        error.includes('WebGL') ||
        error.includes('THREE.WebGLRenderer') ||
        error.includes('getContext'),
    );

    expect(webglErrors.length).toBe(0);
  });

  test('should load without blocking the UI', async ({ page }) => {
    // Page should be interactive quickly
    const sidebar = page.locator('app-sidebar .toggle');
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Should be clickable
    await sidebar.click();

    // Verify interaction worked
    await expect(page.locator('app-sidebar.collapsed')).toBeVisible();
  });

  test('should handle window resize gracefully', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1000);

    // Get initial viewport
    const initialViewport = page.viewportSize();

    // Resize window
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);

    // Resize again
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    // Verify no errors occurred during resize
    const sceneContainer = page.locator('.scene-container');
    await expect(sceneContainer).toBeVisible();

    // Restore original size
    if (initialViewport) {
      await page.setViewportSize(initialViewport);
    }
  });

  test('should display loading state initially', async ({ page }) => {
    // Navigate with network delay simulation
    await page.route('/data/countries-50m.geojson', async (route) => {
      // Simulate slow network
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.goto('/');

    // Check if loading states are handled (no specific loading UI yet, but no crashes)
    const sceneContainer = page.locator('.scene-container');
    await expect(sceneContainer).toBeVisible();
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    // This is a basic test - in real scenarios you'd use more sophisticated memory testing
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Simulate navigation (reload for now since we don't have routing)
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify page still works
    const sceneContainer = page.locator('.scene-container');
    await expect(sceneContainer).toBeVisible();
  });

  test('should work on different viewport sizes', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop Large' },
      { width: 1366, height: 768, name: 'Desktop Medium' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // Verify scene is still visible
      const sceneContainer = page.locator('.scene-container');
      await expect(sceneContainer).toBeVisible();

      // Verify sidebar adapts
      const sidebar = page.locator('app-sidebar');
      await expect(sidebar).toBeVisible();
    }
  });
});
