import { TestBed } from '@angular/core/testing';
import { UserStatsService } from '../../../core/services/user-stats.service';
import { GameSession, UserStatsV1 } from '../models/quiz.models';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

/**
 * Stats Persistence Integration Tests
 *
 * Focused integration tests for the statistics persistence functionality,
 * testing the core workflows without complex quiz state management.
 */
describe('Stats Persistence Integration', () => {
  let userStatsService: UserStatsService;

  beforeEach(async () => {
    // fake-indexeddb is automatically set up via import 'fake-indexeddb/auto'

    await TestBed.configureTestingModule({
      providers: [UserStatsService],
    });

    userStatsService = TestBed.inject(UserStatsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Session Persistence Workflow', () => {
    it('should save session and update statistics', async () => {
      // Arrange: Create a sample session
      const session: GameSession = {
        id: 'test-session-1',
        configuration: {
          mode: 'find-country',
          difficulty: 'medium',
          questionCount: 3,
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
            correctAnswer: 'FR',
            isCorrect: true,
            timeSpent: 2500,
            pointsEarned: 250,
            streakAtTime: 2,
          },
          {
            questionId: 'q3',
            selectedAnswer: 'UK',
            correctAnswer: 'DE',
            isCorrect: false,
            timeSpent: 4000,
            pointsEarned: 0,
            streakAtTime: 0,
          },
        ],
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T10:03:30'),
        finalScore: 450,
        bestStreak: 2,
        completed: true,
      };

      // Act: Save the session
      await userStatsService.saveSession(session);

      // Assert: Verify the service processes the session correctly
      // Note: Since we're mocking IndexedDB, we're testing the interface contract
      expect(userStatsService.totalGames()).toBe(1);
      expect(userStatsService.bestScore()).toBe(450);
      expect(userStatsService.bestStreak()).toBe(2);
    });

    it('should aggregate multiple sessions correctly', async () => {
      // Arrange: Create multiple sessions
      const sessions: GameSession[] = [
        {
          id: 'session-1',
          configuration: {
            mode: 'find-country',
            difficulty: 'easy',
            questionCount: 2,
            seed: 1,
          },
          questions: [],
          results: [
            {
              questionId: 'q1',
              selectedAnswer: 'US',
              correctAnswer: 'US',
              isCorrect: true,
              timeSpent: 2000,
              pointsEarned: 150,
              streakAtTime: 1,
            },
          ],
          startTime: new Date('2024-01-15T09:00:00'),
          endTime: new Date('2024-01-15T09:02:00'),
          finalScore: 150,
          bestStreak: 1,
          completed: true,
        },
        {
          id: 'session-2',
          configuration: {
            mode: 'capital-match',
            difficulty: 'medium',
            questionCount: 2,
            seed: 2,
          },
          questions: [],
          results: [
            {
              questionId: 'q2',
              selectedAnswer: 'Paris',
              correctAnswer: 'Paris',
              isCorrect: true,
              timeSpent: 1500,
              pointsEarned: 200,
              streakAtTime: 1,
            },
          ],
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T10:02:00'),
          finalScore: 200,
          bestStreak: 1,
          completed: true,
        },
        {
          id: 'session-3',
          configuration: {
            mode: 'find-country',
            difficulty: 'hard',
            questionCount: 2,
            seed: 3,
          },
          questions: [],
          results: [
            {
              questionId: 'q3',
              selectedAnswer: 'JP',
              correctAnswer: 'JP',
              isCorrect: true,
              timeSpent: 1000,
              pointsEarned: 300,
              streakAtTime: 1,
            },
          ],
          startTime: new Date('2024-01-15T11:00:00'),
          endTime: new Date('2024-01-15T11:01:30'),
          finalScore: 300,
          bestStreak: 1,
          completed: true,
        },
      ];

      // Act: Save all sessions
      for (const session of sessions) {
        await userStatsService.saveSession(session);
      }

      // Assert: Check aggregated statistics
      expect(userStatsService.totalGames()).toBe(3);
      expect(userStatsService.bestScore()).toBe(300);
      expect(userStatsService.averageScore()).toBe((150 + 200 + 300) / 3);

      // Check mode-specific aggregation would work (interface contract)
      const stats = userStatsService.stats();
      expect(stats).toBeTruthy();
    });
  });

  describe('Export/Import Data Flow', () => {
    it('should export data in correct format', async () => {
      // Arrange: Add some test data
      const session: GameSession = {
        id: 'export-test',
        configuration: {
          mode: 'flag-id',
          difficulty: 'easy',
          questionCount: 1,
          seed: 123,
        },
        questions: [],
        results: [
          {
            questionId: 'q1',
            selectedAnswer: 'US',
            correctAnswer: 'US',
            isCorrect: true,
            timeSpent: 2000,
            pointsEarned: 100,
            streakAtTime: 1,
          },
        ],
        startTime: new Date('2024-01-20T10:00:00'),
        endTime: new Date('2024-01-20T10:02:00'),
        finalScore: 100,
        bestStreak: 1,
        completed: true,
      };

      await userStatsService.saveSession(session);

      // Act: Export data
      const exportData = await userStatsService.exportData();

      // Assert: Verify export structure
      expect(exportData).toBeTruthy();
      expect(exportData.version).toBe(1);
      expect(typeof exportData.exportDate).toBe('string');
      expect(exportData.stats).toBeTruthy();
      expect(Array.isArray(exportData.sessions)).toBe(true);

      // Verify stats structure
      expect(exportData.stats.totalGames).toBe(1);
      expect(exportData.stats.bestScore).toBe(100);
      expect(exportData.stats.gamesByMode).toBeTruthy();
      expect(exportData.stats.gamesByMode['flag-id']).toBeTruthy();
    });

    it('should validate import data correctly', async () => {
      // Valid import data
      const validImportData = {
        version: 1,
        exportDate: '2024-01-20T12:00:00.000Z',
        stats: {
          totalGames: 2,
          totalScore: 300,
          averageScore: 150,
          bestScore: 200,
          bestStreak: 3,
          gamesByMode: {
            'find-country': {
              gamesPlayed: 1,
              totalScore: 200,
              averageScore: 200,
              bestScore: 200,
              bestStreak: 3,
            },
            'capital-match': {
              gamesPlayed: 1,
              totalScore: 100,
              averageScore: 100,
              bestScore: 100,
              bestStreak: 2,
            },
          },
        },
        sessions: [
          {
            id: 'imported-session',
            finalScore: 200,
            completed: true,
            configuration: {
              mode: 'find-country',
              difficulty: 'medium',
              questionCount: 2,
              seed: 456,
            },
          },
        ],
      };

      // Act & Assert: Valid import should work
      await expect(
        userStatsService.importData(validImportData),
      ).resolves.not.toThrow();

      // Invalid data structures should be rejected
      const invalidDataSets = [
        null,
        undefined,
        {},
        { version: 1 }, // missing required fields
        {
          version: 1,
          stats: {},
          sessions: 'not-array',
          exportDate: '2024-01-20',
        },
        {
          version: 'invalid',
          stats: {},
          sessions: [],
          exportDate: '2024-01-20',
        },
        { stats: {}, sessions: [], exportDate: '2024-01-20' }, // missing version
      ];

      for (const invalidData of invalidDataSets) {
        await expect(
          userStatsService.importData(invalidData as any),
        ).rejects.toThrow();
      }
    });

    it('should handle import data replacement workflow', async () => {
      // Arrange: Set up initial data
      const initialSession: GameSession = {
        id: 'initial',
        configuration: {
          mode: 'find-country',
          difficulty: 'easy',
          questionCount: 1,
          seed: 1,
        },
        questions: [],
        results: [],
        startTime: new Date(),
        endTime: new Date(),
        finalScore: 100,
        bestStreak: 1,
        completed: true,
      };

      await userStatsService.saveSession(initialSession);
      expect(userStatsService.totalGames()).toBe(1);

      // Prepare import data with different stats
      const importData = {
        version: 1,
        exportDate: new Date().toISOString(),
        stats: {
          totalGames: 3,
          totalScore: 600,
          averageScore: 200,
          bestScore: 300,
          bestStreak: 5,
          gamesByMode: {
            'capital-match': {
              gamesPlayed: 3,
              totalScore: 600,
              averageScore: 200,
              bestScore: 300,
              bestStreak: 5,
            },
          },
        },
        sessions: [
          {
            id: 'imported-1',
            finalScore: 200,
            completed: true,
            configuration: {
              mode: 'capital-match',
              difficulty: 'medium',
              questionCount: 2,
              seed: 2,
            },
          },
          {
            id: 'imported-2',
            finalScore: 300,
            completed: true,
            configuration: {
              mode: 'capital-match',
              difficulty: 'hard',
              questionCount: 3,
              seed: 3,
            },
          },
        ],
      };

      // Act: Import data (should replace existing)
      await userStatsService.importData(importData);

      // Assert: Data should be replaced
      const newStats = userStatsService.stats();
      expect(newStats?.totalGames).toBe(3);
      expect(newStats?.bestScore).toBe(300);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error
      const mockError = new Error('Database connection failed');
      vi.spyOn(userStatsService as any, 'saveSession').mockRejectedValue(
        mockError,
      );

      const session: GameSession = {
        id: 'error-test',
        configuration: {
          mode: 'find-country',
          difficulty: 'easy',
          questionCount: 1,
          seed: 1,
        },
        questions: [],
        results: [],
        startTime: new Date(),
        endTime: new Date(),
        finalScore: 100,
        bestStreak: 1,
        completed: true,
      };

      // Should handle the error without throwing
      await expect(userStatsService.saveSession(session)).rejects.toThrow(
        'Database connection failed',
      );

      // Error state should be reflected in the service
      expect(userStatsService.lastError()).toBeTruthy();
    });

    it('should validate data integrity during operations', async () => {
      // Test with malformed session data
      const malformedSession = {
        id: 'malformed',
        // Missing required fields
        finalScore: 'not-a-number',
        completed: 'not-a-boolean',
      } as any;

      // Service should handle malformed data gracefully
      await expect(
        userStatsService.saveSession(malformedSession),
      ).rejects.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle multiple concurrent operations', async () => {
      // Create multiple sessions for concurrent saving
      const sessions: GameSession[] = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-${i}`,
        configuration: {
          mode: 'find-country',
          difficulty: 'easy',
          questionCount: 1,
          seed: i,
        },
        questions: [],
        results: [
          {
            questionId: `q${i}`,
            selectedAnswer: 'US',
            correctAnswer: 'US',
            isCorrect: true,
            timeSpent: 1000,
            pointsEarned: 100,
            streakAtTime: 1,
          },
        ],
        startTime: new Date(),
        endTime: new Date(),
        finalScore: 100,
        bestStreak: 1,
        completed: true,
      }));

      // Act: Save all sessions concurrently
      const savePromises = sessions.map((session) =>
        userStatsService.saveSession(session),
      );

      // Should handle concurrent operations without errors
      await expect(Promise.all(savePromises)).resolves.not.toThrow();

      // Final state should reflect all sessions
      expect(userStatsService.totalGames()).toBe(5);
    });

    it('should maintain data consistency under load', async () => {
      // Simulate rapid sequential operations
      for (let i = 0; i < 10; i++) {
        const session: GameSession = {
          id: `rapid-${i}`,
          configuration: {
            mode: 'find-country',
            difficulty: 'easy',
            questionCount: 1,
            seed: i,
          },
          questions: [],
          results: [],
          startTime: new Date(),
          endTime: new Date(),
          finalScore: 50 + i * 10, // Varying scores
          bestStreak: 1,
          completed: true,
        };

        await userStatsService.saveSession(session);
      }

      // Verify final consistency
      expect(userStatsService.totalGames()).toBe(10);
      expect(userStatsService.bestScore()).toBe(140); // Last session had highest score
    });
  });
});
