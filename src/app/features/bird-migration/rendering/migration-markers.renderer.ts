/**
 * Migration Markers Renderer
 * Three.js renderer for bird migration markers on globe
 *
 * @module migration-markers.renderer
 * @description Creates and manages Three.js sprite markers for migration visualization
 */

import * as THREE from 'three';
import { MarkerData, MarkerType } from '../models/migration.types';
import { migrationLogger } from '../utils/migration-logger.utils';

/**
 * Marker visual configuration
 */
interface MarkerStyle {
  readonly baseSize: number; // Base marker size
  readonly pulseSize: number; // Pulse ring size
  readonly color: number; // Hex color
  readonly glowIntensity: number; // Glow effect strength
}

/**
 * Marker styles by type
 */
const MARKER_STYLES: Record<MarkerType, MarkerStyle> = {
  start: {
    baseSize: 0.06, // Balanced size for visibility without overwhelming
    pulseSize: 0.1, // Moderate pulse ring size
    color: 0x00ff88, // Neon green
    glowIntensity: 1.0,
  },
  end: {
    baseSize: 0.06, // Balanced size for visibility without overwhelming
    pulseSize: 0,
    color: 0xff6b35, // Orange
    glowIntensity: 0.8,
  },
  waypoint: {
    baseSize: 0.04, // Smaller waypoints
    pulseSize: 0,
    color: 0x00d9ff, // Cyan
    glowIntensity: 0.6,
  },
};

/**
 * Marker sprite with metadata
 */
interface MarkerSprite {
  sprite: THREE.Sprite;
  pulseRing?: THREE.Sprite;
  data: MarkerData;
  pulsePhase: number;
}

/**
 * Migration Markers Renderer
 * Manages all marker sprites on the globe
 */
export class MigrationMarkersRenderer {
  private markerGroup: THREE.Group;
  private markerSprites: Map<string, MarkerSprite> = new Map();
  private textureCache: Map<MarkerType, THREE.Texture> = new Map();

  constructor(private scene: THREE.Scene) {
    this.markerGroup = new THREE.Group();
    this.markerGroup.name = 'migration-markers';
    this.scene.add(this.markerGroup);

    // Pre-generate textures for all marker types
    this.generateMarkerTextures();

    // migrationLogger.success('MigrationMarkersRenderer initialized');
  }

  /**
   * Update markers based on current state
   * @param markers Array of marker data
   */
  updateMarkers(markers: readonly MarkerData[]): void {
    const currentIds = new Set(markers.map((m) => m.id));

    // Remove markers that no longer exist
    this.markerSprites.forEach((sprite, id) => {
      if (!currentIds.has(id)) {
        this.removeMarker(id);
      }
    });

    // Add or update markers
    markers.forEach((markerData) => {
      const existing = this.markerSprites.get(markerData.id);

      if (existing) {
        // Update existing marker
        this.updateMarkerState(existing, markerData);
      } else {
        // Create new marker
        this.createMarker(markerData);
      }
    });

    migrationLogger.debug(`Updated ${markers.length} markers`);
  }

  /**
   * Animate markers (call from animation loop)
   * @param deltaTime Time since last frame (seconds)
   */
  animate(deltaTime: number): void {
    const time = performance.now() * 0.001;

    this.markerSprites.forEach((markerSprite) => {
      // Animate pulse rings for start markers
      if (markerSprite.pulseRing) {
        const style = MARKER_STYLES[markerSprite.data.type];
        const pulseSpeed = 2.0; // 2 second pulse cycle
        const phase = (time * pulseSpeed) % (Math.PI * 2);

        // Breathing scale animation (relative to pulseSize, not absolute!)
        const scaleMultiplier = 0.8 + Math.sin(phase) * 0.4; // 0.8 to 1.2 multiplier
        const scale = style.pulseSize * scaleMultiplier;
        markerSprite.pulseRing.scale.set(scale, scale, 1);

        // Fade opacity (1.0 to 0.3)
        const opacity = 1.0 - (Math.sin(phase) * 0.35 + 0.35);
        markerSprite.pulseRing.material.opacity = opacity;
      }

      // Hover scale animation (scale relative to base size, not absolute!)
      const style = MARKER_STYLES[markerSprite.data.type];
      const baseSize = style.baseSize;
      const targetScale = markerSprite.data.isHovered
        ? baseSize * 1.2
        : baseSize;
      const currentScale = markerSprite.sprite.scale.x;
      const newScale = THREE.MathUtils.lerp(
        currentScale,
        targetScale,
        deltaTime * 10,
      );
      markerSprite.sprite.scale.set(newScale, newScale, 1);
    });
  }

  /**
   * Get all marker sprites for raycasting
   */
  getMarkerSprites(): THREE.Sprite[] {
    return Array.from(this.markerSprites.values()).map((m) => m.sprite);
  }

  /**
   * Get marker data by sprite
   */
  getMarkerData(sprite: THREE.Sprite): MarkerData | undefined {
    for (const markerSprite of this.markerSprites.values()) {
      if (markerSprite.sprite === sprite) {
        return markerSprite.data;
      }
    }
    return undefined;
  }

  /**
   * Get the marker group for visibility control
   */
  getMarkerGroup(): THREE.Group {
    return this.markerGroup;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.markerSprites.forEach((sprite) => {
      sprite.sprite.material.dispose();
      sprite.pulseRing?.material.dispose();
    });

    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();

    this.markerSprites.clear();
    this.scene.remove(this.markerGroup);

    migrationLogger.info('MigrationMarkersRenderer disposed');
  }

  // ===== Private Methods =====

  /**
   * Create a new marker sprite
   */
  private createMarker(data: MarkerData): void {
    const style = MARKER_STYLES[data.type];
    const texture = this.textureCache.get(data.type)!;

    // Create main marker sprite
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: data.isVisible ? 1.0 : 0.0, // Full opacity for visibility
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(style.baseSize, style.baseSize, 1);
    sprite.position.set(data.position.x, data.position.y, data.position.z);
    sprite.renderOrder = 1000; // Render on top
    sprite.userData = { markerId: data.id, type: data.type };

    this.markerGroup.add(sprite);

    // Create pulse ring for start markers
    let pulseRing: THREE.Sprite | undefined;
    if (data.type === 'start' && style.pulseSize > 0) {
      const pulseTexture = this.createPulseTexture(style.color);
      const pulseMaterial = new THREE.SpriteMaterial({
        map: pulseTexture,
        transparent: true,
        opacity: 0.6, // Increased for visibility
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
      });

      pulseRing = new THREE.Sprite(pulseMaterial);
      pulseRing.scale.set(style.pulseSize, style.pulseSize, 1);
      pulseRing.position.copy(sprite.position);
      pulseRing.renderOrder = 999; // Behind main marker
      this.markerGroup.add(pulseRing);
    }

    this.markerSprites.set(data.id, {
      sprite,
      pulseRing,
      data,
      pulsePhase: 0,
    });
  }

  /**
   * Update existing marker state
   */
  private updateMarkerState(sprite: MarkerSprite, newData: MarkerData): void {
    sprite.data = newData;

    // Update visibility and opacity (full opacity for visibility)
    sprite.sprite.material.opacity = newData.isVisible ? 1.0 : 0.0;

    // Update position if changed
    if (
      sprite.sprite.position.x !== newData.position.x ||
      sprite.sprite.position.y !== newData.position.y ||
      sprite.sprite.position.z !== newData.position.z
    ) {
      sprite.sprite.position.set(
        newData.position.x,
        newData.position.y,
        newData.position.z,
      );
      sprite.pulseRing?.position.copy(sprite.sprite.position);
    }
  }

  /**
   * Remove a marker
   */
  private removeMarker(markerId: string): void {
    const sprite = this.markerSprites.get(markerId);
    if (!sprite) return;

    this.markerGroup.remove(sprite.sprite);
    if (sprite.pulseRing) {
      this.markerGroup.remove(sprite.pulseRing);
    }

    sprite.sprite.material.dispose();
    sprite.pulseRing?.material.dispose();

    this.markerSprites.delete(markerId);
  }

  /**
   * Generate textures for all marker types
   */
  private generateMarkerTextures(): void {
    Object.entries(MARKER_STYLES).forEach(([type, style]) => {
      const texture = this.createMarkerTexture(
        type as MarkerType,
        style.color,
        style.glowIntensity,
      );
      this.textureCache.set(type as MarkerType, texture);
    });

    migrationLogger.debug('Generated marker textures');
  }

  /**
   * Create marker texture using canvas
   */
  private createMarkerTexture(
    type: MarkerType,
    color: number,
    glowIntensity: number,
  ): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    // Create much tighter radial gradient for subtle glow (reduced from full radius to 40%)
    const gradient = ctx.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center * 0.4,
    );
    const colorStr = `#${color.toString(16).padStart(6, '0')}`;

    gradient.addColorStop(0, colorStr);
    gradient.addColorStop(0.5, `${colorStr}CC`); // 80% opacity
    gradient.addColorStop(0.8, `${colorStr}33`); // 20% opacity (reduced from 50%)
    gradient.addColorStop(1, `${colorStr}00`); // Transparent

    // Draw subtle glow
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Draw solid circle in center (smaller core)
    ctx.fillStyle = colorStr;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.2, 0, Math.PI * 2); // Reduced from 0.25 to 0.2
    ctx.fill();

    // Add icon based on type
    if (type === 'start') {
      // Bird icon (simplified)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐦', center, center);
    } else if (type === 'end') {
      // Location pin icon
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📍', center, center);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Create pulse ring texture
   */
  private createPulseTexture(color: number): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    // Create ring gradient (very subtle)
    const gradient = ctx.createRadialGradient(
      center,
      center,
      center * 0.6,
      center,
      center,
      center,
    );
    const colorStr = `#${color.toString(16).padStart(6, '0')}`;

    gradient.addColorStop(0, `${colorStr}00`); // Transparent inside
    gradient.addColorStop(0.7, `${colorStr}33`); // 20% opacity (reduced from 50%)
    gradient.addColorStop(1, `${colorStr}00`); // Transparent outside

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
}
