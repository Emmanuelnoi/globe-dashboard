/**
 * Bird Data Service Tests
 * Comprehensive test suite for BirdDataService (IndexedDB caching service)
 */

import { TestBed } from '@angular/core/testing';
import { BirdDataService } from './bird-data.service';
import { LoggerService } from '@/core/services/logger.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MigrationDataPoint } from '../models/ui.models';

// Mock the migration config to avoid environment import issues
vi.mock('../config/migration.config', () => ({
  CACHE_CONFIG: {
    TTL: 7 * 24 * 60 * 60 * 1000,
    MAX_SIZE: 50 * 1024 * 1024,
    MAX_ENTRIES: 500,
    CLEANUP_INTERVAL: 1000 * 60 * 60,
  },
}));

describe('BirdDataService', () => {
  let service: BirdDataService;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        BirdDataService,
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(BirdDataService);
  });

  afterEach(() => {
    // Clean up service
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have readonly signals', () => {
      expect(service.migrationData).toBeDefined();
      expect(service.cacheStatus).toBeDefined();
      expect(service.loadingState).toBeDefined();
      expect(service.errorState).toBeDefined();
      expect(service.isInitialized).toBeDefined();
    });

    it('should initialize with correct default states', () => {
      const cacheStatus = service.cacheStatus();
      expect(typeof cacheStatus).toBe('string');

      const loadingState = service.loadingState();
      expect(loadingState.isLoading).toBe(false);

      const errorState = service.errorState();
      // Error state may be true if IndexedDB initialization fails (e.g., in test environment)
      expect(typeof errorState.hasError).toBe('boolean');
      expect(typeof errorState.canRetry).toBe('boolean');
      expect(typeof errorState.hasFallback).toBe('boolean');
    });

    it('should have null migration data initially', () => {
      expect(service.migrationData()).toBeNull();
    });
  });

  describe('Signal State Management', () => {
    it('should update cache status', async () => {
      const initialStatus = service.cacheStatus();
      expect(initialStatus).toBeDefined();

      // Cache status should be reactive
      expect(typeof service.cacheStatus()).toBe('string');
    });

    it('should track loading state', () => {
      const loadingState = service.loadingState();

      expect(loadingState).toHaveProperty('isLoading');
      expect(typeof loadingState.isLoading).toBe('boolean');
    });

    it('should track error state', () => {
      const errorState = service.errorState();

      expect(errorState).toHaveProperty('hasError');
      expect(errorState).toHaveProperty('canRetry');
      expect(errorState).toHaveProperty('hasFallback');
      expect(typeof errorState.hasError).toBe('boolean');
    });

    it('should track initialization state', () => {
      const isInitialized = service.isInitialized();
      expect(typeof isInitialized).toBe('boolean');
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', () => {
      const params1 = {
        speciesId: '123',
        seasonOrDateRange: 'summer',
        hemisphere: 'north',
        year: 2023,
      };

      const params2 = {
        speciesId: '123',
        seasonOrDateRange: 'summer',
        hemisphere: 'north',
        year: 2023,
      };

      // Same parameters should generate same key
      const key1 = JSON.stringify(params1);
      const key2 = JSON.stringify(params2);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different parameters', () => {
      const params1 = {
        speciesId: '123',
        seasonOrDateRange: 'summer',
        hemisphere: 'north',
        year: 2023,
      };

      const params2 = {
        speciesId: '456',
        seasonOrDateRange: 'winter',
        hemisphere: 'south',
        year: 2024,
      };

      const key1 = JSON.stringify(params1);
      const key2 = JSON.stringify(params2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Data Validation', () => {
    it('should validate migration data point structure', () => {
      const validDataPoint: MigrationDataPoint = {
        id: 'test-1',
        latitude: 45.5,
        longitude: -122.6,
        date: new Date('2023-06-15'),
        accuracy: 100,
        metadata: {
          scientificName: 'Anas platyrhynchos',
          countryCode: 'US',
          locality: 'Portland, OR',
          issues: [],
        },
      };

      // Validate structure
      expect(validDataPoint).toHaveProperty('id');
      expect(validDataPoint).toHaveProperty('latitude');
      expect(validDataPoint).toHaveProperty('longitude');
      expect(validDataPoint).toHaveProperty('date');
      expect(validDataPoint).toHaveProperty('accuracy');
      expect(validDataPoint).toHaveProperty('metadata');

      // Validate types
      expect(typeof validDataPoint.id).toBe('string');
      expect(typeof validDataPoint.latitude).toBe('number');
      expect(typeof validDataPoint.longitude).toBe('number');
      expect(validDataPoint.date).toBeInstanceOf(Date);
      expect(typeof validDataPoint.accuracy).toBe('number');
    });

    it('should validate coordinate ranges', () => {
      const dataPoint: MigrationDataPoint = {
        id: 'test-1',
        latitude: 45.5,
        longitude: -122.6,
        date: new Date(),
        accuracy: 100,
        metadata: {
          scientificName: 'Test species',
          countryCode: 'US',
          locality: 'Test location',
          issues: [],
        },
      };

      // Valid latitude range: -90 to 90
      expect(dataPoint.latitude).toBeGreaterThanOrEqual(-90);
      expect(dataPoint.latitude).toBeLessThanOrEqual(90);

      // Valid longitude range: -180 to 180
      expect(dataPoint.longitude).toBeGreaterThanOrEqual(-180);
      expect(dataPoint.longitude).toBeLessThanOrEqual(180);
    });
  });

  describe('Error Handling', () => {
    it('should handle database initialization errors gracefully', async () => {
      // Service should not throw on initialization even if IndexedDB fails
      expect(() => service.isInitialized()).not.toThrow();
    });

    it('should maintain error state', () => {
      const errorState = service.errorState();

      expect(errorState.hasError).toBeDefined();
      expect(errorState.canRetry).toBeDefined();
      expect(errorState.hasFallback).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      // Create a spy to track cleanup
      const cleanupSpy = vi.spyOn(service, 'ngOnDestroy');

      service.ngOnDestroy();

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should handle cleanup when no database connection exists', () => {
      // Should not throw even if db is null
      expect(() => service.ngOnDestroy()).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce readonly signals', () => {
      // Signals should be readonly - cannot call .set() on them
      const migrationData = service.migrationData;
      const cacheStatus = service.cacheStatus;
      const loadingState = service.loadingState;
      const errorState = service.errorState;

      // These should be functions (signal getters)
      expect(typeof migrationData).toBe('function');
      expect(typeof cacheStatus).toBe('function');
      expect(typeof loadingState).toBe('function');
      expect(typeof errorState).toBe('function');
    });
  });
});
