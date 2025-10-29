import { TestBed } from '@angular/core/testing';
import { CountryDiscoveryService } from './country-discovery.service';
import { SupabaseService } from './supabase.service';
import { LoggerService } from './logger.service';

describe('CountryDiscoveryService', () => {
  let service: CountryDiscoveryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let loggerService: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    const supabaseSpy = jasmine.createSpyObj('SupabaseService', [
      'isUserAuthenticated',
      'getCurrentUserId',
    ]);
    const loggerSpy = jasmine.createSpyObj('LoggerService', [
      'debug',
      'error',
      'success',
      'warn',
    ]);

    TestBed.configureTestingModule({
      providers: [
        CountryDiscoveryService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: LoggerService, useValue: loggerSpy },
      ],
    });

    service = TestBed.inject(CountryDiscoveryService);
    supabaseService = TestBed.inject(
      SupabaseService,
    ) as jasmine.SpyObj<SupabaseService>;
    loggerService = TestBed.inject(
      LoggerService,
    ) as jasmine.SpyObj<LoggerService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with zero discoveries', (done) => {
    setTimeout(() => {
      expect(service.totalDiscovered()).toBe(0);
      expect(service.percentageExplored()).toBe(0);
      done();
    }, 100);
  });

  it('should track a new discovery', async () => {
    await service.trackDiscovery('US', 'United States', 'click');

    setTimeout(() => {
      expect(service.totalDiscovered()).toBe(1);
      expect(service.percentageExplored()).toBeGreaterThan(0);
    }, 100);
  });
});
