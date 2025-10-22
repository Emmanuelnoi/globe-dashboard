import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsPanelComponent } from './stats-panel';
import { UserStatsService } from '../../../../core/services/user-stats.service';
import { GameSession, GameConfiguration } from '../../models/quiz.models';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsPanelComponent],
      providers: [UserStatsService],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsPanelComponent);
    component = fixture.componentInstance;
    userStatsService = TestBed.inject(UserStatsService);

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
            seed: 12345,
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
            seed: 54321,
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
      await new Promise((resolve) => setTimeout(resolve, 100));

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
    // Export/Import integration test removed - functionality was simplified
    it.skip('should perform complete export/import cycle', async () => {
      // Arrange: Create test data
      const testSession: GameSession = {
        id: 'export-test-session',
        configuration: {
          mode: 'flag-id',
          difficulty: 'hard',
          questionCount: 2,
          seed: 99999,
        },
        questions: [],
        results: [
          {
            questionId: 'q1',
            selectedAnswer: 'US',
            correctAnswer: 'US',
            isCorrect: true,
            timeSpent: 2500,
            pointsEarned: 300,
            streakAtTime: 1,
          },
          {
            questionId: 'q2',
            selectedAnswer: 'UK',
            correctAnswer: 'UK',
            isCorrect: true,
            timeSpent: 3000,
            pointsEarned: 250,
            streakAtTime: 2,
          },
        ],
        startTime: new Date('2024-01-20T09:00:00'),
        endTime: new Date('2024-01-20T09:02:30'),
        finalScore: 550,
        bestStreak: 2,
        completed: true,
      };

      await userStatsService.saveSession(testSession);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Mock DOM methods for file download/upload
      const mockBlob = new Blob(['test'], { type: 'application/json' });
      const mockUrl = 'blob:mock-url';
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        remove: vi.fn(),
      };

      vi.spyOn(global, 'Blob').mockReturnValue(mockBlob);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => mockAnchor as any,
      );
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        () => mockAnchor as any,
      );

      // Act 1: Export data
      await component.exportStats();

      // Assert: Verify export was called
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.click).toHaveBeenCalled();

      // Act 2: Simulate import process
      const originalStats = await userStatsService.getStats();
      const exportData = await userStatsService.exportData();

      // Clear data
      await userStatsService.clearAllData();
      let clearedStats = await userStatsService.getStats();
      expect(clearedStats?.totalGames || 0).toBe(0);

      // Import data back
      await userStatsService.importData(exportData);

      // Assert: Verify data was restored
      const restoredStats = await userStatsService.getStats();
      expect(restoredStats?.totalGames).toBe(originalStats?.totalGames);
      expect(restoredStats?.gamesByMode['flag-id'].gamesPlayed).toBe(1);
      expect(restoredStats?.gamesByMode['flag-id'].bestScore).toBe(550);

      // Clean up mocks
      vi.restoreAllMocks();
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
            seed: 1,
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
            seed: 2,
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
            seed: 3,
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
            seed: 4,
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
      // Simulate an error in the service
      vi.spyOn(userStatsService, 'getStats').mockRejectedValue(
        new Error('Database error'),
      );

      // Initialize component
      await userStatsService.loadStats();
      await new Promise((resolve) => setTimeout(resolve, 100));
      fixture.detectChanges();

      // Check for error display
      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.textContent).toContain('Database error');
    });

    it('should show loading state during data fetch', async () => {
      // Mock a slow loading scenario
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve(null), 1000),
      );
      vi.spyOn(userStatsService, 'getStats').mockReturnValue(
        slowPromise as any,
      );

      // Trigger loading
      userStatsService.loadStats();
      fixture.detectChanges();

      // Check for loading state
      const loadingSpinner =
        fixture.nativeElement.querySelector('.loading-spinner');
      expect(loadingSpinner).toBeTruthy();
      expect(loadingSpinner.textContent).toContain('Loading');
    });
  });
});
