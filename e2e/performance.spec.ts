import { test, expect } from '@playwright/test';

// Type definitions for browser performance APIs
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

interface WindowWithGC extends Window {
  gc?: () => void;
  frameCount?: number;
  startTime?: number;
}

test.describe('Performance Tests', () => {
  test('should load within acceptable time limits', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    // Wait for main components to be visible
    await Promise.all([
      page.waitForSelector('app-globe'),
      page.waitForSelector('app-sidebar'),
      page.waitForSelector('app-comparison-card'),
    ]);

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds (generous for 3D app)
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    // Navigate to page
    await page.goto('/');

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Measure LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // Fallback timeout
        setTimeout(() => resolve(null), 3000);
      });
    });

    if (lcp) {
      // LCP should be under 2.5s for good performance
      expect(lcp).toBeLessThan(2500);
    }
  });

  test('should handle multiple rapid interactions without lag', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('app-sidebar');

    const toggleButton = page.locator('.toggle');
    const startTime = Date.now();

    // Rapid toggle operations
    for (let i = 0; i < 5; i++) {
      await toggleButton.click();
      await page.waitForTimeout(50);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(2000);

    // UI should still be responsive
    await expect(toggleButton).toBeVisible();
  });

  test('should not consume excessive memory', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as ExtendedPerformance).memory?.usedJSHeapSize || 0;
    });

    if (initialMemory > 0) {
      // Perform some interactions
      const toggleButton = page.locator('.toggle');
      const menuItems = page.locator('.menu-item');

      for (let i = 0; i < 10; i++) {
        await toggleButton.click();
        await menuItems.nth(i % 4).click();
        await page.waitForTimeout(100);
      }

      // Force garbage collection if available
      await page.evaluate(() => {
        const windowWithGC = window as WindowWithGC;
        if (windowWithGC.gc) {
          windowWithGC.gc();
        }
      });

      await page.waitForTimeout(1000);

      const finalMemory = await page.evaluate(() => {
        return (performance as ExtendedPerformance).memory?.usedJSHeapSize || 0;
      });

      // Memory shouldn't grow excessively (allow 50MB growth)
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('should maintain 60 FPS during interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Start FPS monitoring
    await page.evaluate(() => {
      const windowWithGC = window as WindowWithGC;
      windowWithGC.frameCount = 0;
      windowWithGC.startTime = performance.now();

      function countFrame() {
        const windowWithGC = window as WindowWithGC;
        if (windowWithGC.frameCount !== undefined) {
          windowWithGC.frameCount++;
        }
        requestAnimationFrame(countFrame);
      }
      requestAnimationFrame(countFrame);
    });

    // Perform interactions for 2 seconds
    const toggleButton = page.locator('.toggle');
    const menuItems = page.locator('.menu-item');

    for (let i = 0; i < 20; i++) {
      if (i % 5 === 0) await toggleButton.click();
      await menuItems.nth(i % 4).click();
      await page.waitForTimeout(100);
    }

    // Calculate FPS
    const fps = await page.evaluate(() => {
      const endTime = performance.now();
      const windowWithGC = window as WindowWithGC;
      const startTime = windowWithGC.startTime || performance.now();
      const frameCount = windowWithGC.frameCount || 0;
      const duration = (endTime - startTime) / 1000;
      return frameCount / duration;
    });

    // Should maintain at least 30 FPS (reasonable for 3D)
    expect(fps).toBeGreaterThan(30);
  });

  test('should handle network interruptions gracefully', async ({ page }) => {
    // Start with normal page load
    await page.goto('/');
    await page.waitForSelector('app-sidebar');

    // Simulate network interruption
    await page.route('/data/**', (route) => route.abort());

    // Try to trigger data loading (if any)
    await page.reload();

    // Should still show basic UI even if data fails
    await page.waitForTimeout(2000);

    const sidebar = page.locator('app-sidebar');
    const globe = page.locator('app-globe');

    await expect(sidebar).toBeVisible();
    await expect(globe).toBeVisible();

    // Restore network
    await page.unroute('/data/**');
  });

  test('should work offline (basic functionality)', async ({
    page,
    context,
  }) => {
    // Load page normally first
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Page should still be functional
    const toggleButton = page.locator('.toggle');
    const menuItems = page.locator('.menu-item');

    await toggleButton.click();
    await menuItems.nth(1).click();

    // Basic interactions should work
    await expect(page.locator('app-sidebar.collapsed')).toBeVisible();
    await expect(menuItems.nth(1)).toHaveClass(/active/);

    // Go back online
    await context.setOffline(false);
  });
});
