import { Injectable } from '@angular/core';
import { Raycaster, Vector2, Camera, Group, Object3D } from 'three';

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
  private raycaster = new Raycaster();

  /**
   * Detect country hover based on TopoJSON mesh structure
   * This service understands the specific mesh hierarchy created by geojson.utils.ts
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

      // Strategy 1: Direct intersection with selection meshes
      const selectionMeshResult = this.findSelectionMeshes(countriesGroup);
      if (selectionMeshResult.length > 0) {
        const intersects = this.raycaster.intersectObjects(
          selectionMeshResult,
          false,
        );

        for (const intersect of intersects) {
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

      // Strategy 2: Traverse hierarchy to find selection meshes
      const allObjects = this.collectAllObjects(countriesGroup);
      const allSelectionMeshes = allObjects.filter(
        (obj) => obj.name && obj.name.startsWith('selection-mesh-'),
      );

      if (allSelectionMeshes.length > 0) {
        const intersects = this.raycaster.intersectObjects(
          allSelectionMeshes,
          false,
        );

        for (const intersect of intersects) {
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

      // Strategy 3: Check all intersections and filter for countries
      const allIntersects = this.raycaster.intersectObjects(
        countriesGroup.children,
        true,
      );

      for (const intersect of allIntersects) {
        // Skip unified borders
        if (
          intersect.object.name === 'unified-borders' ||
          intersect.object.userData?.['isUnifiedBorder']
        ) {
          continue;
        }

        // Check if this is a selection mesh
        if (
          intersect.object.name &&
          intersect.object.name.startsWith('selection-mesh-')
        ) {
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

        // Check userData for country information
        const countryInfo = this.extractCountryInfoFromUserData(
          intersect.object,
        );
        if (countryInfo) {
          return {
            countryName: countryInfo.name,
            countryId: countryInfo.id,
            meshName: intersect.object.name,
            object: intersect.object,
          };
        }
      }

      return null;
    } catch (error) {
      console.warn('❌ Country hover detection failed:', error);
      return null;
    }
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

    console.log(
      `🔍 Found ${selectionMeshes.length} selection meshes for raycasting`,
    );
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

    console.log(
      `🎯 Extracted country name: "${countryName}" -> "${formattedName}"`,
    );
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
    // Handle common cases
    const nameMap: Record<string, string> = {
      UnitedStates: 'United States',
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
    };

    // Check if we have a specific mapping
    if (nameMap[meshCountryName]) {
      return nameMap[meshCountryName];
    }

    // Convert camelCase to spaced format
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
