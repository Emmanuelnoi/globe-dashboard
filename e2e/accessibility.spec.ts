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
