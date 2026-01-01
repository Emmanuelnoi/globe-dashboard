/**
 * Accessibility Testing Helpers
 * Utilities for enhanced accessibility testing with axe-core
 */

import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AxeResults } from 'axe-core';

/**
 * Accessibility scan options
 */
export interface AccessibilityScanOptions {
  /** Take screenshot on violations */
  screenshot?: boolean;
  /** Screenshot filename */
  screenshotPath?: string;
  /** WCAG tags to test against */
  tags?: string[];
  /** Elements to include in scan */
  include?: string[];
  /** Elements to exclude from scan */
  exclude?: string[];
  /** Log detailed violation info */
  verbose?: boolean;
}

/**
 * Enhanced accessibility scan with automatic screenshot and detailed logging
 */
export async function scanAccessibility(
  page: Page,
  options: AccessibilityScanOptions = {},
): Promise<AxeResults> {
  const {
    screenshot = true,
    screenshotPath,
    tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    include = [],
    exclude = [],
    verbose = false,
  } = options;

  let builder = new AxeBuilder({ page }).withTags(tags);

  // Apply include/exclude filters
  include.forEach((selector) => builder.include(selector));
  exclude.forEach((selector) => builder.exclude(selector));

  const results = await builder.analyze();

  // Log violations if verbose
  if (verbose && results.violations.length > 0) {
    console.log('\n=== Accessibility Violations ===');
    logViolations(results);
  }

  // Take screenshot if violations found and screenshot enabled
  if (screenshot && results.violations.length > 0 && screenshotPath) {
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
  }

  return results;
}

/**
 * Log accessibility violations in a readable format
 */
export function logViolations(results: AxeResults): void {
  console.log(`\n📊 Total violations: ${results.violations.length}`);
  console.log(`✅ Total passes: ${results.passes.length}`);
  console.log(`⚠️ Incomplete checks: ${results.incomplete.length}\n`);

  results.violations.forEach((violation, index) => {
    console.log(
      `\n${index + 1}. ${violation.id} (Impact: ${violation.impact})`,
    );
    console.log(`   Description: ${violation.description}`);
    console.log(`   WCAG: ${violation.tags.join(', ')}`);
    console.log(`   Help: ${violation.helpUrl}`);
    console.log(`   Affected elements: ${violation.nodes.length}`);

    violation.nodes.forEach((node, nodeIndex) => {
      console.log(`\n   Element ${nodeIndex + 1}:`);
      console.log(`   - Target: ${node.target.join(' ')}`);
      console.log(`   - HTML: ${node.html.substring(0, 100)}...`);
      console.log(`   - Failure: ${node.failureSummary}`);
    });
  });
}

/**
 * Generate accessibility report summary
 */
export function generateReport(results: AxeResults): string {
  const { violations, passes, incomplete, inapplicable } = results;

  const criticalViolations = violations.filter((v) => v.impact === 'critical');
  const seriousViolations = violations.filter((v) => v.impact === 'serious');
  const moderateViolations = violations.filter((v) => v.impact === 'moderate');
  const minorViolations = violations.filter((v) => v.impact === 'minor');

  return `
Accessibility Report
====================
Total Violations: ${violations.length}
  - Critical: ${criticalViolations.length}
  - Serious: ${seriousViolations.length}
  - Moderate: ${moderateViolations.length}
  - Minor: ${minorViolations.length}

Total Passes: ${passes.length}
Incomplete: ${incomplete.length}
Inapplicable: ${inapplicable.length}

Pass Rate: ${((passes.length / (passes.length + violations.length)) * 100).toFixed(1)}%
  `;
}

/**
 * Test keyboard navigation for a component
 */
export async function testKeyboardNavigation(
  page: Page,
  startSelector: string,
): Promise<boolean> {
  try {
    // Focus the starting element
    await page.focus(startSelector);

    // Tab through multiple elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Check if something is focused
      const focusedElement = await page.evaluateHandle(
        () => document.activeElement,
      );
      const tagName = await focusedElement.evaluate((el) => el?.tagName);

      if (!tagName || tagName === 'BODY') {
        return false; // Focus lost to body
      }
    }

    return true;
  } catch (error) {
    console.error('Keyboard navigation test failed:', error);
    return false;
  }
}

/**
 * Test focus trap in modal
 */
export async function testFocusTrap(
  page: Page,
  modalSelector: string,
): Promise<boolean> {
  try {
    // Tab through elements multiple times
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focusedElement = await page.evaluateHandle(
        () => document.activeElement,
      );
      const isInModal = await focusedElement.evaluate((el) => {
        return !!el?.closest(modalSelector);
      });

      if (!isInModal) {
        return false; // Focus escaped modal
      }
    }

    return true;
  } catch (error) {
    console.error('Focus trap test failed:', error);
    return false;
  }
}

/**
 * Check for ARIA live regions
 */
export async function checkLiveRegions(page: Page): Promise<{
  count: number;
  regions: Array<{ role: string; live: string }>;
}> {
  const regions = await page.$$eval('[aria-live]', (elements) =>
    elements.map((el) => ({
      role: el.getAttribute('role') || 'none',
      live: el.getAttribute('aria-live') || 'off',
    })),
  );

  return {
    count: regions.length,
    regions,
  };
}

/**
 * Verify color contrast for element
 */
export async function checkColorContrast(
  page: Page,
  selector: string,
): Promise<AxeResults> {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2aa'])
    .analyze();

  const contrastViolations = results.violations.filter(
    (v) => v.id === 'color-contrast',
  );

  return {
    ...results,
    violations: contrastViolations,
  };
}

/**
 * Test screen reader announcements by checking ARIA live regions
 */
export async function testScreenReaderAnnouncement(
  page: Page,
  expectedText: string,
  timeout = 5000,
): Promise<boolean> {
  try {
    // Wait for live region with expected text
    const liveRegion = await page.waitForSelector(
      `[aria-live]:has-text("${expectedText}")`,
      { timeout, state: 'visible' },
    );

    return !!liveRegion;
  } catch (error) {
    return false;
  }
}

/**
 * Export accessibility violations to JSON for CI/CD
 */
export function exportViolationsToJSON(
  results: AxeResults,
  filename: string,
): string {
  const report = {
    timestamp: new Date().toISOString(),
    url: results.url,
    summary: {
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
    },
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        html: n.html,
        failureSummary: n.failureSummary,
      })),
    })),
  };

  return JSON.stringify(report, null, 2);
}
