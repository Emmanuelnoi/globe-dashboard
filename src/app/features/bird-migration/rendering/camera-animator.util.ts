/**
 * Camera Animator Utility
 * Handles smooth camera movements and keyframe animations for guided tours
 *
 * @module camera-animator.util
 * @description Creates cinematic camera movements between keyframes with easing
 */

import { PerspectiveCamera, Vector3, Quaternion, Euler } from 'three';
import {
  CameraKeyframe,
  CameraPosition,
  CameraSettings,
  CameraTransition,
  GeographicLocation,
} from '../models/tour.types';
import { getEasingFunction, interpolate } from './easing.util';

/**
 * Camera animation state
 */
interface AnimationState {
  readonly isAnimating: boolean;
  readonly currentKeyframe: number;
  readonly progress: number; // 0-1 within current transition
  readonly elapsedTime: number;
  readonly totalDuration: number;
}

/**
 * Camera Animator Class
 * Manages camera animation along defined keyframes
 */
export class CameraAnimator {
  private readonly GLOBE_RADIUS = 2.0;
  private animationState: AnimationState = {
    isAnimating: false,
    currentKeyframe: 0,
    progress: 0,
    elapsedTime: 0,
    totalDuration: 0,
  };

  private keyframes: readonly CameraKeyframe[] = [];
  private transitions: readonly CameraTransition[] = [];
  private camera: PerspectiveCamera | null = null;

  // Cached vectors for performance
  private readonly tempVec3 = new Vector3();
  private readonly tempQuat = new Quaternion();
  private readonly startPos = new Vector3();
  private readonly endPos = new Vector3();
  private readonly startLookAt = new Vector3();
  private readonly endLookAt = new Vector3();

  /**
   * Initializes the animator with camera reference
   */
  initialize(camera: PerspectiveCamera): void {
    this.camera = camera;
  }

  /**
   * Loads keyframes and transitions for animation
   */
  loadSequence(
    keyframes: readonly CameraKeyframe[],
    transitions: readonly CameraTransition[],
  ): void {
    if (keyframes.length < 2) {
      // console.warn('Need at least 2 keyframes for animation');
      return;
    }

    this.keyframes = keyframes;
    this.transitions = transitions;

    // Calculate total duration
    const totalDuration = transitions.reduce((sum, t) => sum + t.duration, 0);

    this.animationState = {
      isAnimating: false,
      currentKeyframe: 0,
      progress: 0,
      elapsedTime: 0,
      totalDuration,
    };
  }

  /**
   * Starts the animation sequence
   */
  start(): void {
    if (!this.camera || this.keyframes.length < 2) {
      // console.warn('Cannot start animation: camera or keyframes not ready');
      return;
    }

    this.animationState = {
      ...this.animationState,
      isAnimating: true,
      currentKeyframe: 0,
      progress: 0,
      elapsedTime: 0,
    };

    // Set camera to first keyframe immediately
    this.setCameraToKeyframe(this.keyframes[0]);
  }

  /**
   * Stops the animation
   */
  stop(): void {
    this.animationState = {
      ...this.animationState,
      isAnimating: false,
    };
  }

  /**
   * Pauses the animation
   */
  pause(): void {
    this.animationState = {
      ...this.animationState,
      isAnimating: false,
    };
  }

  /**
   * Resumes the animation
   */
  resume(): void {
    if (this.keyframes.length < 2) return;

    this.animationState = {
      ...this.animationState,
      isAnimating: true,
    };
  }

  /**
   * Updates animation (call this in render loop)
   * @param deltaTime - Time elapsed since last frame in milliseconds
   */
  update(deltaTime: number): boolean {
    if (!this.animationState.isAnimating || !this.camera) {
      return false;
    }

    const newElapsed = this.animationState.elapsedTime + deltaTime;

    // Check if animation is complete
    if (newElapsed >= this.animationState.totalDuration) {
      this.animationState = {
        ...this.animationState,
        isAnimating: false,
        elapsedTime: this.animationState.totalDuration,
        progress: 1,
      };

      // Set to final keyframe
      const lastKeyframe = this.keyframes[this.keyframes.length - 1];
      this.setCameraToKeyframe(lastKeyframe);

      return false;
    }

    // Find current transition
    let accumulatedTime = 0;
    let currentTransition: CameraTransition | null = null;
    let transitionProgress = 0;

    for (let i = 0; i < this.transitions.length; i++) {
      const transition = this.transitions[i];
      const transitionEnd = accumulatedTime + transition.duration;

      if (newElapsed >= accumulatedTime && newElapsed < transitionEnd) {
        currentTransition = transition;
        transitionProgress =
          (newElapsed - accumulatedTime) / transition.duration;
        break;
      }

      accumulatedTime = transitionEnd;
    }

    if (!currentTransition) return false;

    // Find keyframes for this transition
    const fromKeyframe = this.keyframes.find(
      (k) => k.id === currentTransition!.fromKeyframeId,
    );
    const toKeyframe = this.keyframes.find(
      (k) => k.id === currentTransition!.toKeyframeId,
    );

    if (!fromKeyframe || !toKeyframe) {
      // console.error('Keyframes not found for transition');
      return false;
    }

    // Interpolate camera position
    this.interpolateCameraPosition(
      fromKeyframe,
      toKeyframe,
      transitionProgress,
      currentTransition.easing,
    );

    // Update state
    this.animationState = {
      ...this.animationState,
      elapsedTime: newElapsed,
      progress: newElapsed / this.animationState.totalDuration,
    };

    return true;
  }

  /**
   * Seeks to specific time in the animation
   */
  seekTo(timeMs: number): void {
    if (!this.camera || this.keyframes.length < 2) return;

    const clampedTime = Math.max(
      0,
      Math.min(timeMs, this.animationState.totalDuration),
    );

    this.animationState = {
      ...this.animationState,
      elapsedTime: clampedTime,
      progress: clampedTime / this.animationState.totalDuration,
    };

    // Force update to seek position
    this.update(0);
  }

  /**
   * Seeks to specific keyframe
   */
  seekToKeyframe(keyframeId: string): void {
    const keyframe = this.keyframes.find((k) => k.id === keyframeId);
    if (!keyframe) {
      // console.warn(`Keyframe ${keyframeId} not found`);
      return;
    }

    this.seekTo(keyframe.time);
  }

  /**
   * Interpolates camera between two keyframes
   */
  private interpolateCameraPosition(
    from: CameraKeyframe,
    to: CameraKeyframe,
    progress: number,
    easingType: string,
  ): void {
    if (!this.camera) return;

    const easingFn = getEasingFunction(easingType as any);
    const easedProgress = easingFn(progress);

    // Convert camera positions to 3D vectors
    this.cameraPositionToVector3(from.position, this.startPos);
    this.cameraPositionToVector3(to.position, this.endPos);

    // Convert look-at targets to 3D vectors
    this.geoLocationToVector3(from.target, this.startLookAt);
    this.geoLocationToVector3(to.target, this.endLookAt);

    // Interpolate position
    this.tempVec3.lerpVectors(this.startPos, this.endPos, easedProgress);
    this.camera.position.copy(this.tempVec3);

    // Interpolate look-at (smooth camera rotation)
    const lookAt = new Vector3().lerpVectors(
      this.startLookAt,
      this.endLookAt,
      easedProgress,
    );
    this.camera.lookAt(lookAt);

    // Interpolate camera settings
    const fromSettings = { ...from.settings };
    const toSettings = { ...to.settings };

    if (fromSettings.fov !== undefined && toSettings.fov !== undefined) {
      this.camera.fov = interpolate(
        fromSettings.fov,
        toSettings.fov,
        easedProgress,
      );
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Sets camera to specific keyframe instantly
   */
  private setCameraToKeyframe(keyframe: CameraKeyframe): void {
    if (!this.camera) return;

    // Set position
    this.cameraPositionToVector3(keyframe.position, this.tempVec3);
    this.camera.position.copy(this.tempVec3);

    // Set look-at
    this.geoLocationToVector3(keyframe.target, this.tempVec3);
    this.camera.lookAt(this.tempVec3);

    // Apply settings
    if (keyframe.settings.fov !== undefined) {
      this.camera.fov = keyframe.settings.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Converts CameraPosition to Vector3
   */
  private cameraPositionToVector3(
    position: CameraPosition,
    target: Vector3,
  ): void {
    // Calculate position based on spherical coordinates
    const distance = this.GLOBE_RADIUS + position.distance;
    const phi = (90 - position.latitude) * (Math.PI / 180);
    const theta = (position.longitude + 180) * (Math.PI / 180);

    // Add elevation and azimuth offsets
    const elevRad = (position.elevation * Math.PI) / 180;
    const azimRad = (position.azimuth * Math.PI) / 180;

    const x = -(distance * Math.sin(phi + elevRad) * Math.cos(theta + azimRad));
    const z = distance * Math.sin(phi + elevRad) * Math.sin(theta + azimRad);
    const y = distance * Math.cos(phi + elevRad);

    target.set(x, y, z);
  }

  /**
   * Converts GeographicLocation to Vector3
   */
  private geoLocationToVector3(
    location: GeographicLocation,
    target: Vector3,
  ): void {
    const radius = this.GLOBE_RADIUS + (location.altitude || 0);
    const phi = (90 - location.latitude) * (Math.PI / 180);
    const theta = (location.longitude + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    target.set(x, y, z);
  }

  /**
   * Smoothly transitions camera to a target position
   * Useful for one-off camera movements outside of keyframe sequences
   */
  transitionTo(
    target: GeographicLocation,
    duration: number,
    distance: number = 3.0,
    easing: string = 'easeInOutCubic',
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.camera) {
        resolve();
        return;
      }

      const startPos = this.camera.position.clone();
      const startLookAt = new Vector3(0, 0, 0); // Assume looking at globe center

      this.geoLocationToVector3(target, this.endPos);
      this.geoLocationToVector3(
        { ...target, altitude: distance },
        this.tempVec3,
      );

      const easingFn = getEasingFunction(easing as any);
      let elapsed = 0;

      const animate = (deltaTime: number) => {
        elapsed += deltaTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easingFn(progress);

        // Interpolate position
        const pos = new Vector3().lerpVectors(
          startPos,
          this.tempVec3,
          easedProgress,
        );
        this.camera!.position.copy(pos);

        // Look at target
        this.camera!.lookAt(this.endPos);

        if (progress >= 1) {
          resolve();
        } else {
          requestAnimationFrame(() => animate(16)); // ~60fps
        }
      };

      animate(0);
    });
  }

  /**
   * Gets current animation progress (0-1)
   */
  getProgress(): number {
    return this.animationState.progress;
  }

  /**
   * Gets current elapsed time
   */
  getElapsedTime(): number {
    return this.animationState.elapsedTime;
  }

  /**
   * Gets total duration
   */
  getTotalDuration(): number {
    return this.animationState.totalDuration;
  }

  /**
   * Checks if animation is playing
   */
  isPlaying(): boolean {
    return this.animationState.isAnimating;
  }

  /**
   * Resets animation to start
   */
  reset(): void {
    this.animationState = {
      ...this.animationState,
      isAnimating: false,
      currentKeyframe: 0,
      progress: 0,
      elapsedTime: 0,
    };

    if (this.camera && this.keyframes.length > 0) {
      this.setCameraToKeyframe(this.keyframes[0]);
    }
  }

  /**
   * Calculates optimal camera position to view entire migration path
   * @param points - Array of geographic locations along path
   * @returns Optimal camera position and look-at target
   */
  static calculateOptimalViewpoint(points: readonly GeographicLocation[]): {
    position: CameraPosition;
    target: GeographicLocation;
  } {
    if (points.length === 0) {
      return {
        position: {
          latitude: 0,
          longitude: 0,
          distance: 5,
          elevation: 45,
          azimuth: 0,
        },
        target: { latitude: 0, longitude: 0 },
      };
    }

    // Calculate bounding box
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Calculate center
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Calculate span
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const maxSpan = Math.max(latSpan, lngSpan);

    // Calculate distance based on span
    const distance = Math.max(3, maxSpan / 20); // Scale factor for good view

    return {
      position: {
        latitude: centerLat,
        longitude: centerLng,
        distance,
        elevation: 30, // Slight angle for better perspective
        azimuth: 0,
      },
      target: {
        latitude: centerLat,
        longitude: centerLng,
      },
    };
  }
}

/**
 * Creates a camera animator instance
 */
export function createCameraAnimator(): CameraAnimator {
  return new CameraAnimator();
}

/**
 * Helper to create a simple keyframe
 */
export function createKeyframe(
  id: string,
  time: number,
  latitude: number,
  longitude: number,
  distance: number = 3,
  fov: number = 45,
): CameraKeyframe {
  return {
    id,
    time,
    position: {
      latitude,
      longitude,
      distance,
      elevation: 30,
      azimuth: 0,
    },
    target: {
      latitude,
      longitude,
    },
    settings: {
      fov,
      near: 0.1,
      far: 1000,
      lookAtSmooth: true,
      orbitEnabled: false,
      zoomEnabled: false,
      panEnabled: false,
    },
    easing: 'easeInOutCubic',
  };
}

/**
 * Helper to create a transition between keyframes
 */
export function createTransition(
  fromId: string,
  toId: string,
  duration: number,
  easing: string = 'easeInOutCubic',
): CameraTransition {
  return {
    fromKeyframeId: fromId,
    toKeyframeId: toId,
    duration,
    easing: easing as any,
  };
}
