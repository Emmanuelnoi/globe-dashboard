import { test, expect } from '@playwright/test';

test.describe('3D Global Dashboard - Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the main page', async ({ page }) => {
    await expect(page).toHaveTitle(/3d-global-dashboard/);
  });

  test('should display the globe component', async ({ page }) => {
    // Wait for the scene container to be visible
    const sceneContainer = page.locator('.scene-container');
    await expect(sceneContainer).toBeVisible();
  });

  test('should display the sidebar', async ({ page }) => {
    const sidebar = page.locator('app-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('should have sidebar navigation items', async ({ page }) => {
    // Wait for sidebar to load
    const sidebar = page.locator('app-sidebar');
    await expect(sidebar).toBeVisible();

    // Check for navigation menu
    const menuItems = page.locator('.menu-item');
    await expect(menuItems.first()).toBeVisible();
  });

  test('should display comparison card component', async ({ page }) => {
    const comparisonCard = page.locator('app-comparison-card');
    await expect(comparisonCard).toBeVisible();
  });
});
