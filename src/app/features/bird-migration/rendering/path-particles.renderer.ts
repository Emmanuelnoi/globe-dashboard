/**
 * Path Particles Renderer
 * Three.js particle system for animated bird migration paths
 *
 * @module path-particles.renderer
 * @description Creates flowing particles along migration paths
 *
 * Performance optimized: Uses InstancedMesh for single draw call rendering
 * instead of individual sprites (N draw calls -> 1 draw call)
 */

import * as THREE from 'three';
import { ActivePath } from '../models/migration.types';
import { MigrationStateService } from '../services/migration-state.service';
import {
  generateMigrationPath,
  calculatePathLength,
  getPointAtDistance,
} from '../utils/migration-path.utils';
import { migrationLogger } from '../utils/migration-logger.utils';

/**
 * Single particle state (lightweight, no Three.js objects)
 */
interface ParticleState {
  distance: number; // Current distance along path
  speed: number; // Travel speed
  startDelay: number; // Stagger delay
  visible: boolean; // Visibility state
  opacity: number; // Current opacity for fade effects
}

/**
 * Particle system for a path
 */
interface PathParticleSystem {
  readonly migrationId: string;
  readonly pathPoints: THREE.Vector3[];
  readonly pathLength: number;
  readonly particles: ParticleState[];
  readonly startIndex: number; // Index in the instanced mesh
}

/**
 * Path Particles Renderer
 * Manages animated particles flowing along migration paths
 *
 * Performance: Uses InstancedMesh for all particles (single draw call)
 */
export class PathParticlesRenderer {
  private particleGroup: THREE.Group;
  private particleSystems: Map<string, PathParticleSystem> = new Map();
  private globeRadius: number = 2.02;

  // Instanced mesh for all particles (single draw call)
  private instancedMesh: THREE.InstancedMesh | null = null;
  private particleGeometry: THREE.SphereGeometry;
  private particleMaterial: THREE.MeshBasicMaterial;
  private dummy = new THREE.Object3D();

  // Particle configuration
  private readonly PARTICLES_PER_PATH = 8;
  private readonly PARTICLE_SIZE = 0.015; // Sphere radius
  private readonly TRAVEL_TIME = 4.0; // seconds to complete path
  private readonly MAX_PARTICLES = 200; // Max particles across all paths

  // Track total active particles
  private activeParticleCount = 0;

  constructor(
    private scene: THREE.Scene,
    private stateService: MigrationStateService,
  ) {
    this.particleGroup = new THREE.Group();
    this.particleGroup.name = 'migration-particles';
    this.scene.add(this.particleGroup);

    // Create shared geometry and material for instancing
    this.particleGeometry = new THREE.SphereGeometry(this.PARTICLE_SIZE, 8, 8);
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d9ff, // Cyan
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false,
    });

    // Create instanced mesh
    this.createInstancedMesh();

    // migrationLogger.success('PathParticlesRenderer initialized (InstancedMesh)');
  }

  /**
   * Create the instanced mesh for all particles
   */
  private createInstancedMesh(): void {
    this.instancedMesh = new THREE.InstancedMesh(
      this.particleGeometry,
      this.particleMaterial,
      this.MAX_PARTICLES,
    );
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.renderOrder = 600; // Render above paths
    this.instancedMesh.frustumCulled = false; // Always render (small objects)
    this.instancedMesh.count = 0; // Start with no visible instances

    this.particleGroup.add(this.instancedMesh);
  }

  /**
   * Update particle systems based on active paths
   * @param activePaths Array of active paths
   */
  updateParticleSystems(activePaths: readonly ActivePath[]): void {
    const activeIds = new Set(activePaths.map((p) => p.migrationId));

    // Remove particle systems for inactive paths
    this.particleSystems.forEach((_, id) => {
      if (!activeIds.has(id)) {
        this.removeParticleSystem(id);
      }
    });

    // Add particle systems for new paths
    activePaths.forEach((activePath) => {
      if (!this.particleSystems.has(activePath.migrationId)) {
        this.createParticleSystem(activePath.migrationId);
      }
    });

    // Rebuild instance indices after changes
    this.rebuildInstanceIndices();

    migrationLogger.debug(`Updated ${activePaths.length} particle systems`);
  }

  /**
   * Animate particles (call from animation loop)
   * Uses InstancedMesh for single draw call
   * @param deltaTime Time since last frame (seconds)
   */
  animate(deltaTime: number): void {
    if (!this.instancedMesh || this.particleSystems.size === 0) return;

    let instanceIndex = 0;

    this.particleSystems.forEach((system) => {
      system.particles.forEach((particle) => {
        // Handle start delay
        if (particle.startDelay > 0) {
          particle.startDelay -= deltaTime;
          particle.visible = false;
        } else {
          particle.visible = true;

          // Update particle distance along path
          particle.distance += particle.speed * deltaTime;

          // Loop particle when it reaches the end
          if (particle.distance > system.pathLength) {
            particle.distance = particle.distance % system.pathLength;
          }

          // Calculate fade effect
          const progress = particle.distance / system.pathLength;
          const fadeDistance = 0.1;

          if (progress < fadeDistance) {
            particle.opacity = (progress / fadeDistance) * 0.8;
          } else if (progress > 1 - fadeDistance) {
            particle.opacity = ((1 - progress) / fadeDistance) * 0.8;
          } else {
            particle.opacity = 0.8;
          }
        }

        // Update instance matrix
        if (particle.visible && instanceIndex < this.MAX_PARTICLES) {
          const position = getPointAtDistance(
            system.pathPoints,
            particle.distance,
          );

          if (position) {
            // Scale based on opacity for fade effect
            const scale = particle.opacity > 0.1 ? 1.0 : particle.opacity * 10;
            this.dummy.position.copy(position);
            this.dummy.scale.setScalar(scale);
            this.dummy.updateMatrix();
            this.instancedMesh!.setMatrixAt(instanceIndex, this.dummy.matrix);
            instanceIndex++;
          }
        }
      });
    });

    // Update instance count and mark for GPU update
    this.instancedMesh!.count = instanceIndex;
    this.instancedMesh!.instanceMatrix.needsUpdate = true;
    this.activeParticleCount = instanceIndex;
  }

  /**
   * Get the particle group for visibility control
   */
  getParticleGroup(): THREE.Group {
    return this.particleGroup;
  }

  /**
   * Get active particle count (for performance monitoring)
   */
  getActiveParticleCount(): number {
    return this.activeParticleCount;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.particleSystems.clear();

    if (this.instancedMesh) {
      this.particleGroup.remove(this.instancedMesh);
      this.instancedMesh.dispose();
    }

    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
    this.scene.remove(this.particleGroup);

    migrationLogger.info('PathParticlesRenderer disposed');
  }

  // ===== Private Methods =====

  /**
   * Create particle system for a migration path
   */
  private createParticleSystem(migrationId: string): void {
    migrationLogger.debug(
      '🟣 PathParticlesRenderer.createParticleSystem() called for:',
      'PathParticlesRenderer',
      migrationId,
    );

    const migration = this.stateService.getMigrationById(migrationId);
    if (!migration) {
      migrationLogger.warn(`Migration not found: ${migrationId}`);
      return;
    }

    // Generate path points
    const pathPoints = generateMigrationPath(migration, this.globeRadius);
    const pathLength = calculatePathLength(pathPoints);

    migrationLogger.debug(
      '🟣 Path points:',
      'PathParticlesRenderer',
      pathPoints.length,
      'Path length:',
      pathLength.toFixed(3),
    );

    // Calculate travel speed
    const speed = pathLength / this.TRAVEL_TIME;

    // Create particle states (lightweight, no Three.js objects)
    const particles: ParticleState[] = [];

    for (let i = 0; i < this.PARTICLES_PER_PATH; i++) {
      const startDistance = (i / this.PARTICLES_PER_PATH) * pathLength;
      const startDelay = (i / this.PARTICLES_PER_PATH) * 0.5;

      particles.push({
        distance: startDistance,
        speed,
        startDelay,
        visible: false,
        opacity: 0,
      });
    }

    const system: PathParticleSystem = {
      migrationId,
      pathPoints,
      pathLength,
      particles,
      startIndex: 0, // Will be set in rebuildInstanceIndices
    };

    this.particleSystems.set(migrationId, system);

    migrationLogger.info(
      `Created particle system for migration: ${migrationId}`,
    );
  }

  /**
   * Remove particle system
   */
  private removeParticleSystem(migrationId: string): void {
    this.particleSystems.delete(migrationId);
    migrationLogger.info(
      `Removed particle system for migration: ${migrationId}`,
    );
  }

  /**
   * Rebuild instance indices after systems are added/removed
   */
  private rebuildInstanceIndices(): void {
    let index = 0;
    this.particleSystems.forEach((system) => {
      (system as { startIndex: number }).startIndex = index;
      index += system.particles.length;
    });
  }
}
