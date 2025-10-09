/**
 * Core Migration Data Types
 * Production-ready TypeScript interfaces for bird migration feature
 *
 * @module migration.types
 * @description Comprehensive type definitions for migration paths, points, and metadata
 */

/**
 * Single migration observation point
 */
export interface MigrationPoint {
  readonly id: string; // Unique identifier (e.g., "gbif-123456")
  readonly latitude: number; // -90 to 90
  readonly longitude: number; // -180 to 180
  readonly date: Date; // Observation timestamp
  readonly accuracy: number; // Coordinate uncertainty in meters
  readonly metadata: MigrationPointMetadata;
}

/**
 * Metadata associated with a migration point
 */
export interface MigrationPointMetadata {
  readonly scientificName: string;
  readonly commonName?: string;
  readonly countryCode: string | null;
  readonly locality: string | null;
  readonly observer?: string;
  readonly basisOfRecord?: string; // OBSERVATION, HUMAN_OBSERVATION, etc.
  readonly issues?: readonly string[]; // GBIF data quality flags
  readonly isSensitive?: boolean; // Redacted for species protection
}

/**
 * Complete migration path for a species
 */
export interface MigrationPath {
  readonly id: string; // Unique path identifier
  readonly speciesKey: number; // GBIF species taxon key
  readonly scientificName: string;
  readonly commonName: string;
  readonly points: readonly MigrationPoint[];
  readonly metadata: MigrationPathMetadata;
  readonly statistics: MigrationStatistics;
}

/**
 * Migration path metadata
 */
export interface MigrationPathMetadata {
  readonly year: number;
  readonly season?: SeasonType;
  readonly hemisphere?: 'north' | 'south';
  readonly dateRange: DateRange;
  readonly sourceType: 'gbif' | 'movebank' | 'ebird' | 'manual';
  readonly dataQuality: DataQuality;
  readonly totalObservations: number;
  readonly validObservations: number;
  readonly redactedCount: number; // Number of points with redacted coordinates
  readonly fetchedAt: Date;
  readonly processingTime: number; // milliseconds
}

/**
 * Statistical analysis of migration path
 */
export interface MigrationStatistics {
  readonly totalDistance: number; // kilometers
  readonly duration: number; // days
  readonly averageSpeed: number; // km/day
  readonly boundingBox: BoundingBox;
  readonly countries: readonly string[]; // ISO country codes
  readonly continents: readonly string[];
  readonly highestLatitude: number;
  readonly lowestLatitude: number;
  readonly crossesEquator: boolean;
  readonly crossesDateLine: boolean;
}

/**
 * Geographic bounding box
 */
export interface BoundingBox {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

/**
 * Date range with granularity
 */
export interface DateRange {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly granularity: 'day' | 'week' | 'month' | 'year';
}

/**
 * Season types for migration
 */
export type SeasonType =
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'year-round';

/**
 * Data quality assessment levels
 */
export type DataQuality =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'insufficient';

/**
 * Species metadata for migration tracking
 */
export interface SpeciesMetadata {
  readonly speciesKey: number; // GBIF taxon key
  readonly scientificName: string;
  readonly commonName: string;
  readonly family: string;
  readonly order: string;
  readonly migrationType: MigrationType;
  readonly conservationStatus: ConservationStatus;
  readonly isSensitive: boolean; // Requires coordinate redaction
  readonly migrationRange: MigrationRange;
  readonly thumbnailUrl?: string;
  readonly description?: string;
  readonly lastUpdated: Date;
}

/**
 * Migration behavior types
 */
export type MigrationType =
  | 'long-distance'
  | 'short-distance'
  | 'altitudinal'
  | 'nomadic'
  | 'resident';

/**
 * IUCN conservation status codes
 */
export type ConservationStatus =
  | 'LC'
  | 'NT'
  | 'VU'
  | 'EN'
  | 'CR'
  | 'EW'
  | 'EX'
  | 'DD'
  | 'NE';

/**
 * Migration distance categories
 */
export type MigrationRange =
  | 'short'
  | 'medium'
  | 'long'
  | 'transcontinental'
  | 'polar'
  | 'circumpolar';

/**
 * Cache entry for IndexedDB storage
 */
export interface CacheEntry<T> {
  readonly key: string;
  readonly data: T;
  readonly timestamp: number;
  readonly expiresAt: number;
  readonly metadata: CacheMetadata;
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  readonly version: number;
  readonly size: number; // bytes
  readonly compressed: boolean;
  readonly source: string;
  readonly integrity?: string; // SHA-256 hash for validation
}

/**
 * Globe mode enumeration with migration support
 */
export type GlobeMode = 'countries' | 'migration' | 'quiz';

/**
 * Playback state for migration animation
 */
export interface PlaybackState {
  readonly isPlaying: boolean;
  readonly speed: PlaybackSpeed;
  readonly currentTime: number; // milliseconds since start
  readonly duration: number; // total duration in milliseconds
  readonly loop: boolean;
  readonly direction: 'forward' | 'reverse';
}

/**
 * Playback speed multipliers
 */
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8;

/**
 * Progress callback for async operations
 */
export interface ProgressCallback {
  (progress: ProgressInfo): void;
}

/**
 * Progress information
 */
export interface ProgressInfo {
  readonly current: number;
  readonly total: number;
  readonly percentage: number; // 0-100
  readonly stage: LoadingStage;
  readonly message?: string;
  readonly estimatedTimeRemaining?: number; // milliseconds
}

/**
 * Loading stages for UI feedback
 */
export type LoadingStage =
  | 'initializing'
  | 'fetching'
  | 'parsing'
  | 'processing'
  | 'caching'
  | 'rendering'
  | 'complete';

/**
 * Error information for user feedback
 */
export interface MigrationError {
  readonly type: ErrorType;
  readonly message: string;
  readonly code?: string;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;
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
  | 'rendering'
  | 'worker'
  | 'unknown';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  readonly requestsPerMinute: number;
  readonly requestsPerHour: number;
  readonly retryAfter: number; // milliseconds
  readonly maxRetries: number;
}

/**
 * Sensitive species protection configuration
 */
export interface SensitiveSpeciesConfig {
  readonly enabled: boolean;
  readonly redactionPrecision: number; // degrees (e.g., 0.5 = ~55km)
  readonly protectedSpecies: readonly number[]; // GBIF taxon keys
  readonly reasonCode: string;
}

// ===== NEW MARKER-BASED UX TYPES =====

/**
 * Single migration record with start/end locations
 * Simplified structure optimized for marker-based visualization
 */
export interface MigrationRecord {
  readonly id: string; // Unique migration ID (e.g., "arctic-tern-2024")
  readonly speciesId: string; // Species identifier (e.g., "arctic-tern")
  readonly startLocation: MigrationLocation;
  readonly endLocation: MigrationLocation;
  readonly waypoints?: readonly MigrationLocation[]; // Optional intermediate points
  readonly distanceKm: number; // Total migration distance
  readonly durationDays: number; // Migration duration in days
  readonly flyway: FlywayName; // Flyway name (e.g., "Atlantic Americas")
  readonly isSensitive: boolean; // Whether coordinates are redacted
}

/**
 * Migration location with geographic and temporal data
 */
export interface MigrationLocation {
  readonly lat: number; // Latitude (-90 to 90)
  readonly lon: number; // Longitude (-180 to 180)
  readonly name: string; // Location name (e.g., "Greenland")
  readonly date?: Date; // Optional observation date
}

/**
 * Species information for marker-based UX
 * Enhanced with UI-friendly metadata
 */
export interface Species {
  readonly id: string; // Species ID (e.g., "arctic-tern")
  readonly commonName: string; // Common name (e.g., "Arctic Tern")
  readonly scientificName: string; // Scientific name (e.g., "Sterna paradisaea")
  readonly imageUrl?: string; // Optional species image URL
  readonly description: string; // Brief species description for info cards
  readonly conservationStatus: ConservationStatus; // IUCN status
  readonly wikipediaUrl?: string; // Optional Wikipedia link
  readonly funFact?: string; // Interesting species fact for engagement
}

/**
 * Marker data for 3D globe rendering
 * Represents a visual marker on the globe (start/end/waypoint)
 */
export interface MarkerData {
  readonly id: string; // Unique marker ID
  readonly position: { x: number; y: number; z: number }; // 3D position on globe (Vector3-compatible)
  readonly type: MarkerType; // Marker type
  readonly speciesId: string; // Associated species ID
  readonly migrationId: string; // Associated migration ID
  readonly isVisible: boolean; // Visibility state
  readonly isHovered: boolean; // Hover state
  readonly opacity: number; // Opacity level (0-1) based on active path visual hierarchy
}

/**
 * Marker type enumeration
 */
export type MarkerType = 'start' | 'end' | 'waypoint';

/**
 * Active migration path rendering state
 * Tracks paths currently displayed on the globe
 */
export interface ActivePath {
  readonly migrationId: string; // Migration ID
  readonly opacity: number; // Path opacity (0-1)
  readonly lastInteractionTime: number; // Timestamp of last interaction (ms)
  readonly isAnimating: boolean; // Whether path draw animation is active
  readonly selectionIndex: number; // Selection order (0 = most recent)
}

/**
 * User-controlled migration filters
 * Controls which migrations/markers are visible
 */
export interface MigrationFilters {
  readonly search: string; // Search query for species names
  readonly statuses: readonly MigrationStatus[]; // Filter by migration status
  readonly flyways: readonly FlywayName[]; // Filter by flyways
  readonly showPaths: boolean; // Toggle path visibility
  readonly showMarkers: boolean; // Toggle marker visibility
}

/**
 * Migration status types for filtering
 * Based on current time of year and species behavior
 */
export type MigrationStatus =
  | 'breeding'
  | 'wintering'
  | 'migrating'
  | 'all-year';

/**
 * Flyway names for major migration routes
 * Based on established global flyway classifications
 */
export const FLYWAYS = [
  'Atlantic Americas',
  'Pacific Americas',
  'Mississippi Americas',
  'East Atlantic',
  'Black Sea/Mediterranean',
  'East Asia-Australasian',
  'Central Asian',
  'West Pacific',
] as const;

export type FlywayName = (typeof FLYWAYS)[number];
