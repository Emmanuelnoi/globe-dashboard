import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { WebGLRenderer } from 'three';

/**
 * Service for handling globe-specific errors and recovery mechanisms
 */
@Injectable({
  providedIn: 'root',
})
export class GlobeErrorRecoveryService {
  private readonly maxRetryAttempts = 3;
  private readonly retryDelayMs = 2000;

  // Error state signals
  public readonly hasWebGLError = signal(false);
  public readonly hasDataError = signal(false);
  public readonly isRecovering = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  // Retry subjects
  private webglRetrySubject = new BehaviorSubject<number>(0);
  private dataRetrySubject = new BehaviorSubject<number>(0);

  /**
   * Handle WebGL context loss
   */
  handleWebGLContextLoss(
    canvas: HTMLCanvasElement,
    onRecover: () => Promise<void>,
  ): void {
    console.warn('WebGL context lost, attempting recovery...');

    this.hasWebGLError.set(true);
    this.isRecovering.set(true);
    this.errorMessage.set(
      '3D rendering context lost. Attempting to restore...',
    );

    // Listen for context restoration
    const handleContextRestore = async () => {
      try {
        await this.delay(1000); // Allow context to fully restore
        await onRecover();

        this.hasWebGLError.set(false);
        this.isRecovering.set(false);
        this.errorMessage.set(null);

        console.log('WebGL context successfully restored');
        canvas.removeEventListener(
          'webglcontextrestored',
          handleContextRestore,
        );
      } catch (error) {
        console.error('Failed to recover from WebGL context loss:', error);
        this.setFatalError(
          'Failed to restore 3D rendering. Please refresh the page.',
        );
      }
    };

    canvas.addEventListener('webglcontextrestored', handleContextRestore);

    // Force context restoration attempt after delay
    timer(3000).subscribe(() => {
      if (this.hasWebGLError()) {
        this.attemptWebGLRecovery(onRecover);
      }
    });
  }

  /**
   * Handle data loading errors with retry mechanism
   */
  handleDataLoadingError(error: Error, retryFn: () => Promise<void>): void {
    console.error('Data loading error:', error);

    const currentRetries = this.dataRetrySubject.value;

    if (currentRetries < this.maxRetryAttempts) {
      this.hasDataError.set(true);
      this.isRecovering.set(true);
      this.errorMessage.set(
        `Loading error. Retrying... (${currentRetries + 1}/${this.maxRetryAttempts})`,
      );

      timer(this.retryDelayMs).subscribe(async () => {
        try {
          await retryFn();
          this.clearDataError();
        } catch (retryError) {
          this.dataRetrySubject.next(currentRetries + 1);
          this.handleDataLoadingError(retryError as Error, retryFn);
        }
      });
    } else {
      this.setFatalError(
        'Failed to load geographic data after multiple attempts. Please check your connection and refresh the page.',
      );
    }
  }

  /**
   * Handle renderer initialization errors
   */
  handleRendererError(error: Error): void {
    console.error('Renderer initialization error:', error);

    if (error.message.includes('WebGL')) {
      this.setFatalError(
        'WebGL is not supported or has been disabled in your browser. Please enable WebGL or use a supported browser.',
      );
    } else {
      this.setFatalError(
        'Failed to initialize 3D renderer. Please refresh the page or try a different browser.',
      );
    }
  }

  /**
   * Handle geometry processing errors
   */
  handleGeometryError(error: Error, countryName?: string): void {
    console.warn(
      `Geometry processing error${countryName ? ` for ${countryName}` : ''}:`,
      error,
    );

    // Geometry errors are usually non-fatal, log and continue
    const message = countryName
      ? `Failed to render ${countryName}. Geographic data may be incomplete.`
      : 'Some geographic features may not display correctly.';

    this.showTemporaryWarning(message);
  }

  /**
   * Check if WebGL is supported
   */
  checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return !!context;
    } catch {
      return false;
    }
  }

  /**
   * Get device capabilities for error prevention
   */
  getDeviceCapabilities(): DeviceCapabilities {
    return {
      webglSupport: this.checkWebGLSupport(),
      memorySize:
        (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4,
      concurrency: navigator.hardwareConcurrency || 2,
      isMobile: /Mobile|Android|iOS/.test(navigator.userAgent),
      isLowEnd: this.isLowEndDevice(),
    };
  }

  /**
   * Setup error prevention measures based on device capabilities
   */
  setupErrorPrevention(renderer: WebGLRenderer): void {
    const capabilities = this.getDeviceCapabilities();

    if (capabilities.isLowEnd) {
      // Reduce quality for low-end devices
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      // Note: antialias must be set during renderer creation, not here
    }

    // Setup context loss handlers
    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('WebGL context lost');
    });
  }

  /**
   * Reset error state (for manual recovery)
   */
  resetErrorState(): void {
    this.hasWebGLError.set(false);
    this.hasDataError.set(false);
    this.isRecovering.set(false);
    this.errorMessage.set(null);
    this.webglRetrySubject.next(0);
    this.dataRetrySubject.next(0);
  }

  /**
   * Get observable for WebGL retry attempts
   */
  getWebGLRetryObservable(): Observable<number> {
    return this.webglRetrySubject.asObservable();
  }

  /**
   * Get observable for data retry attempts
   */
  getDataRetryObservable(): Observable<number> {
    return this.dataRetrySubject.asObservable();
  }

  private async attemptWebGLRecovery(
    onRecover: () => Promise<void>,
  ): Promise<void> {
    const currentRetries = this.webglRetrySubject.value;

    if (currentRetries < this.maxRetryAttempts) {
      try {
        await onRecover();
        this.hasWebGLError.set(false);
        this.isRecovering.set(false);
        this.errorMessage.set(null);
      } catch (error) {
        this.webglRetrySubject.next(currentRetries + 1);
        if (currentRetries + 1 >= this.maxRetryAttempts) {
          this.setFatalError(
            'Unable to restore 3D rendering. Please refresh the page.',
          );
        } else {
          timer(this.retryDelayMs).subscribe(() => {
            this.attemptWebGLRecovery(onRecover);
          });
        }
      }
    }
  }

  private clearDataError(): void {
    this.hasDataError.set(false);
    this.isRecovering.set(false);
    this.errorMessage.set(null);
    this.dataRetrySubject.next(0);
  }

  private setFatalError(message: string): void {
    this.errorMessage.set(message);
    this.isRecovering.set(false);
    console.error('Fatal globe error:', message);
  }

  private showTemporaryWarning(message: string): void {
    this.errorMessage.set(message);
    timer(5000).subscribe(() => {
      if (this.errorMessage() === message) {
        this.errorMessage.set(null);
      }
    });
  }

  private isLowEndDevice(): boolean {
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    const concurrency = navigator.hardwareConcurrency;

    return (
      (memory && memory <= 2) ||
      (concurrency && concurrency <= 2) ||
      /Android.*Chrome\/[3-5]/.test(navigator.userAgent)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Device capability information
 */
export interface DeviceCapabilities {
  webglSupport: boolean;
  memorySize: number;
  concurrency: number;
  isMobile: boolean;
  isLowEnd: boolean;
}
