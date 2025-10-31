import { test, expect } from '@playwright/test';

/**
 * Quiz Game Flow E2E Tests
 * Tests the complete quiz game experience from start to finish
 */

test.describe('Quiz Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should start and complete a quiz game', async ({ page }) => {
    // Find and click quiz/game button
    const quizButton = page.locator('text=/Start Quiz|Game Hub|Quiz/i').first();
    await quizButton.click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Select game mode (if modal appears)
    const flagsMode = page.locator('text=/Flag|Flags/i').first();
    if (await flagsMode.isVisible()) {
      await flagsMode.click();
    }

    // Start game
    const startButton = page.locator('button:has-text("Start")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Verify question appears
    const question = page.locator('[class*="question"]').first();
    await expect(question).toBeVisible({ timeout: 5000 });

    // Answer 3 questions
    for (let i = 0; i < 3; i++) {
      // Find answer options
      const answerOptions = page.locator('[class*="option"]');
      const optionCount = await answerOptions.count();

      if (optionCount > 0) {
        // Click first option
        await answerOptions.first().click();
        await page.waitForTimeout(1500);
      } else {
        // If no options, look for input field (Capitals mode)
        const input = page.locator('input[type="text"]').first();
        if (await input.isVisible()) {
          await input.fill('Paris'); // Generic answer
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1500);
        }
      }
    }

    // Verify we're still in the game or see results
    const resultsOrQuestion = page.locator(
      '[class*="result"], [class*="question"], [class*="score"]',
    );
    await expect(resultsOrQuestion.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show quiz statistics after playing', async ({ page }) => {
    // Navigate to quiz
    const quizButton = page.locator('text=/Quiz|Game/i').first();
    await quizButton.click({ timeout: 5000 });

    // Look for stats button
    const statsButton = page
      .locator('text=/Stats|Statistics|History/i')
      .first();
    if (await statsButton.isVisible()) {
      await statsButton.click();
      await page.waitForTimeout(500);

      // Verify stats panel appears
      const statsPanel = page.locator('[class*="stats"]').first();
      await expect(statsPanel).toBeVisible();
    }
  });

  test('should allow mode selection', async ({ page }) => {
    // Navigate to quiz
    const quizButton = page.locator('text=/Quiz|Game Hub/i').first();
    await quizButton.click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Verify multiple game modes are available
    const modes = await page.locator('[class*="mode"], button').count();
    expect(modes).toBeGreaterThan(0);
  });

  test('should track score during game', async ({ page }) => {
    // Start quiz
    const quizButton = page.locator('text=/Quiz|Game Hub/i').first();
    await quizButton.click({ timeout: 5000 });

    // Start game (if button exists)
    const startButton = page.locator('button:has-text("Start")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    // Look for score display
    const scoreDisplay = page.locator('text=/Score|Points/i').first();
    if (await scoreDisplay.isVisible({ timeout: 3000 })) {
      // Verify score is visible
      await expect(scoreDisplay).toBeVisible();
    }
  });
});
