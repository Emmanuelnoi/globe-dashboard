import { Injectable, signal, computed } from '@angular/core';

export type InteractionMode = 'explore' | 'quiz';

/**
 * Interaction Mode Service using Angular 20 signals
 * Manages the current interaction mode to coordinate between
 * normal globe exploration and quiz mode interactions
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
   * Toggle between modes
   */
  toggleMode(): void {
    this._mode.update((current) =>
      current === 'explore' ? 'quiz' : 'explore',
    );
  }
}
