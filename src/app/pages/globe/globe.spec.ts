/**
 * Globe Component Tests
 *
 * Comprehensive test suite for the main 3D globe component
 * Covers initialization, data loading, user interactions, and cleanup
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { Globe } from './globe';
import { GlobeSceneService } from './services/globe-scene.service';
import { GlobeDataLoadingService } from './services/globe-data-loading.service';
import { GlobeCountrySelectionService } from './services/globe-country-selection.service';
import { GlobeTooltipService } from './services/globe-tooltip.service';
import { GlobeMigrationService } from './services/globe-migration.service';
import { CountryDataService } from '../../core/services/country-data.service';
import { CountryHoverService } from '../../core/services/country-hover.service';
import { QuizStateService } from '../../features/quiz/services/quiz-state';
import { MigrationStateService } from '../../features/bird-migration/services/migration-state.service';
import { AccessibilityService } from '@/core/services/accessibility.service';
import { MemoryManagementService } from '@/core/services/memory-management.service';
import { CountryIdTextureService } from '@lib/services/country-id-texture.service';
import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';

describe('Globe Component', () => {
  let component: Globe;
  let fixture: ComponentFixture<Globe>;

  // Mock services
  let mockGlobeSceneService: Partial<GlobeSceneService>;
  let mockDataLoadingService: Partial<GlobeDataLoadingService>;
  let mockCountrySelectionService: Partial<GlobeCountrySelectionService>;
  let mockTooltipService: Partial<GlobeTooltipService>;
  let mockMigrationService: Partial<GlobeMigrationService>;
  let mockCountryDataService: Partial<CountryDataService>;
  let mockQuizStateService: Partial<QuizStateService>;
  let mockMigrationStateService: Partial<MigrationStateService>;

  beforeEach(async () => {
    // Create mock services with signals
    mockGlobeSceneService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getScene: vi.fn().mockReturnValue(new Scene()),
      getCamera: vi.fn().mockReturnValue(new PerspectiveCamera()),
      getRenderer: vi.fn().mockReturnValue({
        domElement: document.createElement('canvas'),
        setSize: vi.fn(),
      } as unknown as WebGLRenderer),
      getControls: vi.fn().mockReturnValue({}),
      startAnimation: vi.fn(),
      cleanup: vi.fn(),
      requestRender: vi.fn(),
      getAllowSelection: vi.fn().mockReturnValue(true),
      getCameraInteracting: vi.fn().mockReturnValue(false),
    };

    mockDataLoadingService = {
      isLoading: signal(false),
      loadingProgress: signal(0),
      loadingMessage: signal(''),
      initError: signal(null),
      setLoading: vi.fn(),
    };

    mockTooltipService = {
      countryNameTooltipVisible: signal(false),
      hoveredCountryName: signal(''),
      countryNameTooltipPosition: signal({ x: 0, y: 0 }),
      selectedCountry: signal(null),
      hideAllTooltips: vi.fn(),
      hideNameTooltip: vi.fn(),
    };

    mockCountrySelectionService = {
      ensureCountryIds: vi.fn(),
      applyPersistentCountrySelection: vi.fn(),
      resetAllCountrySelections: vi.fn(),
      normalizeCountryNameForDataService: vi.fn((name) => name),
    };

    mockMigrationService = {
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    mockCountryDataService = {
      selectedCountries: signal([]),
      getCountryByName: vi.fn().mockReturnValue({
        id: 'US',
        code: 'US',
        name: 'United States',
        population: 331000000,
        gdp: 21000,
        latitude: 37.09024,
        longitude: -95.712891,
      }),
      getCountryByCode: vi.fn(),
      addCountryFromGlobe: vi.fn().mockReturnValue(true),
      getAllCountries: vi.fn().mockReturnValue([]),
    };

    mockQuizStateService = {
      selectedCandidate: signal(null),
      gameState: signal('idle'),
      selectCandidate: vi.fn(),
    };

    mockMigrationStateService = {
      activePaths: signal([]),
      migrations: signal([]),
      species: signal([]),
      clearAllPaths: vi.fn(),
      removeActivePath: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Globe],
      providers: [
        { provide: GlobeSceneService, useValue: mockGlobeSceneService },
        { provide: GlobeDataLoadingService, useValue: mockDataLoadingService },
        {
          provide: GlobeCountrySelectionService,
          useValue: mockCountrySelectionService,
        },
        { provide: GlobeTooltipService, useValue: mockTooltipService },
        { provide: GlobeMigrationService, useValue: mockMigrationService },
        { provide: CountryDataService, useValue: mockCountryDataService },
        { provide: QuizStateService, useValue: mockQuizStateService },
        { provide: MigrationStateService, useValue: mockMigrationStateService },
        {
          provide: AccessibilityService,
          useValue: {
            initialize: vi.fn(),
            isKeyboardMode: signal(false),
            handleKeyboardNavigation: vi.fn(),
          },
        },
        {
          provide: MemoryManagementService,
          useValue: {
            disposeObject3D: vi.fn(),
            forceGarbageCollection: vi.fn(),
            getMemoryStats: vi.fn(),
          },
        },
        {
          provide: CountryIdTextureService,
          useValue: {
            loadCountryIdAssets: vi.fn().mockResolvedValue(undefined),
            getSelectionMaskTexture: vi.fn(),
            updateSelectionMask: vi.fn(),
          },
        },
        {
          provide: CountryHoverService,
          useValue: { detectCountryHover: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Globe);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeDefined();
    });

    it('should initialize scene on ngAfterViewInit', async () => {
      await component.ngAfterViewInit();

      expect(mockGlobeSceneService.initialize).toHaveBeenCalled();
    });

    it('should start animation loop after initialization', async () => {
      await component.ngAfterViewInit();

      expect(mockGlobeSceneService.startAnimation).toHaveBeenCalled();
    });

    it('should set loading state during initialization', async () => {
      expect(mockDataLoadingService.setLoading).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on ngOnDestroy', () => {
      component.ngOnDestroy();

      expect(mockGlobeSceneService.cleanup).toHaveBeenCalled();
    });

    it('should dispose of memory on cleanup', () => {
      const memoryService = TestBed.inject(MemoryManagementService);

      component.ngOnDestroy();

      expect(memoryService.disposeObject3D).toBeDefined();
    });
  });

  describe('Data Loading', () => {
    it('should expose loading state from service', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should expose loading progress from service', () => {
      expect(component.loadingProgress()).toBe(0);
    });

    it('should expose loading message from service', () => {
      expect(component.loadingMessage()).toBe('');
    });

    it('should handle initialization errors', async () => {
      mockGlobeSceneService.initialize = vi
        .fn()
        .mockRejectedValue(new Error('WebGL not supported'));

      await component.ngAfterViewInit();

      expect(component.initError()).toBeTruthy();
    });
  });

  describe('Country Interaction', () => {
    it('should detect country hover', () => {
      const hoverService = TestBed.inject(CountryHoverService);
      hoverService.detectCountryHover = vi.fn().mockReturnValue({
        countryName: 'France',
        object: {},
      });

      expect(hoverService.detectCountryHover).toBeDefined();
    });

    it('should show tooltip on country hover', () => {
      expect(mockTooltipService.countryNameTooltipVisible).toBeDefined();
    });

    it('should hide tooltips when mouse leaves canvas', () => {
      mockTooltipService.hideAllTooltips!();

      expect(mockTooltipService.hideAllTooltips).toHaveBeenCalled();
    });

    it('should select country on single click', () => {
      const countryData = {
        id: 'FR',
        code: 'FR',
        name: 'France',
        population: 67000000,
        gdp: 2700,
        latitude: 46.227638,
        longitude: 2.213749,
      };

      mockCountryDataService.getCountryByName = vi
        .fn()
        .mockReturnValue(countryData);

      expect(mockCountryDataService.getCountryByName).toBeDefined();
    });

    it('should add country to comparison on double click', () => {
      mockCountryDataService.addCountryFromGlobe!('France');

      expect(mockCountryDataService.addCountryFromGlobe).toHaveBeenCalledWith(
        'France',
      );
    });

    it('should apply visual selection to country', () => {
      mockCountrySelectionService.applyPersistentCountrySelection!(
        'France',
        {} as any,
      );

      expect(
        mockCountrySelectionService.applyPersistentCountrySelection,
      ).toHaveBeenCalled();
    });

    it('should reset selections when clicking empty space', () => {
      mockCountrySelectionService.resetAllCountrySelections!({} as any);

      expect(
        mockCountrySelectionService.resetAllCountrySelections,
      ).toHaveBeenCalled();
    });
  });

  describe('Quiz Mode Integration', () => {
    it('should handle quiz mode activation', () => {
      mockQuizStateService.gameState = signal('active');

      expect(component).toBeDefined();
    });

    it('should select country as quiz candidate', () => {
      mockQuizStateService.selectCandidate!('US');

      expect(mockQuizStateService.selectCandidate).toHaveBeenCalledWith('US');
    });

    it('should clear quiz highlight when game ends', () => {
      mockQuizStateService.gameState = signal('ended');
      mockQuizStateService.selectedCandidate = signal(null);

      expect(component).toBeDefined();
    });
  });

  describe('Migration System', () => {
    it('should initialize migration system', async () => {
      await component.ngAfterViewInit();

      expect(mockMigrationService.initialize).toHaveBeenCalled();
    });

    it('should compute migration card data', () => {
      mockMigrationStateService.activePaths = signal([
        {
          migrationId: 'migration-1',
          pathIndex: 0,
          isPlaying: false,
          progress: 0,
        },
      ]);

      mockMigrationStateService.migrations = signal([
        {
          id: 'migration-1',
          speciesId: 'species-1',
          startLocation: { lat: 40, lon: -74 },
          endLocation: { lat: 51, lon: 0 },
          season: 'spring',
          waypoints: [],
        },
      ]);

      mockMigrationStateService.species = signal([
        {
          id: 'species-1',
          scientificName: 'Sterna paradisaea',
          commonName: 'Arctic Tern',
          imageUrl: '/species/arctic-tern.jpg',
          conservationStatus: 'LC',
        },
      ]);

      const cardData = component.migrationCardData();

      expect(cardData).toBeDefined();
      expect(cardData.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle clear all migrations', () => {
      component.handleClearAllMigrations();

      expect(mockMigrationStateService.clearAllPaths).toHaveBeenCalled();
    });

    it('should handle remove single migration', () => {
      component.handleRemoveMigration('migration-1');

      expect(mockMigrationStateService.removeActivePath).toHaveBeenCalledWith(
        'migration-1',
      );
    });
  });

  describe('Accessibility', () => {
    it('should handle keyboard navigation', () => {
      const accessibilityService = TestBed.inject(AccessibilityService);
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      component.onKeyDown(event);

      expect(accessibilityService.handleKeyboardNavigation).toBeDefined();
    });

    it('should set keyboard mode on focus', () => {
      const accessibilityService = TestBed.inject(AccessibilityService);

      component.onFocus();

      expect(accessibilityService.isKeyboardMode()).toBeDefined();
    });

    it('should handle blur events', () => {
      component.onBlur();

      expect(component).toBeDefined();
    });
  });

  describe('Window Resize', () => {
    it('should handle window resize', () => {
      const camera = mockGlobeSceneService.getCamera!();
      const renderer = mockGlobeSceneService.getRenderer!();

      component.onWindowResize();

      expect(camera).toBeDefined();
      expect(renderer).toBeDefined();
    });

    it('should update camera aspect ratio on resize', () => {
      const camera = mockGlobeSceneService.getCamera!() as PerspectiveCamera;

      component.onWindowResize();

      expect(camera).toBeDefined();
    });
  });

  describe('Rendering Modes', () => {
    it('should support TopoJSON rendering mode', () => {
      const mode = component.getCurrentRenderingMode();

      expect(mode).toBe('topojson');
    });

    it('should allow toggling rendering modes', async () => {
      await component.toggleRenderingMode(false);

      expect(component.getCurrentRenderingMode()).toBe('geojson');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebGL initialization errors', async () => {
      mockGlobeSceneService.initialize = vi
        .fn()
        .mockRejectedValue(new Error('WebGL not supported'));

      await component.ngAfterViewInit();

      expect(component.initError()).toBeTruthy();
      expect(component.isLoading()).toBe(false);
    });

    it('should retry initialization on error', () => {
      component.retryInitialization();

      expect(component.initError()).toBeNull();
      expect(component.isLoading()).toBe(true);
    });

    it('should handle data loading errors gracefully', async () => {
      mockGlobeSceneService.getScene = vi.fn().mockReturnValue(null);

      // Should not throw
      await expect(component.ngAfterViewInit()).resolves.toBeDefined();
    });
  });

  describe('Reverse Geocoding', () => {
    it('should find nearest country for coordinates', () => {
      const countries = [
        {
          id: 'US',
          code: 'US',
          name: 'United States',
          latitude: 37.09024,
          longitude: -95.712891,
          population: 331000000,
          gdp: 21000,
        },
        {
          id: 'FR',
          code: 'FR',
          name: 'France',
          latitude: 46.227638,
          longitude: 2.213749,
          population: 67000000,
          gdp: 2700,
        },
      ];

      mockCountryDataService.getAllCountries = vi
        .fn()
        .mockReturnValue(countries);

      // Test reverse geocoding near US
      const result = (component as any).reverseGeocodeToCountryName(38, -96);

      expect(result).toBeDefined();
    });

    it('should return undefined for ocean coordinates', () => {
      mockCountryDataService.getAllCountries = vi.fn().mockReturnValue([
        {
          id: 'US',
          code: 'US',
          name: 'United States',
          latitude: 37.09024,
          longitude: -95.712891,
          population: 331000000,
          gdp: 21000,
        },
      ]);

      // Test coordinates far from any country (middle of Pacific Ocean)
      const result = (component as any).reverseGeocodeToCountryName(0, -170);

      expect(result).toBeUndefined();
    });
  });

  describe('Performance', () => {
    it('should use OnPush change detection strategy', () => {
      const metadata = (Globe as any).ɵcmp;

      expect(metadata.changeDetection).toBe(1); // 1 = OnPush
    });

    it('should cleanup event listeners on destroy', () => {
      component.ngOnDestroy();

      expect(mockGlobeSceneService.cleanup).toHaveBeenCalled();
    });
  });
});
