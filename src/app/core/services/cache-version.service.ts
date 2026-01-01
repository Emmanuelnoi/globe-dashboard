import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';

/**
 * Database configuration
 */
export interface DatabaseConfig {
  name: string;
  type: 'user-data' | 'api-cache';
  currentVersion: number;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  clearedCaches: string[];
  preservedData: string[];
  errors: string[];
}

/**
 * Cache Version Service
 *
 * Manages cache versioning across all IndexedDB databases.
 * Provides selective migration:
 * - Preserves user data (quiz sessions, achievements, discoveries)
 * - Clears API caches (GBIF, bird migration) on version bumps
 *
 * Features:
 * - Unified version tracking for all caches
 * - Automatic migration on app initialization
 * - Browser console debugging helpers
 * - Error handling with fallbacks
 *
 * @example
 * ```typescript
 * // In browser console:
 * cacheVersion.check() // "1.0.0"
 * cacheVersion.getDatabases() // Array of all databases
 * cacheVersion.clearApiCaches() // Force clear API caches
 * cacheVersion.migrate() // Force migration
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class CacheVersionService {
  private readonly logger = inject(LoggerService);

  /**
   * Database registry
   * Tracks all IndexedDB databases and their types
   */
  private readonly DATABASES: readonly DatabaseConfig[] = [
    // API Caches (cleared on version change)
    {
      name: 'bird-migration-cache',
      type: 'api-cache',
      currentVersion: 1,
    },
    {
      name: 'migration-cache-db',
      type: 'api-cache',
      currentVersion: 1,
    },
    {
      name: 'gbif-cache',
      type: 'api-cache',
      currentVersion: 1,
    },

    // User Data (preserved on version change)
    {
      name: 'quiz-stats-db',
      type: 'user-data',
      currentVersion: 1,
    },
    {
      name: 'country-discoveries-db',
      type: 'user-data',
      currentVersion: 1,
    },
    {
      name: 'achievements-db',
      type: 'user-data',
      currentVersion: 1,
    },
  ] as const;

  private readonly VERSION_DB_NAME = 'cache-version-manager';
  private readonly VERSION_STORE_NAME = 'version';

  /**
   * Check cache version and migrate if needed
   *
   * Called automatically on app initialization via APP_INITIALIZER.
   * Compares stored version with current environment version.
   *
   * @returns Promise resolving to migration result
   */
  async checkAndMigrate(): Promise<MigrationResult> {
    try {
      this.logger.debug('Checking cache version...', 'CacheVersion');

      // Open version manager database
      const versionDb = await this.openVersionDb();

      // Get stored version
      const storedVersion = await this.getStoredVersion(versionDb);
      const currentVersion = environment.cacheVersion || '1.0.0';

      this.logger.debug(
        `Cache version: stored=${storedVersion}, current=${currentVersion}`,
        'CacheVersion',
      );

      // If version mismatch, clear API caches
      if (storedVersion !== currentVersion) {
        this.logger.success(
          `Cache version changed (${storedVersion} → ${currentVersion}). Clearing API caches...`,
          'CacheVersion',
        );

        const apiCaches = this.DATABASES.filter(
          (db) => db.type === 'api-cache',
        );
        const clearedCaches: string[] = [];
        const errors: string[] = [];

        // Clear each API cache
        for (const cache of apiCaches) {
          try {
            await this.deleteDatabase(cache.name);
            clearedCaches.push(cache.name);
            this.logger.debug(`Cleared cache: ${cache.name}`, 'CacheVersion');
          } catch (error) {
            const errorMsg = `Failed to clear ${cache.name}: ${String(error)}`;
            errors.push(errorMsg);
            this.logger.warn(errorMsg, 'CacheVersion');
          }
        }

        // Update stored version
        await this.updateStoredVersion(versionDb, currentVersion);

        versionDb.close();

        const preservedDatabases = this.DATABASES.filter(
          (db) => db.type === 'user-data',
        ).map((db) => db.name);

        return {
          success: errors.length === 0,
          clearedCaches,
          preservedData: preservedDatabases,
          errors,
        };
      }

      versionDb.close();

      // No migration needed
      return {
        success: true,
        clearedCaches: [],
        preservedData: this.DATABASES.map((db) => db.name),
        errors: [],
      };
    } catch (error) {
      this.logger.error(
        `Cache version check failed: ${String(error)}`,
        'CacheVersion',
      );
      return {
        success: false,
        clearedCaches: [],
        preservedData: [],
        errors: [String(error)],
      };
    }
  }

  /**
   * Get current cache version
   *
   * @returns Current version from environment
   */
  getCurrentVersion(): string {
    return environment.cacheVersion || '1.0.0';
  }

  /**
   * Get all database configurations
   *
   * @returns Array of database configs
   */
  getDatabases(): readonly DatabaseConfig[] {
    return this.DATABASES;
  }

  /**
   * Manually clear all API caches
   *
   * Useful for debugging and testing.
   *
   * @returns Promise resolving when caches are cleared
   */
  async clearAllApiCaches(): Promise<void> {
    const apiCaches = this.DATABASES.filter((db) => db.type === 'api-cache');

    for (const cache of apiCaches) {
      try {
        await this.deleteDatabase(cache.name);
        this.logger.success(`Cleared API cache: ${cache.name}`, 'CacheVersion');
      } catch (error) {
        this.logger.error(
          `Failed to clear ${cache.name}: ${String(error)}`,
          'CacheVersion',
        );
      }
    }
  }

  /**
   * Open version manager database
   *
   * @returns Promise resolving to IDBDatabase
   */
  private openVersionDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.VERSION_DB_NAME, 1);

      request.onerror = () =>
        reject(new Error('Failed to open version database'));

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.VERSION_STORE_NAME)) {
          db.createObjectStore(this.VERSION_STORE_NAME);
        }
      };
    });
  }

  /**
   * Get stored cache version
   *
   * @param db - Version manager database
   * @returns Promise resolving to stored version or null
   */
  private getStoredVersion(db: IDBDatabase): Promise<string | null> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(
          [this.VERSION_STORE_NAME],
          'readonly',
        );
        const store = transaction.objectStore(this.VERSION_STORE_NAME);
        const request = store.get('cacheVersion');

        request.onerror = () =>
          reject(new Error('Failed to read stored version'));
        request.onsuccess = () => resolve(request.result as string | null);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update stored cache version
   *
   * @param db - Version manager database
   * @param version - New version to store
   * @returns Promise resolving when version is updated
   */
  private updateStoredVersion(db: IDBDatabase, version: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(
          [this.VERSION_STORE_NAME],
          'readwrite',
        );
        const store = transaction.objectStore(this.VERSION_STORE_NAME);
        const request = store.put(version, 'cacheVersion');

        request.onerror = () =>
          reject(new Error('Failed to update stored version'));
        request.onsuccess = () => resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Delete an IndexedDB database
   *
   * @param dbName - Database name to delete
   * @returns Promise resolving when database is deleted
   */
  private deleteDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);

      request.onerror = () =>
        reject(new Error(`Failed to delete database: ${dbName}`));
      request.onsuccess = () => resolve();
      request.onblocked = () => {
        this.logger.warn(
          `Database ${dbName} is blocked and cannot be deleted`,
          'CacheVersion',
        );
        // Resolve anyway - we tried our best
        resolve();
      };
    });
  }
}
