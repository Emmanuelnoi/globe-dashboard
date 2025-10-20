/**
 * Globe Quiz Integration Service
 * Handles quiz mode integration and candidate highlighting
 * Extracted from globe.ts (~200 lines reduction)
 */

import { Injectable, inject, signal, effect } from '@angular/core';
import { Mesh, Material, Color } from 'three';
import { QuizStateService } from '../../../features/quiz/services/quiz-state';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class GlobeQuizIntegrationService {
  private readonly quizStateService = inject(QuizStateService);
  private readonly logger = inject(LoggerService);

  // Quiz candidate state
  readonly quizCandidate = signal<string | null>(null);
  private quizCandidateMeshes: Mesh[] = []; // Store ALL meshes for MultiPolygon countries
  private quizCandidateMaterial: Material | null = null;

  constructor() {
    // Set up quiz candidate effect
    effect(() => {
      const candidate = this.quizStateService.selectedCandidate();
      this.quizCandidate.set(candidate);
    });
  }

  /**
   * Initialize quiz materials
   */
  initializeQuizMaterials(candidateMaterial: Material): void {
    this.quizCandidateMaterial = candidateMaterial;
  }

  /**
   * Apply quiz candidate highlight to a country
   */
  applyQuizCandidateHighlight(countryName: string, countriesGroup: any): void {
    if (!countriesGroup) return;

    this.clearQuizCandidateHighlight();

    // Counter for matched meshes
    let matchedCount = 0;

    // Debug: collect sample mesh names for troubleshooting
    const sampleMeshNames: string[] = [];
    let sampleCount = 0;

    countriesGroup.traverse((object: any) => {
      if (object instanceof Mesh) {
        const meshCountryName = object.name;

        // Collect samples for debugging (first 5 meshes that partially match)
        if (
          sampleCount < 5 &&
          meshCountryName
            .toLowerCase()
            .includes(countryName.toLowerCase().substring(0, 3))
        ) {
          sampleMeshNames.push(meshCountryName);
          sampleCount++;
        }

        // Use the same matching logic as GlobeCountrySelectionService
        if (this.isCountryNameMatch(meshCountryName, countryName)) {
          this.applyQuizCandidateSelection(object);
          matchedCount++;
        }
      }
    });

    // Log results with samples for debugging
    if (matchedCount === 0 && sampleMeshNames.length > 0) {
      this.logger.warn(
        `No meshes matched for "${countryName}". Sample mesh names: ${sampleMeshNames.join(', ')}`,
        'QuizIntegration',
      );
    } else {
      this.logger.debug(
        `Applied quiz candidate highlight to "${countryName}": ${matchedCount} meshes matched`,
        'QuizIntegration',
      );
    }
  }

  /**
   * Apply quiz candidate selection to a mesh
   */
  applyQuizCandidateSelection(mesh: Mesh): void {
    if (!this.quizCandidateMaterial) return;

    // Store original material
    if (!mesh.userData['originalMaterial']) {
      mesh.userData['originalMaterial'] = mesh.material;
    }

    // Apply quiz candidate material
    mesh.material = this.quizCandidateMaterial;

    // Store in array to track ALL highlighted meshes
    this.quizCandidateMeshes.push(mesh);
  }

  /**
   * Clear quiz candidate highlight
   */
  clearQuizCandidateHighlight(): void {
    // Restore original materials for ALL highlighted meshes
    this.quizCandidateMeshes.forEach((mesh) => {
      if (mesh.userData['originalMaterial']) {
        mesh.material = mesh.userData['originalMaterial'];
        delete mesh.userData['originalMaterial'];
      }
    });

    // Clear the array
    this.quizCandidateMeshes = [];
  }

  /**
   * Check if country names match with enhanced logic for TopoJSON mesh names
   * Uses the same logic as GlobeCountrySelectionService for consistency
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
   * Check if currently in quiz mode
   */
  isQuizMode(): boolean {
    const state = this.quizStateService.gameState();
    return state === 'playing' || state === 'question';
  }

  /**
   * Get current quiz candidate
   */
  getCurrentCandidate(): string | null {
    return this.quizCandidate();
  }

  /**
   * Cleanup on destroy
   */
  cleanup(): void {
    this.clearQuizCandidateHighlight();
    this.quizCandidateMeshes = [];
    this.quizCandidateMaterial = null;
  }
}
