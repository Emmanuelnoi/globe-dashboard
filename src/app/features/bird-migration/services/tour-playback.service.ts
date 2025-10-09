/**
 * Tour Playback Service
 * Integrates Sprint 2 rendering utilities for guided tour playback
 */

import { Injectable, signal, inject } from '@angular/core';
import * as THREE from 'three';
import {
  FlywayRenderer,
  createFlywayRenderer,
  type PathRenderStyle,
} from '../rendering/flyway-renderer.util';
import { CameraAnimator } from '../rendering/camera-animator.util';
import {
  BirdSprite,
  createBirdFlock,
  updateBirdFlock,
  disposeBirdFlock,
} from '../rendering/bird-sprite.util';
import {
  HotspotMarker,
  createHotspotMarkers,
  updateHotspotMarkers,
  disposeHotspotMarkers,
} from '../rendering/hotspot-marker.util';
import type {
  SimpleTourJSON,
  CameraKeyframe,
  SimpleKeyframe,
  SimpleHotspot,
} from '../models/tour.types';
import type { MigrationPath } from '../models/migration.types';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class TourPlaybackService {
  private readonly logger = inject(LoggerService);

  // Sprint 2 rendering utilities
  private flywayRenderer: FlywayRenderer | null = null;
  private cameraAnimator: CameraAnimator | null = null;
  private birdSprites: BirdSprite[] = [];
  private hotspotMarkers: HotspotMarker[] = [];

  // Three.js references
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  // Tour state
  private activeTour: SimpleTourJSON | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private isPlaying = signal(false);
  private currentTime = signal(0);
  private totalDuration = signal(0);
  private playbackSpeed = signal(1);

  // Raycaster for hotspot interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Public readonly signals
  readonly playing = this.isPlaying.asReadonly();
  readonly time = this.currentTime.asReadonly();
  readonly duration = this.totalDuration.asReadonly();
  readonly speed = this.playbackSpeed.asReadonly();

  /**
   * Initialize tour playback system
   */
  initialize(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.scene = scene;
    this.camera = camera;

    // Initialize camera animator
    this.cameraAnimator = new CameraAnimator();
    this.cameraAnimator.initialize(camera);

    this.logger.debug('✅ TourPlaybackService initialized', 'TourPlayback');
  }

  /**
   * Load guided tour
   */
  async loadTour(
    tour: SimpleTourJSON,
    migrationPath: MigrationPath,
  ): Promise<void> {
    if (!this.scene || !this.camera) {
      throw new Error('TourPlaybackService not initialized');
    }

    this.activeTour = tour;
    this.totalDuration.set(tour.estimatedDuration || 180000);

    // Initialize flyway renderer if not exists
    if (!this.flywayRenderer) {
      this.flywayRenderer = createFlywayRenderer({
        style: (tour.pathConfig?.style as PathRenderStyle) || 'glow',
        color: parseInt(
          (tour.pathConfig?.color || '#00aaff').replace('#', ''),
          16,
        ),
        opacity: tour.pathConfig?.opacity || 0.85,
        tubeRadius: tour.pathConfig?.tubeRadius || 0.008,
        glowIntensity: tour.pathConfig?.glowIntensity || 1.2,
        animated: true,
        showStartMarker: tour.pathConfig?.showStartMarker ?? true,
        showEndMarker: tour.pathConfig?.showEndMarker ?? true,
      });
    }

    // Render migration path
    const pathGroup = this.flywayRenderer.renderPath(migrationPath);
    this.scene.add(pathGroup);

    // Create bird sprites if configured
    if (tour.birdSpriteConfig && this.flywayRenderer) {
      const curve = this.flywayRenderer.getPathCurve();
      if (curve) {
        this.birdSprites = createBirdFlock(curve, 3, tour.birdSpriteConfig);

        for (const bird of this.birdSprites) {
          const sprite = bird.getSprite();
          if (sprite) {
            this.scene.add(sprite);
          }
        }
      }
    }

    // Create hotspot markers
    if (tour.hotspots && tour.hotspotMarkerConfig) {
      this.hotspotMarkers = createHotspotMarkers(
        tour.hotspots,
        tour.hotspotMarkerConfig,
      );

      for (const marker of this.hotspotMarkers) {
        this.scene.add(marker.getGroup());
      }
    }

    // Load camera sequence - transform tour keyframes to CameraKeyframe format
    if (this.cameraAnimator && tour.keyframes && tour.transitions) {
      const transformedKeyframes: CameraKeyframe[] = tour.keyframes.map(
        (kf: SimpleKeyframe) => ({
          id: kf.id,
          time: kf.timestamp,
          position: {
            latitude: kf.camera.latitude,
            longitude: kf.camera.longitude,
            distance: kf.camera.distance,
            elevation: kf.camera.elevation,
            azimuth: kf.camera.azimuth,
          },
          target: {
            latitude: kf.camera.latitude,
            longitude: kf.camera.longitude,
          },
          settings: {
            fov: kf.camera.fov,
          },
          easing: 'easeInOutCubic',
        }),
      );

      // Convert SimpleTransition to CameraTransition format
      const transformedTransitions = tour.transitions.map((t) => ({
        fromKeyframeId: t.from,
        toKeyframeId: t.to,
        duration: t.duration,
        easing: t.easing as
          | 'linear'
          | 'easeInQuad'
          | 'easeOutQuad'
          | 'easeInOutQuad'
          | 'easeInCubic'
          | 'easeOutCubic'
          | 'easeInOutCubic',
      }));

      this.cameraAnimator.loadSequence(
        transformedKeyframes,
        transformedTransitions,
      );
    }

    this.logger.debug(`✅ Loaded guided tour: ${tour.title}`, 'TourPlayback');
  }

  /**
   * Start tour playback
   */
  play(): void {
    if (!this.activeTour || !this.cameraAnimator) {
      this.logger.warn('No active tour to play', 'TourPlayback');
      return;
    }

    this.isPlaying.set(true);
    this.cameraAnimator.start();

    // Start bird sprite animations
    for (const bird of this.birdSprites) {
      bird.play();
    }

    // Start animation loop
    this.lastFrameTime = performance.now();
    this.animate();

    this.logger.debug('▶️ Tour playback started', 'TourPlayback');
  }

  /**
   * Pause tour playback
   */
  pause(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isPlaying.set(false);

    if (this.cameraAnimator) {
      this.cameraAnimator.pause();
    }

    for (const bird of this.birdSprites) {
      bird.pause();
    }

    this.logger.debug('⏸️ Tour playback paused', 'TourPlayback');
  }

  /**
   * Resume tour playback
   */
  resume(): void {
    if (!this.activeTour) return;

    this.isPlaying.set(true);

    if (this.cameraAnimator) {
      this.cameraAnimator.resume();
    }

    for (const bird of this.birdSprites) {
      bird.resume();
    }

    this.lastFrameTime = performance.now();
    this.animate();

    this.logger.debug('▶️ Tour playback resumed', 'TourPlayback');
  }

  /**
   * Stop tour playback
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isPlaying.set(false);
    this.currentTime.set(0);

    if (this.cameraAnimator) {
      this.cameraAnimator.stop();
    }

    for (const bird of this.birdSprites) {
      bird.stop();
    }

    this.logger.debug('⏹️ Tour playback stopped', 'TourPlayback');
  }

  /**
   * Restart tour from beginning
   */
  restart(): void {
    this.stop();
    this.currentTime.set(0);
    this.play();
  }

  /**
   * Seek to specific position (0-100)
   */
  seek(progress: number): void {
    const targetTime = (progress / 100) * this.totalDuration();

    if (this.cameraAnimator) {
      this.cameraAnimator.seekTo(targetTime);
    }

    for (const bird of this.birdSprites) {
      bird.seek(progress / 100);
    }

    this.currentTime.set(targetTime);
  }

  /**
   * Change playback speed
   */
  setSpeed(speed: number): void {
    this.playbackSpeed.set(speed);
  }

  /**
   * Animation loop
   */
  private animate(): void {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Update camera animation
    if (this.cameraAnimator) {
      const stillAnimating = this.cameraAnimator.update(deltaTime);

      if (!stillAnimating) {
        // Tour complete
        this.stop();
        return;
      }
    }

    // Update current time
    this.currentTime.update((t) =>
      Math.min(t + deltaTime * this.playbackSpeed(), this.totalDuration()),
    );

    // Update flyway renderer
    if (this.flywayRenderer) {
      this.flywayRenderer.updateAnimation(deltaTime);
    }

    // Update bird sprites
    updateBirdFlock(this.birdSprites, deltaTime / 1000, this.playbackSpeed());

    // Update hotspot markers
    updateHotspotMarkers(this.hotspotMarkers, deltaTime / 1000);

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Get hotspot marker at screen position
   */
  getHotspotAtPosition(
    x: number,
    y: number,
  ): { hotspot: SimpleHotspot; marker: HotspotMarker } | null {
    if (!this.camera) return null;

    this.mouse.x = (x / window.innerWidth) * 2 - 1;
    this.mouse.y = -(y / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersectObjects = this.hotspotMarkers.map((m) => m.getMarkerMesh());
    const intersects = this.raycaster.intersectObjects(intersectObjects, true);

    if (intersects.length > 0) {
      // Find which marker was hit
      for (const marker of this.hotspotMarkers) {
        if (intersects.some((i) => i.object === marker.getMarkerMesh())) {
          // Get hotspot data from marker (assuming it's stored as a property)
          const hotspot = (marker as unknown as { hotspot: SimpleHotspot })
            .hotspot;
          return { hotspot, marker };
        }
      }
    }

    return null;
  }

  /**
   * Get current tour progress (0-100)
   */
  getProgress(): number {
    if (this.totalDuration() === 0) return 0;
    return (this.currentTime() / this.totalDuration()) * 100;
  }

  /**
   * Clear tour and clean up resources
   */
  clearTour(): void {
    this.stop();

    // Clean up flyway renderer
    if (this.flywayRenderer) {
      this.flywayRenderer.clearPath();
      this.flywayRenderer.dispose();
      this.flywayRenderer = null;
    }

    // Clean up bird sprites
    for (const bird of this.birdSprites) {
      const sprite = bird.getSprite();
      if (sprite && this.scene) {
        this.scene.remove(sprite);
      }
    }
    disposeBirdFlock(this.birdSprites);
    this.birdSprites = [];

    // Clean up hotspot markers
    for (const marker of this.hotspotMarkers) {
      if (this.scene) {
        this.scene.remove(marker.getGroup());
      }
    }
    disposeHotspotMarkers(this.hotspotMarkers);
    this.hotspotMarkers = [];

    this.activeTour = null;
    this.currentTime.set(0);
    this.totalDuration.set(0);

    this.logger.debug('🧹 Tour resources cleared', 'TourPlayback');
  }

  /**
   * Get active tour
   */
  getActiveTour(): SimpleTourJSON | null {
    return this.activeTour;
  }

  /**
   * Check if tour is active
   */
  hasTour(): boolean {
    return this.activeTour !== null;
  }
}
