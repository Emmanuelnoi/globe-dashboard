import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { CountryDiscoveryService } from './country-discovery.service';
import { SupabaseService } from './supabase.service';
import { LoggerService } from './logger.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CountryDiscoveryService', () => {
  let service: CountryDiscoveryService;
  let supabaseService: any;
  let loggerService: any;

  beforeEach(async () => {
    // Clear all IndexedDB databases before each test
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map((db) => {
        if (db.name) {
          return new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(db.name!);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => setTimeout(() => resolve(), 50);
          });
        }
        return Promise.resolve();
      }),
    );

    const supabaseSpy = {
      isUserAuthenticated: vi.fn(),
      getCurrentUserId: vi.fn(),
    };
    const loggerSpy = {
      debug: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CountryDiscoveryService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: LoggerService, useValue: loggerSpy },
      ],
    });

    service = TestBed.inject(CountryDiscoveryService);
    supabaseService = TestBed.inject(SupabaseService);
    loggerService = TestBed.inject(LoggerService);

    // Wait for service initialization
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with zero discoveries', async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(service.totalDiscovered()).toBe(0);
    expect(service.percentageExplored()).toBe(0);
  });

  it('should track a new discovery', async () => {
    await service.trackDiscovery('US', 'United States', 'click');

    // Wait for IndexedDB write to complete
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(service.totalDiscovered()).toBe(1);
    expect(service.percentageExplored()).toBeGreaterThan(0);
  });

  afterEach(async () => {
    // Clean up IndexedDB
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map((db) => {
        if (db.name) {
          return new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(db.name!);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => setTimeout(() => resolve(), 50);
          });
        }
        return Promise.resolve();
      }),
    );
    TestBed.resetTestingModule();
  });
});
