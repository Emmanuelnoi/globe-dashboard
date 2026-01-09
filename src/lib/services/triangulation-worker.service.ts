import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { LoggerService } from '@/core/services/logger.service';
import { BufferGeometry, Float32BufferAttribute } from 'three';

/**
 * Pending triangulation request
 */
interface PendingRequest {
  resolve: (geometry: BufferGeometry) => void;
  reject: (error: Error) => void;
  startTime: number;
}

/**
 * Worker response types
 */
interface WorkerResult {
  type: 'result';
  id: string;
  vertices: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  processingTime: number;
}

interface WorkerError {
  type: 'error';
  id: string;
  error: string;
}

interface WorkerReady {
  type: 'ready';
}

type WorkerResponse = WorkerResult | WorkerError | WorkerReady;

/**
 * Triangulation stats
 */
export interface TriangulationStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  totalVertices: number;
  totalTriangles: number;
}

/**
 * TriangulationWorkerService
 *
 * Manages a Web Worker for off-main-thread polygon triangulation.
 * Prevents UI blocking during heavy geometry creation operations.
 *
 * Features:
 * - Async triangulation with Promise API
 * - Automatic worker lifecycle management
 * - Request queuing and batching
 * - Performance statistics
 * - Fallback to main thread if Worker unavailable
 */
@Injectable({
  providedIn: 'root',
})
export class TriangulationWorkerService implements OnDestroy {
  private readonly logger = inject(LoggerService);

  // Worker state
  private worker: Worker | null = null;
  private isReady = signal(false);
  private requestId = 0;
  private pendingRequests = new Map<string, PendingRequest>();

  // Stats
  private stats: TriangulationStats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    totalVertices: 0,
    totalTriangles: 0,
  };

  constructor() {
    this.initializeWorker();
  }

  /**
   * Triangulate polygon coordinates using Web Worker
   *
   * @param coordinates Polygon coordinates (exterior ring + optional holes)
   * @param radius Sphere radius for 3D projection
   * @returns Promise resolving to BufferGeometry
   */
  async triangulate(
    coordinates: number[][][],
    radius: number = 2,
  ): Promise<BufferGeometry> {
    this.stats.totalRequests++;

    // Fallback to main thread if worker not available
    if (!this.worker || !this.isReady()) {
      return this.triangulateMainThread(coordinates, radius);
    }

    return new Promise((resolve, reject) => {
      const id = `tri_${this.requestId++}`;

      this.pendingRequests.set(id, {
        resolve,
        reject,
        startTime: performance.now(),
      });

      this.worker!.postMessage({
        type: 'triangulate',
        id,
        coordinates,
        radius,
      });
    });
  }

  /**
   * Triangulate multiple polygons in parallel
   */
  async triangulateAll(
    polygons: Array<{ coordinates: number[][][]; radius?: number }>,
  ): Promise<BufferGeometry[]> {
    return Promise.all(
      polygons.map(({ coordinates, radius }) =>
        this.triangulate(coordinates, radius),
      ),
    );
  }

  /**
   * Check if worker is ready
   */
  workerReady(): boolean {
    return this.isReady();
  }

  /**
   * Get triangulation statistics
   */
  getStats(): TriangulationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      totalVertices: 0,
      totalTriangles: 0,
    };
  }

  ngOnDestroy(): void {
    this.terminate();
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady.set(false);

      // Reject any pending requests
      this.pendingRequests.forEach((request) => {
        request.reject(new Error('Worker terminated'));
      });
      this.pendingRequests.clear();
    }
  }

  // Private methods

  private initializeWorker(): void {
    try {
      // Create worker from the worker file
      this.worker = new Worker(
        new URL('../workers/triangulation.worker.ts', import.meta.url),
        { type: 'module' },
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        this.logger.error(
          'Triangulation worker error',
          error,
          'TriangulationWorkerService',
        );
        this.isReady.set(false);
      };

      // this.logger.debug(
      //   'Triangulation worker initialized',
      //   'TriangulationWorkerService',
      // );
    } catch (error) {
      this.logger.warn(
        'Failed to create triangulation worker, using main thread fallback',
        'TriangulationWorkerService',
        error,
      );
      this.worker = null;
    }
  }

  private handleWorkerMessage(message: WorkerResponse): void {
    if (message.type === 'ready') {
      this.isReady.set(true);
      // this.logger.debug('Triangulation worker ready', 'TriangulationWorkerService');
      return;
    }

    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      this.logger.warn(
        `No pending request for id: ${message.id}`,
        'TriangulationWorkerService',
      );
      return;
    }

    this.pendingRequests.delete(message.id);

    if (message.type === 'error') {
      this.stats.failedRequests++;
      pending.reject(new Error(message.error));
      return;
    }

    // Success - create BufferGeometry from transferred buffers
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(message.vertices, 3),
    );
    geometry.setIndex(Array.from(message.indices));
    geometry.computeVertexNormals();

    // Update stats
    this.stats.completedRequests++;
    this.stats.totalProcessingTime += message.processingTime;
    this.stats.averageProcessingTime =
      this.stats.totalProcessingTime / this.stats.completedRequests;
    this.stats.totalVertices += message.vertexCount;
    this.stats.totalTriangles += message.triangleCount;

    pending.resolve(geometry);
  }

  /**
   * Fallback triangulation on main thread
   */
  private async triangulateMainThread(
    coordinates: number[][][],
    radius: number,
  ): Promise<BufferGeometry> {
    // Dynamic import earcut for fallback
    const { default: earcut } = await import('earcut');

    const vertices2D: number[] = [];
    const vertices3D: number[] = [];
    const holeIndices: number[] = [];

    coordinates.forEach((ring, ringIndex) => {
      if (ringIndex > 0) {
        holeIndices.push(vertices2D.length / 2);
      }

      ring.forEach(([lon, lat]) => {
        vertices2D.push(lon, lat);

        // Convert to 3D
        const normalizedLon = ((lon + 180) % 360) - 180;
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (normalizedLon + 180) * (Math.PI / 180);

        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        vertices3D.push(x, y, z);
      });
    });

    const triangles = earcut(
      vertices2D,
      holeIndices.length > 0 ? holeIndices : undefined,
      2,
    );

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(vertices3D, 3),
    );
    geometry.setIndex(triangles);
    geometry.computeVertexNormals();

    this.stats.completedRequests++;

    return geometry;
  }
}
