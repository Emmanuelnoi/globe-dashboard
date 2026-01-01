import {
  Injectable,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';

/**
 * Base interface for all notifications
 */
export interface BaseNotification {
  id: string;
  timestamp: Date;
  autoClose: boolean;
  duration?: number;
}

/**
 * Configuration for adding notifications
 */
export interface NotificationConfig {
  autoClose: boolean;
  duration?: number;
}

/**
 * Base Notification Service
 *
 * Generic base class for all notification services.
 * Provides shared functionality:
 * - Signal-based state management
 * - Automatic timeout cleanup
 * - Consistent ID generation
 * - Centralized dismiss/clear logic
 *
 * @template T - Notification type extending BaseNotification
 *
 * @example
 * ```typescript
 * export interface MyNotification extends BaseNotification {
 *   title: string;
 *   message: string;
 * }
 *
 * @Injectable({ providedIn: 'root' })
 * export class MyNotificationService extends BaseNotificationService<MyNotification> {
 *   show(title: string, message: string): string {
 *     const id = this.generateId('my-notification');
 *     const notification: MyNotification = {
 *       id,
 *       title,
 *       message,
 *       timestamp: new Date(),
 *       autoClose: true,
 *       duration: 5000,
 *     };
 *     return this.addNotification(notification, { autoClose: true, duration: 5000 });
 *   }
 * }
 * ```
 */
@Injectable()
export abstract class BaseNotificationService<T extends BaseNotification> {
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly _notifications = signal<readonly T[]>([]);

  // Public readonly signals
  readonly notifications = this._notifications.asReadonly();
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  // Private state
  private timeouts = new Map<string, number>();
  private idCounter = 0;

  /**
   * Generate unique notification ID
   *
   * @param prefix - ID prefix for categorization
   * @returns Unique notification ID
   */
  protected generateId(prefix = 'notification'): string {
    return `${prefix}-${++this.idCounter}-${Date.now()}`;
  }

  /**
   * Add a notification to the active list
   *
   * Automatically sets up timeout cleanup via DestroyRef
   * if autoClose is enabled.
   *
   * @param notification - Notification to add
   * @param config - Auto-close configuration
   * @returns Notification ID
   */
  protected addNotification(
    notification: T,
    config: NotificationConfig,
  ): string {
    // Add to notifications array
    this._notifications.update((notifications) => [
      ...notifications,
      notification,
    ]);

    // Setup auto-close if enabled
    if (config.autoClose && config.duration) {
      const timeoutId = window.setTimeout(
        () => this.dismiss(notification.id),
        config.duration,
      );
      this.timeouts.set(notification.id, timeoutId);

      // Auto-cleanup timeout on service destroy
      this.destroyRef.onDestroy(() => {
        if (this.timeouts.has(notification.id)) {
          const timeout = this.timeouts.get(notification.id);
          if (timeout) {
            clearTimeout(timeout);
          }
        }
      });
    }

    return notification.id;
  }

  /**
   * Dismiss a specific notification
   *
   * Clears associated timeout and removes from active list.
   *
   * @param id - Notification ID to dismiss
   */
  dismiss(id: string): void {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }
    this._notifications.update((n) => n.filter((x) => x.id !== id));
  }

  /**
   * Clear all active notifications
   *
   * Clears all timeouts and empties the notification list.
   */
  clear(): void {
    this.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.timeouts.clear();
    this._notifications.set([]);
  }
}
