import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { CountryDiscoveryService } from './country-discovery.service';
import { SupabaseService } from './supabase.service';
import { LoggerService } from './logger.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockProvider } from 'ng-mocks';

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 2000,
  intervalMs = 50,
): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};

describe('CountryDiscoveryService', () => {
  let service: CountryDiscoveryService;
  let supabaseService: any;
  let loggerService: any;

  beforeEach(async () => {
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
        MockProvider(SupabaseService, supabaseSpy),
        MockProvider(LoggerService, loggerSpy),
      ],
    });

    service = TestBed.inject(CountryDiscoveryService);
    supabaseService = TestBed.inject(SupabaseService);
    loggerService = TestBed.inject(LoggerService);

    await waitFor(() => !service.isLoading());
    await service.clearAllDiscoveries();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with zero discoveries', async () => {
    expect(service.totalDiscovered()).toBe(0);
    expect(service.percentageExplored()).toBe(0);
  });

  it('should track a new discovery', async () => {
    await service.trackDiscovery('US', 'United States', 'click');

    await waitFor(() => service.totalDiscovered() === 1);
    expect(service.totalDiscovered()).toBe(1);
    expect(service.percentageExplored()).toBeGreaterThan(0);
  });

  afterEach(async () => {
    await service.clearAllDiscoveries();
    TestBed.resetTestingModule();
  });
});
