import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AchievementNotificationService,
  AchievementNotification,
} from '../../../core/services/achievement-notification.service';

/**
 * Achievement Notification Component
 *
 * Displays animated toast notifications when users unlock achievements.
 * Auto-dismisses after 4 seconds with click to dismiss support.
 */
@Component({
  selector: 'app-achievement-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="achievement-notification-container">
      @for (
        notification of notificationService.notifications();
        track notification.id
      ) {
        <div
          class="achievement-notification"
          [class.visible]="notification.isVisible"
          (click)="dismiss(notification.id)"
          role="alert"
          aria-live="polite"
        >
          <div
            class="notification-icon"
            [style.background]="getTierColor(notification.tier)"
          >
            {{ getCategoryIcon(notification.category) }}
          </div>
          <div class="notification-content">
            <div class="notification-header">
              <span class="achievement-label">🏆 Achievement Unlocked!</span>
              <span
                class="tier-badge"
                [style.color]="getTierColor(notification.tier)"
              >
                {{ notification.tier | uppercase }}
              </span>
            </div>
            <div class="achievement-name">{{ notification.name }}</div>
            <div class="achievement-description">
              {{ notification.description }}
            </div>
          </div>
          <button
            class="close-button"
            (click)="dismiss(notification.id); $event.stopPropagation()"
            aria-label="Dismiss notification"
            type="button"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .achievement-notification-container {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }

      .achievement-notification {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 400px;
        max-width: 500px;
        padding: 16px 20px;
        background: linear-gradient(
          135deg,
          rgba(16, 185, 129, 0.15) 0%,
          rgba(5, 150, 105, 0.15) 100%
        );
        backdrop-filter: blur(16px) saturate(1.2);
        -webkit-backdrop-filter: blur(16px) saturate(1.2);
        border: 1px solid rgba(16, 185, 129, 0.4);
        border-radius: 12px;
        box-shadow:
          0 8px 32px rgba(16, 185, 129, 0.3),
          0 2px 8px rgba(0, 0, 0, 0.3);
        color: var(--glass-text-primary);
        cursor: pointer;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

        &.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        &:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow:
            0 12px 40px rgba(16, 185, 129, 0.4),
            0 4px 12px rgba(0, 0, 0, 0.4);
        }
      }

      .notification-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        flex-shrink: 0;
        border: 2px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          transform: scale(1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }
        50% {
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
        }
      }

      .notification-content {
        flex: 1;
        min-width: 0;
      }

      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        gap: 8px;

        .achievement-label {
          font-size: 12px;
          font-weight: 600;
          color: rgb(16, 185, 129);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tier-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      }

      .achievement-name {
        font-size: 16px;
        font-weight: 700;
        color: var(--glass-text-primary);
        margin-bottom: 4px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .achievement-description {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.4;
      }

      .close-button {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.8);
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        &:active {
          transform: scale(0.95);
        }
      }

      // Responsive
      @media (max-width: 768px) {
        .achievement-notification-container {
          left: 10px;
          right: 10px;
          transform: none;
        }

        .achievement-notification {
          min-width: 0;
          max-width: 100%;
        }
      }

      @media (max-width: 480px) {
        .achievement-notification {
          padding: 12px 16px;
          gap: 12px;

          .notification-icon {
            width: 48px;
            height: 48px;
            font-size: 24px;
          }

          .achievement-name {
            font-size: 14px;
          }

          .achievement-description {
            font-size: 12px;
          }
        }
      }
    `,
  ],
})
export class AchievementNotificationComponent {
  protected readonly notificationService = inject(
    AchievementNotificationService,
  );

  /**
   * Dismiss a notification
   */
  dismiss(id: string): void {
    this.notificationService.dismissNotification(id);
  }

  /**
   * Get tier color
   */
  getTierColor(tier: string): string {
    return this.notificationService.getTierColor(tier);
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    return this.notificationService.getCategoryIcon(category);
  }
}
