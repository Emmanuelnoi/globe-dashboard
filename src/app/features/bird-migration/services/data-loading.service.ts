import { Injectable, signal, inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject, fromEvent, merge } from 'rxjs';
import { map, filter, takeUntil, finalize } from 'rxjs/operators';
import { GbifAdapterService, GbifSearchResponse } from './gbif-adapter.service';
import { LoggerService } from '@/core/services/logger.service';
import {
  SpeciesInfo,
  DateRange,
  LoadingState,
  ErrorState,
  MigrationDataPoint,
} from '../models/ui.models';
import {
  WorkerMessage,
  ParseRequest,
  DecimationRequest,
} from '../workers/gbif-parser.worker';
import { GBIFOccurrence } from '../models/gbif.types';

/**
 * Data Loading Progress Stages
 */
export type LoadingStage =
  | 'initialization'
  | 'fetching-data'
  | 'parsing-data'
  | 'processing-coordinates'
  | 'applying-filters'
  | 'decimating-data'
  | 'finalizing'
  | 'completed'
  | 'error';

/**
 * Progress Update Interface
 */
export interface LoadingProgress {
  readonly stage: LoadingStage;
  readonly percentage: number;
  readonly message: string;
  readonly currentItem: number;
  readonly totalItems: number;
  readonly estimatedTimeRemaining?: number;
  readonly throughput?: number; // items per second
}

/**
 * Data Loading Request Configuration
 */
export interface DataLoadingRequest {
  readonly species: SpeciesInfo;
  readonly dateRange: DateRange;
  readonly maxPoints?: number;
  readonly coordinateBounds?: {
    readonly minLat: number;
    readonly maxLat: number;
    readonly minLng: number;
    readonly maxLng: number;
  };
  readonly qualityFilters?: {
    readonly minAccuracy?: number;
    readonly excludeIssues?: readonly string[];
  };
  readonly decimationSettings?: {
    readonly algorithm: 'random' | 'spatial' | 'temporal';
    readonly targetCount: number;
  };
}

/**
 * Data Loading Result
 */
export interface DataLoadingResult {
  readonly request: DataLoadingRequest;
  readonly dataPoints: readonly MigrationDataPoint[];
  readonly metadata: {
    readonly totalSourceRecords: number;
    readonly validRecords: number;
    readonly filteredRecords: number;
    readonly finalPointCount: number;
    readonly loadingTimeMs: number;
    readonly dataQuality: 'excellent' | 'good' | 'fair';
    readonly coverage: number;
    readonly processingStages: readonly {
      readonly stage: LoadingStage;
      readonly duration: number;
      readonly itemsProcessed: number;
    }[];
  };
}

/**
 * Worker Pool Management
 */
interface WorkerInstance {
  readonly worker: Worker;
  readonly id: string;
  busy: boolean; // Mutable: updated during task lifecycle
  currentTask?: string;
}

/**
 * Data Loading Service
 * Manages progressive data loading with Web Workers and detailed progress tracking
 */
@Injectable({
  providedIn: 'root',
})
export class DataLoadingService {
  private readonly gbifAdapter = inject(GbifAdapterService);
  private readonly logger = inject(LoggerService);

  // Service state
  private readonly _isLoading = signal<boolean>(false);
  private readonly _currentProgress = signal<LoadingProgress | null>(null);
  private readonly _loadingError = signal<string | null>(null);
  private readonly _activeRequests = signal<number>(0);

  // Worker pool
  private readonly workers: WorkerInstance[] = [];
  private readonly maxWorkers = Math.max(
    2,
    Math.min(navigator.hardwareConcurrency || 4, 6),
  );
  private workerIdCounter = 0;

  // Progress tracking
  private progressSubject = new BehaviorSubject<LoadingProgress | null>(null);
  private cancelSubject = new Subject<void>();
  private stageTimings: Array<{
    stage: LoadingStage;
    startTime: number;
    duration?: number;
    itemsProcessed: number;
  }> = [];

  // Public readonly properties
  readonly isLoading = this._isLoading.asReadonly();
  readonly currentProgress = this._currentProgress.asReadonly();
  readonly loadingError = this._loadingError.asReadonly();
  readonly activeRequests = this._activeRequests.asReadonly();

  // Observable streams
  readonly progress$: Observable<LoadingProgress> = this.progressSubject
    .asObservable()
    .pipe(filter((progress): progress is LoadingProgress => progress !== null));

  constructor() {
    this.logger.debug(
      '🔄 DataLoadingService initialized',
      'DataLoadingService',
    );
    this.initializeWorkerPool();
  }

  /**
   * Initialize Web Worker pool
   */
  private async initializeWorkerPool(): Promise<void> {
    try {
      for (let i = 0; i < this.maxWorkers; i++) {
        const worker = new Worker(
          new URL('../workers/gbif-parser.worker.ts', import.meta.url),
          { type: 'module' },
        );

        const workerInstance: WorkerInstance = {
          worker,
          id: `worker-${++this.workerIdCounter}`,
          busy: false,
        };

        this.workers.push(workerInstance);
        this.logger.debug(`🧵 Worker ${workerInstance.id} initialized`);
      }

      this.logger.debug(
        `✅ Worker pool initialized with ${this.workers.length} workers`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to initialize worker pool:', error);
      // Continue without workers - fallback to main thread processing
    }
  }

  /**
   * Load migration data with progressive loading and detailed progress
   */
  async loadMigrationData(
    request: DataLoadingRequest,
  ): Promise<DataLoadingResult> {
    this.logger.debug('🚀 Starting data loading process:', request);

    this._isLoading.set(true);
    this._loadingError.set(null);
    this._activeRequests.update((count) => count + 1);
    this.stageTimings = [];

    const startTime = Date.now();

    try {
      // Stage 1: Initialization
      await this.updateProgress(
        'initialization',
        0,
        'Initializing data loading...',
        0,
        1,
      );

      // Stage 2: Fetch data from GBIF
      await this.updateProgress(
        'fetching-data',
        5,
        'Fetching data from GBIF...',
        0,
        1,
      );
      const gbifResponse = await this.fetchGbifData(request);

      // Stage 3: Parse raw data
      await this.updateProgress(
        'parsing-data',
        20,
        'Parsing GBIF response...',
        0,
        gbifResponse.results.length,
      );
      const parsedData = await this.parseGbifData(gbifResponse, request);

      // Stage 4: Process coordinates and validate
      await this.updateProgress(
        'processing-coordinates',
        40,
        'Processing coordinates...',
        0,
        parsedData.length,
      );
      const validatedData = await this.processCoordinates(parsedData, request);

      // Stage 5: Apply quality filters
      await this.updateProgress(
        'applying-filters',
        60,
        'Applying quality filters...',
        0,
        validatedData.length,
      );
      const filteredData = await this.applyQualityFilters(
        validatedData,
        request,
      );

      // Stage 6: Decimate data if needed
      let finalData = filteredData;
      if (
        request.decimationSettings &&
        filteredData.length > request.decimationSettings.targetCount
      ) {
        await this.updateProgress(
          'decimating-data',
          80,
          'Decimating data for performance...',
          0,
          filteredData.length,
        );
        finalData = await this.decimateData(
          filteredData,
          request.decimationSettings,
        );
      }

      // Stage 7: Finalize
      await this.updateProgress(
        'finalizing',
        95,
        'Finalizing results...',
        0,
        1,
      );
      const result = await this.finalizeResult(
        request,
        gbifResponse,
        finalData,
        startTime,
      );

      // Stage 8: Complete
      await this.updateProgress(
        'completed',
        100,
        'Data loading completed!',
        1,
        1,
      );

      this.logger.debug(
        `✅ Data loading completed in ${Date.now() - startTime}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Data loading failed:', error);
      await this.updateProgress(
        'error',
        0,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        1,
      );
      this._loadingError.set(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    } finally {
      this._isLoading.set(false);
      this._activeRequests.update((count) => Math.max(0, count - 1));
    }
  }

  /**
   * Cancel current loading operation
   */
  cancelLoading(): void {
    this.logger.debug('🛑 Cancelling data loading...');
    this.cancelSubject.next();
    this._isLoading.set(false);
    this._currentProgress.set(null);
    this._activeRequests.set(0);

    // Terminate busy workers
    this.workers.forEach((workerInstance) => {
      if (workerInstance.busy) {
        workerInstance.worker.terminate();
        this.logger.debug(`🔥 Worker ${workerInstance.id} terminated`);
      }
    });
  }

  /**
   * Get available worker from pool
   */
  private getAvailableWorker(): WorkerInstance | null {
    return this.workers.find((w) => !w.busy) || null;
  }

  /**
   * Execute task with Web Worker
   */
  private async executeWorkerTask<T>(
    request: ParseRequest | DecimationRequest,
    timeout: number = 60000,
  ): Promise<T> {
    const worker = this.getAvailableWorker();

    if (!worker) {
      throw new Error('No available workers in pool');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Worker task timeout'));
      }, timeout);

      const messageHandler = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;

        switch (message.type) {
          case 'progress':
            // Update progress from worker
            if (message.progress !== undefined) {
              this.updateProgressPercentage(message.progress);
            }
            break;

          case 'complete':
            clearTimeout(timeoutId);
            worker.worker.removeEventListener('message', messageHandler);
            worker.busy = false;
            resolve(message.data as T);
            break;

          case 'error':
            clearTimeout(timeoutId);
            worker.worker.removeEventListener('message', messageHandler);
            worker.busy = false;
            reject(new Error(message.error || 'Worker error'));
            break;
        }
      };

      worker.worker.addEventListener('message', messageHandler);
      worker.busy = true;
      worker.worker.postMessage(request);
    });
  }

  /**
   * Fetch data from GBIF API
   */
  private async fetchGbifData(
    request: DataLoadingRequest,
  ): Promise<GbifSearchResponse> {
    this.startStage('fetching-data');

    const response = await this.gbifAdapter.fetchOccurrences(
      '212', // Mock taxon key - would use request.species.gbifKey in production
      request.dateRange,
      {
        limit: request.maxPoints || 5000,
        coordinates: request.coordinateBounds,
      },
    );

    this.endCurrentStage(response.results.length);
    return response;
  }

  /**
   * Parse GBIF data using Web Worker
   */
  private async parseGbifData(
    gbifResponse: GbifSearchResponse,
    request: DataLoadingRequest,
  ): Promise<MigrationDataPoint[]> {
    this.startStage('parsing-data');

    try {
      // If workers available, use worker pool
      if (this.workers.length > 0) {
        const parseRequest: ParseRequest = {
          type: 'parse',
          data: {
            gbifResponse,
            decimationLevel: 1.0,
            taskId: `parse-${Date.now()}`,
          },
        };

        const result = await this.executeWorkerTask<{
          points: MigrationDataPoint[];
        }>(parseRequest);
        this.endCurrentStage(result.points.length);
        return result.points;
      } else {
        // Fallback to main thread processing
        const points = this.parseGbifDataMainThread(gbifResponse);
        this.endCurrentStage(points.length);
        return points;
      }
    } catch (error) {
      this.logger.warn(
        'Worker parsing failed, falling back to main thread:',
        error,
      );
      const points = this.parseGbifDataMainThread(gbifResponse);
      this.endCurrentStage(points.length);
      return points;
    }
  }

  /**
   * Parse GBIF data on main thread (fallback)
   */
  private parseGbifDataMainThread(
    gbifResponse: GbifSearchResponse,
  ): MigrationDataPoint[] {
    const points: MigrationDataPoint[] = [];
    const errors: string[] = [];

    // Validate input data
    if (
      !gbifResponse ||
      !gbifResponse.results ||
      !Array.isArray(gbifResponse.results)
    ) {
      this.logger.warn('Invalid GBIF response structure');
      return points;
    }

    for (let i = 0; i < gbifResponse.results.length; i++) {
      const occurrence = gbifResponse.results[i];

      try {
        // Enhanced validation with edge case handling
        if (this.isValidOccurrence(occurrence)) {
          const point = this.createMigrationDataPoint(occurrence);
          if (point) {
            points.push(point);
          }
        }
      } catch (error) {
        errors.push(
          `Row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Continue processing other records
      }

      // Update progress periodically
      if (i % 100 === 0) {
        const progress = (i / gbifResponse.results.length) * 100;
        this.updateProgressPercentage(20 + progress * 0.2); // 20-40% range
      }
    }

    // Log parsing summary
    if (errors.length > 0) {
      this.logger.warn(
        `⚠️ Parsing completed with ${errors.length} errors:`,
        errors.slice(0, 5),
      );
      if (errors.length > 5) {
        this.logger.warn(`... and ${errors.length - 5} more errors`);
      }
    }

    this.logger.debug(
      `📊 Parsed ${points.length} valid points from ${gbifResponse.results.length} records (${((points.length / gbifResponse.results.length) * 100).toFixed(1)}% success rate)`,
    );
    return points;
  }

  /**
   * Process and validate coordinates
   */
  private async processCoordinates(
    data: MigrationDataPoint[],
    request: DataLoadingRequest,
  ): Promise<MigrationDataPoint[]> {
    this.startStage('processing-coordinates');

    const validatedData: MigrationDataPoint[] = [];
    const rejectedReasons = new Map<string, number>();
    let processed = 0;

    // Input validation
    if (!Array.isArray(data)) {
      throw new Error('Invalid data: expected array of migration data points');
    }

    for (const point of data) {
      try {
        // Enhanced coordinate validation with detailed error tracking
        const validation = this.validateCoordinates(
          point,
          request.coordinateBounds,
        );

        if (validation.isValid) {
          // Additional data integrity checks
          if (this.isDataPointIntegrous(point)) {
            validatedData.push(point);
          } else {
            this.incrementRejectionCount(
              rejectedReasons,
              'data_integrity_failed',
            );
          }
        } else {
          this.incrementRejectionCount(
            rejectedReasons,
            validation.reason || 'coordinate_validation_failed',
          );
        }
      } catch (error) {
        this.incrementRejectionCount(rejectedReasons, 'processing_error');
        this.logger.warn(`Error processing point ${point.id}:`, error);
      }

      processed++;
      if (processed % 200 === 0) {
        const progress = (processed / data.length) * 100;
        this.updateProgressPercentage(40 + progress * 0.2); // 40-60% range
        await this.delay(1); // Yield to prevent blocking
      }
    }

    // Log validation summary
    const rejectedCount = data.length - validatedData.length;
    if (rejectedCount > 0) {
      this.logger.warn(`📊 Coordinate validation summary:`);
      this.logger.warn(`  ✅ Valid: ${validatedData.length}`);
      this.logger.warn(`  ❌ Rejected: ${rejectedCount}`);
      rejectedReasons.forEach((count, reason) => {
        this.logger.warn(`    - ${reason}: ${count}`);
      });
    }

    if (validatedData.length === 0) {
      throw new Error(
        'No valid coordinates found after validation. Check your data and filters.',
      );
    }

    this.endCurrentStage(validatedData.length);
    return validatedData;
  }

  /**
   * Apply quality filters
   */
  private async applyQualityFilters(
    data: MigrationDataPoint[],
    request: DataLoadingRequest,
  ): Promise<MigrationDataPoint[]> {
    this.startStage('applying-filters');

    if (!request.qualityFilters) {
      this.endCurrentStage(data.length);
      return data;
    }

    const filteredData: MigrationDataPoint[] = [];
    let processed = 0;

    for (const point of data) {
      let passesFilters = true;

      // Check accuracy filter
      if (
        request.qualityFilters.minAccuracy &&
        point.accuracy > request.qualityFilters.minAccuracy
      ) {
        passesFilters = false;
      }

      // Check issues filter
      if (request.qualityFilters.excludeIssues && point.metadata.issues) {
        const hasExcludedIssues = request.qualityFilters.excludeIssues.some(
          (issue) => point.metadata.issues?.includes(issue),
        );
        if (hasExcludedIssues) {
          passesFilters = false;
        }
      }

      if (passesFilters) {
        filteredData.push(point);
      }

      processed++;
      if (processed % 200 === 0) {
        const progress = (processed / data.length) * 100;
        this.updateProgressPercentage(60 + progress * 0.2); // 60-80% range
        await this.delay(1);
      }
    }

    this.endCurrentStage(filteredData.length);
    return filteredData;
  }

  /**
   * Decimate data using Web Worker
   */
  private async decimateData(
    data: MigrationDataPoint[],
    settings: {
      algorithm: 'random' | 'spatial' | 'temporal';
      targetCount: number;
    },
  ): Promise<MigrationDataPoint[]> {
    this.startStage('decimating-data');

    try {
      if (this.workers.length > 0) {
        const decimationRequest: DecimationRequest = {
          type: 'decimate',
          data: {
            points: data,
            targetCount: settings.targetCount,
            algorithm: settings.algorithm,
            taskId: `decimate-${Date.now()}`,
          },
        };

        const result = await this.executeWorkerTask<{
          points: MigrationDataPoint[];
        }>(decimationRequest);
        this.endCurrentStage(result.points.length);
        return result.points;
      } else {
        // Fallback to simple random sampling
        const decimatedData = this.randomSample(data, settings.targetCount);
        this.endCurrentStage(decimatedData.length);
        return decimatedData;
      }
    } catch (error) {
      this.logger.warn(
        'Worker decimation failed, using simple sampling:',
        error,
      );
      const decimatedData = this.randomSample(data, settings.targetCount);
      this.endCurrentStage(decimatedData.length);
      return decimatedData;
    }
  }

  /**
   * Simple random sampling (fallback)
   */
  private randomSample<T>(array: T[], count: number): T[] {
    if (array.length <= count) return [...array];

    const result: T[] = [];
    const indices = new Set<number>();

    while (result.length < count) {
      const index = Math.floor(Math.random() * array.length);
      if (!indices.has(index)) {
        indices.add(index);
        result.push(array[index]);
      }
    }

    return result;
  }

  /**
   * Finalize loading result
   */
  private async finalizeResult(
    request: DataLoadingRequest,
    gbifResponse: GbifSearchResponse,
    finalData: MigrationDataPoint[],
    startTime: number,
  ): Promise<DataLoadingResult> {
    this.startStage('finalizing');

    const loadingTimeMs = Date.now() - startTime;

    // Calculate data quality
    const validRecords = finalData.length;
    const totalRecords = gbifResponse.count;
    const qualityRatio = validRecords / Math.max(totalRecords, 1);

    const dataQuality: 'excellent' | 'good' | 'fair' =
      qualityRatio > 0.8 ? 'excellent' : qualityRatio > 0.6 ? 'good' : 'fair';

    // Calculate coverage
    const coverage = Math.min(100, Math.round(qualityRatio * 100));

    const result: DataLoadingResult = {
      request,
      dataPoints: finalData,
      metadata: {
        totalSourceRecords: totalRecords,
        validRecords: gbifResponse.results.length,
        filteredRecords: validRecords,
        finalPointCount: finalData.length,
        loadingTimeMs,
        dataQuality,
        coverage,
        processingStages: this.stageTimings.map((stage) => ({
          stage: stage.stage,
          duration: stage.duration || 0,
          itemsProcessed: stage.itemsProcessed,
        })),
      },
    };

    this.endCurrentStage(1);
    return result;
  }

  /**
   * Update loading progress
   */
  private async updateProgress(
    stage: LoadingStage,
    percentage: number,
    message: string,
    currentItem: number,
    totalItems: number,
  ): Promise<void> {
    const progress: LoadingProgress = {
      stage,
      percentage,
      message,
      currentItem,
      totalItems,
      estimatedTimeRemaining: this.calculateEta(percentage),
      throughput: this.calculateThroughput(),
    };

    this._currentProgress.set(progress);
    this.progressSubject.next(progress);

    // Small delay to ensure progress updates are visible
    await this.delay(10);
  }

  /**
   * Update progress percentage only
   */
  private updateProgressPercentage(percentage: number): void {
    const current = this._currentProgress();
    if (current) {
      const updated: LoadingProgress = {
        ...current,
        percentage: Math.min(100, Math.max(0, percentage)),
        estimatedTimeRemaining: this.calculateEta(percentage),
      };
      this._currentProgress.set(updated);
      this.progressSubject.next(updated);
    }
  }

  /**
   * Start timing a processing stage
   */
  private startStage(stage: LoadingStage): void {
    // End previous stage if exists
    if (this.stageTimings.length > 0) {
      const lastStage = this.stageTimings[this.stageTimings.length - 1];
      if (lastStage.duration === undefined) {
        lastStage.duration = Date.now() - lastStage.startTime;
      }
    }

    this.stageTimings.push({
      stage,
      startTime: Date.now(),
      itemsProcessed: 0,
    });
  }

  /**
   * End current processing stage
   */
  private endCurrentStage(itemsProcessed: number): void {
    if (this.stageTimings.length > 0) {
      const currentStage = this.stageTimings[this.stageTimings.length - 1];
      currentStage.duration = Date.now() - currentStage.startTime;
      currentStage.itemsProcessed = itemsProcessed;
    }
  }

  /**
   * Calculate estimated time of arrival
   */
  private calculateEta(currentPercentage: number): number {
    if (currentPercentage <= 0 || this.stageTimings.length === 0) return 0;

    const totalElapsed = Date.now() - this.stageTimings[0].startTime;
    const remainingPercentage = 100 - currentPercentage;

    return Math.round((totalElapsed / currentPercentage) * remainingPercentage);
  }

  /**
   * Calculate processing throughput
   */
  private calculateThroughput(): number {
    if (this.stageTimings.length === 0) return 0;

    const totalItems = this.stageTimings.reduce(
      (sum, stage) => sum + stage.itemsProcessed,
      0,
    );
    const totalTime = Date.now() - this.stageTimings[0].startTime;

    return totalTime > 0 ? Math.round((totalItems / totalTime) * 1000) : 0;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate GBIF occurrence data
   */
  private isValidOccurrence(occurrence: GBIFOccurrence): boolean {
    if (!occurrence) return false;

    // Check required fields exist and are valid
    if (
      typeof occurrence.decimalLatitude !== 'number' ||
      typeof occurrence.decimalLongitude !== 'number' ||
      !occurrence.eventDate
    ) {
      return false;
    }

    // Check for NaN values
    if (
      isNaN(occurrence.decimalLatitude) ||
      isNaN(occurrence.decimalLongitude)
    ) {
      return false;
    }

    // Basic coordinate bounds check
    if (
      occurrence.decimalLatitude < -90 ||
      occurrence.decimalLatitude > 90 ||
      occurrence.decimalLongitude < -180 ||
      occurrence.decimalLongitude > 180
    ) {
      return false;
    }

    return true;
  }

  /**
   * Create migration data point with error handling
   */
  private createMigrationDataPoint(
    occurrence: GBIFOccurrence,
  ): MigrationDataPoint | null {
    try {
      // Validate eventDate is not null
      if (!occurrence.eventDate) {
        throw new Error('Missing eventDate');
      }

      const eventDate = new Date(occurrence.eventDate);

      // Validate date
      if (isNaN(eventDate.getTime())) {
        throw new Error(`Invalid date: ${occurrence.eventDate}`);
      }

      // Check for future dates (likely data errors)
      if (eventDate > new Date()) {
        throw new Error(`Future date detected: ${occurrence.eventDate}`);
      }

      // Check for unreasonably old dates (pre-1800)
      if (eventDate.getFullYear() < 1800) {
        throw new Error(`Suspiciously old date: ${occurrence.eventDate}`);
      }

      // Validate coordinates are not null
      if (
        occurrence.decimalLatitude === null ||
        occurrence.decimalLongitude === null
      ) {
        throw new Error('Missing coordinates');
      }

      return {
        id: this.sanitizeString(
          occurrence.key?.toString() ||
            `generated-${Date.now()}-${Math.random()}`,
        ),
        latitude: occurrence.decimalLatitude,
        longitude: occurrence.decimalLongitude,
        date: eventDate,
        accuracy: Math.max(0, occurrence.coordinateUncertaintyInMeters || 1000), // Ensure non-negative
        metadata: {
          scientificName: this.sanitizeString(occurrence.scientificName),
          countryCode: this.sanitizeString(occurrence.countryCode),
          locality: this.sanitizeString(occurrence.locality),
          issues: Array.isArray(occurrence.issues) ? occurrence.issues : [],
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to create data point for occurrence ${occurrence.key}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Validate coordinates with detailed error reporting
   */
  private validateCoordinates(
    point: MigrationDataPoint,
    bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  ): { isValid: boolean; reason?: string } {
    // Basic coordinate validation
    if (
      typeof point.latitude !== 'number' ||
      typeof point.longitude !== 'number'
    ) {
      return { isValid: false, reason: 'invalid_coordinate_type' };
    }

    if (isNaN(point.latitude) || isNaN(point.longitude)) {
      return { isValid: false, reason: 'coordinate_nan' };
    }

    if (point.latitude < -90 || point.latitude > 90) {
      return { isValid: false, reason: 'latitude_out_of_bounds' };
    }

    if (point.longitude < -180 || point.longitude > 180) {
      return { isValid: false, reason: 'longitude_out_of_bounds' };
    }

    // Check for suspicious coordinates (0,0 is often a data error)
    if (point.latitude === 0 && point.longitude === 0) {
      return { isValid: false, reason: 'null_island_coordinates' };
    }

    // Apply user-defined bounds if provided
    if (bounds) {
      if (
        point.latitude < bounds.minLat ||
        point.latitude > bounds.maxLat ||
        point.longitude < bounds.minLng ||
        point.longitude > bounds.maxLng
      ) {
        return { isValid: false, reason: 'outside_user_bounds' };
      }
    }

    return { isValid: true };
  }

  /**
   * Check data point integrity
   */
  private isDataPointIntegrous(point: MigrationDataPoint): boolean {
    // Check for required fields
    if (!point.id || !point.date) {
      return false;
    }

    // Check date validity
    if (isNaN(point.date.getTime())) {
      return false;
    }

    // Check accuracy is reasonable (not negative or extremely large)
    if (point.accuracy < 0 || point.accuracy > 10000000) {
      // 10,000 km seems like a reasonable max
      return false;
    }

    return true;
  }

  /**
   * Sanitize string input to prevent XSS and other issues
   */
  private sanitizeString(input: unknown): string {
    if (typeof input !== 'string') {
      return String(input || '');
    }

    // Basic sanitization - remove potential HTML/script tags
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>&"']/g, '') // Remove potential XSS characters
      .trim()
      .substring(0, 500); // Limit length
  }

  /**
   * Helper to increment rejection counts
   */
  private incrementRejectionCount(
    rejectedReasons: Map<string, number>,
    reason: string,
  ): void {
    rejectedReasons.set(reason, (rejectedReasons.get(reason) || 0) + 1);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.logger.debug('🧹 Destroying DataLoadingService');

    this.cancelSubject.next();
    this.cancelSubject.complete();
    this.progressSubject.complete();

    // Terminate all workers
    this.workers.forEach((workerInstance) => {
      workerInstance.worker.terminate();
      this.logger.debug(`🔥 Worker ${workerInstance.id} terminated`);
    });

    this.workers.length = 0;
  }
}
