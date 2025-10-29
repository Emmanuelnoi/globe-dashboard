import { Injectable, signal, computed } from '@angular/core';

export type InteractionMode = 'explore' | 'quiz' | 'migration' | 'leaderboard';

/**
 * Interaction Mode Service using Angular 20 signals
 * Manages the current interaction mode to coordinate between
 * normal globe exploration, quiz mode, bird migration visualization, and leaderboard view
 */
@Injectable({
  providedIn: 'root',
})
export class InteractionModeService {
  // Private signal for internal state management
  private readonly _mode = signal<InteractionMode>('explore');

  // Public readonly signal for components to subscribe to
  readonly mode = this._mode.asReadonly();

  // Computed values for convenience
  readonly isExploreMode = computed(() => this._mode() === 'explore');
  readonly isQuizMode = computed(() => this._mode() === 'quiz');
  readonly isMigrationMode = computed(() => this._mode() === 'migration');
  readonly isLeaderboardMode = computed(() => this._mode() === 'leaderboard');

  /**
   * Switch to explore mode (normal globe interactions)
   */
  enableExploreMode(): void {
    this._mode.set('explore');
  }

  /**
   * Switch to quiz mode (disable normal interactions, enable quiz interactions)
   */
  enableQuizMode(): void {
    this._mode.set('quiz');
  }

  /**
   * Switch to migration mode (bird migration visualization)
   */
  enableMigrationMode(): void {
    this._mode.set('migration');
  }

  /**
   * Switch to leaderboard mode (disable globe interactions)
   */
  enableLeaderboardMode(): void {
    this._mode.set('leaderboard');
  }

  /**
   * Toggle between modes
   */
  toggleMode(): void {
    this._mode.update((current) => {
      if (current === 'explore') return 'quiz';
      if (current === 'quiz') return 'migration';
      return 'explore';
    });
  }
}
