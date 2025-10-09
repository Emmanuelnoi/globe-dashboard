/**
 * Globe Data Loading Service
 * Handles data loading, retries, and rendering mode switching
 * Extracted from globe.ts (~200 lines reduction)
 */

import { Injectable, inject, signal } from '@angular/core';
import { LoggerService } from '../../../core/services/logger.service';

export interface LoadingState {
  isLoading: boolean;
  message: string;
  progress: number;
}

@Injectable({
  providedIn: 'root',
})
export class GlobeDataLoadingService {
  private readonly logger = inject(LoggerService);

  // Loading state
  readonly isLoading = signal(false);
  readonly loadingMessage = signal('Initializing 3D scene...');
  readonly loadingProgress = signal(0);
  readonly initError = signal<string | null>(null);

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean, message?: string, progress?: number): void {
    this.isLoading.set(isLoading);
    if (message !== undefined) this.loadingMessage.set(message);
    if (progress !== undefined) this.loadingProgress.set(progress);
  }

  /**
   * Set loading error
   */
  setError(error: string | null): void {
    this.initError.set(error);
  }

  /**
   * Update loading progress
   */
  updateProgress(progress: number, message?: string): void {
    this.loadingProgress.set(progress);
    if (message) this.loadingMessage.set(message);
  }

  /**
   * Load data with retry logic
   */
  async loadWithRetry<T>(
    loadFn: () => Promise<T>,
    description: string,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `${description} - Attempt ${attempt}/${maxRetries}`,
          'DataLoading',
        );
        return await loadFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `${description} failed (attempt ${attempt}/${maxRetries}):`,
          'DataLoading',
          error,
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw (
      lastError ||
      new Error(`${description} failed after ${maxRetries} attempts`)
    );
  }

  /**
   * Handle initialization error
   */
  handleInitializationError(error: Error | unknown): void {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    this.logger.error('Scene initialization failed:', error, 'DataLoading');

    this.setError(errorMessage);
    this.setLoading(false);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.initError.set(null);
  }

  /**
   * Reset loading state
   */
  reset(): void {
    this.isLoading.set(false);
    this.loadingMessage.set('Initializing 3D scene...');
    this.loadingProgress.set(0);
    this.initError.set(null);
  }

  /**
   * Get current loading state
   */
  getLoadingState(): LoadingState {
    return {
      isLoading: this.isLoading(),
      message: this.loadingMessage(),
      progress: this.loadingProgress(),
    };
  }
}
