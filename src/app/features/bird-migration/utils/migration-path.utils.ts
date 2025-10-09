/**
 * Migration Path Utilities
 * Geometry generation for bird migration paths on globe
 *
 * @module migration-path.utils
 * @description Creates realistic curved paths between migration points
 */

import * as THREE from 'three';
import { MigrationRecord } from '../models/migration.types';
import { migrationLogger } from './migration-logger.utils';

/**
 * Path generation configuration
 */
interface PathConfig {
  readonly segments: number; // Number of curve segments
  readonly altitude: number; // Peak altitude above surface
  readonly smoothness: number; // Curve smoothness factor
}

/**
 * Default path configuration
 */
const DEFAULT_PATH_CONFIG: PathConfig = {
  segments: 150, // Smooth curves
  altitude: 0.3, // 0.3 units above globe surface
  smoothness: 0.5, // Moderate smoothness
};

/**
 * Generate curved migration path
 * Uses great circle interpolation with altitude variation
 *
 * @param migration Migration record with start/end/waypoints
 * @param globeRadius Radius of the globe
 * @param config Path generation configuration
 * @returns Array of Vector3 points for the path
 */
export function generateMigrationPath(
  migration: MigrationRecord,
  globeRadius: number = 2.02,
  config: PathConfig = DEFAULT_PATH_CONFIG,
): THREE.Vector3[] {
  // Convert all locations to Vector3
  const points: THREE.Vector3[] = [];

  // Start location
  points.push(
    latLonToVector3(
      migration.startLocation.lat,
      migration.startLocation.lon,
      globeRadius,
    ),
  );

  // Waypoints (if provided)
  if (migration.waypoints && migration.waypoints.length > 0) {
    migration.waypoints.forEach((waypoint) => {
      points.push(latLonToVector3(waypoint.lat, waypoint.lon, globeRadius));
    });
  }

  // End location
  points.push(
    latLonToVector3(
      migration.endLocation.lat,
      migration.endLocation.lon,
      globeRadius,
    ),
  );

  // Generate smooth curve through all points
  return generateSmoothCurve(points, config, globeRadius);
}

/**
 * Generate smooth curve through points with altitude variation
 */
function generateSmoothCurve(
  controlPoints: THREE.Vector3[],
  config: PathConfig,
  globeRadius: number,
): THREE.Vector3[] {
  if (controlPoints.length < 2) {
    migrationLogger.warn('Cannot generate curve with less than 2 points');
    return controlPoints;
  }

  const curvePoints: THREE.Vector3[] = [];

  // Generate segments between each pair of control points
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const start = controlPoints[i];
    const end = controlPoints[i + 1];

    // Calculate number of segments for this section
    const segmentsForSection = Math.floor(
      config.segments / (controlPoints.length - 1),
    );

    // Generate interpolated points
    for (let j = 0; j <= segmentsForSection; j++) {
      const t = j / segmentsForSection;

      // Great circle interpolation (slerp)
      const point = new THREE.Vector3().lerpVectors(start, end, t);

      // Normalize to maintain consistent distance from center
      point.normalize();

      // Add altitude variation (parabolic arc)
      const altitudeMultiplier = 1 + config.altitude * Math.sin(t * Math.PI);
      point.multiplyScalar(globeRadius * altitudeMultiplier);

      // Skip duplicate points at segment boundaries
      if (j > 0 || i === 0) {
        curvePoints.push(point);
      }
    }
  }

  migrationLogger.debug(`Generated path with ${curvePoints.length} points`);
  return curvePoints;
}

/**
 * Generate path using CatmullRomCurve3 for smoother interpolation
 * Alternative approach for more natural curves
 *
 * @param migration Migration record
 * @param globeRadius Radius of globe
 * @returns Array of Vector3 points
 */
export function generateCatmullRomPath(
  migration: MigrationRecord,
  globeRadius: number = 2.02,
): THREE.Vector3[] {
  const controlPoints: THREE.Vector3[] = [];

  // Collect all control points
  controlPoints.push(
    latLonToVector3(
      migration.startLocation.lat,
      migration.startLocation.lon,
      globeRadius,
    ),
  );

  migration.waypoints?.forEach((waypoint) => {
    controlPoints.push(
      latLonToVector3(waypoint.lat, waypoint.lon, globeRadius),
    );
  });

  controlPoints.push(
    latLonToVector3(
      migration.endLocation.lat,
      migration.endLocation.lon,
      globeRadius,
    ),
  );

  // Create CatmullRom curve
  const curve = new THREE.CatmullRomCurve3(
    controlPoints,
    false,
    'catmullrom',
    0.5,
  );

  // Sample points along curve
  const points = curve.getPoints(150);

  // Add altitude variation
  points.forEach((point, index) => {
    const t = index / (points.length - 1);
    const altitude = 1 + 0.3 * Math.sin(t * Math.PI);
    point.normalize().multiplyScalar(globeRadius * altitude);
  });

  return points;
}

/**
 * Convert latitude/longitude to 3D Vector3 on sphere
 *
 * @param lat Latitude in degrees (-90 to 90)
 * @param lon Longitude in degrees (-180 to 180)
 * @param radius Sphere radius
 * @returns Vector3 position on sphere
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Calculate path length
 *
 * @param points Array of Vector3 points
 * @returns Total path length
 */
export function calculatePathLength(points: THREE.Vector3[]): number {
  let length = 0;

  for (let i = 1; i < points.length; i++) {
    length += points[i].distanceTo(points[i - 1]);
  }

  return length;
}

/**
 * Get point at specific distance along path
 *
 * @param points Array of Vector3 points
 * @param distance Distance along path
 * @returns Interpolated point at distance
 */
export function getPointAtDistance(
  points: THREE.Vector3[],
  distance: number,
): THREE.Vector3 | null {
  if (points.length < 2) return null;

  let accumulatedDistance = 0;

  for (let i = 1; i < points.length; i++) {
    const segmentLength = points[i].distanceTo(points[i - 1]);

    if (accumulatedDistance + segmentLength >= distance) {
      // Interpolate between points[i-1] and points[i]
      const t = (distance - accumulatedDistance) / segmentLength;
      return new THREE.Vector3().lerpVectors(points[i - 1], points[i], t);
    }

    accumulatedDistance += segmentLength;
  }

  // Return last point if distance exceeds path length
  return points[points.length - 1].clone();
}

/**
 * Sample points evenly along path
 *
 * @param points Array of Vector3 points
 * @param numSamples Number of samples to take
 * @returns Evenly spaced points along path
 */
export function samplePathEvenly(
  points: THREE.Vector3[],
  numSamples: number,
): THREE.Vector3[] {
  const totalLength = calculatePathLength(points);
  const sampledPoints: THREE.Vector3[] = [];

  for (let i = 0; i < numSamples; i++) {
    const distance = (i / (numSamples - 1)) * totalLength;
    const point = getPointAtDistance(points, distance);
    if (point) {
      sampledPoints.push(point);
    }
  }

  return sampledPoints;
}

/**
 * Create path geometry from points
 * Returns BufferGeometry for rendering
 *
 * @param points Array of Vector3 points
 * @returns BufferGeometry for the path
 */
export function createPathGeometry(
  points: THREE.Vector3[],
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  // Create position buffer
  const positions = new Float32Array(points.length * 3);

  points.forEach((point, index) => {
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return geometry;
}
