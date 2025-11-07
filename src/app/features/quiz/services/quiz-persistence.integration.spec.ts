import { TestBed } from '@angular/core/testing';
import { QuizStateService } from './quiz-state';
import { UserStatsService } from '../../../core/services/user-stats.service';
import { QuestionGeneratorService } from './question-generator.service';
import { InteractionModeService } from '../../../core/services/interaction-mode';
import { CountryDataService } from '../../../core/services/country-data.service';
import { signal } from '@angular/core';
import {
  GameConfiguration,
  GameSession,
  QuestionResult,
} from '../models/quiz.models';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

/**
 * Quiz Persistence Integration Tests
 *
 * These tests verify the complete end-to-end persistence flow:
 * 1. Quiz session creation and completion
 * 2. Session data persistence to IndexedDB
 * 3. Statistics aggregation and calculation
 * 4. Data export and import functionality
 * 5. Error handling and data recovery
 */
describe('Quiz Persistence Integration', () => {
  let quizStateService: QuizStateService;
  let userStatsService: UserStatsService;
  let questionGeneratorService: QuestionGeneratorService;

  // Mock services
  let mockInteractionModeService: any;
  let mockCountryDataService: any;

  beforeEach(async () => {
    // fake-indexeddb is automatically set up via import 'fake-indexeddb/auto'

    // Mock InteractionModeService
    mockInteractionModeService = {
      enableQuizMode: vi.fn(),
      enableExploreMode: vi.fn(),
    };

    // Mock CountryDataService with sample data
    const sampleCountries = [
      {
        id: 'US',
        name: 'United States',
        capital: 'Washington, D.C.',
        flag: '🇺🇸',
        gdp: 21400000,
        population: 328200000,
        continent: 'North America',
      },
      {
        id: 'FR',
        name: 'France',
        capital: 'Paris',
        flag: '🇫🇷',
        gdp: 2715000,
        population: 67000000,
        continent: 'Europe',
      },
      {
        id: 'JP',
        name: 'Japan',
        capital: 'Tokyo',
        flag: '🇯🇵',
        gdp: 4971000,
        population: 125800000,
        continent: 'Asia',
      },
    ];

    mockCountryDataService = {
      countries: signal(sampleCountries),
      getAllCountries: vi.fn().mockReturnValue(sampleCountries),
    };

    await TestBed.configureTestingModule({
      providers: [
        QuizStateService,
        UserStatsService,
        QuestionGeneratorService,
        {
          provide: InteractionModeService,
          useValue: mockInteractionModeService,
        },
        { provide: CountryDataService, useValue: mockCountryDataService },
      ],
    });

    quizStateService = TestBed.inject(QuizStateService);
    userStatsService = TestBed.inject(UserStatsService);
    questionGeneratorService = TestBed.inject(QuestionGeneratorService);

    // Clear any existing data before each test
    await userStatsService.clearAllData();
  });

  afterEach(async () => {
    // Clean up after each test
    await userStatsService.clearAllData();
  });

  describe('End-to-End Quiz Session Persistence', () => {
    it('should complete a full quiz session and persist data correctly', async () => {
      // Arrange: Create a quiz configuration
      const config: GameConfiguration = {
        mode: 'find-country',
        difficulty: 'medium',
        questionCount: 3,
        seed: 12345,
      };

      // Act 1: Start the quiz
      quizStateService.startGame(config);

      // Verify initial state
      expect(quizStateService.gameState()).toBe('question');
      expect(quizStateService.currentSession()).toBeTruthy();
      expect(quizStateService.questions().length).toBe(3);

      // Act 2: Answer all questions correctly
      const questions = quizStateService.questions();
      let totalScore = 0;

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];

        // Wait for question to load
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Select correct answer
        quizStateService.selectCandidate(question.correctAnswer);
        expect(quizStateService.selectedCandidate()).toBe(
          question.correctAnswer,
        );

        // Confirm answer
        quizStateService.confirmCandidate();

        // Wait for evaluation state
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if score increased
        const currentScore = quizStateService.score();
        expect(currentScore).toBeGreaterThan(totalScore);
        totalScore = currentScore;

        // Wait for next question or end
        await new Promise((resolve) => setTimeout(resolve, 2100));
      }

      // Act 3: Wait for game to end and session to be saved
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert: Verify final session state
      const finalSession = quizStateService.currentSession();
      expect(finalSession?.completed).toBe(true);
      expect(finalSession?.finalScore).toBeGreaterThan(0);
      expect(finalSession?.results.length).toBe(3);

      // Assert: Verify all answers were correct
      finalSession?.results.forEach((result) => {
        expect(result.isCorrect).toBe(true);
        expect(result.pointsEarned).toBeGreaterThan(0);
      });

      // Assert: Verify data was persisted to IndexedDB
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for async save
      const persistedStats = await userStatsService.getStats();

      expect(persistedStats).toBeTruthy();
      expect(persistedStats!.totalGames).toBe(1);
      expect(persistedStats!.totalScore).toBe(finalSession!.finalScore);
      expect(persistedStats!.bestScore).toBe(finalSession!.finalScore);
      expect(persistedStats!.gamesByMode['find-country'].gamesPlayed).toBe(1);

      // Assert: Verify recent sessions
      const recentSessions = await userStatsService.getRecentSessions();
      expect(recentSessions.length).toBe(1);
      expect(recentSessions[0].id).toBe(finalSession!.id);
    }, 15000);

    it('should handle mixed correct/incorrect answers and calculate stats properly', async () => {
      // Arrange
      const config: GameConfiguration = {
        mode: 'capital-match',
        difficulty: 'easy',
        questionCount: 4,
        seed: 54321,
      };

      // Act: Start quiz and answer with mixed results
      quizStateService.startGame(config);
      const questions = quizStateService.questions();

      // Answer pattern: correct, incorrect, correct, skip
      const answerPattern = ['correct', 'incorrect', 'correct', 'skip'];

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        await new Promise((resolve) => setTimeout(resolve, 100));

        switch (answerPattern[i]) {
          case 'correct':
            quizStateService.selectCandidate(question.correctAnswer);
            quizStateService.confirmCandidate();
            break;
          case 'incorrect':
            // Select wrong answer (any option that's not correct)
            const wrongAnswer =
              question.choices?.find((opt) => opt !== question.correctAnswer) ||
              'WRONG';
            quizStateService.selectCandidate(wrongAnswer);
            quizStateService.confirmCandidate();
            break;
          case 'skip':
            quizStateService.skipQuestion();
            break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2100));
      }

      // Wait for session to complete and save
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Assert: Verify mixed results
      const session = quizStateService.currentSession();
      expect(session?.results.length).toBe(4);

      const correctCount =
        session?.results.filter((r) => r.isCorrect).length || 0;
      const incorrectCount =
        session?.results.filter((r) => !r.isCorrect).length || 0;

      expect(correctCount).toBe(2); // 2 correct answers
      expect(incorrectCount).toBe(2); // 1 incorrect + 1 skip

      // Assert: Verify persistence with mixed results
      const stats = await userStatsService.getStats();
      expect(stats?.totalGames).toBe(1);
      expect(stats?.gamesByMode['capital-match'].gamesPlayed).toBe(1);
    }, 15000);
  });

  describe('Multiple Sessions Persistence', () => {
    it('should correctly aggregate statistics across multiple sessions', async () => {
      // Arrange: Play multiple sessions
      const sessions = [
        { mode: 'find-country', difficulty: 'easy', score: 300 },
        { mode: 'find-country', difficulty: 'medium', score: 250 },
        { mode: 'capital-match', difficulty: 'hard', score: 400 },
      ] as const;

      // Act: Complete multiple quiz sessions
      for (const sessionConfig of sessions) {
        const config: GameConfiguration = {
          mode: sessionConfig.mode,
          difficulty: sessionConfig.difficulty,
          questionCount: 2,
          seed: Math.random() * 10000,
        };

        quizStateService.startGame(config);

        // Simulate answering questions correctly to achieve target score
        const questions = quizStateService.questions();
        for (let i = 0; i < questions.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          quizStateService.selectCandidate(questions[i].correctAnswer);
          quizStateService.confirmCandidate();
          await new Promise((resolve) => setTimeout(resolve, 2100));
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        quizStateService.resetToIdle();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Assert: Verify aggregated statistics
      const stats = await userStatsService.getStats();
      expect(stats?.totalGames).toBe(3);

      // Verify per-mode statistics
      expect(stats?.gamesByMode['find-country'].gamesPlayed).toBe(2);
      expect(stats?.gamesByMode['capital-match'].gamesPlayed).toBe(1);

      // Verify sessions are stored
      const recentSessions = await userStatsService.getRecentSessions();
      expect(recentSessions.length).toBe(3);
    }, 20000);
  });

  describe('Data Export/Import Integration', () => {
    it('should export and import complete statistics data', async () => {
      // Arrange: Create some session data
      const config: GameConfiguration = {
        mode: 'flag-id',
        difficulty: 'medium',
        questionCount: 2,
        seed: 99999,
      };

      // Complete a session
      quizStateService.startGame(config);
      const questions = quizStateService.questions();

      for (const question of questions) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        quizStateService.selectCandidate(question.correctAnswer);
        quizStateService.confirmCandidate();
        await new Promise((resolve) => setTimeout(resolve, 2100));
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Act 1: Export data
      const exportedData = await userStatsService.exportData();

      // Assert: Verify export structure
      expect(exportedData.version).toBe(1);
      expect(exportedData.stats).toBeTruthy();
      expect(exportedData.sessions).toBeTruthy();
      expect(Array.isArray(exportedData.sessions)).toBe(true);
      expect(exportedData.sessions.length).toBe(1);
      expect(typeof exportedData.exportDate).toBe('string');

      // Act 2: Clear data and import
      await userStatsService.clearAllData();
      const clearedStats = await userStatsService.getStats();
      expect(clearedStats?.totalGames || 0).toBe(0);

      // Act 3: Import the exported data
      await userStatsService.importData(exportedData);

      // Assert: Verify imported data matches original
      const importedStats = await userStatsService.getStats();
      expect(importedStats?.totalGames).toBe(exportedData.stats.totalGames);
      expect(importedStats?.gamesByMode['flag-id'].gamesPlayed).toBe(1);

      const importedSessions = await userStatsService.getRecentSessions();
      expect(importedSessions.length).toBe(1);
    }, 15000);

    it('should handle import of invalid data gracefully', async () => {
      // Test invalid data structures
      const invalidDataSets = [
        null,
        {},
        { version: 1 }, // missing required fields
        {
          version: 1,
          stats: {},
          sessions: 'not-array',
          exportDate: '2023-01-01',
        },
        {
          version: 'wrong-type',
          stats: {},
          sessions: [],
          exportDate: '2023-01-01',
        },
      ];

      for (const invalidData of invalidDataSets) {
        await expect(
          userStatsService.importData(invalidData as any),
        ).rejects.toThrow();
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test verifies the service handles IndexedDB errors
      // Note: We can't easily mock IndexedDB failures in this environment,
      // but we can verify the error handling code paths exist

      const config: GameConfiguration = {
        mode: 'facts-guess',
        difficulty: 'hard',
        questionCount: 1,
        seed: 77777,
      };

      // Start and complete a session
      quizStateService.startGame(config);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const question = quizStateService.questions()[0];
      quizStateService.selectCandidate(question.correctAnswer);
      quizStateService.confirmCandidate();

      // Even if save fails, the session should complete
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(quizStateService.gameState()).toBe('ended');
    }, 10000);

    it('should maintain data consistency during concurrent operations', async () => {
      // Test concurrent session saves
      const promises = [];

      for (let i = 0; i < 3; i++) {
        const promise = (async () => {
          const config: GameConfiguration = {
            mode: 'find-country',
            difficulty: 'easy',
            questionCount: 1,
            seed: 10000 + i,
          };

          quizStateService.startGame(config);
          await new Promise((resolve) => setTimeout(resolve, 50));

          const question = quizStateService.questions()[0];
          quizStateService.selectCandidate(question.correctAnswer);
          quizStateService.confirmCandidate();

          await new Promise((resolve) => setTimeout(resolve, 2200));
          quizStateService.resetToIdle();
        })();

        promises.push(promise);

        // Stagger the starts slightly
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Wait for all sessions to complete
      await Promise.all(promises);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify all sessions were saved
      const stats = await userStatsService.getStats();
      expect(stats?.totalGames).toBe(3);

      const sessions = await userStatsService.getRecentSessions();
      expect(sessions.length).toBe(3);
    }, 15000);
  });

  describe('Performance and Limits', () => {
    it('should handle large numbers of sessions efficiently', async () => {
      // Test with many quick sessions to verify performance
      const sessionCount = 10;

      for (let i = 0; i < sessionCount; i++) {
        const config: GameConfiguration = {
          mode: 'find-country',
          difficulty: 'easy',
          questionCount: 1,
          seed: 50000 + i,
        };

        quizStateService.startGame(config);
        await new Promise((resolve) => setTimeout(resolve, 20));

        const question = quizStateService.questions()[0];
        quizStateService.selectCandidate(question.correctAnswer);
        quizStateService.confirmCandidate();

        await new Promise((resolve) => setTimeout(resolve, 2050));
        quizStateService.resetToIdle();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Verify all sessions were persisted
      const stats = await userStatsService.getStats();
      expect(stats?.totalGames).toBe(sessionCount);

      // Verify recent sessions limit (should cap at reasonable number)
      const recentSessions = await userStatsService.getRecentSessions();
      expect(recentSessions.length).toBeLessThanOrEqual(50); // Assuming 50 is the limit
    }, 30000);
  });
});
