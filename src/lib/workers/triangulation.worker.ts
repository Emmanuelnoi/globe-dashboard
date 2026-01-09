/**
 * Triangulation Web Worker
 *
 * Performs earcut triangulation in a background thread to prevent
 * main thread blocking during country geometry creation.
 *
 * Messages:
 * - Input: { type: 'triangulate', id, coordinates, radius }
 * - Output: { type: 'result', id, vertices, indices, error? }
 */

import earcut from 'earcut';

// Message types
interface TriangulateMessage {
  type: 'triangulate';
  id: string;
  coordinates: number[][][]; // Polygon coordinates
  radius: number;
}

interface ResultMessage {
  type: 'result';
  id: string;
  vertices: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  processingTime: number;
}

interface ErrorMessage {
  type: 'error';
  id: string;
  error: string;
}

type WorkerMessage = TriangulateMessage;
type WorkerResponse = ResultMessage | ErrorMessage;

/**
 * Convert longitude/latitude to 3D sphere coordinates
 */
function lonLatToSphere(
  lon: number,
  lat: number,
  radius: number,
): [number, number, number] {
  const normalizedLon = ((lon + 180) % 360) - 180;
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (normalizedLon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return [x, y, z];
}

/**
 * Check if ring is clockwise (for proper hole detection)
 */
function isClockwise(ring: number[][]): boolean {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0;
}

/**
 * Ensure ring has correct winding for earcut
 * - Exterior ring: counter-clockwise
 * - Hole rings: clockwise
 */
function ensureWindingOrder(ring: number[][], isHole: boolean): number[][] {
  const clockwise = isClockwise(ring);

  // Exterior should be CCW (not clockwise), holes should be CW (clockwise)
  if (isHole ? !clockwise : clockwise) {
    return [...ring].reverse();
  }

  return ring;
}

/**
 * Triangulate polygon coordinates
 */
function triangulatePolygon(
  coordinates: number[][][],
  radius: number,
): { vertices: Float32Array; indices: Uint32Array } {
  // Process rings with correct winding
  const processedRings = coordinates.map((ring, index) =>
    ensureWindingOrder(ring, index > 0),
  );

  // Flatten for earcut
  const vertices2D: number[] = [];
  const vertices3D: number[] = [];
  const holeIndices: number[] = [];

  processedRings.forEach((ring, ringIndex) => {
    if (ringIndex > 0) {
      // Mark hole start index
      holeIndices.push(vertices2D.length / 2);
    }

    ring.forEach(([lon, lat]) => {
      // 2D for earcut
      vertices2D.push(lon, lat);

      // 3D for mesh
      const [x, y, z] = lonLatToSphere(lon, lat, radius);
      vertices3D.push(x, y, z);
    });
  });

  // Run earcut triangulation
  const triangles = earcut(
    vertices2D,
    holeIndices.length > 0 ? holeIndices : undefined,
    2,
  );

  // Validate triangles
  const maxIndex = vertices3D.length / 3 - 1;
  const validTriangles = triangles.filter((idx) => idx <= maxIndex);

  if (validTriangles.length !== triangles.length) {
    console.warn(
      `Triangulation produced ${triangles.length - validTriangles.length} invalid indices`,
    );
  }

  return {
    vertices: new Float32Array(vertices3D),
    indices: new Uint32Array(validTriangles),
  };
}

/**
 * Handle incoming messages
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'triangulate') {
    const startTime = performance.now();

    try {
      const { vertices, indices } = triangulatePolygon(
        message.coordinates,
        message.radius,
      );

      const response: ResultMessage = {
        type: 'result',
        id: message.id,
        vertices,
        indices,
        vertexCount: vertices.length / 3,
        triangleCount: indices.length / 3,
        processingTime: performance.now() - startTime,
      };

      // Transfer buffers for zero-copy performance
      self.postMessage(response, {
        transfer: [vertices.buffer, indices.buffer],
      });
    } catch (error) {
      const response: ErrorMessage = {
        type: 'error',
        id: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      self.postMessage(response);
    }
  }
};

// Signal ready
self.postMessage({ type: 'ready' });
