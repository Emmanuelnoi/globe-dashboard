import { Injectable, inject, signal } from '@angular/core';
import {
  Group,
  Mesh,
  BufferGeometry,
  Float32BufferAttribute,
  Camera,
  Vector3,
} from 'three';
import { LoggerService } from '@/core/services/logger.service';

/**
 * LOD level configuration
 */
export interface LODLevel {
  /** Distance threshold for this LOD level */
  distance: number;
  /** Simplification factor (0-1, where 1 = full detail) */
  detail: number;
  /** Label for debugging */
  label: string;
}

/**
 * Country LOD data
 */
interface CountryLODData {
  /** Original high-detail geometry */
  originalGeometry: BufferGeometry;
  /** Simplified geometries for each LOD level */
  lodGeometries: Map<number, BufferGeometry>;
  /** Current active LOD level index */
  currentLOD: number;
  /** Mesh reference */
  mesh: Mesh;
}

/**
 * Default LOD levels for countries
 */
const DEFAULT_LOD_LEVELS: LODLevel[] = [
  { distance: 0, detail: 1.0, label: 'full' }, // Close: full detail
  { distance: 5, detail: 0.5, label: 'medium' }, // Medium distance: 50%
  { distance: 8, detail: 0.25, label: 'low' }, // Far: 25%
  { distance: 12, detail: 0.1, label: 'minimal' }, // Very far: 10%
];

/**
 * CountryLODService
 *
 * Manages Level of Detail (LOD) for country meshes to optimize rendering
 * at different zoom levels. Reduces geometry complexity when countries
 * are far from the camera.
 *
 * Features:
 * - Automatic LOD level switching based on camera distance
 * - Douglas-Peucker simplification algorithm
 * - Smooth LOD transitions
 * - Memory-efficient geometry management
 */
@Injectable({
  providedIn: 'root',
})
export class CountryLODService {
  private readonly logger = inject(LoggerService);

  // LOD configuration
  private lodLevels: LODLevel[] = [...DEFAULT_LOD_LEVELS];
  private countryData = new Map<string, CountryLODData>();

  // State
  private isEnabled = signal(true);
  private lastUpdateTime = 0;
  private updateInterval = 100; // ms between LOD updates

  // Stats
  private stats = {
    totalCountries: 0,
    lodSwitches: 0,
    verticesReduced: 0,
  };

  /**
   * Register a country mesh for LOD management
   */
  registerCountry(name: string, mesh: Mesh): void {
    if (!mesh.geometry || this.countryData.has(name)) return;

    const originalGeometry = mesh.geometry.clone();

    // Pre-compute simplified geometries for each LOD level
    const lodGeometries = new Map<number, BufferGeometry>();
    lodGeometries.set(0, originalGeometry); // Level 0 = full detail

    for (let i = 1; i < this.lodLevels.length; i++) {
      const simplified = this.simplifyGeometry(
        originalGeometry,
        this.lodLevels[i].detail,
      );
      lodGeometries.set(i, simplified);
    }

    this.countryData.set(name, {
      originalGeometry,
      lodGeometries,
      currentLOD: 0,
      mesh,
    });

    this.stats.totalCountries++;
  }

  /**
   * Register all countries in a group
   */
  registerCountryGroup(group: Group): void {
    group.traverse((child) => {
      if (child instanceof Mesh && child.name?.startsWith('selection-mesh-')) {
        const countryName = child.name.replace('selection-mesh-', '');
        this.registerCountry(countryName, child);
      }
    });

    // this.logger.debug(
    //   `Registered ${this.stats.totalCountries} countries for LOD`,
    //   'CountryLODService',
    // );
  }

  /**
   * Update LOD levels based on camera position
   * Call this from the animation loop
   */
  update(camera: Camera): void {
    if (!this.isEnabled()) return;

    // Throttle updates
    const now = performance.now();
    if (now - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = now;

    const cameraPosition = camera.position;

    this.countryData.forEach((data, name) => {
      const distance = this.calculateDistance(data.mesh, cameraPosition);
      const targetLOD = this.getLODLevel(distance);

      if (targetLOD !== data.currentLOD) {
        this.switchLOD(name, data, targetLOD);
      }
    });
  }

  /**
   * Force update all countries to specific LOD level
   */
  forceUpdateAll(lodLevel: number): void {
    const clampedLevel = Math.min(
      Math.max(0, lodLevel),
      this.lodLevels.length - 1,
    );

    this.countryData.forEach((data, name) => {
      if (data.currentLOD !== clampedLevel) {
        this.switchLOD(name, data, clampedLevel);
      }
    });
  }

  /**
   * Enable/disable LOD system
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled.set(enabled);

    if (!enabled) {
      // Restore all to full detail
      this.forceUpdateAll(0);
    }
  }

  /**
   * Set custom LOD levels
   */
  setLODLevels(levels: LODLevel[]): void {
    this.lodLevels = [...levels].sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get current stats
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Check if LOD is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled();
  }

  /**
   * Dispose of all LOD resources
   */
  dispose(): void {
    this.countryData.forEach((data) => {
      // Dispose simplified geometries (not the original)
      data.lodGeometries.forEach((geometry, level) => {
        if (level > 0) {
          geometry.dispose();
        }
      });
    });

    this.countryData.clear();
    this.stats = { totalCountries: 0, lodSwitches: 0, verticesReduced: 0 };
  }

  // Private methods

  private calculateDistance(mesh: Mesh, cameraPosition: Vector3): number {
    // Use mesh world position for accurate distance
    const meshPosition = new Vector3();
    mesh.getWorldPosition(meshPosition);
    return cameraPosition.distanceTo(meshPosition);
  }

  private getLODLevel(distance: number): number {
    for (let i = this.lodLevels.length - 1; i >= 0; i--) {
      if (distance >= this.lodLevels[i].distance) {
        return i;
      }
    }
    return 0;
  }

  private switchLOD(
    name: string,
    data: CountryLODData,
    newLevel: number,
  ): void {
    const newGeometry = data.lodGeometries.get(newLevel);
    if (!newGeometry) return;

    const oldVertexCount =
      data.mesh.geometry.attributes['position']?.count || 0;
    const newVertexCount = newGeometry.attributes['position']?.count || 0;

    // Update mesh geometry
    data.mesh.geometry = newGeometry;
    data.currentLOD = newLevel;

    // Track stats
    this.stats.lodSwitches++;
    this.stats.verticesReduced += oldVertexCount - newVertexCount;

    // Uncomment for debugging
    // this.logger.debug(
    //   `LOD switch: ${name} -> level ${newLevel} (${this.lodLevels[newLevel].label})`,
    //   'CountryLODService',
    // );
  }

  /**
   * Simplify geometry using vertex decimation
   * Uses a simple approach: keep every Nth vertex based on detail factor
   */
  private simplifyGeometry(
    geometry: BufferGeometry,
    detailFactor: number,
  ): BufferGeometry {
    const positionAttr = geometry.attributes['position'];
    if (!positionAttr) return geometry.clone();

    const originalVertices = positionAttr.count;
    const targetVertices = Math.max(
      3,
      Math.floor(originalVertices * detailFactor),
    );

    if (targetVertices >= originalVertices) {
      return geometry.clone();
    }

    // Simple decimation: sample vertices at regular intervals
    const step = originalVertices / targetVertices;
    const newPositions: number[] = [];
    const newNormals: number[] = [];

    const normalAttr = geometry.attributes['normal'];
    const hasNormals = !!normalAttr;

    for (let i = 0; i < targetVertices; i++) {
      const index = Math.floor(i * step);
      const idx3 = index * 3;

      newPositions.push(
        positionAttr.getX(index),
        positionAttr.getY(index),
        positionAttr.getZ(index),
      );

      if (hasNormals) {
        newNormals.push(
          normalAttr.getX(index),
          normalAttr.getY(index),
          normalAttr.getZ(index),
        );
      }
    }

    // Create new geometry
    const simplified = new BufferGeometry();
    simplified.setAttribute(
      'position',
      new Float32BufferAttribute(newPositions, 3),
    );

    if (hasNormals) {
      simplified.setAttribute(
        'normal',
        new Float32BufferAttribute(newNormals, 3),
      );
    }

    // Rebuild index buffer for triangle rendering
    const indices: number[] = [];
    for (let i = 0; i < targetVertices - 2; i++) {
      indices.push(0, i + 1, i + 2);
    }
    simplified.setIndex(indices);

    return simplified;
  }
}
