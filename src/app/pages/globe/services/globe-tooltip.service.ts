/**
 * Globe Tooltip Service
 * Handles country hover tooltips and info display
 * Extracted from globe.ts (~150 lines reduction)
 */

import { Injectable, inject, signal } from '@angular/core';
import { CountryHoverService } from '../../../core/services/country-hover.service';
import { CountryDataService } from '../../../core/services/country-data.service';
import { LoggerService } from '../../../core/services/logger.service';
import type { CountryDataRecord } from '../../../core/types/country-data.types';
import type { TooltipPosition } from '../../../layout/component/country-tooltip/country-tooltip';

@Injectable({
  providedIn: 'root',
})
export class GlobeTooltipService {
  private readonly countryHoverService = inject(CountryHoverService);
  private readonly countryDataService = inject(CountryDataService);
  private readonly logger = inject(LoggerService);

  // Tooltip state
  readonly countryNameTooltipVisible = signal(false);
  readonly hoveredCountryName = signal<string>('');
  readonly countryNameTooltipPosition = signal<TooltipPosition>({
    x: 0,
    y: 0,
  });
  readonly selectedCountry = signal<CountryDataRecord | null>(null);

  /**
   * Handle country hover
   */
  async handleCountryHover(
    countryName: string,
    mouseX: number,
    mouseY: number,
  ): Promise<void> {
    if (!countryName) {
      this.hideNameTooltip();
      return;
    }

    // Update hover state
    this.hoveredCountryName.set(countryName);
    this.countryNameTooltipPosition.set({ x: mouseX, y: mouseY });
    this.countryNameTooltipVisible.set(true);
  }

  /**
   * Handle country info display (on click)
   */
  async handleCountryInfoDisplay(
    countryName: string,
    normalizedName: string,
  ): Promise<void> {
    try {
      const countryData =
        await this.countryDataService.getCountryByName(normalizedName);

      if (countryData) {
        this.selectedCountry.set(countryData);
        this.logger.debug(
          `Displaying info for: ${countryData.name}`,
          'TooltipService',
        );
      } else {
        this.logger.warn(
          `No data found for country: ${normalizedName}`,
          'TooltipService',
        );
        this.selectedCountry.set(null);
      }
    } catch (error) {
      this.logger.error(
        'Error fetching country data:',
        error,
        'TooltipService',
      );
      this.selectedCountry.set(null);
    }
  }

  /**
   * Hide name tooltip
   */
  hideNameTooltip(): void {
    this.countryNameTooltipVisible.set(false);
    this.hoveredCountryName.set('');
  }

  /**
   * Hide all tooltips
   */
  hideAllTooltips(): void {
    this.hideNameTooltip();
    this.selectedCountry.set(null);
  }

  /**
   * Clear selected country info
   */
  clearSelectedCountry(): void {
    this.selectedCountry.set(null);
  }

  /**
   * Get current hovered country
   */
  getHoveredCountry(): string {
    return this.hoveredCountryName();
  }

  /**
   * Get selected country data
   */
  getSelectedCountry(): CountryDataRecord | null {
    return this.selectedCountry();
  }
}
