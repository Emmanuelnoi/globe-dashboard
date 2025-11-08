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
  supabaseUrl: 'https://alqojsoikxxubdccovpp.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFscW9qc29pa3h4dWJkY2NvdnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODA5NjcsImV4cCI6MjA3NjY1Njk2N30.bQD23VZJwLrKW0bafU9UMjE_HxNorv_qxCcbdHNb_QU',
  version: '1.0.0',
  buildDate: '2025-11-08T01:13:03.488Z',
} as const;

export type Environment = typeof environment;
