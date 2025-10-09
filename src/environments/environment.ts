/**
 * Development Environment Configuration
 * This file is used for local development and testing
 */

export const environment = {
  // Environment identifier
  production: false,

  // API Endpoints
  gbifApiUrl: 'https://api.gbif.org/v1',

  // Feature Flags
  enableDebugLogging: true,
  enablePerformanceMonitoring: true,
  enableAnalytics: false,

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

  // Error Tracking (Sentry) - Disabled in development
  sentryDsn: '',
  sentryEnvironment: 'development',
  sentryTracesSampleRate: 1.0,
  sentryEnabled: false,

  // Analytics
  googleAnalyticsId: '',
  analyticsEnabled: false,

  // Build Information
  version: '1.0.0-dev',
  buildDate: new Date().toISOString(),
} as const;

export type Environment = typeof environment;
