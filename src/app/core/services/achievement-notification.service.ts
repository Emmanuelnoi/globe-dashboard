import { Injectable, signal, effect, inject } from '@angular/core';
import { AchievementsService } from './achievements.service';
import { LoggerService } from './logger.service';
import {
  BaseNotificationService,
  BaseNotification,
} from './base-notification.service';
import {
  NOTIFICATION_DURATIONS,
  getTierColor,
  getCategoryIcon,
  NotificationSoundPlayer,
} from './notification-helpers';

/**
 * Achievement Notification Item
 */
export interface AchievementNotification extends BaseNotification {
  achievementId: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  isVisible: boolean;
}

/**
 * Achievement Notification Service
 *
 * Listens to achievements service and displays toast notifications
 * when users unlock new achievements.
 *
 * Features:
 * - Auto-detects new achievement unlocks
 * - Shows animated toast notifications
 * - Sound effect support (optional)
 * - Queue management for multiple unlocks
 * - Auto-dismiss after duration
 */
@Injectable({
  providedIn: 'root',
})
export class AchievementNotificationService extends BaseNotificationService<AchievementNotification> {
  private readonly achievementsService = inject(AchievementsService);
  private readonly logger = inject(LoggerService);
  private readonly soundPlayer = new NotificationSoundPlayer();

  // Queue management
  private readonly _queue = signal<AchievementNotification[]>([]);
  private lastUnlockedCount = 0;
  private notificationTimeout: any = null;
  private queueIntervalId: number | null = null;

  constructor() {
    super();

    // Watch for new achievement unlocks
    effect(() => {
      const recent = this.achievementsService.recentUnlocks();
      const currentCount = recent.length;

      // Check if there are new unlocks
      if (currentCount > this.lastUnlockedCount) {
        const newUnlocks = recent.slice(this.lastUnlockedCount);
        newUnlocks.forEach((achievement: any) => {
          this.showNotification(achievement);
        });
        this.lastUnlockedCount = currentCount;
      }
    });

    // Process notification queue
    this.processQueue();
  }

  /**
   * Show notification for an achievement
   */
  private showNotification(achievement: any): void {
    const notification: AchievementNotification = {
      id: `notif-${achievement.id}-${Date.now()}`,
      achievementId: achievement.id,
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      tier: achievement.tier,
      timestamp: new Date(),
      autoClose: true,
      duration: NOTIFICATION_DURATIONS.achievement,
      isVisible: false,
    };

    // Add to queue
    this._queue.update((queue) => [...queue, notification]);

    this.logger.success(
      `🏆 Achievement Unlocked: ${achievement.name}`,
      'Achievements',
    );
  }

  /**
   * Process notification queue (show one at a time)
   */
  private processQueue(): void {
    // Clear any existing interval to prevent memory leaks
    if (this.queueIntervalId !== null) {
      clearInterval(this.queueIntervalId);
    }

    this.queueIntervalId = window.setInterval(() => {
      const queue = this._queue();
      const current = this._notifications();

      // Only show one notification at a time
      if (queue.length > 0 && current.length === 0) {
        const next = queue[0];

        // Move from queue to notifications
        this._queue.update((q) => q.slice(1));
        this._notifications.set([{ ...next, isVisible: true }]);

        // Play sound effect (optional)
        this.playSound();

        // Auto-dismiss after 4 seconds
        if (this.notificationTimeout) {
          clearTimeout(this.notificationTimeout);
        }

        this.notificationTimeout = setTimeout(() => {
          this.dismissNotification(next.id);
        }, NOTIFICATION_DURATIONS.achievement);
      }
    }, 500); // Check queue every 500ms
  }

  /**
   * Dismiss a notification
   */
  dismissNotification(id: string): void {
    this._notifications.update((notifications) =>
      notifications.filter((n) => n.id !== id),
    );
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): void {
    this._notifications.set([]);
    this._queue.set([]);
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
  }

  /**
   * Cleanup on service destroy
   */
  ngOnDestroy(): void {
    if (this.queueIntervalId !== null) {
      clearInterval(this.queueIntervalId);
    }
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    this.soundPlayer.destroy();
  }

  /**
   * Play achievement unlock sound (optional)
   */
  private playSound(): void {
    try {
      this.soundPlayer.playAchievementSound();
    } catch (error) {
      // Silent fail - sound is optional
      this.logger.debug('Failed to play sound:', error);
    }
  }

  /**
   * Get tier color for notification
   */
  getTierColor(tier: string): string {
    return getTierColor(tier);
  }

  /**
   * Get category icon for notification
   */
  getCategoryIcon(category: string): string {
    return getCategoryIcon(category);
  }
}
