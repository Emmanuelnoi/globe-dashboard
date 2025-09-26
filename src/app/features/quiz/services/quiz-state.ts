import {
  Injectable,
  signal,
  computed,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  GameMode,
  Difficulty,
  GameState,
  Question,
  QuestionResult,
  GameConfiguration,
  GameSession,
} from '../models/quiz.models';
import { InteractionModeService } from '../../../core/services/interaction-mode';
import { CountryDataService } from '../../../core/services/country-data.service';
import { CountryDataRecord } from '../../../core/types/country-data.types';
import { QuestionGeneratorService } from './question-generator.service';
import { UserStatsService } from '../../../core/services/user-stats.service';

// Timer configuration
const QUESTION_TIME_LIMITS = {
  easy: 60000, // 60 seconds
  medium: 45000, // 45 seconds
  hard: 30000, // 30 seconds
} as const;

// Scoring configuration
const BASE_POINTS = {
  easy: 100,
  medium: 200,
  hard: 400,
} as const;

@Injectable({
  providedIn: 'root',
})
export class QuizStateService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly interactionModeService = inject(InteractionModeService);
  private readonly countryDataService = inject(CountryDataService);
  private readonly questionGeneratorService = inject(QuestionGeneratorService);
  private readonly userStatsService = inject(UserStatsService);
  private timerAnimationFrame?: number;
  private questionStartTime = 0;
  private sessionStartTime = 0;

  // Private signals for internal state management
  private readonly _gameState = signal<GameState>('idle');
  private readonly _currentQuestion = signal<Question | null>(null);
  private readonly _selectedCandidate = signal<string | null>(null);
  private readonly _timeLeft = signal<number>(0);
  private readonly _score = signal<number>(0);
  private readonly _streak = signal<number>(0);
  private readonly _currentQuestionIndex = signal<number>(0);
  private readonly _questions = signal<Question[]>([]);
  private readonly _results = signal<QuestionResult[]>([]);
  private readonly _configuration = signal<GameConfiguration | null>(null);
  private readonly _isConfirmLocked = signal<boolean>(false);
  private readonly _currentSession = signal<GameSession | null>(null);

  // Public readonly signals for components to subscribe to
  readonly gameState = this._gameState.asReadonly();
  readonly currentQuestion = this._currentQuestion.asReadonly();
  readonly selectedCandidate = this._selectedCandidate.asReadonly();
  readonly timeLeft = this._timeLeft.asReadonly();
  readonly score = this._score.asReadonly();
  readonly streak = this._streak.asReadonly();
  readonly currentQuestionIndex = this._currentQuestionIndex.asReadonly();
  readonly questions = this._questions.asReadonly();
  readonly results = this._results.asReadonly();
  readonly configuration = this._configuration.asReadonly();
  readonly isConfirmLocked = this._isConfirmLocked.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();

  // Computed values
  readonly isPlaying = computed(
    () => this._gameState() === 'playing' || this._gameState() === 'question',
  );
  readonly canConfirm = computed(
    () =>
      this._selectedCandidate() !== null &&
      this._gameState() === 'question' &&
      !this._isConfirmLocked(),
  );
  readonly questionsComplete = computed(
    () => this._currentQuestionIndex() >= this._questions().length,
  );
  readonly progress = computed(() => {
    const total = this._questions().length;
    return total > 0 ? (this._currentQuestionIndex() + 1) / total : 0;
  });
  readonly timeProgress = computed(() => {
    const config = this._configuration();
    const timeLeft = this._timeLeft();
    if (!config) return 0;
    const totalTime = QUESTION_TIME_LIMITS[config.difficulty];
    return Math.max(0, timeLeft / totalTime);
  });

  constructor() {
    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.stopTimer();
    });
  }

  /**
   * Start a new game session
   */
  startGame(config: GameConfiguration): void {
    if (this._gameState() !== 'idle') {
      console.warn('Cannot start game: already in progress');
      return;
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();
    this.sessionStartTime = Date.now();

    // Create session
    const session: GameSession = {
      id: sessionId,
      configuration: config,
      questions: this.generateQuestions(config),
      results: [],
      startTime: new Date(this.sessionStartTime),
      finalScore: 0,
      bestStreak: 0,
      completed: false,
    };

    // Initialize state
    this._configuration.set(config);
    this._currentSession.set(session);
    this._questions.set(session.questions);
    this._results.set([]);
    this._score.set(0);
    this._streak.set(0);
    this._currentQuestionIndex.set(0);
    this._selectedCandidate.set(null);
    this._isConfirmLocked.set(false);

    // Switch to quiz interaction mode
    this.interactionModeService.enableQuizMode();

    // Transition to playing state
    this.transitionToState('playing');

    // Load first question
    this.loadNextQuestion();
  }

  /**
   * Select a candidate answer (country ID)
   */
  selectCandidate(countryId: string): void {
    if (this._gameState() !== 'question') {
      console.warn('Cannot select candidate: not in question state');
      return;
    }

    if (this._isConfirmLocked()) {
      console.warn('Cannot select candidate: confirmation locked');
      return;
    }

    this._selectedCandidate.set(countryId);
  }

  /**
   * Clear the selected candidate
   */
  clearCandidate(): void {
    if (this._gameState() !== 'question' || this._isConfirmLocked()) {
      return;
    }

    this._selectedCandidate.set(null);
  }

  /**
   * Confirm the selected candidate as the final answer
   */
  confirmCandidate(): void {
    const selectedCandidate = this._selectedCandidate();
    const currentQuestion = this._currentQuestion();

    if (!this.canConfirm() || !selectedCandidate || !currentQuestion) {
      console.warn('Cannot confirm: invalid state');
      return;
    }

    // Lock confirmation to prevent double submission
    this._isConfirmLocked.set(true);
    this.stopTimer();

    // Calculate time spent
    const timeSpent = Date.now() - this.questionStartTime;

    // Evaluate answer
    const isCorrect = selectedCandidate === currentQuestion.correctAnswer;

    // Calculate score
    const points = this.calculateScore(isCorrect, timeSpent);

    // Update streak
    const newStreak = isCorrect ? this._streak() + 1 : 0;
    this._streak.set(newStreak);

    // Update score
    this._score.update((current) => current + points);

    // Record result
    const result: QuestionResult = {
      questionId: currentQuestion.id,
      selectedAnswer: selectedCandidate,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
      timeSpent,
      pointsEarned: points,
      streakAtTime: newStreak,
    };

    this._results.update((results) => [...results, result]);

    // Transition to evaluating state
    this.transitionToState('evaluating');

    // Show result for 2 seconds, then continue
    setTimeout(async () => await this.proceedAfterResult(), 2000);
  }

  /**
   * Skip the current question
   */
  skipQuestion(): void {
    if (this._gameState() !== 'question') {
      return;
    }

    const currentQuestion = this._currentQuestion();
    if (!currentQuestion) return;

    this.stopTimer();

    // Record as incorrect with 0 points
    const result: QuestionResult = {
      questionId: currentQuestion.id,
      selectedAnswer: 'SKIPPED',
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: false,
      timeSpent: Date.now() - this.questionStartTime,
      pointsEarned: 0,
      streakAtTime: 0,
    };

    this._results.update((results) => [...results, result]);
    this._streak.set(0);
    this._isConfirmLocked.set(false);

    // Transition through evaluating state first, then proceed
    this.transitionToState('evaluating');
    // Handle async call properly for skip
    this.proceedAfterResult().catch((error) => {
      console.error('Error proceeding after skip:', error);
    });
  }

  /**
   * End the current game session
   */
  async endGame(): Promise<void> {
    const session = this._currentSession();
    if (!session) return;

    this.stopTimer();

    // Update session with final results
    const finalSession: GameSession = {
      ...session,
      results: this._results(),
      endTime: new Date(),
      finalScore: this._score(),
      bestStreak: Math.max(...this._results().map((r) => r.streakAtTime), 0),
      completed: true,
    };

    this._currentSession.set(finalSession);

    // First show results
    this.transitionToState('results');

    // Save session to persistent storage
    try {
      await this.userStatsService.saveSession(finalSession);
      console.log('📊 Session saved to IndexedDB successfully');
    } catch (error) {
      console.error('❌ Failed to save session to IndexedDB:', error);
      // Don't block the UI flow if saving fails
    }

    // Then transition to ended state
    this.transitionToState('ended');

    // Switch back to explore interaction mode
    this.interactionModeService.enableExploreMode();
  }

  /**
   * Reset to idle state for new game
   */
  resetToIdle(): void {
    this.stopTimer();

    // Switch back to explore interaction mode
    this.interactionModeService.enableExploreMode();

    this._gameState.set('idle');
    this._currentQuestion.set(null);
    this._selectedCandidate.set(null);
    this._timeLeft.set(0);
    this._score.set(0);
    this._streak.set(0);
    this._currentQuestionIndex.set(0);
    this._questions.set([]);
    this._results.set([]);
    this._configuration.set(null);
    this._isConfirmLocked.set(false);
    this._currentSession.set(null);
  }

  // ========== PRIVATE METHODS ==========

  private transitionToState(newState: GameState): void {
    const currentState = this._gameState();

    // Validate state transitions
    const validTransitions: Record<GameState, GameState[]> = {
      idle: ['playing'],
      playing: ['question'],
      question: ['evaluating'],
      evaluating: ['results', 'question'],
      results: ['ended', 'question'],
      ended: ['idle'],
    };

    if (!validTransitions[currentState].includes(newState)) {
      console.error(`Invalid state transition: ${currentState} -> ${newState}`);
      return;
    }

    this._gameState.set(newState);
  }

  private loadNextQuestion(): void {
    const questions = this._questions();
    const currentIndex = this._currentQuestionIndex();

    if (currentIndex >= questions.length) {
      // No more questions, show results
      this.transitionToState('results');
      return;
    }

    const question = questions[currentIndex];
    this._currentQuestion.set(question);
    this._selectedCandidate.set(null);
    this._isConfirmLocked.set(false);

    // Start timer
    const config = this._configuration();
    if (config) {
      const timeLimit = QUESTION_TIME_LIMITS[config.difficulty];
      this._timeLeft.set(timeLimit);
      this.startTimer();
    }

    this.transitionToState('question');
    this.questionStartTime = Date.now();
  }

  private async proceedAfterResult(): Promise<void> {
    this._currentQuestionIndex.update((i) => i + 1);

    if (this.questionsComplete()) {
      // All questions complete, end the game and save session
      await this.endGame();
    } else {
      this.loadNextQuestion();
    }
  }

  private startTimer(): void {
    this.stopTimer(); // Ensure no duplicate timers

    const config = this._configuration();
    if (!config) return;

    const timeLimit = QUESTION_TIME_LIMITS[config.difficulty];
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, timeLimit - elapsed);

      this._timeLeft.set(remaining);

      if (remaining <= 0) {
        // Time's up! Auto-skip question
        this.skipQuestion();
        return;
      }

      this.timerAnimationFrame = requestAnimationFrame(tick);
    };

    this.timerAnimationFrame = requestAnimationFrame(tick);
  }

  private stopTimer(): void {
    if (this.timerAnimationFrame) {
      cancelAnimationFrame(this.timerAnimationFrame);
      this.timerAnimationFrame = undefined;
    }
  }

  private calculateScore(isCorrect: boolean, timeSpent: number): number {
    const config = this._configuration();
    if (!isCorrect || !config) return 0;

    const basePoints = BASE_POINTS[config.difficulty];
    const timeLimit = QUESTION_TIME_LIMITS[config.difficulty];
    const timeRemaining = Math.max(0, timeLimit - timeSpent);

    // Time bonus: up to 50% of base points based on time remaining
    const timeBonusRatio = timeRemaining / timeLimit;
    const timeBonus = Math.round(basePoints * 0.5 * timeBonusRatio);

    return basePoints + timeBonus;
  }

  private generateQuestions(config: GameConfiguration): Question[] {
    // Use the dedicated QuestionGeneratorService
    return this.questionGeneratorService.generateSession(
      config.mode,
      config.difficulty,
      config.questionCount,
      config.seed,
    );
  }
}
