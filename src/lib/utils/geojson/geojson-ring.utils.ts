/**
 * GeoJSON Ring Processing Utilities
 * Handles ring preprocessing for Earcut triangulation
 * Extracted from geojson.utils.ts
 */

export interface RingProcessingOptions {
  useSphericalWinding?: boolean;
  invertWinding?: boolean;
  isExteriorRing?: boolean;
}

/**
 * Remove duplicate closing point if present
 * Degenerate triangles from duplicate points confuse earcut
 */
export function removeRingClosure(ring: number[][]): number[][] {
  if (!ring || ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring;
}

/**
 * Unwrap longitudes to avoid cross-dateline triangles
 * Antimeridian wrapping creates triangles that appear inverted on sphere
 */
export function unwrapLongitudes(ring: number[][]): number[][] {
  if (!ring || ring.length === 0) return ring;
  const out: number[][] = [];
  let lastLon = ring[0][0];
  out.push([lastLon, ring[0][1]]);
  for (let i = 1; i < ring.length; i++) {
    let [lon] = ring[i];
    const lat = ring[i][1];
    while (lon - lastLon > 180) lon -= 360;
    while (lon - lastLon < -180) lon += 360;
    out.push([lon, lat]);
    lastLon = lon;
  }
  return out;
}

/**
 * Ensure consistent winding for earcut convention
 * Outer ring CCW, holes CW (earcut standard)
 */
export function ensureWindingForEarcut(
  ring: number[][],
  shouldBeCCW: boolean,
): number[][] {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += (x2 - x1) * (y2 + y1);
  }
  const isCCW = area > 0;
  if (isCCW !== shouldBeCCW) {
    return [...ring].reverse();
  }
  return ring;
}

/**
 * Calculate signed area for winding analysis (planar)
 */
export function calculateSignedArea(ring: number[][]): number {
  if (ring.length < 3) return 0;

  let signedArea = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[j];
    signedArea += (lon2 - lon1) * (lat2 + lat1);
  }

  return signedArea / 2;
}

/**
 * Calculate spherical signed area for proper winding on sphere
 */
export function calculateSphericalSignedArea(ring: number[][]): number {
  if (ring.length < 3) return 0;

  let sphericalArea = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[j];

    // Convert to radians
    const λ1 = (lon1 * Math.PI) / 180;
    const φ1 = (lat1 * Math.PI) / 180;
    const λ2 = (lon2 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;

    // Spherical excess method for signed area
    const Δλ = λ2 - λ1;

    // Handle antimeridian crossing
    let adjustedΔλ = Δλ;
    if (Math.abs(Δλ) > Math.PI) {
      adjustedΔλ = Δλ > 0 ? Δλ - 2 * Math.PI : Δλ + 2 * Math.PI;
    }

    // Spherical area contribution
    const E =
      2 *
      Math.atan2(
        Math.tan(adjustedΔλ / 2) * (Math.sin(φ1) + Math.sin(φ2)),
        2 +
          Math.sin(φ1) * Math.sin(φ2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.cos(adjustedΔλ),
      );

    sphericalArea += E;
  }

  return sphericalArea;
}

/**
 * Process a ring for Earcut triangulation
 * Applies all necessary transformations: closure removal, unwrapping, winding correction
 */
export function processRingForEarcut(
  ring: number[][],
  ringIndex: number,
  options: RingProcessingOptions = {},
): number[][] {
  const {
    useSphericalWinding = true,
    invertWinding = false,
    isExteriorRing = ringIndex === 0,
  } = options;

  // Step 1: Remove closure
  let processed = removeRingClosure(ring);

  // Step 2: Unwrap antimeridian
  processed = unwrapLongitudes(processed);

  // Step 3: Correct winding
  let shouldBeCCW: boolean;
  if (useSphericalWinding) {
    const sphericalArea = calculateSphericalSignedArea(processed);
    const expectedCCW = isExteriorRing;
    shouldBeCCW = invertWinding ? !expectedCCW : expectedCCW;
  } else {
    shouldBeCCW = invertWinding ? !isExteriorRing : isExteriorRing;
  }

  processed = ensureWindingForEarcut(processed, shouldBeCCW);

  return processed;
}
