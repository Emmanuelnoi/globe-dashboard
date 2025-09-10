import { Component, Input, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: Date;
  userAgent: string;
  url: string;
}

@Component({
  selector: 'app-error-boundary',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (hasError()) {
      <div class="error-boundary-container">
        <div class="error-boundary-card">
          <!-- Error Icon -->
          <div class="error-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <!-- Error Content -->
          <div class="error-content">
            <h2 class="error-title">{{ errorTitle }}</h2>
            <p class="error-message">{{ errorDescription }}</p>

            @if (showDetails && errorInfo()) {
              <details class="error-details">
                <summary>Technical Details</summary>
                <pre class="error-stack">{{ errorInfo()?.message }}</pre>
                @if (errorInfo()?.stack) {
                  <pre class="error-stack">{{ errorInfo()?.stack }}</pre>
                }
              </details>
            }
          </div>

          <!-- Error Actions -->
          <div class="error-actions">
            <button
              class="btn btn-primary"
              (click)="retry()"
              [disabled]="isRetrying()"
            >
              @if (isRetrying()) {
                <span class="spinner"></span>
                Retrying...
              } @else {
                Try Again
              }
            </button>

            <button class="btn btn-secondary" (click)="reload()">
              Reload Page
            </button>

            @if (canReport) {
              <button class="btn btn-outline" (click)="reportError()">
                Report Issue
              </button>
            }
          </div>

          <!-- Help Text -->
          <div class="error-help">
            <p class="help-text">
              If this problem persists, try refreshing the page or
              <a href="mailto:support@example.com" class="help-link"
                >contact support</a
              >.
            </p>
          </div>
        </div>
      </div>
    } @else {
      <ng-content></ng-content>
    }
  `,
  styles: [
    `
      .error-boundary-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        padding: 2rem;
        background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
      }

      .error-boundary-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 2rem;
        max-width: 500px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }

      .error-icon {
        color: #ef4444;
        margin-bottom: 1.5rem;
        animation: pulse 2s infinite;
      }

      .error-title {
        color: #f8fafc;
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
      }

      .error-message {
        color: #cbd5e1;
        font-size: 1rem;
        margin: 0 0 1.5rem 0;
        line-height: 1.5;
      }

      .error-details {
        text-align: left;
        margin: 1rem 0;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 1rem;
      }

      .error-details summary {
        color: #94a3b8;
        cursor: pointer;
        font-weight: 500;
        margin-bottom: 0.5rem;
      }

      .error-stack {
        color: #e2e8f0;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 0.75rem;
        margin: 0.5rem 0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .error-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
        margin-bottom: 1.5rem;
      }

      .btn {
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 500;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border: none;
        text-decoration: none;
      }

      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-primary {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
      }

      .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
      }

      .btn-outline {
        background: transparent;
        color: #94a3b8;
        border: 1px solid rgba(148, 163, 184, 0.3);
      }

      .btn-outline:hover {
        color: #f8fafc;
        border-color: rgba(248, 250, 252, 0.3);
      }

      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .error-help {
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .help-text {
        color: #64748b;
        font-size: 0.875rem;
        margin: 0;
      }

      .help-link {
        color: #3b82f6;
        text-decoration: none;
      }

      .help-link:hover {
        text-decoration: underline;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 480px) {
        .error-boundary-container {
          padding: 1rem;
        }

        .error-boundary-card {
          padding: 1.5rem;
        }

        .error-actions {
          flex-direction: column;
        }

        .btn {
          width: 100%;
          justify-content: center;
        }
      }
    `,
  ],
})
export class ErrorBoundaryComponent {
  // Input properties
  @Input() errorTitle: string = 'Something went wrong';
  @Input() errorDescription: string =
    'An unexpected error occurred. Please try again.';
  @Input() showDetails: boolean = false;
  @Input() canReport: boolean = true;
  @Input() autoRetry: boolean = false;
  @Input() retryDelay: number = 3000;

  // State signals
  protected readonly hasError = signal(false);
  protected readonly isRetrying = signal(false);
  protected readonly errorInfo = signal<ErrorInfo | null>(null);
  protected readonly retryCount = signal(0);

  // Output events
  readonly onRetry = output<void>();
  readonly onReload = output<void>();
  readonly onReport = output<ErrorInfo>();

  private maxRetries = 3;

  /**
   * Handle an error and display the error boundary
   */
  handleError(error: Error | ErrorInfo): void {
    console.error('Error caught by boundary:', error);

    const errorInfo: ErrorInfo =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            url: window.location.href,
          }
        : error;

    this.errorInfo.set(errorInfo);
    this.hasError.set(true);

    // Auto-retry if enabled and under retry limit
    if (this.autoRetry && this.retryCount() < this.maxRetries) {
      setTimeout(() => {
        this.retry();
      }, this.retryDelay);
    }

    // Report to analytics/monitoring service
    this.logErrorToService(errorInfo);
  }

  /**
   * Retry the failed operation
   */
  retry(): void {
    this.isRetrying.set(true);
    this.retryCount.update((count) => count + 1);

    // Emit retry event
    this.onRetry.emit();

    // Simulate retry delay
    setTimeout(() => {
      this.reset();
      this.isRetrying.set(false);
    }, 1000);
  }

  /**
   * Reload the entire page
   */
  reload(): void {
    this.onReload.emit();
    window.location.reload();
  }

  /**
   * Report the error to support
   */
  reportError(): void {
    const error = this.errorInfo();
    if (error) {
      this.onReport.emit(error);
      // Could integrate with error reporting service here
      this.openErrorReport(error);
    }
  }

  /**
   * Reset the error boundary state
   */
  reset(): void {
    this.hasError.set(false);
    this.errorInfo.set(null);
    this.retryCount.set(0);
  }

  /**
   * Clear the error and continue
   */
  dismiss(): void {
    this.reset();
  }

  private logErrorToService(error: ErrorInfo): void {
    // In production, send to your error tracking service
    // Example: Sentry, LogRocket, etc.
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as unknown as { gtag: Function }).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        custom_map: {
          timestamp: error.timestamp.toISOString(),
          url: error.url,
        },
      });
    }
  }

  private openErrorReport(error: ErrorInfo): void {
    const subject = encodeURIComponent('Error Report - 3D Global Dashboard');
    const body = encodeURIComponent(`
Error Details:
- Message: ${error.message}
- Timestamp: ${error.timestamp.toISOString()}
- URL: ${error.url}
- User Agent: ${error.userAgent}

Stack Trace:
${error.stack || 'Not available'}

Additional Information:
Please describe what you were doing when this error occurred.
    `);

    const mailtoUrl = `mailto:support@example.com?subject=${subject}&body=${body}`;
    window.open(mailtoUrl);
  }
}
