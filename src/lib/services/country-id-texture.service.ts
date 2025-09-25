import { Injectable, signal } from '@angular/core';
import {
  Texture,
  CanvasTexture,
  NearestFilter,
  RGBAFormat,
  ClampToEdgeWrapping,
} from 'three';

/**
 * Country lookup data interface
 */
export interface CountryLookupData {
  metadata: {
    generatedAt: string;
    totalCountries: number;
    encoding: string;
    format: string;
  };
  countries: Record<
    string,
    {
      name: string;
      index: number;
      encodedColor: {
        r: number;
        g: number;
        b: number;
        hex: string;
        css: string;
      };
      properties: {
        iso_a3?: string;
        name_long?: string;
        continent?: string;
        region?: string;
        subregion?: string;
      };
    }
  >;
}

/**
 * Service for managing GPU textures for country selection
 * Provides texture-based ID mapping for instant country selection
 */
@Injectable({
  providedIn: 'root',
})
export class CountryIdTextureService {
  // Texture dimensions
  private readonly defaultResolution = { width: 2048, height: 1024 };
  private readonly mobileResolution = { width: 1024, height: 512 };

  // Texture instances
  private countryIdTexture?: Texture;
  private selectionMaskTexture?: CanvasTexture;
  private selectionMaskCanvas?: HTMLCanvasElement;
  private selectionMaskContext?: CanvasRenderingContext2D;

  // Data
  private countryLookup?: CountryLookupData;
  private indexToIdMap: Map<number, string> = new Map();
  private idToDataMap: Map<string, CountryLookupData['countries'][string]> =
    new Map();

  // State signals
  public readonly isLoaded = signal(false);
  public readonly isLoading = signal(false);
  public readonly loadError = signal<string | null>(null);
  public readonly selectedCountries = signal<Set<string>>(new Set());

  // Performance settings
  private readonly useHighResolution: boolean;

  constructor() {
    // Determine resolution based on device capabilities
    this.useHighResolution = this.detectDeviceCapabilities();
  }

  /**
   * Load country ID assets and initialize textures
   */
  async loadCountryIdAssets(): Promise<void> {
    if (this.isLoaded() || this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      // Load assets in parallel
      const [idMapImage, lookupData] = await Promise.all([
        this.loadCountryIdTexture(),
        this.loadCountryLookupData(),
      ]);

      // Store lookup data and create mappings
      this.countryLookup = lookupData;
      this.buildLookupMaps();

      // Create selection mask canvas
      this.createSelectionMask(idMapImage.width, idMapImage.height);

      console.log(
        `✅ Country ID textures loaded: ${Object.keys(lookupData.countries).length} countries`,
      );
      this.isLoaded.set(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error loading country ID assets';
      console.error('❌ Failed to load country ID assets:', error);
      this.loadError.set(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Update selection mask with new country selections
   */
  updateSelectionMask(selectedIds: Set<string>): void {
    if (!this.selectionMaskContext || !this.countryLookup) {
      console.warn('Selection mask not initialized');
      return;
    }

    const ctx = this.selectionMaskContext;
    const canvas = this.selectionMaskCanvas!;

    // Clear previous selection
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (selectedIds.size === 0) {
      this.updateMaskTexture();
      return;
    }

    // Use bitmap approach for now - paint white pixels for selected countries
    // This is a placeholder - in production, you'd paint actual country polygons
    this.paintSelectionMaskBitmap(selectedIds);

    this.updateMaskTexture();
    this.selectedCountries.set(new Set(selectedIds));
  }

  /**
   * Get country ID from RGB color values
   */
  decodeCountryId(r: number, g: number, b: number): string | null {
    const index = (r << 16) | (g << 8) | b;
    return this.indexToIdMap.get(index) || null;
  }

  /**
   * Get country data by ID
   */
  getCountryData(
    countryId: string,
  ): CountryLookupData['countries'][string] | null {
    return this.idToDataMap.get(countryId) || null;
  }

  /**
   * Get texture instances
   */
  getCountryIdTexture(): Texture | undefined {
    return this.countryIdTexture;
  }

  getSelectionMaskTexture(): CanvasTexture | undefined {
    return this.selectionMaskTexture;
  }

  /**
   * Get resolution for current device
   */
  getResolution(): { width: number; height: number } {
    return this.useHighResolution
      ? this.defaultResolution
      : this.mobileResolution;
  }

  /**
   * Batch selection updates for performance
   */
  batchUpdateSelection(
    updates: Array<{ countryId: string; selected: boolean }>,
  ): void {
    const currentSelection = new Set(this.selectedCountries());

    for (const update of updates) {
      if (update.selected) {
        currentSelection.add(update.countryId);
      } else {
        currentSelection.delete(update.countryId);
      }
    }

    this.updateSelectionMask(currentSelection);
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.updateSelectionMask(new Set());
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.countryIdTexture?.dispose();
    this.selectionMaskTexture?.dispose();
    this.selectionMaskCanvas = undefined;
    this.selectionMaskContext = undefined;
    this.indexToIdMap.clear();
    this.idToDataMap.clear();

    this.isLoaded.set(false);
    this.selectedCountries.set(new Set());
  }

  private async loadCountryIdTexture(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';

      image.onload = () => {
        try {
          // Create THREE.js texture with precise settings
          this.countryIdTexture = new Texture(image);
          this.countryIdTexture.format = RGBAFormat;
          this.countryIdTexture.minFilter = NearestFilter;
          this.countryIdTexture.magFilter = NearestFilter;
          this.countryIdTexture.wrapS = ClampToEdgeWrapping;
          this.countryIdTexture.wrapT = ClampToEdgeWrapping;
          this.countryIdTexture.generateMipmaps = false;
          this.countryIdTexture.needsUpdate = true;

          resolve(image);
        } catch (error) {
          reject(new Error(`Failed to create country ID texture: ${error}`));
        }
      };

      image.onerror = () => {
        reject(new Error('Failed to load country ID map image'));
      };

      // Load the generated country ID map
      image.src = '/assets/geo/country-id-map.png';
    });
  }

  private async loadCountryLookupData(): Promise<CountryLookupData> {
    try {
      const response = await fetch('/assets/geo/country-id-lookup.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate data structure
      if (!data.countries || typeof data.countries !== 'object') {
        throw new Error('Invalid lookup data format');
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to load country lookup data: ${error}`);
    }
  }

  private buildLookupMaps(): void {
    if (!this.countryLookup) return;

    this.indexToIdMap.clear();
    this.idToDataMap.clear();

    for (const [countryId, data] of Object.entries(
      this.countryLookup.countries,
    )) {
      this.indexToIdMap.set(data.index, countryId);
      this.idToDataMap.set(countryId, data);
    }
  }

  private createSelectionMask(width: number, height: number): void {
    // Create offscreen canvas for selection mask
    this.selectionMaskCanvas = document.createElement('canvas');
    this.selectionMaskCanvas.width = width;
    this.selectionMaskCanvas.height = height;

    const context = this.selectionMaskCanvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create 2D context for selection mask');
    }
    this.selectionMaskContext = context;

    // Create THREE.js texture from canvas
    this.selectionMaskTexture = new CanvasTexture(this.selectionMaskCanvas);
    this.selectionMaskTexture.format = RGBAFormat;
    this.selectionMaskTexture.minFilter = NearestFilter;
    this.selectionMaskTexture.magFilter = NearestFilter;
    this.selectionMaskTexture.wrapS = ClampToEdgeWrapping;
    this.selectionMaskTexture.wrapT = ClampToEdgeWrapping;
    this.selectionMaskTexture.generateMipmaps = false;
  }

  private paintSelectionMaskBitmap(selectedIds: Set<string>): void {
    if (
      !this.selectionMaskContext ||
      !this.countryIdTexture ||
      !this.countryLookup
    ) {
      return;
    }

    const ctx = this.selectionMaskContext;
    const canvas = this.selectionMaskCanvas!;

    // Get the source country ID texture data
    const sourceCanvas = document.createElement('canvas');
    const sourceCtx = sourceCanvas.getContext('2d')!;
    sourceCanvas.width = canvas.width;
    sourceCanvas.height = canvas.height;

    // Draw the country ID texture to get pixel data
    if (this.countryIdTexture.image) {
      sourceCtx.drawImage(
        this.countryIdTexture.image,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const imageData = sourceCtx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const pixels = imageData.data;

      // Create selection mask data
      const maskData = ctx.createImageData(canvas.width, canvas.height);
      const maskPixels = maskData.data;

      // Iterate through pixels and paint selection mask
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const countryId = this.decodeCountryId(r, g, b);

        if (countryId && selectedIds.has(countryId)) {
          // Paint white for selected countries
          maskPixels[i] = 255; // R
          maskPixels[i + 1] = 255; // G
          maskPixels[i + 2] = 255; // B
          maskPixels[i + 3] = 255; // A
        } else {
          // Paint transparent for non-selected
          maskPixels[i] = 0;
          maskPixels[i + 1] = 0;
          maskPixels[i + 2] = 0;
          maskPixels[i + 3] = 0;
        }
      }

      ctx.putImageData(maskData, 0, 0);
    }
  }

  private updateMaskTexture(): void {
    if (this.selectionMaskTexture) {
      this.selectionMaskTexture.needsUpdate = true;
    }
  }

  private detectDeviceCapabilities(): boolean {
    // Check device memory and hardware
    const deviceMemory =
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    const isMobile = /Mobile|Android|iOS/.test(navigator.userAgent);

    // Use high resolution for capable devices
    return deviceMemory >= 4 && hardwareConcurrency >= 4 && !isMobile;
  }
}
