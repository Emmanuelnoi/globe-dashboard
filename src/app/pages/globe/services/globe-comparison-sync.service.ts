/**
 * Globe Comparison Sync Service
 * Syncs globe selections with comparison table
 * Extracted from globe.ts (~80 lines reduction)
 */

import { Injectable, inject, effect } from '@angular/core';
import { GlobeCountrySelectionService } from './globe-country-selection.service';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class GlobeComparisonSyncService {
  private readonly countrySelectionService = inject(
    GlobeCountrySelectionService,
  );
  private readonly logger = inject(LoggerService);

  constructor() {
    // Set up sync effect
    this.setupComparisonTableSync();
  }

  /**
   * Set up comparison table synchronization
   */
  private setupComparisonTableSync(): void {
    effect(() => {
      const state = this.countrySelectionService.selectionState();
      this.logger.debug(
        `Comparison table has ${state.selectedMeshes.size} countries`,
        'ComparisonSync',
      );
    });
  }

  /**
   * Sync globe with comparison table
   */
  syncGlobeWithComparisonTable(
    applySelectionCallback: (countryName: string) => void,
  ): void {
    const state = this.countrySelectionService.selectionState();

    this.logger.debug(
      `Syncing globe with ${state.selectedMeshes.size} countries from comparison table`,
      'ComparisonSync',
    );

    // Apply selections from comparison table to globe
    state.selectedMeshes.forEach((mesh) => {
      const countryName = mesh.name;
      if (countryName) {
        applySelectionCallback(countryName);
      }
    });
  }

  /**
   * Add country to comparison
   */
  addToComparison(countryName: string): void {
    this.logger.debug(`Adding ${countryName} to comparison`, 'ComparisonSync');
    // Logic to add country to comparison table
    // This would typically interact with a comparison service
  }

  /**
   * Remove country from comparison
   */
  removeFromComparison(countryName: string): void {
    this.logger.debug(
      `Removing ${countryName} from comparison`,
      'ComparisonSync',
    );
    // Logic to remove country from comparison table
  }

  /**
   * Get selected countries from comparison table
   */
  getSelectedCountries(): Set<any> {
    return this.countrySelectionService.selectionState().selectedMeshes;
  }

  /**
   * Check if country is in comparison table
   */
  isInComparison(countryName: string): boolean {
    const state = this.countrySelectionService.selectionState();
    return Array.from(state.selectedMeshes).some(
      (mesh) => mesh.name === countryName,
    );
  }
}
