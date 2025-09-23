import {
  Component,
  signal,
  ViewContainerRef,
  ViewChild,
  AfterViewInit,
  inject,
} from '@angular/core';
import { Sidebar } from './layout/component/sidebar/sidebar';
import { ComparisonCard } from './layout/component/comparison-card/comparison-card';
import { NavigationStateService } from './core/services/navigation-state.service';
import { PerformanceMonitorComponent } from './shared/components/performance-monitor/performance-monitor';
import { NotificationToast } from './shared/components/notification-toast/notification-toast';

@Component({
  selector: 'app-root',
  imports: [
    Sidebar,
    ComparisonCard,
    PerformanceMonitorComponent,
    NotificationToast,
  ],
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

      <!-- Conditional rendering based on navigation state -->
      @if (navigationService.isCountryComparisonActive()) {
        <app-comparison-card />
      }

      <!-- Placeholder for future views -->
      @if (navigationService.isGameQuizActive()) {
        <div class="placeholder-view" role="region" aria-label="Game Quiz">
          <div class="placeholder-content">
            <h2>🎮 Game Quiz</h2>
            <p>Coming Soon - Interactive geography quiz game</p>
          </div>
        </div>
      }

      @if (navigationService.isBirdMigrationActive()) {
        <div class="placeholder-view" role="region" aria-label="Bird Migration">
          <div class="placeholder-content">
            <h2>🐦 Bird Migration</h2>
            <p>Coming Soon - Animated bird migration patterns</p>
          </div>
        </div>
      }

      @if (navigationService.isCropCuisineMapperActive()) {
        <div
          class="placeholder-view"
          role="region"
          aria-label="Crop & Cuisine Mapper"
        >
          <div class="placeholder-content">
            <h2>🗺️ Crop & Cuisine Mapper</h2>
            <p>Coming Soon - Agricultural and culinary data visualization</p>
          </div>
        </div>
      }

      <!-- Performance Monitor -->
      <app-performance-monitor />

      <!-- Notification Toast -->
      <app-notification-toast></app-notification-toast>
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

      /* Placeholder views for future features */
      .placeholder-view {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 20px;
        width: min(96vw, 1400px);
        max-width: 1400px;
        z-index: 120;
        pointer-events: auto;
        box-sizing: border-box;

        border-radius: 14px;
        padding: 32px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(14px) saturate(1.15);
        -webkit-backdrop-filter: blur(14px) saturate(1.15);
        box-shadow:
          0 18px 40px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }

      .placeholder-content {
        text-align: center;
        color: rgba(255, 255, 255, 0.9);
      }

      .placeholder-content h2 {
        margin: 0 0 16px 0;
        font-size: 24px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .placeholder-content p {
        margin: 0;
        font-size: 16px;
        color: rgba(255, 255, 255, 0.7);
        font-style: italic;
      }

      @media (max-width: 720px) {
        .placeholder-view {
          left: 12px;
          right: 12px;
          bottom: 24px;
          transform: none;
          max-width: calc(100% - 24px);
          padding: 24px 16px;
        }

        .placeholder-content h2 {
          font-size: 20px;
        }

        .placeholder-content p {
          font-size: 14px;
        }
      }
    `,
  ],
})
export class App implements AfterViewInit {
  @ViewChild('globeContainer', { read: ViewContainerRef })
  private globeContainer!: ViewContainerRef;

  // Inject navigation service for template access
  protected readonly navigationService = inject(NavigationStateService);
  protected readonly title = signal('global-dashboard');

  async ngAfterViewInit(): Promise<void> {
    // Lazy load the Globe component
    const { Globe } = await import('./pages/globe/globe');
    const _componentRef = this.globeContainer.createComponent(Globe);
  }
}
