/**
 * Core module barrel exports
 * Provides clean imports for core services and types
 */

// Services
export { NavigationStateService } from './services/navigation-state.service';
export { CountryDataService } from './services/country-data.service';

// Types - explicit exports to avoid conflicts
export type {
  ViewMode,
  NavigationItem,
  NavigationState,
  ViewConfig,
  CountryData,
  ComparisonState,
} from './types/navigation.types';

export {
  isValidViewMode,
  DEFAULT_VIEW_MODE,
  VIEW_CONFIGS,
} from './types/navigation.types';
