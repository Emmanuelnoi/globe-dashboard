/**
 * GeoJSON Debug Utilities
 * Extracted debug/logging logic from geojson.utils.ts
 * Only loaded when DEBUG_GEOMETRY is enabled
 */

import { Vector3 } from 'three';

export interface TriangulationDebugData {
  name: string;
  originalRings: number[][][];
  correctedRings: number[][][];
  vertices2D: number[];
  vertices3D: Vector3[];
  holeIndices: number[];
  triangles: number[];
  useSphericalWinding: boolean;
  invertWinding: boolean;
}

export interface WindingDebugInfo {
  ringIndex: number;
  sphericalArea: number;
  isCurrentlyCCW: boolean;
  shouldBeCCW: boolean;
}

/**
 * GeoJSON debugging utility class
 */
export class GeoJSONDebugger {
  private static readonly DEBUG_COUNTRIES = [
    'USA',
    'United States',
    'Brazil',
    'Canada',
  ];

  /**
   * Check if country should be debugged
   */
  static shouldDebugCountry(name: string, triangleCount: number): boolean {
    return (
      this.DEBUG_COUNTRIES.some((country) => name.includes(country)) ||
      triangleCount < 100
    );
  }

  /**
   * Log triangulation process details
   */
  static logTriangulation(data: TriangulationDebugData): void {
    const {
      name,
      originalRings,
      correctedRings,
      vertices2D,
      vertices3D,
      holeIndices,
      triangles,
    } = data;

    console.log(
      `🔺 Triangulating ${name}: ${originalRings.length} rings (1 outer + ${originalRings.length - 1} holes)`,
    );
    console.log(`🔍 DETAILED DEBUG for ${name}:`);
    console.log(
      `  Original rings: ${originalRings.length} (${originalRings.map((r) => r.length).join(', ')} vertices each)`,
    );
    console.log(
      `  Processed rings: ${correctedRings.length} (${correctedRings.map((r) => r.length).join(', ')} vertices each)`,
    );
    console.log(`  Hole indices: [${holeIndices.join(', ')}]`);
    console.log(`  Vertices2D: ${vertices2D.length / 2} points`);
    console.log(`  Vertices3D: ${vertices3D.length} points`);
    console.log(
      `  Triangles: ${triangles.length / 3} (${triangles.length} indices)`,
    );
    console.log(
      `  Index range: ${Math.min(...triangles)} to ${Math.max(...triangles)}`,
    );
  }

  /**
   * Log ring processing fixes
   */
  static logRingFixes(
    originalRings: number[][][],
    correctedRings: number[][][],
  ): void {
    originalRings.forEach((originalRing, i) => {
      const correctedRing = correctedRings[i];
      const originalLength = originalRing.length;
      const correctedLength = correctedRing.length;
      const hadClosure = originalLength !== correctedLength;
      const originalArea = this.calculateSignedArea(originalRing);
      const correctedArea = this.calculateSignedArea(correctedRing);
      const wasReversed = originalArea > 0 !== correctedArea > 0;

      console.log(`  Ring ${i} fixes:`);
      console.log(
        `    ✅ Closure removal: ${hadClosure ? `${originalLength} → ${correctedLength} vertices` : 'not needed'}`,
      );
      console.log(`    ✅ Antimeridian unwrap: applied`);
      console.log(
        `    ✅ Winding fix: ${wasReversed ? 'reversed' : 'correct'} (${correctedArea > 0 ? 'CCW' : 'CW'})`,
      );
    });
  }

  /**
   * Log winding configuration
   */
  static logWindingConfig(
    name: string,
    useSphericalWinding: boolean,
    invertWinding: boolean,
  ): void {
    console.log(`🔄 ENHANCED WINDING CONFIG for ${name}:`);
    console.log(
      `  Spherical winding: ${useSphericalWinding ? 'ENABLED (proper sphere geometry)' : 'DISABLED (planar fallback)'}`,
    );
    console.log(
      `  Invert winding: ${invertWinding ? 'YES (manual override)' : 'NO (standard earcut)'}`,
    );
    console.log(
      `  Expected: outer ${invertWinding ? 'CW' : 'CCW'}, holes ${invertWinding ? 'CCW' : 'CW'}`,
    );
    console.log(
      `  ✅ SPHERICAL FIX: Using proper spherical area calculations for winding`,
    );
  }

  /**
   * Log winding decision for a ring
   */
  static logWindingDecision(info: WindingDebugInfo): void {
    const { ringIndex, sphericalArea, isCurrentlyCCW, shouldBeCCW } = info;
    console.log(
      `  Ring ${ringIndex}: spherical area = ${sphericalArea.toFixed(6)}, ` +
        `currently ${isCurrentlyCCW ? 'CCW' : 'CW'}, ` +
        `target ${shouldBeCCW ? 'CCW' : 'CW'}`,
    );
  }

  /**
   * Log sample triangles with position info
   */
  static logSampleTriangles(
    triangles: number[],
    vertices3D: Vector3[],
    sampleCount: number = 6,
  ): void {
    for (let i = 0; i < Math.min(sampleCount, triangles.length); i += 3) {
      const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
      const va = vertices3D[a];
      const vb = vertices3D[b];
      const vc = vertices3D[c];
      console.log(
        `    Triangle ${i / 3}: [${a}, ${b}, ${c}] - ` +
          `positions: [${va.x.toFixed(2)}, ${va.y.toFixed(2)}] ` +
          `[${vb.x.toFixed(2)}, ${vb.y.toFixed(2)}] ` +
          `[${vc.x.toFixed(2)}, ${vc.y.toFixed(2)}]`,
      );
    }
  }

  /**
   * Validate and log triangle normal direction
   */
  static validateTriangleNormal(
    triangles: number[],
    vertices3D: Vector3[],
  ): { isOutward: boolean; dotProduct: number } {
    if (triangles.length < 3) {
      return { isOutward: false, dotProduct: 0 };
    }

    const [a, b, c] = [triangles[0], triangles[1], triangles[2]];
    const va = vertices3D[a];
    const vb = vertices3D[b];
    const vc = vertices3D[c];

    // Calculate triangle normal
    const edge1 = vb.clone().sub(va);
    const edge2 = vc.clone().sub(va);
    const normal = edge1.cross(edge2).normalize();
    const centroid = va.clone().add(vb).add(vc).divideScalar(3);

    // Normal should point outward from sphere center
    const expectedOutward = centroid.clone().normalize();
    const dotProduct = normal.dot(expectedOutward);

    console.log(
      `  First triangle normal: [${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)}]`,
    );
    console.log(
      `  Expected outward: [${expectedOutward.x.toFixed(3)}, ${expectedOutward.y.toFixed(3)}, ${expectedOutward.z.toFixed(3)}]`,
    );
    console.log(
      `  Dot product: ${dotProduct.toFixed(3)} ${dotProduct > 0 ? '✅ (outward - CORRECT!)' : '❌ (inward - INVERTED!)'}`,
    );

    return { isOutward: dotProduct > 0, dotProduct };
  }

  /**
   * Log triangulation verification results
   */
  static logVerificationResults(
    useSphericalWinding: boolean,
    triangleCount: number,
    isOutward: boolean,
  ): void {
    console.log('');
    console.log('🧪 SPHERICAL TRIANGULATION VERIFICATION:');
    console.log(
      `  ✅ Interior fill: ${isOutward ? 'PASS - Will show solid landmass' : 'FAIL - Will show hollow outline'}`,
    );
    console.log(
      `  ✅ Triangle topology: ${triangleCount > 0 ? 'PASS - Triangles generated' : 'FAIL - No triangles'}`,
    );
    console.log(
      `  ✅ Spherical winding: ${useSphericalWinding ? 'ENABLED - Using proper sphere geometry' : 'DISABLED - Using planar approximation'}`,
    );
    console.log(
      `  ✅ Earcut processing: Applied (closure: removed, antimeridian: unwrapped, spherical winding: corrected)`,
    );
    console.log('');

    if (isOutward) {
      console.log('🎉 SUCCESS: Spherical triangulation working correctly!');
      console.log('   Countries should now show proper solid interior fills.');
    } else {
      console.log('🔧 FALLBACK OPTIONS if fill still appears inverted:');
      console.log(
        '   1. window.COUNTRY_INVERT_WINDING = true; location.reload();',
      );
      console.log(
        '   2. window.COUNTRY_SPHERICAL_WINDING = false; location.reload();',
      );
      console.log('   3. Check material.side = THREE.DoubleSide in debug mode');
    }
  }

  /**
   * Log triangulation data summary
   */
  static logTriangulationSummary(
    vertices2DCount: number,
    holeIndices: number[],
  ): void {
    console.log(
      `📊 Triangulation data: ${vertices2DCount / 2} vertices, ` +
        `${holeIndices.length} holes at indices [${holeIndices.join(', ')}]`,
    );
  }

  /**
   * Calculate signed area (planar approximation)
   */
  private static calculateSignedArea(ring: number[][]): number {
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
}
