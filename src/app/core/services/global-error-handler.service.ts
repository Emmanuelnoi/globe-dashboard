import {
  Injectable,
  ErrorHandler,
  NgZone,
  inject,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';

export interface ErrorContext {
  feature?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  url: string;
  userAgent: string;
}

export interface ProcessedError {
  id: string;
  message: string;
  originalError: Error;
  context: ErrorContext;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'runtime' | 'security' | 'validation' | 'unknown';
}

@Injectable({
  providedIn: 'root',
})
export class GlobalErrorHandlerService implements ErrorHandler, OnDestroy {
  private ngZone = inject(NgZone);
  private router = inject(Router);

  private errorQueue: ProcessedError[] = [];
  private readonly maxQueueSize = 50;
  private readonly batchSize = 10;
  private readonly flushInterval = 30000; // 30 seconds
  private batchProcessingInterval: number | null = null;

  constructor() {
    this.startBatchProcessing();
    this.setupUnhandledRejectionHandler();
  }

  ngOnDestroy(): void {
    // Clean up interval to prevent memory leaks
    if (this.batchProcessingInterval !== null) {
      clearInterval(this.batchProcessingInterval);
      this.batchProcessingInterval = null;
    }
  }

  handleError(error: Error | unknown): void {
    console.error('Global error handler caught:', error);

    try {
      const processedError = this.processError(error);
      this.queueError(processedError);

      // Handle critical errors immediately
      if (processedError.severity === 'critical') {
        this.handleCriticalError(processedError);
      }
    } catch (processingError) {
      console.error('Error in error handler:', processingError);
      // Fallback to basic logging
      this.basicErrorLog(error);
    }
  }

  /**
   * Handle errors with additional context
   */
  handleErrorWithContext(
    error: Error,
    context: Partial<ErrorContext> = {},
  ): void {
    const errorWithContext = { ...error, context };
    this.handleError(errorWithContext);
  }

  /**
   * Handle network errors specifically
   */
  handleNetworkError(error: Error, url?: string): void {
    this.handleErrorWithContext(error, {
      feature: 'network',
      action: url ? `request_to_${url}` : 'network_request',
    });
  }

  /**
   * Handle Three.js/WebGL errors
   */
  handleWebGLError(error: Error, context?: string): void {
    this.handleErrorWithContext(error, {
      feature: '3d_rendering',
      action: context || 'webgl_operation',
    });
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 10): ProcessedError[] {
    return this.errorQueue.slice(-limit);
  }

  /**
   * Clear error queue
   */
  clearErrors(): void {
    this.errorQueue = [];
  }

  private processError(error: Error | unknown): ProcessedError {
    const baseContext: ErrorContext = {
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Extract context if provided
    const errorWithContext = error as {
      context?: Partial<ErrorContext>;
      originalError?: Error;
      rejection?: Error;
    };
    const context = { ...baseContext, ...(errorWithContext.context || {}) };

    // Get the actual error object
    const actualError =
      errorWithContext.originalError || errorWithContext.rejection || error;

    // Ensure actualError is an Error object
    const errorObj =
      actualError instanceof Error
        ? actualError
        : new Error(String(actualError));
    const actualErrorWithStack = actualError as { stack?: string };

    const processedError: ProcessedError = {
      id: this.generateErrorId(),
      message: this.extractErrorMessage(actualError),
      originalError: errorObj,
      context,
      stack: actualErrorWithStack?.stack,
      severity: this.determineSeverity(actualError),
      category: this.categorizeError(actualError),
    };

    return processedError;
  }

  private extractErrorMessage(error: Error | unknown): string {
    if (typeof error === 'string') return error;

    const errorObj = error as {
      message?: string;
      error?: { message?: string };
      name?: string;
    };
    if (errorObj?.message) return errorObj.message;
    if (errorObj?.error?.message) return errorObj.error.message;
    if (errorObj?.name)
      return `${errorObj.name}: ${errorObj.message || 'Unknown error'}`;

    return 'An unknown error occurred';
  }

  private determineSeverity(
    error: Error | unknown,
  ): ProcessedError['severity'] {
    const message = this.extractErrorMessage(error).toLowerCase();

    // Critical errors
    if (
      message.includes('webgl') ||
      message.includes('out of memory') ||
      message.includes('security') ||
      message.includes('cors')
    ) {
      return 'critical';
    }

    // High severity
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      return 'high';
    }

    // Medium severity
    if (
      message.includes('validation') ||
      message.includes('permission') ||
      message.includes('not found')
    ) {
      return 'medium';
    }

    return 'low';
  }

  private categorizeError(error: Error | unknown): ProcessedError['category'] {
    const message = this.extractErrorMessage(error).toLowerCase();
    const errorObj = error as { stack?: string };
    const stack = errorObj?.stack?.toLowerCase() || '';

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('xhr') ||
      message.includes('connection')
    ) {
      return 'network';
    }

    if (
      message.includes('security') ||
      message.includes('cors') ||
      message.includes('permission')
    ) {
      return 'security';
    }

    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return 'validation';
    }

    if (
      stack.includes('three') ||
      stack.includes('webgl') ||
      message.includes('webgl')
    ) {
      return 'runtime';
    }

    return 'unknown';
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private queueError(error: ProcessedError): void {
    this.errorQueue.push(error);

    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize);
    }
  }

  private handleCriticalError(error: ProcessedError): void {
    // Immediately send critical errors
    this.sendErrorToService([error]);

    // Show user notification for critical errors
    this.ngZone.run(() => {
      console.error('Critical error occurred:', error);

      // In a real app, you might show a toast notification
      // or redirect to an error page
      if (error.category === 'security') {
        // Handle security errors
        this.router.navigate(['/error'], {
          queryParams: { type: 'security' },
        });
      }
    });
  }

  private startBatchProcessing(): void {
    this.batchProcessingInterval = window.setInterval(() => {
      if (this.errorQueue.length >= this.batchSize) {
        const batch = this.errorQueue.splice(0, this.batchSize);
        this.sendErrorToService(batch);
      }
    }, this.flushInterval);
  }

  private setupUnhandledRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        name: 'UnhandledPromiseRejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        rejection: event.reason,
      });
    });
  }

  private sendErrorToService(errors: ProcessedError[]): void {
    // In production, send to your error tracking service
    // Examples: Sentry, LogRocket, Rollbar, etc.

    try {
      // Example integration with Google Analytics
      if (typeof window !== 'undefined' && 'gtag' in window) {
        errors.forEach((error) => {
          (window as unknown as { gtag: Function }).gtag('event', 'exception', {
            description: error.message,
            fatal: error.severity === 'critical',
            custom_map: {
              error_id: error.id,
              category: error.category,
              severity: error.severity,
            },
          });
        });
      }

      // Example API call (uncomment and modify for your backend)
      /*
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors: errors.map(error => ({
            id: error.id,
            message: error.message,
            stack: error.stack,
            context: error.context,
            severity: error.severity,
            category: error.category,
          }))
        })
      }).catch(err => {
        console.error('Failed to send errors to service:', err);
      });
      */
    } catch (error) {
      console.error('Failed to send errors to tracking service:', error);
    }
  }

  private basicErrorLog(error: Error | unknown): void {
    const timestamp = new Date().toISOString();
    const errorObj = error as { message?: string; stack?: string };
    const errorData = {
      timestamp,
      error: errorObj?.message || error,
      stack: errorObj?.stack,
      url: window.location.href,
    };

    console.error('Basic error log:', errorData);

    // Store in localStorage as fallback
    try {
      const stored = localStorage.getItem('app_errors') || '[]';
      const errors = JSON.parse(stored);
      errors.push(errorData);

      // Keep only last 20 errors
      if (errors.length > 20) {
        errors.splice(0, errors.length - 20);
      }

      localStorage.setItem('app_errors', JSON.stringify(errors));
    } catch (storageError) {
      console.error('Failed to store error in localStorage:', storageError);
    }
  }
}
