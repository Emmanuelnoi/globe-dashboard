import { TestBed } from '@angular/core/testing';
import { LeaderboardService } from './leaderboard.service';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { CountryDiscoveryService } from './country-discovery.service';
import { AchievementsService } from './achievements.service';
import { LoggerService } from './logger.service';
import { signal } from '@angular/core';

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    const supabaseSpy = jasmine.createSpyObj(
      'SupabaseService',
      ['isUserAuthenticated', 'getCurrentUserId'],
      {
        isAuthenticated: signal(false),
      },
    );
    const userStatsSpy = jasmine.createSpyObj('UserStatsService', [], {
      stats: jasmine.createSpy().and.returnValue(null),
    });
    const discoverySpy = jasmine.createSpyObj('CountryDiscoveryService', [], {
      totalDiscovered: jasmine.createSpy().and.returnValue(0),
    });
    const achievementsSpy = jasmine.createSpyObj('AchievementsService', [], {
      unlockedCount: jasmine.createSpy().and.returnValue(0),
    });
    const loggerSpy = jasmine.createSpyObj('LoggerService', [
      'debug',
      'error',
      'success',
      'warn',
    ]);

    TestBed.configureTestingModule({
      providers: [
        LeaderboardService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: UserStatsService, useValue: userStatsSpy },
        { provide: CountryDiscoveryService, useValue: discoverySpy },
        { provide: AchievementsService, useValue: achievementsSpy },
        { provide: LoggerService, useValue: loggerSpy },
      ],
    });

    service = TestBed.inject(LeaderboardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have empty leaderboards initially', () => {
    expect(service.globalLeaderboard()).toEqual([]);
    expect(service.weeklyLeaderboard()).toEqual([]);
    expect(service.monthlyLeaderboard()).toEqual([]);
  });
});
