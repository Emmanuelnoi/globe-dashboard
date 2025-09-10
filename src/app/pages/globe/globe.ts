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
} from '@angular/core';
import {
  Scene,
  Color,
  FogExp2,
  PerspectiveCamera,
  TextureLoader,
  SphereGeometry,
  MeshStandardMaterial,
  FrontSide,
  BackSide,
  Mesh,
  AmbientLight,
  DirectionalLight,
  ShaderMaterial,
  AdditiveBlending,
  WebGLRenderer,
  SRGBColorSpace,
  LineSegments,
  Points,
  Group,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  getStarfield,
  getFresnelMat,
  loadGeoJSON,
  createInteractiveCountries,
} from '@lib/utils';
import { LoadingComponent } from '@/shared/components/loading/loading.component';
import { ErrorBoundaryComponent } from '@/shared/components/error-boundary/error-boundary.component';
import { GlobalErrorHandlerService } from '@/core/services/global-error-handler.service';

@Component({
  selector: 'app-globe',
  imports: [CommonModule, LoadingComponent, ErrorBoundaryComponent],
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
        role="img"
        aria-label="Interactive 3D globe showing global data"
        [attr.aria-describedby]="
          isLoading() ? 'loading-status' : 'globe-status'
        "
        tabindex="0"
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
            3D globe is ready for interaction. Use mouse to rotate and zoom.
          }
        </div>

        <div id="loading-status" class="sr-only" aria-live="polite">
          @if (isLoading()) {
            Loading: {{ loadingMessage() }} - {{ loadingProgress() }}% complete
          }
        </div>
      </div>
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
    `,
  ],
})
export class Globe implements AfterViewInit, OnDestroy {
  private errorHandler = inject(GlobalErrorHandlerService);
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

  private camera!: PerspectiveCamera;
  private scene!: Scene;
  private renderer!: WebGLRenderer;
  private animationId?: number;
  private controls!: OrbitControls;
  private fresnelMat = getFresnelMat();

  // 3D object
  private sphere!: LineSegments;
  private starfield!: Points;
  private countries!: Group;
  private loader!: TextureLoader;

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.initializeScene();
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

    this.loadingProgress.set(40);
    this.loadingMessage.set('Loading Earth textures...');

    // Load Earth mesh with error handling
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
    try {
      const canvas = document.createElement('canvas');
      const context =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!context;
    } catch (error) {
      return false;
    }
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
        '/textures/earthspec1k-m.png',
        (texture) => {
          try {
            const geometry = new SphereGeometry(2, 64, 64);
            const material = new MeshStandardMaterial({
              map: texture,
              transparent: false, // Earth texture shouldn't be transparent
              side: FrontSide, // Only front side needed for sphere
              depthWrite: true, // Enable depth writing for proper rendering
              roughness: 0.8, // More realistic Earth surface
              metalness: 0.1,
            });
            const earthMesh = new Mesh(geometry, material);
            earthMesh.name = 'earth';
            this.scene.add(earthMesh);
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
      this.renderer = new WebGLRenderer({
        antialias: true,
        alpha: false, // Disable alpha for better performance and pure black background
        powerPreference: 'high-performance',
      });

      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
      this.renderer.setClearColor(0x000000, 1.0); // Ensure black background
      this.renderer.outputColorSpace = SRGBColorSpace; // Better color accuracy
      this.rendererContainer.nativeElement.appendChild(
        this.renderer.domElement,
      );

      // Start animation loop
      this.animate = this.animate.bind(this);
      this.renderer.setAnimationLoop(this.animate);
    } catch (error) {
      throw new Error(`Failed to initialize WebGL renderer: ${error}`);
    }
  }

  private setupControls(): void {
    try {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.minDistance = 2.5;
      this.controls.maxDistance = 8;
      this.controls.zoomSpeed = 0.5;
    } catch (error) {
      this.errorHandler.handleWebGLError(error as Error, 'controls_setup');
      throw new Error(`Failed to setup controls: ${error}`);
    }
  }

  private async loadAllData(): Promise<void> {
    try {
      // Load countries data with timeout and retry
      const countriesData = await this.loadWithRetry(
        () => loadGeoJSON('/data/countries-50m.geojson'),
        3,
      );

      // Create countries layer
      const countriesObject = createInteractiveCountries(countriesData, 2);
      this.scene.add(countriesObject);
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
      // Stop animation
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }

      // Dispose of renderer
      if (this.renderer) {
        this.renderer.dispose();

        // Remove canvas from DOM
        const canvas = this.renderer.domElement;
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      }

      // Dispose of controls
      if (this.controls) {
        this.controls.dispose();
      }

      // Clear scene objects
      if (this.scene) {
        this.scene.clear();
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  private animate(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
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

  ngOnDestroy(): void {
    this.cleanup();
  }
}
