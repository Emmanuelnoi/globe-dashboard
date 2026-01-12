/**
 * Analytics Service for Vercel Web Analytics Integration
 *
 * This service provides a wrapper around the Vercel Web Analytics package
 * to track page views and custom events. It initializes the analytics on
 * application startup and enables route change tracking.
 *
 * The Analytics component from @vercel/analytics/react is used, which automatically
 * handles route detection and page view tracking in Angular applications.
 */

import { Injectable, effect, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

/**
 * Type definition for the window.va object used by Vercel Analytics
 */
interface VercelAnalyticsWindow extends Window {
  va?: (...args: unknown[]) => void;
  vaq?: unknown[];
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private router = inject(Router);
  private logger = inject(LoggerService);
  private isInitialized = false;

  constructor() {
    this.initializeAnalytics();
  }

  /**
   * Initialize Vercel Web Analytics
   *
   * This method sets up the analytics tracking. For Angular,
   * we use the @vercel/analytics package which provides route
   * tracking through the Analytics component.
   *
   * The Analytics component should be added to the root component (app.ts)
   * to enable automatic tracking of page views and route changes.
   */
  private initializeAnalytics(): void {
    // Only initialize if analytics is enabled in the environment
    if (!environment.enableAnalytics) {
      this.logger.debug('Analytics initialization skipped: disabled in environment');
      return;
    }

    try {
      // Import the Analytics component dynamically from @vercel/analytics
      // Note: For Angular, the Analytics component should be imported in the root component
      // and used in the template for automatic route tracking.

      // Initialize the global va function used by Vercel's tracking script
      const win = window as VercelAnalyticsWindow;
      if (!win.va) {
        win.va = (...args: unknown[]) => {
          (win.vaq = win.vaq || []).push(args);
        };
      }

      this.isInitialized = true;
      this.logger.debug('Analytics service initialized successfully');

      // Track router events for manual page view tracking if needed
      this.trackRouterEvents();
    } catch (error) {
      this.logger.error('Failed to initialize analytics service', error);
    }
  }

  /**
   * Track router navigation events
   *
   * This method manually tracks page view events on route changes.
   * Note: If using the Analytics component from @vercel/analytics,
   * this is handled automatically, so this method is optional.
   *
   * We keep it as a fallback for non-component-based tracking.
   */
  private trackRouterEvents(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          // Track page view on route navigation
          this.trackEvent('pageview', {
            url: event.url,
            path: event.urlAfterRedirects,
          });
        }
      });
  }

  /**
   * Track a custom event
   *
   * @param eventName - The name of the event
   * @param data - Optional event data
   *
   * Example usage:
   * this.analytics.trackEvent('quiz_completed', { score: 85, category: 'birds' });
   */
  public trackEvent(
    eventName: string,
    data?: Record<string, string | number | boolean>,
  ): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      const win = window as VercelAnalyticsWindow;
      if (win.va) {
        // Call the Vercel Analytics tracking function
        // The va function queues events that are sent to the Vercel Analytics endpoint
        win.va('event', {
          name: eventName,
          ...data,
        });

        this.logger.debug(`Event tracked: ${eventName}`, data);
      }
    } catch (error) {
      this.logger.error(`Failed to track event: ${eventName}`, error);
    }
  }

  /**
   * Check if analytics is initialized
   */
  public isAnalyticsInitialized(): boolean {
    return this.isInitialized;
  }
}
