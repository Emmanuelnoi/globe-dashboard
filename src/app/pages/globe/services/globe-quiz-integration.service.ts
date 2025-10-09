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
  private quizCandidateMesh: Mesh | null = null;
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

    countriesGroup.traverse((object: any) => {
      if (object instanceof Mesh) {
        const meshCountryName = object.name;
        if (
          this.normalizeCountryName(meshCountryName) ===
          this.normalizeCountryName(countryName)
        ) {
          this.applyQuizCandidateSelection(object);
        }
      }
    });
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
    this.quizCandidateMesh = mesh;

    this.logger.debug(
      `Applied quiz candidate highlight to: ${mesh.name}`,
      'QuizIntegration',
    );
  }

  /**
   * Clear quiz candidate highlight
   */
  clearQuizCandidateHighlight(): void {
    if (this.quizCandidateMesh) {
      // Restore original material
      if (this.quizCandidateMesh.userData['originalMaterial']) {
        this.quizCandidateMesh.material =
          this.quizCandidateMesh.userData['originalMaterial'];
        delete this.quizCandidateMesh.userData['originalMaterial'];
      }

      this.quizCandidateMesh = null;
    }
  }

  /**
   * Normalize country name for comparison
   */
  private normalizeCountryName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
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
    this.quizCandidateMesh = null;
    this.quizCandidateMaterial = null;
  }
}
