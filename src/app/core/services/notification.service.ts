import { Injectable } from '@angular/core';
import {
  BaseNotificationService,
  BaseNotification,
} from './base-notification.service';
import { NOTIFICATION_DURATIONS } from './notification-helpers';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification extends BaseNotification {
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService extends BaseNotificationService<Notification> {
  /**
   * Show a success notification
   */
  success(title: string, message: string, autoClose = true): string {
    return this.show('success', title, message, autoClose);
  }

  /**
   * Show an error notification
   */
  error(title: string, message: string, autoClose = false): string {
    return this.show('error', title, message, autoClose);
  }

  /**
   * Show a warning notification
   */
  warning(title: string, message: string, autoClose = true): string {
    return this.show('warning', title, message, autoClose);
  }

  /**
   * Show an info notification
   */
  info(title: string, message: string, autoClose = true): string {
    return this.show('info', title, message, autoClose);
  }

  /**
   * Show a generic notification
   */
  show(
    type: NotificationType,
    title: string,
    message: string,
    autoClose = true,
    duration?: number,
  ): string {
    const id = this.generateId('notification');
    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: new Date(),
      autoClose,
      duration: duration ?? NOTIFICATION_DURATIONS[type],
    };

    return this.addNotification(notification, {
      autoClose,
      duration: notification.duration,
    });
  }

  /**
   * Convenience methods for common system notifications
   */
  readonly system = {
    /**
     * Show country selection success
     */
    countrySelected: (countryName: string) => {
      this.success(
        'Country Selected',
        `${countryName} has been added to your comparison.`,
        true,
      );
    },

    /**
     * Show country deselection
     */
    countryDeselected: (countryName: string) => {
      this.info(
        'Country Removed',
        `${countryName} has been removed from your comparison.`,
        true,
      );
    },

    /**
     * Show data loading success
     */
    dataLoaded: (description: string) => {
      this.success('Data Loaded', description, true);
    },

    /**
     * Show loading errors
     */
    loadingError: (error: string) => {
      this.error('Loading Error', `Failed to load data: ${error}`, false);
    },

    /**
     * Show WebGL context issues
     */
    webglError: (message: string) => {
      this.error(
        'Graphics Error',
        `WebGL issue: ${message}. Try refreshing the page.`,
        false,
      );
    },

    /**
     * Show search results
     */
    searchResults: (count: number, query: string) => {
      if (count === 0) {
        this.warning('No Results', `No countries found for "${query}".`, true);
      } else {
        this.info(
          'Search Results',
          `Found ${count} ${count === 1 ? 'country' : 'countries'} for "${query}".`,
          true,
        );
      }
    },

    /**
     * Show performance warnings
     */
    performanceWarning: (issue: string) => {
      this.warning('Performance Notice', issue, true);
    },
  };
}
