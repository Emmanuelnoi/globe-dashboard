/**
 * HTTP Error Interceptor
 *
 * Provides centralized error handling for all HTTP requests with:
 * - Automatic retry logic for failed requests
 * - Rate limit handling
 * - Network error detection
 * - User-friendly error notifications
 * - Error logging and monitoring
 *
 * @see https://angular.dev/guide/http/interceptors
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, timer } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';
import { ErrorNotificationService } from '../services/error-notification.service';

/**
 * Maximum number of retry attempts for failed requests
 */
const MAX_RETRIES = 3;

/**
 * Base delay between retries in milliseconds
 */
const RETRY_DELAY_MS = 1000;

/**
 * HTTP status codes that should trigger a retry
 */
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * HTTP Error Interceptor Function
 *
 * Intercepts all HTTP requests and applies error handling logic.
 * Uses functional interceptor pattern introduced in Angular 15+.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const errorNotificationService = inject(ErrorNotificationService);

  return next(req).pipe(
    // Retry logic with exponential backoff
    retry({
      count: MAX_RETRIES,
      delay: (error: HttpErrorResponse, retryCount: number) => {
        // Only retry for specific status codes
        if (!RETRYABLE_STATUS_CODES.includes(error.status)) {
          throw error;
        }

        // Calculate exponential backoff delay
        const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount - 1);

        logger.warn(
          `HTTP request failed (attempt ${retryCount}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`,
          'HttpErrorInterceptor',
          { url: req.url, status: error.status },
        );

        // Return timer observable for delay
        return timer(delayMs);
      },
    }),

    // Error handling
    catchError((error: HttpErrorResponse) => {
      // Determine error type and message
      const errorInfo = getErrorInfo(error);

      // Log the error
      logger.error(
        `HTTP ${errorInfo.type}: ${errorInfo.message} [${req.method} ${req.url}]`,
        error,
        'HttpErrorInterceptor',
      );

      // Show user notification (non-blocking)
      errorNotificationService.showError(
        errorInfo.title,
        errorInfo.userMessage,
        errorInfo.severity === 'critical' ? 0 : 5000,
      );

      // Track error in monitoring (if enabled)
      trackError(error, req.url);

      // Re-throw error for component-level handling
      return throwError(() => error);
    }),
  );
};

/**
 * Extract user-friendly error information from HTTP error
 */
function getErrorInfo(error: HttpErrorResponse): {
  type: string;
  message: string;
  userMessage: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionLabel?: string;
} {
  // Client-side or network error
  if (error.error instanceof ErrorEvent) {
    return {
      type: 'Network Error',
      message: error.error.message,
      userMessage:
        'Unable to connect. Please check your internet connection and try again.',
      title: 'Connection Error',
      severity: 'high',
      actionLabel: 'Retry',
    };
  }

  // HTTP error response from server
  switch (error.status) {
    case 0:
      return {
        type: 'Connection Failed',
        message: 'No response from server',
        userMessage:
          'Unable to reach the server. Please check your connection.',
        title: 'Connection Failed',
        severity: 'critical',
        actionLabel: 'Retry',
      };

    case 400:
      return {
        type: 'Bad Request',
        message: error.error?.message || 'Invalid request',
        userMessage: 'Invalid request. Please check your input and try again.',
        title: 'Invalid Request',
        severity: 'medium',
      };

    case 401:
      return {
        type: 'Unauthorized',
        message: 'Authentication required',
        userMessage: 'Authentication required. Please log in to continue.',
        title: 'Authentication Required',
        severity: 'high',
        actionLabel: 'Log In',
      };

    case 403:
      return {
        type: 'Forbidden',
        message: 'Access denied',
        userMessage: 'You do not have permission to access this resource.',
        title: 'Access Denied',
        severity: 'high',
      };

    case 404:
      return {
        type: 'Not Found',
        message: 'Resource not found',
        userMessage: 'The requested resource was not found.',
        title: 'Not Found',
        severity: 'medium',
      };

    case 408:
      return {
        type: 'Request Timeout',
        message: 'Request took too long',
        userMessage: 'Request timed out. Please try again.',
        title: 'Request Timeout',
        severity: 'medium',
        actionLabel: 'Retry',
      };

    case 429:
      return {
        type: 'Rate Limit',
        message: 'Too many requests',
        userMessage: 'Too many requests. Please wait a moment and try again.',
        title: 'Rate Limit Exceeded',
        severity: 'medium',
      };

    case 500:
      return {
        type: 'Server Error',
        message: 'Internal server error',
        userMessage: 'A server error occurred. Our team has been notified.',
        title: 'Server Error',
        severity: 'critical',
        actionLabel: 'Retry',
      };

    case 502:
    case 503:
      return {
        type: 'Service Unavailable',
        message: 'Service temporarily unavailable',
        userMessage:
          'The service is temporarily unavailable. Please try again in a few moments.',
        title: 'Service Unavailable',
        severity: 'critical',
        actionLabel: 'Retry',
      };

    case 504:
      return {
        type: 'Gateway Timeout',
        message: 'Gateway timeout',
        userMessage: 'The request timed out. Please try again.',
        title: 'Gateway Timeout',
        severity: 'high',
        actionLabel: 'Retry',
      };

    default:
      return {
        type: 'HTTP Error',
        message: error.message || `HTTP error ${error.status}`,
        userMessage: 'An unexpected error occurred. Please try again.',
        title: 'Error',
        severity: 'medium',
        actionLabel: 'Retry',
      };
  }
}

/**
 * Track error in monitoring system (Sentry, etc.)
 * Only tracks in production when monitoring is enabled
 */
function trackError(error: HttpErrorResponse, url: string): void {
  // This will be enhanced when Sentry or other monitoring is configured
  // For now, just track in console in development
  if (typeof window !== 'undefined') {
    const windowWithSentry = window as unknown as {
      Sentry?: {
        captureException: (error: unknown, context?: unknown) => void;
      };
    };

    if (windowWithSentry.Sentry) {
      // Sentry is available - track error
      windowWithSentry.Sentry.captureException(error, {
        tags: {
          type: 'http_error',
          status: error.status,
          url,
        },
      });
    }
  }
}
