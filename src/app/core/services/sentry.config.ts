import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';

/**
 * Initialize Sentry Error Tracking
 *
 * To enable Sentry in production:
 * 1. Sign up at https://sentry.io/
 * 2. Create a new project (Angular)
 * 3. Copy your DSN
 * 4. Add to Netlify environment variables:
 *    - VITE_SENTRY_DSN=your-dsn-here
 * 5. Optionally set VITE_SENTRY_ENVIRONMENT=production
 */
export function initializeSentry(): void {
  // Only initialize if DSN is provided and enabled
  if (!environment.sentryDsn || !environment.sentryEnabled) {
    console.info('[Sentry] Not initialized - DSN not provided or disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: environment.sentryDsn,
      environment: environment.sentryEnvironment || 'production',

      // Performance Monitoring
      tracesSampleRate: environment.sentryTracesSampleRate || 0.1,

      // Track navigation timing - trace propagation targets
      tracePropagationTargets: ['localhost', /^\//],

      // Release tracking
      release: `3d-global-dashboard@${environment.version}`,

      // Enhanced error context
      integrations: [
        // Browser integrations
        Sentry.browserTracingIntegration(),

        // Replay sessions for debugging
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Session Replay sampling
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of errored sessions

      // Filter out noise
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        // Random network errors
        'NetworkError',
        'ChunkLoadError',
      ],

      // Custom error enrichment
      beforeSend(event, hint) {
        // Add custom context
        event.contexts = event.contexts || {};
        event.contexts.app = {
          version: environment.version,
          buildDate: environment.buildDate,
        };

        // Filter sensitive data
        if (event.request) {
          delete event.request.cookies;
        }

        return event;
      },
    });

    console.info('[Sentry] Initialized successfully');
  } catch (error) {
    console.error('[Sentry] Initialization failed:', error);
  }
}

/**
 * Capture custom message
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (!environment.sentryEnabled) return;

  Sentry.captureMessage(message, level);
}
