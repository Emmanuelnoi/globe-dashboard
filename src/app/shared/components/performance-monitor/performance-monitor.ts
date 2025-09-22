import { Component, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerformanceMonitorService } from '@/core/services/performance-monitor.service';

@Component({
  selector: 'app-performance-monitor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="performance-monitor" [class.hidden]="!isVisible()">
      <div class="performance-header">
        <h3>Performance Monitor</h3>
        <button
          class="toggle-btn"
          (click)="toggleMonitoring()"
          [class.active]="service.isEnabled()"
        >
          {{ service.isEnabled() ? 'Stop' : 'Start' }}
        </button>
        <button class="close-btn" (click)="hide()">×</button>
      </div>

      <div class="performance-content" *ngIf="service.isEnabled()">
        <!-- Current Metrics -->
        <div class="metrics-section">
          <h4>Current</h4>
          <div class="metrics-grid">
            <div class="metric" [class.warning]="stats().current.fps < 30">
              <span class="label">FPS</span>
              <span class="value">{{ stats().current.fps.toFixed(1) }}</span>
            </div>
            <div
              class="metric"
              [class.warning]="stats().current.frameTime > 33"
            >
              <span class="label">Frame</span>
              <span class="value"
                >{{ stats().current.frameTime.toFixed(1) }}ms</span
              >
            </div>
            <div class="metric">
              <span class="label">Render</span>
              <span class="value"
                >{{ stats().current.renderTime.toFixed(1) }}ms</span
              >
            </div>
            <div class="metric">
              <span class="label">Memory</span>
              <span class="value">{{ memoryMB().toFixed(1) }}MB</span>
            </div>
            <div class="metric">
              <span class="label">Calls</span>
              <span class="value">{{ stats().current.drawCalls }}</span>
            </div>
            <div class="metric">
              <span class="label">Triangles</span>
              <span class="value">{{ triangleCount() }}</span>
            </div>
          </div>
        </div>

        <!-- Warnings -->
        <div class="warnings-section" *ngIf="stats().warnings.length > 0">
          <h4>⚠️ Warnings</h4>
          <div class="warnings">
            <div class="warning" *ngFor="let warning of stats().warnings">
              {{ warning }}
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions-section">
          <button class="action-btn" (click)="exportData()">Export Data</button>
          <button class="action-btn" (click)="showReport()">Show Report</button>
        </div>
      </div>
    </div>

    <!-- Floating Performance Indicator -->
    <div class="floating-indicator" *ngIf="!isVisible() && service.isEnabled()">
      <div class="fps-indicator" [class.warning]="stats().current.fps < 30">
        {{ stats().current.fps.toFixed(0) }} FPS
      </div>
      <button class="expand-btn" (click)="show()">📊</button>
    </div>
  `,
  styles: [
    `
      .performance-monitor {
        position: fixed;
        top: 260px;
        right: 20px;
        width: 320px;
        background: rgba(15, 15, 35, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: white;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 12px;
        z-index: 900;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
      }

      .performance-monitor.hidden {
        display: none;
      }

      .performance-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .performance-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .toggle-btn,
      .close-btn,
      .action-btn,
      .expand-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        transition: all 0.2s ease;
      }

      .toggle-btn:hover,
      .close-btn:hover,
      .action-btn:hover,
      .expand-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .toggle-btn.active {
        background: rgba(34, 197, 94, 0.3);
        border-color: rgba(34, 197, 94, 0.5);
      }

      .performance-content {
        padding: 16px;
      }

      .metrics-section,
      .warnings-section,
      .actions-section {
        margin-bottom: 16px;
      }

      .metrics-section h4,
      .warnings-section h4 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .metric.warning {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.4);
      }

      .metric .label {
        color: rgba(255, 255, 255, 0.7);
        font-size: 10px;
      }

      .metric .value {
        font-weight: 600;
        color: #00ff88;
      }

      .warnings {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .warning {
        padding: 4px 8px;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-radius: 4px;
        font-size: 10px;
        color: #fca5a5;
      }

      .actions-section {
        display: flex;
        gap: 8px;
      }

      .action-btn {
        flex: 1;
        padding: 6px 12px;
      }

      .floating-indicator {
        position: fixed;
        top: 260px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 899;
      }

      .fps-indicator {
        padding: 4px 8px;
        background: rgba(15, 15, 35, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: #00ff88;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 600;
      }

      .fps-indicator.warning {
        color: #ff6b6b;
        border-color: rgba(255, 107, 107, 0.4);
      }

      .expand-btn {
        padding: 4px 6px;
        background: rgba(15, 15, 35, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        font-size: 10px;
      }

      @media (max-width: 768px) {
        .performance-monitor {
          width: calc(100vw - 40px);
          max-width: 300px;
        }
      }
    `,
  ],
})
export class PerformanceMonitorComponent implements OnDestroy {
  private visible = true;

  constructor(public service: PerformanceMonitorService) {
    // Auto-start monitoring in development (check for localhost)
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      this.service.startMonitoring();
    }
  }

  ngOnDestroy(): void {
    this.service.stopMonitoring();
  }

  // Computed properties for reactive UI
  stats = computed(() => this.service.performanceStats());

  memoryMB = computed(() => this.stats().current.memoryUsage / 1024 / 1024);

  triangleCount = computed(() => {
    const count = this.stats().current.triangleCount;
    return count > 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString();
  });

  isVisible = computed(() => this.visible);

  toggleMonitoring(): void {
    if (this.service.isEnabled()) {
      this.service.stopMonitoring();
    } else {
      this.service.startMonitoring();
    }
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  exportData(): void {
    const data = this.service.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  showReport(): void {
    const report = this.service.getPerformanceReport();
    console.log(report);
    // Could also show in a modal or copy to clipboard
    navigator.clipboard?.writeText(report).then(() => {
      console.log('Performance report copied to clipboard');
    });
  }
}
