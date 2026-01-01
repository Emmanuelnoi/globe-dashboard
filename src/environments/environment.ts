/**
 * Development Environment Configuration
 * This file is AUTO-GENERATED from .env.local
 * DO NOT EDIT - Run "pnpm start" to regenerate
 */

export const environment = {
  production: false,
  gbifApiUrl: 'https://api.gbif.org/v1',
  enableDebugLogging: true,
  enablePerformanceMonitoring: true,
  enableAnalytics: false,
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
  sentryEnvironment: 'development',
  sentryTracesSampleRate: 1.0,
  sentryEnabled: false,
  googleAnalyticsId: '',
  analyticsEnabled: false,
  supabaseUrl: 'https://alqojsoikxxubdccovpp.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFscW9qc29pa3h4dWJkY2NvdnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODA5NjcsImV4cCI6MjA3NjY1Njk2N30.bQD23VZJwLrKW0bafU9UMjE_HxNorv_qxCcbdHNb_QU',
  version: '1.0.0-dev',
  cacheVersion: '1.0.0',
  buildDate: '2025-12-31T21:55:22.640Z',
} as const;

export type Environment = typeof environment;
