// Bird Sprite Utility
// Animated sprite following migration path with orientation and flapping

import {
  Sprite,
  SpriteMaterial,
  TextureLoader,
  Vector3,
  Texture,
  AdditiveBlending,
  NormalBlending,
} from 'three';
import { CatmullRomCurve3 } from 'three';

/**
 * Configuration for bird sprite rendering
 */
export interface BirdSpriteConfig {
  /** Path to bird sprite texture (PNG with transparency) */
  texturePath: string;
  /** Sprite size (width and height in world units) */
  size: number;
  /** Animation speed (0-1, affects flapping) */
  animationSpeed: number;
  /** Opacity (0-1) */
  opacity: number;
  /** Use additive blending for glowing effect */
  glowEffect: boolean;
  /** Rotation offset in radians (0 = facing right) */
  rotationOffset: number;
  /** Flapping amplitude (scale variation 0-1) */
  flappingAmplitude: number;
  /** Enable billboard effect (always face camera) */
  billboard: boolean;
}

/**
 * Default configuration for bird sprites
 */
const DEFAULT_BIRD_CONFIG: BirdSpriteConfig = {
  texturePath: '/assets/sprites/bird-silhouette.png',
  size: 0.08,
  animationSpeed: 0.5,
  opacity: 0.9,
  glowEffect: false,
  rotationOffset: 0,
  flappingAmplitude: 0.15,
  billboard: true,
};

/**
 * Animated bird sprite that follows migration path
 */
export class BirdSprite {
  private sprite: Sprite;
  private material: SpriteMaterial;
  private texture: Texture | null = null;
  private curve: CatmullRomCurve3;
  private config: BirdSpriteConfig;

  private progress = 0; // 0-1 along path
  private animationTime = 0;
  private isAnimating = false;

  constructor(curve: CatmullRomCurve3, config: Partial<BirdSpriteConfig> = {}) {
    this.curve = curve;
    this.config = { ...DEFAULT_BIRD_CONFIG, ...config };

    // Create sprite material
    this.material = new SpriteMaterial({
      map: null, // Will be loaded asynchronously
      transparent: true,
      opacity: this.config.opacity,
      blending: this.config.glowEffect ? AdditiveBlending : NormalBlending,
      depthWrite: false,
      depthTest: true,
    });

    // Create sprite
    this.sprite = new Sprite(this.material);
    this.sprite.scale.set(this.config.size, this.config.size, 1);

    // Load texture
    this.loadTexture();

    // Position sprite at start of path
    this.updatePosition(0);
  }

  /**
   * Load bird sprite texture
   */
  private async loadTexture(): Promise<void> {
    const loader = new TextureLoader();

    try {
      this.texture = await loader.loadAsync(this.config.texturePath);
      this.material.map = this.texture;
      this.material.needsUpdate = true;
    } catch (error) {
      console.warn(
        `Failed to load bird sprite texture: ${this.config.texturePath}`,
        error,
      );
      // Fallback: Create simple colored sprite
      this.material.color.setHex(0xffffff);
    }
  }

  /**
   * Update bird position along path
   */
  private updatePosition(t: number): void {
    this.progress = Math.max(0, Math.min(1, t));

    // Get position on curve
    const position = this.curve.getPointAt(this.progress);
    this.sprite.position.copy(position);

    // Calculate orientation (facing direction of movement)
    if (this.progress < 1) {
      const nextProgress = Math.min(this.progress + 0.01, 1);
      const nextPosition = this.curve.getPointAt(nextProgress);
      const direction = new Vector3()
        .subVectors(nextPosition, position)
        .normalize();

      // Calculate rotation angle
      const angle = Math.atan2(direction.y, direction.x);
      this.sprite.material.rotation = angle + this.config.rotationOffset;
    }
  }

  /**
   * Animate flapping effect by scaling sprite
   */
  private updateFlapping(deltaTime: number): void {
    this.animationTime += deltaTime * this.config.animationSpeed * 10;

    // Sinusoidal flapping (vertical scale variation)
    const flap = Math.sin(this.animationTime) * this.config.flappingAmplitude;
    const scaleY = this.config.size * (1 + flap);
    this.sprite.scale.set(this.config.size, scaleY, 1);
  }

  /**
   * Update sprite animation
   * @param deltaTime - Time since last frame in seconds
   * @param speed - Movement speed multiplier (1 = normal)
   * @returns true if animation is still playing, false if complete
   */
  update(deltaTime: number, speed = 1): boolean {
    if (!this.isAnimating) {
      return false;
    }

    // Update position along path
    this.progress += deltaTime * speed * 0.1; // 0.1 = takes ~10 seconds to complete path

    if (this.progress >= 1) {
      this.progress = 1;
      this.isAnimating = false;
      this.updatePosition(1);
      return false;
    }

    this.updatePosition(this.progress);

    // Update flapping animation
    this.updateFlapping(deltaTime);

    return true;
  }

  /**
   * Start animation from beginning
   */
  play(): void {
    this.isAnimating = true;
    this.progress = 0;
    this.animationTime = 0;
  }

  /**
   * Pause animation
   */
  pause(): void {
    this.isAnimating = false;
  }

  /**
   * Resume animation from current position
   */
  resume(): void {
    this.isAnimating = true;
  }

  /**
   * Stop animation and reset to start
   */
  stop(): void {
    this.isAnimating = false;
    this.progress = 0;
    this.animationTime = 0;
    this.updatePosition(0);
  }

  /**
   * Seek to specific position on path
   * @param progress - Position along path (0-1)
   */
  seek(progress: number): void {
    this.updatePosition(progress);
  }

  /**
   * Get Three.js sprite object for adding to scene
   */
  getSprite(): Sprite {
    return this.sprite;
  }

  /**
   * Get current progress along path (0-1)
   */
  getProgress(): number {
    return this.progress;
  }

  /**
   * Check if animation is playing
   */
  isPlaying(): boolean {
    return this.isAnimating;
  }

  /**
   * Update sprite configuration
   */
  updateConfig(config: Partial<BirdSpriteConfig>): void {
    this.config = { ...this.config, ...config };

    // Apply changes to sprite
    this.material.opacity = this.config.opacity;
    this.material.blending = this.config.glowEffect
      ? AdditiveBlending
      : NormalBlending;
    this.sprite.scale.set(this.config.size, this.config.size, 1);
    this.material.needsUpdate = true;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.texture) {
      this.texture.dispose();
    }
    this.material.dispose();
  }
}

/**
 * Create multiple bird sprites for a flock effect
 */
export function createBirdFlock(
  curve: CatmullRomCurve3,
  count: number,
  config: Partial<BirdSpriteConfig> = {},
): BirdSprite[] {
  const flock: BirdSprite[] = [];

  for (let i = 0; i < count; i++) {
    // Slight variation in size and offset
    const variation = {
      size:
        (config.size ?? DEFAULT_BIRD_CONFIG.size) * (0.8 + Math.random() * 0.4),
      animationSpeed:
        (config.animationSpeed ?? DEFAULT_BIRD_CONFIG.animationSpeed) *
        (0.7 + Math.random() * 0.6),
      rotationOffset:
        (config.rotationOffset ?? DEFAULT_BIRD_CONFIG.rotationOffset) +
        (Math.random() - 0.5) * 0.3,
    };

    const bird = new BirdSprite(curve, { ...config, ...variation });

    // Stagger start positions
    bird.seek(i / count);

    flock.push(bird);
  }

  return flock;
}

/**
 * Update all birds in a flock
 */
export function updateBirdFlock(
  flock: BirdSprite[],
  deltaTime: number,
  speed = 1,
): void {
  for (const bird of flock) {
    bird.update(deltaTime, speed);
  }
}

/**
 * Dispose all birds in a flock
 */
export function disposeBirdFlock(flock: BirdSprite[]): void {
  for (const bird of flock) {
    bird.dispose();
  }
}
