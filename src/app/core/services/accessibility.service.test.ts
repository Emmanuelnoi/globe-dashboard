import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PerspectiveCamera,
  Group,
  Mesh,
  Object3D,
  Vector3,
  MOUSE,
  TOUCH,
  EventDispatcher,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AccessibilityService } from './accessibility.service';
// OrbitControls type (imported manually since TypeScript has issues with the path)

// Mock OrbitControls for testing
const mockControls = {
  // Properties
  target: new Vector3(),
  cursor: new Vector3(),
  minDistance: 0,
  maxDistance: Infinity,
  minZoom: 0,
  maxZoom: Infinity,
  minTargetRadius: 0,
  maxTargetRadius: Infinity,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
  enableDamping: false,
  dampingFactor: 0.05,
  enableZoom: true,
  zoomSpeed: 1.0,
  enableRotate: true,
  rotateSpeed: 1.0,
  enablePan: true,
  panSpeed: 1.0,
  screenSpacePanning: true,
  keyPanSpeed: 7.0,
  zoomToCursor: false,
  autoRotate: false,
  autoRotateSpeed: 2.0,
  keys: {
    LEFT: 'ArrowLeft',
    UP: 'ArrowUp',
    RIGHT: 'ArrowRight',
    BOTTOM: 'ArrowDown',
  },
  mouseButtons: { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN },
  touches: { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN },
  target0: new Vector3(),
  position0: new Vector3(),
  zoom0: 1,

  // Methods
  getAzimuthalAngle: vi.fn().mockReturnValue(0),
  getPolarAngle: vi.fn().mockReturnValue(Math.PI / 2),
  getDistance: vi.fn().mockReturnValue(5),
  update: vi.fn(),
  reset: vi.fn(),
  listenToKeyEvents: vi.fn(),
  stopListenToKeyEvents: vi.fn(),
  saveState: vi.fn(),
  dispose: vi.fn(),

  // Event methods
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  hasEventListener: vi.fn(),
} as unknown as OrbitControls;

describe('AccessibilityService', () => {
  let service: AccessibilityService;
  let camera: PerspectiveCamera;
  let countries: Group;
  let liveRegion: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccessibilityService],
    });

    service = TestBed.inject(AccessibilityService);
    camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    countries = new Group();

    // Setup mock DOM elements
    document.body.innerHTML = '';

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Mock Web Audio API
    (global as typeof globalThis & { AudioContext?: unknown }).AudioContext = vi
      .fn()
      .mockImplementation(() => ({
        createOscillator: vi.fn().mockReturnValue({
          connect: vi.fn(),
          frequency: { value: 0 },
          type: 'sine',
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        }),
        destination: {},
        currentTime: 0,
      }));

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    // Clean up DOM
    const existingLiveRegion = document.getElementById('globe-live-region');
    if (existingLiveRegion) {
      existingLiveRegion.remove();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(service.currentCountry()).toBe(null);
      expect(service.globeDescription()).toBe(
        'Interactive 3D globe showing 242 countries',
      );
      expect(service.isKeyboardMode()).toBe(false);
    });

    it('should create live region on initialization', () => {
      service.initialize();

      const liveRegion = document.getElementById('globe-live-region');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should handle arrow key navigation', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });

      const handled = service.handleKeyboardNavigation(
        event,
        camera,
        mockControls,
        countries,
      );

      expect(handled).toBe(true);
      expect(mockControls.update).toHaveBeenCalled();
      expect(mockControls.update).toHaveBeenCalled();
    });

    it('should handle zoom in/out', () => {
      const zoomInEvent = new KeyboardEvent('keydown', { key: '+' });
      const zoomOutEvent = new KeyboardEvent('keydown', { key: '-' });

      const handled1 = service.handleKeyboardNavigation(
        zoomInEvent,
        camera,
        mockControls,
        countries,
      );
      const handled2 = service.handleKeyboardNavigation(
        zoomOutEvent,
        camera,
        mockControls,
        countries,
      );

      expect(handled1).toBe(true);
      expect(handled2).toBe(true);
      expect(mockControls.update).toHaveBeenCalled();
    });

    it('should handle home key to reset view', () => {
      const event = new KeyboardEvent('keydown', { key: 'Home' });

      const handled = service.handleKeyboardNavigation(
        event,
        camera,
        mockControls,
        countries,
      );

      expect(handled).toBe(true);
      expect(mockControls.reset).toHaveBeenCalled();
    });

    it('should handle escape key to clear selection', () => {
      service.updateCountrySelection('Test Country');
      expect(service.currentCountry()).toBe('Test Country');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      service.handleKeyboardNavigation(event, camera, mockControls, countries);

      expect(service.currentCountry()).toBe(null);
    });

    it('should handle letter keys for country search', () => {
      const countries = [
        {
          name: 'Australia',
          description: 'test',
          ariaLabel: 'test',
          instructions: 'test',
        },
        {
          name: 'Brazil',
          description: 'test',
          ariaLabel: 'test',
          instructions: 'test',
        },
        {
          name: 'Canada',
          description: 'test',
          ariaLabel: 'test',
          instructions: 'test',
        },
      ];
      service.updateAvailableCountries(countries);

      const event = new KeyboardEvent('keydown', { key: 'b' });
      const handled = service.handleKeyboardNavigation(
        event,
        camera,
        mockControls,
      );

      expect(handled).toBe(true);
      expect(service.currentCountry()).toBe('Brazil');
    });

    it('should not handle unrecognized keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'F1' });

      const handled = service.handleKeyboardNavigation(
        event,
        camera,
        mockControls,
        countries,
      );

      expect(handled).toBe(false);
    });
  });

  describe('Country Navigation', () => {
    beforeEach(() => {
      const testCountries = [
        {
          name: 'Australia',
          description: 'test',
          ariaLabel: 'test',
          instructions: 'test',
        },
        {
          name: 'Brazil',
          description: 'test',
          ariaLabel: 'test',
          instructions: 'test',
        },
        {
          name: 'Canada',
          description: 'test',
          ariaLabel: 'test',
          instructions: 'test',
        },
      ];
      service.updateAvailableCountries(testCountries);
    });

    it('should navigate to next country with Tab', () => {
      const event = new KeyboardEvent('keydown', { key: 'Tab' });

      service.handleKeyboardNavigation(event, camera, mockControls, countries);
      expect(service.currentCountry()).toBe('Australia');

      service.handleKeyboardNavigation(event, camera, mockControls, countries);
      expect(service.currentCountry()).toBe('Brazil');
    });

    it('should navigate to previous country with Shift+Tab', () => {
      // First navigate to a country
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      service.handleKeyboardNavigation(
        tabEvent,
        camera,
        mockControls,
        countries,
      );

      // Then navigate back
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
      });
      service.handleKeyboardNavigation(
        shiftTabEvent,
        camera,
        mockControls,
        countries,
      );

      expect(service.currentCountry()).toBe('Canada'); // Should wrap to last
    });

    it('should cycle through countries', () => {
      const event = new KeyboardEvent('keydown', { key: 'Tab' });

      // Navigate through all countries and cycle back
      service.handleKeyboardNavigation(event, camera, mockControls, countries); // Australia
      service.handleKeyboardNavigation(event, camera, mockControls, countries); // Brazil
      service.handleKeyboardNavigation(event, camera, mockControls, countries); // Canada
      service.handleKeyboardNavigation(event, camera, mockControls, countries); // Back to Australia

      expect(service.currentCountry()).toBe('Australia');
    });
  });

  describe('Accessibility Features', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should generate proper ARIA description', () => {
      const description = service.getGlobeAriaDescription();
      expect(description).toContain('Interactive 3D globe');
      expect(description).toContain('Use arrow keys');
    });

    it('should update ARIA description when country is selected', () => {
      service.updateCountrySelection('France');

      const description = service.getGlobeAriaDescription();
      expect(description).toContain('Currently focused on France');
    });

    it('should provide country accessibility info', () => {
      const info = service.getCountryAccessibilityInfo('Germany');

      expect(info.name).toBe('Germany');
      expect(info.description).toContain('Germany');
      expect(info.ariaLabel).toContain('Germany');
      expect(info.instructions).toContain('Press Enter');
    });

    it('should detect high contrast mode preference', () => {
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: query.includes('prefers-contrast: high'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(service.isHighContrastMode()).toBe(true);
    });

    it('should detect reduced motion preference', () => {
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(service.isReducedMotionPreferred()).toBe(true);
    });
  });

  describe('Audio Feedback', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should enable/disable audio feedback', () => {
      service.toggleAudioFeedback(true);
      // Should not throw and should create audio context
      expect(() => service.toggleAudioFeedback(false)).not.toThrow();
    });

    it('should handle audio context creation failure gracefully', () => {
      (global as typeof globalThis & { AudioContext?: unknown }).AudioContext =
        vi.fn().mockImplementation(() => {
          throw new Error('AudioContext not supported');
        });

      expect(() => service.toggleAudioFeedback(true)).not.toThrow();
    });
  });

  describe('Loading State Announcements', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should announce loading state with progress', () => {
      const message = 'Loading countries';
      const progress = 50;

      service.announceLoadingState(message, progress);

      const liveRegion = document.getElementById('globe-live-region');
      expect(liveRegion?.textContent).toContain(message);
      expect(liveRegion?.textContent).toContain('50%');
    });

    it('should announce loading state without progress', () => {
      const message = 'Initializing scene';

      service.announceLoadingState(message);

      const liveRegion = document.getElementById('globe-live-region');
      expect(liveRegion?.textContent).toBe(message);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should provide keyboard shortcuts help', () => {
      const shortcuts = service.getKeyboardShortcuts();

      expect(shortcuts).toBeInstanceOf(Array);
      expect(shortcuts.length).toBeGreaterThan(0);

      const arrowShortcut = shortcuts.find((s) => s.key === 'Arrow Keys');
      expect(arrowShortcut).toBeTruthy();
      expect(arrowShortcut?.description).toContain('Rotate');
    });

    it('should include all essential shortcuts', () => {
      const shortcuts = service.getKeyboardShortcuts();
      const keys = shortcuts.map((s) => s.key);

      expect(keys).toContain('Arrow Keys');
      expect(keys).toContain('Enter/Space');
      expect(keys).toContain('Tab');
      expect(keys).toContain('Home');
      expect(keys).toContain('Escape');
    });
  });

  describe('Country Selection Updates', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should update country selection and announce it', () => {
      service.updateCountrySelection('Japan');

      expect(service.currentCountry()).toBe('Japan');

      const liveRegion = document.getElementById('globe-live-region');
      expect(liveRegion?.textContent).toContain('Japan');
    });

    it('should clear country selection', () => {
      service.updateCountrySelection('Japan');
      service.updateCountrySelection(null);

      expect(service.currentCountry()).toBe(null);
    });
  });
});
