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

  // Error Tracking (Sentry)
  // Get your DSN from: https://sentry.io/settings/projects/
  // Set via Netlify environment variable: VITE_SENTRY_DSN
  sentryDsn: import.meta.env['VITE_SENTRY_DSN'] || '',
  sentryEnvironment: 'production',
  sentryTracesSampleRate: 0.1, // Sample 10% of transactions in production
  sentryEnabled: !!import.meta.env['VITE_SENTRY_DSN'], // Auto-enable if DSN is set

  // Analytics (Google Analytics 4)
  // Get your ID from: https://analytics.google.com/
  // Set via Netlify environment variable: VITE_GA_TRACKING_ID
  googleAnalyticsId: import.meta.env['VITE_GA_TRACKING_ID'] || '',
  analyticsEnabled: !!import.meta.env['VITE_GA_TRACKING_ID'], // Auto-enable if ID is set

  // Supabase Configuration (Production)
  // Get your credentials from: https://supabase.com/dashboard
  // Set via Netlify environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
  supabaseUrl: import.meta.env['VITE_SUPABASE_URL'] || '',
  supabaseAnonKey: import.meta.env['VITE_SUPABASE_ANON_KEY'] || '',

  // Build Information
  version: '1.0.0',
  buildDate: new Date().toISOString(),
} as const;

export type Environment = typeof environment;
