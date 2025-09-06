import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  HostListener,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  getStarfield,
  getFresnelMat,
  loadGeoJSON,
  createInteractiveCountries,
} from '@lib/utils';

@Component({
  selector: 'app-globe',
  imports: [CommonModule],
  template: ` <div #rendererContainer class="scene-container"></div> `,
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
    `,
  ],
})
export class Globe implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rendererContainer', { static: true })
  private rendererContainer!: ElementRef<HTMLDivElement>;

  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private animationId?: number;
  private controls!: OrbitControls;
  private fresnelMat = getFresnelMat();

  // 3D object
  private sphere!: THREE.LineSegments;
  private starfield!: THREE.Points;
  private countries!: THREE.Group;
  private loader!: THREE.TextureLoader;

  ngAfterViewInit(): void {
    // 1. Scene
    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    // Add fog for atmospheric effeect
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 1);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
    this.camera.position.z = 5;

    // Scene
    this.scene = new THREE.Scene();

    this.loader = new THREE.TextureLoader();
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    const texture = this.loader.load('/textures/earthspec1k-m.png');
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const earthMesh = new THREE.Mesh(geometry, material);
    this.scene.add(earthMesh);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Starfield background
    this.starfield = getStarfield({ numStars: 1000 });
    this.scene.add(this.starfield);

    // add Atmosphere Glow
    const glowMesh = new THREE.Mesh(geometry, this.fresnelMat);
    glowMesh.scale.setScalar(1);
    this.scene.add(glowMesh);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // // Add OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // smooth movement

    // restrict zoom in/out
    this.controls.minDistance = 2.5; // close enough to see details
    this.controls.maxDistance = 8; // far enough to see the whole globe + glow
    this.controls.zoomSpeed = 0.5; // slower zoom

    // Start animation
    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);

    this.loadAllData();
  }

  private async loadAllData(): Promise<void> {
    // Load countries data (essential for map functionality)
    const countriesData = await loadGeoJSON('/data/countries-50m.geojson');

    // Create countries layer (bottom layer)
    const countriesObject = createInteractiveCountries(countriesData, 2);
    this.scene.add(countriesObject);
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
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
  }
}
