import { Injectable, inject } from '@angular/core';
import { Raycaster, Vector2, Vector3, Camera, Group, Object3D } from 'three';
import { LoggerService } from './logger.service';

export interface CountryHoverResult {
  countryName: string;
  countryId?: string;
  meshName: string;
  object: Object3D;
}

@Injectable({
  providedIn: 'root',
})
export class CountryHoverService {
  private readonly logger = inject(LoggerService);
  private raycaster = new Raycaster();

  // Performance optimization: cache selection meshes to avoid repeated traversal
  private cachedSelectionMeshes: Object3D[] | null = null;
  private cachedCountriesGroup: Group | null = null;

  /**
   * Detect country hover based on TopoJSON mesh structure
   * This service understands the specific mesh hierarchy created by geojson.utils.ts
   * Only detects countries on the front-facing hemisphere (visible side of globe)
   *
   * Performance optimized: Uses cached selection meshes for O(1) lookup
   */
  detectCountryHover(
    mousePosition: { x: number; y: number },
    camera: Camera,
    countriesGroup: Group,
  ): CountryHoverResult | null {
    try {
      // Setup raycaster
      const mouseVector = new Vector2(mousePosition.x, mousePosition.y);
      this.raycaster.setFromCamera(mouseVector, camera);

      // Build cache if needed (only on first call or after invalidation)
      if (
        !this.cachedSelectionMeshes ||
        this.cachedCountriesGroup !== countriesGroup
      ) {
        this.buildSelectionMeshCache(countriesGroup);
      }

      // Single-pass raycasting against cached meshes (optimized)
      if (this.cachedSelectionMeshes && this.cachedSelectionMeshes.length > 0) {
        const intersects = this.raycaster.intersectObjects(
          this.cachedSelectionMeshes,
          false,
        );

        for (const intersect of intersects) {
          // Check if this intersection is on the front-facing side of the globe
          // This prevents hovering over countries through the back of the sphere
          if (!this.isPointFrontFacing(intersect.point, camera.position)) {
            continue; // Skip back-facing countries
          }

          const countryName = this.extractCountryNameFromSelectionMesh(
            intersect.object,
          );
          if (countryName) {
            return {
              countryName,
              meshName: intersect.object.name,
              object: intersect.object,
            };
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(
        'Country hover detection failed',
        'CountryHoverService',
        error,
      );
      return null;
    }
  }

  /**
   * Check if a point on the globe is facing the camera (front hemisphere)
   * Uses dot product: positive = front-facing, negative = back-facing
   */
  private isPointFrontFacing(point: Vector3, cameraPosition: Vector3): boolean {
    // Globe is centered at origin (0, 0, 0)
    // Vector from globe center to the intersection point (normalized)
    const pointDirection = point.clone().normalize();

    // Vector from globe center to camera position (normalized)
    const cameraDirection = cameraPosition.clone().normalize();

    // Dot product > 0 means the point is on the same hemisphere as the camera
    return pointDirection.dot(cameraDirection) > 0;
  }

  /**
   * Build cache of selection meshes for fast raycasting
   * Called once on first hover, then reused
   */
  private buildSelectionMeshCache(countriesGroup: Group): void {
    this.cachedSelectionMeshes = [];
    this.cachedCountriesGroup = countriesGroup;

    countriesGroup.traverse((child) => {
      if (child.name && child.name.startsWith('selection-mesh-')) {
        this.cachedSelectionMeshes!.push(child);
      }
    });

    // this.logger.debug(
    //   `Cached ${this.cachedSelectionMeshes.length} selection meshes for hover detection`,
    //   'CountryHoverService',
    // );
  }

  /**
   * Invalidate the selection mesh cache
   * Call this when countries are added/removed from the scene
   */
  invalidateCache(): void {
    this.cachedSelectionMeshes = null;
    this.cachedCountriesGroup = null;
  }

  /**
   * Find all selection meshes in the countries group
   */
  private findSelectionMeshes(countriesGroup: Group): Object3D[] {
    const selectionMeshes: Object3D[] = [];

    // Look for country-selection-meshes group
    const selectionGroup = countriesGroup.children.find(
      (child) => child.name === 'country-selection-meshes',
    ) as Group;

    if (selectionGroup) {
      // Collect all meshes from the selection group
      selectionGroup.traverse((child) => {
        if (child.name && child.name.startsWith('selection-mesh-')) {
          selectionMeshes.push(child);
        }
      });
    } else {
      // Fallback: traverse entire countries group
      countriesGroup.traverse((child) => {
        if (child.name && child.name.startsWith('selection-mesh-')) {
          selectionMeshes.push(child);
        }
      });
    }

    // this.logger.debug(
    //   `Found ${selectionMeshes.length} selection meshes for raycasting`,
    //   'CountryHoverService',
    // );
    return selectionMeshes;
  }

  /**
   * Collect all objects in the group hierarchy
   */
  private collectAllObjects(group: Group): Object3D[] {
    const objects: Object3D[] = [];
    group.traverse((child) => {
      objects.push(child);
    });
    return objects;
  }

  /**
   * Extract country name from selection mesh name
   * Selection mesh names follow pattern: "selection-mesh-{CountryName}" or "selection-mesh-{CountryName}_{index}"
   */
  private extractCountryNameFromSelectionMesh(object: Object3D): string | null {
    if (!object.name || !object.name.startsWith('selection-mesh-')) {
      return null;
    }

    // Extract country name from mesh name
    // Format: "selection-mesh-UnitedStates_0" -> "UnitedStates"
    // Format: "selection-mesh-France" -> "France"
    const meshName = object.name.replace('selection-mesh-', '');

    // Remove index suffix if present (e.g., "_0", "_1")
    const countryName = meshName.split('_')[0];

    // Convert camelCase or handle special cases
    const formattedName = this.formatCountryName(countryName);

    // this.logger.debug(
    //   `Extracted country name: "${countryName}" -> "${formattedName}"`,
    //   'CountryHoverService',
    // );
    return formattedName;
  }

  /**
   * Extract country information from object userData
   */
  private extractCountryInfoFromUserData(
    object: Object3D,
  ): { name: string; id?: string } | null {
    // Check current object
    if (object.userData?.['name'] && object.userData?.['isCountry']) {
      return {
        name: object.userData['name'],
        id: object.userData['countryId'] || object.userData['topoId'],
      };
    }

    // Check parent objects
    let current = object.parent;
    while (current) {
      if (current.userData?.['name'] && current.userData?.['isCountry']) {
        return {
          name: current.userData['name'],
          id: current.userData['countryId'] || current.userData['topoId'],
        };
      }
      current = current.parent;
    }

    return null;
  }

  /**
   * Format country name for display
   */
  private formatCountryName(meshCountryName: string): string {
    // If the name already has spaces, it's from TopoJSON and already formatted
    // Don't apply camelCase conversion - just return it as-is
    if (meshCountryName.includes(' ')) {
      return meshCountryName;
    }

    // Handle common cases with comprehensive mapping for problematic countries
    const nameMap: Record<string, string> = {
      UnitedStates: 'United States',
      UnitedStatesofAmerica: 'United States of America',
      USA: 'United States',
      America: 'United States',
      US: 'United States',
      UnitedKingdom: 'United Kingdom',
      NewZealand: 'New Zealand',
      SouthAfrica: 'South Africa',
      SaudiArabia: 'Saudi Arabia',
      CostaRica: 'Costa Rica',
      PuertoRico: 'Puerto Rico',
      SouthKorea: 'South Korea',
      NorthKorea: 'North Korea',
      WestBankandGaza: 'West Bank and Gaza',
      BosniaandHerzegovina: 'Bosnia and Herzegovina',
      TrinidadandTobago: 'Trinidad and Tobago',
      PapuaNewGuinea: 'Papua New Guinea',
      SolomonIslands: 'Solomon Islands',
      CentralAfricanRepublic: 'Central African Republic',
      DominicanRepublic: 'Dominican Republic',
      EquatorialGuinea: 'Equatorial Guinea',
      ElSalvador: 'El Salvador',
      CzechRepublic: 'Czech Republic',
      // Mexico variants
      Mexico: 'Mexico',
      UnitedMexicanStates: 'Mexico',
      Estados: 'Mexico',
      MexicanRepublic: 'Mexico',
    };

    // Check if we have a specific mapping
    if (nameMap[meshCountryName]) {
      return nameMap[meshCountryName];
    }

    // Convert camelCase to spaced format (only for names without spaces)
    const spacedName = meshCountryName.replace(/([A-Z])/g, ' $1').trim();

    // Handle special cases like "U S A" -> "USA"
    const cleanedName = spacedName
      .replace(/\bU S A\b/, 'USA')
      .replace(/\bU K\b/, 'UK')
      .replace(/\bU A E\b/, 'UAE');

    return cleanedName;
  }

  /**
   * Get debug information about the countries group structure
   */
  getDebugInfo(countriesGroup: Group): {
    groupName: string;
    childrenCount: number;
    children: Array<{
      name: string;
      type: string;
      childrenCount: number;
    }>;
    selectionMeshes: string[];
    unifiedBorders: string[];
  } {
    const info = {
      groupName: countriesGroup.name,
      childrenCount: countriesGroup.children.length,
      children: countriesGroup.children.map((child) => ({
        name: child.name,
        type: child.type,
        childrenCount: child.children?.length || 0,
      })),
      selectionMeshes: [] as string[],
      unifiedBorders: [] as string[],
    };

    countriesGroup.traverse((child) => {
      if (child.name) {
        if (child.name.startsWith('selection-mesh-')) {
          info.selectionMeshes.push(child.name);
        } else if (
          child.name === 'unified-borders' ||
          child.userData?.['isUnifiedBorder']
        ) {
          info.unifiedBorders.push(child.name);
        }
      }
    });

    return info;
  }
}
