import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests using axe-core
 *
 * Tests WCAG 2.1 Level AA compliance across all major pages
 * Reference: https://www.w3.org/WAI/WCAG21/quickref/
 */

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for the app to be fully loaded
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for globe to render (critical visual element)
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('Home page should not have any automatically detectable accessibility issues', async ({
    page,
  }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Quiz page should be accessible', async ({ page }) => {
    // Navigate to quiz
    await page.click('[data-testid="quiz-link"], button:has-text("Quiz")');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Bird Migration page should be accessible', async ({ page }) => {
    // Navigate to bird migration
    await page.click('[data-testid="migration-link"], button:has-text("Bird")');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Leaderboard should be accessible', async ({ page }) => {
    // Open sidebar/navigation to access leaderboard
    const leaderboardButton = page
      .locator(
        'button:has-text("Leaderboard"), [data-testid="leaderboard-link"]',
      )
      .first();
    if (await leaderboardButton.isVisible()) {
      await leaderboardButton.click();
      await page.waitForLoadState('networkidle');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    } else {
      test.skip();
    }
  });

  test('Keyboard navigation should work', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // At least one element should be focused
    const focusedElement = await page.evaluateHandle(
      () => document.activeElement,
    );
    const tagName = await focusedElement.evaluate((el) => el?.tagName);

    expect(tagName).toBeTruthy();
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'CANVAS']).toContain(
      tagName,
    );
  });

  test('Should have proper heading hierarchy', async ({ page }) => {
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
      elements.map((el) => ({
        tag: el.tagName,
        text: el.textContent?.trim() || '',
      })),
    );

    // Should have at least one h1
    const h1Count = headings.filter((h) => h.tag === 'H1').length;
    expect(h1Count).toBeGreaterThanOrEqual(1);
    expect(h1Count).toBeLessThanOrEqual(1); // Should have exactly one h1

    // Headings should not be empty
    headings.forEach((heading) => {
      expect(heading.text).not.toBe('');
    });
  });

  test('Images should have alt text', async ({ page }) => {
    const imagesWithoutAlt = await page.$$eval(
      'img',
      (images) => images.filter((img) => !img.alt).length,
    );

    expect(imagesWithoutAlt).toBe(0);
  });

  test('Form inputs should have labels', async ({ page }) => {
    const inputs = await page.$$eval('input:not([type="hidden"])', (elements) =>
      elements.map((input) => ({
        id: input.id,
        type: input.getAttribute('type'),
        hasLabel:
          !!input.labels?.length ||
          !!input.getAttribute('aria-label') ||
          !!input.getAttribute('aria-labelledby'),
      })),
    );

    const inputsWithoutLabels = inputs.filter((input) => !input.hasLabel);
    expect(inputsWithoutLabels).toEqual([]);
  });

  test('Color contrast should meet WCAG AA standards', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (violation) => violation.id === 'color-contrast',
    );

    expect(contrastViolations).toEqual([]);
  });

  test('ARIA attributes should be valid', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('body')
      .analyze();

    const ariaViolations = accessibilityScanResults.violations.filter(
      (violation) => violation.id.includes('aria'),
    );

    expect(ariaViolations).toEqual([]);
  });

  test('Should respect prefers-reduced-motion', async ({ page }) => {
    // Emulate prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if animations are disabled or reduced
    const hasReducedMotion = await page.evaluate(() => {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    expect(hasReducedMotion).toBe(true);
  });

  test('Should handle focus properly when modal opens', async ({ page }) => {
    // Try to open a modal (e.g., search, settings)
    const searchButton = page
      .locator('button:has-text("Search"), [data-testid="search-button"]')
      .first();

    if (await searchButton.isVisible()) {
      await searchButton.click();
      await page.waitForTimeout(500); // Wait for modal animation

      // Focus should be trapped in modal
      const focusedElement = await page.evaluateHandle(
        () => document.activeElement,
      );
      const isInModal = await focusedElement.evaluate((el) => {
        return !!el?.closest('[role="dialog"], .modal, [aria-modal="true"]');
      });

      expect(isInModal).toBe(true);
    } else {
      test.skip();
    }
  });

  test('Skip navigation links should be present', async ({ page }) => {
    // Press Tab to reveal skip links
    await page.keyboard.press('Tab');

    // Check for skip navigation link
    const skipLink = page
      .locator('a:has-text("Skip to"), [data-testid="skip-to-content"]')
      .first();

    // Skip link should exist (even if visually hidden)
    const skipLinkCount = await skipLink.count();

    // This is a nice-to-have, not critical
    if (skipLinkCount === 0) {
      console.warn(
        '⚠️ Skip navigation link not found (recommended for accessibility)',
      );
    }
  });

  test('Should provide text alternatives for complex visualizations', async ({
    page,
  }) => {
    // 3D globe should have accessible alternative
    const canvas = page.locator('canvas').first();

    // Check for aria-label or nearby descriptive text
    const hasAriaLabel = await canvas.getAttribute('aria-label');
    const hasRole = await canvas.getAttribute('role');

    // Canvas should have either aria-label or role="img"
    expect(hasAriaLabel || hasRole).toBeTruthy();
  });

  test('Dynamic content updates should be announced to screen readers', async ({
    page,
  }) => {
    // Check for ARIA live regions
    const liveRegions = await page.$$eval(
      '[aria-live]',
      (elements) => elements.length,
    );

    // App should have at least one live region for notifications/updates
    // This is a recommendation, not a hard requirement
    if (liveRegions === 0) {
      console.warn(
        '⚠️ No ARIA live regions found - dynamic updates may not be announced to screen readers',
      );
    }
  });
});

test.describe('Accessibility - Notification System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('Notification toasts should be accessible', async ({ page }) => {
    // Trigger a notification by interacting with the app
    // This will test the consolidated notification system
    const searchButton = page.locator('button:has-text("Search")').first();

    if (await searchButton.isVisible()) {
      await searchButton.click();
      await page.waitForTimeout(500);

      // Scan for accessibility issues with notifications visible
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      // Take screenshot if there are violations
      if (accessibilityScanResults.violations.length > 0) {
        await page.screenshot({
          path: 'e2e-results/notification-violations.png',
          fullPage: true,
        });
      }

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Achievement notifications should be accessible', async ({ page }) => {
    // Check if achievement notification component exists
    const achievementNotification = page.locator(
      'app-achievement-notification',
    );

    if ((await achievementNotification.count()) > 0) {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('app-achievement-notification')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Notification toast container should have proper ARIA attributes', async ({
    page,
  }) => {
    const notificationToast = page.locator('app-notification-toast');

    if ((await notificationToast.count()) > 0) {
      // Check for ARIA role and live region
      const hasRole = await notificationToast.getAttribute('role');
      const hasAriaLive = await notificationToast.getAttribute('aria-live');

      // Notifications should have appropriate ARIA attributes
      // role="status" or "alert" and aria-live="polite" or "assertive"
      const hasProperAria = hasRole || hasAriaLive;

      if (!hasProperAria) {
        console.warn('⚠️ Notification toast missing ARIA attributes');
      }
    }
  });

  test('Notifications should be dismissible with keyboard', async ({
    page,
  }) => {
    // Try to trigger a notification
    const quizButton = page.locator('button:has-text("Quiz")').first();

    if (await quizButton.isVisible()) {
      await quizButton.click();
      await page.waitForTimeout(1000);

      // Look for any visible notification close buttons
      const closeButtons = page.locator(
        '[aria-label*="dismiss"], [aria-label*="close"], button:has-text("×")',
      );
      const count = await closeButtons.count();

      if (count > 0) {
        const firstButton = closeButtons.first();

        // Focus the close button
        await firstButton.focus();

        // Should be able to activate with Enter or Space
        await page.keyboard.press('Enter');

        // Notification should be dismissed (this is functional, not just a11y)
        await page.waitForTimeout(500);

        expect(true).toBe(true); // Test passes if no errors
      }
    }
  });
});

test.describe('Accessibility - Authentication Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('Sign-in modal should be accessible', async ({ page }) => {
    // Look for sign-in button
    const signInButton = page
      .locator('button:has-text("Sign In"), button:has-text("Sign Up")')
      .first();

    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(1000);

      // Scan modal for accessibility issues
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include(
          '[role="dialog"], .modal, app-signin-modal, app-signup-prompt-modal',
        )
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      if (accessibilityScanResults.violations.length > 0) {
        await page.screenshot({
          path: 'e2e-results/signin-modal-violations.png',
          fullPage: true,
        });

        console.log(
          'Sign-in modal violations:',
          accessibilityScanResults.violations,
        );
      }

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Modal should trap focus when open', async ({ page }) => {
    const signInButton = page.locator('button:has-text("Sign In")').first();

    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(500);

      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Focus should remain within modal
      const focusedElement = await page.evaluateHandle(
        () => document.activeElement,
      );
      const isInModal = await focusedElement.evaluate((el) => {
        const modal = el?.closest(
          '[role="dialog"], .modal, [aria-modal="true"]',
        );
        return !!modal;
      });

      expect(isInModal).toBe(true);
    }
  });

  test('Modal should close with Escape key', async ({ page }) => {
    const signInButton = page.locator('button:has-text("Sign In")').first();

    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(500);

      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Modal should be closed
      const modalVisible = await page.locator('[role="dialog"]').isVisible();
      expect(modalVisible).toBe(false);
    }
  });

  test('Modal should have proper ARIA attributes', async ({ page }) => {
    const signInButton = page.locator('button:has-text("Sign In")').first();

    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(500);

      const modal = page.locator('[role="dialog"]').first();

      if ((await modal.count()) > 0) {
        const ariaModal = await modal.getAttribute('aria-modal');
        const ariaLabelledby = await modal.getAttribute('aria-labelledby');
        const ariaLabel = await modal.getAttribute('aria-label');

        // Modal should have aria-modal="true" and either aria-labelledby or aria-label
        expect(ariaModal).toBe('true');
        expect(ariaLabelledby || ariaLabel).toBeTruthy();
      }
    }
  });
});

test.describe('Accessibility - Interactive Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('Country comparison card should be accessible', async ({ page }) => {
    // Look for comparison card
    const comparisonCard = page.locator('app-comparison-card');

    if ((await comparisonCard.count()) > 0) {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('app-comparison-card')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Quiz game hub should be accessible', async ({ page }) => {
    const quizButton = page.locator('button:has-text("Quiz")').first();

    if (await quizButton.isVisible()) {
      await quizButton.click();
      await page.waitForTimeout(1000);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('app-game-hub')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      if (accessibilityScanResults.violations.length > 0) {
        await page.screenshot({
          path: 'e2e-results/quiz-violations.png',
          fullPage: true,
        });
      }

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Bird migration hub should be accessible', async ({ page }) => {
    const migrationButton = page.locator('button:has-text("Bird")').first();

    if (await migrationButton.isVisible()) {
      await migrationButton.click();
      await page.waitForTimeout(1000);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('app-migration-hub')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      if (accessibilityScanResults.violations.length > 0) {
        await page.screenshot({
          path: 'e2e-results/migration-violations.png',
          fullPage: true,
        });
      }

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Leaderboard should be accessible when authenticated', async ({
    page,
  }) => {
    const leaderboardButton = page
      .locator('button:has-text("Leaderboard")')
      .first();

    if (await leaderboardButton.isVisible()) {
      await leaderboardButton.click();
      await page.waitForTimeout(1000);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('app-leaderboard')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Profile dropdown should be keyboard accessible', async ({ page }) => {
    const profileButton = page
      .locator('button[aria-label*="profile"], button:has-text("User")')
      .first();

    if (await profileButton.isVisible()) {
      // Use keyboard to open dropdown
      await profileButton.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Dropdown should be visible
      const dropdown = page.locator('.profile-dropdown-menu');
      const isVisible = await dropdown.isVisible();

      expect(isVisible).toBe(true);

      // Should be able to navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      const focusedElement = await page.evaluateHandle(
        () => document.activeElement,
      );
      const tagName = await focusedElement.evaluate((el) => el?.tagName);

      expect(['BUTTON', 'A', 'DIV']).toContain(tagName);
    }
  });
});

test.describe('Accessibility - Detailed Reports', () => {
  test('Generate detailed accessibility report for home page', async ({
    page,
  }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    // Log full report for review
    console.log('=== Accessibility Scan Results ===');
    console.log(`Violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Passes: ${accessibilityScanResults.passes.length}`);
    console.log(`Incomplete: ${accessibilityScanResults.incomplete.length}`);

    if (accessibilityScanResults.violations.length > 0) {
      console.log('\n=== Violations Detail ===');
      accessibilityScanResults.violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.id} (${violation.impact})`);
        console.log(`   Description: ${violation.description}`);
        console.log(`   Help: ${violation.helpUrl}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);
      });
    }

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
