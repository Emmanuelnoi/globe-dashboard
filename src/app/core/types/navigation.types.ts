/**
 * Core navigation types for the 3D Global Dashboard
 * Provides type safety across the application
 */

/**
 * Available view modes in the application
 */
export type ViewMode =
  | 'country-comparison'
  | 'game-quiz'
  | 'bird-migration'
  | 'leaderboard';

/**
 * Navigation item interface for sidebar menu
 */
export interface NavigationItem {
  readonly id: ViewMode;
  readonly label: string;
  readonly icon: string;
}

/**
 * Navigation state interface
 */
export interface NavigationState {
  readonly currentView: ViewMode;
  readonly isLoading: boolean;
  readonly previousView?: ViewMode;
}

/**
 * View configuration interface
 */
export interface ViewConfig {
  readonly id: ViewMode;
  readonly title: string;
  readonly description: string;
  readonly component?: string;
  readonly route?: string;
  readonly isImplemented: boolean;
}

/**
 * Country data interface for comparison features
 */
export interface CountryData {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly capital: string;
  readonly gdpPerCapita: string;
  readonly hdi: string;
  readonly hdiTag?: string;
  readonly population: string;
  readonly lifeExpectancy: string;
  readonly happiness: string;
}

/**
 * Comparison state interface
 */
export interface ComparisonState {
  readonly selectedCountries: string[];
  readonly searchTerm: string;
  readonly focusedIndex: number;
  readonly isLoading: boolean;
}

/**
 * Type guard to check if a string is a valid ViewMode
 */
export function isValidViewMode(value: string): value is ViewMode {
  return [
    'country-comparison',
    'game-quiz',
    'bird-migration',
    'leaderboard',
  ].includes(value as ViewMode);
}

/**
 * Default view mode constant
 */
export const DEFAULT_VIEW_MODE: ViewMode = 'country-comparison';

/**
 * View configurations with metadata
 */
export const VIEW_CONFIGS: Record<ViewMode, ViewConfig> = {
  'country-comparison': {
    id: 'country-comparison',
    title: 'Country Comparison',
    description: 'Compare statistics between different countries',
    component: 'ComparisonCard',
    isImplemented: true,
  },
  'game-quiz': {
    id: 'game-quiz',
    title: 'Game Quiz',
    description: 'Interactive geography quiz game',
    component: 'GameHub',
    isImplemented: true,
  },
  'bird-migration': {
    id: 'bird-migration',
    title: 'Bird Migration',
    description: 'Animated bird migration patterns visualization',
    isImplemented: true,
  },
  leaderboard: {
    id: 'leaderboard',
    title: 'Leaderboard',
    description: 'View rankings, achievements, and compete globally',
    component: 'LeaderboardView',
    isImplemented: true,
  },
} as const;
