import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizStateService } from '../../services/quiz-state';
import { StatsPanelComponent } from '../stats-panel/stats-panel';
import {
  GameMode,
  Difficulty,
  GameConfiguration,
} from '../../models/quiz.models';
import { LoggerService } from '@/core/services/logger.service';

@Component({
  selector: 'app-game-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, StatsPanelComponent],
  templateUrl: './game-hub.component.html',
  styleUrl: './game-hub.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameHub {
  private readonly quizStateService = inject(QuizStateService);
  private readonly logger = inject(LoggerService);

  // Form state signals
  readonly selectedMode = signal<GameMode>('find-country');
  readonly selectedDifficulty = signal<Difficulty>('easy');
  readonly questionCount = signal<number>(10);
  readonly isStarting = signal<boolean>(false);
  readonly showStats = signal<boolean>(false);

  // Collapse state
  private readonly _isCollapsed = signal<boolean>(false);
  readonly isCollapsed = this._isCollapsed.asReadonly();

  // Available options
  readonly availableModes: Array<{
    value: GameMode;
    label: string;
    enabled: boolean;
  }> = [
    { value: 'find-country', label: 'Find Country', enabled: true },
    { value: 'capital-match', label: 'Capital Match', enabled: true },
    { value: 'flag-id', label: 'Flag ID', enabled: true },
    { value: 'facts-guess', label: 'Facts Guess', enabled: true },
  ];

  readonly difficulties: Array<{
    value: Difficulty;
    label: string;
    description: string;
  }> = [
    { value: 'easy', label: 'Easy', description: '60 seconds per question' },
    {
      value: 'medium',
      label: 'Medium',
      description: '45 seconds per question',
    },
    { value: 'hard', label: 'Hard', description: '30 seconds per question' },
  ];

  readonly questionCountOptions = [5, 10, 15, 20];

  // Quiz state getters
  readonly finalScore = computed(
    () => this.quizStateService.currentSession()?.finalScore || 0,
  );
  readonly results = computed(() => this.quizStateService.results());
  readonly bestStreak = computed(
    () => this.quizStateService.currentSession()?.bestStreak || 0,
  );
  readonly questions = computed(() => this.quizStateService.questions());

  // Computed statistics
  readonly correctAnswers = computed(
    () => this.results().filter((r) => r.isCorrect).length,
  );
  readonly incorrectAnswers = computed(
    () => this.results().length - this.correctAnswers(),
  );

  readonly accuracyPercentage = computed(() => {
    const total = this.results().length;
    return total > 0 ? Math.round((this.correctAnswers() / total) * 100) : 0;
  });

  readonly performanceLevel = computed(() => {
    const accuracy = this.accuracyPercentage();
    if (accuracy >= 80) return 'excellent';
    if (accuracy >= 60) return 'good';
    return 'needs-improvement';
  });

  readonly performanceText = computed(() => {
    const level = this.performanceLevel();
    switch (level) {
      case 'excellent':
        return 'Excellent!';
      case 'good':
        return 'Good Job!';
      default:
        return 'Keep Practicing!';
    }
  });

  readonly totalTimeFormatted = computed(() => {
    const session = this.quizStateService.currentSession();
    if (!session?.startTime || !session?.endTime) return '0:00';

    const totalMs = session.endTime.getTime() - session.startTime.getTime();
    return this.formatTime(totalMs);
  });

  // Start game with form configuration
  async startGame(): Promise<void> {
    if (this.isStarting()) return;

    const mode = this.selectedMode();
    if (!this.availableModes.find((m) => m.value === mode)?.enabled) {
      this.logger.warn('Selected mode is not available:', mode, 'GameHub');
      return;
    }

    this.isStarting.set(true);

    try {
      const config: GameConfiguration = {
        mode: this.selectedMode(),
        difficulty: this.selectedDifficulty(),
        questionCount: this.questionCount(),
      };

      this.quizStateService.startGame(config);
    } catch (error) {
      this.logger.error('Failed to start game:', error, 'GameHub');
    } finally {
      // Reset loading state after a short delay
      setTimeout(() => this.isStarting.set(false), 1000);
    }
  }

  // Form validation
  get isFormValid(): boolean {
    const mode = this.selectedMode();
    const enabledMode = this.availableModes.find(
      (m) => m.value === mode,
    )?.enabled;
    return enabledMode === true;
  }

  // Reset game
  resetGame(): void {
    this.quizStateService.resetToIdle();
    this.isStarting.set(false);
  }

  // Form handlers
  onModeChange(mode: GameMode): void {
    this.selectedMode.set(mode);
  }

  onDifficultyChange(difficulty: Difficulty): void {
    this.selectedDifficulty.set(difficulty);
  }

  onQuestionCountChange(count: number): void {
    this.questionCount.set(count);
  }

  // Utility methods
  getQuestionPrompt(questionId: string): string {
    const question = this.questions().find((q) => q.id === questionId);
    return question?.prompt || 'Question';
  }

  getCountryName(countryId: string): string {
    const question = this.questions().find(
      (q) => q.correctAnswer === countryId,
    );
    return question?.metadata?.['countryName'] || countryId;
  }

  formatTime(timeMs: number): string {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  startNewGame(): void {
    const currentSession = this.quizStateService.currentSession();
    if (currentSession?.configuration) {
      this.showStats.set(false);
      this.quizStateService.resetToIdle();
      // Small delay to ensure state is reset
      setTimeout(() => {
        this.quizStateService.startGame(currentSession.configuration);
      }, 100);
    }
  }

  // Stats panel methods
  toggleStats(): void {
    this.showStats.update((current) => !current);
  }

  hideStats(): void {
    this.showStats.set(false);
  }

  // Collapse methods
  toggleCollapse(): void {
    this._isCollapsed.update((collapsed) => !collapsed);
  }

  // Quiz HUD computed values
  readonly currentQuestionNumber = computed(
    () => this.quizStateService.currentQuestionIndex() + 1,
  );
  readonly totalQuestions = computed(
    () => this.quizStateService.questions().length,
  );
  readonly progressPercentage = computed(
    () => this.quizStateService.progress() * 100,
  );
  readonly timeLeftSeconds = computed(() =>
    Math.ceil(this.quizStateService.timeLeft() / 1000),
  );

  // Timer circle calculation (circumference = 2πr = 2π26 ≈ 163)
  readonly timerDashOffset = computed(() => {
    const progress = this.quizStateService.timeProgress();
    return 163 * (1 - progress);
  });

  // Quiz state methods
  readonly canConfirm = computed(() => this.quizStateService.canConfirm());
  readonly isConfirmLocked = computed(() =>
    this.quizStateService.isConfirmLocked(),
  );

  // Screen reader status
  readonly screenReaderStatus = computed(() => {
    const state = this.quizStateService.gameState();
    const question = this.quizStateService.currentQuestion();
    const timeLeft = this.timeLeftSeconds();
    const selected = this.quizStateService.selectedCandidate();

    if (state === 'question' && question) {
      const selectionText = selected
        ? `Selected: ${selected}. `
        : 'No selection. ';
      return `${question.prompt} ${selectionText}Time remaining: ${timeLeft} seconds.`;
    }

    return '';
  });

  // Quiz action methods
  confirmAnswer(): void {
    if (this.quizStateService.canConfirm()) {
      this.quizStateService.confirmCandidate();
    }
  }

  clearSelection(): void {
    this.quizStateService.clearCandidate();
  }

  skipQuestion(): void {
    this.quizStateService.skipQuestion();
  }

  stopGame(): void {
    this.quizStateService.resetToIdle();
  }

  returnToExplore(): void {
    this.quizStateService.resetToIdle();
  }

  // Multiple choice methods
  isMultipleChoiceMode(): boolean {
    const mode = this.quizStateService.configuration()?.mode;
    return (
      mode === 'capital-match' || mode === 'flag-id' || mode === 'facts-guess'
    );
  }

  selectChoice(choice: string): void {
    if (!this.quizStateService.isConfirmLocked()) {
      this.quizStateService.selectCandidate(choice);
    }
  }

  onFlagError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjYwIiB2aWV3Qm94PSIwIDAgMTAwIDYwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNjAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RmxhZzwvdGV4dD48L3N2Zz4=';
    img.alt = 'Flag not available';
  }

  // Getters for template access to signals
  get gameState(): typeof this.quizStateService.gameState {
    return this.quizStateService.gameState;
  }
  get score(): typeof this.quizStateService.score {
    return this.quizStateService.score;
  }
  get streak(): typeof this.quizStateService.streak {
    return this.quizStateService.streak;
  }
  get timeLeft(): typeof this.quizStateService.timeLeft {
    return this.quizStateService.timeLeft;
  }
  get currentQuestion(): typeof this.quizStateService.currentQuestion {
    return this.quizStateService.currentQuestion;
  }
  get selectedCandidate(): typeof this.quizStateService.selectedCandidate {
    return this.quizStateService.selectedCandidate;
  }
}
