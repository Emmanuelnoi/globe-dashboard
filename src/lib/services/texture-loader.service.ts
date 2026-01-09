import { Injectable, inject, signal } from '@angular/core';
import {
  Texture,
  TextureLoader,
  SRGBColorSpace,
  LinearSRGBColorSpace,
  CompressedTexture,
  WebGLRenderer,
} from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { LoggerService } from '@/core/services/logger.service';

/**
 * Texture format options
 */
export type TextureFormat = 'ktx2' | 'jpg' | 'png' | 'auto';

/**
 * Texture loading options
 */
export interface TextureLoadOptions {
  format?: TextureFormat;
  colorSpace?: 'srgb' | 'linear';
  generateMipmaps?: boolean;
  flipY?: boolean;
}

/**
 * Texture load result with metadata
 */
export interface TextureLoadResult {
  texture: Texture | CompressedTexture;
  format: TextureFormat;
  compressed: boolean;
  loadTime: number;
}

/**
 * TextureLoaderService
 *
 * Unified texture loading service with KTX2 compression support.
 * Automatically detects and uses compressed textures when available,
 * falling back to standard formats when needed.
 *
 * Features:
 * - KTX2 compressed texture support (30-50% memory reduction)
 * - Automatic format detection and fallback
 * - Basis Universal transcoder integration
 * - Performance tracking
 * - Caching support
 */
@Injectable({
  providedIn: 'root',
})
export class TextureLoaderService {
  private readonly logger = inject(LoggerService);

  // Loaders
  private textureLoader = new TextureLoader();
  private ktx2Loader: KTX2Loader | null = null;
  private ktx2Initialized = false;
  private ktx2Supported = signal<boolean | null>(null);

  // Cache
  private textureCache = new Map<string, Texture | CompressedTexture>();

  // Stats
  private loadStats = {
    ktx2Loads: 0,
    fallbackLoads: 0,
    cacheHits: 0,
    totalBytes: 0,
    totalLoadTime: 0,
  };

  /**
   * Initialize KTX2 loader with WebGL renderer
   * Call this after renderer is created
   */
  initializeKTX2(renderer: WebGLRenderer): void {
    if (this.ktx2Initialized) return;

    try {
      this.ktx2Loader = new KTX2Loader();

      // Set transcoder path - Basis Universal WASM files
      // These need to be copied to public folder or served from CDN
      this.ktx2Loader.setTranscoderPath('/libs/basis/');

      // Detect GPU support
      this.ktx2Loader.detectSupport(renderer);

      this.ktx2Initialized = true;
      this.ktx2Supported.set(true);

      this.logger.debug(
        'KTX2 loader initialized with Basis transcoder',
        'TextureLoaderService',
      );
    } catch (error) {
      this.ktx2Supported.set(false);
      this.logger.warn(
        'KTX2 loader initialization failed, using fallback textures',
        'TextureLoaderService',
        error,
      );
    }
  }

  /**
   * Load a texture with automatic format detection
   *
   * @param basePath Base path without extension (e.g., '/textures/earth')
   * @param options Loading options
   * @returns Promise resolving to texture load result
   */
  async loadTexture(
    basePath: string,
    options: TextureLoadOptions = {},
  ): Promise<TextureLoadResult> {
    const {
      format = 'auto',
      colorSpace = 'srgb',
      generateMipmaps = true,
      flipY = true,
    } = options;

    const startTime = performance.now();

    // Check cache first
    const cacheKey = `${basePath}:${format}:${colorSpace}`;
    const cached = this.textureCache.get(cacheKey);
    if (cached) {
      this.loadStats.cacheHits++;
      return {
        texture: cached,
        format: format === 'auto' ? 'jpg' : format,
        compressed: cached instanceof CompressedTexture,
        loadTime: 0,
      };
    }

    let texture: Texture | CompressedTexture;
    let actualFormat: TextureFormat;
    let compressed = false;

    // Try KTX2 first if auto or explicitly requested
    if (
      (format === 'auto' || format === 'ktx2') &&
      this.ktx2Initialized &&
      this.ktx2Loader
    ) {
      try {
        const ktx2Path = `${basePath}.ktx2`;
        texture = await this.loadKTX2Texture(ktx2Path);
        actualFormat = 'ktx2';
        compressed = true;
        this.loadStats.ktx2Loads++;
      } catch {
        // KTX2 not available, fall back
        if (format === 'ktx2') {
          throw new Error(`KTX2 texture not found: ${basePath}.ktx2`);
        }
        // Auto mode - try fallback
        texture = await this.loadStandardTexture(basePath);
        actualFormat = this.detectFormat(basePath);
        this.loadStats.fallbackLoads++;
      }
    } else {
      // Load standard texture
      texture = await this.loadStandardTexture(basePath);
      actualFormat = format === 'auto' ? this.detectFormat(basePath) : format;
      this.loadStats.fallbackLoads++;
    }

    // Apply options
    texture.colorSpace =
      colorSpace === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace;
    texture.generateMipmaps = generateMipmaps;
    texture.flipY = flipY;
    texture.needsUpdate = true;

    // Cache the texture
    this.textureCache.set(cacheKey, texture);

    const loadTime = performance.now() - startTime;
    this.loadStats.totalLoadTime += loadTime;

    return {
      texture,
      format: actualFormat,
      compressed,
      loadTime,
    };
  }

  /**
   * Load multiple textures in parallel
   */
  async loadTextures(
    paths: Array<{ path: string; options?: TextureLoadOptions }>,
  ): Promise<TextureLoadResult[]> {
    return Promise.all(
      paths.map(({ path, options }) => this.loadTexture(path, options)),
    );
  }

  /**
   * Preload textures for later use
   */
  async preload(paths: string[]): Promise<void> {
    await Promise.all(paths.map((path) => this.loadTexture(path)));
  }

  /**
   * Get loading statistics
   */
  getStats(): typeof this.loadStats {
    return { ...this.loadStats };
  }

  /**
   * Check if KTX2 is supported
   */
  isKTX2Supported(): boolean | null {
    return this.ktx2Supported();
  }

  /**
   * Clear texture cache
   */
  clearCache(): void {
    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearCache();
    this.ktx2Loader?.dispose();
    this.ktx2Loader = null;
    this.ktx2Initialized = false;
  }

  // Private methods

  private loadKTX2Texture(path: string): Promise<CompressedTexture> {
    return new Promise((resolve, reject) => {
      if (!this.ktx2Loader) {
        reject(new Error('KTX2 loader not initialized'));
        return;
      }

      this.ktx2Loader.load(
        path,
        (texture) => resolve(texture),
        undefined,
        (error) => reject(error),
      );
    });
  }

  private loadStandardTexture(basePath: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      // Try different extensions
      const extensions = ['.jpg', '.png', '.jpeg'];

      const tryLoad = (index: number): void => {
        if (index >= extensions.length) {
          // Try the path as-is (might already have extension)
          this.textureLoader.load(
            basePath,
            (texture) => resolve(texture),
            undefined,
            () => reject(new Error(`Texture not found: ${basePath}`)),
          );
          return;
        }

        const fullPath = `${basePath}${extensions[index]}`;
        this.textureLoader.load(
          fullPath,
          (texture) => resolve(texture),
          undefined,
          () => tryLoad(index + 1),
        );
      };

      // Check if basePath already has an extension
      if (/\.(jpg|jpeg|png|webp)$/i.test(basePath)) {
        this.textureLoader.load(
          basePath,
          (texture) => resolve(texture),
          undefined,
          (error) => reject(error),
        );
      } else {
        tryLoad(0);
      }
    });
  }

  private detectFormat(path: string): TextureFormat {
    if (path.endsWith('.ktx2')) return 'ktx2';
    if (path.endsWith('.png')) return 'png';
    return 'jpg';
  }
}
