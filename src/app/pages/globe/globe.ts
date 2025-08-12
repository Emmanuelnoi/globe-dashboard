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
import { getStarfield } from '@lib/utils';

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
  private mesh!: THREE.Mesh;
  private animationId?: number;
  private controls!: OrbitControls;
  private starfield!: THREE.Points;

  ngAfterViewInit(): void {
    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 100);
    this.camera.position.z = 5;

    // Scene
    this.scene = new THREE.Scene();

    // sphere with edges
    const geometry = new THREE.SphereGeometry();
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, lineMat);
    this.scene.add(line);

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
