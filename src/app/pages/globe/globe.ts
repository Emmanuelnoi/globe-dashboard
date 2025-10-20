import { AccessibilityService } from '@/core/services/accessibility.service';
import { GlobalErrorHandlerService } from '@/core/services/global-error-handler.service';
import { GlobeErrorRecoveryService } from '@/core/services/globe-error-recovery.service';
import { LoggerService } from '@/core/services/logger.service';
import { MemoryManagementService } from '@/core/services/memory-management.service';
import { ErrorBoundaryComponent } from '@/shared/components/error-boundary/error-boundary.component';
import { LoadingComponent } from '@/shared/components/loading/loading.component';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { CountryIdTextureService } from '@lib/services/country-id-texture.service';
import {
  CountrySelectionService,
  createInteractiveCountries,
  createInteractiveCountriesFromTopo,
  disposeTopoJSONMeshes,
  loadGeoJSON,
  loadTopoJSON,
  type TopoJSONRenderOptions,
} from '@lib/utils';
import { Group, Mesh, Object3D } from 'three';
import { CountryDataService } from '../../core/services/country-data.service';
import { CountryHoverService } from '../../core/services/country-hover.service';
import { InteractionModeService } from '../../core/services/interaction-mode';
import { QuizStateService } from '../../features/quiz/services/quiz-state';
import { CountryNameTooltipComponent } from '../../shared/components/country-name-tooltip/country-name-tooltip';
import {
  MigrationInfoCardComponent,
  type MigrationCardData,
} from '@/features/bird-migration/components/migration-info-card/migration-info-card';
import { MarkerTooltipComponent } from '@/features/bird-migration/components/marker-tooltip/marker-tooltip';
import { MigrationStateService } from '@/features/bird-migration/services/migration-state.service';
import { NavigationStateService } from '@/core/services/navigation-state.service';
import { GlobeAccessibilityService } from './services/globe-accessibility.service';
import { GlobeComparisonSyncService } from './services/globe-comparison-sync.service';
import { GlobeCountrySelectionService } from './services/globe-country-selection.service';
import { GlobeDataLoadingService } from './services/globe-data-loading.service';
import { GlobeMigrationService } from './services/globe-migration.service';
import { GlobeQuizIntegrationService } from './services/globe-quiz-integration.service';
import { GlobeSceneService } from './services/globe-scene.service';
import { GlobeTooltipService } from './services/globe-tooltip.service';
@Component({
  selector: 'app-globe',
  imports: [
    CommonModule,
    LoadingComponent,
    ErrorBoundaryComponent,
    CountryNameTooltipComponent,
    MigrationInfoCardComponent,
    MarkerTooltipComponent,
  ],
  templateUrl: './globe.component.html',
  styleUrls: ['./globe.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Globe implements AfterViewInit, OnDestroy {
  private errorHandler = inject(GlobalErrorHandlerService);
  private memoryManager = inject(MemoryManagementService);
  private errorRecovery = inject(GlobeErrorRecoveryService);
  protected accessibility = inject(AccessibilityService);
  private countryIdTextureService = inject(CountryIdTextureService);
  private countrySelectionService = inject(CountrySelectionService);
  private countryDataService = inject(CountryDataService);
  private countryHoverService = inject(CountryHoverService);
  protected interactionModeService = inject(InteractionModeService);
  private quizStateService = inject(QuizStateService);

  // New services for code organization
  private readonly globeSceneService = inject(GlobeSceneService);
  protected readonly globeMigrationService = inject(GlobeMigrationService);
  readonly migrationState = inject(MigrationStateService);
  readonly navigationStateService = inject(NavigationStateService);
  private readonly logger = inject(LoggerService);
  private readonly countrySelection = inject(GlobeCountrySelectionService);
  private readonly quizIntegration = inject(GlobeQuizIntegrationService);
  private readonly tooltipService = inject(GlobeTooltipService);
  private readonly dataLoading = inject(GlobeDataLoadingService);
  private readonly globeAccessibility = inject(GlobeAccessibilityService);
  private readonly comparisonSync = inject(GlobeComparisonSyncService);

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rendererContainer', { static: true })
  private rendererContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('errorBoundary')
  private errorBoundary!: ElementRef<ErrorBoundaryComponent>;

  // Proxy signals from services (no duplication)
  protected get isLoading(): typeof this.dataLoading.isLoading {
    return this.dataLoading.isLoading;
  }
  protected get loadingProgress(): typeof this.dataLoading.loadingProgress {
    return this.dataLoading.loadingProgress;
  }
  protected get loadingMessage(): typeof this.dataLoading.loadingMessage {
    return this.dataLoading.loadingMessage;
  }
  protected get initError(): typeof this.dataLoading.initError {
    return this.dataLoading.initError;
  }

  protected get countryNameTooltipVisible(): typeof this.tooltipService.countryNameTooltipVisible {
    return this.tooltipService.countryNameTooltipVisible;
  }
  protected get hoveredCountryName(): typeof this.tooltipService.hoveredCountryName {
    return this.tooltipService.hoveredCountryName;
  }
  protected get countryNameTooltipPosition(): typeof this.tooltipService.countryNameTooltipPosition {
    return this.tooltipService.countryNameTooltipPosition;
  }
  protected get selectedCountry(): typeof this.tooltipService.selectedCountry {
    return this.tooltipService.selectedCountry;
  }

  protected get quizCandidate(): typeof this.quizIntegration.quizCandidate {
    return this.quizIntegration.quizCandidate;
  }

  // Migration info card data
  protected readonly migrationCardData = computed<readonly MigrationCardData[]>(
    () => {
      const activePaths = this.migrationState.activePaths();
      const migrations = this.migrationState.migrations();
      const species = this.migrationState.species();

      return activePaths.slice(0, 3).map((activePath) => {
        const migration = migrations.find(
          (m) => m.id === activePath.migrationId,
        );
        const speciesData = species.find((s) => s.id === migration?.speciesId);

        // Reverse geocode start and end locations to country names
        let startCountry: string | undefined;
        let endCountry: string | undefined;
        let waypointCountries: string[] | undefined;

        if (migration) {
          startCountry = this.reverseGeocodeToCountryName(
            migration.startLocation.lat,
            migration.startLocation.lon,
          );
          endCountry = this.reverseGeocodeToCountryName(
            migration.endLocation.lat,
            migration.endLocation.lon,
          );

          // Reverse geocode waypoints if they exist
          if (migration.waypoints && migration.waypoints.length > 0) {
            waypointCountries = migration.waypoints
              .map((wp) => this.reverseGeocodeToCountryName(wp.lat, wp.lon))
              .filter((name): name is string => name !== undefined);
          }
        }

        return {
          migration: migration!,
          activePath,
          species: speciesData,
          startCountry,
          endCountry,
          waypointCountries,
        };
      });
    },
  );

  // Migration info card handlers
  protected readonly handleClearAllMigrations = () => {
    this.logger.debug('🧹 Clear All Paths button clicked', 'GlobeComponent');
    this.logger.debug(
      `📊 Active paths BEFORE clear: ${this.migrationState.activePaths().length}`,
      'GlobeComponent',
    );

    this.migrationState.clearAllPaths();

    this.logger.debug(
      `📊 Active paths AFTER clear: ${this.migrationState.activePaths().length}`,
      'GlobeComponent',
    );
    this.logger.debug(
      `📊 Migration card data length: ${this.migrationCardData().length}`,
      'GlobeComponent',
    );
  };

  protected readonly handleRemoveMigration = (migrationId: string) => {
    this.migrationState.removeActivePath(migrationId);
  };

  // 3D objects (component-specific, not managed by services)
  private countries!: Group;
  private lastSelectedCountryMesh: Mesh | null = null;

  // Flag to prevent infinite loops during bi-directional sync
  private isSyncingFromTable = false;

  // Track previous selection state to detect removals
  private previousSelectedCodes: Set<string> = new Set();

  // Track previous quiz state to prevent infinite loops
  private previousWasInQuizView = false;

  // Track previous bird migration state to prevent infinite loops
  private previousWasInBirdMigrationView = false;

  // Event listeners for cleanup
  private eventListeners: Array<{
    element: HTMLElement;
    event: string;
    handler: EventListener;
  }> = [];

  // Timeout constants
  private readonly DOUBLE_CLICK_DELAY = 250;
  private readonly HOVER_THROTTLE = 16; // ~60fps
  private readonly TOOLTIP_HIDE_DELAY = 2000;
  private readonly QUIZ_TOOLTIP_DELAY = 1000;
  private readonly RETRY_INITIALIZATION_DELAY = 1000;

  // TopoJSON rendering configuration
  private useTopoJSON = true; // Toggle between GeoJSON and TopoJSON
  private renderingMode = signal<'geojson' | 'topojson'>('topojson');
  private topoJSONOptions: TopoJSONRenderOptions = {
    radius: 2.0,
    borderOffset: 0.001, // Minimal offset to prevent z-fighting while staying close to surface
    enableFillMeshes: true,
  };

  constructor() {
    // Setup effect for selection texture updates (needs to be in injection context)
    effect(() => {
      const selectedIds = this.countrySelectionService.selectedCountries();
      // Only update if the selection mask is initialized
      if (this.countryIdTextureService.getSelectionMaskTexture()) {
        this.countryIdTextureService.updateSelectionMask(selectedIds);
      }
    });

    // Setup effect for quiz candidate highlighting
    effect(() => {
      const selectedCandidate = this.quizStateService.selectedCandidate();
      const gameState = this.quizStateService.gameState();

      // Clear quiz highlight when candidate is cleared or game ends
      if (!selectedCandidate || gameState === 'idle' || gameState === 'ended') {
        this.quizIntegration.clearQuizCandidateHighlight();
      }
    });

    // Setup effect to clear all selections when entering quiz view OR quiz mode
    effect(() => {
      const isQuizMode = this.interactionModeService.isQuizMode();
      const isGameQuizView = this.navigationStateService.isGameQuizActive();
      const isInQuizView = isQuizMode || isGameQuizView;

      // Only trigger when ENTERING quiz view (not when already in it)
      if (isInQuizView && !this.previousWasInQuizView) {
        // Clear selected country data tooltip and name tooltip (always, even if countries not loaded)
        this.tooltipService.hideAllTooltips();
        this.selectedCountry.set(null);

        // Clear all visual selections on globe (only if countries are loaded)
        if (this.countries) {
          this.countrySelection.resetAllCountrySelections(this.countries);
        }

        this.logger.debug(
          `Cleared all selections and tooltips (quiz mode: ${isQuizMode}, quiz view: ${isGameQuizView})`,
          'GlobeComponent',
        );
      }

      // Update previous state
      this.previousWasInQuizView = isInQuizView;
    });

    // Setup effect to clear all selections when entering bird migration view
    effect(() => {
      const isBirdMigrationView =
        this.navigationStateService.isBirdMigrationActive();

      // Only trigger when ENTERING bird migration view (not when already in it)
      if (isBirdMigrationView && !this.previousWasInBirdMigrationView) {
        // Clear selected country data tooltip and name tooltip
        this.tooltipService.hideAllTooltips();
        this.selectedCountry.set(null);

        // Clear all visual selections on globe (only if countries are loaded)
        if (this.countries) {
          this.countrySelection.resetAllCountrySelections(this.countries);
        }

        this.logger.debug(
          `Cleared all selections and tooltips (bird migration view active)`,
          'GlobeComponent',
        );
      }

      // Update previous state
      this.previousWasInBirdMigrationView = isBirdMigrationView;
    });

    // Setup bi-directional sync: comparison table → globe visual selections
    // Using a manual check approach instead of effects to avoid infinite loops
    effect(() => {
      const selectedCountryCodes = this.countryDataService.selectedCountries();

      // Prevent infinite loops - skip if we're in the middle of syncing
      if (this.isSyncingFromTable) {
        return;
      }

      // Early exit if countries not loaded yet
      if (!this.countries || this.countries.children.length === 0) {
        return;
      }

      // Convert to Set for easy comparison
      const currentCodes = new Set(selectedCountryCodes);

      // Find removed countries (were in previous, not in current)
      const removedCodes = Array.from(this.previousSelectedCodes).filter(
        (code) => !currentCodes.has(code),
      );

      // Find added countries (in current, not in previous)
      const addedCodes = selectedCountryCodes.filter(
        (code) => !this.previousSelectedCodes.has(code),
      );

      // Only process if there are actual changes
      if (removedCodes.length === 0 && addedCodes.length === 0) {
        return;
      }

      // Set flag to prevent re-entry
      this.isSyncingFromTable = true;

      try {
        // Handle removals - remove visual selection from globe
        if (removedCodes.length > 0) {
          removedCodes.forEach((countryCode) => {
            const country =
              this.countryDataService.getCountryByCode(countryCode);
            if (country) {
              this.countrySelection.removeCountrySelectionByName(
                country.name,
                this.countries,
              );

              this.logger.debug(
                `Removed visual selection: ${country.name}`,
                'GlobeComponent',
              );
            }
          });
        }

        // Handle additions - add visual selection to globe
        if (addedCodes.length > 0) {
          addedCodes.forEach((countryCode) => {
            const country =
              this.countryDataService.getCountryByCode(countryCode);
            if (country) {
              this.countrySelection.applyPersistentCountrySelection(
                country.name,
                this.countries,
                false, // Don't reset - additive
              );

              this.logger.debug(
                `Added visual selection: ${country.name}`,
                'GlobeComponent',
              );
            }
          });
        }

        // Update previous state
        this.previousSelectedCodes = currentCodes;

        this.logger.debug(
          `Synced globe: +${addedCodes.length} -${removedCodes.length}`,
          'GlobeComponent',
        );
      } finally {
        // Always reset flag, even if error occurs
        this.isSyncingFromTable = false;
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.initializeScene();

      // Initialize accessibility features after scene is ready
      this.accessibility.initialize();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  private async initializeScene(): Promise<void> {
    this.loadingMessage.set('Initializing 3D scene...');
    this.loadingProgress.set(10);

    // Initialize GlobeSceneService (handles WebGL check, scene setup, renderer, controls)
    await this.globeSceneService.initialize(this.rendererContainer);

    this.loadingProgress.set(30);
    this.loadingMessage.set('Loading country selection assets...');

    // Load GPU selection assets first
    await this.countryIdTextureService.loadCountryIdAssets();

    this.loadingProgress.set(60);
    this.loadingMessage.set('Loading geographic data...');

    // Get scene reference for adding countries
    const scene = this.globeSceneService.getScene();
    if (!scene) {
      throw new Error('Scene not initialized');
    }

    // Setup country selection interactions
    this.setupCountrySelectionInteractions();

    // Initialize quiz materials (import COUNTRY_MATERIALS)
    const { COUNTRY_MATERIALS } = await import('@lib/utils');
    this.quizIntegration.initializeQuizMaterials(COUNTRY_MATERIALS.quiz.fill);

    // Load countries data
    await this.loadAllData();

    this.loadingProgress.set(80);
    this.loadingMessage.set('Initializing migration system...');

    // Initialize migration system
    await this.initializeMigrationSystem();

    // Start animation loop
    this.globeSceneService.startAnimation();

    this.loadingProgress.set(100);
    this.loadingMessage.set('Complete!');

    setTimeout(() => {
      this.isLoading.set(false);
    }, 500);
  }

  /**
   * Initialize the bird migration visualization system
   */
  private async initializeMigrationSystem(): Promise<void> {
    try {
      const scene = this.globeSceneService.getScene();
      const camera = this.globeSceneService.getCamera();

      if (!scene || !camera || !this.rendererContainer) {
        this.logger.warn(
          'Cannot initialize migration system - scene not ready',
          'GlobeComponent',
        );
        return;
      }

      await this.globeMigrationService.initialize(
        scene,
        camera,
        this.rendererContainer,
        undefined, // atmosphere mesh is optional
      );

      this.logger.success(
        'Migration system initialized successfully',
        'GlobeComponent',
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize migration system:',
        error,
        'GlobeComponent',
      );
      // Don't throw - migration is optional feature
    }
  }

  /**
   * Reinitialize the entire scene (for context loss recovery)
   */
  private async reinitializeScene(): Promise<void> {
    try {
      // Clear current state
      this.cleanup();

      // Reinitialize everything
      await this.initializeScene();
    } catch (error) {
      this.logger.error(
        'Failed to reinitialize scene',
        error,
        'GlobeComponent',
      );
      this.handleInitializationError(error);
    }
  }

  private async loadAllData(): Promise<void> {
    if (this.useTopoJSON) {
      await this.loadTopoJSONData();
    } else {
      await this.loadGeoJSONData();
    }
  }

  /**
   * Load geographic data using optimized TopoJSON with unified borders
   */
  private async loadTopoJSONData(): Promise<void> {
    try {
      this.renderingMode.set('topojson');

      // Get scene from service
      const scene = this.globeSceneService.getScene();
      if (!scene) {
        throw new Error('Scene not initialized');
      }

      // Load TopoJSON topology with retry mechanism
      const topology = await this.loadWithRetry(
        () => loadTopoJSON('/data/world.topo.json'),
        3,
      );

      // Create unified border visualization
      const countriesObject = createInteractiveCountriesFromTopo(
        topology,
        this.topoJSONOptions,
      );

      // Store reference and add to scene
      this.countries = countriesObject;
      scene.add(countriesObject);

      // Ensure country objects have countryId in userData for selection service
      this.countrySelection.ensureCountryIds(this.countries);

      // Sync with any existing comparison table selections (inline)
      const selectedCountryCodes = this.countryDataService.selectedCountries();

      // Initialize previous state to prevent effect from triggering on first load
      this.previousSelectedCodes = new Set(selectedCountryCodes);

      selectedCountryCodes.forEach((countryCode) => {
        const country = this.countryDataService.getCountryByCode(countryCode);
        if (country) {
          this.countrySelection.applyPersistentCountrySelection(
            country.name,
            this.countries,
          );
        }
      });

      // Force render after countries are loaded
      this.globeSceneService.requestRender();
    } catch (error) {
      this.errorHandler.handleNetworkError(
        error as Error,
        '/data/world.topo.json',
      );

      // Fallback to GeoJSON if TopoJSON fails
      try {
        await this.loadGeoJSONData();
      } catch (fallbackError) {
        this.logger.warn(
          'Both TopoJSON and GeoJSON failed, showing basic globe',
          'GlobeComponent',
          fallbackError,
        );
      }
    }
  }

  /**
   * Load geographic data using traditional GeoJSON (fallback method)
   */
  private async loadGeoJSONData(): Promise<void> {
    try {
      this.renderingMode.set('geojson');

      // Load countries data with timeout and retry
      const countriesData = await this.loadWithRetry(
        () => loadGeoJSON('/data/countries-50m.geojson'),
        3,
      );

      // Create countries layer using traditional method
      const countriesObject = createInteractiveCountries(countriesData, 2);

      // Store reference and add to scene
      this.countries = countriesObject;
      const scene = this.globeSceneService.getScene();
      if (scene) {
        scene.add(countriesObject);
      }

      // Ensure country objects have countryId in userData for selection service
      this.countrySelection.ensureCountryIds(this.countries);

      // Sync with any existing comparison table selections (inline)
      const selectedCountryCodes = this.countryDataService.selectedCountries();

      // Initialize previous state to prevent effect from triggering on first load
      this.previousSelectedCodes = new Set(selectedCountryCodes);

      selectedCountryCodes.forEach((countryCode) => {
        const country = this.countryDataService.getCountryByCode(countryCode);
        if (country) {
          this.countrySelection.applyPersistentCountrySelection(
            country.name,
            this.countries,
          );
        }
      });

      // Force render after countries are loaded
      this.globeSceneService.requestRender();
    } catch (error) {
      this.errorHandler.handleNetworkError(
        error as Error,
        '/data/countries-50m.geojson',
      );
      // Continue without country data - show basic globe
      this.logger.warn(
        'Failed to load country data, showing basic globe',
        'GlobeComponent',
        error,
      );
    }
  }

  private async loadWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, attempt)),
        );
      }
    }
    throw new Error('Max retries exceeded');
  }

  private handleInitializationError(error: Error | unknown): void {
    this.logger.error('Globe initialization failed', error, 'GlobeComponent');
    this.isLoading.set(false);

    let errorMessage = 'Failed to initialize 3D scene';

    const errorObj = error as { message?: string };
    if (errorObj?.message?.includes('WebGL')) {
      errorMessage = 'WebGL is not supported or enabled in your browser';
    } else if (errorObj?.message?.includes('texture')) {
      errorMessage = 'Failed to load Earth textures';
    } else if (errorObj?.message?.includes('renderer')) {
      errorMessage = 'Failed to initialize 3D renderer';
    }

    this.initError.set(errorMessage);

    // Convert to Error if unknown type
    const errorToReport =
      error instanceof Error ? error : new Error(String(error));
    this.errorHandler.handleWebGLError(errorToReport, 'globe_initialization');
  }

  // Public methods for error boundary
  handleRetry(): void {
    this.retryInitialization();
  }

  /**
   * Toggle between TopoJSON and GeoJSON rendering modes
   * @param useTopoJSON Whether to use TopoJSON (true) or GeoJSON (false)
   */
  async toggleRenderingMode(useTopoJSON: boolean): Promise<void> {
    if (this.useTopoJSON === useTopoJSON) return;

    this.useTopoJSON = useTopoJSON;
    this.dataLoading.setLoading(true, 'Loading...', 50);

    // Remove existing countries if present
    if (this.countries) {
      if (this.renderingMode() === 'topojson') {
        disposeTopoJSONMeshes(this.countries);
      }
      const scene = this.globeSceneService.getScene();
      if (scene) {
        scene.remove(this.countries);
      }
    }

    try {
      // Reload data with new rendering mode
      await this.loadAllData();

      this.loadingProgress.set(100);
      setTimeout(() => {
        this.isLoading.set(false);
      }, 300);
    } catch (error) {
      this.logger.error(
        'Failed to switch rendering mode',
        error,
        'GlobeComponent',
      );
      this.handleInitializationError(error);
    }
  }

  /**
   * Get current rendering mode
   */
  getCurrentRenderingMode(): 'geojson' | 'topojson' {
    return this.renderingMode();
  }

  retryInitialization(): void {
    // Reset states
    this.initError.set(null);
    this.isLoading.set(true);
    this.loadingProgress.set(0);

    // Clean up existing scene if any
    this.cleanup();

    // Retry initialization
    setTimeout(() => {
      this.initializeScene().catch((error) => {
        this.handleInitializationError(error);
      });
    }, this.RETRY_INITIALIZATION_DELAY);
  }

  private cleanup(): void {
    try {
      // Remove event listeners to prevent memory leaks
      this.eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.eventListeners = [];

      // Dispose of countries and related meshes using memory manager
      if (this.countries) {
        if (this.renderingMode() === 'topojson') {
          disposeTopoJSONMeshes(this.countries);
        }
        this.memoryManager.disposeObject3D(this.countries);
        this.countries = undefined!;
      }

      // Call service cleanup method to handle scene, camera, renderer, controls, etc.
      this.globeSceneService.cleanup();

      // Force garbage collection if available (development only)
      if (
        typeof window !== 'undefined' &&
        !window.location.host.includes('prod')
      ) {
        this.memoryManager.forceGarbageCollection();
      }

      // Log memory stats for debugging in development only
      if (
        typeof window !== 'undefined' &&
        !window.location.host.includes('prod')
      ) {
        const stats = this.memoryManager.getMemoryStats();
        this.logger.debug('Memory cleanup stats', 'GlobeComponent', stats);
      }
    } catch (error) {
      this.logger.warn('Error during cleanup', 'GlobeComponent', error);
      this.errorRecovery.handleGeometryError(error as Error, 'cleanup');
    }
  }

  /**
   * Setup GPU-optimized country selection interactions
   */
  private setupCountrySelectionInteractions(): void {
    const renderer = this.globeSceneService.getRenderer();
    if (!renderer) return;

    const canvas = renderer.domElement;

    // Timing variables for proper single/double-click separation
    let clickTimeout: ReturnType<typeof setTimeout> | null = null;
    let isDoubleClick = false;

    // Handle single clicks with proper double-click separation
    const clickHandler = (event: MouseEvent): void => {
      // Clear any existing timeout
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }

      // If this is part of a double-click, ignore the single-click
      if (isDoubleClick) {
        isDoubleClick = false;
        return;
      }

      // Set a timeout to handle single-click after double-click detection window
      clickTimeout = setTimeout(() => {
        const allowSelection = this.globeSceneService.getAllowSelection();
        const cameraInteracting = this.globeSceneService.getCameraInteracting();
        if (allowSelection && !cameraInteracting) {
          this.handleCountryInfoDisplay(event);
        }
        clickTimeout = null;
      }, this.DOUBLE_CLICK_DELAY);
    };

    // Handle double-click for adding countries to comparison table
    const dblclickHandler = (event: MouseEvent): void => {
      // Mark as double-click to prevent single-click handler
      isDoubleClick = true;

      // Clear single-click timeout immediately
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }

      // Double-click should always work - don't check allowSelection
      // (allowSelection is often false during double-click due to camera interaction)
      this.handleCountryAddToComparison(event);

      // Reset double-click flag after a short delay
      setTimeout(() => {
        isDoubleClick = false;
      }, 100);
    };

    // Handle mouse hover for tooltips (throttled for performance)
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    const mousemoveHandler = (event: MouseEvent): void => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      hoverTimeout = setTimeout(() => {
        this.handleCountryHover(event);
      }, this.HOVER_THROTTLE);
    };

    // Hide tooltip when mouse leaves canvas
    const mouseleaveHandler = (): void => {
      this.tooltipService.hideAllTooltips();
    };

    // Add event listeners
    canvas.addEventListener('click', clickHandler);
    canvas.addEventListener('dblclick', dblclickHandler);
    canvas.addEventListener('mousemove', mousemoveHandler);
    canvas.addEventListener('mouseleave', mouseleaveHandler);

    // Store for cleanup
    this.eventListeners.push(
      {
        element: canvas,
        event: 'click',
        handler: clickHandler as EventListener,
      },
      {
        element: canvas,
        event: 'dblclick',
        handler: dblclickHandler as EventListener,
      },
      {
        element: canvas,
        event: 'mousemove',
        handler: mousemoveHandler as EventListener,
      },
      {
        element: canvas,
        event: 'mouseleave',
        handler: mouseleaveHandler as EventListener,
      },
    );
  }

  /**
   * Handle country info display on single-click (WITH visual selection and detailed info card)
   * Single-click: Select only one country (clears others)
   * Shift+click: Add to existing selection (multiple countries)
   * Ctrl/Cmd+click: Toggle selection (deselect if already selected)
   * DISABLED IN QUIZ MODE, GAME QUIZ VIEW, AND BIRD MIGRATION VIEW
   */
  private async handleCountryInfoDisplay(event: MouseEvent): Promise<void> {
    event.preventDefault();

    // Early exit if in bird migration view - no selection allowed
    if (this.navigationStateService.isBirdMigrationActive()) {
      return;
    }

    const isShiftClick = event.shiftKey;
    const isCtrlClick = event.ctrlKey || event.metaKey; // Ctrl on Windows/Linux, Cmd on Mac

    // Early exit if countries not loaded
    if (!this.countries || this.countries.children.length === 0) {
      return;
    }

    try {
      // Get country name from hover detection
      const countryResult = await this.detectCountryFromEvent(event);

      if (countryResult?.countryName) {
        const countryName = countryResult.countryName;

        // Get detailed country data from service (with name normalization for USA, etc.)
        const normalizedCountryName =
          this.countrySelection.normalizeCountryNameForDataService(countryName);

        console.log(
          `🔍 [Globe] Detected country: "${countryName}" -> normalized: "${normalizedCountryName}"`,
        );

        const countryData = this.countryDataService.getCountryByName(
          normalizedCountryName,
        );

        console.log(
          `📊 [Globe] Country data lookup result:`,
          countryData ? 'FOUND' : 'NOT FOUND',
        );

        if (countryData) {
          // Check if we're in quiz mode - if so, forward to quiz service instead of explore mode logic
          if (this.interactionModeService.isQuizMode()) {
            // For quiz mode, we use the country ID (code) as the candidate
            this.quizStateService.selectCandidate(countryData.id);

            // Apply quiz candidate highlighting to the globe
            this.quizIntegration.applyQuizCandidateHighlight(
              countryName,
              this.countries,
            );

            // NO TOOLTIPS in quiz mode - the quiz HUD shows the selection

            return; // Exit early - don't process explore mode logic
          }

          // Explore mode logic - handle three different selection modes
          if (isCtrlClick) {
            // Ctrl/Cmd+click: Toggle selection
            const isSelected = this.countrySelection.isCountryNameSelected(
              countryName,
              this.countries,
            );

            if (isSelected) {
              // Deselect this country
              this.countrySelection.removeCountrySelectionByName(
                countryName,
                this.countries,
              );
              console.log(`🔄 [Globe] Toggled OFF: "${countryName}"`);
            } else {
              // Add to selection (don't reset others)
              this.countrySelection.applyPersistentCountrySelection(
                countryName,
                this.countries,
                false, // Don't reset - additive
              );
              console.log(`🔄 [Globe] Toggled ON: "${countryName}"`);
            }

            // For toggle, we don't change selectedCountry signal
            // Keep the info card on the first selected country
          } else if (isShiftClick) {
            // Shift+click: Add to existing selection (multiple countries)
            // Check if country is already selected
            if (this.selectedCountry()?.code === countryData.code) {
              return; // Don't add duplicate
            }

            // Apply visual selection highlighting (additive - don't reset)
            this.countrySelection.applyPersistentCountrySelection(
              countryName,
              this.countries,
              false, // Don't reset - additive
            );

            console.log(`➕ [Globe] Added to selection: "${countryName}"`);

            // For Shift+click, we don't change selectedCountry signal
            // Just apply visual highlighting - the info card stays on the first selected country
          } else {
            // Single-click: Select only this country (clear previous selections)
            // Set the selected country to show the detailed info card
            this.selectedCountry.set(countryData);

            // Apply visual selection highlighting with reset
            this.countrySelection.applyPersistentCountrySelection(
              countryName,
              this.countries,
              true, // Reset others first
            );

            console.log(
              `🎯 [Globe] Selected (cleared others): "${countryName}"`,
            );
          }

          // Show immediate feedback tooltip for all cases
          const x = event.clientX;
          const y = event.clientY;
          this.hoveredCountryName.set(countryName);
          this.countryNameTooltipPosition.set({ x, y });
          this.countryNameTooltipVisible.set(true);

          // Hide the simple tooltip after delay
          setTimeout(() => {
            this.countryNameTooltipVisible.set(false);
            this.hoveredCountryName.set('');
          }, this.TOOLTIP_HIDE_DELAY);
        } else {
          // Fallback: Just show the simple tooltip if no detailed data available
          const x = event.clientX;
          const y = event.clientY;
          this.hoveredCountryName.set(countryName);
          this.countryNameTooltipPosition.set({ x, y });
          this.countryNameTooltipVisible.set(true);

          setTimeout(() => {
            this.countryNameTooltipVisible.set(false);
            this.hoveredCountryName.set('');
          }, 4000);
        }
      } else {
        // Clear selection when clicking on empty space (both single and shift-click)
        this.selectedCountry.set(null);
        this.countrySelection.resetAllCountrySelections(this.countries);
      }
    } catch (error) {
      this.logger.error(
        'Error in handleCountryInfoDisplay',
        error,
        'GlobeComponent',
      );
    }
  }

  /**
   * Get normalized mouse coordinates from event
   */
  private getMouseCoordinates(
    event: MouseEvent,
  ): { x: number; y: number } | null {
    const renderer = this.globeSceneService.getRenderer();
    if (!renderer) return null;

    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    return {
      x: (x / canvas.width) * 2 - 1,
      y: -(y / canvas.height) * 2 + 1,
    };
  }

  /**
   * Handle adding country to comparison table from double-click events
   * Double-click adds the country to comparison table AND applies visual selection (additive)
   * DISABLED IN QUIZ MODE, GAME QUIZ VIEW, AND BIRD MIGRATION VIEW
   */
  private async handleCountryAddToComparison(event: MouseEvent): Promise<void> {
    event.preventDefault();

    // Early exit if in quiz mode, game quiz view, or bird migration view - double-click is disabled
    if (
      this.interactionModeService.isQuizMode() ||
      this.navigationStateService.isGameQuizActive() ||
      this.navigationStateService.isBirdMigrationActive()
    ) {
      return;
    }

    // Early exit if countries not loaded
    if (!this.countries || this.countries.children.length === 0) {
      return;
    }

    // Get country name from hover detection
    const countryResult = await this.detectCountryFromEvent(event);

    if (countryResult?.countryName) {
      const countryName = countryResult.countryName;

      // Normalize the country name for data service lookup
      const normalizedCountryName =
        this.countrySelection.normalizeCountryNameForDataService(countryName);

      // Set sync flag BEFORE adding to prevent the effect from running
      this.isSyncingFromTable = true;

      try {
        // Add country to comparison table via CountryDataService
        const added = this.countryDataService.addCountryFromGlobe(
          normalizedCountryName,
        );

        if (added) {
          // Get the country code to update previousSelectedCodes
          const country = this.countryDataService.getCountryByName(
            normalizedCountryName,
          );
          if (country) {
            this.previousSelectedCodes.add(country.code);
          }

          // Apply visual selection to the country on globe (additive - don't reset others)
          this.countrySelection.applyPersistentCountrySelection(
            countryName,
            this.countries,
            false, // Don't reset - keep other selected countries
          );

          this.logger.debug(
            `Double-click: Added "${countryName}" to comparison table`,
            'GlobeComponent',
          );
        }
      } finally {
        // Always reset the sync flag
        this.isSyncingFromTable = false;
      }
    }
  }

  /**
   * Detect country from mouse event (shared logic for clicks and double-clicks)
   */
  private async detectCountryFromEvent(
    event: MouseEvent,
  ): Promise<{ countryName: string; countryGroup?: Object3D } | null> {
    const camera = this.globeSceneService.getCamera();
    if (!camera) return null;

    // Get normalized mouse coordinates
    const mouse = this.getMouseCoordinates(event);
    if (!mouse) return null;

    // Use country hover service for detection
    const hoverResult = this.countryHoverService.detectCountryHover(
      mouse,
      camera,
      this.countries,
    );

    if (hoverResult?.countryName) {
      return {
        countryName: hoverResult.countryName,
        countryGroup: hoverResult.object,
      };
    }

    return null;
  }

  private animate(_currentTime: number = 0): void {
    // Animation is now handled by GlobeSceneService
    // This method is kept for backwards compatibility but delegates to service
    // Note: The service's animation loop is started in initializeScene()
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const camera = this.globeSceneService.getCamera();
    const renderer = this.globeSceneService.getRenderer();
    if (!camera || !renderer) return;

    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  /**
   * Enhanced country hover handling using specialized service
   * DISABLED IN QUIZ MODE AND GAME QUIZ VIEW ONLY
   * ENABLED in bird migration view to show country names
   */
  private async handleCountryHover(event: MouseEvent): Promise<void> {
    try {
      // Early exit if countries not loaded, in quiz mode, or on game quiz view
      if (
        !this.countries ||
        this.countries.children.length === 0 ||
        this.interactionModeService.isQuizMode() ||
        this.navigationStateService.isGameQuizActive()
      ) {
        this.tooltipService.hideAllTooltips();
        return;
      }

      const camera = this.globeSceneService.getCamera();
      const renderer = this.globeSceneService.getRenderer();
      if (!camera || !renderer) return;

      // Get normalized mouse coordinates
      const mouse = this.getMouseCoordinates(event);
      if (!mouse) return;

      const canvas = renderer.domElement;

      // Use the specialized hover service that understands TopoJSON structure
      const hoverResult = this.countryHoverService.detectCountryHover(
        mouse,
        camera,
        this.countries,
      );

      if (hoverResult) {
        // Show only country name tooltip on hover
        this.hoveredCountryName.set(hoverResult.countryName);
        this.countryNameTooltipPosition.set({
          x: event.clientX,
          y: event.clientY,
        });
        this.countryNameTooltipVisible.set(true);

        canvas.style.cursor = 'pointer';
      } else {
        // No country found - hide name tooltip only
        this.tooltipService.hideNameTooltip();
        canvas.style.cursor = 'default';
      }
    } catch (error) {
      this.logger.warn(
        'Error in country hover handler',
        'GlobeComponent',
        error,
      );
      this.tooltipService.hideNameTooltip();
    }
  }

  /**
   * Handle keyboard navigation events
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      return;
    }

    const camera = this.globeSceneService.getCamera();
    const controls = this.globeSceneService.getControls();
    if (!camera || !controls) return;

    const handled = this.accessibility.handleKeyboardNavigation(
      event,
      camera,
      controls,
      this.countries,
    );

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Handle focus events for accessibility
   */
  onFocus(): void {
    this.accessibility.isKeyboardMode.set(true);
  }

  /**
   * Handle blur events for accessibility
   */
  onBlur(): void {
    // Don't immediately disable keyboard mode as user might tab back
    setTimeout(() => {
      if (document.activeElement !== this.rendererContainer.nativeElement) {
        this.accessibility.isKeyboardMode.set(false);
      }
    }, 100);
  }

  /**
   * Reverse geocode coordinates to nearest country name
   * Uses Haversine formula to find the closest country by comparing to country centroids
   */
  private reverseGeocodeToCountryName(
    lat: number,
    lon: number,
  ): string | undefined {
    const allCountries = this.countryDataService.getAllCountries();
    if (allCountries.length === 0) {
      return undefined;
    }

    // Find the nearest country using Haversine distance formula
    let nearestCountry = allCountries[0];
    let minDistance = this.calculateDistance(
      lat,
      lon,
      nearestCountry.latitude,
      nearestCountry.longitude,
    );

    for (const country of allCountries) {
      const distance = this.calculateDistance(
        lat,
        lon,
        country.latitude,
        country.longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestCountry = country;
      }
    }

    // Only return the country if it's reasonably close (within ~1000km)
    // This prevents assigning a country to ocean coordinates
    if (minDistance < 1000) {
      return nearestCountry.name;
    }

    return undefined;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
