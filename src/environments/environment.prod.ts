/**
 * Production Environment Configuration
 * This file is used for production builds
 *
 * IMPORTANT: Update these values before deploying to production
 */

export const environment = {
  // Environment identifier
  production: true,

  // API Endpoints
  gbifApiUrl: 'https://api.gbif.org/v1',

  // Feature Flags
  enableDebugLogging: false, // Disable debug logs in production
  enablePerformanceMonitoring: true,
  enableAnalytics: true, // Enable analytics in production

  // Cache Configuration
  cacheEnabled: true,
  cacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  cacheMaxSize: 50 * 1024 * 1024, // 50MB
  cacheMaxEntries: 100,

  // Rate Limiting
  rateLimitEnabled: true,
  maxRequestsPerMinute: 300,
  maxRequestsPerHour: 10000,

  // Performance
  enableWebWorkers: true,
  maxWebWorkers: 6,

  // Data Loading
  dataLoadingBatchSize: 1000,
  dataLoadingProgressiveStages: 5,

  // Error Tracking (Sentry) - Configure before production deployment
  sentryDsn: '', // TODO: Add your Sentry DSN here
  sentryEnvironment: 'production',
  sentryTracesSampleRate: 0.1, // Sample 10% of transactions in production
  sentryEnabled: false, // TODO: Set to true after configuring Sentry DSN

  // Analytics - Configure before production deployment
  googleAnalyticsId: '', // TODO: Add your Google Analytics ID here
  analyticsEnabled: false, // TODO: Set to true after configuring GA ID

  // Build Information
  version: '1.0.0',
  buildDate: new Date().toISOString(),
} as const;

export type Environment = typeof environment;
