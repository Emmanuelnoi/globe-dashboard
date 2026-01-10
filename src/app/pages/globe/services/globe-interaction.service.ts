import { Injectable, inject, signal } from '@angular/core';
import {
  Mesh,
  Material,
  Color,
  Object3D,
  Group,
  Raycaster,
  Vector2,
  Vector3,
  PerspectiveCamera,
} from 'three';
import { LoggerService } from '@/core/services/logger.service';
import { CountryDataService } from '@/core/services/country-data.service';
import { CountryHoverService } from '@/core/services/country-hover.service';
import { CountrySelectionService } from '@lib/utils';
import { CountryIdTextureService } from '@lib/services/country-id-texture.service';
import { InteractionModeService } from '@/core/services/interaction-mode';
import { QuizStateService } from '@/features/quiz/services/quiz-state';

/**
 * GlobeInteractionService
 *
 * Manages all country interaction logic for the 3D globe including:
 * - Country selection via raycasting and GPU-based detection
 * - Hover detection and tooltip coordination
 * - Material updates for visual selection feedback
 * - Quiz candidate highlighting (distinct from explore mode)
 * - Comparison table integration and bi-directional sync
 * - Country name normalization and matching
 *
 * This service centralizes all interaction logic to make the globe component
 * cleaner and more maintainable. It handles both explore mode (green selection)
 * and quiz mode (blue selection) with distinct visual styling.
 */
@Injectable({
  providedIn: 'root',
})
export class GlobeInteractionService {
  private logger = inject(LoggerService);
  private countryDataService = inject(CountryDataService);
  private countryHoverService = inject(CountryHoverService);
  private countrySelectionService = inject(CountrySelectionService);
  private countryIdTextureService = inject(CountryIdTextureService);
  private interactionModeService = inject(InteractionModeService);
  private quizStateService = inject(QuizStateService);

  // Quiz candidate state (for quiz mode highlighting)
  private readonly quizCandidate = signal<string | null>(null);

  // Performance optimization: pre-indexed country meshes by name for O(1) lookup
  private countryMeshIndex = new Map<string, Mesh[]>();
  private indexedCountriesGroup: Group | null = null;

  /**
   * Handle country selection from mouse clicks (optimized)
   * Only selects countries on the front-facing hemisphere of the globe
   * @param event Mouse click event
   * @param renderer WebGL renderer for canvas access
   * @param camera Perspective camera for raycasting
   * @param countries Group containing all country meshes
   * @returns Promise resolving to selected country name or null
   */
  async handleCountrySelection(
    event: MouseEvent,
    renderer: { domElement: HTMLCanvasElement },
    camera: PerspectiveCamera,
    countries: Group,
  ): Promise<string | null> {
    event.preventDefault();

    // Early exit if countries not loaded
    if (!countries || countries.children.length === 0) {
      return null;
    }

    // Get mouse coordinates relative to canvas
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to normalized device coordinates (-1 to +1)
    const mouse = {
      x: (x / canvas.width) * 2 - 1,
      y: -(y / canvas.height) * 2 + 1,
    };

    // Use optimized raycasting
    const raycaster = new Raycaster();
    raycaster.near = 0.1;
    raycaster.far = 10; // Limit ray distance
    const mouseVector = new Vector2(mouse.x, mouse.y);
    raycaster.setFromCamera(mouseVector, camera);

    // Optimized intersection testing - only check country meshes
    const intersects = raycaster.intersectObjects(countries.children, true);

    if (intersects.length > 0) {
      // Find first valid country mesh that is front-facing
      let selectedCountryMesh: Mesh | null = null;
      let countryGroup: Object3D | null = null;

      for (const intersect of intersects) {
        const obj = intersect.object;

        // Skip border lines - we want actual country meshes
        if (
          obj.name === 'unified-borders' ||
          obj.userData?.['isUnifiedBorder']
        ) {
          continue;
        }

        // Look for country selection meshes
        if (obj.name.startsWith('selection-mesh-') && obj.type === 'Mesh') {
          // Check if this intersection is on the front-facing side of the globe
          if (!this.isPointFrontFacing(intersect.point, camera)) {
            continue; // Skip back-facing countries
          }

          selectedCountryMesh = obj as Mesh;
          countryGroup = obj.parent;
          break; // Early exit for performance
        }
      }

      if (selectedCountryMesh && countryGroup) {
        const countryData = countryGroup.userData as {
          properties?: { NAME?: string };
          name?: string;
        };
        const countryName =
          countryData?.properties?.NAME ||
          countryData?.name ||
          selectedCountryMesh.name.replace('selection-mesh-', '').split('_')[0];

        return countryName;
      }
    }

    return null;
  }

  /**
   * Check if a point on the globe is facing the camera (front hemisphere)
   * Uses dot product: positive = front-facing, negative = back-facing
   * @param point The intersection point on the globe surface
   * @param camera The camera to check against
   * @returns true if the point is on the camera-facing side
   */
  private isPointFrontFacing(
    point: Vector3,
    camera: PerspectiveCamera,
  ): boolean {
    // Globe is centered at origin (0, 0, 0)
    // Vector from globe center to intersection point (normalized)
    const pointDirection = point.clone().normalize();

    // Vector from globe center to camera position (normalized)
    const cameraDirection = camera.position.clone().normalize();

    // Dot product > 0 means the point is on the same hemisphere as the camera
    return pointDirection.dot(cameraDirection) > 0;
  }

  /**
   * Handle country hover detection for tooltips
   * @param event Mouse move event
   * @param renderer WebGL renderer for canvas access
   * @param camera Perspective camera for raycasting
   * @param countries Group containing all country meshes
   * @returns Country name if hovering over a country, null otherwise
   */
  async handleCountryHover(
    event: MouseEvent,
    renderer: { domElement: HTMLCanvasElement },
    camera: PerspectiveCamera,
    countries: Group,
  ): Promise<string | null> {
    try {
      // Early exit if countries not loaded or in quiz mode
      if (
        !countries ||
        countries.children.length === 0 ||
        this.interactionModeService.isQuizMode()
      ) {
        return null;
      }

      const canvas = renderer.domElement;
      const rect = canvas.getBoundingClientRect();

      // Get mouse coordinates relative to canvas
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert to normalized device coordinates
      const mouse = {
        x: (x / canvas.width) * 2 - 1,
        y: -(y / canvas.height) * 2 + 1,
      };

      // Use the specialized hover service that understands TopoJSON structure
      const hoverResult = this.countryHoverService.detectCountryHover(
        mouse,
        camera,
        countries,
      );

      if (hoverResult) {
        return hoverResult.countryName;
      }

      return null;
    } catch (error) {
      this.logger.warn(
        '⚠️ Error in country hover handler',
        'GlobeInteractionService',
        error,
      );
      return null;
    }
  }

  /**
   * Handle adding country to comparison table from double-click events
   * @param event Mouse double-click event
   * @param renderer WebGL renderer for canvas access
   * @param camera Perspective camera for raycasting
   * @param countries Group containing all country meshes
   * @returns Promise resolving to true if country was added, false otherwise
   */
  async handleCountryAddToComparison(
    event: MouseEvent,
    renderer: { domElement: HTMLCanvasElement },
    camera: PerspectiveCamera,
    countries: Group,
  ): Promise<boolean> {
    event.preventDefault();

    // Early exit if countries not loaded
    if (!countries || countries.children.length === 0) {
      return false;
    }

    // Get country name from hover detection
    const countryResult = await this.detectCountryFromEvent(
      event,
      renderer,
      camera,
      countries,
    );

    if (countryResult?.countryName) {
      const countryName = countryResult.countryName;

      // Add country to comparison table via CountryDataService
      const added = this.countryDataService.addCountryFromGlobe(countryName);

      return added;
    }

    return false;
  }

  /**
   * Detect country from mouse event (shared logic for clicks and double-clicks)
   * @param event Mouse event
   * @param renderer WebGL renderer for canvas access
   * @param camera Perspective camera for raycasting
   * @param countries Group containing all country meshes
   * @returns Object with country name and group, or null
   */
  async detectCountryFromEvent(
    event: MouseEvent,
    renderer: { domElement: HTMLCanvasElement },
    camera: PerspectiveCamera,
    countries: Group,
  ): Promise<{ countryName: string; countryGroup?: Object3D } | null> {
    // Get mouse coordinates relative to canvas
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to normalized device coordinates (-1 to +1)
    const mouse = {
      x: (x / canvas.width) * 2 - 1,
      y: -(y / canvas.height) * 2 + 1,
    };

    // Use country hover service for detection
    const hoverResult = this.countryHoverService.detectCountryHover(
      mouse,
      camera,
      countries,
    );

    if (hoverResult?.countryName) {
      return {
        countryName: hoverResult.countryName,
        countryGroup: hoverResult.object,
      };
    }

    return null;
  }

  /**
   * Build index of country meshes by name for O(1) lookup
   * Called once when countries are loaded, then reused for all selections
   * @param countries Group containing all country meshes
   */
  buildCountryIndex(countries: Group): void {
    if (!countries || this.indexedCountriesGroup === countries) return;

    this.countryMeshIndex.clear();
    this.indexedCountriesGroup = countries;

    countries.traverse((child) => {
      if (
        child.name &&
        child.name.startsWith('selection-mesh-') &&
        child.type === 'Mesh'
      ) {
        const meshName = child.name
          .replace('selection-mesh-', '')
          .split('_')[0];
        const formattedMeshName = this.formatCountryName(meshName);

        // Index by formatted name
        if (!this.countryMeshIndex.has(formattedMeshName)) {
          this.countryMeshIndex.set(formattedMeshName, []);
        }
        this.countryMeshIndex.get(formattedMeshName)!.push(child as Mesh);

        // Also index by raw mesh name for fallback matching
        if (meshName !== formattedMeshName) {
          if (!this.countryMeshIndex.has(meshName)) {
            this.countryMeshIndex.set(meshName, []);
          }
          this.countryMeshIndex.get(meshName)!.push(child as Mesh);
        }
      }
    });

    // Add common aliases for problematic countries
    this.addCountryAliases();
  }

  /**
   * Add aliases for countries with multiple naming conventions
   */
  private addCountryAliases(): void {
    const aliases: Record<string, string[]> = {
      'United States': ['USA', 'US', 'America', 'United States of America'],
      Mexico: ['United Mexican States'],
      'United Kingdom': ['UK', 'Britain', 'Great Britain'],
      Czechia: ['Czech Republic'],
    };

    for (const [canonical, aliasList] of Object.entries(aliases)) {
      const meshes = this.countryMeshIndex.get(canonical);
      if (meshes) {
        for (const alias of aliasList) {
          if (!this.countryMeshIndex.has(alias)) {
            this.countryMeshIndex.set(alias, meshes);
          }
        }
      }
    }
  }

  /**
   * Invalidate the country mesh index
   * Call this when countries are added/removed from the scene
   */
  invalidateIndex(): void {
    this.countryMeshIndex.clear();
    this.indexedCountriesGroup = null;
  }

  /**
   * Apply persistent visual selection to country (for comparison table integration)
   * Performance optimized: Uses pre-built index for O(1) lookup
   * @param countryName Country name to select
   * @param countries Group containing all country meshes
   */
  applyCountrySelection(countryName: string, countries: Group): void {
    if (!countries) return;

    // Build index if not already built
    if (this.indexedCountriesGroup !== countries) {
      this.buildCountryIndex(countries);
    }

    // O(1) lookup using index
    let selectionMeshes = this.countryMeshIndex.get(countryName);

    // Fallback: try normalized name
    if (!selectionMeshes || selectionMeshes.length === 0) {
      const normalizedName =
        this.normalizeCountryNameForDataService(countryName);
      selectionMeshes = this.countryMeshIndex.get(normalizedName);
    }

    // Fallback: try formatted name
    if (!selectionMeshes || selectionMeshes.length === 0) {
      const formattedName = this.formatCountryName(countryName);
      selectionMeshes = this.countryMeshIndex.get(formattedName);
    }

    // Apply selection styling to all found meshes
    if (selectionMeshes) {
      selectionMeshes.forEach((mesh) => {
        this.applySelectionMaterial(mesh);
      });
    }
  }

  /**
   * Reset all country selections (make them invisible)
   * @param countries Group containing all country meshes
   */
  resetCountrySelections(countries: Group): void {
    if (!countries) return;

    // Reset all selection meshes (needed for complete fill reset)
    countries.traverse((child) => {
      if (
        child.name &&
        child.name.startsWith('selection-mesh-') &&
        child.type === 'Mesh'
      ) {
        const material = (child as Mesh).material as Material & {
          color?: Color;
          emissive?: Color;
        };
        if (material) {
          material.transparent = true;
          material.opacity = 0.0; // Completely invisible when not selected
          material.color?.setHex(0x000000); // Black (invisible)
          material.needsUpdate = true;

          if (material.emissive) {
            material.emissive.setHex(0x000000);
          }
        }
      }
    });
  }

  /**
   * Apply quiz candidate highlighting to a country (distinct from explore mode selection)
   * Performance optimized: Uses pre-built index for O(1) lookup
   * @param countryName Country name to highlight
   * @param countries Group containing all country meshes
   */
  applyQuizCandidateHighlight(countryName: string, countries: Group): void {
    if (!countries) return;

    // Clear any previous quiz highlight first
    this.clearQuizCandidateHighlight(countries);

    // Build index if not already built
    if (this.indexedCountriesGroup !== countries) {
      this.buildCountryIndex(countries);
    }

    // O(1) lookup using index
    let selectionMeshes = this.countryMeshIndex.get(countryName);

    // Fallback: try normalized name
    if (!selectionMeshes || selectionMeshes.length === 0) {
      const normalizedName =
        this.normalizeCountryNameForDataService(countryName);
      selectionMeshes = this.countryMeshIndex.get(normalizedName);
    }

    // Fallback: try formatted name
    if (!selectionMeshes || selectionMeshes.length === 0) {
      const formattedName = this.formatCountryName(countryName);
      selectionMeshes = this.countryMeshIndex.get(formattedName);
    }

    // Apply quiz-specific styling with radial offset
    if (selectionMeshes) {
      selectionMeshes.forEach((mesh) => {
        this.applyQuizCandidateSelectionMaterial(mesh);
      });
    }

    // Store the current quiz candidate
    this.quizCandidate.set(countryName);
  }

  /**
   * Clear current quiz candidate highlighting
   * @param countries Group containing all country meshes
   */
  clearQuizCandidateHighlight(countries: Group): void {
    if (!countries || !this.quizCandidate()) return;

    const currentCandidate = this.quizCandidate();

    countries.traverse((child) => {
      if (
        child.name &&
        child.name.startsWith('selection-mesh-') &&
        child.type === 'Mesh'
      ) {
        const meshName = child.name
          .replace('selection-mesh-', '')
          .split('_')[0];

        const formattedMeshName = this.formatCountryName(meshName);

        const isMatch = this.isCountryNameMatch(
          currentCandidate!,
          meshName,
          formattedMeshName,
        );

        if (isMatch) {
          const mesh = child as Mesh;
          const material = mesh.material as Material & {
            transparent?: boolean;
            opacity?: number;
            color?: Color;
            emissive?: Color;
          };

          if (material) {
            material.transparent = true;
            material.opacity = 0.0; // Make invisible
            material.color?.setHex(0x000000); // Black (invisible)
            if (material.emissive) {
              material.emissive.setHex(0x000000);
            }
            material.needsUpdate = true;
          }

          // Reset scale and render order
          mesh.scale.setScalar(1.0);
          mesh.renderOrder = 0;
          mesh.visible = false;
        }
      }
    });

    this.quizCandidate.set(null);
  }

  /**
   * Check if a country is currently selected
   * @param mesh Country mesh to check
   * @returns True if country is selected (has emissive glow)
   */
  isCountrySelected(mesh: Mesh): boolean {
    const material = mesh.material as Material & {
      emissive?: { r: number; g: number; b: number };
    };
    return !!(material.emissive && material.emissive.r > 0);
  }

  /**
   * Check if country ID/name matches
   * @param countryId Country ID or code
   * @param countryName Country name to match against
   * @returns True if they match
   */
  countryMatches(countryId: string, countryName: string): boolean {
    const id1 = countryId.toLowerCase();
    const name1 = countryName.toLowerCase();

    return id1 === name1 || id1.includes(name1) || name1.includes(id1);
  }

  /**
   * Format country name for matching (simplified version of country-hover.service.ts)
   * @param meshCountryName Raw mesh country name
   * @returns Formatted country name
   */
  formatCountryName(meshCountryName: string): string {
    const nameMap: Record<string, string> = {
      UnitedStates: 'United States',
      UnitedStatesofAmerica: 'United States',
      USA: 'United States',
      America: 'United States',
      US: 'United States',
      Mexico: 'Mexico',
      UnitedMexicanStates: 'Mexico',
      Estados: 'Mexico',
      MexicanRepublic: 'Mexico',
    };

    if (nameMap[meshCountryName]) {
      return nameMap[meshCountryName];
    }

    // Convert camelCase to spaced format
    return meshCountryName.replace(/([A-Z])/g, ' $1').trim();
  }

  /**
   * Normalize country name for CountryDataService lookup
   * Converts detected country names to the format expected by the data service
   * @param detectedCountryName Country name from mesh/raycasting
   * @returns Normalized country name for data service
   */
  normalizeCountryNameForDataService(detectedCountryName: string): string {
    // Normalize spaces: trim and replace multiple spaces with single space
    const normalizedName = detectedCountryName.trim().replace(/\s+/g, ' ');

    // Comprehensive country name mappings based on actual dataset and common mesh/data mismatches
    const countryMappings: Record<string, string> = {
      // USA variants
      'United States of America': 'United States',
      UnitedStatesofAmerica: 'United States',
      UnitedStates: 'United States',
      USA: 'United States',
      US: 'United States',
      America: 'United States',

      // Mexico variants
      'United Mexican States': 'Mexico',
      UnitedMexicanStates: 'Mexico',
      Estados: 'Mexico',
      MexicanRepublic: 'Mexico',

      // United Kingdom variants
      UnitedKingdom: 'United Kingdom',
      UK: 'United Kingdom',

      // Czech Republic variants - CRITICAL FIX: Dataset uses "Czechia"
      CzechRepublic: 'Czechia',
      'Czech Republic': 'Czechia',
      CzechoslovakianRepublic: 'Czechia',

      // Multi-word countries that might have spacing issues
      NewZealand: 'New Zealand',
      SouthAfrica: 'South Africa',
      SaudiArabia: 'Saudi Arabia',
      CostaRica: 'Costa Rica',
      PuertoRico: 'Puerto Rico',
      SouthKorea: 'South Korea',
      NorthKorea: 'North Korea',
      SouthSudan: 'South Sudan',
      WestBankandGaza: 'West Bank and Gaza',
      BosniaandHerzegovina: 'Bosnia and Herzegovina',
      TrinidadandTobago: 'Trinidad and Tobago',
      PapuaNewGuinea: 'Papua New Guinea',
      SolomonIslands: 'Solomon Islands',
      CentralAfricanRepublic: 'Central African Republic',
      DominicanRepublic: 'Dominican Republic',
      EquatorialGuinea: 'Equatorial Guinea',
      ElSalvador: 'El Salvador',
      HongKong: 'Hong Kong',
      IvoryCoast: 'Ivory Coast',
      SanMarino: 'San Marino',
      VaticanCity: 'Vatican City',
      CapeVerde: 'Cape Verde',
      SaintLucia: 'Saint Lucia',
      NewCaledonia: 'New Caledonia',

      // Countries with special variations
      UnitedArabEmirates: 'United Arab Emirates',
      RepublicoftheCongo: 'Republic of the Congo',
      DRCongo: 'DR Congo',
      DemocraticRepublicofCongo: 'DR Congo',
      NorthMacedonia: 'North Macedonia',
      GuineaBissau: 'Guinea-Bissau',
      TimorLeste: 'Timor-Leste',
      SierraLeone: 'Sierra Leone',
      BurkinaFaso: 'Burkina Faso',
      MarshallIslands: 'Marshall Islands',
      CookIslands: 'Cook Islands',
      NorthernMarianaIslands: 'Northern Mariana Islands',
      SintMaarten: 'Sint Maarten',

      // Common variations that might appear
      'U S A': 'United States',
      'U K': 'United Kingdom',
      'U A E': 'United Arab Emirates',
    };

    // Check for exact match in mappings (case-insensitive)
    const mappingKey = Object.keys(countryMappings).find(
      (key) => key.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (mappingKey) {
      return countryMappings[mappingKey];
    }

    // For countries not in the mapping, return the normalized name
    return normalizedName;
  }

  /**
   * Enhanced country name matching with bidirectional logic for USA and other problematic countries
   * @param countryName Country name to match
   * @param meshName Raw mesh name
   * @param formattedMeshName Formatted mesh name
   * @returns True if names match
   */
  private isCountryNameMatch(
    countryName: string,
    meshName: string,
    formattedMeshName: string,
  ): boolean {
    // Direct matches (case-insensitive)
    if (
      formattedMeshName === countryName ||
      formattedMeshName.toLowerCase() === countryName.toLowerCase() ||
      meshName === countryName ||
      meshName.toLowerCase() === countryName.toLowerCase()
    ) {
      return true;
    }

    // Special bidirectional mappings for problematic countries
    const usaVariants = [
      'United States',
      'United States of America',
      'USA',
      'US',
      'America',
      'UnitedStates',
      'UnitedStatesofAmerica',
    ];

    const mexicoVariants = [
      'Mexico',
      'United Mexican States',
      'UnitedMexicanStates',
      'Estados',
      'MexicanRepublic',
    ];

    // Check if both country name and mesh name are USA variants
    const isCountryUSA = usaVariants.some(
      (variant) => variant.toLowerCase() === countryName.toLowerCase(),
    );
    const isMeshUSA = usaVariants.some(
      (variant) =>
        variant.toLowerCase() === meshName.toLowerCase() ||
        variant.toLowerCase() === formattedMeshName.toLowerCase(),
    );

    if (isCountryUSA && isMeshUSA) {
      return true;
    }

    // Check if both country name and mesh name are Mexico variants
    const isCountryMexico = mexicoVariants.some(
      (variant) => variant.toLowerCase() === countryName.toLowerCase(),
    );
    const isMeshMexico = mexicoVariants.some(
      (variant) =>
        variant.toLowerCase() === meshName.toLowerCase() ||
        variant.toLowerCase() === formattedMeshName.toLowerCase(),
    );

    if (isCountryMexico && isMeshMexico) {
      return true;
    }

    // Partial matching for other countries
    const normalizedCountry = countryName.toLowerCase().replace(/[^a-z]/g, '');
    const normalizedMesh = meshName.toLowerCase().replace(/[^a-z]/g, '');
    const normalizedFormatted = formattedMeshName
      .toLowerCase()
      .replace(/[^a-z]/g, '');

    return (
      normalizedCountry.includes(normalizedMesh) ||
      normalizedMesh.includes(normalizedCountry) ||
      normalizedCountry.includes(normalizedFormatted) ||
      normalizedFormatted.includes(normalizedCountry)
    );
  }

  /**
   * Apply simple country selection with geometry offset + render order backup
   * @param mesh Country mesh to apply selection to
   */
  private applySelectionMaterial(mesh: Mesh): void {
    if (!mesh || !mesh.geometry) return;

    const material = mesh.material as Material & {
      transparent?: boolean;
      opacity?: number;
      color?: Color;
      emissive?: Color;
    };
    if (material) {
      material.transparent = true;
      material.opacity = 0.85;
      material.color?.setHex(0x00ff88); // Green selection
      if (material.emissive) {
        material.emissive.setHex(0x006644);
      }
      // Ensure no depth testing for selected materials
      material.depthTest = false;
      material.depthWrite = false;
      material.needsUpdate = true;
    }

    // Add render order as backup to geometry offset - higher value for large countries
    mesh.renderOrder = 10; // Much higher render order to ensure countries render on top

    mesh.visible = true;
  }

  /**
   * Apply quiz candidate selection material with distinct visual appearance
   * @param mesh Country mesh to apply quiz selection to
   */
  private applyQuizCandidateSelectionMaterial(mesh: Mesh): void {
    if (!mesh || !mesh.geometry) return;

    const material = mesh.material as Material & {
      transparent?: boolean;
      opacity?: number;
      color?: Color;
      emissive?: Color;
    };

    if (material) {
      material.transparent = true;
      material.opacity = 0.75;
      material.color?.setHex(0x3b82f6); // Blue quiz candidate (different from green explore)
      if (material.emissive) {
        material.emissive.setHex(0x1e40af); // Darker blue emissive
      }
      // Ensure proper depth handling with radial offset
      material.depthTest = false;
      material.depthWrite = false;
      material.needsUpdate = true;
    }

    // Higher render order than explore mode (10) to distinguish quiz selections
    mesh.renderOrder = 15;

    // Add slight radial offset to avoid z-fighting
    const scale = 1.002; // Very subtle offset, just enough to prevent z-fighting
    mesh.scale.setScalar(scale);

    mesh.visible = true;
  }
}
