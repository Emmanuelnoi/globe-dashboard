import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  MigrationPreview,
  LoadingState,
  ErrorState,
  MigrationDataPoint,
} from '../models/ui.models';
import { LoggerService } from '@/core/services/logger.service';
import { CACHE_CONFIG } from '../config/migration.config';

/**
 * Bird Migration Data Cache Schema
 */
interface BirdMigrationCacheDB extends DBSchema {
  migration_data: {
    key: string;
    value: {
      cacheKey: string;
      data: MigrationDataPoint[];
      metadata: {
        speciesId: string;
        seasonOrDateRange: string;
        hemisphere: string;
        year: number;
        dataQuality: 'excellent' | 'good' | 'fair';
        totalPoints: number;
        processingTime: number;
      };
      timestamp: number;
      expiresAt: number;
      size: number; // Data size in bytes
    };
    indexes: {
      timestamp: number;
      expiresAt: number;
      speciesId: string;
      hemisphere: string;
    };
  };
  cache_metadata: {
    key: string;
    value: {
      key: string;
      totalEntries: number;
      totalSize: number;
      lastCleanup: number;
      version: number;
    };
  };
}

/**
 * Cache Configuration
 */
interface CacheConfig {
  readonly defaultTTL: number; // 7 days
  readonly maxCacheSize: number; // 50MB
  readonly maxEntries: number; // 500 entries
  readonly cleanupInterval: number; // 1 hour
}

/**
 * Bird Data Service with IndexedDB Caching
 * Production-ready caching implementation for bird migration data
 */
@Injectable({
  providedIn: 'root',
})
export class BirdDataService implements OnDestroy {
  // Cache Configuration (from centralized config)
  private readonly CACHE_CONFIG: CacheConfig = {
    defaultTTL: CACHE_CONFIG.TTL,
    maxCacheSize: CACHE_CONFIG.MAX_SIZE,
    maxEntries: CACHE_CONFIG.MAX_ENTRIES,
    cleanupInterval: CACHE_CONFIG.CLEANUP_INTERVAL,
  };

  // Service state signals
  private readonly _migrationData = signal<MigrationDataPoint[] | null>(null);
  private readonly _cacheStatus = signal<string>('initializing');
  private readonly _loadingState = signal<LoadingState>({ isLoading: false });
  private readonly _errorState = signal<ErrorState>({
    hasError: false,
    canRetry: false,
    hasFallback: false,
  });
  private readonly _isInitialized = signal<boolean>(false);

  // Public readonly signals
  readonly migrationData = this._migrationData.asReadonly();
  readonly cacheStatus = this._cacheStatus.asReadonly();
  readonly loadingState = this._loadingState.asReadonly();
  readonly errorState = this._errorState.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();

  // Database connection
  private db: IDBPDatabase<BirdMigrationCacheDB> | null = null;
  private cleanupInterval: number | null = null;
  private logger = inject(LoggerService);

  constructor() {
    this.logger.debug(
      '🗃️ BirdDataService initializing with IndexedDB caching',
      'BirdDataService',
    );
    this.initializeDatabase().catch((error) => {
      this.logger.error(
        '❌ Failed to initialize database:',
        error,
        'BirdDataService',
      );
    });
  }

  /**
   * Initialize IndexedDB database
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await openDB<BirdMigrationCacheDB>('bird-migration-cache', 1, {
        upgrade(db) {
          // Create migration_data store
          if (!db.objectStoreNames.contains('migration_data')) {
            const migrationStore = db.createObjectStore('migration_data', {
              keyPath: 'cacheKey',
            });
            migrationStore.createIndex('timestamp', 'timestamp');
            migrationStore.createIndex('expiresAt', 'expiresAt');
            migrationStore.createIndex('speciesId', 'metadata.speciesId');
            migrationStore.createIndex('hemisphere', 'metadata.hemisphere');
          }

          // Create cache_metadata store
          if (!db.objectStoreNames.contains('cache_metadata')) {
            db.createObjectStore('cache_metadata', { keyPath: 'key' });
          }
        },
      });

      this._isInitialized.set(true);
      this._cacheStatus.set('ready');
      this.logger.info('✅ BirdDataService IndexedDB database initialized');

      // Initialize cache metadata
      await this.initializeCacheMetadata();

      // Start automatic cleanup
      this.startPeriodicCleanup();

      // Clean expired entries on startup
      await this.clearExpiredCache();
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize BirdDataService database:',
        error,
      );
      this._cacheStatus.set('error');
      this._errorState.set({
        hasError: true,
        canRetry: true,
        hasFallback: true,
        message: 'Failed to initialize cache database',
      });
    }
  }

  /**
   * Initialize cache metadata
   */
  private async initializeCacheMetadata(): Promise<void> {
    if (!this.db) return;

    try {
      const existing = await this.db.get('cache_metadata', 'main');
      if (!existing) {
        await this.db.put('cache_metadata', {
          key: 'main',
          totalEntries: 0,
          totalSize: 0,
          lastCleanup: Date.now(),
          version: 1,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to initialize cache metadata:', error);
    }
  }

  /**
   * Start periodic cache cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = window.setInterval(() => {
      this.clearExpiredCache().catch((error: unknown) => {
        this.logger.warn('Periodic cache cleanup failed:', error);
      });
    }, this.CACHE_CONFIG.cleanupInterval);
  }

  /**
   * Calculate data size in bytes
   */
  private calculateDataSize(data: MigrationDataPoint[]): number {
    return JSON.stringify(data).length * 2; // Rough estimate
  }

  /**
   * Cache migration data with metadata
   */
  async cacheMigrationData(
    cacheKey: string,
    data: MigrationDataPoint[],
    metadata: {
      speciesId: string;
      seasonOrDateRange: string;
      hemisphere: string;
      year: number;
      dataQuality: 'excellent' | 'good' | 'fair';
      totalPoints: number;
      processingTime: number;
    },
  ): Promise<void> {
    if (!this.db) {
      this.logger.warn('Cache database not initialized');
      return;
    }

    try {
      const now = Date.now();
      const size = this.calculateDataSize(data);

      // Check cache limits before adding
      await this.enforceCacheLimits(size);

      const cacheEntry = {
        cacheKey,
        data,
        metadata,
        timestamp: now,
        expiresAt: now + this.CACHE_CONFIG.defaultTTL,
        size,
      };

      await this.db.put('migration_data', cacheEntry);
      await this.updateCacheMetadata(1, size);

      this._cacheStatus.set('cached');
      this.logger.info(
        `📦 Cached migration data: ${cacheKey} (${data.length} points, ${Math.round(size / 1024)}KB)`,
      );
    } catch (error) {
      this.logger.error('Failed to cache migration data:', error);
      this._errorState.set({
        hasError: true,
        canRetry: true,
        hasFallback: true,
        message: 'Failed to cache data',
      });
    }
  }

  /**
   * Get cached migration data
   */
  async getCachedData(cacheKey: string): Promise<MigrationDataPoint[] | null> {
    if (!this.db) {
      this.logger.warn('Cache database not initialized');
      return null;
    }

    try {
      const entry = await this.db.get('migration_data', cacheKey);

      if (!entry) {
        this.logger.info(`🔍 Cache miss: ${cacheKey}`);
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.logger.info(`⏰ Cache expired: ${cacheKey}`);
        await this.db.delete('migration_data', cacheKey);
        await this.updateCacheMetadata(-1, -entry.size);
        return null;
      }

      this.logger.info(
        `📦 Cache hit: ${cacheKey} (${entry.data.length} points)`,
      );
      this._migrationData.set(entry.data);
      return entry.data;
    } catch (error) {
      this.logger.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<void> {
    if (!this.db) return;

    try {
      const now = Date.now();
      const tx = this.db.transaction('migration_data', 'readwrite');
      const store = tx.objectStore('migration_data');
      const index = store.index('expiresAt');

      const expiredEntries = await index.getAll(IDBKeyRange.upperBound(now));
      let totalSizeRemoved = 0;

      for (const entry of expiredEntries) {
        await store.delete(entry.cacheKey);
        totalSizeRemoved += entry.size;
      }

      await tx.done;

      if (expiredEntries.length > 0) {
        await this.updateCacheMetadata(
          -expiredEntries.length,
          -totalSizeRemoved,
        );
        this.logger.info(
          `🧹 Cleaned ${expiredEntries.length} expired cache entries (${Math.round(totalSizeRemoved / 1024)}KB)`,
        );
      }

      // Update last cleanup time
      await this.updateLastCleanupTime();
      this._cacheStatus.set('cleaned');
    } catch (error) {
      this.logger.error('Failed to clean expired cache:', error);
    }
  }

  /**
   * Enforce cache size and entry limits
   */
  private async enforceCacheLimits(newDataSize: number): Promise<void> {
    if (!this.db) return;

    const metadata = await this.db.get('cache_metadata', 'main');
    if (!metadata) return;

    // Check if adding new data would exceed limits
    const wouldExceedSize =
      metadata.totalSize + newDataSize > this.CACHE_CONFIG.maxCacheSize;
    const wouldExceedEntries =
      metadata.totalEntries >= this.CACHE_CONFIG.maxEntries;

    if (wouldExceedSize || wouldExceedEntries) {
      await this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction('migration_data', 'readwrite');
      const store = tx.objectStore('migration_data');
      const index = store.index('timestamp');

      // Get oldest entries
      const oldEntries = await index.getAll(null, 50); // Get up to 50 oldest
      let removedEntries = 0;
      let removedSize = 0;

      // Remove oldest 25% of entries
      const toRemove = Math.ceil(oldEntries.length * 0.25);
      for (let i = 0; i < toRemove && i < oldEntries.length; i++) {
        const entry = oldEntries[i];
        await store.delete(entry.cacheKey);
        removedEntries++;
        removedSize += entry.size;
      }

      await tx.done;

      if (removedEntries > 0) {
        await this.updateCacheMetadata(-removedEntries, -removedSize);
        this.logger.info(
          `🗑️ Evicted ${removedEntries} old cache entries (${Math.round(removedSize / 1024)}KB)`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to evict cache entries:', error);
    }
  }

  /**
   * Update cache metadata
   */
  private async updateCacheMetadata(
    entryDelta: number,
    sizeDelta: number,
  ): Promise<void> {
    if (!this.db) return;

    try {
      const metadata = await this.db.get('cache_metadata', 'main');
      if (metadata) {
        metadata.totalEntries = Math.max(0, metadata.totalEntries + entryDelta);
        metadata.totalSize = Math.max(0, metadata.totalSize + sizeDelta);
        await this.db.put('cache_metadata', metadata);
      }
    } catch (error) {
      this.logger.warn('Failed to update cache metadata:', error);
    }
  }

  /**
   * Update last cleanup time
   */
  private async updateLastCleanupTime(): Promise<void> {
    if (!this.db) return;

    try {
      const metadata = await this.db.get('cache_metadata', 'main');
      if (metadata) {
        metadata.lastCleanup = Date.now();
        await this.db.put('cache_metadata', metadata);
      }
    } catch (error) {
      this.logger.warn('Failed to update cleanup time:', error);
    }
  }

  /**
   * Generate cache key for migration data
   */
  generateCacheKey(
    speciesId: string,
    seasonOrDateRange: string,
    hemisphere: string,
    year: number,
  ): string {
    return `${speciesId}-${seasonOrDateRange}-${hemisphere}-${year}`;
  }

  /**
   * Check if cache key exists
   */
  async hasCachedData(cacheKey: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const entry = await this.db.get('migration_data', cacheKey);
      if (!entry) return false;

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.db.delete('migration_data', cacheKey);
        await this.updateCacheMetadata(-1, -entry.size);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to check cache key:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    if (!this.db) {
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    try {
      const metadata = await this.db.get('cache_metadata', 'main');
      if (!metadata) {
        return {
          totalEntries: 0,
          totalSize: 0,
          oldestEntry: null,
          newestEntry: null,
        };
      }

      // Get oldest and newest entries
      const tx = this.db.transaction('migration_data', 'readonly');
      const store = tx.objectStore('migration_data');
      const timestampIndex = store.index('timestamp');

      const oldestEntry = await timestampIndex.get(IDBKeyRange.lowerBound(0));
      const newestCursor = await timestampIndex.openCursor(null, 'prev');
      const newestEntry = newestCursor?.value;

      return {
        totalEntries: metadata.totalEntries,
        totalSize: metadata.totalSize,
        oldestEntry: oldestEntry ? new Date(oldestEntry.timestamp) : null,
        newestEntry: newestEntry ? new Date(newestEntry.timestamp) : null,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Get cached data by species
   */
  async getCachedDataBySpecies(speciesId: string): Promise<
    Array<{
      cacheKey: string;
      metadata: {
        speciesId: string;
        seasonOrDateRange: string;
        hemisphere: string;
        year: number;
      };
      timestamp: Date;
    }>
  > {
    if (!this.db) return [];

    try {
      const tx = this.db.transaction('migration_data', 'readonly');
      const store = tx.objectStore('migration_data');
      const index = store.index('speciesId');

      const entries = await index.getAll(speciesId);
      return entries.map((entry) => ({
        cacheKey: entry.cacheKey,
        metadata: entry.metadata,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error) {
      this.logger.error('Failed to get cached data by species:', error);
      return [];
    }
  }

  /**
   * Set loading state
   */
  setLoadingState(state: LoadingState): void {
    this._loadingState.set(state);
  }

  /**
   * Set error state
   */
  setErrorState(state: ErrorState): void {
    this._errorState.set(state);
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<void> {
    if (!this.db) {
      this.logger.warn('Cache database not initialized');
      return;
    }

    try {
      const tx = this.db.transaction(
        ['migration_data', 'cache_metadata'],
        'readwrite',
      );
      await tx.objectStore('migration_data').clear();
      await tx.objectStore('cache_metadata').put({
        key: 'main',
        totalEntries: 0,
        totalSize: 0,
        lastCleanup: Date.now(),
        version: 1,
      });
      await tx.done;

      this._cacheStatus.set('cleared');
      this._migrationData.set(null);
      this.logger.info('🗑️ All cached data cleared');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      this._errorState.set({
        hasError: true,
        canRetry: true,
        hasFallback: false,
        message: 'Failed to clear cache',
      });
    }
  }

  /**
   * Cleanup resources on destroy
   */
  ngOnDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.db) {
      this.db.close();
    }
  }
}
