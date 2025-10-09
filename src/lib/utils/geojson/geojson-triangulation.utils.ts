/**
 * GeoJSON Triangulation Utilities
 * Core triangulation logic extracted from geojson.utils.ts
 */

import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three';
import earcut from 'earcut';

export interface TriangulationResult {
  geometry: BufferGeometry;
  vertexCount: number;
  triangleCount: number;
}

/**
 * Prepare rings for triangulation by flattening to 2D/3D arrays
 */
export function prepareTriangulationData(
  rings: number[][][],
  toSphereFunc: (lon: number, lat: number, radius: number) => Vector3,
  radius: number,
): {
  vertices2D: number[];
  vertices3D: Vector3[];
  holeIndices: number[];
} {
  const vertices2D: number[] = [];
  const vertices3D: Vector3[] = [];
  const holeIndices: number[] = [];

  // Add exterior ring
  rings[0].forEach(([lon, lat]) => {
    vertices2D.push(lon, lat);
    vertices3D.push(toSphereFunc(lon, lat, radius));
  });

  // Add hole rings and track hole start indices
  for (let ringIndex = 1; ringIndex < rings.length; ringIndex++) {
    holeIndices.push(vertices2D.length / 2);

    rings[ringIndex].forEach(([lon, lat]) => {
      vertices2D.push(lon, lat);
      vertices3D.push(toSphereFunc(lon, lat, radius));
    });
  }

  return { vertices2D, vertices3D, holeIndices };
}

/**
 * Triangulate using earcut with validation
 */
export function triangulateWithValidation(
  vertices2D: number[],
  holeIndices: number[],
  vertexCount: number,
  name: string,
): number[] | null {
  // Triangulate using earcut with hole support
  const triangles =
    holeIndices.length > 0
      ? earcut(vertices2D, holeIndices)
      : earcut(vertices2D);

  if (triangles.length === 0) {
    console.warn(`❌ Triangulation failed for ${name}: no triangles generated`);
    return null;
  }

  // Validate triangle indices
  const maxIndex = Math.max(...triangles);
  if (maxIndex >= vertexCount) {
    console.error(
      `❌ INVALID TRIANGULATION for ${name}: max index ${maxIndex} >= vertex count ${vertexCount}`,
    );
    return null;
  }

  return triangles;
}

/**
 * Create BufferGeometry from triangulation data
 */
export function createGeometryFromTriangles(
  vertices3D: Vector3[],
  triangles: number[],
): BufferGeometry {
  const geometry = new BufferGeometry();

  // Create position attribute
  const allPositions: number[] = [];
  vertices3D.forEach((vertex) => {
    allPositions.push(vertex.x, vertex.y, vertex.z);
  });

  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(allPositions, 3),
  );
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();

  // Convert to non-indexed geometry to prevent merge corruption
  const safeGeometry = geometry.toNonIndexed();
  safeGeometry.computeVertexNormals();

  return safeGeometry;
}

/**
 * Apply radial offset to geometry to prevent z-fighting
 */
export function applyRadialOffset(
  geometry: BufferGeometry,
  offset: number,
): void {
  const positionAttribute = geometry.attributes['position'];
  const positions = positionAttribute.array as Float32Array;

  // Push each vertex slightly away from Earth center
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const length = Math.sqrt(x * x + y * y + z * z) || 1;
    const factor = (length + offset) / length;
    positions[i] = x * factor;
    positions[i + 1] = y * factor;
    positions[i + 2] = z * factor;
  }

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}
