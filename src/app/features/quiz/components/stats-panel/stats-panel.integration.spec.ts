import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsPanelComponent } from './stats-panel';
import { UserStatsService } from '../../../../core/services/user-stats.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { GameSession, GameConfiguration } from '../../models/quiz.models';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';
import { MockProvider } from 'ng-mocks';

/**
 * StatsPanelComponent Integration Tests
 *
 * These tests verify the integration between the StatsPanelComponent
 * and the UserStatsService, including real data persistence and display.
 */
describe('StatsPanelComponent Integration', () => {
  let component: StatsPanelComponent;
  let fixture: ComponentFixture<StatsPanelComponent>;
  let userStatsService: UserStatsService;

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(
    condition: () => boolean,
    timeoutMs = 5000,
    intervalMs = 50,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (condition()) return;
      await delay(intervalMs);
    }
    throw new Error(`Timed out waiting for condition after ${timeoutMs}ms`);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsPanelComponent],
      providers: [
        UserStatsService,
        MockProvider(LoggerService, {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          success: vi.fn(),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsPanelComponent);
    component = fixture.componentInstance;
    userStatsService = TestBed.inject(UserStatsService);

    // Wait until IndexedDB initialization is complete before test actions.
    await waitFor(() => !userStatsService.isLoading());

    // Clear any existing data
    await userStatsService.clearAllData();
  });

  afterEach(async () => {
    await userStatsService.clearAllData();
  });

  describe('Real Data Integration', () => {
    it('should display actual persisted statistics data', async () => {
      // Arrange: Create sample session data
      const sampleSessions: GameSession[] = [
        {
          id: 'session-1',
          configuration: {
            mode: 'find-country',
            difficulty: 'medium',
            questionCount: 5,
            seed: '12345',
          },
          questions: [],
          results: [
            {
              questionId: 'q1',
              selectedAnswer: 'US',
              correctAnswer: 'US',
              isCorrect: true,
              timeSpent: 3000,
              pointsEarned: 200,
              streakAtTime: 1,
            },
            {
              questionId: 'q2',
              selectedAnswer: 'FR',
              correctAnswer: 'UK',
              isCorrect: false,
              timeSpent: 5000,
              pointsEarned: 0,
              streakAtTime: 0,
            },
          ],
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T10:05:00'),
          finalScore: 200,
          bestStreak: 1,
          completed: true,
        },
        {
          id: 'session-2',
          configuration: {
            mode: 'capital-match',
            difficulty: 'easy',
            questionCount: 3,
            seed: '54321',
          },
          questions: [],
          results: [
            {
              questionId: 'q3',
              selectedAnswer: 'Paris',
              correctAnswer: 'Paris',
              isCorrect: true,
              timeSpent: 2000,
              pointsEarned: 150,
              streakAtTime: 1,
            },
          ],
          startTime: new Date('2024-01-16T14:30:00'),
          endTime: new Date('2024-01-16T14:32:00'),
          finalScore: 150,
          bestStreak: 1,
          completed: true,
        },
      ];

      // Act: Save sessions to IndexedDB
      for (const session of sampleSessions) {
        await userStatsService.saveSession(session);
      }

      // Wait for signals to update
      await waitFor(() => component.totalGames() === 2);

      fixture.detectChanges();

      // Assert: Verify component displays correct aggregate statistics
      expect(component.totalGames()).toBe(2);
      expect(component.bestScore()).toBe(200);

      // Verify mode-specific statistics
      const findCountryStats = component.getModeStats('find-country');
      expect(findCountryStats.gamesPlayed).toBe(1);
      expect(findCountryStats.bestScore).toBe(200);

      const capitalMatchStats = component.getModeStats('capital-match');
      expect(capitalMatchStats.gamesPlayed).toBe(1);
      expect(capitalMatchStats.bestScore).toBe(150);

      // Verify recent sessions display
      const recentSessions = component.recentSessions();
      expect(recentSessions.length).toBe(2);
    });

    // Export/Import button test removed - functionality was removed per CLAUDE.md
  });

  describe('Export/Import Integration', () => {
    it('should perform complete export/import cycle', async () => {
      const exportData = {
        version: 1,
        exportDate: new Date().toISOString(),
        stats: {
          version: 1,
          totalGames: 2,
          totalScore: 350,
          averageScore: 175,
          bestScore: 200,
          bestStreak: 2,
          gamesByMode: {
            'find-country': {
              gamesPlayed: 2,
              totalScore: 350,
              averageScore: 175,
              bestScore: 200,
              bestStreak: 2,
            },
            'capital-match': {
              gamesPlayed: 0,
              totalScore: 0,
              averageScore: 0,
              bestScore: 0,
              bestStreak: 0,
            },
            'flag-id': {
              gamesPlayed: 0,
              totalScore: 0,
              averageScore: 0,
              bestScore: 0,
              bestStreak: 0,
            },
            'facts-guess': {
              gamesPlayed: 0,
              totalScore: 0,
              averageScore: 0,
              bestScore: 0,
              bestStreak: 0,
            },
            'explore-learn': {
              gamesPlayed: 0,
              totalScore: 0,
              averageScore: 0,
              bestScore: 0,
              bestStreak: 0,
            },
          },
          lastUpdated: new Date(),
        },
        sessions: [],
      };

      const exportSpy = vi
        .spyOn(userStatsService, 'exportData')
        .mockResolvedValue(exportData as any);
      const importSpy = vi
        .spyOn(userStatsService, 'importData')
        .mockResolvedValue(undefined);

      const originalCreateObjectURL = (URL as any).createObjectURL;
      const originalRevokeObjectURL = (URL as any).revokeObjectURL;
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:test-url');
      (URL as any).revokeObjectURL = vi.fn();
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      try {
        await component.exportStats();
        expect(exportSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();

        const file = {
          type: 'application/json',
          text: vi.fn().mockResolvedValue(JSON.stringify(exportData)),
        };
        const input = {
          files: [file],
          value: 'stats.json',
        };

        await component.onFileSelected({ target: input } as unknown as Event);

        expect(importSpy).toHaveBeenCalledTimes(1);
        const importedArg = importSpy.mock.calls[0][0] as any;
        expect(importedArg.version).toBe(exportData.version);
        expect(importedArg.stats.totalGames).toBe(exportData.stats.totalGames);
        expect(importedArg.sessions).toEqual(exportData.sessions);
        expect(input.value).toBe('');
      } finally {
        exportSpy.mockRestore();
        importSpy.mockRestore();
        clickSpy.mockRestore();
        confirmSpy.mockRestore();
        alertSpy.mockRestore();
        (URL as any).createObjectURL = originalCreateObjectURL;
        (URL as any).revokeObjectURL = originalRevokeObjectURL;
      }
    });

    it('should validate import data correctly', () => {
      // Test valid data
      const validData = {
        version: 1,
        exportDate: '2024-01-20T10:00:00.000Z',
        stats: {
          totalGames: 5,
          totalScore: 1000,
          averageScore: 200,
          bestScore: 350,
          bestStreak: 3,
        },
        sessions: [
          {
            id: 'test-session',
            finalScore: 350,
            completed: true,
          },
        ],
      };

      expect(component.isValidStatsData(validData)).toBe(true);

      // Test invalid data variations
      expect(component.isValidStatsData(null)).toBe(false);
      expect(component.isValidStatsData({})).toBe(false);
      expect(component.isValidStatsData({ version: 1 })).toBe(false);
      expect(
        component.isValidStatsData({
          version: 1,
          stats: {},
          sessions: 'not-array',
          exportDate: '2024-01-20',
        }),
      ).toBe(false);
    });
  });

  describe('Date Formatting Integration', () => {
    it('should format session dates correctly based on current time', async () => {
      const now = new Date();
      const today = new Date(now);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Test session with various dates
      const sessions: GameSession[] = [
        {
          id: 'today-session',
          configuration: {
            mode: 'find-country',
            difficulty: 'easy',
            questionCount: 1,
            seed: '1',
          },
          questions: [],
          results: [],
          startTime: today,
          endTime: today,
          finalScore: 100,
          bestStreak: 1,
          completed: true,
        },
        {
          id: 'yesterday-session',
          configuration: {
            mode: 'find-country',
            difficulty: 'easy',
            questionCount: 1,
            seed: '2',
          },
          questions: [],
          results: [],
          startTime: yesterday,
          endTime: yesterday,
          finalScore: 100,
          bestStreak: 1,
          completed: true,
        },
        {
          id: 'three-days-session',
          configuration: {
            mode: 'find-country',
            difficulty: 'easy',
            questionCount: 1,
            seed: '3',
          },
          questions: [],
          results: [],
          startTime: threeDaysAgo,
          endTime: threeDaysAgo,
          finalScore: 100,
          bestStreak: 1,
          completed: true,
        },
        {
          id: 'old-session',
          configuration: {
            mode: 'find-country',
            difficulty: 'easy',
            questionCount: 1,
            seed: '4',
          },
          questions: [],
          results: [],
          startTime: twoWeeksAgo,
          endTime: twoWeeksAgo,
          finalScore: 100,
          bestStreak: 1,
          completed: true,
        },
      ];

      for (const session of sessions) {
        await userStatsService.saveSession(session);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Test date formatting
      expect(component.formatDate(today)).toBe('Today');
      expect(component.formatDate(yesterday)).toBe('Yesterday');
      expect(component.formatDate(threeDaysAgo)).toBe('3 days ago');
      expect(component.formatDate(twoWeeksAgo)).toBe(
        twoWeeksAgo.toLocaleDateString(),
      );
      expect(component.formatDate(undefined)).toBe('');
    });
  });

  describe('Error State Integration', () => {
    it('should display errors from UserStatsService', async () => {
      // Simulate an error state in the service
      (userStatsService as any)._lastError.set('Database error');
      fixture.detectChanges();

      // Check for error display
      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Database error');
    });

    it('should show loading state during data fetch', async () => {
      // Simulate loading state directly
      (userStatsService as any)._isLoading.set(true);
      fixture.detectChanges();

      // Check for loading state
      const loadingSpinner =
        fixture.nativeElement.querySelector('.loading-spinner');
      expect(loadingSpinner).toBeTruthy();
      expect(loadingSpinner.textContent).toContain('Loading');
    });
  });
});
