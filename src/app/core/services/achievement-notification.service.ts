import { Injectable, signal, effect, inject } from '@angular/core';
import { AchievementsService } from './achievements.service';
import { LoggerService } from './logger.service';

/**
 * Achievement Notification Item
 */
export interface AchievementNotification {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  timestamp: Date;
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
export class AchievementNotificationService {
  private readonly achievementsService = inject(AchievementsService);
  private readonly logger = inject(LoggerService);

  // State
  private readonly _notifications = signal<AchievementNotification[]>([]);
  private readonly _queue = signal<AchievementNotification[]>([]);
  private lastUnlockedCount = 0;
  private notificationTimeout: any = null;

  // Public readonly signals
  readonly notifications = this._notifications.asReadonly();
  readonly hasNotifications = () => this._notifications().length > 0;

  constructor() {
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
  private async processQueue(): Promise<void> {
    setInterval(() => {
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
        }, 4000);
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
   * Play achievement unlock sound (optional)
   */
  private playSound(): void {
    try {
      // Create a simple success sound using Web Audio API
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Achievement unlock sound: two-tone chime
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(
        659.25,
        audioContext.currentTime + 0.1,
      ); // E5
      oscillator.frequency.setValueAtTime(
        783.99,
        audioContext.currentTime + 0.2,
      ); // G5

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      // Silent fail - sound is optional
      this.logger.debug('Failed to play sound:', error);
    }
  }

  /**
   * Get tier color for notification
   */
  getTierColor(tier: string): string {
    const colors: Record<string, string> = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
      platinum: '#e5e4e2',
      diamond: '#b9f2ff',
    };
    return colors[tier] || '#10b981';
  }

  /**
   * Get category icon for notification
   */
  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      quiz: '🎯',
      discovery: '🗺️',
      exploration: '🔍',
      social: '👥',
      milestone: '⭐',
    };
    return icons[category] || '🏆';
  }
}
