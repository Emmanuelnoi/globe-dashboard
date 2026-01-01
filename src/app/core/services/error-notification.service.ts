import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';
import {
  BaseNotificationService,
  BaseNotification,
} from './base-notification.service';
import { NOTIFICATION_DURATIONS } from './notification-helpers';

export interface ErrorNotification extends BaseNotification {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

@Injectable({
  providedIn: 'root',
})
export class ErrorNotificationService extends BaseNotificationService<ErrorNotification> {
  private readonly logger = inject(LoggerService);

  // Alias for backward compatibility
  readonly activeNotifications = this.notifications;

  /**
   * Show a user-friendly error notification
   */
  showError(
    title: string,
    message: string,
    duration: number = NOTIFICATION_DURATIONS.quizError,
  ): void {
    const id = this.generateId('error');
    const notification: ErrorNotification = {
      id,
      title,
      message,
      type: 'error',
      timestamp: new Date(),
      autoClose: true,
      duration,
    };
    this.addNotification(notification, { autoClose: true, duration });
  }

  /**
   * Show a warning notification
   */
  showWarning(
    title: string,
    message: string,
    duration: number = NOTIFICATION_DURATIONS.quizWarning,
  ): void {
    const id = this.generateId('warning');
    const notification: ErrorNotification = {
      id,
      title,
      message,
      type: 'warning',
      timestamp: new Date(),
      autoClose: true,
      duration,
    };
    this.addNotification(notification, { autoClose: true, duration });
  }

  /**
   * Show an info notification
   */
  showInfo(
    title: string,
    message: string,
    duration: number = NOTIFICATION_DURATIONS.quizInfo,
  ): void {
    const id = this.generateId('info');
    const notification: ErrorNotification = {
      id,
      title,
      message,
      type: 'info',
      timestamp: new Date(),
      autoClose: true,
      duration,
    };
    this.addNotification(notification, { autoClose: true, duration });
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
   * Clear all notifications (alias for backward compatibility)
   */
  clearAll(): void {
    this.clear();
  }
}
