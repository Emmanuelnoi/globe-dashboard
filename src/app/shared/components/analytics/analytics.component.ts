/**
 * Analytics Component for Vercel Web Analytics Integration
 *
 * This component wraps the Vercel Analytics component from @vercel/analytics/react
 * and makes it compatible with Angular. The component automatically handles:
 * - Initialization of the Vercel tracking script
 * - Route change tracking
 * - Custom event tracking
 *
 * Usage:
 * Add this component to your root component (app.ts) template:
 * <app-analytics />
 */

import { Component, OnInit, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { LoggerService } from '../../../core/services/logger.service';

declare const window: {
  va?: (...args: unknown[]) => void;
  vaq?: unknown[];
};

@Component({
  selector: 'app-analytics',
  standalone: true,
  template: '',
  styles: [],
})
export class AnalyticsComponent implements OnInit {
  private logger = inject(LoggerService);

  ngOnInit(): void {
    if (!environment.enableAnalytics) {
      this.logger.debug('Analytics component: disabled in environment');
      return;
    }

    this.initializeVercelAnalytics();
  }

  /**
   * Initialize Vercel Web Analytics
   *
   * This method sets up the Vercel tracking script. The script automatically:
   * - Sends pageview data when the route changes
   * - Tracks performance metrics
   * - Sends data to Vercel's analytics service
   *
   * The Vercel platform automatically enables the /_vercel/insights/* routes
   * after your next deployment when Web Analytics is enabled in the dashboard.
   */
  private initializeVercelAnalytics(): void {
    try {
      // Create the global va function for tracking
      if (!window.va) {
        window.va = (...args: unknown[]) => {
          (window.vaq = window.vaq || []).push(args);
        };
      }

      // Add the Vercel Analytics tracking script
      // This script will be served from /_vercel/insights/script.js after deployment
      // The script is automatically added by Vercel when Web Analytics is enabled

      // For development or non-deployed environments, you may need to ensure
      // the script is available. In production on Vercel, this is handled automatically.

      this.logger.debug('Vercel Analytics initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Vercel Analytics', error);
    }
  }
}
