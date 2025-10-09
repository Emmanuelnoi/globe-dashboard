/**
 * Bird Migration Feature Configuration
 * Centralized configuration for GBIF API, caching, and performance settings
 *
 * This file extracts hardcoded constants from services for better maintainability
 * and easier configuration across different environments.
 */

import { environment } from '../../../environments/environment';

/**
 * GBIF API Configuration
 */
export const GBIF_CONFIG = {
  /** GBIF API base URL - from environment configuration */
  API_URL: environment.gbifApiUrl,

  /** Default pagination limit for API requests */
  DEFAULT_LIMIT: 1000,

  /** Maximum pagination limit for API requests */
  MAX_LIMIT: 20000,

  /** Request timeout in milliseconds (30 seconds) */
  REQUEST_TIMEOUT: 30000,

  /** Maximum number of retry attempts for failed requests */
  MAX_RETRIES: 3,
} as const;

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
  /** Cache time-to-live in milliseconds (7 days) */
  TTL: environment.cacheTTL,

  /** Cache version for invalidation */
  VERSION: 1,

  /** Maximum number of cached entries */
  MAX_ENTRIES: environment.cacheMaxEntries,

  /** Maximum cache size in bytes (50MB) */
  MAX_SIZE: environment.cacheMaxSize,

  /** Cleanup interval in milliseconds (1 hour) */
  CLEANUP_INTERVAL: 1000 * 60 * 60,
} as const;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  /** Time window for rate limiting in milliseconds (1 minute) */
  WINDOW: 60000,

  /** Maximum requests per window */
  MAX_REQUESTS: 100,

  /** Minimum interval between requests in milliseconds (200ms for GBIF) */
  MIN_INTERVAL: 200,

  /** Requests per minute (300 for GBIF) */
  REQUESTS_PER_MINUTE: environment.maxRequestsPerMinute,

  /** Requests per hour (10,000 for GBIF) */
  REQUESTS_PER_HOUR: environment.maxRequestsPerHour,

  /** Retry delay after rate limit in milliseconds */
  RETRY_AFTER: 200,

  /** Maximum retry attempts */
  MAX_RETRIES: 3,
} as const;

/**
 * Performance Configuration
 */
export const PERFORMANCE_CONFIG = {
  /** Worker pool size for parallel processing */
  WORKER_POOL_SIZE: environment.maxWebWorkers,

  /** Batch size for processing large datasets */
  BATCH_SIZE: environment.dataLoadingBatchSize,

  /** Maximum concurrent requests */
  MAX_CONCURRENT: 5,

  /** Debounce delay for user input in milliseconds */
  DEBOUNCE_DELAY: 300,
} as const;

/**
 * Data Quality Configuration
 */
export const DATA_QUALITY_CONFIG = {
  /** Minimum coordinate accuracy in meters */
  MIN_COORDINATE_ACCURACY: 10000,

  /** Maximum allowed coordinate uncertainty in meters */
  MAX_COORDINATE_UNCERTAINTY: 50000,

  /** Minimum required data points for quality assessment */
  MIN_DATA_POINTS: 50,

  /** Threshold for "excellent" quality rating (0-1) */
  EXCELLENT_THRESHOLD: 0.8,

  /** Threshold for "good" quality rating (0-1) */
  GOOD_THRESHOLD: 0.6,
} as const;

/**
 * Feature Flags
 */
export const FEATURE_FLAGS = {
  /** Enable Web Worker for data processing */
  ENABLE_WEB_WORKER: environment.enableWebWorkers,

  /** Enable IndexedDB caching */
  ENABLE_CACHE: environment.cacheEnabled,

  /** Enable rate limiting */
  ENABLE_RATE_LIMITING: environment.rateLimitEnabled,

  /** Enable sensitive species protection */
  ENABLE_SENSITIVE_SPECIES_PROTECTION: true,

  /** Enable performance monitoring */
  ENABLE_PERFORMANCE_MONITORING: environment.enablePerformanceMonitoring,

  /** Enable debug logging */
  ENABLE_DEBUG_LOGGING: environment.enableDebugLogging,
} as const;

/**
 * Combined configuration export
 */
export const MIGRATION_CONFIG = {
  gbif: GBIF_CONFIG,
  cache: CACHE_CONFIG,
  rateLimit: RATE_LIMIT_CONFIG,
  performance: PERFORMANCE_CONFIG,
  dataQuality: DATA_QUALITY_CONFIG,
  features: FEATURE_FLAGS,
} as const;

/**
 * Type-safe configuration access
 */
export type MigrationConfig = typeof MIGRATION_CONFIG;
