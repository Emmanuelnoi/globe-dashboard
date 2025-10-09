import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-angular';
import {
  NotificationService,
  type Notification,
} from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="notification-container"
      [class.has-notifications]="notificationService.hasNotifications()"
    >
      @for (
        notification of notificationService.notifications();
        track notification.id
      ) {
        <div
          class="notification-toast"
          [class]="'notification-' + notification.type"
          [attr.role]="notification.type === 'error' ? 'alert' : 'status'"
          [attr.aria-live]="
            notification.type === 'error' ? 'assertive' : 'polite'
          "
          [attr.aria-labelledby]="'notification-title-' + notification.id"
          [attr.aria-describedby]="'notification-message-' + notification.id"
        >
          <!-- Icon based on notification type -->
          <div class="notification-icon">
            @switch (notification.type) {
              @case ('success') {
                <lucide-angular
                  [img]="CheckCircle"
                  class="icon-success"
                ></lucide-angular>
              }
              @case ('error') {
                <lucide-angular
                  [img]="AlertCircle"
                  class="icon-error"
                ></lucide-angular>
              }
              @case ('warning') {
                <lucide-angular
                  [img]="AlertTriangle"
                  class="icon-warning"
                ></lucide-angular>
              }
              @case ('info') {
                <lucide-angular [img]="Info" class="icon-info"></lucide-angular>
              }
            }
          </div>

          <!-- Content -->
          <div class="notification-content">
            <h4
              class="notification-title"
              [id]="'notification-title-' + notification.id"
            >
              {{ notification.title }}
            </h4>
            <p
              class="notification-message"
              [id]="'notification-message-' + notification.id"
            >
              {{ notification.message }}
            </p>
          </div>

          <!-- Close button -->
          <button
            type="button"
            class="notification-close"
            (click)="dismiss(notification.id)"
            [attr.aria-label]="'Close ' + notification.title + ' notification'"
          >
            <lucide-angular [img]="X" class="close-icon"></lucide-angular>
          </button>

          <!-- Progress bar for auto-close -->
          @if (notification.autoClose) {
            <div class="notification-progress">
              <div
                class="notification-progress-bar"
                [style.animation-duration]="notification.duration + 'ms'"
              ></div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .notification-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 400px;
        pointer-events: none;
      }

      .notification-container.has-notifications {
        pointer-events: auto;
      }

      .notification-toast {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        color: white;
        font-family:
          'Inter',
          -apple-system,
          BlinkMacSystemFont,
          sans-serif;
        animation: slideIn 0.3s ease-out;
        overflow: hidden;
      }

      .notification-toast::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.1) 0%,
          rgba(255, 255, 255, 0.05) 100%
        );
        pointer-events: none;
      }

      /* Type-specific styling */
      .notification-success {
        border-left: 3px solid #10b981;
        background: rgba(16, 185, 129, 0.1);
      }

      .notification-error {
        border-left: 3px solid #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }

      .notification-warning {
        border-left: 3px solid #f59e0b;
        background: rgba(245, 158, 11, 0.1);
      }

      .notification-info {
        border-left: 3px solid #3b82f6;
        background: rgba(59, 130, 246, 0.1);
      }

      .notification-icon {
        flex-shrink: 0;
        margin-top: 0.125rem;
      }

      .notification-icon lucide-angular {
        width: 20px;
        height: 20px;
      }

      .icon-success {
        color: #10b981;
      }
      .icon-error {
        color: #ef4444;
      }
      .icon-warning {
        color: #f59e0b;
      }
      .icon-info {
        color: #3b82f6;
      }

      .notification-content {
        flex: 1;
        min-width: 0;
      }

      .notification-title {
        margin: 0 0 0.25rem 0;
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1.25;
        color: white;
      }

      .notification-message {
        margin: 0;
        font-size: 0.8125rem;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.8);
        word-wrap: break-word;
      }

      .notification-close {
        flex-shrink: 0;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 0.375rem;
        transition: all 0.2s ease;
        margin-top: -0.125rem;
      }

      .notification-close:hover {
        color: white;
        background: rgba(255, 255, 255, 0.1);
      }

      .notification-close:focus {
        outline: none;
        color: white;
        background: rgba(255, 255, 255, 0.15);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
      }

      .close-icon {
        width: 16px;
        height: 16px;
      }

      .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: rgba(255, 255, 255, 0.1);
        overflow: hidden;
      }

      .notification-progress-bar {
        height: 100%;
        background: rgba(255, 255, 255, 0.3);
        width: 100%;
        animation: progressShrink linear;
        transform-origin: left;
      }

      /* Animations */
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes progressShrink {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }

      /* Mobile responsiveness */
      @media (max-width: 640px) {
        .notification-container {
          left: 1rem;
          right: 1rem;
          max-width: none;
        }

        .notification-toast {
          padding: 0.875rem;
          gap: 0.625rem;
        }

        .notification-title {
          font-size: 0.8125rem;
        }

        .notification-message {
          font-size: 0.75rem;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .notification-toast {
          animation: none;
        }

        .notification-progress-bar {
          animation: none;
          background: rgba(255, 255, 255, 0.1);
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .notification-toast {
          border: 2px solid white;
          background: black;
        }

        .notification-title,
        .notification-message {
          color: white;
        }
      }
    `,
  ],
})
export class NotificationToast {
  protected readonly notificationService = inject(NotificationService);

  // Icon references for template
  protected readonly X = X;
  protected readonly CheckCircle = CheckCircle;
  protected readonly AlertCircle = AlertCircle;
  protected readonly AlertTriangle = AlertTriangle;
  protected readonly Info = Info;

  /**
   * Dismiss a notification
   */
  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }
}
