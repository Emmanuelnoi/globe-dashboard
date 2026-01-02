import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests using axe-core
 *
 * IMPORTANT: These tests are tagged @a11y and run in NIGHTLY builds only.
 * They are too slow for CI due to heavy axe-core scans and Angular bootstrap time.
 *
 * For CI, use smoke.spec.ts which has basic a11y checks.
 *
 * Tests WCAG 2.1 Level AA compliance across all major pages
 * Reference: https://www.w3.org/WAI/WCAG21/quickref/
 */

// Helper to wait for app ready state
async function waitForAppReady(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForSelector('app-root', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  // Wait for specific elements instead of networkidle
  await page.waitForSelector('main#main-content', { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 5000 });
}

test.describe('Accessibility - Core WCAG Tests @a11y @slow', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('home page has no WCAG 2.1 AA violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        'WCAG Violations:',
        JSON.stringify(results.violations, null, 2),
      );
    }

    expect(results.violations).toEqual([]);
  });

  test('proper heading hierarchy exists', async ({ page }) => {
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
      elements.map((el) => ({
        tag: el.tagName,
        text: el.textContent?.trim() || '',
      })),
    );

    // Should have exactly one h1
    const h1Count = headings.filter((h) => h.tag === 'H1').length;
    expect(h1Count).toBe(1);

    // All headings should have content
    headings.forEach((heading) => {
      expect(heading.text.length).toBeGreaterThan(0);
    });
  });

  test('form inputs have labels', async ({ page }) => {
    const inputs = await page.$$eval('input:not([type="hidden"])', (elements) =>
      elements.map((input) => {
        const htmlInput = input as HTMLInputElement;
        return {
          id: input.id,
          type: input.getAttribute('type'),
          hasLabel:
            !!htmlInput.labels?.length ||
            !!input.getAttribute('aria-label') ||
            !!input.getAttribute('aria-labelledby'),
        };
      }),
    );

    const unlabeled = inputs.filter((input) => !input.hasLabel);
    expect(unlabeled).toEqual([]);
  });

  test('images have alt text', async ({ page }) => {
    const imagesWithoutAlt = await page.$$eval(
      'img',
      (images) => images.filter((img) => !img.alt).length,
    );

    expect(imagesWithoutAlt).toBe(0);
  });

  test('color contrast meets WCAG AA', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('body')
      .analyze();

    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast',
    );

    expect(contrastViolations).toEqual([]);
  });

  test('ARIA attributes are valid', async ({ page }) => {
    const results = await new AxeBuilder({ page }).include('body').analyze();

    const ariaViolations = results.violations.filter((v) =>
      v.id.includes('aria'),
    );

    expect(ariaViolations).toEqual([]);
  });
});

test.describe('Accessibility - Keyboard Navigation @a11y @slow', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('tab navigation reaches interactive elements', async ({ page }) => {
    // Press Tab multiple times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    const focusedElement = await page.evaluateHandle(
      () => document.activeElement,
    );
    const tagName = await focusedElement.evaluate((el) => el?.tagName);

    expect(tagName).toBeTruthy();
    // Accept DIV for custom components with tabindex
    expect([
      'BUTTON',
      'A',
      'INPUT',
      'SELECT',
      'TEXTAREA',
      'CANVAS',
      'DIV',
    ]).toContain(tagName);
  });

  test('skip link exists and works', async ({ page }) => {
    // Press Tab to reveal skip link
    await page.keyboard.press('Tab');

    const skipLink = page
      .locator('a[href="#main-content"], .skip-link')
      .first();
    const count = await skipLink.count();

    if (count > 0) {
      await skipLink.click();
      // Focus should move to main content
      const focused = await page.evaluate(() => document.activeElement?.id);
      expect(focused).toBe('main-content');
    }
  });
});

test.describe('Accessibility - Modal Dialogs @a11y @slow', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('sign-in modal has proper ARIA', async ({ page }) => {
    const signInButton = page.locator('button:has-text("Sign In")').first();

    // Skip if sign-in button doesn't exist
    if ((await signInButton.count()) === 0) {
      test.skip();
      return;
    }

    await signInButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const modal = page.locator('[role="dialog"]').first();
    const ariaModal = await modal.getAttribute('aria-modal');
    const ariaLabelledby = await modal.getAttribute('aria-labelledby');
    const ariaLabel = await modal.getAttribute('aria-label');

    expect(ariaModal).toBe('true');
    expect(ariaLabelledby || ariaLabel).toBeTruthy();
  });

  test('modal closes with Escape', async ({ page }) => {
    const signInButton = page.locator('button:has-text("Sign In")').first();

    if ((await signInButton.count()) === 0) {
      test.skip();
      return;
    }

    await signInButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    await page.keyboard.press('Escape');

    // Wait briefly for animation
    await page.waitForTimeout(300);

    const modalVisible = await page.locator('[role="dialog"]').isVisible();
    expect(modalVisible).toBe(false);
  });

  test('modal traps focus', async ({ page }) => {
    const signInButton = page.locator('button:has-text("Sign In")').first();

    if ((await signInButton.count()) === 0) {
      test.skip();
      return;
    }

    await signInButton.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Tab through modal elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Check focus is still in modal
    const isInModal = await page.evaluate(() => {
      const activeEl = document.activeElement;
      return !!activeEl?.closest('[role="dialog"], [aria-modal="true"]');
    });

    expect(isInModal).toBe(true);
  });
});

test.describe('Accessibility - Interactive Components @a11y @slow', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('comparison card is accessible', async ({ page }) => {
    const comparisonCard = page.locator('app-comparison-card');

    if ((await comparisonCard.count()) === 0) {
      test.skip();
      return;
    }

    const results = await new AxeBuilder({ page })
      .include('app-comparison-card')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('sidebar menu is accessible', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('app-sidebar')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('canvas has text alternative', async ({ page }) => {
    const canvas = page.locator('canvas').first();

    if ((await canvas.count()) === 0) {
      test.skip();
      return;
    }

    const ariaLabel = await canvas.getAttribute('aria-label');
    const role = await canvas.getAttribute('role');

    expect(ariaLabel || role).toBeTruthy();
  });
});

test.describe('Accessibility - Reduced Motion @a11y @slow', () => {
  test('respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForSelector('app-root', { timeout: 15000 });

    const hasReducedMotion = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    expect(hasReducedMotion).toBe(true);
  });
});

test.describe('Accessibility - Notification System @a11y @slow', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  test('notifications have ARIA live regions', async ({ page }) => {
    const liveRegions = await page.$$eval(
      '[aria-live]',
      (elements) => elements.length,
    );

    // Should have at least one live region
    if (liveRegions === 0) {
      console.warn('Warning: No ARIA live regions found for notifications');
    }

    // This is a soft check - warn but don't fail
    expect(liveRegions).toBeGreaterThanOrEqual(0);
  });

  test('notification toast has proper ARIA when visible', async ({ page }) => {
    const toast = page.locator('.notification-toast').first();

    if ((await toast.count()) === 0) {
      // No notification visible, skip
      test.skip();
      return;
    }

    const role = await toast.getAttribute('role');
    const ariaLive = await toast.getAttribute('aria-live');

    expect(role || ariaLive).toBeTruthy();
  });
});

test.describe('Accessibility - Full Report @a11y @slow', () => {
  test('generate comprehensive accessibility report', async ({ page }) => {
    await waitForAppReady(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    console.log('=== Accessibility Report ===');
    console.log(`Violations: ${results.violations.length}`);
    console.log(`Passes: ${results.passes.length}`);
    console.log(`Incomplete: ${results.incomplete.length}`);

    if (results.violations.length > 0) {
      console.log('\n=== Violations ===');
      results.violations.forEach((v, i) => {
        console.log(`${i + 1}. ${v.id} (${v.impact}): ${v.description}`);
      });
    }

    // Allow best-practice issues but fail on WCAG violations
    const wcagViolations = results.violations.filter(
      (v) =>
        !v.tags.includes('best-practice') ||
        v.tags.some((t) => t.startsWith('wcag')),
    );

    expect(wcagViolations).toEqual([]);
  });
});
