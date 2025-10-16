/**
 * Globe Comparison Sync Service
 * Handles bi-directional synchronization between globe visual selections and comparison table
 * Extracted from globe.ts for better separation of concerns
 */

import { Injectable, inject, effect } from '@angular/core';
import { Group } from 'three';
import { GlobeCountrySelectionService } from './globe-country-selection.service';
import { CountryDataService } from '../../../core/services/country-data.service';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class GlobeComparisonSyncService {
  private readonly countrySelectionService = inject(
    GlobeCountrySelectionService,
  );
  private readonly countryDataService = inject(CountryDataService);
  private readonly logger = inject(LoggerService);

  // Flag to prevent infinite loops during bi-directional sync
  private isSyncing = false;

  /**
   * Setup bi-directional synchronization between comparison table and globe
   * This should be called once after countries are loaded
   *
   * @param countries - The Three.js Group containing all country meshes
   */
  setupBiDirectionalSync(countries: Group): void {
    if (!countries) {
      this.logger.warn(
        'Cannot setup bi-directional sync - countries not loaded',
        'ComparisonSync',
      );
      return;
    }

    // Effect: Watch comparison table changes → update globe visual selections
    effect(() => {
      // Prevent infinite loops
      if (this.isSyncing) {
        return;
      }

      const selectedCountryCodes = this.countryDataService.selectedCountries();

      this.logger.debug(
        `Comparison table changed: ${selectedCountryCodes.length} countries selected`,
        'ComparisonSync',
      );

      // Early exit if countries not ready
      if (!countries || countries.children.length === 0) {
        return;
      }

      // Set sync flag to prevent circular updates
      this.isSyncing = true;

      try {
        // Reset all country selections first
        this.countrySelectionService.resetAllCountrySelections(countries);

        // Apply selection to countries in the comparison table
        selectedCountryCodes.forEach((countryCode) => {
          const country = this.countryDataService.getCountryByCode(countryCode);
          if (country) {
            this.countrySelectionService.applyPersistentCountrySelection(
              country.name,
              countries,
              false, // Don't reset - we already reset above
            );

            this.logger.debug(
              `Applied visual selection to: ${country.name}`,
              'ComparisonSync',
            );
          } else {
            this.logger.warn(
              `Could not find country data for code: ${countryCode}`,
              'ComparisonSync',
            );
          }
        });

        this.logger.success(
          `Globe synced with comparison table (${selectedCountryCodes.length} countries)`,
          'ComparisonSync',
        );
      } finally {
        // Always reset sync flag
        this.isSyncing = false;
      }
    });

    this.logger.success(
      'Bi-directional sync initialized successfully',
      'ComparisonSync',
    );
  }

  /**
   * Manually sync globe with comparison table (for initial load or manual refresh)
   *
   * @param countries - The Three.js Group containing all country meshes
   */
  syncGlobeWithComparisonTable(countries: Group): void {
    if (!countries || countries.children.length === 0) {
      this.logger.warn('Cannot sync - countries not loaded', 'ComparisonSync');
      return;
    }

    const selectedCountryCodes = this.countryDataService.selectedCountries();

    this.logger.debug(
      `Manual sync: ${selectedCountryCodes.length} countries from comparison table`,
      'ComparisonSync',
    );

    // Reset all country selections first
    this.countrySelectionService.resetAllCountrySelections(countries);

    // Apply selection to countries in the comparison table
    selectedCountryCodes.forEach((countryCode) => {
      const country = this.countryDataService.getCountryByCode(countryCode);
      if (country) {
        this.countrySelectionService.applyPersistentCountrySelection(
          country.name,
          countries,
          false, // Don't reset - we already reset above
        );
      }
    });

    this.logger.success(
      `Manual sync complete (${selectedCountryCodes.length} countries)`,
      'ComparisonSync',
    );
  }

  /**
   * Check if currently syncing (to prevent infinite loops)
   */
  isSyncingNow(): boolean {
    return this.isSyncing;
  }
}
