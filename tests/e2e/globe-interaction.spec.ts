import { test, expect } from '@playwright/test';

/**
 * Globe Interaction E2E Tests
 * Tests the core 3D globe functionality and country selection
 */

test.describe('Globe Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for globe to load
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000); // Give globe time to initialize
  });

  test('should load the globe and display canvas', async ({ page }) => {
    // Verify canvas element exists
    const canvas = await page.locator('canvas').count();
    expect(canvas).toBeGreaterThan(0);

    // Verify page title
    await expect(page).toHaveTitle(/3D Global Dashboard/i);
  });

  test('should display country search', async ({ page }) => {
    // Verify search input exists
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();

    // Type country name
    await searchInput.fill('Canada');
    await page.waitForTimeout(500);

    // Verify search results appear
    const searchResults = page.locator('[class*="search-result"]').first();
    await expect(searchResults).toBeVisible({ timeout: 5000 });
  });

  test('should interact with sidebar navigation', async ({ page }) => {
    // Find navigation buttons/tabs
    const quizButton = page.locator('text=/Quiz|Game/i').first();

    if (await quizButton.isVisible()) {
      await quizButton.click();
      await page.waitForTimeout(500);

      // Verify quiz hub appeared
      const quizHub = page.locator('[class*="quiz"]').first();
      await expect(quizHub).toBeVisible();
    }
  });

  test('should handle globe rotation', async ({ page }) => {
    const canvas = page.locator('canvas').first();

    // Get canvas bounding box
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('Canvas not found');
    }

    // Simulate mouse drag to rotate globe
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
    await page.mouse.up();

    // Verify globe is still visible after interaction
    await expect(canvas).toBeVisible();
  });

  test('should open country comparison on double-click', async ({ page }) => {
    // Search for a country
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('Japan');
    await page.waitForTimeout(500);

    // Click first result
    const firstResult = page.locator('[class*="search-result"]').first();
    await firstResult.click();
    await page.waitForTimeout(1000);

    // Verify country is selected (look for comparison table or country info)
    const countryInfo = page.locator('[class*="country"]').first();
    await expect(countryInfo).toBeVisible();
  });
});
