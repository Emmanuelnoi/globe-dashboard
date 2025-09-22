import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  HostListener,
  inject,
  signal,
  effect,
} from '@angular/core';
import {
  Scene,
  Color,
  FogExp2,
  PerspectiveCamera,
  TextureLoader,
  SphereGeometry,
  BackSide,
  Mesh,
  AmbientLight,
  DirectionalLight,
  ShaderMaterial,
  MeshStandardMaterial,
  AdditiveBlending,
  WebGLRenderer,
  SRGBColorSpace,
  LineSegments,
  Points,
  Group,
  Object3D,
  Material,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  getStarfield,
  getFresnelMat,
  loadGeoJSON,
  createInteractiveCountries,
  loadTopoJSON,
  createInteractiveCountriesFromTopo,
  disposeTopoJSONMeshes,
  CountrySelectionService,
  type TopoJSONRenderOptions,
} from '@lib/utils';
import { LoadingComponent } from '@/shared/components/loading/loading.component';
import { ErrorBoundaryComponent } from '@/shared/components/error-boundary/error-boundary.component';
import { GlobalErrorHandlerService } from '@/core/services/global-error-handler.service';
import { MemoryManagementService } from '@/core/services/memory-management.service';
import { GlobeErrorRecoveryService } from '@/core/services/globe-error-recovery.service';
import {
  AccessibilityService,
  CountryAccessibilityData,
} from '@/core/services/accessibility.service';
import { CountryIdTextureService } from '@lib/services/country-id-texture.service';
import { TooltipPosition } from '../../layout/component/country-tooltip/country-tooltip';
import { CountryDataService } from '../../core/services/country-data.service';
import { CountryDataRecord } from '../../core/types/country-data.types';
import { CountryHoverService } from '../../core/services/country-hover.service';
import { CountryNameTooltipComponent } from '../../shared/components/country-name-tooltip/country-name-tooltip';

@Component({
  selector: 'app-globe',
  imports: [
    CommonModule,
    LoadingComponent,
    ErrorBoundaryComponent,
    CountryNameTooltipComponent,
  ],
  template: `
    <app-error-boundary
      #errorBoundary
      [showDetails]="true"
      (onRetry)="handleRetry()"
    >
      @if (isLoading()) {
        <app-loading
          variant="globe"
          size="large"
          [loadingText]="loadingMessage()"
          [showProgress]="true"
          [progress]="loadingProgress()"
          [overlay]="true"
        />
      }

      <div
        #rendererContainer
        class="scene-container"
        role="application"
        [attr.aria-label]="accessibility.getGlobeAriaDescription()"
        [attr.aria-describedby]="
          isLoading() ? 'loading-status' : 'globe-status'
        "
        tabindex="0"
        (keydown)="onKeyDown($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
      >
        @if (initError()) {
          <div
            class="init-error"
            role="alert"
            aria-live="polite"
            id="globe-error"
          >
            <h3>Failed to initialize 3D scene</h3>
            <p>{{ initError() }}</p>
            <button
              (click)="retryInitialization()"
              class="retry-btn"
              aria-describedby="globe-error"
            >
              Try Again
            </button>
          </div>
        }

        <!-- Status for screen readers -->
        <div id="globe-status" class="sr-only" aria-live="polite">
          @if (!isLoading() && !initError()) {
            {{ accessibility.getGlobeAriaDescription() }}
          }
        </div>

        <div id="loading-status" class="sr-only" aria-live="polite">
          @if (isLoading()) {
            Loading: {{ loadingMessage() }} - {{ loadingProgress() }}% complete
          }
        </div>

        <!-- Keyboard shortcuts help -->
        <div id="keyboard-help" class="sr-only" aria-live="polite">
          @if (accessibility.isKeyboardMode()) {
            Current country:
            {{ accessibility.currentCountry() || 'None selected' }}. Use arrow
            keys to rotate, Tab to navigate countries, Enter to select.
          }
        </div>
      </div>

      <!-- Country Name Tooltip (on hover) -->
      <app-country-name-tooltip
        [visible]="countryNameTooltipVisible()"
        [countryName]="hoveredCountryName()"
        [position]="countryNameTooltipPosition()"
      />

      <!-- Fixed Position Country Details (on selection) -->
      @if (selectedCountry()) {
        <div class="fixed-country-details">
          <div class="fixed-country-card">
            <div class="country-header">
              <div class="country-name">{{ selectedCountry()?.name }}</div>
              <div class="country-code">{{ selectedCountry()?.code }}</div>
            </div>

            <div class="country-info">
              <div class="info-row">
                <span class="info-label">Capital:</span>
                <span class="info-value">{{ selectedCountry()?.capital }}</span>
              </div>

              <div class="info-row">
                <span class="info-label">Population:</span>
                <span class="info-value">{{
                  selectedCountry()?.populationFormatted
                }}</span>
              </div>

              <div class="info-row">
                <span class="info-label">GDP per capita:</span>
                <span class="info-value">{{
                  selectedCountry()?.gdpPerCapitaFormatted
                }}</span>
              </div>

              <div class="info-row">
                <span class="info-label">Life expectancy:</span>
                <span class="info-value">{{
                  selectedCountry()?.lifeExpectancyFormatted
                }}</span>
              </div>
            </div>
          </div>
        </div>
      }
    </app-error-boundary>
  `,
  styles: [
    `
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
      }

      .scene-container {
        position: fixed; /* Covers the entire viewport */
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: block;
        overflow: hidden;
      }

      .init-error {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 12px;
        padding: 2rem;
        color: #f8fafc;
        max-width: 400px;
      }

      .init-error h3 {
        margin: 0 0 1rem 0;
        color: #ef4444;
      }

      .init-error p {
        margin: 0 0 1.5rem 0;
        color: #cbd5e1;
        font-size: 0.875rem;
      }

      .retry-btn {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: transform 0.2s ease;
      }

      .retry-btn:hover {
        transform: translateY(-1px);
      }

      /* Screen reader only text */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Focus styles for accessibility */
      .scene-container:focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      /* Fixed position country details */
      .fixed-country-details {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        pointer-events: none;
        width: auto;
        height: auto;
      }

      .fixed-country-card {
        background: rgba(30, 41, 59, 0.8);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 16px;
        color: white;
        min-width: 280px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.3),
          0 0 0 1px rgba(255, 255, 255, 0.05);
        pointer-events: auto;
      }

      .fixed-country-card .country-header {
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .fixed-country-card .country-name {
        font-size: 18px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 4px;
      }

      .fixed-country-card .country-code {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        font-family: 'JetBrains Mono', 'Courier New', monospace;
      }

      .fixed-country-card .country-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .fixed-country-card .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
      }

      .fixed-country-card .info-label {
        color: rgba(255, 255, 255, 0.8);
        font-weight: 500;
      }

      .fixed-country-card .info-value {
        color: #00ff88;
        font-weight: 600;
        text-align: right;
      }
    `,
  ],
})
export class Globe implements AfterViewInit, OnDestroy {
  private errorHandler = inject(GlobalErrorHandlerService);
  private memoryManager = inject(MemoryManagementService);
  private errorRecovery = inject(GlobeErrorRecoveryService);
  protected accessibility = inject(AccessibilityService);
  private countryIdTextureService = inject(CountryIdTextureService);
  private countrySelectionService = inject(CountrySelectionService);
  private countryDataService = inject(CountryDataService);
  private countryHoverService = inject(CountryHoverService);
  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rendererContainer', { static: true })
  private rendererContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('errorBoundary')
  private errorBoundary!: ElementRef<ErrorBoundaryComponent>;

  // Loading and error states
  protected readonly isLoading = signal(true);
  protected readonly loadingProgress = signal(0);
  protected readonly loadingMessage = signal('Initializing 3D scene...');
  protected readonly initError = signal<string | null>(null);

  // Tooltip states
  protected readonly tooltipVisible = signal(false);
  protected readonly hoveredCountry = signal<CountryDataRecord | null>(null);
  protected readonly tooltipPosition = signal<TooltipPosition>({ x: 0, y: 0 });

  // Country name tooltip states (new improved tooltip)
  protected readonly countryNameTooltipVisible = signal(false);
  protected readonly hoveredCountryName = signal<string>('');
  protected readonly countryNameTooltipPosition = signal<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  // Selected country state (for fixed position detailed tooltip)
  protected readonly selectedCountry = signal<CountryDataRecord | null>(null);

  private camera!: PerspectiveCamera;
  private scene!: Scene;
  private renderer!: WebGLRenderer;
  private animationId?: number;
  private controls!: OrbitControls;
  private fresnelMat = getFresnelMat();

  // Performance optimization properties
  private lastFrameTime = 0;
  private frameInterval = 16.67; // Target 60fps
  private mouseEventThrottle = 50; // 50ms throttle for mouse events
  private lastMouseEvent = 0;
  private needsRender = true;
  private isAnimating = false;

  // Camera interaction state for preventing selection during camera movement
  private cameraInteracting = false;
  private allowSelection = true;

  // 3D objects
  private sphere!: LineSegments;
  private starfield!: Points;
  private countries!: Group;
  private loader!: TextureLoader;
  private earthMesh?: Mesh;
  private atmosphereMesh?: Mesh;
  private lastSelectedCountryMesh: Mesh | null = null;

  // Debug state

  // TopoJSON rendering configuration
  private useTopoJSON = true; // Toggle between GeoJSON and TopoJSON
  private renderingMode = signal<'geojson' | 'topojson'>('topojson');
  private topoJSONOptions: TopoJSONRenderOptions = {
    radius: 2,
    borderOffset: 0.001, // Slight offset to prevent z-fighting
    enableFillMeshes: true,
  };

  constructor() {
    // Setup effect for selection texture updates (needs to be in injection context)
    effect(() => {
      const selectedIds = this.countrySelectionService.selectedCountries();
      // Only update if the selection mask is initialized
      if (this.countryIdTextureService.getSelectionMaskTexture()) {
        this.countryIdTextureService.updateSelectionMask(selectedIds);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.initializeScene();

      // Initialize accessibility features after scene is ready
      this.accessibility.initialize();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  private async initializeScene(): Promise<void> {
    this.loadingMessage.set('Initializing 3D scene...');
    this.loadingProgress.set(10);

    // Check WebGL support
    if (!this.checkWebGLSupport()) {
      throw new Error('WebGL is not supported in this browser');
    }

    this.loadingProgress.set(20);
    this.loadingMessage.set('Setting up camera and scene...');

    // Initialize basic scene components
    await this.setupScene();

    this.loadingProgress.set(30);
    this.loadingMessage.set('Loading country selection assets...');

    // Load GPU selection assets first
    await this.countryIdTextureService.loadCountryIdAssets();

    this.loadingProgress.set(50);
    this.loadingMessage.set('Loading Earth textures...');

    // Load Earth mesh with GPU selection enabled
    await this.setupEarthMesh();

    this.loadingProgress.set(60);
    this.loadingMessage.set('Adding atmospheric effects...');

    // Add lighting and atmosphere
    this.setupLighting();
    this.setupAtmosphere();

    this.loadingProgress.set(80);
    this.loadingMessage.set('Initializing controls...');

    // Setup renderer and controls
    this.setupRenderer();
    this.setupControls();
    this.setupCountrySelectionInteractions();

    this.loadingProgress.set(90);
    this.loadingMessage.set('Loading geographic data...');

    // Load countries data
    await this.loadAllData();

    this.loadingProgress.set(100);
    this.loadingMessage.set('Complete!');

    // Small delay to show completion
    setTimeout(() => {
      this.isLoading.set(false);
    }, 500);
  }

  private checkWebGLSupport(): boolean {
    return this.errorRecovery.checkWebGLSupport();
  }

  private async setupScene(): Promise<void> {
    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    // Scene
    this.scene = new Scene();
    this.scene.background = new Color(0x000000); // Pure black background
    this.scene.fog = new FogExp2(0x000000, 0.002); // Much lighter fog effect

    // Camera
    this.camera = new PerspectiveCamera(75, width / height, 0.1, 100);
    this.camera.position.z = 5;
  }

  private async setupEarthMesh(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader = new TextureLoader();

      this.loader.load(
        '/textures/earthbump1k.jpg',
        // '/textures/earth2048.jpg',
        (texture) => {
          try {
            const geometry = new SphereGeometry(1.98, 64, 64); // Slightly smaller than countries (radius 2)

            // Create realistic Earth material
            const earthMaterial = new MeshStandardMaterial({
              map: texture,
              roughness: 0.8,
              metalness: 0.1,
              transparent: false,
            });

            const earthMesh = new Mesh(geometry, earthMaterial);
            earthMesh.name = 'earth';
            earthMesh.renderOrder = 0; // Ensure Earth renders first
            this.earthMesh = earthMesh; // Store reference for later use
            this.scene.add(earthMesh);

            console.log('✅ Earth texture loaded with realistic world map');
            resolve();
          } catch (error) {
            reject(new Error(`Failed to create Earth mesh: ${error}`));
          }
        },
        undefined, // onProgress
        (error) => {
          reject(new Error(`Failed to load Earth texture: ${error}`));
        },
      );
    });
  }

  private setupLighting(): void {
    // Ambient light - much lower intensity to preserve texture details
    const ambientLight = new AmbientLight(0x404040, 0.2); // Dimmer gray ambient light
    this.scene.add(ambientLight);

    // Directional light - simulate sunlight from one side
    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 3, 2); // More realistic sun position
    directionalLight.castShadow = false; // Disable shadows for performance
    this.scene.add(directionalLight);

    // Add a subtle rim light from the opposite side
    const rimLight = new DirectionalLight(0x6699ff, 0.1);
    rimLight.position.set(-5, -2, -3);
    this.scene.add(rimLight);
  }

  private setupAtmosphere(): void {
    try {
      // Enhanced starfield background
      this.starfield = getStarfield({ numStars: 2000 });
      this.scene.add(this.starfield);

      // Create a subtle atmosphere glow effect
      const atmosphereGeometry = new SphereGeometry(2.1, 64, 64);
      const atmosphereMaterial = new ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.8 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
            gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
          }
        `,
        blending: AdditiveBlending,
        side: BackSide,
        transparent: true,
      });

      const atmosphereMesh = new Mesh(atmosphereGeometry, atmosphereMaterial);
      atmosphereMesh.name = 'atmosphere';
      this.scene.add(atmosphereMesh);
    } catch (error) {
      this.errorHandler.handleWebGLError(error as Error, 'atmosphere_setup');
      // Non-critical error, continue without atmosphere
      console.warn('Failed to setup atmosphere effects:', error);
    }
  }

  private setupRenderer(): void {
    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    try {
      // Check device capabilities for optimal settings
      const capabilities = this.errorRecovery.getDeviceCapabilities();

      this.renderer = new WebGLRenderer({
        antialias: !capabilities.isLowEnd, // Disable antialias on low-end devices
        alpha: false, // Disable alpha for better performance and pure black background
        powerPreference: capabilities.isLowEnd
          ? 'low-power'
          : 'high-performance',
        preserveDrawingBuffer: false, // Better performance
        stencil: false, // Not needed for this application
      });

      this.renderer.setSize(width, height);

      // Adaptive pixel ratio based on device capabilities
      const pixelRatio = capabilities.isLowEnd
        ? Math.min(window.devicePixelRatio, 1.5)
        : Math.min(window.devicePixelRatio, 2);
      this.renderer.setPixelRatio(pixelRatio);

      this.renderer.setClearColor(0x000000, 1.0); // Ensure black background
      this.renderer.outputColorSpace = SRGBColorSpace; // Better color accuracy

      // Performance optimizations
      this.renderer.info.autoReset = false; // Manual reset for better performance monitoring

      // Setup error prevention measures
      this.errorRecovery.setupErrorPrevention(this.renderer);

      // Setup WebGL context loss handling
      const canvas = this.renderer.domElement;
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        console.warn('🚨 WebGL context lost');
        this.errorRecovery.handleWebGLContextLoss(canvas, () =>
          this.reinitializeScene(),
        );
      });

      canvas.addEventListener('webglcontextrestored', () => {
        console.log('✅ WebGL context restored');
      });

      // Add canvas to DOM
      this.rendererContainer.nativeElement.appendChild(canvas);

      // Track renderer for memory management
      this.memoryManager.track(this.renderer);

      // Start optimized animation loop
      this.animate = this.animate.bind(this);
      this.renderer.setAnimationLoop(this.animate);

      // Initial render
      this.needsRender = true;

      console.log('✅ Renderer initialized successfully', {
        capabilities,
        pixelRatio,
        antialias: !capabilities.isLowEnd,
      });
    } catch (error) {
      this.errorRecovery.handleRendererError(error as Error);
      throw new Error(`Failed to initialize WebGL renderer: ${error}`);
    }
  }

  /**
   * Reinitialize the entire scene (for context loss recovery)
   */
  private async reinitializeScene(): Promise<void> {
    try {
      console.log('🔄 Reinitializing scene after context loss...');

      // Clear current state
      this.cleanup();

      // Reinitialize everything
      await this.initializeScene();

      console.log('✅ Scene reinitialized successfully');
    } catch (error) {
      console.error('❌ Failed to reinitialize scene:', error);
      this.handleInitializationError(error);
    }
  }

  private setupControls(): void {
    try {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05; // Smoother damping
      this.controls.minDistance = 2.5;
      this.controls.maxDistance = 8;
      this.controls.zoomSpeed = 0.8; // Faster zoom response
      this.controls.rotateSpeed = 1.2; // Faster rotation
      this.controls.panSpeed = 1.0;

      // Performance optimizations
      this.controls.enablePan = false; // Disable panning for better performance
      this.controls.autoRotate = false;

      // Add change listener to only render when needed
      this.controls.addEventListener('change', () => {
        this.needsRender = true;
      });

      // Add start/end listeners for smooth interaction and selection control
      this.controls.addEventListener('start', () => {
        console.log('🎥 Camera interaction started');
        this.isAnimating = true;
        this.cameraInteracting = true;
        this.allowSelection = false; // Disable selection during camera interaction
      });

      this.controls.addEventListener('end', () => {
        console.log('🎥 Camera interaction ended');
        this.isAnimating = false;
        this.needsRender = true;
        this.cameraInteracting = false;
        // Re-enable selection immediately for better responsiveness
        this.allowSelection = true;
      });
    } catch (error) {
      this.errorHandler.handleWebGLError(error as Error, 'controls_setup');
      throw new Error(`Failed to setup controls: ${error}`);
    }
  }

  private async loadAllData(): Promise<void> {
    if (this.useTopoJSON) {
      await this.loadTopoJSONData();
    } else {
      await this.loadGeoJSONData();
    }
  }

  /**
   * Load geographic data using optimized TopoJSON with unified borders
   */
  private async loadTopoJSONData(): Promise<void> {
    try {
      console.log('🌍 Loading TopoJSON data with unified borders...');
      this.renderingMode.set('topojson');

      // Load TopoJSON topology with retry mechanism
      const topology = await this.loadWithRetry(
        () => loadTopoJSON('/data/world.topo.json'),
        3,
      );

      // Create unified border visualization
      const countriesObject = createInteractiveCountriesFromTopo(
        topology,
        this.topoJSONOptions,
      );

      // Store reference and add to scene
      this.countries = countriesObject;
      this.scene.add(countriesObject);

      // Ensure country objects have countryId in userData for selection service
      this.ensureCountryIds();

      console.log(
        `✅ TopoJSON loaded: ${countriesObject.userData['countryCount']} countries, ${countriesObject.userData['arcCount']} shared arcs`,
      );
    } catch (error) {
      this.errorHandler.handleNetworkError(
        error as Error,
        '/data/world.topo.json',
      );

      console.warn('TopoJSON failed, falling back to GeoJSON...', error);

      // Fallback to GeoJSON if TopoJSON fails
      try {
        await this.loadGeoJSONData();
      } catch (fallbackError) {
        console.warn(
          'Both TopoJSON and GeoJSON failed, showing basic globe:',
          fallbackError,
        );
      }
    }
  }

  /**
   * Load geographic data using traditional GeoJSON (fallback method)
   */
  private async loadGeoJSONData(): Promise<void> {
    try {
      console.log('🗺️ Loading GeoJSON data (fallback mode)...');
      this.renderingMode.set('geojson');

      // Load countries data with timeout and retry
      const countriesData = await this.loadWithRetry(
        () => loadGeoJSON('/data/countries-50m.geojson'),
        3,
      );

      // Create countries layer using traditional method
      const countriesObject = createInteractiveCountries(countriesData, 2);

      // Store reference and add to scene
      this.countries = countriesObject;
      this.scene.add(countriesObject);

      // Ensure country objects have countryId in userData for selection service
      this.ensureCountryIds();

      console.log(
        `✅ GeoJSON loaded: ${countriesData.features.length} countries`,
      );
    } catch (error) {
      this.errorHandler.handleNetworkError(
        error as Error,
        '/data/countries-50m.geojson',
      );
      // Continue without country data - show basic globe
      console.warn('Failed to load country data, showing basic globe:', error);
    }
  }

  private async loadWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, attempt)),
        );
      }
    }
    throw new Error('Max retries exceeded');
  }

  private handleInitializationError(error: Error | unknown): void {
    console.error('Globe initialization failed:', error);
    this.isLoading.set(false);

    let errorMessage = 'Failed to initialize 3D scene';

    const errorObj = error as { message?: string };
    if (errorObj?.message?.includes('WebGL')) {
      errorMessage = 'WebGL is not supported or enabled in your browser';
    } else if (errorObj?.message?.includes('texture')) {
      errorMessage = 'Failed to load Earth textures';
    } else if (errorObj?.message?.includes('renderer')) {
      errorMessage = 'Failed to initialize 3D renderer';
    }

    this.initError.set(errorMessage);

    // Convert to Error if unknown type
    const errorToReport =
      error instanceof Error ? error : new Error(String(error));
    this.errorHandler.handleWebGLError(errorToReport, 'globe_initialization');
  }

  // Public methods for error boundary
  handleRetry(): void {
    this.retryInitialization();
  }

  /**
   * Toggle between TopoJSON and GeoJSON rendering modes
   * @param useTopoJSON Whether to use TopoJSON (true) or GeoJSON (false)
   */
  async toggleRenderingMode(useTopoJSON: boolean): Promise<void> {
    if (this.useTopoJSON === useTopoJSON) return;

    console.log(
      `🔄 Switching rendering mode to ${useTopoJSON ? 'TopoJSON' : 'GeoJSON'}`,
    );

    this.useTopoJSON = useTopoJSON;
    this.loadingMessage.set('Switching rendering mode...');
    this.loadingProgress.set(50);
    this.isLoading.set(true);

    // Remove existing countries if present
    if (this.countries) {
      if (this.renderingMode() === 'topojson') {
        disposeTopoJSONMeshes(this.countries);
      }
      this.scene.remove(this.countries);
    }

    try {
      // Reload data with new rendering mode
      await this.loadAllData();

      this.loadingProgress.set(100);
      setTimeout(() => {
        this.isLoading.set(false);
      }, 300);

      console.log(
        `✅ Successfully switched to ${useTopoJSON ? 'TopoJSON' : 'GeoJSON'} rendering`,
      );
    } catch (error) {
      console.error('Failed to switch rendering mode:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Get current rendering mode
   */
  getCurrentRenderingMode(): 'geojson' | 'topojson' {
    return this.renderingMode();
  }

  retryInitialization(): void {
    console.log('Retrying globe initialization...');

    // Reset states
    this.initError.set(null);
    this.isLoading.set(true);
    this.loadingProgress.set(0);

    // Clean up existing scene if any
    this.cleanup();

    // Retry initialization
    setTimeout(() => {
      this.initializeScene().catch((error) => {
        this.handleInitializationError(error);
      });
    }, 1000);
  }

  private cleanup(): void {
    try {
      console.log('🧹 Starting comprehensive Three.js cleanup...');

      // Stop animation
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = undefined;
      }

      // Dispose of countries and related meshes using memory manager
      if (this.countries) {
        if (this.renderingMode() === 'topojson') {
          console.log('🧹 Disposing TopoJSON meshes...');
          disposeTopoJSONMeshes(this.countries);
        }
        this.memoryManager.disposeObject3D(this.countries);
        this.countries = undefined!;
      }

      // Dispose earth mesh and atmosphere using memory manager
      if (this.earthMesh) {
        this.memoryManager.disposeObject3D(this.earthMesh);
        this.earthMesh = undefined;
      }

      if (this.atmosphereMesh) {
        this.memoryManager.disposeObject3D(this.atmosphereMesh);
        this.atmosphereMesh = undefined;
      }

      // Dispose starfield using memory manager
      if (this.starfield) {
        this.memoryManager.disposeObject3D(this.starfield);
        this.starfield = undefined!;
      }

      // Dispose sphere using memory manager
      if (this.sphere) {
        this.memoryManager.disposeObject3D(this.sphere);
        this.sphere = undefined!;
      }

      // Dispose scene using memory manager
      if (this.scene) {
        this.memoryManager.disposeScene(this.scene);
        this.scene = undefined!;
      }

      // Dispose controls
      if (this.controls) {
        this.controls.dispose();
        this.controls = undefined!;
      }

      // Dispose renderer using memory manager
      if (this.renderer) {
        // Remove canvas from DOM first
        const canvas = this.renderer.domElement;
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }

        this.memoryManager.disposeRenderer(this.renderer);
        this.renderer = undefined!;
      }

      // Dispose loader if present
      if (this.loader) {
        this.loader = undefined!;
      }

      // Dispose fresnel material
      if (this.fresnelMat) {
        this.memoryManager.track(this.fresnelMat);
        this.fresnelMat = undefined!;
      }

      // Force garbage collection if available (development only)
      if (
        typeof window !== 'undefined' &&
        !window.location.host.includes('prod')
      ) {
        this.memoryManager.forceGarbageCollection();
      }

      console.log('✅ Three.js cleanup completed successfully');

      // Log memory stats for debugging
      if (
        typeof window !== 'undefined' &&
        !window.location.host.includes('prod')
      ) {
        const stats = this.memoryManager.getMemoryStats();
        console.log('📊 Memory cleanup stats:', stats);
      }
    } catch (error) {
      console.warn('⚠️ Error during cleanup:', error);
      this.errorRecovery.handleGeometryError(error as Error, 'cleanup');
    }
  }

  /**
   * Setup GPU-optimized country selection interactions
   */
  private setupCountrySelectionInteractions(): void {
    const canvas = this.renderer.domElement;

    // Handle mouse clicks for country selection (only if camera not interacting)
    canvas.addEventListener('click', (event) => {
      console.log(
        `🖱️ Click detected - allowSelection: ${this.allowSelection}, cameraInteracting: ${this.cameraInteracting}`,
      );
      if (this.allowSelection && !this.cameraInteracting) {
        console.log('🎯 Attempting country selection...');
        this.handleCountrySelection(event);
      } else {
        console.log(
          '❌ Click ignored - camera interacting or selection disabled',
        );
      }
    });

    // Handle mouse hover for tooltips (throttled)
    canvas.addEventListener('mousemove', (event) => {
      const now = Date.now();
      if (now - this.lastMouseEvent > this.mouseEventThrottle) {
        this.handleCountryHover(event);
        this.lastMouseEvent = now;
      }
    });

    // Hide tooltip when mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
      this.hideAllTooltips();
    });

    console.log('✅ GPU country selection interactions setup complete');
  }

  /**
   * Handle country selection from mouse clicks (optimized)
   */
  private async handleCountrySelection(event: MouseEvent): Promise<void> {
    event.preventDefault();

    // Early exit if countries not loaded
    if (!this.countries || this.countries.children.length === 0) {
      return;
    }

    // Get mouse coordinates relative to canvas
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to normalized device coordinates (-1 to +1)
    const mouse = {
      x: (x / canvas.width) * 2 - 1,
      y: -(y / canvas.height) * 2 + 1,
    };

    // Use optimized raycasting
    const { Raycaster, Vector2 } = await import('three');
    const raycaster = new Raycaster();
    raycaster.near = 0.1;
    raycaster.far = 10; // Limit ray distance
    const mouseVector = new Vector2(mouse.x, mouse.y);
    raycaster.setFromCamera(mouseVector, this.camera);

    // Optimized intersection testing - only check country meshes
    const intersects = raycaster.intersectObjects(
      this.countries.children,
      true,
    );

    if (intersects.length > 0) {
      // Find first valid country mesh (optimized loop)
      let selectedCountryMesh: Mesh | null = null;
      let countryGroup: Object3D | null = null;

      for (const intersect of intersects) {
        const obj = intersect.object;

        // Skip border lines - we want actual country meshes
        if (
          obj.name === 'unified-borders' ||
          obj.userData?.['isUnifiedBorder']
        ) {
          continue;
        }

        // Look for country selection meshes
        if (obj.name.startsWith('selection-mesh-') && obj.type === 'Mesh') {
          selectedCountryMesh = obj as Mesh;
          countryGroup = obj.parent;
          break; // Early exit for performance
        }
      }

      if (selectedCountryMesh && countryGroup) {
        const countryData = countryGroup.userData;
        const countryName =
          countryData?.['properties']?.['NAME'] ||
          countryData?.['name'] ||
          selectedCountryMesh.name.replace('selection-mesh-', '').split('_')[0];

        // Handle multi-selection based on modifier keys
        if (event.shiftKey) {
          // Add to selection - don't reset others
          this.applyCountrySelectionToGroup(countryGroup, countryName);
        } else if (event.ctrlKey || event.metaKey) {
          // Toggle selection
          const isCurrentlySelected =
            this.isCountrySelected(selectedCountryMesh);
          if (isCurrentlySelected) {
            this.removeCountrySelection(selectedCountryMesh);
          } else {
            this.applyCountrySelectionToGroup(countryGroup, countryName);
          }
        } else {
          // Regular click - reset all and select this one
          this.resetAllCountrySelections();
          this.applyCountrySelectionToGroup(countryGroup, countryName);
        }

        // Store current selection
        this.lastSelectedCountryMesh = selectedCountryMesh;

        // Find detailed country data for selected country
        const countryDataRecord = this.countryDataService
          .getAllCountries()
          .find((c: CountryDataRecord) => {
            const name1 = c.name.toLowerCase();
            const name2 = countryName.toLowerCase();
            const code1 = c.code.toLowerCase();

            return (
              name1 === name2 ||
              name1.includes(name2) ||
              name2.includes(name1) ||
              code1 === name2
            );
          });

        // Show detailed tooltip in fixed position for selected country
        if (countryDataRecord) {
          this.selectedCountry.set(countryDataRecord);
        }

        // Update accessibility
        this.updateAccessibilityCountrySelection(countryName);

        console.log(`🎯 Country selected: ${countryName}`);
      }
    } else {
      // No country clicked - clear selection
      this.selectedCountry.set(null);
    }
  }

  /**
   * Check if a country is currently selected
   */
  private isCountrySelected(mesh: Mesh): boolean {
    const material = mesh.material as Material & {
      emissive?: { r: number; g: number; b: number };
    };
    return !!(material.emissive && material.emissive.r > 0);
  }

  /**
   * Remove selection from a country
   */
  private removeCountrySelection(mesh: Mesh): void {
    const material = mesh.material as Material & {
      transparent?: boolean;
      opacity?: number;
      emissive?: { setHex: (hex: number) => void };
    };

    if (material) {
      material.transparent = true;
      material.opacity = 0.7;
      if (material.emissive) {
        material.emissive.setHex(0x000000); // Remove glow
      }
    }
  }

  /**
   * Apply selection visual to a country by ID
   */
  private applyCountrySelectionById(countryId: string): void {
    if (!this.countries) return;

    this.countries.traverse((child) => {
      if (child.name.startsWith('selection-mesh-') && child.type === 'Mesh') {
        const mesh = child as Mesh;
        const countryGroup = mesh.parent;

        if (countryGroup) {
          const countryData = countryGroup.userData;
          const countryName =
            countryData?.['properties']?.['NAME'] ||
            countryData?.['name'] ||
            mesh.name.replace('selection-mesh-', '').split('_')[0];

          // Check if this mesh corresponds to the selected country
          if (this.countryMatches(countryId, countryName)) {
            const material = mesh.material as Material & {
              color?: { setHex: (hex: number) => void };
              opacity?: number;
            };
            if (material && 'color' in material) {
              // Apply selected color
              material.color?.setHex(0xff6b35);
              if ('opacity' in material) {
                material.opacity = 0.8;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Check if country ID/name matches
   */
  private countryMatches(countryId: string, countryName: string): boolean {
    const id1 = countryId.toLowerCase();
    const name1 = countryName.toLowerCase();

    return id1 === name1 || id1.includes(name1) || name1.includes(id1);
  }

  /**
   * Ensure all country objects have countryId in userData for selection service
   */
  private ensureCountryIds(): void {
    if (!this.countries) return;

    this.countries.traverse((child) => {
      if (
        child.type === 'Group' &&
        child.userData &&
        child.userData['properties']
      ) {
        // This is a country group
        const countryName =
          child.userData['properties']['NAME'] ||
          child.userData['name'] ||
          child.name;

        if (countryName && !child.userData['countryId']) {
          child.userData['countryId'] = countryName;
        }
      }
    });

    console.log('✅ Country IDs ensured for selection service');
  }

  /**
   * Optimized reset of country selections
   */
  private resetAllCountrySelections(): void {
    if (!this.countries) return;

    // Reset all selection meshes (needed for complete fill reset)
    this.countries.traverse((child) => {
      if (
        child.name &&
        child.name.startsWith('selection-mesh-') &&
        child.type === 'Mesh'
      ) {
        const material = (child as Mesh).material as Material & {
          color?: Color;
          emissive?: Color;
        };
        if (material) {
          material.transparent = true;
          material.opacity = 0.1; // Slightly visible for interaction
          material.color?.setHex(0x444444);
          material.needsUpdate = true;

          if (material.emissive) {
            material.emissive.setHex(0x000000);
          }
        }
      }
    });

    this.lastSelectedCountryMesh = null;
    this.needsRender = true;
  }

  /**
   * Apply country selection to all meshes within a country group
   */
  private applyCountrySelectionToGroup(
    countryGroup: Object3D,
    countryName: string,
  ): void {
    // Find all selection meshes for this country
    const selectionMeshes: Mesh[] = [];

    // Search recursively for all selection meshes
    countryGroup.traverse((child) => {
      if (
        child.name &&
        child.name.startsWith('selection-mesh-') &&
        child.type === 'Mesh'
      ) {
        selectionMeshes.push(child as Mesh);
      }
    });

    // Also search in the parent selection meshes group
    if (this.countries) {
      this.countries.traverse((child) => {
        if (
          child.name &&
          child.name.startsWith('selection-mesh-') &&
          child.type === 'Mesh'
        ) {
          const meshName = child.name
            .replace('selection-mesh-', '')
            .split('_')[0];
          if (
            meshName === countryName ||
            meshName.toLowerCase() === countryName.toLowerCase()
          ) {
            selectionMeshes.push(child as Mesh);
          }
        }
      });
    }

    console.log(
      `🎯 Found ${selectionMeshes.length} selection meshes for ${countryName}`,
    );

    // Apply selection styling to all found meshes
    selectionMeshes.forEach((mesh, index) => {
      this.applyCountrySelection(mesh);
      console.log(
        `✅ Applied selection to mesh ${index + 1}/${selectionMeshes.length}: ${mesh.name}`,
      );
    });

    this.needsRender = true;
  }

  /**
   * Apply simple country selection with geometry offset + render order backup
   */
  private applyCountrySelection(mesh: Mesh): void {
    if (!mesh || !mesh.geometry) return;

    const material = mesh.material as Material & {
      transparent?: boolean;
      opacity?: number;
      color?: Color;
      emissive?: Color;
    };
    if (material) {
      material.transparent = true;
      material.opacity = 0.85;
      material.color?.setHex(0x00ff88); // Green selection
      if (material.emissive) {
        material.emissive.setHex(0x006644);
      }
      // Ensure no depth testing for selected materials
      material.depthTest = false;
      material.depthWrite = false;
      material.needsUpdate = true;
    }

    // Add render order as backup to geometry offset - higher value for large countries
    mesh.renderOrder = 10; // Much higher render order to ensure countries render on top

    mesh.visible = true;
    this.needsRender = true;
  }

  private animate(currentTime: number = 0): void {
    // Frame rate limiting - only render if enough time has passed
    if (
      currentTime - this.lastFrameTime < this.frameInterval &&
      !this.needsRender &&
      !this.isAnimating
    ) {
      return;
    }

    this.lastFrameTime = currentTime;

    // Only update controls if they need updating
    const controlsNeedUpdate =
      this.controls.enableDamping &&
      (this.isAnimating || this.controls.autoRotate);
    if (controlsNeedUpdate) {
      this.controls.update();
    }

    // Only render if scene has changed
    if (this.needsRender || this.isAnimating) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.camera || !this.renderer) return;

    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Enhanced country hover handling using specialized service
   */
  private async handleCountryHover(event: MouseEvent): Promise<void> {
    try {
      // Early exit if countries not loaded
      if (!this.countries || this.countries.children.length === 0) {
        this.hideAllTooltips();
        return;
      }

      const canvas = this.renderer.domElement;
      const rect = canvas.getBoundingClientRect();

      // Get mouse coordinates relative to canvas
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert to normalized device coordinates
      const mouse = {
        x: (x / canvas.width) * 2 - 1,
        y: -(y / canvas.height) * 2 + 1,
      };

      // Use the specialized hover service that understands TopoJSON structure
      const hoverResult = this.countryHoverService.detectCountryHover(
        mouse,
        this.camera,
        this.countries,
      );

      if (hoverResult) {
        // Show only country name tooltip on hover
        this.hoveredCountryName.set(hoverResult.countryName);
        this.countryNameTooltipPosition.set({
          x: event.clientX,
          y: event.clientY,
        });
        this.countryNameTooltipVisible.set(true);

        canvas.style.cursor = 'pointer';
      } else {
        // No country found - hide name tooltip only
        this.hideNameTooltip();
        canvas.style.cursor = 'default';
      }
    } catch (error) {
      console.warn('⚠️ Error in country hover handler:', error);
      this.hideNameTooltip();
    }
  }

  /**
   * Hide only the country name tooltip (for hover)
   */
  private hideNameTooltip(): void {
    this.countryNameTooltipVisible.set(false);
    this.hoveredCountryName.set('');
  }

  /**
   * Hide all tooltips (for mouse leave - keeps selected country tooltip)
   */
  private hideAllTooltips(): void {
    this.hideNameTooltip();
    // Keep selected country tooltip visible even on mouse leave
  }

  /**
   * Handle keyboard navigation events
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.shiftKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      return;
    }

    const handled = this.accessibility.handleKeyboardNavigation(
      event,
      this.camera,
      this.controls,
      this.countries,
    );

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Handle focus events for accessibility
   */
  onFocus(): void {
    this.accessibility.isKeyboardMode.set(true);
    console.log('🎯 Globe focused - keyboard navigation enabled');
  }

  /**
   * Handle blur events for accessibility
   */
  onBlur(): void {
    // Don't immediately disable keyboard mode as user might tab back
    setTimeout(() => {
      if (document.activeElement !== this.rendererContainer.nativeElement) {
        this.accessibility.isKeyboardMode.set(false);
      }
    }, 100);
  }

  /**
   * Update country selection for accessibility
   */
  private updateAccessibilityCountrySelection(
    countryName: string | null,
  ): void {
    this.accessibility.updateCountrySelection(countryName);

    // Update available countries for navigation
    if (this.countries) {
      const countryData = this.extractCountriesForAccessibility(this.countries);
      this.accessibility.updateAvailableCountries(countryData);
    }
  }

  /**
   * Extract country data for accessibility navigation
   */
  private extractCountriesForAccessibility(
    countriesGroup: Group,
  ): CountryAccessibilityData[] {
    const countries: CountryAccessibilityData[] = [];

    countriesGroup.traverse((object) => {
      if (object.userData?.['isCountry'] && object.userData?.['name']) {
        const countryName = object.userData['name'];
        countries.push(
          this.accessibility.getCountryAccessibilityInfo(countryName),
        );
      }
    });

    return countries;
  }

  /**
   * Update accessibility state when loading
   */
  private updateAccessibilityLoadingState(
    message: string,
    progress?: number,
  ): void {
    this.accessibility.announceLoadingState(message, progress);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
