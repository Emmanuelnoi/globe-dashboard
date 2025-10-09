/**
 * Flyway Detection Utilities
 * Geographic algorithms to determine bird migration flyways
 *
 * @module flyway-detection.utils
 * @description Accurate flyway classification using geographic regions
 */

import { FlywayName } from '../models/migration.types';

/**
 * Geographic bounding box for a flyway region
 */
interface FlywayRegion {
  readonly name: FlywayName;
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
  readonly priority: number; // Higher priority wins in overlap cases
}

/**
 * Major flyway regions based on established migration routes
 * Data based on BirdLife International and Ramsar Convention classifications
 */
const FLYWAY_REGIONS: readonly FlywayRegion[] = [
  // Americas
  {
    name: 'Atlantic Americas',
    minLat: -60,
    maxLat: 80,
    minLon: -80,
    maxLon: -30,
    priority: 10,
  },
  {
    name: 'Pacific Americas',
    minLat: -60,
    maxLat: 70,
    minLon: -170,
    maxLon: -100,
    priority: 10,
  },
  {
    name: 'Mississippi Americas',
    minLat: 10,
    maxLat: 70,
    minLon: -110,
    maxLon: -80,
    priority: 9,
  },
  // Europe/Africa
  {
    name: 'East Atlantic',
    minLat: -35,
    maxLat: 70,
    minLon: -20,
    maxLon: 20,
    priority: 10,
  },
  {
    name: 'Black Sea/Mediterranean',
    minLat: 0,
    maxLat: 60,
    minLon: 20,
    maxLon: 60,
    priority: 9,
  },
  // Asia/Pacific
  {
    name: 'Central Asian',
    minLat: 20,
    maxLat: 70,
    minLon: 40,
    maxLon: 90,
    priority: 10,
  },
  {
    name: 'East Asia-Australasian',
    minLat: -50,
    maxLat: 70,
    minLon: 90,
    maxLon: 150,
    priority: 10,
  },
  {
    name: 'West Pacific',
    minLat: -50,
    maxLat: 60,
    minLon: 150,
    maxLon: 180,
    priority: 10,
  },
];

/**
 * Determine flyway from migration start and end coordinates
 * Uses geographic region matching with priority-based conflict resolution
 *
 * @param startLat Starting latitude
 * @param startLon Starting longitude
 * @param endLat Ending latitude
 * @param endLon Ending longitude
 * @returns Flyway name
 */
export function determineFlyway(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
): FlywayName {
  // Calculate midpoint of migration route
  const midLat = (startLat + endLat) / 2;
  const midLon = normalizeLongitude((startLon + endLon) / 2);

  // Find all matching regions
  const matchingRegions = FLYWAY_REGIONS.filter((region) =>
    isPointInRegion(midLat, midLon, region),
  );

  if (matchingRegions.length === 0) {
    // Fallback: Check start and end points separately
    const startMatches = FLYWAY_REGIONS.filter((region) =>
      isPointInRegion(startLat, normalizeLongitude(startLon), region),
    );

    const endMatches = FLYWAY_REGIONS.filter((region) =>
      isPointInRegion(endLat, normalizeLongitude(endLon), region),
    );

    // Prefer start location match, then end, then default
    if (startMatches.length > 0) {
      return selectHighestPriority(startMatches);
    }
    if (endMatches.length > 0) {
      return selectHighestPriority(endMatches);
    }

    // Default to Atlantic Americas
    return 'Atlantic Americas';
  }

  // Return highest priority matching region
  return selectHighestPriority(matchingRegions);
}

/**
 * Check if a point is within a flyway region
 */
function isPointInRegion(
  lat: number,
  lon: number,
  region: FlywayRegion,
): boolean {
  return (
    lat >= region.minLat &&
    lat <= region.maxLat &&
    lon >= region.minLon &&
    lon <= region.maxLon
  );
}

/**
 * Select the flyway region with highest priority
 */
function selectHighestPriority(regions: readonly FlywayRegion[]): FlywayName {
  return regions.reduce((highest, current) =>
    current.priority > highest.priority ? current : highest,
  ).name;
}

/**
 * Normalize longitude to -180 to 180 range
 */
function normalizeLongitude(lon: number): number {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

/**
 * Calculate great circle distance between two points
 * Uses Haversine formula
 *
 * @param lat1 Starting latitude
 * @param lon1 Starting longitude
 * @param lat2 Ending latitude
 * @param lon2 Ending longitude
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
