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
    setTimeout(() => this.proceedAfterResult(), 2000);
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
    this.proceedAfterResult();
  }

  /**
   * End the current game session
   */
  endGame(): void {
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

  private proceedAfterResult(): void {
    this._currentQuestionIndex.update((i) => i + 1);

    if (this.questionsComplete()) {
      this.transitionToState('results');
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
    if (config.mode === 'find-country') {
      return this.generateFindCountryQuestions(config);
    }

    // Fallback for other modes (Sprint 2)
    console.warn(
      `Mode ${config.mode} not implemented yet, using stub questions`,
    );
    return this.generateStubQuestions(config);
  }

  private generateFindCountryQuestions(config: GameConfiguration): Question[] {
    // Get all available countries from the data service
    const allCountries = this.countryDataService.getAllCountries();

    if (allCountries.length === 0) {
      console.error('No countries available for quiz generation');
      return this.generateStubQuestions(config);
    }

    // Filter countries based on difficulty
    const eligibleCountries = this.filterCountriesByDifficulty(
      allCountries,
      config.difficulty,
    );

    if (eligibleCountries.length < config.questionCount) {
      console.warn(
        `Not enough eligible countries (${eligibleCountries.length}) for requested questions (${config.questionCount}). Using all available.`,
      );
    }

    // Randomly select unique countries for questions
    const selectedCountries = this.selectRandomCountries(
      eligibleCountries,
      config.questionCount,
    );

    // Generate questions from selected countries
    const questions: Question[] = selectedCountries.map((country, index) => {
      const questionPrompt = this.generateFindCountryPrompt(
        country,
        config.difficulty,
      );

      return {
        id: `find_country_${index + 1}`,
        type: 'find-country',
        prompt: questionPrompt,
        correctAnswer: country.id,
        metadata: {
          countryId: country.id,
          countryName: country.name,
          capital: country.capital,
          region: country.region,
          population: country.population,
          difficulty: config.difficulty,
        },
      };
    });

    return questions;
  }

  private filterCountriesByDifficulty(
    countries: readonly CountryDataRecord[],
    difficulty: Difficulty,
  ): CountryDataRecord[] {
    // Filter logic based on difficulty:
    // Easy: Larger, well-known countries (population > 10M)
    // Medium: Mix of medium and large countries (population > 1M)
    // Hard: All countries including small ones

    switch (difficulty) {
      case 'easy':
        return [
          ...countries.filter(
            (country) =>
              country.population > 10_000_000 ||
              [
                'United States',
                'China',
                'Russia',
                'Canada',
                'Brazil',
                'Australia',
                'India',
                'Mexico',
              ].includes(country.name),
          ),
        ];

      case 'medium':
        return [
          ...countries.filter(
            (country) =>
              country.population > 1_000_000 ||
              ['Luxembourg', 'Malta', 'Iceland', 'Singapore'].includes(
                country.name,
              ),
          ),
        ];

      case 'hard':
        return [...countries]; // All countries available for hard difficulty

      default:
        return [...countries];
    }
  }

  private selectRandomCountries(
    countries: CountryDataRecord[],
    count: number,
  ): CountryDataRecord[] {
    // Shuffle and select unique countries
    const shuffled = [...countries].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, countries.length));
  }

  private generateFindCountryPrompt(
    country: CountryDataRecord,
    difficulty: Difficulty,
  ): string {
    // Generate different types of prompts based on available data and difficulty
    const prompts: string[] = [];

    // Capital-based prompts (most common)
    if (country.capital && country.capital !== 'N/A') {
      prompts.push(`Find the country whose capital is ${country.capital}`);
    }

    // Region-based prompts (for variety)
    if (country.region) {
      prompts.push(`Find this ${country.region} country: ${country.name}`);
    }

    // Population-based prompts (for larger countries)
    if (difficulty !== 'easy' && country.population > 50_000_000) {
      const popFormatted =
        country.populationFormatted ||
        `${Math.round(country.population / 1_000_000)}M+`;
      prompts.push(
        `Find the country with approximately ${popFormatted} people: ${country.name}`,
      );
    }

    // GDP-based prompts (for countries with data)
    if (
      difficulty === 'hard' &&
      country.gdpPerCapita &&
      country.gdpPerCapita > 30000
    ) {
      prompts.push(`Find this high-income country: ${country.name}`);
    }

    // Regional context prompts
    if (country.subregion) {
      prompts.push(`Find this ${country.subregion} country: ${country.name}`);
    }

    // Fallback to simple prompt
    if (prompts.length === 0) {
      prompts.push(`Find the country: ${country.name}`);
    }

    // Select random prompt for variety
    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    // For hard difficulty, sometimes make it more challenging by removing the country name
    if (
      difficulty === 'hard' &&
      Math.random() < 0.3 &&
      country.capital &&
      country.capital !== 'N/A'
    ) {
      return `Find the country whose capital is ${country.capital}`;
    }

    return selectedPrompt;
  }

  private generateStubQuestions(config: GameConfiguration): Question[] {
    const questions: Question[] = [];

    for (let i = 0; i < config.questionCount; i++) {
      questions.push({
        id: `stub_q_${i + 1}`,
        type: config.mode,
        prompt: `Find Country Question ${i + 1} (${config.difficulty}) - Coming Soon`,
        correctAnswer: 'SAMPLE_COUNTRY_ID',
        metadata: {
          countryId: 'SAMPLE_COUNTRY_ID',
          isStub: true,
        },
      });
    }

    return questions;
  }
}
