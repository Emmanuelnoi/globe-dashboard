import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerformanceMonitorService } from '@/core/services/performance-monitor.service';

/**
 * PerformancePanelComponent
 *
 * A compact, draggable performance monitoring panel for Three.js applications.
 * Displays real-time FPS, frame time, draw calls, memory usage, and warnings.
 *
 * Features:
 * - Real-time metrics display
 * - Color-coded performance indicators
 * - Collapsible detailed view
 * - Warning indicators
 * - Keyboard shortcut toggle (Shift+P)
 */
@Component({
  selector: 'app-performance-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible()) {
      <div
        class="performance-panel"
        [class.collapsed]="isCollapsed()"
        [class.warning]="hasWarnings()"
        [class.critical]="hasCriticalWarnings()"
      >
        <!-- Header -->
        <div class="panel-header" (click)="toggleCollapse()">
          <span
            class="fps"
            [class.good]="fpsStatus() === 'good'"
            [class.warning]="fpsStatus() === 'warning'"
            [class.bad]="fpsStatus() === 'bad'"
          >
            {{ metrics().fps }} FPS
          </span>
          <span class="frame-time"
            >{{ metrics().frameTimeAvg.toFixed(1) }}ms</span
          >
          @if (hasWarnings()) {
            <span class="warning-badge">{{ warnings().length }}</span>
          }
          <button class="close-btn" (click)="hide($event)">×</button>
        </div>

        <!-- Detailed metrics (collapsible) -->
        @if (!isCollapsed()) {
          <div class="panel-body">
            <!-- Frame metrics -->
            <div class="metric-row">
              <span class="label">Frame</span>
              <span class="value">
                min: {{ metrics().frameTimeMin.toFixed(1) }}ms / max:
                {{ metrics().frameTimeMax.toFixed(1) }}ms
              </span>
            </div>

            <!-- Draw calls -->
            <div
              class="metric-row"
              [class.over-budget]="metrics().drawCalls > 100"
            >
              <span class="label">Draw Calls</span>
              <span class="value">{{ metrics().drawCalls }}</span>
            </div>

            <!-- Triangles -->
            <div
              class="metric-row"
              [class.over-budget]="metrics().triangles > 500000"
            >
              <span class="label">Triangles</span>
              <span class="value">{{ formatNumber(metrics().triangles) }}</span>
            </div>

            <!-- Geometries & Textures -->
            <div class="metric-row">
              <span class="label">Geo/Tex</span>
              <span class="value"
                >{{ metrics().geometries }} / {{ metrics().textures }}</span
              >
            </div>

            <!-- Memory -->
            @if (metrics().jsHeapUsed) {
              <div class="metric-row" [class.over-budget]="memoryMB() > 200">
                <span class="label">Memory</span>
                <span class="value">{{ memoryMB().toFixed(0) }}MB</span>
              </div>
            }

            <!-- Warnings -->
            @if (hasWarnings()) {
              <div class="warnings">
                @for (warning of warnings(); track warning.timestamp) {
                  <div class="warning-item" [class]="warning.severity">
                    {{ warning.message }}
                  </div>
                }
              </div>
            }

            <!-- Actions -->
            <div class="actions">
              <button (click)="logReport()">Log Report</button>
              <button (click)="clearWarnings()">Clear</button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .performance-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 11px;
        border-radius: 6px;
        overflow: hidden;
        z-index: 10000;
        min-width: 180px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .performance-panel.warning {
        border-color: rgba(255, 193, 7, 0.5);
      }

      .performance-panel.critical {
        border-color: rgba(244, 67, 54, 0.5);
      }

      .panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        user-select: none;
      }

      .panel-header:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .fps {
        font-weight: bold;
        font-size: 13px;
      }

      .fps.good {
        color: #4caf50;
      }
      .fps.warning {
        color: #ffc107;
      }
      .fps.bad {
        color: #f44336;
      }

      .frame-time {
        color: #aaa;
      }

      .warning-badge {
        background: #f44336;
        color: white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
      }

      .close-btn {
        margin-left: auto;
        background: none;
        border: none;
        color: #888;
        font-size: 16px;
        cursor: pointer;
        padding: 0 4px;
      }

      .close-btn:hover {
        color: #fff;
      }

      .panel-body {
        padding: 8px 10px;
      }

      .metric-row {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .metric-row:last-child {
        border-bottom: none;
      }

      .metric-row.over-budget .value {
        color: #ffc107;
      }

      .label {
        color: #888;
      }

      .value {
        color: #fff;
      }

      .warnings {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .warning-item {
        padding: 4px 6px;
        margin-bottom: 4px;
        border-radius: 3px;
        font-size: 10px;
      }

      .warning-item.low {
        background: rgba(33, 150, 243, 0.3);
      }
      .warning-item.medium {
        background: rgba(255, 193, 7, 0.3);
      }
      .warning-item.high {
        background: rgba(255, 152, 0, 0.3);
      }
      .warning-item.critical {
        background: rgba(244, 67, 54, 0.3);
      }

      .actions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .actions button {
        flex: 1;
        padding: 4px 8px;
        font-size: 10px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
      }

      .actions button:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .collapsed .panel-body {
        display: none;
      }
    `,
  ],
})
export class PerformancePanelComponent {
  private readonly performanceMonitor = inject(PerformanceMonitorService);

  // State
  private _isVisible = true;
  private _isCollapsed = false;

  // Computed values from service
  readonly metrics = this.performanceMonitor.metrics;
  readonly warnings = this.performanceMonitor.warnings;

  // Local computed values
  readonly isVisible = computed(
    () => this._isVisible && this.performanceMonitor.isEnabled(),
  );
  readonly isCollapsed = () => this._isCollapsed;
  readonly hasWarnings = computed(() => this.warnings().length > 0);
  readonly hasCriticalWarnings = computed(() =>
    this.warnings().some((w) => w.severity === 'critical'),
  );

  readonly fpsStatus = computed(() => {
    const fps = this.metrics().fps;
    if (fps >= 55) return 'good';
    if (fps >= 30) return 'warning';
    return 'bad';
  });

  readonly memoryMB = computed(() => {
    const mem = this.metrics().jsHeapUsed;
    return mem ? mem / 1024 / 1024 : 0;
  });

  toggleCollapse(): void {
    this._isCollapsed = !this._isCollapsed;
  }

  hide(event: Event): void {
    event.stopPropagation();
    this._isVisible = false;
  }

  show(): void {
    this._isVisible = true;
  }

  logReport(): void {
    this.performanceMonitor.logReport();
  }

  clearWarnings(): void {
    this.performanceMonitor.clearWarnings();
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}
