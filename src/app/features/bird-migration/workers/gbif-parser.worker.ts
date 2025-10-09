/**
 * GBIF Parser Web Worker - Production Implementation
 * Handles heavy GBIF data parsing and decimation in background thread
 * BM1-T8: Complete implementation with real GBIF processing
 */

import { LoggerService } from '@/core/services/logger.service';

// Create logger instance for worker context
const logger = new LoggerService();

// GBIF API types (replicated for worker isolation)
interface GbifOccurrence {
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

interface GbifSearchResponse {
  readonly offset: number;
  readonly limit: number;
  readonly endOfRecords: boolean;
  readonly count: number;
  readonly results: readonly GbifOccurrence[];
  readonly facets?: readonly unknown[];
}

// Migration data types (replicated for worker isolation)
interface MigrationDataPoint {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly date: Date;
  readonly accuracy: number;
  readonly metadata: {
    readonly scientificName: string;
    readonly countryCode: string | null;
    readonly locality: string | null;
    readonly issues?: readonly string[];
  };
}

// Message types for worker communication
export interface WorkerMessage {
  readonly type: 'parse' | 'decimate' | 'progress' | 'error' | 'complete';
  readonly data?: unknown;
  readonly progress?: number;
  readonly error?: string;
}

export interface ParseRequest {
  readonly type: 'parse';
  readonly data: {
    readonly gbifResponse: GbifSearchResponse;
    readonly decimationLevel: number; // 0-1, where 1 = no decimation
    readonly taskId: string;
  };
}

export interface DecimationRequest {
  readonly type: 'decimate';
  readonly data: {
    readonly points: readonly MigrationDataPoint[];
    readonly targetCount: number;
    readonly algorithm: 'random' | 'spatial' | 'temporal';
    readonly taskId: string;
  };
}

// Worker production implementation
logger.debug('🚀 GBIF Parser Worker initialized (production implementation)');

// Handle messages from main thread
self.addEventListener(
  'message',
  (event: MessageEvent<ParseRequest | DecimationRequest>) => {
    const message = event.data;

    logger.debug(`👷 [WORKER STUB] Received ${message.type} request:`, message);

    switch (message.type) {
      case 'parse':
        handleParseRequest(message);
        break;
      case 'decimate':
        handleDecimationRequest(message);
        break;
      default:
        logger.error('❌ [WORKER STUB] Unknown message type:', message);
    }
  },
);

/**
 * Handle GBIF data parsing request (production implementation)
 */
function handleParseRequest(request: ParseRequest): void {
  const { gbifResponse, decimationLevel, taskId } = request.data;

  logger.debug(`📝 [WORKER] Parsing GBIF data for task: ${taskId}`);
  logger.debug(`📊 Raw GBIF records: ${gbifResponse.results.length}`);

  try {
    // Parse GBIF data in chunks to allow progress updates
    const chunkSize = Math.max(
      10,
      Math.floor(gbifResponse.results.length / 20),
    );
    const parsedPoints: MigrationDataPoint[] = [];
    let validRecords = 0;
    let invalidRecords = 0;
    let processedRecords = 0;

    // Bounding box tracking
    const bounds = {
      north: -90,
      south: 90,
      east: -180,
      west: 180,
    };

    // Date range tracking
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    function processChunk(startIndex: number): void {
      const endIndex = Math.min(
        startIndex + chunkSize,
        gbifResponse.results.length,
      );

      for (let i = startIndex; i < endIndex; i++) {
        const occurrence = gbifResponse.results[i];

        // Validate required fields
        if (
          !occurrence.decimalLatitude ||
          !occurrence.decimalLongitude ||
          !occurrence.eventDate
        ) {
          invalidRecords++;
          continue;
        }

        // Parse and validate coordinates
        const lat = occurrence.decimalLatitude;
        const lng = occurrence.decimalLongitude;

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          invalidRecords++;
          continue;
        }

        // Parse and validate date
        const date = new Date(occurrence.eventDate);
        if (isNaN(date.getTime())) {
          invalidRecords++;
          continue;
        }

        // Update bounding box
        bounds.north = Math.max(bounds.north, lat);
        bounds.south = Math.min(bounds.south, lat);
        bounds.east = Math.max(bounds.east, lng);
        bounds.west = Math.min(bounds.west, lng);

        // Update date range
        if (!earliestDate || date < earliestDate) earliestDate = date;
        if (!latestDate || date > latestDate) latestDate = date;

        // Calculate accuracy from coordinate uncertainty
        const accuracy = occurrence.coordinateUncertaintyInMeters || 1000; // Default 1km

        // Create migration data point
        const point: MigrationDataPoint = {
          id: `gbif-${occurrence.key}`,
          latitude: lat,
          longitude: lng,
          date,
          accuracy,
          metadata: {
            scientificName: occurrence.scientificName,
            countryCode: occurrence.countryCode,
            locality: occurrence.locality,
            issues:
              occurrence.issues.length > 0 ? occurrence.issues : undefined,
          },
        };

        parsedPoints.push(point);
        validRecords++;
      }

      processedRecords = endIndex;
      const progress = (processedRecords / gbifResponse.results.length) * 100;

      // Send progress update
      const progressMessage: WorkerMessage = {
        type: 'progress',
        progress,
      };
      self.postMessage(progressMessage);

      // Process next chunk or complete
      if (endIndex < gbifResponse.results.length) {
        // Use setTimeout to yield control and allow progress updates
        setTimeout(() => processChunk(endIndex), 10);
      } else {
        completeProcessing();
      }
    }

    function completeProcessing(): void {
      // Apply decimation if requested
      let finalPoints = parsedPoints;
      if (decimationLevel < 1 && parsedPoints.length > 0) {
        const targetCount = Math.floor(parsedPoints.length * decimationLevel);
        finalPoints = decimatePointsSpatial(parsedPoints, targetCount);
      }

      // Assess data quality
      const completenessRatio = validRecords / (validRecords + invalidRecords);
      let dataQuality: 'excellent' | 'good' | 'fair';
      if (completenessRatio >= 0.9) dataQuality = 'excellent';
      else if (completenessRatio >= 0.7) dataQuality = 'good';
      else dataQuality = 'fair';

      const parsedData = {
        points: finalPoints,
        metadata: {
          totalRecords: gbifResponse.results.length,
          validRecords,
          invalidRecords,
          dataQuality,
          dateRange: {
            start: earliestDate,
            end: latestDate,
          },
          boundingBox: bounds,
          species: {
            taxonKey: finalPoints[0]?.metadata.scientificName || 'unknown',
            scientificName:
              finalPoints[0]?.metadata.scientificName || 'Unknown species',
          },
          decimationApplied: decimationLevel < 1,
          originalCount: parsedPoints.length,
          finalCount: finalPoints.length,
          parseTime: Date.now(),
          worker: 'gbif-parser-production',
        },
      };

      // Send completion message
      const response: WorkerMessage = {
        type: 'complete',
        data: parsedData,
      };

      self.postMessage(response);
      logger.debug(`✅ [WORKER] Parse task ${taskId} completed`);
      logger.debug(
        `📊 Processed: ${validRecords} valid, ${invalidRecords} invalid records`,
      );
    }

    // Start processing
    processChunk(0);
  } catch (error) {
    logger.error(`❌ [WORKER] Parse error in task ${taskId}:`, error);
    const errorMessage: WorkerMessage = {
      type: 'error',
      error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    self.postMessage(errorMessage);
  }
}

/**
 * Handle data decimation request (production implementation)
 */
function handleDecimationRequest(request: DecimationRequest): void {
  const { points, targetCount, algorithm, taskId } = request.data;

  logger.debug(`🎯 [WORKER] Decimating data for task: ${taskId}`);
  logger.debug(
    `Original count: ${points.length}, Target: ${targetCount}, Algorithm: ${algorithm}`,
  );

  try {
    let decimatedPoints: MigrationDataPoint[];

    // Send initial progress
    const progressMessage: WorkerMessage = {
      type: 'progress',
      progress: 0,
    };
    self.postMessage(progressMessage);

    // Apply selected decimation algorithm
    switch (algorithm) {
      case 'spatial':
        decimatedPoints = decimatePointsSpatial([...points], targetCount);
        break;
      case 'temporal':
        decimatedPoints = decimatePointsTemporal([...points], targetCount);
        break;
      case 'random':
      default:
        decimatedPoints = decimatePointsRandom([...points], targetCount);
        break;
    }

    // Send final progress
    const finalProgressMessage: WorkerMessage = {
      type: 'progress',
      progress: 100,
    };
    self.postMessage(finalProgressMessage);

    const decimatedData = {
      points: decimatedPoints,
      metadata: {
        originalCount: points.length,
        decimatedCount: decimatedPoints.length,
        algorithm,
        reductionRatio: decimatedPoints.length / points.length,
        targetCount,
        achieved: decimatedPoints.length <= targetCount,
        decimationTime: Date.now(),
        worker: 'gbif-parser-production',
      },
    };

    const response: WorkerMessage = {
      type: 'complete',
      data: decimatedData,
    };

    self.postMessage(response);
    logger.debug(`✅ [WORKER] Decimation task ${taskId} completed`);
    logger.debug(
      `📊 Reduced from ${points.length} to ${decimatedPoints.length} points`,
    );
  } catch (error) {
    logger.error(`❌ [WORKER] Decimation error in task ${taskId}:`, error);
    const errorMessage: WorkerMessage = {
      type: 'error',
      error: `Decimation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    self.postMessage(errorMessage);
  }
}

/**
 * Simulate progressive task with progress updates
 */
function simulateProgressiveTask(
  taskId: string,
  description: string,
  onComplete: () => void,
): void {
  let progress = 0;
  const totalSteps = 20;
  const stepDelay = 50; // ms per step

  const progressInterval = setInterval(() => {
    progress += 1;
    const percentage = (progress / totalSteps) * 100;

    // Send progress update
    const progressMessage: WorkerMessage = {
      type: 'progress',
      progress: percentage,
    };

    self.postMessage(progressMessage);

    if (progress >= totalSteps) {
      clearInterval(progressInterval);
      // Add final delay before completion
      setTimeout(onComplete, 100);
    }
  }, stepDelay);

  // Simulate occasional errors (5% chance)
  if (Math.random() < 0.05) {
    setTimeout(() => {
      clearInterval(progressInterval);
      const errorMessage: WorkerMessage = {
        type: 'error',
        error: `Simulated error in task ${taskId}: ${description}`,
      };
      self.postMessage(errorMessage);
    }, stepDelay * 5);
  }
}

/**
 * Generate mock migration points (stub data)
 */
function generateMockMigrationPoints(count: number): Array<{
  lat: number;
  lng: number;
  date: Date;
  accuracy: number;
  id: string;
}> {
  const points = [];

  for (let i = 0; i < count; i++) {
    // Generate migration path from Arctic to Antarctic
    const progress = i / count;
    const baseLat = 80 - progress * 150; // 80° to -70°
    const baseLng = -50 + Math.sin(progress * Math.PI * 3) * 30; // Curved path

    // Add some randomness
    const lat = baseLat + (Math.random() - 0.5) * 10;
    const lng = baseLng + (Math.random() - 0.5) * 20;

    // Generate date across migration season
    const startDate = new Date('2024-06-01');
    const endDate = new Date('2024-09-30');
    const dateProgress = progress;
    const date = new Date(
      startDate.getTime() +
        dateProgress * (endDate.getTime() - startDate.getTime()),
    );

    points.push({
      lat: Math.max(-90, Math.min(90, lat)),
      lng: Math.max(-180, Math.min(180, lng)),
      date,
      accuracy: Math.random() * 1000 + 100, // 100-1100m
      id: `mock-point-${i}`,
    });
  }

  return points;
}

/**
 * Spatial decimation algorithm - reduces points while preserving geographic distribution
 */
function decimatePointsSpatial(
  points: MigrationDataPoint[],
  targetCount: number,
): MigrationDataPoint[] {
  if (points.length <= targetCount) return points;

  // Calculate spatial bounds
  const bounds = {
    minLat: Math.min(...points.map((p) => p.latitude)),
    maxLat: Math.max(...points.map((p) => p.latitude)),
    minLng: Math.min(...points.map((p) => p.longitude)),
    maxLng: Math.max(...points.map((p) => p.longitude)),
  };

  // Create grid for spatial sampling
  const gridSize = Math.ceil(Math.sqrt(targetCount));
  const latStep = (bounds.maxLat - bounds.minLat) / gridSize;
  const lngStep = (bounds.maxLng - bounds.minLng) / gridSize;

  const grid: { [key: string]: MigrationDataPoint[] } = {};

  // Distribute points into grid cells
  for (const point of points) {
    const latIndex = Math.floor((point.latitude - bounds.minLat) / latStep);
    const lngIndex = Math.floor((point.longitude - bounds.minLng) / lngStep);
    const cellKey = `${Math.max(0, Math.min(gridSize - 1, latIndex))},${Math.max(0, Math.min(gridSize - 1, lngIndex))}`;

    if (!grid[cellKey]) grid[cellKey] = [];
    grid[cellKey].push(point);
  }

  // Select representative points from each cell
  const decimatedPoints: MigrationDataPoint[] = [];
  const pointsPerCell = Math.max(
    1,
    Math.floor(targetCount / Object.keys(grid).length),
  );

  for (const cellPoints of Object.values(grid)) {
    if (cellPoints.length === 0) continue;

    // Sort by accuracy (better accuracy = lower uncertainty)
    cellPoints.sort((a, b) => a.accuracy - b.accuracy);

    // Take the best points from this cell
    const pointsToTake = Math.min(pointsPerCell, cellPoints.length);
    for (
      let i = 0;
      i < pointsToTake && decimatedPoints.length < targetCount;
      i++
    ) {
      decimatedPoints.push(cellPoints[i]);
    }
  }

  // If we need more points, add the best remaining points
  if (decimatedPoints.length < targetCount) {
    const usedIds = new Set(decimatedPoints.map((p) => p.id));
    const remainingPoints = points
      .filter((p) => !usedIds.has(p.id))
      .sort((a, b) => a.accuracy - b.accuracy);

    for (
      let i = 0;
      i < remainingPoints.length && decimatedPoints.length < targetCount;
      i++
    ) {
      decimatedPoints.push(remainingPoints[i]);
    }
  }

  return decimatedPoints;
}

/**
 * Random decimation algorithm - simple random sampling
 */
function decimatePointsRandom(
  points: MigrationDataPoint[],
  targetCount: number,
): MigrationDataPoint[] {
  if (points.length <= targetCount) return points;

  const shuffled = [...points].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, targetCount);
}

/**
 * Temporal decimation algorithm - preserves time distribution
 */
function decimatePointsTemporal(
  points: MigrationDataPoint[],
  targetCount: number,
): MigrationDataPoint[] {
  if (points.length <= targetCount) return points;

  // Sort by date
  const sorted = [...points].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // Calculate step size for even temporal distribution
  const step = sorted.length / targetCount;
  const decimatedPoints: MigrationDataPoint[] = [];

  for (let i = 0; i < targetCount; i++) {
    const index = Math.floor(i * step);
    if (index < sorted.length) {
      decimatedPoints.push(sorted[index]);
    }
  }

  return decimatedPoints;
}

/**
 * Handle worker errors
 */
self.addEventListener('error', (event: ErrorEvent) => {
  logger.error('❌ [WORKER STUB] Worker error:', event.error);

  const errorMessage: WorkerMessage = {
    type: 'error',
    error: `Worker error: ${event.message || 'Unknown error'}`,
  };

  self.postMessage(errorMessage);
});

/**
 * Handle unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  logger.error('❌ [WORKER STUB] Unhandled promise rejection:', event.reason);

  const errorMessage: WorkerMessage = {
    type: 'error',
    error: `Unhandled rejection: ${event.reason || 'Unknown error'}`,
  };

  self.postMessage(errorMessage);
});

// Export for TypeScript (helps with type checking in main thread)
export {};
