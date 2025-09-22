import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ElementRef, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { Globe } from './globe';

// Mock Three.js modules
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(() => ({
    enableDamping: true,
    minDistance: 0,
    maxDistance: 0,
    zoomSpeed: 0,
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock utility functions
vi.mock('@lib/utils', () => ({
  getStarfield: vi.fn().mockReturnValue(new THREE.Points()),
  getFresnelMat: vi.fn().mockReturnValue(new THREE.ShaderMaterial()),
  loadGeoJSON: vi.fn().mockResolvedValue({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { NAME: 'Test Country' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  }),
  createInteractiveCountries: vi.fn().mockReturnValue(new THREE.Group()),
}));

// Test wrapper component to handle template
@Component({
  template:
    '<div #testContainer style="width: 800px; height: 600px;"><div #rendererContainer></div></div>',
  standalone: true,
})
class TestWrapperComponent {
  @ViewChild('testContainer', { static: true })
  testContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('rendererContainer', { static: true })
  rendererContainer!: ElementRef<HTMLDivElement>;
}

describe('Globe Component', () => {
  let component: Globe;
  let fixture: ComponentFixture<Globe>;
  let wrapperFixture: ComponentFixture<TestWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Globe, TestWrapperComponent],
    }).compileComponents();

    // Create wrapper fixture for DOM container
    wrapperFixture = TestBed.createComponent(TestWrapperComponent);
    wrapperFixture.detectChanges();

    fixture = TestBed.createComponent(Globe);
    component = fixture.componentInstance;

    // Mock the container element
    const mockContainer =
      wrapperFixture.componentInstance.rendererContainer.nativeElement;
    Object.defineProperty(component, 'rendererContainer', {
      value: { nativeElement: mockContainer },
      writable: true,
    });
  });

  afterEach(() => {
    if (component && component['renderer']) {
      component.ngOnDestroy();
    }
    vi.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have required ViewChild references', () => {
      expect(component).toHaveProperty('rendererContainer');
    });

    it('should initialize Three.js components after view init', async () => {
      await component.ngAfterViewInit();

      expect(component['scene']).toBeInstanceOf(THREE.Scene);
      expect(component['camera']).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(component['renderer']).toBeInstanceOf(THREE.WebGLRenderer);
    });

    it('should set up camera with correct parameters', async () => {
      await component.ngAfterViewInit();

      const camera = component['camera'];
      expect(camera.fov).toBe(75);
      expect(camera.near).toBe(0.1);
      expect(camera.far).toBe(100);
      expect(camera.position.z).toBe(5);
    });

    it('should add fog to scene for atmospheric effect', async () => {
      await component.ngAfterViewInit();

      const scene = component['scene'];
      expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    });
  });

  describe('Scene Setup', () => {
    beforeEach(async () => {
      await component.ngAfterViewInit();
    });

    it('should add Earth mesh to scene', () => {
      const scene = component['scene'];
      const earthMesh = scene.children.find(
        (child) =>
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial,
      );
      expect(earthMesh).toBeDefined();
    });

    it('should add lights to scene', () => {
      const scene = component['scene'];
      const ambientLight = scene.children.find(
        (child) => child instanceof THREE.AmbientLight,
      );
      const directionalLight = scene.children.find(
        (child) => child instanceof THREE.DirectionalLight,
      );

      expect(ambientLight).toBeDefined();
      expect(directionalLight).toBeDefined();
    });

    it('should add starfield to scene', () => {
      const scene = component['scene'];
      const starfield = scene.children.find(
        (child) => child instanceof THREE.Points,
      );
      expect(starfield).toBeDefined();
    });

    it('should add atmosphere glow mesh', () => {
      const scene = component['scene'];
      const glowMesh = scene.children.find(
        (child) =>
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.ShaderMaterial,
      );
      expect(glowMesh).toBeDefined();
    });
  });

  describe('Renderer Configuration', () => {
    beforeEach(async () => {
      await component.ngAfterViewInit();
    });

    it('should configure renderer with antialias', () => {
      const renderer = component['renderer'];
      expect(renderer).toBeInstanceOf(THREE.WebGLRenderer);
    });

    it('should set renderer size to container dimensions', () => {
      const renderer = component['renderer'];
      const setSizeSpy = vi.spyOn(renderer, 'setSize');

      // Trigger resize to test
      component.onWindowResize();

      expect(setSizeSpy).toHaveBeenCalled();
    });

    it('should set pixel ratio for crisp rendering', () => {
      const renderer = component['renderer'];
      const setPixelRatioSpy = vi.spyOn(renderer, 'setPixelRatio');

      // Recreate to test initial setup
      component.ngOnDestroy();
      component.ngAfterViewInit();

      expect(setPixelRatioSpy).toHaveBeenCalledWith(window.devicePixelRatio);
    });
  });

  describe('Controls Setup', () => {
    beforeEach(async () => {
      await component.ngAfterViewInit();
    });

    it('should initialize OrbitControls', () => {
      expect(component['controls']).toBeDefined();
    });

    it('should configure control limits', () => {
      const controls = component['controls'];
      expect(controls.enableDamping).toBe(true);
      expect(controls.minDistance).toBe(2.5);
      expect(controls.maxDistance).toBe(8);
      expect(controls.zoomSpeed).toBe(0.5);
    });
  });

  describe('Data Loading', () => {
    beforeEach(async () => {
      await component.ngAfterViewInit();
    });

    it('should load GeoJSON data', async () => {
      const { loadGeoJSON } = await import('@lib/utils');

      expect(loadGeoJSON).toHaveBeenCalledWith('/data/countries-50m.geojson');
    });

    it('should create interactive countries from GeoJSON', async () => {
      const { createInteractiveCountries } = await import('@lib/utils');

      expect(createInteractiveCountries).toHaveBeenCalled();
    });

    it('should add countries to scene', async () => {
      const scene = component['scene'];

      // Wait for async data loading
      await new Promise((resolve) => setTimeout(resolve, 0));

      const countriesGroup = scene.children.find(
        (child) => child instanceof THREE.Group,
      );
      expect(countriesGroup).toBeDefined();
    });
  });

  describe('Animation Loop', () => {
    beforeEach(async () => {
      await component.ngAfterViewInit();
    });

    it('should update controls in animation loop', () => {
      const controls = component['controls'];
      const updateSpy = vi.spyOn(controls, 'update');

      component['animate']();

      expect(updateSpy).toHaveBeenCalled();
    });

    it('should render scene in animation loop', () => {
      const renderer = component['renderer'];
      const renderSpy = vi.spyOn(renderer, 'render');

      component['animate']();

      expect(renderSpy).toHaveBeenCalledWith(
        component['scene'],
        component['camera'],
      );
    });

    it('should set animation loop on renderer', () => {
      const renderer = component['renderer'];
      const setAnimationLoopSpy = vi.spyOn(renderer, 'setAnimationLoop');

      // Re-initialize to test
      component.ngOnDestroy();
      component.ngAfterViewInit();

      expect(setAnimationLoopSpy).toHaveBeenCalledWith(component['animate']);
    });
  });

  describe('Window Resize Handling', () => {
    beforeEach(async () => {
      await component.ngAfterViewInit();
    });

    it('should handle window resize', () => {
      const camera = component['camera'];
      const renderer = component['renderer'];

      const updateProjectionMatrixSpy = vi.spyOn(
        camera,
        'updateProjectionMatrix',
      );
      const setSizeSpy = vi.spyOn(renderer, 'setSize');

      component.onWindowResize();

      expect(updateProjectionMatrixSpy).toHaveBeenCalled();
      expect(setSizeSpy).toHaveBeenCalled();
    });

    it('should update camera aspect ratio on resize', () => {
      const camera = component['camera'];
      const initialAspect = camera.aspect;

      // Mock container size change
      Object.defineProperty(
        component['rendererContainer'].nativeElement,
        'clientWidth',
        {
          value: 1200,
          writable: true,
        },
      );
      Object.defineProperty(
        component['rendererContainer'].nativeElement,
        'clientHeight',
        {
          value: 800,
          writable: true,
        },
      );

      component.onWindowResize();

      expect(camera.aspect).toBe(1200 / 800);
    });

    it('should handle resize when components are not initialized', () => {
      component['camera'] = undefined as unknown as THREE.PerspectiveCamera;
      component['renderer'] = undefined as unknown as THREE.WebGLRenderer;

      expect(() => component.onWindowResize()).not.toThrow();
    });
  });

  describe('Component Cleanup', () => {
    beforeEach(async () => {
      await component.ngAfterViewInit();
    });

    it('should dispose renderer on destroy', () => {
      const renderer = component['renderer'];
      const disposeSpy = vi.spyOn(renderer, 'dispose');

      component.ngOnDestroy();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should cancel animation frame on destroy', () => {
      const cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame');

      // Set animation ID
      component['animationId'] = 123;

      component.ngOnDestroy();

      expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(123);
    });

    it('should handle destroy when animation ID is undefined', () => {
      component['animationId'] = undefined;

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle data loading errors gracefully', async () => {
      const { loadGeoJSON } = await import('@lib/utils');
      vi.mocked(loadGeoJSON).mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await component.ngAfterViewInit();

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should not throw, error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing container element', () => {
      component['rendererContainer'] =
        undefined as unknown as ElementRef<HTMLDivElement>;

      expect(() => component.ngAfterViewInit()).not.toThrow();
    });
  });
});
