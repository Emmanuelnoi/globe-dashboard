/**
 * Production Environment Configuration (Generated)
 * DO NOT EDIT - This file is auto-generated from environment variables
 */

export const environment = {
  production: true,
  gbifApiUrl: 'https://api.gbif.org/v1',
  enableDebugLogging: false,
  enablePerformanceMonitoring: true,
  enableAnalytics: true,
  cacheEnabled: true,
  cacheTTL: 7 * 24 * 60 * 60 * 1000,
  cacheMaxSize: 50 * 1024 * 1024,
  cacheMaxEntries: 100,
  rateLimitEnabled: true,
  maxRequestsPerMinute: 300,
  maxRequestsPerHour: 10000,
  enableWebWorkers: true,
  maxWebWorkers: 6,
  dataLoadingBatchSize: 1000,
  dataLoadingProgressiveStages: 5,
  sentryDsn: '',
  sentryEnvironment: 'production',
  sentryTracesSampleRate: 0.1,
  sentryEnabled: false,
  googleAnalyticsId: '',
  analyticsEnabled: false,
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-key-123',
  version: '1.0.0',
  cacheVersion: '1.0.0',
  buildDate: '2026-01-04T01:16:58.807Z',
} as const;

export type Environment = typeof environment;
