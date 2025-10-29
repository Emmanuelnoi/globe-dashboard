import {
  Injectable,
  signal,
  inject,
  ElementRef,
  Injector,
  effect,
  runInInjectionContext,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Scene,
  Group,
  Object3D,
  Mesh,
  Material,
  Line,
  BufferGeometry,
  PerspectiveCamera,
} from 'three';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '@/core/services/logger.service';
import { NavigationStateService } from '@/core/services/navigation-state.service';
import { MigrationStateService } from '@/features/bird-migration/services/migration-state.service';
import { TourPlaybackService } from '@/features/bird-migration/services/tour-playback.service';
import { MigrationMarkersRenderer } from '@/features/bird-migration/rendering/migration-markers.renderer';
import { MigrationPathsRenderer } from '@/features/bird-migration/rendering/migration-paths.renderer';
import { PathParticlesRenderer } from '@/features/bird-migration/rendering/path-particles.renderer';
import {
  MarkerInteractionHandler,
  throttle,
} from '@/features/bird-migration/utils/marker-interaction.utils';
import type {
  MigrationRecord,
  Species,
} from '@/features/bird-migration/models/migration.types';

/**
 * Interface for migration renderers that expose Three.js Group objects
 */
interface RendererWithGroup {
  markerGroup?: Group;
  pathsGroup?: Group;
  particlesGroup?: Group;
}

/**
 * GlobeMigrationService
 *
 * Manages bird migration visualization integration with the globe.
 * Handles migration marker rendering, path visualization, particle effects,
 * and user interaction with migration data.
 *
 * Responsibilities:
 * - Initialize migration visualization system
 * - Manage migration renderers (markers, paths, particles)
 * - Handle marker click and hover interactions
 * - Toggle migration visibility based on navigation state
 * - Coordinate with TourPlaybackService for guided tours
 * - Load and manage migration data from GBIF
 * - Debug scene objects for migration elements
 */
@Injectable({
  providedIn: 'root',
})
export class GlobeMigrationService {
  private readonly logger = inject(LoggerService);
  private readonly http = inject(HttpClient);
  private readonly navigationStateService = inject(NavigationStateService);
  private readonly migrationState = inject(MigrationStateService);
  private readonly tourPlaybackService = inject(TourPlaybackService);
  private readonly injector = inject(Injector);

  // Migration renderers
  private markersRenderer?: MigrationMarkersRenderer;
  private pathsRenderer?: MigrationPathsRenderer;
  private particlesRenderer?: PathParticlesRenderer;
  private markerInteractionHandler?: MarkerInteractionHandler;
  private throttledMouseMove?: ReturnType<typeof throttle>;

  // Scene references (set during initialization)
  private scene?: Scene;
  private camera?: PerspectiveCamera;
  private atmosphereMesh?: Mesh;

  // Signals for reactive state
  readonly isInitialized = signal(false);
  readonly migrationTooltipPosition = signal<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  readonly hoveredMarkerType = signal<string>('');

  /**
   * Initialize the migration visualization system
   *
   * @param scene - Three.js scene to add migration objects to
   * @param camera - Camera for raycasting marker interactions
   * @param container - HTML container for event listeners
   * @param atmosphereMesh - Optional atmosphere mesh to keep visible during migration mode
   * @returns Promise that resolves when migration system is initialized
   */
  async initialize(
    scene: Scene,
    camera: PerspectiveCamera,
    container: ElementRef<HTMLDivElement>,
    atmosphereMesh?: Mesh,
  ): Promise<void> {
    try {
      // this.logger.debug(
      //   '🐦 Initializing migration system...',
      //   'GlobeMigrationService',
      // );

      // Store references
      this.scene = scene;
      this.camera = camera;
      this.atmosphereMesh = atmosphereMesh;

      // Initialize TourPlaybackService with scene and camera
      this.tourPlaybackService.initialize(scene, camera);

      // Load sample migration data
      const data = await firstValueFrom(
        this.http.get<{ migrations: MigrationRecord[]; species: Species[] }>(
          '/assets/data/sample-migrations.json',
        ),
      );

      // Load data into state service
      this.migrationState.loadMigrationData(data.migrations, data.species);
      // this.logger.debug(
      //   `✅ Loaded ${data.migrations.length} migrations, ${data.species.length} species`,
      //   'GlobeMigrationService',
      // );

      // Initialize renderers
      this.markersRenderer = new MigrationMarkersRenderer(scene);
      this.pathsRenderer = new MigrationPathsRenderer(
        scene,
        this.migrationState,
      );
      this.particlesRenderer = new PathParticlesRenderer(
        scene,
        this.migrationState,
      );

      // Initialize interaction handler
      this.markerInteractionHandler = new MarkerInteractionHandler(
        camera,
        container.nativeElement,
      );

      // Setup event listeners for marker interaction
      this.setupEventListeners(container);

      // Setup effects for reactive updates
      this.setupEffects();

      this.isInitialized.set(true);
      // this.logger.success(
      //   '✅ Migration system initialized',
      //   'GlobeMigrationService',
      // );
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize migration system:',
        error,
        'GlobeMigrationService',
      );
      throw error;
    }
  }

  /**
   * Setup event listeners for marker interaction (only active in bird migration mode)
   */
  private setupEventListeners(container: ElementRef<HTMLDivElement>): void {
    // Throttled mouse move for hover detection
    this.throttledMouseMove = throttle((e: unknown) => {
      // Only handle migration interactions in bird migration mode
      if (!this.navigationStateService.isBirdMigrationActive()) {
        return;
      }

      const event = e as MouseEvent;
      this.markerInteractionHandler!.handleMouseMove(
        event.clientX,
        event.clientY,
        this.markersRenderer!.getMarkerSprites(),
        (id) => {
          this.migrationState.setHoveredMarker(id);
          if (id) {
            this.migrationTooltipPosition.set({
              x: event.clientX,
              y: event.clientY,
            });
            const marker = this.migrationState
              .markers()
              .find((m) => m.id === id);
            this.hoveredMarkerType.set(marker?.type || '');
          }
        },
      );
    }, 100);

    container.nativeElement.addEventListener(
      'mousemove',
      this.throttledMouseMove as EventListener,
    );

    // Click handler for marker selection
    container.nativeElement.addEventListener('click', (e: MouseEvent) => {
      // Only handle migration clicks in bird migration mode
      if (!this.navigationStateService.isBirdMigrationActive()) {
        return;
      }

      this.logger.debug(
        '🖱️ CLICK EVENT - Bird Migration mode active',
        'GlobeMigrationService',
      );
      this.logger.debug(
        '📊 Scene objects BEFORE click:',
        'GlobeMigrationService',
      );
      this.debugSceneObjects();

      this.markerInteractionHandler!.handleClick(
        e.clientX,
        e.clientY,
        this.markersRenderer!.getMarkerSprites(),
        (id) => {
          this.logger.debug('✅ Marker clicked:', id, 'GlobeMigrationService');
          // Handle marker click - this will add the migration path and update info card
          if (typeof this.migrationState.handleMarkerClick === 'function') {
            this.migrationState.handleMarkerClick(id);
          }

          this.logger.debug(
            '📊 Scene objects AFTER marker click:',
            'GlobeMigrationService',
          );
          this.debugSceneObjects();
        },
      );
    });
  }

  /**
   * Setup Angular effects for reactive updates
   */
  private setupEffects(): void {
    runInInjectionContext(this.injector, () => {
      // Watch navigation state and toggle marker visibility
      effect(() => {
        const isBirdMigrationActive =
          this.navigationStateService.isBirdMigrationActive();
        this.toggleMigrationVisibility(isBirdMigrationActive);
      });

      // Effect to update markers when marker data changes
      effect(() => {
        const markers = this.migrationState.markers();
        // this.logger.debug(
        //   `🎯 Markers changed (${markers.length}), updating renderer`,
        //   'GlobeMigrationService',
        // );
        if (this.markersRenderer) {
          this.markersRenderer.updateMarkers(markers);
        }
      });

      // Effect to update paths when active paths change
      effect(() => {
        const activePaths = this.migrationState.activePaths();
        // this.logger.debug(
        //   `🎨 Active paths changed (${activePaths.length}), updating renderers`,
        //   'GlobeMigrationService',
        // );

        // if (activePaths.length === 0) {
        //   this.logger.debug(
        //     '🧹 NO ACTIVE PATHS - All paths should be removed from scene',
        //     'GlobeMigrationService',
        //   );
        // }

        if (this.pathsRenderer) {
          this.pathsRenderer.updatePaths(activePaths);
          // this.logger.debug(
          //   `✅ Paths renderer updated`,
          //   'GlobeMigrationService',
          // );
        }
        if (this.particlesRenderer) {
          this.particlesRenderer.updateParticleSystems(activePaths);
          // this.logger.debug(
          //   `✅ Particles renderer updated`,
          //   'GlobeMigrationService',
          // );
        }
      });
    });
  }

  /**
   * Toggle visibility of migration markers based on navigation state
   *
   * @param visible - True to show migration visualizations, false to hide
   */
  private toggleMigrationVisibility(visible: boolean): void {
    // Toggle markers visibility
    if (this.markersRenderer) {
      const markerGroup = this.markersRenderer.getMarkerGroup();
      if (markerGroup) {
        markerGroup.visible = visible;
      }
    }

    // Toggle paths visibility
    if (this.pathsRenderer) {
      const pathGroup = this.pathsRenderer.getPathGroup();
      if (pathGroup) {
        pathGroup.visible = visible;
      }
    }

    // Toggle particles visibility
    if (this.particlesRenderer) {
      const particleGroup = this.particlesRenderer.getParticleGroup();
      if (particleGroup) {
        particleGroup.visible = visible;
      }
    }

    // Keep atmosphere visible for migration mode (globe needs the glow!)
    if (this.atmosphereMesh) {
      this.atmosphereMesh.visible = true;
    }

    // this.logger.debug(
    //   `🔄 Migration visibility toggled: ${visible} (markers, paths, particles)`,
    //   'GlobeMigrationService',
    // );
  }

  /**
   * Debug function to log all scene objects with details
   */
  private debugSceneObjects(): void {
    if (!this.scene) return;

    this.logger.debug(
      `Total scene children: ${this.scene.children.length}`,
      'GlobeMigrationService',
    );
    this.scene.children.forEach((child, index: number) => {
      this.logger.debug(
        `  [${index}] ${child.name || child.type} - visible: ${child.visible}, type: ${child.type}`,
        'GlobeMigrationService',
      );

      if (child.type === 'Group') {
        const group = child as Group;
        this.logger.debug(
          `      └─ ${group.children.length} children in group`,
          'GlobeMigrationService',
        );
        group.children.forEach((groupChild: Object3D, gIndex: number) => {
          if (groupChild.type === 'Mesh') {
            const mesh = groupChild as Mesh;
            const geometry = mesh.geometry;
            const material = mesh.material as Material;
            const scale = mesh.scale;
            const pos = mesh.position;

            let geometryInfo = geometry.type;
            if (geometry.type === 'SphereGeometry') {
              const sphereGeo = geometry as unknown as {
                parameters: { radius: number };
              };
              geometryInfo = `SphereGeometry(radius: ${sphereGeo.parameters.radius.toFixed(3)})`;
            }

            this.logger.debug(
              `        [${gIndex}] ${groupChild.name || 'Mesh'}`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Geometry: ${geometryInfo}`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Material: ${material.type}, visible: ${groupChild.visible}`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Scale: (${scale.x.toFixed(3)}, ${scale.y.toFixed(3)}, ${scale.z.toFixed(3)})`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`,
              'GlobeMigrationService',
            );
          } else if (groupChild.type === 'Sprite') {
            const scale = groupChild.scale;
            const pos = groupChild.position;
            this.logger.debug(
              `        [${gIndex}] ${groupChild.name || 'Sprite'} - visible: ${groupChild.visible}`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Scale: (${scale.x.toFixed(3)}, ${scale.y.toFixed(3)})`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`,
              'GlobeMigrationService',
            );
          } else if (groupChild.type === 'Line') {
            const line = groupChild as Line;
            const geometry = line.geometry as BufferGeometry;
            const pos = groupChild.position;
            this.logger.debug(
              `        [${gIndex}] ${groupChild.name || 'Line'} - visible: ${groupChild.visible}`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Geometry: ${geometry.type}, points: ${geometry.attributes['position']?.count || 0}`,
              'GlobeMigrationService',
            );
            this.logger.debug(
              `            Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`,
              'GlobeMigrationService',
            );
          }
        });
      } else if (child.type === 'Mesh') {
        const mesh = child as Mesh;
        const geometry = mesh.geometry;
        const scale = mesh.scale;

        let geometryInfo = geometry.type;
        if (geometry.type === 'SphereGeometry') {
          const sphereGeo = geometry as unknown as {
            parameters: { radius: number };
          };
          geometryInfo = `SphereGeometry(radius: ${sphereGeo.parameters.radius.toFixed(3)})`;
        }

        this.logger.debug(
          `      Geometry: ${geometryInfo}`,
          'GlobeMigrationService',
        );
        this.logger.debug(
          `      Scale: (${scale.x.toFixed(3)}, ${scale.y.toFixed(3)}, ${scale.z.toFixed(3)})`,
          'GlobeMigrationService',
        );
      }
    });
  }

  /**
   * Request render on next frame (to be called by globe component)
   */
  requestRender(): void {
    // This method is called by effects when migration data changes
    // The globe component should listen to this and trigger a render
  }

  /**
   * Animate migration visualizations (call from globe render loop)
   * @param deltaTime - Time since last frame in seconds
   */
  animate(deltaTime: number): void {
    if (!this.isInitialized()) {
      return;
    }

    // Animate markers (pulse effects, hover animations)
    this.markersRenderer?.animate(deltaTime);

    // Animate paths (draw progress animations)
    this.pathsRenderer?.animate(deltaTime);

    // Animate particles (movement along paths)
    this.particlesRenderer?.animate(deltaTime);
  }

  /**
   * Cleanup all migration resources and event listeners
   */
  cleanup(): void {
    this.logger.debug(
      '🧹 Cleaning up GlobeMigrationService',
      'GlobeMigrationService',
    );

    // Remove event listeners
    if (this.throttledMouseMove) {
      // Event listeners will be cleaned up by the component
      this.throttledMouseMove = undefined;
    }

    // Dispose renderers
    // Note: Renderers should have their own cleanup methods if needed

    this.isInitialized.set(false);
    this.logger.success(
      '✅ GlobeMigrationService cleaned up',
      'GlobeMigrationService',
    );
  }

  // Getters for external access
  getMarkersRenderer(): MigrationMarkersRenderer | undefined {
    return this.markersRenderer;
  }

  getPathsRenderer(): MigrationPathsRenderer | undefined {
    return this.pathsRenderer;
  }

  getParticlesRenderer(): PathParticlesRenderer | undefined {
    return this.particlesRenderer;
  }

  getMigrationTooltipPosition(): { x: number; y: number } {
    return this.migrationTooltipPosition();
  }

  getHoveredMarkerType(): string {
    return this.hoveredMarkerType();
  }
}
