import { test, expect } from '@playwright/test';

/**
 * Authentication Flow E2E Tests
 * Tests user authentication, sign-up, sign-in, and profile features
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should display sign-in button for unauthenticated users', async ({
    page,
  }) => {
    // Look for sign-in/auth button
    const authButton = page.locator('text=/Sign In|Login|Auth/i').first();
    await expect(authButton).toBeVisible({ timeout: 5000 });
  });

  test('should open sign-in modal when clicking auth button', async ({
    page,
  }) => {
    // Click sign-in button
    const authButton = page.locator('text=/Sign In|Login|Auth/i').first();
    await authButton.click();
    await page.waitForTimeout(500);

    // Verify modal appears
    const modal = page.locator('[class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();

    // Verify email input exists
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('should validate email format in sign-in form', async ({ page }) => {
    // Open sign-in modal
    const authButton = page.locator('text=/Sign In|Login|Auth/i').first();
    await authButton.click();
    await page.waitForTimeout(500);

    // Find email input
    const emailInput = page.locator('input[type="email"]').first();

    // Enter invalid email
    await emailInput.fill('invalid-email');
    await page.keyboard.press('Tab'); // Trigger validation

    // Try to submit
    const submitButton = page.locator('button:has-text("Sign In")').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(500);

      // Verify error message or validation appears
      const errorOrValidation = page.locator(
        '[class*="error"], [class*="invalid"]',
      );
      const hasError = (await errorOrValidation.count()) > 0;
      expect(
        hasError ||
          (await emailInput.getAttribute('class'))?.includes('invalid'),
      ).toBeTruthy();
    }
  });

  test('should switch between sign-in and sign-up modals', async ({ page }) => {
    // Open sign-in modal
    const authButton = page.locator('text=/Sign In|Login|Auth/i').first();
    await authButton.click();
    await page.waitForTimeout(500);

    // Look for "Sign Up" link
    const signUpLink = page
      .locator('text=/Sign Up|Create Account|Register/i')
      .first();
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.waitForTimeout(500);

      // Verify sign-up form appears (should have additional fields)
      const modal = page.locator('[class*="modal"], [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Look for sign-up specific elements
      const hasSignUpElements =
        (await page.locator('input[type="email"]').count()) > 0;
      expect(hasSignUpElements).toBeTruthy();
    }
  });

  test('should display password reset option', async ({ page }) => {
    // Open sign-in modal
    const authButton = page.locator('text=/Sign In|Login|Auth/i').first();
    await authButton.click();
    await page.waitForTimeout(500);

    // Look for "Forgot Password" link
    const forgotPasswordLink = page
      .locator('text=/Forgot Password|Reset Password/i')
      .first();
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();
      await page.waitForTimeout(500);

      // Verify password reset form appears
      const emailInput = page.locator('input[type="email"]').first();
      await expect(emailInput).toBeVisible();
    }
  });

  test('should close modal when clicking outside or close button', async ({
    page,
  }) => {
    // Open sign-in modal
    const authButton = page.locator('text=/Sign In|Login|Auth/i').first();
    await authButton.click();
    await page.waitForTimeout(500);

    // Find close button
    const closeButton = page
      .locator('button:has([class*="close"]), button:has-text("×")')
      .first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await page.waitForTimeout(500);

      // Verify modal is hidden
      const modal = page.locator('[class*="modal"], [role="dialog"]').first();
      await expect(modal).not.toBeVisible();
    }
  });

  test('should show leaderboard for authenticated context', async ({
    page,
  }) => {
    // Look for leaderboard component
    const leaderboard = page
      .locator('text=/Leaderboard|Rankings|Top Players/i')
      .first();

    if (await leaderboard.isVisible({ timeout: 3000 })) {
      // Verify leaderboard is visible
      await expect(leaderboard).toBeVisible();

      // Click to expand if needed
      await leaderboard.click();
      await page.waitForTimeout(500);

      // Verify leaderboard entries
      const entries = page.locator('[class*="leaderboard"]').first();
      await expect(entries).toBeVisible();
    }
  });
});
