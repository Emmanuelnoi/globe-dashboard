/**
 * Globe Accessibility Service
 * Handles ARIA, keyboard navigation, and screen reader support
 * Extracted from globe.ts (~100 lines reduction)
 */

import { Injectable, inject } from '@angular/core';
import { AccessibilityService } from '../../../core/services/accessibility.service';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class GlobeAccessibilityService {
  private readonly accessibilityService = inject(AccessibilityService);
  private readonly logger = inject(LoggerService);

  /**
   * Update accessibility for country selection
   */
  updateAccessibilityCountrySelection(countryName: string | null): void {
    if (countryName) {
      // Use updateCountrySelection to update state and trigger accessibility announcement
      this.accessibilityService.updateCountrySelection(countryName);
      this.logger.debug(
        `Announced country selection: ${countryName}`,
        'Accessibility',
      );
    }
  }

  /**
   * Update accessibility loading state
   */
  updateAccessibilityLoadingState(
    isLoading: boolean,
    message?: string,
    progress?: number,
  ): void {
    if (isLoading) {
      const loadingMessage = message || 'Loading globe data';
      // Use announceLoadingState instead of announceLoading
      this.accessibilityService.announceLoadingState(loadingMessage, progress);
    }
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboardNavigation(
    event: KeyboardEvent,
    callback: (direction: string) => void,
  ): void {
    const key = event.key;

    // Arrow keys for rotation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      event.preventDefault();
      callback(key);
      return;
    }

    // Enter/Space for selection
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      callback('select');
      return;
    }

    // Escape to clear
    if (key === 'Escape') {
      event.preventDefault();
      callback('escape');
      return;
    }
  }

  /**
   * Get ARIA description for globe
   */
  getGlobeAriaDescription(): string {
    return this.accessibilityService.getGlobeAriaDescription();
  }

  /**
   * Announce error to screen readers
   */
  announceError(error: string): void {
    // Use announceLoadingState to announce errors (no dedicated announceError method)
    this.accessibilityService.announceLoadingState(`Error: ${error}`);
    this.logger.error(`Accessibility error announced: ${error}`, 'Globe');
  }

  /**
   * Check if in keyboard mode
   */
  isKeyboardMode(): boolean {
    return this.accessibilityService.isKeyboardMode();
  }

  /**
   * Get current country for screen readers
   */
  getCurrentCountry(): string | null {
    return this.accessibilityService.currentCountry();
  }
}
