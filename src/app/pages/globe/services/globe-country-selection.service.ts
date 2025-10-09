/**
 * Globe Country Selection Service
 * Handles all country selection logic extracted from globe.ts
 * Reduces globe.ts complexity by ~400 lines
 */

import { Injectable, inject, signal } from '@angular/core';
import { Mesh, Material, Group, Object3D, Color } from 'three';
import { CountryDataService } from '../../../core/services/country-data.service';
import { LoggerService } from '../../../core/services/logger.service';
import type { CountryDataRecord } from '../../../core/types/country-data.types';

export interface CountrySelectionState {
  selectedMeshes: Set<Mesh>;
  lastSelectedMesh: Mesh | null;
  persistentSelection: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class GlobeCountrySelectionService {
  private readonly countryDataService = inject(CountryDataService);
  private readonly logger = inject(LoggerService);

  // Selection state
  private readonly _selectionState = signal<CountrySelectionState>({
    selectedMeshes: new Set(),
    lastSelectedMesh: null,
    persistentSelection: null,
  });

  readonly selectionState = this._selectionState.asReadonly();

  // Selection materials
  private defaultMaterial: Material | null = null;
  private selectedMaterial: Material | null = null;
  private hoverMaterial: Material | null = null;

  /**
   * Initialize selection materials
   */
  initializeSelectionMaterials(
    defaultMat: Material,
    selectedMat: Material,
    hoverMat: Material,
  ): void {
    this.defaultMaterial = defaultMat;
    this.selectedMaterial = selectedMat;
    this.hoverMaterial = hoverMat;
  }

  /**
   * Apply country selection to a mesh
   */
  applyCountrySelection(mesh: Mesh): void {
    if (!this.selectedMaterial) return;

    // Store original material if not already stored
    if (!mesh.userData['originalMaterial']) {
      mesh.userData['originalMaterial'] = mesh.material;
    }

    // Apply selected material
    mesh.material = this.selectedMaterial;

    // Add to selected meshes
    const state = this._selectionState();
    state.selectedMeshes.add(mesh);
    this._selectionState.set({
      ...state,
      lastSelectedMesh: mesh,
    });
  }

  /**
   * Remove country selection from a mesh
   */
  removeCountrySelection(mesh: Mesh): void {
    // Restore original material
    if (mesh.userData['originalMaterial']) {
      mesh.material = mesh.userData['originalMaterial'];
      delete mesh.userData['originalMaterial'];
    }

    // Remove from selected meshes
    const state = this._selectionState();
    state.selectedMeshes.delete(mesh);
    this._selectionState.set({ ...state });
  }

  /**
   * Reset all country selections
   */
  resetAllCountrySelections(countries?: Group): void {
    const state = this._selectionState();

    // Restore materials for all selected meshes
    state.selectedMeshes.forEach((mesh) => {
      if (mesh.userData['originalMaterial']) {
        mesh.material = mesh.userData['originalMaterial'];
        delete mesh.userData['originalMaterial'];
      }
    });

    // Clear selection state
    this._selectionState.set({
      selectedMeshes: new Set(),
      lastSelectedMesh: null,
      persistentSelection: null,
    });
  }

  /**
   * Reset temporary selections (keep persistent)
   */
  resetTemporarySelections(): void {
    const state = this._selectionState();
    const persistentCountry = state.persistentSelection;

    // Clear all selections
    state.selectedMeshes.forEach((mesh) => {
      if (mesh.userData['originalMaterial']) {
        mesh.material = mesh.userData['originalMaterial'];
        delete mesh.userData['originalMaterial'];
      }
    });

    this._selectionState.set({
      selectedMeshes: new Set(),
      lastSelectedMesh: null,
      persistentSelection: persistentCountry,
    });
  }

  /**
   * Check if a mesh is selected
   */
  isCountrySelected(mesh: Mesh): boolean {
    return this._selectionState().selectedMeshes.has(mesh);
  }

  /**
   * Apply selection to country by ID
   */
  applyCountrySelectionById(countryId: string, countriesGroup: Group): void {
    if (!countriesGroup) return;

    countriesGroup.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        const meshCountryId = object.userData['countryId'] || object.name;
        if (this.countryMatches(meshCountryId, countryId)) {
          this.applyCountrySelection(object);
        }
      }
    });
  }

  /**
   * Apply selection to country group
   */
  applyCountrySelectionToGroup(
    countryName: string,
    countriesGroup: Group,
  ): void {
    if (!countriesGroup) return;

    let foundMatch = false;

    countriesGroup.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        const meshCountryName = object.name;

        if (this.isCountryNameMatch(meshCountryName, countryName)) {
          this.applyCountrySelection(object);
          foundMatch = true;
        }
      }
    });

    if (!foundMatch) {
      this.logger.warn(
        `No mesh found for country: ${countryName}`,
        'CountrySelection',
      );
    }
  }

  /**
   * Apply persistent country selection
   */
  applyPersistentCountrySelection(
    countryName: string,
    countriesGroup: Group,
  ): void {
    this.resetTemporarySelections();

    const state = this._selectionState();
    this._selectionState.set({
      ...state,
      persistentSelection: countryName,
    });

    this.applyCountrySelectionToGroup(countryName, countriesGroup);
  }

  /**
   * Ensure all countries have IDs
   */
  ensureCountryIds(countriesGroup: Group): void {
    if (!countriesGroup) return;

    countriesGroup.traverse((object: Object3D) => {
      if (object instanceof Mesh && !object.userData['countryId']) {
        object.userData['countryId'] = object.name;
      }
    });
  }

  /**
   * Check if country names match
   */
  private isCountryNameMatch(meshName: string, targetName: string): boolean {
    const normalize = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');

    const meshNormalized = normalize(meshName);
    const targetNormalized = normalize(targetName);

    return meshNormalized === targetNormalized;
  }

  /**
   * Check if country ID/name matches
   */
  private countryMatches(countryId: string, targetId: string): boolean {
    return countryId.toLowerCase() === targetId.toLowerCase();
  }

  /**
   * Format country name from mesh name
   */
  formatCountryName(meshCountryName: string): string {
    return meshCountryName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Normalize country name for data service
   */
  normalizeCountryNameForDataService(meshCountryName: string): string {
    const formatted = this.formatCountryName(meshCountryName);

    // Handle special cases
    const specialCases: Record<string, string> = {
      'United States Of America': 'United States',
      'United Kingdom': 'United Kingdom',
      'Russian Federation': 'Russia',
      'Peoples Republic Of China': 'China',
      'Republic Of Korea': 'South Korea',
      'Democratic Peoples Republic Of Korea': 'North Korea',
      Czechia: 'Czech Republic',
      'Ivory Coast': "Côte d'Ivoire",
      Congo: 'Republic of the Congo',
      'Democratic Republic Of The Congo': 'Democratic Republic of the Congo',
    };

    return specialCases[formatted] || formatted;
  }

  /**
   * Get country data by name
   */
  async getCountryData(countryName: string): Promise<CountryDataRecord | null> {
    const normalized = this.normalizeCountryNameForDataService(countryName);
    const countryData =
      await this.countryDataService.getCountryByName(normalized);

    if (!countryData) {
      this.logger.warn(
        `No data found for country: ${normalized}`,
        'CountrySelection',
      );
      return null;
    }

    return countryData;
  }

  /**
   * Clear persistent selection
   */
  clearPersistentSelection(): void {
    const state = this._selectionState();
    this._selectionState.set({
      ...state,
      persistentSelection: null,
    });
  }

  /**
   * Get current persistent selection
   */
  getPersistentSelection(): string | null {
    return this._selectionState().persistentSelection;
  }
}
