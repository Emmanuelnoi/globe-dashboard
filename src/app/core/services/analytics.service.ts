/**
 * Analytics Service for Vercel Web Analytics Integration
 *
 * This service provides an Angular wrapper around Vercel Web Analytics.
 * It injects the Vercel tracking script on application startup and exposes a
 * typed helper for custom events.
 */

import { Injectable, inject as injectDependency } from '@angular/core';
import { inject as injectVercelAnalytics, track } from '@vercel/analytics';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private logger = injectDependency(LoggerService);
  private isInitialized = false;

  constructor() {
    this.initializeAnalytics();
  }

  /**
   * Initialize Vercel Web Analytics
   */
  private initializeAnalytics(): void {
    // Only initialize if analytics is enabled in the environment
    if (!environment.enableAnalytics) {
      this.logger.debug(
        'Analytics initialization skipped: disabled in environment',
      );
      return;
    }

    try {
      injectVercelAnalytics({
        framework: 'angular',
        mode: environment.production ? 'production' : 'development',
      });
      this.isInitialized = true;
      this.logger.debug('Analytics service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize analytics service', error);
    }
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
      track(eventName, data);
      this.logger.debug(`Event tracked: ${eventName}`, data);
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
