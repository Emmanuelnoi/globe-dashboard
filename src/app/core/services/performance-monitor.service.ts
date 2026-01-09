import { Injectable, signal, computed, inject } from '@angular/core';
import { LoggerService } from './logger.service';

/**
 * Performance metrics snapshot
 */
export interface PerformanceMetrics {
  // Frame metrics
  fps: number;
  frameTime: number;
  frameTimeAvg: number;
  frameTimeMax: number;
  frameTimeMin: number;

  // Render metrics
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;

  // Memory metrics (WebGL)
  geometries: number;
  textures: number;
  programs: number;

  // JS Memory (if available)
  jsHeapSize?: number;
  jsHeapUsed?: number;
  jsHeapLimit?: number;

  // Custom timings
  customTimings: Map<string, number>;

  // Timestamp
  timestamp: number;
}

/**
 * Performance budget thresholds
 */
export interface PerformanceBudget {
  targetFPS: number;
  maxFrameTime: number;
  maxDrawCalls: number;
  maxTriangles: number;
  maxMemoryMB: number;
  maxGeometries: number;
  maxTextures: number;
}

/**
 * Performance warning
 */
export interface PerformanceWarning {
  type:
    | 'fps'
    | 'frameTime'
    | 'drawCalls'
    | 'triangles'
    | 'memory'
    | 'geometries'
    | 'textures';
  message: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

/**
 * Default performance budget for 60fps target
 */
const DEFAULT_BUDGET: PerformanceBudget = {
  targetFPS: 60,
  maxFrameTime: 16.67, // ms per frame at 60fps
  maxDrawCalls: 100,
  maxTriangles: 500000,
  maxMemoryMB: 200,
  maxGeometries: 500,
  maxTextures: 50,
};

/**
 * PerformanceMonitorService
 *
 * Comprehensive performance monitoring for Three.js applications.
 * Tracks FPS, frame times, draw calls, memory usage, and custom timings.
 *
 * Features:
 * - Real-time FPS and frame time tracking
 * - WebGL renderer info (draw calls, triangles, geometries)
 * - Memory monitoring (JS heap + WebGL resources)
 * - Performance budget warnings
 * - Custom timing markers
 * - Chrome DevTools integration
 */
@Injectable({
  providedIn: 'root',
})
export class PerformanceMonitorService {
  private readonly logger = inject(LoggerService);

  // State
  private isMonitoring = false;
  private renderer?: THREE.WebGLRenderer;
  private budget: PerformanceBudget = { ...DEFAULT_BUDGET };

  // Frame tracking
  private frameCount = 0;
  private lastFPSUpdate = 0;
  private frameTimes: number[] = [];
  private readonly maxFrameSamples = 120; // 2 seconds at 60fps

  // Custom timings
  private customTimings = new Map<string, number>();
  private activeMarkers = new Map<string, number>();

  // Signals for reactive UI
  readonly metrics = signal<PerformanceMetrics>(this.createEmptyMetrics());
  readonly warnings = signal<PerformanceWarning[]>([]);
  readonly isEnabled = signal(false);

  // Computed signals
  readonly currentFPS = computed(() => this.metrics().fps);
  readonly isPerformanceGood = computed(() => {
    const m = this.metrics();
    return m.fps >= 55 && m.frameTime <= 18;
  });

  /**
   * Initialize the performance monitor with a Three.js renderer
   */
  initialize(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.logger.debug(
      'PerformanceMonitor initialized',
      'PerformanceMonitorService',
    );
  }

  /**
   * Start monitoring performance
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.isEnabled.set(true);
    this.lastFPSUpdate = performance.now();
    this.frameCount = 0;
    this.frameTimes = [];

    this.logger.debug(
      'Performance monitoring started',
      'PerformanceMonitorService',
    );
  }

  /**
   * Stop monitoring performance
   */
  stop(): void {
    this.isMonitoring = false;
    this.isEnabled.set(false);
    this.logger.debug(
      'Performance monitoring stopped',
      'PerformanceMonitorService',
    );
  }

  /**
   * Update metrics - call this at the end of each render frame
   */
  update(): void {
    if (!this.isMonitoring) return;

    const now = performance.now();
    this.frameCount++;

    // Calculate frame time
    const frameTime =
      this.frameTimes.length > 0
        ? now -
          (this.lastFPSUpdate - this.frameTimes.reduce((a, b) => a + b, 0))
        : 0;

    // Store frame time
    this.frameTimes.push(now);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    // Update metrics every 500ms
    const elapsed = now - this.lastFPSUpdate;
    if (elapsed >= 500) {
      const fps = (this.frameCount / elapsed) * 1000;
      const metrics = this.collectMetrics(fps, frameTime);
      this.metrics.set(metrics);

      // Check budget and generate warnings
      this.checkBudget(metrics);

      // Reset counters
      this.frameCount = 0;
      this.lastFPSUpdate = now;
    }
  }

  /**
   * Mark the start of a custom timing section
   */
  startTiming(label: string): void {
    if (!this.isMonitoring) return;
    this.activeMarkers.set(label, performance.now());

    // Chrome DevTools performance marker
    if (typeof performance.mark === 'function') {
      performance.mark(`${label}-start`);
    }
  }

  /**
   * Mark the end of a custom timing section and record duration
   */
  endTiming(label: string): number {
    if (!this.isMonitoring) return 0;

    const startTime = this.activeMarkers.get(label);
    if (startTime === undefined) {
      this.logger.warn(
        `No start marker found for: ${label}`,
        'PerformanceMonitorService',
      );
      return 0;
    }

    const duration = performance.now() - startTime;
    this.customTimings.set(label, duration);
    this.activeMarkers.delete(label);

    // Chrome DevTools performance marker
    if (
      typeof performance.mark === 'function' &&
      typeof performance.measure === 'function'
    ) {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
    }

    return duration;
  }

  /**
   * Set custom performance budget
   */
  setBudget(budget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...budget };
  }

  /**
   * Get current budget
   */
  getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  /**
   * Clear all warnings
   */
  clearWarnings(): void {
    this.warnings.set([]);
  }

  /**
   * Export metrics history for analysis
   */
  exportMetrics(): string {
    const data = {
      timestamp: new Date().toISOString(),
      budget: this.budget,
      currentMetrics: this.metrics(),
      warnings: this.warnings(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get a formatted metrics report
   */
  getReport(): string {
    const m = this.metrics();
    const lines = [
      '=== Performance Report ===',
      `FPS: ${m.fps.toFixed(1)} (target: ${this.budget.targetFPS})`,
      `Frame Time: ${m.frameTime.toFixed(2)}ms (avg: ${m.frameTimeAvg.toFixed(2)}ms, max: ${m.frameTimeMax.toFixed(2)}ms)`,
      `Draw Calls: ${m.drawCalls} (budget: ${this.budget.maxDrawCalls})`,
      `Triangles: ${m.triangles.toLocaleString()} (budget: ${this.budget.maxTriangles.toLocaleString()})`,
      `Geometries: ${m.geometries} | Textures: ${m.textures} | Programs: ${m.programs}`,
    ];

    if (m.jsHeapUsed !== undefined) {
      lines.push(
        `JS Heap: ${(m.jsHeapUsed / 1024 / 1024).toFixed(1)}MB / ${(m.jsHeapLimit! / 1024 / 1024).toFixed(0)}MB`,
      );
    }

    if (this.customTimings.size > 0) {
      lines.push('--- Custom Timings ---');
      this.customTimings.forEach((duration, label) => {
        lines.push(`  ${label}: ${duration.toFixed(2)}ms`);
      });
    }

    const currentWarnings = this.warnings();
    if (currentWarnings.length > 0) {
      lines.push('--- Warnings ---');
      currentWarnings.forEach((w) => {
        lines.push(`  [${w.severity.toUpperCase()}] ${w.message}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Log performance report to console
   */
  logReport(): void {
    console.log(this.getReport());
  }

  // Private methods

  private collectMetrics(fps: number, frameTime: number): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      fps: Math.round(fps),
      frameTime,
      frameTimeAvg: this.calculateAvgFrameTime(),
      frameTimeMax: this.calculateMaxFrameTime(),
      frameTimeMin: this.calculateMinFrameTime(),
      drawCalls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      customTimings: new Map(this.customTimings),
      timestamp: Date.now(),
    };

    // Get WebGL renderer info
    if (this.renderer) {
      const info = this.renderer.info;
      metrics.drawCalls = info.render.calls;
      metrics.triangles = info.render.triangles;
      metrics.points = info.render.points;
      metrics.lines = info.render.lines;
      metrics.geometries = info.memory.geometries;
      metrics.textures = info.memory.textures;
      metrics.programs = info.programs?.length ?? 0;
    }

    // Get JS memory info (Chrome only)
    const perfMemory = (
      performance as Performance & {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }
    ).memory;

    if (perfMemory) {
      metrics.jsHeapUsed = perfMemory.usedJSHeapSize;
      metrics.jsHeapSize = perfMemory.totalJSHeapSize;
      metrics.jsHeapLimit = perfMemory.jsHeapSizeLimit;
    }

    return metrics;
  }

  private calculateAvgFrameTime(): number {
    if (this.frameTimes.length < 2) return 0;
    const diffs: number[] = [];
    for (let i = 1; i < this.frameTimes.length; i++) {
      diffs.push(this.frameTimes[i] - this.frameTimes[i - 1]);
    }
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  private calculateMaxFrameTime(): number {
    if (this.frameTimes.length < 2) return 0;
    let max = 0;
    for (let i = 1; i < this.frameTimes.length; i++) {
      const diff = this.frameTimes[i] - this.frameTimes[i - 1];
      if (diff > max) max = diff;
    }
    return max;
  }

  private calculateMinFrameTime(): number {
    if (this.frameTimes.length < 2) return 0;
    let min = Infinity;
    for (let i = 1; i < this.frameTimes.length; i++) {
      const diff = this.frameTimes[i] - this.frameTimes[i - 1];
      if (diff < min) min = diff;
    }
    return min === Infinity ? 0 : min;
  }

  private checkBudget(metrics: PerformanceMetrics): void {
    const newWarnings: PerformanceWarning[] = [];
    const now = Date.now();

    // FPS check
    if (metrics.fps < this.budget.targetFPS * 0.9) {
      newWarnings.push({
        type: 'fps',
        message: `Low FPS: ${metrics.fps} (target: ${this.budget.targetFPS})`,
        value: metrics.fps,
        threshold: this.budget.targetFPS,
        severity:
          metrics.fps < 30 ? 'critical' : metrics.fps < 45 ? 'high' : 'medium',
        timestamp: now,
      });
    }

    // Frame time check
    if (metrics.frameTimeMax > this.budget.maxFrameTime * 2) {
      newWarnings.push({
        type: 'frameTime',
        message: `Frame spike: ${metrics.frameTimeMax.toFixed(1)}ms (budget: ${this.budget.maxFrameTime}ms)`,
        value: metrics.frameTimeMax,
        threshold: this.budget.maxFrameTime,
        severity:
          metrics.frameTimeMax > 100
            ? 'critical'
            : metrics.frameTimeMax > 50
              ? 'high'
              : 'medium',
        timestamp: now,
      });
    }

    // Draw calls check
    if (metrics.drawCalls > this.budget.maxDrawCalls) {
      newWarnings.push({
        type: 'drawCalls',
        message: `High draw calls: ${metrics.drawCalls} (budget: ${this.budget.maxDrawCalls})`,
        value: metrics.drawCalls,
        threshold: this.budget.maxDrawCalls,
        severity:
          metrics.drawCalls > this.budget.maxDrawCalls * 2 ? 'high' : 'medium',
        timestamp: now,
      });
    }

    // Triangle count check
    if (metrics.triangles > this.budget.maxTriangles) {
      newWarnings.push({
        type: 'triangles',
        message: `High triangle count: ${metrics.triangles.toLocaleString()} (budget: ${this.budget.maxTriangles.toLocaleString()})`,
        value: metrics.triangles,
        threshold: this.budget.maxTriangles,
        severity:
          metrics.triangles > this.budget.maxTriangles * 2 ? 'high' : 'medium',
        timestamp: now,
      });
    }

    // Memory check
    if (metrics.jsHeapUsed) {
      const usedMB = metrics.jsHeapUsed / 1024 / 1024;
      if (usedMB > this.budget.maxMemoryMB) {
        newWarnings.push({
          type: 'memory',
          message: `High memory usage: ${usedMB.toFixed(0)}MB (budget: ${this.budget.maxMemoryMB}MB)`,
          value: usedMB,
          threshold: this.budget.maxMemoryMB,
          severity:
            usedMB > this.budget.maxMemoryMB * 1.5 ? 'critical' : 'high',
          timestamp: now,
        });
      }
    }

    // Geometry count check
    if (metrics.geometries > this.budget.maxGeometries) {
      newWarnings.push({
        type: 'geometries',
        message: `High geometry count: ${metrics.geometries} (budget: ${this.budget.maxGeometries})`,
        value: metrics.geometries,
        threshold: this.budget.maxGeometries,
        severity: 'medium',
        timestamp: now,
      });
    }

    // Texture count check
    if (metrics.textures > this.budget.maxTextures) {
      newWarnings.push({
        type: 'textures',
        message: `High texture count: ${metrics.textures} (budget: ${this.budget.maxTextures})`,
        value: metrics.textures,
        threshold: this.budget.maxTextures,
        severity: 'medium',
        timestamp: now,
      });
    }

    // Only update if there are new warnings or warnings cleared
    if (newWarnings.length > 0 || this.warnings().length > 0) {
      this.warnings.set(newWarnings);
    }
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      fps: 0,
      frameTime: 0,
      frameTimeAvg: 0,
      frameTimeMax: 0,
      frameTimeMin: 0,
      drawCalls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      customTimings: new Map(),
      timestamp: 0,
    };
  }
}

// Type declaration for Three.js
declare namespace THREE {
  interface WebGLRenderer {
    info: {
      render: {
        calls: number;
        triangles: number;
        points: number;
        lines: number;
      };
      memory: {
        geometries: number;
        textures: number;
      };
      programs: unknown[] | null;
    };
  }
}
