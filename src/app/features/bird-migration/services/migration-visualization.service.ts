/**
 * Migration Visualization Service
 * Handles 3D rendering of bird migration data using Three.js
 */

import { Injectable, signal, inject } from '@angular/core';
import * as THREE from 'three';
import {
  MigrationDataPoint,
  TimelineState,
  AnimationConfig,
  LoadingState,
} from '../models/ui.models';
import { LoggerService } from '@/core/services/logger.service';

export interface MigrationPath {
  readonly id: string;
  readonly points: readonly MigrationDataPoint[];
  readonly species: string;
  readonly timeRange: {
    readonly start: Date;
    readonly end: Date;
  };
  readonly color: THREE.Color;
  readonly intensity: number; // 0-1 based on data density
}

export interface PathSegment {
  readonly start: THREE.Vector3;
  readonly end: THREE.Vector3;
  readonly timestamp: Date;
  readonly progress: number; // 0-1 animation progress
}

export interface RenderStats {
  readonly activePaths: number;
  readonly totalPoints: number;
  readonly frameRate: number;
  readonly memoryUsage: number; // MB
  readonly lastUpdate: Date;
}

/**
 * LOD (Level of Detail) configuration for performance optimization
 */
export interface LODConfig {
  readonly high: {
    readonly maxPaths: number;
    readonly particleCount: number;
    readonly segmentResolution: number;
  };
  readonly medium: {
    readonly maxPaths: number;
    readonly particleCount: number;
    readonly segmentResolution: number;
  };
  readonly low: {
    readonly maxPaths: number;
    readonly particleCount: number;
    readonly segmentResolution: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class MigrationVisualizationService {
  // Reactive state
  private readonly _isInitialized = signal(false);
  private readonly _renderStats = signal<RenderStats>({
    activePaths: 0,
    totalPoints: 0,
    frameRate: 60,
    memoryUsage: 0,
    lastUpdate: new Date(),
  });
  private readonly _currentLOD = signal<keyof LODConfig>('high');

  // Three.js components
  private scene: THREE.Scene | null = null;
  private globe: THREE.Object3D | null = null;
  private pathGroup: THREE.Group | null = null;
  private particleSystem: THREE.Points | null = null;
  private animationMixer: THREE.AnimationMixer | null = null;

  // Migration data
  private migrationPaths: MigrationPath[] = [];
  private activeAnimations: Map<string, THREE.AnimationAction> = new Map();
  private pathGeometries: Map<string, THREE.BufferGeometry> = new Map();
  private birdMarkers: Map<string, THREE.Mesh> = new Map();

  // Tooltip and interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private tooltipCallback:
    | ((tooltip: string | null, x: number, y: number) => void)
    | null = null;

  // Performance monitoring
  private performanceMonitor = {
    frameCount: 0,
    lastFrameTime: 0,
    fpsUpdateInterval: 1000, // ms
  };

  // Custom shader storage
  private _customShaders: {
    vertex: string;
    fragment: string;
  } | null = null;

  // LOD configuration
  private readonly LOD_CONFIG: LODConfig = {
    high: {
      maxPaths: 500,
      particleCount: 10000,
      segmentResolution: 50,
    },
    medium: {
      maxPaths: 250,
      particleCount: 5000,
      segmentResolution: 25,
    },
    low: {
      maxPaths: 100,
      particleCount: 2000,
      segmentResolution: 10,
    },
  };

  // Public reactive state
  public readonly isInitialized = this._isInitialized.asReadonly();
  public readonly renderStats = this._renderStats.asReadonly();
  public readonly currentLOD = this._currentLOD.asReadonly();

  private logger = inject(LoggerService);

  constructor() {
    this.logger.debug(
      '🎨 MigrationVisualizationService initializing',
      'MigrationVisualization',
    );
    this.initializeShaders();
  }

  /**
   * Initialize the visualization system with Three.js scene
   */
  async initializeVisualization(
    scene: THREE.Scene,
    globe: THREE.Object3D,
  ): Promise<void> {
    try {
      this.logger.debug('🎨 Initializing migration visualization system');

      this.scene = scene;
      this.globe = globe;

      // Create main path group
      this.pathGroup = new THREE.Group();
      this.pathGroup.name = 'migration-paths';
      this.scene.add(this.pathGroup);

      // Initialize particle system
      this.initializeParticleSystem();

      // Initialize animation mixer
      this.animationMixer = new THREE.AnimationMixer(this.pathGroup);

      // Set up performance monitoring
      this.setupPerformanceMonitoring();

      this._isInitialized.set(true);
      this.logger.debug('✅ Migration visualization system initialized');
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize migration visualization:',
        error,
      );
      throw error;
    }
  }

  /**
   * Load and render migration data
   */
  async loadMigrationData(
    migrationData: readonly MigrationDataPoint[],
  ): Promise<void> {
    if (!this.scene || !this.pathGroup) {
      throw new Error('Visualization not initialized');
    }

    try {
      this.logger.debug(
        `🔄 Loading ${migrationData.length} migration data points`,
      );

      // Process migration data into paths
      this.migrationPaths = this.processMigrationPaths(migrationData);

      // Apply LOD filtering
      const filteredPaths = this.applyLODFiltering(this.migrationPaths);

      // Clear existing paths
      this.clearExistingPaths();

      // Create 3D geometries for paths
      await this.createPathGeometries(filteredPaths);

      // Update render stats
      this.updateRenderStats();

      this.logger.debug(`✅ Loaded ${filteredPaths.length} migration paths`);
    } catch (error) {
      this.logger.error('❌ Failed to load migration data:', error);
      throw error;
    }
  }

  /**
   * Update animation based on timeline state
   */
  updateTimelineAnimation(timelineState: TimelineState): void {
    if (!this.animationMixer || !this.pathGroup) return;

    try {
      const {
        currentDate,
        startDate,
        endDate,
        isPlaying,
        playbackSpeed,
        progress,
      } = timelineState;

      // Update animation progress for all paths
      this.activeAnimations.forEach((action, pathId) => {
        if (isPlaying) {
          action.timeScale = playbackSpeed;
          action.paused = false;
          action.play();
        } else {
          action.paused = true;
        }

        // Set animation time based on progress
        const totalDuration = action.getClip().duration;
        action.time = progress * totalDuration;
      });

      // Update bird marker positions based on timeline progress
      this.birdMarkers.forEach((birdMarker, pathId) => {
        this.updateBirdMarkerPosition(pathId, progress);
      });

      // Update particle positions based on current time
      this.updateParticlePositions(currentDate, progress);

      this.logger.debug(
        `🔄 Updated timeline animation: ${(progress * 100).toFixed(1)}%`,
      );
    } catch (error) {
      this.logger.warn('⚠️ Error updating timeline animation:', error);
    }
  }

  /**
   * Update LOD based on performance metrics
   */
  updateLOD(frameRate: number, pathCount: number): void {
    let newLOD: keyof LODConfig = 'high';

    if (frameRate < 30 || pathCount > 300) {
      newLOD = 'low';
    } else if (frameRate < 45 || pathCount > 150) {
      newLOD = 'medium';
    }

    if (newLOD !== this._currentLOD()) {
      this.logger.debug(
        `🎯 Switching to ${newLOD} LOD (FPS: ${frameRate}, Paths: ${pathCount})`,
      );
      this._currentLOD.set(newLOD);

      // Reapply LOD filtering if needed
      if (this.migrationPaths.length > 0) {
        const filteredPaths = this.applyLODFiltering(this.migrationPaths);
        this.createPathGeometries(filteredPaths);
      }
    }
  }

  /**
   * Animate the visualization (called from render loop)
   */
  animate(deltaTime: number): void {
    if (!this._isInitialized()) return;

    try {
      // Update animation mixer
      if (this.animationMixer) {
        this.animationMixer.update(deltaTime);
      }

      // Update bird marker animations
      this.animateBirdMarkers(deltaTime);

      // Update particle system
      this.updateParticleAnimation(deltaTime);

      // Update performance stats
      this.updatePerformanceStats();
    } catch (error) {
      this.logger.warn('⚠️ Animation update error:', error);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.logger.debug('🧹 Disposing migration visualization resources');

    try {
      // Clear animations
      this.activeAnimations.clear();
      if (this.animationMixer) {
        this.animationMixer.stopAllAction();
      }

      // Dispose geometries
      this.pathGeometries.forEach((geometry) => geometry.dispose());
      this.pathGeometries.clear();

      // Remove from scene
      if (this.scene && this.pathGroup) {
        this.scene.remove(this.pathGroup);
      }

      // Reset state
      this._isInitialized.set(false);
      this.migrationPaths = [];
    } catch (error) {
      this.logger.error('❌ Error disposing visualization:', error);
    }
  }

  /**
   * Process migration data into renderable paths
   */
  private processMigrationPaths(
    migrationData: readonly MigrationDataPoint[],
  ): MigrationPath[] {
    this.logger.debug('🔄 Processing migration data into paths');

    // Group points by species and create temporal sequences
    const speciesGroups = new Map<string, MigrationDataPoint[]>();

    migrationData.forEach((point) => {
      const species = point.metadata.scientificName;
      if (!speciesGroups.has(species)) {
        speciesGroups.set(species, []);
      }
      speciesGroups.get(species)!.push(point);
    });

    const paths: MigrationPath[] = [];
    let pathId = 0;

    speciesGroups.forEach((points, species) => {
      // Sort points by date
      const sortedPoints = [...points].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );

      if (sortedPoints.length < 2) return; // Need at least 2 points for a path

      // Create path segments based on temporal proximity
      const pathSegments = this.createPathSegments(sortedPoints);

      pathSegments.forEach((segment) => {
        if (segment.length >= 2) {
          const timeRange = {
            start: segment[0].date,
            end: segment[segment.length - 1].date,
          };

          paths.push({
            id: `path-${pathId++}`,
            points: segment,
            species,
            timeRange,
            color: this.getSpeciesColor(species),
            intensity: Math.min(segment.length / 50, 1), // Normalize intensity
          });
        }
      });
    });

    this.logger.debug(
      `✅ Created ${paths.length} migration paths from ${speciesGroups.size} species`,
    );
    return paths;
  }

  /**
   * Create path segments from sorted points based on temporal proximity
   */
  private createPathSegments(
    sortedPoints: MigrationDataPoint[],
  ): MigrationDataPoint[][] {
    const segments: MigrationDataPoint[][] = [];
    let currentSegment: MigrationDataPoint[] = [sortedPoints[0]];

    const MAX_TIME_GAP = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    for (let i = 1; i < sortedPoints.length; i++) {
      const prevPoint = sortedPoints[i - 1];
      const currentPoint = sortedPoints[i];
      const timeGap = currentPoint.date.getTime() - prevPoint.date.getTime();

      if (timeGap <= MAX_TIME_GAP) {
        currentSegment.push(currentPoint);
      } else {
        // Start new segment
        if (currentSegment.length >= 2) {
          segments.push(currentSegment);
        }
        currentSegment = [currentPoint];
      }
    }

    // Add final segment
    if (currentSegment.length >= 2) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Apply LOD filtering to migration paths
   */
  private applyLODFiltering(paths: MigrationPath[]): MigrationPath[] {
    const lodConfig = this.LOD_CONFIG[this._currentLOD()];

    if (paths.length <= lodConfig.maxPaths) {
      return paths;
    }

    // Sort by intensity and take top paths
    return [...paths]
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, lodConfig.maxPaths);
  }

  /**
   * Create Three.js geometries for migration paths
   */
  private async createPathGeometries(paths: MigrationPath[]): Promise<void> {
    if (!this.pathGroup) return;

    this.logger.debug(`🔨 Creating geometries for ${paths.length} paths`);

    for (const path of paths) {
      try {
        // Create simplified path for Phase 2
        this.createSimplifiedPath(path);

        // Create start and end markers
        this.createStartEndMarkers(path);
      } catch (error) {
        this.logger.warn(
          `⚠️ Failed to create geometry for path ${path.id}:`,
          error,
        );
      }
    }

    this.logger.debug(`✅ Created ${this.pathGeometries.size} path geometries`);
  }

  /**
   * Create simplified migration path (Phase 2 implementation)
   */
  private createSimplifiedPath(path: MigrationPath): void {
    if (!this.pathGroup || path.points.length < 2) return;

    // Get start and end points for simplified visualization
    const startPoint = path.points[0];
    const endPoint = path.points[path.points.length - 1];

    // Convert to 3D positions
    const startPos = this.geoToGlobePosition(
      startPoint.latitude,
      startPoint.longitude,
    );
    const endPos = this.geoToGlobePosition(
      endPoint.latitude,
      endPoint.longitude,
    );

    // Create simple line geometry
    const geometry = new THREE.BufferGeometry().setFromPoints([
      startPos,
      endPos,
    ]);

    // Create material with species color - BRIGHTER and THICKER
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00, // Bright yellow for maximum visibility
      opacity: 1.0,
      transparent: false,
      linewidth: 5,
      depthTest: false, // Render on top
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    line.name = `${path.id}-line`;
    line.userData = { path, type: 'migration-path' };
    line.frustumCulled = false; // Disable frustum culling
    line.renderOrder = 1000; // Very high render order

    this.pathGroup.add(line);
    this.pathGeometries.set(path.id, geometry);
  }

  /**
   * Create start and end markers for migration path
   */
  private createStartEndMarkers(path: MigrationPath): void {
    if (!this.pathGroup || path.points.length < 2) return;

    const startPoint = path.points[0];
    const endPoint = path.points[path.points.length - 1];

    // Create start marker (green sphere) - MUCH LARGER for visibility
    const startPos = this.geoToGlobePosition(
      startPoint.latitude,
      startPoint.longitude,
      2.05,
    );
    const startGeometry = new THREE.SphereGeometry(0.15, 32, 32); // Much larger and detailed
    const startMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Bright green
      transparent: false,
      depthTest: false, // Render on top
      depthWrite: false,
    });

    const startMarker = new THREE.Mesh(startGeometry, startMaterial);
    startMarker.position.copy(startPos);
    startMarker.name = `${path.id}-start`;
    startMarker.userData = {
      type: 'start-marker',
      path: path,
      point: startPoint,
      label: `Start: ${startPoint.metadata.locality || 'Unknown location'}`,
    };
    startMarker.frustumCulled = false; // Disable frustum culling
    startMarker.renderOrder = 1000; // Very high render order

    // Create end marker (red sphere) - MUCH LARGER for visibility
    const endPos = this.geoToGlobePosition(
      endPoint.latitude,
      endPoint.longitude,
      2.05,
    );
    const endGeometry = new THREE.SphereGeometry(0.15, 32, 32); // Much larger and detailed
    const endMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Bright red
      transparent: false,
      depthTest: false, // Render on top
      depthWrite: false,
    });

    const endMarker = new THREE.Mesh(endGeometry, endMaterial);
    endMarker.position.copy(endPos);
    endMarker.name = `${path.id}-end`;
    endMarker.userData = {
      type: 'end-marker',
      path: path,
      point: endPoint,
      label: `End: ${endPoint.metadata.locality || 'Unknown location'}`,
    };
    endMarker.frustumCulled = false; // Disable frustum culling
    endMarker.renderOrder = 1000; // Very high render order

    this.pathGroup.add(startMarker);
    this.pathGroup.add(endMarker);

    // Create animated bird marker
    this.createBirdMarker(path);

    this.logger.debug(`✅ Created start/end markers for ${path.species}`);
    this.logger.debug(`📍 Start marker at:`, startMarker.position);
    this.logger.debug(`📍 End marker at:`, endMarker.position);
    this.logger.debug(
      `📍 Start marker distance from camera:`,
      startMarker.position.length(),
    );
    this.logger.debug(`🔍 Start marker layers:`, startMarker.layers.mask);
    this.logger.debug(`🔍 Start marker renderOrder:`, startMarker.renderOrder);
    this.logger.debug(
      `🔍 Start marker frustumCulled:`,
      startMarker.frustumCulled,
    );
    this.logger.debug(
      `🗂️ PathGroup children count:`,
      this.pathGroup.children.length,
    );
    this.logger.debug(`👁️ PathGroup visible:`, this.pathGroup.visible);
    this.logger.debug(`👁️ Start marker visible:`, startMarker.visible);
    this.logger.debug(`👁️ End marker visible:`, endMarker.visible);
    this.logger.debug(
      `🌍 PathGroup in scene:`,
      this.scene?.children.includes(this.pathGroup),
    );

    // CRITICAL DEBUG: Check if markers are within camera frustum
    if (this.scene?.children) {
      const camera = this.scene.children.find(
        (child) => child.type === 'PerspectiveCamera',
      ) as THREE.PerspectiveCamera | undefined;
      if (camera) {
        this.logger.debug('📷 Camera position:', camera.position);
        this.logger.debug('📷 Camera far plane:', camera.far);
      }
    }
  }

  /**
   * Create animated bird marker for migration path
   */
  private createBirdMarker(path: MigrationPath): void {
    if (!this.pathGroup || path.points.length < 2) return;

    // Create bird icon geometry (small diamond/plane shape)
    const geometry = new THREE.ConeGeometry(0.01, 0.03, 4);
    const material = new THREE.MeshBasicMaterial({
      color: path.color,
      transparent: true,
      opacity: 0.9,
    });

    const birdMarker = new THREE.Mesh(geometry, material);

    // Position at start initially
    const startPoint = path.points[0];
    const startPos = this.geoToGlobePosition(
      startPoint.latitude,
      startPoint.longitude,
      2.03,
    );
    birdMarker.position.copy(startPos);

    // Point the cone towards the end point initially
    const endPoint = path.points[path.points.length - 1];
    const endPos = this.geoToGlobePosition(
      endPoint.latitude,
      endPoint.longitude,
      2.03,
    );
    birdMarker.lookAt(endPos);

    birdMarker.name = `${path.id}-bird`;
    birdMarker.userData = {
      type: 'bird-marker',
      path: path,
      animationProgress: 0,
      startPos: startPos.clone(),
      endPos: endPos.clone(),
    };

    this.pathGroup.add(birdMarker);
    this.birdMarkers.set(path.id, birdMarker);

    this.logger.debug(`✅ Created animated bird marker for ${path.species}`);
  }

  /**
   * Update bird marker position based on animation progress (0-1)
   */
  updateBirdMarkerPosition(pathId: string, progress: number): void {
    const birdMarker = this.birdMarkers.get(pathId);
    if (!birdMarker) return;

    const userData = birdMarker.userData;
    const { startPos, endPos } = userData;

    // Linear interpolation between start and end
    const currentPos = startPos.clone().lerp(endPos, progress);
    birdMarker.position.copy(currentPos);

    // Update direction to face movement direction
    if (progress > 0 && progress < 1) {
      const nextProgress = Math.min(progress + 0.01, 1);
      const nextPos = startPos.clone().lerp(endPos, nextProgress);
      birdMarker.lookAt(nextPos);
    }

    userData['animationProgress'] = progress;
  }

  /**
   * Animate all bird markers (called from render loop)
   * Only runs auto-animation when not controlled by timeline
   */
  animateBirdMarkers(deltaTime: number): void {
    if (!this._isInitialized()) return;

    // Check if timeline is controlling the animation
    const timelineControlled = this.activeAnimations.size > 0;

    if (!timelineControlled) {
      // Auto-animation mode when no timeline control
      this.birdMarkers.forEach((birdMarker, pathId) => {
        const userData = birdMarker.userData;
        let progress = userData['animationProgress'] || 0;

        // Simple auto-animation (moves from start to end in 10 seconds)
        progress += deltaTime * 0.1; // 10 second duration

        if (progress >= 1) {
          progress = 0; // Loop back to start
        }

        this.updateBirdMarkerPosition(pathId, progress);
      });
    }
  }

  /**
   * Create Three.js geometry for a single migration path
   */
  private createPathGeometry(path: MigrationPath): THREE.BufferGeometry {
    const lodConfig = this.LOD_CONFIG[this._currentLOD()];
    const points: THREE.Vector3[] = [];

    // Convert geographic coordinates to 3D globe positions
    path.points.forEach((point) => {
      const position = this.geoToGlobePosition(point.latitude, point.longitude);
      points.push(position);
    });

    // Create smooth curve if we have enough resolution
    let curvePoints: THREE.Vector3[];
    if (lodConfig.segmentResolution > points.length) {
      curvePoints = points;
    } else {
      // Create spline curve for smooth paths
      const curve = new THREE.CatmullRomCurve3(points);
      curvePoints = curve.getPoints(lodConfig.segmentResolution);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

    // Add attributes for animation
    const distances = new Float32Array(curvePoints.length);
    let totalDistance = 0;

    for (let i = 1; i < curvePoints.length; i++) {
      const distance = curvePoints[i].distanceTo(curvePoints[i - 1]);
      totalDistance += distance;
      distances[i] = totalDistance;
    }

    // Normalize distances
    distances.forEach((_, index) => {
      distances[index] = distances[index] / totalDistance;
    });

    geometry.setAttribute('distance', new THREE.BufferAttribute(distances, 1));

    return geometry;
  }

  /**
   * Create material for migration path
   */
  private createPathMaterial(path: MigrationPath): THREE.LineBasicMaterial {
    return new THREE.LineBasicMaterial({
      color: path.color,
      opacity: 0.6 + path.intensity * 0.4, // 0.6 to 1.0 based on intensity
      transparent: true,
      linewidth: Math.max(1, path.intensity * 3), // 1 to 3 pixels
    });
  }

  /**
   * Convert geographic coordinates to 3D globe position
   */
  private geoToGlobePosition(
    latitude: number,
    longitude: number,
    radius: number = 2.02,
  ): THREE.Vector3 {
    // Earth mesh radius is 1.98, so we use 2.02 to place paths slightly above the surface
    const phi = (90 - latitude) * (Math.PI / 180);
    const theta = (longitude + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Get color for species (deterministic based on species name)
   */
  private getSpeciesColor(species: string): THREE.Color {
    // Create deterministic color based on species name hash
    let hash = 0;
    for (let i = 0; i < species.length; i++) {
      hash = (hash << 5) - hash + species.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    const hue = Math.abs(hash % 360) / 360;
    const saturation = 0.7 + Math.abs(hash % 30) / 100; // 0.7-1.0
    const lightness = 0.5 + Math.abs(hash % 20) / 100; // 0.5-0.7

    return new THREE.Color().setHSL(hue, saturation, lightness);
  }

  /**
   * Initialize particle system for enhanced visual effects
   */
  private initializeParticleSystem(): void {
    if (!this.scene) return;

    const lodConfig = this.LOD_CONFIG[this._currentLOD()];
    const particleCount = lodConfig.particleCount;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // CRITICAL FIX: Initialize all arrays to prevent uninitialized GPU memory
    positions.fill(0);
    colors.fill(0);
    sizes.fill(0);

    for (let i = 0; i < particleCount; i++) {
      // Random positions on globe surface
      const phi = Math.random() * Math.PI;
      const theta = Math.random() * Math.PI * 2;
      const radius = 5.1;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      // Random colors
      colors[i * 3] = Math.random();
      colors[i * 3 + 1] = Math.random();
      colors[i * 3 + 2] = Math.random();

      sizes[i] = Math.random() * 2 + 1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.particleSystem.name = 'migration-particles';
    this.particleSystem.visible = false; // Start hidden until migration data loads
    this.scene.add(this.particleSystem);
  }

  /**
   * Create animation for migration path
   */
  private createPathAnimation(path: MigrationPath, mesh: THREE.Line): void {
    if (!this.animationMixer) return;

    try {
      // Create timeline for path visibility
      const duration =
        (path.timeRange.end.getTime() - path.timeRange.start.getTime()) / 1000; // seconds

      const times = [0, duration * 0.1, duration * 0.9, duration];
      const opacityValues = [0, 1, 1, 0];

      const opacityTrack = new THREE.NumberKeyframeTrack(
        `${mesh.name}.material.opacity`,
        times,
        opacityValues,
      );

      const clip = new THREE.AnimationClip(`${path.id}-timeline`, duration, [
        opacityTrack,
      ]);
      const action = this.animationMixer.clipAction(clip, mesh);

      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;

      this.activeAnimations.set(path.id, action);
    } catch (error) {
      this.logger.warn(
        `⚠️ Failed to create animation for path ${path.id}:`,
        error,
      );
    }
  }

  /**
   * Update particle positions based on current time
   */
  private updateParticlePositions(currentDate: Date, progress: number): void {
    if (!this.particleSystem) return;

    // Animate particles along active migration paths
    const positionAttribute = this.particleSystem.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;

    if (positionAttribute) {
      positionAttribute.needsUpdate = true;
    }
  }

  /**
   * Update particle animation
   */
  private updateParticleAnimation(deltaTime: number): void {
    if (!this.particleSystem) return;

    // Rotate particle system slowly
    this.particleSystem.rotation.y += deltaTime * 0.1;
  }

  /**
   * Clear existing paths from scene
   */
  private clearExistingPaths(): void {
    if (!this.pathGroup) return;

    // Remove all path meshes
    const pathsToRemove = this.pathGroup.children.slice();
    pathsToRemove.forEach((child) => {
      this.pathGroup!.remove(child);

      if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Clear tracking maps
    this.pathGeometries.clear();
    this.activeAnimations.clear();
    this.birdMarkers.clear();
  }

  /**
   * Initialize custom shaders for enhanced effects
   */
  private initializeShaders(): void {
    // Custom vertex shader for migration paths
    const migrationVertexShader = `
      attribute float distance;
      varying float vDistance;

      void main() {
        vDistance = distance;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Custom fragment shader for migration paths
    const migrationFragmentShader = `
      uniform float time;
      uniform float opacity;
      varying float vDistance;

      void main() {
        float alpha = opacity * (1.0 - abs(vDistance - mod(time, 1.0)));
        gl_FragColor = vec4(1.0, 0.5, 0.2, alpha);
      }
    `;

    // Store shaders for later use
    this._customShaders = {
      vertex: migrationVertexShader,
      fragment: migrationFragmentShader,
    };
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    this.performanceMonitor.lastFrameTime = performance.now();
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(): void {
    const now = performance.now();
    this.performanceMonitor.frameCount++;

    if (
      now - this.performanceMonitor.lastFrameTime >=
      this.performanceMonitor.fpsUpdateInterval
    ) {
      const fps = Math.round(
        (this.performanceMonitor.frameCount * 1000) /
          (now - this.performanceMonitor.lastFrameTime),
      );

      // Update LOD based on performance
      this.updateLOD(fps, this.migrationPaths.length);

      // Update render stats
      this._renderStats.set({
        activePaths: this.pathGeometries.size,
        totalPoints: this.migrationPaths.reduce(
          (sum, path) => sum + path.points.length,
          0,
        ),
        frameRate: fps,
        memoryUsage: this.estimateMemoryUsage(),
        lastUpdate: new Date(),
      });

      // Reset counters
      this.performanceMonitor.frameCount = 0;
      this.performanceMonitor.lastFrameTime = now;
    }
  }

  /**
   * Update render statistics
   */
  private updateRenderStats(): void {
    this._renderStats.set({
      activePaths: this.pathGeometries.size,
      totalPoints: this.migrationPaths.reduce(
        (sum, path) => sum + path.points.length,
        0,
      ),
      frameRate: this._renderStats().frameRate,
      memoryUsage: this.estimateMemoryUsage(),
      lastUpdate: new Date(),
    });
  }

  /**
   * Set tooltip callback for hover interactions
   */
  setTooltipCallback(
    callback: (tooltip: string | null, x: number, y: number) => void,
  ): void {
    this.tooltipCallback = callback;
  }

  /**
   * Handle mouse move for tooltips and hover effects
   */
  onMouseMove(
    event: MouseEvent,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
  ): void {
    if (!this.scene || !this.pathGroup) return;

    // Calculate mouse position in normalized device coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, camera);

    // Check for intersections with migration markers
    const intersects = this.raycaster.intersectObjects(
      this.pathGroup.children,
      true,
    );

    if (intersects.length > 0) {
      const intersected = intersects[0];
      const userData = intersected.object.userData;

      if (userData && userData['type']) {
        let tooltipText = '';

        switch (userData['type']) {
          case 'start-marker':
            tooltipText = `🟢 Migration Start\n${userData['label']}\n${userData['point'].date.toLocaleDateString()}`;
            break;
          case 'end-marker':
            tooltipText = `🔴 Migration End\n${userData['label']}\n${userData['point'].date.toLocaleDateString()}`;
            break;
          case 'bird-marker':
            const progress = Math.round(userData['animationProgress'] * 100);
            tooltipText = `🦅 ${userData['path'].species}\nProgress: ${progress}%`;
            break;
          case 'migration-path':
            const pointCount = userData['path'].points.length;
            const timespan = Math.round(
              (userData['path'].timeRange.end.getTime() -
                userData['path'].timeRange.start.getTime()) /
                (1000 * 60 * 60 * 24),
            );
            tooltipText = `✈️ Migration Path\n${userData['path'].species}\n${pointCount} observations over ${timespan} days`;
            break;
        }

        if (tooltipText && this.tooltipCallback) {
          this.tooltipCallback(tooltipText, event.clientX, event.clientY);
        }
        return;
      }
    }

    // No intersection - hide tooltip
    if (this.tooltipCallback) {
      this.tooltipCallback(null, 0, 0);
    }
  }

  /**
   * Handle mouse leave to hide tooltips
   */
  onMouseLeave(): void {
    if (this.tooltipCallback) {
      this.tooltipCallback(null, 0, 0);
    }
  }

  /**
   * Estimate memory usage of visualization
   */
  private estimateMemoryUsage(): number {
    let totalBytes = 0;

    // Estimate geometry memory
    this.pathGeometries.forEach((geometry) => {
      const positions = geometry.getAttribute('position');
      if (positions) {
        totalBytes += positions.array.length * 4; // 4 bytes per float
      }
    });

    // Estimate particle system memory
    if (this.particleSystem) {
      const positions = this.particleSystem.geometry.getAttribute('position');
      if (positions) {
        totalBytes += positions.array.length * 4;
      }
    }

    return Math.round(totalBytes / (1024 * 1024)); // Convert to MB
  }

  /**
   * Initialize method for compatibility with migration-viewer component
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.logger.debug('🎬 Initializing migration visualization with canvas');
    // This method is for compatibility - actual initialization happens in initializeVisualization
    this._isInitialized.set(true);
  }

  /**
   * Set visualization mode for compatibility
   */
  async setVisualizationMode(mode: string): Promise<void> {
    this.logger.debug('🎨 Setting visualization mode:', mode);
    // For simplified implementation, this is a no-op
  }

  /**
   * Get particle count for compatibility
   */
  getParticleCount(): number {
    return this.particleSystem ? 1000 : 0; // Return estimated particle count
  }

  /**
   * Set visibility for compatibility with globe component
   */
  setVisibility(visible: boolean): void {
    this.logger.debug(
      '👁️ Setting migration visualization visibility:',
      visible,
    );
    if (this.pathGroup) {
      this.pathGroup.visible = visible;
    }
  }
}
