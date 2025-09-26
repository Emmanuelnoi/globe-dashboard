import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, MockedFunction } from 'vitest';
import { QuizStateService } from './quiz-state';
import { InteractionModeService } from '../../../core/services/interaction-mode';
import { CountryDataService } from '../../../core/services/country-data.service';
import {
  GameConfiguration,
  GameState,
  Question,
  QuestionResult,
} from '../models/quiz.models';
import { CountryDataRecord } from '../../../core/types/country-data.types';

describe('QuizStateService', () => {
  let service: QuizStateService;
  let mockInteractionModeService: {
    enableQuizMode: MockedFunction<any>;
    enableExploreMode: MockedFunction<any>;
    isQuizMode: MockedFunction<any>;
  };
  let mockCountryDataService: {
    getAllCountries: MockedFunction<() => CountryDataRecord[]>;
  };
  let mockCountryData: CountryDataRecord[];

  beforeEach(async () => {
    // Mock country data
    mockCountryData = [
      {
        id: 'US',
        name: 'United States',
        code: 'USA',
        capital: 'Washington, D.C.',
        population: 331900000,
        region: 'Americas',
        subregion: 'Northern America',
        latitude: 39.8283,
        longitude: -98.5795,
        area: 9833517,
        timezones: [
          'UTC-12',
          'UTC-11',
          'UTC-10',
          'UTC-9',
          'UTC-8',
          'UTC-7',
          'UTC-6',
          'UTC-5',
          'UTC-4',
        ],
        gdpPerCapita: 65000,
        lifeExpectancy: 78.9,
        hdi: 0.926,
        happiness: 6.94,
        gdpPerCapitaFormatted: '$65,000',
        lifeExpectancyFormatted: '78.9 years',
        hdiFormatted: '0.926',
        hdiCategory: 'Very High',
        happinessFormatted: '6.94/10',
        populationFormatted: '331.9M',
        dataSource: 'worldbank-gdp',
        dataCompleteness: 100,
      },
      {
        id: 'CN',
        name: 'China',
        code: 'CHN',
        capital: 'Beijing',
        population: 1412000000,
        region: 'Asia',
        subregion: 'Eastern Asia',
        latitude: 35.8617,
        longitude: 104.1954,
        area: 9596960,
        timezones: ['UTC+8'],
        gdpPerCapita: 12556,
        lifeExpectancy: 77.4,
        hdi: 0.761,
        happiness: 5.125,
        gdpPerCapitaFormatted: '$12,556',
        lifeExpectancyFormatted: '77.4 years',
        hdiFormatted: '0.761',
        hdiCategory: 'High',
        happinessFormatted: '5.125/10',
        populationFormatted: '1.41B',
        dataSource: 'worldbank-gdp',
        dataCompleteness: 100,
      },
      {
        id: 'MT',
        name: 'Malta',
        code: 'MLT',
        capital: 'Valletta',
        population: 441000,
        region: 'Europe',
        subregion: 'Southern Europe',
        latitude: 35.9375,
        longitude: 14.3754,
        area: 316,
        timezones: ['UTC+1'],
        gdpPerCapita: 31058,
        lifeExpectancy: 82.5,
        hdi: 0.918,
        happiness: 6.6,
        gdpPerCapitaFormatted: '$31,058',
        lifeExpectancyFormatted: '82.5 years',
        hdiFormatted: '0.918',
        hdiCategory: 'Very High',
        happinessFormatted: '6.6/10',
        populationFormatted: '441K',
        dataSource: 'worldbank-gdp',
        dataCompleteness: 100,
      },
    ];

    // Create mock objects for dependencies
    mockInteractionModeService = {
      enableQuizMode: vi.fn(),
      enableExploreMode: vi.fn(),
      isQuizMode: vi.fn().mockReturnValue(false),
    };

    mockCountryDataService = {
      getAllCountries: vi.fn().mockReturnValue(mockCountryData),
    };

    // Setup timer mocking
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      providers: [
        QuizStateService,
        {
          provide: InteractionModeService,
          useValue: mockInteractionModeService,
        },
        { provide: CountryDataService, useValue: mockCountryDataService },
      ],
    });

    service = TestBed.inject(QuizStateService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with idle state', () => {
      expect(service.gameState()).toBe('idle');
      expect(service.score()).toBe(0);
      expect(service.streak()).toBe(0);
      expect(service.currentQuestion()).toBeNull();
      expect(service.selectedCandidate()).toBeNull();
      expect(service.questions()).toEqual([]);
      expect(service.results()).toEqual([]);
      expect(service.currentQuestionIndex()).toBe(0);
      expect(service.timeLeft()).toBe(0);
      expect(service.configuration()).toBeNull();
      expect(service.currentSession()).toBeNull();
    });

    it('should have correct computed values in idle state', () => {
      expect(service.isPlaying()).toBe(false);
      expect(service.canConfirm()).toBe(false);
      expect(service.questionsComplete()).toBe(true); // No questions = complete
      expect(service.progress()).toBe(0);
      expect(service.timeProgress()).toBe(0);
    });
  });

  describe('Game Configuration and Startup', () => {
    const testConfig: GameConfiguration = {
      mode: 'find-country',
      difficulty: 'medium',
      questionCount: 2,
    };

    it('should start a game with valid configuration', () => {
      service.startGame(testConfig);

      expect(service.gameState()).toBe('question');
      expect(service.configuration()).toEqual(testConfig);
      expect(service.questions().length).toBe(2);
      expect(service.currentQuestionIndex()).toBe(0);
      expect(service.currentQuestion()).toBeTruthy();
      expect(service.currentSession()).toBeTruthy();
      expect(service.isPlaying()).toBe(true);
      expect(mockInteractionModeService.enableQuizMode).toHaveBeenCalled();
    });

    it('should generate questions based on difficulty', () => {
      service.startGame(testConfig);
      const questions = service.questions();

      expect(questions.length).toBe(2);
      expect(questions[0].type).toBe('find-country');
      expect(questions[0].correctAnswer).toBeTruthy();
      expect(questions[0].prompt).toBeTruthy();
    });

    it('should not start game if already in progress', () => {
      service.startGame(testConfig);
      const firstSession = service.currentSession();

      // Try to start another game
      service.startGame({ ...testConfig, questionCount: 5 });

      expect(service.currentSession()).toBe(firstSession);
      expect(service.questions().length).toBe(2); // Still the original
    });

    it('should initialize timer with correct time limit', () => {
      service.startGame(testConfig);

      // Medium difficulty should have 45 seconds
      expect(service.timeLeft()).toBe(45000);
    });
  });

  describe('State Transitions', () => {
    beforeEach(() => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 1,
      });
    });

    it('should transition from idle to playing to question', () => {
      service.resetToIdle();
      expect(service.gameState()).toBe('idle');

      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 1,
      });

      expect(service.gameState()).toBe('question');
    });

    it('should transition from question to evaluating when confirming answer', () => {
      expect(service.gameState()).toBe('question');

      service.selectCandidate('US');
      service.confirmCandidate();

      expect(service.gameState()).toBe('evaluating');
    });

    it('should transition from evaluating to results after delay', async () => {
      service.selectCandidate('US');
      service.confirmCandidate();

      expect(service.gameState()).toBe('evaluating');

      // Fast-forward the 2-second delay
      vi.advanceTimersByTime(2000);

      expect(service.gameState()).toBe('results');
    });

    it('should transition from results to ended when ending game', async () => {
      service.selectCandidate('US');
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);

      expect(service.gameState()).toBe('results');

      await service.endGame();

      expect(service.gameState()).toBe('ended');
      expect(mockInteractionModeService.enableExploreMode).toHaveBeenCalled();
    });

    it('should transition from ended to idle when resetting', async () => {
      service.selectCandidate('US');
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);
      await service.endGame();

      expect(service.gameState()).toBe('ended');

      service.resetToIdle();

      expect(service.gameState()).toBe('idle');
    });
  });

  describe('Question Management', () => {
    beforeEach(() => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 3,
      });
    });

    it('should load first question automatically', () => {
      expect(service.currentQuestion()).toBeTruthy();
      expect(service.currentQuestionIndex()).toBe(0);
      expect(service.gameState()).toBe('question');
    });

    it('should progress through questions correctly', () => {
      const totalQuestions = service.questions().length;

      // Answer first question
      service.selectCandidate('US');
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);

      expect(service.currentQuestionIndex()).toBe(1);

      if (totalQuestions > 1) {
        expect(service.gameState()).toBe('question');

        // Answer second question
        service.selectCandidate('CN');
        service.confirmCandidate();
        vi.advanceTimersByTime(2000);

        expect(service.currentQuestionIndex()).toBe(2);

        if (totalQuestions > 2) {
          expect(service.gameState()).toBe('question');
        } else {
          expect(service.gameState()).toBe('results');
        }
      } else {
        expect(service.gameState()).toBe('results');
      }
    });

    it('should transition to results after last question', () => {
      // Complete all 3 questions
      for (let i = 0; i < 3; i++) {
        service.selectCandidate('US');
        service.confirmCandidate();
        vi.advanceTimersByTime(2000);
      }

      expect(service.gameState()).toBe('results');
      expect(service.questionsComplete()).toBe(true);
    });

    it('should calculate progress correctly', () => {
      const totalQuestions = service.questions().length;
      expect(service.progress()).toBe(1 / totalQuestions); // Question 1 of total

      service.selectCandidate('US');
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);

      expect(service.progress()).toBe(2 / totalQuestions); // Question 2 of total
    });
  });

  describe('Candidate Selection', () => {
    beforeEach(() => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 1,
      });
    });

    it('should select candidate in question state', () => {
      expect(service.selectedCandidate()).toBeNull();

      service.selectCandidate('US');

      expect(service.selectedCandidate()).toBe('US');
    });

    it('should not select candidate in non-question states', () => {
      service.selectCandidate('US');
      service.confirmCandidate(); // Move to evaluating state

      service.selectCandidate('CN'); // Should be ignored

      expect(service.selectedCandidate()).toBe('US');
    });

    it('should clear candidate selection', () => {
      service.selectCandidate('US');
      expect(service.selectedCandidate()).toBe('US');

      service.clearCandidate();

      expect(service.selectedCandidate()).toBeNull();
    });

    it('should not clear candidate when locked', () => {
      service.selectCandidate('US');
      service.confirmCandidate(); // This locks confirmation

      service.clearCandidate(); // Should be ignored

      expect(service.selectedCandidate()).toBe('US');
    });

    it('should update canConfirm signal correctly', () => {
      expect(service.canConfirm()).toBe(false);

      service.selectCandidate('US');
      expect(service.canConfirm()).toBe(true);

      service.confirmCandidate();
      expect(service.canConfirm()).toBe(false); // Locked after confirm
    });
  });

  describe('Answer Confirmation and Scoring', () => {
    beforeEach(() => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'medium', // 200 base points
        questionCount: 1,
      });
    });

    it('should confirm correct answer and update score', () => {
      const correctAnswer = service.currentQuestion()!.correctAnswer;

      service.selectCandidate(correctAnswer);
      service.confirmCandidate();

      const results = service.results();
      expect(results.length).toBe(1);
      expect(results[0].isCorrect).toBe(true);
      expect(results[0].pointsEarned).toBeGreaterThan(0);
      expect(service.score()).toBeGreaterThan(0);
      expect(service.streak()).toBe(1);
    });

    it('should confirm incorrect answer and not award points', () => {
      const correctAnswer = service.currentQuestion()!.correctAnswer;
      const wrongAnswer = correctAnswer === 'US' ? 'CN' : 'US';

      service.selectCandidate(wrongAnswer);
      service.confirmCandidate();

      const results = service.results();
      expect(results.length).toBe(1);
      expect(results[0].isCorrect).toBe(false);
      expect(results[0].pointsEarned).toBe(0);
      expect(service.score()).toBe(0);
      expect(service.streak()).toBe(0);
    });

    it('should calculate time bonus correctly', () => {
      const correctAnswer = service.currentQuestion()!.correctAnswer;

      service.selectCandidate(correctAnswer);

      // Confirm immediately (maximum time bonus)
      service.confirmCandidate();

      const results = service.results();
      expect(results[0].pointsEarned).toBe(300); // 200 base + ~100 time bonus
    });

    it('should handle time bonus degradation', () => {
      const correctAnswer = service.currentQuestion()!.correctAnswer;

      service.selectCandidate(correctAnswer);

      // Wait most of the time limit before confirming
      vi.advanceTimersByTime(40000); // 40 seconds out of 45

      service.confirmCandidate();

      const results = service.results();
      expect(results[0].pointsEarned).toBeGreaterThan(200); // Base points
      expect(results[0].pointsEarned).toBeLessThan(250); // Reduced time bonus
    });

    it('should maintain streak for consecutive correct answers', () => {
      service.resetToIdle();
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 3,
      });

      const totalQuestions = service.questions().length;

      // Answer all available questions correctly
      for (let i = 0; i < totalQuestions; i++) {
        const correctAnswer = service.currentQuestion()!.correctAnswer;
        service.selectCandidate(correctAnswer);
        service.confirmCandidate();
        vi.advanceTimersByTime(2000);
      }

      expect(service.streak()).toBe(totalQuestions);
    });

    it('should reset streak on incorrect answer', () => {
      service.resetToIdle();
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 3,
      });

      // Correct answer
      let correctAnswer = service.currentQuestion()!.correctAnswer;
      service.selectCandidate(correctAnswer);
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);

      expect(service.streak()).toBe(1);

      // Incorrect answer
      correctAnswer = service.currentQuestion()!.correctAnswer;
      const wrongAnswer = correctAnswer === 'US' ? 'CN' : 'US';
      service.selectCandidate(wrongAnswer);
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);

      expect(service.streak()).toBe(0);
    });
  });

  describe('Question Skipping', () => {
    beforeEach(() => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 2,
      });
    });

    it('should skip question and record as incorrect', () => {
      service.skipQuestion();

      const results = service.results();
      expect(results.length).toBe(1);
      expect(results[0].isCorrect).toBe(false);
      expect(results[0].selectedAnswer).toBe('SKIPPED');
      expect(results[0].pointsEarned).toBe(0);
      expect(service.streak()).toBe(0);
    });

    it('should progress to next question after skip', () => {
      expect(service.currentQuestionIndex()).toBe(0);

      service.skipQuestion();

      expect(service.currentQuestionIndex()).toBe(1);
      expect(service.gameState()).toBe('question');
    });

    it('should not skip in non-question states', () => {
      service.selectCandidate('US');
      service.confirmCandidate(); // Move to evaluating

      const initialResults = service.results().length;
      service.skipQuestion(); // Should be ignored

      expect(service.results().length).toBe(initialResults);
    });
  });

  describe('Timer Functionality', () => {
    beforeEach(() => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'hard', // 30 second timer
        questionCount: 1,
      });
    });

    it('should start timer with correct time limit', () => {
      expect(service.timeLeft()).toBe(30000); // 30 seconds for hard
    });

    it('should countdown timer correctly', () => {
      vi.advanceTimersByTime(5000); // 5 seconds

      expect(service.timeLeft()).toBeLessThanOrEqual(25100); // Allow some timer precision leeway
      expect(service.timeLeft()).toBeGreaterThan(24000);
    });

    it('should calculate time progress correctly', () => {
      expect(service.timeProgress()).toBe(1); // Full time remaining

      vi.advanceTimersByTime(15000); // Half time elapsed

      expect(service.timeProgress()).toBeCloseTo(0.5, 1);
    });

    it('should auto-skip when time runs out', () => {
      vi.advanceTimersByTime(30000); // Full time elapsed

      const results = service.results();
      expect(results.length).toBe(1);
      expect(results[0].selectedAnswer).toBe('SKIPPED');
      expect(results[0].isCorrect).toBe(false);
    });

    it('should stop timer when answer is confirmed', () => {
      service.selectCandidate('US');
      const timeBeforeConfirm = service.timeLeft();

      service.confirmCandidate();
      vi.advanceTimersByTime(1000); // Time should not continue decreasing

      expect(service.timeLeft()).toBe(timeBeforeConfirm);
    });
  });

  describe('Difficulty-based Question Generation', () => {
    it('should filter countries by easy difficulty', () => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 5,
      });

      const questions = service.questions();
      // Should only include large countries (US, China) from our mock data
      questions.forEach((question) => {
        const country = mockCountryData.find(
          (c) => c.id === question.correctAnswer,
        );
        expect(country).toBeTruthy();
        expect(
          country!.population > 10_000_000 ||
            ['United States', 'China'].includes(country!.name),
        ).toBe(true);
      });
    });

    it('should filter countries by medium difficulty', () => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'medium',
        questionCount: 5,
      });

      const questions = service.questions();
      questions.forEach((question) => {
        const country = mockCountryData.find(
          (c) => c.id === question.correctAnswer,
        );
        expect(country).toBeTruthy();
        expect(
          country!.population > 1_000_000 || ['Malta'].includes(country!.name),
        ).toBe(true);
      });
    });

    it('should include all countries for hard difficulty', () => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'hard',
        questionCount: 3,
      });

      const questions = service.questions();
      expect(questions.length).toBe(3); // All countries available
    });
  });

  describe('Session Management', () => {
    it('should create session with unique ID on game start', () => {
      const config: GameConfiguration = {
        mode: 'find-country',
        difficulty: 'medium',
        questionCount: 2,
      };

      service.startGame(config);

      const session = service.currentSession();
      expect(session).toBeTruthy();
      expect(session!.id).toBeTruthy();
      expect(session!.configuration).toEqual(config);
      expect(session!.startTime).toBeInstanceOf(Date);
      expect(session!.completed).toBe(false);
    });

    it('should update session on game end', async () => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 1,
      });

      service.selectCandidate('US');
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);
      await service.endGame();

      const session = service.currentSession();
      expect(session!.completed).toBe(true);
      expect(session!.endTime).toBeInstanceOf(Date);
      expect(session!.finalScore).toBe(service.score());
      expect(session!.bestStreak).toBeGreaterThanOrEqual(0);
    });

    it('should calculate best streak correctly', async () => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 3,
      });

      // Create a streak of 2, then miss one
      for (let i = 0; i < 2; i++) {
        const correctAnswer = service.currentQuestion()!.correctAnswer;
        service.selectCandidate(correctAnswer);
        service.confirmCandidate();
        vi.advanceTimersByTime(2000);
      }

      // Miss the last one
      const correctAnswer = service.currentQuestion()!.correctAnswer;
      const wrongAnswer = correctAnswer === 'US' ? 'CN' : 'US';
      service.selectCandidate(wrongAnswer);
      service.confirmCandidate();
      vi.advanceTimersByTime(2000);

      await service.endGame();

      const session = service.currentSession();
      expect(session!.bestStreak).toBe(2);
    });
  });

  describe('Reset and Cleanup', () => {
    beforeEach(() => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 1,
      });
      service.selectCandidate('US');
      service.confirmCandidate();
    });

    it('should reset all state to idle', () => {
      service.resetToIdle();

      expect(service.gameState()).toBe('idle');
      expect(service.score()).toBe(0);
      expect(service.streak()).toBe(0);
      expect(service.currentQuestion()).toBeNull();
      expect(service.selectedCandidate()).toBeNull();
      expect(service.questions()).toEqual([]);
      expect(service.results()).toEqual([]);
      expect(service.currentQuestionIndex()).toBe(0);
      expect(service.timeLeft()).toBe(0);
      expect(service.configuration()).toBeNull();
      expect(service.currentSession()).toBeNull();
      expect(mockInteractionModeService.enableExploreMode).toHaveBeenCalled();
    });

    it('should stop timer on reset', () => {
      const timeBeforeReset = service.timeLeft();
      service.resetToIdle();

      vi.advanceTimersByTime(1000);

      expect(service.timeLeft()).toBe(0); // Should not continue from before
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty country data gracefully', () => {
      mockCountryDataService.getAllCountries.mockReturnValue([]);

      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 5,
      });

      // Should fall back to stub questions
      const questions = service.questions();
      expect(questions.length).toBe(5);
      expect(questions[0].correctAnswer).toBe('SAMPLE_COUNTRY_ID');
    });

    it('should handle insufficient countries for difficulty', () => {
      // Mock with only one easy country
      mockCountryDataService.getAllCountries.mockReturnValue([
        mockCountryData[0],
      ]);

      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 5,
      });

      const questions = service.questions();
      expect(questions.length).toBeLessThanOrEqual(1);
    });

    it('should not confirm without selection', () => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 1,
      });

      service.confirmCandidate(); // No selection made

      expect(service.results()).toEqual([]);
      expect(service.gameState()).toBe('question');
    });

    it('should handle rapid successive calls gracefully', () => {
      service.startGame({
        mode: 'find-country',
        difficulty: 'easy',
        questionCount: 1,
      });

      // Rapid successive selections
      service.selectCandidate('US');
      service.selectCandidate('CN');
      service.selectCandidate('MT');

      expect(service.selectedCandidate()).toBe('MT'); // Last one wins

      // Rapid successive confirmations
      service.confirmCandidate();
      service.confirmCandidate(); // Should be ignored

      expect(service.results().length).toBe(1); // Only one result
    });
  });
});
