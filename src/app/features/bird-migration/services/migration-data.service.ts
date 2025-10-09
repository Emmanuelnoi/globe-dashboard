/**
 * Migration Data Service
 * Core service for fetching, caching, and managing bird migration data from GBIF
 *
 * @module migration-data.service
 * @description Production-ready GBIF integration with IndexedDB caching, Web Worker parsing,
 *              rate limiting, and sensitive species protection
 */

import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import {
  HttpClient,
  HttpParams,
  HttpErrorResponse,
} from '@angular/common/http';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { firstValueFrom, retry, catchError, throwError, timeout } from 'rxjs';
import { LoggerService } from '@/core/services/logger.service';

import {
  MigrationPath,
  MigrationPoint,
  MigrationPathMetadata,
  MigrationStatistics,
  CacheEntry,
  ProgressCallback,
  ProgressInfo,
  MigrationError,
  SpeciesMetadata,
  DataQuality,
  BoundingBox,
  DateRange,
  MigrationRecord,
  Species,
  MigrationLocation,
  FlywayName,
} from '../models/migration.types';
import {
  GBIFResponse,
  GBIFOccurrence,
  GBIFQueryParams,
  GBIFSpecies,
  GBIFWorkerRequest,
  GBIFWorkerResponse,
} from '../models/gbif.types';
import { determineFlyway as detectFlyway } from '../utils/flyway-detection.utils';
import { createGBIFRateLimiter, RateLimiter } from '../utils/rate-limiter.util';
import {
  protectSensitivePoints,
  isSensitiveSpecies,
  getRedactionExplanation,
} from '../utils/sensitive-species.util';
import { GBIF_CONFIG, CACHE_CONFIG } from '../config/migration.config';

/**
 * IndexedDB Schema for migration data cache
 */
interface MigrationCacheDB extends DBSchema {
  migrations: {
    key: string;
    value: CacheEntry<MigrationPath>;
    indexes: {
      timestamp: number;
      expiresAt: number;
      speciesKey: number;
    };
  };
  species: {
    key: number;
    value: CacheEntry<SpeciesMetadata>;
    indexes: {
      timestamp: number;
      expiresAt: number;
    };
  };
}

/**
 * Service state interface
 */
interface ServiceState {
  readonly isLoading: boolean;
  readonly currentOperation: string | null;
  readonly progress: number; // 0-100
  readonly error: MigrationError | null;
}

/**
 * Migration Data Service
 */
@Injectable({
  providedIn: 'root',
})
export class MigrationDataService implements OnDestroy {
  // Dependencies
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  // GBIF API Configuration (from centralized config)
  private readonly GBIF_API_URL = GBIF_CONFIG.API_URL;
  private readonly CACHE_VERSION = CACHE_CONFIG.VERSION;
  private readonly CACHE_TTL = CACHE_CONFIG.TTL;
  private readonly MAX_CACHE_ENTRIES = CACHE_CONFIG.MAX_ENTRIES;
  private readonly REQUEST_TIMEOUT = GBIF_CONFIG.REQUEST_TIMEOUT;
  private readonly MAX_RETRIES = GBIF_CONFIG.MAX_RETRIES;

  // State signals
  private readonly _state = signal<ServiceState>({
    isLoading: false,
    currentOperation: null,
    progress: 0,
    error: null,
  });

  private readonly _cachedPaths = signal<Map<string, MigrationPath>>(new Map());

  // Public readonly signals
  readonly state = this._state.asReadonly();
  readonly isLoading = computed(() => this._state().isLoading);
  readonly currentOperation = computed(() => this._state().currentOperation);
  readonly progress = computed(() => this._state().progress);
  readonly error = computed(() => this._state().error);
  readonly cachedPaths = this._cachedPaths.asReadonly();

  // Internal state
  private db: IDBPDatabase<MigrationCacheDB> | null = null;
  private rateLimiter: RateLimiter;
  private worker: Worker | null = null;
  private workerReady = false;
  private pendingWorkerTasks = new Map<
    string,
    {
      resolve: (
        data:
          | readonly MigrationPoint[]
          | PromiseLike<readonly MigrationPoint[]>,
      ) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor() {
    this.rateLimiter = createGBIFRateLimiter();
    this.initializeDatabase();
    this.initializeWorker();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Initializes IndexedDB database
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await openDB<MigrationCacheDB>(
        'migration-cache',
        this.CACHE_VERSION,
        {
          upgrade(db) {
            // Create migrations store
            if (!db.objectStoreNames.contains('migrations')) {
              const migrationStore = db.createObjectStore('migrations', {
                keyPath: 'key',
              });
              migrationStore.createIndex('timestamp', 'timestamp');
              migrationStore.createIndex('expiresAt', 'expiresAt');
              migrationStore.createIndex('speciesKey', 'data.speciesKey');
            }

            // Create species store
            if (!db.objectStoreNames.contains('species')) {
              const speciesStore = db.createObjectStore('species', {
                keyPath: 'key',
              });
              speciesStore.createIndex('timestamp', 'timestamp');
              speciesStore.createIndex('expiresAt', 'expiresAt');
            }
          },
        },
      );

      this.logger.debug('✅ Migration cache database initialized');
      await this.cleanExpiredCache();
    } catch (error) {
      this.logger.error('❌ Failed to initialize cache database:', error);
    }
  }

  /**
   * Initializes Web Worker for data parsing
   */
  private initializeWorker(): void {
    try {
      this.worker = new Worker(
        new URL('../workers/gbif-parser.worker.ts', import.meta.url),
        { type: 'module' },
      );

      this.worker.onmessage = (event: MessageEvent<GBIFWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        this.logger.error('❌ Worker error:', error);
        this.setError({
          type: 'worker',
          message: 'Data processing worker encountered an error',
          recoverable: true,
          retryable: true,
          timestamp: new Date(),
        });
      };

      this.workerReady = true;
      this.logger.debug('✅ GBIF parser worker initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize worker:', error);
      this.workerReady = false;
    }
  }

  /**
   * Handles messages from Web Worker
   */
  private handleWorkerMessage(response: GBIFWorkerResponse): void {
    const task = this.pendingWorkerTasks.get(response.id);

    if (!task) {
      this.logger.warn('⚠️ Received response for unknown task:', response.id);
      return;
    }

    switch (response.type) {
      case 'success':
        task.resolve(response.data as readonly MigrationPoint[]);
        this.pendingWorkerTasks.delete(response.id);
        break;

      case 'error':
        task.reject(new Error(response.error || 'Worker processing failed'));
        this.pendingWorkerTasks.delete(response.id);
        break;

      case 'progress':
        this.updateProgress(response.progress || 0);
        break;
    }
  }

  /**
   * Fetches migration path for a species
   * @param speciesKey - GBIF taxon key
   * @param dateRange - Optional date range filter
   * @param progressCallback - Optional progress callback
   * @returns Migration path with all data points
   */
  async fetchMigrationPath(
    speciesKey: number,
    dateRange?: DateRange,
    progressCallback?: ProgressCallback,
  ): Promise<MigrationPath> {
    this.startOperation('Fetching migration data');

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(speciesKey, dateRange);
      const cached = await this.getCachedMigration(cacheKey);

      if (cached) {
        this.logger.debug('✅ Using cached migration data');
        this.completeOperation();
        return cached;
      }

      // Fetch species metadata
      this.updateProgress(10, 'Fetching species information');
      const species = await this.fetchSpeciesMetadata(speciesKey);

      // Build GBIF query
      const query = this.buildGBIFQuery(speciesKey, dateRange);

      // Fetch occurrences (with pagination)
      this.updateProgress(20, 'Fetching occurrence data');
      const occurrences = await this.fetchAllOccurrences(
        query,
        progressCallback,
      );

      if (occurrences.length === 0) {
        throw new Error('No migration data found for this species');
      }

      // Parse data in Web Worker
      this.updateProgress(60, 'Processing migration data');
      const parsedPoints = await this.parseOccurrencesInWorker(occurrences);

      // Apply sensitive species protection
      const protectedPoints = protectSensitivePoints(
        parsedPoints,
        speciesKey,
        species.conservationStatus,
      );

      // Calculate statistics
      this.updateProgress(80, 'Calculating statistics');
      const statistics = this.calculateStatistics(protectedPoints);

      // Build migration path
      const migrationPath: MigrationPath = {
        id: `migration-${speciesKey}-${Date.now()}`,
        speciesKey,
        scientificName: species.scientificName,
        commonName: species.commonName,
        points: protectedPoints,
        metadata: {
          year: dateRange?.startDate.getFullYear() || new Date().getFullYear(),
          dateRange: dateRange || this.inferDateRange(protectedPoints),
          sourceType: 'gbif',
          dataQuality: this.assessDataQuality(protectedPoints),
          totalObservations: occurrences.length,
          validObservations: protectedPoints.length,
          redactedCount: species.isSensitive ? protectedPoints.length : 0,
          fetchedAt: new Date(),
          processingTime: 0, // Will be set after
        },
        statistics,
      };

      // Cache the result
      this.updateProgress(90, 'Caching data');
      await this.cacheMigrationPath(cacheKey, migrationPath);

      this.updateProgress(100, 'Complete');
      this.completeOperation();

      return migrationPath;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Fetches species metadata from GBIF
   */
  private async fetchSpeciesMetadata(
    speciesKey: number,
  ): Promise<SpeciesMetadata> {
    // Check cache
    if (this.db) {
      const cached = await this.db.get('species', speciesKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    await this.rateLimiter.acquire();

    try {
      const url = `${this.GBIF_API_URL}/species/${speciesKey}`;
      const species = await firstValueFrom(
        this.http
          .get<GBIFSpecies>(url)
          .pipe(
            timeout(this.REQUEST_TIMEOUT),
            retry(2),
            catchError(this.handleHttpError),
          ),
      );

      const metadata: SpeciesMetadata = {
        speciesKey,
        scientificName: species.scientificName,
        commonName: species.vernacularName || species.canonicalName,
        family: species.family || 'Unknown',
        order: species.order || 'Unknown',
        migrationType: 'long-distance', // Would be determined from data analysis
        conservationStatus: 'LC', // Would come from IUCN API
        isSensitive: isSensitiveSpecies(speciesKey),
        migrationRange: 'long',
        lastUpdated: new Date(),
      };

      // Cache metadata
      if (this.db) {
        const cacheEntry: CacheEntry<SpeciesMetadata> = {
          key: String(speciesKey),
          data: metadata,
          timestamp: Date.now(),
          expiresAt: Date.now() + this.CACHE_TTL,
          metadata: {
            version: this.CACHE_VERSION,
            size: JSON.stringify(metadata).length,
            compressed: false,
            source: 'gbif-species-api',
          },
        };

        await this.db.put('species', cacheEntry);
      }

      return metadata;
    } catch (error) {
      this.logger.error('Failed to fetch species metadata:', error);
      // Return minimal metadata
      return {
        speciesKey,
        scientificName: `Species ${speciesKey}`,
        commonName: `Species ${speciesKey}`,
        family: 'Unknown',
        order: 'Unknown',
        migrationType: 'long-distance',
        conservationStatus: 'DD',
        isSensitive: false,
        migrationRange: 'medium',
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Builds GBIF API query parameters
   */
  private buildGBIFQuery(
    speciesKey: number,
    dateRange?: DateRange,
  ): GBIFQueryParams {
    let query: GBIFQueryParams = {
      taxonKey: speciesKey,
      hasCoordinate: true,
      hasGeospatialIssue: false,
      limit: 300,
      offset: 0,
    };

    if (dateRange) {
      const startISO = dateRange.startDate.toISOString().split('T')[0];
      const endISO = dateRange.endDate.toISOString().split('T')[0];
      query = { ...query, eventDate: `${startISO},${endISO}` };
    }

    return query;
  }

  /**
   * Fetches all occurrences with pagination
   */
  private async fetchAllOccurrences(
    query: GBIFQueryParams,
    progressCallback?: ProgressCallback,
  ): Promise<readonly GBIFOccurrence[]> {
    const allOccurrences: GBIFOccurrence[] = [];
    let offset = 0;
    const limit = 300;
    const maxRecords = 10000; // Safety limit

    while (allOccurrences.length < maxRecords) {
      await this.rateLimiter.acquire();

      const queryObject: Record<string, string> = {
        offset: String(offset),
        limit: String(limit),
      };

      // Type-safe query parameter conversion
      if (query.taxonKey !== undefined)
        queryObject['taxonKey'] = String(query.taxonKey);
      if (query.scientificName)
        queryObject['scientificName'] = query.scientificName;
      if (query.country) queryObject['country'] = query.country;
      if (query.year !== undefined) queryObject['year'] = String(query.year);
      if (query.month !== undefined) queryObject['month'] = String(query.month);
      if (query.decimalLatitude !== undefined)
        queryObject['decimalLatitude'] = String(query.decimalLatitude);
      if (query.decimalLongitude !== undefined)
        queryObject['decimalLongitude'] = String(query.decimalLongitude);
      if (query.hasCoordinate !== undefined)
        queryObject['hasCoordinate'] = String(query.hasCoordinate);
      if (query.hasGeospatialIssue !== undefined)
        queryObject['hasGeospatialIssue'] = String(query.hasGeospatialIssue);

      const params = new HttpParams({ fromObject: queryObject });

      try {
        const response = await firstValueFrom(
          this.http
            .get<GBIFResponse>(`${this.GBIF_API_URL}/occurrence/search`, {
              params,
            })
            .pipe(
              timeout(this.REQUEST_TIMEOUT),
              retry(this.MAX_RETRIES),
              catchError(this.handleHttpError),
            ),
        );

        allOccurrences.push(...response.results);

        if (progressCallback) {
          const progress = Math.min(
            100,
            (allOccurrences.length / Math.min(response.count, maxRecords)) *
              100,
          );
          progressCallback({
            current: allOccurrences.length,
            total: Math.min(response.count, maxRecords),
            percentage: progress,
            stage: 'fetching',
            message: `Fetched ${allOccurrences.length} of ${response.count} records`,
          });
        }

        if (response.endOfRecords || allOccurrences.length >= maxRecords) {
          break;
        }

        offset += limit;
      } catch (error) {
        this.logger.error('Error fetching occurrences:', error);
        break;
      }
    }

    return allOccurrences;
  }

  /**
   * Parses occurrences using Web Worker
   */
  private async parseOccurrencesInWorker(
    occurrences: readonly GBIFOccurrence[],
  ): Promise<readonly MigrationPoint[]> {
    if (!this.worker || !this.workerReady) {
      // Fallback to synchronous parsing
      return this.parseOccurrencesSync(occurrences);
    }

    const taskId = `parse-${Date.now()}`;

    return new Promise<readonly MigrationPoint[]>((resolve, reject) => {
      this.pendingWorkerTasks.set(taskId, { resolve, reject });

      // Create proper GBIFResponse structure for worker
      const gbifResponse: GBIFResponse = {
        results: occurrences as readonly GBIFOccurrence[],
        offset: 0,
        limit: occurrences.length,
        endOfRecords: true,
        count: occurrences.length,
      };

      const request: GBIFWorkerRequest = {
        type: 'parse',
        id: taskId,
        data: gbifResponse,
        options: {
          filterIssues: true,
          redactSensitive: false, // Will be done separately
          sortByDate: true,
        },
      };

      this.worker!.postMessage(request);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingWorkerTasks.has(taskId)) {
          this.pendingWorkerTasks.delete(taskId);
          reject(new Error('Worker parsing timeout'));
        }
      }, 60000);
    });
  }

  /**
   * Synchronous fallback for parsing occurrences
   */
  private parseOccurrencesSync(
    occurrences: readonly GBIFOccurrence[],
  ): readonly MigrationPoint[] {
    const points: MigrationPoint[] = [];

    for (const occ of occurrences) {
      if (!occ.decimalLatitude || !occ.decimalLongitude || !occ.eventDate) {
        continue;
      }

      const point: MigrationPoint = {
        id: `gbif-${occ.key}`,
        latitude: occ.decimalLatitude,
        longitude: occ.decimalLongitude,
        date: new Date(occ.eventDate),
        accuracy: occ.coordinateUncertaintyInMeters || 1000,
        metadata: {
          scientificName: occ.scientificName,
          countryCode: occ.countryCode,
          locality: occ.locality,
          issues: occ.issues,
        },
      };

      points.push(point);
    }

    return points.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Calculates migration statistics
   */
  private calculateStatistics(
    points: readonly MigrationPoint[],
  ): MigrationStatistics {
    if (points.length === 0) {
      return this.getEmptyStatistics();
    }

    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const countries = new Set(
      points.map((p) => p.metadata.countryCode).filter(Boolean),
    );

    const boundingBox: BoundingBox = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    };

    const totalDistance = this.calculateTotalDistance(points);
    const duration = this.calculateDuration(points);

    return {
      totalDistance,
      duration,
      averageSpeed: duration > 0 ? totalDistance / duration : 0,
      boundingBox,
      countries: Array.from(countries) as string[],
      continents: [], // Would require additional mapping
      highestLatitude: boundingBox.north,
      lowestLatitude: boundingBox.south,
      crossesEquator: boundingBox.north > 0 && boundingBox.south < 0,
      crossesDateLine: boundingBox.east > 150 && boundingBox.west < -150,
    };
  }

  /**
   * Calculates total distance along path (haversine)
   */
  private calculateTotalDistance(points: readonly MigrationPoint[]): number {
    let total = 0;

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      total += this.haversineDistance(
        p1.latitude,
        p1.longitude,
        p2.latitude,
        p2.longitude,
      );
    }

    return total;
  }

  /**
   * Haversine distance formula (km)
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculates duration in days
   */
  private calculateDuration(points: readonly MigrationPoint[]): number {
    if (points.length < 2) return 0;

    const first = points[0].date.getTime();
    const last = points[points.length - 1].date.getTime();

    return (last - first) / (1000 * 60 * 60 * 24);
  }

  /**
   * Assesses data quality
   */
  private assessDataQuality(points: readonly MigrationPoint[]): DataQuality {
    if (points.length === 0) return 'insufficient';
    if (points.length < 10) return 'poor';
    if (points.length < 50) return 'fair';
    if (points.length < 200) return 'good';
    return 'excellent';
  }

  /**
   * Infers date range from points
   */
  private inferDateRange(points: readonly MigrationPoint[]): DateRange {
    if (points.length === 0) {
      const now = new Date();
      return {
        startDate: now,
        endDate: now,
        granularity: 'day',
      };
    }

    const dates = points.map((p) => p.date.getTime());
    return {
      startDate: new Date(Math.min(...dates)),
      endDate: new Date(Math.max(...dates)),
      granularity: 'day',
    };
  }

  /**
   * Generates cache key
   */
  private generateCacheKey(speciesKey: number, dateRange?: DateRange): string {
    const parts = [`species-${speciesKey}`];

    if (dateRange) {
      parts.push(
        `${dateRange.startDate.toISOString()}-${dateRange.endDate.toISOString()}`,
      );
    }

    return parts.join('-');
  }

  /**
   * Gets cached migration path
   */
  private async getCachedMigration(key: string): Promise<MigrationPath | null> {
    if (!this.db) return null;

    try {
      const cached = await this.db.get('migrations', key);

      if (!cached || cached.expiresAt < Date.now()) {
        return null;
      }

      return cached.data;
    } catch (error) {
      this.logger.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Caches migration path
   */
  private async cacheMigrationPath(
    key: string,
    path: MigrationPath,
  ): Promise<void> {
    if (!this.db) return;

    try {
      const cacheEntry: CacheEntry<MigrationPath> = {
        key,
        data: path,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_TTL,
        metadata: {
          version: this.CACHE_VERSION,
          size: JSON.stringify(path).length,
          compressed: false,
          source: 'gbif-api',
        },
      };

      await this.db.put('migrations', cacheEntry);

      // Update in-memory cache
      this._cachedPaths.update((cache) => {
        const newCache = new Map(cache);
        newCache.set(key, path);
        return newCache;
      });

      // Enforce cache size limit
      await this.enforceCacheLimit();
    } catch (error) {
      this.logger.error('Cache write error:', error);
    }
  }

  /**
   * Cleans expired cache entries
   */
  private async cleanExpiredCache(): Promise<void> {
    if (!this.db) return;

    try {
      const now = Date.now();
      const tx = this.db.transaction(['migrations', 'species'], 'readwrite');

      const migrationsIndex = tx.objectStore('migrations').index('expiresAt');
      const speciesIndex = tx.objectStore('species').index('expiresAt');

      for await (const cursor of migrationsIndex.iterate()) {
        if (cursor.value.expiresAt < now) {
          await cursor.delete();
        }
      }

      for await (const cursor of speciesIndex.iterate()) {
        if (cursor.value.expiresAt < now) {
          await cursor.delete();
        }
      }

      await tx.done;
      this.logger.debug('✅ Expired cache entries cleaned');
    } catch (error) {
      this.logger.error('Cache cleanup error:', error);
    }
  }

  /**
   * Enforces maximum cache entries limit
   */
  private async enforceCacheLimit(): Promise<void> {
    if (!this.db) return;

    try {
      const migrations = await this.db.getAllFromIndex(
        'migrations',
        'timestamp',
      );

      if (migrations.length > this.MAX_CACHE_ENTRIES) {
        const toDelete = migrations
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, migrations.length - this.MAX_CACHE_ENTRIES);

        for (const entry of toDelete) {
          await this.db.delete('migrations', entry.key);
        }

        this.logger.debug(`🗑️ Removed ${toDelete.length} old cache entries`);
      }
    } catch (error) {
      this.logger.error('Cache limit enforcement error:', error);
    }
  }

  /**
   * State management methods
   */
  private startOperation(operation: string): void {
    this._state.update((state) => ({
      ...state,
      isLoading: true,
      currentOperation: operation,
      progress: 0,
      error: null,
    }));
  }

  private updateProgress(progress: number, message?: string): void {
    this._state.update((state) => ({
      ...state,
      progress,
      currentOperation: message || state.currentOperation,
    }));
  }

  private completeOperation(): void {
    this._state.update((state) => ({
      ...state,
      isLoading: false,
      currentOperation: null,
      progress: 100,
    }));
  }

  private setError(error: MigrationError): void {
    this._state.update((state) => ({
      ...state,
      isLoading: false,
      error,
    }));
  }

  private handleError(error: unknown): void {
    this.logger.error('Migration data service error:', error);

    const migrationError: MigrationError = {
      type: 'unknown',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
      recoverable: true,
      retryable: true,
      timestamp: new Date(),
    };

    this.setError(migrationError);
  }

  private handleHttpError(error: HttpErrorResponse) {
    let message = 'Network error occurred';

    if (error.status === 404) {
      message = 'Species data not found';
    } else if (error.status === 429) {
      message = 'Rate limit exceeded. Please try again later.';
    } else if (error.status >= 500) {
      message = 'GBIF server error. Please try again later.';
    }

    return throwError(() => new Error(message));
  }

  private getEmptyStatistics(): MigrationStatistics {
    return {
      totalDistance: 0,
      duration: 0,
      averageSpeed: 0,
      boundingBox: { north: 0, south: 0, east: 0, west: 0 },
      countries: [],
      continents: [],
      highestLatitude: 0,
      lowestLatitude: 0,
      crossesEquator: false,
      crossesDateLine: false,
    };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.logger.debug('🧹 Migration data service cleaned up');
  }

  /**
   * Clears all cached data
   */
  async clearCache(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(['migrations', 'species'], 'readwrite');
      await tx.objectStore('migrations').clear();
      await tx.objectStore('species').clear();
      await tx.done;

      this._cachedPaths.set(new Map());

      this.logger.debug('🗑️ All cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }

  // ===== NEW MARKER-BASED UX METHODS =====

  /**
   * Get simplified migration records for marker-based visualization
   * Transforms GBIF MigrationPath data to MigrationRecord format
   * @param speciesKeys Array of GBIF taxon keys
   * @param dateRange Optional date range filter
   * @returns Array of migration records
   */
  async getMigrationRecords(
    speciesKeys: number[],
    dateRange?: DateRange,
  ): Promise<MigrationRecord[]> {
    this.startOperation('Fetching migration records');

    try {
      const migrationRecords: MigrationRecord[] = [];

      for (const speciesKey of speciesKeys) {
        try {
          // Fetch full migration path from existing method
          const migrationPath = await this.fetchMigrationPath(
            speciesKey,
            dateRange,
          );

          // Transform to simplified MigrationRecord format
          const record = this.transformToMigrationRecord(migrationPath);
          migrationRecords.push(record);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch migration for species ${speciesKey}:`,
            error,
          );
          // Continue with other species
        }
      }

      this.completeOperation();
      return migrationRecords;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Get species metadata for marker-based UX
   * Fetches species details, images, and conservation status
   * @param speciesKeys Array of GBIF taxon keys
   * @returns Array of species metadata
   */
  async getSpeciesMetadata(speciesKeys: number[]): Promise<Species[]> {
    this.startOperation('Fetching species metadata');

    try {
      const speciesMetadata: Species[] = [];

      for (const speciesKey of speciesKeys) {
        try {
          const metadata = await this.fetchSpeciesMetadata(speciesKey);

          // Transform to Species format for marker-based UX
          const species: Species = {
            id: this.generateSpeciesId(metadata.scientificName),
            commonName: metadata.commonName,
            scientificName: metadata.scientificName,
            description: this.generateSpeciesDescription(metadata),
            conservationStatus: metadata.conservationStatus,
            funFact: this.generateFunFact(metadata.scientificName),
            wikipediaUrl: this.generateWikipediaUrl(metadata.commonName),
            imageUrl: this.generateImageUrl(metadata.scientificName),
          };

          speciesMetadata.push(species);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch metadata for species ${speciesKey}:`,
            error,
          );
          // Continue with other species
        }
      }

      this.completeOperation();
      return speciesMetadata;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // ===== Helper Methods for Marker-Based UX =====

  /**
   * Transform MigrationPath to simplified MigrationRecord
   */
  private transformToMigrationRecord(
    migrationPath: MigrationPath,
  ): MigrationRecord {
    const points = migrationPath.points;

    // Find start and end locations
    const startPoint = points[0];
    const endPoint = points[points.length - 1];

    // Extract waypoints (sample every ~10 points for performance)
    const waypointInterval = Math.max(1, Math.floor(points.length / 10));
    const waypoints = points
      .slice(1, -1) // Exclude start and end
      .filter((_, index) => index % waypointInterval === 0)
      .map((point) => ({
        lat: point.latitude,
        lon: point.longitude,
        name: point.metadata.locality || 'Unknown',
        date: point.date,
      }));

    return {
      id: migrationPath.id,
      speciesId: this.generateSpeciesId(migrationPath.scientificName),
      startLocation: {
        lat: startPoint.latitude,
        lon: startPoint.longitude,
        name: startPoint.metadata.locality || 'Unknown',
        date: startPoint.date,
      },
      endLocation: {
        lat: endPoint.latitude,
        lon: endPoint.longitude,
        name: endPoint.metadata.locality || 'Unknown',
        date: endPoint.date,
      },
      waypoints,
      distanceKm: migrationPath.statistics.totalDistance,
      durationDays: migrationPath.statistics.duration,
      flyway: detectFlyway(
        startPoint.latitude,
        startPoint.longitude,
        endPoint.latitude,
        endPoint.longitude,
      ),
      isSensitive: migrationPath.metadata.redactedCount > 0,
    };
  }

  /**
   * Generate species ID from scientific name
   */
  private generateSpeciesId(scientificName: string): string {
    return scientificName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Generate species description
   */
  private generateSpeciesDescription(metadata: SpeciesMetadata): string {
    const { commonName, family, migrationType, migrationRange } = metadata;

    return `${commonName} is a ${migrationType} migrant in the ${family} family, known for its ${migrationRange} migration journeys.`;
  }

  /**
   * Generate fun fact for species
   */
  private generateFunFact(scientificName: string): string {
    const funFacts: Record<string, string> = {
      'Sterna paradisaea':
        'Arctic Terns see more daylight than any other animal, experiencing two summers per year!',
      'Limosa lapponica':
        'Bar-tailed Godwits can fly non-stop for over 7,000 miles without food or water!',
      'Archilochus colubris':
        'Ruby-throated Hummingbirds fly 500 miles non-stop across the Gulf of Mexico!',
      'Hirundo rustica':
        'Barn Swallows can travel up to 200 miles per day during migration!',
      'Calidris canutus':
        'Red Knots can detect magnetic fields to navigate during migration!',
    };

    return (
      funFacts[scientificName] ||
      'This species undertakes remarkable migration journeys!'
    );
  }

  /**
   * Generate Wikipedia URL for species
   */
  private generateWikipediaUrl(commonName: string): string {
    const wikiName = commonName.replace(/\s+/g, '_');
    return `https://en.wikipedia.org/wiki/${wikiName}`;
  }

  /**
   * Generate image URL for species
   * Uses Wikipedia Commons images - free and high quality
   */
  private generateImageUrl(scientificName: string): string | undefined {
    // Map of known species to their Wikipedia Commons image URLs
    const imageMap: Record<string, string> = {
      'Sterna paradisaea':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Arctic_tern.jpg/400px-Arctic_tern.jpg',
      'Limosa lapponica':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Bar-tailed_Godwit.jpg/400px-Bar-tailed_Godwit.jpg',
      'Archilochus colubris':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Ruby-throated_Hummingbird_%28male%29.jpg/400px-Ruby-throated_Hummingbird_%28male%29.jpg',
      'Hirundo rustica':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Barn_Swallow.jpg/400px-Barn_Swallow.jpg',
      'Calidris canutus':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Red_Knot.jpg/400px-Red_Knot.jpg',
      'Grus grus':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Common_Crane_%28Grus_grus%29.jpg/400px-Common_Crane_%28Grus_grus%29.jpg',
      'Pernis ptilorhynchus':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Pernis_ptilorhynchus_-_Mae_Wong.jpg/400px-Pernis_ptilorhynchus_-_Mae_Wong.jpg',
      'Ciconia ciconia':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/White_Stork_%28Ciconia_ciconia%29_..._%2851318611478%29.jpg/400px-White_Stork_%28Ciconia_ciconia%29_..._%2851318611478%29.jpg',
      'Tyto alba':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Tyto_alba_-British_Wildlife_Centre%2C_Surrey%2C_England-8a_%282%29.jpg/400px-Tyto_alba_-British_Wildlife_Centre%2C_Surrey%2C_England-8a_%282%29.jpg',
      'Selasphorus rufus':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Rufous_Hummingbird_%28male%29.jpg/400px-Rufous_Hummingbird_%28male%29.jpg',
    };

    return imageMap[scientificName];
  }
}
