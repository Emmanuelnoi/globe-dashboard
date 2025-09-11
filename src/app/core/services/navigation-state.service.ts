import { Injectable, signal, computed } from '@angular/core';
import {
  ViewMode,
  NavigationItem,
  DEFAULT_VIEW_MODE,
  VIEW_CONFIGS,
} from '../types/navigation.types';

/**
 * Navigation state service using Angular 20 signals
 * Manages the current active view and provides reactive state
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationStateService {
  // Private signals for internal state management
  private readonly _currentView = signal<ViewMode>(DEFAULT_VIEW_MODE);
  private readonly _isLoading = signal(false);

  // Public readonly signals for components to subscribe to
  readonly currentView = this._currentView.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // Navigation items configuration
  readonly navigationItems: NavigationItem[] = [
    { id: 'country-comparison', label: 'Country Comparison', icon: 'globe' },
    { id: 'game-quiz', label: 'Game Quiz', icon: 'gamepad' },
    { id: 'bird-migration', label: 'Bird Migration', icon: 'plane' },
    { id: 'crop-cuisine-mapper', label: 'Crop & Cuisine Mapper', icon: 'map' },
  ];

  // Computed values for derived state
  readonly activeNavigationItem = computed(() =>
    this.navigationItems.find((item) => item.id === this.currentView()),
  );

  readonly isCountryComparisonActive = computed(
    () => this.currentView() === 'country-comparison',
  );

  readonly isGameQuizActive = computed(
    () => this.currentView() === 'game-quiz',
  );

  readonly isBirdMigrationActive = computed(
    () => this.currentView() === 'bird-migration',
  );

  readonly isCropCuisineMapperActive = computed(
    () => this.currentView() === 'crop-cuisine-mapper',
  );

  /**
   * Navigate to a specific view mode
   * @param viewMode - The view mode to navigate to
   */
  navigateTo(viewMode: ViewMode): void {
    if (this._currentView() !== viewMode) {
      this._isLoading.set(true);

      // Simulate async navigation if needed
      queueMicrotask(() => {
        this._currentView.set(viewMode);
        this._isLoading.set(false);
      });
    }
  }

  /**
   * Get navigation item by ID
   * @param id - The navigation item ID
   * @returns The navigation item or undefined
   */
  getNavigationItem(id: ViewMode): NavigationItem | undefined {
    return this.navigationItems.find((item) => item.id === id);
  }

  /**
   * Reset to default view
   */
  resetToDefault(): void {
    this.navigateTo(DEFAULT_VIEW_MODE);
  }

  /**
   * Get view configuration for current view
   */
  getCurrentViewConfig() {
    return VIEW_CONFIGS[this.currentView()];
  }

  /**
   * Check if current view is implemented
   */
  readonly isCurrentViewImplemented = computed(
    () => VIEW_CONFIGS[this.currentView()].isImplemented,
  );

  /**
   * Set loading state (useful for external components)
   * @param loading - Loading state
   */
  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }
}
