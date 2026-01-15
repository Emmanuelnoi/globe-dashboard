/**
 * Analytics Component for Vercel Web Analytics Integration
 *
 * This component wraps the Vercel Web Analytics tracking for Angular applications.
 * The component automatically handles:
 * - Initialization of the Vercel tracking script
 * - Route change tracking
 * - Custom event tracking
 *
 * The Vercel platform automatically enables the /_vercel/insights/* routes
 * after your next deployment when Web Analytics is enabled in the dashboard.
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
   * The script will be available from /_vercel/insights/script.js after deployment
   * when Web Analytics is enabled in the Vercel dashboard.
   */
  private initializeVercelAnalytics(): void {
    try {
      // Create the global va function for tracking (queuing mechanism)
      // This function queues tracking calls before the script loads
      if (!window.va) {
        window.va = (...args: unknown[]) => {
          (window.vaq = window.vaq || []).push(args);
        };
      }

      // Inject the Vercel Analytics tracking script
      // This script will be served from /_vercel/insights/script.js after deployment
      // The script is automatically added by Vercel when Web Analytics is enabled
      const script = document.createElement('script');
      script.src = '/_vercel/insights/script.js';
      script.defer = true;
      script.async = true;

      // Append the script to the document head
      document.head.appendChild(script);

      this.logger.debug('Vercel Analytics script injected');
    } catch (error) {
      this.logger.error('Failed to initialize Vercel Analytics', error);
    }
  }
}
