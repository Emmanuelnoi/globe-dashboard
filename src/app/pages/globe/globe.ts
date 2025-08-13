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
  @ViewChild('rendererContainer', { static: true })
  private rendererContainer!: ElementRef<HTMLDivElement>;

  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private animationId?: number;
  private controls!: OrbitControls;

  // 3D object
  private sphere!: THREE.LineSegments;
  private starfield!: THREE.Points;
  private countries!: THREE.Group;

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

    const geometry = new THREE.SphereGeometry(2);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    const edges = new THREE.EdgesGeometry(geometry, 1);
    this.sphere = new THREE.LineSegments(edges, lineMat);
    this.scene.add(this.sphere);

    // Starfield background
    this.starfield = getStarfield({ numStars: 1000 });
    this.scene.add(this.starfield);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // Add OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // smooth movement

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
