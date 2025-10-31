import { Injectable, signal, inject } from '@angular/core';
import { LoggerService } from './logger.service';

export interface ErrorNotification {
  id: string;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  timestamp: Date;
  duration?: number; // Auto-dismiss after milliseconds
}

@Injectable({
  providedIn: 'root',
})
export class ErrorNotificationService {
  private readonly logger = inject(LoggerService);
  private notifications = signal<ErrorNotification[]>([]);

  readonly activeNotifications = this.notifications.asReadonly();

  /**
   * Show a user-friendly error notification
   */
  showError(title: string, message: string, duration = 5000): void {
    this.addNotification({
      title,
      message,
      type: 'error',
      duration,
    });
  }

  /**
   * Show a warning notification
   */
  showWarning(title: string, message: string, duration = 4000): void {
    this.addNotification({
      title,
      message,
      type: 'warning',
      duration,
    });
  }

  /**
   * Show an info notification
   */
  showInfo(title: string, message: string, duration = 3000): void {
    this.addNotification({
      title,
      message,
      type: 'info',
      duration,
    });
  }

  /**
   * Handle common quiz-related errors with user-friendly messages
   */
  handleQuizError(error: unknown, context: string): void {
    this.logger.error(`Quiz error in ${context}:`, error, 'ErrorNotification');

    if (error instanceof Error) {
      switch (context) {
        case 'start-game':
          this.showError(
            'Unable to Start Quiz',
            'There was a problem starting your quiz. Please try again or refresh the page.',
          );
          break;
        case 'save-session':
          this.showWarning(
            'Progress Not Saved',
            'Your quiz results may not be saved. Please ensure you have storage available and try again.',
          );
          break;
        case 'load-stats':
          this.showWarning(
            'Stats Unavailable',
            "We couldn't load your statistics. Your progress is safe, but stats may not display correctly.",
          );
          break;
        case 'export-data':
          this.showError(
            'Export Failed',
            'Unable to export your data. Please check your browser permissions and try again.',
          );
          break;
        case 'import-data':
          this.showError(
            'Import Failed',
            "The file couldn't be imported. Please check the file format and try again.",
          );
          break;
        case 'flag-load':
          this.showInfo(
            'Flag Not Available',
            "Some flag images may not display correctly. This won't affect your quiz experience.",
          );
          break;
        default:
          this.showError(
            'Something Went Wrong',
            'An unexpected error occurred. Please try again or refresh the page.',
          );
      }
    } else {
      this.showError(
        'Unexpected Error',
        'Something unexpected happened. Please try refreshing the page.',
      );
    }
  }

  /**
   * Dismiss a specific notification
   */
  dismiss(id: string): void {
    this.notifications.update((notifications) =>
      notifications.filter((n) => n.id !== id),
    );
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications.set([]);
  }

  private addNotification(
    notification: Omit<ErrorNotification, 'id' | 'timestamp'>,
  ): void {
    const fullNotification: ErrorNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    this.notifications.update((notifications) => [
      ...notifications,
      fullNotification,
    ]);

    // Auto-dismiss if duration is specified
    if (notification.duration) {
      setTimeout(() => {
        this.dismiss(fullNotification.id);
      }, notification.duration);
    }
  }
}
