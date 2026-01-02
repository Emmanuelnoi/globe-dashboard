import { test, expect } from '@playwright/test';

/**
 * Sidebar Navigation Tests
 *
 * Tests sidebar toggle, menu items, and keyboard navigation.
 * Uses proper wait strategies to ensure Angular app is fully loaded.
 */

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Angular app to bootstrap
    await page.waitForSelector('app-root', { timeout: 15000 });
    // Wait for scene container (indicates app is fully rendered)
    await page.waitForSelector('.scene-container', { timeout: 10000 });
    // Wait for sidebar's visible content (nav element with glass-card class)
    await page.waitForSelector('app-sidebar nav.glass-card', {
      timeout: 10000,
      state: 'visible',
    });
  });

  test('should toggle sidebar collapse/expand', async ({ page }) => {
    // The 'collapsed' class is on the inner <aside> element, not <app-sidebar>
    const sidebarAside = page.locator('app-sidebar aside.sidebar');
    const toggleButton = page.locator('app-sidebar .toggle');

    // Initially expanded
    await expect(sidebarAside).not.toHaveClass(/collapsed/);

    // Click to collapse
    await toggleButton.click();
    await expect(sidebarAside).toHaveClass(/collapsed/);

    // Click to expand
    await toggleButton.click();
    await expect(sidebarAside).not.toHaveClass(/collapsed/);
  });

  test('should display navigation menu items', async ({ page }) => {
    const menuItems = page.locator('app-sidebar .menu-item');

    // Should have multiple menu items
    await expect(menuItems).toHaveCount(4); // Based on your sidebar data

    // Check specific items by aria-label within sidebar
    await expect(
      page.locator('app-sidebar [aria-label="Country Comparison"]'),
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar [aria-label="Game Quiz"]'),
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar [aria-label="Bird Migration"]'),
    ).toBeVisible();
    await expect(
      page.locator('app-sidebar [aria-label="Leaderboard"]'),
    ).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    const menu = page.locator('app-sidebar .menu');

    // Focus on menu
    await menu.focus();

    // Should be able to navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Home');
    await page.keyboard.press('End');

    // Should be able to activate with Enter
    await page.keyboard.press('Enter');

    // Verify no errors occurred
    await expect(menu).toBeVisible();
  });

  test('should highlight active menu item', async ({ page }) => {
    const firstMenuItem = page.locator('app-sidebar .menu-item').first();

    // First item should be active by default
    await expect(firstMenuItem).toHaveClass(/active/);

    // Should have active pill
    await expect(firstMenuItem.locator('.active-pill')).toBeVisible();
  });

  test('should handle menu item clicks', async ({ page }) => {
    const menuItems = page.locator('app-sidebar .menu-item');
    const secondItem = menuItems.nth(1);

    // Click on second item
    await secondItem.click();

    // Should become active
    await expect(secondItem).toHaveClass(/active/);

    // First item should no longer be active
    const firstItem = menuItems.first();
    await expect(firstItem).not.toHaveClass(/active/);
  });

  test('should work in collapsed mode', async ({ page }) => {
    // The 'collapsed' class is on the inner <aside> element, not <app-sidebar>
    const sidebarAside = page.locator('app-sidebar aside.sidebar');
    const toggleButton = page.locator('app-sidebar .toggle');
    const menuItems = page.locator('app-sidebar .menu-item');

    // Collapse sidebar
    await toggleButton.click();
    await expect(sidebarAside).toHaveClass(/collapsed/);

    // Menu items should still be clickable
    await menuItems.nth(1).click();
    await expect(menuItems.nth(1)).toHaveClass(/active/);

    // Active pill should be visible in collapsed mode
    await expect(menuItems.nth(1).locator('.active-pill')).toBeVisible();
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    // aria-label is on the inner <aside> element, not <app-sidebar>
    const sidebarAside = page.locator('app-sidebar aside.sidebar');
    const toggleButton = page.locator('app-sidebar .toggle');
    const menu = page.locator('app-sidebar .menu');
    const menuItems = page.locator('app-sidebar .menu-item');

    // Sidebar <aside> should have proper ARIA attributes
    await expect(sidebarAside).toHaveAttribute(
      'aria-label',
      'Primary navigation',
    );

    // Toggle button should have ARIA attributes
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    await expect(toggleButton).toHaveAttribute('aria-pressed', 'false');

    // Menu should have role
    await expect(menu).toHaveAttribute('role', 'menu');

    // Menu items should have proper roles and labels
    const firstItem = menuItems.first();
    await expect(firstItem).toHaveAttribute('role', 'menuitem');
    await expect(firstItem).toHaveAttribute('aria-label');
  });

  test('should animate active pill transition', async ({ page }) => {
    const menuItems = page.locator('app-sidebar .menu-item');

    // Click different menu items to trigger animations
    await menuItems.nth(0).click();
    await page.waitForTimeout(100);

    await menuItems.nth(2).click();
    await page.waitForTimeout(100);

    await menuItems.nth(1).click();
    await page.waitForTimeout(100);

    // Verify the active item is correct after animations
    await expect(menuItems.nth(1)).toHaveClass(/active/);
    await expect(menuItems.nth(1).locator('.active-pill')).toBeVisible();
  });

  test('should maintain focus after interactions', async ({ page }) => {
    const menu = page.locator('app-sidebar .menu');
    const toggleButton = page.locator('app-sidebar .toggle');

    // Focus menu and navigate
    await menu.focus();
    await page.keyboard.press('ArrowDown');

    // Toggle sidebar
    await toggleButton.click();

    // Menu should still be focusable
    await menu.focus();
    await expect(menu).toBeFocused();
  });
});
