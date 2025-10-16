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
import { COUNTRY_MATERIALS } from '@lib/utils/geojson.utils';

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

  // Selection materials - use COUNTRY_MATERIALS directly
  private get defaultMaterial(): Material {
    return COUNTRY_MATERIALS.normal.border;
  }

  private get selectedMaterial(): Material {
    return COUNTRY_MATERIALS.selected.fill;
  }

  private get hoverMaterial(): Material {
    return COUNTRY_MATERIALS.hover.fill;
  }

  /**
   * @deprecated Materials are now accessed directly from COUNTRY_MATERIALS
   * Initialize selection materials (kept for backward compatibility)
   */
  initializeSelectionMaterials(
    defaultMat: Material,
    selectedMat: Material,
    hoverMat: Material,
  ): void {
    // No-op: Materials are now accessed directly from COUNTRY_MATERIALS
    // This method is kept for backward compatibility
  }

  /**
   * Apply country selection to a mesh
   */
  applyCountrySelection(mesh: Mesh): void {
    // Store original material if not already stored
    if (!mesh.userData['originalMaterial']) {
      mesh.userData['originalMaterial'] = mesh.material;
    }

    // Apply selected material
    mesh.material = this.selectedMaterial;

    // CRITICAL: Configure depth handling for MultiPolygon countries (USA, Canada, Brazil, etc.)
    // Without these settings, the 100+ polygon parts in large countries occlude each other incorrectly
    const material = mesh.material as Material & {
      depthTest?: boolean;
      depthWrite?: boolean;
      needsUpdate?: boolean;
    };

    if (material) {
      material.depthTest = false; // Disable depth testing to prevent mesh occlusion gaps
      material.depthWrite = false; // Disable depth writing to prevent depth buffer conflicts
      material.needsUpdate = true; // Force material update to apply changes immediately
    }

    // Set render order and visibility (from commit 275bcf7)
    mesh.renderOrder = 10; // Render on top of Earth surface
    mesh.visible = true; // Ensure mesh is visible

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

    // Reset mesh properties (from commit 275bcf7)
    mesh.renderOrder = 0; // Reset render order
    mesh.visible = false; // Hide unselected meshes

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
   * Check if a country (by name) is currently selected
   */
  isCountryNameSelected(countryName: string, countriesGroup: Group): boolean {
    const state = this._selectionState();

    // Check if any mesh matching this country name is in the selected set
    let isSelected = false;
    countriesGroup.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        const meshCountryName = object.name;
        if (this.isCountryNameMatch(meshCountryName, countryName)) {
          if (state.selectedMeshes.has(object)) {
            isSelected = true;
          }
        }
      }
    });

    return isSelected;
  }

  /**
   * Remove selection from a country by name
   */
  removeCountrySelectionByName(
    countryName: string,
    countriesGroup: Group,
  ): void {
    if (!countriesGroup) return;

    const meshesToRemove: Mesh[] = [];

    countriesGroup.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        const meshCountryName = object.name;
        if (this.isCountryNameMatch(meshCountryName, countryName)) {
          meshesToRemove.push(object);
        }
      }
    });

    // Remove all matched meshes
    meshesToRemove.forEach((mesh) => {
      this.removeCountrySelection(mesh);
    });
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
    let meshCount = 0;
    const matchedMeshes: Array<{ name: string; vertices: number }> = [];

    countriesGroup.traverse((object: Object3D) => {
      if (object instanceof Mesh) {
        const meshCountryName = object.name;

        if (this.isCountryNameMatch(meshCountryName, countryName)) {
          this.applyCountrySelection(object);
          const vertexCount =
            object.geometry?.attributes['position']?.count || 0;
          matchedMeshes.push({ name: meshCountryName, vertices: vertexCount });
          foundMatch = true;
          meshCount++;
        }
      }
    });

    if (foundMatch) {
      console.log(
        `✅ [CountrySelection] Successfully applied selection to: "${countryName}" (${meshCount} meshes)`,
      );

      // Sort by vertex count to find the largest meshes (likely mainland)
      const sortedBySize = [...matchedMeshes].sort(
        (a, b) => b.vertices - a.vertices,
      );
      const totalVertices = matchedMeshes.reduce(
        (sum, m) => sum + m.vertices,
        0,
      );

      console.log(
        `📊 Total vertices: ${totalVertices.toLocaleString()}, Largest 3 meshes:`,
        sortedBySize.slice(0, 3),
      );

      if (meshCount <= 10) {
        console.log(`📋 All matched meshes:`, matchedMeshes);
      } else {
        console.log(`📋 First 5 meshes:`, matchedMeshes.slice(0, 5));
        console.log(`📋 Last 5 meshes:`, matchedMeshes.slice(-5));
      }
    } else {
      this.logger.warn(
        `No mesh found for country: ${countryName}`,
        'CountrySelection',
      );

      // Debug: Show possible matches
      const possibleMatches: string[] = [];
      countriesGroup.traverse((object: Object3D) => {
        if (object instanceof Mesh && object.name) {
          const meshName = object.name.toLowerCase();
          const targetName = countryName.toLowerCase();
          if (meshName.includes(targetName) || targetName.includes(meshName)) {
            possibleMatches.push(object.name);
          }
        }
      });
      if (possibleMatches.length > 0) {
        console.log(
          `🔍 Possible "${countryName}" matches:`,
          possibleMatches.slice(0, 10),
        );
      }
    }
  }

  /**
   * Apply persistent country selection (WITHOUT reset for multi-selection support)
   * Use resetFirst parameter to control whether to clear existing selections
   */
  applyPersistentCountrySelection(
    countryName: string,
    countriesGroup: Group,
    resetFirst: boolean = false,
  ): void {
    if (resetFirst) {
      this.resetAllCountrySelections(countriesGroup);
    }

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
   * Check if country names match with enhanced logic for TopoJSON mesh names
   */
  private isCountryNameMatch(meshName: string, targetName: string): boolean {
    // Normalize function that handles prefixes, suffixes, and special characters
    const normalize = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/^selection-mesh-/i, '') // Strip "selection-mesh-" prefix
        .replace(/^selection-/i, '') // Strip "selection-" prefix
        .replace(/_\d+$/i, '') // Strip "_0", "_1", "_2" suffixes (for MultiPolygon parts)
        .replace(/[\s.''\-]/g, '') // Remove spaces, dots, apostrophes, hyphens
        .replace(/[^a-z0-9]/g, ''); // Remove all non-alphanumeric characters

    const meshNormalized = normalize(meshName);
    const targetNormalized = normalize(targetName);

    // Direct match
    if (meshNormalized === targetNormalized) {
      return true;
    }

    // Special case mappings for abbreviated names in TopoJSON
    const specialMappings: Record<string, string[]> = {
      // Democratic Republic of the Congo variants
      demrepcongo: [
        'democraticrepublicofthecongo',
        'democraticrepubliccongo',
        'drcongo',
        'dr.congo',
        'congodemocraticrepublic',
      ],
      // United States variants
      unitedstatesofamerica: ['unitedstates', 'usa', 'us'],
      // Côte d'Ivoire variants
      cotedivoire: ['ivorycoast', 'cotedivoire'],
      // Republic of the Congo
      congo: ['republicofthecongo', 'congobrazz', 'congobrazzaville'],
      // Other common abbreviations
      unitedkingdom: ['uk', 'greatbritain'],
      southafrica: ['rsa', 'republicofsouthafrica'],
      // Add more as needed
    };

    // Check if either the mesh or target matches any special mapping
    for (const [key, variants] of Object.entries(specialMappings)) {
      if (meshNormalized === key || variants.includes(meshNormalized)) {
        if (targetNormalized === key || variants.includes(targetNormalized)) {
          return true;
        }
      }
    }

    // Partial match: check if one is contained in the other (for abbreviated names)
    // Only if the shorter name is at least 4 characters to avoid false positives
    const minLength = Math.min(meshNormalized.length, targetNormalized.length);
    if (minLength >= 4) {
      if (
        meshNormalized.includes(targetNormalized) ||
        targetNormalized.includes(meshNormalized)
      ) {
        return true;
      }
    }

    return false;
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
   * Maps TopoJSON names to exact names used in country-data.ts
   */
  normalizeCountryNameForDataService(meshCountryName: string): string {
    // Handle special cases (TopoJSON names -> Country Data names)
    // IMPORTANT: Map TO the exact names used in src/assets/data/country-data.ts
    // TopoJSON names from src/assets/geo/country-id-lookup.json
    const specialCases: Record<string, string> = {
      // United States variants -> "United States"
      'United States of America': 'United States', // TopoJSON exact name
      'United States Of America': 'United States',
      'United States': 'United States',
      USA: 'United States',
      'U.S.A.': 'United States',
      US: 'United States',

      // United Kingdom -> "United Kingdom"
      'United Kingdom': 'United Kingdom', // TopoJSON exact name
      UK: 'United Kingdom',
      'Great Britain': 'United Kingdom',

      // Russia -> "Russia"
      'Russian Federation': 'Russia',
      Russia: 'Russia', // TopoJSON exact name

      // China -> "China"
      'Peoples Republic Of China': 'China',
      "People's Republic of China": 'China',
      'Peoples Republic of China': 'China',
      China: 'China', // TopoJSON exact name
      PRC: 'China',

      // South Korea -> "South Korea"
      'Republic Of Korea': 'South Korea',
      'Republic of Korea': 'South Korea',
      'South Korea': 'South Korea', // TopoJSON exact name
      'Korea, South': 'South Korea',
      'S. Korea': 'South Korea',

      // North Korea -> "North Korea"
      'Democratic Peoples Republic Of Korea': 'North Korea',
      "Democratic People's Republic of Korea": 'North Korea',
      'Democratic Peoples Republic of Korea': 'North Korea',
      'North Korea': 'North Korea', // TopoJSON exact name
      'Korea, North': 'North Korea',
      DPRK: 'North Korea',
      'N. Korea': 'North Korea',

      // Czech Republic -> "Czechia" (data uses "Czechia")
      'Czech Republic': 'Czechia',
      Czechia: 'Czechia', // TopoJSON exact name

      // Côte d'Ivoire -> "Ivory Coast" (data uses "Ivory Coast")
      "Côte d'Ivoire": 'Ivory Coast', // TopoJSON exact name
      "Côte D'ivoire": 'Ivory Coast',
      "Cote d'Ivoire": 'Ivory Coast',
      "Cote D'Ivoire": 'Ivory Coast',
      'Ivory Coast': 'Ivory Coast',

      // Congo variants -> "Republic of the Congo"
      Congo: 'Republic of the Congo', // TopoJSON exact name
      'Republic of the Congo': 'Republic of the Congo',
      'Congo-Brazzaville': 'Republic of the Congo',
      'Rep. Congo': 'Republic of the Congo',

      // DR Congo -> "DR Congo" (data uses "DR Congo")
      'Democratic Republic Of The Congo': 'DR Congo',
      'Democratic Republic of the Congo': 'DR Congo',
      'Dem Rep Congo': 'DR Congo',
      'Dem. Rep. Congo': 'DR Congo', // TopoJSON exact name
      'DR Congo': 'DR Congo',
      'D.R. Congo': 'DR Congo',
      DRC: 'DR Congo',
      'Congo-Kinshasa': 'DR Congo',

      // South Africa -> "South Africa"
      'South Africa': 'South Africa', // TopoJSON exact name
      'Republic of South Africa': 'South Africa',
      RSA: 'South Africa',

      // Central African Republic abbreviations
      'Central African Rep.': 'Central African Republic', // TopoJSON exact name
      'C.A.R.': 'Central African Republic',

      // Bosnia abbreviations
      'Bosnia and Herz.': 'Bosnia and Herzegovina', // TopoJSON exact name
      'Bosnia and Herzegovina': 'Bosnia and Herzegovina',

      // British territories
      'Br. Indian Ocean Ter.': 'British Indian Ocean Territory', // TopoJSON
      'British Virgin Is.': 'British Virgin Islands', // TopoJSON

      // Other common variants
      Burma: 'Myanmar',
      'East Timor': 'Timor-Leste',
      Swaziland: 'Eswatini',
      'Cabo Verde': 'Cape Verde', // TopoJSON uses "Cabo Verde"
      'Cook Is.': 'Cook Islands', // TopoJSON abbreviation
      'Cayman Is.': 'Cayman Islands', // TopoJSON abbreviation
      'Falkland Is.': 'Falkland Islands',
      'Antigua and Barb.': 'Antigua and Barbuda', // TopoJSON abbreviation
      'St. Kitts and Nevis': 'Saint Kitts and Nevis',
      'St. Lucia': 'Saint Lucia',
      'St. Vincent and the Grenadines': 'Saint Vincent and the Grenadines',
      'Solomon Is.': 'Solomon Islands', // TopoJSON abbreviation
      'N. Mariana Is.': 'Northern Mariana Islands',
      'Marshall Is.': 'Marshall Islands',
      'Turks and Caicos Is.': 'Turks and Caicos Islands',
      'U.S. Virgin Is.': 'United States Virgin Islands',
    };

    // First, try direct lookup with the input as-is
    if (specialCases[meshCountryName]) {
      return specialCases[meshCountryName];
    }

    // If not found, try with formatted name (for camelCase inputs like "UnitedStatesOfAmerica")
    const formatted = this.formatCountryName(meshCountryName);
    if (specialCases[formatted]) {
      return specialCases[formatted];
    }

    // Return formatted name if no special case found
    return formatted;
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
