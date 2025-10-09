import {
  ChangeDetectionStrategy,
  Component,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizStateService } from '../../services/quiz-state';

@Component({
  selector: 'app-quiz-hud',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quiz-hud" role="complementary" aria-label="Quiz game controls">
      <!-- ARIA Live Regions for Screen Readers -->
      <div
        class="sr-only"
        aria-live="polite"
        aria-atomic="true"
        [attr.aria-label]="screenReaderStatus()"
      ></div>

      <!-- Header with Progress and Timer -->
      <header class="hud-header">
        <!-- Progress Indicator -->
        <div class="progress-section">
          <div class="progress-text">
            Question {{ currentQuestionNumber() }} of {{ totalQuestions() }}
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              [style.width.%]="progressPercentage()"
              role="progressbar"
              [attr.aria-valuenow]="currentQuestionNumber()"
              [attr.aria-valuemax]="totalQuestions()"
              [attr.aria-label]="
                'Question progress: ' +
                currentQuestionNumber() +
                ' of ' +
                totalQuestions()
              "
            ></div>
          </div>
        </div>

        <!-- Timer Display -->
        <div class="timer-section">
          <div class="timer-display">
            <svg
              class="timer-circle"
              width="60"
              height="60"
              viewBox="0 0 60 60"
            >
              <!-- Background circle -->
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                stroke-width="3"
              />
              <!-- Progress circle -->
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="rgba(100,200,255,0.8)"
                stroke-width="3"
                stroke-linecap="round"
                [style.stroke-dasharray]="163"
                [style.stroke-dashoffset]="timerDashOffset()"
                [class.timer-warning]="timeLeftSeconds() <= 10"
                [class.timer-critical]="timeLeftSeconds() <= 5"
                transform="rotate(-90 30 30)"
              />
            </svg>
            <div class="timer-text">
              <span class="timer-seconds">{{ timeLeftSeconds() }}</span>
              <span class="timer-label">sec</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Question Prompt -->
      <div class="question-section">
        <div
          class="question-prompt"
          [attr.aria-live]="
            quizState.gameState() === 'question' ? 'polite' : 'off'
          "
        >
          @if (quizState.currentQuestion()) {
            {{ quizState.currentQuestion()!.prompt }}
          }
        </div>
      </div>

      <!-- Selected Candidate Display -->
      <div class="selection-section">
        @if (quizState.selectedCandidate()) {
          <div class="selected-candidate" role="status" aria-live="polite">
            <span class="selection-label">Selected</span>
            <!-- <span class="selection-value">{{ quizState.selectedCandidate() }}</span> -->
          </div>
        } @else {
          <div class="no-selection" role="status" aria-live="polite">
            <span class="selection-hint"
              >Click a country on the globe to select it</span
            >
          </div>
        }
      </div>

      <!-- Action Buttons -->
      <div class="actions-section">
        <div class="action-buttons" role="toolbar" aria-label="Quiz actions">
          <!-- Confirm Button -->
          <button
            class="action-btn confirm-btn"
            [disabled]="!quizState.canConfirm()"
            [class.locked]="quizState.isConfirmLocked()"
            (click)="confirmAnswer()"
            [attr.aria-busy]="quizState.isConfirmLocked()"
            type="button"
          >
            @if (quizState.isConfirmLocked()) {
              <span class="btn-spinner">🔄</span>
              Processing...
            } @else {
              <span class="btn-icon">✓</span>
              Confirm
            }
          </button>

          <!-- Clear Button -->
          <button
            class="action-btn clear-btn"
            [disabled]="
              !quizState.selectedCandidate() || quizState.isConfirmLocked()
            "
            (click)="clearSelection()"
            type="button"
          >
            <span class="btn-icon">✗</span>
            Clear
          </button>

          <!-- Skip Button -->
          <button
            class="action-btn skip-btn"
            [disabled]="quizState.isConfirmLocked()"
            (click)="skipQuestion()"
            type="button"
          >
            <span class="btn-icon">⏭</span>
            Skip
          </button>
        </div>
      </div>

      <!-- Score Display -->
      <div class="score-section">
        <div class="score-display">
          <div class="score-item">
            <span class="score-label">Score</span>
            <span class="score-value">{{ quizState.score() }}</span>
          </div>
          <div class="score-item">
            <span class="score-label">Streak</span>
            <span
              class="score-value"
              [class.streak-active]="quizState.streak() > 0"
            >
              {{ quizState.streak() }}
              @if (quizState.streak() > 2) {
                🔥
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* Screen reader only content */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .quiz-hud {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        width: 300px;
        max-width: min(300px, calc(100vw - 40px));
        max-height: calc(100vh - 80px);
        min-height: 520px;
        z-index: 130;
        pointer-events: auto;
        box-sizing: border-box;
        overflow-y: auto;

        border-radius: 12px;
        padding: 20px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.08),
          rgba(255, 255, 255, 0.03)
        );
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(16px) saturate(1.2);
        -webkit-backdrop-filter: blur(16px) saturate(1.2);
        box-shadow:
          0 12px 28px rgba(0, 0, 0, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.04);

        display: flex;
        flex-direction: column;
        gap: 12px;
        color: rgba(255, 255, 255, 0.9);
        height: 100%;
        overflow-y: auto;
      }

      /* Header Section */
      .hud-header {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 6px;
        flex-shrink: 0;
      }

      /* Progress Section */
      .progress-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 8px;
        flex-shrink: 0;
      }

      .progress-text {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.8);
      }

      .progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #64c8ff, #3b82f6);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      /* Timer Section */
      .timer-section {
        display: flex;
        justify-content: center;
      }

      .timer-display {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .timer-circle {
        transform: rotate(-90deg);
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }

      .timer-circle circle {
        transition: stroke-dashoffset 0.1s linear;
      }

      .timer-circle circle.timer-warning {
        stroke: rgba(255, 165, 0, 0.9);
      }

      .timer-circle circle.timer-critical {
        stroke: rgba(255, 69, 58, 0.9);
        animation: pulse 0.5s ease-in-out infinite alternate;
      }

      .timer-text {
        position: absolute;
        text-align: center;
        font-weight: 700;
      }

      .timer-seconds {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.95);
        display: block;
      }

      .timer-label {
        font-size: 9px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      @keyframes pulse {
        from {
          opacity: 1;
        }
        to {
          opacity: 0.6;
        }
      }

      /* Question Section */
      .question-section {
        text-align: center;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        margin: 8px 0;
        flex-shrink: 0;
      }

      .question-prompt {
        font-size: 15px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        line-height: 1.3;
        min-height: 40px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        white-space: normal;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Selection Section */
      .selection-section {
        display: flex;
        justify-content: center;
        min-height: 36px;
        align-items: center;
        margin: 8px 0;
        flex-shrink: 0;
      }

      .selected-candidate {
        padding: 6px 12px;
        background: rgba(0, 255, 100, 0.1);
        border: 1px solid rgba(0, 255, 100, 0.3);
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .selection-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        font-weight: 500;
      }

      .selection-value {
        font-size: 14px;
        color: rgba(0, 255, 100, 0.9);
        font-weight: 600;
      }

      .no-selection {
        padding: 6px 12px;
      }

      .selection-hint {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
      }

      /* Actions Section */
      .actions-section {
        display: flex;
        justify-content: center;
        flex-shrink: 0;
      }

      .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
        margin-top: 6px;
      }

      .action-btn {
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 8px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        justify-content: center;
        min-height: 40px;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.1),
          rgba(255, 255, 255, 0.05)
        );
        color: rgba(255, 255, 255, 0.9);
      }

      .action-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .action-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none;
      }

      .confirm-btn {
        background: linear-gradient(
          135deg,
          rgba(0, 255, 100, 0.2),
          rgba(0, 200, 80, 0.1)
        );
        border-color: rgba(0, 255, 100, 0.3);
      }

      .confirm-btn:hover:not(:disabled) {
        border-color: rgba(0, 255, 100, 0.5);
        background: linear-gradient(
          135deg,
          rgba(0, 255, 100, 0.3),
          rgba(0, 200, 80, 0.2)
        );
      }

      .confirm-btn.locked {
        background: linear-gradient(
          135deg,
          rgba(100, 200, 255, 0.2),
          rgba(50, 150, 255, 0.1)
        );
      }

      .clear-btn {
        background: linear-gradient(
          135deg,
          rgba(255, 165, 0, 0.2),
          rgba(255, 140, 0, 0.1)
        );
        border-color: rgba(255, 165, 0, 0.3);
      }

      .clear-btn:hover:not(:disabled) {
        border-color: rgba(255, 165, 0, 0.5);
      }

      .skip-btn {
        background: linear-gradient(
          135deg,
          rgba(255, 100, 100, 0.2),
          rgba(255, 80, 80, 0.1)
        );
        border-color: rgba(255, 100, 100, 0.3);
      }

      .skip-btn:hover:not(:disabled) {
        border-color: rgba(255, 100, 100, 0.5);
      }

      .btn-spinner {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      /* Score Section */
      .score-section {
        background: rgba(0, 0, 0, 0.25);
        border-radius: 8px;
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
        margin-top: 8px;
      }

      .score-display {
        display: flex;
        justify-content: space-around;
        gap: 16px;
        margin-top: 8px;
      }

      .score-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .score-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .score-value {
        font-size: 16px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
      }

      .score-value.streak-active {
        color: rgba(255, 165, 0, 0.9);
      }

      /* Desktop specific positioning */
      @media (min-width: 769px) {
        .quiz-hud {
          top: 20px !important;
          right: 20px !important;
          left: auto !important;
        }
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .quiz-hud {
          top: 10px !important;
          right: 10px !important;
          left: 10px !important;
          width: auto;
          max-width: calc(100vw - 20px);
          padding: 14px;
        }

        .question-prompt {
          font-size: 16px;
        }

        .action-buttons {
          flex-direction: row;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px;
        }

        .action-btn {
          flex: 1;
          min-width: 80px;
          padding: 8px 12px;
          font-size: 13px;
        }

        .score-display {
          gap: 12px;
        }

        .score-value {
          font-size: 18px;
        }
      }

      @media (max-width: 480px) {
        .quiz-hud {
          padding: 12px;
        }

        .action-buttons {
          flex-direction: column;
          gap: 6px;
        }

        .action-btn {
          width: 100%;
          min-width: unset;
        }
      }
    `,
  ],
})
export class QuizHud {
  readonly quizState = inject(QuizStateService);

  // Computed values for template
  readonly currentQuestionNumber = computed(
    () => this.quizState.currentQuestionIndex() + 1,
  );
  readonly totalQuestions = computed(() => this.quizState.questions().length);
  readonly progressPercentage = computed(() => this.quizState.progress() * 100);
  readonly timeLeftSeconds = computed(() =>
    Math.ceil(this.quizState.timeLeft() / 1000),
  );

  // Timer circle calculation (circumference = 2πr = 2π26 ≈ 163)
  readonly timerDashOffset = computed(() => {
    const progress = this.quizState.timeProgress();
    return 163 * (1 - progress);
  });

  // Screen reader status
  readonly screenReaderStatus = computed(() => {
    const state = this.quizState.gameState();
    const question = this.quizState.currentQuestion();
    const timeLeft = this.timeLeftSeconds();
    const selected = this.quizState.selectedCandidate();

    if (state === 'question' && question) {
      const selectionText = selected
        ? `Selected: ${selected}. `
        : 'No selection. ';
      return `${question.prompt} ${selectionText}Time remaining: ${timeLeft} seconds.`;
    }

    return '';
  });

  // Action methods
  confirmAnswer(): void {
    if (this.quizState.canConfirm()) {
      this.quizState.confirmCandidate();
    }
  }

  clearSelection(): void {
    this.quizState.clearCandidate();
  }

  skipQuestion(): void {
    this.quizState.skipQuestion();
  }
}
