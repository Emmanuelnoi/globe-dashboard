import { TestBed } from '@angular/core/testing';
import { LeaderboardService } from './leaderboard.service';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { CountryDiscoveryService } from './country-discovery.service';
import { AchievementsService } from './achievements.service';
import { LoggerService } from './logger.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    const supabaseSpy = {
      isUserAuthenticated: vi.fn(),
      getCurrentUserId: vi.fn(),
      isAuthenticated: signal(false),
    };
    const userStatsSpy = {
      stats: vi.fn(() => null),
    };
    const discoverySpy = {
      totalDiscovered: vi.fn(() => 0),
    };
    const achievementsSpy = {
      unlockedCount: vi.fn(() => 0),
    };
    const loggerSpy = {
      debug: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
    };

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
