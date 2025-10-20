/**
 * Migration State Service
 * Centralized state management for marker-based bird migration feature
 *
 * @module migration-state.service
 * @description Signal-based state management for migrations, markers, paths, and filters
 */

import { Injectable, signal, computed, effect, inject } from '@angular/core';
import {
  MigrationRecord,
  Species,
  MarkerData,
  ActivePath,
  MigrationFilters,
  MigrationStatus,
  FlywayName,
  FLYWAYS,
} from '../models/migration.types';
import { migrationLogger } from '../utils/migration-logger.utils';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Migration State Service
 * Manages all state for the marker-based migration visualization
 */
@Injectable({
  providedIn: 'root',
})
export class MigrationStateService {
  private readonly logger = inject(LoggerService);

  // ===== Core State Signals =====

  /**
   * All loaded migration records
   */
  private readonly _migrations = signal<readonly MigrationRecord[]>([]);

  /**
   * All species metadata
   */
  private readonly _species = signal<readonly Species[]>([]);

  /**
   * All rendered markers on globe
   */
  private readonly _markers = signal<readonly MarkerData[]>([]);

  /**
   * Currently active (visible) migration paths
   */
  private readonly _activePaths = signal<readonly ActivePath[]>([]);

  /**
   * Currently selected species ID (for info card display)
   */
  private readonly _selectedSpeciesId = signal<string | null>(null);

  /**
   * Currently hovered marker ID (for tooltip)
   */
  private readonly _hoveredMarkerId = signal<string | null>(null);

  /**
   * User-controlled filters
   */
  private readonly _filters = signal<MigrationFilters>({
    search: '',
    statuses: [],
    flyways: [],
    showPaths: true,
    showMarkers: true,
  });

  /**
   * Loading state
   */
  private readonly _isLoading = signal<boolean>(false);

  /**
   * Error state
   */
  private readonly _error = signal<string | null>(null);

  // ===== Public Readonly Signals =====

  readonly migrations = this._migrations.asReadonly();
  readonly species = this._species.asReadonly();
  readonly markers = this._markers.asReadonly();
  readonly activePaths = this._activePaths.asReadonly();
  readonly selectedSpeciesId = this._selectedSpeciesId.asReadonly();
  readonly hoveredMarkerId = this._hoveredMarkerId.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  // ===== Computed Signals =====

  /**
   * Filtered migrations based on user filters
   */
  readonly filteredMigrations = computed(() => {
    const migrations = this._migrations();
    const filters = this._filters();

    let filtered = [...migrations];

    // Apply search filter
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((migration) => {
        const species = this.getSpeciesById(migration.speciesId);
        if (!species) return false;

        return (
          species.commonName.toLowerCase().includes(searchLower) ||
          species.scientificName.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply flyway filter
    if (filters.flyways.length > 0) {
      filtered = filtered.filter((migration) =>
        filters.flyways.includes(migration.flyway),
      );
    }

    // Apply status filter
    if (filters.statuses.length > 0) {
      filtered = filtered.filter((migration) => {
        const status = this.determineMigrationStatus(migration);
        return filters.statuses.includes(status);
      });
    }

    return filtered;
  });

  /**
   * Visible markers based on filters and active migrations
   */
  readonly visibleMarkers = computed(() => {
    const markers = this._markers();
    const filters = this._filters();
    const filteredMigrations = this.filteredMigrations();

    if (!filters.showMarkers) {
      return [];
    }

    const filteredMigrationIds = new Set(filteredMigrations.map((m) => m.id));

    return markers.filter((marker) =>
      filteredMigrationIds.has(marker.migrationId),
    );
  });

  /**
   * Currently selected species details
   */
  readonly selectedSpecies = computed(() => {
    const speciesId = this._selectedSpeciesId();
    if (!speciesId) return null;

    return this.getSpeciesById(speciesId);
  });

  /**
   * Currently hovered marker details
   */
  readonly hoveredMarker = computed(() => {
    const markerId = this._hoveredMarkerId();
    if (!markerId) return null;

    return this._markers().find((m) => m.id === markerId) || null;
  });

  /**
   * Number of active paths
   */
  readonly activePathCount = computed(() => this._activePaths().length);

  /**
   * Total number of visible species
   */
  readonly visibleSpeciesCount = computed(() => {
    const filteredMigrations = this.filteredMigrations();
    const speciesIds = new Set(filteredMigrations.map((m) => m.speciesId));
    return speciesIds.size;
  });

  /**
   * Whether any filters are active
   */
  readonly hasActiveFilters = computed(() => {
    const filters = this._filters();
    return (
      filters.search.trim() !== '' ||
      filters.statuses.length > 0 ||
      filters.flyways.length > 0 ||
      !filters.showPaths ||
      !filters.showMarkers
    );
  });

  /**
   * Top 3 most recently selected migrations (for info card display)
   * Returns migrations with full data sorted by selection index
   */
  readonly topSelectedMigrations = computed(() => {
    const activePaths = this._activePaths();
    const migrations = this._migrations();

    // Get top 3 most recent (lowest selection indices)
    const top3Paths = [...activePaths]
      .sort(
        (a: ActivePath, b: ActivePath) => a.selectionIndex - b.selectionIndex,
      )
      .slice(0, 3);

    // Map to full migration records
    return top3Paths
      .map((path: ActivePath) => {
        const migration = migrations.find((m) => m.id === path.migrationId);
        if (!migration) return null;

        return {
          migration,
          activePath: path,
        };
      })
      .filter(
        (
          item: { migration: MigrationRecord; activePath: ActivePath } | null,
        ): item is { migration: MigrationRecord; activePath: ActivePath } =>
          item !== null,
      );
  });

  // ===== Constructor =====

  constructor() {
    // Setup effects for automatic state management
    this.setupEffects();

    migrationLogger.success('MigrationStateService initialized');
  }

  // ===== Public Methods: Data Loading =====

  /**
   * Set all migration records
   * @param migrations Array of migration records
   */
  setMigrations(migrations: readonly MigrationRecord[]): void {
    this._migrations.set(migrations);
    this.regenerateMarkers();
    migrationLogger.success(`Loaded ${migrations.length} migration records`);
  }

  /**
   * Set all species metadata
   * @param species Array of species details
   */
  setSpecies(species: readonly Species[]): void {
    this._species.set(species);
    migrationLogger.success(`Loaded ${species.length} species`);
  }

  /**
   * Load complete migration data (migrations + species)
   * @param migrations Migration records
   * @param species Species metadata
   */
  loadMigrationData(
    migrations: readonly MigrationRecord[],
    species: readonly Species[],
  ): void {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      this.setMigrations(migrations);
      this.setSpecies(species);
      this._isLoading.set(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._error.set(`Failed to load migration data: ${message}`);
      this._isLoading.set(false);
      migrationLogger.error('Failed to load migration data:', error);
    }
  }

  // ===== Public Methods: Filtering =====

  /**
   * Update user filters
   * @param filters Partial filter updates
   */
  updateFilters(filters: Partial<MigrationFilters>): void {
    this._filters.update((current) => ({ ...current, ...filters }));
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this._filters.set({
      search: '',
      statuses: [],
      flyways: [],
      showPaths: true,
      showMarkers: true,
    });
  }

  /**
   * Toggle a specific flyway filter
   * @param flyway Flyway to toggle
   */
  toggleFlyway(flyway: FlywayName): void {
    this._filters.update((current) => {
      const flyways = current.flyways.includes(flyway)
        ? current.flyways.filter((f) => f !== flyway)
        : [...current.flyways, flyway];

      return { ...current, flyways };
    });
  }

  /**
   * Toggle a specific status filter
   * @param status Status to toggle
   */
  toggleStatus(status: MigrationStatus): void {
    this._filters.update((current) => {
      const statuses = current.statuses.includes(status)
        ? current.statuses.filter((s) => s !== status)
        : [...current.statuses, status];

      return { ...current, statuses };
    });
  }

  // ===== Public Methods: Selection & Interaction =====

  /**
   * Select a migration to display its path
   * @param migrationId Migration ID to select
   */
  selectMigration(migrationId: string): void {
    this.logger.debug(
      '🔵 selectMigration() called with:',
      'MigrationState',
      migrationId,
    );

    const migration = this._migrations().find((m) => m.id === migrationId);
    if (!migration) {
      migrationLogger.warn(`Migration not found: ${migrationId}`);
      return;
    }

    this.logger.debug('🔵 Found migration:', 'MigrationState', migration);
    this.logger.debug(
      '🔵 Setting selected species to:',
      'MigrationState',
      migration.speciesId,
    );

    // Set selected species
    this._selectedSpeciesId.set(migration.speciesId);

    this.logger.debug(
      '🔵 Calling addActivePath for:',
      'MigrationState',
      migrationId,
    );

    // Add to active paths (max 5 paths)
    this.addActivePath(migrationId);

    this.logger.debug(
      '🔵 Current active paths count:',
      'MigrationState',
      this._activePaths().length,
    );

    migrationLogger.info(`Selected migration: ${migrationId}`);
  }

  /**
   * Clear current selection
   */
  clearSelection(): void {
    this._selectedSpeciesId.set(null);
  }

  /**
   * Set hovered marker
   * @param markerId Marker ID or null to clear
   */
  setHoveredMarker(markerId: string | null): void {
    this._hoveredMarkerId.set(markerId);
  }

  // ===== Public Methods: Active Paths =====

  /**
   * Add a migration path to active paths
   * Enforces maximum of 5 simultaneous paths with visual hierarchy
   * Latest selection: 100% opacity (index 0)
   * Older selections: 30% opacity (index 1+)
   * @param migrationId Migration ID to activate
   */
  addActivePath(migrationId: string): void {
    const currentPaths = this._activePaths();

    // Check if already active
    if (currentPaths.some((p) => p.migrationId === migrationId)) {
      // Move to most recent position (index 0) and update all indices
      this._activePaths.update((paths) => {
        const reorderedPaths = paths
          .map((p) => {
            if (p.migrationId === migrationId) {
              // This becomes the most recent
              return {
                ...p,
                selectionIndex: 0,
                opacity: 1.0,
                lastInteractionTime: Date.now(),
                isAnimating: true,
              };
            } else {
              // Increment selection index for older paths
              return {
                ...p,
                selectionIndex: p.selectionIndex + 1,
                opacity: 0.5,
              };
            }
          })
          .sort((a, b) => a.selectionIndex - b.selectionIndex);

        return reorderedPaths;
      });
      return;
    }

    // Enforce max 5 paths - remove oldest if needed
    let newPaths = [...currentPaths];
    if (newPaths.length >= 5) {
      // Remove path with highest selection index (oldest)
      newPaths.sort((a, b) => a.selectionIndex - b.selectionIndex);
      newPaths = newPaths.slice(0, 4); // Keep first 4 (most recent)
    }

    // Increment all existing paths' selection indices and reduce opacity
    const updatedOldPaths = newPaths.map((p) => ({
      ...p,
      selectionIndex: p.selectionIndex + 1,
      opacity: 0.5, // Older paths get 50% opacity
      isAnimating: false,
    }));

    // Add new path as most recent (index 0, 100% opacity)
    const newPath: ActivePath = {
      migrationId,
      opacity: 1.0,
      lastInteractionTime: Date.now(),
      isAnimating: true,
      selectionIndex: 0,
    };

    this._activePaths.set([newPath, ...updatedOldPaths]);

    // Regenerate markers with updated opacity values
    this.regenerateMarkers();

    migrationLogger.info(
      `Added active path: ${migrationId} (selection index: 0)`,
    );
  }

  /**
   * Remove a specific active path
   * @param migrationId Migration ID to remove
   */
  removeActivePath(migrationId: string): void {
    this._activePaths.update((paths) =>
      paths.filter((p) => p.migrationId !== migrationId),
    );

    // Regenerate markers with updated opacity values
    this.regenerateMarkers();

    migrationLogger.info(`Removed active path: ${migrationId}`);
  }

  /**
   * Clear all active paths
   */
  clearAllPaths(): void {
    this._activePaths.set([]);

    // Regenerate markers with default opacity (no active paths)
    this.regenerateMarkers();

    migrationLogger.info('Cleared all active paths');
  }

  /**
   * Handle marker click - finds migration for marker and adds active path
   * @param markerId Marker ID (format: "start-{migrationId}" or "end-{migrationId}")
   */
  handleMarkerClick(markerId: string): void {
    this.logger.debug(`🖱️ Marker clicked: ${markerId}`, 'MigrationState');

    // Extract migration ID from marker ID
    // Marker IDs are formatted as: "marker-start-{migrationId}" or "marker-end-{migrationId}" or "marker-waypoint-{migrationId}-{index}"
    let migrationId: string;

    if (
      markerId.startsWith('marker-start-') ||
      markerId.startsWith('marker-end-')
    ) {
      // marker-start-arctic-tern-2024 -> arctic-tern-2024
      migrationId = markerId.split('-').slice(2).join('-');
    } else if (markerId.startsWith('marker-waypoint-')) {
      // marker-waypoint-arctic-tern-2024-0 -> arctic-tern-2024
      const parts = markerId.split('-');
      // Remove "marker", "waypoint", and last element (index), join the rest
      migrationId = parts.slice(2, parts.length - 1).join('-');
    } else {
      this.logger.warn(
        `⚠️ Unknown marker ID format: ${markerId}`,
        'MigrationState',
      );
      return;
    }

    this.logger.debug(
      `🔍 Extracted migration ID: ${migrationId}`,
      'MigrationState',
    );

    // Check if migration exists
    const migration = this.getMigrationById(migrationId);
    if (!migration) {
      this.logger.warn(
        `⚠️ Migration not found: ${migrationId}`,
        'MigrationState',
      );
      return;
    }

    this.logger.debug(`✅ Found migration:`, 'MigrationState', migration);

    // Add active path (triggers visual hierarchy)
    this.addActivePath(migrationId);
    this.logger.debug(
      `🎯 Added active path from marker click: ${migrationId}`,
      'MigrationState',
    );
  }

  /**
   * Update path timeouts and opacity based on inactivity
   * Should be called from animation loop
   */
  updatePathTimeouts(): void {
    const now = Date.now();
    const INACTIVE_THRESHOLD = 30000; // 30 seconds

    this._activePaths.update((paths) => {
      const updated = paths.map((path) => {
        const timeSinceInteraction = now - path.lastInteractionTime;

        // Auto-hide paths after 30s of inactivity
        if (timeSinceInteraction > INACTIVE_THRESHOLD) {
          return null; // Mark for removal
        }

        // Fade out paths as they age (after 20s)
        const FADE_START = 20000;
        if (timeSinceInteraction > FADE_START) {
          const fadeProgress =
            (timeSinceInteraction - FADE_START) /
            (INACTIVE_THRESHOLD - FADE_START);
          const opacity = Math.max(0.5, 1.0 - fadeProgress * 0.5);
          return { ...path, opacity, isAnimating: false };
        }

        return path;
      });

      // Filter out null values (paths to remove)
      return updated.filter((p): p is ActivePath => p !== null);
    });
  }

  // ===== Helper Methods =====

  /**
   * Get species by ID
   * @param speciesId Species ID
   */
  private getSpeciesById(speciesId: string): Species | undefined {
    return this._species().find((s) => s.id === speciesId);
  }

  /**
   * Determine migration status based on current date
   * @param migration Migration record
   * @returns Current migration status
   */
  private determineMigrationStatus(
    migration: MigrationRecord,
  ): MigrationStatus {
    // Simplified status determination
    // In production, this would use actual dates and hemisphere logic
    const now = new Date();
    const month = now.getMonth(); // 0-11

    // Northern hemisphere breeding season (April-September)
    if (month >= 3 && month <= 8) {
      return 'breeding';
    }

    // Northern hemisphere wintering season (October-March)
    return 'wintering';
  }

  /**
   * Regenerate markers from migration data
   * Creates MarkerData objects for all start/end/waypoint locations
   */
  private regenerateMarkers(): void {
    const migrations = this._migrations();
    const markers: MarkerData[] = [];

    migrations.forEach((migration) => {
      // Determine opacity based on active paths
      const activePath = this._activePaths().find(
        (p) => p.migrationId === migration.id,
      );
      const opacity = activePath ? activePath.opacity : 1.0; // Default to full opacity if not active

      // Start marker
      markers.push({
        id: `marker-start-${migration.id}`,
        position: this.latLonToCartesian(
          migration.startLocation.lat,
          migration.startLocation.lon,
        ),
        type: 'start',
        speciesId: migration.speciesId,
        migrationId: migration.id,
        isVisible: true,
        isHovered: false,
        opacity,
      });

      // End marker
      markers.push({
        id: `marker-end-${migration.id}`,
        position: this.latLonToCartesian(
          migration.endLocation.lat,
          migration.endLocation.lon,
        ),
        type: 'end',
        speciesId: migration.speciesId,
        migrationId: migration.id,
        isVisible: true,
        isHovered: false,
        opacity,
      });

      // Waypoint markers
      migration.waypoints?.forEach((waypoint, index) => {
        markers.push({
          id: `marker-waypoint-${migration.id}-${index}`,
          position: this.latLonToCartesian(waypoint.lat, waypoint.lon),
          type: 'waypoint',
          speciesId: migration.speciesId,
          migrationId: migration.id,
          isVisible: true,
          isHovered: false,
          opacity,
        });
      });
    });

    this._markers.set(markers);
    migrationLogger.success(`Generated ${markers.length} markers`);
  }

  /**
   * Convert lat/lon to 3D Cartesian coordinates on sphere
   * @param lat Latitude in degrees
   * @param lon Longitude in degrees
   * @param radius Sphere radius (default 2.02 to match globe)
   */
  private latLonToCartesian(
    lat: number,
    lon: number,
    radius: number = 2.02,
  ): { x: number; y: number; z: number } {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return { x, y, z };
  }

  /**
   * Setup reactive effects
   */
  private setupEffects(): void {
    // Log filter changes (development only)
    effect(() => {
      const filters = this._filters();
      migrationLogger.debug('Filters updated:', filters);
    });

    // Log active path changes (development only)
    effect(() => {
      const pathCount = this._activePaths().length;
      migrationLogger.debug(`Active paths: ${pathCount}`);
    });
  }

  // ===== Utility Methods =====

  /**
   * Get migration by ID
   * @param migrationId Migration ID
   */
  getMigrationById(migrationId: string): MigrationRecord | undefined {
    return this._migrations().find((m) => m.id === migrationId);
  }

  /**
   * Get migrations for a specific species
   * @param speciesId Species ID
   */
  getMigrationsBySpecies(speciesId: string): readonly MigrationRecord[] {
    return this._migrations().filter((m) => m.speciesId === speciesId);
  }

  /**
   * Get all available flyways from loaded migrations
   */
  getAvailableFlyways(): readonly FlywayName[] {
    const migrations = this._migrations();
    const flyways = new Set(migrations.map((m) => m.flyway));
    return Array.from(flyways);
  }

  /**
   * Reset all state to defaults
   */
  reset(): void {
    this._migrations.set([]);
    this._species.set([]);
    this._markers.set([]);
    this._activePaths.set([]);
    this._selectedSpeciesId.set(null);
    this._hoveredMarkerId.set(null);
    this.clearFilters();
    this._isLoading.set(false);
    this._error.set(null);

    migrationLogger.info('Migration state reset');
  }
}
