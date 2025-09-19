import { Injectable, OnDestroy } from '@angular/core';
import {
  Material,
  Mesh,
  BufferGeometry,
  Texture,
  WebGLRenderer,
  Scene,
  Group,
  Object3D,
  LineSegments,
} from 'three';

/**
 * Service for managing Three.js memory and preventing memory leaks
 */
@Injectable({
  providedIn: 'root',
})
export class MemoryManagementService implements OnDestroy {
  private disposables: Set<Disposable> = new Set();
  private tracked3DObjects: Set<Object3D> = new Set();

  /**
   * Register a disposable resource for automatic cleanup
   */
  track<T extends Disposable>(resource: T): T {
    this.disposables.add(resource);
    return resource;
  }

  /**
   * Register a 3D object for automatic cleanup
   */
  track3DObject<T extends Object3D>(object: T): T {
    this.tracked3DObjects.add(object);
    return object;
  }

  /**
   * Dispose all materials in a mesh or group recursively
   */
  disposeMaterials(object: Object3D): void {
    object.traverse((child) => {
      if (child instanceof Mesh || child instanceof LineSegments) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) =>
              this.disposeMaterial(material),
            );
          } else {
            this.disposeMaterial(child.material);
          }
        }
      }
    });
  }

  /**
   * Dispose all geometries in a mesh or group recursively
   */
  disposeGeometries(object: Object3D): void {
    object.traverse((child) => {
      if (child instanceof Mesh || child instanceof LineSegments) {
        if (child.geometry) {
          this.disposeGeometry(child.geometry);
        }
      }
    });
  }

  /**
   * Dispose all textures in materials recursively
   */
  disposeTextures(object: Object3D): void {
    object.traverse((child) => {
      if (child instanceof Mesh || child instanceof LineSegments) {
        if (child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          materials.forEach((material) => {
            this.extractAndDisposeTextures(material);
          });
        }
      }
    });
  }

  /**
   * Complete cleanup of a 3D object
   */
  disposeObject3D(object: Object3D): void {
    // Clean up materials
    this.disposeMaterials(object);

    // Clean up geometries
    this.disposeGeometries(object);

    // Clean up textures
    this.disposeTextures(object);

    // Remove from parent
    if (object.parent) {
      object.parent.remove(object);
    }

    // Clear children
    while (object.children.length > 0) {
      this.disposeObject3D(object.children[0]);
    }

    // Remove from tracking
    this.tracked3DObjects.delete(object);
  }

  /**
   * Clean up WebGL renderer resources
   */
  disposeRenderer(renderer: WebGLRenderer): void {
    // Force context loss to free GPU memory
    const gl = renderer.getContext();
    if (gl && gl.getExtension('WEBGL_lose_context')) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }

    // Dispose renderer
    renderer.dispose();

    // Clear caches
    renderer.info.memory.geometries = 0;
    renderer.info.memory.textures = 0;
  }

  /**
   * Clean up scene and all its contents
   */
  disposeScene(scene: Scene): void {
    while (scene.children.length > 0) {
      this.disposeObject3D(scene.children[0]);
    }
    scene.clear();
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(renderer?: WebGLRenderer): MemoryStats {
    const stats: MemoryStats = {
      trackedDisposables: this.disposables.size,
      tracked3DObjects: this.tracked3DObjects.size,
      webglInfo: renderer
        ? {
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
            drawCalls: renderer.info.render.calls,
          }
        : undefined,
    };

    return stats;
  }

  /**
   * Force garbage collection if available (development only)
   */
  forceGarbageCollection(): void {
    if (typeof window !== 'undefined') {
      const windowWithGc = window as Window & { gc?: () => void };
      if (windowWithGc.gc) {
        windowWithGc.gc();
      }
    }
  }

  /**
   * Cleanup all tracked resources
   */
  disposeAll(): void {
    // Dispose all tracked 3D objects
    this.tracked3DObjects.forEach((object) => {
      this.disposeObject3D(object);
    });
    this.tracked3DObjects.clear();

    // Dispose all other tracked disposables
    this.disposables.forEach((disposable) => {
      try {
        disposable.dispose();
      } catch (error) {
        console.warn('Error disposing resource:', error);
      }
    });
    this.disposables.clear();
  }

  ngOnDestroy(): void {
    this.disposeAll();
  }

  private disposeMaterial(material: Material): void {
    try {
      material.dispose();
    } catch (error) {
      console.warn('Error disposing material:', error);
    }
  }

  private disposeGeometry(geometry: BufferGeometry): void {
    try {
      geometry.dispose();
    } catch (error) {
      console.warn('Error disposing geometry:', error);
    }
  }

  private extractAndDisposeTextures(material: Material): void {
    // Check for common texture properties
    const textureProperties = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'bumpMap',
      'displacementMap',
      'alphaMap',
      'lightMap',
      'envMap',
    ];

    textureProperties.forEach((prop) => {
      // Cast material to unknown first, then to Record to avoid direct type conflict
      const materialAsRecord = material as unknown as Record<string, unknown>;
      const texture = materialAsRecord[prop];
      if (
        texture &&
        typeof texture === 'object' &&
        texture !== null &&
        'dispose' in texture &&
        typeof texture.dispose === 'function'
      ) {
        try {
          (texture as { dispose: () => void }).dispose();
        } catch (error) {
          console.warn(`Error disposing texture ${prop}:`, error);
        }
      }
    });
  }
}

/**
 * Interface for disposable resources
 */
interface Disposable {
  dispose(): void;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  trackedDisposables: number;
  tracked3DObjects: number;
  webglInfo?: {
    geometries: number;
    textures: number;
    drawCalls: number;
  };
}
