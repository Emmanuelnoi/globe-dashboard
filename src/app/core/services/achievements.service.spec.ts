import { TestBed } from '@angular/core/testing';
import { AchievementsService } from './achievements.service';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { CountryDiscoveryService } from './country-discovery.service';
import { LoggerService } from './logger.service';

describe('AchievementsService', () => {
  let service: AchievementsService;

  beforeEach(() => {
    const supabaseSpy = jasmine.createSpyObj('SupabaseService', [
      'isUserAuthenticated',
      'getCurrentUserId',
    ]);
    const userStatsSpy = jasmine.createSpyObj('UserStatsService', [], {
      totalGames: jasmine.createSpy().and.returnValue(0),
      bestStreak: jasmine.createSpy().and.returnValue(0),
      stats: jasmine.createSpy().and.returnValue(null),
    });
    const discoverySpy = jasmine.createSpyObj('CountryDiscoveryService', [], {
      totalDiscovered: jasmine.createSpy().and.returnValue(0),
    });
    const loggerSpy = jasmine.createSpyObj('LoggerService', [
      'debug',
      'error',
      'success',
      'warn',
    ]);

    TestBed.configureTestingModule({
      providers: [
        AchievementsService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: UserStatsService, useValue: userStatsSpy },
        { provide: CountryDiscoveryService, useValue: discoverySpy },
        { provide: LoggerService, useValue: loggerSpy },
      ],
    });

    service = TestBed.inject(AchievementsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with predefined achievements', (done) => {
    setTimeout(() => {
      expect(service.totalAchievements()).toBeGreaterThan(0);
      expect(service.unlockedCount()).toBe(0);
      done();
    }, 200);
  });
});
