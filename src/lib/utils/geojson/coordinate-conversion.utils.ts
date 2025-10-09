/**
 * Coordinate Conversion Utilities
 * Functions for converting between lat/lon and 3D sphere coordinates
 * Extracted from geojson.utils.ts
 */

import { Vector3 } from 'three';

/**
 * Convert latitude/longitude to 3D coordinates on a sphere
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param radius Sphere radius
 * @returns Vector3 position on sphere
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = 2,
): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new Vector3(x, y, z);
}

/**
 * Convert longitude and latitude to 3D sphere coordinates
 * Alternative implementation with different parameter order
 * @param longitude Longitude in degrees
 * @param latitude Latitude in degrees
 * @param radius Sphere radius (default 2)
 * @param borderOffset Additional offset from surface (default 0.001)
 * @returns Vector3 position on sphere
 */
export function lonLatToSphere(
  longitude: number,
  latitude: number,
  radius: number = 2,
  borderOffset: number = 0.001,
): Vector3 {
  // Convert lat/lon to radians
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);

  // Add slight offset to prevent z-fighting
  const r = radius + borderOffset;

  // Calculate 3D position
  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const z = r * Math.sin(phi) * Math.sin(theta);
  const y = r * Math.cos(phi);

  return new Vector3(x, y, z);
}
