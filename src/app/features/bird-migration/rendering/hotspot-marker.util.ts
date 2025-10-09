// Hotspot Marker Utility
// Interactive 3D markers for narrative hotspots along migration tour

import {
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  Color,
  Vector3,
  Group,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  AdditiveBlending,
  DoubleSide,
} from 'three';
import type { NarrativeHotspot } from '../models/tour.types';

/**
 * Configuration for hotspot marker rendering
 */
export interface HotspotMarkerConfig {
  /** Marker sphere radius */
  radius: number;
  /** Primary color for marker */
  color: string;
  /** Glow intensity (0-1) */
  glowIntensity: number;
  /** Show pulsing animation */
  pulse: boolean;
  /** Show label text */
  showLabel: boolean;
  /** Label font size in pixels */
  labelFontSize: number;
  /** Label background color */
  labelBackgroundColor: string;
  /** Label text color */
  labelTextColor: string;
  /** Render order (higher = on top) */
  renderOrder: number;
}

/**
 * Default hotspot marker configuration
 */
const DEFAULT_HOTSPOT_CONFIG: HotspotMarkerConfig = {
  radius: 0.05,
  color: '#00aaff',
  glowIntensity: 0.8,
  pulse: true,
  showLabel: true,
  labelFontSize: 14,
  labelBackgroundColor: 'rgba(0, 0, 0, 0.7)',
  labelTextColor: '#ffffff',
  renderOrder: 1000,
};

/**
 * Interactive hotspot marker with glow and label
 */
export class HotspotMarker {
  private readonly GLOBE_RADIUS = 2.0;
  private readonly HEIGHT_OFFSET = 0.03;

  private group: Group;
  private markerMesh: Mesh;
  private glowMesh: Mesh;
  private labelSprite: Sprite | null = null;
  private config: HotspotMarkerConfig;
  private animationTime = 0;

  readonly hotspot: any;
  private _isHovered = false;
  private _isActive = false;

  constructor(hotspot: any, config: Partial<HotspotMarkerConfig> = {}) {
    this.hotspot = hotspot;
    this.config = { ...DEFAULT_HOTSPOT_CONFIG, ...config };

    // Create group to hold all marker components
    this.group = new Group();
    this.group.name = `hotspot-${hotspot.id}`;

    // Convert lat/lng to 3D position
    const location = (hotspot as any).position || (hotspot as any).location;
    const latitude = location?.latitude || 0;
    const longitude = location?.longitude || 0;
    const position = this.latLngToVector3(
      latitude,
      longitude,
      this.GLOBE_RADIUS + this.HEIGHT_OFFSET,
    );
    this.group.position.copy(position);

    // Create marker sphere
    this.markerMesh = this.createMarkerSphere();
    this.group.add(this.markerMesh);

    // Create glow effect
    this.glowMesh = this.createGlowEffect();
    this.group.add(this.glowMesh);

    // Create label sprite if enabled
    if (this.config.showLabel) {
      const title =
        (hotspot as any).content?.title || (hotspot as any).title || 'Hotspot';
      this.labelSprite = this.createLabelSprite(title);
      this.group.add(this.labelSprite);
    }
  }

  /**
   * Create marker sphere mesh
   */
  private createMarkerSphere(): Mesh {
    const geometry = new SphereGeometry(this.config.radius, 32, 32);
    const material = new MeshBasicMaterial({
      color: new Color(this.config.color),
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = this.config.renderOrder;
    return mesh;
  }

  /**
   * Create outer glow effect using shader material
   */
  private createGlowEffect(): Mesh {
    const geometry = new SphereGeometry(this.config.radius * 1.5, 32, 32);

    const material = new ShaderMaterial({
      uniforms: {
        glowColor: { value: new Color(this.config.color) },
        intensity: { value: this.config.glowIntensity },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          // Fresnel effect for outer glow
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 3.0);

          // Pulsing animation
          float pulse = 0.6 + 0.4 * sin(time * 2.0);

          // Glow color with falloff
          vec3 glow = glowColor * fresnel * intensity * pulse;
          float alpha = fresnel * intensity * 0.5;

          gl_FragColor = vec4(glow, alpha);
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthTest: true,
      depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = this.config.renderOrder - 1;
    return mesh;
  }

  /**
   * Create text label sprite
   */
  private createLabelSprite(text: string): Sprite {
    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas 2D context');
    }

    // Set canvas size
    canvas.width = 256;
    canvas.height = 64;

    // Draw background
    context.fillStyle = this.config.labelBackgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.font = `${this.config.labelFontSize}px Arial, sans-serif`;
    context.fillStyle = this.config.labelTextColor;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create sprite from canvas
    const texture = new CanvasTexture(canvas);
    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });

    const sprite = new Sprite(material);
    sprite.scale.set(0.3, 0.075, 1);
    sprite.position.set(0, this.config.radius * 2.5, 0);
    sprite.renderOrder = this.config.renderOrder + 1;

    return sprite;
  }

  /**
   * Convert latitude/longitude to 3D position
   */
  private latLngToVector3(lat: number, lng: number, radius: number): Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return new Vector3(x, y, z);
  }

  /**
   * Update marker animation
   */
  update(deltaTime: number): void {
    this.animationTime += deltaTime;

    if (this.config.pulse) {
      // Update glow shader time uniform
      const glowMaterial = this.glowMesh.material as ShaderMaterial;
      glowMaterial.uniforms['time'].value = this.animationTime;

      // Pulsing scale for marker sphere
      const pulseScale = 1 + Math.sin(this.animationTime * 2) * 0.1;
      this.markerMesh.scale.set(pulseScale, pulseScale, pulseScale);
    }

    // Enhanced scale when hovered
    if (this._isHovered) {
      const hoverScale = 1.3;
      this.group.scale.lerp(
        new Vector3(hoverScale, hoverScale, hoverScale),
        0.1,
      );
    } else {
      this.group.scale.lerp(new Vector3(1, 1, 1), 0.1);
    }

    // Highlight when active (MeshBasicMaterial doesn't have emissive properties)
    const markerMaterial = this.markerMesh.material as MeshBasicMaterial;
    if (this._isActive) {
      markerMaterial.color = new Color(this.config.color);
      markerMaterial.opacity = 1.0;
    } else {
      markerMaterial.color = new Color(this.config.color);
      markerMaterial.opacity = 0.8;
    }
  }

  /**
   * Set hover state
   */
  setHovered(hovered: boolean): void {
    this._isHovered = hovered;

    // Show/hide label based on hover
    if (this.labelSprite) {
      this.labelSprite.visible = hovered || this._isActive;
    }
  }

  /**
   * Set active state (currently selected hotspot)
   */
  setActive(active: boolean): void {
    this._isActive = active;

    if (this.labelSprite) {
      this.labelSprite.visible = active || this._isHovered;
    }
  }

  /**
   * Get Three.js group for adding to scene
   */
  getGroup(): Group {
    return this.group;
  }

  /**
   * Get marker mesh for raycasting
   */
  getMarkerMesh(): Mesh {
    return this.markerMesh;
  }

  /**
   * Check if currently hovered
   */
  isHovered(): boolean {
    return this._isHovered;
  }

  /**
   * Check if currently active
   */
  isActive(): boolean {
    return this._isActive;
  }

  /**
   * Show marker
   */
  show(): void {
    this.group.visible = true;
  }

  /**
   * Hide marker
   */
  hide(): void {
    this.group.visible = false;
  }

  /**
   * Update marker configuration
   */
  updateConfig(config: Partial<HotspotMarkerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update marker color
    const markerMaterial = this.markerMesh.material as MeshBasicMaterial;
    markerMaterial.color = new Color(this.config.color);

    // Update glow color
    const glowMaterial = this.glowMesh.material as ShaderMaterial;
    glowMaterial.uniforms['glowColor'].value = new Color(this.config.color);
    glowMaterial.uniforms['intensity'].value = this.config.glowIntensity;

    // Update label visibility
    if (this.labelSprite) {
      this.labelSprite.visible = this.config.showLabel;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.markerMesh.geometry.dispose();
    (this.markerMesh.material as MeshBasicMaterial).dispose();

    this.glowMesh.geometry.dispose();
    (this.glowMesh.material as ShaderMaterial).dispose();

    if (this.labelSprite) {
      if (this.labelSprite.material.map) {
        this.labelSprite.material.map.dispose();
      }
      this.labelSprite.material.dispose();
    }
  }
}

/**
 * Create multiple hotspot markers
 */
export function createHotspotMarkers(
  hotspots: readonly any[],
  config: Partial<HotspotMarkerConfig> = {},
): HotspotMarker[] {
  return hotspots.map((hotspot) => new HotspotMarker(hotspot, config));
}

/**
 * Update all hotspot markers
 */
export function updateHotspotMarkers(
  markers: HotspotMarker[],
  deltaTime: number,
): void {
  for (const marker of markers) {
    marker.update(deltaTime);
  }
}

/**
 * Dispose all hotspot markers
 */
export function disposeHotspotMarkers(markers: HotspotMarker[]): void {
  for (const marker of markers) {
    marker.dispose();
  }
}

/**
 * Find closest hotspot marker to screen position (for raycasting)
 */
export function findClosestHotspot(
  markers: HotspotMarker[],
  intersects: { object: Mesh; distance: number }[],
): HotspotMarker | null {
  for (const intersect of intersects) {
    const marker = markers.find((m) => m.getMarkerMesh() === intersect.object);
    if (marker) {
      return marker;
    }
  }
  return null;
}
