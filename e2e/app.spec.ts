import { test, expect } from '@playwright/test';

/**
 * Basic Functionality Tests for GlobePlay
 *
 * These tests verify core UI elements are rendered correctly.
 * Uses proper wait strategies to ensure Angular app is fully loaded.
 */

test.describe('GlobePlay - Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Angular app to bootstrap and render
    await page.waitForSelector('app-root', { timeout: 15000 });
    // Wait for scene container which indicates Three.js has initialized
    await page.waitForSelector('.scene-container', { timeout: 10000 });
  });

  test('should load the main page', async ({ page }) => {
    // Match actual title: "GlobePlay - Interactive Geography, Bird Migration & Quiz"
    await expect(page).toHaveTitle(/GlobePlay/);
  });

  test('should display the globe component', async ({ page }) => {
    const sceneContainer = page.locator('.scene-container');
    await expect(sceneContainer).toBeVisible({ timeout: 5000 });
  });

  test('should display the sidebar', async ({ page }) => {
    // Wait for sidebar's inner content to be visible (not just the element)
    const sidebarNav = page.locator('app-sidebar nav.glass-card');
    await expect(sidebarNav).toBeVisible({ timeout: 5000 });
  });

  test('should have sidebar navigation items', async ({ page }) => {
    // Wait for menu items to render
    const menuItems = page.locator('.menu-item');
    await expect(menuItems.first()).toBeVisible({ timeout: 5000 });

    // Should have at least one menu item
    const count = await menuItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display comparison card component', async ({ page }) => {
    // Wait for comparison card's inner content
    const comparisonCard = page.locator('app-comparison-card');
    await expect(comparisonCard).toBeAttached({ timeout: 5000 });
  });
});
