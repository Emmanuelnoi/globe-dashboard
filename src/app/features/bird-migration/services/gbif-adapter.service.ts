import { Injectable, signal, inject } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  SpeciesInfo,
  DateRange,
  MigrationPreview,
  ErrorType,
  HistogramPoint,
} from '../models/ui.models';
import { LoggerService } from '@/core/services/logger.service';
import {
  GBIF_CONFIG,
  CACHE_CONFIG,
  RATE_LIMIT_CONFIG,
} from '../config/migration.config';

/**
 * GBIF API Response Interfaces
 * Properly typed to avoid 'any' usage
 */
export interface GbifOccurrence {
  readonly key: number;
  readonly scientificName: string;
  readonly decimalLatitude: number | null;
  readonly decimalLongitude: number | null;
  readonly eventDate: string | null;
  readonly countryCode: string | null;
  readonly locality: string | null;
  readonly coordinateUncertaintyInMeters: number | null;
  readonly issues: readonly string[];
}

export interface GbifSearchResponse {
  readonly offset: number;
  readonly limit: number;
  readonly endOfRecords: boolean;
  readonly count: number;
  readonly results: readonly GbifOccurrence[];
  readonly facets?: readonly unknown[];
}

export interface GbifSpeciesSearchResult {
  readonly key: number;
  readonly scientificName: string;
  readonly canonicalName: string;
  readonly vernacularNames?: readonly {
    readonly vernacularName: string;
    readonly language: string;
  }[];
  readonly rank: string;
  readonly status: string;
  readonly kingdom: string;
  readonly family?: string;
  readonly familyKey?: number;
  readonly order?: string;
  readonly orderKey?: number;
}

/**
 * GBIF Cache Database Schema
 */
interface GbifCacheDB extends DBSchema {
  occurrences: {
    key: string;
    value: {
      cacheKey: string;
      data: GbifSearchResponse;
      timestamp: number;
      expiresAt: number;
    };
    indexes: { timestamp: number; expiresAt: number };
  };
  species: {
    key: string;
    value: {
      cacheKey: string;
      data: GbifSpeciesSearchResult[];
      timestamp: number;
      expiresAt: number;
    };
    indexes: { timestamp: number; expiresAt: number };
  };
}

/**
 * GBIF API Rate Limiting
 */
interface RateLimitState {
  requestCount: number;
  windowStart: number;
  isLimited: boolean;
}

/**
 * Cache Configuration
 */
interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxEntries: number;
  compressionEnabled: boolean;
}

/**
 * GBIF Adapter Service
 * Production-ready GBIF API integration with caching and error handling
 */
@Injectable({
  providedIn: 'root',
})
export class GbifAdapterService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  // GBIF API Configuration (from centralized config)
  private readonly GBIF_BASE_URL = GBIF_CONFIG.API_URL;
  private readonly DEFAULT_LIMIT = GBIF_CONFIG.DEFAULT_LIMIT;
  private readonly MAX_LIMIT = GBIF_CONFIG.MAX_LIMIT;

  // Rate Limiting Configuration (from centralized config)
  private readonly RATE_LIMIT_WINDOW = RATE_LIMIT_CONFIG.WINDOW;
  private readonly RATE_LIMIT_MAX_REQUESTS = RATE_LIMIT_CONFIG.MAX_REQUESTS;

  // Cache Configuration (from centralized config)
  private readonly CACHE_CONFIG: CacheConfig = {
    defaultTTL: CACHE_CONFIG.TTL,
    maxEntries: CACHE_CONFIG.MAX_ENTRIES,
    compressionEnabled: true,
  };

  // Service State
  private readonly _requestCount = signal<number>(0);
  private readonly _lastRequestTime = signal<Date | null>(null);
  private readonly _isInitialized = signal<boolean>(false);
  private readonly _cacheStats = signal<{ hits: number; misses: number }>({
    hits: 0,
    misses: 0,
  });

  // Rate limiting state
  private rateLimitState: RateLimitState = {
    requestCount: 0,
    windowStart: Date.now(),
    isLimited: false,
  };

  // Database connection
  private db: IDBPDatabase<GbifCacheDB> | null = null;

  // Public readonly properties
  readonly requestCount = this._requestCount.asReadonly();
  readonly lastRequestTime = this._lastRequestTime.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly cacheStats = this._cacheStats.asReadonly();

  constructor() {
    this.logger.info(
      '🌐 GbifAdapterService initializing with caching and rate limiting',
      'GBIFAdapter',
    );
    this.initializeCache();
  }

  /**
   * Initialize IndexedDB cache
   */
  private async initializeCache(): Promise<void> {
    try {
      this.db = await openDB<GbifCacheDB>('gbif-cache', 1, {
        upgrade(db) {
          // Create occurrences store
          if (!db.objectStoreNames.contains('occurrences')) {
            const occurrenceStore = db.createObjectStore('occurrences', {
              keyPath: 'cacheKey',
            });
            occurrenceStore.createIndex('timestamp', 'timestamp');
            occurrenceStore.createIndex('expiresAt', 'expiresAt');
          }

          // Create species store
          if (!db.objectStoreNames.contains('species')) {
            const speciesStore = db.createObjectStore('species', {
              keyPath: 'cacheKey',
            });
            speciesStore.createIndex('timestamp', 'timestamp');
            speciesStore.createIndex('expiresAt', 'expiresAt');
          }
        },
      });

      this._isInitialized.set(true);
      this.logger.info('✅ GBIF cache database initialized');

      // Clean expired entries on startup
      await this.cleanExpiredEntries();
    } catch (error) {
      this.logger.error('❌ Failed to initialize GBIF cache:', error);
      // Continue without cache
      this._isInitialized.set(true);
    }
  }

  /**
   * Generate cache key for requests
   */
  private generateCacheKey(
    endpoint: string,
    params: Record<string, unknown>,
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${endpoint}?${sortedParams}`;
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset window if needed
    if (now - this.rateLimitState.windowStart > this.RATE_LIMIT_WINDOW) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.windowStart = now;
      this.rateLimitState.isLimited = false;
    }

    // Check if rate limited
    if (this.rateLimitState.requestCount >= this.RATE_LIMIT_MAX_REQUESTS) {
      this.rateLimitState.isLimited = true;
      const waitTime =
        this.RATE_LIMIT_WINDOW - (now - this.rateLimitState.windowStart);
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
      );
    }

    this.rateLimitState.requestCount++;
  }

  /**
   * Get data from cache
   */
  private async getFromCache<T>(
    storeName: 'occurrences' | 'species',
    cacheKey: string,
  ): Promise<T | null> {
    if (!this.db) return null;

    try {
      const entry = await this.db.get(storeName, cacheKey);

      if (!entry) {
        this._cacheStats.update((stats) => ({
          ...stats,
          misses: stats.misses + 1,
        }));
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.db.delete(storeName, cacheKey);
        this._cacheStats.update((stats) => ({
          ...stats,
          misses: stats.misses + 1,
        }));
        return null;
      }

      this._cacheStats.update((stats) => ({ ...stats, hits: stats.hits + 1 }));
      return entry.data as T;
    } catch (error) {
      this.logger.warn('Cache read error:', error);
      return null;
    }
  }

  /**
   * Store data in cache
   */
  private async storeInCache<
    T extends GbifSearchResponse | GbifSpeciesSearchResult[],
  >(
    storeName: 'occurrences' | 'species',
    cacheKey: string,
    data: T,
    ttl: number = this.CACHE_CONFIG.defaultTTL,
  ): Promise<void> {
    if (!this.db) return;

    try {
      // Type-safe put operation for the specific store
      if (storeName === 'occurrences' && this.isGbifSearchResponse(data)) {
        const entry = {
          cacheKey,
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + ttl,
        };
        await this.db.put('occurrences', entry);
      } else if (storeName === 'species' && Array.isArray(data)) {
        const entry = {
          cacheKey,
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + ttl,
        };
        await this.db.put('species', entry);
      }
    } catch (error) {
      this.logger.warn('Cache write error:', error);
    }
  }

  /**
   * Type guard for GbifSearchResponse
   */
  private isGbifSearchResponse(data: unknown): data is GbifSearchResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      'results' in data &&
      'offset' in data &&
      'limit' in data
    );
  }

  /**
   * Clean expired cache entries
   */
  private async cleanExpiredEntries(): Promise<void> {
    if (!this.db) return;

    try {
      const now = Date.now();
      const stores: Array<'occurrences' | 'species'> = [
        'occurrences',
        'species',
      ];

      for (const storeName of stores) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const index = store.index('expiresAt');

        const expiredKeys = await index.getAllKeys(IDBKeyRange.upperBound(now));

        for (const key of expiredKeys) {
          await store.delete(key);
        }

        await tx.done;
      }

      this.logger.info(`🧹 Cleaned ${stores.length} cache stores`);
    } catch (error) {
      this.logger.warn('Cache cleanup error:', error);
    }
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest<T>(url: string, params: HttpParams): Promise<T> {
    await this.checkRateLimit();

    this._requestCount.update((count) => count + 1);
    this._lastRequestTime.set(new Date());

    try {
      this.logger.info(`🌐 Making GBIF API request: ${url}`);
      const response = await this.http.get<T>(url, { params }).toPromise();

      if (!response) {
        throw new Error('Empty response from GBIF API');
      }

      return response;
    } catch (error) {
      this.logger.error('GBIF API request failed:', error);

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 429:
            throw new Error(
              'GBIF API rate limit exceeded. Please try again later.',
            );
          case 503:
            throw new Error(
              'GBIF API is temporarily unavailable. Please try again later.',
            );
          case 404:
            throw new Error('Requested data not found in GBIF database.');
          default:
            throw new Error(
              `GBIF API error (${error.status}): ${error.message}`,
            );
        }
      }

      throw error;
    }
  }

  /**
   * Fetch occurrence data from GBIF
   */
  async fetchOccurrences(
    taxonKey: string,
    dateRange: DateRange,
    options: {
      limit?: number;
      coordinates?: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      };
    } = {},
  ): Promise<GbifSearchResponse> {
    const limit = Math.min(options.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

    // Build request parameters
    let params = new HttpParams()
      .set('taxonKey', taxonKey)
      .set('hasCoordinate', 'true')
      .set('hasGeospatialIssue', 'false')
      .set('limit', limit.toString())
      .set('offset', '0');

    // Add date range if provided
    if (dateRange.startDate && dateRange.endDate) {
      const startDateStr = this.formatDateForGbif(dateRange.startDate);
      const endDateStr = this.formatDateForGbif(dateRange.endDate);
      params = params.set('eventDate', `${startDateStr},${endDateStr}`);
    }

    // Add coordinate bounds if provided
    if (options.coordinates) {
      const { minLat, maxLat, minLng, maxLng } = options.coordinates;
      params = params
        .set('decimalLatitude', `${minLat},${maxLat}`)
        .set('decimalLongitude', `${minLng},${maxLng}`);
    }

    const cacheKey = this.generateCacheKey(
      'occurrences',
      params.keys().reduce(
        (acc, key) => {
          acc[key] = params.get(key);
          return acc;
        },
        {} as Record<string, unknown>,
      ),
    );

    // Try cache first
    const cached = await this.getFromCache<GbifSearchResponse>(
      'occurrences',
      cacheKey,
    );
    if (cached) {
      this.logger.info('📦 Using cached GBIF occurrence data');
      return cached;
    }

    // Make API request
    const url = `${this.GBIF_BASE_URL}/occurrence/search`;
    const response = await this.makeRequest<GbifSearchResponse>(url, params);

    // Cache the response
    await this.storeInCache('occurrences', cacheKey, response);

    this.logger.info(
      `✅ Fetched ${response.results.length} occurrences from GBIF`,
    );
    return response;
  }

  /**
   * Search for species in GBIF
   */
  async searchSpecies(
    query: string,
    limit: number = 20,
  ): Promise<GbifSpeciesSearchResult[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit.toString())
      .set('rank', 'SPECIES')
      .set('status', 'ACCEPTED')
      .set('isExtinct', 'false');

    const cacheKey = this.generateCacheKey('species', {
      q: query,
      limit,
      rank: 'SPECIES',
      status: 'ACCEPTED',
      isExtinct: 'false',
    });

    // Try cache first
    const cached = await this.getFromCache<GbifSpeciesSearchResult[]>(
      'species',
      cacheKey,
    );
    if (cached) {
      this.logger.info('📦 Using cached GBIF species data');
      return cached;
    }

    // Make API request
    const url = `${this.GBIF_BASE_URL}/species/search`;
    const response = await this.makeRequest<{
      results: GbifSpeciesSearchResult[];
    }>(url, params);

    const results = response.results || [];

    // Cache the response
    await this.storeInCache('species', cacheKey, results);

    this.logger.info(
      `✅ Found ${results.length} species matches for "${query}"`,
    );
    return results;
  }

  /**
   * Generate migration preview from GBIF data
   */
  async generateMigrationPreview(
    species: SpeciesInfo,
    dateRange: DateRange,
  ): Promise<MigrationPreview> {
    try {
      this.logger.info(
        `🔍 Generating migration preview for ${species.scientificName}`,
      );

      // Fetch a sample of occurrence data
      const sampleData = await this.fetchOccurrences(
        species.id,
        dateRange,
        { limit: 300 }, // Smaller sample for preview
      );

      // Process data into histogram
      const histogram = this.generateHistogramFromOccurrences(
        sampleData.results,
        dateRange,
      );

      // Calculate quality metrics
      const quality = this.assessDataQuality(sampleData.results);
      const coverage = this.calculateTemporalCoverage(
        sampleData.results,
        dateRange,
      );

      const preview: MigrationPreview = {
        totalPoints: sampleData.count,
        quality,
        coverage,
        histogram,
        dateRange,
        estimatedSize: Math.floor(sampleData.count * 0.1), // Rough estimate in KB
        processingTime: 1500, // Estimated processing time in ms
      };

      this.logger.info(
        `✅ Generated preview: ${preview.totalPoints} points, ${preview.quality} quality`,
      );
      return preview;
    } catch (error) {
      this.logger.error('Failed to generate migration preview:', error);

      // Return fallback preview
      return {
        totalPoints: 0,
        quality: 'fair',
        coverage: 0,
        histogram: [],
        dateRange,
        estimatedSize: 0,
        processingTime: 0,
      };
    }
  }

  /**
   * Format date for GBIF API
   */
  private formatDateForGbif(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate histogram from occurrence data
   */
  private generateHistogramFromOccurrences(
    occurrences: readonly GbifOccurrence[],
    dateRange: DateRange,
  ): HistogramPoint[] {
    const histogram: HistogramPoint[] = [];
    const dateMap = new Map<string, number>();

    // Group occurrences by date
    for (const occurrence of occurrences) {
      if (occurrence.eventDate) {
        const date = new Date(occurrence.eventDate);
        const dateKey = date.toISOString().split('T')[0];
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
      }
    }

    // Generate histogram points
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    const totalDays = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const interval = Math.max(1, Math.floor(totalDays / 50)); // Max 50 points

    for (let i = 0; i < totalDays; i += interval) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      const count = dateMap.get(dateKey) || 0;

      histogram.push({
        date,
        count,
        density: Math.min(count / Math.max(occurrences.length / 10, 1), 1), // Normalize to 0-1
      });
    }

    return histogram;
  }

  /**
   * Assess data quality based on occurrence properties
   */
  private assessDataQuality(
    occurrences: readonly GbifOccurrence[],
  ): 'excellent' | 'good' | 'fair' {
    if (occurrences.length === 0) return 'fair';

    const withCoordinates = occurrences.filter(
      (o) => o.decimalLatitude !== null && o.decimalLongitude !== null,
    ).length;

    const withDates = occurrences.filter((o) => o.eventDate !== null).length;

    const coordinateRatio = withCoordinates / occurrences.length;
    const dateRatio = withDates / occurrences.length;

    const avgQuality = (coordinateRatio + dateRatio) / 2;

    if (avgQuality > 0.8) return 'excellent';
    if (avgQuality > 0.6) return 'good';
    return 'fair';
  }

  /**
   * Calculate temporal coverage of data
   */
  private calculateTemporalCoverage(
    occurrences: readonly GbifOccurrence[],
    dateRange: DateRange,
  ): number {
    const datesWithData = new Set<string>();

    for (const occurrence of occurrences) {
      if (occurrence.eventDate) {
        const date = new Date(occurrence.eventDate);
        if (date >= dateRange.startDate && date <= dateRange.endDate) {
          datesWithData.add(date.toISOString().split('T')[0]);
        }
      }
    }

    const totalDays = Math.floor(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return Math.round((datesWithData.size / totalDays) * 100);
  }

  /**
   * Clear all cache data
   */
  async clearCache(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(['occurrences', 'species'], 'readwrite');
      await tx.objectStore('occurrences').clear();
      await tx.objectStore('species').clear();
      await tx.done;

      this._cacheStats.set({ hits: 0, misses: 0 });
      this.logger.info('🧹 Cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const stats = this._cacheStats();
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? Math.round((stats.hits / total) * 100) : 0;

    return {
      size: 0, // Would need to calculate actual size
      hitRate,
    };
  }

  /**
   * Check if service is healthy
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    try {
      // Test basic API connectivity
      const testParams = new HttpParams()
        .set('limit', '1')
        .set('hasCoordinate', 'true');

      const startTime = Date.now();
      await this.makeRequest(
        `${this.GBIF_BASE_URL}/occurrence/search`,
        testParams,
      );
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 5000 ? 'healthy' : 'degraded',
        details: {
          responseTime,
          cacheInitialized: this._isInitialized(),
          rateLimited: this.rateLimitState.isLimited,
          requestCount: this._requestCount(),
          cacheStats: this.getCacheStats(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          cacheInitialized: this._isInitialized(),
          rateLimited: this.rateLimitState.isLimited,
        },
      };
    }
  }
}
