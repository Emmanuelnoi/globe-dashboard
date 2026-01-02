import { LoggerService } from '@/core/services/logger.service';
import { MemoryManagementService } from '@/core/services/memory-management.service';
import { ElementRef, inject, Injectable, signal } from '@angular/core';
import { CountryIdTextureService } from '@lib/services/country-id-texture.service';
import { GlobeMigrationService } from './globe-migration.service';
import { getFresnelMat, getStarfield } from '@lib/utils';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * GlobeSceneService
 *
 * Manages Three.js scene setup, camera, renderer, lighting, atmosphere, and controls.
 * Handles the foundational 3D graphics infrastructure for the globe visualization.
 *
 * Responsibilities:
 * - Scene, camera, and renderer initialization
 * - Lighting and atmospheric effects
 * - OrbitControls setup and management
 * - Earth mesh creation with GPU-optimized materials
 * - Animation loop coordination
 * - WebGL capability detection
 * - Performance optimization (frame throttling)
 */
@Injectable({
  providedIn: 'root',
})
export class GlobeSceneService {
  private readonly logger = inject(LoggerService);
  private readonly memoryManager = inject(MemoryManagementService);
  private readonly countryIdTextureService = inject(CountryIdTextureService);
  private readonly globeMigrationService = inject(GlobeMigrationService);

  // Three.js core objects
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private renderer!: WebGLRenderer;
  private controls!: OrbitControls;
  private loader = new TextureLoader();

  // 3D meshes and objects
  private earthMesh?: Mesh;
  private atmosphereMesh?: Mesh;
  private starfield!: Points;
  private sphere!: LineSegments;
  private fresnelMat = getFresnelMat({
    rimHex: 0x0088ff, // Light blue matching rgb(0.3, 0.6, 1.0) 0x4d99ff 0x0088ff
    facingHex: 0x000000,
    fresnelBias: 0.1,
    fresnelScale: 0.9,
    fresnelPower: 4.5,
  });

  // Animation state
  private animationId?: number;
  private lastFrameTime = 0;
  private readonly frameInterval = 16.67; // Target 60fps
  private needsRender = true;
  private isAnimating = false;

  // Camera interaction state
  private cameraInteracting = false;
  private allowSelection = true;

  // Signals for reactive state
  readonly isInitialized = signal(false);
  readonly cameraInteractionState = signal<boolean>(false);

  /**
   * Check if WebGL is supported in the current browser
   */
  checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null && gl !== undefined;
    } catch (e) {
      this.logger.error('WebGL support check failed', e, 'GlobeSceneService');
      return false;
    }
  }

  /**
   * Initialize the complete scene with all components
   *
   * @param container - HTML container element for the renderer
   * @returns Promise that resolves when scene is fully initialized
   */
  async initialize(container: ElementRef<HTMLDivElement>): Promise<void> {
    // this.logger.debug('🌍 Initializing GlobeSceneService', 'GlobeSceneService');

    // Check WebGL support first
    if (!this.checkWebGLSupport()) {
      throw new Error('WebGL is not supported in this browser');
    }

    // Setup scene components in sequence
    await this.setupScene();

    // Load GPU selection assets
    await this.countryIdTextureService.loadCountryIdAssets();

    // Setup Earth mesh with GPU-optimized materials
    await this.setupEarthMesh();

    // Add lighting and atmosphere
    this.setupLighting();
    this.setupAtmosphere();

    // Setup renderer and controls
    this.setupRenderer(container);
    this.setupControls();

    this.isInitialized.set(true);
    // this.logger.success(
    //   '✅ GlobeSceneService initialized',
    //   'GlobeSceneService',
    // );
  }

  /**
   * Setup the basic Three.js scene with fog and starfield
   */
  private async setupScene(): Promise<void> {
    // this.logger.debug('🔧 Setting up scene...', 'GlobeSceneService');

    // Create scene with atmospheric fog
    this.scene = new Scene();
    this.scene.background = new Color(0x000814);
    this.scene.fog = new FogExp2(0x000814, 0.0025);

    // Setup camera
    this.camera = new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.z = 5;

    // Add starfield background
    this.starfield = getStarfield({ numStars: 2500 });
    this.scene.add(this.starfield);

    // this.logger.debug('✅ Scene setup complete', 'GlobeSceneService');
  }

  /**
   * Setup Earth mesh with textures and GPU-optimized materials
   */
  private async setupEarthMesh(): Promise<void> {
    // this.logger.debug('🌎 Setting up Earth mesh...', 'GlobeSceneService');

    const geometry = new SphereGeometry(1.98, 128, 128);

    // Load texture
    const earthBumpTexture = this.loader.load('/textures/earthbump1k.jpg');
    earthBumpTexture.colorSpace = SRGBColorSpace;

    const material = new MeshStandardMaterial({
      map: earthBumpTexture,
      color: 0xffffff, // White base color
      emissive: 0x222222, // Slight emission for better visibility
      emissiveIntensity: 0.3,
      roughness: 0.7,
      metalness: 0.0,
    });

    this.earthMesh = new Mesh(geometry, material);
    this.earthMesh.name = 'Earth';

    this.scene.add(this.earthMesh);

    // this.logger.debug('✅ Earth mesh created', 'GlobeSceneService');
  }

  /**
   * Setup lighting with ambient and directional lights
   */
  private setupLighting(): void {
    // this.logger.debug('💡 Setting up lighting...', 'GlobeSceneService');

    // Ambient light - balanced intensity for texture visibility
    const ambientLight = new AmbientLight(0xc2c2c2, 0.6); // Brighter gray for better texture visibility
    this.scene.add(ambientLight);

    // Directional light - simulate sunlight from one side
    const sunLight = new DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(5, 3, 2); // More realistic sun position
    sunLight.castShadow = false; // Disable shadows for performance
    this.scene.add(sunLight);

    // Add a subtle rim light from the opposite side
    const rimLight = new DirectionalLight(0x6699ff, 0.3);
    rimLight.position.set(-5, -2, -3);
    this.scene.add(rimLight);

    // this.logger.debug('✅ Lighting setup complete', 'GlobeSceneService');
  }

  /**
   * Setup atmospheric glow effect using Fresnel shader
   */
  private setupAtmosphere(): void {
    // this.logger.debug('🌫️ Setting up atmosphere...', 'GlobeSceneService');

    const atmosphereGeometry = new SphereGeometry(1.88, 64, 64);
    // const atmosphereGeometry = new SphereGeometry(1.98, 64, 64);

    this.atmosphereMesh = new Mesh(atmosphereGeometry, this.fresnelMat);
    this.atmosphereMesh.scale.set(1.06, 1.06, 1.06); // Subtle atmospheric glow
    this.scene.add(this.atmosphereMesh);

    // this.logger.debug('✅ Atmosphere setup complete', 'GlobeSceneService');
  }

  /**
   * Setup WebGL renderer with optimal settings
   *
   * @param container - HTML container for the canvas
   */
  private setupRenderer(container: ElementRef<HTMLDivElement>): void {
    // this.logger.debug('🎨 Setting up renderer...', 'GlobeSceneService');

    const nativeElement = container.nativeElement;
    // this.logger.debug(
    //   '📦 Renderer container dimensions:',
    //   {
    //     width: nativeElement.clientWidth,
    //     height: nativeElement.clientHeight,
    //     offsetWidth: nativeElement.offsetWidth,
    //     offsetHeight: nativeElement.offsetHeight,
    //   },
    //   'GlobeSceneService',
    // );

    // Create renderer with optimal settings
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp',
    });

    // Configure renderer
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      nativeElement.clientWidth,
      nativeElement.clientHeight,
    );
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Clear existing canvas if any
    const existingCanvas = nativeElement.querySelector('canvas');
    if (existingCanvas) {
      // this.logger.debug('🧹 Removing existing canvas', 'GlobeSceneService');
      existingCanvas.remove();
    }

    // Append canvas to container
    nativeElement.appendChild(this.renderer.domElement);

    // Add ARIA attributes to canvas for accessibility
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D globe visualization showing countries and data',
    );
    this.renderer.domElement.setAttribute('role', 'img');

    // this.logger.debug('✅ Renderer setup complete', 'GlobeSceneService');
  }

  /**
   * Setup OrbitControls for camera interaction
   */
  private setupControls(): void {
    // this.logger.debug('🎮 Setting up controls...', 'GlobeSceneService');

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Configure controls
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 15;
    this.controls.autoRotate = false;

    // Track camera interaction state
    this.controls.addEventListener('start', () => {
      this.cameraInteracting = true;
      this.allowSelection = false;
      this.cameraInteractionState.set(true);
    });

    this.controls.addEventListener('end', () => {
      this.cameraInteracting = false;
      // Small delay before allowing selection after camera stops
      setTimeout(() => {
        this.allowSelection = true;
      }, 100);
      this.cameraInteractionState.set(false);
    });

    this.controls.addEventListener('change', () => {
      this.needsRender = true;
    });

    // this.logger.debug('✅ Controls setup complete', 'GlobeSceneService');
  }

  /**
   * Start the animation loop
   */
  startAnimation(): void {
    if (this.isAnimating) return;

    this.isAnimating = true;
    // this.logger.debug('▶️ Starting animation loop', 'GlobeSceneService');
    this.animate();
  }

  /**
   * Stop the animation loop
   */
  stopAnimation(): void {
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
      this.isAnimating = false;
      this.logger.debug('⏸️ Animation loop stopped', 'GlobeSceneService');
    }
  }

  /**
   * Main animation loop with frame throttling and render-on-demand optimization
   */
  private animate(currentTime: number = 0): void {
    this.animationId = requestAnimationFrame((time) => this.animate(time));

    // Frame throttling for consistent 60fps
    const deltaTime = currentTime - this.lastFrameTime;
    if (deltaTime < this.frameInterval) {
      return;
    }

    // Calculate delta time in seconds for animations
    const deltaTimeSeconds = deltaTime / 1000.0;
    this.lastFrameTime = currentTime;

    // Update controls (this may set needsRender to true via 'change' event)
    this.controls.update();

    // Check if there are active migration animations
    const hasActiveMigrations =
      this.globeMigrationService.isInitialized() &&
      this.globeMigrationService.hasActiveAnimations();

    // Animate migration visualizations if they exist
    if (hasActiveMigrations) {
      this.globeMigrationService.animate(deltaTimeSeconds);
      this.needsRender = true; // Ensure we render when migrations are animating
    }

    // Only render when something changed OR migrations are animating
    if (this.needsRender || hasActiveMigrations) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  /**
   * Handle window resize events
   */
  onResize(): void {
    if (!this.camera || !this.renderer) return;

    const container = this.renderer.domElement.parentElement;
    if (!container) return;

    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.needsRender = true;

    this.logger.debug('📐 Scene resized', 'GlobeSceneService');
  }

  /**
   * Request a render on the next frame
   */
  requestRender(): void {
    this.needsRender = true;
  }

  /**
   * Enable/disable OrbitControls
   */
  setControlsEnabled(enabled: boolean): void {
    if (this.controls) {
      this.controls.enabled = enabled;
    }
  }

  /**
   * Cleanup all Three.js resources
   */
  cleanup(): void {
    this.logger.debug('🧹 Cleaning up GlobeSceneService', 'GlobeSceneService');

    this.stopAnimation();

    // Dispose controls
    if (this.controls) {
      this.controls.dispose();
    }

    // Dispose meshes
    if (this.earthMesh) {
      this.earthMesh.geometry.dispose();
      if (this.earthMesh.material) {
        if (Array.isArray(this.earthMesh.material)) {
          this.earthMesh.material.forEach((m) => m.dispose());
        } else {
          this.earthMesh.material.dispose();
        }
      }
    }

    if (this.atmosphereMesh) {
      this.atmosphereMesh.geometry.dispose();
      if (this.atmosphereMesh.material) {
        if (Array.isArray(this.atmosphereMesh.material)) {
          this.atmosphereMesh.material.forEach((m) => m.dispose());
        } else {
          this.atmosphereMesh.material.dispose();
        }
      }
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }

    // Clear scene
    if (this.scene) {
      this.scene.clear();
    }

    this.isInitialized.set(false);
    this.logger.success('✅ GlobeSceneService cleaned up', 'GlobeSceneService');
  }

  // Getters for external access
  getScene(): Scene | undefined {
    return this.scene;
  }
  getCamera(): PerspectiveCamera | undefined {
    return this.camera;
  }
  getRenderer(): WebGLRenderer | undefined {
    return this.renderer;
  }
  getControls(): OrbitControls | undefined {
    return this.controls;
  }
  getEarthMesh(): Mesh | undefined {
    return this.earthMesh;
  }
  getAllowSelection(): boolean {
    return this.allowSelection;
  }
  getCameraInteracting(): boolean {
    return this.cameraInteracting;
  }
}
