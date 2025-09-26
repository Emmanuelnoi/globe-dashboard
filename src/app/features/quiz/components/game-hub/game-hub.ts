import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizStateService } from '../../services/quiz-state';
import { StatsPanelComponent } from '../stats-panel/stats-panel';
import {
  GameMode,
  Difficulty,
  GameConfiguration,
} from '../../models/quiz.models';

@Component({
  selector: 'app-game-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, StatsPanelComponent],
  template: `
    <div class="quiz-view" role="region" aria-label="Game Quiz Hub">
      <div class="quiz-content">
        <header class="quiz-header">
          <h2>🎮 Game Quiz</h2>
          <p>Test your geography knowledge with interactive quiz games</p>
        </header>

        <!-- Game Configuration Form -->
        @if (gameState() === 'idle') {
          <form class="game-config-form" (ngSubmit)="startGame()">
            <!-- Game Mode Selector -->
            <div class="form-group">
              <label class="form-label">Game Mode</label>
              <div class="mode-selector">
                @for (mode of availableModes; track mode.value) {
                  <div
                    class="mode-option"
                    [class.selected]="selectedMode() === mode.value"
                    [class.disabled]="!mode.enabled"
                    (click)="mode.enabled && onModeChange(mode.value)"
                    [attr.aria-disabled]="!mode.enabled"
                    role="radio"
                    [attr.aria-checked]="selectedMode() === mode.value"
                  >
                    <div class="mode-icon">
                      @switch (mode.value) {
                        @case ('find-country') {
                          🌍
                        }
                        @case ('capital-match') {
                          🏛️
                        }
                        @case ('flag-id') {
                          🏳️
                        }
                        @case ('facts-guess') {
                          📊
                        }
                      }
                    </div>
                    <div class="mode-info">
                      <h3>{{ mode.label }}</h3>
                      @if (!mode.enabled) {
                        <span class="coming-soon">Sprint 2</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Difficulty Selector -->
            <div class="form-group">
              <label class="form-label">Difficulty</label>
              <div class="difficulty-selector">
                @for (difficulty of difficulties; track difficulty.value) {
                  <label class="difficulty-option">
                    <input
                      type="radio"
                      name="difficulty"
                      [value]="difficulty.value"
                      [checked]="selectedDifficulty() === difficulty.value"
                      (change)="onDifficultyChange(difficulty.value)"
                    />
                    <span class="radio-custom"></span>
                    <div class="difficulty-info">
                      <span class="difficulty-name">{{
                        difficulty.label
                      }}</span>
                      <span class="difficulty-desc">{{
                        difficulty.description
                      }}</span>
                    </div>
                  </label>
                }
              </div>
            </div>

            <!-- Question Count Selector -->
            <div class="form-group">
              <label class="form-label" for="question-count">
                Questions: {{ questionCount() }}
              </label>
              <div class="question-count-selector">
                <input
                  type="range"
                  id="question-count"
                  class="count-slider"
                  [min]="questionCountOptions[0]"
                  [max]="questionCountOptions[questionCountOptions.length - 1]"
                  [step]="5"
                  [value]="questionCount()"
                  (input)="onQuestionCountChange(+$any($event.target).value)"
                />
                <div class="count-marks">
                  @for (count of questionCountOptions; track count) {
                    <span
                      class="count-mark"
                      [class.active]="questionCount() === count"
                      >{{ count }}</span
                    >
                  }
                </div>
              </div>
            </div>

            <!-- Start Game Button -->
            <div class="form-actions">
              <button
                type="submit"
                class="start-game-btn"
                [disabled]="!isFormValid || isStarting()"
                [attr.aria-busy]="isStarting()"
              >
                @if (isStarting()) {
                  <span class="btn-spinner">🔄</span>
                  Starting...
                } @else {
                  <span class="btn-icon">🎮</span>
                  Start Game
                }
              </button>
            </div>
          </form>
        }

        <!-- Quiz Gameplay HUD (shows during active quiz) -->
        @if (
          gameState() === 'question' ||
          gameState() === 'evaluating' ||
          gameState() === 'playing'
        ) {
          <div
            class="quiz-gameplay"
            role="complementary"
            aria-label="Quiz game controls"
          >
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
                  Question {{ currentQuestionNumber() }} of
                  {{ totalQuestions() }}
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
                [attr.aria-live]="gameState() === 'question' ? 'polite' : 'off'"
              >
                @if (currentQuestion()) {
                  {{ currentQuestion()!.prompt }}
                }
              </div>

              <!-- Flag Display for Flag ID Mode -->
              @if (
                currentQuestion()?.type === 'flag-id' &&
                currentQuestion()?.metadata?.flagUrl
              ) {
                <div class="flag-display">
                  <img
                    [src]="currentQuestion()?.metadata?.flagUrl"
                    [alt]="'Flag to identify'"
                    class="question-flag"
                    loading="eager"
                    (error)="onFlagError($event)"
                  />
                </div>
              }
            </div>

            <!-- Selection Interface -->
            <div class="selection-section">
              <!-- Multiple Choice Grid (for capital-match, flag-id, facts-guess) -->
              @if (isMultipleChoiceMode()) {
                <div
                  class="multiple-choice-grid"
                  role="radiogroup"
                  [attr.aria-label]="
                    'Answer choices for: ' + currentQuestion()?.prompt
                  "
                >
                  @if (currentQuestion()?.choices; as choices) {
                    @for (choice of choices; track choice) {
                      <button
                        type="button"
                        class="choice-button"
                        [class.selected]="selectedCandidate() === choice"
                        [disabled]="isConfirmLocked()"
                        (click)="selectChoice(choice)"
                        role="radio"
                        [attr.aria-checked]="selectedCandidate() === choice"
                        [attr.aria-label]="'Select ' + choice"
                      >
                        <div class="choice-content">
                          <span class="choice-text">{{ choice }}</span>
                        </div>
                        @if (selectedCandidate() === choice) {
                          <div class="choice-indicator">✓</div>
                        }
                      </button>
                    }
                  }
                </div>
              } @else {
                <!-- Globe Selection Display (for find-country) -->
                @if (selectedCandidate()) {
                  <div
                    class="selected-candidate"
                    role="status"
                    aria-live="polite"
                  >
                    <span class="selection-label"
                      >Selected:
                      {{ getCountryName(selectedCandidate()!) }}</span
                    >
                  </div>
                } @else {
                  <div class="no-selection" role="status" aria-live="polite">
                    <span class="selection-hint"
                      >Click a country on the globe to select it</span
                    >
                  </div>
                }
              }
            </div>

            <!-- Action Buttons -->
            <div class="actions-section">
              <div
                class="action-buttons"
                role="toolbar"
                aria-label="Quiz actions"
              >
                <!-- Confirm Button -->
                <button
                  class="action-btn confirm-btn"
                  [disabled]="!canConfirm()"
                  [class.locked]="isConfirmLocked()"
                  (click)="confirmAnswer()"
                  [attr.aria-busy]="isConfirmLocked()"
                  type="button"
                >
                  @if (isConfirmLocked()) {
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
                  [disabled]="!selectedCandidate() || isConfirmLocked()"
                  (click)="clearSelection()"
                  type="button"
                >
                  <span class="btn-icon">✗</span>
                  Clear
                </button>

                <!-- Skip Button -->
                <button
                  class="action-btn skip-btn"
                  [disabled]="isConfirmLocked()"
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
                  <span class="score-value">{{ score() }}</span>
                </div>
                <div class="score-item">
                  <span class="score-label">Streak</span>
                  <span
                    class="score-value"
                    [class.streak-active]="streak() > 0"
                  >
                    {{ streak() }}
                    @if (streak() > 2) {
                      🔥
                    }
                  </span>
                </div>
              </div>
            </div>

            <!-- Stop Game Button Section -->
            <div class="stop-game-section">
              <button
                type="button"
                class="stop-game-button"
                (click)="stopGame()"
                [attr.aria-label]="'Stop quiz and return to game setup'"
                title="Stop Quiz"
              >
                <span class="button-icon">⏹️</span>
                <span class="button-text">Stop Game</span>
              </button>
            </div>
          </div>
        }

        <!-- Results Display (shows when quiz is complete) -->
        @if (gameState() === 'results' || gameState() === 'ended') {
          <div class="quiz-results" role="region" aria-label="Quiz Results">
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
                  <span class="accuracy-value"
                    >{{ accuracyPercentage() }}%</span
                  >
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
                          !result.isCorrect &&
                          result.selectedAnswer !== 'SKIPPED'
                        ) {
                          <span class="correct-answer">
                            Correct: {{ getCountryName(result.correctAnswer) }}
                          </span>
                        }
                      </div>
                    </div>
                    <div class="result-stats">
                      <div class="result-points">
                        +{{ result.pointsEarned }}
                      </div>
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
              <button class="action-btn secondary-btn" (click)="toggleStats()">
                <span class="btn-icon">📊</span>
                {{ showStats() ? 'Hide Stats' : 'View Stats' }}
              </button>
              <button
                class="action-btn secondary-btn"
                (click)="returnToExplore()"
              >
                <span class="btn-icon">🌍</span>
                Explore Globe
              </button>
            </div>
          </div>
        }

        <!-- Stats Panel Modal -->
        @if (showStats()) {
          <app-stats-panel (closeStats)="hideStats()" />
        }
      </div>
    </div>
  `,
  styles: [
    `
      .quiz-view {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        bottom: 20px !important;
        width: 380px;
        max-width: min(380px, calc(100vw - 40px));
        height: calc(100vh - 40px);
        z-index: 120;
        pointer-events: auto;
        box-sizing: border-box;
        overflow-y: auto;

        border-radius: 10px;
        padding: 16px;
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
      }

      .quiz-content {
        color: rgba(255, 255, 255, 0.9);
      }

      .quiz-header {
        text-align: center;
        margin-bottom: 20px;
      }

      .quiz-header h2 {
        margin: 0 0 6px 0;
        font-size: 22px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .quiz-header p {
        margin: 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.3;
      }

      /* Form Styles */
      .game-config-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-label {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 6px;
      }

      /* Mode Selector */
      .mode-selector {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .mode-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-radius: 10px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.04),
          rgba(255, 255, 255, 0.01)
        );
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }

      .mode-option:hover:not(.disabled) {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
      }

      .mode-option.selected {
        border-color: rgba(100, 200, 255, 0.5);
        background: linear-gradient(
          180deg,
          rgba(100, 200, 255, 0.08),
          rgba(100, 200, 255, 0.02)
        );
      }

      .mode-option.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .mode-option .mode-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .mode-info h3 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .coming-soon {
        font-size: 11px;
        font-weight: 500;
        color: rgba(255, 200, 0, 0.9);
        background: rgba(255, 200, 0, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(255, 200, 0, 0.3);
      }

      /* Difficulty Selector */
      .difficulty-selector {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .difficulty-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.02);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .difficulty-option:hover {
        background: rgba(255, 255, 255, 0.04);
      }

      .difficulty-option input[type='radio'] {
        display: none;
      }

      .radio-custom {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        position: relative;
        flex-shrink: 0;
      }

      .difficulty-option input:checked + .radio-custom {
        border-color: rgba(100, 200, 255, 0.8);
      }

      .difficulty-option input:checked + .radio-custom::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        background: rgba(100, 200, 255, 0.8);
        border-radius: 50%;
      }

      .difficulty-info {
        flex: 1;
      }

      .difficulty-name {
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        display: block;
      }

      .difficulty-desc {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }

      /* Question Count Selector */
      .question-count-selector {
        position: relative;
      }

      .count-slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.1);
        outline: none;
        -webkit-appearance: none;
      }

      .count-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(100, 200, 255, 0.8);
        cursor: pointer;
      }

      .count-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(100, 200, 255, 0.8);
        cursor: pointer;
        border: none;
      }

      .count-marks {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
      }

      .count-mark {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        transition: color 0.2s ease;
      }

      .count-mark.active {
        color: rgba(100, 200, 255, 0.9);
        font-weight: 600;
      }

      /* Start Game Button */
      .form-actions {
        margin-top: 12px;
      }

      .start-game-btn {
        width: 100%;
        padding: 16px 24px;
        font-size: 18px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        background: linear-gradient(
          135deg,
          rgba(100, 200, 255, 0.2),
          rgba(50, 150, 255, 0.1)
        );
        border: 2px solid rgba(100, 200, 255, 0.3);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .start-game-btn:hover:not(:disabled) {
        background: linear-gradient(
          135deg,
          rgba(100, 200, 255, 0.3),
          rgba(50, 150, 255, 0.2)
        );
        border-color: rgba(100, 200, 255, 0.5);
        transform: translateY(-1px);
      }

      .start-game-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
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

      /* Quiz Results Styles */
      .quiz-results {
        color: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      /* Results Header */
      .results-header {
        text-align: center;
        margin-bottom: 20px;
      }

      .results-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .results-header h2 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .performance-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
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
        margin-bottom: 16px;
      }

      .score-main {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin-bottom: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .final-score,
      .accuracy-display {
        text-align: center;
      }

      .score-value,
      .accuracy-value {
        display: block;
        font-size: 20px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 2px;
      }

      .score-label,
      .accuracy-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }

      .stat-item {
        text-align: center;
        padding: 8px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .stat-value {
        display: block;
        font-size: 16px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 2px;
      }

      .stat-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Question Results */
      .question-results {
        margin-bottom: 16px;
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .question-results h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .results-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
      }

      .result-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 6px;
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
        font-size: 14px;
        flex-shrink: 0;
      }

      .result-content {
        flex: 1;
        min-width: 0;
      }

      .result-question {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .result-details {
        display: flex;
        gap: 6px;
        align-items: center;
        font-size: 10px;
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
        font-size: 12px;
        font-weight: 600;
        color: rgba(100, 200, 255, 0.9);
        margin-bottom: 1px;
      }

      .result-time {
        font-size: 9px;
        color: rgba(255, 255, 255, 0.6);
      }

      /* Action Buttons */
      .results-actions {
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .action-btn {
        padding: 12px 18px;
        font-size: 14px;
        font-weight: 600;
        border-radius: 8px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 120px;
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
        font-size: 16px;
      }

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

      /* Quiz Gameplay HUD Styles */
      .quiz-gameplay {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: rgba(255, 255, 255, 0.9);
        height: 100%;
        flex: 1;
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
        text-align: center;
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
        color: rgba(0, 255, 100, 0.9);
        font-weight: 500;
      }

      .no-selection {
        padding: 6px 12px;
      }

      .selection-hint {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        text-align: center;
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
        width: 100%;
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

      /* Gameplay Score Section */
      .quiz-gameplay .score-section {
        background: rgba(0, 0, 0, 0.25);
        border-radius: 8px;
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
        margin-top: 8px;
      }

      .quiz-gameplay .score-display {
        display: flex;
        justify-content: space-around;
        gap: 16px;
      }

      .quiz-gameplay .score-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .quiz-gameplay .score-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .quiz-gameplay .score-value {
        font-size: 16px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
      }

      .quiz-gameplay .score-value.streak-active {
        color: rgba(255, 165, 0, 0.9);
      }

      /* Stop Game Button Section */
      .stop-game-section {
        margin-top: 8px;
        flex-shrink: 0;
      }

      .stop-game-button {
        width: 100%;
        padding: 12px 12px;
        background: rgba(220, 53, 69, 0.3);
        color: rgba(225, 225, 225, 0.9);
        border: 1px solid rgba(220, 53, 69, 0.3);
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .stop-game-button:hover {
        background: rgba(220, 53, 69, 0.5);
        border-color: rgba(220, 53, 69, 0.4);
        color: rgba(225, 225, 225, 1);
        transform: translateY(-1px);
      }

      .stop-game-button:active {
        transform: translateY(0);
        background: rgba(220, 53, 69, 0.3);
      }

      .stop-game-button .button-icon {
        font-size: 12px;
        line-height: 1;
      }

      .stop-game-button .button-text {
        line-height: 1;
      }

      /* Scrollbar Styling */
      .results-list::-webkit-scrollbar {
        width: 4px;
      }

      .results-list::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
      }

      .results-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
      }

      .results-list::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      @media (max-width: 768px) {
        .quiz-view {
          top: 10px;
          right: 10px;
          left: 10px;
          width: auto;
          max-width: calc(100vw - 20px);
          padding: 16px;
        }

        .quiz-header h2 {
          font-size: 20px;
          margin-bottom: 6px;
        }

        .quiz-header p {
          font-size: 14px;
        }

        .mode-selector {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .mode-option {
          padding: 12px;
        }

        /* Mobile Results Styles */
        .score-main {
          flex-direction: column;
          gap: 16px;
        }

        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
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

      /* Flag Display Styles for Flag ID Mode */
      .flag-display {
        display: flex;
        justify-content: center;
        margin: 16px 0;
        padding: 16px;
        background: rgba(33, 33, 33);
        border: 0px;
        border-radius: 8px;
        backdrop-filter: blur(8px);
      }

      .question-flag {
        width: 120px;
        height: 80px;
        object-fit: cover;
        border-radius: 6px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }

      @media (max-width: 768px) {
        .flag-display {
          margin: 12px 0;
          padding: 12px;
        }

        .question-flag {
          width: 100px;
          height: 66px;
        }
      }

      /* Multiple Choice Grid Styles */
      .multiple-choice-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin: 16px 0;
        max-height: 300px;
        overflow-y: auto;
      }

      .choice-button {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        min-height: 48px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        outline: none;
        backdrop-filter: blur(8px);
      }

      .choice-button:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(100, 200, 255, 0.3);
        transform: translateY(-1px);
      }

      .choice-button:focus {
        border-color: rgba(100, 200, 255, 0.8);
        box-shadow: 0 0 0 2px rgba(100, 200, 255, 0.2);
      }

      .choice-button.selected {
        background: rgba(100, 200, 255, 0.2);
        border-color: rgba(100, 200, 255, 0.8);
        color: rgba(255, 255, 255, 0.95);
      }

      .choice-button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
        transform: none;
      }

      .choice-content {
        display: flex;
        align-items: center;
        flex: 1;
      }

      .choice-text {
        font-weight: 500;
        line-height: 1.3;
        word-break: break-word;
      }

      .choice-indicator {
        color: rgba(100, 200, 255, 1);
        font-size: 16px;
        font-weight: bold;
        margin-left: 8px;
        flex-shrink: 0;
      }

      /* Adjust grid for more choices on hard difficulty */
      @media (min-width: 400px) {
        .multiple-choice-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 768px) {
        .multiple-choice-grid {
          grid-template-columns: 1fr;
          gap: 8px;
          margin: 12px 0;
        }

        .choice-button {
          padding: 10px 12px;
          min-height: 44px;
          font-size: 13px;
        }

        .mode-selector {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 1024px) and (min-width: 769px) {
        .quiz-view {
          width: 300px;
          padding: 18px;
        }

        .mode-selector {
          grid-template-columns: 1fr;
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class GameHub {
  private readonly quizStateService = inject(QuizStateService);

  // Form state signals
  readonly selectedMode = signal<GameMode>('find-country');
  readonly selectedDifficulty = signal<Difficulty>('easy');
  readonly questionCount = signal<number>(10);
  readonly isStarting = signal<boolean>(false);
  readonly showStats = signal<boolean>(false);

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
      console.warn('Selected mode is not available:', mode);
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
      console.error('Failed to start game:', error);
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
