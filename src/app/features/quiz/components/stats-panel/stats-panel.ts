import {
  Component,
  inject,
  ElementRef,
  ViewChild,
  Output,
  EventEmitter,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { UserStatsService } from '../../../../core/services/user-stats.service';
import { UserStatsV1, GameSession } from '../../models/quiz.models';

// Interface for exported stats data
interface ExportedStatsData {
  version: number;
  exportDate: string;
  stats: UserStatsV1;
  sessions: GameSession[];
}

/**
 * Statistics Panel Component
 *
 * Displays user quiz statistics including:
 * - Overall performance metrics (games played, average score, best score, streaks)
 * - Recent game history
 * - Per-mode statistics breakdown
 * - Data export/import functionality
 */
@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div
      class="stats-modal-card"
      role="complementary"
      aria-label="Quiz statistics"
      (click)="$event.stopPropagation()"
    >
      <!-- Header -->
      <header class="stats-header">
        <h2 class="stats-title">
          <span class="stats-icon" aria-hidden="true">📊</span>
          Quiz Statistics
        </h2>
        <button
          type="button"
          class="close-button"
          (click)="closeStats.emit()"
          aria-label="Close statistics"
        >
          ✕
        </button>

        @if (isLoading()) {
          <div class="loading-spinner" aria-label="Loading statistics">
            <span class="spinner-icon">⏳</span>
            Loading...
          </div>
        }

        @if (!isLoading() && hasPlayedAnyGames()) {
          <div class="stats-actions">
            <button
              type="button"
              class="action-button export-button"
              (click)="exportStats()"
              title="Export your quiz statistics to a JSON file"
              aria-label="Export statistics"
            >
              <span class="button-icon" aria-hidden="true">📥</span>
              Export
            </button>
            <button
              type="button"
              class="action-button import-button"
              (click)="importStats()"
              title="Import quiz statistics from a JSON file"
              aria-label="Import statistics"
            >
              <span class="button-icon" aria-hidden="true">📤</span>
              Import
            </button>
            <input
              #fileInput
              type="file"
              accept=".json"
              (change)="onFileSelected($event)"
              style="display: none;"
              aria-label="Select statistics file to import"
            />
          </div>
        }
      </header>

      <!-- Main Stats Section -->
      @if (!isLoading()) {
        <div class="stats-content">
          <!-- Overall Performance -->
          <section class="stats-section" aria-labelledby="overall-stats-title">
            <h3 id="overall-stats-title" class="section-title">
              <span class="section-icon" aria-hidden="true">🎯</span>
              Overall Performance
            </h3>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{{ totalGames() }}</div>
                <div class="stat-label">Games Played</div>
              </div>

              <div class="stat-card">
                <div class="stat-value">
                  {{ averageScore() | number: '1.0-0' }}
                </div>
                <div class="stat-label">Average Score</div>
              </div>

              <div class="stat-card">
                <div class="stat-value">{{ bestScore() }}</div>
                <div class="stat-label">Best Score</div>
              </div>

              <div class="stat-card">
                <div class="stat-value">
                  {{ bestStreak() }}
                  @if (bestStreak() >= 3) {
                    <span class="streak-fire" aria-hidden="true">🔥</span>
                  }
                </div>
                <div class="stat-label">Best Streak</div>
              </div>
            </div>
          </section>

          <!-- Game Mode Breakdown -->
          @if (stats() && hasPlayedAnyGames()) {
            <section class="stats-section" aria-labelledby="mode-stats-title">
              <h3 id="mode-stats-title" class="section-title">
                <span class="section-icon" aria-hidden="true">🎮</span>
                By Game Mode
              </h3>

              <div class="mode-stats">
                @for (mode of gameModes; track mode.key) {
                  @if (getModeStats(mode.key).gamesPlayed > 0) {
                    <div class="mode-card">
                      <div class="mode-header">
                        <span class="mode-icon" aria-hidden="true">{{
                          mode.icon
                        }}</span>
                        <h4 class="mode-name">{{ mode.name }}</h4>
                      </div>
                      <div class="mode-stats-grid">
                        <div class="mode-stat">
                          <span class="mode-stat-value">{{
                            getModeStats(mode.key).gamesPlayed
                          }}</span>
                          <span class="mode-stat-label">Played</span>
                        </div>
                        <div class="mode-stat">
                          <span class="mode-stat-value">{{
                            getModeStats(mode.key).averageScore
                              | number: '1.0-0'
                          }}</span>
                          <span class="mode-stat-label">Avg</span>
                        </div>
                        <div class="mode-stat">
                          <span class="mode-stat-value">{{
                            getModeStats(mode.key).bestScore
                          }}</span>
                          <span class="mode-stat-label">Best</span>
                        </div>
                      </div>
                    </div>
                  }
                }
              </div>
            </section>
          }

          <!-- Recent Sessions -->
          @if (recentSessions().length > 0) {
            <section
              class="stats-section"
              aria-labelledby="recent-sessions-title"
            >
              <h3 id="recent-sessions-title" class="section-title">
                <span class="section-icon" aria-hidden="true">📈</span>
                Recent Games
              </h3>

              <div class="recent-sessions">
                @for (
                  session of recentSessions().slice(0, 5);
                  track session.id
                ) {
                  <div class="session-card">
                    <div class="session-header">
                      <span class="session-mode">{{
                        getModeDisplayName(session.configuration.mode)
                      }}</span>
                      <span class="session-date">{{
                        formatDate(session.endTime)
                      }}</span>
                    </div>
                    <div class="session-stats">
                      <span class="session-score"
                        >{{ session.finalScore }} pts</span
                      >
                      @if (session.bestStreak > 0) {
                        <span class="session-streak"
                          >{{ session.bestStreak }}🔥</span
                        >
                      }
                    </div>
                  </div>
                }
              </div>
            </section>
          }

          <!-- No Data State -->
          @if (!hasPlayedAnyGames()) {
            <div class="empty-state">
              <div class="empty-icon" aria-hidden="true">🎯</div>
              <h3 class="empty-title">No Games Played Yet</h3>
              <p class="empty-description">
                Start playing quiz games to see your statistics here!
              </p>
            </div>
          }

          <!-- Error State -->
          @if (lastError()) {
            <div class="error-state" role="alert">
              <div class="error-icon" aria-hidden="true">⚠️</div>
              <div class="error-message">{{ lastError() }}</div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stats-modal-card {
        position: fixed !important;
        top: 0px !important;
        left: 0px !important;
        bottom: 0px !important;
        width: 380px;
        max-width: min(380px, calc(100vw - 40px));
        height: calc(136vh - 40px);
        z-index: 130;
        pointer-events: auto;
        box-sizing: border-box;
        overflow-y: auto;
        border-radius: 10px;
        padding: 16px;
        background: rgba(20, 20, 20, 1);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: rgba(225, 225, 225, 0.9);
        font-family: 'Inter', system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease;
      }

      .stats-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px 12px 0 0;
        flex-wrap: wrap;
        gap: 12px;
      }

      .stats-title {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: rgba(225, 225, 225, 0.95);
      }

      .stats-icon {
        font-size: 28px;
      }

      .close-button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(225, 225, 225, 0.8);
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 16px;
        font-weight: 600;
        font-family: inherit;
      }

      .close-button:hover {
        background: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.95);
        border-color: rgba(255, 255, 255, 0.4);
      }

      .close-button:focus {
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 2px;
      }

      .loading-spinner {
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgba(225, 225, 225, 0.7);
        font-size: 14px;
      }

      .spinner-icon {
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

      .stats-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .action-button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: rgba(225, 225, 225, 0.9);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .action-button:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }

      .action-button:active {
        transform: translateY(0);
      }

      .action-button:focus {
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 2px;
      }

      .button-icon {
        font-size: 14px;
      }

      .export-button:hover {
        background: rgba(40, 167, 69, 0.15);
        border-color: rgba(40, 167, 69, 0.3);
      }

      .import-button:hover {
        background: rgba(0, 123, 255, 0.15);
        border-color: rgba(0, 123, 255, 0.3);
      }

      .stats-content {
        display: flex;
        flex-direction: column;
        gap: 24px;
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }

      .stats-section {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        color: rgba(225, 225, 225, 0.9);
      }

      .section-icon {
        font-size: 20px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 16px;
      }

      .stat-card {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 16px;
        text-align: center;
        transition: all 0.2s ease;
      }

      .stat-card:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.25);
      }

      .stat-value {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 24px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 12px;
        color: rgba(225, 225, 225, 0.7);
        font-weight: 500;
      }

      .streak-fire {
        font-size: 16px;
        animation: flicker 1.5s ease-in-out infinite alternate;
      }

      @keyframes flicker {
        0% {
          opacity: 1;
        }
        100% {
          opacity: 0.7;
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

      .mode-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .mode-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 14px;
        transition: all 0.2s ease;
      }

      .mode-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .mode-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }

      .mode-icon {
        font-size: 16px;
      }

      .mode-name {
        font-size: 14px;
        font-weight: 600;
        margin: 0;
        color: rgba(225, 225, 225, 0.9);
      }

      .mode-stats-grid {
        display: flex;
        justify-content: space-between;
      }

      .mode-stat {
        text-align: center;
      }

      .mode-stat-value {
        display: block;
        font-size: 16px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
      }

      .mode-stat-label {
        font-size: 11px;
        color: rgba(225, 225, 225, 0.6);
      }

      .recent-sessions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .session-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all 0.2s ease;
      }

      .session-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .session-header {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .session-mode {
        font-weight: 600;
        font-size: 13px;
        color: rgba(225, 225, 225, 0.9);
      }

      .session-date {
        font-size: 11px;
        color: rgba(225, 225, 225, 0.6);
      }

      .session-stats {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .session-score {
        font-weight: 600;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
      }

      .session-streak {
        font-size: 12px;
        color: rgba(255, 165, 0, 0.9);
      }

      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: rgba(225, 225, 225, 0.7);
      }

      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.6;
      }

      .empty-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: rgba(225, 225, 225, 0.8);
      }

      .empty-description {
        font-size: 14px;
        margin: 0;
        color: rgba(225, 225, 225, 0.6);
      }

      .error-state {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: rgba(220, 53, 69, 0.1);
        border: 1px solid rgba(220, 53, 69, 0.3);
        border-radius: 8px;
        color: rgba(255, 182, 193, 0.9);
      }

      .error-icon {
        font-size: 20px;
      }

      .error-message {
        font-size: 14px;
        font-weight: 500;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .stats-modal-card {
          top: 0px;
          left: 0px;
          right: 0px;
          bottom: 0px;
          width: 100vw;
          max-width: 100vw;
          height: 100vh;
          padding: 16px;
        }

        .stats-header {
          padding: 16px 20px;
        }

        .stats-content {
          padding: 16px 20px;
        }

        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .mode-stats {
          grid-template-columns: 1fr;
        }

        .session-card {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .session-stats {
          align-self: flex-end;
        }

        .stats-actions {
          flex-direction: column;
          width: 100%;
          gap: 6px;
        }

        .action-button {
          width: 100%;
          justify-content: center;
        }
      }

      @media (max-width: 480px) {
        .stats-modal-card {
          top: 0px;
          left: 0px;
          right: 0px;
          bottom: 0px;
          width: 100vw;
          max-width: 100vw;
          height: 100vh;
          padding: 18px;
        }

        .stats-grid {
          grid-template-columns: 1fr;
        }

        .stats-title {
          font-size: 20px;
        }

        .stat-value {
          font-size: 20px;
        }
      }
    `,
  ],
})
export class StatsPanelComponent {
  private readonly userStatsService = inject(UserStatsService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @Output() closeStats = new EventEmitter<void>();

  // Signal subscriptions
  readonly stats = this.userStatsService.stats;
  readonly recentSessions = this.userStatsService.recentSessions;
  readonly isLoading = this.userStatsService.isLoading;
  readonly lastError = this.userStatsService.lastError;

  // Computed stats
  readonly totalGames = this.userStatsService.totalGames;
  readonly averageScore = this.userStatsService.averageScore;
  readonly bestScore = this.userStatsService.bestScore;
  readonly bestStreak = this.userStatsService.bestStreak;
  readonly hasPlayedAnyGames = this.userStatsService.hasPlayedAnyGames;

  // Game mode metadata
  readonly gameModes = [
    { key: 'find-country', name: 'Find Country', icon: '🌍' },
    { key: 'capital-match', name: 'Capital Match', icon: '🏛️' },
    { key: 'flag-id', name: 'Flag ID', icon: '🏴' },
    { key: 'facts-guess', name: 'Facts Guess', icon: '📊' },
  ] as const;

  /**
   * Get statistics for a specific game mode
   */
  getModeStats(mode: string): {
    gamesPlayed: number;
    totalScore: number;
    averageScore: number;
    bestScore: number;
    bestStreak: number;
  } {
    const stats = this.stats();
    if (!stats?.gamesByMode) {
      return {
        gamesPlayed: 0,
        totalScore: 0,
        averageScore: 0,
        bestScore: 0,
        bestStreak: 0,
      };
    }
    return (
      stats.gamesByMode[mode as keyof typeof stats.gamesByMode] || {
        gamesPlayed: 0,
        totalScore: 0,
        averageScore: 0,
        bestScore: 0,
        bestStreak: 0,
      }
    );
  }

  /**
   * Get display name for game mode
   */
  getModeDisplayName(mode: string): string {
    const modeConfig = this.gameModes.find((m) => m.key === mode);
    return modeConfig ? modeConfig.name : mode;
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | undefined): string {
    if (!date) return '';

    const now = new Date();
    const sessionDate = new Date(date);
    const diffMs = now.getTime() - sessionDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return sessionDate.toLocaleDateString();
    }
  }

  /**
   * Export statistics data as JSON file
   */
  async exportStats(): Promise<void> {
    try {
      const data = await this.userStatsService.exportData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-stats-${new Date().toISOString().split('T')[0]}.json`;

      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('📥 Statistics exported successfully');
    } catch (error) {
      console.error('❌ Failed to export statistics:', error);
      alert('Failed to export statistics. Please try again.');
    }
  }

  /**
   * Trigger file input for importing statistics
   */
  importStats(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * Handle file selection for importing statistics
   */
  async onFileSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'application/json') {
      alert('Please select a valid JSON file.');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate the data structure
      if (!this.isValidStatsData(data)) {
        alert(
          'Invalid statistics file format. Please select a valid quiz statistics export.',
        );
        return;
      }

      // Confirm import
      const confirmed = confirm(
        'This will replace your current statistics. Are you sure you want to import this data?',
      );

      if (!confirmed) {
        return;
      }

      await this.userStatsService.importData(data);
      console.log('📤 Statistics imported successfully');
      alert('Statistics imported successfully!');
    } catch (error) {
      console.error('❌ Failed to import statistics:', error);
      alert(
        'Failed to import statistics. Please check the file format and try again.',
      );
    } finally {
      // Clear the file input
      target.value = '';
    }
  }

  /**
   * Validate imported statistics data structure
   */
  isValidStatsData(data: unknown): data is ExportedStatsData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for required properties
    const dataObj = data as Record<string, unknown>;
    const hasStats = !!dataObj['stats'] && typeof dataObj['stats'] === 'object';
    const hasSessions = Array.isArray(dataObj['sessions']);
    const hasVersion = typeof dataObj['version'] === 'number';
    const hasExportDate = typeof dataObj['exportDate'] === 'string';

    return Boolean(hasStats && hasSessions && hasVersion && hasExportDate);
  }
}
