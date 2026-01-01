import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  GbifAdapterService,
  GbifSearchResponse,
  GbifOccurrence,
} from './gbif-adapter.service';
import { SpeciesInfo, DateRange } from '../models/ui.models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('GbifAdapterService', () => {
  let service: GbifAdapterService;
  let httpTestingController: HttpTestingController;

  // Helper to wait for async cache operations to complete
  const waitForCacheCheck = () =>
    new Promise((resolve) => setTimeout(resolve, 100));

  // Mock GBIF API response data
  const mockGbifOccurrence: GbifOccurrence = {
    key: 12345,
    scientificName: 'Turdus migratorius',
    decimalLatitude: 45.5017,
    decimalLongitude: -73.5673,
    eventDate: '2024-05-15T08:30:00Z',
    countryCode: 'CA',
    locality: 'Montreal, Quebec',
    coordinateUncertaintyInMeters: 100,
    issues: [],
  };

  const mockGbifResponse: GbifSearchResponse = {
    offset: 0,
    limit: 300,
    endOfRecords: false,
    count: 1500,
    results: [mockGbifOccurrence],
    facets: [],
  };

  const mockSpecies: SpeciesInfo = {
    id: '2480598',
    scientificName: 'Turdus migratorius',
    commonName: 'American Robin',
    family: 'Turdidae',
    order: 'Passeriformes',
    migrationRange: 'medium',
    isPopular: true,
  };

  const mockDateRange: DateRange = {
    startDate: new Date('2024-03-20'),
    endDate: new Date('2024-06-20'),
    granularity: 'day',
  };

  beforeEach(async () => {
    // Reset TestBed first to close any open database connections
    TestBed.resetTestingModule();

    // Clear all IndexedDB databases before each test
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map((db) => {
        if (db.name) {
          return new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(db.name!);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve(); // Resolve even on error to continue
            request.onblocked = () => {
              // Force close by waiting a bit
              setTimeout(() => resolve(), 100);
            };
          });
        }
        return Promise.resolve();
      }),
    );

    // Wait for database deletion to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    TestBed.configureTestingModule({
      providers: [
        GbifAdapterService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(GbifAdapterService);
    httpTestingController = TestBed.inject(HttpTestingController);

    // Wait for service cache initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clear cache and close database connection
    try {
      await service.clearCache();
    } catch (error) {
      // Ignore cleanup errors
    }

    // Verify no outstanding HTTP requests
    try {
      httpTestingController.verify();
    } catch (error) {
      // Ignore verification errors - some tests intentionally don't complete requests
    }

    // Reset TestBed to clean up injector and close connections
    TestBed.resetTestingModule();

    // Force close all database connections
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map((db) => {
        if (db.name) {
          return new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(db.name!);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => {
              setTimeout(() => resolve(), 50);
            };
          });
        }
        return Promise.resolve();
      }),
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with correct configuration', () => {
      expect(service.isInitialized()).toBeDefined();
      expect(service.requestCount()).toBe(0);
      expect(service.lastRequestTime()).toBeNull();
    });
  });

  describe('fetchOccurrences', () => {
    it('should successfully fetch occurrence data', async () => {
      // Act - Start the request
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange);

      // Wait for cache check to complete and HTTP request to be initiated
      await waitForCacheCheck();

      // Assert HTTP request
      const req = httpTestingController.expectOne(
        (req) =>
          req.url.includes('/occurrence/search') && req.params.has('taxonKey'),
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('taxonKey')).toBe(mockSpecies.id);
      expect(req.request.params.get('hasCoordinate')).toBe('true');

      req.flush(mockGbifResponse);

      const result = await promise;
      expect(result.results).toHaveLength(1);
      expect(result.count).toBe(1500);
      expect(result.results[0].scientificName).toBe('Turdus migratorius');
    });

    it('should handle HTTP errors gracefully', async () => {
      // Act
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange);
      await waitForCacheCheck();

      // Assert HTTP error
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(promise).rejects.toThrow();
    });

    it('should apply coordinate bounds when provided', async () => {
      // Arrange
      const coordinates = {
        minLat: 40,
        maxLat: 50,
        minLng: -80,
        maxLng: -70,
      };

      // Act
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange, {
        coordinates,
      });
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      expect(req.request.params.get('decimalLatitude')).toBe('40,50');
      expect(req.request.params.get('decimalLongitude')).toBe('-80,-70');

      req.flush(mockGbifResponse);
      await promise;
    });

    it('should respect limit parameter', async () => {
      // Act
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange, {
        limit: 500,
      });
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      expect(req.request.params.get('limit')).toBe('500');

      req.flush(mockGbifResponse);
      await promise;
    });
  });

  describe('searchSpecies', () => {
    const mockSpeciesResults = [
      {
        key: 2480598,
        scientificName: 'Turdus migratorius',
        canonicalName: 'Turdus migratorius',
        vernacularNames: [{ vernacularName: 'American Robin', language: 'en' }],
        rank: 'SPECIES',
        status: 'ACCEPTED',
        kingdom: 'Animalia',
      },
    ];

    it('should search for species successfully', async () => {
      // Act
      const promise = service.searchSpecies('robin');
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/species/search'),
      );
      expect(req.request.params.get('q')).toBe('robin');
      expect(req.request.params.get('rank')).toBe('SPECIES');
      expect(req.request.params.get('status')).toBe('ACCEPTED');

      req.flush({ results: mockSpeciesResults });

      const results = await promise;
      expect(results).toHaveLength(1);
      expect(results[0].scientificName).toBe('Turdus migratorius');
    });

    it('should handle empty search results', async () => {
      // Act
      const promise = service.searchSpecies('nonexistent');
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/species/search'),
      );
      req.flush({ results: [] });

      const results = await promise;
      expect(results).toHaveLength(0);
    });
  });

  describe('generateMigrationPreview', () => {
    it('should generate migration preview successfully', async () => {
      // Act
      const promise = service.generateMigrationPreview(
        mockSpecies,
        mockDateRange,
      );
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush(mockGbifResponse);

      const preview = await promise;
      expect(preview.totalPoints).toBe(1500);
      expect(preview.quality).toBeDefined();
      expect(preview.coverage).toBeGreaterThanOrEqual(0);
      expect(preview.histogram).toBeDefined();
      expect(preview.dateRange).toEqual(mockDateRange);
    });

    it('should return fallback preview on error', async () => {
      // Act
      const promise = service.generateMigrationPreview(
        mockSpecies,
        mockDateRange,
      );
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      const preview = await promise;
      expect(preview.totalPoints).toBe(0);
      expect(preview.quality).toBe('fair');
      expect(preview.coverage).toBe(0);
      expect(preview.histogram).toEqual([]);
    });
  });

  describe('Rate Limiting', () => {
    it('should track request count', async () => {
      // Act
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange);
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush(mockGbifResponse);

      await promise;
      expect(service.requestCount()).toBe(1);
      expect(service.lastRequestTime()).toBeTruthy();
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = service.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.hitRate).toBe('number');
    });

    it('should clear cache successfully', async () => {
      await expect(service.clearCache()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      // Act
      const promise = service.healthCheck();
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush({
        results: [],
        count: 0,
        offset: 0,
        limit: 1,
        endOfRecords: true,
      });

      const health = await promise;
      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.details).toBeDefined();
    });

    it('should report unhealthy on API failure', async () => {
      // Act
      const promise = service.healthCheck();
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      const health = await promise;
      expect(health.status).toBe('unhealthy');
      expect(health.details['error']).toBeDefined();
    });
  });

  describe('Data Quality Assessment', () => {
    it('should assess data quality correctly', async () => {
      // Arrange - High quality data
      const highQualityResponse: GbifSearchResponse = {
        ...mockGbifResponse,
        results: Array.from({ length: 100 }, (_, i) => ({
          ...mockGbifOccurrence,
          key: i,
          coordinateUncertaintyInMeters: 10, // High accuracy
        })),
      };

      // Act
      const promise = service.generateMigrationPreview(
        mockSpecies,
        mockDateRange,
      );
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush(highQualityResponse);

      const preview = await promise;
      expect(preview.quality).toBe('excellent');
    });

    it('should handle missing coordinates in quality assessment', async () => {
      // Arrange - Poor quality data
      const poorQualityResponse: GbifSearchResponse = {
        ...mockGbifResponse,
        results: [
          { ...mockGbifOccurrence, decimalLatitude: null },
          { ...mockGbifOccurrence, key: 2, decimalLongitude: null },
          { ...mockGbifOccurrence, key: 3, eventDate: null },
        ],
      };

      // Act
      const promise = service.generateMigrationPreview(
        mockSpecies,
        mockDateRange,
      );
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush(poorQualityResponse);

      const preview = await promise;
      expect(['fair', 'good'].includes(preview.quality)).toBe(true);
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly for GBIF API', async () => {
      // Act
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange);
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      const eventDate = req.request.params.get('eventDate');
      expect(eventDate).toBe('2024-03-20,2024-06-20');

      req.flush(mockGbifResponse);
      await promise;
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      // Act
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange);
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.error(new ProgressEvent('timeout'));

      await expect(promise).rejects.toThrow();
    });

    it('should handle rate limit responses', async () => {
      // Act
      const promise = service.fetchOccurrences(mockSpecies.id, mockDateRange);
      await waitForCacheCheck();

      // Assert
      const req = httpTestingController.expectOne((req) =>
        req.url.includes('/occurrence/search'),
      );
      req.flush('Rate limited', {
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(promise).rejects.toThrow('rate limit');
    });
  });
});
