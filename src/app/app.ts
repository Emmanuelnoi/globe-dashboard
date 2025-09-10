import {
  Component,
  signal,
  ViewContainerRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { Sidebar } from './layout/component/sidebar/sidebar';
import { ComparisonCard } from './layout/component/comparison-card/comparison-card';

@Component({
  selector: 'app-root',
  imports: [Sidebar, ComparisonCard],
  template: `
    <div
      class="app-container"
      role="application"
      aria-label="3D Global Dashboard"
    >
      <!-- Skip to main content link for keyboard users -->
      <a
        href="#main-content"
        class="skip-link"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        #globeContainer
        role="main"
        aria-label="Interactive 3D globe visualization"
        aria-describedby="globe-description"
      ></main>

      <!-- Hidden description for screen readers -->
      <div id="globe-description" class="sr-only">
        Interactive 3D globe showing country data. Use the sidebar to navigate
        and the comparison table to analyze country statistics.
      </div>

      <app-sidebar />
      <app-comparison-card />
    </div>
  `,
  styles: [
    `
      .app-container {
        height: 100vh;
        overflow: hidden;
        position: relative;
        background: radial-gradient(
          ellipse at bottom,
          #1b2735 0%,
          #090a0f 100%
        );
      }

      /* Skip link for keyboard accessibility */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: #3b82f6;
        color: white;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
        font-size: 14px;
        z-index: 9999;
        transition: top 0.2s ease;
      }

      .skip-link:focus {
        top: 6px;
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

      /* Main content area */
      main {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class App implements AfterViewInit {
  @ViewChild('globeContainer', { read: ViewContainerRef })
  private globeContainer!: ViewContainerRef;

  protected readonly title = signal('global-dashboard');

  async ngAfterViewInit() {
    // Lazy load the Globe component
    const { Globe } = await import('./pages/globe/globe');
    const componentRef = this.globeContainer.createComponent(Globe);
  }
}
