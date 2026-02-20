import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  signal,
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockProvider } from 'ng-mocks';
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
import { CountrySelectionService } from '@lib/utils';
import { CountryDiscoveryService } from '@/core/services/country-discovery.service';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import 'fake-indexeddb/auto';

describe('Globe Component (Stabilized)', () => {
  let component: Globe;
  let fixture: ComponentFixture<Globe>;

  const specDir = dirname(fileURLToPath(import.meta.url));

  beforeAll(async () => {
    await resolveComponentResources(async (url) =>
      readFile(resolve(specDir, url), 'utf8'),
    );

    const topoRaw = await readFile(
      resolve(specDir, '../../../../public/data/world.topo.json'),
      'utf8',
    );
    const topoJson = JSON.parse(topoRaw);
    const geoJson = {
      type: 'FeatureCollection',
      features: [],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: string | URL) => {
        const url = String(input);
        const body = url.includes('world.topo.json') ? topoJson : geoJson;

        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => body,
        };
      }),
    );
  });

  beforeEach(async () => {
    const mockGlobeSceneService: Partial<GlobeSceneService> = {
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

    const mockDataLoadingService: Partial<GlobeDataLoadingService> = {
      isLoading: signal(false),
      loadingProgress: signal(0),
      loadingMessage: signal(''),
      initError: signal(null),
      setLoading: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Globe],
      providers: [
        MockProvider(GlobeSceneService, mockGlobeSceneService),
        MockProvider(GlobeDataLoadingService, mockDataLoadingService),
        MockProvider(GlobeCountrySelectionService, {
          ensureCountryIds: vi.fn(),
          applyPersistentCountrySelection: vi.fn(),
          resetAllCountrySelections: vi.fn(),
          normalizeCountryNameForDataService: vi.fn((name: string) => name),
        }),
        MockProvider(GlobeTooltipService, {
          countryNameTooltipVisible: signal(false),
          hoveredCountryName: signal(''),
          countryNameTooltipPosition: signal({ x: 0, y: 0 }),
          selectedCountry: signal(null),
          hideAllTooltips: vi.fn(),
          hideNameTooltip: vi.fn(),
        }),
        MockProvider(GlobeMigrationService, {
          initialize: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(CountryDataService, {
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
        }),
        MockProvider(QuizStateService, {
          selectedCandidate: signal(null),
          gameState: signal('idle'),
          selectCandidate: vi.fn(),
        }),
        MockProvider(MigrationStateService, {
          activePaths: signal([]),
          migrations: signal([]),
          species: signal([]),
          clearAllPaths: vi.fn(),
          removeActivePath: vi.fn(),
        }),
        MockProvider(AccessibilityService, {
          initialize: vi.fn(),
          isKeyboardMode: signal(false),
          handleKeyboardNavigation: vi.fn(),
        }),
        MockProvider(MemoryManagementService, {
          disposeObject3D: vi.fn(),
          forceGarbageCollection: vi.fn(),
          getMemoryStats: vi.fn(),
        }),
        MockProvider(CountryIdTextureService, {
          loadCountryIdAssets: vi.fn().mockResolvedValue(undefined),
          getSelectionMaskTexture: vi.fn(),
          updateSelectionMask: vi.fn(),
        }),
        MockProvider(CountryHoverService, {
          detectCountryHover: vi.fn(),
        }),
        MockProvider(CountrySelectionService, {
          selectedCountries: signal(new Set<string>()),
        }),
        MockProvider(CountryDiscoveryService, {
          discoverCountry: vi.fn().mockResolvedValue(undefined),
          getDiscoveryByCountryCode: vi.fn().mockReturnValue(null),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Globe);
    component = fixture.componentInstance;
  });

  it('creates the component', () => {
    expect(component).toBeDefined();
  });

  it('initializes scene services on ngAfterViewInit', async () => {
    const sceneService = TestBed.inject(GlobeSceneService);
    await component.ngAfterViewInit();
    expect(sceneService.initialize).toHaveBeenCalled();
    expect(sceneService.startAnimation).toHaveBeenCalled();
  });

  it('cleans up on ngOnDestroy', () => {
    const sceneService = TestBed.inject(GlobeSceneService);
    component.ngOnDestroy();
    expect(sceneService.cleanup).toHaveBeenCalled();
  });

  it('exposes loading state signals', () => {
    expect(component.isLoading()).toBe(false);
    expect(component.loadingProgress()).toBe(0);
    expect(component.loadingMessage()).toBe('');
  });

  it('handles window resize safely', () => {
    expect(() => component.onWindowResize()).not.toThrow();
  });

  it('supports rendering mode toggle', async () => {
    expect(component.getCurrentRenderingMode()).toBe('topojson');
    await component.toggleRenderingMode(false);
    expect(component.getCurrentRenderingMode()).toBe('geojson');
  });
});
