/**
 * Migration Paths Renderer
 * Three.js renderer for bird migration paths on globe
 *
 * @module migration-paths.renderer
 * @description Creates and manages animated migration paths with gradients
 */

import * as THREE from 'three';
import { MigrationRecord, ActivePath } from '../models/migration.types';
import { MigrationStateService } from '../services/migration-state.service';
import {
  generateMigrationPath,
  createPathGeometry,
} from '../utils/migration-path.utils';
import { migrationLogger } from '../utils/migration-logger.utils';

/**
 * Path visual state
 */
interface PathMesh {
  readonly migrationId: string;
  readonly line: THREE.Line;
  readonly points: THREE.Vector3[];
  drawProgress: number; // 0 to 1
  isAnimating: boolean;
}

/**
 * Migration Paths Renderer
 * Manages all migration path lines on the globe
 */
export class MigrationPathsRenderer {
  private pathGroup: THREE.Group;
  private pathMeshes: Map<string, PathMesh> = new Map();
  private globeRadius: number = 2.02;

  constructor(
    private scene: THREE.Scene,
    private stateService: MigrationStateService,
  ) {
    this.pathGroup = new THREE.Group();
    this.pathGroup.name = 'migration-paths';
    this.scene.add(this.pathGroup);

    // migrationLogger.success('MigrationPathsRenderer initialized');
  }

  /**
   * Update paths based on active paths state
   * @param activePaths Array of active paths
   */
  updatePaths(activePaths: readonly ActivePath[]): void {
    migrationLogger.debug(
      `📥 updatePaths called with ${activePaths.length} active paths`,
      'MigrationPathsRenderer',
    );
    migrationLogger.debug(
      `📊 Current pathMeshes.size: ${this.pathMeshes.size}`,
      'MigrationPathsRenderer',
    );
    migrationLogger.debug(
      `📊 pathGroup.children.length: ${this.pathGroup.children.length}`,
      'MigrationPathsRenderer',
    );

    const activeIds = new Set(activePaths.map((p) => p.migrationId));

    // Remove paths that are no longer active
    const pathsToRemove: string[] = [];
    this.pathMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        pathsToRemove.push(id);
      }
    });

    if (pathsToRemove.length > 0) {
      migrationLogger.debug(
        `🗑️ Removing ${pathsToRemove.length} paths: ${pathsToRemove.join(', ')}`,
        'MigrationPathsRenderer',
      );
      pathsToRemove.forEach((id) => {
        this.removePath(id);
      });
    }

    // Add or update active paths
    activePaths.forEach((activePath) => {
      const existing = this.pathMeshes.get(activePath.migrationId);

      if (existing) {
        // Update existing path opacity
        this.updatePathOpacity(existing, activePath.opacity);
        existing.isAnimating = activePath.isAnimating;
      } else {
        // Create new path
        this.createPath(activePath.migrationId);
      }
    });

    migrationLogger.debug(
      `✅ Updated to ${activePaths.length} active paths (meshes: ${this.pathMeshes.size}, group children: ${this.pathGroup.children.length})`,
      'MigrationPathsRenderer',
    );
  }

  /**
   * Animate paths (call from animation loop)
   * @param deltaTime Time since last frame (seconds)
   */
  animate(deltaTime: number): void {
    this.pathMeshes.forEach((pathMesh) => {
      if (pathMesh.isAnimating && pathMesh.drawProgress < 1.0) {
        // Animate draw progress
        const drawSpeed = 2.0; // Complete in 0.5 seconds
        pathMesh.drawProgress = Math.min(
          1.0,
          pathMesh.drawProgress + deltaTime * drawSpeed,
        );

        // Update path geometry to show draw animation
        this.updatePathDrawProgress(pathMesh);
      }
    });
  }

  /**
   * Get the path group for visibility control
   */
  getPathGroup(): THREE.Group {
    return this.pathGroup;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.pathMeshes.forEach((mesh) => {
      mesh.line.geometry.dispose();
      (mesh.line.material as THREE.Material).dispose();
    });

    this.pathMeshes.clear();
    this.scene.remove(this.pathGroup);

    migrationLogger.info('MigrationPathsRenderer disposed');
  }

  // ===== Private Methods =====

  /**
   * Create a new path mesh
   */
  private createPath(migrationId: string): void {
    migrationLogger.debug(
      '🟢 MigrationPathsRenderer.createPath() called for:',
      'MigrationPathsRenderer',
      migrationId,
    );

    const migration = this.stateService.getMigrationById(migrationId);
    if (!migration) {
      migrationLogger.warn(`Migration not found: ${migrationId}`);
      return;
    }

    migrationLogger.debug(
      '🟢 Found migration data:',
      'MigrationPathsRenderer',
      migration,
    );

    // Generate path points
    const points = generateMigrationPath(migration, this.globeRadius);
    migrationLogger.debug(
      '🟢 Generated path points:',
      'MigrationPathsRenderer',
      points.length,
    );

    // Create geometry
    const geometry = createPathGeometry(points);
    migrationLogger.debug(
      '🟢 Created geometry with',
      'MigrationPathsRenderer',
      geometry.attributes['position']?.count || 0,
      'vertices',
    );

    // Create gradient material
    const material = this.createGradientMaterial();
    migrationLogger.debug(
      '🟢 Created material:',
      'MigrationPathsRenderer',
      material.type,
      'color:',
      material.color?.getHexString(),
    );

    // Create line mesh
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 500; // Render above globe, below markers
    line.frustumCulled = false;
    line.name = `migration-path-${migrationId}`;

    migrationLogger.debug(
      '🟢 Created Line object:',
      'MigrationPathsRenderer',
      line.name,
    );

    this.pathGroup.add(line);
    migrationLogger.debug(
      '🟢 Added line to pathGroup, pathGroup now has',
      'MigrationPathsRenderer',
      this.pathGroup.children.length,
      'children',
    );

    const pathMesh: PathMesh = {
      migrationId,
      line,
      points,
      drawProgress: 0.0,
      isAnimating: true,
    };

    this.pathMeshes.set(migrationId, pathMesh);

    migrationLogger.info(`Created path for migration: ${migrationId}`);
  }

  /**
   * Remove a path
   */
  private removePath(migrationId: string): void {
    const mesh = this.pathMeshes.get(migrationId);
    if (!mesh) return;

    this.pathGroup.remove(mesh.line);
    mesh.line.geometry.dispose();
    (mesh.line.material as THREE.Material).dispose();

    this.pathMeshes.delete(migrationId);

    migrationLogger.info(`Removed path for migration: ${migrationId}`);
  }

  /**
   * Update path opacity
   */
  private updatePathOpacity(pathMesh: PathMesh, opacity: number): void {
    const material = pathMesh.line.material as THREE.LineBasicMaterial;
    material.opacity = opacity;
  }

  /**
   * Update path draw progress (animated reveal)
   */
  private updatePathDrawProgress(pathMesh: PathMesh): void {
    const numPoints = pathMesh.points.length;
    const visiblePoints = Math.floor(numPoints * pathMesh.drawProgress);

    if (visiblePoints < 2) return;

    // Create subset of points
    const visiblePathPoints = pathMesh.points.slice(0, visiblePoints);

    // Update geometry
    const newGeometry = createPathGeometry(visiblePathPoints);
    pathMesh.line.geometry.dispose();
    pathMesh.line.geometry = newGeometry;
  }

  /**
   * Create gradient material for path
   * Uses solid color for better performance and browser compatibility
   *
   * Note: Gradient shader is available via createGradientShaderMaterial()
   * but solid color is preferred for consistent rendering across devices
   */
  private createGradientMaterial(): THREE.LineBasicMaterial {
    return new THREE.LineBasicMaterial({
      color: 0x00d9ff, // Cyan
      transparent: true,
      opacity: 0.6, // Reduced from 1.0 for more subtlety
      linewidth: 2, // Note: linewidth > 1 only works with WebGLRenderer
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * Create gradient shader material (advanced)
   * Alternative to createGradientMaterial() with cyan-to-magenta gradient
   * Available but not used by default due to performance considerations
   */
  private createGradientShaderMaterial(): THREE.ShaderMaterial {
    const vertexShader = `
      varying vec3 vPosition;

      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 colorStart;
      uniform vec3 colorEnd;
      uniform float opacity;
      varying vec3 vPosition;

      void main() {
        // Calculate gradient based on position along path
        float t = (vPosition.y + 2.0) / 4.0; // Normalize to 0-1
        vec3 color = mix(colorStart, colorEnd, t);
        gl_FragColor = vec4(color, opacity);
      }
    `;

    return new THREE.ShaderMaterial({
      uniforms: {
        colorStart: { value: new THREE.Color(0x00d9ff) }, // Cyan
        colorEnd: { value: new THREE.Color(0xff00ff) }, // Magenta
        opacity: { value: 1.0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }
}
