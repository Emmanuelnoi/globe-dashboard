/**
 * Path Particles Renderer
 * Three.js particle system for animated bird migration paths
 *
 * @module path-particles.renderer
 * @description Creates flowing particles along migration paths
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
 * Single particle state
 */
interface Particle {
  readonly sprite: THREE.Sprite;
  distance: number; // Current distance along path
  speed: number; // Travel speed
  startDelay: number; // Stagger delay
}

/**
 * Particle system for a path
 */
interface PathParticleSystem {
  readonly migrationId: string;
  readonly pathPoints: THREE.Vector3[];
  readonly pathLength: number;
  readonly particles: Particle[];
}

/**
 * Path Particles Renderer
 * Manages animated particles flowing along migration paths
 */
export class PathParticlesRenderer {
  private particleGroup: THREE.Group;
  private particleSystems: Map<string, PathParticleSystem> = new Map();
  private particleTexture: THREE.Texture | null = null;
  private globeRadius: number = 2.02;

  // Particle configuration
  private readonly PARTICLES_PER_PATH = 8;
  private readonly PARTICLE_SIZE = 0.02; // Reduced from 0.04 to make particles smaller
  private readonly TRAVEL_TIME = 4.0; // seconds to complete path

  constructor(
    private scene: THREE.Scene,
    private stateService: MigrationStateService,
  ) {
    this.particleGroup = new THREE.Group();
    this.particleGroup.name = 'migration-particles';
    this.scene.add(this.particleGroup);

    // Create particle texture
    this.particleTexture = this.createParticleTexture();

    migrationLogger.success('PathParticlesRenderer initialized');
  }

  /**
   * Update particle systems based on active paths
   * @param activePaths Array of active paths
   */
  updateParticleSystems(activePaths: readonly ActivePath[]): void {
    const activeIds = new Set(activePaths.map((p) => p.migrationId));

    // Remove particle systems for inactive paths
    this.particleSystems.forEach((system, id) => {
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

    migrationLogger.debug(`Updated ${activePaths.length} particle systems`);
  }

  /**
   * Animate particles (call from animation loop)
   * @param deltaTime Time since last frame (seconds)
   */
  animate(deltaTime: number): void {
    this.particleSystems.forEach((system) => {
      system.particles.forEach((particle) => {
        // Handle start delay
        if (particle.startDelay > 0) {
          particle.startDelay -= deltaTime;
          particle.sprite.visible = false;
          return;
        }

        particle.sprite.visible = true;

        // Update particle distance along path
        particle.distance += particle.speed * deltaTime;

        // Loop particle when it reaches the end
        if (particle.distance > system.pathLength) {
          particle.distance = particle.distance % system.pathLength;
        }

        // Get position at current distance
        const position = getPointAtDistance(
          system.pathPoints,
          particle.distance,
        );
        if (position) {
          particle.sprite.position.copy(position);

          // Fade effect near start/end
          const progress = particle.distance / system.pathLength;
          const fadeDistance = 0.1; // Fade in first/last 10%

          let opacity = 1.0;
          if (progress < fadeDistance) {
            opacity = progress / fadeDistance;
          } else if (progress > 1 - fadeDistance) {
            opacity = (1 - progress) / fadeDistance;
          }

          particle.sprite.material.opacity = opacity * 0.8; // Max 80% opacity
        }
      });
    });
  }

  /**
   * Get the particle group for visibility control
   */
  getParticleGroup(): THREE.Group {
    return this.particleGroup;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.particleSystems.forEach((system) => {
      system.particles.forEach((particle) => {
        particle.sprite.material.dispose();
      });
    });

    this.particleSystems.clear();
    this.particleTexture?.dispose();
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

    // Create particles
    const particles: Particle[] = [];

    for (let i = 0; i < this.PARTICLES_PER_PATH; i++) {
      const sprite = this.createParticleSprite();

      migrationLogger.debug(
        `🟣 Created particle ${i}: scale=${sprite.scale.x.toFixed(3)}, material opacity=${sprite.material.opacity}`,
        'PathParticlesRenderer',
      );

      // Stagger particles along the path
      const startDistance = (i / this.PARTICLES_PER_PATH) * pathLength;
      const startDelay = (i / this.PARTICLES_PER_PATH) * 0.5; // 0.5s stagger

      particles.push({
        sprite,
        distance: startDistance,
        speed,
        startDelay,
      });

      this.particleGroup.add(sprite);
    }

    migrationLogger.debug(
      '🟣 Created',
      'PathParticlesRenderer',
      particles.length,
      'particles, particleGroup now has',
      this.particleGroup.children.length,
      'children',
    );

    const system: PathParticleSystem = {
      migrationId,
      pathPoints,
      pathLength,
      particles,
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
    const system = this.particleSystems.get(migrationId);
    if (!system) return;

    system.particles.forEach((particle) => {
      this.particleGroup.remove(particle.sprite);
      particle.sprite.material.dispose();
    });

    this.particleSystems.delete(migrationId);

    migrationLogger.info(
      `Removed particle system for migration: ${migrationId}`,
    );
  }

  /**
   * Create a single particle sprite
   */
  private createParticleSprite(): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: this.particleTexture,
      transparent: true,
      opacity: 0.4, // Reduced from 0.6 for more subtlety
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending, // Changed from AdditiveBlending to prevent extreme glow
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(this.PARTICLE_SIZE, this.PARTICLE_SIZE, 1);
    sprite.renderOrder = 600; // Render above paths
    sprite.visible = false; // Start invisible (handle delay)

    return sprite;
  }

  /**
   * Create particle texture (bird silhouette with glow)
   */
  private createParticleTexture(): THREE.Texture {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    // Create very tight radial gradient for minimal glow
    const gradient = ctx.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center * 0.5,
    );
    gradient.addColorStop(0, '#ffffff'); // White center
    gradient.addColorStop(0.4, '#00d9ff'); // Cyan
    gradient.addColorStop(0.7, '#00d9ff22'); // Cyan 13% opacity (reduced from 25%)
    gradient.addColorStop(1, '#00d9ff00'); // Transparent

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Draw bird silhouette in center
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐦', center, center);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
  }
}
