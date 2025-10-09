/**
 * Data Loading Service Tests
 *
 * Tests for the progressive data loading service with caching,
 * rate limiting, and Web Worker integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DataLoadingService } from './data-loading.service';
import { GbifAdapterService } from './gbif-adapter.service';
import { LoggerService } from '@/core/services/logger.service';
import type { DataLoadingRequest, LoadingStage } from './data-loading.service';
import type { GbifSearchResponse } from './gbif-adapter.service';
import type { SpeciesInfo, DateRange } from '../models/ui.models';

// Mock the entire migration config to avoid environment import issues
vi.mock('../config/migration.config', () => ({
  GBIF_CONFIG: {
    API_URL: 'https://api.gbif.org/v1',
    DEFAULT_LIMIT: 1000,
    MAX_LIMIT: 20000,
    REQUEST_TIMEOUT: 30000,
    MAX_RETRIES: 3,
  },
  CACHE_CONFIG: {
    TTL: 7 * 24 * 60 * 60 * 1000,
    VERSION: 1,
    MAX_ENTRIES: 100,
    MAX_SIZE: 50 * 1024 * 1024,
    CLEANUP_INTERVAL: 1000 * 60 * 60,
  },
  RATE_LIMIT_CONFIG: {
    WINDOW: 60000,
    MAX_REQUESTS: 100,
    MIN_INTERVAL: 200,
    REQUESTS_PER_MINUTE: 300,
    REQUESTS_PER_HOUR: 10000,
    RETRY_AFTER: 200,
    MAX_RETRIES: 3,
  },
  PERFORMANCE_CONFIG: {
    WORKER_POOL_SIZE: 4,
    BATCH_SIZE: 1000,
    MAX_CONCURRENT: 5,
    DEBOUNCE_DELAY: 300,
  },
  DATA_QUALITY_CONFIG: {
    MIN_COORDINATE_ACCURACY: 10000,
    MAX_COORDINATE_UNCERTAINTY: 50000,
    MIN_DATA_POINTS: 50,
    EXCELLENT_THRESHOLD: 0.8,
    GOOD_THRESHOLD: 0.6,
  },
  FEATURE_FLAGS: {
    ENABLE_WEB_WORKER: false, // Disable workers in tests
    ENABLE_CACHE: true,
    ENABLE_RATE_LIMITING: true,
    ENABLE_SENSITIVE_SPECIES_PROTECTION: true,
    ENABLE_PERFORMANCE_MONITORING: true,
    ENABLE_DEBUG_LOGGING: false,
  },
  MIGRATION_CONFIG: {
    gbif: {
      API_URL: 'https://api.gbif.org/v1',
      DEFAULT_LIMIT: 1000,
      MAX_LIMIT: 20000,
      REQUEST_TIMEOUT: 30000,
      MAX_RETRIES: 3,
    },
    cache: {
      TTL: 7 * 24 * 60 * 60 * 1000,
      VERSION: 1,
      MAX_ENTRIES: 100,
      MAX_SIZE: 50 * 1024 * 1024,
      CLEANUP_INTERVAL: 1000 * 60 * 60,
    },
    rateLimit: {
      WINDOW: 60000,
      MAX_REQUESTS: 100,
      MIN_INTERVAL: 200,
      REQUESTS_PER_MINUTE: 300,
      REQUESTS_PER_HOUR: 10000,
      RETRY_AFTER: 200,
      MAX_RETRIES: 3,
    },
    performance: {
      WORKER_POOL_SIZE: 4,
      BATCH_SIZE: 1000,
      MAX_CONCURRENT: 5,
      DEBOUNCE_DELAY: 300,
    },
    dataQuality: {
      MIN_COORDINATE_ACCURACY: 10000,
      MAX_COORDINATE_UNCERTAINTY: 50000,
      MIN_DATA_POINTS: 50,
      EXCELLENT_THRESHOLD: 0.8,
      GOOD_THRESHOLD: 0.6,
    },
    features: {
      ENABLE_WEB_WORKER: false, // Disable workers in tests
      ENABLE_CACHE: true,
      ENABLE_RATE_LIMITING: true,
      ENABLE_SENSITIVE_SPECIES_PROTECTION: true,
      ENABLE_PERFORMANCE_MONITORING: true,
      ENABLE_DEBUG_LOGGING: false,
    },
  },
}));

describe('DataLoadingService', () => {
  let service: DataLoadingService;
  let mockGbifAdapter: {
    fetchOccurrences: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Test data factories
  const createMockSpecies = (): SpeciesInfo => ({
    gbifKey: '212',
    commonName: 'Arctic Tern',
    scientificName: 'Sterna paradisaea',
    imageUrl: '',
    description: 'Test species',
  });

  const createMockDateRange = (): DateRange => ({
    start: new Date('2023-01-01'),
    end: new Date('2023-12-31'),
  });

  const createMockGbifResponse = (count: number = 10): GbifSearchResponse => ({
    offset: 0,
    limit: 1000,
    endOfRecords: true,
    count: count,
    results: Array.from({ length: count }, (_, i) => ({
      key: i + 1,
      scientificName: 'Sterna paradisaea',
      decimalLatitude: 45.0 + i * 0.1,
      decimalLongitude: -75.0 + i * 0.1,
      eventDate: `2023-0${(i % 12) + 1}-01`,
      countryCode: 'US',
      locality: `Location ${i}`,
      coordinateUncertaintyInMeters: 100,
      issues: [],
    })),
  });

  beforeEach(() => {
    // Create mock services
    mockGbifAdapter = {
      fetchOccurrences: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DataLoadingService,
        { provide: GbifAdapterService, useValue: mockGbifAdapter },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DataLoadingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.destroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default state', () => {
      expect(service.isLoading()).toBe(false);
      expect(service.currentProgress()).toBeNull();
      expect(service.loadingError()).toBeNull();
      expect(service.activeRequests()).toBe(0);
    });

    it('should initialize logger on construction', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DataLoadingService initialized'),
        'DataLoadingService',
      );
    });
  });

  describe('Load Migration Data', () => {
    it('should successfully load migration data', async () => {
      const mockResponse = createMockGbifResponse(10);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
        maxPoints: 1000,
      };

      const result = await service.loadMigrationData(request);

      expect(result).toBeDefined();
      expect(result.dataPoints.length).toBeGreaterThan(0);
      expect(result.metadata.totalSourceRecords).toBe(10);
      expect(mockGbifAdapter.fetchOccurrences).toHaveBeenCalled();
    });

    it('should set loading state during operation', async () => {
      const mockResponse = createMockGbifResponse(5);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const loadPromise = service.loadMigrationData(request);

      // Check loading state is true during operation
      expect(service.isLoading()).toBe(true);
      expect(service.activeRequests()).toBe(1);

      await loadPromise;

      // Check loading state is false after completion
      expect(service.isLoading()).toBe(false);
      expect(service.activeRequests()).toBe(0);
    });

    it('should emit progress updates during loading', async () => {
      const mockResponse = createMockGbifResponse(10);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const progressUpdates: LoadingStage[] = [];

      service.progress$.subscribe((progress) => {
        progressUpdates.push(progress.stage);
      });

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      await service.loadMigrationData(request);

      // Should have received multiple progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates).toContain('initialization');
      expect(progressUpdates).toContain('fetching-data');
      expect(progressUpdates).toContain('completed');
    });

    it('should handle loading errors', async () => {
      const error = new Error('GBIF API error');
      mockGbifAdapter.fetchOccurrences.mockRejectedValue(error);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      await expect(service.loadMigrationData(request)).rejects.toThrow(
        'GBIF API error',
      );

      expect(service.isLoading()).toBe(false);
      expect(service.loadingError()).toBe('GBIF API error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should filter out invalid coordinates', async () => {
      const mockResponse: GbifSearchResponse = {
        offset: 0,
        limit: 1000,
        endOfRecords: true,
        count: 3,
        results: [
          {
            key: 1,
            scientificName: 'Test Species',
            decimalLatitude: 45.0,
            decimalLongitude: -75.0,
            eventDate: '2023-01-01',
            countryCode: 'US',
          },
          {
            key: 2,
            scientificName: 'Test Species',
            decimalLatitude: 0, // Null Island - should be filtered
            decimalLongitude: 0,
            eventDate: '2023-01-02',
            countryCode: 'US',
          },
          {
            key: 3,
            scientificName: 'Test Species',
            decimalLatitude: 200, // Invalid latitude - should be filtered
            decimalLongitude: -75.0,
            eventDate: '2023-01-03',
            countryCode: 'US',
          },
        ],
      };

      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const result = await service.loadMigrationData(request);

      // Should only include the valid coordinate
      expect(result.dataPoints.length).toBe(1);
      expect(result.dataPoints[0].latitude).toBe(45.0);
    });

    it('should apply coordinate bounds filter', async () => {
      const mockResponse = createMockGbifResponse(10);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
        coordinateBounds: {
          minLat: 45.0,
          maxLat: 45.5,
          minLng: -75.5,
          maxLng: -75.0,
        },
      };

      const result = await service.loadMigrationData(request);

      // All data points should be within bounds
      result.dataPoints.forEach((point) => {
        expect(point.latitude).toBeGreaterThanOrEqual(45.0);
        expect(point.latitude).toBeLessThanOrEqual(45.5);
      });
    });

    it('should calculate data quality metrics', async () => {
      const mockResponse = createMockGbifResponse(100);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const result = await service.loadMigrationData(request);

      expect(result.metadata.dataQuality).toMatch(/^(excellent|good|fair)$/);
      expect(result.metadata.coverage).toBeGreaterThanOrEqual(0);
      expect(result.metadata.coverage).toBeLessThanOrEqual(100);
      expect(result.metadata.loadingTimeMs).toBeGreaterThan(0);
    });

    it('should track processing stages with timings', async () => {
      const mockResponse = createMockGbifResponse(10);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const result = await service.loadMigrationData(request);

      expect(result.metadata.processingStages.length).toBeGreaterThan(0);

      result.metadata.processingStages.forEach((stage) => {
        expect(stage.stage).toBeDefined();
        expect(stage.duration).toBeGreaterThanOrEqual(0);
        expect(stage.itemsProcessed).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Cancel Loading', () => {
    it('should cancel ongoing loading operation', async () => {
      const mockResponse = createMockGbifResponse(100);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const loadPromise = service.loadMigrationData(request);

      // Cancel while loading
      service.cancelLoading();

      expect(service.isLoading()).toBe(false);
      expect(service.currentProgress()).toBeNull();
      expect(service.activeRequests()).toBe(0);

      // Wait for promise to resolve/reject
      await loadPromise.catch(() => {
        // Expect cancellation
      });
    });
  });

  describe('Multiple Concurrent Requests', () => {
    it('should track multiple active requests', async () => {
      const mockResponse = createMockGbifResponse(5);
      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const promise1 = service.loadMigrationData(request);
      const promise2 = service.loadMigrationData(request);

      // Should track 2 active requests
      expect(service.activeRequests()).toBeGreaterThanOrEqual(1);

      await Promise.all([promise1, promise2]);

      // All requests should be complete
      expect(service.activeRequests()).toBe(0);
    });
  });

  describe('Data Validation', () => {
    it('should reject occurrences with missing coordinates', async () => {
      const mockResponse: GbifSearchResponse = {
        offset: 0,
        limit: 1000,
        endOfRecords: true,
        count: 2,
        results: [
          {
            key: 1,
            scientificName: 'Test Species',
            decimalLatitude: 45.0,
            decimalLongitude: -75.0,
            eventDate: '2023-01-01',
            countryCode: 'US',
          },
          {
            key: 2,
            scientificName: 'Test Species',
            decimalLatitude: null as unknown as number, // Missing latitude
            decimalLongitude: -75.0,
            eventDate: '2023-01-02',
            countryCode: 'US',
          },
        ],
      };

      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const result = await service.loadMigrationData(request);

      // Should only include valid occurrence
      expect(result.dataPoints.length).toBe(1);
      expect(result.dataPoints[0].latitude).toBe(45.0);
    });

    it('should reject occurrences with invalid dates', async () => {
      const mockResponse: GbifSearchResponse = {
        offset: 0,
        limit: 1000,
        endOfRecords: true,
        count: 2,
        results: [
          {
            key: 1,
            scientificName: 'Test Species',
            decimalLatitude: 45.0,
            decimalLongitude: -75.0,
            eventDate: '2023-01-01',
            countryCode: 'US',
          },
          {
            key: 2,
            scientificName: 'Test Species',
            decimalLatitude: 45.0,
            decimalLongitude: -75.0,
            eventDate: 'invalid-date',
            countryCode: 'US',
          },
        ],
      };

      mockGbifAdapter.fetchOccurrences.mockResolvedValue(mockResponse);

      const request: DataLoadingRequest = {
        species: createMockSpecies(),
        dateRange: createMockDateRange(),
      };

      const result = await service.loadMigrationData(request);

      // Should only include valid occurrence
      expect(result.dataPoints.length).toBe(1);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      service.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Destroying DataLoadingService'),
      );
    });
  });
});
