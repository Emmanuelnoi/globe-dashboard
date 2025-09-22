import { Injectable, signal } from '@angular/core';
import { WebGLRenderer } from 'three';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export interface PerformanceMetrics {
  frameTime: number;
  fps: number;
  memoryUsage: number;
  renderTime: number;
  drawCalls: number;
  triangleCount: number;
  timestamp: number;
}

export interface PerformanceStats {
  current: PerformanceMetrics;
  average: PerformanceMetrics;
  peak: PerformanceMetrics;
  history: PerformanceMetrics[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root',
})
export class PerformanceMonitorService {
  private isMonitoring = false;
  private frameCount = 0;
  private lastTime = 0;
  private renderStartTime = 0;
  private history: PerformanceMetrics[] = [];
  private readonly maxHistorySize = 300; // 5 minutes at 60fps

  // Performance thresholds
  private readonly PERFORMANCE_THRESHOLDS = {
    minFps: 30,
    maxFrameTime: 33.33, // 30fps threshold
    maxMemoryMB: 512,
    maxRenderTime: 16.67, // 60fps threshold
  };

  // Reactive signals for UI updates
  public readonly performanceStats = signal<PerformanceStats>({
    current: this.createEmptyMetrics(),
    average: this.createEmptyMetrics(),
    peak: this.createEmptyMetrics(),
    history: [],
    warnings: [],
  });

  public readonly isEnabled = signal(false);

  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.isEnabled.set(true);
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.history = [];

    console.log('🔍 Performance monitoring started');
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.isEnabled.set(false);
    console.log('🔍 Performance monitoring stopped');
  }

  // Call this at the start of each render frame
  beginRender(): void {
    if (!this.isMonitoring) return;
    this.renderStartTime = performance.now();
  }

  // Call this at the end of each render frame
  endRender(renderer?: WebGLRenderer): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const renderTime = currentTime - this.renderStartTime;
    const frameTime = currentTime - this.lastTime;

    this.frameCount++;

    // Calculate metrics
    const metrics: PerformanceMetrics = {
      frameTime,
      fps: 1000 / frameTime,
      memoryUsage: this.getMemoryUsage(),
      renderTime,
      drawCalls: renderer?.info?.render?.calls || 0,
      triangleCount: renderer?.info?.render?.triangles || 0,
      timestamp: currentTime,
    };

    // Add to history
    this.history.push(metrics);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Update performance stats
    this.updatePerformanceStats(metrics);

    this.lastTime = currentTime;
  }

  // Get performance report for debugging
  getPerformanceReport(): string {
    const stats = this.performanceStats();
    const { current, average, warnings } = stats;

    return `
🎯 Performance Report
─────────────────────
📊 Current Metrics:
  • FPS: ${current.fps.toFixed(1)}
  • Frame Time: ${current.frameTime.toFixed(2)}ms
  • Render Time: ${current.renderTime.toFixed(2)}ms
  • Memory: ${(current.memoryUsage / 1024 / 1024).toFixed(1)}MB
  • Draw Calls: ${current.drawCalls}
  • Triangles: ${current.triangleCount.toLocaleString()}

📈 Average Metrics:
  • FPS: ${average.fps.toFixed(1)}
  • Frame Time: ${average.frameTime.toFixed(2)}ms
  • Render Time: ${average.renderTime.toFixed(2)}ms
  • Memory: ${(average.memoryUsage / 1024 / 1024).toFixed(1)}MB

⚠️ Warnings: ${warnings.length > 0 ? warnings.join(', ') : 'None'}
`;
  }

  // Export performance data for analysis
  exportData(): {
    timestamp: string;
    stats: PerformanceStats;
    userAgent: string;
    screenResolution: string;
    devicePixelRatio: number;
  } {
    return {
      timestamp: new Date().toISOString(),
      stats: this.performanceStats(),
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
    };
  }

  private updatePerformanceStats(current: PerformanceMetrics): void {
    const stats = this.performanceStats();

    // Calculate averages
    const average = this.calculateAverages();

    // Calculate peaks
    const peak = this.calculatePeaks();

    // Generate warnings
    const warnings = this.generateWarnings(current);

    // Update signal
    this.performanceStats.set({
      current,
      average,
      peak,
      history: [...this.history],
      warnings,
    });
  }

  private calculateAverages(): PerformanceMetrics {
    if (this.history.length === 0) return this.createEmptyMetrics();

    const totals = this.history.reduce(
      (acc, metrics) => ({
        frameTime: acc.frameTime + metrics.frameTime,
        fps: acc.fps + metrics.fps,
        memoryUsage: acc.memoryUsage + metrics.memoryUsage,
        renderTime: acc.renderTime + metrics.renderTime,
        drawCalls: acc.drawCalls + metrics.drawCalls,
        triangleCount: acc.triangleCount + metrics.triangleCount,
        timestamp: Math.max(acc.timestamp, metrics.timestamp),
      }),
      this.createEmptyMetrics(),
    );

    const count = this.history.length;
    return {
      frameTime: totals.frameTime / count,
      fps: totals.fps / count,
      memoryUsage: totals.memoryUsage / count,
      renderTime: totals.renderTime / count,
      drawCalls: totals.drawCalls / count,
      triangleCount: totals.triangleCount / count,
      timestamp: totals.timestamp,
    };
  }

  private calculatePeaks(): PerformanceMetrics {
    if (this.history.length === 0) return this.createEmptyMetrics();

    return this.history.reduce((peak, metrics) => ({
      frameTime: Math.max(peak.frameTime, metrics.frameTime),
      fps: Math.max(peak.fps, metrics.fps),
      memoryUsage: Math.max(peak.memoryUsage, metrics.memoryUsage),
      renderTime: Math.max(peak.renderTime, metrics.renderTime),
      drawCalls: Math.max(peak.drawCalls, metrics.drawCalls),
      triangleCount: Math.max(peak.triangleCount, metrics.triangleCount),
      timestamp: Math.max(peak.timestamp, metrics.timestamp),
    }));
  }

  private generateWarnings(current: PerformanceMetrics): string[] {
    const warnings: string[] = [];

    if (current.fps < this.PERFORMANCE_THRESHOLDS.minFps) {
      warnings.push(`Low FPS: ${current.fps.toFixed(1)}`);
    }

    if (current.frameTime > this.PERFORMANCE_THRESHOLDS.maxFrameTime) {
      warnings.push(`High frame time: ${current.frameTime.toFixed(2)}ms`);
    }

    if (
      current.memoryUsage >
      this.PERFORMANCE_THRESHOLDS.maxMemoryMB * 1024 * 1024
    ) {
      warnings.push(
        `High memory usage: ${(current.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    if (current.renderTime > this.PERFORMANCE_THRESHOLDS.maxRenderTime) {
      warnings.push(`Slow rendering: ${current.renderTime.toFixed(2)}ms`);
    }

    return warnings;
  }

  private getMemoryUsage(): number {
    // Use Performance.memory if available (Chrome)
    if ('memory' in performance) {
      return (performance as PerformanceWithMemory).memory?.usedJSHeapSize || 0;
    }

    // Fallback estimation
    return 0;
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      frameTime: 0,
      fps: 0,
      memoryUsage: 0,
      renderTime: 0,
      drawCalls: 0,
      triangleCount: 0,
      timestamp: 0,
    };
  }
}
