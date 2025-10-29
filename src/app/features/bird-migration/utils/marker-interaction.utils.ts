/**
 * Marker Interaction Utilities
 * Raycaster-based interaction for bird migration markers
 *
 * @module marker-interaction.utils
 * @description Handles click and hover detection for Three.js markers
 */

import * as THREE from 'three';
import { migrationLogger } from './migration-logger.utils';

/**
 * Raycast result with marker information
 */
export interface MarkerHitResult {
  readonly markerId: string;
  readonly markerType: string;
  readonly distance: number;
  readonly point: THREE.Vector3;
}

/**
 * Marker Interaction Handler
 * Manages raycasting for marker click and hover detection
 */
export class MarkerInteractionHandler {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private hoveredMarkerId: string | null = null;

  constructor(
    private camera: THREE.Camera,
    private canvas: HTMLElement,
  ) {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Sprite = {
      threshold: 0.05, // 5px hit threshold for sprites
    };
    this.mouse = new THREE.Vector2();

    // migrationLogger.success('MarkerInteractionHandler initialized');
  }

  /**
   * Find marker at screen position
   * @param clientX Mouse X coordinate
   * @param clientY Mouse Y coordinate
   * @param markerSprites Array of marker sprites to test
   * @returns Marker hit result or null
   */
  findMarkerAt(
    clientX: number,
    clientY: number,
    markerSprites: THREE.Sprite[],
  ): MarkerHitResult | null {
    // Convert screen coordinates to normalized device coordinates
    this.updateMousePosition(clientX, clientY);

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Test intersection with markers
    const intersects = this.raycaster.intersectObjects(markerSprites, false);

    if (intersects.length === 0) {
      return null;
    }

    // Get closest intersection
    const intersection = intersects[0];
    const sprite = intersection.object as THREE.Sprite;

    // Extract marker ID from userData
    const markerId = sprite.userData['markerId'] as string;
    const markerType = sprite.userData['type'] as string;

    if (!markerId) {
      migrationLogger.warn('Marker sprite missing userData.markerId');
      return null;
    }

    return {
      markerId,
      markerType,
      distance: intersection.distance,
      point: intersection.point,
    };
  }

  /**
   * Handle mouse move for hover detection
   * @param clientX Mouse X coordinate
   * @param clientY Mouse Y coordinate
   * @param markerSprites Array of marker sprites
   * @param onHoverChange Callback when hover state changes
   */
  handleMouseMove(
    clientX: number,
    clientY: number,
    markerSprites: THREE.Sprite[],
    onHoverChange: (markerId: string | null) => void,
  ): void {
    const hit = this.findMarkerAt(clientX, clientY, markerSprites);

    const newHoveredId = hit?.markerId || null;

    // Check if hover state changed
    if (newHoveredId !== this.hoveredMarkerId) {
      this.hoveredMarkerId = newHoveredId;
      onHoverChange(newHoveredId);

      migrationLogger.debug(
        `Hover changed: ${newHoveredId ? `hovering ${newHoveredId}` : 'no hover'}`,
      );
    }
  }

  /**
   * Handle click for marker selection
   * @param clientX Mouse X coordinate
   * @param clientY Mouse Y coordinate
   * @param markerSprites Array of marker sprites
   * @param onMarkerClick Callback when marker is clicked
   */
  handleClick(
    clientX: number,
    clientY: number,
    markerSprites: THREE.Sprite[],
    onMarkerClick: (markerId: string, markerType: string) => void,
  ): void {
    const hit = this.findMarkerAt(clientX, clientY, markerSprites);

    if (hit) {
      onMarkerClick(hit.markerId, hit.markerType);
      migrationLogger.info(`Marker clicked: ${hit.markerId}`);
    }
  }

  /**
   * Clear hover state
   */
  clearHover(): void {
    if (this.hoveredMarkerId !== null) {
      this.hoveredMarkerId = null;
    }
  }

  /**
   * Update mouse position in normalized device coordinates
   */
  private updateMousePosition(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();

    // Convert to normalized device coordinates (-1 to +1)
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Get current hovered marker ID
   */
  getHoveredMarkerId(): string | null {
    return this.hoveredMarkerId;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.hoveredMarkerId = null;
    migrationLogger.info('MarkerInteractionHandler disposed');
  }
}

/**
 * Create marker interaction handler
 * @param camera Three.js camera
 * @param canvas Canvas element for coordinate conversion
 */
export function createMarkerInteractionHandler(
  camera: THREE.Camera,
  canvas: HTMLElement,
): MarkerInteractionHandler {
  return new MarkerInteractionHandler(camera, canvas);
}

/**
 * Throttle function for performance
 * @param func Function to throttle
 * @param limit Time limit in milliseconds
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number,
): T {
  let inThrottle: boolean;
  return function (this: unknown, ...args: unknown[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  } as T;
}
