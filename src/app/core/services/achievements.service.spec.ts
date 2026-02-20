import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { AchievementsService } from './achievements.service';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { CountryDiscoveryService } from './country-discovery.service';
import { LoggerService } from './logger.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockProvider } from 'ng-mocks';

describe('AchievementsService', () => {
  let service: AchievementsService;

  beforeEach(() => {
    const supabaseSpy = {
      isUserAuthenticated: vi.fn(),
      getCurrentUserId: vi.fn(),
    };
    const userStatsSpy = {
      totalGames: vi.fn(() => 0),
      bestStreak: vi.fn(() => 0),
      stats: vi.fn(() => null),
    };
    const discoverySpy = {
      totalDiscovered: vi.fn(() => 0),
    };
    const loggerSpy = {
      debug: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AchievementsService,
        MockProvider(SupabaseService, supabaseSpy),
        MockProvider(UserStatsService, userStatsSpy),
        MockProvider(CountryDiscoveryService, discoverySpy),
        MockProvider(LoggerService, loggerSpy),
      ],
    });

    service = TestBed.inject(AchievementsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with predefined achievements', async () => {
    // Wait for service initialization to complete
    let attempts = 0;
    while (service.isLoading() && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    expect(service.totalAchievements()).toBeGreaterThan(0);
    expect(service.unlockedCount()).toBe(0);
  });
});
