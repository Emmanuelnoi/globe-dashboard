import { Injectable, signal, computed } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly timestamp: number;
  readonly autoClose?: boolean;
  readonly duration?: number; // in milliseconds
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly _notifications = signal<readonly Notification[]>([]);
  private notificationCounter = 0;

  // Public read-only signals
  readonly notifications = this._notifications.asReadonly();
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  // Default durations for auto-close
  private readonly DEFAULT_DURATIONS = {
    success: 4000,
    info: 5000,
    warning: 6000,
    error: 8000,
  } as const;

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
    const id = `notification-${++this.notificationCounter}`;
    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
      autoClose,
      duration: duration ?? this.DEFAULT_DURATIONS[type],
    };

    // Add to notifications array
    this._notifications.update((notifications) => [
      ...notifications,
      notification,
    ]);

    // Auto-close if enabled
    if (autoClose) {
      setTimeout(() => {
        this.dismiss(id);
      }, notification.duration);
    }

    return id;
  }

  /**
   * Dismiss a specific notification
   */
  dismiss(id: string): void {
    this._notifications.update((notifications) =>
      notifications.filter((n) => n.id !== id),
    );
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this._notifications.set([]);
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
