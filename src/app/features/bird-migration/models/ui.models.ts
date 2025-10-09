/**
 * UI Models for Bird Migration Feature
 * Defines TypeScript interfaces for the user interface components
 */

/**
 * Season enumeration with proper typing
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Hemisphere enumeration
 */
export type Hemisphere = 'north' | 'south';

/**
 * Season configuration interface
 */
export interface SeasonConfig {
  readonly id: Season;
  readonly name: string;
  readonly icon: string;
  readonly northMonths: readonly [number, number, number]; // [start, mid, end] months (0-11)
  readonly southMonths: readonly [number, number, number];
  readonly color: string;
  readonly description: string;
}

/**
 * Hemisphere-aware season information
 */
export interface SeasonInfo {
  readonly season: Season;
  readonly hemisphere: Hemisphere;
  readonly months: readonly [number, number, number];
  readonly monthLabels: readonly [string, string, string];
  readonly displayLabel: string;
  readonly isCurrentSeason: boolean;
}

/**
 * Date range interface for custom date selection
 */
export interface DateRange {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly granularity: DateGranularity;
}

/**
 * Date granularity options
 */
export type DateGranularity = 'day' | 'week' | 'month';

/**
 * Preview data histogram point
 */
export interface HistogramPoint {
  readonly date: Date;
  readonly count: number;
  readonly density: number; // 0-1 normalized
}

/**
 * Migration data point from GBIF
 */
export interface MigrationDataPoint {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly date: Date;
  readonly accuracy: number; // Coordinate uncertainty in meters
  readonly metadata: {
    readonly scientificName: string;
    readonly countryCode: string | null;
    readonly locality: string | null;
    readonly issues?: readonly string[];
  };
}

/**
 * Migration data preview information
 */
export interface MigrationPreview {
  readonly totalPoints: number;
  readonly quality: DataQuality;
  readonly coverage: number; // 0-100 percentage
  readonly histogram: readonly HistogramPoint[];
  readonly dateRange: DateRange;
  readonly estimatedSize: number; // bytes
  readonly processingTime: number; // milliseconds estimated
}

/**
 * Data quality assessment
 */
export type DataQuality =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'insufficient';

/**
 * Species selection interface
 */
export interface SpeciesInfo {
  readonly id: string; // GBIF taxon key
  readonly scientificName: string;
  readonly commonName: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly imageUrl?: string;
  readonly family?: string;
  readonly order?: string;
  readonly migrationRange: MigrationRange;
  readonly conservationStatus?: ConservationStatus;
  readonly isPopular: boolean;
  readonly lastSelected?: Date;
}

/**
 * Migration range classification
 */
export type MigrationRange =
  | 'short'
  | 'medium'
  | 'long'
  | 'transcontinental'
  | 'polar';

/**
 * Conservation status
 */
export type ConservationStatus = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

/**
 * Timeline scrubber state
 */
export interface TimelineState {
  readonly currentDate: Date;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly isPlaying: boolean;
  readonly playbackSpeed: PlaybackSpeed;
  readonly progress: number; // 0-1
}

/**
 * Playback speed options
 */
export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

/**
 * UI loading state
 */
export interface LoadingState {
  readonly isLoading: boolean;
  readonly progress?: number; // 0-100
  readonly message?: string;
  readonly stage?: LoadingStage;
}

/**
 * Loading stages
 */
export type LoadingStage =
  | 'fetching'
  | 'parsing'
  | 'processing'
  | 'rendering'
  | 'caching';

/**
 * Error state information
 */
export interface ErrorState {
  readonly hasError: boolean;
  readonly errorType?: ErrorType;
  readonly message?: string;
  readonly canRetry: boolean;
  readonly hasFallback: boolean;
}

/**
 * Error types
 */
export type ErrorType =
  | 'network'
  | 'api'
  | 'parsing'
  | 'storage'
  | 'validation'
  | 'unknown';

/**
 * Quick preset date ranges
 */
export interface DatePreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly getDates: (currentDate: Date, hemisphere: Hemisphere) => DateRange;
  readonly isAvailable: (currentDate: Date) => boolean;
}

/**
 * Responsive breakpoint information
 */
export interface ViewportInfo {
  readonly width: number;
  readonly height: number;
  readonly breakpoint: Breakpoint;
  readonly isMobile: boolean;
  readonly isTablet: boolean;
  readonly isDesktop: boolean;
  readonly hasTouch: boolean;
}

/**
 * Responsive breakpoints
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

/**
 * Accessibility preferences
 */
export interface AccessibilityPreferences {
  readonly prefersReducedMotion: boolean;
  readonly prefersHighContrast: boolean;
  readonly useScreenReader: boolean;
  readonly keyboardNavigation: boolean;
}

/**
 * Component visibility state
 */
export interface ComponentVisibility {
  readonly seasonSelector: boolean;
  readonly hemisphereToggle: boolean;
  readonly yearSelector: boolean;
  readonly customDateModal: boolean;
  readonly speciesSelector: boolean;
  readonly previewPanel: boolean;
  readonly timelineScrubber: boolean;
}

/**
 * User interaction state
 */
export interface InteractionState {
  readonly hoveredSeason?: Season;
  readonly focusedElement?: string;
  readonly selectedSeason?: Season;
  readonly selectedSpecies?: SpeciesInfo;
  readonly activeModal?: string;
  readonly isInteracting: boolean;
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  readonly duration: number; // milliseconds
  readonly easing: string;
  readonly delay: number;
  readonly enabled: boolean;
}

/**
 * Theme configuration for bird migration UI
 */
export interface BirdMigrationTheme {
  readonly colors: {
    readonly spring: string;
    readonly summer: string;
    readonly autumn: string;
    readonly winter: string;
    readonly accent: string;
    readonly warning: string;
    readonly error: string;
    readonly success: string;
  };
  readonly animations: {
    readonly seasonTransition: AnimationConfig;
    readonly modalFade: AnimationConfig;
    readonly previewUpdate: AnimationConfig;
    readonly timelineProgress: AnimationConfig;
  };
  readonly spacing: {
    readonly chipGap: string;
    readonly modalPadding: string;
    readonly componentMargin: string;
  };
}

/**
 * Simplified filter criteria for future use
 */
export interface FilterCriteria {
  readonly dateRange?: DateRange;
  readonly species?: string[];
  readonly regions?: string[];
}

/**
 * Simplified comparison dataset for future use
 */
export interface ComparisonDataset {
  readonly id: string;
  readonly name: string;
  readonly data: readonly MigrationDataPoint[];
}

/**
 * Comparison modes for future use
 */
export type ComparisonMode = 'overlay' | 'split' | 'difference' | 'timeline';

/**
 * Component state aggregation interface
 */
export interface BirdMigrationUIState {
  readonly season: SeasonInfo;
  readonly hemisphere: Hemisphere;
  readonly year: number;
  readonly species: SpeciesInfo | null;
  readonly dateRange: DateRange | null;
  readonly preview: MigrationPreview | null;
  readonly timeline: TimelineState | null;
  readonly loading: LoadingState;
  readonly error: ErrorState;
  readonly viewport: ViewportInfo;
  readonly accessibility: AccessibilityPreferences;
  readonly visibility: ComponentVisibility;
  readonly interaction: InteractionState;
}
