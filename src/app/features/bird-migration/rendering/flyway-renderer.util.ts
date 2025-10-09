/**
 * Flyway Renderer Utility
 * Renders bird migration paths on the 3D globe using Three.js
 *
 * @module flyway-renderer.util
 * @description Creates beautiful migration path visualizations with tubes, lines,
 *              gradient colors, and animated effects
 */

import {
  Vector3,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  TubeGeometry,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Group,
  CatmullRomCurve3,
  Color,
  AdditiveBlending,
  DoubleSide,
  Points,
  PointsMaterial,
  BufferAttribute,
} from 'three';
import { MigrationPoint, MigrationPath } from '../models/migration.types';

/**
 * Rendering style options
 */
export type PathRenderStyle =
  | 'line'
  | 'tube'
  | 'gradient'
  | 'glow'
  | 'particles';

/**
 * Path rendering configuration
 */
export interface PathRenderConfig {
  readonly style: PathRenderStyle;
  readonly color: string | number; // Hex color
  readonly opacity: number; // 0-1
  readonly lineWidth: number; // For line style
  readonly tubeRadius: number; // For tube style
  readonly tubeSegments: number; // Tube quality
  readonly glowIntensity: number; // Glow effect strength
  readonly animated: boolean; // Enable animation
  readonly animationSpeed: number; // Animation speed multiplier
  readonly showStartMarker: boolean;
  readonly showEndMarker: boolean;
  readonly showDirectionArrows: boolean;
  readonly heightOffset: number; // Elevation above globe surface
  readonly tension: number; // Curve smoothness (0-1)
}

/**
 * Default rendering configuration
 */
const DEFAULT_CONFIG: PathRenderConfig = {
  style: 'glow',
  color: 0x00d4ff, // Cyan
  opacity: 0.8,
  lineWidth: 3,
  tubeRadius: 0.005,
  tubeSegments: 8,
  glowIntensity: 1.5,
  animated: true,
  animationSpeed: 1.0,
  showStartMarker: true,
  showEndMarker: true,
  showDirectionArrows: false,
  heightOffset: 0.02,
  tension: 0.5,
};

/**
 * Flyway Renderer Class
 * Manages rendering of migration paths on the globe
 */
export class FlywayRenderer {
  private readonly GLOBE_RADIUS = 2.0; // Match globe.ts radius
  private pathGroup: Group;
  private pathCurve: CatmullRomCurve3 | null = null;
  private animationProgress = 0;
  private animationDirection = 1; // 1 for forward, -1 for reverse

  constructor(private readonly config: Partial<PathRenderConfig> = {}) {
    this.pathGroup = new Group();
    this.pathGroup.name = 'migration-path-group';
  }

  /**
   * Renders a complete migration path
   * @param path - Migration path data
   * @returns Three.js Group containing all rendered elements
   */
  renderPath(path: MigrationPath): Group {
    const finalConfig = { ...DEFAULT_CONFIG, ...this.config };

    // Clear previous renders
    this.clearPath();

    // Convert migration points to 3D positions
    const positions = this.convertPointsTo3D(
      path.points,
      finalConfig.heightOffset,
    );

    if (positions.length < 2) {
      console.warn('Path has fewer than 2 points, skipping render');
      return this.pathGroup;
    }

    // Create smooth curve through points
    const curve = new CatmullRomCurve3(
      positions,
      false,
      'catmullrom',
      finalConfig.tension,
    );

    // Store curve for bird sprites and other animations
    this.pathCurve = curve;

    // Render based on style
    switch (finalConfig.style) {
      case 'line':
        this.renderLineStyle(curve, finalConfig);
        break;
      case 'tube':
        this.renderTubeStyle(curve, finalConfig);
        break;
      case 'gradient':
        this.renderGradientStyle(curve, finalConfig);
        break;
      case 'glow':
        this.renderGlowStyle(curve, finalConfig);
        break;
      case 'particles':
        this.renderParticleStyle(positions, finalConfig);
        break;
    }

    // Add markers
    if (finalConfig.showStartMarker && positions.length > 0) {
      this.addMarker(positions[0], 'start', finalConfig);
    }

    if (finalConfig.showEndMarker && positions.length > 0) {
      this.addMarker(positions[positions.length - 1], 'end', finalConfig);
    }

    // Add direction arrows (optional)
    if (finalConfig.showDirectionArrows) {
      this.addDirectionArrows(curve, finalConfig);
    }

    return this.pathGroup;
  }

  /**
   * Converts lat/lng points to 3D globe positions
   */
  private convertPointsTo3D(
    points: readonly MigrationPoint[],
    heightOffset: number,
  ): Vector3[] {
    return points.map((point) =>
      this.latLngToVector3(
        point.latitude,
        point.longitude,
        this.GLOBE_RADIUS + heightOffset,
      ),
    );
  }

  /**
   * Converts latitude/longitude to 3D position on sphere
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
   * Renders path as simple line
   */
  private renderLineStyle(
    curve: CatmullRomCurve3,
    config: PathRenderConfig,
  ): void {
    const points = curve.getPoints(200);
    const geometry = new BufferGeometry().setFromPoints(points);

    const material = new LineBasicMaterial({
      color: config.color,
      opacity: config.opacity,
      transparent: true,
      linewidth: config.lineWidth,
    });

    const line = new Line(geometry, material);
    line.name = 'migration-line';
    this.pathGroup.add(line);
  }

  /**
   * Renders path as 3D tube
   */
  private renderTubeStyle(
    curve: CatmullRomCurve3,
    config: PathRenderConfig,
  ): void {
    const geometry = new TubeGeometry(
      curve,
      200, // tubular segments
      config.tubeRadius,
      config.tubeSegments, // radial segments
      false, // closed
    );

    const material = new MeshBasicMaterial({
      color: config.color,
      opacity: config.opacity,
      transparent: true,
      side: DoubleSide,
    });

    const tube = new Mesh(geometry, material);
    tube.name = 'migration-tube';
    this.pathGroup.add(tube);
  }

  /**
   * Renders path with gradient color (start to end)
   */
  private renderGradientStyle(
    curve: CatmullRomCurve3,
    config: PathRenderConfig,
  ): void {
    const points = curve.getPoints(200);
    const geometry = new BufferGeometry().setFromPoints(points);

    // Create color gradient along path
    const colors: number[] = [];
    const startColor = new Color(config.color);
    const endColor = new Color(0xff6b00); // Orange for end

    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1);
      const color = new Color().lerpColors(startColor, endColor, t);
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute(
      'color',
      new BufferAttribute(new Float32Array(colors), 3),
    );

    const material = new LineBasicMaterial({
      vertexColors: true,
      opacity: config.opacity,
      transparent: true,
      linewidth: config.lineWidth,
    });

    const line = new Line(geometry, material);
    line.name = 'migration-gradient-line';
    this.pathGroup.add(line);
  }

  /**
   * Renders path with glow effect using shader material
   */
  private renderGlowStyle(
    curve: CatmullRomCurve3,
    config: PathRenderConfig,
  ): void {
    const points = curve.getPoints(200);
    const geometry = new TubeGeometry(
      curve,
      200,
      config.tubeRadius,
      config.tubeSegments,
      false,
    );

    // Custom shader material for glow effect
    const material = new ShaderMaterial({
      uniforms: {
        color: { value: new Color(config.color) },
        glowIntensity: { value: config.glowIntensity },
        opacity: { value: config.opacity },
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
        uniform vec3 color;
        uniform float glowIntensity;
        uniform float opacity;
        uniform float time;

        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          // Fresnel-like glow effect
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.0);

          // Pulsing animation
          float pulse = 0.5 + 0.5 * sin(time * 2.0);

          // Combine effects
          vec3 glowColor = color * (1.0 + fresnel * glowIntensity * pulse);
          float alpha = opacity * (0.6 + 0.4 * fresnel);

          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    const tube = new Mesh(geometry, material);
    tube.name = 'migration-glow-tube';
    (tube.material as ShaderMaterial).uniforms['time'].value = 0; // Will be updated in animation loop
    this.pathGroup.add(tube);
  }

  /**
   * Renders path as particle trail
   */
  private renderParticleStyle(
    positions: Vector3[],
    config: PathRenderConfig,
  ): void {
    const geometry = new BufferGeometry().setFromPoints(positions);

    // Add size attribute for varying particle sizes
    const sizes = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      sizes[i] = Math.random() * 0.02 + 0.01;
    }
    geometry.setAttribute('size', new BufferAttribute(sizes, 1));

    const material = new PointsMaterial({
      color: config.color,
      size: 0.02,
      opacity: config.opacity,
      transparent: true,
      sizeAttenuation: true,
      blending: AdditiveBlending,
    });

    const particles = new Points(geometry, material);
    particles.name = 'migration-particles';
    this.pathGroup.add(particles);
  }

  /**
   * Adds start/end marker sphere
   */
  private addMarker(
    position: Vector3,
    type: 'start' | 'end',
    config: PathRenderConfig,
  ): void {
    const markerGeometry = new BufferGeometry();
    const radius = 0.03;
    const segments = 16;

    // Create sphere vertices manually
    const vertices: number[] = [];
    for (let lat = 0; lat <= segments; lat++) {
      const theta = (lat * Math.PI) / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= segments; lon++) {
        const phi = (lon * 2 * Math.PI) / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        vertices.push(
          position.x + radius * x,
          position.y + radius * y,
          position.z + radius * z,
        );
      }
    }

    markerGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(vertices), 3),
    );

    const color = type === 'start' ? 0x00ff00 : 0xff0000;
    const material = new PointsMaterial({
      color,
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
    });

    const marker = new Points(markerGeometry, material);
    marker.name = `migration-${type}-marker`;
    this.pathGroup.add(marker);
  }

  /**
   * Adds direction arrows along the path
   */
  private addDirectionArrows(
    curve: CatmullRomCurve3,
    config: PathRenderConfig,
  ): void {
    const arrowCount = 10;
    const points = curve.getPoints(arrowCount);

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const prevPoint = points[i - 1];
      const direction = new Vector3().subVectors(point, prevPoint).normalize();

      // Simple arrow representation (would be replaced with actual arrow geometry)
      const arrowGeometry = new BufferGeometry().setFromPoints([
        prevPoint,
        point,
      ]);

      const arrowMaterial = new LineBasicMaterial({
        color: 0xffff00,
        opacity: 0.5,
        transparent: true,
      });

      const arrow = new Line(arrowGeometry, arrowMaterial);
      arrow.name = `migration-arrow-${i}`;
      this.pathGroup.add(arrow);
    }
  }

  /**
   * Updates animation (call this in render loop)
   */
  updateAnimation(deltaTime: number): void {
    const config = { ...DEFAULT_CONFIG, ...this.config };

    if (!config.animated) return;

    this.animationProgress +=
      deltaTime * config.animationSpeed * this.animationDirection;

    // Update shader uniforms for glow effect
    this.pathGroup.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof ShaderMaterial) {
        child.material.uniforms['time'].value = this.animationProgress;
      }
    });

    // Reverse animation direction at boundaries (optional ping-pong effect)
    if (this.animationProgress > 10 || this.animationProgress < 0) {
      this.animationDirection *= -1;
    }
  }

  /**
   * Sets animation progress manually (0-1)
   */
  setAnimationProgress(progress: number): void {
    this.animationProgress = progress * 10; // Scale to reasonable range
  }

  /**
   * Clears all rendered path elements
   */
  clearPath(): void {
    while (this.pathGroup.children.length > 0) {
      const child = this.pathGroup.children[0];
      this.pathGroup.remove(child);

      // Dispose geometries and materials
      if (
        child instanceof Mesh ||
        child instanceof Line ||
        child instanceof Points
      ) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  /**
   * Gets the path group for adding to scene
   */
  getPathGroup(): Group {
    return this.pathGroup;
  }

  /**
   * Gets the path curve for bird sprite animations
   */
  getPathCurve(): CatmullRomCurve3 | null {
    return this.pathCurve;
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.clearPath();
  }

  /**
   * Shows/hides the path
   */
  setVisible(visible: boolean): void {
    this.pathGroup.visible = visible;
  }

  /**
   * Updates path opacity
   */
  setOpacity(opacity: number): void {
    this.pathGroup.traverse((child) => {
      if (
        child instanceof Mesh ||
        child instanceof Line ||
        child instanceof Points
      ) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m.opacity = opacity;
            m.transparent = opacity < 1;
          });
        } else {
          child.material.opacity = opacity;
          child.material.transparent = opacity < 1;
        }
      }
    });
  }

  /**
   * Changes path color dynamically
   */
  setColor(color: number | string): void {
    const colorObj = new Color(color);

    this.pathGroup.traverse((child) => {
      if (
        child instanceof Mesh ||
        child instanceof Line ||
        child instanceof Points
      ) {
        if (child.material instanceof ShaderMaterial) {
          child.material.uniforms['color'].value = colorObj;
        } else if ('color' in child.material) {
          (child.material as any).color = colorObj;
        }
      }
    });
  }
}

/**
 * Creates a flyway renderer with default configuration
 */
export function createFlywayRenderer(
  config?: Partial<PathRenderConfig>,
): FlywayRenderer {
  return new FlywayRenderer(config);
}

/**
 * Helper to calculate optimal height offset based on path length
 */
export function calculateOptimalHeightOffset(pathLength: number): number {
  // Longer paths get higher offset for better visibility
  const minHeight = 0.02;
  const maxHeight = 0.15;

  // Normalize path length (assume max 20,000 km)
  const normalizedLength = Math.min(pathLength / 20000, 1);

  return minHeight + (maxHeight - minHeight) * normalizedLength;
}

/**
 * Helper to get color based on migration season
 */
export function getSeasonalColor(season?: string): number {
  switch (season?.toLowerCase()) {
    case 'spring':
      return 0x00ff88; // Green
    case 'summer':
      return 0xffdd00; // Yellow
    case 'autumn':
    case 'fall':
      return 0xff6b00; // Orange
    case 'winter':
      return 0x00d4ff; // Cyan
    default:
      return 0x00d4ff; // Default cyan
  }
}
