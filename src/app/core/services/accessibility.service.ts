import { Injectable, signal, inject } from '@angular/core';
import { Vector3, Raycaster, Camera, Object3D, Group } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LoggerService } from './logger.service';

/**
 * Service for managing accessibility features of the 3D globe
 */
@Injectable({
  providedIn: 'root',
})
export class AccessibilityService {
  // Logger service
  private readonly logger = inject(LoggerService);

  // Current accessibility state
  public readonly currentCountry = signal<string | null>(null);
  public readonly globeDescription = signal<string>(
    'Interactive 3D globe showing 242 countries',
  );
  public readonly navigationInstructions = signal<string>(
    'Use arrow keys to rotate, Enter to select, Tab to navigate',
  );
  public readonly isKeyboardMode = signal<boolean>(false);

  // Keyboard navigation state
  private currentRotation = { x: 0, y: 0 };
  private rotationStep = 0.05;
  private selectedCountryIndex = -1;
  private availableCountries: CountryAccessibilityData[] = [];

  // Audio feedback settings
  private audioEnabled = false;
  private audioContext?: AudioContext;

  /**
   * Initialize accessibility features
   */
  initialize(): void {
    this.setupAudioContext();
    this.loadUserPreferences();
    this.announceGlobeReady();
  }

  /**
   * Handle keyboard navigation for the globe
   */
  handleKeyboardNavigation(
    event: KeyboardEvent,
    camera: Camera,
    controls: OrbitControls,
    countries?: Group,
  ): boolean {
    let handled = false;

    switch (event.key) {
      case 'ArrowUp':
        this.rotateGlobe(0, this.rotationStep, controls);
        this.announceRotation('up');
        handled = true;
        break;

      case 'ArrowDown':
        this.rotateGlobe(0, -this.rotationStep, controls);
        this.announceRotation('down');
        handled = true;
        break;

      case 'ArrowLeft':
        this.rotateGlobe(-this.rotationStep, 0, controls);
        this.announceRotation('left');
        handled = true;
        break;

      case 'ArrowRight':
        this.rotateGlobe(this.rotationStep, 0, controls);
        this.announceRotation('right');
        handled = true;
        break;

      case 'Enter':
      case ' ':
        if (countries) {
          this.selectCountryUnderFocus(camera, countries);
        }
        handled = true;
        break;

      case 'Tab':
        if (!event.shiftKey) {
          this.focusNextCountry(camera, countries);
        } else {
          this.focusPreviousCountry(camera, countries);
        }
        handled = true;
        break;

      case 'Home':
        this.resetGlobeView(controls);
        this.announceAction('Globe view reset to home position');
        handled = true;
        break;

      case 'End':
        this.focusRandomCountry(camera, countries);
        handled = true;
        break;

      case 'Escape':
        this.clearSelection();
        this.announceAction('Selection cleared');
        handled = true;
        break;

      case '+':
      case '=':
        this.zoomIn(controls);
        handled = true;
        break;

      case '-':
        this.zoomOut(controls);
        handled = true;
        break;

      default:
        // Handle country search by letter
        if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
          this.searchCountryByLetter(
            event.key.toLowerCase(),
            camera,
            countries,
          );
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      this.isKeyboardMode.set(true);
    }

    return handled;
  }

  /**
   * Get ARIA description for the current globe state
   */
  getGlobeAriaDescription(): string {
    const country = this.currentCountry();
    const baseDescription = this.globeDescription();

    if (country) {
      return `${baseDescription}. Currently focused on ${country}. ${this.navigationInstructions()}`;
    }

    return `${baseDescription}. ${this.navigationInstructions()}`;
  }

  /**
   * Get accessibility information for a country
   */
  getCountryAccessibilityInfo(countryName: string): CountryAccessibilityData {
    return {
      name: countryName,
      description: this.generateCountryDescription(countryName),
      ariaLabel: `${countryName} - Click to select and view details`,
      instructions:
        'Press Enter to select, Arrow keys to navigate to other countries',
    };
  }

  /**
   * Update country selection for screen readers
   */
  updateCountrySelection(countryName: string | null): void {
    this.currentCountry.set(countryName);

    if (countryName) {
      this.announceCountrySelection(countryName);
    }
  }

  /**
   * Announce globe loading state
   */
  announceLoadingState(message: string, progress?: number): void {
    const announcement =
      progress !== undefined ? `${message} - ${progress}% complete` : message;

    this.announce(announcement);
  }

  /**
   * Enable/disable audio feedback
   */
  toggleAudioFeedback(enabled: boolean): void {
    this.audioEnabled = enabled;
    if (enabled) {
      this.setupAudioContext();
    }
  }

  /**
   * Get keyboard shortcuts help text
   */
  getKeyboardShortcuts(): KeyboardShortcut[] {
    return [
      {
        key: 'Arrow Keys',
        description: 'Rotate the globe in different directions',
      },
      { key: 'Enter/Space', description: 'Select the country under focus' },
      { key: 'Tab', description: 'Navigate between countries' },
      { key: 'Shift + Tab', description: 'Navigate to previous country' },
      { key: 'Home', description: 'Reset globe to initial view' },
      { key: 'End', description: 'Focus on a random country' },
      { key: 'Escape', description: 'Clear current selection' },
      { key: '+/-', description: 'Zoom in/out' },
      {
        key: 'Letter keys',
        description: 'Search for countries starting with that letter',
      },
    ];
  }

  /**
   * Check if high contrast mode is needed
   */
  isHighContrastMode(): boolean {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }

  /**
   * Check if reduced motion is preferred
   */
  isReducedMotionPreferred(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Update available countries for navigation
   */
  updateAvailableCountries(countries: CountryAccessibilityData[]): void {
    this.availableCountries = countries.sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  private rotateGlobe(
    deltaX: number,
    deltaY: number,
    controls: OrbitControls,
  ): void {
    if (controls) {
      this.currentRotation.x += deltaX;
      this.currentRotation.y += deltaY;

      // Apply rotation using private methods with type assertion
      const controlsWithPrivateMethods = controls as OrbitControls & {
        _rotateLeft?(angle: number): void;
        _rotateUp?(angle: number): void;
      };

      if (controlsWithPrivateMethods._rotateLeft) {
        controlsWithPrivateMethods._rotateLeft(deltaX);
      }
      if (controlsWithPrivateMethods._rotateUp) {
        controlsWithPrivateMethods._rotateUp(deltaY);
      }
      controls.update();
    }
  }

  private selectCountryUnderFocus(camera: Camera, countries?: Group): void {
    if (!countries) return;

    // Use raycasting to find country at center of view
    const raycaster = new Raycaster();
    const centerVector = new Vector3(0, 0, -1);
    centerVector.unproject(camera);

    const direction = centerVector.sub(camera.position).normalize();
    raycaster.set(camera.position, direction);

    const intersects = raycaster.intersectObjects(countries.children, true);

    if (intersects.length > 0) {
      const countryObject = this.findCountryFromIntersection(
        intersects[0].object,
      );
      if (countryObject) {
        const countryName =
          countryObject.userData?.['name'] || 'Unknown Country';
        this.updateCountrySelection(countryName);
      }
    }
  }

  private focusNextCountry(camera: Camera, countries?: Group): void {
    if (this.availableCountries.length === 0) return;

    this.selectedCountryIndex =
      (this.selectedCountryIndex + 1) % this.availableCountries.length;
    const country = this.availableCountries[this.selectedCountryIndex];

    this.updateCountrySelection(country.name);
    this.announceAction(`Focused on ${country.name}`);
  }

  private focusPreviousCountry(camera: Camera, countries?: Group): void {
    if (this.availableCountries.length === 0) return;

    this.selectedCountryIndex =
      this.selectedCountryIndex <= 0
        ? this.availableCountries.length - 1
        : this.selectedCountryIndex - 1;

    const country = this.availableCountries[this.selectedCountryIndex];
    this.updateCountrySelection(country.name);
    this.announceAction(`Focused on ${country.name}`);
  }

  private searchCountryByLetter(
    letter: string,
    camera: Camera,
    countries?: Group,
  ): void {
    const matchingCountries = this.availableCountries.filter((country) =>
      country.name.toLowerCase().startsWith(letter),
    );

    if (matchingCountries.length > 0) {
      const country = matchingCountries[0];
      this.updateCountrySelection(country.name);
      this.announceAction(`Found ${country.name}`);
    } else {
      this.announceAction(
        `No countries found starting with ${letter.toUpperCase()}`,
      );
    }
  }

  private resetGlobeView(controls: OrbitControls): void {
    if (controls) {
      controls.reset();
      this.currentRotation = { x: 0, y: 0 };
      this.selectedCountryIndex = -1;
    }
  }

  private focusRandomCountry(camera: Camera, countries?: Group): void {
    if (this.availableCountries.length === 0) return;

    const randomIndex = Math.floor(
      Math.random() * this.availableCountries.length,
    );
    const country = this.availableCountries[randomIndex];

    this.selectedCountryIndex = randomIndex;
    this.updateCountrySelection(country.name);
    this.announceAction(`Randomly selected ${country.name}`);
  }

  private clearSelection(): void {
    this.updateCountrySelection(null);
    this.selectedCountryIndex = -1;
  }

  private zoomIn(controls: OrbitControls): void {
    if (controls) {
      const controlsWithPrivateMethods = controls as OrbitControls & {
        _dollyIn?(scale: number): void;
      };

      if (controlsWithPrivateMethods._dollyIn) {
        controlsWithPrivateMethods._dollyIn(0.9);
      }
      controls.update();
      this.announceAction('Zoomed in');
    }
  }

  private zoomOut(controls: OrbitControls): void {
    if (controls) {
      const controlsWithPrivateMethods = controls as OrbitControls & {
        _dollyOut?(scale: number): void;
      };

      if (controlsWithPrivateMethods._dollyOut) {
        controlsWithPrivateMethods._dollyOut(1.1);
      }
      controls.update();
      this.announceAction('Zoomed out');
    }
  }

  private announceRotation(direction: string): void {
    this.announce(`Globe rotated ${direction}`);
  }

  private announceCountrySelection(countryName: string): void {
    const info = this.getCountryAccessibilityInfo(countryName);
    this.announce(info.description);
  }

  private announceAction(message: string): void {
    this.announce(message);
  }

  private announceGlobeReady(): void {
    this.announce(
      '3D Globe loaded successfully. Use arrow keys to explore, Tab to navigate countries, Enter to select.',
    );
  }

  private announce(message: string): void {
    // Create or update live region for screen readers
    const liveRegion = this.getOrCreateLiveRegion();
    liveRegion.textContent = message;

    // Audio feedback if enabled
    if (this.audioEnabled) {
      this.playAudioFeedback();
    }

    // Clear after a delay to allow for new announcements
    setTimeout(() => {
      if (liveRegion.textContent === message) {
        liveRegion.textContent = '';
      }
    }, 1000);
  }

  private getOrCreateLiveRegion(): HTMLElement {
    let liveRegion = document.getElementById('globe-live-region');

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'globe-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      liveRegion.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(liveRegion);
    }

    return liveRegion;
  }

  private setupAudioContext(): void {
    if (this.audioEnabled && !this.audioContext) {
      try {
        this.audioContext = new (
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        )();
      } catch (error) {
        this.logger.warn(
          'Web Audio API not supported',
          'AccessibilityService',
          error,
        );
      }
    }
  }

  private playAudioFeedback(): void {
    if (!this.audioContext || !this.audioEnabled) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.1,
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.1);
    } catch (error) {
      this.logger.warn('Audio feedback failed', 'AccessibilityService', error);
    }
  }

  private generateCountryDescription(countryName: string): string {
    // This could be enhanced with actual country data
    return `${countryName} selected. Press Enter to view details, arrow keys to navigate.`;
  }

  private findCountryFromIntersection(object: Object3D): Object3D | null {
    let current = object;
    while (current) {
      if (current.userData?.['isCountry']) {
        return current;
      }
      current = current.parent!;
    }
    return null;
  }

  private loadUserPreferences(): void {
    // Load from localStorage or user preferences
    const savedPreferences = localStorage.getItem(
      'globe-accessibility-preferences',
    );
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences);
        this.audioEnabled = preferences.audioEnabled || false;
        this.rotationStep = preferences.rotationStep || 0.05;
      } catch (error) {
        this.logger.warn(
          'Failed to load accessibility preferences',
          'AccessibilityService',
          error,
        );
      }
    }
  }
}

/**
 * Interface for country accessibility data
 */
export interface CountryAccessibilityData {
  name: string;
  description: string;
  ariaLabel: string;
  instructions: string;
}

/**
 * Interface for keyboard shortcuts
 */
export interface KeyboardShortcut {
  key: string;
  description: string;
}
