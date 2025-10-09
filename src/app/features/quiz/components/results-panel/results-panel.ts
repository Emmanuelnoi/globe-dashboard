import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizStateService } from '../../services/quiz-state';

@Component({
  selector: 'app-results-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="results-panel" role="region" aria-label="Quiz Results">
      <!-- Results Header -->
      <header class="results-header">
        <div class="results-icon">
          @if (accuracyPercentage() >= 80) {
            🏆
          } @else if (accuracyPercentage() >= 60) {
            🎉
          } @else {
            📊
          }
        </div>
        <h2>Quiz Complete!</h2>
        <div class="performance-badge" [class]="performanceLevel()">
          {{ performanceText() }}
        </div>
      </header>

      <!-- Score Summary -->
      <div class="score-summary">
        <div class="score-main">
          <div class="final-score">
            <span class="score-value">{{ finalScore() }}</span>
            <span class="score-label">Points</span>
          </div>
          <div class="accuracy-display">
            <span class="accuracy-value">{{ accuracyPercentage() }}%</span>
            <span class="accuracy-label">Accuracy</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{{ correctAnswers() }}</span>
            <span class="stat-label">Correct</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ incorrectAnswers() }}</span>
            <span class="stat-label">Incorrect</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ bestStreak() }}</span>
            <span class="stat-label">Best Streak</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ totalTimeFormatted() }}</span>
            <span class="stat-label">Total Time</span>
          </div>
        </div>
      </div>

      <!-- Question Results -->
      <div class="question-results">
        <h3>Question Results</h3>
        <div class="results-list">
          @for (result of results(); track result.questionId) {
            <div
              class="result-item"
              [class.correct]="result.isCorrect"
              [class.incorrect]="!result.isCorrect"
            >
              <div class="result-icon">
                @if (result.isCorrect) {
                  ✅
                } @else if (result.selectedAnswer === 'SKIPPED') {
                  ⏭️
                } @else {
                  ❌
                }
              </div>
              <div class="result-content">
                <div class="result-question">
                  {{ getQuestionPrompt(result.questionId) }}
                </div>
                <div class="result-details">
                  @if (result.selectedAnswer === 'SKIPPED') {
                    <span class="result-answer skipped">Skipped</span>
                  } @else {
                    <span
                      class="result-answer"
                      [class.correct]="result.isCorrect"
                      [class.incorrect]="!result.isCorrect"
                    >
                      {{ getCountryName(result.selectedAnswer) }}
                    </span>
                  }
                  @if (
                    !result.isCorrect && result.selectedAnswer !== 'SKIPPED'
                  ) {
                    <span class="correct-answer">
                      Correct: {{ getCountryName(result.correctAnswer) }}
                    </span>
                  }
                </div>
              </div>
              <div class="result-stats">
                <div class="result-points">+{{ result.pointsEarned }}</div>
                <div class="result-time">
                  {{ formatTime(result.timeSpent) }}
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="results-actions">
        <button class="action-btn primary-btn" (click)="startNewGame()">
          <span class="btn-icon">🎮</span>
          Play Again
        </button>
        <button class="action-btn secondary-btn" (click)="returnToExplore()">
          <span class="btn-icon">🌍</span>
          Explore Globe
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .results-panel {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        width: 340px;
        max-width: min(340px, calc(100vw - 40px));
        max-height: calc(100vh - 80px);
        min-height: 520px;
        z-index: 130;
        pointer-events: auto;
        box-sizing: border-box;
        overflow-y: auto;

        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.4),
          rgba(0, 0, 0, 0.2)
        );
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 24px;
        backdrop-filter: blur(20px) saturate(1.2);
        -webkit-backdrop-filter: blur(20px) saturate(1.2);
        box-shadow:
          0 20px 40px rgba(0, 0, 0, 0.6),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);

        color: rgba(255, 255, 255, 0.9);
      }

      /* Header Section */
      .results-header {
        text-align: center;
        margin-bottom: 24px;
      }

      .results-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      .results-header h2 {
        margin: 0 0 12px 0;
        font-size: 28px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .performance-badge {
        display: inline-block;
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .performance-badge.excellent {
        background: rgba(0, 255, 100, 0.2);
        color: rgba(0, 255, 100, 0.9);
        border: 1px solid rgba(0, 255, 100, 0.3);
      }

      .performance-badge.good {
        background: rgba(255, 165, 0, 0.2);
        color: rgba(255, 165, 0, 0.9);
        border: 1px solid rgba(255, 165, 0, 0.3);
      }

      .performance-badge.needs-improvement {
        background: rgba(255, 100, 100, 0.2);
        color: rgba(255, 100, 100, 0.9);
        border: 1px solid rgba(255, 100, 100, 0.3);
      }

      /* Score Summary */
      .score-summary {
        margin-bottom: 24px;
      }

      .score-main {
        display: flex;
        justify-content: center;
        gap: 40px;
        margin-bottom: 20px;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .final-score,
      .accuracy-display {
        text-align: center;
      }

      .score-value,
      .accuracy-value {
        display: block;
        font-size: 32px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 4px;
      }

      .score-label,
      .accuracy-label {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }

      .stat-item {
        text-align: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .stat-value {
        display: block;
        font-size: 20px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Question Results */
      .question-results {
        margin-bottom: 24px;
      }

      .question-results h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .results-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 300px;
        overflow-y: auto;
        padding-right: 8px;
      }

      .result-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: all 0.2s ease;
      }

      .result-item:hover {
        background: rgba(255, 255, 255, 0.06);
      }

      .result-item.correct {
        border-color: rgba(0, 255, 100, 0.2);
        background: rgba(0, 255, 100, 0.05);
      }

      .result-item.incorrect {
        border-color: rgba(255, 100, 100, 0.2);
        background: rgba(255, 100, 100, 0.05);
      }

      .result-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .result-content {
        flex: 1;
        min-width: 0;
      }

      .result-question {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .result-details {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: 12px;
      }

      .result-answer.correct {
        color: rgba(0, 255, 100, 0.9);
        font-weight: 500;
      }

      .result-answer.incorrect {
        color: rgba(255, 100, 100, 0.9);
        font-weight: 500;
      }

      .result-answer.skipped {
        color: rgba(255, 165, 0, 0.9);
        font-weight: 500;
      }

      .correct-answer {
        color: rgba(255, 255, 255, 0.7);
      }

      .result-stats {
        text-align: right;
        flex-shrink: 0;
      }

      .result-points {
        font-size: 14px;
        font-weight: 600;
        color: rgba(100, 200, 255, 0.9);
        margin-bottom: 2px;
      }

      .result-time {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
      }

      /* Action Buttons */
      .results-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .action-btn {
        padding: 14px 24px;
        font-size: 16px;
        font-weight: 600;
        border-radius: 10px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 140px;
        justify-content: center;
      }

      .primary-btn {
        background: linear-gradient(
          135deg,
          rgba(100, 200, 255, 0.2),
          rgba(50, 150, 255, 0.1)
        );
        border-color: rgba(100, 200, 255, 0.3);
        color: rgba(255, 255, 255, 0.9);
      }

      .primary-btn:hover {
        border-color: rgba(100, 200, 255, 0.5);
        background: linear-gradient(
          135deg,
          rgba(100, 200, 255, 0.3),
          rgba(50, 150, 255, 0.2)
        );
        transform: translateY(-1px);
      }

      .secondary-btn {
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.1),
          rgba(255, 255, 255, 0.05)
        );
        border-color: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.9);
      }

      .secondary-btn:hover {
        border-color: rgba(255, 255, 255, 0.3);
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.15),
          rgba(255, 255, 255, 0.08)
        );
        transform: translateY(-1px);
      }

      .btn-icon {
        font-size: 18px;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .results-panel {
          top: 10px !important;
          right: 10px !important;
          left: 10px !important;
          width: auto;
          max-width: calc(100vw - 20px);
          padding: 16px;
          max-height: calc(100vh - 20px);
        }

        .score-main {
          flex-direction: column;
          gap: 20px;
        }

        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .result-question {
          white-space: normal;
          overflow: visible;
        }

        .results-actions {
          flex-direction: column;
        }

        .action-btn {
          width: 100%;
          min-width: unset;
        }
      }

      /* Scrollbar Styling */
      .results-list::-webkit-scrollbar {
        width: 6px;
      }

      .results-list::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }

      .results-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }

      .results-list::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `,
  ],
})
export class ResultsPanel {
  private readonly quizStateService = inject(QuizStateService);

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
  readonly totalQuestions = computed(() => this.results().length);

  readonly accuracyPercentage = computed(() => {
    const total = this.totalQuestions();
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

  /**
   * Get question prompt by question ID
   */
  getQuestionPrompt(questionId: string): string {
    const question = this.questions().find((q) => q.id === questionId);
    return question?.prompt || 'Question';
  }

  /**
   * Get country name from country ID (simplified - could be enhanced with country service)
   */
  getCountryName(countryId: string): string {
    const question = this.questions().find(
      (q) => q.correctAnswer === countryId,
    );
    return question?.metadata?.['countryName'] || countryId;
  }

  /**
   * Format time in milliseconds to MM:SS format
   */
  formatTime(timeMs: number): string {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Start a new game with the same configuration
   */
  startNewGame(): void {
    const currentSession = this.quizStateService.currentSession();
    if (currentSession?.configuration) {
      this.quizStateService.resetToIdle();
      // Small delay to ensure state is reset
      setTimeout(() => {
        this.quizStateService.startGame(currentSession.configuration);
      }, 100);
    }
  }

  /**
   * Return to explore mode
   */
  returnToExplore(): void {
    this.quizStateService.resetToIdle();
  }
}
